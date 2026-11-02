// ep bench: tasks, validate, plan, run and report for one repository (bench v2, docs/v8/09-evaluation-plan.md).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fail, finding, git, hash32, sha, store } from './io.mjs';
import { armHashes, guards, refuseNested, runPlan } from './run.mjs';
import { loadPrices, mean, report, stdev } from './stats.mjs';
import { loadTasks, mineTasks, validateTasks } from './tasks.mjs';

export const HELP = `ep bench <subcommand> [--repo <path>]   (data: <state>/bench/<repo key>/)

  tasks --accept "<cmd>" [--prepare "<cmd>"] [--limit 20] [--tuning n]
      Mine tasks from commits that changed tests and code: base, reference, a drafted prompt (review it in
      tasks.jsonl), the reference tests as hidden acceptance files. --tuning n tags n tasks "tuning"; those
      are never used to judge an arm.
  validate [--task <id>]
      Keep the tasks that pass G1 history-free clone, G2 fails at base, G3 passes at reference and
      G4 both verdicts 3 of 3 (flaky tasks are dropped). It runs the tasks' own commands, so like run it
      refuses inside an agent session and asks for a typed code first.
  plan [--k 2] [--cap-usd <per-run cap>]
      Arms from arms.json plus a lower-effort reference arm, interleaved per task (A B B A, then B A A B).
      Shows the maximum spend and the minimum detectable effect, and prints the plan hash. Refuses
      tasks whose drafted prompt still has "promptNeedsReview": true in tasks.jsonl.
  run --plan <hash> [--allow-api-billing]
      Refuses inside an agent session and refuses API-key or custom-endpoint billing (environment, your
      settings, each arm's settings, the MCP servers' env) unless allowed. Every run and every validate
      lists in full what the repository and the arms make it execute or apply, prints a fresh random code
      and goes on only when that code is typed back at a terminal; with no terminal on stdin it stops (exit 3).
      Nothing is remembered, and no flag, variable or file replaces the typing. An agent that drives a
      pseudo-terminal could still answer it, so never hand one a terminal. Stops before a run that could take
      the spend past the plan's maximum. Ctrl-C, SIGTERM or a closed terminal stops the agent and all it
      started; a run with no result row (a bench that was killed) counts at the per-run cap when you resume.
      Fresh clone per run, auto memory off, no session persistence, the same strict MCP config.
  report
      Per-task cost ratios, geometric mean, median, sign count; bootstrap intervals from 8 tasks up;
      the decision rule fixed in the plan; pass^k; validity threats. Cost is an API-price estimate.

arms.json, in the bench folder (file paths are relative to it):
  { "arms": [ { "name": "base", "effort": "high" },
              { "name": "rule", "effort": "high", "appendSystemPrompt": "One sentence with the same intent." },
              { "name": "overlay", "effort": "high", "settings": "overlay.json", "pluginDir": "plugin",
                "appendSystemPromptFile": "rules.md", "model": "sonnet", "expect": ["plugin-or-skill"],
                "absent": [], "hooks": true } ],
    "baseline": "base", "lowerEffort": "medium" (or false), "maxTurns": 40, "budgetUsd": 2, "timeoutMin": 30,
    "permissionMode": "acceptEdits", "allowedTools": ["Read", "Edit", "Write", "Glob", "Grep"], "deltaPoints": 5 }

Bench is not a sandbox: the agent and the acceptance and prepare commands run with your full user rights,
in scratch clones of the repository. Use WSL or a dev container for repositories you don't trust.`;

