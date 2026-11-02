import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { inspect } from '../engine/inspect.mjs';
import { setValue } from '../engine/jsonc.mjs';
import { loadRegistry } from '../engine/registry.mjs';
import { show } from '../engine/show.mjs';
import { tokens } from '../engine/util.mjs';
import { verify } from '../engine/verify.mjs';
import { NOW, ROOT, codes, gitRepo, planApply, sandbox } from './helpers.mjs';

const problems = (r) => r.findings.filter((f) => f.severity !== 'info');

test('a clean install verifies without warnings', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  planApply(s.ctx, { with: ['autocompact'] });
  assert.deepEqual(problems(verify(s.ctx)), []);
  assert.ok(codes(verify(s.ctx).findings).includes('EP-AGENT-MISSING'));
});

test('an edited owned file is drift and a deleted one is missing; show agrees', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  planApply(s.ctx, { with: ['nudge'] });
  s.write('rules/efficiency-playbook.md', '# mine now\n');
  rmSync(join(s.cfg, 'efficiency-playbook', 'nudge.mjs'));
  assert.deepEqual(codes(problems(verify(s.ctx))).sort(), ['EP-DRIFT-EDITED', 'EP-DRIFT-MISSING']);
  const status = Object.fromEntries(show(s.ctx).data.items.filter((i) => i.status).map((i) => [i.item.split(':')[0] + ':' + i.item.split('/').at(-1), i.status]));
  assert.equal(status['file:efficiency-playbook.md'], 'edited');
  assert.equal(status['file:nudge.mjs'], 'missing');
});

test('show gives each value in effect, the layer it comes from, its owner and its evidence', (t) => {
  const matcher = `not-for-printing-${'q'.repeat(8)}`;
  const s = sandbox(t, { settings: JSON.stringify({ enabledPlugins: { 'gopls-lsp@claude-plugins-official': true }, env: { PONYTAIL_SUBAGENT_MATCHER: matcher } }) });
  planApply(s.ctx, { with: ['autocompact'] });
  writeFileSync(s.env.EP_MANAGED_SETTINGS, JSON.stringify({ outputStyle: 'Explanatory' }));
  s.write('backups/setup-20260927-152909/MANIFEST.json', JSON.stringify({ settings_keys: [{ key: 'env.PONYTAIL_SUBAGENT_MATCHER', absent_before_setup: true }] }));
  const r = show(s.ctx);
  const facts = (items, suffix) => {
    const i = items.find((x) => x.item.endsWith(suffix));
    return [i.value, i.sourceScope, i.owner];
  };
  const own = r.data.items.find((i) => i.item.endsWith('#/autoCompactWindow'));
  assert.deepEqual([own.value, own.sourceScope, own.owner, own.status], [300000, 'user', 'engine', 'ok']);
  assert.deepEqual(own.evidence, { component: 'autocompact', verdict: 'Trial', measuredBy: ['independent'] });
  assert.deepEqual(facts(r.data.items, '/outputStyle'), ['Explanatory', 'managed', 'managed']);
  assert.deepEqual(facts(r.data.items, '/env/PONYTAIL_SUBAGENT_MATCHER'), ['set', 'user', 'other'], 'v7 wrote it and was never migrated');
  assert.deepEqual(facts(r.data.items, '/enabledPlugins/gopls-lsp@claude-plugins-official'), [true, 'user', 'user']);
  assert.deepEqual(facts(r.data.items, '/hooks/SessionStart/-'), [null, 'none', null]);
  assert.ok(!JSON.stringify(r).includes(matcher), 'env values show only as set');
  const repo = gitRepo(s);
  mkdirSync(join(repo, '.claude'));
  writeFileSync(join(repo, '.claude', 'settings.local.json'), '{ "autoCompactWindow": 1 }\n');
  assert.deepEqual(facts(show({ ...s.ctx, cwd: repo }).data.items, '#/autoCompactWindow'), [1, 'local', 'user'], 'local settings win over user settings');
});

test('verify reports packs, duplicate rules and secret rules that exist only as prose', (t) => {
  const s = sandbox(t, { settings: '{ "enabledPlugins": { "ecc@ecc": true } }\n' });
  s.write('rules/ecc/common/security.md', 'Never print secrets.\n');
  s.write('rules/token-efficiency.md', '# v7 rules\n');
  planApply(s.ctx);
  const found = codes(verify(s.ctx).findings);
  for (const c of ['EP-PACK-PRESENT', 'EP-SECURITY-RULE-UNENFORCED', 'EP-V7-LEFTOVER', 'EP-DUPLICATE-BLOCK']) assert.ok(found.includes(c), c);
  s.write('settings.json', '{ "enabledPlugins": { "ecc@ecc": true }, "permissions": { "deny": ["Read(./.env)"] } }\n');
  assert.ok(!codes(verify(s.ctx).findings).includes('EP-SECURITY-RULE-UNENFORCED'), 'a deny rule answers the prose');
});

