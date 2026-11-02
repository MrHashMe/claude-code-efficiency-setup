// Verify (06 section 9): drift of owned items, budgets, duplicate rules, role conflicts, packs, policy,
// cross-scope repeats, what loads here, agent and tool versions. Read-only, except the one-line summary
// the optional nudge reads.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BUDGET, loadFragments } from './content.mjs';
import { duplicateFindings, staleFindings } from './cross.mjs';
import { installedFindings, pluginCommands } from './installed.mjs';
import { parse } from './jsonc.mjs';
import { loadedFindings, mdFiles } from './loaded.mjs';
import { itemStatus, ownership } from './owned.mjs';
import { readPolicy } from './policy.mjs';
import { loadRegistry, staleEntries } from './registry.mjs';
import { V7_USER_PATHS, resolveScope } from './scopes.mjs';
import { applyJournals, loadState, readJournal } from './state.mjs';
import { MIN_CLAUDE, WIN, agentCli, displayPath, finding, printable, privateDir, readJson, readText, run, samePath, tokens, toolPath, versionAtLeast, writeJson } from './util.mjs';

const WINDOWS_RECOMMENDED = '2.1.309';
const SECRET_WORDS = /\b(secrets?|credentials?|passwords?|api keys?)\b/i;
const V7_RULES = 'rules/token-efficiency.md';

export function agentVersion(env) {
  const cli = agentCli(env);
  if (!cli) return { cli: null, version: null };
  return { cli, version: run(cli, ['--version'], { env, timeout: 30000 }).stdout.match(/\d+\.\d+\.\d+/)?.[0] ?? null };
}

const mentionsSecrets = (cfg) => [join(cfg, 'CLAUDE.md'), ...mdFiles(join(cfg, 'rules'))].some((p) => SECRET_WORDS.test(readText(p) ?? ''));

function agentFindings(env) {
  const { cli, version } = agentVersion(env);
  if (!cli) return [finding('info', 'EP-AGENT-MISSING', 'the claude CLI is not on PATH (or only as an npm .cmd shim), so plugin rows print commands to paste')];
  if (version && !versionAtLeast(version, MIN_CLAUDE)) return [finding('error', 'EP-AGENT-BELOW-MIN', `Claude Code ${version} is older than ${MIN_CLAUDE}, the oldest version v8 supports; update it`)];
  if (WIN && version && !versionAtLeast(version, WINDOWS_RECOMMENDED)) {
    return [finding('info', 'EP-AGENT-WINDOWS', `Claude Code ${version}: ${WINDOWS_RECOMMENDED} or later is recommended on Windows (PowerShell permission and hook fixes)`)];
  }
  return [];
}

// What the owned items say: files and values that changed, and plugins still waiting for their commands. Settings that
// no longer parse (status unreadable) are reported once, as EP-SETTINGS-PARSE, not once per item.
function ownedFindings(sc, owned) {
  return owned.flatMap((o) => {
    const where = `${displayPath(o.target, sc)}${o.pointer ? `#${o.pointer}` : ''}`;
    const status = itemStatus(o);
    if (status === 'missing' && o.kind === 'plugin' && o.plugin) {
      // A plugin row ends in commands you run yourself, so until then it is a step to do, not drift.
      const steps = pluginCommands(o.plugin, sc.scope, sc.configDir).map((c) => `"${c}"`).join(', then ');
      return [finding('info', 'EP-PLUGIN-NOT-INSTALLED', `${o.plugin.plugin} is planned but not installed yet; run ${steps}`)];
    }
    if (status === 'missing') return [finding('warn', 'EP-DRIFT-MISSING', `${where}: installed by the playbook but now missing; plan recreates it, uninstall forgets it`)];
    if (status === 'edited') return [finding('warn', 'EP-DRIFT-EDITED', `${where}: edited since the playbook wrote it; plan shows it as a conflict and keeps your edit until you choose`)];
    return [];
  });
}

const isoDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().startsWith(s);
};

