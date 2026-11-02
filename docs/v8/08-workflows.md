# 08. Workflows

Status: draft for review, 2026-11-01. User and team workflows (U1 to U8) first, then maintainer workflows (M1, M2). Commands are those of [06-design.md](06-design.md); scope mechanics are in [07-install-scopes.md](07-install-scopes.md).

## U1. First install for all projects (`user`)

1. Install the plugin at user scope (pinned tag recommended): `claude plugin marketplace add MrHashMe/efficiency-playbook#v8.0.0`, then `claude plugin install efficiency-playbook@efficiency-playbook`. For Codex: `codex plugin marketplace add MrHashMe/efficiency-playbook --ref v8.0.0`, then `codex plugin add efficiency-playbook@efficiency-playbook`. Without a ref, Codex reinstalls the plugin at startup whenever `main` changes.
2. In any session: `/efficiency-playbook:setup` (Codex: `$setup`). Choose **All my projects**.
3. The skill shows the plan in groups with token cost, evidence badge (Adopt, Trial) and egress for each row, and asks which groups to apply. Adopt rows and "Trial, on" rows (owned or first-party, no egress, nothing in the request path, reversible, scheduled in the maintainer bench) are preselected; other Trial rows and every third-party component are unchecked. Each Trial row names its kill test and when it will be judged.
4. The engine applies the approved rows, verifies, and the skill reports in at most 15 lines: what changed, what was skipped and why, what needs a new session.
5. Start a new session. Changes that alter the tool list (plugins, MCP servers) apply cleanly to new sessions; resuming an older session after such a change rewrites its prompt cache once.

If Node 22+ is missing, step 2 offers a user-level Node install and stops until it's present. If v7 is installed, the plan includes migration rows ([11-migration-and-roadmap.md](11-migration-and-roadmap.md)).

## U2. Install for one project, personal (`local`)

Same as U1, choosing **This project, just for me**. Everything lands in uncommitted files (local settings, local plugin enablement, excluded files); nothing appears in `git status`. Use this to try the setup in one repository before going user-wide, or in a repository you don't own.

## U3. Install for one project, team (`project`)

```mermaid
sequenceDiagram
  actor M as Repo maintainer
  participant E as Engine
  participant G as Git
  actor T as Teammate
  M->>E: setup, scope "This project, team"
  E-->>M: plan, apply, verify; prints git status and suggested add list
  M->>G: reviews the diff, commits, opens a PR (by hand)
  T->>G: pulls
  T->>T: opens the repo in the agent
  Note over T: Native prompts: trust folder, add marketplace, install plugin
  T->>E: optional: setup in this repo
  E-->>T: offers team plugins not yet installed and the recommended components from the lock, at local or user scope
```

1. The maintainer runs setup and picks **This project, team**. The plan writes only committed-safe files: the project rules file (`.claude/rules/efficiency-playbook.md`) with the command map as one section, the project block in `AGENTS.md` when Codex is selected, declarative marketplace and plugin enablement for plugins allowed at `project` scope, and `.efficiency-playbook.json`. Components that run hooks, keep per-user state, need `env` or need a machine tool (Ponytail, language-server plugins) go into the lock's `recommended` list instead. It never creates or edits `CLAUDE.md`.
2. The engine prints `git status` and the suggested `git add` list. It never commits.
3. Teammates get rules immediately; plugin enablement goes through their agent's own prompts. Codex reads the repository's `AGENTS.md` without trust, but ignores `.codex/config.toml` (and the plugin enablement in it) until the user marks the project trusted.
4. A teammate who runs setup in that repository gets a plan limited to what the committed configuration needs on their machine (`EP-PLUGIN-NOT-INSTALLED` rows for team plugins not yet installed), plus an offer of the lock's recommended components and personal extras at `local` or `user` scope. Machine tools come only with a recommended component the teammate opts into: a language-server plugin brings its server and is enabled only after the server starts on that machine.

## U4. Upgrade

