// Bench v2 statistics and pricing on synthetic results with known effects (M-2, M-3, M-6, M-10).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootstrap, canonModel, compare, loadPrices, priceRun, report, select } from '../engine/bench/stats.mjs';

const prices = loadPrices();
const DECISION = { deltaPoints: 5, resamples: 10000, minTasks: 8, interval: 0.95 };
const size = (t, rep) => 0.5 + t * 0.37 + rep * 0.01; // tasks of very different sizes
const id = (t) => `t${String(t).padStart(2, '0')}`;
function runs(arm, n, cost, pass = () => true, k = 2) {
  return Array.from({ length: n * k }, (_, i) => {
    const t = Math.floor(i / k), rep = (i % k) + 1;
    return { task: id(t), arm, rep, cost: cost(t, rep), pass: pass(t, rep) };
  });
}
const pair = (n, b, passB) => [...runs('a', n, size), ...runs('b', n, b, passB)];

test('a 30% cheaper arm with equal passes wins', () => {
  const r = compare(pair(12, (t, rep) => size(t, rep) * (0.7 + 0.02 * ((t % 3) - 1))), 'a', 'b', DECISION, 7, true);
  assert.equal(r.outcome, 'wins');
  assert.ok(r.costInterval[1] < 1 && r.passInterval[0] > -5);
  assert.ok(Math.abs(r.geomean - 0.7) < 0.02);
  assert.equal(r.cheaper, 12);
  assert.equal(r.passDiffPoints, 0);
});

test('a 40% dearer arm loses, and so does a cheaper arm that fails half the tasks', () => {
  assert.equal(compare(pair(12, (t, rep) => size(t, rep) * 1.4), 'a', 'b', DECISION, 7, true).outcome, 'loses');
  const r = compare(pair(12, (t, rep) => size(t, rep) * 0.7, (t) => t % 2 === 0), 'a', 'b', DECISION, 7, true);
  assert.equal(r.outcome, 'loses');
  assert.ok(r.passInterval[1] < -5);
});

test('an arm that is cheaper on some tasks and dearer on others is inconclusive', () => {
  const r = compare(pair(12, (t, rep) => size(t, rep) * (t % 2 ? 0.8 : 1.25)), 'a', 'b', DECISION, 7, true);
  assert.equal(r.outcome, 'inconclusive');
  assert.ok(r.costInterval[0] < 1 && r.costInterval[1] > 1);
});

test('below 8 tasks there are no intervals, only per-task results and the sign count', () => {
  const r = compare(pair(5, (t, rep) => size(t, rep) * 0.7), 'a', 'b', DECISION, 7, true);
  assert.equal(r.outcome, 'inconclusive');
  assert.equal(r.costInterval, null);
  assert.deepEqual([r.geomean, r.median, r.passDiffPoints], [null, null, null]);
  assert.equal(r.cheaper, 5);
  assert.equal(r.perTask.length, 5);
  assert.match(r.note, /no interval is reliable/);
});

test('the bootstrap is reproducible for a seed', () => {
  const items = Array.from({ length: 20 }, (_, i) => Math.sqrt(i * 7.31) + Math.sin(i));
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const one = bootstrap(items, [mean], { resamples: 10000, seed: 42 });
  assert.deepEqual(bootstrap(items, [mean], { resamples: 10000, seed: 42 }), one);
  assert.notDeepEqual(bootstrap(items, [mean], { resamples: 10000, seed: 43 }), one);
  assert.ok(one[0][0] < mean(items) && mean(items) < one[0][1]);
});

test('failed runs keep their cost in the per-task ratio', () => {
  const rs = [{ task: 't', arm: 'a', rep: 1, cost: 1, pass: true }, { task: 't', arm: 'a', rep: 2, cost: 3, pass: false },
    { task: 't', arm: 'b', rep: 1, cost: 1, pass: true }, { task: 't', arm: 'b', rep: 2, cost: 1, pass: true }];
  assert.equal(compare(rs, 'a', 'b', DECISION, 1, true).perTask[0].ratio, 0.5);
});

