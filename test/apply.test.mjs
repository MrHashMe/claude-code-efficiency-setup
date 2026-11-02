import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { rollback, select } from '../engine/apply.mjs';
import { getValue, setValue } from '../engine/jsonc.mjs';
import { loadRegistry } from '../engine/registry.mjs';
import { writeChecked } from '../engine/rows.mjs';
import { resolveScope } from '../engine/scopes.mjs';
import { snapshot } from '../engine/selftest.mjs';
import { loadState, readJournal } from '../engine/state.mjs';
import { samePath, slash, textHash } from '../engine/util.mjs';
import { verify } from '../engine/verify.mjs';
import { NOW, ROOT, applyPlan, codes, gitRepo, plan, planApply, sandbox } from './helpers.mjs';

// Rewrites each record of a journal file, the way a damaged or doctored journal would read.
const rewrite = (file, fn) => writeFileSync(file, readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.stringify(fn(JSON.parse(l)))).join('\n') + '\n');

test('a target changed after plan stops apply with exit 4 and a fresh plan', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const p = plan(s.ctx, { with: ['autocompact'] });
  s.write('settings.json', '{ "autoCompactWindow": 100000 }\n');
  assert.throws(() => applyPlan(s.ctx, p), (e) => e.code === 'EP-STALE-PLAN' && e.exit === 4 && e.data.fresh !== p.hash.slice(7, 19));
});

test('a value the user set is a conflict: only approval by id changes it, and uninstall restores it', (t) => {
  const original = '{\n  // mine\n  "autoCompactWindow": 100000\n}\n';
  const s = sandbox(t, { settings: original });
  const p = plan(s.ctx, { with: ['autocompact'] });
  const row = p.rows.find((r) => r.pointer === '/autoCompactWindow');
  assert.equal(row.status, 'conflict');
  applyPlan(s.ctx, p, 'all');
  assert.equal(getValue(s.read('settings.json'), '/autoCompactWindow'), 100000, '"all" never includes conflicts');
  const p2 = plan(s.ctx);
  assert.deepEqual(p2.rows.map((r) => r.status), ['conflict'], 'autocompact stays planned without --with');
  applyPlan(s.ctx, p2, p2.rows[0].id);
  assert.equal(getValue(s.read('settings.json'), '/autoCompactWindow'), 300000);
  assert.match(s.read('settings.json'), /\/\/ mine/, 'comments survive');
  planApply(s.ctx, { mode: 'uninstall' });
  assert.equal(s.read('settings.json'), original);
});

test('uninstall moves a replaced file to quarantine and puts the user version back', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  s.write('rules/efficiency-playbook.md', 'my own rules\n');
  const p = plan(s.ctx);
  const row = p.rows.find((r) => r.target.endsWith('rules/efficiency-playbook.md'));
  assert.equal(row.status, 'conflict');
  applyPlan(s.ctx, p, `default,${row.id}`);
  assert.match(s.read('rules/efficiency-playbook.md'), /^# Working rules/);
  const { plan: un } = planApply(s.ctx, { mode: 'uninstall' });
  assert.ok(un.rows.some((r) => r.op === 'restore'));
  assert.equal(s.read('rules/efficiency-playbook.md'), 'my own rules\n');
  const q = join(s.tmp, 'state', 'scopes', readdirSync(join(s.tmp, 'state', 'scopes'))[0], 'quarantine');
  assert.ok(readdirSync(q).length > 0, 'the engine version went to quarantine, not to the bin');
});

test('an apply that fails part-way shows in verify and rolls back to the original bytes', (t) => {
  const s = sandbox(t, { settings: '\uFEFF{\r\n  "model": "opus"\r\n}\r\n' });
  const before = snapshot(s.cfg);
  for (const k of [1, 2, 3, 4]) {
    const ctx = { ...s.ctx, env: { ...s.env, EP_FAULT_AFTER: String(k) } };
    const p = plan(ctx, { with: ['autocompact', 'nudge'] });
    assert.throws(() => applyPlan(ctx, p), { code: 'EP-FAULT' });
    assert.ok(codes(verify(s.ctx).findings).includes('EP-APPLY-INCOMPLETE'), `fault after ${k} rows`);
    rollback(s.ctx, { scope: 'user', last: true });
    assert.equal(snapshot(s.cfg), before, `fault after ${k} rows`);
    assert.ok(!codes(verify(s.ctx).findings).includes('EP-APPLY-INCOMPLETE'));
  }
});