const S = { type: 'string' }, B = { type: 'boolean' };
const OPTIONS = { tasks: { repo: S, accept: S, prepare: S, limit: S, tuning: S }, validate: { repo: S, task: S },
  plan: { repo: S, k: S, 'cap-usd': S }, run: { repo: S, plan: S, 'allow-api-billing': B }, report: { repo: S, plan: S } };
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep'];
// These values reach the agent's command line: a tool is a name with an optional (pattern), a model an id or alias, and neither may start with a dash.
const TOOL = /^[A-Za-z_][\w.:*-]*(\([^\r\n]{0,300}\))?$/;
const MODEL = /^[A-Za-z0-9][\w.:@/[\]-]{0,99}$/;
const MODES = ['default', 'acceptEdits', 'plan', 'dontAsk']; // not bypassPermissions: the arms differ in configuration, never in how much is skipped
const NAME = /^[a-z0-9][a-z0-9-]{0,23}$/;
const LOG_10_PERCENT = -Math.log(0.9);
const armsError = (msg) => fail('EP-BENCH-ARMS', `arms.json: ${msg}`, 2);

function num(v, name, { int = false, min, max, code = 'EP-BENCH-USAGE' }) {
  if (v == null) return undefined;
  const n = Number(v);
  if (v === '' || !Number.isFinite(n) || (int && !Number.isInteger(n)) || n < min || n > max)
    throw fail(code, `${name} must be ${int ? 'a whole number' : 'a number'} from ${min} to ${max}`, 2);
  return n;
}

function context(ctx, o) {
  // A caller's git variables (a git hook sets GIT_DIR and GIT_INDEX_FILE) would point the clones' git commands at another repository.
  // On Windows, cmd.exe and the .cmd shims look in the current folder first, where a repository could plant a program: this switches that off for every child.
  const env = { ...Object.fromEntries(Object.entries(ctx.env).filter(([n]) => !/^GIT_/i.test(n) || /^GIT_CONFIG_(NOSYSTEM|GLOBAL|SYSTEM)$/i.test(n))),
    NoDefaultCurrentDirectoryInExePath: '1' };
  const start = path.resolve(ctx.cwd, o.repo ?? '.');
  let top;
  try {
    top = git(env, start, 'rev-parse', '--show-toplevel');
  } catch {
    throw fail('EP-BENCH-NOT-A-REPO', `${start} isn't inside a git repository`, 2);
  }
  const repo = fs.realpathSync.native(top), key = sha(repo.replace(/\\/g, '/').toLowerCase()).slice(0, 12);
  const dir = path.join(ctx.stateRoot, 'bench', key);
  return { ctx, env, repo, key, dir, store: store(dir), now: ctx.now };
}

function resolveArms(c, cfg) {
  const bad = armsError;
  const file = (a, f) => {
    if (a[f] == null) return null;
    const p = path.resolve(c.dir, String(a[f]));
    if (!fs.existsSync(p)) throw bad(`arm ${a.name}: ${f} ${a[f]} doesn't exist (paths are relative to ${c.dir})`);
    return p;
  };
  const arms = cfg.arms.map((a) => {
    if (!NAME.test(a?.name ?? '')) throw bad(`arm names are 1 to 24 lower-case letters, digits or hyphens, not ${JSON.stringify(a?.name)}`);
    if (a.effort != null && !EFFORTS.includes(a.effort)) throw bad(`arm ${a.name}: effort must be one of ${EFFORTS.join(', ')}`);
    if (a.model != null && !MODEL.test(String(a.model))) throw bad(`arm ${a.name}: model must be a model id or alias, not ${JSON.stringify(a.model).slice(0, 60)}`);
    const settings = file(a, 'settings'), pluginDir = file(a, 'pluginDir'), appendFile = file(a, 'appendSystemPromptFile');
    const append = a.appendSystemPrompt == null ? null : String(a.appendSystemPrompt);
    return { name: a.name, model: a.model == null ? null : String(a.model), effort: a.effort ?? null, settings, pluginDir, appendFile, append,
      expect: [].concat(a.expect ?? []).map(String), absent: [].concat(a.absent ?? []).map(String), hooks: !!a.hooks, reference: null,
      hashes: armHashes({ settings, pluginDir, appendFile, append }) };
  });
  if (new Set(arms.map((a) => a.name)).size < arms.length) throw bad('arm names must be unique');
  const baseline = cfg.baseline ?? arms[0].name, b = arms.find((a) => a.name === baseline);
  if (!b) throw bad(`the baseline ${baseline} isn't an arm`);
  // The automatic reference: the baseline one effort step lower (09: a component must beat lower effort at equal quality).
  const lower = cfg.lowerEffort === false ? null : cfg.lowerEffort ?? (b.effort ? EFFORTS[EFFORTS.indexOf(b.effort) - 1] ?? null : null);
  if (lower != null && !EFFORTS.includes(lower)) throw bad(`lowerEffort must be one of ${EFFORTS.join(', ')} or false`);
  const findings = [], refName = `${b.name}-${lower}`;
  if (!lower || lower === b.effort) {
    if (cfg.lowerEffort !== false) findings.push(finding('EP-BENCH-NO-REFERENCE', 'info',
      `no lower-effort reference arm: give the baseline ${baseline} an effort above low, or set "lowerEffort" in arms.json`));
  } else if (!arms.some((a) => a.name === refName)) arms.push({ ...b, name: refName, effort: lower, reference: 'lower-effort' });
  return { arms, baseline, findings };
}