test('the nudge shows one line when verify found problems, then waits a week', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  planApply(s.ctx, { with: ['nudge'] });
  const nudge = () => spawnSync(process.execPath, [join(ROOT, 'content', 'nudge.mjs')], { env: s.env, encoding: 'utf8' });
  verify(s.ctx);
  assert.equal(nudge().stdout, '', 'no problems, no line');
  s.write('rules/efficiency-playbook.md', '# mine now\n');
  verify(s.ctx);
  const summary = JSON.parse(readFileSync(join(s.tmp, 'state', 'nudge.json'), 'utf8'));
  assert.equal(summary.count, 1);
  assert.equal(summary.top, 'EP-DRIFT-EDITED');
  const first = nudge();
  assert.equal(first.status, 0);
  assert.match(JSON.parse(first.stdout).systemMessage, /found 1 problem\(s\), first EP-DRIFT-EDITED/);
  assert.equal(nudge().stdout, '', 'shown once a week at most');
});

test('inspect lists every scope that owns items, with display paths only', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const repo = gitRepo(s);
  assert.deepEqual(inspect(s.ctx).data.installs, []);
  planApply(s.ctx);
  planApply({ ...s.ctx, cwd: repo }, { scope: 'local' });
  const d = inspect({ ...s.ctx, cwd: repo }).data;
  assert.equal(d.configDir, '~/.claude');
  assert.match(d.repo, /\/repo$/);
  assert.equal(d.claude.cli, null, 'EP_AGENT_CLI=none');
  assert.deepEqual(d.installs.map((i) => i.key.split('-')[0]).sort(), ['local', 'user']);
  assert.ok(d.installs.find((i) => i.key.startsWith('user')).folders.every((f) => f.startsWith('~/')));
});

test('the nudge exits cleanly when there is no summary', (t) => {
  const s = sandbox(t);
  const r = spawnSync(process.execPath, [join(ROOT, 'content', 'nudge.mjs')], { env: s.env, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout + r.stderr, '');
});

// A copy of the package with registry entries changed: { id: (entry) => entry }.
function pkg(s, name, edits) {
  const root = join(s.tmp, name);
  cpSync(join(ROOT, 'registry'), join(root, 'registry'), { recursive: true });
  cpSync(join(ROOT, 'content'), join(root, 'content'), { recursive: true });
  for (const [id, edit] of Object.entries(edits)) {
    const file = join(root, 'registry', 'components', `${id}.json`);
    writeFileSync(file, JSON.stringify(edit(JSON.parse(readFileSync(file, 'utf8'))), null, 2));
  }
  return { ...s.ctx, root };
}
const only = (ctx, code, opts) => verify(ctx, opts).findings.filter((f) => f.code === code);

test('a settings file that does not parse is a finding in verify and an unreadable item in show, never a crash', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  planApply(s.ctx, { with: ['autocompact'] });
  s.write('settings.json', '{ "autoCompactWindow": ');
  const v = verify(s.ctx);
  assert.ok(codes(v.findings).includes('EP-SETTINGS-PARSE'));
  assert.ok(!codes(v.findings).includes('EP-DRIFT-MISSING'), 'an unreadable file is not a missing value');
  const r = show(s.ctx);
  assert.ok(codes(r.findings).includes('EP-SETTINGS-PARSE'));
  assert.equal(r.data.items.find((i) => i.item.endsWith('#/autoCompactWindow')).status, 'unreadable');
});

test('right after a manual plugin step verify says the plugin is not installed yet, and is quiet once it is', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const { source, ref } = loadRegistry(ROOT).byId.get('ponytail').agents.claude.install[0];
  planApply(s.ctx, { with: ['ponytail'] });
  const [note, ...more] = only(s.ctx, 'EP-PLUGIN-NOT-INSTALLED');
  assert.deepEqual([more.length, note.severity], [0, 'info']);
  assert.ok(note.message.includes(`claude plugin marketplace add ${source}@${ref}`), note.message);
  assert.ok(note.message.includes('claude plugin install ponytail@ponytail --scope user'), note.message);
  assert.ok(!codes(verify(s.ctx).findings).includes('EP-DRIFT-MISSING'), 'a pending step is not drift');
  s.write('plugins/known_marketplaces.json', JSON.stringify({ ponytail: { source: { source: 'github', repo: source } } }));
  assert.ok(!only(s.ctx, 'EP-PLUGIN-NOT-INSTALLED')[0].message.includes('marketplace add'), 'a known marketplace needs no add');
  s.write('settings.json', setValue(s.read('settings.json'), '/enabledPlugins/ponytail@ponytail', true));
  const after = codes(verify(s.ctx).findings);
  assert.ok(!after.includes('EP-PLUGIN-NOT-INSTALLED') && !after.includes('EP-DRIFT-MISSING'));
});

