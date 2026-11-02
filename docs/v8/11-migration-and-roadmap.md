# 11. Migration from v7 and roadmap

Status: draft for review, 2026-11-01. The v7 facts below come from PLAYBOOK.md v7.3 and PLAYBOOK-CODEX.md v1.0 in this repository.

## What v7 left on a machine

| v7 artifact | Where | v8 outcome |
| --- | --- | --- |
| `MANIFEST.json` (version, every file, block, settings key, hook and plugin with before and after hashes; `installedBy`; `removed` marks) | `%USERPROFILE%\.claude\backups\setup-<timestamp>\`, or `%LOCALAPPDATA%\claude-setup-backups\` when the home folder is cloud-synced | Read once by the migration step inside `ep plan`; ownership and prior values move into v8 state. Left in place, never deleted. |
| Working rules with markers `<!-- token-efficiency-setup -->` and `<!-- playbook v7.x -->` | `~/.claude/rules/token-efficiency.md` | Replaced by the v8 user rules file `~/.claude/rules/efficiency-playbook.md` (rendered from `content/`). Old file removed if unchanged, else diff and ask. |
| Project section between `<!-- efficiency:start -->` and `<!-- efficiency:end -->`, or a new `CLAUDE.md` containing `@AGENTS.md` | Repo `CLAUDE.md` | Moved out: the section's content becomes the v8 rules file (`.claude/rules/efficiency-playbook.md` for `project`, `.claude/rules/efficiency-playbook.local.md` for `local`; the user chooses per repository on its next setup), and the marked section is removed from `CLAUDE.md`, shown as a diff. A `CLAUDE.md` that v7 created, that still contains only `@AGENTS.md` and is unchanged, is removed, so Claude Code reads `AGENTS.md` directly again; any other `CLAUDE.md` stays, and the plan says what it hides (07, section 3.3). When `CLAUDE.md` is tracked, both edits change a committed file, so they are `project` rows; a `local` setup only reports the section and never edits the tracked file (07 section 1, rule 3). |
| Skills `project-setup` (model-invocable), `setup-check`, `memory-lint`, `paired-check` (with `run.mjs`) | `~/.claude/skills/` | Removed: v8 ships these jobs inside the plugin as explicit-only skills (`verify`, `bench`, `memory-lint`), so nothing is listed in every session. |
| SessionStart nudge hook and `~/.claude/project-setup-state.json` | User settings, home folder | Removed unless the user opts into the v8 nudge; state moves into the v8 state dir. |
| Owned settings keys (for example `env.PONYTAIL_SUBAGENT_MATCHER`, plugin enablement) | `~/.claude/settings.json` | Adopted as owned, carrying v7's recorded pre-install values, so a v8 uninstall restores the pre-v7 state. |
| Windows language-server fallback plugin | `~/.claude/local-plugins/` | Adopted; replaced only if the v8 registry has a better-evidenced mechanism. |
| npm prefix fix, `%APPDATA%\npm` on PATH, global `typescript-language-server` and `typescript` | Machine | Entered in the machine-layer refcount table as `installedBy: v7`. Kept by default, as v7 rollback did. |
| Codex: `MANIFEST.json` (version `codex-v1.0`) | `<codex home>\efficiency-backups\setup-<timestamp>\` | Same as the Claude manifest. |
| Codex: global block `<!-- efficiency-playbook:start -->` ... `<!-- efficiency-playbook:end -->` | `<codex home>\AGENTS.md` (or `AGENTS.override.md`) | Replaced by the v8 Codex user block. |
| Codex: project section `<!-- efficiency-codex:start -->` ... `<!-- efficiency-codex:end -->` | Repo `AGENTS.md` | Replaced by the v8 project block. |
| Codex: skills `project-setup`, `setup-check` | `%USERPROFILE%\.agents\skills\` | Removed; the Codex plugin ships its own explicit-only skills. |
| Codex: owned `config.toml` keys (for example `service_tier`, a `context7` MCP entry) | `<codex home>\config.toml` | Adopted with their recorded prior values. |

## Migration algorithm

Migration runs inside `ep plan` when v7 artifacts are found (there is no separate command); it produces ordinary plan rows, so consent, journal and rollback work as for any change.

1. Find the newest v7 manifest in each known location. Skip items marked `removed`.
2. For each item, compare its current hash with the manifest's "after" hash:
   - **Unchanged**: adopt it as owned in v8 state, with the manifest's "before" value as the restore point, and add a row that replaces it with v8 content (or removes it, per the table above).
   - **Edited by the user**: show the diff and ask: keep it as user content (v8 disowns it and never touches it again), or replace it. A v7 folder (a skill) moves as a whole, so a file in it that the manifest doesn't list counts as an edit.
   - **Missing**: drop it from ownership and note it in the report.
3. Write v8 state, then a pointer file `migrated-from-v7.json` (manifest path, hash, timestamp) so migration never runs twice.
4. Run `ep verify`. If it fails, `ep rollback --last` restores the exact pre-migration bytes.

Compatibility window: through v8.1 the setup skill still accepts the `rollback` argument for a machine whose v7 install wasn't migrated, using the v7 rules. From v8.2, `rollback` without v8 state prints the manual steps.

## Roadmap

Effort figures are estimates for one maintainer working with a coding agent, not measurements.

| Phase | Contents | Exit criteria | Estimate |
| --- | --- | --- | --- |
| P0. Spike and kill tests (before v8.0) | Engine prototype, Claude Code only, with every command except `bench` and `evidence`, for the item kinds the acceptance tests need (rules file, settings key, plugin enablement, machine-tool refcount), at `user`, `project` and `local` scope. Confirm the facts in 07 section 13 on the current agent releases and run 07 acceptance tests 1 to 4, 8 to 11 and 13 to 17. Measure setup tokens of the prototype against v7.3 on the same fixture. | K-ENGINE, K-SCOPE (its Claude Code tests), K-TOKENS and K-ARMS in [03-admission-ledger.md](03-admission-ledger.md) pass. | 2 to 3 weeks |
| v8.0. Claude Code parity | Full engine (all commands), registry with schema and generated decisions page, three scopes, migration from v7, bench v2 core (task gates, paired runs, bootstrap intervals, fingerprints), CI on windows, ubuntu and macos, context budget gate, thin setup skill, README rewrite. | Every Must requirement for Claude Code in 04 passes; v7.3 fixture migrates cleanly; one dogfood week with no data-loss bug. | 4 to 6 weeks |
| v8.1. Codex parity | Codex adapter at every scope Codex supports, `config.toml` key-level editing, Codex bench arms via `codex exec --json`. | Codex fixture suite passes; in a mixed Claude Code and Codex repository each agent loads its own copy once, and where Claude Code also reads `AGENTS.md` the duplicate is reported (`EP-DUPLICATE-BLOCK`); 07 acceptance tests 5, 6, 7 and 12 pass. | 2 to 3 weeks |
| v8.2. Maintenance automation | Weekly evidence freshness job (one tracking issue, no automatic verdict changes), known-conflict signatures for `verify` (patterns that recognize a known bad combination, such as one pack installed both as a plugin and as copied files), the firing-rate audit (TE-T4, Trial, off), an example CI step for teams (`ep verify --ci --scope project`). | Freshness job ran for 4 weeks with no false "stale" on fresh entries; K-TE-T4 has run. | 2 weeks |
| v8.3 and later. Assess and late Trial items | Harbor task export, bench tasks exported as `claude plugin eval` cases, local-only usage analytics, AGENTS.md adapter for other agents, opt-in personal tuning loop over the Pareto front, TokenEconomizer ideas TE-T1 to TE-T3 (Trial, off). Each Assess item enters only after its row gets evidence. | Per item: an Assess row moves to Trial or Adopt; a Trial row runs its kill test. | Unplanned |

## What changes for users

- One plugin install, then one setup command, as today. The command now asks first: all projects, this project for the team, or this project just for me.
- Setup is faster and cheaper because a script does the mechanical work; the agent explains and asks.
- `PLAYBOOK.md` stops being executed. It is regenerated from the registry as a human-readable manual for people who prefer to configure by hand (if the owner keeps it: decision 5 in [01-proposal.md](01-proposal.md)).
- Nothing is added to every session's context beyond the budgeted rules; v7's model-invocable `project-setup` skill listing goes away.

## Program kill criteria

Stop or rethink v8 if P0 shows any of these: the engine-driven setup does not cut setup tokens by at least two thirds against v7.3; a native mechanism needed for `project` or `local` scope behaves differently than 07 assumes and has no workaround inside the constraints; or the engine cannot stay within the size budget in N-8 while passing the Must requirements.
