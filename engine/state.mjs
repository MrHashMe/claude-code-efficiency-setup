// Per-scope state (06 section 4.3): ownership records, declined rows, journals, backups, quarantine and
// the apply lock. Everything lives in the scope's folder under the state root.
import { appendFileSync, closeSync, copyFileSync, existsSync, linkSync, openSync, readdirSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { ENGINE, displayPath, fail, moveFile, normalize, privateDir, readJson, readText, redact, writeJson } from './util.mjs';

const LOCK_STALE_MS = 10 * 60 * 1000;

export const stamp = (now = new Date()) => now.toISOString().replace(/[:.]/g, '-');
export const emptyState = () => ({ schema: 1, engine: ENGINE, items: [], declined: [], optedOut: [], satisfiedBy: [], migratedFrom: null });

// A state file that isn't JSON stops plan and apply (they would otherwise propose everything again over records
// that are really there). Read-only callers pass onBad, hear about it, and carry on with an empty state.
export function loadState(sc, onBad) {
  const file = join(sc.dir, 'state.json');
  let s;
  try {
    s = readJson(file);
  } catch (e) {
    if (e.code) throw e;
    const message = `${displayPath(file, sc)} isn't valid JSON (${e.message}); restore it from a copy, or move it away to start this scope's records over`;
    if (!onBad) throw fail('EP-STATE-CORRUPT', message, { exit: 3 });
    onBad(message);
    return emptyState();
  }
  if (!s) return emptyState();
  if (s.schema !== 1) throw fail('EP-STATE', `unknown state schema ${s.schema} in ${file}`, { exit: 3 });
  return { ...emptyState(), ...s };
}
export const saveState = (sc, state) => writeJson(join(sc.dir, 'state.json'), { ...state, engine: ENGINE });
export const upsert = (state, item) => ({ ...state, items: [...state.items.filter((i) => i.key !== item.key), item] });
export const drop = (state, key) => ({ ...state, items: state.items.filter((i) => i.key !== key) });

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};

// A lock is stale when the process that wrote it is gone; one with no readable process id is stale once it is
// 10 minutes old. A live process keeps its lock however old it is.
const isStale = (pid, mtimeMs) => (pid > 0 ? !alive(pid) : Date.now() - mtimeMs >= LOCK_STALE_MS);

// Replacing a stale lock: move it to a name of its own first (only one process can win that rename), look at what
// was moved, then let the caller create a fresh lock with 'wx'. Deleting and re-creating in place could remove the
// fresh lock another process had just made. True when the path is free to try again.
function clearStale(p) {
  let seen;
  try {
    seen = { text: readText(p), mtime: statSync(p).mtimeMs };
  } catch (e) {
    if (e.code === 'ENOENT') return true;
    throw e;
  }
  if (!isStale(Number.parseInt(seen.text ?? '', 10), seen.mtime)) return false;
  const moved = `${p}.stale-${process.pid}-${Date.now()}`;
  try {
    renameSync(p, moved);
  } catch (e) {
    if (e.code === 'ENOENT') return true;
    throw e;
  }
  const wasStale = readText(moved) === seen.text;
  // Not what was judged stale: a live process created its lock in between. Give it back.
  if (!wasStale) {
    try {
      linkSync(moved, p);
    } catch {}
  }
  unlinkSync(moved);
  return wasStale;
}

// 06 section 6.2 step 1: exclusive create; a stale lock is replaced.
export function withLock(sc, fn) {
  privateDir(sc.dir);
  const p = join(sc.dir, 'lock');
  let fd;
  for (let tries = 0; fd === undefined; tries++) {
    try {
      fd = openSync(p, 'wx');
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (tries >= 3 || !clearStale(p)) {
        throw fail('EP-LOCKED', `another apply or rollback holds ${p}; if none is running, wait 10 minutes and retry`, { exit: 3 });
      }
    }
  }
  writeSync(fd, String(process.pid));
  closeSync(fd);
  try {
    return fn();
  } finally {
    try {
      unlinkSync(p);
    } catch {}
  }
}

// 06 section 4.5: one JSONL file per apply or rollback.
export function journal(sc, id) {
  const file = join(sc.dir, 'journal', `${id}.jsonl`);
  privateDir(dirname(file));
  // N-7: messages and pasted commands can carry CLI stderr or a credential; rollback reads the other fields (the exact
  // values it puts back), so only these display fields are masked.
  const clean = (rec) => ({
    ...rec,
    ...(typeof rec.message === 'string' ? { message: redact(rec.message) } : {}),
    ...(Array.isArray(rec.commands) ? { commands: rec.commands.map((c) => redact(c)) } : {}),
  });
  return { id, file, write: (rec) => appendFileSync(file, JSON.stringify({ t: new Date().toISOString(), ...clean(rec) }) + '\n') };
}
// Journal ids are timestamps; two runs in the same millisecond get a counter, padded so ids sort in run order.
export function newJournal(sc, now, suffix = '') {
  let id = stamp(now) + suffix;
  for (let n = 1; existsSync(join(sc.dir, 'journal', `${id}.jsonl`)); n++) id = `${stamp(now)}-${String(n).padStart(4, '0')}${suffix}`;
  return journal(sc, id);
}
// A crash can cut the last line short; a line that isn't JSON is left out, so the journal still reads as unfinished.
export const readJournal = (file) =>
  normalize(readText(file) ?? '')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
export function applyJournals(sc) {
  const dir = join(sc.dir, 'journal');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl') && !f.includes('-rollback'))
    .map((f) => f.slice(0, -'.jsonl'.length))
    .sort();
}

// Whole-file copies before the engine overwrites a file; quarantine moves instead of deleting (I4). Both paths can
// be worked out first, so the journal names them before the copy or the move happens.
export const backupPath = (sc, id, row, target) => join(sc.dir, 'backups', id, `${row}-${basename(target)}`);
export function backup(sc, id, row, target) {
  const to = backupPath(sc, id, row, target);
  privateDir(dirname(to));
  // The bytes, not a copy of a link: a link would show whatever is written through it next.
  copyFileSync(target, to);
  return to;
}
// Where a quarantine move will put the file, so the journal can name it before the move happens.
export const quarantinePath = (sc, id, row, target) => join(sc.dir, 'quarantine', id, `${row}-${basename(target)}`);
export function quarantine(sc, id, row, target) {
  const to = quarantinePath(sc, id, row, target);
  privateDir(dirname(to));
  moveFile(target, to);
  return to;
}
