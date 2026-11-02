// U-4: managed settings win over every scope. The sandbox points EP_MANAGED_SETTINGS at a temp file, so
// these tests never read the machine's policy.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { getValue } from '../engine/jsonc.mjs';
import { admits, readPolicy } from '../engine/policy.mjs';
import { verify } from '../engine/verify.mjs';
import { applyPlan, codes, plan, sandbox } from './helpers.mjs';

const policy = (s, doc) => writeFileSync(s.env.EP_MANAGED_SETTINGS, typeof doc === 'string' ? doc : JSON.stringify(doc));
const at = (p, pointer) => p.rows.find((r) => r.pointer === pointer);
const GOPLS = '/enabledPlugins/gopls-lsp@claude-plugins-official';

test('a setting the policy sets is blocked with its reason, and no approval applies it', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  policy(s, { autoCompactWindow: 100000 });
  const p = plan(s.ctx, { with: ['autocompact'] });
  const row = at(p, '/autoCompactWindow');
  assert.equal(row.status, 'blocked');
  assert.equal(row.default, false);
  assert.match(row.reason, /managed settings set \/autoCompactWindow/);
  assert.ok(p.findings.some((f) => f.code === 'EP-POLICY-BLOCKED' && f.severity === 'info' && f.message.startsWith(row.id)));
  assert.throws(() => applyPlan(s.ctx, p, row.id), { code: 'EP-POLICY-BLOCKED', exit: 3 });
  applyPlan(s.ctx, p, 'all');
  assert.equal(getValue(s.read('settings.json'), '/autoCompactWindow'), undefined, '"all" leaves blocked rows out');
  policy(s, {});
  assert.equal(at(plan(s.ctx), '/autoCompactWindow').status, 'proposed', 'a blocked row is not remembered as declined');
});

test('hook entries are blocked while the policy allows only managed hooks or none', (t) => {
  for (const flag of ['allowManagedHooksOnly', 'disableAllHooks']) {
    const s = sandbox(t, { settings: '{}\n' });
    policy(s, { [flag]: true });
    const p = plan(s.ctx, { with: ['nudge'] });
    const hook = p.rows.find((r) => r.kind === 'entry');
    assert.equal(hook.status, 'blocked', flag);
    assert.match(hook.reason, new RegExp(flag));
    assert.ok(p.rows.filter((r) => r !== hook).every((r) => r.status === 'proposed'), 'the hook script itself is not policy');
  }
});

test('a plugin the policy turns off is blocked', (t) => {
  const s = sandbox(t, { settings: '{}\n', bins: ['gopls'] });
  policy(s, { enabledPlugins: { 'gopls-lsp@claude-plugins-official': false } });
  const row = at(plan(s.ctx), GOPLS);
  assert.equal(row.status, 'blocked');
  assert.match(row.reason, /disable gopls-lsp@claude-plugins-official at every scope/);
});

test('strictKnownMarketplaces blocks a marketplace it does not admit, and that marketplace\'s plugins', (t) => {
  const s = sandbox(t, { settings: '{}\n', bins: ['gopls'] });
  policy(s, { strictKnownMarketplaces: [] });
  const p = plan(s.ctx, { with: ['ponytail'] });
  for (const ptr of ['/extraKnownMarketplaces/ponytail', '/enabledPlugins/ponytail@ponytail', GOPLS]) {
    assert.equal(at(p, ptr).status, 'blocked', ptr);
    assert.match(at(p, ptr).reason, /strictKnownMarketplaces doesn't admit/);
  }
  assert.equal(at(p, '/env/PONYTAIL_SUBAGENT_MATCHER').status, 'proposed');
  assert.deepEqual(at(p, '/enabledPlugins/ponytail@ponytail').requires, [], 'a blocked row is nobody\'s requirement');
  policy(s, { strictKnownMarketplaces: [{ source: 'github', repo: 'anthropics/claude-plugins-official' }] });
  const p2 = plan(s.ctx, { with: ['ponytail'] });
  assert.equal(at(p2, GOPLS).status, 'proposed', 'an entry that admits the official marketplace lets its plugins through');
  assert.equal(at(p2, '/extraKnownMarketplaces/ponytail').status, 'blocked');
});

test('allowlist entries match as the marketplace docs describe', () => {
  const official = { source: 'github', repo: 'anthropics/claude-plugins-official' };
  assert.ok(admits({ source: 'github', repo: 'anthropics/claude-plugins-official' }, official));
  assert.ok(admits({ source: 'github', repo: 'anthropics/*' }, official), 'owner/* admits every repository of that owner');
  assert.ok(!admits({ source: 'github', repo: 'anthropics/claude-*' }, official), 'no other wildcard');
  assert.ok(!admits({ source: 'github', repo: 'anthropics/claude-plugins-official', ref: 'v1' }, official), 'a pinned ref must match');
  assert.ok(admits({ source: 'hostPattern', hostPattern: '^github\\.com$' }, official));
  assert.ok(admits({ source: 'hostPattern', hostPattern: 'example\\.com$' }, { source: 'git', url: 'git@git.example.com:team/m.git' }));
  assert.ok(!admits({ source: 'hostPattern', hostPattern: '(' }, official), 'a broken pattern admits nothing');
  assert.ok(!admits({ source: 'url', url: 'https://example.com/m.json' }, official));
});

test('managed files merge in order: values replace, lists combine, objects merge, aliases resolve', (t) => {
  const s = sandbox(t);
  const [a, b] = [join(s.tmp, 'a.json'), join(s.tmp, 'b.json')];
  writeFileSync(a, JSON.stringify({ outputStyle: 'x', strictKnownMarketplaces: [{ source: 'github', repo: 'a/b' }], enabledPlugins: { 'p@m': false } }));
  writeFileSync(b, JSON.stringify({ outputStyle: 'y', allowedMarketplaces: [{ source: 'github', repo: 'c/d' }], enabledPlugins: { 'q@m': true } }));
  const { policy: merged, findings } = readPolicy({ EP_MANAGED_SETTINGS: [a, b].join(delimiter) });
  assert.deepEqual(findings, []);
  assert.equal(merged.outputStyle, 'y');
  assert.deepEqual(merged.strictKnownMarketplaces.map((e) => e.repo), ['a/b', 'c/d']);
  assert.deepEqual(merged.enabledPlugins, { 'p@m': false, 'q@m': true });
});

test('a managed settings file that does not parse or cannot be read is reported by plan and verify', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  policy(s, '{ not json');
  assert.match(plan(s.ctx).findings.find((f) => f.code === 'EP-POLICY-UNREADABLE').message, /isn't valid JSON \(at position 2\b/);
  assert.equal(verify(s.ctx).findings.find((f) => f.code === 'EP-POLICY-UNREADABLE')?.severity, 'warn');
  const token = 'ghp_' + 'A1b2C3d4'.repeat(4);
  policy(s, `token: ${token}\n`);
  const msg = plan(s.ctx).findings.find((f) => f.code === 'EP-POLICY-UNREADABLE').message;
  assert.ok(!msg.includes(token.slice(0, 6)), `the parser's quote of the file stays out: ${msg}`);
  policy(s, '[1, 2]');
  assert.ok(codes(verify(s.ctx).findings).includes('EP-POLICY-UNREADABLE'), 'valid JSON that is not an object');
  const folder = { ...s.ctx, env: { ...s.env, EP_MANAGED_SETTINGS: s.tmp } };
  assert.match(plan(folder).findings.find((f) => f.code === 'EP-POLICY-UNREADABLE').message, /can't be read/);
});
