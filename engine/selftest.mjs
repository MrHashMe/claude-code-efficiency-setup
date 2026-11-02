// selftest: install, re-plan, verify, uninstall and rollback in a temp folder, with no network and no
// agent CLI. Uninstall must give back the config folder byte for byte.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { apply, rollback } from './apply.mjs';
import { buildPlan, savePlan } from './plan.mjs';
import { canonical, finding, slash } from './util.mjs';
import { verify } from './verify.mjs';

const BOM = '\uFEFF';

// Every file under dir as raw bytes, so a changed BOM or line ending counts as a difference.
export function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[slash(relative(dir, p))] = readFileSync(p).toString('base64');
    }
  };
  walk(dir);
  return canonical(out);
}

export function selftest(ctx) {
  const tmp = mkdtempSync(join(tmpdir(), 'ep-selftest-'));
  const home = join(tmp, 'home');
  const cfg = join(home, '.claude');
  mkdirSync(cfg, { recursive: true });
  writeFileSync(join(cfg, 'settings.json'), `${BOM}{\r\n  "model": "opus"\r\n}\r\n`);
  // Windows spells it Path; drop every spelling so the empty PATH below is the only one. The machine's
  // managed policy and the folders above the temp folder stay out of the run.
  const env = Object.fromEntries(Object.entries(ctx.env).filter(([k]) => k.toUpperCase() !== 'PATH' && !k.startsWith('EP_') && !k.startsWith('GIT_')));
  const isolated = { HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: cfg, EP_STATE_DIR: join(tmp, 'state'), EP_AGENT_CLI: 'none', EP_MANAGED_SETTINGS: '', GIT_CEILING_DIRECTORIES: dirname(tmp), PATH: '' };
  const c = { ...ctx, cwd: tmp, env: { ...env, ...isolated } };
  const checks = [];
  const check = (name, ok) => checks.push({ name, ok: Boolean(ok) });
  const planAndApply = (inputs, approve) => {
    const plan = buildPlan(c, inputs);
    savePlan(c, plan);
    return apply(c, { scope: 'user', plan: plan.hash.slice(7, 19), approve });
  };
  const install = { scope: 'user', profile: 'default', with: ['autocompact', 'nudge'], without: [], answers: {}, mode: 'install' };
  try {
    const before = snapshot(cfg);
    const done = planAndApply(install, 'default');
    const settings = readFileSync(join(cfg, 'settings.json'), 'utf8');
    check('install applies every default row', done.data.results.length && done.data.results.every((r) => r.status === 'done'));
    check('settings keep their BOM and CRLF line endings', settings.startsWith(BOM) && settings.includes('"autoCompactWindow": 300000,\r\n'));
    check('a second plan has no rows', buildPlan(c, install).rows.length === 0);
    check('verify finds no problems', verify(c, { scope: 'user' }).findings.every((x) => x.severity === 'info'));
    const installed = snapshot(cfg);
    planAndApply({ ...install, with: [], mode: 'uninstall' }, 'all');
    check('uninstall gives back the config folder byte for byte', snapshot(cfg) === before);
    rollback(c, { scope: 'user', last: true });
    check('rolling back the uninstall brings the install back', snapshot(cfg) === installed);
  } catch (e) {
    check(`runs without error (${e.code ?? 'error'}: ${e.message})`, false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { data: { checks }, findings: checks.filter((x) => !x.ok).map((x) => finding('error', 'EP-SELFTEST', `failed: ${x.name}`)) };
}
