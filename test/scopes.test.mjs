// How the scopes share one machine: a local install leans on the user and project installs (S-2, S-11),
// the project install stands alone and renders the same bytes everywhere (N-9), neither writes outside
// its repository (S-3), and the commit stays the user's (L-11).
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { test } from 'node:test';
import { rollback } from '../engine/apply.mjs';
import { mayWrite, resolveScope } from '../engine/scopes.mjs';
import { snapshot } from '../engine/selftest.mjs';
import { loadState } from '../engine/state.mjs';
import { isInside, run, samePath, slash, which } from '../engine/util.mjs';
import { verify } from '../engine/verify.mjs';
import { NOW, ROOT, applyPlan, codes, gitRepo, plan, planApply, sandbox } from './helpers.mjs';

const MAP = { commandMap: { quick: ['npm test'], full: ['npm run check'] } };
const WORKING = /In large files, read the relevant line ranges/;
const LOCAL_RULES = join('.claude', 'rules', 'efficiency-playbook.local.md');
const PROJECT_FILES = ['.claude/rules/efficiency-playbook.md', '.efficiency-playbook.json'];

test('a local install leaves out what the user install loads, and takes it back when that stops', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const repo = gitRepo(s);
  const ctx = { ...s.ctx, cwd: repo };
  planApply(s.ctx, { with: ['autocompact'] });
  const p = plan(ctx, { scope: 'local', with: ['autocompact'] });
  assert.ok(!p.rows.some((r) => r.pointer === '/autoCompactWindow'), 'the user scope already sets it');
  assert.deepEqual(p.satisfied.map((x) => x.item.split('#')[0]).sort(), ['fragment:precedence', 'fragment:working-rules', 'key:/autoCompactWindow']);
  assert.ok(p.satisfied.every((x) => x.scopes.join() === 'user'));
  planApply(ctx, { scope: 'local', with: ['autocompact'] });
  const rules = readFileSync(join(repo, LOCAL_RULES), 'utf8');
  assert.doesNotMatch(rules, WORKING);
  assert.match(rules, /^# Compact instructions$/m, 'what only local scope loads is still written');
  assert.equal(loadState(resolveScope('local', ctx)).satisfiedBy.length, 3, 'each skip is recorded');
  assert.ok(!codes(verify(ctx, { scope: 'local' }).findings).includes('EP-LOCAL-STALE'));

  planApply(s.ctx, { mode: 'uninstall' }, 'all');
  const stale = verify(ctx, { scope: 'local' }).findings.filter((f) => f.code === 'EP-LOCAL-STALE');
  assert.equal(stale.length, 3);
  assert.ok(stale.every((f) => f.severity === 'warn' && /no longer does, so plan --scope local restores it/.test(f.message)));
  const back = plan(ctx, { scope: 'local' });
  assert.deepEqual(back.satisfied, []);
  assert.ok(back.rows.some((r) => r.pointer === '/autoCompactWindow' && r.op === 'create'), 'no --with needed: the skipped component is still chosen');
  planApply(ctx, { scope: 'local' });
  assert.match(readFileSync(join(repo, LOCAL_RULES), 'utf8'), WORKING);
  assert.ok(!codes(verify(ctx, { scope: 'local' }).findings).includes('EP-LOCAL-STALE'));
});

test('a project install stands alone, and verify reports each block that then loads twice', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const repo = gitRepo(s);
  const ctx = { ...s.ctx, cwd: repo };
  planApply(s.ctx);
  assert.deepEqual(plan(ctx, { scope: 'project', answers: MAP }).satisfied, [], 'a committed file cannot lean on one person\'s user scope');
  planApply(ctx, { scope: 'project', answers: MAP });
  assert.match(readFileSync(join(repo, PROJECT_FILES[0]), 'utf8'), WORKING);
  const dup = verify(ctx, { scope: 'project' }).findings.filter((f) => f.code === 'EP-DUPLICATE-BLOCK');
  assert.deepEqual(dup.map((f) => /^the (\S+) block/.exec(f.message)[1]).sort(), ['precedence', 'working-rules']);
  assert.ok(dup.every((f) => f.severity === 'warn' && /about \d+ extra tokens per session/.test(f.message) && f.message.includes('claudeMdExcludes')));
  writeFileSync(join(repo, '.claude', 'settings.local.json'), JSON.stringify({ claudeMdExcludes: [`${slash(s.cfg)}/rules/**`] }));
  assert.ok(!codes(verify(ctx, { scope: 'project' }).findings).includes('EP-DUPLICATE-BLOCK'), 'an excluded file no longer loads here');
});

