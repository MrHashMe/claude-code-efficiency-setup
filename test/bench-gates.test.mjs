// Bench v2 task mining and gates G1-G4 on a fixture git repository, including a flaky task that must be dropped (M-1).
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { bench } from '../engine/bench/index.mjs';
import { agentCommand, git as benchGit, gitBash, killTree, shellRun, store } from '../engine/bench/io.mjs';
import { cloneContext, draftPrompt, historyFree, inClone, isTest, runClone, safeRel } from '../engine/bench/tasks.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-bench-gates-'));
const home = path.join(root, 'home'), repo = path.join(root, 'repo'), pwned = path.join(root, 'pwned.txt');
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) =>
    !/^(CLAUDECODE$|CLAUDE_CODE_(?!GIT_BASH_PATH$)|CLAUDE_CONFIG_DIR$|ANTHROPIC_|EP_|GIT_|NODE_TEST_CONTEXT$|NODE_OPTIONS$)/i.test(k))),
  HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: path.join(home, '.claude'), EP_BENCH_QUIET: '1', GIT_CONFIG_NOSYSTEM: '1',
};
// A person's answer: the listing ends with "Type <code> to continue", and these tests read the code off it (M-9).
const typed = async (text) => /Type ([0-9a-f]{6}) to continue/.exec(text)[1];
const ctx = { env, cwd: root, stateRoot: path.join(root, 'state'), now: () => new Date('2026-11-02T12:00:00Z'), ask: typed };
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', ...a],
  { cwd, env, encoding: 'utf8' }).trim();
function commit(files, message) {
  for (const [f, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true });
    fs.writeFileSync(path.join(repo, f), body);
  }
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
}
// The acceptance command: imports every test/*.mjs and fails if any default export throws.
const CHECK = ["import fs from 'node:fs';", "import { pathToFileURL } from 'node:url';", 'let failed = 0;',
  "for (const f of fs.readdirSync('test').filter((n) => n.endsWith('.mjs')).sort()) {",
  "  try { await (await import(pathToFileURL('test/' + f).href)).default(); } catch (e) { console.error(f, e.message); failed++; }", '}',
  'process.exit(failed ? 1 : 0);', ''].join('\n');
const expect = (mod, name, call, want) => `import { ${name} } from '../src/${mod}.mjs';\nexport default () => { if (${call} !== ${want}) throw new Error('${name} is wrong'); };\n`;
const c = {};

before(() => {
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  c.c0 = commit({ 'check.mjs': CHECK, 'src/add.mjs': 'export const add = (a, b) => a - b;\n', 'test/smoke.test.mjs': 'export default () => {};\n' }, 'Initial commit');
  c.valid = commit({ 'src/add.mjs': 'export const add = (a, b) => a + b;\n', 'test/add.test.mjs': expect('add', 'add', 'add(2, 3)', 5) },
    'Fix add() returning the difference (#12)\n\nThe helper in src/add.mjs subtracted instead of adding, which broke totals.');
  // G2: the new test already passes at the base.
  c.g2 = commit({ 'src/sub.mjs': 'export const sub = (a, b) => a - b;\n', 'test/sum.test.mjs': expect('add', 'add', 'add(1, 1)', 2) }, 'feat: add sub helper');
  // G3: the reference change doesn't make its own test pass.
  c.g3 = commit({ 'src/neg.mjs': 'export const neg = (x) => x;\n', 'test/neg.test.mjs': expect('neg', 'neg', 'neg(2)', -2) }, 'feat: add neg helper');
  commit({ 'src/neg.mjs': 'export const neg = (x) => -x;\n' }, 'Correct neg'); // code only, so not a task; later trees pass again
  // G4: passes once at the reference, then fails (a counter file in the clone). Last, so no other task's tree contains it.
  c.g4 = commit({ 'src/flag.mjs': 'export const flag = () => true;\n', 'test/flag.test.mjs': ["import fs from 'node:fs';", "import { flag } from '../src/flag.mjs';",
    'export default () => {', "  const n = fs.existsSync('.runs') ? Number(fs.readFileSync('.runs', 'utf8')) : 0;", "  fs.writeFileSync('.runs', String(n + 1));",
    "  if (!flag() || n > 0) throw new Error('flaky');", '};', ''].join('\n') }, 'feat(flags): add flag support');
  // Code only, so not a task, but its message carries a forged log record whose "hash" is a git option.
  c.forged = commit({ 'src/note.mjs': 'export const note = 1;\n' },
    `Add a note\n\n\x1e--output=${pwned}\x1f${c.c0}\x1fforged\x1f\x1d\nM\tsrc/add.mjs\nA\ttest/add.test.mjs\n`);
});
after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

