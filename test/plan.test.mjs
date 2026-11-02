import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { getValue } from '../engine/jsonc.mjs';
import { loadRegistry } from '../engine/registry.mjs';
import { WIN, run, textHash } from '../engine/util.mjs';
import { verify } from '../engine/verify.mjs';
import { ROOT, applyPlan, codes, gitRepo, label, plan, planApply, sandbox } from './helpers.mjs';

test('a fresh user plan writes the rules file and the lock, and leaves settings alone', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const p = plan(s.ctx);
  assert.deepEqual(p.rows.map(label).sort(), ['create file ~/.claude/efficiency-playbook.lock.json', 'create file ~/.claude/rules/efficiency-playbook.md']);
  assert.ok(p.rows.every((r) => r.status === 'proposed' && r.default));
  assert.ok(codes(p.findings).includes('EP-TOOL-NONE'), 'no language server on PATH means no LSP plugin rows');
  assert.ok(p.alwaysLoadedTokens > 0 && p.alwaysLoadedTokens <= 600);
});

test('the plan hash is stable, and a plan after apply has no rows', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  assert.equal(plan(s.ctx).hash, plan(s.ctx).hash);
  planApply(s.ctx);
  assert.equal(plan(s.ctx).rows.length, 0);
});

test('off-by-default Trial components are offered as options with their cost', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const options = plan(s.ctx).options;
  for (const id of ['autocompact', 'concise', 'context7', 'nudge', 'ponytail']) assert.ok(options.some((o) => o.id === id), id);
  assert.ok(!options.some((o) => o.id === 'lsp'), 'lsp is on by default, so not an option');
  assert.ok(options.every((o) => typeof o.alwaysLoadedTokens === 'number' && o.egress));
  const reg = loadRegistry(ROOT);
  for (const o of options) {
    assert.equal(o.verdict, reg.byId.get(o.id).verdict, `${o.id} carries its verdict, as a row does`);
    assert.deepEqual(o.evidence, reg.byId.get(o.id).evidence.map((e) => e.id), `${o.id} names its evidence`);
  }
});

test('a language server on PATH plans its plugin', (t) => {
  const s = sandbox(t, { settings: '{}\n', bins: ['rust-analyzer'] });
  const row = plan(s.ctx).rows.find((r) => r.kind === 'plugin');
  assert.equal(row?.pointer, '/enabledPlugins/rust-analyzer-lsp@claude-plugins-official');
});

test('a rustup proxy plans rust-analyzer only once a toolchain holds the real server', (t) => {
  const s = sandbox(t, { settings: '{}\n', bins: ['rust-analyzer', 'rustup'] });
  const pluginRow = () => plan(s.ctx).rows.find((r) => r.kind === 'plugin');
  assert.equal(pluginRow(), undefined, 'rustup puts the proxy in its bin folder without the component');
  const bin = join(s.home, '.rustup', 'toolchains', 'stable-x86_64', 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, WIN ? 'rust-analyzer.exe' : 'rust-analyzer'), '');
  assert.equal(pluginRow()?.pointer, '/enabledPlugins/rust-analyzer-lsp@claude-plugins-official');
});

test('--with ponytail plans marketplace, env key and plugin; the plugin waits for its marketplace', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const p = plan(s.ctx, { with: ['ponytail'] });
  const market = p.rows.find((r) => r.pointer === '/extraKnownMarketplaces/ponytail');
  const env = p.rows.find((r) => r.pointer === '/env/PONYTAIL_SUBAGENT_MATCHER');
  const plugin = p.rows.find((r) => r.kind === 'plugin');
  assert.ok(market && env && plugin);
  assert.deepEqual(plugin.requires, [market.id]);
  assert.equal(env.after.summary, 'set', 'env values are never printed');
  assert.ok(p.enabled.includes('ponytail'));
});

test('unknown, Hold and conflicting components are usage errors', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  assert.throws(() => plan(s.ctx, { with: ['no-such-component'] }), { code: 'EP-USAGE', exit: 2 });
  assert.throws(() => plan(s.ctx, { with: ['ecc'] }), { code: 'EP-USAGE', exit: 2 });
  assert.throws(() => plan(s.ctx, { with: ['ponytail', 'yagni-line'] }), { code: 'EP-ROLE-CONFLICT', exit: 2 });
});

test('--without opts a default component out, and the choice sticks', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  planApply(s.ctx, { without: ['rules'] });
  assert.doesNotMatch(s.read('rules/efficiency-playbook.md'), /# Working rules\n\n- /);
  assert.equal(plan(s.ctx).rows.length, 0, 'a later plan without --without keeps rules off');
  assert.ok(plan(s.ctx, { with: ['rules'] }).rows.length > 0, '--with turns it back on');
});

test('project and local scopes need a git working tree', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  assert.throws(() => plan(s.ctx, { scope: 'project' }), { code: 'EP-NOT-A-REPO', exit: 2 });
  assert.throws(() => plan(s.ctx, { scope: 'somewhere' }), { code: 'EP-USAGE', exit: 2 });
});

