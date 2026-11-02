// How each kind of row changes its target, and how rollback puts it back: files and folders, marked blocks, keys and
// list entries in a settings file, plugins. A prepare function looks at the row and its target and returns what the
// row will do, without doing it:
//   rec    what the journal records so rollback can undo the row (paths are worked out first, before the change)
//   run    the change itself; it may return { manual } (commands to paste) instead of changing anything
//   state  how the scope's ownership records change once the row is done
// Rows that only change records (adopt, disown) have no run.
import { marketplaceKnown, pluginArgs, pluginCommands } from './installed.mjs';
import { addItem, dropItem, getValue, isBlank, parse, parsePointer, removeValue, setValue, toPointer } from './jsonc.mjs';
import { blockOf } from './owned.mjs';
import { backup, backupPath, drop, quarantine, quarantinePath, upsert } from './state.mjs';
import { agentCli, atomicWrite, fail, matchFormat, moveFile, normalize, readText, run, textHash, valueHash } from './util.mjs';

export const WRITES = new Set(['create', 'update']);

// A JSON target is re-read and parsed after each edit; a failure puts the previous bytes back. null: nothing is left
// in a file the install made, so it moves to quarantine.
export function writeChecked(sc, id, row, target, next, before) {
  if (next === null) {
    quarantine(sc, id, row, target);
    return;
  }
  atomicWrite(target, matchFormat(next, before));
  try {
    parse(readText(target));
  } catch (e) {
    if (before == null) quarantine(sc, id, `${row}-unparsable`, target);
    else atomicWrite(target, before);
    throw fail('EP-PARSE-REVERTED', `${target} didn't parse after the edit, so the previous version is back: ${e.message}`);
  }
}

const putBlock = (t, cur, text) => (cur !== undefined ? t.replace(cur, () => text) : `${t}${t && !t.endsWith('\n') ? '\n' : ''}${text}\n`);
const stripBlock = (t, cur) => (cur === undefined ? t : t.includes(`${cur}\n`) ? t.replace(`${cur}\n`, () => '') : t.replace(cur, () => ''));
const ownedRecord = (it, prior, ownedHash) => ({
  key: it.key,
  kind: it.kind,
  target: it.target,
  ...(it.pointer ? { pointer: it.pointer } : {}),
  ...(it.kind === 'entry' ? { value: it.value } : {}),
  ...(it.kind === 'block' ? { id: it.id } : {}),
  ...(it.plugin ? { plugin: it.plugin } : {}),
  ...(it.includes ? { includes: it.includes } : {}),
  component: it.component,
  ownedHash,
  prior,
});
const keep = (it, prior, ownedHash) => (s) => upsert(s, ownedRecord(it, prior, ownedHash));
const forget = (it) => (s) => drop(s, it.key);

function prepareFile({ sc, id }, row, it, prev) {
  if (row.op === 'disown') return { state: forget(it) };
  if (row.op === 'remove' || row.op === 'restore') {
    const prior = row.op === 'restore' ? readText(it.prior.backup) : null;
    if (row.op === 'restore' && prior == null) throw fail('EP-BACKUP-MISSING', `the backup of ${row.target} is gone, so it can't be restored; plan again, which offers a remove instead`);
    return {
      state: forget(it),
      rec: { quarantine: quarantinePath(sc, id, row.id, it.target) },
      run() {
        quarantine(sc, id, row.id, it.target);
        if (prior != null) atomicWrite(it.target, prior);
      },
    };
  }
  const before = readText(it.target);
  const bak = before == null ? null : backupPath(sc, id, row.id, it.target);
  const text = matchFormat(it.text, before);
  return {
    state: keep(it, prev?.prior ?? { exists: before != null, backup: bak }, textHash(text)),
    rec: { backup: bak },
    run() {
      if (bak) backup(sc, id, row.id, it.target);
      atomicWrite(it.target, text);
      if (!it.target.endsWith('.json')) return;
      try {
        JSON.parse(normalize(readText(it.target)));
      } catch (e) {
        if (bak) atomicWrite(it.target, before);
        else quarantine(sc, id, `${row.id}-unparsable`, it.target);
        throw fail('EP-PARSE-REVERTED', `${row.target} didn't parse after the write, so it was put back: ${e.message}`);
      }
    },
  };
}

// A block is found by its own id: the exclude file is shared by every worktree of a repository.
function prepareBlock(cx, row, it) {
  if (row.op === 'disown') return { state: forget(it) };
  const before = readText(it.target) ?? '';
  const t = normalize(before);
  const cur = blockOf(t, it.id);
  const write = WRITES.has(row.op);
  const next = matchFormat(write ? putBlock(t, cur, it.text) : stripBlock(t, cur), before);
  return { state: write ? keep(it, { exists: false }, textHash(it.text)) : forget(it), rec: { undo: { text: cur ?? null } }, run: () => atomicWrite(it.target, next) };
}

// The objects and lists setValue builds on the way to a pointer (for an entry, its list too).
function containers(it) {
  const segs = parsePointer(it.pointer);
  return segs.slice(0, it.kind === 'entry' ? segs.length : segs.length - 1).map((_, k) => toPointer(segs.slice(0, k + 1)));
}
// Removal takes away the containers the install built once nothing is left in them (not even a comment), so
// uninstall gives back the original bytes. '' is the file itself, when the install made it: null means it is empty
// now. Rows without a record (v7 migration) only drop their emptied list, as v7 did.
function prune(text, created) {
  let t = text;
  for (const p of [...created].reverse()) {
    if (!isBlank(t, p)) continue;
    if (p === '') return null;
    t = removeValue(t, p);
  }
  return t;
}
const createdBy = (it, rec) => rec?.created ?? (it.kind === 'entry' ? [it.pointer] : []);
// The record that the install made the file rides on one key. When that key leaves first, the next key still in the
// file takes it over, so the file goes with the last of them whichever way round they leave.
const leave = (it, emptied) => (s) => {
  const rest = drop(s, it.key);
  const heir = !emptied && it.prior?.created?.[0] === '' ? rest.items.find((i) => i.target === it.target && i.prior) : undefined;
  return heir ? upsert(rest, { ...heir, prior: { ...heir.prior, created: ['', ...createdBy(heir, heir.prior)] } }) : rest;
};

