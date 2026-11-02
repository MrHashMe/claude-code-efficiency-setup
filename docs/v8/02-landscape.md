# 02. Landscape

Status: draft for review, 2026-11-01. This page compares v8 with projects that do similar work and records what v8 takes from each. Facts are as of 2026-11-01 unless a line gives another date; sources are listed in [14-sources.md](14-sources.md). Decisions and kill tests live in [03-admission-ledger.md](03-admission-ledger.md); this page gives the reasons.

## 1. Scope and method

- **Covered.** Sixteen setup frameworks, packs and installers; TokenEconomizer and Ponytail in depth; seven rules-sync and skill tools; the token-saving tools ruled on in 03; cross-agent standards; recent research.
- **Method.** Documentation, source, issues and releases. Installed copies of ECC, compound-engineering and Ponytail 4.10.0 on the machine where this design was written were read as files. Nothing new was installed, and no benchmark was repeated.
- **Tokens** are characters divided by 4, an estimate, unless quoted from a source.
- **Labels.** Verified, Inferred, Assumption and Unknown as defined in the [README](README.md). "Vendor-run" marks a project's own results; "user report", "competitor-run" and "sponsor-run" mark other one-party results; "(inference)" marks this page's reasoning.

## 2. Summary

| Name | Kind | Maintainer, license | Latest (date) | Always-on tokens | Install scopes | Main strength | Main weakness | What v8 takes | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ECC | 71 agents, 311 skills (plugin copy; its AGENTS.md says 68 and 293), hooks | affaan-m, MIT | v2.2.3 (2026-10-01) | Listings ~33k before the 1% cap; ~2k at start | User, project, local | Hash install-state; doctor, repair, dry run; SLSA3 | Cost; plugin and file copies collide | Inventory first; dry run; repair | [Hold](03-admission-ledger.md) |
| superpowers | Skills, session-start injection | obra, MIT | v7.0.1 (2026-10-21) | ~2.3k (inference); 1.6–1.9k (user report) | Plugin scopes | Workflow discipline on 16 hosts | Companion telemetry on; no CI | Nothing | [Hold](03-admission-ledger.md); flag below 7.0.0 |
| compound-engineering | 27 skills, 9 explicit-only | EveryInc, MIT | v3.34.0 (2026-10-31) | ~1.6k | Plugin scopes; committed config plus local override | 8,000-byte skill cap in CI; no telemetry | Evals not shipped as records | Size cap in CI | No row |
| ruflo | Swarm harness | ruvnet, MIT | v3.68.0 (2026-11-01) | `init`: several thousand (inference) | Plugins; `init` per project | Plugin path writes no files; Windows CI | `init` adds 8 hook events, a daemon, MCP; unpinned | Nothing | No row |
| BMAD-METHOD | Method as modules | bmad-code-org, MIT with attribution | v6.12.4 (2026-10-14) | Unknown | Project | SHA256 manifest; uninstall keeps user files | V7 alpha warns of breaking changes | Keep user files | No row |
| spec-kit | Spec workflow CLI | github, MIT | v1.2.5 (2026-10-28) | Small (inference) | Project | Upgrade stops on edited files; composition view | Bare `self upgrade` runs unprompted | Edit-safe upgrade; inventory | No row |
| claude-plugins-official | Official marketplace | anthropics, Apache-2.0 | No releases | Per plugin | User, project, local, managed | 262 remote entries SHA-pinned; Context cost pane | Ubuntu-only CI; 202 open Windows issues | Cost on every row | No row |
| gstack | Skills, browser tools | garrytan, MIT | v1.91.318.0 (2026-10-29) | ~1.8k plus a CLAUDE.md section | User; team mode commits `.claude/` | `./setup --status`; Windows CI | Hourly unpinned team updates; outside reviews send code | Status per install | No row |
| oh-my-claudecode | Multi-agent orchestration | Yeachan-Heo, MIT | v5.7.27 (2026-11-01) | ~4.4k plus hook output | `--local` or `--global` | `/omc-doctor` finds legacy installs | Overwrites `~/.claude/CLAUDE.md` by default | Legacy-install check | No row |
| gsd-core | Workflow pack | open-gsd, MIT | v1.19.0 (2026-10-26) | Unknown | Global or local | Reapplies local patches after update | Moved organizations within months | `maintenance` field | No row |
| microsoft/apm | Config package manager | microsoft, MIT | v0.35.0 (2026-10-22) | n/a | Project or `-g` | Hash lock; hidden-Unicode scan; audit; SBOM; org policy | No measurement | Lock, audit diff, Unicode scan | No row |
| vercel-labs/skills | Skill installer | vercel-labs, MIT | v1.7.4 (2026-10-19) | n/a | Project or `-g` | Lock files; 70 to 79 agents | Telemetry on; junctions on Windows | Nothing new | No row |
| TokenEconomizer | Hooks-only optimizer | Microsoft Research and partners, Apache-2.0 | v0.1.0 (2026-10-26) | Near 0 by default; a Python process per hook event | Default plugin scope (user, assumed) | Cache discipline; ownership records | Unconsented deny rules; evidence on another configuration | Ideas TE-A1 to TE-A9 | [Reject bundling; ideas Adopt](03-admission-ledger.md) |
| Ponytail | Hook-injected rules, skills | DietrichGebert (one maintainer), MIT | v5.3.3 (2026-10-29) | ~0.7k per session and per matched subagent, plus a map | Plugin scopes; state per user | Rules that activate; v5 halved them | v5 evidence vendor-run; no security channel | Pin, matcher, uninstall script first | [Trial, off for new installs](03-admission-ledger.md) |

