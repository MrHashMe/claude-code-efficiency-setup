# Efficiency Playbook v8 design documents

Status: design of 2026-11-01. v8.0 for Claude Code was built from it on 2026-11-02 and is awaiting review; v7.4 is the released version. Where the build differs from these documents, [8.0 as built](#80-as-built) says so.

v8 turns the playbook into a deterministic configuration engine with an evidence registry and a personal benchmark, installable for all projects (`user`), for one project and its team (`project`) or for one project just for you (`local`), for Claude Code (v8.0) and Codex (v8.1).

## Documents

| File | What it answers |
| --- | --- |
| [01-proposal.md](01-proposal.md) | What to build, why, the alternatives, and the decisions the owner must make |
| [02-landscape.md](02-landscape.md) | What comparable projects do well and badly, including TokenEconomizer and Ponytail |
| [03-admission-ledger.md](03-admission-ledger.md) | The verdict on every candidate component, with kill tests |
| [04-requirements.md](04-requirements.md) | Requirements with acceptance checks |
| [05-architecture.md](05-architecture.md) | Components, data flow and key decisions |
| [06-design.md](06-design.md) | Engine commands, data formats, algorithms, verify findings, tests |
| [07-install-scopes.md](07-install-scopes.md) | All projects, one project for the team, or one project just for me: where everything goes and how scopes combine |
| [08-workflows.md](08-workflows.md) | Install, upgrade, uninstall, team, benchmark and maintainer workflows |
| [09-evaluation-plan.md](09-evaluation-plan.md) | How components and v8 itself are measured |
| [10-threat-model.md](10-threat-model.md) | Threats, mitigations and the invariants tests enforce |
| [11-migration-and-roadmap.md](11-migration-and-roadmap.md) | Moving from v7, phases, and program kill criteria |
| [12-decision-records.md](12-decision-records.md) | Architecture decision records |
| [13-research-appendix.md](13-research-appendix.md) | Research method, coverage, omission scouts, open questions |
| [14-sources.md](14-sources.md) | Sources with dates and status |

## Reading order

- **Deciding whether to proceed:** 01, then 07 section 1, 03 sections 1 to 3, and the roadmap in 11.
- **Building it:** 04, 05, 06, 07, 08, 10.
- **Checking the evidence:** 02, 03, 09, 13, 14.

## Conventions

- Fast-moving facts carry a date and a status: Verified (source, date), Inferred, Assumption or Unknown. Results measured by a project's own authors are labeled vendor-run. Estimates and recommendations are labeled as such.
- IDs: requirements S, L, C, M, E, A, U, N (04); assets A1 to A6, threats T and invariants I (10); kill tests K- (03); TokenEconomizer ideas TE-A and TE-T (02, 03); workflows U1 to U8, M1 and M2 (08); verify findings EP- (06 section 9); decision records ADR-0001 onward (12).
- Paths use `~` for the home folder, `<repo>` for a repository root and `<codex home>` for Codex's config folder.

## 8.0 as built

Where the 2026-11-02 build differs from these documents:

- **Verify findings not emitted yet.** `EP-UNOWNED-EXECUTABLE-CONFIG` and `EP-MOD-PRESENT` (U-5, a Should), `EP-SURFACE-SPLIT` (S-12, a Should), `EP-MARKETPLACE-UNPINNED`, `EP-SELF-CHECKSUM`, `EP-INSTRUCTIONS-NOT-LOADED`, `EP-LOCAL-EXPOSED`, `EP-LOCK-ENGINE-MISMATCH`, `EP-FLAGS-DISABLED`, `EP-HOOK-SLOTS` and `EP-EXTERNAL-DRIFT` (06 section 9). `EP-CODEX-PROJECT-UNTRUSTED` and `EP-CODEX-HOOK-UNTRUSTED` arrive with the Codex adapter in v8.1. No Must requirement's acceptance check depends on them.
- **Policy blocks come from `plan`.** A row that managed settings forbid is shown as blocked (`EP-POLICY-BLOCKED`) and `apply` refuses it; `verify` reports only a managed settings file it can't read (`EP-POLICY-UNREADABLE`).
- **The command map has no consent group of its own.** Its text is part of the core rules file, so it is approved with that row; 06 section 8 lists it as a separate group.
- **The nudge talks to the user, not to Claude.** It prints a `systemMessage`, so it adds nothing to Claude's context (03 estimated about 20 tokens when it fires).
- **The bench asks every time.** The design had the user confirm a repository once. After the security review, every `validate` and `run` lists what it will execute and goes on only when a fresh code from that listing is typed back at a terminal; nothing is remembered, no flag skips it, and both refuse inside an agent session. 04 M-9, 08 U8, 09, 10 T11 and T17 and 13 now say so.
- **Bench is over its line budget.** N-8 and 06 give `engine/bench` 1,200 lines; the typed-code gate, its full listing and the hardening after a second review (private state folders, a `started` line counted at the spend cap, killing the agent's process tree on Ctrl-C, an output cap) took it to about 1,340, so `scripts/check.mjs` allows 1,400.
- **Git facts without `git status`.** A project apply lists what it changed from `git ls-files` with `core.fsmonitor` off, because `git status` can run programs a cloned repository configures. The report shows those lines under "changed by this apply, as git sees them", with the `git add` to run.
- **Marketplace pins are tags.** A marketplace `ref` names a branch or tag, not a commit, so the registry pins a release tag and records the commit it tested. `verify` compares that with what Claude Code recorded in `plugins/installed_plugins.json` and `plugins/known_marketplaces.json` (`EP-COMPONENT-VERSION-UNEXPECTED`, `EP-MARKETPLACE-NOT-CANONICAL`).
- **Settings files are also copied whole** before their first edit in an apply, for restoring by hand; rollback still works key by key. 06 section 4.3 and 10 T6 now say so.
- **Backups aren't pruned yet.** L-10 (a Should) keeps the last 5 per scope; 8.0 keeps every backup and quarantined file, so nothing it saved is ever deleted.
- **Hidden characters.** `scripts/check.mjs` scans every shipped text file rather than only `content/`, `registry/` and skills, with the engine's character set, which also covers soft hyphens, the Arabic letter mark, deprecated format characters and runs of variation selectors. Everything the engine prints escapes control, format and line-separator characters (`\u{…}` for people, `\uXXXX` in JSON), so a file or branch name can't reorder or hide what follows it.
- **Left from the security review.** A rolled-back hook entry comes back re-indented, and a CRLF settings file is rewritten with CRLF throughout (whitespace only). The first apply from a lock written on another machine doesn't ask "Trust this repository's configuration?" (10 T4); every apply still needs `--approve` for the rows plan listed, and at project and local scope `claude plugin` runs with the repository as its working folder. Nothing re-reads a target just before its rename, so a save by another program between a row's read and its write is overwritten. Journal records aren't flushed to disk one by one, so a power cut (not a crash) can lose the last one. The fault switches `EP_FAULT_AFTER` and `EP_FAULT_MID` work in any run, not only in tests.
- **Limits.** Managed policy is read from files only (no MDM profiles, Windows registry or server-delivered settings). Symlinked skill folders and skills in the plugin cache aren't scanned for hidden characters. The CI matrix covers Windows, Ubuntu and macOS; before review only the Windows suite was run.
