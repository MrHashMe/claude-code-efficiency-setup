# 12. Architecture decision records

Status of every record: Proposed, 2026-11-01. Format: context, decision, alternatives, consequences, revisit trigger. Evidence and dates are in [14-sources.md](14-sources.md).

## ADR-0001. A deterministic engine executes; the model explains and asks

- **Context.** v7 ships a roughly 700-line prose program (PLAYBOOK.md Part 1) that the agent reads and executes on every setup. That costs tokens each run, can be executed differently on two machines, and exposes the install path to injected text. The closest competitor (awesome-agent-config, an agent-run INSTALL.md) has the same property.
- **Decision.** A Node engine (`ep`) does inspection, planning, writing, verification and undo deterministically, with JSON output. The skill keeps only judgment work: scope question, plan explanation, consent, command-map confirmation, report.
- **Alternatives.** Keep prose and add a project path (cheapest, keeps nondeterminism). Plugin-only, no engine (can't express uninstall with restore, refcounts or migration). PowerShell plus Bash scripts (two codebases, weak JSON handling).
- **Consequences.** Node 22+ becomes a prerequisite for setup (it already is for the TypeScript language server). Setup tokens should drop sharply (target: at most one third of v7.3, measured in P0). The engine needs its own tests and CI matrix.
- **Revisit when** the agents offer a native, declarative way to apply and undo a configuration bundle at all three scopes.

## ADR-0002. Plugin-native packaging; the plugin stays inert

- **Context.** v7 copies skills into `~/.claude/skills`, including a model-invocable one listed in every session, and installs a SessionStart hook.
- **Decision.** All skills ship inside the plugin and are explicit-only (`disable-model-invocation: true`; Codex `allow_implicit_invocation: false`). The plugin has no hooks, MCP servers, apps or always-loaded files. The optional nudge hook is installed by the engine at user scope only, after explicit opt-in, from a script copied into the agent's config folder (`~/.claude/efficiency-playbook/nudge.mjs`), so a synced config folder never points at another machine's state root.
- **Alternatives.** Keep copying skills (duplicates on plugin update, uninstall residue). Ship the nudge as a plugin hook (runs for everyone who enables the plugin, and plugin cache paths change on update).
- **Consequences.** Enabling or disabling the plugin per scope is the native on and off switch for the skills. Installing the plugin costs no tokens per session.
- **Revisit when** plugins can ship opt-in, always-loaded rules natively per scope; then the adapter can move the rules into the plugin.

## ADR-0003. Three install scopes, mapped onto native agent scopes

- **Context.** The user must be able to install for every project or for one project. Claude Code plugins have user, project and local scopes, with local over project over user, and each collaborator installs a project-scope plugin once (Claude Code plugin docs, read 2026-11-01). Settings files follow managed, CLI, local, project, user precedence. Instruction files from all scopes load together, with one exception that shapes placement: Claude Code reads `AGENTS.md` only when no `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` exists in the folder or above it.
- **Decision.** The setup asks: all projects (`user`), this project for the team (`project`, committed files), or this project just for me (`local`, uncommitted files). Each item is written at the narrowest scope chosen. Settings keys rely on the agent's precedence. Within one scope the renderer never places a fragment twice for one agent; across scopes and agents each agent gets its own copy, and text that then loads twice in one session is reported with its token cost (`EP-DUPLICATE-BLOCK`), not removed. State lives outside repositories; a `project` install adds one committed lock file. Details and acceptance tests are in [07-install-scopes.md](07-install-scopes.md).
- **Alternatives.** User scope only (v7; fails the requirement). Project only (teams love it, individuals with many repos don't). Copying user content into each project (duplicates and drift).
- **Consequences.** Three times the fixture matrix. Some third-party components keep user-wide state even when enabled for one project (Ponytail writes per-project mode files under `~/.claude/` and a global config). The plan discloses that state, and such components are never enabled at `project` scope: the lock can only recommend them, and each person enables them at `local` or `user` (07 section 1, rule 2).
- **Revisit when** an agent adds or changes a native scope (for example a local-only instructions file).

## ADR-0004. The evidence registry is data; the decisions page is generated

- **Context.** v7's Part 2 is prose tables that must be updated by hand as agents and tools ship weekly; freshness can't be checked mechanically.
- **Decision.** One JSON file per component with roles, verdict, dated evidence items (who measured, setting, effect, quality measured, status label), kill test, egress, request-path effect, install mappings and revisit triggers. CI validates it and renders `docs/decisions.md`. A weekly job flags stale evidence in one tracking issue and never changes a verdict.
- **Alternatives.** Keep prose (no validation). External database or service (violates no-hosted-service).
- **Consequences.** Verdict changes become reviewable diffs. Contributors must fill structured fields.
- **Revisit when** registry maintenance exceeds the time it saves (track time per verdict change).

## ADR-0005. Personal paired measurement is the promotion gate

- **Context.** Effects of harness components depend on model, agent version and task mix; vendor numbers are often measured in settings unlike the user's (Ponytail's v5 benchmark disabled Bash and CLAUDE.md; TokenEconomizer's benchmark used a different configuration from its shipped default).
- **Decision.** Bench v2 keeps v7's task gates (history-free, fails at base, passes at reference), adds a determinism gate, reference arms (lower effort; one-line rule), fingerprints, cluster-bootstrap intervals and a pre-registered non-inferiority rule that reports `inconclusive` honestly. Codex arms in v8.1.
- **Alternatives.** Trust public benchmarks (rank-unstable for deployment decisions). Hosted personal benchmarks (SelfBench needs a GitHub repository connection; violates local-only data).
- **Consequences.** Users who want a verdict for their own setting must spend tokens on runs; the sample-size helper says how many before they start.
- **Revisit when** an independent, local-only personal benchmark tool matures enough to adopt instead of building.

## ADR-0006. A hard budget for always-loaded text

- **Context.** Every token in rules and instruction files is paid in every session and every compaction; tool and skill listings add more.
- **Decision.** Owned always-loaded text is capped at 600 estimated tokens at user scope and 700 at project scope, where committed files must carry the working rules as well as the project-only fragments (07 section 3.3, rule 4). The caps are enforced in CI and reported by `verify`. No model-invocable skills by default.
- **Alternatives.** No cap (creep). Measured caps from the agent's own context report (more exact, but not available offline in CI; used by `verify` when available).
- **Consequences.** New guidance must displace old guidance or move into explicit skills. Path-scoped rules don't make room: reports show them loading at session start or not at all, so the cap counts them as always loaded (07 section 3.1; Hold in 03).
- **Revisit when** the bench shows a rule worth more than its cost that doesn't fit.

## ADR-0007. One content source, rendered per agent

- **Context.** v7.4 maintains two playbooks by hand (Claude Code and Codex), which already differ in wording.
- **Decision.** Owned text lives once in `content/` as fragments with conditions; adapters render Claude Code and Codex targets. CI fails if a rendered target differs from its committed rendering.
- **Alternatives.** Symlinked AGENTS.md and CLAUDE.md (Claude Code reads `AGENTS.md` only when no `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` exists in the folder or above it; symlinks need Developer Mode or admin rights on Windows). Third-party rules-sync tools such as rulesync, ruler or vercel-labs/skills: some are widely used, but each would become a runtime dependency, targets 32 to 79 agents, has ownership gaps and records no evidence (02 section 8). ai-rulez's ownership model is copied instead.
- **Consequences.** Agent-specific behavior is expressed as fragment conditions, not forks of the text.
- **Revisit when** both agents read one shared instructions standard with identical semantics.

## ADR-0008. Node 22+, zero runtime dependencies, three-OS CI

- **Context.** Node 20 reached end of life on 2026-04-30; Node 22 is supported until 2027-04-30 and Node 24 until 2028-04-30 (nodejs/Release schedule, checked 2026-11-01). The v7 runner targets Node 18+.
- **Decision.** Engine requires Node 22 or later and uses only the standard library. CI runs on Windows (PowerShell 5.1, PowerShell 7, Git Bash), Ubuntu and macOS.
- **Alternatives.** Single-file executables (code signing and SmartScreen friction on Windows). Python (not otherwise required on Windows).
- **Consequences.** Format-preserving JSONC and TOML editors are written in-house (section 7 of 06), bounded by the module size budget.
- **Revisit** the Node floor every April when an LTS line ends.

## ADR-0009. Supply chain: pinned, checksummed, attested; third-party upgrades need consent

- **Context.** The tool changes what code agents run. Third-party marketplaces don't auto-update by default in Claude Code, which leaves stale installs (this machine runs Ponytail 4.10.0, missing the v4.10.2 security fix), while Codex updates plugins at startup when the repository has a new commit unless added at a tag.
- **Decision.** Releases from CI only, with SHA256SUMS and GitHub artifact attestations; README recommends pinned installs. The registry records tested versions of third-party components; an upgrade is a plan row with consent; `verify` reports versions below the registry minimum.
- **Alternatives.** Track third-party main branches (fast, unsafe). Vendor third-party code into this repository (license and maintenance burden).
- **Consequences.** The maintainer must refresh tested versions; the weekly job surfaces new releases.
- **Revisit when** agents offer signed plugin releases.

## ADR-0010. Nothing committed or pushed; no hooks, MCP servers or permission rules at project scope

- **Context.** Committed configuration runs on teammates' machines. Native trust prompts exist for marketplaces, plugins and folders; the engine must not route around them.
- **Decision.** The engine never runs git write commands. At `project` scope it writes only rules, instruction blocks, the lock file and declarative plugin and marketplace enablement; teammates get the agent's own install and trust prompts. Hooks and MCP servers are written only at `user` scope, each after explicit opt-in (the nudge, Context7). The engine writes no permission rules by default; the only candidate, TokenEconomizer's tool-pruning deny list (TE-T1, Trial, off), would be personal: `user` or `local` scope, with consent per rule. Components that run hooks, keep per-user state, need `env` or need a machine tool are never enabled at `project` scope; the lock can only recommend them, and each person enables them at `local` or `user` (07 section 1, rule 2).
- **Alternatives.** Commit for the user (violates a principle). Allow project hooks with a warning (one click from code execution on every teammate machine).
- **Consequences.** Some components (for example a tool-pruning deny list) can only be personal.
- **Revisit when** an agent adds per-user consent for committed hooks.
