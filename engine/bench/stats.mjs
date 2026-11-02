// API-price estimates (M-6), the paired comparison with a cluster bootstrap and a fixed decision rule (M-2), and the report.
import fs from 'node:fs';
import { finding } from './io.mjs';

const PRICES = new URL('../../registry/prices.json', import.meta.url);
export const loadPrices = () => JSON.parse(fs.readFileSync(PRICES, 'utf8'));
export const FIELDS = ['input', 'output', 'cacheRead', 'write5m', 'write1h'];
export const totalTokens = (t) => FIELDS.reduce((s, f) => s + (t?.[f] || 0), 0);
export const canonModel = (m) => String(m ?? '').trim().replace(/^([a-z]+\.)?anthropic\./, '').replace(/\[[^\]]*\]$/, '')
  .replace(/(@\d{8}|-\d{8}|-v\d+(:\d+)?)$/, '');

// An unknown model id is an error and a model with status Unknown has no price: either way the run gets no estimate.
export function priceRun(table, byModel) {
  let usd = 0;
  const unknown = [], unpriced = [];
  for (const [m, t] of Object.entries(byModel ?? {})) {
    if (!totalTokens(t)) continue;
    const p = table.models[canonModel(m)];
    if (!p) unknown.push(m);
    else if (p.status === 'Unknown') unpriced.push(m);
    else usd += (t.input * p.input + t.output * p.output + p.input * (t.cacheRead * p.cacheRead + t.write5m * p.cacheWrite5m + t.write1h * p.cacheWrite1h)) / 1e6;
  }
  return { usd: unknown.length || unpriced.length ? null : usd, unknown, unpriced };
}

export const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
export const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b), m = s.length >> 1;
  return !s.length ? null : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const stdev = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1)); };
