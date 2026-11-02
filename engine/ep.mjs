#!/usr/bin/env node
// Efficiency Playbook engine CLI (06 section 2): strict flags, one JSON envelope with --json, exit codes
// 0 ok, 1 findings or failed checks, 2 usage, 3 blocked, 4 stale plan. Node 22+, no dependencies.
import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply, rollback } from './apply.mjs';
import { inspect, installs } from './inspect.mjs';
import { buildPlan, savePlan } from './plan.mjs';
import { loadRegistry, renderDecisions, staleEntries } from './registry.mjs';
import { stateRoot } from './scopes.mjs';
import { selftest } from './selftest.mjs';
import { ENGINE, atomicWrite, displayPath, fail, finding, normalize, printable, printableJson, readJson, readText, redact, samePath, slash } from './util.mjs';
import { show } from './show.mjs';
import { verify } from './verify.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BOOL = new Set(['json', 'deep', 'last', 'installs', 'write']);
const VALUE = new Set(['scope', 'profile', 'answers', 'plan', 'approve', 'to', 'agent']);
const LIST = new Set(['with', 'without']);
const LATER = { ci: 'v8.2', self: 'a later release', from: 'a later release' };
const USAGE = 'usage: ep <inspect|plan|uninstall|apply|verify|show|rollback|bench|evidence|selftest> [--scope user|project|local] [--json]';
const usage = (message) => fail('EP-USAGE', message, { exit: 2 });

export function parseArgs(args) {
  const o = { _: [], with: [], without: [] };
  for (let i = 0; i < args.length; i++) {
    const m = /^--([a-z]+)(?:=(.*))?$/s.exec(args[i]);
    if (!m) {
      o._.push(args[i]);
      continue;
    }
    const [, name, inline] = m;
    if (LATER[name]) throw usage(`--${name} arrives in ${LATER[name]}`);
    if (BOOL.has(name)) {
      if (inline !== undefined) throw usage(`--${name} takes no value`);
      o[name] = true;
      continue;
    }
    if (!VALUE.has(name) && !LIST.has(name)) throw usage(`unknown flag --${name}\n${USAGE}`);
    const v = inline ?? args[++i];
    if (v === undefined || (inline === undefined && v.startsWith('--'))) throw usage(`--${name} needs a value`);
    if (LIST.has(name)) o[name] = [...o[name], ...v.split(',').map((s) => s.trim()).filter(Boolean)];
    else o[name] = v;
  }
  return o;
}

function planInputs(ctx, o, mode) {
  if (o.agent && o.agent !== 'claude') throw usage('v8.0 plans for Claude Code only; the Codex adapter arrives in v8.1 (the v7.4 Codex skill still works)');
  const profile = o.profile ?? 'default';
  if (!['default', 'minimal'].includes(profile)) throw usage('--profile is default or minimal');
  let answers = {};
  if (o.answers) {
    try {
      answers = readJson(resolve(ctx.cwd, o.answers));
    } catch (e) {
      // N-7: a JSON parser's message quotes the file's text, which may hold a secret; say only that it failed.
      throw e.exit ? e : usage(`--answers ${o.answers}: ${e instanceof SyntaxError ? "isn't valid JSON" : e.message}`);
    }
    if (!answers || typeof answers !== 'object' || Array.isArray(answers) || Object.keys(answers).some((k) => k !== 'commandMap')) {
      throw usage('--answers takes a JSON file holding only {"commandMap":{"quick":["..."],"full":["..."]}}');
    }
  }
  return { scope: o.scope ?? 'user', profile, with: [...new Set(o.with)].sort(), without: [...new Set(o.without)].sort(), answers, mode };
}

function planData(ctx, plan) {
  const id = plan.hash.slice(7, 19);
  const { sc } = plan;
  return {
    plan: id,
    scope: sc.scope,
    rows: plan.rows,
    enabled: plan.enabled,
    recommended: plan.recommended,
    options: plan.options,
    alwaysLoadedTokens: plan.alwaysLoadedTokens,
    migration: plan.migration && displayPath(plan.migration, sc),
    ...(plan.satisfied.length ? { satisfied: plan.satisfied } : {}),
    next: plan.rows.length ? `node "${slash(ctx.root)}/engine/ep.mjs" apply --scope ${sc.scope} --plan ${id} --approve default` : null,
  };
}

function evidence(ctx, o) {
  const reg = loadRegistry(ctx.root);
  const file = join(ctx.root, 'docs', 'decisions.md');
  const [sub] = o._;
  if (sub === 'check') {
    const findings = reg.errors.map((m) => finding('error', 'EP-REGISTRY', m));
    for (const c of staleEntries(reg.components, ctx.now())) findings.push(finding('warn', 'EP-EVIDENCE-STALE', `${c.id}: verdict dated ${c.verdictDate} is past its ${c.freshnessDays}-day window`));
    if (!reg.errors.length && normalize(readText(file) ?? '') !== renderDecisions(reg.components)) {
      findings.push(finding('warn', 'EP-DECISIONS-STALE', 'docs/decisions.md differs from the registry; run evidence render --write'));
    }
    return { data: { components: reg.components.length }, findings };
  }
  if (sub === 'render') {
    if (reg.errors.length) throw fail('EP-REGISTRY', `registry errors:\n${reg.errors.join('\n')}`);
    const markdown = renderDecisions(reg.components);
    if (!o.write) return { data: { markdown }, findings: [] };
    atomicWrite(file, markdown);
    return { data: { written: 'docs/decisions.md' }, findings: [] };
  }
  if (sub === 'fresh') throw usage('evidence fresh (network, maintainer only) arrives in v8.2');
  throw usage('evidence takes check, render or fresh');
}

