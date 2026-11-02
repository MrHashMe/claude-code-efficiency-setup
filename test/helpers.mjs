// Test fixtures: each test gets its own home, config folder and state root in a temp folder, no agent CLI,
// and a PATH holding only a fake bin folder and git. Nothing outside the temp folder is read or written.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply } from '../engine/apply.mjs';
import { buildPlan, savePlan } from '../engine/plan.mjs';
import { WIN, run, which } from '../engine/util.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const NOW = new Date('2026-11-02T12:00:00Z');
const GIT = which('git', process.env);

export function sandbox(t, { settings, bins = [] } = {}) {
  // The real path, as git prints it: macOS's temp folder is a link into /private, and Windows runners
  // spell theirs in 8.3 form, so home and repository paths would otherwise disagree.
  const tmp = mkdtempSync(join(realpathSync.native(tmpdir()), 'ep-test-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const home = join(tmp, 'home');
  const cfg = join(home, '.claude');
  const bin = join(tmp, 'bin');
  mkdirSync(cfg, { recursive: true });
  mkdirSync(bin);
  for (const b of bins) writeFileSync(join(bin, WIN ? `${b}.exe` : b), '', { mode: 0o755 });
  // git alone, not its folder: on Linux and macOS that is /usr/bin, where a language server such as
  // clangd would make lsp plan a plugin. Windows keeps Git's cmd folder, which holds only git.
  if (GIT && !WIN) symlinkSync(GIT, join(bin, 'git'));
  if (settings !== undefined) writeFileSync(join(cfg, 'settings.json'), settings);
  // Windows spells it Path; drop every spelling so ours is the only one. The ceiling stops git from
  // finding a repository above the temp folder, and the ancestor scan from reading the folders above it.
  // The managed policy is a file in the temp folder (absent unless a test writes it), never the machine's.
  // RUSTUP_HOME too: CI runners set it, and rust-analyzer detection would read the runner's toolchains.
  const inherited = Object.entries(process.env).filter(([k]) => k.toUpperCase() !== 'PATH' && !k.startsWith('EP_') && !k.startsWith('GIT_') && !['CLAUDE_CONFIG_DIR', 'RUSTUP_HOME'].includes(k));
  const env = {
    ...Object.fromEntries(inherited),
    HOME: home,
    USERPROFILE: home,
    CLAUDE_CONFIG_DIR: cfg,
    EP_STATE_DIR: join(tmp, 'state'),
    EP_AGENT_CLI: 'none',
    EP_MANAGED_SETTINGS: join(tmp, 'managed-settings.json'),
    GIT_CEILING_DIRECTORIES: dirname(tmp),
    PATH: [bin, GIT && WIN ? dirname(GIT) : ''].join(delimiter),
  };
  const ctx = { root: ROOT, cwd: tmp, env, now: () => NOW };
  const read = (rel) => readFileSync(join(cfg, rel), 'utf8');
  const write = (rel, text) => {
    mkdirSync(dirname(join(cfg, rel)), { recursive: true });
    writeFileSync(join(cfg, rel), text);
  };
  return { tmp, home, cfg, bin, env, ctx, read, write };
}

export const inputs = (over = {}) => ({ scope: 'user', profile: 'default', with: [], without: [], answers: {}, mode: 'install', ...over });

export function plan(ctx, over) {
  const p = buildPlan(ctx, inputs(over));
  savePlan(ctx, p);
  return p;
}
export const applyPlan = (ctx, p, approve = 'default') => apply(ctx, { scope: p.sc.scope, plan: p.hash.slice(7, 19), approve });
export function planApply(ctx, over, approve = 'default') {
  const p = plan(ctx, over);
  return { plan: p, result: applyPlan(ctx, p, approve) };
}

export function gitRepo(s, name = 'repo') {
  const dir = join(s.tmp, name);
  mkdirSync(dir);
  const r = run('git', ['init', '-q', dir], { env: s.env });
  if (!r.ok) throw new Error(`git init failed: ${r.stderr}`);
  return dir;
}

export const codes = (findings) => findings.map((f) => f.code);
export const label = (r) => `${r.op} ${r.kind} ${r.target}${r.pointer ? `#${r.pointer}` : ''}`;