function rng(seed) { // mulberry32: small, seeded, so a report is reproducible
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const quantile = (s, p) => s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
// Cluster bootstrap: resample whole tasks (each item carries all of a task's runs), recompute each statistic, keep the 2.5th and 97.5th percentiles.
export function bootstrap(items, stats, { resamples = 10000, seed = 1 } = {}) {
  const next = rng(seed), n = items.length, draws = stats.map(() => []);
  for (let b = 0; b < resamples; b++) {
    const sample = Array.from({ length: n }, () => items[Math.floor(next() * n)]);
    stats.forEach((f, i) => { const v = f(sample); if (v != null && !Number.isNaN(v)) draws[i].push(v); });
  }
  return draws.map((d) => (d.length ? (d.sort((x, y) => x - y), [quantile(d, 0.025), quantile(d, 0.975)]) : null));
}

// Per task: mean API-price estimate per run (failed runs included) and pass rate, for both arms.
function perTask(runs, a, b) {
  const side = (task, arm) => {
    const rs = runs.filter((r) => r.task === task && r.arm === arm), costs = rs.map((r) => r.cost).filter((x) => x != null);
    return rs.length ? { pass: mean(rs.map((r) => (r.pass ? 1 : 0))), cost: mean(costs) } : null;
  };
  return [...new Set(runs.map((r) => r.task))].sort().flatMap((task) => {
    const A = side(task, a), B = side(task, b);
    return A && B ? [{ task, passA: A.pass, passB: B.pass, ratio: A.cost > 0 && B.cost != null ? B.cost / A.cost : null }] : [];
  });
}
const geomean = (ts) => { const r = ts.filter((t) => t.ratio > 0); return r.length ? Math.exp(mean(r.map((t) => Math.log(t.ratio)))) : null; };
const passDiff = (ts) => mean(ts.map((t) => t.passB - t.passA)) * 100;

export function compare(runs, a, b, decision, seed, costKnown) {
  const ts = perTask(runs, a, b), ratios = ts.map((t) => t.ratio).filter((x) => x != null);
  const res = { a, b, tasks: ts.length, perTask: ts, cheaper: costKnown ? ratios.filter((x) => x < 1).length : null,
    geomean: null, median: null, passDiffPoints: null, costInterval: null, passInterval: null, outcome: 'inconclusive', note: null };
  if (ts.length < decision.minTasks)
    return { ...res, note: `${ts.length} paired tasks: per-task results and the sign count only; no interval is reliable at this size` };
  const [costInterval, passInterval] = bootstrap(ts, [costKnown ? geomean : () => null, passDiff], { resamples: decision.resamples, seed });
  const d = decision.deltaPoints;
  const outcome = !costInterval || !passInterval ? 'inconclusive'
    : costInterval[0] > 1 || passInterval[1] < -d ? 'loses'
      : costInterval[1] < 1 && passInterval[0] > -d ? 'wins' : 'inconclusive';
  return { ...res, geomean: costKnown ? geomean(ts) : null, median: costKnown ? median(ratios) : null, passDiffPoints: passDiff(ts),
    costInterval, passInterval, outcome, note: costKnown ? null : 'a model in these runs has no price, so only pass rates are compared' };
}

// Latest graded row per run slot wins; a missing row counts only while its slot has no graded row.
// M-3: each arm keeps the fingerprint most of its runs share; runs with any other fingerprint are reported, never pooled.
export function select(rows, planHash) {
  const slots = new Map();
  for (const r of rows.filter((x) => x.plan === planHash)) {
    const key = `${r.task}|${r.arm}|${r.rep}`;
    if (r.status === 'graded' || slots.get(key)?.status !== 'graded') slots.set(key, r);
  }
  const all = [...slots.values()], delivered = all.filter((r) => r.status === 'graded' && r.delivery?.ok);
  const keep = new Map();
  for (const arm of new Set(delivered.map((r) => r.arm))) {
    const counts = new Map();
    for (const r of delivered.filter((x) => x.arm === arm)) counts.set(r.fingerprint.hash, (counts.get(r.fingerprint.hash) ?? 0) + 1);
    keep.set(arm, [...counts].sort((x, y) => y[1] - x[1])[0][0]);
  }
  return { runs: delivered.filter((r) => keep.get(r.arm) === r.fingerprint.hash), notPooled: delivered.filter((r) => keep.get(r.arm) !== r.fingerprint.hash),
    undelivered: all.filter((r) => r.status === 'graded' && !r.delivery?.ok), missing: all.filter((r) => r.status === 'missing' || r.status === 'started') }; // started: the bench ended before the result was recorded
}

function armSummary(runs, arm, plan, costKnown, seed) {
  const rs = runs.filter((r) => r.arm === arm.name), passed = rs.filter((r) => r.pass).length;
  const groups = plan.tasks.map((t) => rs.filter((r) => r.task === t)).filter((g) => g.length);
  const perAccepted = (gs) => {
    const f = gs.flat().filter((r) => r.cost != null), p = f.filter((r) => r.pass).length;
    return p ? f.reduce((s, r) => s + r.cost, 0) / p : Infinity;
  };
  const count = (k) => rs.filter((r) => r.flags?.[k]?.length).length;
  return { arm: arm.name, reference: arm.reference ?? null, runs: rs.length, passed, passRate: rs.length ? passed / rs.length : null,
    passK: groups.length ? groups.filter((g) => g.length >= plan.k && g.every((r) => r.pass)).length / groups.length : null,
    costPerAccepted: costKnown && rs.length ? perAccepted(groups) : null,
    costInterval: costKnown && groups.length >= plan.decision.minTasks ? bootstrap(groups, [perAccepted], { resamples: plan.decision.resamples, seed })[0] : null,
    medianTokens: median(rs.map((r) => totalTokens(r.tokens))), medianLines: median(rs.map((r) => r.linesChanged)),
    flags: { outsideWrites: count('outsideWrites'), network: count('network'), deletedTests: count('deletedTests') } };
}

const THREATS = [
  'Small task counts: most single-user benches end inconclusive for small effects, and inconclusive is not evidence of no effect.',
  'Tasks mined from one repository may not represent future work.',
  'Public repositories may be in the model\'s training data.',
  'Model updates between runs: fingerprints catch version changes, not silent server-side changes.',
  'Prompt-cache state and cache lifetimes vary; subagents and compaction use a shorter cache lifetime than the main conversation.',
  'Infrastructure noise: an A/A batch (the same arm planned twice under two names) measures it on this machine.',
  'Tests are a partial definition of quality; flags and diff size are descriptive only.',
  'Real requirements evolve after the first attempt, which this bench does not model.',
  'Public coding benchmarks have their own validity problems, which is one reason your own tasks are the test set.',
];
const usd = (x) => (x == null ? 'n/a' : x === Infinity ? '∞' : `$${x.toFixed(4)}`);
const ratio = (x) => (x == null ? 'n/a' : x.toFixed(2));
const pct = (x) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`);
const pts = (x) => (x == null ? 'n/a' : `${x > 0 ? '+' : ''}${x.toFixed(1)} points`);
const num = (x) => (x == null ? 'n/a' : Math.round(x).toLocaleString('en-US'));
const span = (iv, f) => (iv ? `[${f(iv[0])}, ${f(iv[1])}]` : 'n/a');

export function report(plan, rows, prices) {
  const sel = select(rows, plan.hash), unknown = new Set(), unpriced = new Set();
  // Re-priced from tokens with today's table, so a price correction reaches earlier runs too.
  const runs = sel.runs.map((r) => {
    const p = r.usageMissing ? { usd: null, unknown: [], unpriced: [] } : priceRun(prices, r.byModel);
    p.unknown.forEach((m) => unknown.add(m));
    p.unpriced.forEach((m) => unpriced.add(m));
    return { ...r, cost: p.usd, costBlocked: p.unknown.length + p.unpriced.length > 0 };
  });
  const costKnown = (name) => !runs.some((r) => r.arm === name && r.costBlocked);
  const seed = parseInt(plan.hash.slice(0, 8), 16), d = plan.decision;
  const arms = plan.arms.map((a) => armSummary(runs, a, plan, costKnown(a.name), seed));
  const finite = arms.filter((a) => a.passRate != null && a.costPerAccepted != null && a.costPerAccepted !== Infinity);
  for (const a of arms) a.pareto = finite.includes(a) && !finite.some((o) => o !== a && o.passRate >= a.passRate
    && o.costPerAccepted <= a.costPerAccepted && (o.passRate > a.passRate || o.costPerAccepted < a.costPerAccepted));
  // Every arm against the baseline; candidates also against each reference arm, since they must beat cheap alternatives too.
  const refs = plan.arms.filter((a) => a.reference).map((a) => a.name);
  const cands = plan.arms.filter((a) => !a.reference && a.name !== plan.baseline).map((a) => a.name);
  const pairs = [...plan.arms.filter((a) => a.name !== plan.baseline).map((a) => [plan.baseline, a.name]), ...refs.flatMap((r) => cands.map((c) => [r, c]))];
  const comps = pairs.map(([a, b]) => compare(runs, a, b, d, seed, costKnown(a) && costKnown(b)));

  const findings = [];
  if (unknown.size) findings.push(finding('EP-BENCH-PRICE-UNKNOWN-MODEL', 'error', `no price for ${[...unknown].join(', ')}: add it to registry/prices.json (an unknown model never gets a fallback price)`));
  if (unpriced.size) findings.push(finding('EP-BENCH-UNPRICED', 'info', `tokens without a price for ${[...unpriced].join(', ')} (status Unknown in registry/prices.json)`));
  for (const name of new Set(sel.notPooled.map((r) => r.arm)))
    findings.push(finding('EP-BENCH-NOT-POOLED', 'warn', `${sel.notPooled.filter((r) => r.arm === name).length} runs of ${name} ran with a different fingerprint (agent, model, settings, plugins or flags) and were not pooled`));
  const bases = new Set(sel.runs.map((r) => r.fingerprint.base));
  if (bases.size > 1) findings.push(finding('EP-BENCH-BASE-DIFFERS', 'warn', 'the arms ran on different shared configurations (agent version, user settings or content changed between them), so comparisons are confounded'));
  if (sel.undelivered.length) findings.push(finding('EP-BENCH-NOT-DELIVERED', 'warn', `${sel.undelivered.length} runs were excluded because their arm didn't take effect: ${[...new Set(sel.undelivered.flatMap((r) => r.delivery?.problems ?? []))].slice(0, 5).join('; ')}`));
  if (sel.missing.length) findings.push(finding('EP-BENCH-MISSING', 'info', `${sel.missing.length} runs are missing data (usage limits, an interrupted bench or infrastructure), not task failures`));
  const open = plan.order.length - sel.runs.length - sel.notPooled.length - sel.undelivered.length;
  if (open > 0) findings.push(finding('EP-BENCH-INCOMPLETE', 'info', `${open} planned runs have no graded result; bench run --plan ${plan.hash} resumes them`));
  if (!sel.runs.length) findings.push(finding('EP-BENCH-NO-RESULTS', 'warn', 'no graded runs for this plan yet'));

  const L = [`# Bench report, plan ${plan.hash}`, '',
    `${plan.tasks.length} held-out tasks, ${plan.arms.length} arms, k = ${plan.k}. Graded runs: ${sel.runs.length}. Missing (usage limits, an interrupted bench or infrastructure, not failures): ${sel.missing.length}. Excluded because the arm didn't take effect: ${sel.undelivered.length}. Not pooled because the fingerprint differs: ${sel.notPooled.length}.`,
    `Cost is an API-price estimate from registry/prices.json (prices as of ${prices.asOf}); subscription plan usage is not inferred.`, '',
    '| Arm | Passed | Pass^k | Cost per accepted task (API-price estimate) | 95% interval | Median tokens per run | Median lines changed | Flags (outside writes / network / deleted tests) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...arms.map((a) => `| ${a.arm}${a.reference ? ` (${a.reference} reference)` : ''}${a.pareto ? ' *' : ''} | ${a.passed}/${a.runs} | ${pct(a.passK)} | ${a.runs && !a.passed ? 'none accepted' : usd(a.costPerAccepted)} | ${span(a.costInterval, usd)} | ${num(a.medianTokens)} | ${num(a.medianLines)} | ${a.flags.outsideWrites} / ${a.flags.network} / ${a.flags.deletedTests} |`),
    '', '\\* not dominated on pass rate and cost per accepted task (Pareto view).', '',
    `Decision rule, fixed before the run: an arm wins only when the cost-ratio interval lies entirely below 1 and the pass-rate difference interval lies entirely above -${d.deltaPoints} points; it loses when the cost interval lies entirely above 1 or the pass interval entirely below -${d.deltaPoints} points; otherwise the result is inconclusive.`];
  for (const c of comps)
    L.push('', `## ${c.b} vs ${c.a}: ${c.outcome}`, c.tasks < d.minTasks
      ? `Per-task cost ratio (${c.b} over ${c.a}): cheaper on ${c.cheaper ?? 'n/a'} of ${c.tasks} tasks.`
      : `Per-task cost ratio (${c.b} over ${c.a}): geometric mean ${ratio(c.geomean)}, median ${ratio(c.median)}, cheaper on ${c.cheaper ?? 'n/a'} of ${c.tasks} tasks. Pass-rate difference ${pts(c.passDiffPoints)}.`,
      ...(c.costInterval || c.passInterval ? [`95% intervals (cluster bootstrap over tasks, ${d.resamples} resamples): cost ratio ${span(c.costInterval, ratio)}, pass-rate difference ${span(c.passInterval, pts)}.`] : []),
      ...(c.note ? [`${c.note[0].toUpperCase()}${c.note.slice(1)}.`] : []),
      '', `| Task | Cost ratio | Pass ${c.a} | Pass ${c.b} |`, '| --- | --- | --- | --- |',
      ...c.perTask.map((t) => `| ${t.task} | ${ratio(t.ratio)} | ${pct(t.passA)} | ${pct(t.passB)} |`));
  const mde = plan.mde?.mdePercent;
  L.push('', '## Validity threats', ...THREATS.map((t) => `- ${t}`),
    ...(mde != null ? [`- At this size the plan estimated a minimum detectable cost change of about ${[].concat(mde).join(' to ')}% (${plan.mde.source}).`] : []),
    ...(unpriced.size ? [`- Tokens without a price: ${[...unpriced].join(', ')}; cost comparisons involving them are inconclusive.`] : []));
  return { data: { plan: plan.hash, arms, comparisons: comps, graded: sel.runs.length, missing: sel.missing.length,
    excluded: { notDelivered: sel.undelivered.length, notPooled: sel.notPooled.length }, pricesAsOf: prices.asOf, text: L.join('\n') }, findings };
}