// Components that are on here: roles two of them claim, pairs that list each other as conflicting (a pair the role
// check already named is not named again), revisit dates that have come, and what the agent installed against what
// the registry tested.
function activeFindings(ctx, sc, active) {
  const out = [];
  const said = new Set();
  const pair = (a, b) => [a, b].sort().join(' and ');
  const claims = new Map();
  for (const c of active) if (c.exclusive) for (const role of c.roles) claims.set(role, [...(claims.get(role) ?? []), c.id]);
  for (const [role, ids] of claims) {
    if (ids.length < 2) continue;
    for (const a of ids) for (const b of ids) said.add(pair(a, b));
    out.push(finding('warn', 'EP-ROLE-CONFLICT', `${ids.join(' and ')} are both active for the "${role}" role; keep one`));
  }
  const on = new Set(active.map((c) => c.id));
  for (const c of active) {
    for (const other of (c.conflicts ?? []).filter((id) => on.has(id) && id !== c.id)) {
      const both = pair(c.id, other);
      if (said.has(both)) continue;
      said.add(both);
      out.push(finding('warn', 'EP-COMPONENT-CONFLICT', `${both} overlap; keep one`));
    }
  }
  const today = ctx.now().toISOString().slice(0, 10);
  for (const c of active) {
    for (const date of (c.revisit ?? []).filter((d) => isoDate(d) && d <= today)) {
      out.push(finding('info', 'EP-REVISIT-TRIGGERED', `${c.id}: revisit date ${date} has arrived; update the playbook (a current release re-dates it)`));
    }
  }
  return [...out, ...installedFindings(sc.configDir, active.flatMap((c) => c.agents.claude?.install ?? []))];
}

// User scope: v7 files left in the config folder, and prose rules about secrets that no deny rule enforces.
function userFindings(sc, rules, settings) {
  const out = [];
  const left = V7_USER_PATHS.filter((p) => existsSync(join(sc.configDir, p)));
  if (left.length) out.push(finding('warn', 'EP-V7-LEFTOVER', `v7 files still in the config folder: ${left.join(', ')}; plan offers to move unedited ones to quarantine`));
  if (rules && left.includes(V7_RULES)) {
    const extra = tokens(readText(join(sc.configDir, V7_RULES)));
    out.push(finding('warn', 'EP-DUPLICATE-BLOCK', `the v7 rules (${V7_RULES}) and the v8 rules file both load in every session, about ${extra} extra tokens per session; add "**/${V7_RULES}" to claudeMdExcludes in settings.json to stop the v7 file loading, or run plan, which offers to move it to quarantine`));
  }
  if (!settings?.permissions?.deny?.length && mentionsSecrets(sc.configDir)) {
    out.push(finding('info', 'EP-SECURITY-RULE-UNENFORCED', 'your instruction files ask in prose to protect secrets, but settings.json has no permissions.deny rules; prose is advice, deny rules (for example "Read(./.env)") are enforced'));
  }
  return out;
}

// The one line the optional nudge hook reads. The code is shown escaped if it ever holds control characters.
function writeNudgeSummary(ctx, sc, f) {
  const p = join(sc.stateRoot, 'nudge.json');
  privateDir(sc.stateRoot);
  const problems = f.filter((x) => x.severity !== 'info');
  let shownAt = 0;
  try {
    shownAt = readJson(p, {})?.shownAt ?? 0;
  } catch {}
  writeJson(p, { at: ctx.now().toISOString(), count: problems.length, top: problems[0] ? printable(problems[0].code) : null, shownAt });
}

