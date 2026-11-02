// Process, git and file helpers for the bench. Nothing here makes a network call.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { privateDir, redact, which } from '../util.mjs';

export { privateDir }; // bench state is private: folders 0700, files 0600 (no effect on Windows)
export const WIN = process.platform === 'win32';
export const finding = (code, severity, message) => ({ code, severity, message });
export const fail = (code, message, exitCode = 1) => Object.assign(new Error(message), { code, exitCode });
export const tail = (s, n = 400) => String(s ?? '').trim().slice(-n);
export const lines = (s) => String(s).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
export const unBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
export const sha = (d) => createHash('sha256').update(d).digest('hex');
export const canonical = (v) => JSON.stringify(v, (_, x) =>
  x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x);
const digest = (v) => sha(typeof v === 'string' ? v : canonical(v));
export const hash12 = (v) => digest(v).slice(0, 12); // for display and grouping only
export const hash32 = (v) => digest(v).slice(0, 32); // 128 bits: what a plan or a file is bound by, always compared whole
export const say = (env, msg) => { if (!env.EP_BENCH_QUIET) process.stderr.write(`${msg}\n`); };
export const configDir = (env) => env.CLAUDE_CONFIG_DIR || path.join((WIN ? env.USERPROFILE : env.HOME) || os.homedir(), '.claude');

// Secrets out of anything printed or saved, with util's redact. With keepCode the text stays whole when masking would hide something a
// shell runs (a quoted value can hold $(...)): a listing a person decides on can't be spoofed.
const active = (s) => (s.match(/[$`;&|<>()\\]/g) ?? []).length;
export function scrub(text, keepCode = false) {
  const raw = String(text ?? '').slice(0, 20000), masked = redact(raw);
  return keepCode && active(masked) < active(raw) ? raw : masked;
}

export function readJson(p) {
  try {
    return JSON.parse(unBom(fs.readFileSync(p, 'utf8')));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new Error(`can't read ${p}: ${e.message}`);
  }
}

// Programs start by absolute path only. Windows (and a relative PATH entry) looks in the current folder first, where a repository could
// plant git.exe, claude.exe or cmd.exe, so PATH is searched here, in absolute entries only, and System32 comes from SystemRoot.
export function exe(name, env, exts = '.EXE;.COM') {
  const dirs = String(env.PATH ?? env.Path ?? '').split(path.delimiter).filter((d) => path.isAbsolute(d));
  return which(name, { PATH: dirs.join(path.delimiter), PATHEXT: exts });
}
const sys32 = (name) => path.join(process.env.SystemRoot ?? process.env.windir, 'System32', name);

export function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true, ...opts });
  if (r.error) throw r.error;
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}
export function gitRun(env, cwd, args, opts = {}) {
  const exePath = exe('git', env);
  if (!exePath) throw fail('EP-BENCH-NO-GIT', 'git is not on PATH', 3);
  return sh(exePath, ['-c', 'core.quotepath=off', ...args], { cwd, env, ...opts });
}
export function git(env, cwd, ...args) {
  const r = gitRun(env, cwd, args);
  if (r.code !== 0) throw new Error(`git ${args.slice(0, 2).join(' ')} failed: ${tail(r.err, 300)}`);
  return r.out.trim();
}
export const gitOk = (env, cwd, ...args) => gitRun(env, cwd, args).code === 0;

export function rmDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    return null;
  } catch {
    return dir; // the caller records it as a leftover (Windows keeps files open for a while)
  }
}
// Links are hashed as links, never followed: a link in a folder can't pull in (or loop through) what it points at.
function hashInto(h, p) {
  const st = fs.lstatSync(p, { throwIfNoEntry: false });
  if (st?.isSymbolicLink()) h.update(`link\0${fs.readlinkSync(p)}`);
  else if (st?.isDirectory()) for (const n of fs.readdirSync(p).sort()) { h.update(`${n}\0`); hashInto(h, path.join(p, n)); }
  else if (st) h.update(fs.readFileSync(p));
}
export function hashPath(p) {
  if (!p || !fs.lstatSync(p, { throwIfNoEntry: false })) return null;
  const h = createHash('sha256');
  hashInto(h, p);
  return h.digest('hex').slice(0, 32);
}

