import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { inspect } from '../engine/inspect.mjs';
import { getValue } from '../engine/jsonc.mjs';
import { findManifest } from '../engine/migrate.mjs';
import { show } from '../engine/show.mjs';
import { slash } from '../engine/util.mjs';
import { verify } from '../engine/verify.mjs';
import { applyPlan, codes, plan, planApply, sandbox } from './helpers.mjs';

const V7_FILES = {
  'rules/token-efficiency.md': '# v7 rules\n',
  'skills/project-setup/SKILL.md': '---\nname: project-setup\n---\n',
  'hooks/project-setup-nudge.js': 'console.log("nudge")\n',
  'project-setup-state.json': '{"repos": {}}\n',
};

// What v7 left on disk, with the MANIFEST.json it wrote.
function v7(s) {
  const nudge = slash(join(s.cfg, 'hooks', 'project-setup-nudge.js'));
  const entry = { matcher: 'startup', hooks: [{ type: 'command', command: `node "${nudge}"`, timeout: 5 }] };
  s.write('settings.json', JSON.stringify({ autoCompactWindow: 300000, hooks: { SessionStart: [entry] } }, null, 2) + '\n');
  const files = Object.entries(V7_FILES).map(([rel, text]) => {
    s.write(rel, text);
    return { path: join(s.cfg, rel), created_by_setup: true, hash_after: createHash('sha256').update(text).digest('hex') };
  });
  const outside = join(s.tmp, 'elsewhere', 'settings.json');
  mkdirSync(join(s.tmp, 'elsewhere'));
  writeFileSync(outside, '{}\n');
  const manifest = {
    files: [...files, { path: outside, created_by_setup: true, hash_after: 'x' }],
    hooks: [{ file: join(s.cfg, 'settings.json'), event: 'SessionStart', entry }],
    settings_keys: [{ key: 'autoCompactWindow', absent_before_setup: true }],
    plugins: [],
    marked_blocks: [{ path: join(s.tmp, 'some-repo', 'CLAUDE.md') }],
  };
  s.write('backups/setup-20260927-152909/MANIFEST.json', JSON.stringify(manifest, null, 2));
}

test('v7 leftovers: unedited files go to quarantine, the hook entry goes, v7 settings are adopted', (t) => {
  const s = sandbox(t);
  v7(s);
  const p = plan(s.ctx);
  const mig = p.rows.filter((r) => r.group === 'migration');
  assert.deepEqual(mig.map((r) => `${r.op} ${r.kind} ${r.target}`).sort(), [
    'remove dir ~/.claude/skills/project-setup',
    'remove entry ~/.claude/settings.json',
    'remove file ~/.claude/hooks/project-setup-nudge.js',
    'remove file ~/.claude/project-setup-state.json',
    'remove file ~/.claude/rules/token-efficiency.md',
  ]);
  assert.ok(mig.every((r) => r.status === 'proposed'));
  const hook = mig.find((r) => r.kind === 'entry');
  assert.ok(mig.find((r) => r.target.endsWith('project-setup-nudge.js')).requires.includes(hook.id), 'the hook entry goes before its script');
  assert.ok(p.rows.some((r) => r.op === 'adopt' && r.pointer === '/autoCompactWindow'));
  assert.ok(codes(p.findings).includes('EP-V7-OUTSIDE') && codes(p.findings).includes('EP-V7-BLOCK'));
  planApply(s.ctx);
  for (const rel of Object.keys(V7_FILES)) assert.ok(!existsSync(join(s.cfg, rel)), rel);
  const settings = s.read('settings.json');
  assert.equal(getValue(settings, '/hooks/SessionStart'), undefined);
  assert.equal(getValue(settings, '/autoCompactWindow'), 300000);
  assert.ok(!codes(verify(s.ctx).findings).includes('EP-V7-LEFTOVER'));
  assert.equal(plan(s.ctx).rows.length, 0);
});

test('a newer repo-only manifest (a v6 kit worktree run) does not hide the user-level one', (t) => {
  const s = sandbox(t);
  v7(s);
  s.write('backups/setup-20260927-152936-kit/MANIFEST.json', JSON.stringify({ setup: 'repo part only', entries: [{ kind: 'block', path: join(s.tmp, 'kit', 'CLAUDE.md') }] }));
  assert.match(slash(findManifest(s.cfg)), /\/setup-20260927-152909\/MANIFEST\.json$/);
  assert.equal(plan(s.ctx).rows.filter((r) => r.group === 'migration').length, 5);
});

test('an edited v7 file is a conflict and stays unless approved by id', (t) => {
  const s = sandbox(t);
  v7(s);
  s.write('rules/token-efficiency.md', '# v7 rules\n- my own line\n');
  const p = plan(s.ctx);
  const row = p.rows.find((r) => r.target.endsWith('token-efficiency.md'));
  assert.equal(row.status, 'conflict');
  planApply(s.ctx);
  assert.ok(existsSync(join(s.cfg, 'rules', 'token-efficiency.md')));
  assert.ok(codes(verify(s.ctx).findings).includes('EP-DUPLICATE-BLOCK'));
});

