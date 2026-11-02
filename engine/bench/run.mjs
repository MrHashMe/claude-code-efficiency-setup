// bench run: the refusals (M-4) and the typed confirmation (M-9), then one fresh history-free clone per run, with a started line before the agent and a result line after it in results.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { agentCommand, canonical, configDir, fail, finding, hash12, hash32, hashPath, killAll, launchAgent, privateDir, readJson, rmDir, say, scrub, tail } from './io.mjs';
import { FIELDS, canonModel, loadPrices, priceRun, totalTokens } from './stats.mjs';
import { accept, changes, cloneContext, configPrint, dropBase, isTest, loadTasks, prepareClone, runClone, writeAcceptance } from './tasks.mjs';
import { confirmRun } from './trust.mjs';

const BILLING = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY'];
// Behavior-changing environment flags. Their values go into the fingerprint; none of them holds a secret.
const ENV_FLAGS = ['ANTHROPIC_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'ANTHROPIC_SMALL_FAST_MODEL',
  'CLAUDE_CODE_SUBAGENT_MODEL', 'CLAUDE_CODE_EFFORT_LEVEL', 'MAX_THINKING_TOKENS', 'CLAUDE_CODE_MAX_OUTPUT_TOKENS', 'DISABLE_PROMPT_CACHING',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', 'DISABLE_TELEMETRY', 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS', 'CLAUDE_CODE_SIMPLE'];
const USER_CONTENT = ['settings.json', 'CLAUDE.md', 'rules', 'skills', 'agents', 'commands', 'output-styles', 'plugins/installed_plugins.json'];
const INFRA = /usage limit|rate.?limit|limit (reached|exceeded)|overloaded|internal server error|api error|\b(429|5\d\d)\b|connection|network|ECONN|ETIMEDOUT|socket hang up|log ?in|authenticat|unauthori[sz]ed|credit balance|billing|quota/i;
const NET = /\b(curl|wget|Invoke-WebRequest|Invoke-RestMethod|iwr|irm|ssh|scp|rsync|ftp|telnet|git\s+(clone|fetch|pull|push|ls-remote)|npm\s+(i|install|ci|add|publish)|pnpm\s+(i|install|add)|yarn\s+(add|install)|pip3?\s+install|cargo\s+(install|add|fetch)|go\s+(get|install))\b/i;
const RESULT = /"type"\s*:\s*"result"/;
const SIGNALS = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 }; // the exit codes a shell reports for them: 128 plus the signal number
const settingsFiles = (c) => [['user settings', path.join(configDir(c.env), 'settings.json')],
  ['project settings', path.join(c.repo, '.claude', 'settings.json')], ['local project settings', path.join(c.repo, '.claude', 'settings.local.json')]];

// validate and run start the repository's commands and the agent's sessions: a person does that from a plain terminal, not from inside a session.
export function refuseNested(c, what) {
  if (c.env.CLAUDECODE || c.env.EP_BENCH_CHILD)
    throw fail('EP-BENCH-NESTED', `bench ${what} refuses to run inside an agent session (CLAUDECODE or EP_BENCH_CHILD is set): run it from a plain terminal you opened yourself`, 3);
}

// The billing check also reads each arm's settings and the MCP servers' env once there is a plan.
export function guards(c, o, plan) {
  refuseNested(c, 'run');
  if (o['allow-api-billing']) return;
  const found = BILLING.filter((n) => c.env[n]).map((n) => `${n} (environment)`);
  const scan = (label, s) => {
    if (s?.apiKeyHelper) found.push(`apiKeyHelper (${label})`);
    found.push(...BILLING.filter((n) => s?.env?.[n]).map((n) => `env.${n} (${label})`));
  };
  for (const [label, file] of settingsFiles(c)) scan(label, readJson(file));
  for (const a of plan?.arms ?? []) if (a.settings) scan(`arm ${a.name} settings`, readJson(a.settings));
  for (const [n, srv] of Object.entries(plan?.mcpConfig?.mcpServers ?? {})) scan(`MCP server ${n}`, { env: srv?.env });
  // Names only: no value is ever copied into a message.
  if (found.length) throw fail('EP-BENCH-API-BILLING', `these runs would bill an API key or a custom endpoint instead of your plan: ${found.join(', ')}. Unset it, or pass --allow-api-billing to accept API charges`, 3);
}

