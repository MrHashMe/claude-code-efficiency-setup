# 14. Sources

Status: checked 2026-11-01; the docs were corrected to match on 2026-11-02. In the Status column, Verified means the source, read on the Checked date, says what the doc says; Inferred means the doc draws a conclusion the source doesn't state; Unknown means we couldn't check it; a label after the status says who produced the evidence.

This file lists the sources behind the fast-moving facts in 01 and 03 to 13. 02 wasn't audited here; a source that only 02 uses shows `02` in Supports.

How to read the tables:

- **Date** is the source's publish or release date. Claude Code versions use their npm publish date. Docs pages and repository pages have no single date (n/a), so the Checked date applies.
- **Checked** is the day we read the source.
- **Supports** names the doc and section that rely on the source: `07 §11`, `10 T16`, `03 §3 Ponytail`, `04 M-6`, `12 ADR-0008`. Sections of 09 and 10 without numbers go by their heading, for example `09 Run protocol` and `10 Hooks` (Hooks are not a security boundary).
- **Labels:** vendor-run, sponsor-run and user-generated mark one-party results, as in 02. Secondary means the source reports on another source. Snapshot means a count that changes daily. Observed means seen on the design machine.

## 1. Agent docs and changelogs

### 1.1 Claude Code releases

Entries are paraphrased from the changelog. Dates are npm publish dates.

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [Claude Code 2.1.316 changelog][cc-log]: adds `CLAUDE_CODE_SUBAGENT_EFFORT`, the effort level subagents use when nothing else names one | 2026-10-31 | 2026-11-01 | 02; 13 §2 | Verified |
| [npm dist-tags for @anthropic-ai/claude-code](https://registry.npmjs.org/-/package/@anthropic-ai/claude-code/dist-tags): `stable` is 2.1.309; `latest` and `next` are 2.1.316 | n/a | 2026-11-01 | 07 intro, §11 | Verified, snapshot |
| [Claude Code 2.1.314 changelog][cc-log]: each hook's output is cut at 10,000 characters; idle compaction now also runs for subscribers with telemetry off, and on Bedrock, Vertex, Foundry and LLM gateways once the one-hour cache is on; idle compaction comes to VS Code and the Desktop Code tab | 2026-10-30 | 2026-11-01 | 10 Hooks; 06 §9 | Verified |
| [Claude Code 2.1.312 changelog][cc-log]: prompt and agent hooks run at most 24 at a time per session, subagents included, plus at most 12 that waited past their event's timeout | 2026-10-27 | 2026-11-01 | 10 Hooks | Verified |
| [Claude Code 2.1.309 changelog][cc-log]: `cd` and `Set-Location` with extra arguments now prompt; PowerShell hooks block on exit code 2; PowerShell-shell PreToolUse and PermissionRequest hooks no longer fail open when Git for Windows is missing | 2026-10-22 | 2026-11-01 | 07 §11; 10 Hooks | Verified |
| [Claude Code 2.1.304 changelog][cc-log]: mods' `settings.read` hooks receive each settings layer and can rewrite the merged settings; the skills of one source can register at most 1,024 hooks and 16,384 matcher characters per session | 2026-10-19 | 2026-11-01 | 10 T18, Hooks | Verified |
| [Claude Code 2.1.302 changelog][cc-log]: at most 12 prompt or agent hooks of one event run at a time; the rest wait | 2026-10-16 | 2026-11-01 | 10 Hooks | Verified |
| [Claude Code 2.1.300 changelog][cc-log]: the OTel `api_request` event reports `cache_creation_5m_tokens` and `cache_creation_1h_tokens` | 2026-10-14 | 2026-11-01 | 04 M-6; 09 Metrics per run | Verified |
| [Claude Code 2.1.299 changelog][cc-log]: idle compaction in the terminal for sessions over 200K tokens left idle about 54 minutes; `CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS` and `"idleCompaction": false` adjust it or turn it off | 2026-10-14 | 2026-11-01 | 03 §2 native defaults, §3 keepalives | Verified |
| [Claude Code 2.1.296 changelog][cc-log]: a Git Bash fix for bypass mode | 2026-10-09 | 2026-11-01 | 07 §11 | Verified |
| [Claude Code 2.1.292 changelog][cc-log]: fixes PreToolUse approvals and auto mode letting UNC-path reads through without a prompt | 2026-10-06 | 2026-11-01 | 07 §11 | Verified |
| [Claude Code 2.1.287 changelog][cc-log]: adds Claude mods; fixes the paging advice for large MCP results saved as JSON | 2026-10-01 | 2026-11-01 | 03 §3 mod row, Context Mode; 10 T18 | Verified |
| [Claude Code 2.1.285 changelog][cc-log]: fixes the PowerShell permission check skipping deny and ask rules, and caching that failure, when its command parser failed to start; starts without a managed settings file's policies when the OS denies reading it; on Windows, project and local `env` no longer set `ALLUSERSPROFILE`, `SystemDrive` or the `CommonProgramFiles` variables | 2026-09-29 | 2026-11-01 | 07 §4.1, §11 | Verified |
| [Claude Code 2.1.283 changelog][cc-log]: interactive sessions on third-party providers or with telemetry off start in auto mode when no mode is set | 2026-09-25 | 2026-11-01 | 03 §2 permission allowlists | Verified |
| [Claude Code 2.1.281 changelog][cc-log]: `AGENTS.md` support also on Bedrock, Vertex AI, Microsoft Foundry, LLM gateways and sessions with telemetry off | 2026-09-23 | 2026-11-01 | 07 §3.1, §11 | Verified |
| [Claude Code 2.1.277 changelog][cc-log]: adds `AGENTS.md` support, set under "Project instructions" in `/config` | 2026-09-18 | 2026-11-01 | 07 §3.1, §11 | Verified |
| [Claude Code 2.1.269 changelog][cc-log]: adds `claude plugin eval` | 2026-09-11 | 2026-11-01 | 03 §4 eval export row | Verified |
| [Claude Code 2.1.261 changelog][cc-log]: `bashOutputMaxChars` and `taskOutputMaxChars` set how much command and background-task output stays inline, up to 128K, before it is saved to a file | 2026-09-04 | 2026-11-01 | 03 §3 Headroom, Context Mode | Verified |
| [Claude Code 2.1.237 changelog][cc-log]: adds the Concise output style | 2026-08-19 | 2026-11-01 | 03 §2 Concise | Verified |

### 1.2 Claude Code docs

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [How Claude remembers your project](https://code.claude.com/docs/en/memory): `AGENTS.md` loads only when no `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` exists in the folder or above it, and then `.claude/AGENTS.md` in folders above loads too; `~/.claude/CLAUDE.md` doesn't count and loads alongside; `AGENTS.local.md`, `AGENTS.override.md` and `.agents/` are never read; `instructionFiles` is read only from user settings, `--settings` and managed settings | n/a | 2026-11-01 | 07 §3.1, §3.3, §4.1; 06 §9; 12 ADR-0007; 13 §4 | Verified |
| [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching): a one-hour cache for the main conversation and five minutes for everything else, and a section on resuming sessions | n/a | 2026-11-01 | 03 §2 next-session rule; 07 §10; 09 Run protocol, Validity threats; 13 §6 | Verified |
| [Security](https://code.claude.com/docs/en/security): auto mode is the starting mode for interactive terminal and VS Code sessions | n/a | 2026-11-01 | 03 §2 permission allowlists | Verified |
| [Choose a permission mode](https://code.claude.com/docs/en/permission-modes): auto mode is the starting mode from 2.1.283 and needs 2.1.228 or later (macOS, Linux, WSL) or 2.1.233 or later (native Windows); `-p` and the Agent SDK start in `default` | n/a | 2026-11-01 | 03 §2; 10 T17 | Verified |
| [Configure permissions](https://code.claude.com/docs/en/permissions): `-p` and Agent SDK sessions never show the workspace trust dialog and count as accepted | n/a | 2026-11-01 | 04 M-9; 09 Run protocol; 10 T17; 13 §4 Scout 1 | Verified for Claude Code |
| [Hooks reference](https://code.claude.com/docs/en/hooks): output over 10,000 characters goes to a file with a 2,000-character preview; shell-form hooks run in Git Bash on Windows, or PowerShell when Git Bash is missing; `onFailure` defaults to `continue`, and `block` needs 2.1.295 or later; at most 1,024 hooks per skill source | n/a | 2026-11-01 | 07 §4.1, §10; 10 Hooks | Verified; "aren't run by every surface" is Inferred |
| [Settings files and precedence](https://code.claude.com/docs/en/settings): user, project, local and managed settings and their order | n/a | 2026-11-01 | 07 §4.1 | Verified |
| [Environment variables](https://code.claude.com/docs/en/env-vars): `CLAUDE_CONFIG_DIR`, `DISABLE_TELEMETRY` and `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | n/a | 2026-11-01 | 07 §2.5, §4.1; 06 §9 | Verified |
| [Install and manage plugins](https://code.claude.com/docs/en/plugins/install) | n/a | 2026-11-01 | 07 §5, §6 | Verified |
| [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference) and [Measure plugin cost and usage](https://code.claude.com/docs/en/plugins/measure) | n/a | 2026-11-01 | 03 §5; 07 §7, §9; 11 Roadmap; 12 ADR-0006 | Verified |
| [Test plugins with evals](https://code.claude.com/docs/en/plugin-evals): `claude plugin eval` needs 2.1.269 or later, runs each case 3 times by default, loads only the plugin under test, reports means and deltas, and runs Bash under the OS sandbox | n/a | 2026-11-01 | 03 §4 eval export row, §6 K-EVALCI; 09 Validity threats; 11 Roadmap; 13 §6 | Verified; 03 labels its notes on intervals and WSL2 as inferred |
| [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing): the sandbox runs on macOS, Linux and WSL2; on native Windows, commands run unsandboxed | n/a | 2026-11-01 | 10 intro, T11; 06 §9; 03 §4 eval export row | Verified |
| [Desktop application](https://code.claude.com/docs/en/desktop): on Windows the app doesn't read PowerShell profiles; on macOS and Linux it reads what the login shell exports at startup; `.worktreeinclude` | n/a | 2026-11-01 | 07 §2.5, §3.3, §9 | Verified |
| [Claude Code Desktop in WSL](https://code.claude.com/docs/en/desktop-wsl) | n/a | 2026-11-01 | 07 §9 | Verified |
| [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview): mods run unsandboxed, above hooks and permission rules, also in `-p`; the bypass of `ask` rules applies only without managed settings or a Team or Enterprise login | n/a | 2026-11-01 | 03 §3 mod row; 10 T18 | Verified |
| [Extend Claude with skills](https://code.claude.com/docs/en/skills): skill frontmatter, including the fields that make a skill explicit-only | n/a | 2026-11-01 | 05 Components; 13 §3 | Verified |
| [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) | n/a | 2026-11-01 | 03 §1 | Verified |
| [Prompt caching: pricing](https://platform.claude.com/docs/en/build-with-claude/prompt-caching#pricing): cache reads at 0.05x input for Opus 5.5 and Sonnet 5.5 and 0.025x for Fable 5.1 and Mythos 5.1; one-hour cache writes at 2x | n/a | 2026-11-01 | 09 Metrics per run | Verified |

### 1.3 Claude Code issue reports

`CC#NNN` in the docs is short for `github.com/anthropics/claude-code/issues/NNN`. All are user-generated and were open on 2026-11-01. Date is the day the issue was opened. An open issue is a field report, not a confirmed bug.

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [#16299: Path-scoped rules in .claude/rules/ load into context globally regardless of paths: frontmatter](https://github.com/anthropics/claude-code/issues/16299) | 2026-01-05 | 2026-11-01 | 03 §1 path-scoped rules; 07 §3.1; 13 §4 Scout 3 | Verified, user-generated |
| [#73158: UTF-8 BOM in agent .md silently prevents agent registration](https://github.com/anthropics/claude-code/issues/73158) | 2026-07-02 | 2026-11-01 | 06 §11 | Verified, user-generated |
| [#78119: Repo-committed extraKnownMarketplaces and enabledPlugins never processed in claude.ai/code cloud sandboxes](https://github.com/anthropics/claude-code/issues/78119): hooks from the same settings file run | 2026-07-16 | 2026-11-01 | 07 §13 | Verified, user-generated |
| [#87590: --setting-sources project still loads user memory](https://github.com/anthropics/claude-code/issues/87590): a comment of 2026-10-29 reproduces it on 2.1.312 (Linux) | 2026-08-18 | 2026-11-01 | 09 Arms and isolation | Verified, user-generated |
| [#87647: Over 6k issues labeled with "has repro" have been auto-closed since March 2026](https://github.com/anthropics/claude-code/issues/87647) | 2026-08-18 | 2026-11-01 | 08 M1; 13 §4 Scout 3 | Verified, user-generated |
| [#88813: Unresolvable @import in CLAUDE.md fails completely silently](https://github.com/anthropics/claude-code/issues/88813) | 2026-08-22 | 2026-11-01 | 07 §3.1 | Verified, user-generated |
| [#90122: Plugin hooks' commandWindows field silently ignored on Windows](https://github.com/anthropics/claude-code/issues/90122) | 2026-08-27 | 2026-11-01 | 10 Hooks | Verified, user-generated |
| [#90148: cleanupPeriodDays in a project's settings controls the machine-wide transcript sweep, deleting other projects' history](https://github.com/anthropics/claude-code/issues/90148) | 2026-08-27 | 2026-11-01 | 10 I6; 13 §4 Scout 3 | Verified, user-generated |
| [#93742: /model save-as-default rewrites all of settings.json from a stale session snapshot, silently reverting hooks](https://github.com/anthropics/claude-code/issues/93742): a comment of 2026-09-27 reproduces it on 2.1.283 (macOS); another reports the same cause from a Remote Control start in the Desktop app | 2026-09-11 | 2026-11-01 | 07 §10 | Verified, user-generated |
| [#95555: Transcript rows zero every usage counter but keep usage.cache_creation](https://github.com/anthropics/claude-code/issues/95555) | 2026-09-19 | 2026-11-01 | 06 §10 | Verified, user-generated |
| [#96192: CLAUDE.md @import path containing a space silently loads nothing](https://github.com/anthropics/claude-code/issues/96192) | 2026-09-23 | 2026-11-01 | 07 §3.1 | Verified, user-generated |
| [#96361: Path-scoped rules and nested CLAUDE.md never load when Write creates a new file](https://github.com/anthropics/claude-code/issues/96361) | 2026-09-23 | 2026-11-01 | 03 §1 path-scoped rules; 07 §3.1; 13 §4 Scout 3 | Verified, user-generated |
| [#102712: Project .mcp.json is executed on Windows when the project lives in WSL](https://github.com/anthropics/claude-code/issues/102712) | 2026-10-16 | 2026-11-01 | 07 §2.5 | Verified, user-generated |
| [#103116: Headless claude -p stays alive after its final result when background subagents were used](https://github.com/anthropics/claude-code/issues/103116): reported on 2.1.302 (Linux) | 2026-10-18 | 2026-11-01 | 09 Metrics per run | Verified, user-generated |
| [#103458: AGENTS.md ignored under home directory when ~/.claude/CLAUDE.md exists](https://github.com/anthropics/claude-code/issues/103458) | 2026-10-19 | 2026-11-01 | 07 §3.1, §12 test 4 | Verified, user-generated |
| [#105838: Windows: skill effort: frontmatter is ignored when SKILL.md has CRLF line endings](https://github.com/anthropics/claude-code/issues/105838): reported on 2.1.312 | 2026-10-29 | 2026-11-01 | 06 §1, §11 | Verified, user-generated |
| [#106095: Path-scoped rules in an additional directory never load](https://github.com/anthropics/claude-code/issues/106095) | 2026-10-30 | 2026-11-01 | 03 §1 path-scoped rules | Verified, user-generated |
| [#106526: Desktop app: one settings profile for every session it launches (local, SSH, WSL)](https://github.com/anthropics/claude-code/issues/106526): a feature request; it says nothing in the app shows which settings file a session uses | 2026-11-01 | 2026-11-01 | 07 §2.5 | Verified, user-generated |

### 1.4 Codex releases and source

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [Codex rust-v0.166.0](https://github.com/openai/codex/releases/tag/rust-v0.166.0) | 2026-10-29 | 2026-11-01 | 06 §1; 07 intro, §2.4, §4.2, §13; 09 Run protocol; 10 T19 | Verified |
| [Codex rust-v0.165.0](https://github.com/openai/codex/releases/tag/rust-v0.165.0), with [PR #56263: Reject backslashes in HTTP(S) marketplace URL userinfo](https://github.com/openai/codex/pull/56263), merged 2026-10-22 | 2026-10-27 | 2026-11-01 | 07 §11; 10 T16 | Verified |
| [Codex rust-v0.146.0](https://github.com/openai/codex/releases/tag/rust-v0.146.0), with [PR #34644: Verify Git plugin SHA checkouts](https://github.com/openai/codex/pull/34644), merged 2026-07-22 | 2026-07-29 | 2026-11-01 | 07 §11; 10 T16 | Verified |
| [codex-rs/core/src/agents_md.rs at rust-v0.166.0](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/core/src/agents_md.rs): instruction files, `AGENTS.override.md`, and `project_doc_max_bytes` of 32 KiB | 2026-10-29 | 2026-11-01 | 04 C-9; 06 §9; 07 §2.2, §2.4, §3.2, §3.3; 11 What v7 left on a machine | Verified |
| [codex-rs/config/src/loader/mod.rs at rust-v0.166.0](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/config/src/loader/mod.rs): config layers | 2026-10-29 | 2026-11-01 | 07 §4.2 | Verified |
| [codex-rs/config/src/project_trust.rs at rust-v0.166.0](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/config/src/project_trust.rs): project trust | 2026-10-29 | 2026-11-01 | 07 §2.4; 10 T17 | Verified |
| [codex-rs/core-plugins/src/marketplace_upgrade/git.rs](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/core-plugins/src/marketplace_upgrade/git.rs) and [codex-rs/core-plugins/src/manager.rs](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/core-plugins/src/manager.rs) at rust-v0.166.0: Git marketplaces are checked with `git ls-remote` at startup and reinstalled when the revision changes | 2026-10-29 | 2026-11-01 | 07 §4.2; 10 T19 | Verified |
| [codex-rs/cli/src/marketplace_cmd.rs at rust-v0.166.0](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/cli/src/marketplace_cmd.rs): `--ref` | 2026-10-29 | 2026-11-01 | 07 §2.2, §4.2; 08 U1, U4; 10 T19 | Verified |
| [codex-rs/ext/skills/src/host_roots.rs at rust-v0.166.0](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/ext/skills/src/host_roots.rs): `.agents/skills` from the working folder up to the repository root, `.codex/skills`, and the home-folder lookup | 2026-10-29 | 2026-11-01 | 07 §3.2; 09 Run protocol; 10 T20 | Verified |
| [codex-rs/protocol/src/hooks.rs](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/protocol/src/hooks.rs) and [codex-rs/hooks/src/engine/discovery.rs](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/hooks/src/engine/discovery.rs) at rust-v0.166.0: `commandWindows` | 2026-10-29 | 2026-11-01 | 10 Hooks | Verified |
| [codex-rs/exec/src/exec_events.rs at rust-v0.166.0](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/exec/src/exec_events.rs) | 2026-10-29 | 2026-11-01 | 09 Run protocol | Verified |

### 1.5 Codex docs

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [Config basics](https://learn.chatgpt.com/docs/config-file/config-basic.md) | n/a | 2026-11-01 | 07 §4.2 | Verified |
| [Advanced Configuration](https://learn.chatgpt.com/docs/config-file/config-advanced.md): project `.codex/` layers, hooks and rules included, load only when the project is trusted; user and system layers always load | n/a | 2026-11-01 | 07 §2.4, §4.2; 10 T17 | Verified |
| [Hooks](https://learn.chatgpt.com/docs/hooks.md): hooks that aren't managed need review and trust, unless `--dangerously-bypass-hook-trust` is passed | n/a | 2026-11-01 | 10 T17, Hooks | Verified |
| [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md.md) | n/a | 2026-11-01 | 07 §2.2, §3.2 | Verified |
| [Build skills](https://learn.chatgpt.com/docs/build-skills.md): covers `allow_implicit_invocation` | n/a | 2026-11-01 | 05 Components; 07 §2.2, §3.2; 10 T20; 12 ADR-0002 | Verified |
| [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp.md) | n/a | 2026-11-01 | 07 §2.2 | Verified |
| [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode.md): the page says nothing about trust | n/a | 2026-11-01 | 09 Run protocol; 10 T17 | Verified |
| [Package your plugin](https://developers.openai.com/plugins/build/plugins.md) | n/a | 2026-11-01 | 07 §2.2, §4.2 | Verified |

## 2. Studied projects

### 2.1 Ponytail

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail): MIT; the owner made most commits (167; the next contributor 12); no SECURITY.md, and private vulnerability reporting is off | created 2026-06-12 | 2026-11-01 | 01 Landscape in brief; 03 §3 Ponytail | Verified |
| [Ponytail v5.3.3](https://github.com/DietrichGebert/ponytail/releases/tag/v5.3.3) | 2026-10-29 | 2026-11-01 | 01 Where v7 falls short, Landscape in brief; 03 §3 Ponytail, §6 K-PONYTAIL; 06 §4.1, §4.3; 07 §8; 12 ADR-0009 | Verified |
| [Ponytail v5.3.0](https://github.com/DietrichGebert/ponytail/releases/tag/v5.3.0): needs Claude Code 2.1.290 | 2026-10-16 | 2026-11-01 | 06 §4.1 `minVersion` | Verified |
| [Ponytail v5.0.0](https://github.com/DietrichGebert/ponytail/releases/tag/v5.0.0): rules about half as long | 2026-10-08 | 2026-11-01 | 01 Landscape in brief | Verified |
| [Ponytail v4.10.2](https://github.com/DietrichGebert/ponytail/releases/tag/v4.10.2), a "security and reliability" release, with [PR #827: fix(hooks): stop interpolating plugin root into lifecycle hook shell text](https://github.com/DietrichGebert/ponytail/pull/827) | 2026-10-03 | 2026-11-01 | 01 Where v7 falls short; 03 §3 Ponytail; 12 ADR-0009 | Verified |
| [Ponytail #1162: A session start with default off blanks other sessions' badge, and compaction then turns the missing flag into a permanent off](https://github.com/DietrichGebert/ponytail/issues/1162) | 2026-10-17 | 2026-11-01 | 07 §8 | Verified, user-generated; open |
| [Agentic benchmark: Ponytail 5 vs Ponytail vs no skill](https://github.com/DietrichGebert/ponytail/blob/v5.3.3/benchmarks/results/2026-10-07-agentic.md): Opus 5.5 at default effort, CLI 2.1.288, `claude -p`, 39 tasks x 5 runs x 3 arms (585 sessions), Bash disabled, CLAUDE.md loading and auto memory off; cost −26% [−36, −16] | 2026-10-07 | 2026-11-01 | 01 Landscape in brief; 03 §3 Ponytail; 06 §4.1; 12 ADR-0005; 13 §5 | Verified, vendor-run |
| [Ponytail SKILL.md at v5.3.3](https://github.com/DietrichGebert/ponytail/blob/v5.3.3/skills/ponytail/SKILL.md) | 2026-10-29 | 2026-11-01 | 03 §3 Ponytail; 06 §4.1 | Verified; the 0.7k token count is Inferred (our count) |

### 2.2 TokenEconomizer, Superpowers and benjamin-plus

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [microsoft/TokenEconomizer](https://github.com/microsoft/TokenEconomizer): Apache-2.0; tool pruning and the loop guard are on by default; tool pruning writes a deny list after 60 idle minutes (`toolprune_quiet_minutes`); `toolprune=propose` only proposes; it never touches deny rules the user wrote | created 2026-10-13 | 2026-11-01 | 01 Executive answer, Landscape in brief; 03 §3 TokenEconomizer rows; 02 | Verified |
| [TokenEconomizer #87: Claude Code side calls keep every MCP server attached, so one Haiku call costs ~570k effective tokens](https://github.com/microsoft/TokenEconomizer/issues/87): about 572k against about 14k with the MCP servers removed | 2026-10-30 | 2026-11-01 | 09 Run protocol | Verified, user-generated; closed as completed 2026-10-30 |
| [Superpowers v7.0.0](https://github.com/obra/superpowers/releases/tag/v7.0.0), with [PR #2393: fix(hooks): run-hook.cmd finds per-user Git, skips WSL launchers and the current directory, keeps exit codes](https://github.com/obra/superpowers/pull/2393), merged 2026-09-26: a repository could plant `bash.cmd` or `where.bat` that ran at session start, on machines without Git in Program Files | 2026-10-10 | 2026-11-01 | 03 §3 Superpowers | Verified |
| [Superpowers v7.0.1](https://github.com/obra/superpowers/releases/tag/v7.0.1) | 2026-10-21 | 2026-11-01 | 02 | Verified |
| [Agent-Profiles #37: Integrate with obra/superpowers](https://github.com/guisam/Agent-Profiles/issues/37): Superpowers adds 1,600 to 1,900 tokens per session | 2026-10-30 | 2026-11-01 | 03 §3 Superpowers; 02 | Verified, user-generated |
| [JetBrains/benjamin-plus-skill](https://github.com/JetBrains/benjamin-plus-skill): MIT; skill v6 (SKILL.md plus payload) is 745 tokens; Codex CLI with gpt-5.6-luna, 675 paired replicas: −4.4% [−7.5, −1.5], p = 0.003, solve rate unchanged | last commit 2026-08-25 | 2026-11-01 | 03 §3 benjamin-plus | Verified, vendor-run |
| [benjamin-plus EXPECTED-RESULTS.md](https://github.com/JetBrains/benjamin-plus-skill/blob/main/EXPECTED-RESULTS.md): v6 final run on 2026-08-16, −17.9% median (p = 0.005) and −16.7% on totals; between the v5 run on 2026-08-15 and that run, the unchanged control's cost moved +10.5% median (+20.5% on totals) | last push 2026-08-27 | 2026-11-01 | 03 §3 benjamin-plus, §4 Bench v2; 09 Run protocol; 13 §3 | Verified, vendor-run |

### 2.3 Token and output tools

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [RTK v1.1.0](https://github.com/rtk-ai/rtk/releases/tag/v1.1.0), with its [README](https://github.com/rtk-ai/rtk/blob/v1.1.0/README.md) and [CHANGELOG](https://github.com/rtk-ai/rtk/blob/v1.1.0/CHANGELOG.md) | 2026-10-25 | 2026-11-01 | 03 §3 RTK, proxies; 02 | Verified |
| [RTK LICENSE at v1.1.0](https://github.com/rtk-ai/rtk/blob/v1.1.0/LICENSE): Apache-2.0 at the root; BUSL-1.1 in [engine/](https://github.com/rtk-ai/rtk/blob/v1.1.0/engine/LICENSE) and [proxy/](https://github.com/rtk-ai/rtk/blob/v1.1.0/proxy/LICENSE) | 2026-10-25 | 2026-11-01 | 03 §3 RTK | Verified; the BUSL use grant wasn't reviewed (Unknown) |
| [RTK #1319: Add Claude Code PowerShell hook compatibility](https://github.com/rtk-ai/rtk/issues/1319) | 2026-04-15 | 2026-11-01 | 03 §3 RTK | Verified, user-generated; open |
| [RTK #3673: An allow rule that names arguments is matched as a prefix, granting more than it says](https://github.com/rtk-ai/rtk/issues/3673) | 2026-08-23 | 2026-11-01 | 03 §3 RTK | Verified, user-generated; open |
| [RTK #3970: Permission verdict is computed on a command that is not the one that runs](https://github.com/rtk-ai/rtk/issues/3970) | 2026-09-09 | 2026-11-01 | 03 §3 RTK | Verified, user-generated; open |
| [RTK #4281: Permission rules: deny and ask miss commands behind an env assignment or a process wrapper that Claude Code strips](https://github.com/rtk-ai/rtk/issues/4281) | 2026-09-26 | 2026-11-01 | 03 §3 RTK | Verified, user-generated; closed 2026-10-31, fix listed for v1.1.0 |
| [Context Mode v1.0.169](https://github.com/mksglu/context-mode/releases/tag/v1.0.169): the latest release; ELv2 | 2026-06-29 | 2026-11-01 | 03 §3 Context Mode; 02 | Verified |
| [Caveman v3.0.0](https://github.com/JuliusBrussee/caveman/releases/tag/v3.0.0): the CLI and its agent hooks send usage stats with a random install ID and the IP address, on by default | 2026-09-30 | 2026-11-01 | 03 §3 Caveman | Verified |
| [Caveman README at v4.0.1](https://github.com/JuliusBrussee/caveman/blob/v4.0.1/README.md): CLI usage stats on by default; a proxy; "Auto" sends each request, with CLAUDE.md and memory, to Caveman Cloud once the user signs in and picks it | 2026-10-13 | 2026-11-01 | 03 §3 Caveman, proxies | Verified |
| [Caveman SECURITY.md at v4.0.1](https://github.com/JuliusBrussee/caveman/blob/v4.0.1/SECURITY.md) | 2026-10-13 | 2026-11-01 | 03 §3 Caveman | Verified |
| [Caveman HONEST-NUMBERS.md at v4.0.1](https://github.com/JuliusBrussee/caveman/blob/v4.0.1/docs/HONEST-NUMBERS.md): n = 10; output 3% smaller than an "Answer concisely." control | 2026-10-13 | 2026-11-01 | 03 §3 Caveman | Verified, vendor-run |
| [headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom): Apache-2.0; claims about 20% fewer tokens; library, proxy and MCP modes | created 2026-01-07 | 2026-11-01 | 03 §3 Headroom | Verified (vendor claim) |
| [teamchong/pxpipe](https://github.com/teamchong/pxpipe): MIT; renders text context as images | created 2026-05-20 | 2026-11-01 | 03 §3 proxies | Verified for the description; its place in the request path is Unknown |
| [edgee-ai/edgee](https://github.com/edgee-ai/edgee): Apache-2.0; a hosted gateway | created 2026-03-16 | 2026-11-01 | 03 §3 proxies | Verified |
| [Compresr-ai/Context-Gateway](https://github.com/Compresr-ai/Context-Gateway): Apache-2.0; an agent proxy | created 2026-02-10 | 2026-11-01 | 03 §3 proxies | Verified |
| [OptScale blog: context compression for coding agents](https://optscale.ai/blog/context-compression-coding-agents), with [hystax/optscale-kompressor](https://github.com/hystax/optscale-kompressor) (MIT): Kompressor −22.7% with a solve rate of 81.1% against 82.2% (Codex); Headroom −8.2% | repository created 2026-10-14 | 2026-11-01 | 03 §3 Headroom, OptScale Kompressor | Verified, vendor-run |
| [alexgreensh/token-optimizer](https://github.com/alexgreensh/token-optimizer): PolyForm Noncommercial | n/a | 2026-11-01 | 03 §3; 13 §2 | Verified |
| [claudioemmanuel/squeez](https://github.com/claudioemmanuel/squeez) | n/a | 2026-11-01 | 03 §3 squeez | Verified for the repository; the persona-block detail wasn't re-read |
| [yvgude/lean-ctx](https://github.com/yvgude/lean-ctx) | n/a | 2026-11-01 | 03 §3 lean-ctx | Verified |
| [drona23/claude-token-efficient](https://github.com/drona23/claude-token-efficient) | n/a | 2026-11-01 | 03 §3 claude-token-efficient | Verified for the repository; the 352-byte size wasn't re-read |
| [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph) | n/a | 2026-11-01 | 03 §3 code-graph indexers | Verified |

### 2.4 Rules, skills and workflow tools

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [Mizoreww/awesome-agent-config](https://github.com/Mizoreww/awesome-agent-config): MIT; v4.2.0 | 2026-10-09 | 2026-11-01 | 01 Executive answer, Landscape in brief; 12 ADR-0001; 13 §3 | Verified |
| [mupt-ai/self-bench](https://github.com/mupt-ai/self-bench): MIT; release prod-20261030-08d6592 on 2026-10-31, then prod-20261101-6cb6593 on 2026-11-01 | created 2026-07-12 | 2026-11-01 | 01 Landscape in brief; 09 Admission gates; 12 ADR-0005; 13 §3 | Verified |
| [microsoft/apm](https://github.com/microsoft/apm): 4,168 stars; `apm.lock.yaml`, a hidden-Unicode scan on install, `apm audit` | n/a | 2026-11-01 | 01 Landscape in brief; 02 | Verified, snapshot |
| [vercel-labs/skills](https://github.com/vercel-labs/skills): 37,545 stars | n/a | 2026-11-01 | 01 Landscape in brief; 02 | Verified, snapshot; 02 shows an earlier 37,525 |
| [garrytan/gstack](https://github.com/garrytan/gstack): 138,565 stars | n/a | 2026-11-01 | 02 | Verified, snapshot |
| [Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode): 40,482 stars | n/a | 2026-11-01 | 02 | Verified, snapshot |
| [rulesync weekly npm downloads](https://api.npmjs.org/downloads/point/last-week/rulesync): 335,024 | 2026-10-23 to 2026-10-29 | 2026-11-01 | 01 Landscape in brief; 02 | Verified, snapshot |
| [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done): archived; the README points to [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core) (MIT, created 2026-05-22) | archived 2026-06-26 | 2026-11-01 | 02 | Verified |
| [d-date/retok](https://github.com/d-date/retok): MIT, no dependencies | created 2026-07-06 | 2026-11-01 | 03 §4 retok; 13 §3 | Verified |
| [ccusage/ccusage](https://github.com/ccusage/ccusage) | n/a | 2026-11-01 | 03 §4; 13 §3 | Verified |
| [harbor-framework/harbor](https://github.com/harbor-framework/harbor): Apache-2.0 | n/a | 2026-11-01 | 03 §4; 11 Roadmap; 13 §2, §3 | Verified |

### 2.5 Projects new to the brief

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [lopopolo/harness-engineering](https://github.com/lopopolo/harness-engineering): CC-BY-4.0; v1.0.0 | 2026-07-18 | 2026-11-01 | 13 §3 | Verified |
| [adamancini/clew](https://github.com/adamancini/clew): v1.1.0 | 2026-04-16 | 2026-11-01 | 13 §3 | Verified |
| [rory-mccrory/Agent-Config-Sync](https://github.com/rory-mccrory/Agent-Config-Sync) | created 2026-10-31 | 2026-11-01 | 13 §3 | Verified |
| [PanisHandsome/ai-rules-sync](https://github.com/PanisHandsome/ai-rules-sync): MIT | created 2026-06-01 | 2026-11-01 | 13 §3 | Verified |
| [resuaico/agentsync](https://github.com/resuaico/agentsync) | created 2026-08-03 | 2026-11-01 | 13 §3 | Verified |
| [chajunseok/claude-config-map](https://github.com/chajunseok/claude-config-map) | created 2026-09-10 | 2026-11-01 | 13 §3 | Verified |
| [tktk7l9/agent-cockpit](https://github.com/tktk7l9/agent-cockpit) | created 2026-07-07 | 2026-11-01 | 13 §3 | Verified |
| [ratel-ai/ratel](https://github.com/ratel-ai/ratel) | last push 2026-10-31 | 2026-11-01 | 13 §3 | Verified |
| [Kulaxyz/token-diet](https://github.com/Kulaxyz/token-diet): no license, no releases | n/a | 2026-11-01 | 13 §3 | Verified |
| [OITApps/claude-code-team-commander](https://github.com/OITApps/claude-code-team-commander) | last push 2026-10-20 | 2026-11-01 | 13 §3 | Verified |
| [hmcts/agentic-plugins-marketplace](https://github.com/hmcts/agentic-plugins-marketplace) | last push 2026-10-26 | 2026-11-01 | 13 §3 | Verified |
| [Blue](https://bluee.sh/); [Show HN thread](https://news.ycombinator.com/item?id=49728525) | Show HN 2026-09-16 | 2026-11-01; thread 2026-11-02 | 13 §3 | Verified |
| [onecli/onecli](https://github.com/onecli/onecli): Apache-2.0; [Launch HN thread](https://news.ycombinator.com/item?id=49363710) | Launch HN 2026-08-19 | 2026-11-01; thread 2026-11-02 | 13 §3 | Verified |
| [A garbage collector for LLM context windows, written in Rust (Hacker News)](https://news.ycombinator.com/item?id=50274683) | 2026-10-28 | 2026-11-01 | 13 §3 | Verified |
| [danluu.com/pl-tokens](http://danluu.com/pl-tokens/) | 2026-08-10 | 2026-11-01 | 13 §3 | Verified |
| [humanlayer: advanced context engineering for coding agents, wsff.md](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/wsff.md) | 2026-07-23 | 2026-11-01 | 13 §3 | Verified |

## 3. Security advisories and incidents

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [GHSA-pq7j-f95f-qfcv](https://github.com/anthropics/claude-code/security/advisories/GHSA-pq7j-f95f-qfcv) and [CVE-2026-86063 in NVD](https://nvd.nist.gov/vuln/detail/CVE-2026-86063): high severity; a plugin hash-pin bypass in versions below 2.1.179, fixed in 2.1.179; it needs a plugin install from a git host that allows SHA-shaped branch names | 2026-10-15 (global advisory) | 2026-11-01 | 07 §11; 10 T16; 13 §4 | Verified |
| [AIR Security: Plugin4Shell, zero-click RCE in the top 4 coding agents](https://air.security/blog-posts/plugin4shell): the reporters' write-up; they name it Plugin4Shell | 2026-09-17 | 2026-11-01 | 07 §11; 10 T16 | Verified |
| [CSA Lab Space: Plugin4Shell: SHA-Pinning Bypass Enables AI Coding Agent RCE](https://labs.cloudsecurityalliance.org/research/csa-research-note-plugin4shell-ai-coding-agent-supply-chain/) | 2026-09-19 | 2026-11-01 | 10 T16 | Verified, secondary |
| [GHSA-jh7p-qr78-84p7 (CVE-2026-21852)](https://github.com/advisories/GHSA-jh7p-qr78-84p7): medium severity; a malicious environment configuration could leak data before trust was confirmed; fixed in 2.0.65 | 2026-01-21 | 2026-11-01 | 10 I7 | Verified |
| [SafeDep: Miasma Worm Targets AI Coding Agents via GitHub Repos](https://safedep.io/miasma-worm-ai-coding-agent-config-injection/): 123 repositories carry both `.claude/settings.json` and `.gemini/settings.json` | 2026-06-05 | 2026-11-01 | 10 T15 | Verified, secondary; we found no NVD or GitHub advisory |
| [Socket: SANDWORM_MODE: Shai-Hulud-Style npm Worm Hijacks CI Workflows and Poisons AI Toolchains](https://socket.dev/blog/sandworm-mode-npm-worm-ai-toolchain-poisoning) | 2026-02-20 | 2026-11-01 | 10 T15 | Verified |
| [Mitiga: MCP Token Theft in Claude Code: A Man-in-the-Middle Attack Chain](https://www.mitiga.io/blog/claude-code-mcp-token-theft-mitm): a chain through `mcpServers` in `~/.claude.json` that the project trust prompt doesn't stop | 2026-05-05 (byline; page metadata says 2026-10-30) | 2026-11-01 | 10 T15 | Verified |

## 4. Papers and independent measurements

### 4.1 Papers

Date is the first version; a later version date follows where a doc cites it. Status covers the abstract unless the row says otherwise.

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [arXiv 2602.11988: Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?](https://arxiv.org/abs/2602.11988) | 2026-02-12; v3 2026-09-29 | 2026-11-01 | 03 §1 working-rules bundle, project command map | Verified |
| [arXiv 2608.23550: When "Do Not" Is Not Deny: Security Rules in CLAUDE.md vs Built-In Controls](https://arxiv.org/abs/2608.23550) | 2026-08-24 | 2026-11-01 | 03 §1 | Verified (16% is in the abstract) |
| [arXiv 2608.28795: The reach of a verification tool decides its value: A controlled study of verification surface, artifact quality, and cost in AI coding agents](https://arxiv.org/abs/2608.28795) | v2 2026-09-29 | 2026-11-01 | 03 §3 reviewer row | Verified |
| [arXiv 2610.11647: One Skill Too Many: How Co-Installed Skills Conflict in Coding Agents](https://arxiv.org/abs/2610.11647) | 2026-10-08; v2 2026-10-13 | 2026-11-01 | 03 §1 | Verified |
| [arXiv 2610.25064: One Skill Takes Over: Clashing Agent Skills and a One-File Fix](https://arxiv.org/abs/2610.25064) | 2026-10-18 | 2026-11-01 | 03 §1 | Verified (93 to 99% and 61 to 62% are in the abstract) |
| [arXiv 2610.30571: Stale Instruction Files Override the Code in Coding Agents: A One-Sentence Fix](https://arxiv.org/abs/2610.30571) | 2026-10-22 | 2026-11-01 | 03 §1 | Verified (4.2% and 91.4% are in the abstract) |
| [arXiv 2610.22732: TokenEconomizer: Experience-Driven Black-Box Cost Control for Coding Agents](https://arxiv.org/abs/2610.22732) | 2026-10-15 | 2026-11-01 | 01 Landscape in brief; 03 §2 native defaults, §3 RTK, TokenEconomizer; 09 Arms and isolation | Verified, vendor-run, for the abstract (18.4 to 30.9%); the effort figures and the RTK cells come from its tables per the research notes and weren't re-read |
| [arXiv 2610.34425: CTXAgent - Self-Controlled Context Management of LLM Agents](https://arxiv.org/abs/2610.34425) | 2026-10-25 | 2026-11-01 | 03 §2 auto-compact | Verified |
| [arXiv 2610.26770: HarnessPro: Recursive Harness Self-Improvement with Pareto Optimization for Performance-Cost Trade-offs](https://arxiv.org/abs/2610.26770) | 2026-10-19; v2 2026-10-20 | 2026-11-01 | 03 §4; 13 §3 | Verified |
| [arXiv 2601.14470: Tokenomics: Quantifying Where Tokens Are Used in Agentic Software Engineering](https://arxiv.org/abs/2601.14470) | 2026-01-20 | 2026-11-01 | 03 §3 reviewer row | Verified (59.4% in ChatDev) |
| [arXiv 2605.14271: Auditing Agent Harness Safety](https://arxiv.org/abs/2605.14271) | 2026-05-14; v2 2026-05-16 | 2026-11-01 | 09 Metrics per run; 13 §3 | Verified |
| [arXiv 2606.19704: Beyond Static Leaderboards: Predictive Validity for the Evaluation of LLM Agents](https://arxiv.org/abs/2606.19704) | 2026-06-18 | 2026-11-01 | 09 intro; 13 §3 | Verified |
| [arXiv 2608.13292: Refine After Generation: Toward Correct and Concise Patches in LLM-based Program Repair](https://arxiv.org/abs/2608.13292) | 2026-08-13 | 2026-11-01 | 09 Metrics per run | Verified |
| [arXiv 2608.27831: RealSWE: A Compositional Evaluation of Coding Agents under Realistic User Requests](https://arxiv.org/abs/2608.27831) | 2026-08-28; v3 2026-10-05 | 2026-11-01 | 09 Tasks; 13 §3 | Verified |
| [arXiv 2609.20804: An Empirical Study of Harness Design for Coding Agents](https://arxiv.org/abs/2609.20804) | 2026-09-17 | 2026-11-01 | 09 intro; 13 §3 | Verified |
| [arXiv 2610.34577: Rethinking Verification in Agent Harnesses](https://arxiv.org/abs/2610.34577) | 2026-10-25 | 2026-11-01 | 09 Admission gates; 13 §3 | Verified |
| [arXiv 2610.35488: Benchmarking Coding Agents under Evolving Requirements](https://arxiv.org/abs/2610.35488) | 2026-10-26; v2 2026-10-29 | 2026-11-01 | 09 Validity threats; 13 §3 | Verified |
| [arXiv 2610.35971: Continue or Restart? The Limits of Early Failure Prediction in Coding Agents](https://arxiv.org/abs/2610.35971) | 2026-10-26 | 2026-11-01 | 09 Run protocol | Verified |
| [arXiv 2605.23904: SkillOpt: Executive Strategy for Self-Evolving Agent Skills](https://arxiv.org/abs/2605.23904) | 2026-05-22; v2 2026-05-25 | 2026-11-01 | 13 §3 | Verified |
| [arXiv 2606.14066: FastContext: Training Efficient Repository Explorer for Coding Agents](https://arxiv.org/abs/2606.14066) | 2026-06-12; v4 2026-06-30 | 2026-11-01 | 13 §3 | Verified |
| [arXiv 2607.13285: Harness Handbook: Making Evolving Agent Harnesses Readable, Navigable, and Editable](https://arxiv.org/abs/2607.13285) | 2026-07-14 | 2026-11-01 | 13 §3 | Verified |
| [arXiv 2608.23041: AutoSaddler: Automatic Harness Optimization with Durable Updates from Agent Execution Traces](https://arxiv.org/abs/2608.23041) | 2026-08-24 | 2026-11-01 | 13 §3 | Verified |
| [arXiv 2608.28497: On the Maintenance and Co-evolution of Agent Plugins: An Empirical Study of Claude Code Plugin Marketplaces](https://arxiv.org/abs/2608.28497) | 2026-08-28 | 2026-11-01 | 13 §3 | Verified |
| [arXiv 2610.32285: Trial by Trace: Benchmarking AI Agent Harnesses for Reliability and Failure Attribution](https://arxiv.org/abs/2610.32285) | 2026-10-23 | 2026-11-01 | 13 §3 | Verified |
| [arXiv 2610.35348: Toward Evidence-Based Agentic Software Engineering](https://arxiv.org/abs/2610.35348) | 2026-10-26 | 2026-11-01 | 13 §3 | Verified |

### 4.2 Measurements of studied tools

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [JetBrains: Ponytail Skill for Claude Code: Does It Really Cut Tokens](https://blog.jetbrains.com/ai/2026/07/ponytail-skill-claude-tested/): Ponytail 4.8.4, Claude Code 2.1.201, Sonnet 5 at medium effort; over 80 paired SkillsBench tasks, cost −10.3% (p = 0.004) and code −15% (p = 0.088); the smoke run cost 9.6% more; 251 trials, USD 246.09 | 2026-07 | 2026-11-01 | 01 Landscape in brief; 03 §3 Ponytail; 09 Statistics | Verified; loads only with a browser user agent |
| [JetBrains: rtk Claude Code Token Savings: A Skill Trial Benchmark](https://blog.jetbrains.com/ai/2026/07/rtk-claude-code-token-savings/): rtk 0.43.0, Claude Code 2.1.201, Sonnet 5; +7.6% at low effort (p = 0.004), no change at high effort | 2026-07 | 2026-11-01 | 03 §3 RTK; 02 | Verified |
| [JetBrains: Speaking to AI Agents like Cavemen Saves 65% of Tokens. We Test.](https://blog.jetbrains.com/ai/2026/07/speak-to-ai-agents-like-cavemen-tosave-tokens/): output tokens −8.5% over 82 paired tasks; about 10% of cost at best | 2026-07 | 2026-11-01 | 03 §2 Concise, §3 Caveman; 02 | Verified |
| [Ponytail #685: SessionStart injects ~2.8k tokens once, but every API call re-reads them](https://github.com/DietrichGebert/ponytail/issues/685): Ponytail 4.x cost +6.9% against a comparison sentence and +0.7% [−6.5, +9.8] against no add-on | 2026-08-04 | 2026-11-01 | 03 §3 Ponytail, one-line rule; 09 Arms and isolation | Verified, user-generated; closed as not planned 2026-10-03 |
| [BenchKeeper #19: feat: benchmark Claude Code with and without BenchKeeper on SkillsBench](https://github.com/ESchuderer/BenchKeeper/issues/19): reports the Ponytail smoke run as 9.6% more expensive | 2026-10-13 | 2026-11-01 | 09 Statistics | Verified, user-generated; closed 2026-10-16 |
| [Caveman #727: Benchmark results and three questions - 0 savings E2E](https://github.com/JuliusBrussee/caveman/issues/727): 300 runs per arm on Opus 4.8; output −44.1%, cost +0.06% | 2026-07-21 | 2026-11-01 | 03 §3 Caveman; 02 | Verified, user-generated; closed 2026-10-08 |
| [Nobbettt/AgentStackBench](https://github.com/Nobbettt/AgentStackBench): Apache-2.0; Superpowers 5.0.5 on Codex: 45.6% and 47.8%, about 40% more tokens, no significance test | last push 2026-06-28 | 2026-11-01 | 03 §3 Superpowers | Verified, user-generated |
| [daseinlabs/code-compression-bench](https://github.com/daseinlabs/code-compression-bench): Caveman −19%; RTK +13%; Headroom tokens +6% and cost +44% | last push 2026-09-22 | 2026-11-01 | 03 §2 Concise, §3 RTK, Headroom; 02 | Verified, sponsor-run |
| [Token harness optimizer leaderboard](https://pi-infected.github.io/token-harness-optimizer-leaderboard/), with its [repository](https://github.com/pi-infected/token-harness-optimizer-leaderboard): claude-token-efficient −4.8% (not significant); Headroom +52.8%; lean-ctx +23.4%; squeez 1.010 and codegraph 1.049 (neither significant) | last push 2026-07-18 | 2026-11-01 | 03 §3 claude-token-efficient, Headroom, lean-ctx, squeez, code-graph indexers | Verified, sponsor-run |

### 4.3 Benchmark validity

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [Anthropic: Infrastructure noise in agentic coding evals](https://www.anthropic.com/engineering/infrastructure-noise) | 2026-02-05 | 2026-11-01 | 03 §4 A/A batch; 09 Validity threats; 13 §4 Scout 1 | Verified, vendor-run |
| [OpenAI: Why we no longer evaluate SWE-bench Verified](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/) | 2026-02-23 | 2026-11-01 | 09 Validity threats | Verified |
| [OpenAI: Separating signal from noise in coding evaluations](https://openai.com/index/separating-signal-from-noise-coding-evaluations/): about 30% of SWE-bench Pro tasks are broken | 2026-07-08 | 2026-11-01 | 09 Validity threats | Verified |
| [GIGAZINE report on OpenAI's SWE-Bench Pro findings](https://gigazine.net/gsc_news/en/20260709-openai-coding-evaluations/) | 2026-07-09 | 2026-11-01 | 09 Validity threats | Verified, secondary |

## 5. Standards and specifications

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| [AGENTS.md](https://agents.md/) | n/a | 2026-11-01 | 13 §7; 02 | Verified |
| [Linux Foundation announces the formation of the Agentic AI Foundation](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation) | 2025-12-09 | 2026-11-01 | 02 | Verified |
| [AAIF projects](https://aaif.io/projects/) | n/a | 2026-11-01 | 02 | Verified |
| [Agent Skills specification](https://agentskills.io/specification.md) | n/a | 2026-11-01 | 13 §2, §7 | Verified |
| [agent-plugins.org](https://agent-plugins.org) | n/a | 2026-11-01 | 07 §4.2, §13; 13 §2, §7 | Verified |
| [MCP specification 2026-07-28: changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog.md) | 2026-07-28 | 2026-11-01 | 13 §7 | Verified |
| [nodejs/Release: the Node.js release schedule](https://github.com/nodejs/Release): Node 20 reached end of life on 2026-04-30; Node 22 ends on 2027-04-30 and Node 24 on 2028-04-30 | n/a | 2026-11-01 | 01 Decisions for the owner; 04 N-3; 05 In one paragraph, Key decisions and why; 12 ADR-0008 | Verified; primary source |

## 6. Observations on the design machine

| Source | Date | Checked | Supports | Status |
| --- | --- | --- | --- | --- |
| Ponytail 4.10.0 installed at user scope | installed 2026-09-27 | 2026-11-01 | 01 Where v7 falls short; 12 ADR-0009 | Verified, observed |
| Claude Code 2.1.303 installed | n/a | 2026-11-01 | 06 §4.1 `testedVersion` | Verified, observed |
| A third-party pack's `~/.claude/AGENTS.md` loaded as project instructions in a repository with no `CLAUDE.md` | 2026-11-01 | 2026-11-01 | 07 §3.1 | Verified, observed |
| One pack installed both as a plugin and as copied files lists every agent twice, about 7,800 tokens of descriptions | n/a | 2026-11-01 | 07 §5; 13 §4 Findings from the research agents | Verified, observed |
| A Claude Code docs page carried a note telling AI readers to fetch an index file first; not acted on | n/a | 2026-11-01 | 13 §7 | Verified, observed |
| One vendor's documentation index carried text addressed to coding agents asking them to stage settings changes; not acted on | n/a | 2026-11-01 | 13 §7 | Unknown: reported by a research agent; the URL wasn't recorded |

## Corrections after the source check

On 2026-11-02 the docs were corrected in the 19 places where this check found a doc line and its source disagreeing, among them changelog wording, the settings and figures of the Ponytail benchmarks, the comparison prompt in Ponytail issue #685, Codex trust behavior, hook limits and the JetBrains drift figures. The four claims that had no source were sourced, rewritten or removed. The rows above describe the corrected docs.

[cc-log]: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