test('settings keep their byte-order mark and CRLF line endings', (t) => {
  const s = sandbox(t, { settings: '\uFEFF{\r\n  "model": "opus"\r\n}\r\n' });
  planApply(s.ctx, { with: ['autocompact'] });
  const text = s.read('settings.json');
  assert.ok(text.startsWith('\uFEFF'));
  assert.ok(!/[^\r]\n/.test(text), 'every line ends in CRLF');
});

test('without an agent CLI, plugin rows print the commands to paste and still record ownership', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const { result } = planApply(s.ctx, { with: ['ponytail'] });
  const step = result.findings.find((f) => f.code === 'EP-MANUAL-STEP')?.message ?? '';
  const { source, ref } = loadRegistry(ROOT).byId.get('ponytail').agents.claude.install[0];
  assert.ok(ref, 'the registry pins the marketplace to a release');
  assert.ok(step.includes(`claude plugin marketplace add ${source}@${ref}`), `the pinned release is part of the command: ${step}`);
  assert.match(step, /claude plugin install ponytail@ponytail --scope user/);
  assert.deepEqual(plan(s.ctx).rows.map((r) => `${r.op} ${r.kind}`), ['create plugin'], 'the plugin row stays until the commands are run');
  s.write('settings.json', setValue(s.read('settings.json'), '/enabledPlugins/ponytail@ponytail', true));
  assert.equal(plan(s.ctx).rows.length, 0);
  const { result: un } = planApply(s.ctx, { mode: 'uninstall' });
  assert.match(un.findings.find((f) => f.code === 'EP-MANUAL-STEP')?.message ?? '', /claude plugin uninstall ponytail@ponytail --scope user --keep-data/);
});

test('apply never removes a plugin it did not install', (t) => {
  const s = sandbox(t, { settings: '{ "enabledPlugins": { "pyright-lsp@claude-plugins-official": true } }\n', bins: ['pyright-langserver'] });
  const p = plan(s.ctx);
  assert.ok(!p.rows.some((r) => r.kind === 'plugin'), 'already enabled by the user: no row');
  planApply(s.ctx);
  const un = plan(s.ctx, { mode: 'uninstall' });
  assert.ok(!un.rows.some((r) => r.kind === 'plugin'));
});

test('a held lock blocks apply with exit 3', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const p = plan(s.ctx);
  writeFileSync(join(p.sc.dir, 'lock'), String(process.pid));
  assert.throws(() => applyPlan(s.ctx, p), { code: 'EP-LOCKED', exit: 3 });
});

test('--approve with no matching row is a usage error', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const p = plan(s.ctx);
  assert.throws(() => applyPlan(s.ctx, p, 'r99'), { code: 'EP-USAGE', exit: 2 });
  assert.throws(() => applyPlan(s.ctx, p, 'group:none'), { code: 'EP-USAGE', exit: 2 });
});

test('--approve group:<name> takes the open rows of that group only, and a group nobody has is a usage error', () => {
  const rows = [
    { id: 'r01', group: 'g', status: 'proposed' },
    { id: 'r02', group: 'g', status: 'conflict' },
    { id: 'r03', group: 'g', status: 'blocked' },
    { id: 'r04', group: 'h', status: 'proposed' },
    { id: 'r05', group: 'g', status: 'declined' },
  ];
  assert.deepEqual([...select(rows, 'group:g')], ['r01', 'r05']);
  assert.deepEqual([...select(rows, 'default,group:h')], ['r01', 'r04']);
  assert.throws(() => select(rows, 'default,group:typo'), (e) => e.code === 'EP-USAGE' && e.exit === 2 && e.message.includes('typo'));
});

const COMMENTED = ['{', '  // keep me', '  "model": "opus", // inline', '  "hooks": {', '    // hook note', '  },', '  /* block note */', '  "permissions": { "allow": ["Read"] }', '}', ''].join('\n');

test('install and uninstall keep every comment in settings.json, uninstall gives back the original bytes, and the first edit is backed up', (t) => {
  const s = sandbox(t, { settings: COMMENTED });
  const { plan: p, result } = planApply(s.ctx, { with: ['autocompact', 'nudge'] });
  const after = s.read('settings.json');
  for (const c of ['// keep me', '// inline', '// hook note', '/* block note */']) assert.ok(after.includes(c), c);
  assert.equal(getValue(after, '/autoCompactWindow'), 300000);
  assert.equal(getValue(after, '/hooks/SessionStart').length, 1);
  const dir = join(p.sc.dir, 'backups', result.data.journal);
  const copies = readdirSync(dir).filter((n) => n.endsWith('-settings.json'));
  assert.equal(copies.length, 1, 'one copy of the file, taken before its first edit');
  assert.equal(readFileSync(join(dir, copies[0]), 'utf8'), COMMENTED);
  planApply(s.ctx, { mode: 'uninstall' });
  assert.equal(s.read('settings.json'), COMMENTED);
});

