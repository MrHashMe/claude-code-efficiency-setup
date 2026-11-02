// Plan (06 section 6.1): desired items for the enabled components, diffed against the targets and the
// scope's ownership records. A plan is rows plus a hash; apply recomputes it and refuses a stale one.
import { basename, join, relative } from 'node:path';
import { BUDGET, loadFragments, renderRules } from './content.mjs';
import { confirmedCommands, desiredIdent, provided } from './cross.mjs';
import { toPointer } from './jsonc.mjs';
import { v7Migration } from './migrate.mjs';
import { RULES_REL, TEXT, current, hashOf, keyOf, markersOf, ownership, readLock, withConfigDir } from './owned.mjs';
import { blockedBy, readPolicy } from './policy.mjs';
import { loadRegistry } from './registry.mjs';
import { resolveScope } from './scopes.mjs';
import { loadState } from './state.mjs';
import { ENGINE, canonical, displayPath, fail, finding, isInside, privateDir, readJson, readText, sha256, slash, textHash, tokens, toolPath, valueHash, writeJson } from './util.mjs';

const ORDER = ['file', 'block', 'key', 'entry', 'plugin', 'dir'];
const WRITES = new Set(['create', 'update']);

// v7 settings and plugins that still hold a value make their v8 component enabled, so the plan adopts them.
function migratedComponents(reg, sc, adopt) {
  const pointers = (c) => [
    ...Object.keys(c.agents.claude?.settings ?? {}),
    ...(c.agents.claude?.install ?? []).map((i) => toPointer(['enabledPlugins', i.plugin])),
  ];
  return reg.components
    .filter((c) => pointers(c).some((p) => adopt.has(p) && current({ kind: 'key', target: sc.settings, pointer: p }) !== undefined))
    .map((c) => c.id);
}

function enabledSet(reg, sc, { owned, lock, state, migrated }, inputs, findings) {
  const here = (c) => Boolean(c?.agents.claude?.scopes.includes(sc.scope));
  const enabled = new Set();
  // The project lock is committed by someone else: a "recommended" that isn't a list is reported, not trusted.
  const listed = lock?.recommended;
  if (listed !== undefined && !Array.isArray(listed)) {
    findings.push(finding('warn', 'EP-LOCK-INVALID', `${displayPath(sc.lockFile, sc)}: "recommended" should be a list of component ids, so it is ignored`));
  }
  const recommended = new Set((Array.isArray(listed) ? listed : []).filter((id) => reg.byId.has(id)));
  for (const id of [...inputs.with, ...inputs.without]) {
    if (!reg.byId.has(id)) throw fail('EP-USAGE', `unknown component "${id}"; docs/decisions.md lists them`, { exit: 2 });
  }
  if (inputs.mode === 'uninstall') return { enabled, recommended: new Set() };
  for (const c of reg.components) if (c.defaultOn && here(c) && (inputs.profile !== 'minimal' || c.verdict === 'Adopt')) enabled.add(c.id);
  // A component another scope provides stays enabled here, so the next plan restores it if that stops.
  const sticky = [...[...owned.values()].flatMap((o) => [o.component, ...(o.includes ?? [])]), ...state.satisfiedBy.map((s) => s.component)];
  for (const id of [...sticky, ...Object.keys(lock?.components ?? {}), ...migrated]) if (here(reg.byId.get(id))) enabled.add(id);
  for (const id of state.optedOut) if (!inputs.with.includes(id)) enabled.delete(id);
  for (const id of inputs.with) {
    const c = reg.byId.get(id);
    if (here(c)) enabled.add(id);
    else if (sc.scope === 'project' && c.agents.claude?.scopes.length) {
      recommended.add(id);
      findings.push(finding('info', 'EP-RECOMMENDED', `${id} runs hooks, keeps per-user state or needs a machine tool, so the project lock recommends it; each person adds it at user or local scope`));
    } else {
      throw fail('EP-USAGE', `${id} can't be installed at ${sc.scope} scope (verdict ${c.verdict}; scopes: ${c.agents.claude?.scopes.join(', ') || 'none'})`, { exit: 2 });
    }
  }
  for (const id of inputs.without) {
    enabled.delete(id);
    recommended.delete(id);
  }
  const claims = new Map();
  for (const id of enabled) {
    const c = reg.byId.get(id);
    if (c.exclusive) for (const role of c.roles) claims.set(role, [...(claims.get(role) ?? []), id]);
  }
  for (const [role, ids] of claims) {
    if (ids.length > 1) throw fail('EP-ROLE-CONFLICT', `${ids.join(' and ')} both claim the "${role}" role; pass --without for one of them`, { exit: 2 });
  }
  return { enabled, recommended };
}