EP v7.4 appears in sections 5 and 6. Also read, but left out of both tables: SuperClaude, claude-code-templates, wshobson/agents and OpenSpec. None measures effect on the user's own tasks; v8 takes nothing from them. "No row" means studied for ideas only; large packs fall under 03's "ECC and other large packs" row. 01 also names awesome-agent-config and SelfBench (whose task gates 09 adopts); they are not reviewed here.

## 3. TokenEconomizer

**What it is.** A plugin from Microsoft Research, UC Berkeley and Microsoft Security (Apache-2.0; arXiv 2610.22732, 2026-10-15). v0.1.0 shipped 2026-10-26, and at least 44 commits followed without a version bump. Six hooks, no PreToolUse hook, no proxy, no rewriting of context. Tool-list changes go into the agent's project settings and apply from the next session, after a 60-minute quiet window. Defaults: micro-skills off, tool pruning on, loop guard `nudge` (a Haiku judge and a model-written redirect, about 25k tokens per episode), repository map off. No telemetry.

**Strengths.** Cache discipline; records of exactly the entries it adds; quality reported next to cost, with effort and RTK reference arms; a shadow setting.

**Weaknesses.**
- The default writes deny rules with no per-change approval, and the loop guard calls a model.
- Uninstall needs `toolprune restore` in every repository; its `.git/info/exclude` lines stay.
- It prices every `claude-*` model with a 0.10 cache-read weight; 09 uses 0.05 or 0.025.
- Issue #87: a one-line Haiku helper call cost about 572k effective tokens with 503 MCP tools attached, against 14k without (fixed 2026-10-30).
- Windows support arrived 2026-10-29; #104 is open.

**Evidence quality.** All vendor-run: 277 SWE-bench tasks, 3 seeds, 5 agent and model combinations, Claude Code 2.1.170. Cost fell 18.4 to 30.9%; Pass@1 moved −1.0 to +2.6 points. No intervals, no raw data, no replication, and tuning used the same repositories. The measured configuration is not the shipped default: micro-skills were on, the loop guard killed and resumed instead of nudging, and side calls used the main model; the authors call the nudge "not established". Pruning alone, the nearest proxy for the default, saved 13.2% and 17.7% on Claude Code (inference). Medium effort alone saved 16.8 to 28.9% at a 1.8 to 4.7-point loss.

### Ideas TE-A1 to TE-A9

