// bench tasks (mining from history) and bench validate (gates G1-G4), on history-free scratch clones.
// Every git write here runs inside a scratch clone under the bench folder; the user's repository is only read.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fail, finding, git, gitBash, gitOk, gitRun, hash12, hash32, hashPath, lines, privateDir, rmDir, say, scrub, shellRun, tail } from './io.mjs';
import { confirmRun } from './trust.mjs';

const HEX = /^[0-9a-f]{40}([0-9a-f]{24})?$/;
const BASE_REF = 'refs/heads/bench-base';
const ACCEPT_MS = 15 * 60000, PREPARE_MS = 20 * 60000;
const MAX_CODE_FILES = 20; // a commit touching more code files than this is a migration, not a task
const GATE_RUNS = 3; // G4: base fails 3 of 3 and reference passes 3 of 3
const CONFIG_FILES = ['CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md', '.mcp.json', '.claude/CLAUDE.md', '.claude/settings.json',
  '.claude/settings.local.json', '.claude/rules', '.claude/skills', '.claude/agents', '.claude/commands', '.claude/hooks'];
export const isTest = (f) => /(^|\/)(__tests__|tests?|specs?|testing)\/|[._-](test|spec)s?\.[^/]+$|(^|\/)test_[^/]+$/i.test(f)
  || /[a-z0-9]Tests?\.[^/.]+$/.test(f);

// A repository path from history or the working tree, checked before anything under a clone is written or deleted: plain parts
// only, never .git or its 8.3 alias, and no part that Windows rewrites (a trailing dot or space, a drive or stream colon).
export const safeRel = (rel) => typeof rel === 'string' && rel.split('/').every((p) => p && !/[\\:]|[. ]$/.test(p) && !/^(\.git|git~\d+)$/i.test(p));
// Also no existing parent that is a link or a file: a committed symlink would otherwise lead the write outside the clone.
export function inClone(dir, rel) {
  if (!safeRel(rel)) throw new Error(`refusing an unsafe repository path: ${String(rel).slice(0, 80)}`);
  const parts = rel.split('/');
  for (let i = 1; i < parts.length; i++) {
    const st = fs.lstatSync(path.join(dir, ...parts.slice(0, i)), { throwIfNoEntry: false });
    if (st && !st.isDirectory()) throw new Error(`refusing to write through ${parts.slice(0, i).join('/')}: it isn't a plain folder`);
  }
  return path.join(dir, ...parts);
}
export const configPrint = (repo, files) => hash32(files.map((f) => [f, hashPath(path.join(repo, f))]));

// tasks.jsonl is edited by hand (prompts are reviewed there), so each row is checked before its fields reach git or a path.
export function loadTasks(c) {
  return c.store.rows('tasks.jsonl').map((t, i) => {
    if (!(HEX.test(t?.base) && HEX.test(t.reference) && t.id === t.reference.slice(0, 10) && typeof t.prompt === 'string'
      && typeof t.accept === 'string' && (t.prepare == null || typeof t.prepare === 'string')
      && Array.isArray(t.acceptanceFiles) && t.acceptanceFiles.length && t.acceptanceFiles.every(safeRel)))
      throw fail('EP-BENCH-TASKS-INVALID', `${c.store.p('tasks.jsonl')} line ${i + 1} isn't a valid task: fix or delete that line, or run bench tasks again`, 2);
    return t;
  });
}

// Today's project configuration (working tree) goes into every clone, so arms run on the user's real setup.
export function cloneContext(c) {
  const work = path.join(c.dir, 'runs'), noHooks = path.join(work, 'no-hooks');
  privateDir(noHooks);
  const nested = lines(gitRun(c.env, c.repo, ['ls-files', '-co', '--exclude-standard']).out)
    .filter((f) => /(^|\/)(CLAUDE|AGENTS)\.md$/.test(f) && !f.startsWith('.claude/worktrees/') && safeRel(f));
  const configFiles = [...new Set([...CONFIG_FILES, ...nested])];
  return { ...c, work, noHooks, configFiles, bash: gitBash(c.env),
    commonDir: path.resolve(c.repo, git(c.env, c.repo, 'rev-parse', '--git-common-dir')), projectConfig: configPrint(c.repo, configFiles) };
}