const origin = (u) => { try { return new URL(u).origin; } catch { return 'a URL'; } };
const money = (x) => (Number.isFinite(x) && x >= 0 ? x : null);
const flat = (u = {}) => {
  const c5 = u.cache_creation?.ephemeral_5m_input_tokens ?? 0, c1 = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  return { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0,
    write5m: Math.max(c5, (u.cache_creation_input_tokens ?? 0) - c1), write1h: c1 };
};
const add = (a, b) => Object.fromEntries(FIELDS.map((f) => [f, (a?.[f] ?? 0) + (b?.[f] ?? 0)]));
const maxOf = (a, b) => Object.fromEntries(FIELDS.map((f) => [f, Math.max(a?.[f] ?? 0, b?.[f] ?? 0)]));

export function parseStream(text) {
  const s = { init: null, result: null, msgs: new Map(), tools: new Map(), hooks: 0 };
  for (const line of String(text).split('\n')) {
    if (!line.trim().startsWith('{')) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; } // a partial line from a killed run
    if (e.type === 'system' && e.subtype === 'init') s.init ??= e;
    else if (e.type === 'system' && /^hook/.test(e.subtype ?? '')) s.hooks++;
    else if (e.type === 'result') s.result = e;
    else if (e.type === 'assistant' && e.message?.id && e.message.model !== '<synthetic>') {
      // A message arrives once per content block, each time repeating its usage: one record per message id.
      const m = e.message, old = s.msgs.get(m.id);
      s.msgs.set(m.id, { model: m.model, main: old?.main ?? !e.parent_tool_use_id, usage: maxOf(old?.usage, flat(m.usage)) });
      for (const b of m.content ?? []) if (b.type === 'tool_use') s.tools.set(b.id ?? `${m.id}:${s.tools.size}`, { name: b.name, input: b.input ?? {} });
    }
  }
  return s;
}
// Tokens by model from the stream (subagents included), plus whatever the result's per-model totals add on top (helper model calls).
export function usageOf(s) {
  const byModel = {};
  for (const m of s.msgs.values()) byModel[canonModel(m.model)] = add(byModel[canonModel(m.model)], m.usage);
  for (const [model, u] of Object.entries(s.result?.modelUsage ?? {})) {
    const have = byModel[canonModel(model)] ?? add();
    const extra = { input: (u.inputTokens ?? 0) - have.input, output: (u.outputTokens ?? 0) - have.output, cacheRead: (u.cacheReadInputTokens ?? 0) - have.cacheRead,
      write5m: (u.cacheCreationInputTokens ?? 0) - have.write5m - have.write1h, write1h: 0 };
    byModel[canonModel(model)] = add(have, Object.fromEntries(FIELDS.map((f) => [f, Math.max(0, extra[f])])));
  }
  const first = [...s.msgs.values()].find((m) => m.main);
  return { byModel, tokens: Object.values(byModel).reduce(add, add()), firstCacheRead: first ? first.usage.cacheRead : null };
}

// M-10: failed, capped and timed-out runs are graded and keep their spend; usage limits and infrastructure errors are missing data.
export function outcome(p, s) {
  if (p.spawnError) return { status: 'missing', reason: `couldn't start the agent: ${p.spawnError}` };
  const r = s.result;
  if (!r) return p.killed ? { status: 'graded', reason: 'timed out' } : { status: 'missing', reason: `the agent exited without a result: ${tail(p.err || p.out, 300)}` };
  const capped = /^error_max/.test(r.subtype ?? ''), text = `${r.result ?? ''} ${[].concat(r.errors ?? []).join(' ')}`.trim() || p.err;
  if (r.is_error && !capped && INFRA.test(text)) return { status: 'missing', reason: `usage limit or infrastructure: ${tail(text, 300)}` };
  return { status: 'graded', reason: capped ? r.subtype : r.is_error ? `error: ${tail(text || r.subtype, 200)}` : null };
}