// have: what other scopes already load here (local scope only); those fragments and settings are left
// out and listed in satisfied instead.
function desired(ctx, sc, reg, { enabled, recommended, answers, fragments, have }, findings) {
  const items = [];
  const satisfied = [];
  const skip = new Set();
  for (const f of fragments) {
    const scopes = have.get(`fragment:${f.id}`);
    if (!scopes || !enabled.has(f.when) || !f.scopes.includes(sc.scope)) continue;
    skip.add(f.id);
    satisfied.push({ item: `fragment:${f.id}`, component: f.when, scopes });
  }
  const text = renderRules(fragments, sc.scope, enabled, answers, skip);
  const includes = [...enabled].filter((id) => fragments.some((f) => f.when === id && f.scopes.includes(sc.scope) && !skip.has(f.id))).sort();
  if (text) items.push({ kind: 'file', target: sc.rulesFile, text, component: 'core', includes, tokens: tokens(text) });
  const push = (it) => {
    const scopes = have.get(desiredIdent(it));
    if (scopes) satisfied.push({ item: desiredIdent(it), component: it.component, scopes });
    else items.push(it);
  };
  for (const id of [...enabled].sort()) {
    const c = reg.byId.get(id);
    const claude = c.agents.claude;
    for (const f of claude.content ?? []) {
      if (f.startsWith('content/rules/')) continue;
      const body = readText(join(ctx.root, f));
      if (body == null) throw fail('EP-CONTENT', `${f} is missing from the package`, { exit: 3 });
      items.push({ kind: 'file', target: join(sc.configDir, 'efficiency-playbook', basename(f)), text: body, component: id });
    }
    for (const [ptr, raw] of Object.entries(claude.settings ?? {})) {
      const value = withConfigDir(raw, sc.configDir);
      push(
        ptr.endsWith('/-')
          ? { kind: 'entry', target: sc.settings, pointer: ptr.slice(0, -2), value, component: id, tokens: c.alwaysLoaded.perSessionTokens }
          : { kind: 'key', target: sc.settings, pointer: ptr, value, component: id },
      );
    }
    const found = (claude.install ?? []).filter((i) => !i.bin || toolPath(i.bin, ctx.env));
    if (claude.install?.length && !found.length) findings.push(finding('info', 'EP-TOOL-NONE', `${id}: none of its tools is installed, so no plugin is planned`));
    found.forEach((inst, k) => {
      const pointer = toPointer(['enabledPlugins', inst.plugin]);
      push({ kind: 'plugin', target: sc.settings, pointer, value: true, plugin: inst, component: id, tokens: k ? 0 : c.alwaysLoaded.perSessionTokens });
    });
  }
  if (sc.lockFile && enabled.size) {
    const components = Object.fromEntries([...enabled].sort().map((id) => [id, {}]));
    const lock =
      sc.scope === 'project'
        ? { engine: ENGINE, agents: ['claude'], components, files: text ? { [RULES_REL]: textHash(text) } : {}, recommended: [...recommended].sort() }
        : { engine: ENGINE, scope: 'user', components };
    items.push({ kind: 'file', target: sc.lockFile, text: JSON.stringify(lock, null, 2) + '\n', component: 'core' });
  }
  if (sc.scope === 'local' && items.length) {
    const rel = (p) => '/' + slash(relative(sc.repo, p));
    const [open, close] = markersOf(sc.blockId);
    items.push({ kind: 'block', id: sc.blockId, target: sc.exclude, text: [open, rel(sc.rulesFile), rel(sc.settings), close].join('\n'), component: 'core' });
  }
  return { items: items.map((it) => ({ ...it, key: keyOf(sc, it) })), satisfied };
}

function diffDesired(items, owned, v7) {
  const rows = [];
  for (const it of items) {
    const cur = current(it);
    const before = hashOf(it, cur);
    const after = hashOf(it, TEXT.has(it.kind) ? it.text : it.value);
    const o = owned.get(it.key);
    if (before === after) {
      // Equal but unowned is the user's own setup and is never claimed, unless v7 recorded writing it.
      const prior = !o && it.pointer ? v7?.adopt.get(it.pointer) : undefined;
      if (prior) rows.push({ it: { ...it, prior }, op: 'adopt', cur, before, after, status: 'proposed' });
      continue;
    }
    const status = before === null || o?.ownedHash === before ? 'proposed' : 'conflict';
    rows.push({ it, op: before === null ? 'create' : 'update', cur, before, after, status });
  }
  return rows;
}

