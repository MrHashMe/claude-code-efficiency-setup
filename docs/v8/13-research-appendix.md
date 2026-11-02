# 13. Research appendix

Status: draft for review, 2026-11-01. How the research behind these documents was done, what it covered, what it missed, and how much is probably still unseen. Sources are in [14-sources.md](14-sources.md).

## 1. Method

The research followed a published protocol for design work (frontier scout, full mode), run on 2026-11-01 with a freshness window of 12 months for fast-moving claims and 36 months for mature ones.

| Round | What was done | Output |
| --- | --- | --- |
| R0 Frame | Goal stated apart from any solution; hard constraints, users, ranked quality attributes | Problem contract in [01-proposal.md](01-proposal.md) |
| R1 Vocabulary | Automated sweep of GitHub, arXiv, Hugging Face Papers and Hacker News since 2026-05-05, plus GitHub metadata checks | 32 terms new to the brief (section 3) |
| R2 Analogs | Census of 16 comparable projects; deep studies of TokenEconomizer and Ponytail; separate studies of token-saving tools, Codex and cross-agent standards, and Claude Code's native scope features | [02-landscape.md](02-landscape.md) |
| R3 Dimensions | 25-dimension coverage check | Section 2 |
| R4 Alternatives | Four whole-system alternatives and a hybrid, compared on scenarios | [01-proposal.md](01-proposal.md) |
| R5 Ledger | One row and one decision per candidate, with kill tests for every Trial | [03-admission-ledger.md](03-admission-ledger.md) |
| R6 Omission scouts | Independent scouts that saw only the brief, never the draft; findings reconciled against the draft's concern list; capture-recapture estimate of what is still unseen | Section 4 |
| R7 Verify | Re-check of versions, dates, licenses and API names; weakest points and rejected criticisms | Section 5 |

Research was done by one model family (Claude). The protocol's ensemble step, scouts from other model families, wasn't run: it would send the brief to another provider from this session, which the owner's constraints exclude. All coverage estimates below are therefore lower bounds on what is unseen, since scouts from one family share blind spots.

No code from any studied project was run. Downloaded sources were read as data in isolated folders.

## 2. Coverage of the 25 dimensions