test('a hook entry joins a list you wrote without touching the rest of it, and leaves it as it was', (t) => {
  const own = '{\n  "hooks": {\n    "SessionStart": [\n      // mine\n      { "hooks": [{ "type": "command", "command": "echo hi" }] }\n    ]\n  }\n}\n';
  const s = sandbox(t, { settings: own });
  planApply(s.ctx, { with: ['nudge'] });
  const during = s.read('settings.json');
  assert.ok(during.includes('// mine') && during.includes('echo hi'));
  assert.equal(getValue(during, '/hooks/SessionStart').length, 2);
  planApply(s.ctx, { mode: 'uninstall' });
  assert.equal(s.read('settings.json'), own);
});

test('a rollback that cannot undo a row stays open, leaves the saved state alone, and finishes on the next try', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  s.write('rules/efficiency-playbook.md', 'my own rules\n');
  const before = snapshot(s.cfg);
  const p = plan(s.ctx, { with: ['autocompact'] });
  const rules = p.rows.find((r) => r.target.endsWith('rules/efficiency-playbook.md'));
  const { journal: id } = applyPlan(s.ctx, p, `default,${rules.id}`).data;
  const saved = join(p.sc.dir, 'backups', id);
  const copy = join(saved, readdirSync(saved).find((n) => n.endsWith('-efficiency-playbook.md')));
  const kept = readFileSync(copy, 'utf8');
  rmSync(copy);
  const log = () => readJournal(join(p.sc.dir, 'journal', `${id}.jsonl`));
  const first = rollback(s.ctx, { scope: 'user', last: true });
  assert.ok(codes(first.findings).includes('EP-ROLLBACK-FAILED'));
  assert.deepEqual(first.data.rolledBack, []);
  assert.ok(!log().some((r) => r.type === 'rolled-back'), 'the journal stays open');
  assert.ok(loadState(p.sc).items.length > 0, 'the saved state is not rewound while a row is still applied');
  writeFileSync(copy, kept);
  const second = rollback(s.ctx, { scope: 'user', last: true });
  assert.deepEqual(codes(second.findings), [], 'rows undone the first time are not reported again');
  assert.deepEqual(second.data.rolledBack, [id]);
  assert.equal(snapshot(s.cfg), before);
  assert.ok(log().some((r) => r.type === 'rolled-back'));
  assert.equal(loadState(p.sc).items.length, 0);
});

test('rollback leaves a value you changed after the apply, says so, and still closes the journal', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const { result } = planApply(s.ctx, { with: ['autocompact'] });
  s.write('settings.json', setValue(s.read('settings.json'), '/autoCompactWindow', 123456));
  const r = rollback(s.ctx, { scope: 'user', last: true });
  assert.deepEqual(codes(r.findings), ['EP-ROLLBACK-SKIPPED']);
  assert.equal(getValue(s.read('settings.json'), '/autoCompactWindow'), 123456);
  assert.deepEqual(r.data.rolledBack, [result.data.journal]);
});

test('rollback --to undoes that apply and every later one, newest first', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const before = snapshot(s.cfg);
  const a = planApply(s.ctx, { with: ['autocompact'] }).result.data.journal;
  const b = planApply(s.ctx, { with: ['nudge'] }).result.data.journal;
  const r = rollback(s.ctx, { scope: 'user', to: a });
  assert.deepEqual(r.data.rolledBack, [b, a]);
  assert.equal(snapshot(s.cfg), before);
  assert.throws(() => rollback(s.ctx, { scope: 'user', to: a }), { code: 'EP-USAGE', exit: 2 });
});