const mainModels = (s) => {
  const m = [...new Set([...s.msgs.values()].filter((x) => x.main).map((x) => x.model))];
  return m.length ? m : [s.init?.model].filter(Boolean);
};
const sameModel = (got, want) => { const g = canonModel(got).toLowerCase(), w = canonModel(want).toLowerCase(); return g === w || g.includes(w); };
const names = (xs) => [].concat(xs ?? []).map((x) => (typeof x === 'string' ? x : x?.name)).filter(Boolean);
// Did the arm take effect? Checked on the init record: model, MCP servers, permission mode, expected and excluded content, hooks.
export function delivery(s, arm, plan, models) {
  const i = s.init, problems = [];
  if (!i) return { ok: false, problems: ['no init record in the stream'] };
  if (arm.model && !models.some((m) => sameModel(m, arm.model))) problems.push(`model ${models.join(', ') || 'unknown'} instead of ${arm.model}`);
  const servers = names(i.mcp_servers).sort().join(), want = Object.keys(plan.mcpConfig.mcpServers ?? {}).sort().join();
  if (servers !== want) problems.push(`MCP servers [${servers}] differ from the strict configuration [${want}]`);
  if (i.permissionMode && i.permissionMode !== plan.permissionMode) problems.push(`permission mode ${i.permissionMode} instead of ${plan.permissionMode}`);
  const loaded = new Set([...names(i.plugins), ...names(i.skills), ...names(i.agents), ...names(i.slash_commands)]);
  problems.push(...arm.expect.filter((n) => !loaded.has(n)).map((n) => `${n} isn't loaded`));
  problems.push(...arm.absent.filter((n) => loaded.has(n)).map((n) => `${n} is loaded although the arm excludes it`));
  if (arm.hooks && !s.hooks) problems.push('no hook event in the stream');
  return { ok: !problems.length, problems };
}

function sharedPrint(c, k) {
  const d = configDir(c.env);
  return { user: Object.fromEntries(USER_CONTENT.map((f) => [f, hashPath(path.join(d, f))])), project: k.projectConfig,
    env: Object.fromEntries(ENV_FLAGS.filter((n) => c.env[n] != null).map((n) => [n, c.env[n]])), billing: BILLING.filter((n) => c.env[n]) };
}
function fingerprint(shared, s, arm, models) {
  const i = s.init ?? {}, agent = i.claude_code_version ?? null, apiKeySource = i.apiKeySource ?? null;
  const base = hash12({ ...shared, agent, apiKeySource });
  const own = { model: models, effort: arm.effort, permissionMode: i.permissionMode ?? null, overlay: arm.hashes,
    plugins: names(i.plugins).sort(), mcpServers: names(i.mcp_servers).sort() };
  return { agent, apiKeySource, ...own, base, hash: hash12({ base, ...own }) };
}

function flags(s, dir, ch, t) {
  const inside = (p) => { const r = path.relative(dir, path.resolve(dir, p)); return !r.startsWith('..') && !path.isAbsolute(r); };
  const tools = [...s.tools.values()];
  const outsideWrites = tools.filter((x) => /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(x.name)).map((x) => x.input.file_path ?? x.input.notebook_path)
    .filter((p) => typeof p === 'string' && !inside(p));
  // Scrubbed before it is cut: a secret that straddles the cut would otherwise survive in part.
  const network = tools.filter((x) => /^Web(Fetch|Search)$/.test(x.name) || (/^(Bash|PowerShell)$/.test(x.name) && NET.test(x.input.command ?? '')))
    .map((x) => (x.name === 'WebFetch' ? `WebFetch ${origin(x.input.url)}` : x.name === 'WebSearch' ? 'WebSearch' : scrub(String(x.input.command ?? '').slice(0, 1000)).slice(0, 200)));
  return { outsideWrites: [...new Set(outsideWrites)], network, deletedTests: ch.deleted.filter(isTest),
    acceptanceTouched: ch.files.map((f) => f.file).filter((f) => t.acceptanceFiles.includes(f)) };
}

