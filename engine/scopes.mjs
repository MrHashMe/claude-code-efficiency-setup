// Scopes: state root, scope keys, git facts and the paths each scope may write (I1 in 10-threat-model).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { delimiter, join, relative, resolve } from 'node:path';
import { WIN, fail, homeDir, isInside, realPath, run, samePath, slash, userName } from './util.mjs';

export const stateRoot = (env) =>
  env.EP_STATE_DIR ||
  (WIN
    ? join(env.LOCALAPPDATA || join(homeDir(env), 'AppData', 'Local'), 'efficiency-playbook')
    : join(env.XDG_STATE_HOME || join(homeDir(env), '.local', 'state'), 'efficiency-playbook'));
export const configDir = (env) => env.CLAUDE_CONFIG_DIR || join(homeDir(env), '.claude');

// U-4: the managed settings folder per OS (WSL reads the Linux one), as the settings docs list it; the
// legacy C:/ProgramData location is no longer read. managed-settings.d/*.json merge after the main file
// in name order, hidden files skipped. EP_MANAGED_SETTINGS (a path-delimiter list) replaces all of this,
// so tests never read the machine's policy. onError hears about a drop-in folder that can't be listed.
export const MANAGED = { win32: 'C:/Program Files/ClaudeCode', darwin: '/Library/Application Support/ClaudeCode', linux: '/etc/claude-code' };
export function managedFiles(env, onError = () => {}) {
  if (env.EP_MANAGED_SETTINGS != null) return env.EP_MANAGED_SETTINGS.split(delimiter).filter(Boolean);
  const dir = MANAGED[process.platform] ?? MANAGED.linux;
  const drop = join(dir, 'managed-settings.d');
  let names = [];
  try {
    names = readdirSync(drop).filter((f) => f.endsWith('.json') && !f.startsWith('.')).sort();
  } catch (e) {
    if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') onError(drop, e);
  }
  return [join(dir, 'managed-settings.json'), ...names.map((f) => join(drop, f))];
}

// One key per folder however it's spelled: real path, forward slashes, case-folded where the file system ignores case.
export function normPath(p) {
  let out = resolve(p);
  try {
    out = realpathSync.native(out);
  } catch {}
  out = slash(out).replace(/^([A-Z]):/, (_, d) => d.toLowerCase() + ':');
  return WIN || process.platform === 'darwin' ? out.toLowerCase() : out;
}
export const pathKey = (p) => createHash('sha256').update(normPath(p)).digest('hex').slice(0, 12);

// Git starts with the caller's GIT_DIR, GIT_CONFIG_*, GIT_EXTERNAL_DIFF and the like left out: they can send it anywhere.
// GIT_CEILING_DIRECTORIES only limits how far up it looks for a repository, so it stays.
export const gitEnv = (env) => Object.fromEntries(Object.entries(env).filter(([k]) => !/^GIT_/i.test(k) || k.toUpperCase() === 'GIT_CEILING_DIRECTORIES'));

export function gitFacts(cwd, env) {
  const r = run('git', ['rev-parse', '--path-format=absolute', '--show-toplevel', '--git-common-dir', '--git-path', 'info/exclude'], { cwd, env: gitEnv(env) });
  if (!r.ok) return null;
  const [top, commonDir, exclude] = r.stdout.trim().split(/\r?\n/).map((p) => resolve(p));
  return { top, commonDir, exclude };
}

// L-11: a project apply leaves the commit to the user. Only read-only git runs here, and not `git status`: it
// refreshes the index through the repository's own core.fsmonitor program and its filter drivers, which a cloned
// repository can set. ls-files only reads the index and the folder; status lines are built from that and what
// the apply wrote. The engine never stages, commits or pushes anything.
export function gitChanges(sc, targets, env) {
  const paths = [...new Set(targets.filter((p) => isInside(p, sc.repo)).map((p) => slash(relative(sc.repo, p))))].sort();
  if (!paths.length) return null;
  const args = ['--no-optional-locks', '--literal-pathspecs', '-c', 'core.fsmonitor=false', 'ls-files', '-t', '--cached', '--others', '--exclude-standard', '-z', '--', ...paths];
  const r = run('git', args, { cwd: sc.repo, env: gitEnv(env) });
  const tag = new Map(r.ok ? r.stdout.split('\0').filter(Boolean).map((l) => [l.slice(2), l[0]]) : []);
  const line = (p) => (tag.get(p) === '?' ? `?? ${p}` : `${existsSync(join(sc.repo, p)) ? ' M' : ' D'} ${p}`);
  return { status: paths.filter((p) => tag.has(p)).map(line), add: paths };
}

