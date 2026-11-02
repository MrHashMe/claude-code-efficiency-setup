// Release checks for this repo (06 section 11). Node 22+, no dependencies. Prints one FAIL line per problem and exits 1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUDGET, loadFragments, renderRules } from '../engine/content.mjs';
import { loadRegistry, renderDecisions } from '../engine/registry.mjs';
import { HIDDEN } from '../engine/loaded.mjs';
import { ENGINE, normalize, tokens } from '../engine/util.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = (p) => fs.readFileSync(path.join(root, p));
const read = (p) => raw(p).toString('utf8').replace(/\r\n/g, '\n');
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) =>
  e.name === '.git' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name).split(path.sep).join('/')]);
const files = walk('.');
const under = (...dirs) => files.filter((p) => dirs.some((d) => p.startsWith(`${d}/`)));

// 1. Each playbook uses one version throughout; both plugin manifests share one release version.
// PLAYBOOK.md stays the v7.3 manual guide in 8.0, so its markers still have to agree with each other.
const book = read('PLAYBOOK.md');
const lines = book.split('\n');
const v = /\(v(\d+\.\d+)\)/.exec(lines[0])?.[1];
check(v, 'no (vX.Y) in the PLAYBOOK.md title');
for (const s of [`the playbook version (\`v${v}\`)`, `records version \`v${v}\``])
  check(book.includes(s), `PLAYBOOK.md lacks: ${s}`);
for (const s of [`<!-- playbook v${v} -->`, `<!-- end of Part 1, playbook v${v} -->`])
  check(lines.includes(s), `PLAYBOOK.md lacks the line: ${s}`);
const cbook = read('PLAYBOOK-CODEX.md');
const clines = cbook.split('\n');
const cv = /\(v(\d+\.\d+)\)/.exec(clines[0])?.[1];
check(cv, 'no (vX.Y) in the PLAYBOOK-CODEX.md title');
for (const s of [`the playbook version (\`codex-v${cv}\`)`, `records version \`codex-v${cv}\``, `the \`codex playbook v${cv}\` line`])
  check(cbook.includes(s), `PLAYBOOK-CODEX.md lacks: ${s}`);
for (const s of [`<!-- codex playbook v${cv} -->`, `<!-- end of Part 1, codex playbook v${cv} -->`])
  check(clines.includes(s), `PLAYBOOK-CODEX.md lacks the line: ${s}`);
const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
const cplugin = JSON.parse(read('.codex-plugin/plugin.json'));
check(/^\d+\.\d+\.\d+$/.test(plugin.version), `plugin.json version ${plugin.version} isn't X.Y.Z`);
check(cplugin.version === plugin.version && cplugin.name === plugin.name, 'the Claude and Codex plugin.json files must share name and version');
check(plugin.version === ENGINE, `plugin.json version ${plugin.version} isn't the engine version ${ENGINE} (engine/util.mjs)`);
if (process.env.GITHUB_REF_TYPE === 'tag') check(process.env.GITHUB_REF_NAME === `v${plugin.version}`, `tag ${process.env.GITHUB_REF_NAME} isn't v${plugin.version}`);

// 2. Marketplace invariants. Codex reads .agents/plugins/marketplace.json first; its name must never change, or upgrades fail.
const market = JSON.parse(read('.claude-plugin/marketplace.json'));
const entry = market.plugins?.[0];
check(market.plugins?.length === 1, 'marketplace.json must list exactly one plugin');
check(entry?.name === plugin.name && market.name === plugin.name, 'marketplace name, entry name and plugin name must match');
check(entry?.source === './' && !('version' in (entry ?? {})), 'marketplace entry needs source "./" and no version');
check(market.description, 'marketplace.json needs a top-level description');
const cmarket = JSON.parse(read('.agents/plugins/marketplace.json'));
const centry = cmarket.plugins?.[0];
check(cmarket.plugins?.length === 1 && cmarket.name === plugin.name && centry?.name === plugin.name, 'Codex marketplace must list only this plugin, under the same name');
check(centry?.source?.source === 'local' && centry?.source?.path === './', 'Codex marketplace entry needs source {source: "local", path: "./"}');

// 3. Nothing that would load into every session; every skill explicit-only and short.
for (const p of ['CLAUDE.md', 'AGENTS.md', 'SKILL.md', 'plugin.json', 'bin', 'hooks', '.mcp.json', '.app.json', 'commands', 'agents'])
  check(!fs.existsSync(path.join(root, p)), `${p} must not exist`);
