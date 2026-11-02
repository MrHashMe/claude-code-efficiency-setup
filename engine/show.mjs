// U-2: show lists each owned item, and each setting a registry component writes, with the value in effect
// here, the layer it comes from (managed, then local, project, user: the order in which Claude Code lets
// one override another), who set it, and the evidence behind its component. Read-only.
import { scopeHere } from './cross.mjs';
import { parse, parsePointer, toPointer } from './jsonc.mjs';
import { findManifest, pointerOf } from './migrate.mjs';
import { current, itemStatus, ownership, withConfigDir } from './owned.mjs';
import { readPolicy } from './policy.mjs';
import { loadRegistry } from './registry.mjs';
import { resolveScope } from './scopes.mjs';
import { applyJournals, loadState } from './state.mjs';
import { canonical, displayPath, finding, readJson, readText, samePath } from './util.mjs';

const SETTINGS = new Set(['key', 'entry', 'plugin']);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const valueAt = (doc, pointer) => parsePointer(pointer).reduce((v, k) => (isObj(v) ? v[k] : undefined), doc);

// A state file that isn't JSON is one finding however many times it is read, and reads as empty meanwhile.
const stateReader = (findings) => {
  const seen = new Set();
  return (sc) =>
    loadState(sc, (message) => {
      if (!seen.has(message)) findings.push(finding('error', 'EP-STATE-CORRUPT', message));
      seen.add(message);
    });
};

// Managed first, then each scope that applies here, with its parsed settings and its ownership records.
function layers(ctx, policy, findings, read) {
  const out = [{ scope: 'managed', doc: policy, owned: [] }];
  for (const name of ['local', 'project', 'user']) {
    const sc = scopeHere(name, ctx);
    if (!sc) continue;
    const text = readText(sc.settings);
    let doc = {};
    try {
      doc = text == null ? {} : parse(text);
    } catch (e) {
      findings.push(finding('error', 'EP-SETTINGS-PARSE', `${displayPath(sc.settings, sc)}: ${e.message}`));
    }
    const state = read(sc);
    out.push({ scope: name, sc, doc, state, owned: [...ownership(sc, state).values()] });
  }
  return out;
}

// Pointers an unmigrated v7 MANIFEST.json says v7 set at user scope: their owner is "other".
function v7Pointers(user) {
  const manifest = findManifest(user.sc.configDir);
  if (!manifest || (user.state.migratedFrom && samePath(user.state.migratedFrom, manifest))) return new Set();
  const m = readJson(manifest) ?? {};
  return new Set([
    ...(m.settings_keys ?? []).filter((k) => typeof k?.key === 'string').map((k) => pointerOf(k.key)),
    ...(m.plugins ?? []).filter((p) => p?.scope === 'user' && typeof p.id === 'string').map((p) => toPointer(['enabledPlugins', p.id])),
  ]);
}

// The first layer that sets the pointer; for a hook entry, the first that lists it (hooks from every layer run).
function effective(ls, it) {
  for (const l of ls) {
    const v = valueAt(l.doc, it.pointer);
    if (it.kind === 'entry' ? Array.isArray(v) && v.some((x) => canonical(x) === canonical(it.value)) : v !== undefined) return { l, v: it.kind === 'entry' ? it.value : v };
  }
  return null;
}

function ownerOf(l, it, v7) {
  if (l.scope === 'managed') return 'managed';
  const same = (o) => SETTINGS.has(o.kind) && o.pointer === it.pointer && samePath(o.target, l.sc.settings) && (it.kind !== 'entry' || canonical(o.value) === canonical(it.value));
  if (l.owned.some(same)) return 'engine';
  return l.scope === 'user' && v7.has(it.pointer) ? 'other' : 'user';
}

const evidenceOf = (reg, id) => {
  const c = reg.byId.get(id);
  return { component: id, verdict: c?.verdict ?? null, measuredBy: [...new Set((c?.evidence ?? []).map((e) => e.measuredBy))] };
};

export function show(ctx, { scope = 'user' } = {}) {
  const sc = resolveScope(scope, ctx);
  const reg = loadRegistry(ctx.root);
  const { policy, findings } = readPolicy(ctx.env);
  const read = stateReader(findings);
  const state = read(sc);
  const ls = layers(ctx, policy, findings, read);
  const v7 = v7Pointers(ls.find((l) => l.scope === 'user'));
  const setting = (item, it, component, extra = {}) => {
    const e = effective(ls, it);
    // Env values can be secrets, so show says only that one is set.
    const value = e ? (it.pointer.startsWith('/env/') ? 'set' : e.v) : null;
    return { item, value, sourceScope: e?.l.scope ?? 'none', owner: e ? ownerOf(e.l, it, v7) : null, ...extra, evidence: evidenceOf(reg, component) };
  };
  const owned = [...ownership(sc, state).values()];
  const items = owned.map((o) => {
    if (SETTINGS.has(o.kind)) return setting(o.key, o, o.component, { status: itemStatus(o) });
    const text = current(o);
    const there = text !== undefined;
    return { item: o.key, value: there ? `${Buffer.byteLength(text)} bytes` : null, sourceScope: there ? sc.scope : 'none', owner: there ? 'engine' : null, status: itemStatus(o), evidence: evidenceOf(reg, o.component) };
  });
  // Every pointer a component writes, once, unless an owned item above already shows it.
  const covered = new Set(owned.filter((o) => SETTINGS.has(o.kind)).map((o) => o.pointer));
  for (const c of reg.components) {
    const claude = c.agents.claude;
    const writes = [
      ...Object.entries(claude?.settings ?? {}).map(([ptr, raw]) => ({ item: ptr, kind: ptr.endsWith('/-') ? 'entry' : 'key', pointer: ptr.replace(/\/-$/, ''), value: withConfigDir(raw, sc.configDir) })),
      ...(claude?.install ?? []).map((i) => toPointer(['enabledPlugins', i.plugin])).map((pointer) => ({ item: pointer, kind: 'plugin', pointer })),
    ];
    for (const it of writes.filter((x) => !covered.has(x.pointer))) {
      covered.add(it.pointer);
      items.push(setting(it.item, it, c.id));
    }
  }
  return { data: { scope: sc.scope, items, journals: applyJournals(sc), optedOut: state.optedOut, declined: state.declined.length }, findings };
}