test('project and local installs leave the config folder alone, and local writes only what git ignores', (t) => {
  const s = sandbox(t, { settings: '{}\n' });
  const repo = gitRepo(s);
  const ctx = { ...s.ctx, cwd: repo };
  const home = snapshot(s.home);
  const before = JSON.parse(snapshot(s.tmp));
  planApply(ctx, { scope: 'local', with: ['autocompact', 'concise'] });
  const after = JSON.parse(snapshot(s.tmp));
  const changed = Object.keys({ ...before, ...after }).filter((k) => before[k] !== after[k] && !k.startsWith('state/'));
  assert.deepEqual(changed.sort(), ['repo/.claude/rules/efficiency-playbook.local.md', 'repo/.claude/settings.local.json', 'repo/.git/info/exclude']);
  assert.equal(snapshot(s.home), home);
  planApply(ctx, { scope: 'project', answers: MAP });
  assert.equal(snapshot(s.home), home);
});

test('a project install renders the same bytes on any machine, at any time', (t) => {
  const out = ['repo', 'elsewhere'].map((name, k) => {
    const s = sandbox(t);
    const repo = gitRepo(s, name);
    const now = k ? new Date('2027-03-04T05:06:07Z') : NOW;
    planApply({ ...s.ctx, cwd: repo, now: () => now }, { scope: 'project', answers: MAP });
    return PROJECT_FILES.map((f) => readFileSync(join(repo, f)));
  });
  assert.deepEqual(out[0], out[1]);
});

test('a project apply returns git status and the paths to stage, and stages nothing', (t) => {
  const s = sandbox(t);
  const repo = gitRepo(s);
  const { result } = planApply({ ...s.ctx, cwd: repo }, { scope: 'project', answers: MAP });
  assert.deepEqual(result.data.git.add, PROJECT_FILES);
  assert.deepEqual(result.data.git.status, PROJECT_FILES.map((f) => `?? ${f}`));
  assert.equal(run('git', ['-C', repo, 'diff', '--cached', '--name-only'], { env: s.env }).stdout, '');
});

test('on Windows, a git.exe planted in the repository never runs', { skip: process.platform !== 'win32' }, (t) => {
  const s = sandbox(t);
  const repo = gitRepo(s);
  writeFileSync(join(repo, 'git.exe'), '');
  // This variable hides the folder search; Windows doesn't set it by default.
  const saved = process.env.NoDefaultCurrentDirectoryInExePath;
  delete process.env.NoDefaultCurrentDirectoryInExePath;
  t.after(() => saved !== undefined && (process.env.NoDefaultCurrentDirectoryInExePath = saved));
  assert.equal(slash(resolveScope('project', { ...s.ctx, cwd: repo }).repo), slash(repo));
});