test('a file you added inside a v7 folder makes the folder a conflict, and one added after plan makes apply stale', (t) => {
  const s = sandbox(t);
  v7(s);
  const p = plan(s.ctx);
  s.write('skills/project-setup/my-notes.md', 'mine\n');
  assert.throws(() => applyPlan(s.ctx, p), { code: 'EP-STALE-PLAN' });
  assert.equal(plan(s.ctx).rows.find((r) => r.kind === 'dir').status, 'conflict');
  planApply(s.ctx);
  assert.equal(s.read('skills/project-setup/my-notes.md'), 'mine\n', 'the folder stays unless approved by id');
});

test('a v7 manifest that lists a credential file never gets it opened', (t) => {
  const s = sandbox(t);
  v7(s);
  s.write('skills/project-setup/.env', 'TOKEN=not-real\n');
  const rel = 'backups/setup-20260927-152909/MANIFEST.json';
  const m = JSON.parse(s.read(rel));
  s.write(rel, JSON.stringify({ ...m, files: [...m.files, { path: join(s.cfg, 'skills', 'project-setup', '.env'), created_by_setup: true, hash_after: 'x' }] }));
  assert.throws(() => plan(s.ctx), { code: 'EP-SECRET-PATH' });
});

test('uninstall after a migration removes v8 items and does not bring v7 back', (t) => {
  const s = sandbox(t);
  v7(s);
  planApply(s.ctx);
  planApply(s.ctx, { mode: 'uninstall' });
  assert.ok(!existsSync(join(s.cfg, 'rules', 'efficiency-playbook.md')));
  assert.ok(!existsSync(join(s.cfg, 'rules', 'token-efficiency.md')));
  assert.equal(getValue(s.read('settings.json'), '/autoCompactWindow'), undefined, 'the adopted v7 key leaves with the playbook');
});

test('a v7 hook entry you edited is a conflict, and the script it runs stays until you decide', (t) => {
  const s = sandbox(t);
  v7(s);
  const script = join(s.cfg, 'hooks', 'project-setup-nudge.js');
  const mine = { matcher: 'startup', hooks: [{ type: 'command', command: `node "${slash(script)}"`, timeout: 30 }] };
  s.write('settings.json', JSON.stringify({ autoCompactWindow: 300000, hooks: { SessionStart: [mine] } }, null, 2) + '\n');
  const p = plan(s.ctx);
  const hook = p.rows.find((r) => r.kind === 'entry');
  const file = p.rows.find((r) => r.target.endsWith('project-setup-nudge.js'));
  assert.deepEqual([hook.op, hook.status, hook.group], ['remove', 'conflict', 'migration']);
  assert.ok(file.requires.includes(hook.id), 'the script waits for the hook that runs it');
  const { result } = planApply(s.ctx);
  assert.ok(existsSync(script), 'the hook you kept still points at it');
  assert.ok(codes(result.findings).includes('EP-ROW-SKIPPED'));
  assert.equal(getValue(s.read('settings.json'), '/hooks/SessionStart').length, 1);
  const again = plan(s.ctx);
  applyPlan(s.ctx, again, `default,${again.rows.find((r) => r.kind === 'entry').id}`);
  assert.ok(!existsSync(script), 'approved by id, both go');
  assert.equal(getValue(s.read('settings.json'), '/hooks/SessionStart'), undefined);
});

test('one corrupt manifest is a finding, and the manifests around it are still read', (t) => {
  const s = sandbox(t);
  v7(s);
  s.write('backups/setup-20260928-000000/MANIFEST.json', '{ not json');
  const bad = [];
  assert.match(slash(findManifest(s.cfg, (path) => bad.push(path))), /setup-20260927-152909\/MANIFEST\.json$/);
  assert.equal(bad.length, 1);
  const p = plan(s.ctx);
  assert.equal(p.rows.filter((r) => r.group === 'migration').length, 5);
  assert.ok(codes(p.findings).includes('EP-MANIFEST-CORRUPT'));
  const d = inspect(s.ctx);
  assert.ok(codes(d.findings).includes('EP-MANIFEST-CORRUPT'));
  assert.match(d.data.v7Manifest, /setup-20260927-152909\/MANIFEST\.json$/);
});

test('a corrupt state file blocks plan and apply with a clear error; verify, show and inspect report it and carry on', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const { plan: p } = planApply(s.ctx);
  writeFileSync(join(p.sc.dir, 'state.json'), '{ "schema": 1, "items": [');
  assert.throws(() => plan(s.ctx), { code: 'EP-STATE-CORRUPT', exit: 3 });
  assert.deepEqual(codes(verify(s.ctx).findings).filter((c) => c === 'EP-STATE-CORRUPT'), ['EP-STATE-CORRUPT']);
  assert.deepEqual(codes(show(s.ctx).findings).filter((c) => c === 'EP-STATE-CORRUPT'), ['EP-STATE-CORRUPT']);
  const d = inspect(s.ctx);
  assert.ok(codes(d.findings).includes('EP-STATE-CORRUPT'));
  assert.deepEqual(d.data.installs, []);
});