export function killTree(pid) {
  try {
    if (WIN) spawnSync(sys32('taskkill.exe'), ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
    else process.kill(-pid, 'SIGKILL');
  } catch {} // already gone
}
// Every process started here, so that a signal to the bench or its exit stops them all: on POSIX each runs detached, in its own process group,
// where Ctrl-C and a closed terminal don't reach it.
const live = new Set();
export const killAll = () => live.forEach(killTree);
process.on('exit', killAll);
// `finished` marks the output that ends a run; a headless agent can stay alive after its result record (CC#103116),
// so once it shows up the process gets graceMs to exit on its own before it is stopped. Output is kept in memory up to maxBytes a stream:
// the first chunk (the init record) and the newest stay, the middle goes, and `truncated` says so.
export function runProc(cmd, args, { cwd, env, input = '', shell = false, timeoutMs = 0, finished = null, graceMs = 15000, maxBytes = 1 << 26 } = {}) {
  return new Promise((resolve) => {
    const out = [], err = [];
    let killed = false, lingered = false, truncated = false, timer = null, grace = null, last = '', child;
    const done = (code, spawnError = null) => {
      live.delete(child?.pid);
      clearTimeout(timer);
      clearTimeout(grace);
      resolve({ code, killed, lingered, truncated, spawnError, out: Buffer.concat(out).toString('utf8'), err: Buffer.concat(err).toString('utf8') });
    };
    const keep = (list, d) => {
      list.push(d);
      list.bytes = (list.bytes ?? 0) + d.length;
      if (list.bytes <= maxBytes) return;
      let n = 1; // drops the oldest chunks after the first until half of maxBytes is free, so this costs little per chunk
      while (list.bytes > maxBytes / 2 && n < list.length - 1) list.bytes -= list[n++].length;
      list.splice(1, n - 1);
      truncated = true;
    };
    try {
      child = spawn(cmd, args, { cwd, env, shell: shell && WIN ? sys32('cmd.exe') : shell, windowsHide: true, detached: !WIN });
    } catch (e) {
      return done(null, e.code || e.message);
    }
    if (child.pid) live.add(child.pid);
    if (timeoutMs) timer = setTimeout(() => { killed = true; killTree(child.pid); }, timeoutMs);
    child.stdout.on('data', (d) => {
      keep(out, d);
      last = (last + d).slice(-4096);
      if (finished && !grace && finished.test(last)) grace = setTimeout(() => { lingered = true; killTree(child.pid); }, graceMs);
    });
    child.stderr.on('data', (d) => keep(err, d));
    child.on('error', (e) => done(null, e.code || String(e)));
    child.on('close', (code) => {
      if (!WIN) try { process.kill(-child.pid, 'SIGKILL'); } catch {} // the group may already be gone
      done(code);
    });
    child.stdin.on('error', () => {}); // the child may exit before reading its input
    child.stdin.end(input);
  });
}

// Commands from the project's command map are written for Claude Code's Bash tool, so on Windows they run in Git Bash.
export function gitBash(env) {
  if (!WIN) return null;
  if (env.CLAUDE_CODE_GIT_BASH_PATH && fs.existsSync(env.CLAUDE_CODE_GIT_BASH_PATH)) return env.CLAUDE_CODE_GIT_BASH_PATH;
  const g = exe('git', env);
  for (const up of ['..', path.join('..', '..')]) {
    const c = g && path.resolve(path.dirname(g), up, 'bin', 'bash.exe');
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}
export const shellRun = (bash, command, opts) => (bash ? runProc(bash, ['-c', command], opts) : runProc(command, [], { ...opts, shell: true }));

// EP_BENCH_AGENT replaces `claude` (tests point it at a script that replays recorded stream-json).
export function agentCommand(env) {
  const alt = env.EP_BENCH_AGENT;
  if (alt) return /\.[cm]?js$/i.test(alt) ? { cmd: process.execPath, pre: [alt] } : { cmd: alt, pre: [] };
  const real = exe('claude', env), shim = WIN && exe('claude', env, '.CMD;.BAT');
  if (real) return { cmd: real, pre: [] };
  if (shim) return { cmd: shim, pre: [], viaCmd: true };
  throw fail('EP-BENCH-NO-AGENT', 'claude is not on PATH: install the Claude Code CLI and open a new terminal', 3);
}
export function launchAgent(agent, args, opts) {
  if (!agent.viaCmd) return runProc(agent.cmd, [...agent.pre, ...args], opts);
  // A .cmd shim only starts through cmd.exe, so the prompt goes on stdin and the fixed arguments are quoted here.
  for (const a of args) if (/["%\r\n]/.test(a)) throw new Error(`can't pass this argument through cmd.exe safely: ${a.slice(0, 60)}`);
  // Backslashes before the closing quote would escape it, so a trailing run of them is doubled.
  return runProc([agent.cmd, ...args].map((a) => `"${a.replace(/\\+$/, '$&$&')}"`).join(' '), [], { ...opts, shell: true });
}

// The bench folder: JSON files and JSONL tables.
export function store(dir) {
  const p = (f) => path.join(dir, f);
  const save = (f, v) => {
    privateDir(dir);
    fs.writeFileSync(p(f), typeof v === 'string' ? v : JSON.stringify(v, null, 2) + '\n', { mode: 0o600 }); // only a new file takes the mode
  };
  return {
    dir, p, save,
    json: (f) => readJson(p(f)),
    rows: (f) => (fs.existsSync(p(f)) ? fs.readFileSync(p(f), 'utf8').split('\n') : []).filter((l) => l.trim()).map((l, i) => {
      try {
        return JSON.parse(l);
      } catch {
        throw new Error(`${p(f)} line ${i + 1} isn't valid JSON; fix or delete that line`);
      }
    }),
    saveRows: (f, rows) => save(f, rows.map((r) => JSON.stringify(r) + '\n').join('')),
    append: (f, row) => {
      privateDir(dir);
      fs.appendFileSync(p(f), JSON.stringify(row) + '\n', { mode: 0o600 });
    },
  };
}