test('the engine runs no git command that stages, commits or rewrites anything', () => {
  // Line-based like scripts/check.mjs; the bench's scratch clones are the one exception.
  const WRITE = /['"`](add|commit|push|reset|checkout|stash|rm|mv|tag|merge|rebase|branch)['"`]/;
  const files = readdirSync(join(ROOT, 'engine'), { recursive: true }).map(slash).filter((p) => p.endsWith('.mjs') && p !== 'bench/tasks.mjs');
  assert.ok(files.includes('scopes.mjs'));
  const hits = files.flatMap((p) =>
    readFileSync(join(ROOT, 'engine', p), 'utf8')
      .split('\n')
      .flatMap((l, i) => (/\bgit\b/.test(l) && WRITE.test(l) ? [`${p}:${i + 1}`] : [])),
  );
  assert.deepEqual(hits, []);
});

const identity = (repo, env) => (...args) => run('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { env });

test('a project apply never runs a program that the repository names in its git config', (t) => {
  const s = sandbox(t);
  const repo = gitRepo(s);
  // Git for Windows runs such a command through its own sh, which the sandbox PATH (git alone) doesn't hold.
  const git = which('git', process.env);
  const sh = git && [join(dirname(git), '..', 'usr', 'bin'), join(dirname(git), '..', '..', 'usr', 'bin')].find((d) => existsSync(join(d, 'sh.exe')));
  const env = sh ? { ...s.env, PATH: `${s.env.PATH}${delimiter}${sh}` } : s.env;
  const marker = join(s.tmp, 'fsmonitor-ran');
  assert.ok(run('git', ['-C', repo, 'config', 'core.fsmonitor', `echo ran > ${slash(marker)}`], { env }).ok);
  run('git', ['-C', repo, 'status', '--porcelain'], { env });
  if (!existsSync(marker)) return t.skip('this git does not run a core.fsmonitor command here');
  rmSync(marker);
  const { result } = planApply({ ...s.ctx, cwd: repo, env }, { scope: 'project', answers: MAP });
  assert.equal(existsSync(marker), false, 'git status would have run it');
  assert.deepEqual(result.data.git.add, PROJECT_FILES);
  assert.deepEqual(result.data.git.status, PROJECT_FILES.map((f) => `?? ${f}`));
});

test('a project apply over committed files reports them as modified, and a removal as deleted', (t) => {
  const s = sandbox(t);
  const repo = gitRepo(s);
  const ctx = { ...s.ctx, cwd: repo };
  const git = identity(repo, s.env);
  planApply(ctx, { scope: 'project', answers: MAP });
  assert.ok(git('add', '-A').ok && git('commit', '-q', '-m', 'playbook').ok);
  const { result } = planApply(ctx, { scope: 'project', answers: { commandMap: { quick: ['npm run quick'], full: ['npm run check'] } } });
  assert.deepEqual(result.data.git.status, PROJECT_FILES.map((f) => ` M ${f}`));
  const gone = planApply(ctx, { scope: 'project', mode: 'uninstall' }).result.data.git;
  assert.deepEqual(gone.status, PROJECT_FILES.map((f) => ` D ${f}`));
});

test('a link inside the repository that leads out of it is never written through', (t) => {
  const s = sandbox(t);
  const repo = gitRepo(s);
  const outside = join(s.tmp, 'outside');
  mkdirSync(outside);
  try {
    symlinkSync(outside, join(repo, '.claude'), 'junction');
  } catch (e) {
    return t.skip(`no link rights here: ${e.code}`);
  }
  const ctx = { ...s.ctx, cwd: repo };
  const result = applyPlan(ctx, plan(ctx, { scope: 'project', answers: MAP }));
  assert.deepEqual(readdirSync(outside), [], 'nothing landed outside the repository');
  assert.ok(codes(result.findings).includes('EP-PATH-REFUSED'));
  assert.ok(existsSync(join(repo, '.efficiency-playbook.json')), 'what really is inside the repository is still written');
});

test('a repository that is the home folder or holds it is refused, spelled any way', (t) => {
  const cases = {
    'the home folder': (s) => ({ repo: s.home, cwd: s.home }),
    'a parent of the home folder': (s) => ({ repo: s.tmp, cwd: s.home }),
    'the home folder through a link': (s) => {
      const link = join(s.tmp, 'homelink');
      symlinkSync(s.home, link, 'junction');
      return { repo: s.home, cwd: s.home, env: { HOME: link, USERPROFILE: link } };
    },
  };
  for (const [why, make] of Object.entries(cases)) {
    const s = sandbox(t);
    let spec;
    try {
      spec = make(s);
    } catch (e) {
      if (e.code !== 'EPERM') throw e;
      continue;
    }
    assert.ok(run('git', ['init', '-q', spec.repo], { env: s.env }).ok);
    const ctx = { ...s.ctx, cwd: spec.cwd, env: { ...s.env, ...spec.env } };
    assert.throws(() => resolveScope('project', ctx), { code: 'EP-REPO-REFUSED', exit: 3 }, why);
    assert.throws(() => resolveScope('local', ctx), { code: 'EP-REPO-REFUSED', exit: 3 }, why);
  }
});

test('each scope may write its own files and the state folder, and nothing else', (t) => {
  const s = sandbox(t);
  const repo = gitRepo(s);
  const ctx = { ...s.ctx, cwd: repo };
  const [user, project, local] = ['user', 'project', 'local'].map((n) => resolveScope(n, ctx));
  const yes = (sc, ...paths) => paths.forEach((p) => assert.ok(mayWrite(sc, p), `${sc.scope} may write ${p}`));
  const no = (sc, ...paths) => paths.forEach((p) => assert.ok(!mayWrite(sc, p), `${sc.scope} may not write ${p}`));
  yes(user, user.settings, user.rulesFile, user.lockFile, join(s.cfg, 'efficiency-playbook', 'nudge.mjs'), join(s.cfg, 'rules', 'token-efficiency.md'), join(user.stateRoot, 'any'));
  no(user, join(s.cfg, 'CLAUDE.md'), join(s.cfg, 'settings.local.json'), join(s.home, 'notes.txt'), join(repo, 'CLAUDE.md'));
  yes(project, project.settings, project.rulesFile, project.lockFile, join(repo, 'CLAUDE.md'));
  no(project, local.settings, join(s.cfg, 'settings.json'), join(repo, 'src', 'main.js'), project.exclude);
  yes(local, local.settings, local.rulesFile, local.exclude);
  no(local, project.settings, join(repo, 'CLAUDE.md'), join(s.cfg, 'rules', 'efficiency-playbook.md'));
});

test('each linked worktree is its own local install, and the shared exclude file keeps every one of them', (t) => {
  const s = sandbox(t);
  const main = gitRepo(s);
  const git = identity(main, s.env);
  assert.ok(git('commit', '--allow-empty', '-q', '-m', 'init').ok);
  const linked = join(s.tmp, 'linked');
  assert.ok(git('worktree', 'add', '-q', linked).ok, 'git worktree add');
  const [inMain, inLinked] = [main, linked].map((cwd) => ({ ...s.ctx, cwd }));
  const exclude = join(main, '.git', 'info', 'exclude');
  const blocks = () => (readFileSync(exclude, 'utf8').match(/^# ep:begin/gm) ?? []).length;
  const local = { scope: 'local', with: ['autocompact'] };
  planApply(inMain, local);
  planApply(inLinked, local);
  assert.equal(blocks(), 2, 'one block per worktree');
  assert.notEqual(resolveScope('local', inMain).key, resolveScope('local', inLinked).key);

  const un = plan(inLinked, { scope: 'local', mode: 'uninstall' });
  assert.ok(un.items.length > 0 && un.items.every((it) => isInside(it.target, linked) || samePath(it.target, exclude)), "no row touches the main worktree's files");
  const result = applyPlan(inLinked, un);
  assert.ok(!codes(result.findings).includes('EP-PATH-REFUSED'));
  assert.ok(!existsSync(join(linked, LOCAL_RULES)));
  assert.ok(existsSync(join(main, LOCAL_RULES)), "the main worktree's files stay");
  assert.equal(blocks(), 1, "the main worktree's block stays");
  assert.ok(run('git', ['-C', main, 'check-ignore', '-q', '.claude/settings.local.json'], { env: s.env }).ok, 'and keeps its files out of git');
  assert.equal(plan(inMain, local).rows.length, 0, 'nothing for the main worktree to change');

  planApply(inMain, { scope: 'local', mode: 'uninstall' });
  assert.equal(blocks(), 0);
  assert.equal(readFileSync(exclude, 'utf8').includes('ep:'), false);
});

test('rollback at project and local scope puts the repository back byte for byte: the shared exclude file, and a settings file the install made or the user wrote', (t) => {
  for (const [name, seed] of [['made', undefined], ['written', '{\n  // mine\n  "model": "opus"\n}\n']]) {
    const s = sandbox(t);
    const repo = gitRepo(s);
    const ctx = { ...s.ctx, cwd: repo };
    if (seed !== undefined) {
      mkdirSync(join(repo, '.claude'));
      writeFileSync(join(repo, '.claude', 'settings.local.json'), seed);
    }
    const before = snapshot(repo);
    for (const [scope, extra] of [['project', { answers: MAP }], ['local', { with: ['autocompact'] }]]) {
      planApply(ctx, { scope, ...extra });
      assert.notEqual(snapshot(repo), before, `${scope} wrote something`);
      const out = rollback(ctx, { scope, last: true });
      assert.deepEqual(codes(out.findings), [], `${scope}, ${name}`);
      assert.equal(snapshot(repo), before, `${scope}, settings file ${name}`);
    }
  }
});
