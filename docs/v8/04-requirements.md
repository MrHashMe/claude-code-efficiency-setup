# 04. Requirements and acceptance criteria

Status: draft for review, 2026-11-01. Every requirement has an ID, a priority (Must, Should, Could) and an acceptance check that a test or a reviewer can run. Mechanisms live in [06-design.md](06-design.md) and [07-install-scopes.md](07-install-scopes.md); this file says what must be true, not how.

Terms. **Agent**: Claude Code or Codex. **Engine**: the deterministic `ep` command (see [05-architecture.md](05-architecture.md)). **Owned item**: a file, marked block, settings key, hook or plugin enablement the engine created, recorded in state with its hash. **Scope**: `user` (every project of this OS user and agent config dir), `project` (one repository, files meant to be committed and shared), `local` (one repository, this user only, never committed). **Fixture**: a throwaway home dir plus repo used by tests.

## Goal and non-goals

Goal: make an AI coding agent produce accepted work for the fewest tokens, with no measured loss of quality, by configuring the user's own environment, with consent, reversibly, at the scope the user picks.

Non-goals: a proxy or gateway in the model request path; a hosted service or telemetry; changing organization-managed policy; replacing features the agent already has; committing or pushing for the user; model training.

## Scope (S)

| ID | Pri | Requirement | Acceptance |
| --- | --- | --- | --- |
| S-1 | Must | The user chooses the target at setup: `user`, `project` or `local`. The choice is asked first and shown on every plan row. `project` and `local` are offered only inside a git working tree whose top level isn't the home folder, a parent of it or an agent config folder. | For each scope, every write path in `ep plan --scope <s> --json` is inside that scope's allowed path set (table in 07), and the three path sets never overlap. Test enumerates paths on a fixture, including a home folder that is a git repository and a non-git folder, where only `user` is offered. |
| S-2 | Must | `user` and `project`/`local` installs can coexist. Settings follow the agent's own precedence. Within one scope the engine never places a fragment twice for one agent, and a `local` install never repeats an item already provided at `user` or `project` scope. With both agents selected, each agent gets its own copy, and when Claude Code also loads the Codex block the duplicate is reported (07, section 3.3, rule 3). A committed `project` file stays self-contained for teammates, so on a machine that also has the `user` install the duplicate is reported with its token cost and, where the agent can skip one file for one project, removed with a `local` exclusion (07, section 3.3). | With both installed, `ep show` lists each item with its source scope; `ep verify` reports each cross-scope duplicate once with its token cost (`EP-DUPLICATE-BLOCK`); after the offered exclusion is applied, the agent's own context listing (07, section 9) shows each block once. In a mixed Claude Code and Codex fixture where Claude Code also loads `AGENTS.md`, the cross-agent duplicate is reported once with its token cost. |
| S-3 | Must | A `project` or `local` install writes only inside the repository, plus the engine's per-user state dir and agent-owned local records (for example a local plugin enablement). | File-system diff of the fixture home and repo before and after apply. |
| S-4 | Must | Files produced by a `project` install are safe and stable to commit: no absolute or user-specific paths, no secrets, no timestamps, byte-identical on two machines. | Lint over generated project files; two fixture homes with different user names produce identical bytes. |
| S-5 | Must | Uninstall works per scope. Removing one scope leaves the others installed and passing `verify`. | Install user and project, uninstall project: `ep verify --scope user` passes; project files equal their pre-install bytes except user-edited ones, which are reported. |
| S-6 | Should | Machine-level items shared by scopes (a global language server, a plugin install in the per-user plugin cache) are reference-counted. Removing the last scope that uses one offers to remove it; nothing else does. A third-party plugin's own cleanup step runs only when the plugin leaves the machine and no scope the engine can see still enables it. | Unit tests over the refcount table; uninstall with two users of a tool keeps it; 07 acceptance tests 3 and 15. |
| S-7 | Must | The lock in the current checkout decides the `project` install: a checkout without it has none, and ownership of committed files is derived from it, so any clone on any machine can verify, upgrade and uninstall the team install. `local` items are per worktree; journals record their worktree. | Fixture with `git worktree add` and two branches: on the branch with the lock, `verify` passes in both worktrees; on a branch without it, nothing is reported for `project`; a second fixture machine with another path spelling uninstalls the project install; after a `local` install, `verify` in the second worktree reports only the local items as missing and the next plan re-creates them; `rollback` from the second worktree refuses. |
| S-8 | Should | Separate agent config dirs (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`) are separate user scopes with separate state. | Two fixture config dirs get two state keys; uninstalling one leaves the other intact. |
| S-9 | Must | Teammates who open a repository with a `project` install get the configuration through the agent's native mechanisms where they exist, without running the engine; where a step needs their consent or a tool, `verify` tells them the exact command. | Fresh fixture user opens the fixture repo: rules load; plugin enablement prompts natively (manual check recorded per agent release). |
| S-10 | Must | A `project` install never enables hooks, MCP servers or plugins for teammates without the agent's own trust or install prompt, and never enables a component that runs hooks, keeps per-user state outside the scope, needs an `env` entry or needs a machine tool; the lock can only recommend those, for each person to accept at `local` or `user`. | Review checklist item; a fixture test that the committed files contain no `hooks` key and only marketplace and plugin enablement keys; a registry schema test that such components have no `project` placement; a teammate's user-scope `false` for a recommended plugin stays in effect. |
| S-11 | Must | A local choice that depends on another scope (a skipped repeat, an exclusion, an opt-out `false`) records that dependency, and every plan and `verify` re-check it. | After the team's install is removed by a pull, or the user scope is uninstalled, `verify` reports each dependent local choice (`EP-LOCAL-STALE`) and the plan offers to restore or drop it. |
| S-12 | Should | The engine detects config folders that differ between surfaces or sync between machines, and says what that means before writing. | Fixtures: `CLAUDE_CONFIG_DIR` set only in the process environment gives `EP-SURFACE-SPLIT`; a config folder under a synced folder gives `EP-CONFIG-SYNCED`, and a second fixture machine sharing it rebuilds ownership from the user lock. |

## Lifecycle (L)

| ID | Pri | Requirement | Acceptance |
| --- | --- | --- | --- |
| L-1 | Must | `inspect` is read-only, including state and logs. | Snapshot of fixture dirs before and after: identical. |
| L-2 | Must | `plan` lists every change: scope, path or key, operation, before and after summary, always-loaded token cost, evidence verdict, reversibility, data egress. Nothing outside the approved plan is applied. | The apply journal is a subset of the approved plan rows (property test over random approval sets). |
| L-3 | Must | Consent per item or group. Declined items are not applied and not asked again until their content or verdict changes. | Approval set equals journal; a re-run plan marks declined items `declined` and skips them. |
| L-4 | Must | Idempotence: after apply, `plan` is empty; applying twice equals applying once, byte for byte. | CI test on fixtures for each scope. |
| L-5 | Must | Uninstall removes owned files and blocks and restores owned settings keys to their pre-install values (or removes them if they were absent). An owned item the user changed is never silently removed: show a diff and ask. | Fixture cases: unchanged, edited by user, deleted by user, key changed by another tool. |
| L-6 | Must | Upgrades between v8 versions and migration from v7.x (its `MANIFEST.json`, markers and skills) leave no duplicate or orphaned content. | v7.3 fixture install, then `ep plan` (which includes the migration rows), `ep apply` and `ep verify` pass; every v7 item is adopted, replaced or removed per the approved plan. |
| L-7 | Must | A failure during apply leaves the pre-apply state or a journaled partial state with one-command revert. | Fault injection: abort after operation k for every k; `ep rollback --last` restores the pre-apply bytes. |
| L-8 | Must | One apply per scope at a time (lock). An item whose target changed between plan and apply is skipped and reported. | Test edits a target between plan and apply; that item is reported `stale`, the rest apply. |
| L-9 | Must | `verify` detects drift: owned items changed, required tools missing, agent below the tested minimum, a component whose evidence is stale or whose revisit trigger fired. | One fixture per drift type; each produces a distinct finding code. |
| L-10 | Should | Backups are bounded (default: last 5 per scope) and never copy credential files. | Retention test; backup set excludes the credential file list in 10-threat-model. |
| L-11 | Must | No commit or push by the engine or its skill, ever. After a `project` apply it prints the `git status` lines and suggested `git add` list. | Grep of the engine for git write subcommands; fixture shows the printed list. |
| L-12 | Must | Uninstall removes only what the engine owns, even when the agent's own removal command would remove more: it never removes a marketplace that still has plugins the engine doesn't own, never prunes dependencies the agent installed, and at `project` scope never uninstalls for teammates (it removes the committed enablement; each person's install stays theirs). | Fixture with a second plugin from the same marketplace, a shared dependency and a teammate's install: all survive uninstall. |

## Components and content (C)

| ID | Pri | Requirement | Acceptance |
| --- | --- | --- | --- |
| C-1 | Must | Every installable component has a registry entry: roles, verdict, evidence items (source, date, who ran it, setting, effect, quality measured or not, status label), platforms, data egress, request-path effect, install mappings per agent and scope, revisit triggers. | JSON Schema validation in CI; the engine refuses to plan a component without a valid entry. |
| C-2 | Must | One owner per exclusive role. The plan never installs two owners of one role; an existing third-party owner is reported as a conflict with a choice. | Conflict fixtures (for example two output-style or two code-navigation owners). |
| C-3 | Must | Budget for always-loaded owned text: at most 600 estimated tokens at user scope and 700 at project scope, where committed files are self-contained (bytes / 3.5), reported per item in `plan` and `verify`. Owned text in a rule with `paths:` frontmatter counts as always loaded (07 section 3.1). | CI fails above budget; `verify` prints the estimate per scope. |
| C-4 | Must | No Adopt-verdict component may sit in the model request path or rewrite conversation history (both break prompt caching). | Registry field `requestPath: "none"` required for Adopt; schema test. |
| C-5 | Must | No component sends source code, prompts or transcripts to a third party unless the user opts in after seeing the destination. Default exception: documentation lookups that send library names and generic questions (Context7). | Registry `egress` field; default plan contains no other egress; plan shows an egress badge. |
| C-6 | Should | The project command map (quick checks, full acceptance) is built from detected candidates, then confirmed by the user. | Fixture repos for Node, Python, .NET and Go produce the expected candidates. |
| C-7 | Must | Owned instruction text is written once in a single source and rendered per agent; agent copies never drift. | CI renders all adapters and fails on any diff from the committed output. |
| C-8 | Must | Owned text uses plain wording (no emphasis by capitals or stacked "must"), and user-scope rules include the precedence sentence (follow the existing code on conflict, and say so). Model-generated text, such as command-map candidates, reaches an always-loaded file only through a shown diff and consent. | Content lint in CI; fixture shows the diff step before any generated block is written. |
| C-9 | Must | No owned file, and no combination of loaded instruction files, exceeds an agent's size cap (for example Codex's 32 KiB project-doc limit), so nothing is cut off silently. | `verify` fixture with an oversized combined file reports `EP-SIZE-CAP`. |

## Measurement (M)

| ID | Pri | Requirement | Acceptance |
| --- | --- | --- | --- |
| M-1 | Must | Bench builds tasks from the user's own history and admits a task only if it passes four gates: history-free clone, fails at base, passes at reference, and both verdicts hold on three runs each. | Unit tests per gate with fixture repos, including a flaky test that must be dropped. |
| M-2 | Must | Bench compares arms with paired runs and reports pass rate and cost per accepted task with bootstrap confidence intervals over tasks. It reports `inconclusive` when an interval crosses the decision margin and never says "significant" without a pre-registered test. | Statistical unit tests on synthetic results with known effects. |
| M-3 | Must | Each run records the arm's configuration fingerprint (agent version, model, settings, plugins, owned content hashes). Runs with different fingerprints for one arm are not pooled. | Mismatch test. |
| M-4 | Must | Bench refuses to run inside an agent session and refuses API-key or third-party-endpoint billing unless explicitly allowed. | Environment-variable tests. |
| M-5 | Should | Bench runs Codex arms as well as Claude Code arms. | Parser tests against recorded `codex exec --json` output. |
| M-6 | Must | Cost is reported as tokens by type (input, cache read, cache write, output, all models including subagents) plus an API-price estimate labeled as an estimate. Plan usage is never inferred. | Report snapshot test. |
| M-7 | Must | Bench data stays local. Export is a separate, explicit command. | No network calls in bench code except the agent CLI it launches (static check). |
| M-8 | Must | Every arm starts from identical memory and session state (auto memory off, fresh session, no persisted state from earlier runs), and tasks used to tune a configuration are never reused to judge it. | Fixture asserts the memory setting and an empty session store per run; task ids carry a `tuning` or `held-out` tag. |
| M-9 | Must | Headless Claude Code runs skip the workspace-trust prompt (whether `codex exec` applies Codex's trust checks is unverified), so before every `validate` and `run` the bench lists what will execute or apply (the task commands, and for `run` the repository's hooks, environment entries, MCP servers, helper commands and skills and each arm's configuration) and goes on only when the user types back a fresh code from that listing at a terminal. Nothing is remembered between runs. | Fixture repo with a project hook: the bench lists it and stops unless the code is typed back; without a terminal on stdin it stops with exit 3. |
| M-10 | Must | Failed and timed-out runs are costed at what they spent, up to the run cap; usage-limit and infrastructure errors are recorded as missing data, never as task failures. | Synthetic results with each error type. |

## Evidence lifecycle (E)

| ID | Pri | Requirement | Acceptance |
| --- | --- | --- | --- |
| E-1 | Must | The human-readable decisions page is generated from the registry. | CI renders it and fails on diff. |
| E-2 | Should | A weekly job flags evidence past its freshness window or with a fired revisit trigger and updates one tracking issue. It never changes a verdict. | Dry-run test with fixture registry and dates. |
| E-3 | Must | Vendor-run, author-run and user-generated evidence is labeled as such; a saving that was not measured is never shown as measured. | Schema requires `measuredBy`; renderer prints the label. |

## Agents and surfaces (A)

| ID | Pri | Requirement | Acceptance |
| --- | --- | --- | --- |
| A-1 | Must | v8.0 supports Claude Code at `user`, `project` and `local`. | Fixture suite per scope. |
| A-2 | Should | v8.1 supports Codex at every scope Codex supports natively (07 lists them). | Fixture suite with `CODEX_HOME`. |
| A-3 | Must | The setup command works in the Claude Code terminal, VS Code and the Desktop Code tab. Where a surface can't run a step (for example `/plugin` in the Desktop Code tab), the engine prints the equivalent shell command. | Manual surface checklist per release. |
| A-4 | Could | Other agents through an AGENTS.md adapter, after v8.2. | Not tested in v8.0. |
| A-5 | Must | The engine and every component declare a minimum version per agent, and `verify` checks each surface it can see separately (the Desktop Code tab runs its own copy of Claude Code, which can differ from the terminal CLI). | Fixture with two surface versions, one below the minimum: one `EP-AGENT-BELOW-MIN` finding naming that surface. |

## UX (U)

| ID | Pri | Requirement | Acceptance |
| --- | --- | --- | --- |
| U-1 | Must | One entry command per agent: ask scope, show plan table, collect consent, apply, verify, report in at most 15 lines. | Transcript review on fixtures; report line count test. |
| U-2 | Must | `ep show` lists the effective configuration: item, value, source scope, owner (engine, user, other tool, managed policy) and evidence id. | Fixture with all four owners. |
| U-3 | Must | Nothing needs activating per session. The optional SessionStart nudge is off unless the user opts in. | Default plan has no hook rows. |
| U-4 | Must | Blocked-by-policy items are shown as blocked, not retried or worked around. | Managed-settings fixture. |
| U-5 | Should | `verify` lists executable configuration the engine doesn't own, in every scope it can read: hooks, MCP servers, environment entries, statusline commands and installed mods. It reports and never changes or approves them. | Fixture with a SessionStart hook injected into project settings produces `EP-UNOWNED-EXECUTABLE-CONFIG`. |

## Non-functional (N)

| ID | Pri | Requirement | Acceptance |
| --- | --- | --- | --- |
| N-1 | Must | Determinism: same engine version, inspected state and answers give the same plan bytes. | Golden-file tests. |
| N-2 | Must | Setup costs at most one third of v7.3's tokens for the same machine and choices. Target, to be measured, not assumed. | Bench the setup session itself (09, "Evaluating v8 itself"). |
| N-3 | Must | Runs on Windows 10 and 11 (PowerShell 5.1 and 7, Git Bash), macOS, Linux and WSL with Node 22 or later and no runtime dependencies. | CI matrix on windows, ubuntu and macos. |
| N-4 | Must | No admin rights, no system-wide writes, no remote scripts piped into a shell. | Static check of engine commands; Windows CI runs as a standard user. |
| N-5 | Must | `inspect`, `plan`, `apply` (for components already available), `verify`, `show` and `uninstall` work offline. | CI job with network disabled. |
| N-6 | Should | `inspect` plus `plan` under 3 s and `verify` under 5 s on the reference machine, excluding the optional language-server probe. | Timed CI step (informational). |
| N-7 | Must | The engine never opens credential files; logs and reports redact anything that looks like a key or token; state dirs are readable by the user only. | Static list check, redaction tests, permission test on Unix. |
| N-8 | Should | Engine modules stay under 400 lines each; the core (everything but bench) under 3,500 lines and bench under 1,200; line coverage at least 80%. | CI coverage report and line-count check. |
| N-9 | Must | Two installs of one version on two machines produce identical owned artifacts except declared machine-specific values. | Cross-fixture diff test. |
| N-10 | Must | The registry records the minimum and last-tested version of each agent and third-party tool; `verify` warns below the minimum; CI runs the fixture suite against the latest agent CLIs weekly. | Scheduled CI job. |
| N-11 | Must | Owned-artifact hashes are computed on normalized text (LF line endings, no byte-order mark); writes keep a file's existing line endings and byte-order mark; no owned artifact is a symlink. | Same content written under `core.autocrlf=true` and `false`, and from PowerShell 5.1 and 7, gives one hash. |
| N-12 | Should | The repository has a security policy with a private reporting channel and a short statement of its position under the EU Cyber Resilience Act, with what would trigger reassessment. | `SECURITY.md` present; check in `scripts/check.mjs`. |

## Traceability to the ranked quality attributes

| Quality attribute (brief rank) | Requirements |
| --- | --- |
| 1. Task quality does not fall | M-1, M-2, M-3, M-8, E-3, C-1, C-8 |
| 2. Tokens per accepted task fall | C-3, C-4, C-9, M-6, M-10, N-2 |
| 3. Safety and reversibility | L-1 to L-12, S-5, S-10, M-9, U-5, N-4, N-7, N-12 |
| 4. Reproducibility | N-1, N-9, N-11, S-4, M-3 |
| 5. Low friction, maintainability | U-1 to U-5, E-1, E-2, A-5, N-8, N-10 |