test('a crash inside a row, after its write and before its journal record, is rolled back too, a settings file the install was making included', (t) => {
  for (const settings of ['{\n  "model": "opus"\n}\n', undefined]) {
    const s = sandbox(t, { settings });
    const before = snapshot(s.cfg);
    for (const k of [0, 1, 2, 3, 4]) {
      const ctx = { ...s.ctx, env: { ...s.env, EP_FAULT_MID: String(k) } };
      const p = plan(ctx, { with: ['autocompact', 'nudge'] });
      assert.throws(() => applyPlan(ctx, p), { code: 'EP-FAULT' });
      assert.notEqual(snapshot(s.cfg), before, `row ${k} was written before the crash`);
      assert.ok(codes(verify(s.ctx).findings).includes('EP-APPLY-INCOMPLETE'), `crash in row ${k}`);
      rollback(s.ctx, { scope: 'user', last: true });
      assert.equal(snapshot(s.cfg), before, `crash in row ${k}, settings ${settings === undefined ? 'made by the install' : 'written by the user'}`);
    }
  }
});

test('a journal whose last line was cut short by a crash still shows as incomplete and rolls back', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const before = snapshot(s.cfg);
  const ctx = { ...s.ctx, env: { ...s.env, EP_FAULT_AFTER: '2' } };
  const p = plan(ctx, { with: ['autocompact'] });
  assert.throws(() => applyPlan(ctx, p), { code: 'EP-FAULT' });
  const dir = join(p.sc.dir, 'journal');
  const file = join(dir, readdirSync(dir).find((n) => n.endsWith('.jsonl')));
  writeFileSync(file, readFileSync(file, 'utf8') + '{"t":"2026-11-02T12:00:00.0');
  assert.ok(codes(verify(s.ctx).findings).includes('EP-APPLY-INCOMPLETE'));
  rollback(s.ctx, { scope: 'user', last: true });
  assert.equal(snapshot(s.cfg), before);
});

test('a lock left by a process that is gone is replaced; one held by a live process, or of unknown age, is not', (t) => {
  const dead = spawnSync(process.execPath, ['-e', '0']).pid;
  const old = new Date(Date.now() - 11 * 60 * 1000);
  const cases = [
    ['a dead process, lock just written', String(dead), false, null],
    ['a dead process, lock long ago', String(dead), true, null],
    ['no process id, lock long ago', 'junk', true, null],
    ['no process id, lock just written', 'junk', false, 'EP-LOCKED'],
    ['a live process, lock long ago', String(process.pid), true, 'EP-LOCKED'],
  ];
  for (const [why, content, aged, blocked] of cases) {
    const s = sandbox(t, { settings: '{}\n' });
    const p = plan(s.ctx);
    const lock = join(p.sc.dir, 'lock');
    writeFileSync(lock, content);
    if (aged) utimesSync(lock, old, old);
    if (blocked) {
      assert.throws(() => applyPlan(s.ctx, p), { code: blocked, exit: 3 }, why);
      continue;
    }
    applyPlan(s.ctx, p);
    assert.deepEqual(readdirSync(p.sc.dir).filter((n) => n.startsWith('lock')), [], `${why}: the lock is released and no takeover file is left`);
  }
});

test('a row you leave out is declined: later plans show it so and a default apply skips it', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const p = plan(s.ctx, { with: ['autocompact'] });
  const key = p.rows.find((r) => r.pointer === '/autoCompactWindow');
  applyPlan(s.ctx, p, p.rows.filter((r) => r !== key).map((r) => r.id).join(','));
  const again = plan(s.ctx);
  assert.deepEqual(again.rows.map((r) => [r.pointer, r.status, r.default]), [['/autoCompactWindow', 'declined', false]]);
  assert.throws(() => applyPlan(s.ctx, again), { code: 'EP-USAGE', exit: 2 });
  applyPlan(s.ctx, again, again.rows[0].id);
  assert.equal(getValue(s.read('settings.json'), '/autoCompactWindow'), 300000);
  assert.equal(plan(s.ctx).rows.length, 0);
});

test('a row whose prerequisite row was not approved is skipped, and the file is left alone', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const p = plan(s.ctx, { with: ['nudge'] });
  const hook = p.rows.find((r) => r.kind === 'entry');
  assert.ok(hook.requires.length > 0, 'the hook entry waits for its script');
  const r = applyPlan(s.ctx, p, hook.id);
  assert.deepEqual(r.data.results.map((x) => x.status), ['skipped']);
  assert.ok(codes(r.findings).includes('EP-ROW-SKIPPED'));
  assert.equal(s.read('settings.json'), '{}\n');
});

test('a target that changes while apply runs is reported as stale and left as it is', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const p = plan(s.ctx, { with: ['autocompact'] });
  const ctx = {
    ...s.ctx,
    now: () => {
      s.write('settings.json', '{ "autoCompactWindow": 5 }\n');
      return NOW;
    },
  };
  const r = applyPlan(ctx, p);
  assert.ok(codes(r.findings).includes('EP-ROW-STALE'));
  assert.equal(getValue(s.read('settings.json'), '/autoCompactWindow'), 5);
});