function diffOwned(items, owned, findings, sc) {
  const wanted = new Set(items.map((i) => i.key));
  const rows = [];
  for (const o of owned.values()) {
    if (wanted.has(o.key)) continue;
    const cur = current(o);
    const before = hashOf(o, cur);
    let op = before === null ? 'disown' : o.kind !== 'plugin' && o.prior?.exists ? 'restore' : 'remove';
    // The saved copy of the file the install replaced is gone: say so, and offer to remove the playbook's version.
    // Saved copies live in the state folder; a record naming any other file counts as gone and is never read.
    const file = o.kind === 'file' || o.kind === 'dir';
    const saved = op === 'restore' && file && o.prior.backup && isInside(o.prior.backup, sc.dir) ? readText(o.prior.backup) : null;
    if (op === 'restore' && file && saved == null) {
      findings.push(finding('warn', 'EP-BACKUP-MISSING', `${displayPath(o.target, sc)}: the saved copy of the file the install replaced is gone, so it can't be put back; removing the playbook's version leaves the path empty`));
      op = 'remove';
    }
    const after = op !== 'restore' ? null : o.kind === 'file' ? textHash(saved) : valueHash(o.prior.value);
    rows.push({ it: o, op, cur, before, after, status: before === null || before === o.ownedHash ? 'proposed' : 'conflict' });
  }
  return rows;
}

function diffV7(sc, v7) {
  return (v7?.removals ?? []).flatMap((r) => {
    const it = { ...r, key: keyOf(sc, r), component: 'v7' };
    const cur = current(it);
    const before = hashOf(it, cur);
    return before === null ? [] : [{ it, op: 'remove', cur, before, after: null, status: r.unchanged ? 'proposed' : 'conflict', group: 'migration' }];
  });
}

// Marketplace before plugin, script before the hook that runs it, a v7 hook before the script it runs.
function needs(r, x) {
  const same = x.it.component === r.it.component;
  if (r.it.kind === 'plugin' && WRITES.has(r.op)) {
    return same && x.it.kind === 'key' && WRITES.has(x.op) && x.it.pointer === toPointer(['extraKnownMarketplaces', r.it.plugin.marketplace]);
  }
  if (r.it.kind === 'entry' && WRITES.has(r.op)) return same && x.it.kind === 'file' && WRITES.has(x.op);
  if (r.group === 'migration' && r.it.kind !== 'entry') {
    return x.group === 'migration' && x.it.kind === 'entry' && JSON.stringify(x.it.value).includes(slash(r.it.target));
  }
  return false;
}

