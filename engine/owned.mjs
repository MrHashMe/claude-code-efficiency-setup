// Owned items: how a target's current value is read and hashed, item keys, and each scope's ownership
// records. Plan, apply, verify, show and the cross-scope checks all read ownership through this module.
import { getValue } from './jsonc.mjs';
import { canonical, displayPath, fail, fold, normalize, readJson, readText, slash, textHash, valueHash } from './util.mjs';

export const TEXT = new Set(['file', 'dir', 'block']);
export const RULES_REL = '.claude/rules/efficiency-playbook.md';

// A block in a file others write too (the exclude file all linked worktrees share) is found by its own id.
export const markersOf = (id) => [`# ep:begin ${id}`, `# ep:end ${id}`];
export function blockOf(text, id) {
  const t = normalize(text ?? '');
  const [open, close] = markersOf(id);
  const a = `\n${t}`.indexOf(`\n${open}\n`);
  const b = a < 0 ? -1 : t.indexOf(close, a);
  return b < 0 ? undefined : t.slice(a, b + close.length);
}

// What a target holds now: text for files and blocks, a JSON value for the rest, undefined when absent.
export function current(it) {
  if (it.kind === 'file' || it.kind === 'dir') return readText(it.kind === 'dir' ? it.probe : it.target) ?? undefined;
  const text = readText(it.target);
  if (text == null) return undefined;
  if (it.kind === 'block') return blockOf(text, it.id);
  let v;
  try {
    v = getValue(text, it.pointer);
  } catch (e) {
    throw fail(e.code, `${it.target}: ${e.message}; fix the file, then plan again`, { exit: 3 });
  }
  if (it.kind !== 'entry') return v;
  return Array.isArray(v) && v.some((x) => canonical(x) === canonical(it.value)) ? it.value : undefined;
}
export const hashOf = (it, v) => (v === undefined ? null : TEXT.has(it.kind) ? textHash(v) : valueHash(v));

// A registry settings value may name <configDir>; it goes in JSON-escaped, so a path stays valid in strings.
// The replacement is a function, so "$'" or "$&" in a folder name stays text.
export const withConfigDir = (raw, dir) => JSON.parse(JSON.stringify(raw).replaceAll('<configDir>', () => JSON.stringify(slash(dir)).slice(1, -1)));

// 'unreadable': the settings file no longer parses, which verify reports once rather than per item.
export function itemStatus(o) {
  let h;
  try {
    h = hashOf(o, current(o));
  } catch (e) {
    if (String(e.code).startsWith('EP-JSONC-')) return 'unreadable';
    throw e;
  }
  return h === null ? 'missing' : h === o.ownedHash ? 'ok' : 'edited';
}

export function keyOf(sc, it) {
  // A path outside the home and the repository is spelled out; it folds case the way the scope folder does.
  const shown = displayPath(it.target, sc);
  const d = /^(?:<repo>|~)(?:\/|$)/.test(shown) ? shown : fold(shown);
  if (it.kind === 'plugin') return `plugin:${it.plugin.plugin}`;
  if (it.kind === 'key') return `key:${d}#${it.pointer}`;
  if (it.kind === 'entry') return `entry:${d}#${it.pointer}#${valueHash(it.value).slice(7, 19)}`;
  return `${it.kind}:${d}`;
}

export function readLock(sc) {
  if (!sc.lockFile) return null;
  try {
    const lock = readJson(sc.lockFile);
    return lock && typeof lock === 'object' && !Array.isArray(lock) ? lock : null;
  } catch {
    throw fail('EP-LOCK-PARSE', `${displayPath(sc.lockFile, sc)} isn't valid JSON; fix it or move it away, then plan again`, { exit: 3 });
  }
}

// User and local scope keep ownership in state.json. At project scope the committed lock is the record
// (06 section 4.3), so every clone derives the same owner; only the lock and the rules file can be owned.
export function ownership(sc, state, lock = readLock(sc)) {
  const recorded = new Map(state.items.map((i) => [i.key, i]));
  if (sc.scope !== 'project') return recorded;
  const owned = new Map();
  const add = (target, ownedHash, includes) => {
    const it = { kind: 'file', target };
    const key = keyOf(sc, it);
    owned.set(key, { ...it, key, component: 'core', includes, ownedHash, prior: recorded.get(key)?.prior ?? { exists: false } });
  };
  if (lock) {
    add(sc.lockFile, textHash(readText(sc.lockFile)), Object.keys(lock.components ?? {}));
    if (typeof lock.files?.[RULES_REL] === 'string') add(sc.rulesFile, lock.files[RULES_REL], []);
  }
  return owned;
}
