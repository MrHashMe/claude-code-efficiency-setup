// Registry: load components, validate them against the schema subset the schema uses, enforce the
// ledger's admission rules, render docs/decisions.md.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson } from './util.mjs';

export function validate(schema, v, at = '$', errs = []) {
  const t = Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v;
  if (schema.enum && !schema.enum.includes(v)) errs.push(`${at}: must be one of ${schema.enum.join(', ')}`);
  if (schema.type && schema.type !== t && !(schema.type === 'number' && t === 'integer')) {
    errs.push(`${at}: expected ${schema.type}`);
    return errs;
  }
  if (t === 'string') {
    if (schema.minLength != null && v.length < schema.minLength) errs.push(`${at}: shorter than ${schema.minLength}`);
    if (schema.maxLength != null && v.length > schema.maxLength) errs.push(`${at}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(v)) errs.push(`${at}: doesn't match ${schema.pattern}`);
  }
  if ((t === 'integer' || t === 'number') && schema.minimum != null && v < schema.minimum) errs.push(`${at}: below ${schema.minimum}`);
  if (t === 'array') {
    if (schema.minItems != null && v.length < schema.minItems) errs.push(`${at}: fewer than ${schema.minItems} items`);
    if (schema.items) v.forEach((x, k) => validate(schema.items, x, `${at}[${k}]`, errs));
  }
  if (t === 'object') {
    for (const k of schema.required ?? []) if (!(k in v)) errs.push(`${at}: missing ${k}`);
    for (const [k, x] of Object.entries(v)) {
      if (schema.properties?.[k]) validate(schema.properties[k], x, `${at}.${k}`, errs);
      else if (schema.additionalProperties === false) errs.push(`${at}: unknown field ${k}`);
    }
  }
  return errs;
}

// The ledger's admission rules (03 section 2), checked on every entry.
export function policy(c) {
  const e = [];
  const claude = c.agents.claude;
  if (c.verdict === 'Adopt') {
    if (!c.evidence.some((x) => x.qualityMeasured)) e.push('Adopt needs evidence that measured quality');
    if (c.requestPath !== 'none') e.push('Adopt needs requestPath "none"');
    if (c.egress.default !== 'none' && !c.roles.includes('docs-lookup')) e.push('Adopt needs no default egress');
  }
  if (c.verdict === 'Trial' && !c.killTest) e.push('every Trial needs a kill test');
  if (c.defaultOn && !['Adopt', 'Trial'].includes(c.verdict)) e.push('only Adopt and Trial entries can be on by default');
  if (c.defaultOn && c.verdict === 'Trial') {
    const ok = ['owned', 'first-party'].includes(c.origin) && c.egress.default === 'none' && c.requestPath === 'none' && c.reversible && c.killTest?.scheduled;
    if (!ok) e.push('a default-on Trial must be owned or first-party, with no egress or request-path change, reversible, with its kill test scheduled');
  }
  const personal = c.runsHooks || c.userStateOutsideScope || claude?.needsEnv || claude?.install?.some((i) => i.bin);
  if (personal && claude?.scopes.includes('project')) e.push('components that run hooks, keep per-user state, need env entries or a machine tool never go at project scope');
  if (['Assess', 'Hold', 'Reject'].includes(c.verdict) && claude?.scopes.length) e.push(`${c.verdict} entries are never installed, so they get no scopes`);
  return e.map((m) => `${c.id}: ${m}`);
}

export function loadRegistry(root) {
  const schema = readJson(join(root, 'registry', 'component.schema.json'));
  const dir = join(root, 'registry', 'components');
  const components = [];
  const errors = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    let c;
    try {
      c = readJson(join(dir, file));
    } catch (e) {
      errors.push(`${file}: ${e.message}`);
      continue;
    }
    const schemaErrors = validate(schema, c, file);
    errors.push(...schemaErrors);
    if (c.id !== file.slice(0, -5)) errors.push(`${file}: id must match the file name`);
    if (!schemaErrors.length) errors.push(...policy(c));
    components.push(c);
  }
  return { components, byId: new Map(components.map((c) => [c.id, c])), errors };
}

const ageDays = (date, now) => Math.floor((now - new Date(date + 'T00:00:00Z')) / 86400000);
export const staleEntries = (components, now) => components.filter((c) => ageDays(c.verdictDate, now) > c.freshnessDays);

const ORDER = ['Adopt', 'Trial', 'Assess', 'Hold', 'Reject'];
const cell = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

export function renderDecisions(components) {
  const out = [
    '# Decisions',
    '',
    'Generated from `registry/components/*.json` by `node engine/ep.mjs evidence render`; edit the registry, not this file.',
    'Verdicts follow the admission rules in [docs/v8/03-admission-ledger.md](v8/03-admission-ledger.md). Tokens are estimates (bytes / 3.5).',
  ];
  for (const verdict of ORDER) {
    const rows = components.filter((c) => c.verdict === verdict).sort((a, b) => a.id.localeCompare(b.id));
    if (!rows.length) continue;
    out.push('', `## ${verdict}`, '', '| Component | On by default | Always-loaded tokens | Evidence | Kill test | Revisit when |', '| --- | --- | --- | --- | --- | --- |');
    for (const c of rows) {
      const ev = c.evidence.map((x) => `${x.tier} ${x.measuredBy}${x.qualityMeasured ? ', quality measured' : ''} (${x.status})`).join('; ') || 'none';
      out.push(`| ${cell(c.name)} (\`${c.id}\`) | ${c.defaultOn ? 'yes' : 'no'} | ${c.alwaysLoaded.perSessionTokens} | ${cell(ev)} | ${c.killTest?.id ?? '-'} | ${cell(c.revisit.join('; ')) || '-'} |`);
    }
  }
  return out.join('\n') + '\n';
}