| Idea | What | Where v8 uses it |
| --- | --- | --- |
| TE-A1 Cost formula | Dated per-model prices; an unknown model is an error; helper calls charged to the arm | 09, "Metrics per run" (cost accounting rules) |
| TE-A2 Effort arm | Lower effort as a reference arm | 09, "Arms and isolation"; 03 section 2 |
| TE-A3 Usage dedupe | By message id, subagents included; UTF-8 on Windows; skip non-object records | 09, "Metrics per run"; fixtures in 06 section 10 |
| TE-A4 Next-session rule | Changes apply to new sessions | 07 section 10; no quiet window, since v8 writes only on consent (inference) |
| TE-A5 Entry-level ownership | Record and restore only what was added | 06 sections 4.3 and 7; 07 sections 1 and 7; 08 U5 |
| TE-A6 Headless hygiene | Strict MCP config, recursion guard, same tools in every arm | 09, "Run protocol" and the run fingerprint |
| TE-A7 Shadow mode | Compute and show, write nothing | `ep plan`, `ep show` (06 section 2); 03 section 4 |
| TE-A8 Windows hook checklist | UTF-8, no console window, path case, file locks, the Store `python` alias | The nudge (K-NUDGE); engine child processes; Windows CI (06 section 10) |
| TE-A9 Repository identity | One state key per repository | 04 S-7 and 06 section 4.3 use the git common dir, so worktrees share state and a re-clone does not (inference) |

TE-T1 to TE-T3 (propose-only pruning, failure-repair mining, a loop signal) are Trial, off for v8.3, and TE-T4 (a firing-rate audit) for v8.2. The LLM judge, the micro-skill proposer and the bundle are rejected (03).

## 4. Ponytail

