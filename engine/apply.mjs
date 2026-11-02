// Apply and rollback (06 sections 6.2 and 6.3): recompute the plan, refuse a stale one, then change each
// approved row (rows.mjs says how). A row is journalled before it is changed (an intent record) and again when it
// is done, so rollback can undo a row that stopped half-way.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildPlan, readPlan, savePlan } from './plan.mjs';
import { current, hashOf } from './owned.mjs';
import { PREPARE, WRITES, pluginCommand, undoFile, undoSetting } from './rows.mjs';
import { gitChanges, mayWrite, resolveScope } from './scopes.mjs';
import { applyJournals, journal, loadState, newJournal, readJournal, saveState, withLock } from './state.mjs';
import { canonical, fail, finding, isInside, moveFile, readJson, samePath, writeJson } from './util.mjs';

const open = (r) => r.status !== 'conflict' && r.status !== 'blocked';

export function select(rows, approve) {
  const picks = new Set();
  const add = (list) => list.forEach((r) => picks.add(r.id));
  for (const a of String(approve ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (a === 'default') add(rows.filter((r) => r.status === 'proposed'));
    else if (a === 'all') add(rows.filter(open));
    else if (a.startsWith('group:')) {
      const group = a.slice(6);
      if (!rows.some((r) => r.group === group)) {
        throw fail('EP-USAGE', `--approve: no row is in the group "${group}"; the groups in this plan are ${[...new Set(rows.map((r) => r.group))].join(', ')}`, { exit: 2 });
      }
      add(rows.filter((r) => r.group === group && open(r)));
    } else {
      const r = rows.find((x) => x.id === a);
      if (!r) throw fail('EP-USAGE', `--approve: no row or selector "${a}"; use default, all, group:<name> or row ids (conflicts only by id)`, { exit: 2 });
      // U-4: the policy wins over every scope, so not even approval by id applies a blocked row.
      if (r.status === 'blocked') throw fail('EP-POLICY-BLOCKED', `${a} is blocked: ${r.reason}`, { exit: 3 });
      picks.add(a);
    }
  }
  return picks;
}

const recordBase = (row, it) => ({
  row: row.id,
  key: row.key,
  kind: row.kind,
  op: row.op,
  target: it.target,
  ...(it.pointer ? { pointer: it.pointer } : {}),
  ...(it.plugin ? { plugin: it.plugin } : {}),
  ...(it.id ? { id: it.id } : {}),
});

// The approved rows in plan order. EP_FAULT_AFTER stops between rows, EP_FAULT_MID inside a row after its change
// and before its records: crashes the tests and the self-test use to prove rollback.
function applyRows(cx, plan, picks, start, j) {
  const { ctx, sc } = cx;
  const [fault, mid] = ['EP_FAULT_AFTER', 'EP_FAULT_MID'].map((n) => (ctx.env[n] == null ? -1 : Number(ctx.env[n])));
  const [results, findings, notDone] = [[], [], new Set()];
  let state = start;
  let done = 0;
  for (const [k, row] of plan.rows.entries()) {
    if (!picks.has(row.id)) continue;
    const it = plan.items[k];
    const base = recordBase(row, it);
    const skip = (type, status, message, severity, code) => {
      notDone.add(row.id);
      j.write({ type, ...base, message });
      results.push({ row: row.id, status, message });
      findings.push(finding(severity, code, `${row.id} ${row.target}: ${message}`));
    };
    const missing = row.requires.find((r) => !picks.has(r) || notDone.has(r));
    if (missing) {
      skip('skip', 'skipped', `needs ${missing}, which wasn't applied`, 'warn', 'EP-ROW-SKIPPED');
      continue;
    }
    if (done === fault) throw fail('EP-FAULT', `fault injected after ${done} rows (EP_FAULT_AFTER)`);
    if (!mayWrite(sc, it.target)) {
      skip('blocked', 'blocked', `outside what ${sc.scope} scope may write`, 'error', 'EP-PATH-REFUSED');
      continue;
    }
    if (hashOf(it, current(it)) !== row.before.hash) {
      skip('stale', 'stale', 'changed since the plan was made; plan again', 'warn', 'EP-ROW-STALE');
      continue;
    }
    try {
      const step = PREPARE[it.kind](cx, row, it, state.items.find((i) => i.key === row.key));
      const rec = { ...base, before: row.before.hash, after: row.after.hash, ...(it.probe ? { probe: it.probe } : {}), ...step.rec };
      if (step.run) j.write({ type: 'intent', ...rec });
      const out = step.run?.() ?? {};
      if (step.run && done === mid) throw fail('EP-FAULT', `fault injected inside row ${row.id} (EP_FAULT_MID)`, { exit: 3 });
      state = step.state(state);
      saveState(sc, state);
      if (out.manual) {
        notDone.add(row.id);
        j.write({ type: 'manual', ...base, commands: out.manual });
        results.push({ row: row.id, status: 'manual', commands: out.manual });
        findings.push(finding('info', 'EP-MANUAL-STEP', `${row.id}: run ${out.manual.map((c) => `"${c}"`).join(', then ')}`));
        continue;
      }
      j.write({ type: 'done', ...rec });
      results.push({ row: row.id, status: 'done' });
      done++;
    } catch (e) {
      if (e.exit === 3) throw e;
      skip('failed', 'failed', e.message, 'error', e.code ?? 'EP-ROW-FAILED');
    }
  }
  return { state, results, findings };
}

export function apply(ctx, { scope = 'user', plan: wanted, approve }) {
  const sc = resolveScope(scope, ctx);
  const saved = readPlan(sc, wanted);
  return withLock(sc, () => {
    const plan = buildPlan(ctx, saved.inputs);
    if (plan.hash !== saved.hash) {
      savePlan(ctx, plan);
      throw fail('EP-STALE-PLAN', `targets changed since plan ${saved.hash.slice(7, 19)}; review the fresh plan ${plan.hash.slice(7, 19)} and approve again`, { exit: 4, data: { fresh: plan.hash.slice(7, 19), rows: plan.rows } });
    }
    if (!plan.rows.length) {
      // S-2: what other scopes provide is still recorded, so verify can tell when that stops.
      const st = loadState(sc);
      if (canonical(st.satisfiedBy) !== canonical(plan.satisfied)) saveState(sc, { ...st, satisfiedBy: plan.satisfied });
      return { data: { journal: null, results: [], message: 'nothing to do' }, findings: plan.findings };
    }
    const picks = select(plan.rows, approve);
    if (!picks.size) throw fail('EP-USAGE', '--approve selected no rows', { exit: 2 });
    const start = loadState(sc);
    const j = newJournal(sc, ctx.now());
    writeJson(join(sc.dir, 'journal', `${j.id}.state-before.json`), start);
    j.write({ type: 'begin', plan: plan.hash, scope: sc.key, ...(sc.repo ? { worktree: sc.repo } : {}) });
    const ran = applyRows({ ctx, sc, id: j.id, backed: new Set() }, plan, picks, start, j);
    const unpicked = plan.rows.filter((r) => !picks.has(r.id) && open(r) && (WRITES.has(r.op) || r.op === 'adopt'));
    const touched = new Set(plan.rows.map((r) => r.key));
    const state = {
      ...ran.state,
      declined: [...ran.state.declined.filter((d) => !touched.has(d.key)), ...unpicked.map((r) => ({ key: r.key, hash: r.after.hash }))],
      optedOut: [...new Set([...ran.state.optedOut.filter((x) => !saved.inputs.with.includes(x)), ...saved.inputs.without])].sort(),
      satisfiedBy: plan.satisfied,
      migratedFrom: ran.results.some((r) => r.status === 'done' && plan.rows.find((x) => x.id === r.row).group === 'migration') ? plan.migration : ran.state.migratedFrom,
    };
    saveState(sc, state);
    j.write({ type: 'end' });
    const wrote = plan.rows.flatMap((r, k) => (ran.results.some((x) => x.row === r.id && x.status === 'done') ? [plan.items[k].target] : []));
    const git = sc.scope === 'project' ? gitChanges(sc, wrote, ctx.env) : null;
    return { data: { journal: j.id, results: ran.results, rollback: `rollback --scope ${sc.scope} --last`, ...(git ? { git } : {}) }, findings: [...plan.findings, ...ran.findings] };
  });
}

// Reverse one journalled row. True: put back, or it was never changed, so undoing twice does no harm. False: the
// target changed since the apply and is left as it is. A list: commands to run by hand.
function undo(ctx, sc, id, rec) {
  if (rec.op === 'adopt' || rec.op === 'disown') return true;
  // A journal is a file on disk like any other: what it names must still be something this scope may write and keep.
  if (!mayWrite(sc, rec.target)) throw fail('EP-PATH-REFUSED', `${rec.target} is outside what ${sc.scope} scope may write`);
  for (const p of [rec.backup, rec.quarantine]) if (p && !isInside(p, sc.dir)) throw fail('EP-PATH-REFUSED', `${p} is outside this scope's state folder`);
  const it = { kind: rec.kind, target: rec.target, pointer: rec.pointer, probe: rec.probe, id: rec.id, value: rec.undo?.entry };
  const now = hashOf(it, current(it));
  if (now === rec.before && now !== rec.after) return true;
  if (now !== rec.after) {
    // Moved aside and the file that replaces it never written: the moved one comes back.
    if (now !== null || !rec.quarantine || !existsSync(rec.quarantine)) return false;
    moveFile(rec.quarantine, rec.target);
    return true;
  }
  if (rec.kind === 'plugin') return pluginCommand({ ctx, sc }, { ...it, plugin: rec.plugin }, !WRITES.has(rec.op)).manual ?? true;
  if (rec.kind === 'file' || rec.kind === 'dir') undoFile(sc, id, rec);
  else undoSetting(sc, id, rec);
  return true;
}

// Rows to undo, newest first: every row that has a change journalled. The done record is the one used when there is
// one; a row that stopped before it has only its intent record. A row that ended in a manual step was never changed.
function undoable(recs) {
  const manual = new Set(recs.filter((r) => r.type === 'manual').map((r) => r.row));
  const latest = new Map();
  for (const r of recs) if ((r.type === 'intent' || r.type === 'done') && !manual.has(r.row)) latest.set(r.row, r);
  return [...latest.values()].reverse();
}

export function rollback(ctx, { scope = 'user', last, to }) {
  const sc = resolveScope(scope, ctx);
  return withLock(sc, () => {
    const file = (id) => join(sc.dir, 'journal', `${id}.jsonl`);
    const open = applyJournals(sc).filter((id) => !readJournal(file(id)).some((r) => r.type === 'rolled-back'));
    let ids;
    if (to) {
      const k = open.indexOf(to);
      if (k < 0) throw fail('EP-USAGE', `no journal "${to}" that isn't rolled back yet; show --scope ${scope} lists them`, { exit: 2 });
      ids = open.slice(k).reverse();
    } else if (last) ids = open.slice(-1);
    else throw fail('EP-USAGE', 'rollback needs --last or --to <journal id>', { exit: 2 });
    if (!ids.length) throw fail('EP-USAGE', 'nothing to roll back', { exit: 2 });
    const [findings, undone, closed] = [[], [], []];
    for (const id of ids) {
      const recs = readJournal(file(id));
      const begin = recs.find((r) => r.type === 'begin');
      if (begin?.worktree && !(sc.repo && samePath(begin.worktree, sc.repo))) throw fail('EP-USAGE', `journal ${id} belongs to ${begin.worktree}; run rollback there`, { exit: 2 });
      const rj = newJournal(sc, ctx.now(), '-rollback');
      rj.write({ type: 'begin', of: id });
      let failed = 0;
      for (const rec of undoable(recs)) {
        try {
          const r = undo(ctx, sc, rj.id, rec);
          if (r === false) findings.push(finding('warn', 'EP-ROLLBACK-SKIPPED', `${rec.row} ${rec.target}: changed since ${id}, left as it is`));
          else if (Array.isArray(r)) findings.push(finding('info', 'EP-MANUAL-STEP', `${rec.row}: run ${r.map((c) => `"${c}"`).join(', then ')}`));
          else undone.push(`${id}/${rec.row}`);
          rj.write({ type: r === false ? 'skip' : 'done', row: rec.row, key: rec.key });
        } catch (e) {
          failed++;
          rj.write({ type: 'failed', row: rec.row, key: rec.key, message: e.message });
          findings.push(finding('error', 'EP-ROLLBACK-FAILED', `${rec.row} ${rec.target}: ${e.message}`));
        }
      }
      rj.write({ type: 'end' });
      // A row still applied keeps this journal open and the saved records as they are; fix it and roll back again.
      // Older journals wait too: their records assume this one is undone.
      if (failed) break;
      const snapFile = join(sc.dir, 'journal', `${id}.state-before.json`);
      try {
        const snapshot = readJson(snapFile);
        if (snapshot) saveState(sc, snapshot);
      } catch (e) {
        if (e.code) throw e;
        findings.push(finding('warn', 'EP-STATE-CORRUPT', `${snapFile} isn't valid JSON, so the saved records were left as they are; plan shows what remains`));
      }
      journal(sc, id).write({ type: 'rolled-back', by: rj.id });
      closed.push(id);
    }
    return { data: { rolledBack: closed, undone }, findings };
  });
}