const summary = (it, v) => {
  if (v === undefined) return 'absent';
  if (TEXT.has(it.kind)) return `${Buffer.byteLength(v)} bytes`;
  if (it.pointer?.startsWith('/env/')) return 'set';
  const s = JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 77)}...` : s;
};

function publicRow(r, reg, sc) {
  const c = reg.byId.get(r.it.component);
  const want = TEXT.has(r.it.kind) ? r.it.text : r.it.value;
  return {
    id: r.id,
    key: r.it.key,
    group: r.group ?? (c ? c.id : 'core'),
    component: r.it.component,
    kind: r.it.kind,
    target: displayPath(r.it.target, sc),
    pointer: r.it.pointer ?? null,
    op: r.op,
    status: r.status,
    ...(r.reason ? { reason: r.reason } : {}),
    default: r.status === 'proposed',
    before: { hash: r.before, summary: summary(r.it, r.cur) },
    after: { hash: r.after, summary: r.after === null ? 'absent' : r.op === 'restore' ? 'value before install' : summary(r.it, want) },
    alwaysLoadedTokens: r.it.tokens ?? 0,
    verdict: c?.verdict ?? null,
    evidence: c?.evidence.map((e) => e.id) ?? [],
    egress: c?.egress.default ?? 'none',
    reversible: c?.reversible ?? true,
    requires: r.requires,
  };
}

export function buildPlan(ctx, inputs) {
  const sc = resolveScope(inputs.scope, ctx);
  const reg = loadRegistry(ctx.root);
  if (reg.errors.length) throw fail('EP-REGISTRY', `registry errors:\n${reg.errors.join('\n')}`, { exit: 3 });
  const fragments = loadFragments(ctx.root);
  const state = loadState(sc);
  const lock = readLock(sc);
  const owned = ownership(sc, state, lock);
  const v7 = sc.scope === 'user' && inputs.mode !== 'uninstall' ? v7Migration(sc) : null;
  const findings = [...(v7?.findings ?? [])];
  const migrated = v7 ? migratedComponents(reg, sc, v7.adopt) : [];
  const { enabled, recommended } = enabledSet(reg, sc, { owned, lock, state, migrated }, inputs, findings);
  let answers = inputs.answers ?? {};
  if (enabled.has('command-map')) {
    const filled = confirmedCommands(sc, answers);
    if (filled) answers = filled;
    else {
      enabled.delete('command-map');
      findings.push(finding('info', 'EP-ANSWER-NEEDED', 'the command map needs your quick-check and full-acceptance commands: pass --answers <file> containing {"commandMap":{"quick":["..."],"full":["..."]}}'));
    }
  }
  const have = inputs.mode === 'uninstall' ? new Map() : provided(ctx, sc, fragments, answers, (message) => findings.push(finding('warn', 'EP-STATE-CORRUPT', `${message}; until then it counts as providing nothing`)));
  const { items, satisfied } = desired(ctx, sc, reg, { enabled, recommended, answers, fragments, have }, findings);
  const rules = items.find((i) => i.target === sc.rulesFile);
  if (rules && rules.tokens > BUDGET[sc.scope]) findings.push(finding('warn', 'EP-BUDGET-EXCEEDED', `the rules file is about ${rules.tokens} tokens, over the ${sc.scope} budget of ${BUDGET[sc.scope]}`));
  const rank = (r) => ORDER.indexOf(r.it.kind);
  const all = [
    ...diffDesired(items, owned, v7).sort((a, b) => rank(a) - rank(b)),
    ...diffOwned(items, owned, findings, sc).sort((a, b) => rank(b) - rank(a)),
    ...diffV7(sc, v7).sort((a, b) => rank(b) - rank(a)),
  ];
  const { policy, findings: unreadable } = readPolicy(ctx.env);
  findings.push(...unreadable);
  const declined = new Set(state.declined.map((d) => `${d.key} ${d.hash}`));
  all.forEach((r, k) => {
    r.id = `r${String(k + 1).padStart(2, '0')}`;
    if (r.status === 'proposed' && declined.has(`${r.it.key} ${r.after}`)) r.status = 'declined';
    // U-4: a write the managed policy overrides or refuses is blocked, whatever its status was.
    r.reason = blockedBy(policy, r, reg.byId.get(r.it.component));
    if (!r.reason) return;
    r.status = 'blocked';
    findings.push(finding('info', 'EP-POLICY-BLOCKED', `${r.id} ${displayPath(r.it.target, sc)}${r.it.pointer ? `#${r.it.pointer}` : ''}: ${r.reason}`));
  });
  const live = all.filter((r) => r.status !== 'blocked');
  for (const r of all) r.requires = live.filter((x) => x !== r && needs(r, x)).map((x) => x.id);
  const rows = all.map((r) => publicRow(r, reg, sc));
  const options = reg.components
    .filter((c) => c.verdict === 'Trial' && !c.defaultOn && !enabled.has(c.id) && c.agents.claude?.scopes.includes(sc.scope))
    .map((c) => ({ id: c.id, name: c.name, alwaysLoadedTokens: c.alwaysLoaded.perSessionTokens, egress: c.egress.default, summary: c.summary, verdict: c.verdict, evidence: c.evidence.map((e) => e.id) }));
  return {
    sc,
    inputs,
    hash: sha256(canonical({ engine: ENGINE, scope: sc.key, rows, ...(satisfied.length ? { satisfied } : {}) })),
    rows,
    items: all.map((r) => r.it),
    enabled: [...enabled].sort(),
    recommended: [...recommended].sort(),
    options,
    alwaysLoadedTokens: items.reduce((n, i) => n + (i.tokens ?? 0), 0),
    migration: v7?.manifest ?? null,
    satisfied,
    findings,
  };
}

export function savePlan(ctx, plan) {
  privateDir(join(plan.sc.dir, 'plans'));
  writeJson(join(plan.sc.dir, 'plans', `${plan.hash.slice(7, 19)}.json`), { hash: plan.hash, createdAt: ctx.now().toISOString(), inputs: plan.inputs, rows: plan.rows });
}

export function readPlan(sc, wanted) {
  const hex = String(wanted ?? '').replace(/^sha256:/, '');
  if (!/^[0-9a-f]{12,64}$/.test(hex)) throw fail('EP-USAGE', '--plan takes the 12-character hash that plan printed', { exit: 2 });
  const saved = readJson(join(sc.dir, 'plans', `${hex.slice(0, 12)}.json`));
  if (!saved?.hash?.startsWith(`sha256:${hex}`)) throw fail('EP-USAGE', `no saved plan ${hex.slice(0, 12)} for ${sc.scope} scope here; run plan again`, { exit: 2 });
  return saved;
}
