import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseArgs } from '../engine/ep.mjs';
import { run } from '../engine/util.mjs';
import { verify } from '../engine/verify.mjs';
import { ROOT, gitRepo, planApply, sandbox } from './helpers.mjs';

function cli(s, args, cwd = s.tmp) {
  const r = spawnSync(process.execPath, [join(ROOT, 'engine', 'ep.mjs'), ...args], { cwd, env: s.env, encoding: 'utf8', timeout: 60000 });
  return { exit: r.status, out: r.stdout, err: r.stderr, json: args.includes('--json') ? JSON.parse(r.stdout) : null };
}
const answersFile = (s, name, commandMap) => {
  const f = join(s.tmp, name);
  writeFileSync(f, JSON.stringify({ commandMap }));
  return f;
};

test('--json prints one envelope, and exit codes follow 06 section 2', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const p = cli(s, ['plan', '--json']);
  assert.equal(p.exit, 0, p.out);
  assert.deepEqual(Object.keys(p.json).sort(), ['command', 'data', 'engine', 'error', 'findings', 'ok']);
  assert.equal(p.json.ok, true);
  assert.match(p.json.data.next, /apply --scope user --plan [0-9a-f]{12} --approve default$/);
  assert.equal(cli(s, ['apply', '--plan', p.json.data.plan, '--approve', 'default', '--json']).exit, 0);
  assert.equal(cli(s, ['plan', '--json']).json.data.rows.length, 0);
  assert.equal(cli(s, ['verify', '--json']).exit, 0);
  for (const args of [['nonsense'], ['plan', '--bogus'], ['plan', 'extra'], ['apply'], ['plan', '--agent', 'codex'], ['plan', '--ci'], ['evidence', 'fresh']]) {
    const r = cli(s, [...args, '--json']);
    assert.equal(r.exit, 2, args.join(' '));
    assert.equal(r.json.error.code, 'EP-USAGE');
    assert.equal(r.json.ok, false);
  }
});

test('a stale plan exits 4 and names the fresh plan', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const p = cli(s, ['plan', '--with', 'autocompact', '--json']);
  s.write('settings.json', '{ "autoCompactWindow": 1 }\n');
  const a = cli(s, ['apply', '--plan', p.json.data.plan, '--approve', 'default', '--json']);
  assert.equal(a.exit, 4);
  assert.equal(a.json.error.code, 'EP-STALE-PLAN');
  assert.match(a.json.data.fresh, /^[0-9a-f]{12}$/);
});

test('--answers takes only the command map', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const f = join(s.tmp, 'answers.json');
  writeFileSync(f, JSON.stringify({ commandMap: { quick: ['a'], full: ['b'] }, extra: true }));
  assert.equal(cli(s, ['plan', '--answers', f, '--json']).exit, 2);
  assert.equal(cli(s, ['plan', '--answers', join(s.tmp, 'missing.json'), '--json']).exit, 2);
  assert.equal(cli(s, ['plan', '--answers', join(s.tmp, '.env'), '--json']).json.error.code, 'EP-SECRET-PATH');
});

test('human output lists rows and the apply command', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const r = cli(s, ['plan']);
  assert.equal(r.exit, 0);
  assert.match(r.out, /^r01 proposed +create +~\/\.claude\//m);
  assert.match(r.out, /^apply with: node ".+\/engine\/ep\.mjs" apply --scope user --plan [0-9a-f]{12} --approve default$/m);
});

test('a project apply lists what it changed as git sees it, and the git add to run; the commit is the user\'s', (t) => {
  const s = sandbox(t);
  const repo = gitRepo(s);
  const answers = answersFile(s, 'answers.json', { quick: ['npm test'], full: ['npm run check'] });
  const p = cli(s, ['plan', '--scope', 'project', '--answers', answers, '--json'], repo);
  const r = cli(s, ['apply', '--scope', 'project', '--plan', p.json.data.plan, '--approve', 'default'], repo);
  assert.equal(r.exit, 0, r.out);
  assert.match(r.out, /^changed by this apply, as git sees them:\n {2}\?\? \.claude\/rules\/efficiency-playbook\.md\n {2}\?\? \.efficiency-playbook\.json$/m);
  assert.match(r.out, /^to commit, stage them: git add -- \.claude\/rules\/efficiency-playbook\.md \.efficiency-playbook\.json$/m);
  assert.equal(run('git', ['-C', repo, 'status', '--porcelain', '--untracked-files=no'], { env: s.env }).stdout, '', 'nothing staged');
});

test('printed messages are redacted, in human and JSON output', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const repo = gitRepo(s);
  const token = 'ghp_' + 'A1b2C3d4'.repeat(4);
  const bad = join(s.tmp, 'bad.json');
  writeFileSync(bad, `token: ${token}\n`);
  const map = answersFile(s, 'map.json', { quick: [`npm test --token ${token} \``], full: ['npm run check'] });
  for (const [args, cwd, masked] of [[['plan', '--answers', bad], s.tmp, false], [['plan', '--scope', 'project', '--answers', map], repo, true]]) {
    for (const json of [[], ['--json']]) {
      const r = cli(s, [...args, ...json], cwd);
      assert.equal(r.exit, 2, r.out);
      assert.ok(!r.out.includes(token) && !r.err.includes(token), r.out);
      if (masked) assert.match(r.out, /\[redacted\]/, 'the message still names the entry');
    }
  }
});

test('state folders are private to the user', { skip: process.platform === 'win32' && 'POSIX folder modes are a no-op on Windows' }, (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  planApply(s.ctx, { with: ['nudge'] });
  planApply(s.ctx, { mode: 'uninstall' }, 'all');
  verify(s.ctx);
  const root = join(s.tmp, 'state');
  const dirs = [root, ...readdirSync(root, { recursive: true }).map((p) => join(root, p)).filter((p) => statSync(p).isDirectory())];
  assert.ok(dirs.length > 3);
  for (const d of dirs) assert.equal((statSync(d).mode & 0o777).toString(8), '700', d);
});

test('selftest passes', (t) => {
  const s = sandbox(t);
  const r = cli(s, ['selftest', '--json']);
  assert.equal(r.exit, 0, JSON.stringify(r.json.data));
  assert.ok(r.json.data.checks.length >= 6 && r.json.data.checks.every((c) => c.ok));
});

test('the shipped registry validates and docs/decisions.md matches it', (t) => {
  const s = sandbox(t);
  const r = cli(s, ['evidence', 'check', '--json']);
  assert.equal(r.exit, 0, JSON.stringify(r.json.findings));
});

test('the flag parser is strict', () => {
  assert.deepEqual(parseArgs(['--with', 'a,b', '--with=c', '--scope', 'user', '--json']), { _: [], with: ['a', 'b', 'c'], without: [], scope: 'user', json: true });
  assert.throws(() => parseArgs(['--json=1']), { code: 'EP-USAGE' });
  assert.throws(() => parseArgs(['--scope']), { code: 'EP-USAGE' });
  assert.throws(() => parseArgs(['--plan', '--approve', 'x']), { code: 'EP-USAGE' });
});