// Minimum detectable cost change: from a pilot's per-task log cost ratios when one exists, else the rough guide in 09.
function mde(c, arms, baseline, n) {
  const other = arms.find((a) => a.name !== baseline)?.name, byTask = new Map();
  for (const r of c.store.rows('results.jsonl'))
    if (r.status === 'graded' && r.costUsd > 0 && (r.arm === baseline || r.arm === other)) {
      const t = byTask.get(r.task) ?? { a: [], b: [] };
      (r.arm === baseline ? t.a : t.b).push(r.costUsd);
      byTask.set(r.task, t);
    }
  const diffs = [...byTask.values()].filter((t) => t.a.length && t.b.length).map((t) => Math.log(mean(t.b) / mean(t.a)));
  if (diffs.length >= 3) {
    const sd = stdev(diffs);
    return { source: `pilot variance over ${diffs.length} tasks`, sd, mdePercent: Math.round(100 * (1 - Math.exp(-2.8 * sd / Math.sqrt(n)))),
      tasksFor10Percent: Math.ceil((2.8 * sd / LOG_10_PERCENT) ** 2) };
  }
  return { source: 'rough guide from v7-sized pilots, a calculation rather than a measurement', mdePercent: [25, 35].map((p) => Math.min(100, Math.round(p * Math.sqrt(8 / n)))) };
}

export function buildPlan(c, k, capUsd) {
  const tasks = loadTasks(c).filter((t) => t.valid && t.tag !== 'tuning');
  if (!tasks.length) throw fail('EP-BENCH-NO-TASKS', 'no validated held-out tasks: run bench tasks and bench validate first');
  const unreviewed = tasks.filter((t) => t.promptNeedsReview).map((t) => t.id);
  if (unreviewed.length) throw fail('EP-BENCH-PROMPT-REVIEW', `the prompt of task ${unreviewed.join(', ')} was redacted or is thin and hasn't been reviewed: read it in ${c.store.p('tasks.jsonl')}, rewrite it as the request you would make, then set "promptNeedsReview" to false on that line`, 2);
  const cfg = c.store.json('arms.json');
  if (!Array.isArray(cfg?.arms) || !cfg.arms.length) throw fail('EP-BENCH-NO-ARMS', `write the arms to ${c.store.p('arms.json')} first (see bench help)`, 2);
  const { arms, baseline, findings } = resolveArms(c, cfg);
  const arg = { code: 'EP-BENCH-ARMS' };
  const caps = { maxTurns: num(cfg.maxTurns, 'maxTurns', { ...arg, int: true, min: 1, max: 500 }) ?? 40,
    budgetUsd: capUsd ?? num(cfg.budgetUsd, 'budgetUsd', { ...arg, min: 0.01, max: 100 }) ?? 2,
    timeoutMin: num(cfg.timeoutMin, 'timeoutMin', { ...arg, int: true, min: 1, max: 600 }) ?? 30 };
  const allowedTools = [].concat(cfg.allowedTools ?? TOOLS).map(String), permissionMode = cfg.permissionMode ?? 'acceptEdits';
  const badTool = allowedTools.find((t) => !TOOL.test(t));
  if (badTool != null) throw armsError(`allowedTools holds ${JSON.stringify(badTool).slice(0, 60)}: a tool is a name such as Read or Bash(npm test:*), never a flag`);
  if (!MODES.includes(permissionMode)) throw armsError(`permissionMode must be one of ${MODES.join(', ')}`);
  const body = { armsFile: hash32(cfg), baseline, arms, k, caps, permissionMode, allowedTools, mcpConfig: cfg.mcpConfig ?? { mcpServers: {} },
    decision: { deltaPoints: num(cfg.deltaPoints, 'deltaPoints', { ...arg, min: 0, max: 50 }) ?? 5, resamples: 10000, minTasks: 8, interval: 0.95 },
    inputs: tasks.map(({ id, base, reference, prompt, accept, prepare, acceptanceFiles, refLines }) => ({ id, base, reference, prompt, accept, prepare, acceptanceFiles, refLines })) };
  // Balanced interleaving: the arm order flips per repetition and per task, so drift over time falls on every arm alike.
  const order = [];
  tasks.forEach((t, ti) => {
    for (let rep = 1; rep <= k; rep++) for (const a of (ti + rep) % 2 ? arms : [...arms].reverse()) order.push({ task: t.id, arm: a.name, rep, seq: order.length + 1 });
  });
  const { inputs, ...rest } = body;
  const plan = { hash: hash32(body), ...rest, tasks: tasks.map((t) => t.id), order, maxSpendUsd: +(order.length * caps.budgetUsd).toFixed(2),
    mde: mde(c, arms, baseline, tasks.length) };
  return { plan, findings };
}

