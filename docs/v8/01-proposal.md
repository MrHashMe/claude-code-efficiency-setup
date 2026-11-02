# 01. Proposal: Efficiency Playbook v8

Status: proposal for the owner's decision, 2026-11-01. Facts carry a source in [14-sources.md](14-sources.md); estimates and recommendations are labeled as such.

## Executive answer

1. **Recommendation:** rebuild the playbook as a deterministic, desired-state configuration engine with an evidence registry and a personal benchmark, packaged in the existing plugin, installable at three scopes: all projects, one project for the team, one project just for me. Codex gets the first two; it has no personal per-project layer that wouldn't hide the team's files ([07-install-scopes.md](07-install-scopes.md), section 2.4).
2. **Why:** v7's main cost and risk is that the agent executes about 700 lines of prose on every setup; a script does that work identically every time for a fraction of the tokens (estimate; measured in phase P0). Scope choice needs real uninstall and precedence handling, which prose can't do reliably.
3. **What makes it better than comparable projects:** they either let the agent run an install document (awesome-agent-config), inject rules without per-user measurement (Ponytail), change settings without per-change consent (TokenEconomizer's default writes deny rules with no per-change approval), or sync rule files without evidence. v8 combines plan, consent, apply, verify and undo per scope with dated, labeled evidence and a gate that measures components on the user's own tasks against cheap baselines (lower effort, a one-line rule).
4. **Biggest risk:** maintenance load. One maintainer must keep adapters current while both agents ship weekly. Mitigation: zero dependencies, small modules, a weekly CI run against the latest agent releases.
5. **What would change this:** P0 failing its kill tests (setup not at least 3 times cheaper, or a native scope mechanism unusable), or the agents shipping native declarative configuration bundles with undo at all three scopes.

## Problem contract

- **Goal.** Correct, maintainable results from AI coding agents for the fewest tokens per accepted task, by configuring the user's own environment.
- **Hard constraints.** User picks the install scope (all projects, one project for the team, or one project just for me), and each scope installs, upgrades, verifies and uninstalls cleanly, with defined interaction. No measured loss of task quality. Consent before every change; reversible; idempotent. No admin rights, no piped remote scripts, no system-wide changes. No third-party egress of code, prompts or transcripts by default (Context7 lookups are the opt-in exception). Respect managed policy. Never commit or push. Works on native Windows with PowerShell and Git Bash. Every recommended component has dated evidence, vendor-run results labeled.
- **Must not.** Add always-loaded context that doesn't pay for itself; break prompt caching or sit in the request path; duplicate a native role.
- **Ranked quality attributes.** 1. task quality does not fall; 2. tokens per accepted task fall; 3. safety and reversibility; 4. reproducibility; 5. low friction and maintainability. Scenarios and acceptance checks are in [04-requirements.md](04-requirements.md).
- **Assumptions.** Documents now, implementation later. Windows remains the primary platform; macOS, Linux and WSL are supported if cheap (the design makes them cheap).

## Where v7 falls short

| Gap | Evidence | v8 answer |
| --- | --- | --- |
| Setup is an LLM-executed program | PLAYBOOK.md Part 1 is about 700 lines the agent reads and executes per run | Engine executes; the skill explains and asks (ADR-0001) |
| User scope only | v7 ground rule "user-level installs only" | `user`, `project`, `local` scopes end to end ([07](07-install-scopes.md)) |
| Evidence is hand-maintained prose | Part 2 tables; no freshness check | Registry as data, CI-validated, weekly freshness flags (ADR-0004) |
| Listing cost of a model-invocable skill and a startup hook in every session | v7 installs `project-setup` (model-invocable) and a SessionStart nudge | Explicit-only skills in the plugin; nudge opt-in (ADR-0002) |
| Third-party installs go stale | This machine runs Ponytail 4.10.0; 5.3.3 is current and 4.10.2 fixed a security issue (Ponytail releases, 2026-10) | Registry minimum versions; `verify` flags; upgrades as consented plan rows (ADR-0009) |
| Paired-check lacks a determinism gate, intervals and cheap baselines | v7 runner gates: history-free, fails at base, passes at reference; "never call a difference significant" | Bench v2: four gates, reference arms, bootstrap intervals, non-inferiority rule ([09](09-evaluation-plan.md)) |
| Two hand-written playbooks drift | PLAYBOOK.md v7.3 and PLAYBOOK-CODEX.md v1.0 | One content source, per-agent adapters (ADR-0007) |
| Windows only | Part 1 stops on other systems | Node engine with three-OS CI (ADR-0008) |

## Landscape in brief

Full analysis in [02-landscape.md](02-landscape.md). Summary of what the strongest comparable projects teach:

- **TokenEconomizer** (Microsoft Research and partners, Apache-2.0, created 2026-10-13): hooks only, no proxy, ownership records for the settings it edits, next-session application to protect the prompt cache. Its 18.4 to 30.9% savings are vendor-run, without intervals, on a configuration different from the one it ships; lowering effort alone came close. Take its discipline, don't bundle it.
- **Ponytail** (single maintainer, MIT, v5.3.3 on 2026-10-29): rules injected by hooks actually activate; v5 halved the rules' size. Independent evidence exists only for v4: JetBrains measured 10.3% lower cost (p = 0.004) over 80 paired tasks, on Ponytail 4.8.4, Claude Code 2.1.201 and Sonnet 5 at medium effort. v5 gains are vendor-run, with Bash, CLAUDE.md loading and auto memory off. Keep it optional, pinned and measured against a one-line rule.
- **Agent-run install documents** (awesome-agent-config): flexible, but every install is a new, nondeterministic program execution, which is v7's problem too.
- **Personal benchmarks** (SelfBench): the right gates (smoke, nop, oracle, determinism, independent review), but hosted and tied to a GitHub repository connection. Take the gates, keep data local.
- **Rules-sync, skill-distribution and config-viewer tools**: useful single ideas (one source, effective-config view, a hash lock). Some are widely used (on 2026-11-01, vercel-labs/skills had about 37.5k stars and rulesync about 335k npm downloads a week; microsoft/apm adds a hash lock, an audit and hidden-Unicode scanning), but each would be a runtime dependency targeting 32 to 79 agents, with no evidence records. Build the two small pieces into the engine and copy ai-rulez's ownership model instead of depending on them.

## Alternatives

| | A. Simplest | B. Plugin-native only | C. Frontier | D. Contrarian | Recommended hybrid |
| --- | --- | --- | --- | --- | --- |
| Idea | Keep the prose playbook; add project-scope steps | Ship rules, skills and settings as plugin components; rely on native plugin scopes | A self-tuning harness: mine traces, search configurations on a cost-quality Pareto front, apply the best | Read-only doctor and bench: advise, never write | Native mechanisms where they suffice, deterministic engine for the rest, registry as data, bench as the promotion gate |
| Task quality | Unmeasured unless the user benches | Unmeasured | Measured continuously, but research-grade | Measured | Measured before Adopt; non-inferiority rule |
| Setup tokens | High (prose per run) | Low | High (runs) | Low | Low (estimate, P0 measures) |
| Scope support | Prose for three scopes; error-prone | Plugins yes; rules, settings keys and machine tools no | Not addressed | Not applicable | All three, end to end |
| Reversibility | Prose rollback | Native plugin uninstall only | Hard (continuous changes) | Nothing to reverse | Journaled undo per scope |
| Reproducibility | Low | High for plugin parts | Low | High | High (deterministic plans) |
| Maintainability | Low (large prose) | High | Low | High | Medium: small engine, weekly agent CI |
| Fit to constraints | Meets most, weakly | Fails scope for non-plugin items | Conflicts with consent per change and local-only data unless heavily gated | Fails "set it up once" | Meets all |

**Choice:** the hybrid. B's native pieces carry plugin enablement and skills; the engine covers what plugins can't express (rules files, settings keys with restore, machine tools, migration, per-scope undo); D's read-only doctor exists as `verify` and `show`; C's tuning loop is an Assess item for v8.3+, opt-in, propose-only.

## What would flip the choice

| Evidence | Flip to |
| --- | --- |
| P0: engine setup not at least 3 times cheaper than v7.3, or no more reliable on the 20 fixtures | A, improved prose |
| Agents ship native, declarative configuration bundles with undo at user, project and local scope | B, a thin wrapper |
| Independent replications show trace-driven tuning loops saving 15% or more at non-inferior quality on personal tasks | Pull C forward |
| Users decline most writes in practice (opt-in usage reports, if ever collected locally and shared voluntarily) | D |

## Risks and how they're contained

| Risk | Containment |
| --- | --- |
| Agent releases break adapters weekly | Weekly CI against the latest CLIs in throwaway config dirs; adapters isolate agent specifics; registry tested versions |
| Engine bugs damage configuration | Key-level backups, atomic writes, parse-after-write, journal, quarantine instead of delete, fault-injection tests |
| Evidence goes stale | Freshness windows and revisit triggers in the registry; one weekly tracking issue |
| Bench results misread as proof | Intervals, pre-registered decision rule, `inconclusive` outcome, validity threats in every report |
| Project scope surprises teammates | Only committed-safe file kinds at project scope; native trust and install prompts; no hooks, MCP servers or permission rules there; components that run hooks, keep per-user state, need `env` or need a machine tool are only recommended by the lock |

Kill tests for every Trial item are in [03-admission-ledger.md](03-admission-ledger.md).

## Roadmap

P0 spike and kill tests (1 to 2 weeks), v8.0 Claude Code parity at three scopes (4 to 6 weeks), v8.1 Codex parity, v8.2 maintenance automation, v8.3+ Assess items. Estimates, not measurements. Details in [11-migration-and-roadmap.md](11-migration-and-roadmap.md).

## Decisions for the owner

1. Accept Node 22+ as a setup prerequisite (offered as a user-level install when missing)?
2. Support macOS and Linux in v8.0, or keep v8.0 Windows-only and add them in v8.1? Recommendation: all three in v8.0, as N-3 and the CI matrix already assume.
3. Default profile: Adopt components and "Trial, on" components (owned or first-party, no egress and nothing in the request path, reversible, already scheduled in the maintainer bench) preselected; other Trial components shown but unchecked; third-party components never preselected?
4. Project lock file name and location: `.efficiency-playbook.json` at the repository root?
5. Keep `PLAYBOOK.md` as a generated manual guide, or retire it?
