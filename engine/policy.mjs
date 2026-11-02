// U-4: managed settings (the admin policy) win over every scope. The engine reads the policy files only,
// not MDM, the Windows registry or server-managed policy, merges them the way Claude Code does, and never
// plans a write the policy overrides or refuses: such rows are blocked, with the reason, and no approval
// selects them.
import { parsePointer, toPointer } from './jsonc.mjs';
import { managedFiles } from './scopes.mjs';
import { canonical, finding, normalize, readText, slash } from './util.mjs';

// Aliases resolve within each file; when a file sets both, the canonical key wins.
const ALIASES = { allowedMarketplaces: 'strictKnownMarketplaces', additionalMarketplaces: 'extraKnownMarketplaces' };
const WHOLE = new Set(['fallbackModel', 'modelPicker']);
const BY_NAME = new Set(['extraKnownMarketplaces', 'managedMcpServers']);
const OFFICIAL = { source: 'github', repo: 'anthropics/claude-plugins-official' };
const WRITES = new Set(['create', 'update']);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function canonicalKeys(doc) {
  const out = { ...doc };
  for (const [alias, key] of Object.entries(ALIASES)) {
    if (!(alias in out)) continue;
    if (!(key in out)) out[key] = out[alias];
    delete out[alias];
  }
  return out;
}

// Later files: a single value replaces, lists combine without duplicates, objects merge key by key;
// a marketplace or MCP server of the same name is replaced whole.
function mergeValue(a, b, byName) {
  if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b.filter((x) => !a.some((y) => canonical(y) === canonical(x)))];
  if (!isObj(a) || !isObj(b)) return b;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in a && !byName ? mergeValue(a[k], v, false) : v;
  return out;
}

export function readPolicy(env) {
  const findings = [];
  const bad = (p, why) => findings.push(finding('warn', 'EP-POLICY-UNREADABLE', `managed settings ${slash(p)} ${why}; the plan can't tell what that file allows`));
  const policy = {};
  for (const p of managedFiles(env, (dir, e) => bad(dir, `can't be listed (${e.code ?? e.message})`))) {
    let text;
    try {
      text = readText(p);
    } catch (e) {
      bad(p, `can't be read (${e.code ?? e.message})`);
      continue;
    }
    if (text == null || !normalize(text).trim()) continue;
    let doc;
    try {
      doc = JSON.parse(normalize(text));
    } catch (e) {
      // N-7: the parser's message can quote the file's text, which may hold a secret; keep only where.
      const at = /position \d+(?: \(line \d+ column \d+\))?/.exec(e.message)?.[0];
      bad(p, `isn't valid JSON${at ? ` (at ${at})` : ''}, and Claude Code refuses to start until it is fixed`);
      continue;
    }
    if (!isObj(doc)) {
      bad(p, "doesn't hold a JSON object, and Claude Code refuses to start until it is fixed");
      continue;
    }
    for (const [k, v] of Object.entries(canonicalKeys(doc))) policy[k] = k in policy && !WHOLE.has(k) ? mergeValue(policy[k], v, BY_NAME.has(k)) : v;
  }
  return { policy, findings };
}

const valueAt = (obj, pointer) => parsePointer(pointer).reduce((v, k) => (isObj(v) ? v[k] : undefined), obj);
const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return /^[^@]+@([^:/]+)[:/]/.exec(url ?? '')?.[1] ?? null;
  }
};
const same = (a, b, keys) => keys.every((k) => (a[k] ?? null) === (b[k] ?? null));

// One strictKnownMarketplaces entry against a marketplace source, per the plugin marketplace docs.
export function admits(e, src) {
  if (!isObj(e) || !isObj(src)) return false;
  if (e.source === 'hostPattern') {
    const host = src.source === 'github' ? 'github.com' : ['git', 'url'].includes(src.source) ? hostOf(src.url) : null;
    try {
      return Boolean(host) && new RegExp(e.hostPattern).test(host);
    } catch {
      return false;
    }
  }
  if (e.source === 'pathPattern') {
    try {
      return ['file', 'directory'].includes(src.source) && new RegExp(e.pathPattern).test(src.path ?? '');
    } catch {
      return false;
    }
  }
  if (e.source !== src.source) return false;
  if (e.source === 'github') {
    const [owner, name, extra] = String(e.repo ?? '').split('/');
    // owner/* admits every repository of that owner; any other wildcard is invalid and admits nothing.
    if (name === '*' && extra === undefined && owner && !owner.includes('*')) {
      return String(src.repo ?? '').split('/')[0] === owner && same(e, src, ['ref']) && (e.path == null || e.path === src.path);
    }
    return !String(e.repo).includes('*') && same(e, src, ['repo', 'ref', 'path']);
  }
  if (e.source === 'git') return same(e, src, ['url', 'ref', 'path']);
  if (e.source === 'url') return same(e, src, ['url']);
  if (e.source === 'file' || e.source === 'directory') return same(e, src, ['path']);
  return false;
}

// The marketplace a row adds or installs from: its name and source, or undefined for other rows.
function marketplaceOf(it, c) {
  const m = /^\/extraKnownMarketplaces\/([^/]+)$/.exec(it.pointer ?? '');
  if (it.kind === 'key' && m) return { name: m[1], source: it.value?.source ?? null };
  if (it.kind !== 'plugin') return undefined;
  const name = it.plugin.marketplace;
  const declared = c?.agents.claude?.settings?.[toPointer(['extraKnownMarketplaces', name])]?.source;
  const source = declared ?? (name === 'claude-plugins-official' ? OFFICIAL : it.plugin.source ? { source: 'github', repo: it.plugin.source, ...(it.plugin.ref ? { ref: it.plugin.ref } : {}) } : null);
  return { name, source };
}

// Why the policy blocks a planned write, or null. Removing what the engine owns is never blocked.
export function blockedBy(policy, row, c) {
  const { it } = row;
  if (!WRITES.has(row.op)) return null;
  if (it.kind === 'entry') {
    if (!it.pointer.startsWith('/hooks/')) return null;
    const flag = ['disableAllHooks', 'allowManagedHooksOnly'].find((k) => policy[k] === true);
    return flag ? `managed settings set ${flag}, so a hook from this scope would not run` : null;
  }
  if (it.kind === 'plugin' && policy.enabledPlugins?.[it.plugin.plugin] === false) return `managed settings disable ${it.plugin.plugin} at every scope`;
  if ((it.kind === 'key' || it.kind === 'plugin') && valueAt(policy, it.pointer) !== undefined) return `managed settings set ${it.pointer}, which wins over every other scope`;
  const market = marketplaceOf(it, c);
  const list = policy.strictKnownMarketplaces;
  if (!market || list == null) return null;
  // A value that isn't a list is enforced as an empty allowlist.
  const ok = Array.isArray(list) && market.source != null && list.some((e) => admits(e, market.source));
  return ok ? null : `managed strictKnownMarketplaces doesn't admit the ${market.name} marketplace`;
}