async function planCmd(c, o) {
  const k = num(o.k, '--k', { int: true, min: 1, max: 10 }) ?? 2, cap = num(o['cap-usd'], '--cap-usd', { min: 0.01, max: 100 });
  const { plan, findings } = buildPlan(c, k, cap), m = plan.mde;
  c.store.save('plan.json', { ...plan, created: c.now().toISOString() });
  const mdeText = m.tasksFor10Percent != null ? `${m.mdePercent}% (${m.source}; about ${m.tasksFor10Percent} tasks would detect a 10% change)`
    : `${m.mdePercent.join(' to ')}% (${m.source})`;
  findings.push(finding('EP-BENCH-PLAN-CONFIRM', 'info', `${plan.order.length} runs: ${plan.tasks.length} tasks × ${plan.arms.length} arms × k = ${k}. Maximum spend $${plan.maxSpendUsd.toFixed(2)} (API-price estimate at the $${plan.caps.budgetUsd} per-run cap). Smallest cost change this size can detect: about ${mdeText}. Confirm both with the user, then run: bench run --plan ${plan.hash}`));
  if (plan.tasks.length < 8) findings.push(finding('EP-BENCH-FEW-TASKS', 'warn', `${plan.tasks.length} tasks: the report will show per-task results and the sign count only, since no interval is reliable below 8 tasks`));
  return { data: { plan: plan.hash, file: c.store.p('plan.json'), runs: plan.order.length, maxSpendUsd: plan.maxSpendUsd, mde: m,
    arms: plan.arms.map(({ name, reference, model, effort }) => ({ name, reference, model, effort })), caps: plan.caps }, findings };
}

// plan.json is a file on disk: the numbers that size a loop or a bootstrap are range-checked before run or report uses them.
const within = (x, min, max, int = false) => Number.isFinite(x) && x >= min && x <= max && (!int || Number.isInteger(x));
function checkPlan(p) {
  const d = p?.decision, caps = p?.caps;
  const bad = [['k', within(p?.k, 1, 10, true)], ['caps.maxTurns', within(caps?.maxTurns, 1, 500, true)], ['caps.budgetUsd', within(caps?.budgetUsd, 0.01, 100)],
    ['caps.timeoutMin', within(caps?.timeoutMin, 1, 600, true)], ['decision.resamples', within(d?.resamples, 100, 100000, true)],
    ['decision.minTasks', within(d?.minTasks, 1, 1000, true)], ['decision.deltaPoints', within(d?.deltaPoints, 0, 50)], ['decision.interval', within(d?.interval, 0.5, 0.999)],
    ['hash', /^[0-9a-f]{32}$/.test(p?.hash)], ['order', Array.isArray(p?.order)], ['arms', Array.isArray(p?.arms)], ['tasks', Array.isArray(p?.tasks)]]
    .filter(([, ok]) => !ok).map(([name]) => name);
  if (bad.length) throw fail('EP-BENCH-PLAN-INVALID', `plan.json has missing or out-of-range values (${bad.join(', ')}): run bench plan again`, 3);
}