async function run(command, rest, ctx) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw fail('EP-NODE', `Node ${process.version} is too old; v8 needs Node 22 or later`, { exit: 3 });
  if (command === 'bench') {
    const { bench } = await import('./bench/index.mjs');
    const r = await bench(rest.filter((a) => a !== '--json'), { env: ctx.env, cwd: ctx.cwd, stateRoot: stateRoot(ctx.env), now: ctx.now });
    return { data: r.data, findings: r.findings ?? [], exit: r.exitCode };
  }
  const o = parseArgs(rest);
  if (o._.length && command !== 'evidence') throw usage(`unexpected argument "${o._[0]}"\n${USAGE}`);
  const scope = o.scope ?? 'user';
  switch (command) {
    case 'inspect':
      return inspect(ctx);
    case 'plan':
    case 'uninstall': {
      const plan = buildPlan(ctx, planInputs(ctx, o, command === 'plan' ? 'install' : 'uninstall'));
      savePlan(ctx, plan);
      return { data: planData(ctx, plan), findings: plan.findings };
    }
    case 'apply':
      if (!o.plan || !o.approve) throw usage('apply needs --plan <hash> and --approve <default|all|group:name|row ids>');
      return apply(ctx, { scope, plan: o.plan, approve: o.approve });
    case 'verify':
      return verify(ctx, { scope, deep: o.deep });
    case 'show': {
      if (!o.installs) return show(ctx, { scope });
      const findings = [];
      return { data: { installs: installs(ctx, findings) }, findings };
    }
    case 'rollback':
      return rollback(ctx, { scope, last: o.last, to: o.to });
    case 'evidence':
      return evidence(ctx, o);
    case 'selftest':
      return selftest(ctx);
    default:
      throw usage(USAGE);
  }
}

function human(data, findings) {
  const lines = [];
  if (Array.isArray(data?.rows)) {
    for (const r of data.rows) {
      const tokens = r.alwaysLoadedTokens ? ` (~${r.alwaysLoadedTokens} tokens)` : '';
      const why = r.reason ? ` [${r.reason}]` : '';
      lines.push(`${r.id} ${r.status.padEnd(9)} ${r.op.padEnd(7)} ${r.target}${r.pointer ? `#${r.pointer}` : ''}: ${r.before.summary} -> ${r.after.summary}${tokens}${why}`);
    }
    if (!data.rows.length) lines.push('nothing to change');
  } else if (Array.isArray(data?.checks)) {
    for (const c of data.checks) lines.push(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}`);
  } else if (typeof data?.markdown === 'string') {
    lines.push(data.markdown.trimEnd());
  } else if (data != null) {
    lines.push(JSON.stringify(data.git?.add ? { ...data, git: undefined } : data, null, 2));
  }
  // L-11: the user commits; the engine prints what changed and the paths to stage. (inspect's git is a sentence.)
  if (data?.git?.add) {
    const paths = data.git.add.map((p) => (/^[\w./-]+$/.test(p) ? p : JSON.stringify(p))).join(' ');
    lines.push('', 'changed by this apply, as git sees them:', ...data.git.status.map((l) => `  ${l}`), `to commit, stage them: git add -- ${paths}`);
  }
  for (const f of findings) lines.push(`${f.severity} ${f.code}: ${f.message}`);
  if (data?.next) lines.push('', `apply with: ${data.next}`);
  return lines.join('\n');
}

export async function main(argv, ctx) {
  const [command = 'help', ...rest] = argv;
  let data = null;
  let findings = [];
  let error = null;
  let exit = 0;
  try {
    const r = await run(command, rest, ctx);
    data = r.data ?? null;
    findings = r.findings ?? [];
    exit = r.exit ?? (findings.some((f) => f.severity !== 'info') ? 1 : 0);
  } catch (e) {
    error = { code: e.code ?? 'EP-INTERNAL', message: e.message };
    data = e.data ?? null;
    exit = e.exit ?? 1;
  }
  const envelope = { ok: exit === 0, command, engine: ENGINE, data, findings, error };
  // N-7: everything printed goes through redact; JSON leaf by leaf, so field names stay intact. S3: then control,
  // bidi and other invisible characters are escaped, so text from a repository can't reorder or hide what follows it.
  if (rest.includes('--json')) return { exit, out: printableJson(JSON.stringify(envelope, (_, v) => (typeof v === 'string' ? redact(v) : v), 2)) };
  return { exit, out: printable(redact([error && `error ${error.code}: ${error.message}`, human(data, findings)].filter(Boolean).join('\n'))) };
}

// Node runs the main module from its real path, so compare real paths: started through a link, it must still run.
const entry = process.argv[1] && existsSync(process.argv[1]) ? realpathSync(process.argv[1]) : null;
if (entry && samePath(entry, fileURLToPath(import.meta.url))) {
  const { exit, out } = await main(process.argv.slice(2), { root: ROOT, env: process.env, cwd: process.cwd(), now: () => new Date() });
  process.stdout.write(out + '\n');
  process.exitCode = exit;
}