// Keys and list entries in a settings file; adopt records ownership without writing. The file is copied before its
// first edit in an apply.
function prepareSetting({ sc, id, backed }, row, it, prev) {
  if (row.op === 'adopt') return { state: keep(it, it.prior ?? { exists: false }, valueHash(it.value)) };
  if (row.op === 'disown') return { state: leave(it, false) };
  const before = readText(it.target);
  const cur = before == null ? undefined : getValue(before, it.pointer);
  const [entry, write] = [it.kind === 'entry', WRITES.has(row.op)];
  if (entry && cur !== undefined && !Array.isArray(cur)) throw fail('EP-JSONC-MANUAL', `${it.pointer} in ${row.target} isn't a list; edit it by hand`);
  const created = [...(before == null ? [''] : []), ...containers(it).filter((p) => before == null || getValue(before, p) === undefined)];
  const text = before ?? '{}\n';
  let next;
  if (entry) next = write ? addItem(text, it.pointer, it.value) : prune(dropItem(text, it.pointer, it.value), createdBy(it, it.prior));
  else if (write) next = setValue(text, it.pointer, it.value);
  else if (row.op === 'restore') next = setValue(text, it.pointer, it.prior.value);
  else next = prune(removeValue(text, it.pointer), createdBy(it, it.prior));
  const prior = prev?.prior ?? (entry ? { exists: false, created } : { exists: cur !== undefined, value: cur, created });
  const bak = before != null && !backed.has(it.target) ? backupPath(sc, id, row.id, it.target) : null;
  return {
    state: write ? keep(it, prior, valueHash(it.value)) : leave(it, next === null),
    rec: { undo: entry ? { entry: it.value } : { value: cur }, ...(write ? { created: prior.created } : {}), ...(bak ? { backup: bak } : {}) },
    run() {
      if (bak) {
        backup(sc, id, row.id, it.target);
        backed.add(it.target);
      }
      writeChecked(sc, id, row.id, it.target, next, before);
    },
  };
}

// 06 section 6.2 step 7: plugins go through the agent's CLI; without one, the row returns the commands to paste.
// A user-scope install runs from the home folder, so the repository you stand in is not part of it.
export function pluginCommand({ ctx, sc }, it, install) {
  const cli = agentCli(ctx.env);
  if (!cli || (install && !marketplaceKnown(sc.configDir, it.plugin.marketplace))) return { manual: pluginCommands(it.plugin, sc.scope, sc.configDir, install) };
  const args = pluginArgs(it.plugin, sc.scope, install);
  const r = run(cli, args, { cwd: sc.repo ?? sc.home, env: ctx.env, timeout: 300000 });
  const enabled = getValue(readText(it.target) ?? '{}', it.pointer) === true;
  if (enabled !== install) {
    const why = (r.stderr || r.stdout || r.error || 'no output').trim().split(/\r\n?|\n/).slice(-3).join(' ');
    throw fail('EP-PLUGIN', `claude ${args.join(' ')} didn't take effect: ${why}`);
  }
  return {};
}

function preparePlugin(cx, row, it, prev) {
  if (row.op === 'adopt') return { state: keep(it, it.prior ?? { exists: false }, valueHash(true)) };
  if (row.op === 'disown') return { state: forget(it) };
  const install = WRITES.has(row.op);
  // A pasted install is still the playbook's: record it now so a later uninstall can remove it.
  return { state: install ? keep(it, prev?.prior ?? { exists: false }, valueHash(true)) : forget(it), run: () => pluginCommand(cx, it, install) };
}

export const PREPARE = { file: prepareFile, dir: prepareFile, block: prepareBlock, key: prepareSetting, entry: prepareSetting, plugin: preparePlugin };

// Put a settings value, list entry or block back the way the journal says it was.
export function undoSetting(sc, id, rec) {
  const before = readText(rec.target);
  const text = before ?? '{}\n';
  if (rec.kind === 'block') {
    const t = normalize(before ?? '');
    const cur = blockOf(t, rec.id);
    atomicWrite(rec.target, matchFormat(rec.undo.text ? putBlock(t, cur, rec.undo.text) : stripBlock(t, cur), before));
    return;
  }
  let next;
  if (rec.kind === 'entry') next = WRITES.has(rec.op) ? prune(dropItem(text, rec.pointer, rec.undo.entry), createdBy(rec, rec)) : addItem(text, rec.pointer, rec.undo.entry);
  else if (rec.undo.value === undefined) next = prune(removeValue(text, rec.pointer), createdBy(rec, rec));
  else next = setValue(text, rec.pointer, rec.undo.value);
  writeChecked(sc, id, rec.row, rec.target, next, before);
}

export function undoFile(sc, id, rec) {
  if (rec.after !== null) {
    if (!rec.backup) quarantine(sc, id, rec.row, rec.target);
    else {
      const saved = readText(rec.backup);
      if (saved == null) throw fail('EP-BACKUP-MISSING', `the saved copy ${rec.backup} is gone`);
      atomicWrite(rec.target, saved);
    }
  }
  if (rec.quarantine) moveFile(rec.quarantine, rec.target);
}