async function runCmd(c, o) {
  guards(c, o);
  if (!o.plan) throw fail('EP-BENCH-USAGE', 'bench run needs --plan <hash>, from bench plan', 2);
  const saved = c.store.json('plan.json');
  if (saved?.hash !== o.plan) throw fail('EP-BENCH-PLAN-UNKNOWN', `the current plan is ${saved?.hash ?? 'missing'}, not ${o.plan}: run bench plan and confirm the plan it prints`, 3);
  checkPlan(saved);
  // The runs use the plan rebuilt from tasks.jsonl and arms.json; plan.json only names what the user confirmed.
  const { plan } = buildPlan(c, saved.k, saved.caps.budgetUsd);
  if (plan.hash !== saved.hash)
    throw fail('EP-BENCH-PLAN-STALE', 'tasks, arms.json or an arm\'s files changed since this plan was made: run bench plan again and confirm the new plan', 3);
  return runPlan(c, plan, o);
}

async function reportCmd(c, o) {
  const plan = c.store.json('plan.json');
  if (!plan) throw fail('EP-BENCH-NO-PLAN', 'no plan yet: run bench plan first');
  if (o.plan && o.plan !== plan.hash) throw fail('EP-BENCH-PLAN-UNKNOWN', `plan.json holds plan ${plan.hash}, not ${o.plan}`, 2);
  checkPlan(plan);
  return report(plan, c.store.rows('results.jsonl'), loadPrices());
}

const SUBS = {
  tasks: (c, o) => {
    if (!o.accept?.trim()) throw fail('EP-BENCH-USAGE', 'bench tasks needs --accept "<command that runs the tests>"', 2);
    return mineTasks(c, { accept: o.accept.trim(), prepare: o.prepare?.trim() || null,
      limit: num(o.limit, '--limit', { int: true, min: 1, max: 200 }), tuning: num(o.tuning, '--tuning', { int: true, min: 0, max: 200 }) });
  },
  validate: (c, o) => { refuseNested(c, 'validate'); return validateTasks(c, { task: o.task }); },
  plan: planCmd,
  run: runCmd,
  report: reportCmd,
};

export async function bench(argv, ctx) {
  const [sub, ...rest] = argv ?? [];
  const usage = (message) => ({ data: { help: HELP }, findings: [finding('EP-BENCH-USAGE', 'error', message)], exitCode: 2 });
  if (sub === 'help' || sub === '--help' || sub === '-h') return { data: { help: HELP }, findings: [], exitCode: 0 };
  if (!SUBS[sub]) return usage(sub ? `unknown bench subcommand ${sub}` : 'bench needs a subcommand: tasks, validate, plan, run or report');
  let o, c;
  try {
    o = parseArgs({ args: rest, options: OPTIONS[sub], strict: true, allowPositionals: false }).values;
  } catch (e) {
    return usage(e.message);
  }
  try {
    c = context(ctx, o);
    const res = await SUBS[sub](c, o);
    return { data: { benchDir: c.dir, ...res.data }, findings: res.findings,
      exitCode: res.exitCode ?? (res.findings.some((f) => f.severity !== 'info') ? 1 : 0) };
  } catch (e) {
    const code = String(e.code ?? '').startsWith('EP-') ? e.code : 'EP-BENCH-ERROR';
    return { data: { benchDir: c?.dir ?? null, ...(e.exitCode === 2 ? { help: HELP } : {}) }, findings: [finding(code, 'error', e.message)], exitCode: e.exitCode ?? 1 };
  }
}