test('an edit that leaves the file unparsable is put back, and a new unparsable file goes to quarantine', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const sc = resolveScope('user', s.ctx);
  assert.throws(() => writeChecked(sc, 'j1', 'r01', join(s.cfg, 'settings.json'), '{ "a": ', '{}\n'), { code: 'EP-PARSE-REVERTED' });
  assert.equal(s.read('settings.json'), '{}\n');
  const fresh = join(s.cfg, 'new.json');
  assert.throws(() => writeChecked(sc, 'j1', 'r02', fresh, '{ "a": ', null), { code: 'EP-PARSE-REVERTED' });
  assert.ok(!existsSync(fresh));
  assert.ok(existsSync(join(sc.dir, 'quarantine', 'j1', 'r02-unparsable-new.json')));
});

test('rollback refuses a journal record that points outside what the scope may write or keep', (t) => {
  const doctored = {
    'a target outside the config folder': (victim, loot) => ({ target: victim, after: textHash('precious\n'), backup: loot }),
    'a backup outside the state folder': (victim, loot) => ({ backup: loot }),
  };
  for (const [why, change] of Object.entries(doctored)) {
    const s = sandbox(t, { settings: '{}\n' });
    const { plan: p, result } = planApply(s.ctx);
    const [victim, loot] = [join(s.home, 'victim.txt'), join(s.home, 'loot.txt')];
    writeFileSync(victim, 'precious\n');
    writeFileSync(loot, 'planted\n');
    const rules = readFileSync(join(s.cfg, 'rules', 'efficiency-playbook.md'), 'utf8');
    rewrite(join(p.sc.dir, 'journal', `${result.data.journal}.jsonl`), (r) => (r.type === 'done' && slash(r.target).endsWith('rules/efficiency-playbook.md') ? { ...r, ...change(victim, loot) } : r));
    const out = rollback(s.ctx, { scope: 'user', last: true });
    assert.ok(codes(out.findings).includes('EP-ROLLBACK-FAILED'), why);
    assert.equal(readFileSync(victim, 'utf8'), 'precious\n', why);
    assert.equal(s.read('rules/efficiency-playbook.md'), rules, why);
  }
});

test('plugin commands at user scope run from the home folder, not from the repository you are standing in', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const repo = gitRepo(s);
  s.write('plugins/known_marketplaces.json', JSON.stringify({ ponytail: { source: { source: 'github', repo: 'DietrichGebert/ponytail' } } }));
  const [probe, seen] = [join(s.tmp, 'probe.cjs'), join(s.tmp, 'cwd.txt')];
  writeFileSync(probe, "require('fs').writeFileSync(process.env.EP_PROBE_FILE, process.cwd()); process.exit(0);\n");
  const env = { ...s.env, EP_AGENT_CLI: process.execPath, EP_PROBE_FILE: seen, NODE_OPTIONS: `--require=${slash(probe)}` };
  planApply({ ...s.ctx, env, cwd: repo }, { with: ['ponytail'] });
  assert.ok(existsSync(seen), 'the agent CLI ran');
  assert.ok(samePath(readFileSync(seen, 'utf8'), s.home), `it ran in ${readFileSync(seen, 'utf8')}`);
});

// An install that makes the settings file from nothing owns the file as well: taking the install back leaves no
// empty "{}" behind (S-5, L-7), and a file the user made, or put their own key in, stays.
test('rollback puts away a settings file the install made, and leaves one the user made', (t) => {
  for (const [why, seed] of [['made by the install', undefined], ['made by the user', '{}\n']]) {
    const s = sandbox(t, { settings: seed });
    const sc = resolveScope('user', s.ctx);
    planApply(s.ctx, { with: ['autocompact', 'nudge'] });
    const out = rollback(s.ctx, { scope: 'user', last: true });
    assert.deepEqual(codes(out.findings), [], why);
    assert.equal(existsSync(join(s.cfg, 'settings.json')), seed !== undefined, why);
    const kept = readdirSync(join(sc.dir, 'quarantine'), { recursive: true }).some((n) => n.endsWith('settings.json'));
    assert.equal(kept, seed === undefined, `${why}: moved to quarantine, not deleted`);
  }
});

