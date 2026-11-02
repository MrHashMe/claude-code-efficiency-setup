# 06. Detailed design

Status: draft for review, 2026-11-01. Implements [04-requirements.md](04-requirements.md) within [05-architecture.md](05-architecture.md). Per-agent paths, keys and scope rules are in [07-install-scopes.md](07-install-scopes.md); this file defines the engine, its data formats and its algorithms.

## 1. Repository layout (v8)

```text
.claude-plugin/        plugin.json, marketplace.json (unchanged names; marketplace invariants kept)
.codex-plugin/         plugin.json
.agents/plugins/       marketplace.json (Codex)
skills/                Claude Code skills: setup, verify, bench, memory-lint (explicit-only)
codex-skills/          Codex skills: setup, verify, bench (explicit-only)
engine/                ep.mjs and modules (Node 22+, no dependencies)
content/               owned text, single source (rules fragments, blocks, templates)
registry/              components/*.json, component.schema.json, lock.schema.json
docs/decisions.md      generated from the registry (successor of PLAYBOOK.md Part 2)
PLAYBOOK.md            generated manual for people who configure by hand (if kept: owner decision 5 in 01)
docs/v8/               these design documents
test/                  node:test suites; fixtures are generated into temp dirs at run time
scripts/check.mjs      repository invariants (rewritten for v8, see section 11)
.gitattributes         LF line endings for shipped text files (with CRLF, Windows ignored a skill's effort field: CC#105838)
```

The plugin root keeps v7's invariants: no root `CLAUDE.md`, `AGENTS.md`, `SKILL.md`, `bin`, `hooks`, `.mcp.json`, `commands` or `agents`, so nothing loads into sessions by itself. It also has no root `plugin.json`: Codex 0.166.0 prefers a root manifest over `.codex-plugin/plugin.json` and would then load the Claude Code skills from `skills/` ([07-install-scopes.md](07-install-scopes.md), section 4.2).

## 2. Engine command surface

Every command accepts `--json` and then prints exactly one JSON envelope on stdout: `{ "ok": bool, "command": str, "engine": "8.x.y", "data": {...}, "findings": [...], "error": null | { "code": str, "message": str } }`. Human output is a rendering of the same data.

| Command | Purpose | Writes |
| --- | --- | --- |
| `ep inspect` | Facts about OS, shells, Node, Git, agents, configs per scope, policy, repo, v7 artifacts, role owners | Nothing (L-1) |
| `ep plan --scope <user\|project\|local> [--agent claude\|codex\|all] [--answers f] [--profile default\|minimal]` | Desired state minus current state, as rows; includes migration and uninstall rows when relevant | Nothing |
| `ep apply --plan <hash> --approve <ids>` | Apply approved rows of a plan computed from the current state | Targets, state, journal, backups |
| `ep verify [--scope s] [--deep] [--self] [--ci]` | Drift, budget, duplicates, tool presence, versions, evidence age; `--deep` adds the language-server probe; `--self` checks the engine's files against release checksums; `--ci` uses exit codes only | Nothing |
| `ep show [--scope s] [--installs] [--from <folder>]` | Effective configuration: item, value, source scope, owner, evidence id. `--installs` lists every scope on this machine that still has items: each user config folder, and each repository and worktree where v8 applied a plan. `--from` computes what a session started in another folder would load (07 section 9) | Nothing |
| `ep uninstall --scope s` | A plan of removal and restore rows, applied with `ep apply` | Nothing until applied |
| `ep rollback --last \| --to <journal-id>` | Reverse a journaled apply | Targets, state, journal |
| `ep bench tasks\|validate\|plan\|run\|report` | Bench v2 ([09-evaluation-plan.md](09-evaluation-plan.md)) | Bench folder in state root |
| `ep evidence check\|render\|fresh` | Registry validation (offline), render decisions page, freshness scan (network, maintainer) | `docs/` (render), report file (fresh) |
| `ep selftest` | Built-in tests that need no network or agent | Temp dir only |

