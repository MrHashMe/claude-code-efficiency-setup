// v7 migration (11-migration-and-roadmap): v7 recorded what it created in MANIFEST.json. v8 quarantines
// unedited v7 files, removes the v7 nudge hook, and adopts v7 settings that already hold v8's value.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { getValue, toPointer } from './jsonc.mjs';
import { V7_USER_PATHS } from './scopes.mjs';
import { canonical, displayPath, finding, fold, readBytes, readJson, readText, samePath, slash } from './util.mjs';

// The newest manifest that records user-level items. A repo-only v6 run (kit worktrees) wrote `entries` instead,
// and taking it would hide the user-level manifest an earlier run wrote. A manifest that isn't JSON is passed to
// onBad and skipped, so one damaged file doesn't hide the older ones.
export function findManifest(cfg, onBad = () => {}) {
  const dir = join(cfg, 'backups');
  if (!existsSync(dir)) return null;
  for (const run of readdirSync(dir).filter((d) => d.startsWith('setup-')).sort().reverse()) {
    const p = join(dir, run, 'MANIFEST.json');
    let m;
    try {
      m = readJson(p);
    } catch (e) {
      if (e.code) throw e;
      onBad(p, e);
      continue;
    }
    if (m && ['files', 'hooks', 'settings_keys', 'plugins'].some((k) => Array.isArray(m[k]))) return p;
  }
  return null;
}

// v7 wrote "env.NAME" paths; the second segment may hold dots (plugin ids), so split once.
export const pointerOf = (dotted) => {
  const i = dotted.indexOf('.');
  return toPointer(i < 0 ? [dotted] : [dotted.slice(0, i), dotted.slice(i + 1)]);
};
const rawHash = (p) => createHash('sha256').update(readBytes(p)).digest('hex');
const pathKey = (p) => fold(slash(resolve(p)));
// Anything in the folder v7 didn't list, a file or a link; folders themselves are walked, not counted.
const unlisted = (dir, listed) => readdirSync(dir, { recursive: true, withFileTypes: true }).some((e) => !e.isDirectory() && !listed.has(pathKey(join(e.parentPath, e.name))));

export function v7Migration(sc) {
  const findings = [];
  const manifest = findManifest(sc.configDir, (p, e) => findings.push(finding('warn', 'EP-MANIFEST-CORRUPT', `${displayPath(p, sc)} isn't valid JSON (${e.message}), so it is skipped; v7's records in it can't be used`)));
  if (!manifest) return findings.length ? { manifest: null, removals: [], adopt: new Map(), findings } : null;
  const m = readJson(manifest);
  const removals = new Map();
  const listed = new Map();
  for (const f of m.files ?? []) {
    if (!f.created_by_setup || !existsSync(f.path)) continue;
    const rel = slash(relative(sc.configDir, f.path));
    const top = V7_USER_PATHS.find((v) => rel === v || rel.startsWith(`${v}/`));
    if (!top) {
      findings.push(finding('info', 'EP-V7-OUTSIDE', `v7 also wrote ${displayPath(f.path, sc)}; v8 leaves files outside the config folder alone`));
      continue;
    }
    // v7's own state file changes by design; every other file must be unedited to be removed by default.
    const unchanged = top === 'project-setup-state.json' || rawHash(f.path) === f.hash_after;
    const prev = removals.get(top);
    removals.set(top, {
      kind: top === rel ? 'file' : 'dir',
      target: join(sc.configDir, top),
      probe: prev?.probe ?? f.path,
      unchanged: (prev?.unchanged ?? true) && unchanged,
    });
    listed.set(top, (listed.get(top) ?? new Set()).add(pathKey(f.path)));
  }
  // A folder goes to quarantine whole, so a file in it that v7 didn't write (yours) makes it a conflict.
  const moved = [...removals].map(([top, r]) => (r.kind === 'dir' && unlisted(r.target, listed.get(top)) ? { ...r, unchanged: false } : r));
  // The hook entry v7 wrote goes by default. One you changed still runs the v7 script, so it is a conflict row
  // (found by the script's path in it) and the script waits for it.
  const scripts = moved.map((r) => slash(r.target));
  const listAt = (pointer) => {
    try {
      const v = getValue(readText(sc.settings) ?? '{}', pointer);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const entries = (m.hooks ?? [])
    .filter((h) => h.file && samePath(h.file, sc.settings))
    .flatMap((h) => {
      const pointer = toPointer(['hooks', h.event]);
      const row = (value, unchanged) => ({ kind: 'entry', target: sc.settings, pointer, value, unchanged });
      const there = listAt(pointer);
      if (there.some((x) => canonical(x) === canonical(h.entry))) return [row(h.entry, true)];
      const edited = there.filter((x) => scripts.some((s) => JSON.stringify(x).includes(s)));
      return edited.length ? edited.map((x) => row(x, false)) : [row(h.entry, true)];
    });
  const adopt = new Map();
  for (const k of m.settings_keys ?? []) if (k.absent_before_setup) adopt.set(pointerOf(k.key), { exists: false });
  for (const p of m.plugins ?? []) if (p.scope === 'user' && p.installed_by_setup) adopt.set(toPointer(['enabledPlugins', p.id]), { exists: false });
  for (const b of m.marked_blocks ?? []) {
    const where = b.path ?? b.file;
    findings.push(finding('info', 'EP-V7-BLOCK', `v7 wrote a marked block in ${where ? displayPath(where, sc) : 'a project file'}; run the setup at project scope there to migrate it`));
  }
  return { manifest, removals: [...moved, ...entries], adopt, findings };
}