// An allowlist, so a component key added to the manifest format later (hooks, MCP or LSP servers, agents...) fails too.
const META = ['name', 'displayName', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords'];
for (const k of Object.keys(plugin).filter((k) => !META.includes(k)))
  check(false, `.claude-plugin/plugin.json declares ${k}; it holds only metadata (${META.join(', ')})`);
check(cplugin.skills === './codex-skills/' && !('hooks' in cplugin) && !('mcpServers' in cplugin) && !('apps' in cplugin),
  'Codex plugin.json must point skills at ./codex-skills/ and declare no hooks, MCP servers or apps');
check(/^policy:\n\s+allow_implicit_invocation: false\n?$/.test(read('codex-skills/setup/agents/openai.yaml')), 'the Codex setup skill must be explicit-only');
const ui = cplugin.interface ?? {};
for (const k of ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category', 'capabilities', 'defaultPrompt'])
  check(ui[k]?.length, `Codex plugin.json interface lacks ${k}`);
check(ui.defaultPrompt?.length <= 3 && ui.defaultPrompt.every((s) => s.length <= 128), 'defaultPrompt: at most 3 entries of at most 128 characters');
for (const p of files.filter((p) => /^(skills|codex-skills)\/[^/]+\/SKILL\.md$/.test(p))) {
  const text = read(p);
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
  const d = /^description: (.+)$/m.exec(front)?.[1];
  check(d && d.length <= 1024, `${p} needs a description of at most 1024 characters`);
  check(text.trimEnd().split('\n').length < 60, `${p} must stay under 60 lines`);
  if (p.startsWith('skills/')) check(/^disable-model-invocation: true$/m.test(front), `${p} must be explicit-only (disable-model-invocation: true)`);
}

// 4. The registry validates, docs/decisions.md is its rendering, and owned rules stay small and plain (C-8).
const reg = loadRegistry(root);
for (const e of reg.errors) check(false, `registry: ${e}`);
for (const c of reg.components ?? []) for (const o of c.conflicts ?? [])
  check(reg.byId.has(o), `registry: ${c.id} lists an unknown component in conflicts: ${o}`);
if (!reg.errors.length)
  check(normalize(read('docs/decisions.md')) === renderDecisions(reg.components), 'docs/decisions.md differs from the registry; run: node engine/ep.mjs evidence render --write');
const fragments = loadFragments(root);
const everything = new Set(fragments.map((f) => f.when));
const answers = { commandMap: { quick: ['npm test'], full: ['npm run check'] } };
for (const scope of Object.keys(BUDGET)) {
  const n = tokens(renderRules(fragments, scope, everything, answers) ?? '');
  check(n <= BUDGET[scope], `${scope} rules with every fragment on are ${n} tokens; the budget is ${BUDGET[scope]}`);
}
check(fragments.find((f) => f.id === 'precedence')?.scopes.includes('user') && reg.byId.get('precedence')?.defaultOn,
  'user-scope rules must carry the precedence sentence, on by default');
const EMPHASIS = /\b(ALWAYS|NEVER|MUST|IMPORTANT|CRITICAL|REQUIRED|MANDATORY|DO NOT|DON'T|ONLY|NOTE|WARNING)\b/;
for (const p of under('content').filter((p) => p.endsWith('.md'))) {
  const text = read(p);
  check(!EMPHASIS.test(text), `${p} uses capitals for emphasis`);
  check(!text.split('\n').some((l) => (l.match(/\bmust\b/gi) ?? []).length > 1), `${p} stacks "must" in one line`);
}

// 5. Engine size (N-8), no git writes outside the bench's scratch clones, no PowerShell entry points.
const count = (p) => read(p).trimEnd().split('\n').length;
const sum = (list) => list.reduce((n, p) => n + count(p), 0);
const core = files.filter((p) => /^engine\/[^/]+\.mjs$/.test(p));
const bench = under('engine/bench');
for (const p of [...core, ...bench]) check(count(p) < 400, `${p} has ${count(p)} lines; modules stay under 400`);
check(sum(core) < 3500, `the engine core has ${sum(core)} lines; the budget is 3,500`);
// N-8 says 1,200; the per-run typed-code gate and its full listing (bench/trust.mjs), added after the security review, need about 160 more.
check(sum(bench) < 1400, `engine/bench has ${sum(bench)} lines; the budget is 1,400`);
// ponytail: line-based, so a git call split across lines is missed; a real parser if that ever matters.
const GIT_WRITE = /['"`](add|am|apply|checkout|cherry-pick|clean|clone|commit|commit-tree|fetch|gc|init|merge|mv|notes|prune|pull|push|rebase|reset|restore|revert|rm|stash|submodule|switch|update-index|update-ref|worktree|write-tree)['"`]/;
for (const p of under('engine').filter((p) => p !== 'engine/bench/tasks.mjs'))
  read(p).split('\n').forEach((l, i) => check(!(/\bgit\b/.test(l) && GIT_WRITE.test(l)), `${p}:${i + 1} runs a git command that writes`));
for (const p of files.filter((p) => p.endsWith('.ps1'))) check(false, `${p}: no PowerShell entry points`);
for (const p of under('engine', 'skills', 'codex-skills', 'content', 'scripts').filter((p) => p !== 'scripts/check.mjs'))
  check(!/ExecutionPolicy/i.test(read(p)), `${p} changes the PowerShell execution policy`);

// 6. Text hygiene in every text file: no hidden characters (the set verify reports), LF without BOM, a security policy.
const TEXT = /\.(md|mjs|js|json|ya?ml|svg|txt)$|(^|\/)(LICENSE|\.gitattributes)$/;
for (const p of files.filter((p) => TEXT.test(p))) {
  const b = raw(p);
  check(!b.includes(13), `${p} has CR line endings`);
  check(!(b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf), `${p} starts with a BOM`);
  const at = read(p).split('\n').findIndex((l) => HIDDEN.test(l));
  check(at < 0, `${p}:${at + 1} has an invisible or bidirectional control character`);
}
check(fs.existsSync(path.join(root, 'SECURITY.md')), 'SECURITY.md is missing (N-12)');

// 7. No placeholders, personal paths or emails.
const manifests = ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', '.codex-plugin/plugin.json', '.agents/plugins/marketplace.json'];
for (const p of [...manifests, 'README.md', 'LICENSE'])
  check(!/<owner>|<display name>/.test(read(p)), `${p} has a placeholder`);
for (const p of files) check(!/[A-Z]:[\\/]+Users[\\/]|(^|[^\w])\/[a-z]\/Users\//im.test(read(p)), `${p} has a personal Windows path`);
for (const p of manifests)
  check(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(read(p)), `${p} has an email address`);

for (const f of fails) console.log(`FAIL: ${f}`);
console.log(fails.length ? `${fails.length} check(s) failed` : 'all checks passed');
process.exit(fails.length ? 1 : 0);