export function verify(ctx, { scope = 'user', deep = false } = {}) {
  const sc = resolveScope(scope, ctx);
  const reg = loadRegistry(ctx.root);
  const f = agentFindings(ctx.env);
  const state = loadState(sc, (message) => f.push(finding('error', 'EP-STATE-CORRUPT', message)));
  const owned = [...ownership(sc, state).values()];
  const disp = (p) => displayPath(p, sc);
  f.push(...ownedFindings(sc, owned));
  const rules = readText(sc.rulesFile);
  if (rules && tokens(rules) > BUDGET[sc.scope]) f.push(finding('warn', 'EP-BUDGET-EXCEEDED', `${disp(sc.rulesFile)} is about ${tokens(rules)} tokens, over the ${sc.scope} budget of ${BUDGET[sc.scope]}`));
  const fragments = loadFragments(ctx.root);
  const { policy, findings: unreadable } = readPolicy(ctx.env);
  f.push(...unreadable, ...staleFindings(ctx, sc, state, fragments), ...duplicateFindings(ctx, sc, fragments, policy), ...loadedFindings(ctx));
  const userSettings = join(sc.configDir, 'settings.json');
  const settings = [userSettings, ...(samePath(userSettings, sc.settings) ? [] : [sc.settings])].map((p) => {
    const text = readText(p);
    try {
      return text == null ? {} : parse(text);
    } catch (e) {
      f.push(finding('error', 'EP-SETTINGS-PARSE', `${disp(p)}: ${e.message}`));
      return {};
    }
  });
  // A detect list may name a plugin without its marketplace: "superpowers" matches "superpowers@<any>".
  const enabledIds = settings.flatMap((s) => Object.keys(s?.enabledPlugins ?? {}).filter((id) => s.enabledPlugins[id] === true));
  const pluginOn = (want) => enabledIds.some((id) => id === want || (!want.includes('@') && id.split('@')[0] === want));
  const active = reg.components.filter(
    (c) => owned.some((o) => o.component === c.id || o.includes?.includes(c.id)) || (c.agents.claude?.install ?? []).some((i) => pluginOn(i.plugin)),
  );
  f.push(...activeFindings(ctx, sc, active));
  for (const c of reg.components) {
    const d = c.agents.claude?.detect;
    if (!d) continue;
    const hits = [...(d.plugins ?? []).filter(pluginOn), ...(d.rulesDirs ?? []).map((r) => join(sc.configDir, r)).filter(existsSync).map(disp)];
    if (hits.length) {
      f.push(finding('info', 'EP-PACK-PRESENT', `${c.name}: ${hits.join(', ')} found; about ${c.alwaysLoaded.perSessionTokens} always-loaded tokens per session (verdict ${c.verdict}; v8 doesn't install or remove it)`));
    }
  }
  if (sc.scope === 'user') f.push(...userFindings(sc, rules, settings[0]));
  if (/onedrive|dropbox|icloud/i.test(sc.configDir)) f.push(finding('warn', 'EP-CONFIG-SYNCED', `${disp(sc.configDir)} is in a synced folder; ownership records are per machine, so plan on each machine`));
  const lastApply = applyJournals(sc).at(-1);
  if (lastApply && !readJournal(join(sc.dir, 'journal', `${lastApply}.jsonl`)).some((r) => r.type === 'end' || r.type === 'rolled-back')) {
    f.push(finding('warn', 'EP-APPLY-INCOMPLETE', `apply ${lastApply} stopped part-way; run rollback --scope ${sc.scope} --last, then plan again`));
  }
  for (const c of staleEntries(active, ctx.now())) f.push(finding('info', 'EP-EVIDENCE-STALE', `${c.id}: verdict dated ${c.verdictDate} is past its ${c.freshnessDays}-day window; update the playbook`));
  const tools = [];
  for (const inst of active.flatMap((c) => c.agents.claude?.install ?? []).filter((i) => i.bin && pluginOn(i.plugin))) {
    const bin = toolPath(inst.bin, ctx.env);
    if (!bin) f.push(finding('warn', 'EP-TOOL-MISSING', `${inst.plugin} is enabled but ${inst.bin} isn't installed, so it can't start`));
    else if (deep && /\.(cmd|bat)$/i.test(bin)) tools.push({ bin: inst.bin, status: 'present, not probed (.cmd shim)' });
    else if (deep) tools.push({ bin: inst.bin, status: run(bin, ['--version'], { env: ctx.env, timeout: 15000, input: '' }).ok ? 'answers --version' : 'no answer to --version' });
  }
  if (sc.scope === 'user' && owned.some((o) => o.component === 'nudge')) writeNudgeSummary(ctx, sc, f);
  return { data: { scope: sc.scope, owned: owned.length, ...(deep ? { tools } : {}) }, findings: f };
}