test('uninstall puts the settings file away with the last key the install put in it, whichever key goes first', (t) => {
  for (const order of [['/hooks/SessionStart', '/autoCompactWindow'], ['/autoCompactWindow', '/hooks/SessionStart']]) {
    const s = sandbox(t);
    planApply(s.ctx, { with: ['autocompact', 'nudge'] });
    for (const [k, pointer] of order.entries()) {
      const un = plan(s.ctx, { mode: 'uninstall' });
      applyPlan(s.ctx, un, un.rows.find((r) => r.pointer === pointer).id);
      assert.equal(existsSync(join(s.cfg, 'settings.json')), k === 0, `${order.join(' then ')}: after ${pointer}`);
    }
  }
});

test('a settings file the install made goes with its last key, comes back with undo, and a crash while it goes is undone', (t) => {
  const s = sandbox(t);
  const empty = snapshot(s.cfg);
  planApply(s.ctx, { with: ['autocompact', 'nudge'] });
  const installed = snapshot(s.cfg);
  planApply(s.ctx, { mode: 'uninstall' }, 'all');
  assert.equal(snapshot(s.cfg), empty, 'uninstall');
  assert.deepEqual(codes(rollback(s.ctx, { scope: 'user', last: true }).findings), []);
  assert.equal(snapshot(s.cfg), installed, 'undo of the uninstall');
  rollback(s.ctx, { scope: 'user', last: true });
  assert.equal(snapshot(s.cfg), empty, 'undo of the install');

  planApply(s.ctx, { with: ['autocompact'] });
  const one = snapshot(s.cfg);
  const un = plan(s.ctx, { mode: 'uninstall' });
  const key = un.rows.find((r) => r.pointer === '/autoCompactWindow');
  assert.throws(() => applyPlan({ ...s.ctx, env: { ...s.env, EP_FAULT_MID: '0' } }, un, key.id), { code: 'EP-FAULT' });
  assert.ok(!existsSync(join(s.cfg, 'settings.json')), 'the file was already put away when the row stopped');
  rollback(s.ctx, { scope: 'user', last: true });
  assert.equal(snapshot(s.cfg), one, 'undo of the half-done uninstall');
});

test('a settings file the install made stays when you wrote a comment outside its braces', (t) => {
  for (const how of ['uninstall', 'rollback']) {
    const s = sandbox(t);
    planApply(s.ctx, { with: ['autocompact'] });
    s.write('settings.json', `// mine\n${s.read('settings.json')}`);
    if (how === 'uninstall') planApply(s.ctx, { mode: 'uninstall' }, 'all');
    else rollback(s.ctx, { scope: 'user', last: true });
    assert.ok(existsSync(join(s.cfg, 'settings.json')), how);
    assert.match(s.read('settings.json'), /^\/\/ mine\n/, how);
    assert.equal(getValue(s.read('settings.json'), '/autoCompactWindow'), undefined, how);
  }
});

test('a state record naming a saved copy outside the state folder is never read or restored from', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  s.write('rules/efficiency-playbook.md', 'my own rules\n');
  const p = plan(s.ctx);
  applyPlan(s.ctx, p, `default,${p.rows.find((r) => r.target.endsWith('rules/efficiency-playbook.md')).id}`);
  const loot = join(s.tmp, 'loot.txt');
  writeFileSync(loot, 'not the user rules\n');
  const file = join(p.sc.dir, 'state.json');
  const state = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, JSON.stringify({ ...state, items: state.items.map((i) => (i.prior?.backup ? { ...i, prior: { ...i.prior, backup: loot } } : i)) }));
  const { plan: un } = planApply(s.ctx, { mode: 'uninstall' });
  assert.ok(!un.rows.some((r) => r.op === 'restore'));
  assert.ok(codes(un.findings).includes('EP-BACKUP-MISSING'));
  assert.ok(!existsSync(join(s.cfg, 'rules', 'efficiency-playbook.md')), 'the playbook version goes to quarantine and nothing takes its place');
});

test('a settings file with a key the user added stays when the install is taken back', (t) => {
  for (const how of ['uninstall', 'rollback']) {
    const s = sandbox(t);
    planApply(s.ctx, { with: ['autocompact'] });
    s.write('settings.json', setValue(s.read('settings.json'), '/model', 'opus'));
    if (how === 'uninstall') planApply(s.ctx, { mode: 'uninstall' }, 'all');
    else rollback(s.ctx, { scope: 'user', last: true });
    assert.equal(s.read('settings.json'), '{\n  "model": "opus"\n}\n', how);
  }
});