// Every flag below is listed by `claude --help` on 2.1.303 except --max-turns (accepted, but hidden from the help) and
// --append-system-prompt-file (named only in the --bare description). --allowedTools takes any number of values, so a flag follows it.
export const agentArgs = (plan, arm, mcpFile) => ['-p', '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
  '--strict-mcp-config', '--mcp-config', mcpFile, '--max-turns', String(plan.caps.maxTurns), '--max-budget-usd', String(plan.caps.budgetUsd),
  '--allowedTools', ...plan.allowedTools, '--permission-mode', plan.permissionMode, '--forward-subagent-text', '--include-hook-events',
  ...(arm.model ? ['--model', arm.model] : []), ...(arm.effort ? ['--effort', arm.effort] : []), ...(arm.settings ? ['--settings', arm.settings] : []),
  ...(arm.append ? ['--append-system-prompt', arm.append] : []), ...(arm.appendFile ? ['--append-system-prompt-file', arm.appendFile] : []),
  ...(arm.pluginDir ? ['--plugin-dir', arm.pluginDir] : [])];
export const armHashes = (a) => ({ settings: hashPath(a.settings), pluginDir: hashPath(a.pluginDir),
  append: a.appendFile ? hashPath(a.appendFile) : a.append && hash32(a.append) });

// What a finished agent process says: its outcome, tokens and API-price estimate.
function record(r, arm, row, p, s, wallMs) {
  const out = outcome(p, s), use = usageOf(s), models = mainModels(s), res = s.result ?? {}, price = priceRun(r.prices, use.byModel);
  const usageMissing = !totalTokens(use.tokens) && (s.msgs.size > 0 || (res.num_turns ?? 0) > 0); // zeroed usage (CC#95555)
  return { ...row, status: out.status, reason: out.reason, pass: null,
    exit: { code: p.code, subtype: res.subtype ?? null, isError: res.is_error ?? null, timedOut: p.killed, lingered: p.lingered, truncated: p.truncated },
    fingerprint: fingerprint(r.shared, s, arm, models), delivery: delivery(s, arm, r.plan, models),
    tokens: use.tokens, byModel: use.byModel, firstCacheRead: use.firstCacheRead, usageMissing,
    costUsd: usageMissing ? null : price.usd, costLabel: 'API-price estimate', unknownModels: price.unknown, unpricedModels: price.unpriced,
    agentCostUsd: money(res.total_cost_usd), turns: res.num_turns ?? null, durationMs: res.duration_ms ?? null, wallMs };
}
// The cost the agent reported, read without trusting the rest of its output.
function reportedCost(out) {
  for (const l of out.split('\n')) if (RESULT.test(l)) try { return money(JSON.parse(l).total_cost_usd); } catch {}
  return null;
}

async function oneRun(r, t, arm, slot) {
  const { c, k, plan } = r, name = `${t.id}-${arm.name}-${slot.rep}`, dir = path.join(r.runDir, name);
  const row = { plan: plan.hash, task: t.id, arm: arm.name, rep: slot.rep, seq: slot.seq, at: c.now().toISOString() };
  let start;
  try {
    runClone(k, t, dir);
    start = await prepareClone(k, t, dir);
    if (r.signal) throw new Error(`interrupted by ${r.signal}`); // a stopped prepare command looks like a failed one
  } catch (e) {
    return { ...row, status: 'missing', reason: `setup failed: ${tail(e.message, 300)}`, pass: null, leftover: rmDir(dir) };
  }
  // Written before the agent starts, so a bench that dies mid-run leaves a trace: until a result row follows it, it counts at the per-run cap.
  c.store.append('results.jsonl', { ...row, status: 'started', reason: 'the agent was started and no result was recorded; until one is, this run counts at the per-run cap' });
  const began = Date.now();
  const p = await launchAgent(r.agent, agentArgs(plan, arm, r.mcpFile),
    { cwd: dir, env: r.env, input: t.prompt, timeoutMs: plan.caps.timeoutMin * 60000, finished: RESULT });
  const wallMs = Date.now() - began;
  // The agent has run, so this run may have cost money: it gets a row with the cost the agent reported (the cap counts when even that is unknown).
  const lost = (why) => ({ ...row, status: 'missing', reason: why, pass: null, unreadable: true,
    exit: { code: p.code, subtype: null, isError: null, timedOut: p.killed, lingered: p.lingered }, agentCostUsd: reportedCost(p.out), wallMs, leftover: rmDir(dir) });
  let s, rec;
  try {
    fs.writeFileSync(path.join(r.runDir, `${name}.jsonl`), p.out, { mode: 0o600 });
    if (r.signal) return lost(`interrupted by ${r.signal}: the agent and everything it started were stopped`);
    s = parseStream(p.out);
    rec = record(r, arm, row, p, s, wallMs);
  } catch (e) {
    return lost(`couldn't read the result of the run: ${tail(e.message, 200)}`);
  }
  if (rec.status !== 'graded') return { ...rec, leftover: rmDir(dir) };
  try {
    const ch = changes(c.env, dir, start);
    writeAcceptance(k, t, dir); // grading always uses the reference tests, whatever the run did to them
    const a = await accept(k, t, dir);
    if (r.signal) throw new Error(`interrupted by ${r.signal}`); // a stopped acceptance command looks like a failed one
    const code = ch.files.filter((f) => !isTest(f.file)).reduce((n, f) => n + f.lines, 0);
    return { ...rec, pass: a.code === 0, linesChanged: ch.files.reduce((n, f) => n + f.lines, 0), filesChanged: ch.files.length,
      diffRatio: t.refLines ? +(code / t.refLines).toFixed(2) : null, flags: flags(s, dir, ch, t), leftover: rmDir(dir) };
  } catch (e) {
    return { ...rec, status: 'missing', reason: `grading failed: ${tail(e.message, 300)}`, leftover: rmDir(dir) };
  }
}

