// C-9, U-2 and U-5: the instruction files, rules, skills and auto memory Claude Code loads into a session
// started in the current folder, checked for length, for folders above the repository and for hidden
// characters. Report only: the engine never edits these files.
import { existsSync, readdirSync } from 'node:fs';
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { configDir, gitFacts, normPath } from './scopes.mjs';
import { displayPath, finding, homeDir, isSecretPath, normalize, readText, tokens } from './util.mjs';

const MAX_LINES = 200; // Claude Code's guidance per instruction file, and the MEMORY.md lines it loads
const MEMORY_BYTES = 25 * 1024; // the MEMORY.md bytes it loads
const CLAUDE_FILES = ['CLAUDE.md', join('.claude', 'CLAUDE.md'), 'CLAUDE.local.md'];
const AGENTS_FILES = ['AGENTS.md', join('.claude', 'AGENTS.md')];
// Zero-width and bidirectional controls, invisible operators, isolates, a BOM past the start, tag characters,
// and two or more variation selectors in a row (one follows an emoji; a run encodes hidden bytes): an editor
// doesn't show them, the model reads them. normalize drops one leading BOM.
export const HIDDEN = /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u{E0000}-\u{E007F}]|[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]{2,}/u;
const HIDDEN_ALL = new RegExp(HIDDEN.source, 'gu');

const lineCount = (t) => (t ? t.split('\n').length - (t.endsWith('\n') ? 1 : 0) : 0);

// Every .md file under dir, minus credential paths, which the engine never opens.
export function mdFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { recursive: true, withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return [];
    throw e;
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => join(e.parentPath ?? e.path, e.name))
    .filter((p) => !isSecretPath(p))
    .sort();
}

// The folders from the repository top down to the working folder (just the working folder outside one).
function projectDirs(cwd, top) {
  if (!top) return [resolve(cwd)];
  const rel = relative(normPath(top), normPath(cwd));
  const parts = rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel.split(/[\\/]/) : [];
  return parts.reduce((dirs, p) => [join(dirs[0], p), ...dirs], [top]);
}

// Folders above base, up to but not including the file system root, which Claude Code doesn't read. The
// walk also stops at a GIT_CEILING_DIRECTORIES entry, as git's own discovery does, so a sandbox (the
// tests, selftest) never reads the real folders around it.
function ancestors(base, env) {
  const ceilings = (env.GIT_CEILING_DIRECTORIES ?? '').split(delimiter).filter(Boolean).map(normPath);
  const out = [];
  for (let d = dirname(base); dirname(d) !== d && !ceilings.includes(normPath(d)); d = dirname(d)) out.push(d);
  return out;
}

// CLAUDE.md, .claude/CLAUDE.md and CLAUDE.local.md in each folder, nearest first. An AGENTS.md counts only
// when neither its folder nor one above it has one of those (the rule the design doc gives; inferred). The
// config folder's CLAUDE.md and rules are the user's own files, not a folder's; compared by real path,
// since the folders here come from git, which prints real paths.
function folderFiles(dirs, cfg) {
  const [mine, rules] = [normPath(join(cfg, 'CLAUDE.md')), `${normPath(join(cfg, 'rules'))}/`];
  const own = (p) => normPath(p) === mine || normPath(p).startsWith(rules);
  const here = (d, names) => names.map((n) => join(d, n)).filter((p) => !own(p) && !isSecretPath(p) && existsSync(p));
  const claude = dirs.map(({ d }) => here(d, CLAUDE_FILES));
  return dirs.flatMap(({ d, above }, i) => [...claude[i], ...(claude.slice(i).some((x) => x.length) ? [] : here(d, AGENTS_FILES))].map((p) => ({ p, d, above })));
}