test('test files are recognized across conventions', () => {
  for (const f of ['test/a.mjs', 'src/__tests__/x.js', 'foo.test.ts', 'foo_spec.rb', 'tests/test_foo.py', 'src/FooTest.java', 'src/FooTests.cs', 'spec/a.rb'])
    assert.ok(isTest(f), f);
  for (const f of ['src/attest.mjs', 'src/testing-utils.mjs', 'latest.json', 'src/contest.js']) assert.ok(!isTest(f), f);
});

test('drafted prompts are short requests that never name a file from the diff', () => {
  const d = draftPrompt('fix(api): handle empty payloads in src/api/handler.ts (#123)', '', ['src/api/handler.ts', 'test/handler.test.ts']);
  assert.equal(d.prompt, 'Can you handle empty payloads in the code?');
  assert.equal(d.promptNeedsReview, true);
  assert.equal(draftPrompt('Fix UTF-8 decoding of headers', '', ['src/h.js', 'test/h.test.js']).prompt, 'Can you fix UTF-8 decoding of headers?');
  assert.equal(draftPrompt('PROJ-42: Fixes login redirect loop', '', ['src/a.js']).prompt, 'Can you fix login redirect loop?');
  assert.equal(draftPrompt('Fix Makefile clean target', '', ['Makefile', 'test/make.test.js']).prompt, 'Can you fix the code clean target?');
  assert.equal(draftPrompt('Make the tests run faster', '', ['run', 'test/run.test.js']).prompt, 'Can you make the tests run faster?');
});