const slotKey = (x) => `${x.task}|${x.arm}|${x.rep}`;
// A run without a cost record counts at the cap, unless it produced no data (a usage limit stops a run before any model call). A started row
// counts at the cap until the next row of its slot, a result, follows it: without one the bench died before it could record what the agent cost.
const spentOn = (x, cap, next) => (x.status === 'started' ? (next && slotKey(next) === slotKey(x) && next.status !== 'started' ? 0 : cap)
  : x.exit ? x.costUsd ?? x.agentCostUsd ?? (x.status === 'missing' && !x.unreadable ? 0 : cap) : 0);
// Checked before every run: the spend so far, and the files that can change during a long bench.
function preflight(r, arm, spent) {
  const { k, plan } = r;
  if (spent + plan.caps.budgetUsd > plan.maxSpendUsd + 1e-9)
    return finding('EP-BENCH-SPEND-CAP', 'warn', `stopped: this plan's runs reached $${spent.toFixed(2)} (API-price estimate), so one more could pass the $${plan.maxSpendUsd.toFixed(2)} maximum`);
  if (canonical(armHashes(arm)) !== canonical(arm.hashes))
    return finding('EP-BENCH-PLAN-STALE', 'error', `arm ${arm.name}'s files changed during the bench: run bench plan again and confirm the new plan`);
  if (configPrint(k.repo, k.configFiles) !== k.projectConfig)
    return finding('EP-BENCH-CONFIG-CHANGED', 'error', 'the repository configuration changed after you confirmed the listing: run bench run again to review the new one');
  return null;
}
export async function runPlan(c, plan, o) {
  guards(c, o, plan);
  const tasks = new Map(loadTasks(c).map((t) => [t.id, t])), k = cloneContext(c), agent = agentCommand(c.env);
  const runDir = path.join(k.work, plan.hash.slice(0, 12)), mcpFile = path.join(runDir, 'mcp.json');
  // A .cmd shim starts through cmd.exe, which can't carry these characters; checked before any money is spent.
  const bad = agent.viaCmd && plan.arms.flatMap((a) => agentArgs(plan, a, mcpFile)).find((x) => /["%\r\n]/.test(x));
  if (bad) throw fail('EP-BENCH-CMD-ARGS', `claude starts through a .cmd shim here, which can't pass quotes, % or line breaks (${bad.slice(0, 60)}): use appendSystemPromptFile or install the native claude.exe`, 3);
  await confirmRun(c, k, plan.tasks.map((id) => tasks.get(id)), plan); // nothing below starts until a person has typed the code
  privateDir(runDir);
  fs.writeFileSync(mcpFile, JSON.stringify(plan.mcpConfig), { mode: 0o600 }); // the MCP servers' env can hold tokens
  const prior = c.store.rows('results.jsonl').filter((x) => x.plan === plan.hash);
  const done = new Set(prior.filter((x) => x.status === 'graded').map(slotKey));
  const r = { c, k, plan, agent, mcpFile, runDir, prices: loadPrices(), shared: sharedPrint(c, k), signal: null,
    env: { ...c.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1', EP_BENCH_CHILD: '1' } };
  const findings = [], undelivered = {};
  let ran = 0, missingInRow = 0, exitCode, spent = prior.reduce((n, x, i) => n + spentOn(x, plan.caps.budgetUsd, prior[i + 1]), 0);
  // The agent runs detached, so Ctrl-C and a closed terminal don't reach it: a signal stops it and everything it started, and the bench ends cleanly.
  const off = Object.keys(SIGNALS).map((sig) => {
    const stop = () => { r.signal = sig; killAll(); };
    process.once(sig, stop);
    return () => process.off(sig, stop);
  });
  try {
    for (const slot of plan.order.filter((x) => !done.has(slotKey(x)))) {
      const t = tasks.get(slot.task), arm = plan.arms.find((a) => a.name === slot.arm);
      const stop = preflight(r, arm, spent);
      if (stop) {
        findings.push(stop);
        if (stop.severity === 'error') exitCode = 3;
        break;
      }
      say(c.env, `run ${slot.seq}/${plan.order.length}: task ${t.id}, arm ${arm.name}, rep ${slot.rep}`);
      const got = await oneRun(r, t, arm, slot), rec = got.reason ? { ...got, reason: scrub(got.reason) } : got; // agent output can echo a secret
      c.store.append('results.jsonl', rec);
      ran++;
      spent += spentOn(rec, plan.caps.budgetUsd);
      say(c.env, `  ${rec.status === 'graded' ? (rec.pass ? 'pass' : 'fail') : `missing: ${rec.reason}`}${rec.costUsd != null ? `, $${rec.costUsd.toFixed(4)} API-price estimate` : ''}`);
      if (r.signal) {
        findings.push(finding('EP-BENCH-INTERRUPTED', 'warn', `stopped: ${r.signal} arrived, and the agent and everything it started were stopped. Resume with bench run --plan ${plan.hash}`));
        exitCode = SIGNALS[r.signal];
        break;
      }
      missingInRow = rec.status === 'missing' ? missingInRow + 1 : 0;
      if (rec.status === 'graded') undelivered[arm.name] = rec.delivery.ok ? 0 : (undelivered[arm.name] ?? 0) + 1;
      const src = rec.fingerprint?.apiKeySource;
      if (src && src !== 'none' && !o['allow-api-billing']) {
        findings.push(finding('EP-BENCH-API-BILLING', 'error', `the agent reported API billing (apiKeySource ${src}), so the bench stopped; pass --allow-api-billing to accept API charges`));
        exitCode = 3;
        break;
      }
      if (missingInRow >= 2) {
        findings.push(finding('EP-BENCH-STOPPED', 'warn', `stopped: two runs in a row produced no data (${rec.reason}). Resume later with bench run --plan ${plan.hash}`));
        break;
      }
      if (undelivered[arm.name] >= 2) {
        findings.push(finding('EP-BENCH-DELIVERY-STOP', 'warn', `stopped: arm ${arm.name} didn't take effect in two runs in a row (${rec.delivery.problems.join('; ')}). Fix the arm, then plan again`));
        break;
      }
    }
  } finally {
    off.forEach((f) => f());
  }
  for (const id of plan.tasks) dropBase(k, id);
  const graded = new Set(c.store.rows('results.jsonl').filter((x) => x.plan === plan.hash && x.status === 'graded').map(slotKey));
  const remaining = plan.order.filter((x) => !graded.has(slotKey(x))).length;
  if (remaining && !findings.length) findings.push(finding('EP-BENCH-INCOMPLETE', 'info', `${remaining} planned runs have no graded result; bench run --plan ${plan.hash} retries them`));
  return { data: { plan: plan.hash, ran, remaining, results: c.store.p('results.jsonl') }, findings, exitCode };
}