**What v5 changed.** v5.0.0 (2026-10-08) rewrote the rules at about half the length and added a codebase map at session start. v5.1.1 (2026-10-12) stopped repository text reaching hidden context through the map (PR #1070). v5.3.0 (2026-10-16) added the band, a Claude Code mod (2.1.290 or later) with a local ledger and an optional webhook. v5.3.3 (2026-10-29) raised hook timeouts for Windows (#1165). Full mode injects 2,859 characters (about 0.7k tokens), against 5,229 in 4.10.0, plus a map of up to 2,000 characters. Each subagent gets a copy unless the matcher excludes it, resumed sessions carry it twice (#1318), and each reply still ends with a footer (#1213).

**Evidence.**

| Source | Setting | Result | Label |
| --- | --- | --- | --- |
| Maintainer benchmark, v5 (2026-10-07) | Opus 5.5 at default effort, Claude Code 2.1.288, headless; 39 tasks × 5 runs × 3 arms; Bash off, CLAUDE.md loading and auto memory off | Cost −26% [−36, −16]; hidden checks 87/90 against 86/90; injected bugs caught where a test exists 69% against 77% without it | Vendor-run; grader issues #1171, #1316 open |
| JetBrains, v4.8.4 (2026-07) | 80 paired SkillsBench tasks; Claude Code 2.1.201, Sonnet 5 at medium effort | Cost −10.3% (p = 0.004) | Independent; the page loads only with a browser user agent |
| Issue #685, v4.8.x (2026-08-04) | Sonnet 5, Claude Code 2.1.220 | +0.7% [−6.5, +9.8] against no add-on; +6.9% [+3.9, +10.0] against a one-sentence prompt asking for a runnable check | User report |
| Chisle's author (2026-10) | 20 tasks; version not stated | 68% of bare cost overall, but costlier on 8 of 20 tasks; a rerun gave 105% | Competitor-run; post 404 on 2026-11-01, figures survive only in search snippets; not counted |

No independent test of v5 was found. K-PONYTAIL therefore compares no add-on, the one-line rule and Ponytail 5.3.3, with Bash on, instruction files present and subagents allowed.

**User-wide state.** Ponytail writes its mode flags, config, status-line copy and band ledger per user whatever the scope, and `/ponytail default` changes the global default; issue #1162 shows a project's "off" leaking into other projects. So v8 never enables it at `project` scope, shows that state on the plan row (`userStateOutsideScope`), and turns it off for one project by setting its plugin enablement to `false` at `local` scope (07 section 8).

**Security fix and maintenance.** v4.10.2 (2026-10-03) stopped splicing the plugin root into shell text (PR #827) and time-boxed the matcher regex (#890). v7 adds Ponytail without a ref and third-party marketplaces don't auto-update, so the machine where this design was written still runs 4.10.0. One maintainer merged the last 100 pull requests and shipped 14 releases in October; 49 open issues have no reply. There is no private security channel (#1326), and CI runs on Ubuntu only (#1142).

**What v8 takes.** Trial, off for new installs; existing v7 installs are kept with an upgrade row to 5.3.3 (03). The registry pins `v5.3.3`, requires Claude Code 2.1.290, keeps the subagent matcher and the standing rule, records egress as none unless the user sets a band webhook URL, and records `maintenance`. Uninstall runs Ponytail's own script first (07 section 7, 08 U5).

## 5. Capability matrix

Y yes, P partial, N no, U unknown. EP v8 (planned) shows design targets, not observed behavior. SP superpowers, CE compound-engineering, RF ruflo, BM BMAD-METHOD, SK spec-kit, CPO claude-plugins-official with native Claude Code, GS gstack, OMC oh-my-claudecode, GSD gsd-core, APM microsoft/apm, VSK vercel-labs/skills.

| Capability | EP v7.4 | EP v8 (planned) | ECC | SP | CE | RF | BM | SK | CPO | GS | OMC | GSD | APM | VSK |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Install profiles | P | Y | Y | N | P | Y | Y | Y | Y | P | N | P | Y | Y |
| Scope choice | N | Y | Y | P | P | P | P | P | Y | P | Y | Y | Y | Y |
| Team project config | P | Y | P | N | Y | Y | Y | Y | Y | Y | P | P | Y | P |
| Uninstall, rollback | Y | Y | Y | P | P | P | Y | P | Y | Y | P | P | Y | Y |
| Ownership manifest | Y | Y | Y | P | P | P | Y | Y | Y | P | P | Y | Y | Y |
| Drift detection | P | Y | Y | N | N | P | P | Y | P | P | Y | Y | Y | P |
| Doctor or verify | Y | Y | Y | P | P | Y | P | Y | Y | Y | Y | Y | Y | N |
| Measurement | Y | Y | P | P | P | P | N | N | P | P | P | N | N | N |
| Evidence record | Y | Y | N | P | P | N | N | N | N | N | N | N | N | P |
| Cross-agent | P | P | Y | Y | Y | Y | Y | Y | N | Y | P | Y | Y | Y |
| Budget enforcement | P | Y | P | P | P | P | N | N | P | U | N | U | N | N |
| Pinning | P | Y | Y | P | Y | P | P | Y | Y | P | P | P | Y | P |
| Consent | Y | Y | Y | P | P | P | Y | P | P | P | P | Y | P | P |
| Windows | Y | Y | Y | P | Y | Y | Y | Y | P | Y | Y | P | Y | Y |
| CI tests | Y | Y | Y | N | Y | Y | Y | Y | P | Y | Y | Y | Y | Y |
| Supply chain | N | Y | Y | P | U | P | U | N | P | P | U | U | Y | P |

Cells record documented behavior, not quality. v8 is P on cross-agent by design: two agents, Codex from v8.1 (ADR-0007).

## 6. Where v8 is behind, level or ahead

**Gaps v8 closes.** Scope choice (07, ADR-0003); named profiles (06 section 2); a committed team lock (06 section 4.4); drift on every owned item (06 section 9); pinning and release integrity (ADR-0009, 08 M2); a whole-plan dry run before consent (06 section 6.1, 08 U1); duplicate and same-job detection (`EP-DUPLICATE-BLOCK`, `EP-ROLE-CONFLICT`); an always-loaded budget of 600 tokens at user scope and 700 at project scope, where committed files are self-contained (ADR-0006).

**Level.** Uninstall, consent, Windows and CI were already Y in v7.4; v8 adds macOS and Linux to CI (ADR-0008).

**Only EP.** Dated evidence verdicts per component (ADR-0004) and paired tests on the user's own commits against cheap reference arms (09, ADR-0005). The nearest native tool, `claude plugin eval` (2.1.269), runs authored cases 3 times against a no-plugin baseline, without intervals, and needs WSL2 on Windows for suites that grant a shell.

**Frontier features** (seen in one analog):

| Feature | Seen in | In v8 |
| --- | --- | --- |
| Organization policy | APM | A non-goal (04); managed settings are read-only inputs (07 section 4.1, 10 T13) |
| SBOM | APM | Deferred; with zero dependencies it would list only v8 (inference); checksums and attestations instead (ADR-0009) |
| Hidden-Unicode scan | APM | `EP-HIDDEN-UNICODE` (06 section 9) and a repository check (06 section 11) |
| Marketplace context cost | CPO | Token cost on each plan row (08 U1); budget (ADR-0006); K-TOKENS (07 section 9) |
| Composition inventory | SK | `ep show` (07 section 9) |
| Local patch reapply | GSD | Deferred; edited items get keep or replace on upgrade (08 U4) |
| Skill size caps in CI | CE | Skill files under 60 lines, description limits, content budget per scope (06 section 11) |

**Mistakes avoided.** Unpinned auto-update (gstack): upgrades need consent (ADR-0009). Overwriting the global instruction file (OMC): v8 never edits `CLAUDE.md` files (07 section 3.3). Default-on telemetry (claude-code-templates, the superpowers companion, OpenSpec, vercel-labs/skills): v8 sends nothing (04 non-goals) and shows each component's egress (06 section 4.1, 10 T7).

## 7. Ten lessons and where they land

| # | Lesson | Where it lands |
| --- | --- | --- |
| 1 | Make scope a first-class choice, through native mechanisms | 07 sections 1 and 2; ADR-0003 |
| 2 | One install channel per component; detect duplicates. On the machine where this design was written, ECC is installed as a plugin and as file copies, so agent descriptions load twice and a `~/.claude/AGENTS.md` loads in every repository under the home folder: about 20k always-on tokens | `EP-DUPLICATE-BLOCK`, `EP-ROLE-CONFLICT`, `EP-ANCESTOR-INSTRUCTIONS` (06 section 9) |
| 3 | Grow the hash manifest into status, repair and edit-preserving update | 06 sections 4.3 and 6.3; `EP-DRIFT-EDITED`; 08 U4 |
| 4 | Show the whole plan before consent | 06 sections 2 and 6.1; 08 U1 |
| 5 | Measure always-on cost natively, then enforce a budget | ADR-0006; 06 section 11; K-TOKENS |
| 6 | Keep the two capabilities no analog has, and date every verdict | 09; ADR-0004 and ADR-0005; `EP-EVIDENCE-STALE`; 08 M1 |
| 7 | No telemetry by default; disclose every network call | 04 non-goals; `egress` (06 section 4.1); 10 T7 |
| 8 | Pin everything, keep auto-update off, record pins in a lock | ADR-0009; 06 section 4.4; `EP-MARKETPLACE-UNPINNED` |
| 9 | Ship verifiable releases | ADR-0009; 08 M2; `ep verify --self` |
| 10 | Test on Windows, avoid placement hazards, track maintenance | ADR-0008; 06 section 10; `maintenance` (06 section 4.1); 07 section 11 |

## 8. Rules-sync and skill-distribution tools

| Tool | What it does | Latest (date) | License | Stars / npm per week | Telemetry |
| --- | --- | --- | --- | --- | --- |
| ruler | 32 agents, project only; `.bak` backups; `ruler revert` | v0.3.46 (2026-10-22) | MIT | 2,956 / 124k | Not stated |
| rulesync | 69 targets, project or `--global`; last writer wins; no revert; `--delete` removes unmanaged skill folders | v43.4.2 (2026-11-01) | MIT | 1,577 / 335k | Not stated |
| vercel-labs/skills | `.agents/skills` plus links (junctions on Windows) or copies; lock files; `skills remove` | v1.7.4 (2026-10-19) | MIT | 37,525 / 5.89M | On by default |
| openskills | `.claude/skills` or `.agent/skills`; AGENTS.md marker block; `remove` | v1.5.0 (2026-01-17, idle) | Apache-2.0 | 10,818 / 8.7k | Not stated |
| gh skill | GitHub CLI preview; copies only, 48 agents; no remove (#13706) | gh v2.103.3 (2026-10-26) | MIT | n/a | Not stated |
| skills-manager | Central library per agent; its Codex path conflicts with OpenAI's docs | v1.43.2 (2026-10-31) | MIT | 7,131 / n/a | Not stated |
| ai-rulez | Manifest, project or `--user`; never overwrites hand-written files; merges owned keys, keeps comments; `clean` | v5.10.0 (2026-11-01) | MIT | 167 / 7.6k | Not stated |

"Not stated" means the sources read say nothing (Unknown).

**Why v8 builds the small pieces itself.** v8 needs one source rendered for two agents (ADR-0007) and a view of what loads (`ep show`). Each tool would add a runtime dependency (ADR-0008), targets 32 to 79 agents, and records no evidence. Most also have the ownership gaps shown in the table. ai-rulez's ownership model is the one to copy: one owner per shared file, never overwrite hand-written text, merge only owned keys and keep comments, remove only what the manifest recorded (06 sections 4.3 and 7; 07 sections 3.3 and 7).

**Standards.** AGENTS.md (Agentic AI Foundation, Linux Foundation) has no global path, and agents load it differently; Claude Code reads it only in folders without a `CLAUDE.md` file (2.1.277). Agent Skills has no explicit-only field, so v8 sets each agent's own flag (ADR-0002) and never writes `.agents/skills`, which Claude Code ignores. Agent Plugins 1.0.0 is not steered by Anthropic.

## 9. Token-saving tools

| Tool | Evidence in brief | 03 decision |
| --- | --- | --- |
| Concise output style (native, 2.1.237) | Native form of terse-output packs | Trial, off |
| Caveman | Output −8.5% (JetBrains); a 300-run test: output −44.1%, cost +0.06% | Hold (plugin); Reject (CLI, proxy, cloud) |
| claude-token-efficient | −4.8%, not significant (sponsor-run) | Assess |
| benjamin-plus | −17.9% median cost (JetBrains' own tool); Codex −4.4% (vendor-run) | Hold (Claude Code); Assess (Codex) |
| RTK | +7.6% cost at low effort (JetBrains); +13% (Dasein); −1.1 to −8.9% in 4 of 5 cells of TokenEconomizer's vendor-run baseline | Reject |
| TokenEconomizer bundle | Section 3 | Reject bundling |
| Proxies and gateways | All sit in the request path | Reject |
| OptScale Kompressor | Cost −22.7%, solve rate 81.1% against 82.2% (vendor-run); a proxy | Hold |
| lean-ctx | Cost +23.4% (sponsor-run) | Reject |
| squeez | Not significant; prepends a persona to global instructions | Reject |
| token-optimizer | Vendor counters only; noncommercial license | Reject |
| Cache keepalives | Native idle compaction | Reject |
| Code-graph indexers | codegraph not significant (sponsor-run); Serena +28.6% and +30.8% cost, one run each | Hold; Serena Reject |
| Context Mode | Native output caps | Hold |
| Usage dashboards | Native `/usage`, `/cost` | Hold |
| retok | Young (2026-07) | Trial, off (accounting cross-check) |
| Headroom | About 20% (vendor claim); THOL +52.8% cost on long sessions and Dasein +44% cost (both sponsor-run) | Reject |

## 10. Native features that replaced add-ons

| Native feature (version, date) | Add-on category it made unnecessary |
| --- | --- |
| Concise output style (2.1.237, 2026-08-20) | Terse-output rule packs |
| `/cost` cache line (2.1.251); `/usage` flags large misses (2.1.311) | Cache monitors, cache-fix proxies |
| Idle compaction (2.1.299, 2026-10-14) | Cache keepalives |
| Shell and background-task output over a set size saved to a file (2.1.261); large MCP results saved to a file; MCP description cap (2.1.296) | Output truncators |
| `/usage` warnings for always-on context and large results (2.1.299); one-key fixes (2.1.305) | Waste analyzers |
| `--max-budget-usd`; gateway spend limits (2.1.251 onward) | Budget enforcers |
| `claude plugin details`; the marketplace Context cost pane (version not recorded) | Context cost meters |
| `/skill-doctor` (2.1.252); 1% listing budget; `skillOverrides`; `disable-model-invocation` | Skill pruners |
| MCP tool search (version not recorded) | Most tool pruning; K-TE-T1 tests the rest |
| Effort changes keep the cache on current models, with exceptions such as Bedrock; `CLAUDE_CODE_SUBAGENT_EFFORT` (2.1.316, 2026-10-31) | Effort switchers |
| Auto mode as the starting permission mode | Allowlist packs |
| `AGENTS.md` reading (2.1.277) | `CLAUDE.md`-to-`AGENTS.md` sync |
| Marketplace `#ref` pins; third-party auto-update off | Update guards |
| Codex: usage dashboard (0.156.0), background compaction (0.163.0), advisory budgets (0.166.0) | Codex trackers and compaction add-ons |

The `.trash` hazard (fixed in 2.1.280) and Plugin4Shell (CVE-2026-86063, fixed in 2.1.179) are below v8's floor (07 section 11). Mods (2.1.287) went the other way: an unsandboxed layer above hooks and permission rules, so v8 ships none and `verify` lists installed ones (`EP-MOD-PRESENT`). Codex has no `--scope` flag for plugins; project enablement goes in `.codex/config.toml` (07 section 2.2). Its 8,000-byte skill limit is inferred from compound-engineering's test.

## 11. Closest prior art

Cortex (Giampieri, arXiv 2610.14216, 2026-10-09) keeps a change to an agent's rules or skills only when repeated paired runs show a net gain, and prunes the rest. On Haiku 4.5 and Sonnet 5, auto-loaded rules did most of the work, skills offered every turn were rarely opened, and on Sonnet 5 one evolved run added little. It is a preprint, evaluated by its author.

v8 shares the paired-run gate but differs:

- **Who changes things:** the user, after a plan, not an automatic loop; tuning loops are Assess, v8.3 or later, propose-only (03 section 4).
- **Decision rule:** non-inferiority with δ = 5 points, bootstrap intervals and an `inconclusive` outcome (09).
- **Baselines:** lower effort and a one-line rule, plus a delivery check per run (09).
- **Tasks:** the user's own commits, behind admission gates (09).
- **Record and undo:** dated registry verdicts (ADR-0004); install and undo at three scopes (07).

Its finding about rules and unopened skills is consistent with v8's small budget and explicit-only skills (ADR-0002, ADR-0006; inference). Related results: Vercel's evals found a skill never invoked in 56% of cases (2026-01-27, vendor-run); arXiv 2610.04832 found on-demand loading kept about 51% of a rule's gain; arXiv 2610.11647 found nearly one in four skills shares its job with another, which `EP-ROLE-CONFLICT` reports.

## 12. Limits

- One model family did the research and wrote this page.
- Much evidence is vendor-run, sponsor-run or a single user report. The Chisle post returned 404 on 2026-11-01, and the JetBrains Ponytail page loads only with a browser user agent.
- Stars measure attention, not quality.
- Versions change weekly: ruflo shipped more than 100 releases since 2026-08-12. Freshness is handled by 08 M1 and `EP-EVIDENCE-STALE`.
- Token figures are estimates; none was measured with `claude plugin details` or `/context`.
- The SP and CPO matrix columns were not re-checked, and four minor projects were left out.