Exit codes: 0 success, 1 findings or failed checks, 2 usage error, 3 blocked (lock held or managed policy), 4 stale plan.

## 3. Module layout and size budget

| Module | Lines (budget) | Responsibility |
| --- | --- | --- |
| `ep.mjs` | 150 | Argument parsing, envelopes, exit codes |
| `inspect.mjs`, `detect/*.mjs` | 580 | Facts; repo language and command-candidate detection; role-owner detection |
| `plan.mjs` | 300 | Desired state, diff, row ordering, plan hash |
| `apply.mjs`, `journal.mjs` | 370 | Lock, stale check, ordered writes, journal, post-write parse check, rollback |
| `state.mjs` | 200 | State root resolution, scope keys, ownership records, refcounts, retention |
| `formats/jsonc.mjs`, `formats/toml.mjs`, `formats/mdblock.mjs` | 560 | Format-preserving edits (section 7) |
| `adapters/claude.mjs`, `adapters/codex.mjs` | 520 | Abstract item to concrete path or key per scope ([07](07-install-scopes.md)) |
| `registry.mjs` | 250 | Load, validate (minimal JSON Schema subset), resolve conflicts and roles |
| `verify.mjs` | 300 | Findings with stable codes (section 9) |
| `evidence.mjs` | 250 | Check, render, freshness scan |
| `bench/*.mjs` | 1,200 | tasks, validate, run, report, stats (grown from v7's 455-line runner) |

## 4. Data formats

### 4.1 Registry entry (`registry/components/<id>.json`)

```json
{
  "id": "ponytail",
  "name": "Ponytail",
  "kind": "plugin",
  "origin": "third-party",
  "license": "MIT",
  "roles": ["output-discipline"],
  "exclusive": true,
  "verdict": "Trial",
  "defaultOn": false,
  "verdictDate": "2026-11-01",
  "summary": "Hook-injected rules that push toward the simplest working change.",
  "evidence": [
    {
      "id": "ponytail-vendor-2026-10-07",
      "source": "https://github.com/DietrichGebert/ponytail (benchmarks/results/2026-10-07-agentic.md)",
      "date": "2026-10-07",
      "measuredBy": "vendor",
      "setting": "Opus 5.5, claude -p, Claude Code 2.1.288, 39 tasks x 5 runs x 3 arms, Bash disabled, no CLAUDE.md or auto memory",
      "effect": "cost -26% [-36, -16] vs no add-on",
      "qualityMeasured": true,
      "status": "Verified"
    }
  ],
  "killTest": {
    "hypothesis": "Ponytail 5.3.3 lowers cost per accepted task on the maintainer bench without lowering pass rate",
    "baseline": "No add-on, and a one-line YAGNI rule",
    "pass": "Cost-ratio interval below 1 vs both baselines; pass-rate difference above -5 points",
    "budget": "40 tasks x 3 arms x 2 runs; two weeks",
    "ifFails": "Assess; existing users see the result with an offer to remove"
  },
  "platforms": { "win32": "supported", "darwin": "supported", "linux": "supported" },
  "egress": { "default": "none", "optional": ["band webhook, only if the user sets a URL"] },
  "requestPath": "none",
  "runsHooks": true,
  "alwaysLoaded": { "perSessionTokens": 700, "perSubagentTokens": 700 },
  "userStateOutsideScope": ["~/.claude/ponytail-modes/", "%APPDATA%\\ponytail\\config.json"],
  "agents": {
    "claude": {
      "minVersion": "2.1.290",
      "testedVersion": "2.1.303",
      "install": { "plugin": "ponytail@ponytail", "marketplace": "DietrichGebert/ponytail", "ref": "v5.3.3" },
      "settings": { "env.PONYTAIL_SUBAGENT_MATCHER": "^(?!(explore|plan)$)" },
      "contentWhenEnabled": ["rules/user/50-ponytail-override.md"],
      "uninstallFirst": "the plugin's own uninstall script, before the plugin is removed"
    }
  },
  "conflicts": [{ "role": "output-discipline", "detect": "another plugin injecting output-style rules" }],
  "revisit": [{ "type": "release", "repo": "DietrichGebert/ponytail" }, { "type": "date", "on": "2027-02-01" }],
  "maintenance": { "maintainers": 1, "privateSecurityChannel": false, "lastRelease": "2026-10-29", "archived": false },
  "freshnessDays": 90
}
```

Rules enforced by the schema and `registry.mjs`: `verdict: "Adopt"` requires at least one evidence item with `qualityMeasured: true`, `requestPath: "none"`, and `egress.default` of `"none"` or the docs-lookup exception; every `Trial` has a complete `killTest`; `defaultOn: true` is allowed for Adopt, and for Trial only when `origin` is `owned` or `first-party`, `egress.default` is `"none"`, `requestPath` is `"none"`, every install mapping is one the engine can undo, and `killTest.scheduled` names the maintainer bench run (the "Trial, on" rule in [03-admission-ledger.md](03-admission-ledger.md)); dates are ISO; `status` is one of `Verified`, `Inferred`, `Assumption`, `Unknown`; `license` is an SPDX identifier, or `unknown`; a component with `runsHooks: true`, a non-empty `userStateOutsideScope`, an `env` key in its settings or a machine tool is never placed at `project` scope, and a lock may only list it under `recommended` ([07-install-scopes.md](07-install-scopes.md), section 1, rule 2). Plan rows show `license`, `maintenance` and `userStateOutsideScope`, and `ep evidence fresh` (08, M1) flags upstreams that were archived or haven't released within `freshnessDays`.

### 4.2 Plan row

```json
{
  "id": "r07",
  "group": "rules",
  "component": "rules.user",
  "agent": "claude",
  "scope": "user",
  "kind": "file",
  "target": "~/.claude/rules/efficiency-playbook.md",
  "op": "create",
  "before": { "hash": null, "summary": "absent" },
  "after": { "hash": "sha256:…", "summary": "9 rules, 1,390 bytes" },
  "alwaysLoadedTokens": 397,
  "verdict": "Adopt",
  "evidence": ["…"],
  "egress": "none",
  "reversible": true,
  "requires": [],
  "status": "proposed"
}
```

`kind` is one of `file`, `block`, `key`, `plugin`, `marketplace`, `skill`, `machine`. `op` is one of `create`, `update`, `remove`, `restore`, `adopt`, `disown`. `status` is one of `proposed`, `declined`, `blocked-by-policy`, `conflict`, `stale`. Targets are displayed with `~` or `<repo>`, never as absolute personal paths. The plan hash is SHA-256 over the canonical JSON of the rows plus the hash of the inspected facts they were computed from.

### 4.3 State (per scope, in the state root)

Scope keys: `user-<agent>-<sha256(config dir)[0:12]>`, `project-<sha256(git common dir)[0:12]>`, `local-<same>-<user>`. Paths are normalized before hashing (real path, forward slashes, lower-case drive letter, case-folded where the file system ignores case), so `C:\` and `/c/` spellings of one folder give one key. Each scope folder holds:

```text
state.json                ownership records (below), declined items, engine version
plans/                    saved plans, by plan id
journal/                  one JSONL file per apply or rollback, and the state before each apply
backups/<journal id>/     whole-file copies named <row>-<file name>: files the engine fully owns, and each settings
                          file before its first edit in an apply; key-level prior values live in state.json
quarantine/<journal id>/  files that uninstall or rollback removed (moved, not deleted)
lock                      exclusive lock file while an apply runs
```

```json
{
  "schema": 1,
  "engine": "8.0.0",
  "items": [
    { "id": "rules.user", "kind": "file", "path": "<absolute>", "ownedHash": "sha256:…", "prior": { "exists": false } },
    { "id": "env.PONYTAIL_SUBAGENT_MATCHER", "kind": "key", "file": "<absolute settings.json>", "pointer": "/env/PONYTAIL_SUBAGENT_MATCHER", "ownedValueHash": "sha256:…", "prior": { "exists": true, "value": "…" } },
    { "id": "plugin.ponytail", "kind": "plugin", "ref": "ponytail@ponytail", "version": "5.3.3", "prior": { "enabled": false } }
  ],
  "declined": [{ "component": "context7", "contentHash": "sha256:…" }],
  "migratedFrom": null
}
```

That example is a `user` scope. Every item also records the machine id, for config folders that sync between machines (07 section 2.5).

- **`project` items aren't stored as an ownership list.** The lock in the current checkout is the source: a committed file or block is owned when it matches what the lock renders at the lock's engine version, and the command map when its normalized text matches the lock's hash. Branches without the lock have no project install, and any clone on any machine derives the same ownership (S-7; 07 section 3.3, rule 6). The project scope folder keeps only journals, backups, prior values of keys and the list of worktrees where v8 applied a plan.
- **`local` items** are per worktree. Each records the absolute worktree root (state is per user and never committed, so S-4 is unaffected), the path relative to it, and any scope and item it depends on (`satisfiedBy` for a skipped repeat, `dependsOn` for an exclusion or an opt-out `false`), which every plan and `verify` re-check (`EP-LOCAL-STALE`).
- **The user lock.** User scope also writes `<config dir>/efficiency-playbook.lock.json` in the project lock's format, so a machine that syncs the config folder can derive ownership the same way.
- **What the install built.** A key or list entry's `prior.created` lists the JSON pointers of the objects and lists the install had to create for it, with `""` first when it created the settings file itself. Uninstall and rollback take those away again once nothing is left in them, not even a comment. When the last owned key leaves a settings file the install created, the file moves to quarantine; a file the user made, or one that still holds keys of theirs, stays.

`machine.json` at the state root holds the machine layer: `{ "tools": { "<name>": { "version": "…", "refs": ["<scope key>", …], "installedBy": "v8.0.0 | v7" } }, "plugins": { "<plugin id>": { "version": "…", "refs": ["<scope key>", …], "installedBy": "v8.0.0 | other" } } }`. When an entry's `refs` becomes empty, the plan offers to remove it; a plugin's own cleanup step (`uninstallFirst` in its registry entry) runs only then, and only if no scope the engine can see still enables the plugin (S-6).

### 4.4 Project lock (`.efficiency-playbook.json`, committed)

```json
{
  "engine": "8.0.0",
  "agents": ["claude", "codex"],
  "components": {
    "rules.project": {},
    "command-map": { "hash": "sha256:…" }
  },
  "recommended": ["lsp.typescript", "ponytail"]
}
```

Only the engine version, agent names, registry ids, schema-valid options and content hashes (I5 in [10-threat-model.md](10-threat-model.md)). `components` are rendered into committed files. `recommended` components are offered to each person at `local` or `user` scope after their own checks, and nothing committed enables them. The command map itself lives in the rendered file or block, never in the lock; the lock carries only the hash of that section's normalized text.

### 4.5 Journal record (JSONL)

`{ "t": "2026-11-01T20:30:00Z", "type": "begin|intent|done|manual|skip|stale|blocked|failed|end|rolled-back", "plan": "sha256:…", "row": "r07", "before": "sha256:…", "after": "sha256:…", "backup": "backups/…", "quarantine": "quarantine/…", "worktree": "<absolute worktree root, project and local scopes only>" }`

`intent` is written just before a row changes anything and holds everything rollback needs (the undo value, the containers created, the backup and quarantine paths); `done` follows the change. A failed row records `failed`, including a parse check that put the previous bytes back (`EP-PARSE-REVERTED`). A rollback writes its own journal (`<journal id>-rollback`: `begin` naming the journal it undoes, then `done`, `skip` or `failed` per row, `end`) and adds `rolled-back` to the apply journal once every row is undone.

## 5. Content model

- Owned text lives in `content/` as fragments with frontmatter: `id`, `agents` (`claude`, `codex`), `scopes`, `when` (a component id that must be enabled at that scope, or `always`), and an order prefix in the file name.
- An adapter renders a target by concatenating the fragments that apply, in order. No templating language; a fragment is either included or not. Example: `content/rules/user/50-ponytail-override.md` has `when: ponytail`, so the Ponytail override line exists only where Ponytail is enabled.
- Placement follows [07-install-scopes.md](07-install-scopes.md), section 3.3. Claude Code text goes only into whole files the engine owns under `rules/` folders; the engine never creates or edits `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md`, because creating one stops Claude Code from reading the repository's `AGENTS.md`. Codex text goes into one marked block in the `AGENTS.md` file Codex reads.
- Blocks inside user-edited files use one marker pair per block, for example `<!-- ep:begin project-rules -->` and `<!-- ep:end project-rules -->`. Fully owned files carry no markers. Marker bytes count toward the budget (Codex keeps HTML comments in context).
- The command map is a section of the project or local rules file (Claude Code) or of the project block (Codex). It has a fixed structure (two headed bullet lists: quick checks, full acceptance) so the engine can re-render the template around the user-confirmed commands on upgrade.

## 6. Algorithms

### 6.1 Plan

1. Load registry and content; validate; refuse on schema errors. Refuse `project` and `local` outside a git working tree, or where its top level is the home folder, a parent of it or an agent config folder (07 section 1, rule 6). At `project` scope, if the lock names another engine version, stop with `EP-LOCK-ENGINE-MISMATCH` unless the user asked for an upgrade plan. An agent or surface that `inspect` doesn't find gets no rows and no files; `verify` reports it as not installed, never as a failure.
2. Resolve the profile (default: components with `defaultOn: true` whose platform and agent match, plus Trial components the user opts into) and the answers file.
3. For each selected component, ask its adapter for desired items at the chosen scope. Placement follows 07: each item goes to the scope the user chose for it, instruction text follows the rules in 07 section 3.3, components that can't be placed at `project` scope go to the lock's `recommended` list, and a `local` item that repeats a `user` or `project` item is skipped and recorded with `satisfiedBy`.
4. Diff desired items against inspected facts and state: create, update (owned and unchanged), conflict (owned but edited, or owned by another tool), adopt (v7-owned and unchanged), restore or remove (owned but no longer desired).
5. Apply policy: rows touching keys or plugins blocked by managed settings become `blocked-by-policy`.
6. Apply role exclusivity: two exclusive owners of a role produce one `conflict` row with a choice.
7. Order rows topologically by `requires` (marketplace before plugin, plugin before its settings keys, machine tools before items that need them). Compute token costs per scope and the plan hash.

### 6.2 Apply

1. Take the scope lock (`lock` file created with exclusive create; a lock older than 10 minutes whose process is gone is stale and replaced).
2. Recompute the plan from current facts; if its hash differs from the requested one, stop with exit 4 and return the fresh plan (L-8).
3. Write a `begin` journal record. For each approved row in order: re-read the target; if its hash differs from `before.hash`, record `stale`, skip it and its dependents; else record the prior value (key-level; a settings file is also copied whole before its first edit in an apply, for restoring by hand) or back up the file (fully owned files), write an `intent` record, write atomically, parse the result, record `done`.
4. Atomic write: write `<target>.ep-<random>.tmp` in the same folder, created only if no file or link has that name, flush, rename over the target. On Windows, retry a failed rename three times with backoff (files held open by editors or scanners), then record `skip` with the reason. Access denied in a folder that Controlled Folder Access or endpoint protection guards is reported with the path and the program to allow; allowing it is the user's or their admin's step, and the engine never changes security settings.
5. If a parse check fails, put the previous bytes back immediately (a file the row created moves to quarantine) and record `failed` with `EP-PARSE-REVERTED`.
6. Update `state.json` atomically, write `end`, release the lock, run fast `verify` checks for the scope.
7. Rows of kind `plugin` and `marketplace` are executed through the agent's CLI (`claude plugin …`, `codex plugin …`) when it is available; otherwise the row returns the exact command for the user to paste, and `verify` confirms it later.

### 6.3 Uninstall and rollback

- Uninstall plan for a scope: every owned item becomes `remove` (files and blocks: current hash equals owned hash), `restore` (keys: prior value or delete; a machine without the prior value removes the owned key and says so), or `conflict` (edited since install: show the diff and offer keep, remove anyway, or restore prior). At `project` scope the owned set is derived from the lock in this checkout, so a branch without the lock has nothing to remove. At `local` scope, items missing from this worktree are reported, and dropped from state only when no other recorded worktree holds them. Machine tools and plugin installs lose this scope's ref; one with no refs left gets an optional row, off by default.
- A third-party cleanup step (the registry's `uninstallFirst`) runs only in the row that removes the plugin from the machine, and only when no scope the engine can see enables it: the user's and project settings in view, and every scope in state. The row notes that repositories the engine never touched can't be checked.
- Linked worktrees share one `info/exclude` file, so each local install keeps its own marked block in it (`# ep:begin efficiency-playbook-<path key of its top folder>`); removing one worktree's install leaves the other blocks as they are.
- Removed files go to `quarantine/<journal id>/`; retention is bounded like backups (L-10).
- Native removal commands can remove more than the engine owns (L-12), so the planner checks before using one: a marketplace is removed only if the engine added it and no other installed plugin comes from it; plugin removal never runs a dependency prune; at `project` scope the plan removes the committed enablement keys and never chooses the agent's "uninstall for everyone" path. Anything the engine can't remove without collateral becomes a row with the exact command and a note on what else it would remove.
- At `project` and `local` scope, uninstall also lists the repository's other worktrees (`git worktree list`, read-only) that still hold an owned file or block with the owned hash, one row each, so no copy is left behind as unowned text.
- `rollback --last` reverses every changed row of the last open journal, newest first, from its `done` record, or from its `intent` record when the apply stopped inside the row. A row is undone only if the target still has that record's `after` hash; a target that still has its `before` hash was never changed, and any other target is left as it is (`EP-ROLLBACK-SKIPPED`). If an undo fails, the journal stays open with its saved records, and the next rollback finishes it; older journals wait until then. It refuses to run in a worktree other than the one the journal records. Every command also runs from a plain terminal (each apply report prints the command line for this machine), so `rollback --last` works when a broken config stops the agent from starting.

### 6.4 Migration from v7

Specified in [11-migration-and-roadmap.md](11-migration-and-roadmap.md); implemented as plan rows of op `adopt`, `disown`, `update` and `remove`.

## 7. Format-preserving editors

| Format | Approach | Refuses (reports "manual edit needed") |
| --- | --- | --- |
| JSON and JSONC (agent settings) | Tokenize, find the member span by JSON pointer, replace the value text; insert new members before the closing brace using the file's detected indent and newline; delete a member with its comma. Keep the BOM if present, line endings and the final newline. Parse after writing. | Duplicate keys at the same pointer; files that don't tokenize |
| TOML (Codex `config.toml`) | Line-based: top-level keys above the first table header; `[table]` and `[table."quoted"]` sections edited in place; comments and order kept; never rewrite the whole file. After writing, run the agent's own config check when available (v1.0 used `codex features list`). | Inline tables or arrays of tables that hold an owned key; multi-line strings at an owned key |
| Markdown blocks | Find `ep:begin`/`ep:end` pair by id; replace inner text; append with one blank line if absent. | Unbalanced markers; two blocks with the same id |

All editors share three rules (N-11): hashes are computed on normalized text (CRLF to LF, byte-order mark removed), so `core.autocrlf` and PowerShell 5.1's default encodings don't make an unchanged file look edited; a write keeps the target's existing line endings and byte-order mark, and new files are UTF-8 without a byte-order mark and with LF endings; the engine never creates symlinks (they need Developer Mode or admin rights on Windows and check out as plain text elsewhere). On Windows a plan row whose target path would exceed 260 characters is refused with the path shown, because agents and Git may not handle longer paths without an admin-only system setting.

## 8. Skills (conversation layer)

- `setup [scope] [uninstall]`: asks scope first (three options), runs `ep inspect` and `ep plan`, shows the plan grouped (core rules, code navigation, output discipline, docs lookup, project command map, optional nudge) with token costs, evidence badges and egress, asks for consent per group (multi-select), confirms command-map candidates, runs `ep apply` and `ep verify`, reports in at most 15 lines. In Claude Code it calls `node "${CLAUDE_PLUGIN_ROOT}/engine/ep.mjs"`; in Codex the plugin root is two folders above the skill file.
- `verify`: runs `ep verify --deep` and explains findings.
- `bench`: drives `ep bench` with the user, including the budget confirmation.
- `memory-lint`: unchanged job from v7 (find stale or contradictory auto-memory entries), explicit-only.
- If Node 22+ is missing, the setup skill offers the user-scope install (Windows: `winget install OpenJS.NodeJS.LTS --scope user`; macOS and Linux: the platform's usual user-level method) and stops until it is present.

## 9. Verify findings

Stable codes, each with a fix hint: `EP-DRIFT-EDITED`, `EP-DRIFT-MISSING`, `EP-DUPLICATE-BLOCK`, `EP-BUDGET-EXCEEDED`, `EP-TOOL-MISSING`, `EP-AGENT-BELOW-MIN`, `EP-COMPONENT-VERSION-UNEXPECTED`, `EP-EVIDENCE-STALE`, `EP-REVISIT-TRIGGERED`, `EP-POLICY-BLOCKED`, `EP-ROLE-CONFLICT`, `EP-MARKETPLACE-NOT-CANONICAL`, `EP-PLUGIN-NOT-INSTALLED` (project scope enabled but this user hasn't installed it yet), `EP-SELF-CHECKSUM`.

Added after the omission scout (each traces to a requirement):

| Code | What it reports | Requirement |
| --- | --- | --- |
| `EP-ROLE-CONFLICT` (extended) | Installed third-party skills, plugins or rule sets that claim the same job as each other or as an owned component, and one component installed through two channels (a plugin plus copied files, or two marketplaces) | 03, same-job check |
| `EP-DUPLICATE-BLOCK` (extended) | Owned text that loads twice in one session: within a scope (an engine bug), across scopes (a self-contained project file plus the user install) or across agents (Claude Code also loading the Codex block in `AGENTS.md`), with the token cost and the agent's native exclusion, if one exists | S-2 |
| `EP-ANCESTOR-INSTRUCTIONS` | Instruction files in a parent folder, such as the home folder, that load into every repository below it | U-2 |
| `EP-HIDDEN-UNICODE` | Invisible or bidirectional control characters in any instruction file, rule or skill that loads in the current folder; report only | U-5 |
| `EP-MARKETPLACE-UNPINNED` | This plugin's marketplace added without a tag or full commit SHA, so Codex reinstalls it whenever `main` changes | L-9 |
| `EP-POLICY-UNREADABLE` | A managed settings file exists but can't be read, so the agent runs without the organization's policies | U-4 |
| `EP-CODEX-PROJECT-UNTRUSTED` (v8.1) | Codex project items inactive because the user hasn't trusted the project; names the trust prompt and never writes trust | A-2, S-9 |
| `EP-UNOWNED-EXECUTABLE-CONFIG` | Hooks, MCP servers, environment entries, statusline commands and mods not in the ledger, per scope and agent; report only, never approve or remove | U-5 |
| `EP-MOD-PRESENT` | Installed Claude mods, which can approve tool calls past permission rules and hooks | U-5 |
| `EP-AGENT-BELOW-MIN` (per surface) | The version on each surface it can see: terminal CLI, VS Code extension, Desktop Code tab | A-5 |
| `EP-INSTRUCTIONS-NOT-LOADED` | An instruction file that won't load in this combination, for example `AGENTS.md` ignored because a `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` exists in the folder or above it, or `<codex home>/AGENTS.md` ignored because only v8's block keeps `AGENTS.override.md` non-empty | S-2 |
| `EP-SIZE-CAP` | An owned file, or the combined instruction files, past an agent's cap. Codex project docs past 32 KiB (the default) block the write; a Claude Code auto memory index past the 200 lines or 25 KB that load is reported only; an instruction file past Claude Code's 200-line guidance gets a warning | C-9 |
| `EP-SECURITY-RULE-UNENFORCED` | A prose security rule with no setting, permission rule or sandbox option that enforces it (advisory; an engine feature on Trial) | 03, K-SECLINT |
| `EP-FLAGS-DISABLED` | Privacy variables (for example `DISABLE_TELEMETRY`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`) that also switch off flag-gated features such as unused-skill reports; informational | M-3 |
| `EP-HOOK-SLOTS` | Hook count per event across all sources against the agent's limits; informational | — |
| `EP-CODEX-HOOK-UNTRUSTED` (v8.1) | Codex hooks skipped because they are new or changed and not yet re-trusted | A-2 |
| `EP-EXTERNAL-DRIFT` | Changes the engine doesn't own but that affect results: server-delivered settings, synced skills with names that collide with owned ones | N-9 |

Added after the scope red-team review:

| Code | What it reports | Requirement |
| --- | --- | --- |
| `EP-LOCAL-STALE` | A local choice whose reason is gone: an item skipped because another scope provided it, an exclusion of the user rules file, or an opt-out `false`, after that scope dropped the item | S-11 |
| `EP-LOCAL-EXPOSED` | A local file that git now tracks or no longer ignores, or a local target that git tracks (refused) | S-3 |
| `EP-LOCK-ENGINE-MISMATCH` | The project lock names another engine version; names the version to install, changes nothing | S-7 |
| `EP-SURFACE-SPLIT` | The terminal and apps started from the desktop resolve different config folders or state roots, so a user-scope install loads on one surface only | S-12 |
| `EP-CONFIG-SYNCED` | The agent's config folder is inside a synced folder or a git repository, so changes reach other machines; informational | S-12 |

## 10. Testing

- `node:test` suites; fixtures are built at run time in temp dirs (fake home, fake config dirs, fake repos with `git init`), so no personal paths ever appear in the repository.
- Golden plans per fixture (N-1); property test that the journal is a subset of the approved rows (L-2); fault injection with `EP_FAULT_AFTER=<k>` (a stop between rows) and `EP_FAULT_MID=<k>` (a crash inside a row, after its change and before its records) (L-7); idempotence (L-4); cross-fixture byte equality for project files (S-4, N-9).
- Usage-parser fixtures (TE-A3): usage repeated across content blocks of one message counted once; subagent records included; UTF-8 transcripts on Windows; non-object records skipped; a run whose assistant rows carry all-zero usage (CC#95555) is recorded as missing data, not as free.
- CI matrix: windows-latest (PowerShell 5.1, PowerShell 7, Git Bash), ubuntu-latest, macos-latest; plus a weekly job against the latest Claude Code and Codex CLIs that installs into throwaway config dirs and runs the fixture suite, as the current `codex` job does.

## 11. Repository checks (`scripts/check.mjs` for v8)

Keep: marketplace and manifest invariants, no root files that load into sessions (now including a root `plugin.json`), explicit-only skills, description limits, no placeholders, no personal paths, no emails in manifests. Add: registry schema validation; `docs/decisions.md` and `PLAYBOOK.md` match their rendering; content budget per scope; plain-wording lint over `content/` (C-8); engine module line budgets; skill files under 60 lines; no git write subcommands in the engine (L-11); no `.ps1` entry points and no execution-policy changes anywhere; no invisible or bidirectional control characters in `content/`, `registry/` or skills; `SECURITY.md` present (N-12); shipped text files use LF and no byte-order mark (CC#105838, CC#73158). Drop: the check that the runner block in `PLAYBOOK.md` equals `skills/setup/run.mjs`, once the playbook is generated.