export function resolveScope(scope, { cwd, env }) {
  const home = homeDir(env);
  const cfg = configDir(env);
  const root = stateRoot(env);
  const base = { scope, home, configDir: cfg, stateRoot: root, cwd };
  if (scope === 'user') {
    const key = `user-claude-${pathKey(cfg)}`;
    return {
      ...base,
      key,
      dir: join(root, 'scopes', key),
      repo: null,
      rulesFile: join(cfg, 'rules', 'efficiency-playbook.md'),
      settings: join(cfg, 'settings.json'),
      lockFile: join(cfg, 'efficiency-playbook.lock.json'),
    };
  }
  if (scope !== 'project' && scope !== 'local') throw fail('EP-USAGE', `unknown scope "${scope}": use user, project or local`, { exit: 2 });
  const git = gitFacts(cwd, env);
  if (!git) throw fail('EP-NOT-A-REPO', `${scope} scope needs a git working tree; use --scope user here`, { exit: 2 });
  // By real path: a link to the home folder is still the home folder.
  const [top, realHome, realCfg] = [git.top, home, cfg].map(realPath);
  if (samePath(top, realHome) || isInside(realHome, top) || samePath(top, realCfg) || isInside(top, realCfg)) {
    throw fail('EP-REPO-REFUSED', `${scope} scope refused: the repository's top level is the home folder, a parent of it or an agent config folder, so its files would load in every project`, { exit: 3 });
  }
  // Linked worktrees share one git folder but each has its own working files, so each is its own local install:
  // its state and its block in the shared exclude file are keyed by its own top folder.
  const key = scope === 'project' ? `project-${pathKey(git.commonDir)}` : `local-${pathKey(git.top)}-${userName()}`;
  const dotClaude = join(git.top, '.claude');
  return {
    ...base,
    key,
    dir: join(root, 'scopes', key),
    repo: git.top,
    commonDir: git.commonDir,
    blockId: `efficiency-playbook-${pathKey(git.top)}`,
    exclude: git.exclude,
    rulesFile: join(dotClaude, 'rules', scope === 'project' ? 'efficiency-playbook.md' : 'efficiency-playbook.local.md'),
    settings: join(dotClaude, scope === 'project' ? 'settings.json' : 'settings.local.json'),
    lockFile: scope === 'project' ? join(git.top, '.efficiency-playbook.json') : null,
  };
}

// What v7 wrote at user scope; the migration may move these and nothing else in the config folder.
export const V7_USER_PATHS = [
  'rules/token-efficiency.md',
  'skills/project-setup',
  'skills/setup-check',
  'skills/memory-lint',
  'skills/paired-check',
  'hooks/project-setup-nudge.js',
  'hooks/project-setup-nudge.test.js',
  'project-setup-state.json',
];

// The paths a scope names, spelled as it spells them. The exclude file is the local install's alone.
function listed(sc, p) {
  if ([sc.rulesFile, sc.settings, sc.lockFile, sc.scope === 'local' && sc.exclude].some((f) => f && samePath(f, p))) return true;
  if (sc.scope === 'user') {
    if (isInside(p, join(sc.configDir, 'efficiency-playbook'))) return true;
    return V7_USER_PATHS.some((rel) => {
      const t = join(sc.configDir, rel);
      return samePath(p, t) || isInside(p, t);
    });
  }
  return sc.scope === 'project' && samePath(p, join(sc.repo, 'CLAUDE.md'));
}

// I1: the only paths a scope may write. A link in the config folder is the user's own (a dotfiles repository), but a link
// inside a repository comes from whoever wrote it, so there the path must really lead into the repository (for the
// exclude file, its shared git folder) and not out through a link.
export function mayWrite(sc, p) {
  if (isInside(p, sc.stateRoot)) return true;
  if (!listed(sc, p)) return false;
  if (sc.scope === 'user') return true;
  const real = realPath(p);
  return [sc.repo, sc.commonDir].some((root) => isInside(real, realPath(root)));
}
