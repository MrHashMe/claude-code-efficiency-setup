// Shared helpers: hashes on normalized text, format-keeping atomic writes, paths, processes.
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, closeSync, cpSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { basename, delimiter, dirname, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const ENGINE = '8.0.0';
export const MIN_CLAUDE = '2.1.281';
export const WIN = process.platform === 'win32';
const BOM = '\uFEFF';
const BS = '\\';

export const fail = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
export const finding = (severity, code, message) => ({ code, severity, message });

// N-7: token shapes (Anthropic, OpenAI, GitHub, Slack, AWS, JWT, Bearer, npm, Hugging Face, Stripe, PyPI, GitLab),
// URL credentials (with or without a user name), Authorization headers, credential flags (-u user:pw, --token x,
// mysql -pX, sshpass and docker login -p, aws_secret_access_key x) and name=value secrets are masked in everything
// the engine and the bench print, save or journal. A bare "key" counts only before "=", so the engine's own "key": fields and item keys
// (key:~/...) stay readable. Every pattern reads a bounded stretch from each start (or starts only where a run
// of its characters begins), so a long text made of near-matches is read in linear time, not once per start.
const SECRETS = [
  [/\bsk-(?:ant-|proj-)?[\w-]{16,}/g, '[redacted]'],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,})/g, '[redacted]'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, '[redacted]'],
  [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '[redacted]'],
  [/\b(?:npm_|hf_)[A-Za-z0-9]{20,}|\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}|\bpypi-[\w-]{20,}|\bglpat-[\w-]{16,}/g, '[redacted]'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[redacted]'],
  [/(?<![\w-])eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*/g, '[redacted]'],
  [/\b([a-z][a-z0-9+.-]{0,31}:\/\/)[^\s/@:]+(?::[^\s/@]*)?@/gi, '$1[redacted]@'],
  [/(\/\/[^\s/:@"']*:)[^\s@/"']+@/g, '$1[redacted]@'],
  [/\b(Bearer\s+)[\w.~+/=-]{8,}/gi, '$1[redacted]'],
  [/(Authorization["']?\s*[:=]\s*["']?(?:\w+\s+)?)[^\s"']+/gi, '$1[redacted]'],
  [/((?:token|secret|passw(?:or)?d|credential|api[-_]?key|[A-Za-z0-9][_.-]?key)["']?\s*[:=]\s*)(?:"[^"$`\\]*"|'[^']*')/gi, '$1[redacted]'],
  [/(\s(?:-u|--user|--proxy-user)[\s=]+["']?)[^\s:"']+:[^\s"']+/g, '$1[redacted]'],
  [/(--(?:auth|api[-_]?key|token|secret|password|passwd|pass)(?:\s+|=)["']?)[^\s"'=-][^\s"']*/gi, '$1[redacted]'],
  [/(\bmysql\w*\b[^\n|;&]{0,200}?\s-p)\S+/g, '$1[redacted]'],
  [/(\b(?:sshpass|(?:docker|podman) login)\b[^\n|;&]{0,200}?\s-p[ \t]*)(?:"[^"]*"|'[^']*'|\S+)/g, '$1[redacted]'],
  [/(\baws_(?:secret_access_key|session_token)\s+)(?:"[^"]*"|'[^']*'|\S+)/gi, '$1[redacted]'],
  [/(token|secret|password|passwd|[A-Za-z0-9][_.-]?key)\b(["']?\s*[:=]\s*["']?)(?![~<\/[{(])[^\s"',;]+/gi, '$1$2[redacted]'],
  [/\b(key\s*=\s*["']?)(?![~<\/[{(])[^\s"',;]+/gi, '$1[redacted]'],
];
export const redact = (text) => SECRETS.reduce((s, [re, to]) => s.replace(re, to), String(text ?? ''));

// Text from a repository or a file name reaches the terminal: control characters (not tab or newline), format
// characters (bidi marks, zero-width marks, soft hyphen, byte-order mark, tags) and line or paragraph separators show
// as \u{XXXX}. The escape holds none of those characters, so printing it twice changes nothing.
const UNSAFE = /(?![\t\n])[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
export const printable = (s) => String(s ?? '').replace(UNSAFE, (c) => `\\u{${c.codePointAt(0).toString(16).toUpperCase()}}`);
// The same characters in JSON text, as JSON escapes of each UTF-16 unit, which parse back to the original string.
export const printableJson = (text) => text.replace(UNSAFE, (c) => c.split('').map((u) => `\\u${u.charCodeAt(0).toString(16).padStart(4, '0')}`).join(''));

// N-11: hashes ignore CRLF and the byte-order mark, so autocrlf and PowerShell encodings don't fake an edit.
export const normalize = (text) => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
export const sha256 = (s) => 'sha256:' + createHash('sha256').update(s).digest('hex');
export const textHash = (text) => (text == null ? null : sha256(normalize(text)));
export const canonical = (v) =>
  JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
export const valueHash = (v) => (v === undefined ? null : sha256(canonical(v)));
export const tokens = (text) => Math.round(Buffer.byteLength(text ?? '', 'utf8') / 3.5);

export const homeDir = (env) => (WIN ? env.USERPROFILE : env.HOME) || homedir();
export const userName = () => userInfo().username.toLowerCase().replace(/[^a-z0-9-]/g, '-');
export const slash = (p) => p.split(BS).join('/');
export const fold = (p) => (WIN || process.platform === 'darwin' ? p.toLowerCase() : p);
export const isInside = (child, parent) => fold(slash(resolve(child))).startsWith(fold(slash(resolve(parent))).replace(/\/$/, '') + '/');
export const samePath = (a, b) => fold(slash(resolve(a))) === fold(slash(resolve(b)));

// I4: files the engine never opens, whatever a plan or manifest says.
export function isSecretPath(p) {
  const parts = slash(resolve(p)).toLowerCase().split('/');
  const name = parts.at(-1);
  if (parts.includes('.ssh') || parts.includes('.aws') || parts.includes('.gnupg')) return true;
  // .claude.json and its backups hold the agent's account record and the env of MCP servers.
  if (['.credentials.json', '.git-credentials', '.npmrc', '.netrc', '.pypirc'].includes(name) || name.startsWith('.env') || name.startsWith('.claude.json')) return true;
  return (name === 'auth.json' && parts.at(-2) === '.codex') || (name === 'hosts.yml' && parts.at(-2) === 'gh');
}
// The path with every link in its deepest existing part resolved; what lies below that may not exist yet.
export function realPath(p) {
  const rest = [];
  let head = resolve(p);
  for (;;) {
    try {
      return join(realpathSync.native(head), ...rest);
    } catch {
      const up = dirname(head);
      if (up === head) return resolve(p);
      rest.unshift(basename(head));
      head = up;
    }
  }
}
// A link to a credential file is still a credential path.
const guard = (p) => {
  if (isSecretPath(p) || isSecretPath(realPath(p))) throw fail('EP-SECRET-PATH', `refusing to open a credential path: ${p}`, { exit: 3 });
};

export function readText(p) {
  guard(p);
  try {
    return readFileSync(p, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return null;
    throw e;
  }
}
export const fileHash = (p) => textHash(readText(p));
// The bytes as written, for a hash another tool took of the file (v7's manifest).
export function readBytes(p) {
  guard(p);
  return readFileSync(p);
}
export function readJson(p, fallback = null) {
  const text = readText(p);
  return text == null ? fallback : JSON.parse(normalize(text));
}

// Keep the target's BOM and line endings; new files get LF and no BOM (N-11).
export function matchFormat(text, previous) {
  let out = normalize(text);
  if (previous?.includes('\r\n')) out = out.replace(/\n/g, '\r\n');
  if (previous?.startsWith(BOM)) out = BOM + out;
  return out;
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Same-folder temp file, flushed, then rename; Windows editors and scanners hold files open, so retry with backoff.
// A symlinked target (a dotfiles repository) is written through, and the file keeps its mode. A file that isn't
// valid UTF-8 is never rewritten: the engine reads text, so the write would turn its odd bytes into U+FFFD.
export function atomicWrite(p, text) {
  guard(p);
  if (WIN && resolve(p).length >= 260) throw fail('EP-PATH-TOO-LONG', `path longer than 259 characters: ${p}`);
  let dest = p;
  let mode;
  try {
    dest = realpathSync(p);
    guard(dest);
    mode = statSync(dest).mode & 0o7777;
    const bytes = readFileSync(dest);
    if (!bytes.equals(Buffer.from(bytes.toString('utf8')))) {
      throw fail('EP-NOT-UTF8', `${p} isn't valid UTF-8, so the engine won't rewrite it (that would replace the odd bytes); convert it to UTF-8, then plan again`);
    }
  } catch (e) {
    if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e;
  }
  mkdirSync(dirname(dest), { recursive: true });
  // A name nobody can guess, created only if nothing has it: a link planted beside the target can't take the write.
  const tmp = `${dest}.ep-${randomBytes(6).toString('hex')}.tmp`;
  const fd = openSync(tmp, 'wx', mode ?? 0o666);
  try {
    writeFileSync(fd, text);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  if (mode !== undefined) chmodSync(tmp, mode);
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(tmp, dest);
      return;
    } catch (e) {
      if (!WIN || attempt === 3 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) {
        try {
          unlinkSync(tmp);
        } catch {}
        throw e;
      }
      sleep(100 * 2 ** attempt);
    }
  }
}

export const writeJson = (p, value) => atomicWrite(p, JSON.stringify(value, null, 2) + '\n');
// N-7: state folders are private to the user; mode is a no-op on Windows, where the profile ACL does this.
export const privateDir = (dir) => mkdirSync(dir, { recursive: true, mode: 0o700 });

// Moves never delete: quarantine and backups keep the bytes. Works for files and folders.
export function moveFile(from, to) {
  guard(from);
  mkdirSync(dirname(to), { recursive: true });
  try {
    renameSync(from, to);
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true });
  }
}

export function displayPath(p, { home, repo } = {}) {
  const abs = slash(resolve(p));
  for (const [base, label] of [[repo, '<repo>'], [home, '~']]) {
    if (base && (samePath(abs, base) || isInside(abs, base))) return label + abs.slice(slash(resolve(base)).replace(/\/$/, '').length);
  }
  return abs;
}

// A program starts in the home folder unless a folder is given: the repository you happen to stand in is not
// where a tool should find its files first (a planted config, a hook, a language server setting).
export function run(cmd, args, { cwd, env, timeout = 120000, input } = {}) {
  // Windows looks in the working folder before PATH, so a repository could plant git.exe: spawn the PATH hit only.
  const exe = WIN && !/[\\/]/.test(cmd) ? which(cmd, { ...(env ?? process.env), PATHEXT: '.COM;.EXE' }) : cmd;
  if (!exe) return { ok: false, status: null, stdout: '', stderr: '', error: 'ENOENT' };
  const r = spawnSync(exe, args, { cwd: cwd ?? homeDir(env ?? process.env), env, timeout, input, encoding: 'utf8', windowsHide: true, shell: false });
  return { ok: r.status === 0, status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error?.code ?? null };
}

// PATH lookup without executing anything (npm shims are .cmd files spawn can't run without a shell).
export function which(name, env = process.env) {
  const exts = WIN ? (env.PATHEXT || '.COM;.EXE;.BAT;.CMD').toLowerCase().split(';') : [''];
  for (const dir of (env.PATH ?? env.Path ?? '').split(delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const f = join(dir, name + ext);
      try {
        if (existsSync(f) && statSync(f).isFile()) return f;
      } catch {}
    }
  }
  return null;
}

// A tool the agent would start. rustup puts a proxy (a copy of rustup) for every tool in its bin folder whether
// the component is installed or not, so a proxy counts only if some toolchain holds the real binary.
// ponytail: any installed toolchain counts; the one a project selects (rust-toolchain.toml, overrides) isn't resolved.
export function toolPath(name, env = process.env) {
  const f = which(name, env);
  const rustup = f && join(dirname(f), `rustup${extname(f)}`);
  if (!f || !existsSync(rustup) || statSync(rustup).size !== statSync(f).size) return f;
  const dir = join(env.RUSTUP_HOME || join(homeDir(env), '.rustup'), 'toolchains');
  return existsSync(dir) && readdirSync(dir).some((t) => existsSync(join(dir, t, 'bin', basename(f)))) ? f : null;
}

// The agent's CLI for plugin rows; npm's .cmd shims need a shell, which the engine never starts.
export function agentCli(env) {
  if (env.EP_AGENT_CLI === 'none') return null;
  const cli = env.EP_AGENT_CLI || which('claude', env);
  return cli && !/\.(cmd|bat)$/i.test(cli) ? cli : null;
}

export const versionAtLeast = (v, min) => {
  const a = String(v).match(/\d+/g)?.map(Number) ?? [];
  const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
  return true;
};
