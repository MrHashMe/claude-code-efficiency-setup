// What the agent itself recorded under <config dir>/plugins: the marketplaces it knows and the plugin versions it
// installed. Read-only, and only names, versions, repositories and commit ids are used. A file that is missing,
// damaged or shaped differently reads as empty: the agent owns these files and may change them.
import { join } from 'node:path';
import { fail, finding, printable, readJson } from './util.mjs';

const plain = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
function agentFile(configDir, name) {
  try {
    return plain(readJson(join(configDir, 'plugins', name)));
  } catch {
    return {};
  }
}
const knownMarketplaces = (configDir) => agentFile(configDir, 'known_marketplaces.json');
const installedPlugins = (configDir) => plain(agentFile(configDir, 'installed_plugins.json').plugins);
export const marketplaceKnown = (configDir, name) => Object.hasOwn(knownMarketplaces(configDir), name);

// An id read back from a journal or state file becomes a process argument and a command to paste: name@marketplace only.
const PLUGIN_ID = /^\w[\w.-]*@\w[\w.-]*$/;
export function pluginArgs(inst, scope, install) {
  if (!PLUGIN_ID.test(inst.plugin ?? '')) throw fail('EP-PLUGIN-ID', `not a plugin id (name@marketplace): ${inst.plugin}`, { exit: 3 });
  return install ? ['plugin', 'install', inst.plugin, '--scope', scope] : ['plugin', 'uninstall', inst.plugin, '--scope', scope, '--keep-data'];
}

// The commands that finish a plugin row by hand: add its marketplace (at the release the registry tested) unless
// the agent knows it, then install; or uninstall.
export function pluginCommands(inst, scope, configDir, install = true) {
  const step = `claude ${pluginArgs(inst, scope, install).join(' ')}`;
  if (!install || marketplaceKnown(configDir, inst.marketplace)) return [step];
  const add = inst.source
    ? `claude plugin marketplace add ${inst.source}${inst.ref ? `@${inst.ref}` : ''}`
    : `add the "${inst.marketplace}" marketplace first (/plugin, Marketplaces)`;
  return [add, step];
}

const SHA = /^[0-9a-f]{40}$/i;
// Text from the agent's files reaches the terminal: control and format characters show escaped, and it stays short.
const shown = (v) => printable(String(v)).slice(0, 60);

// The installed plugin against the release and commit the registry tested, and its marketplace against the
// repository the registry names. Only plugins and marketplaces the agent has a record of are compared.
export function installedFindings(configDir, installs) {
  const [records, markets] = [installedPlugins(configDir), knownMarketplaces(configDir)];
  const out = [];
  for (const inst of new Map(installs.map((i) => [i.plugin, i])).values()) {
    const pin = /^v?(\d[\w.+-]*)$/.exec(inst.ref ?? '')?.[1];
    const problems = new Set();
    for (const r of Array.isArray(records[inst.plugin]) ? records[inst.plugin].map(plain) : []) {
      if (pin && typeof r.version === 'string' && r.version !== pin) problems.add(`installed ${shown(r.version)}, tested pin ${pin}`);
      if (SHA.test(inst.sha ?? '') && SHA.test(r.gitCommitSha ?? '') && r.gitCommitSha.toLowerCase() !== inst.sha.toLowerCase()) {
        problems.add(`installed commit ${r.gitCommitSha.slice(0, 7)}, tested commit ${inst.sha.slice(0, 7)}`);
      }
    }
    if (problems.size) out.push(finding('warn', 'EP-COMPONENT-VERSION-UNEXPECTED', `${inst.plugin}: ${[...problems].join('; ')}; run claude plugin update ${inst.plugin}, or plan again to review what the playbook pins`));
  }
  for (const inst of new Map(installs.filter((i) => i.source).map((i) => [i.marketplace, i])).values()) {
    const from = plain(plain(markets[inst.marketplace]).source);
    if (from.source === 'github' && typeof from.repo === 'string' && from.repo.toLowerCase() !== inst.source.toLowerCase()) {
      out.push(finding('warn', 'EP-MARKETPLACE-NOT-CANONICAL', `marketplace "${inst.marketplace}" comes from ${shown(from.repo)}, not ${inst.source}, the repository the registry tested; remove it with claude plugin marketplace remove ${inst.marketplace}, then plan again`));
    }
  }
  return out;
}
