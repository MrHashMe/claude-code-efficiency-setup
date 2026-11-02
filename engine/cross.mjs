// S-2 and S-11: a local install never repeats a fragment or setting that the user scope's install, or
// this repository's project install, already loads. Each skip is recorded in local state, so verify can
// tell when the provider stops providing it. Project scope stays self-contained: it is committed and
// shared, so it can't lean on one person's user scope. verify reports rules text that loads twice here.
import * as nodePath from 'node:path';
import { fragmentText, readCommandMap } from './content.mjs';
import { parse } from './jsonc.mjs';
import { RULES_REL, itemStatus, ownership } from './owned.mjs';
import { resolveScope } from './scopes.mjs';
import { loadState } from './state.mjs';
import { displayPath, finding, normalize, readText, samePath, slash, tokens, valueHash } from './util.mjs';

const SETTINGS = new Set(['key', 'entry', 'plugin']);

// One identity per item whatever file holds it: a fragment by id, a setting by pointer and value.
const ident = (it, hash) => (it.kind === 'plugin' ? `plugin:${it.plugin.plugin}` : `${it.kind}:${it.pointer}#${hash.slice(7, 19)}`);
export const desiredIdent = (it) => ident(it, valueHash(it.kind === 'plugin' ? true : it.value));

// A scope that applies here: project and local only inside a repository the engine accepts.
export function scopeHere(name, ctx) {
  try {
    return resolveScope(name, ctx);
  } catch (e) {
    if (e.code === 'EP-NOT-A-REPO' || e.code === 'EP-REPO-REFUSED') return null;
    throw e;
  }
}

// Another scope's records are read here only to compare with. A damaged state file there reads as empty: verify and
// show report it when they look at that scope, and plan stops on it when that scope is the one being planned.
const recordsOf = (p, onBad = () => {}) => [...ownership(p, loadState(p, onBad)).values()];
const hasRules = (p, owned) => owned.some((o) => o.kind === 'file' && samePath(o.target, p.rulesFile));
const ownedRules = (p) => hasRules(p, recordsOf(p));

// The commands the user confirmed: --answers, else this scope's rules file, else (local) the project's.
export function confirmedCommands(sc, answers = {}) {
  if (answers.commandMap) return answers;
  for (const f of [sc.rulesFile, ...(sc.scope === 'local' ? [nodePath.join(sc.repo, RULES_REL)] : [])]) {
    const commandMap = readCommandMap(readText(f));
    if (commandMap) return { ...answers, commandMap };
  }
  return null;
}

// What the user and project installs already load for a local install: identity -> providing scopes.
export function provided(ctx, sc, fragments, answers = {}, onBad) {
  const out = new Map();
  if (sc.scope !== 'local') return out;
  const add = (id, scope) => out.set(id, [...(out.get(id) ?? []), scope]);
  for (const p of [resolveScope('user', ctx), resolveScope('project', ctx)]) {
    const owned = recordsOf(p, onBad);
    const rules = hasRules(p, owned) ? normalize(readText(p.rulesFile) ?? '') : '';
    for (const f of rules ? fragments : []) {
      if (f.when === 'always' || !f.scopes.includes('local') || (f.id === 'command-map' && !answers.commandMap)) continue;
      if (rules.includes(fragmentText(f, answers))) add(`fragment:${f.id}`, p.scope);
    }
    for (const o of owned) if (SETTINGS.has(o.kind) && itemStatus(o) === 'ok') add(ident(o, o.ownedHash), p.scope);
  }
  return out;
}

export function staleFindings(ctx, sc, state, fragments) {
  if (sc.scope !== 'local' || !state.satisfiedBy?.length) return [];
  const now = provided(ctx, sc, fragments, confirmedCommands(sc) ?? {});
  return state.satisfiedBy
    .filter((s) => !now.has(s.item))
    .map((s) => finding('warn', 'EP-LOCAL-STALE', `${s.item} (${s.component}) was left out of the local install because ${s.scopes.join(' and ')} scope provided it; it no longer does, so plan --scope local restores it`));
}

const settingsList = (p, key) => {
  try {
    const v = parse(readText(p) ?? '{}')?.[key];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

// claudeMdExcludes from every layer (lists merge), glob-matched against absolute paths. path.matchesGlob
// arrived in Node 22.5; without it nothing counts as excluded.
function excluder(scopes, policy) {
  const globs = [...(Array.isArray(policy.claudeMdExcludes) ? policy.claudeMdExcludes : []), ...scopes.flatMap((p) => settingsList(p.settings, 'claudeMdExcludes'))].filter((g) => typeof g === 'string');
  const match = (f, g) => {
    try {
      return nodePath.matchesGlob(f, g);
    } catch {
      return false;
    }
  };
  return (file) => typeof nodePath.matchesGlob === 'function' && globs.some((g) => match(file, g) || match(slash(file), g));
}

// EP-DUPLICATE-BLOCK: one finding per fragment that loads from two or more engine-owned rules files here,
// when one of them is the verified scope's. Report only; the native fix is claudeMdExcludes.
export function duplicateFindings(ctx, sc, fragments, policy) {
  const here = [resolveScope('user', ctx), scopeHere('project', ctx), scopeHere('local', ctx)].filter(Boolean);
  const skip = excluder(here, policy);
  const files = here
    .filter((p) => ownedRules(p) && !skip(p.rulesFile))
    .map((p) => ({ scope: p.scope, file: p.rulesFile, text: normalize(readText(p.rulesFile) ?? '') }))
    .filter((x) => x.text);
  if (!files.some((x) => x.scope === sc.scope)) return [];
  const out = [];
  for (const f of fragments.filter((x) => x.when !== 'always')) {
    const groups = new Map();
    for (const x of files) {
      const commandMap = f.id === 'command-map' ? readCommandMap(x.text) : null;
      if (f.id === 'command-map' && !(commandMap?.quick.length && commandMap.full.length)) continue;
      const body = commandMap ? fragmentText(f, { commandMap }) : f.body;
      if (x.text.includes(body)) groups.set(body, [...(groups.get(body) ?? []), x]);
    }
    for (const [body, xs] of groups) {
      if (xs.length < 2 || !xs.some((x) => x.scope === sc.scope)) continue;
      const where = xs.map((x) => displayPath(x.file, sc)).join(', ');
      out.push(finding('warn', 'EP-DUPLICATE-BLOCK', `the ${f.id} block loads ${xs.length} times here (${where}), about ${tokens(body) * (xs.length - 1)} extra tokens per session; to keep one copy, list the others in claudeMdExcludes in .claude/settings.local.json (verify only reports this)`));
    }
  }
  return out;
}