const VERB = { fixed: 'fix', fixes: 'fix', added: 'add', adds: 'add', removed: 'remove', removes: 'remove', updated: 'update',
  updates: 'update', changed: 'change', changes: 'change', made: 'make', makes: 'make', handled: 'handle', handles: 'handle',
  improved: 'improve', improves: 'improve', allowed: 'allow', allows: 'allow', supported: 'support', supports: 'support' };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A short, casual request from the commit message. It never names a file from the diff: paths and file names are replaced.
export function draftPrompt(subject, body, files) {
  const merge = /^Merge (pull request|branch|remote-tracking branch)\b/i.test(subject);
  const prose = lines(body).filter((l) => !/^[\w-]+:\s|^[-*#>]|^\[/.test(l));
  // Cut before the regexes: a subject or body that is one long run of spaces would make them quadratic.
  let ask = (merge ? prose.shift() ?? '' : subject).slice(0, 300).replace(/^\w+(\([^)]*\))?!?:\s*/, '').replace(/^\[?[A-Z][A-Z0-9]+-\d+\]?:?\s*/, '')
    .replace(/\s*\((#\d+|[A-Z][A-Z0-9]+-\d+)\)|\s*#\d+\b/g, '').replace(/[.\s]+$/, '').trim().replace(/^\w+/, (w) => VERB[w.toLowerCase()] ?? w);
  if (!ask) return null;
  if (/^[A-Z][a-z]/.test(ask)) ask = ask[0].toLowerCase() + ask.slice(1);
  const why = prose.find((l) => l.length >= 20 && l.length <= 200);
  let text = `Can you ${ask}?${why ? ` ${why}` : ''}`, redacted = false;
  // Paths, names with an extension, and names like Makefile; a lower-case bare name ("run") is too often an ordinary word.
  const names = [...new Set(files.flatMap((f) => [f, path.posix.basename(f)]))].filter((n) => n.includes('/') || /\.\w+$|[A-Z]/.test(n));
  for (const n of names.sort((a, b) => b.length - a.length))
    text = text.replace(new RegExp(`(?<![\\w./-])${esc(n)}(?![\\w/-])`, 'gi'), () => { redacted = true; return 'the code'; });
  return { prompt: text, promptNeedsReview: merge || redacted || text.length < 30 };
}

export function mineTasks(c, o) {
  const limit = o.limit ?? 20;
  // First-parent history with merges diffed against their first parent covers squash, rebase and merge-commit workflows.
  // A random marker bounds each record, so no commit message can forge one; the hashes come before any message text.
  const mark = randomBytes(8).toString('hex');
  const raw = git(c.env, c.repo, 'log', '--first-parent', '--diff-merges=first-parent', '--no-renames', '--name-status',
    `--max-count=${limit * 25}`, `--format=%x1e${mark}%H%x1f%P%x1f%s%x1f%b%x1d${mark}`, 'HEAD');
  const found = [];
  for (const rec of raw.split(`\x1e${mark}`).slice(1)) {
    if (found.length >= limit) break;
    const [head, list = ''] = rec.split(`\x1d${mark}`);
    const [reference, parents = '', subject = '', ...body] = head.split('\x1f');
    const base = parents.split(' ')[0];
    const changed = lines(list).map((l) => l.split('\t')).filter((x) => x.length === 2 && safeRel(x[1]));
    const tests = changed.filter(([s, f]) => s !== 'D' && isTest(f)).map(([, f]) => f);
    const code = changed.filter(([, f]) => !isTest(f));
    if (!HEX.test(reference) || !HEX.test(base) || !tests.length || !code.length || code.length > MAX_CODE_FILES) continue;
    const draft = draftPrompt(subject, body.join('\x1f'), changed.map(([, f]) => f));
    if (!draft) continue;
    const refLines = lines(git(c.env, c.repo, 'diff', '--numstat', '--no-renames', '--end-of-options', base, reference)).map((l) => l.split('\t'))
      .filter(([, , f]) => !isTest(f)).reduce((s, [a, r]) => s + (+a || 0) + (+r || 0), 0);
    found.push({ id: reference.slice(0, 10), base, reference, subject, ...draft, acceptanceFiles: tests, accept: o.accept,
      prepare: o.prepare ?? null, refLines, tag: 'held-out' });
  }
  // Rows already mined with the same commands keep their reviewed prompt and gate results.
  const old = new Map(loadTasks(c).map((t) => [t.id, t]));
  const merged = found.map((t) => (old.get(t.id)?.accept === t.accept && old.get(t.id)?.prepare === t.prepare ? old.get(t.id) : t));
  const tuning = new Set([...merged].sort((a, b) => (hash12(a.id) < hash12(b.id) ? -1 : 1)).slice(0, o.tuning ?? 0).map((t) => t.id));
  const tasks = o.tuning == null ? merged : merged.map((t) => ({ ...t, tag: tuning.has(t.id) ? 'tuning' : 'held-out' }));
  c.store.saveRows('tasks.jsonl', tasks);
  const findings = [];
  if (!tasks.length) findings.push(finding('EP-BENCH-NO-CANDIDATES', 'warn', `no commit in the last ${limit * 25} first-parent commits changed both tests and code`));
  else if (tasks.length < 8) findings.push(finding('EP-BENCH-FEW-TASKS', 'warn', `only ${tasks.length} candidate tasks; at least 8 are needed for intervals, and validate drops some`));
  const review = tasks.filter((t) => t.promptNeedsReview).length;
  if (review) findings.push(finding('EP-BENCH-PROMPT-REVIEW', 'info', `${review} prompts were redacted or are thin; review them in tasks.jsonl before validate`));
  return { data: { file: c.store.p('tasks.jsonl'), count: tasks.length,
    tasks: tasks.map(({ id, prompt, promptNeedsReview, tag, acceptanceFiles }) => ({ id, prompt, promptNeedsReview, tag, acceptanceFiles })) }, findings };
}

// G1: HEAD is the base, no remote, no ref or reflog reaches anything else, the reference doesn't exist and no stray objects remain.
export function historyFree(env, dir, t, refs) {
  const g = (...a) => git(env, dir, ...a);
  const reachable = lines(g('rev-list', '--objects', '--all', '--reflog')).length;
  return g('rev-parse', 'HEAD') === t.base && !g('remote') && !gitOk(env, dir, 'cat-file', '-e', `${t.reference}^{commit}`)
    && g('rev-list', '--all', '--reflog', '--count') === g('rev-list', 'HEAD', '--count')
    && lines(g('for-each-ref', '--format=%(refname)')).join() === refs.join()
    && lines(g('cat-file', '--batch-all-objects', '--batch-check=%(objectname)')).length === reachable;
}
function baseRepo(k, t) {
  const dir = path.join(k.work, `base-${t.id}`);
  if (fs.existsSync(dir)) {
    try { if (historyFree(k.env, dir, t, [BASE_REF])) return dir; } catch {} // rebuilt below
    rmDir(dir);
  }
  const g = (...a) => git(k.env, dir, ...a);
  git(k.env, k.work, 'clone', '--quiet', '--no-checkout', '--no-local', '--no-tags', k.commonDir, dir);
  g('remote', 'remove', 'origin');
  g('update-ref', BASE_REF, t.base);
  g('symbolic-ref', 'HEAD', BASE_REF);
  for (const r of lines(g('for-each-ref', '--format=%(refname)'))) if (r !== BASE_REF) g('update-ref', '-d', r);
  g('reflog', 'expire', '--expire=now', '--all');
  g('gc', '--quiet', '--prune=now');
  if (!historyFree(k.env, dir, t, [BASE_REF])) throw new Error(`couldn't build a history-free base for ${t.id}`);
  return dir;
}
export const dropBase = (k, id) => rmDir(path.join(k.work, `base-${id}`));
export function runClone(k, t, dir) {
  rmDir(dir);
  privateDir(path.dirname(dir));
  git(k.env, path.dirname(dir), 'clone', '--quiet', '--no-tags', baseRepo(k, t), dir);
  const g = (...a) => git(k.env, dir, ...a);
  g('checkout', '--quiet', '--detach');
  g('branch', '--quiet', '-D', 'bench-base');
  g('remote', 'remove', 'origin');
  g('reflog', 'expire', '--expire=now', '--all');
  if (!historyFree(k.env, dir, t, [])) throw new Error(`the clone for ${t.id} isn't history-free`);
  return dir;
}

const shell = (k, cmd, dir, timeoutMs) => shellRun(k.bash, cmd, { cwd: dir, env: k.env, timeoutMs });
export const accept = (k, t, dir) => shell(k, t.accept, dir, ACCEPT_MS);
async function prepare(k, t, dir) {
  if (!t.prepare) return;
  const p = await shell(k, t.prepare, dir, PREPARE_MS);
  if (p.code !== 0) throw new Error(`prepare failed: ${tail(p.out + p.err, 300)}`);
}
// Copy today's configuration in, run prepare and commit, so the run starts from a clean tree and the diff is the agent's alone.
export async function prepareClone(k, t, dir) {
  for (const rel of k.configFiles) {
    const from = path.join(k.repo, rel), to = inClone(dir, rel);
    if (rmDir(to)) throw new Error(`couldn't clear ${rel} in the clone`);
    if (!fs.existsSync(from)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    // A link in the user's tree is skipped (the confirmation lists it): copying it, or what it points at, could bring in files from anywhere.
    fs.cpSync(from, to, { recursive: true, filter: (src) => !fs.lstatSync(src).isSymbolicLink() });
  }
  await prepare(k, t, dir);
  const g = (...a) => git(k.env, dir, ...a);
  g('add', '-A');
  if (!gitOk(k.env, dir, 'diff', '--cached', '--quiet'))
    g('-c', `core.hooksPath=${k.noHooks}`, '-c', 'user.name=ep-bench', '-c', 'user.email=ep-bench@localhost', '-c', 'commit.gpgsign=false',
      'commit', '--quiet', '--no-verify', '-m', 'bench: configuration and prepare');
  g('reflog', 'expire', '--expire=now', '--all');
  return g('rev-parse', 'HEAD');
}
function writeBlob(k, rev, rel, dir) {
  const to = inClone(dir, rel);
  const r = gitRun(k.env, k.repo, ['cat-file', '--filters', `${rev}:${rel}`], { encoding: 'buffer' });
  if (r.code !== 0) throw new Error(`can't read ${rel} at ${rev.slice(0, 10)}`);
  if (rmDir(to)) throw new Error(`couldn't clear ${rel} in the clone`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, r.out, { flag: 'wx' }); // 'wx' never follows a link left at the path
}
// Grading always uses the reference tests, whatever the run did to them.
export const writeAcceptance = (k, t, dir) => t.acceptanceFiles.forEach((rel) => writeBlob(k, t.reference, rel, dir));
async function applyReference(k, t, dir) {
  const z = gitRun(k.env, k.repo, ['diff', '--name-status', '--no-renames', '-z', '--end-of-options', t.base, t.reference]).out.split('\0').filter(Boolean);
  for (let i = 0; i + 1 < z.length; i += 2)
    if (z[i] === 'D') fs.rmSync(inClone(dir, z[i + 1]), { force: true });
    else writeBlob(k, t.reference, z[i + 1], dir);
  await prepare(k, t, dir);
}
export function changes(env, dir, start) {
  git(env, dir, 'add', '-A');
  const tree = git(env, dir, 'write-tree');
  const files = lines(git(env, dir, 'diff', '--numstat', '--no-renames', start, tree)).map((l) => l.split('\t'))
    .map(([a, r, file]) => ({ file, lines: (+a || 0) + (+r || 0) }));
  return { files, deleted: lines(git(env, dir, 'diff', '--name-only', '--no-renames', '--diff-filter=D', start, tree)) };
}

// How many runs in a row behave as wanted before the first that doesn't (at most GATE_RUNS).
async function streak(k, t, dir, wantPass) {
  for (let i = 0; i < GATE_RUNS; i++) if (((await accept(k, t, dir)).code === 0) !== wantPass) return i;
  return GATE_RUNS;
}
async function gate(k, t) {
  const dir = path.join(k.work, `v-${t.id}`);
  const g = { g1: false, g2: false, g3: false, g4: false };
  try {
    runClone(k, t, dir);
    g.g1 = true;
    await prepareClone(k, t, dir);
    writeAcceptance(k, t, dir);
    const base = await streak(k, t, dir, false);
    if (!base) return { ...g, failed: 'G2', note: 'acceptance passes at the base, so it can\'t tell a solved task from an unsolved one' };
    await applyReference(k, t, dir);
    const ref = await streak(k, t, dir, true);
    if (!ref) return { ...g, g2: true, failed: 'G3', note: 'acceptance fails with the reference change applied' };
    if (base < GATE_RUNS || ref < GATE_RUNS)
      return { ...g, g2: true, g3: true, failed: 'G4', note: `flaky: ${base < GATE_RUNS ? `the base passed on run ${base + 1}` : `the reference failed on run ${ref + 1}`} of ${GATE_RUNS}` };
    return { g1: true, g2: true, g3: true, g4: true, failed: null, note: '' };
  } catch (e) {
    return { ...g, failed: g.g1 ? 'SETUP' : 'G1', note: tail(e.message, 300) };
  } finally {
    rmDir(dir);
  }
}

export async function validateTasks(c, o) {
  let rows = loadTasks(c);
  if (!rows.length) throw fail('EP-BENCH-NO-TASKS', 'no tasks yet: run bench tasks first');
  const chosen = o.task ? rows.filter((t) => t.id === o.task) : rows;
  if (!chosen.length) throw fail('EP-BENCH-USAGE', `no task ${o.task} in tasks.jsonl`, 2);
  const k = cloneContext(c), findings = [];
  await confirmRun(c, k, chosen, null); // the gates run the tasks' own commands on the repository's history
  for (const t of chosen) {
    const got = await gate(k, t), gates = { ...got, note: scrub(got.note), at: c.now().toISOString() }; // a failing command can echo a secret
    const next = { ...t, gates, valid: !gates.failed };
    rows = rows.map((x) => (x.id === t.id ? next : x));
    c.store.saveRows('tasks.jsonl', rows); // saved per task, so an interrupted validate keeps its progress
    dropBase(k, t.id);
    say(c.env, `${next.valid ? 'ok  ' : 'drop'} ${t.id}${gates.note ? ` - ${gates.note}` : ''}`);
    if (!next.valid) findings.push(finding(`EP-BENCH-GATE-${gates.failed}`, 'info', `${t.id} dropped: ${gates.note}`));
  }
  const valid = rows.filter((t) => t.valid && t.tag !== 'tuning');
  if (valid.length < 8) findings.push(finding('EP-BENCH-FEW-TASKS', 'warn', `${valid.length} valid held-out tasks; with fewer than 8 the report shows per-task results only`));
  return { data: { checked: chosen.length, survivors: rows.filter((t) => t.valid).map((t) => t.id),
    dropped: rows.filter((t) => t.gates && !t.valid).map((t) => ({ id: t.id, gate: t.gates.failed, note: t.gates.note })) }, findings };
}