test('bench tasks mines commits that changed tests and code, with hidden acceptance files', async () => {
  const before = git(repo, 'for-each-ref');
  const r = await bench(['tasks', '--repo', repo, '--accept', 'node check.mjs', '--tuning', '1'], ctx);
  assert.equal(r.data.count, 4, JSON.stringify(r.findings));
  assert.deepEqual(r.data.tasks.map((t) => t.id).sort(), [c.valid, c.g2, c.g3, c.g4].map((x) => x.slice(0, 10)).sort());
  assert.equal(r.data.tasks.filter((t) => t.tag === 'tuning').length, 1);
  const t = r.data.tasks.find((x) => x.id === c.valid.slice(0, 10));
  assert.deepEqual(t.acceptanceFiles, ['test/add.test.mjs']);
  assert.match(t.prompt, /^Can you fix add\(\) returning the difference\?/);
  assert.doesNotMatch(t.prompt, /add\.mjs|src\//);
  assert.equal(git(repo, 'for-each-ref'), before);
  assert.ok(r.findings.some((f) => f.code === 'EP-BENCH-FEW-TASKS'));
  assert.equal(r.exitCode, 1);
  assert.ok(git(repo, 'log', '-1', '--format=%B', c.forged).includes('\x1e--output='), 'the forged record is in history');
  assert.ok(!fs.existsSync(pwned), 'a forged record never reaches git as an option');
  const redirected = await bench(['tasks', '--repo', repo, '--accept', 'node check.mjs', '--tuning', '1'],
    { ...ctx, env: { ...env, GIT_DIR: path.join(root, 'nope'), GIT_INDEX_FILE: path.join(root, 'nope', 'index') } });
  assert.equal(redirected.data.count, 4, 'a caller\'s GIT_DIR doesn\'t redirect the bench');
});

test('repository paths stay inside the clone: no .., .git, drive, stream or link parent', () => {
  for (const p of ['../x', 'a/../b', '/abs', 'C:/x', 'a\\b', '.git/config', '.GIT/hooks/x', 'git~1/config', 'a/b.', 'a /b', 'a//b', 'x:s', ''])
    assert.equal(safeRel(p), false, p);
  for (const p of ['test/a.mjs', '.claude/rules', 'src/__tests__/x.js', '.github/workflows/ci.yml']) assert.equal(safeRel(p), true, p);
  const dir = fs.mkdtempSync(path.join(root, 'contain-')), outside = fs.mkdtempSync(path.join(root, 'outside-'));
  fs.symlinkSync(outside, path.join(dir, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => inClone(dir, 'link/x.mjs'), /isn't a plain folder/);
  fs.writeFileSync(path.join(dir, 'file'), '');
  assert.throws(() => inClone(dir, 'file/x.mjs'), /isn't a plain folder/);
  assert.throws(() => inClone(dir, '../x.mjs'), /unsafe/);
  assert.equal(inClone(dir, 'new/x.mjs'), path.join(dir, 'new', 'x.mjs'));
});

test('on Windows, nothing is started from the current or the repository folder: git, taskkill, cmd.exe, where.exe, claude', { skip: process.platform !== 'win32' }, async () => {
  const top = fs.mkdtempSync(path.join(root, 'plant-')), sub = path.join(top, 'sub'), was = process.cwd();
  const saved = Object.fromEntries(['NoDefaultCurrentDirectoryInExePath', 'COMSPEC'].map((n) => [n, process.env[n]]));
  fs.mkdirSync(path.join(top, 'bin'));
  fs.mkdirSync(sub);
  // An empty file can't run: if a call picks one of these over the real program, it fails instead of passing quietly.
  for (const f of ['git.exe', 'claude.exe', 'where.exe', 'taskkill.exe', 'cmd.exe']) fs.writeFileSync(path.join(sub, f), '');
  fs.writeFileSync(path.join(top, 'bin', 'bash.exe'), '');
  // Windows searches the folder before PATH unless this variable is set. The shell that runs the tests sets it, which hides the problem.
  for (const n of Object.keys(saved)) delete process.env[n];
  const clean = Object.fromEntries(Object.entries({ ...env, CLAUDE_CODE_GIT_BASH_PATH: '' }).filter(([k]) => !/^(NoDefaultCurrentDirectoryInExePath|COMSPEC)$/i.test(k)));
  const pathKey = Object.keys(clean).find((k) => /^path$/i.test(k));
  const dotFirst = { ...clean, [pathKey]: `.${path.delimiter}${clean[pathKey]}` }; // a relative PATH entry means the current folder
  process.chdir(sub);
  try {
    for (const e of [clean, dotFirst]) assert.match(benchGit(e, sub, '--version'), /^git version/, 'git comes from PATH, not from the folder it runs in');
    assert.ok(!String(gitBash(clean)).startsWith(top), 'bash comes from the git on PATH');
    let agent = null;
    try { agent = agentCommand(clean); } catch (e) { assert.equal(e.code, 'EP-BENCH-NO-AGENT'); }
    assert.ok(!agent?.cmd.startsWith(top), 'claude comes from PATH');
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });
    const gone = new Promise((resolve) => child.once('exit', () => resolve(true)));
    killTree(child.pid);
    const stopped = await Promise.race([gone, new Promise((resolve) => setTimeout(() => resolve(false), 5000))]);
    child.kill();
    assert.equal(stopped, true, 'taskkill comes from System32');
    const r = await shellRun(null, 'echo hi', { cwd: sub, env: clean });
    assert.equal(r.out.trim(), 'hi', 'the shell is System32\\cmd.exe, not a cmd.exe in the folder');
  } finally {
    process.chdir(was);
    for (const [n, v] of Object.entries(saved)) if (v !== undefined) process.env[n] = v;
  }
});

test('a commit subject or body made of whitespace can\'t stall the prompt drafter (ReDoS)', () => {
  const t0 = Date.now();
  assert.ok(draftPrompt(`Fix${' '.repeat(80000)}x`, '', ['a.js']));
  assert.ok(draftPrompt('Merge pull request #1 from a/b', `a${' '.repeat(80000)}x`, ['a.js']));
  assert.ok(Date.now() - t0 < 2000, `${Date.now() - t0} ms`);
});

test('G1: a plain clone isn\'t history-free; the bench clone is, at the base, without the reference', () => {
  const dir = path.join(root, 'state', 'g1');
  const k = cloneContext({ env, repo, dir, store: store(dir), now: ctx.now });
  const t = { id: c.valid.slice(0, 10), base: c.c0, reference: c.valid };
  const plain = path.join(root, 'plain');
  git(root, 'clone', '-q', repo, plain);
  git(plain, 'checkout', '-q', '--detach', c.c0);
  assert.equal(historyFree(env, plain, t, []), false);
  git(plain, 'remote', 'remove', 'origin');
  assert.equal(historyFree(env, plain, t, []), false, 'the reference is still reachable from main');
  const clone = runClone(k, t, path.join(dir, 'runs', 'clone'));
  assert.equal(historyFree(env, clone, t, []), true);
  assert.equal(git(clone, 'rev-parse', 'HEAD'), c.c0);
  assert.throws(() => execFileSync('git', ['cat-file', '-e', `${c.valid}^{commit}`], { cwd: clone, env, stdio: 'ignore' }));
  assert.equal(git(clone, 'remote'), '');
});

test('bench validate shows the commands it will run and starts nothing unless a fresh code is typed back (M-9)', async () => {
  const asked = [];
  const answer = (reply) => async (text) => { asked.push(text); return reply; };
  const wrong = await bench(['validate', '--repo', repo], { ...ctx, ask: answer('nope') });
  const again = await bench(['validate', '--repo', repo], { ...ctx, ask: answer('') });
  for (const r of [wrong, again]) {
    assert.equal(r.exitCode, 3);
    assert.equal(r.findings[0].code, 'EP-BENCH-NOT-CONFIRMED');
  }
  assert.match(asked[0], /task accept command \(tasks [^)]*\): node check\.mjs/);
  assert.match(asked[0], /not a sandbox/i);
  const code = (text) => /Type ([0-9a-f]{6}) to continue/.exec(text)[1];
  assert.notEqual(code(asked[0]), code(asked[1]), 'every run of the command prints a new code');
  assert.ok(!fs.readFileSync(path.join(wrong.data.benchDir, 'tasks.jsonl'), 'utf8').includes('"gates"'), 'no task was checked');
  assert.deepEqual(fs.readdirSync(path.join(wrong.data.benchDir, 'runs')).filter((n) => n !== 'no-hooks'), [], 'no clone was made');
});

test('bench validate refuses inside an agent session before it shows or asks anything', async () => {
  const asked = [];
  for (const extra of [{ CLAUDECODE: '1' }, { EP_BENCH_CHILD: '1' }]) {
    const r = await bench(['validate', '--repo', repo], { ...ctx, env: { ...env, ...extra }, ask: async (text) => { asked.push(text); return 'x'; } });
    assert.equal(r.exitCode, 3, JSON.stringify(extra));
    assert.equal(r.findings[0].code, 'EP-BENCH-NESTED');
  }
  assert.deepEqual(asked, []);
});

test('bench validate keeps the valid task and drops G2, G3 and the flaky G4 task', async () => {
  const head = git(repo, 'rev-parse', 'HEAD'), refs = git(repo, 'for-each-ref');
  const r = await bench(['validate', '--repo', repo], ctx);
  assert.deepEqual(r.data.survivors, [c.valid.slice(0, 10)], JSON.stringify(r.data.dropped));
  const gate = Object.fromEntries(r.data.dropped.map((d) => [d.id, d]));
  assert.equal(gate[c.g2.slice(0, 10)].gate, 'G2');
  assert.equal(gate[c.g3.slice(0, 10)].gate, 'G3');
  assert.equal(gate[c.g4.slice(0, 10)].gate, 'G4');
  assert.match(gate[c.g4.slice(0, 10)].note, /flaky: the reference failed on run 2 of 3/);
  for (const g of ['G2', 'G3', 'G4']) assert.ok(r.findings.some((f) => f.code === `EP-BENCH-GATE-${g}`), g);
  // The user's repository is only read.
  assert.equal(git(repo, 'rev-parse', 'HEAD'), head);
  assert.equal(git(repo, 'for-each-ref'), refs);
  assert.equal(git(repo, 'status', '--porcelain'), '');
  const one = await bench(['validate', '--repo', repo, '--task', c.valid.slice(0, 10)], ctx);
  assert.equal(one.data.checked, 1);
  assert.equal((await bench(['validate', '--repo', repo, '--task', 'nope'], ctx)).exitCode, 2);
});

test('a secret that a failing prepare command prints is masked before the note is saved or shown', async () => {
  const id = c.valid.slice(0, 10), file = path.join((await bench(['validate', '--repo', repo, '--task', 'nope'], ctx)).data.benchDir, 'tasks.jsonl');
  const script = path.join(root, 'noisy-prepare.mjs'), saved = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(script, "process.stderr.write('password=hunter2 then curl -u admin:s3cret x\\n');\nprocess.exit(1);\n");
  try {
    const rows = saved.trim().split('\n').map((l) => JSON.parse(l)).map((t) => (t.id === id ? { ...t, prepare: `node "${script.replace(/\\/g, '/')}"` } : t));
    fs.writeFileSync(file, rows.map((t) => JSON.stringify(t)).join('\n') + '\n');
    const r = await bench(['validate', '--repo', repo, '--task', id], ctx);
    const dropped = r.data.dropped.find((d) => d.id === id);
    assert.match(dropped.note, /prepare failed/);
    for (const text of [JSON.stringify(r), fs.readFileSync(file, 'utf8')]) assert.doesNotMatch(text, /hunter2|s3cret/);
  } finally {
    fs.writeFileSync(file, saved);
  }
});

test('usage errors exit 2 with the help text', async () => {
  for (const argv of [[], ['nope'], ['tasks', '--repo', repo], ['plan', '--repo', repo, '--k', 'x'], ['report', '--bogus']]) {
    const r = await bench(argv, ctx);
    assert.equal(r.exitCode, 2, argv.join(' '));
    assert.match(r.data.help, /Bench is not a sandbox/);
  }
  assert.equal((await bench(['tasks', '--repo', path.join(root, 'home'), '--accept', 'x'], ctx)).findings[0].code, 'EP-BENCH-NOT-A-REPO');
});

test('a tasks.jsonl row that isn\'t a valid task is refused before any field reaches git or a path', async () => {
  const file = path.join((await bench(['validate', '--repo', repo, '--task', 'nope'], ctx)).data.benchDir, 'tasks.jsonl');
  const saved = fs.readFileSync(file, 'utf8'), [first, ...rest] = saved.trim().split('\n');
  try {
    for (const bad of [{ base: `--output=${pwned}` }, { acceptanceFiles: ['../outside.mjs'] }, { id: '../../x' }]) {
      fs.writeFileSync(file, [JSON.stringify({ ...JSON.parse(first), ...bad }), ...rest].join('\n') + '\n');
      const r = await bench(['validate', '--repo', repo], ctx);
      assert.equal(r.findings[0].code, 'EP-BENCH-TASKS-INVALID', JSON.stringify(bad));
      assert.equal(r.exitCode, 2);
    }
    assert.ok(!fs.existsSync(pwned));
  } finally {
    fs.writeFileSync(file, saved);
  }
});