| # | Dimension | Status | Where |
| --- | --- | --- | --- |
| 1 | Problem and value | Addressed | 01 problem contract and gaps; "what would flip the choice" names the native features that would make v8 unnecessary |
| 2 | Users, stakeholders and jobs | Addressed | Individual users, teammates, repository maintainers, the playbook maintainer: 07 section 6, 08 (U, T, E, M workflows) |
| 3 | Functional scope and non-goals | Addressed | 04 goal and non-goals, 05, 10 "Not defended" |
| 4 | Data | Addressed | State, journal, backups and bench data stay local with bounded retention: 06 section 4, 09, 10 T6, L-10 |
| 5 | Knowledge and retrieval | Addressed, narrow | v8 does no retrieval itself; docs lookup and code navigation are components in 03 |
| 6 | Models and inference | Addressed | Native effort defaults left alone in 03; native effort features, including `CLAUDE_CODE_SUBAGENT_EFFORT`, in 02; model pinning and drift in 09 |
| 7 | Agents, orchestration and tools | Addressed | Engine versus agent roles (ADR-0001), explicit-only skills, subagent cost in 09, hooks not a security boundary (10) |
| 8 | Evaluation and quality | Addressed | 09 bench v2 and the component admission protocol; kill tests in 03 |
| 9 | Observability and debugging | Addressed | Journal (06 section 4.5), `ep show` and `verify` (07 section 9), bench fingerprints (09) |
| 10 | Security | Addressed | 10 threat model, STRIDE, T1 to T20, invariants I1 to I7 |
| 11 | Privacy and data protection | Addressed | No egress by default (01, C-5), credential paths never opened (I4); v8 collects no personal data and has no telemetry |
| 12 | Safety and misuse | Addressed | Consent per item, policy respected (U-4), rollback and uninstall as the kill switch; no autonomy defaults changed |
| 13 | Compliance and governance | Addressed, narrow | Managed policy (T13), EU Cyber Resilience Act position in `SECURITY.md` (N-12). AI governance frameworks such as ISO/IEC 42001 aren't relevant to a local configuration tool that makes no model decisions |
| 14 | Reliability and resilience | Addressed | Atomic writes, journal, idempotence, fault injection (L-4, L-7, 06 section 6.2) |
| 15 | Performance and scale | Addressed, narrow | The performance that matters is tokens per session and prompt-cache reuse (next-session rule, 07 section 10); engine run time isn't critical |
| 16 | Cost and unit economics | Addressed | Tokens per accepted task as the goal, budgets of 600 tokens (user) and 700 (project), bench cost (09), maintainer cost as the main program risk (01) |
| 17 | Deployment and sovereignty | Addressed | Local only, user-level installs, no admin rights, no cloud component; uninstall is the exit path |
| 18 | UX, accessibility and localization | Addressed, partly | Scope question first, grouped consent, 15-line report, plain wording (C-8). English only; localization isn't planned |
| 19 | Developer experience and maintainability | Addressed | Zero dependencies, module size budgets (06 section 3), repository checks (06 section 11), weekly CI against the latest agents |
| 20 | Interoperability and standards | Addressed | AGENTS.md, Agent Skills and Agent Plugins (02, 07); Codex adapter in v8.1; Harbor task export is Assess |
| 21 | Market, competition and timing | Addressed | 02 |
| 22 | Business model and go-to-market | Not relevant | A free MIT-licensed plugin distributed through agent marketplaces; there is no buyer or pricing |
| 23 | Operations, support and team | Addressed | One maintainer named as the main risk (01), weekly evidence refresh (08, M1), private security reporting (N-12) |
| 24 | Lifecycle, migration and exit | Addressed | Migration from v7 (11), per-scope uninstall and rollback (06 section 6.3), roadmap and kill criteria (11) |
| 25 | Legal, IP and licensing | Addressed | Component licenses in the registry (06 section 4.1) and in 03 (for example token-optimizer's PolyForm Noncommercial license, which counted toward its Reject) |

## 3. New to the brief (round R1)

Terms and projects the brief didn't name, found by the sweep. Star counts and dates are from the GitHub API on 2026-11-01.

| Term | Meaning | Example source, date | Use in v8 |
| --- | --- | --- | --- |
| Harness engineering | Designing everything around the model: context, tools, loops, checks | lopopolo/harness-engineering v1.0.0, 2026-07-18 | Frames v8 as a harness-configuration tool |
| Harness optimization from traces | Change the harness, not the weights, from observed failures, keeping cost-quality Pareto winners | HarnessPro (HF 2610.26770, 2026-10-19); AutoSaddler (arXiv 2608.23041) | Personal tuning loop: Assess, v8.3+ |
| Pareto cost-quality frontier | Keep only configurations no other beats on both cost and quality | HarnessPro; SelfBench | Bench report view |
| Component-level harness ablation | Measure each harness component's effect separately | HF 2609.20804, 2026-09-17 | Per-component verdicts |
| Evidence-based agentic software engineering | Results depend on model and harness, so harness choices need evidence | arXiv 2610.35348, 2026-10-26 | Same thesis as the playbook |
| Plugin marketplace co-evolution | Study of maintenance and breakage in Claude Code plugin marketplaces | arXiv 2608.28497, 2026-08-28 | Weekly compatibility CI |
| Verification strategies in harnesses | Instructions, reminders, gates or independent critics | HF 2610.34577, 2026-10-25 (independent critics strongest) | Verify step design |
| Failure attribution | Attribute failures to harness components from traces | Trial by Trace (arXiv 2610.32285) | Bench diagnostics |
| Progressive disclosure | Load guidance only when the behavior needs it | Harness Handbook (HF 2607.13285); ratel-ai/ratel | Explicit skills over always-loaded text; path-scoped rules on Hold (03) |
| Self-evolving skills | Optimize skill text as agent state | SkillOpt (HF 2605.23904) | Assess |
| Exploration specialists | Separate repository exploration from solving to cut tokens | FastContext (HF 2606.14066) | Explore-subagent guidance |
| Realistic user requests | Short, casual prompts; stating intent and motivation helps | RealSWE (HF 2608.27831) | Bench prompts written like the user writes |
| Evolving-requirements evaluation | Tasks refined after trying an implementation | arXiv 2610.35488 | A stated bench limitation |
| Predictive validity of agent evals | Static leaderboards are rank-unstable for deployment decisions | HF 2606.19704 | Argues for personal benchmarks |
| Personal benchmark from merged PRs | Tasks from the user's own pull requests with hidden tests | mupt-ai/self-bench, release prod-20261101-6cb6593 (2026-11-01) | Its gates adopted in bench v2 (09); its hosting not |
| Harbor task format | Task and runner format from the Terminal-Bench team | harborframework.com | Export format: Assess |
| Local usage analyzers | Read local session logs for tokens, cache hits and cost | d-date/retok; ccusage | Local-only analytics |
| OpenTelemetry for agents | Traces and metrics to a collector | Claude Code OpenTelemetry export | Local collector only, never remote by default |
| Declarative agent configuration | Desired-state file for plugins, marketplaces and MCP servers | adamancini/clew v1.1.0, 2026-04-16 | Confirms the desired-state model |
| Plan and apply | Terraform-style plan, approve, apply | Terraform; chezmoi; Nix home-manager | The engine's core workflow |
| Agent-rules lint and drift checks | Lint instruction files for drift, dead paths and bloat in CI | Agent-Config-Sync (2026-10-31) | `verify` and the CI budget gate |
| One rules source for many agents | Compile rules into each agent's files | ai-rules-sync; agentsync | Adapter layer (ADR-0007) |
| Effective-configuration viewers | One view of every active setting, rule, skill and hook | claude-config-map; agent-cockpit | `ep show` |
| Agent-guided configuration | The agent executes an install document | Mizoreww/awesome-agent-config v4.2.0, 2026-10-09 | Closest competitor; same nondeterminism as v7 |
| Always-on token-saving skills | Prompt rules that claim lower bills | token-diet (no license, no releases); benjamin-plus | Admitted only with paired evidence |
| Tool and skill overload | Too many tools and skills dilute selection and cost context | ratel; Claude Code's skill-listing budget | Context budget gate |
| Team configuration blueprints | Shared team configuration repositories and marketplaces | claude-code-team-commander; hmcts/agentic-plugins-marketplace | Demand signal for `project` scope |
| Agent governance for teams | Policy, sandboxing and audit for coding agents | Blue; OneCLI (Hacker News, 2026) | Respect managed policy; not built |
| Context garbage collection | Prune stale context mid-session | Hacker News, 2026-10-28 | Hold: rewrites history and breaks caching |
| Token cost by language | Languages differ in tokens per task | danluu.com/pl-tokens, 2026-08-10 | Not actionable |
| Limits of harness engineering | Automated pipelines fail without human judgment loops | humanlayer essay, 2026-07-23 | Keep consent and human review |
| Harness safety auditing | Correct output can hide unsafe steps | HF 2605.14271 | Bench logs tool actions, not only pass or fail |

## 4. Omission scouts and the coverage estimate

### Scout 1

A fresh Claude subagent that saw only the brief listed 59 concerns any design for this problem must handle. Reconciled against the draft's frozen list of 98 concern IDs: 39 were already covered, 10 were new and decision-changing, 10 were new but minor.

Capture-recapture estimate (Chapman, n1 = 98, n2 = 59, m = 39): about 147.5 concerns in total (95% interval about 127 to 168), so about 29.5 still unseen. The Chao2 estimate gave 158 total and about 40 unseen. Verdict: not saturated, so a second scout with different lenses was run.

The 10 decision-changing findings and where each landed:

| Finding | Change |
| --- | --- |
| Uninstall collateral (removing a marketplace uninstalls all its plugins; "uninstall for everyone") | L-12; 06 section 6.3; 07 section 7; 08 U5 |
| Malware persisting through agent configuration | U-5; T15; `EP-UNOWNED-EXECUTABLE-CONFIG` |
| Headless Claude Code runs skip workspace trust | M-9; T17; every bench `validate` and `run` lists what will execute and needs a freshly typed code |
| Windows file semantics (line endings, byte-order marks, symlinks) | N-11; 06 section 7 |
| Infrastructure noise in paired runs | 09: an A/A batch sets the noise floor |
| Memory contamination between bench arms | 09: auto memory off, identical starting state, tuning and judging tasks kept apart |
| Silent truncation of instruction files | C-9; `EP-SIZE-CAP`; 07 section 3.3, rule 5 |
| User rules conflicting with a project's conventions | C-8: the precedence sentence in user-scope rules |
| Claude Code mods sit above hooks and permissions | T18; `EP-MOD-PRESENT`; mods Rejected in 03 |
| Prompt style changes with each model generation | C-8 plain wording; owned text re-validated on each model generation |

Minor findings that were also applied: third-party guards labeled advisory; no bundled third-party skills; no `.ps1` entry points or execution-policy changes; hook counts per event; skipped Codex hooks detected (v8.1); owned drift separated from external drift; explicit-only skills; telemetry opt-out side effects reported; a `SECURITY.md` with a Cyber Resilience Act position; hooks stated as advisory, not enforcement, in the threat model.

### Scout 2

A second fresh Claude subagent, again seeing only the brief, used other generators: user personas and time horizons (day 30, the next agent major release, a maintainer away for three months, a move to a new machine). Its 45 concerns reconcile to 44 distinct IDs: 35 already on the draft's list, 5 that scout 1 had found, and 4 new and minor. None was decision-changing. The minor ones were applied: a preview that matches the real run (already met by the plan hash, stale rows and redaction), an agent that isn't installed (06 section 6.1), endpoint protection blocking writes (06 section 6.2) and Windows path length (06 section 7). One draft concern turned out under-specified in the documents: what a session started in a monorepo package folder or in a cloud session loads. It now has `ep show --from`, a `verify` check, test 17 and P0 item 16 in 07.

Estimates: draft × scout 2, Chapman 122.8 in total (95% about 108 to 137), about 16 unseen; scout 1 × scout 2, 107.0 (about 86 to 128), about 28 unseen. Chao2 across the three lists: 153.3 in total, about 31 unseen (62 concerns on exactly one list, 41 on exactly two). Reading: not saturated. Both scouts are Claude, so correlated misses make this a lower bound. Most single-list concerns (43 of 62) are draft concerns that neither scout named, which keeps the estimate high.

### Scout 3

A third Claude subagent changed the source type rather than the lens: failure reports in the issue trackers of Claude Code, Codex, ECC and rulesync, for issues updated from 2026-05-01 to 2026-11-01 (119 read-only searches; the scout reports re-fetching the state and dates of all 387 cited issues on 2026-11-01). Its 45 findings reconcile to 39 distinct IDs: 34 already on the earlier lists and 5 new. Most findings back existing choices with field reports rather than adding concerns: no `CLAUDE.md` and no symlinks, each agent its own copy, key-level ownership, journaled atomic writes, a delivery check on every bench run.

One was decision-changing. Rules with `paths:` frontmatter don't load reliably: open reports show them loading at session start (CC#16299, open since 2026-01, though a later comment there found the body deferred) and not loading for a newly written file (CC#96361). ADR-0006 had named path-scoped rules as a way to fit new guidance under the cap. Now owned text in such a rule counts as always loaded (C-3), the ADR's consequence is changed, and the technique is on Hold in 03.

Four minor findings were applied: at `project` scope the engine writes only an allowlist of files and keys, since one repository's `cleanupPeriodDays` deleted transcripts machine-wide (I6; CC#90148); v8 writes no `@` imports, which fail silently (07 section 3.1); WSL counts as a separate machine (07 section 2.5); an issue's state is never a revisit trigger, since the claude-code stale bot has closed thousands of reproduced issues (08 M1; CC#87647). Smaller precision fixes from the same report: a late revert by a session left open (07 section 10); a documented `AGENTS.md` behavior that an open report contradicts (07 section 3.1, test 4); LF-only shipped files (06 sections 1 and 11); the delivery check confirming that excluded content is absent (09); zeroed usage rows and hung headless processes in the bench (06 section 10, 09); the fingerprint recording the model the transcript reports (09); `rollback` from a plain terminal (06 section 6).

Estimates with four lists (the draft and scouts 1 to 3; 127 distinct concerns): draft × scout 3, Chapman 140.4 in total (95% about 117 to 164), about 30 unseen; Chao2 across the four lists, 166.6 in total and about 40 unseen (59 concerns on exactly one list, 33 on exactly two). Reading: not saturated. The estimate rose with scout 3 because a new source type brings new single-list concerns.

**Stop reason.** The protocol stops when a round adds no decision-changing finding and Chao2 puts fewer than one concern unseen. Neither holds: scout 3 added one decision-changing finding, and about 40 concerns remain unseen by the estimate. Strictly, the protocol asks for another scout after such a round. The research stopped here for two reasons. Scout 3's decision-changing finding was narrow (a budget-counting rule, not the architecture), and scout 2, with different lenses, found none. The lever that would most reduce correlated misses, scouts from other model families, means sending the brief to another provider, which the owner's constraints exclude (section 1). The estimates are lower bounds, and a non-Claude scout is the first thing to run if that constraint is lifted.

### Red-team review of the scope design

A separate review attacked the three-scope design (07) with the user's request in mind: install for every project, or for one project only. Its high and medium findings changed the design:

| Finding | Change |
| --- | --- |
| A home folder kept as a git repository makes "project" files load everywhere | `project` and `local` need a git working tree outside home, its parents and config folders (07 section 1, rule 6) |
| Enabling a hook-running plugin at `project` scope overrides each teammate's own choice | Components with hooks, per-user state, `env` or machine tools are only recommended by the lock and enabled per person (07 section 1, rule 2; S-10) |
| Uninstalling one scope ran a third-party cleanup that other scopes still needed | Plugin installs are reference-counted; third-party cleanup runs only when the plugin leaves the machine (07 sections 2.3 and 7) |
| Serving both agents from one copy made committed bytes depend on each person's files | Each agent gets its own copy; the duplicate is reported (07 section 3.3, rule 3) |
| Ownership remembered on one machine broke on other clones, branches and worktrees | Project ownership is derived from the lock in the checkout; local items are per worktree; rollback refuses in another worktree (07 section 3.3, rule 6; S-7) |
| Local files could reach a commit | Local scope refuses tracked targets, adds exclude lines for every file and re-checks them (`EP-LOCAL-EXPOSED`) |
| Local choices outlived the scope they depended on | `satisfiedBy` and `dependsOn`, re-checked by every plan and verify (`EP-LOCAL-STALE`, S-11) |
| Removing the plugin stranded scopes the engine could no longer clean | `ep show --installs`; plugin removal is suggested only when it lists nothing (08 U5) |
| Synced or relocated config folders | `EP-SURFACE-SPLIT`, `EP-CONFIG-SYNCED`, a user lock and machine ids (07 section 2.5, S-12) |
| Codex caps and the override file | Cap summed along every `AGENTS.md` path; an override kept non-empty only by v8's block is reported (07 section 3.3, rules 2 and 5) |

### Findings from the research agents

The R2 studies also changed decisions, outside the scout count: creating a `CLAUDE.md` stops Claude Code from reading `AGENTS.md`, which moved all Claude Code text into owned `rules/` files (07 section 3.3); Codex force-reinstalls unpinned Git marketplaces at startup (T19, pinned installs); Plugin4Shell set minimum agent versions (T16, 07 section 11); a pack installed both as a plugin and as copied files on the machine where this design was written doubled about 7,800 tokens of descriptions (07 section 5, `EP-ROLE-CONFLICT`).

## 5. Weakest points and rejected criticisms (round R7)

Three weakest points of the recommended design:

1. **Maintenance load.** One maintainer must keep two agent adapters, a key table of where each setting works, and the registry current while both agents ship weekly. Weekly CI catches breakage but doesn't fix it. If the maintainer stops, installs keep working and uninstall works offline, but evidence goes stale.
2. **Unproven savings.** The engine's main benefit, setup at least three times cheaper than v7.3, is an estimate until P0 measures it. The bench has low power: about 5 tasks × 2 runs detects only effects of roughly 34 to 46%, so most Trial verdicts will stay `inconclusive` for months, and defaults change slowly.
3. **Agent behavior not yet exercised.** Several placement rules rest on facts read in docs or source but not yet tested (07 section 13), for example that Claude Code loads git-ignored files under `.claude/rules/`. If that fails, `local` scope for Claude Code needs another home, and K-SCOPE can drop it for that agent.

Three strongest criticisms considered and rejected:

1. **"Ship only plugin components and drop the engine."** Rejected: plugins can't express settings keys with restore, rules files at `project` and `local` scope, machine tools, migration or per-scope undo. This flips if the agents ship declarative configuration bundles with undo at all three scopes (01).
2. **"A personal bench is too expensive and too weak; trust published benchmarks."** Rejected: the published numbers for the main candidates were measured in settings unlike users' (Ponytail v5 with Bash disabled; TokenEconomizer on a configuration it doesn't ship), and cheap baselines such as lower effort came close. The bench is opt-in for users; the maintainer runs it for defaults.
3. **"Node 22 is a prerequisite users don't have; write the engine in PowerShell and shell script."** Rejected: two script dialects double the code and tests and still differ across systems; one zero-dependency Node engine runs on Windows, macOS and Linux and is testable. Node is offered as a user-level install when missing (owner decision 1 in 01).

## 6. Open questions

- Whether changing effort keeps the prompt cache on every provider route. It does on the first-party API; the exceptions found (some cloud providers, gateways, a beta-disabling variable, HIPAA setups) need a bench note.
- How subscription plans count cached input against usage limits, compared with API price weights used for cost per accepted task (09).
- Whether the EU Cyber Resilience Act applies to a free, MIT-licensed plugin; `SECURITY.md` states a position, but no legal advice was obtained.
- A `local` scope for Codex (07 section 2.4).
- The seventeen facts to confirm in P0 (07 section 13); items 2 to 4 and 12 are now partly answered from the docs.
- Whether `claude plugin eval` can run bench tasks on native Windows; it refuses suites that grant shell access there and needs WSL2.

## 7. Research log

- **Rounds run:** R0 to R5 in full; R6 with three Claude scouts and a red-team review of 07; R7 in the review step before delivery.
- **Query families:** problem-phrase sweeps over code hosts, paper indexes and forums; vendor documentation and changelogs (Claude Code, Codex); GitHub repositories, issues and releases of each studied project; package registries; security advisories; independent and vendor benchmark reports; standards bodies' pages (AGENTS.md, Agent Skills, Agent Plugins, MCP).
- **New candidates per round:** R1, 32 terms; R2, 16 analogs plus the token tools, sync tools and native features in 02; R6 scout 1, 10 decision-changing and 10 minor concerns; scout 2, 4 minor concerns and one under-specified draft concern; scout 3 (issue trackers), 1 decision-changing and 4 minor concerns; a red-team review of 07, 10 design changes.
- **Retrieved content treated as data:** one vendor's documentation index contained text addressed to coding agents asking them to stage settings changes, and a Claude Code documentation page carried a note telling AI readers to fetch an index file first. Neither was acted on.
- **Stop reason:** see section 4.
