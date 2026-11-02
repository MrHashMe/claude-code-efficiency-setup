// Inspect (06 section 2): facts about this machine and the installs v8 manages. Writes nothing.
import { existsSync, readdirSync } from 'node:fs';
import { release } from 'node:os';
import { dirname, join } from 'node:path';
import { findManifest } from './migrate.mjs';
import { configDir, gitEnv, gitFacts, managedFiles, stateRoot } from './scopes.mjs';
import { displayPath, finding, homeDir, readJson, run } from './util.mjs';
import { agentVersion } from './verify.mjs';

// Every scope with ownership records, and the folders its items live in (07 section 9). A state file that isn't JSON
// is a finding in `findings` and counts as no records.
export function installs(ctx, findings = []) {
  const home = homeDir(ctx.env);
  const dir = join(stateRoot(ctx.env), 'scopes');
  if (!existsSync(dir)) return [];
  const read = (key) => {
    const file = join(dir, key, 'state.json');
    try {
      return readJson(file, null);
    } catch (e) {
      if (e.code) throw e;
      findings.push(finding('error', 'EP-STATE-CORRUPT', `${displayPath(file, { home })} isn't valid JSON (${e.message}); restore it from a copy, or move it away to start this scope's records over`));
      return null;
    }
  };
  return readdirSync(dir)
    .map((key) => ({ key, state: read(key) }))
    .filter((x) => x.state?.items?.length)
    .map(({ key, state }) => ({ key, items: state.items.length, engine: state.engine, folders: [...new Set(state.items.map((i) => displayPath(dirname(i.target), { home })))].sort() }));
}

export function inspect(ctx) {
  const env = ctx.env;
  const home = homeDir(env);
  const d = (p) => (p ? displayPath(p, { home }) : null);
  const findings = [];
  const { cli, version } = agentVersion(env);
  const git = gitFacts(ctx.cwd, env);
  const cfg = configDir(env);
  const manifest = findManifest(cfg, (p, e) => findings.push(finding('warn', 'EP-MANIFEST-CORRUPT', `${d(p)} isn't valid JSON (${e.message}), so it is skipped; v7's records in it can't be used`)));
  return {
    data: {
      os: `${process.platform} ${release()}`,
      node: process.version,
      claude: { cli: d(cli), version },
      git: run('git', ['--version'], { env: gitEnv(env) }).stdout.trim() || null,
      configDir: d(cfg),
      stateRoot: d(stateRoot(env)),
      managedSettings: managedFiles(env).filter(existsSync).map(d),
      repo: git ? d(git.top) : null,
      v7Manifest: d(manifest),
      installs: installs(ctx, findings),
    },
    findings,
  };
}