test('the project command map needs answers once, then survives re-plans without them', (t) => {
  const s = sandbox(t);
  const repo = gitRepo(s);
  const ctx = { ...s.ctx, cwd: repo };
  const first = plan(ctx, { scope: 'project' });
  assert.ok(codes(first.findings).includes('EP-ANSWER-NEEDED'));
  assert.ok(!first.enabled.includes('command-map'));
  planApply(ctx, { scope: 'project', answers: { commandMap: { quick: ['npm test -- --watch=false'], full: ['npm run check'] } } });
  const rules = readFileSync(join(repo, '.claude', 'rules', 'efficiency-playbook.md'), 'utf8');
  assert.match(rules, /^- `npm run check`$/m);
  assert.equal(plan(ctx, { scope: 'project' }).rows.length, 0);
  const lock = JSON.parse(readFileSync(join(repo, '.efficiency-playbook.json'), 'utf8'));
  assert.equal(lock.files['.claude/rules/efficiency-playbook.md'], textHash(rules));
  assert.ok(lock.components['command-map']);
});

test('a personal component at project scope becomes a recommendation, not a file', (t) => {
  const s = sandbox(t);
  const ctx = { ...s.ctx, cwd: gitRepo(s) };
  const p = plan(ctx, { scope: 'project', with: ['autocompact'] });
  assert.ok(p.recommended.includes('autocompact'));
  assert.ok(!p.rows.some((r) => r.pointer === '/autoCompactWindow'));
  assert.ok(codes(p.findings).includes('EP-RECOMMENDED'));
});

test('local scope keeps its files out of git with a marked block in info/exclude', (t) => {
  const s = sandbox(t);
  const repo = gitRepo(s);
  const ctx = { ...s.ctx, cwd: repo };
  const p = plan(ctx, { scope: 'local', with: ['autocompact'] });
  assert.ok(p.rows.some((r) => r.kind === 'block' && r.target.endsWith('info/exclude')));
  planApply(ctx, { scope: 'local', with: ['autocompact'] });
  for (const f of ['.claude/rules/efficiency-playbook.local.md', '.claude/settings.local.json']) {
    assert.ok(run('git', ['-C', repo, 'check-ignore', '-q', f], { env: s.env }).ok, `${f} is ignored`);
  }
});

test('uninstall plans a remove, and says why, when the backup of the file the install replaced is gone', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  s.write('rules/efficiency-playbook.md', 'my own rules\n');
  const p = plan(s.ctx);
  const row = p.rows.find((r) => r.target.endsWith('rules/efficiency-playbook.md'));
  const { journal } = applyPlan(s.ctx, p, `default,${row.id}`).data;
  const saved = join(p.sc.dir, 'backups', journal);
  for (const name of readdirSync(saved)) rmSync(join(saved, name));
  const un = plan(s.ctx, { mode: 'uninstall' });
  const gone = un.rows.find((r) => r.target.endsWith('rules/efficiency-playbook.md'));
  assert.deepEqual([gone.op, gone.status], ['remove', 'proposed']);
  assert.ok(codes(un.findings).includes('EP-BACKUP-MISSING'));
  const result = applyPlan(s.ctx, un);
  assert.ok(result.data.results.every((r) => r.status === 'done'), 'the remove goes through instead of failing on the missing backup');
  assert.ok(!existsSync(join(s.cfg, 'rules', 'efficiency-playbook.md')));
});

test('an empty or byte-order-mark-only settings.json reads as an empty object', (t) => {
  const bom = String.fromCodePoint(0xfeff);
  for (const blank of ['', bom, '  \n']) {
    const s = sandbox(t, { settings: blank });
    assert.ok(!codes(verify(s.ctx).findings).includes('EP-SETTINGS-PARSE'), JSON.stringify(blank));
    planApply(s.ctx, { with: ['autocompact'] });
    assert.equal(getValue(s.read('settings.json'), '/autoCompactWindow'), 300000, JSON.stringify(blank));
    assert.equal(s.read('settings.json').startsWith(bom), blank.startsWith(bom), 'the byte-order mark stays if there was one');
  }
});

test('a command map that is not a list of commands is a usage error, not a crash', (t) => {
  const s = sandbox(t);
  const ctx = { ...s.ctx, cwd: gitRepo(s) };
  assert.throws(() => plan(ctx, { scope: 'project', answers: { commandMap: { quick: 'make', full: ['make check'] } } }), { code: 'EP-USAGE', exit: 2 });
});

test('a project lock whose recommended entry is not a list is reported and ignored', (t) => {
  const s = sandbox(t);
  const repo = gitRepo(s);
  writeFileSync(join(repo, '.efficiency-playbook.json'), JSON.stringify({ engine: '8.0.0', agents: ['claude'], components: {}, files: {}, recommended: 'autocompact' }));
  const p = plan({ ...s.ctx, cwd: repo }, { scope: 'project', answers: { commandMap: { quick: ['npm test'], full: ['npm run check'] } } });
  assert.ok(codes(p.findings).includes('EP-LOCK-INVALID'));
  assert.deepEqual(p.recommended, []);
});