// Auto memory's folder name is inferred, not documented: the main checkout's absolute path with every
// character other than a letter, digit or hyphen replaced by a hyphen. Worktrees share the main
// checkout's memory, so a worktree maps to the folder that holds its common .git.
function memoryFile(cfg, git, cwd) {
  const main = git ? (basename(git.commonDir) === '.git' ? dirname(git.commonDir) : git.top) : resolve(cwd);
  return join(cfg, 'projects', main.replace(/[^A-Za-z0-9-]/g, '-'), 'memory', 'MEMORY.md');
}

function hiddenFinding(p, text, disp) {
  const lines = text.split('\n').flatMap((l, k) => (HIDDEN.test(l) ? [k + 1] : []));
  if (!lines.length) return [];
  const chars = [...new Set([...text.matchAll(HIDDEN_ALL)].map((m) => `U+${m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`))];
  const more = lines.length > 1 ? ` and ${lines.length - 1} more line(s)` : '';
  return [finding('warn', 'EP-HIDDEN-UNICODE', `${disp(p)} line ${lines[0]}${more}: invisible or bidirectional characters (${chars.slice(0, 5).join(', ')}) that the agent reads but an editor doesn't show; check the text says what it seems to (report only)`)];
}

export function loadedFindings(ctx) {
  const { cwd, env } = ctx;
  const cfg = configDir(env);
  const git = gitFacts(cwd, env);
  const top = git?.top ?? null;
  const disp = (p) => displayPath(p, { home: homeDir(env), repo: top });
  const dirs = projectDirs(cwd, top);
  const folders = folderFiles([...dirs.map((d) => ({ d, above: false })), ...ancestors(top ?? resolve(cwd), env).map((d) => ({ d, above: true }))], cfg);
  // kind: 'cap' gets the 200-line check, 'above' the ancestor report, 'memory' its load limit; all get
  // the hidden-character scan. A file reached twice (a session in the home folder) counts once.
  const files = [
    ...[join(cfg, 'CLAUDE.md'), ...mdFiles(join(cfg, 'rules'))].map((p) => ({ p, kind: 'cap' })),
    ...folders.map((x) => ({ ...x, kind: x.above ? 'above' : 'cap' })),
    ...dirs.flatMap((d) => mdFiles(join(d, '.claude', 'rules'))).map((p) => ({ p, kind: 'cap' })),
    { p: memoryFile(cfg, git, cwd), kind: 'memory' },
    ...[join(cfg, 'skills'), ...dirs.map((d) => join(d, '.claude', 'skills'))].flatMap(mdFiles).map((p) => ({ p, kind: 'skill' })),
  ];
  const seen = new Set();
  const out = [];
  for (const x of files) {
    const k = normPath(x.p);
    if (seen.has(k)) continue;
    seen.add(k);
    const raw = readText(x.p);
    if (raw == null) continue;
    const text = normalize(raw);
    const n = lineCount(text);
    if (x.kind === 'cap' && n > MAX_LINES) {
      out.push(finding('warn', 'EP-SIZE-CAP', `${disp(x.p)} is ${n} lines; Claude Code's guidance is under ${MAX_LINES} lines per instruction file, since longer files cost tokens every session and are followed less reliably; move task-specific parts into skills or path-scoped .claude/rules files`));
    }
    const bytes = Buffer.byteLength(raw);
    if (x.kind === 'memory' && (n > MAX_LINES || bytes > MEMORY_BYTES)) {
      out.push(finding('info', 'EP-SIZE-CAP', `${disp(x.p)} is ${n} lines and ${Math.ceil(bytes / 1024)} KB; Claude Code loads only its first ${MAX_LINES} lines or 25 KB at session start, so the rest doesn't load; the memory-lint skill can trim it`));
    }
    if (x.kind === 'above') {
      out.push(finding('info', 'EP-ANCESTOR-INSTRUCTIONS', `${disp(x.p)} is above ${top ? 'the repository' : 'this folder'}, so it loads into every session started under ${disp(x.d)}: about ${tokens(text)} tokens each; if it isn't meant for all of them, move it, or list it in claudeMdExcludes where it shouldn't load`));
    }
    out.push(...hiddenFinding(x.p, text, disp));
  }
  return out;
}