test('prices are dated, have every multiplier, and model ids are matched without suffixes', () => {
  assert.match(prices.asOf, /^\d{4}-\d{2}-\d{2}$/);
  for (const [m, p] of Object.entries(prices.models)) {
    assert.ok(['Verified', 'Unknown'].includes(p.status), m);
    if (p.status === 'Verified') for (const f of ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h']) assert.equal(typeof p[f], 'number', `${m} ${f}`);
  }
  assert.equal(prices.models['claude-fable-5-1'].cacheRead, 0.025);
  assert.equal(prices.models['claude-opus-5-5'].cacheRead, 0.05);
  assert.equal(prices.models['claude-sonnet-4-6'].cacheWrite1h, 2);
  for (const m of ['claude-sonnet-4-6', 'claude-sonnet-4-6[1m]', 'claude-sonnet-4-6-20260101', 'us.anthropic.claude-sonnet-4-6-v1:0', 'claude-sonnet-4-6@20260101'])
    assert.equal(canonModel(m), 'claude-sonnet-4-6', m);
});

test('pricing: hand-computed cost, an unknown model is an error, an Unknown price leaves tokens unpriced', () => {
  const M = 1e6, all = { input: M, output: M, cacheRead: M, write5m: M, write1h: M };
  const r = priceRun(prices, { 'claude-sonnet-4-6': all, 'claude-haiku-4-5': { ...all, output: 0, cacheRead: 0, write5m: 0, write1h: 0 } });
  assert.ok(Math.abs(r.usd - (3 + 15 + 0.3 + 3.75 + 6 + 1)) < 1e-9);
  assert.deepEqual(priceRun(prices, { 'claude-imaginary-9': all }), { usd: null, unknown: ['claude-imaginary-9'], unpriced: [] });
  assert.deepEqual(priceRun(prices, { 'claude-opus-4-7': all }), { usd: null, unknown: [], unpriced: ['claude-opus-4-7'] });
  assert.equal(priceRun(prices, { 'claude-imaginary-9': { input: 0, output: 0, cacheRead: 0, write5m: 0, write1h: 0 } }).usd, 0);
});

// Results rows as bench run writes them, priced through output tokens of claude-sonnet-4-6 ($15 per million).
const PLAN = { hash: 'abc123def456', baseline: 'a', k: 2, order: [], decision: DECISION, mde: { source: 'rough guide', mdePercent: [25, 35] },
  arms: [{ name: 'a', reference: null }, { name: 'b', reference: null }] };
const row = (r, over = {}) => ({ plan: PLAN.hash, task: r.task, arm: r.arm, rep: r.rep, status: 'graded', pass: r.pass,
  delivery: { ok: true, problems: [] }, fingerprint: { hash: `fp-${r.arm}`, base: 'shared' }, usageMissing: false, linesChanged: 4,
  tokens: { input: 0, output: r.cost * 1e6 / 15, cacheRead: 0, write5m: 0, write1h: 0 },
  byModel: { 'claude-sonnet-4-6': { input: 0, output: r.cost * 1e6 / 15, cacheRead: 0, write5m: 0, write1h: 0 } },
  flags: { outsideWrites: [], network: [], deletedTests: [] }, ...over });
const planFor = (n) => ({ ...PLAN, tasks: Array.from({ length: n }, (_, t) => id(t)) });

test('the report labels cost, applies the decision rule and never says significant', () => {
  const rows = pair(10, (t, rep) => size(t, rep) * 0.7).map((r) => row(r));
  const { data, findings } = report(planFor(10), rows, prices);
  assert.match(data.text, /API-price estimate/);
  assert.match(data.text, /## b vs a: wins/);
  assert.doesNotMatch(data.text, /signific/i);
  assert.match(data.text, /Validity threats/);
  assert.equal(data.comparisons[0].outcome, 'wins');
  assert.equal(data.arms.find((a) => a.arm === 'b').passK, 1);
  assert.deepEqual(findings.filter((f) => f.severity !== 'info'), []);
});

test('fingerprint mismatch: runs of one arm with a different fingerprint are not pooled (M-3)', () => {
  const rows = pair(4, (t, rep) => size(t, rep) * 0.7).map((r) => row(r));
  rows[0] = { ...rows[0], fingerprint: { hash: 'fp-a-other', base: 'shared' } };
  const sel = select(rows, PLAN.hash);
  assert.equal(sel.runs.length, 15);
  assert.deepEqual(sel.notPooled.map((r) => [r.arm, r.task, r.rep]), [['a', 't00', 1]]);
  const { data, findings } = report(planFor(4), rows, prices);
  assert.ok(findings.some((f) => f.code === 'EP-BENCH-NOT-POOLED' && f.severity === 'warn' && /\ba\b/.test(f.message)));
  assert.equal(data.excluded.notPooled, 1);
  assert.match(data.text, /no interval is reliable/);
});

test('missing, undelivered and unpriced runs are reported, never counted as failures', () => {
  const base = pair(3, (t, rep) => size(t, rep) * 0.7).map((r) => row(r));
  const rows = [...base.slice(1), { ...base[0], status: 'missing', pass: null, reason: 'usage limit' },
    row({ task: 't00', arm: 'b', rep: 3, cost: 1, pass: false }, { delivery: { ok: false, problems: ['plugin x isn\'t loaded'] } }),
    row({ task: 't01', arm: 'b', rep: 3, cost: 1, pass: false }, { byModel: { 'claude-opus-4-7': { input: 5, output: 5, cacheRead: 0, write5m: 0, write1h: 0 } } })];
  const { data, findings } = report(planFor(3), rows, prices);
  const codes = findings.map((f) => f.code);
  assert.ok(codes.includes('EP-BENCH-MISSING') && codes.includes('EP-BENCH-NOT-DELIVERED') && codes.includes('EP-BENCH-UNPRICED'));
  assert.equal(data.missing, 1);
  assert.equal(data.arms.find((a) => a.arm === 'a').runs, 5);
  assert.equal(data.comparisons[0].geomean, null, 'no cost ratio while a model of the arm has no price');
  const unknown = report(planFor(3), [...base, row({ task: 't02', arm: 'b', rep: 3, cost: 1, pass: true }, { byModel: { 'claude-imaginary-9': { input: 1, output: 1, cacheRead: 0, write5m: 0, write1h: 0 } } })], prices);
  assert.ok(unknown.findings.some((f) => f.code === 'EP-BENCH-PRICE-UNKNOWN-MODEL' && f.severity === 'error'));
});

test('a run that was started and never finished is missing data until a later row for its slot replaces it', () => {
  const base = pair(3, (t, rep) => size(t, rep) * 0.7).map((r) => row(r));
  const started = (r) => ({ plan: PLAN.hash, task: r.task, arm: r.arm, rep: r.rep, status: 'started' });
  const lost = report(planFor(3), [...base.slice(1), started(base[0])], prices);
  assert.equal(lost.data.missing, 1);
  assert.ok(lost.findings.some((f) => f.code === 'EP-BENCH-MISSING' && /interrupted bench/.test(f.message)));
  const done = report(planFor(3), [started(base[0]), ...base], prices);
  assert.deepEqual([done.data.missing, done.data.graded], [0, 12]);
});

test('cost per accepted task counts failed attempts', () => {
  const rows = [row({ task: 't00', arm: 'a', rep: 1, cost: 1, pass: true }), row({ task: 't00', arm: 'a', rep: 2, cost: 3, pass: false }),
    row({ task: 't00', arm: 'b', rep: 1, cost: 1, pass: false }), row({ task: 't00', arm: 'b', rep: 2, cost: 1, pass: false })];
  const { data } = report(planFor(1), rows, prices);
  const a = data.arms.find((x) => x.arm === 'a'), b = data.arms.find((x) => x.arm === 'b');
  assert.ok(Math.abs(a.costPerAccepted - 4) < 1e-9);
  assert.equal(b.costPerAccepted, Infinity);
  assert.match(data.text, /none accepted/);
});