1. The marketplace is refreshed, then the plugin updates. Unpinned installs run `claude plugin marketplace update` before the plugin update; pinned installs re-add the marketplace at the new tag (`#v8.x.y`; Codex `--ref`).
2. On the next `/efficiency-playbook:setup`, or when `verify` reports `EP-COMPONENT-VERSION-UNEXPECTED` or a new engine version, the plan contains only the differences: updated owned content, new registry versions, rows for components whose verdict changed (demoted components are offered for removal, never removed silently).
3. Owned content the user edited is shown as a diff with keep or replace.

## U5. Uninstall

1. `/efficiency-playbook:setup uninstall`, choose the scope (or all scopes).
2. The plan lists removals and restores; edited items appear as conflicts with a diff.
3. After apply, if `ep show --installs` lists no scope on this machine that still has items, the report gives the commands to remove the plugin itself at the scope where it was installed (`claude plugin uninstall efficiency-playbook@efficiency-playbook`, `codex plugin remove efficiency-playbook@efficiency-playbook`). Otherwise it lists the remaining scopes first, because the engine lives in the plugin and can't clean them up once it is gone. It suggests removing the marketplace only when no other installed plugin comes from it, because removing a marketplace uninstalls all of its plugins, and it never suggests `claude plugin prune` or "Uninstall for everyone" (L-12). For components with their own cleanup step (Ponytail's uninstall script) it runs that step only when the plugin leaves the machine and no scope it can see still enables it (07 section 7).
4. Removed files stay in the quarantine folder until retention expires; `ep rollback --last` undoes the uninstall.

## U6. Check health

`/efficiency-playbook:verify` at any time, or after an agent update. With the optional nudge (opt-in at user scope), a session start prints one line when a verify finding exists, at most once a week.

## U7. Team CI check (v8.2)

An optional CI step in a team repository checks out the engine at the lock's version and runs `ep verify --ci --scope project`: the lock is valid, owned project files match their rendering for that engine version, no duplicate blocks, the project budget holds. It needs no agent and no secrets.

## U8. Evaluate a component on your own work

1. `/efficiency-playbook:bench`. The skill proposes tasks from recent commits that touched tests, using the prepare and acceptance commands the user gives it.
2. The user starts `ep bench validate` from a terminal they opened themselves; it lists the commands it will run and goes on only when they type back the code it prints. It keeps tasks that pass the four gates; the skill reports how many survived.
3. `ep bench plan` shows the budget and the minimum detectable effect for the arms chosen (always including a lower-effort reference arm), and asks to proceed.
4. The user starts `ep bench run` the same way (the bench refuses to run nested). It lists the repository's and each arm's configuration and asks for a fresh code, then runs arm by arm, interleaved per task. Nothing is remembered, so every `validate` and `run` asks again (M-9).
5. `ep bench report` prints the table, the decision-rule outcome (`wins`, `loses`, `inconclusive`) and the validity threats. The user decides; the engine changes nothing based on a bench result by itself.

## M1. Maintainer: evidence refresh (weekly)

1. Scheduled CI runs `ep evidence fresh`: new releases of tracked components, agent changelog entries matching revisit triggers, evidence past `freshnessDays`. An issue's state is never a trigger by itself: the claude-code stale bot has auto-closed thousands of reproduced issues (CC#87647), so a fix counts once a release note names it and a re-test confirms it.
2. It updates one tracking issue with a checklist. It never edits verdicts.
3. The maintainer triages: no change, re-run the maintainer bench, or open a verdict-change PR that edits the registry entry (evidence item with date, measuredBy and status).
4. CI renders `docs/decisions.md`, validates the schema and runs fixtures against the latest agent CLIs.

## M2. Maintainer: release

1. Bump the version in both plugin manifests; update registry tested versions; render docs.
2. CI on the PR: `check`, `selftest`, fixture suites on three OSes, budget gate, informational agent validations (`claude plugin validate --strict`, Codex install into a throwaway home).
3. Tag `v8.x.y` on main. The release job (needs `check` and `selftest`) publishes release notes, SHA256SUMS and artifact attestations.
4. Smoke test from the tag in a throwaway config dir on Windows: install, setup at each scope, verify, uninstall.