test('the v7 rules file loading beside the v8 one says what it costs and how to stop it', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const v7 = '# v7 rules\n' + '- a line long enough to cost something each session\n'.repeat(20);
  s.write('rules/token-efficiency.md', v7);
  planApply(s.ctx);
  const [f] = only(s.ctx, 'EP-DUPLICATE-BLOCK');
  assert.equal(f.severity, 'warn');
  assert.ok(f.message.includes(`about ${tokens(v7)} extra tokens per session`), f.message);
  assert.match(f.message, /claudeMdExcludes/);
});

test('two active components that list each other as conflicting are reported once, unless their role already says so', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const overlap = pkg(s, 'overlap', { rules: (c) => ({ ...c, conflicts: ['precedence'] }) });
  planApply(overlap);
  assert.deepEqual(only(overlap, 'EP-COMPONENT-CONFLICT').map((f) => [f.severity, f.message]), [['warn', 'precedence and rules overlap; keep one']]);
  const both = pkg(s, 'same-role', {
    rules: (c) => ({ ...c, conflicts: ['precedence'], exclusive: true, roles: ['x-role'] }),
    precedence: (c) => ({ ...c, conflicts: ['rules'], exclusive: true, roles: ['x-role'] }),
  });
  assert.ok(codes(verify(both).findings).includes('EP-ROLE-CONFLICT'));
  assert.deepEqual(only(both, 'EP-COMPONENT-CONFLICT'), [], 'the role conflict already says it');
});

test('a revisit date that has arrived is an info finding for an active component; other notes and later dates are not', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const ctx = pkg(s, 'revisit', { rules: (c) => ({ ...c, revisit: ['2026-11-02', '2026-11-03', '2026-13-45', 'K-RULES result'] }), autocompact: (c) => ({ ...c, revisit: ['2020-01-01'] }) });
  planApply(ctx);
  const [f, ...more] = only(ctx, 'EP-REVISIT-TRIGGERED');
  assert.equal(more.length, 0, 'not the later date, not the notes, not an inactive component');
  assert.equal(f.severity, 'info');
  assert.ok(/rules/.test(f.message) && /2026-11-02/.test(f.message) && /update the playbook/.test(f.message), f.message);
  const later = only({ ...ctx, now: () => new Date('2026-11-04T00:00:00Z') }, 'EP-REVISIT-TRIGGERED');
  assert.equal(later.length, 2);
});

test('verify compares the installed plugin, its pin and its marketplace with what the registry tested', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const { ref, sha, source } = loadRegistry(ROOT).byId.get('ponytail').agents.claude.install[0];
  const pin = ref.replace(/^v/, '');
  planApply(s.ctx, { with: ['ponytail'] });
  s.write('settings.json', setValue(s.read('settings.json'), '/enabledPlugins/ponytail@ponytail', true));
  const plugin = (version, gitCommitSha) => s.write('plugins/installed_plugins.json', JSON.stringify({ version: 2, plugins: { 'ponytail@ponytail': [{ scope: 'user', installPath: '/x', version, gitCommitSha }] } }));
  const market = (source) => s.write('plugins/known_marketplaces.json', JSON.stringify({ ponytail: { source, installLocation: '/y' } }));
  const found = () => verify(s.ctx).findings.filter((f) => /^EP-(COMPONENT-VERSION-UNEXPECTED|MARKETPLACE-NOT-CANONICAL)$/.test(f.code));
  plugin(pin, sha);
  market({ source: 'github', repo: source });
  assert.deepEqual(found(), []);

  plugin('1.0.0', sha);
  assert.deepEqual(found().map((f) => [f.code, f.severity]), [['EP-COMPONENT-VERSION-UNEXPECTED', 'warn']]);
  assert.ok(found()[0].message.includes(`installed 1.0.0, tested pin ${pin}`) && found()[0].message.includes('claude plugin update ponytail@ponytail'), found()[0].message);

  plugin(pin, 'a'.repeat(40));
  assert.deepEqual(found().map((f) => f.code), ['EP-COMPONENT-VERSION-UNEXPECTED']);
  assert.ok(found()[0].message.includes('aaaaaaa') && found()[0].message.includes(sha.slice(0, 7)), found()[0].message);

  plugin(pin, sha);
  market({ source: 'github', repo: 'someone-else/ponytail' });
  assert.deepEqual(found().map((f) => [f.code, f.severity]), [['EP-MARKETPLACE-NOT-CANONICAL', 'warn']]);
  assert.ok(found()[0].message.includes('someone-else/ponytail') && found()[0].message.includes(source), found()[0].message);

  market({ source: 'git', url: 'https://example.com/x.git' });
  assert.deepEqual(found(), [], 'only a github marketplace has a repo to compare');
  s.write('plugins/installed_plugins.json', '{ not json');
  s.write('plugins/known_marketplaces.json', '[1, 2');
  assert.deepEqual(found(), [], 'unreadable agent files are skipped, never a crash');
});
