# Claude Code Desktop (Windows): Complete Quality + Efficiency Playbook (v7.3)

> **Superseded for Claude Code by plugin v8.0.** Since v8.0, `/efficiency-playbook:setup` runs the engine in this repository (`engine/ep.mjs`) and no longer executes this file, and its rollback is `/efficiency-playbook:setup uninstall`. This v7.3 playbook is kept as a manual, Windows-only guide and is no longer updated. Current verdicts and evidence are in `docs/decisions.md`. A v7 install is migrated by the first v8 user-scope plan.

Prepared 2026-09-29 for Claude Code v2.1.284 or later. Supersedes v7.2, v7.1, v7 and v6. Part 2 records every component we evaluated, with verdicts and evidence, including the Jev, Hindsight, JevRouter, Karpathy-method and Claude Projects reviews added in v7, and the review of setup infographics, Graphify and an AI-native builder stack added in v7.1.

**How to use this file.** Attach it in a new Code-tab session and say "Execute Part 1 of the attached playbook." The efficiency-playbook plugin doesn't use this file since v8.0 (see the note at the top). Without the plugin, you can also save this file and say "Read <full path> up to '## Part 2' and execute Part 1." Part 1 is the setup Claude Code carries out; if an earlier version is installed, Part 1 upgrades it in place. Part 2 is the decision record: every plugin, skill, hook, MCP server, app, CLI tool, service and native feature we evaluated, with its verdict, evidence, and how it activates. Part 3 is daily habits for me. Part 4 maps this setup onto Claude Projects cloud threads, in case I use them. When executing, act only on Part 1. Treat Parts 2 to 4 as background, and don't install anything Part 1 doesn't list.

## Changes since v6 (background)

### v7.3

| Change | Why | Evidence |
| --- | --- | --- |
| Nested sessions: `/paired-check` still runs from a separate terminal, now because runs started inside a session inherit its variables | Claude Code no longer refuses a nested `claude`; the v7 reason was out of date | Env-vars and errors docs; changelog v2.1.41 and v2.1.47 (A) |
| PowerShell tool: on by default for claude.ai accounts on Windows and Claude's primary shell; neither shell is sandboxed on native Windows | Rows and notes said opt-in and "Git Bash handles most commands" | Tools-reference, env-vars, sandboxing docs; changelog v2.1.126 (A) |
| RTK moves from "Skip by default; conditional experiment" to Skip, with a revisit trigger | Five paired tests, none a reliable saving; hook misses the PowerShell tool; second permission engine | JetBrains, Quesma, Glia (B); Dasein, RTK's own (C); RTK source and advisory (A) |
| Runner counts subagent and compaction tokens from `modelUsage`, and its nested-session message is corrected | `usage` covers only the main loop, so tokens per accepted task were undercounted | Agent SDK cost-tracking docs (A); self-test extended |
| LSP: TypeScript 6 pin, Java, .NET and clangd prerequisites; Windows fallback matches today's failure modes | TypeScript 7 has no tsserver; the `.cmd` spawn bug was fixed in v2.1.213 | Plugin issues #4492, #4842; claude-code #73961 (B) |
| Context7: hosted server, anonymous quota, optional key, data handling | The plugin moved to Upstash's hosted server in August 2026 | Plugin PR #4985; Context7 privacy page (A) |
| Account skills and plugins that Desktop loads are inspected and flagged for overlap | `consolidate-memory` and `skill-creator` duplicate roles here | Desktop and settings docs; changelog v2.1.283 (A) |
| Evidence refreshed: Ponytail v4.10.0, Caveman and the built-in Concise style, benjamin-plus, jevgrep, Hindsight, Graphify, Supabase, Projects docs | Newer releases, tests and docs since v7.2 | Per row in Part 2 |
| Published as the `efficiency-playbook` Claude Code plugin: `/efficiency-playbook:setup` runs Part 1 and `/efficiency-playbook:setup rollback` removes what its manifest records (v7.3 and v7.4 only; v8.0 replaced both) | Install and update from GitHub instead of attaching this file | Plugin, marketplace and skills docs (A) |

### v7.2

| Change | Why | Evidence |
| --- | --- | --- |
| Step 7 Q2: a "no" now sets `permissions.defaultMode` to `"default"` | v2.1.284 starts terminal and VS Code sessions in Auto when no mode is set | Changelog v2.1.284 (A) |
| Cache bullet: one hour only within plan usage, five minutes on usage credits | Costs docs | A |
| Headless: cost fields are estimates; `--bare` may become the `-p` default; `-p` bills Fable without asking | Headless and model-config docs | A |
| 1M-window list, compaction range and override; AGENTS.md native loading; effort changes keep the cache | Model-config, memory and prompt-caching docs | A |
| Q1 caveat on the 300k cap; Q3 Fable billing by plan | `/autocompact` text; Fable plan article | C; A |
| security-guidance Windows note | Open issues #2697, #6186, #6249, #6289, #94525 | B |
| Ponytail v4.9.0; Ultracode and Sonnet 5.5 rows; CLI via WinGet; weekly `/usage` cache check | Release notes; changelog v2.1.284; setup docs | A/B |

### v7.1

| Change | Why | Evidence |
| --- | --- | --- |
| In repos that use hosted services (databases, payments, hosting, email, storage), the project section gets one line that keeps Claude on test keys, development data and read-only access | A coding agent with CLI or MCP access to a live service can change real data. Supabase says its own MCP server is for development and testing only, never production data | Supabase MCP docs |
| New habits: interview, then spec, then a fresh session for larger features; `/clear` after two failed corrections on the same issue; related small fixes in one message | The first two are Anthropic's documented practice. Each message re-reads the whole conversation, so batching related asks saves re-reads | Claude Code best practices |
| Caveman moves from Skip to a conditional experiment, and RTK's Skip is corroborated | A new comparison on headless Claude Code (100 SWE-bench Verified tasks, official grader) found Caveman 19% cheaper in total with 58 solved against 57, and RTK 13% more expensive with 54 solved | Dasein Code-Compression Bench (sponsor-run) |
| New "What could be wrong" item: this setup's own project section is written by an LLM | A controlled study found LLM-generated context files slightly lowered success and raised cost by over 20%. The section stays minimal, and `/paired-check` can test it | Gloaguen et al., arXiv 2602.11988 |
| Reviewed: two Claude Cowork setup infographics, a Graphify + Obsidian "Claude Code setup", and the AI-Native Builder Stack | Mostly Cowork-specific, outdated, or already covered here. Graphify is Skip for code | "v7.1 review" in Part 2 |

### v7

| Change | Why | Evidence |
| --- | --- | --- |
| New `/paired-check` skill and runner: three to five tasks from my own commits, replayed headless from a separate terminal, comparing tokens per accepted task between configurations | v6's biggest gap was that the combined stack had never been measured. This is the Karpathy loop's discipline (an evaluator the agent can't touch, one change at a time, a results log, a stop condition), run on request with a hard budget instead of overnight. The runs start outside Desktop because Claude Code refuses nested sessions. Each uses a clone with no later history, hidden tests, and auto memory off, so a run can't read the answer, weaken the check, or learn from earlier runs | Karpathy's autoresearch pattern; Claude Code issues #25803 and #29543; the memory docs; benchmark harnesses that strip future commits and revert test edits; the runner's self-test and 36 adversarial checks, run on Linux (its Windows-only paths are untested) |
| New `/memory-lint` skill: finds stale, contradicted, duplicate and misplaced auto-memory entries and proposes edits | MEMORY.md loads into every session up to 200 lines or 25KB. Stale entries cost tokens and mislead. Claude Code's own reminder is triggered by size, not accuracy | Claude Code memory docs; the "lint" operation in Karpathy's LLM Wiki |
| Compact instructions now keep my constraints, paths, commands, identifiers and error messages verbatim | In the one independent test of Jev-style compaction, the recall gain came from keeping text verbatim, and the misses were identifiers and constraints in the conversation text | Hermes Agent PR #116246 |
| Working rule: filter long command output, but never drop errors, warnings, skipped tests or log severity | The native, zero-dependency version of what RTK, winnow and jev-pruner attempt, guarded against the failures RTK's adversarial suite found | RTK adversarial suite; JetBrains RTK test |
| Working rule: check git history before changing code whose intent is unclear | Hindsight's premise (the last mile often hinges on a decision recorded in git history) without a daemon, per-prompt injection or transcript upload | Hindsight Coding Agents docs |
| Inspection flags an `ANTHROPIC_BASE_URL` proxy, early-access function hooks, and Jev or Hindsight integrations | Pruning proxies and routers sit in the request path, can break prompt caching, and send code to third parties | Yoshi README; Hermes Agent PR #116246 |
| Upgrade path: content an earlier version installed is updated in place if unchanged; otherwise I see a diff | v6 had no rule for replacing its own earlier content | None needed |
| Jev ecosystem, Hindsight and JevRouter reviewed: all Skip for Claude Code itself; Hindsight gets an optional, hardened one-repo experiment | See "v7 review" in Part 2 | Part 2 |
| New Part 4: what carries over to Claude Projects cloud threads | Local rules and locally installed plugins don't load there | The Claude Projects guide supplied by the author (not public) |

Self-assessed review scores for this revision: evidence 8/10 (every verdict cites a primary source; the Hindsight, Yoshi and JevRouter figures are their authors' own), safety 9/10, token discipline 9/10 (v7 added two always-loaded lines, roughly 70 tokens; v7.1 adds one project line, only in repos that use hosted services), executability 8/10 (`/paired-check` needs one line pasted into a separate terminal, because Claude Code won't start nested sessions; its runner passed its tests on Linux, but its Windows-only paths first run on my machine), honesty 9/10, usefulness 8/10.

---

## Part 1: Setup (execute this)

Set up the highest-quality, lowest-friction configuration for Claude Code in this Windows Desktop Code tab. After setup, everything must work automatically: no per-session or per-task activation, one owner per role, and nothing that conflicts or lowers quality. Do the work now with your normal permissioned tools, and keep the final report short.

### Ground rules

- Don't change my model, effort level, permission mode, sandbox, login, compaction settings, or existing hooks, except where step 7 asks me first. Report current values instead.
- Keep my existing choices for auto memory and the Desktop preview, including anything I've deliberately turned off.
- Configure only local Desktop sessions on this machine. Don't touch other AI clients (Codex, Cursor and so on), WSL distributions, remote machines, or Claude Projects settings. Don't close Desktop or interrupt other sessions.
- Respect managed settings and organization policy. If one blocks a step, report it and move on.
- Before editing any existing file, copy it to `%USERPROFILE%\.claude\backups\setup-<timestamp>\` (if that folder is synced to the cloud, use `%LOCALAPPDATA%\claude-setup-backups\setup-<timestamp>\` instead). In the same folder, keep `MANIFEST.json`: the playbook version (`v7.3`) and every file, marked block, settings key, hook, and plugin this setup adds or changes, with a hash before and after each change.
- If an earlier setup's `MANIFEST.json` exists in either backup location, read the newest one first. Everything it lists is owned by this setup. Update owned content in place: if it still matches its recorded hash, replace it with this version's content; if I've edited it since, show me a diff of the proposed change and ask. Carry the earlier ownership records into the new manifest.
- Edit JSON with a parser rather than text replacement, validate it after writing, and keep each file's encoding. Re-read a file just before writing it; if it changed since you read it, merge again instead of overwriting. Make re-runs idempotent (no duplicate blocks, files, plugins, hooks, or settings). Never print secrets or whole credential files; for keys and tokens, report only whether they're set.
- Don't commit or push anything. Leave repository changes for me to review.
- Install tools at user level only (`winget --scope user`, `npm -g`, `dotnet tool -g`, `pip --user`). No admin rights, no piping remote scripts into a shell, no changes to system Python, ExecutionPolicy, or PowerShell profiles, and no broad upgrades of unrelated software.
- Install nothing beyond what Part 1 lists, and nothing Part 2 marks Skip. Don't install or enable anything that sends my source code, prompts or transcripts to a third-party service; the only exception is Context7's lookups (a library name and a generic question, never code), if I install it. If a tool I already have overlaps a role below and works, keep it and report the overlap. Ask me before disabling anything.
- Every component must pass its check in the `/setup-check` skill (step 6). If one can't be made to work on this machine, remove only this setup's addition for it and report it. A broken integration is worse than none.
- You can't run slash commands or restart Desktop. When a step needs me, give me the exact text to paste and continue with everything else.

### Roles (one owner each)

| Role | Owner | How it activates |
| --- | --- | --- |
| Context size | Native auto-compaction, with an optional 300k cap (step 7) and the compact instructions (step 5) | Automatically |
| Type errors, definitions, references | One verified LSP plugin per language | After every edit, and on lookups |
| Over-engineering and code volume | Ponytail plugin, with my testing and reporting rule | Every session, through its hooks |
| Current library and API docs | Context7 plugin, if I install it | When libraries come up |
| UI design (new frontends only) | frontend-design plugin, scoped to that repo | During UI work |
| Learning my corrections | Native auto memory | Always, unless I've turned it off |
| Keeping memory accurate | `/memory-lint` skill; Claude Code's own size reminders. Two other things can rewrite memory with no approval step, and neither is an owner: the Anthropic `consolidate-memory` skill that Desktop loads into Code sessions, which Claude can pick on its own, and Auto Dream, a background clean-up that stays off unless Anthropic's rollout turns it on for my account. Report the skill as an overlap if it's loaded | Monthly, when I type `/memory-lint` |
| Why code is the way it is | Git history lookups (working rule) | Before changing code whose intent is unclear |
| Verifying app changes | Desktop auto-verify preview; `/verify` when I ask | After edits in web apps; on request |
| Measuring a configuration change | `/paired-check` skill, plus its runner, which I start from a separate terminal | When I type `/paired-check`, before and after a change |
| Setting up new repos | `project-setup` skill plus a one-time startup note | First session in a repo that isn't set up |
| Hard decisions and final checks | Advisor (optional, step 7) | At decision points |
| Approval prompts | Auto mode (optional, step 7) | Always |

### 1. Inspect (read-only), then summarize in a few lines

- First confirm you read all of Part 1: it ends with the comment `<!-- end of Part 1, playbook v7.3 -->`.
- Claude Code engine version. If it's older than v2.1.284, tell me to update Desktop (Help → Check for Updates), then continue.
- Whether an earlier version of this setup is installed (a `MANIFEST.json` in either backup location, the rules file marker, `efficiency:start` markers, the `project-setup` and `setup-check` skills), and which version.
- Which shell tool(s) this session uses (Git Bash, PowerShell, or both), and the config directory (`CLAUDE_CONFIG_DIR`, else `%USERPROFILE%\.claude`).
- Current model, effort, `autoCompactWindow`, permission mode, `advisorModel`, and whether auto memory is on.
- Whether `DISABLE_GROWTHBOOK`, `DISABLE_TELEMETRY`, `DO_NOT_TRACK`, or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set anywhere Claude Code reads it. These switch off features that need feature-flag fetching, such as the advisor and, on Windows with Git Bash, the PowerShell tool being on by default.
- Whether `ANTHROPIC_BASE_URL` is set anywhere Claude Code reads it. If it is, report only the host: a proxy or gateway there sees every prompt and file and can defeat prompt caching. Leave it as is.
- Whether `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` is set, and which plugins use function hooks.
- Enabled plugins, hooks (event and matcher), and MCP servers from `~/.claude.json`, `.mcp.json`, and the Desktop app's `claude_desktop_config.json` (locate it; don't guess the path). Flag duplicates, anything Part 2 marks Skip, servers that look unrelated to coding, anything that injects text into every prompt or rewrites tool output, and anything that belongs to a Jev or Hindsight integration (hooks or servers that call `api.typesafe.ai`, a `TYPESAFE_API_KEY`, `AI_GATEWAY_API_KEY` or `JEV_API_KEY` variable, or a `~/.hindsight\` folder). Report names only, never values. The efficiency-playbook plugin is this setup's installer; report it but don't flag it.
- Plugins, skills and connectors that reach Code sessions from my claude.ai account rather than from those files. In Desktop, the app passes them to each session itself, from its own folder (`%APPDATA%\Claude`): the plugins turned on under **Customize**, plus one `anthropic-skills` plugin that carries my account's skills. In terminal sessions they load as `<name>@synced`. None of them is listed in `installed_plugins.json`, so take their names from your own skill and tool list. Report each one's name, how many skills it adds, and whether its MCP servers are waiting for sign-in. Flag the ones unrelated to coding or duplicating a role in this setup's table: `consolidate-memory` (Claude can run it on its own, and unlike `/memory-lint` it merges, rewrites and retires auto-memory files without asking), `skill-creator` (nearly the same as the official plugin in Part 2, so don't install both), and account plugin skills for code review, testing or UI work. Every skill description and tool name costs context, and when the skill listing overflows, Claude Code drops descriptions. Propose what to turn off; change nothing. Turning one off in **Customize** turns it off for my whole account, Cowork included. To keep a plugin in Cowork but out of Desktop Code sessions, the documented switch is `"<name>@inline": false` in `enabledPlugins`; for one account skill, a `Skill(anthropic-skills:<name>)` rule in `permissions.deny` (Claude Code v2.1.283 or later). Confirm in a new session that it's gone. `"<name>@synced": false`, `syncClaudeAiPlugins` and `syncClaudeAiSkills` only control what the `claude` CLI downloads for terminal sessions.
- Whether Git for Windows, Node.js LTS, the GitHub CLI (`gh`), and the Claude Code CLI (`claude`) are installed. Check `claude` with `Get-Command` or `command -v` only, and don't run it from this session, not even `--version`: anything started here inherits this session's variables. Only `/paired-check` uses it, from a separate terminal.
- Line counts of `~/.claude/CLAUDE.md`, files in `~/.claude/rules/`, this project's `CLAUDE.md`, `.claude/CLAUDE.md` and `AGENTS.md`, and auto memory (`MEMORY.md`), noting whether MEMORY.md is near its 200-line or 25KB startup limit.
- Languages used in this repo (from tracked file extensions), whether it has a web frontend and an established design system or component library, and its build, typecheck, lint, and test commands (from manifests and CI config). Don't run repo scripts to discover them.
- Existing run or verify recipes (`.claude/skills/run-*`, `.claude/skills/verify/`) and `.claude/launch.json`, including whether `autoVerify` is on (report only; leave all of it as is).

### 2. Prerequisites

Git for Windows and Node.js LTS are required: Desktop worktrees need Git, and Ponytail's hooks, the startup note, and npm-based language servers need Node. Install whichever is missing at user level with winget. If that needs admin rights, tell me and continue. If Node came from WinGet's user-scope zip (its MSI is machine-scope only), check `npm prefix -g`. If it points inside the versioned Node folder, the next WinGet upgrade of Node deletes that folder and every global npm package in it, language servers included. Set the prefix to `%APPDATA%\npm` with `npm config set prefix`, add that folder to my user PATH, and record both changes in `MANIFEST.json`. This session won't see the new PATH until Desktop restarts, so check servers installed there by full path until then. Install `gh` only if I ask; Desktop uses it to watch pull requests. The Claude Code CLI isn't required; `/paired-check` gives me its install command only when I run that skill.

### 3. Code intelligence

- For each language with a meaningful amount of code in this repo (skip languages with only a few incidental files) that has an official plugin in `claude-plugins-official` (typescript-lsp, pyright-lsp, csharp-lsp, gopls-lsp, rust-analyzer-lsp, jdtls-lsp, clangd-lsp, php-lsp, ruby-lsp, kotlin-lsp, swift-lsp, lua-lsp), install its language server binary following the plugin's README, and confirm it resolves on PATH (`Get-Command` in PowerShell, `command -v` in Git Bash).
- Install corrections the plugin READMEs haven't caught up with. For TypeScript, run `npm install -g typescript-language-server typescript@6`. Plain `typescript` now installs 7.x, which has no `tsserver`, so the server can't start. typescript-language-server 6 also needs Node 22.22.2 or later. In a repo on TypeScript 7, the server falls back to that global TypeScript 6, so its diagnostics may differ from the repo's compiler; trust the repo's own typecheck when they disagree and tell me. jdtls needs Java 21 or later and, on Windows, Python 3.9 or later, because its `jdtls.bat` launcher runs a Python script. csharp-ls needs the .NET 10 SDK or later. For C and C++, use `winget install LLVM.clangd --scope user` rather than the full LLVM installer, which installs machine-wide.
- Give me one line per official plugin to paste, like: `/plugin install typescript-lsp@claude-plugins-official`. Try the official plugin first; `/setup-check` verifies it after the restart.
- Windows fallback, used by `/setup-check` only after an observed failure. A user's retest on v2.1.231 found that the official plugins now start npm `.cmd` shims themselves, so match the failure first (the error may show only in the `/plugin` Errors tab):
  - The plugin is enabled and its binary resolves, but no server handles its files (no LSP tool, or the LSP tool says no server is available for them) and no LSP error shows. That's an empty install, an open bug where the installed copy lacks the server entry. Plugin details can still list the server, so don't trust them. Give me the lines to uninstall and reinstall that plugin, then restart. Reinstalling fixes copies installed before a manifest change, but on Windows and in Desktop fresh installs have come up empty too.
  - Still empty after the reinstall: create a small local plugin under `~/.claude/local-plugins/` whose `.lsp.json` holds that plugin's `lspServers` entry from the official `marketplace.json` (see the docs page "LSP servers in plugin components"), plus a local marketplace manifest.
  - Its server fails to spawn (ENOENT, or "not found or is in an unsafe location") and starts only from a `.cmd` or `.bat` file with no `.exe` (npm shims, `kotlin-lsp.cmd`, RubyGems stubs such as `ruby-lsp.bat`, or `jdtls.bat`): create the same local plugin, but launch the server with the command `cmd.exe` and the args `/d /s /c <launcher file name>` followed by the official plugin's own arguments: `--stdio` for the npm servers and kotlin-lsp, none for ruby-lsp and jdtls (ruby-lsp exits on an unknown option).
  - Either way, give me the lines that disable the official plugin for that language and add and install the local one. Keep it only if it passes the same verification. Otherwise remove this setup's LSP addition for that language and rely on Grep.
  - If an earlier version of this setup left a local LSP plugin, test the official plugin instead, and remove the local one once the official one passes.
  - Keep exactly one LSP plugin per language.

### 4. Plugins

Each of these runs automatically once installed.

- Ponytail. Confirm `node` is on PATH. Give me these to paste as two separate messages: `/plugin marketplace add DietrichGebert/ponytail`, then `/plugin install ponytail@ponytail`. Keep its default mode; I'll decline its optional statusline. So its rules reach code-writing subagents but not the read-only Explore and Plan agents, add `"PONYTAIL_SUBAGENT_MATCHER": "^(?!(explore|plan)$)"` to the `env` block of `~/.claude/settings.json`, merged with any existing entries. Step 5 adds a standing rule that keeps Ponytail from cutting tests or reports.
- Context7. Give me `/plugin install context7@claude-plugins-official`, noting that it connects to Upstash's hosted server (no npx or local Node needed). Each lookup sends a library name and a short question Claude writes, plus my IP address and client name. Upstash keeps the questions for its own benchmarks, keeps API logs for 30 days, and has OpenAI, Google and Anthropic models rank the results; its terms say it won't train on them without my consent. It works without an account on a small shared quota (200 calls a month in September 2026). If lookups start failing with a quota error, or `/mcp` shows Context7 as failed, I can create a free Context7 API key (1,000 calls a month), save it as my user environment variable `CONTEXT7_API_KEY`, which also ties lookups to that account, and fully quit and reopen Desktop. Report only whether the key is set, never its value. If I don't install it, leave its line out of the working rules in step 5.
- frontend-design, only if this repo is a new web frontend without an established design system or component library. Install it for this repo only (project or local scope, not user scope). Repos with an existing design system don't get it.

If Desktop replies that `/plugin` isn't available, tell me to use **+ → Plugins → Add plugin** instead (adding Ponytail's marketplace under **Customize** first), and to pick the scope there.

### 5. Instructions

Create `~/.claude/rules/token-efficiency.md` (user-level rules load in every project) with exactly this content. If a file with that name exists without the first-line marker, don't overwrite it; report it instead. If it exists with the marker, it's from an earlier version of this setup: update it under the ground rules for owned content.

```markdown
<!-- token-efficiency-setup -->
<!-- playbook v7.3 -->
# Working rules (quality first)
- In large files, read the relevant line ranges rather than the whole file. Use the LSP tool for definitions and references when it's available.
- Use a subagent for broad exploration or large log analysis only when a summary is all you need from it, and keep file references for anything you'll change.
- When code depends on a library or framework API that may have changed recently, look up that API with Context7 for the version this project uses, or the closest version it lists, before writing it. Send only library names and generic questions, never private code.
- Check narrowly while iterating (one test or file, quiet output), then run the full acceptance checks on the final state. Report failures with the failing test names and key error lines.
- When a command's output may be long, filter it to what you need, but never filter out errors, warnings, skipped or expected-failure tests, or log severity. If the filtered view doesn't explain a failure, read the full output.
- Before changing code whose intent isn't clear from the code, tests or instructions, check the history of those lines (`git log -L` or `git blame`) for the decision behind them.
- Standing request, including while Ponytail is active: when a change needs tests, write them in the project's existing test framework and style, with its fixtures; the one-check default applies only where the project has no test setup. Always report verification results, failures, caveats, and risks.
- Keep prose concise without dropping results, caveats, or risks.
- If I switch to an unrelated task in a long session, suggest /clear first.
```

For this project, add a section between `<!-- efficiency:start -->` and `<!-- efficiency:end -->` markers (HTML comments are stripped from Claude's context, so they cost nothing). If the markers already exist, update the section under the ground rules for owned content.

- If the project has a `CLAUDE.md` (at the root or in `.claude/`), add the section there.
- If it has an `AGENTS.md` but no `CLAUDE.md`, create `CLAUDE.md` with `@AGENTS.md` as its first line, then the section. A CLAUDE.md without that import would stop AGENTS.md from loading.
- Otherwise, create `CLAUDE.md` containing the section.

The section contains:

- A command map in two groups. Quick checks for iterating: a single test, a single file, typecheck, lint. Full acceptance: the complete test suite with no fail-fast flag, plus build. Use only flags the tool documents, taken from the project's own config where it sets them, and note any flag you added. Write each command so it runs unchanged in both Git Bash and Windows PowerShell 5.1, so no `&&` chains, `/dev/null` redirects or `VAR=value` prefixes; mark any command that needs Bash as Bash. On Windows the PowerShell tool is now on by default for claude.ai and Console accounts, and Claude then treats PowerShell as its main shell, while `/paired-check` runs the map in Git Bash. Skip any command the existing instructions already state correctly.
- If the repo has run or verify recipes, one line pointing to them. Don't run `/run-skill-generator` during setup; it commits files.
- Only non-obvious gotchas Claude can't learn from the code, such as required environment variables or services the tests need. Don't add directory layouts, dependency lists, or architecture overviews, and don't remove anything already there.
- If the repo has an established design system or component library: "Use the existing components and design tokens; don't introduce a new visual style unless I ask."
- If the repo talks to hosted services (a database, payments, hosting, email or storage, judged from its SDK dependencies, deploy configs such as `vercel.json` or `wrangler.toml`, and `.mcp.json`), one line naming them: "For <services>, work with test keys, development databases or branches, and read-only access. Deploys, migrations and changes to live data or settings happen only when I ask."
- This block:

```markdown
# Compact instructions
Preserve the current goal, decisions made, files changed, exact failing tests and errors, and next steps. Keep these verbatim rather than paraphrased: my explicit constraints and prohibitions, file paths, commands, identifiers, and error messages.
```

Propose, but don't apply: trims for any instruction file over about 200 lines (moving task-specific parts into skills or path-scoped `.claude/rules/` files), which MCP servers to disable for Code sessions, and, if MEMORY.md is near its startup limit, a `/memory-lint` run.

### 6. Automation for other repos, and verification

Write each skill body out in full; it must work without this file. If an earlier version of this setup wrote a skill with the same name, update it under the ground rules for owned content.

- `~/.claude/skills/project-setup/SKILL.md`, model-invocable (no `disable-model-invocation`), so Claude can run it once I agree. Description: "Set up or refresh this repository's Claude Code project section and language servers. Use when the session-start note says the repo isn't set up and the user agrees, or when the user asks to set up the repo." Body: do the repo parts of step 1, all of step 3, the frontend-design part of step 4, and the project part of step 5 for that repo only, never looking outside its root; then record `done` for the repo in `~/.claude/project-setup-state.json`.
- `~/.claude/skills/setup-check/SKILL.md`, with `disable-model-invocation: true` so it runs only when I type `/setup-check`. Replace any `efficiency-check` skill an earlier version of this setup created. It verifies every role in the table and reports what works, what doesn't (with the exact fix), and anything Part 2 marks Skip that's enabled. Checks:
  - The settings keys this setup added match the manifest, and the manifest records version `v7.3`.
  - The rules file on disk has the `token-efficiency-setup` and `playbook v7.3` markers. Read the file itself to check them: they're HTML comments, which are stripped before the file reaches context. The file's heading and rules, this project's section (with the v7 compact instructions), and any `AGENTS.md` are in context.
  - The Ponytail ruleset is active, with its mode and the standing testing-and-reporting rule.
  - Context7, if installed, can resolve a public library such as "react" (send nothing else).
  - LSP, per language:
    - Run a read-only go-to-definition and find-references on an existing symbol in the current project.
    - For diagnostics, add a scratch folder name to `.git/info/exclude`, create that folder inside the project root with a minimal config for the language and a toy file containing one deliberate type error, and confirm the diagnostics arrive. They can show up a tool call or two late (an open issue), so if none appear under the edit, make one or two more read-only tool calls and check again before calling it a failure. Then fix the error and confirm they clear.
    - Delete the folder and the exclude line. Never touch my real source files.
    - If the server fails to start, apply the Windows fallback from step 3.
  - frontend-design is present only in new frontend repos.
  - The startup note's state file is valid, and no hook errors appeared at session start.
  - The `memory-lint` and `paired-check` skills exist, with valid frontmatter and `disable-model-invocation: true`. Don't run them. `run.mjs` matches its manifest hash, and `node run.mjs selftest` passes; the self-test uses a stand-in for `claude`, never the real one.
  - `ANTHROPIC_BASE_URL` is unset, is `https://api.anthropic.com` (the desktop app sets that itself), or points to a host I've confirmed.
  - No Jev or Hindsight integration, request-path proxy, or per-prompt injection hook is enabled unless I chose Part 2's documented experiment. If one is, tell me how to remove it; don't remove it yourself.
  - Skills and plugins enabled for my claude.ai account are listed by name, taken from your own skill list, since Desktop keeps them outside `~/.claude`. Flag any that overlap a role here, such as `consolidate-memory`, which rewrites memory files without asking, unlike `/memory-lint`. If `~/.claude/settings.json` denies `Skill(anthropic-skills:consolidate-memory)`, check that the engine is v2.1.283 or later, because older engines don't apply that rule to skills Desktop delivers as a plugin, and that the name still matches your skill list. Don't invoke the skill to test the rule.
  - The advisor, Auto mode and compaction cap match what I chose in step 7.

  End by reminding me that I can run `/doctor prompt-audit` and `/context`, and, if MEMORY.md is near its startup limit, `/memory-lint`. Also mention plain `/doctor`: it finds unused skills, plugins and MCP servers against their context cost, and flags slow hooks. It also proposes trimming checked-in CLAUDE.md files, moving always-loaded guidance into skills, and making Auto the default mode. It asks before changing anything, so I should decline its edits to the section between the `efficiency:start` and `efficiency:end` markers, and any default permission mode that differs from my step 7 answer.
- `~/.claude/skills/memory-lint/SKILL.md`, with `disable-model-invocation: true`. Description: "Review this repository's auto memory for stale, contradicted, duplicate or misplaced entries and propose fixes. Run only when the user types /memory-lint." Body:
  - Find this repo's auto memory folder (the one `/memory` opens, under the config directory's `projects` folder). Report MEMORY.md's line count and size against the 200-line and 25KB startup limits, and list the topic files with their sizes.
  - Read MEMORY.md and every topic file. Label each entry: current; stale (it names a file, command, flag, dependency or version that no longer exists, checked with Glob, Grep or git); contradicted (it conflicts with CLAUDE.md, a rules file, or the code); duplicate; or misplaced (a lasting project rule that belongs in CLAUDE.md, or a one-off task log that doesn't belong in memory at all).
  - Show a table of proposed edits (delete, merge, move to a topic file, reword, or propose for CLAUDE.md), each with its evidence. Change nothing until I approve.
  - Back up the memory folder first, using this setup's backup rules, then apply only the approved edits. Never edit CLAUDE.md or rules files from this skill; list those proposals for me instead. Never delete a topic file without a yes for that specific file.
  - Finish with MEMORY.md's new line count and size.
- `~/.claude/skills/paired-check/SKILL.md`, with `disable-model-invocation: true`, and beside it the runner `run.mjs` (below). Description: "Measure whether a Claude Code configuration change helps: build a fixed set of real tasks with hidden acceptance tests, have the user replay them headless from a separate terminal, and compare tokens per accepted task between labeled arms. Run only when the user types /paired-check." Body:
  - The runs can't happen in this session. Anything started from here inherits this session's variables (`CLAUDECODE`, `CLAUDE_CODE_CHILD_SESSION` and, in the desktop app, an `ANTHROPIC_BASE_URL` that points at Anthropic's own API), so runs started here wouldn't match a normal session. Current Claude Code no longer refuses a nested `claude`, so `run.mjs` does the refusing: it stops when `CLAUDECODE` is set. Never unset those variables or work around that check, and don't run `claude` from here, not even `--version`. This skill prepares, validates and reports with `run.mjs`, whose `where`, `validate`, `report` and `selftest` commands never start `claude`. I start the runs myself from a normal terminal.
  - Preconditions: this is a git repo; `node` and `git` are on PATH; `claude` resolves on PATH (check with `Get-Command` or `command -v`; don't run it). If `claude` is missing, give me the user-level install command and stop. `node <skill folder>/run.mjs where` prints this repo's data folder, which all its worktrees share.
  - First run in a repo, build the task set. Propose three to five tasks typical of my work here, from recent commits that added or changed tests: the base is the commit's parent, the reference is the commit, and the acceptance files are the test files it added or changed. Write each prompt the way I'd ask for the change, from the commit's intent; never include its diff or tests. Save `tasks.json` in the data folder with `id`, `source` (this worktree's root), `allowedTools` (Read, Edit, Write, Glob, Grep and the project's check commands, as permission rules; on Windows give each check command both a `Bash(...)` and a `PowerShell(...)` rule, since Claude may run it with either tool), `prepare` if the tests need dependencies installed (such as `npm ci`), and, for each task, `id` (letters, digits and dashes), `prompt`, `base`, `reference`, `acceptanceFiles`, `acceptance` (a command that runs at least those files), `maxTurns`, `budgetUsd` and `timeoutMin`. Validate with `node run.mjs validate <tasks.json> <task id>`, one task per call, in the background if it may take several minutes. Drop every task it reports as DROP and tell me why. Show me the final set; after my yes it's fixed. If it has to change, save a new set with a new `id`; results don't compare across sets.
  - Each batch: ask me for an arm label (for example `baseline` or `ponytail-lite`) and a repeat count (default 2). Take the model's full name (not an alias) and the effort level in effect now, written in this skill as `${CLAUDE_EFFORT}` so Claude Code fills it in. That value already applies every settings file, including the level `/effort` saves for each model under `modelSettings` since v2.1.251. Don't read a top-level `effortLevel` from my settings instead: in my user settings, Opus 5.5 and later models ignore it, and a project or managed settings file can outrank it. If no level comes through, use `auto`, the model's default. Show the maximum spend (tasks × repeats × per-task budget, plus a one-turn test run), and say that runs draw on my plan like any session. Say what every arm holds fixed: model, effort, permission mode, allowed tools, a fresh clone, and auto memory off. So `/paired-check` can't measure changes to those or to memory tools such as Hindsight, and tasks this short can't exercise compaction settings. Also say that the clones are folders Claude Code has never trusted. Headless runs there ignore the allow rules in the project's `.claude/settings.json` (the task set's allowed tools and my user-level rules still apply). They also connect every server in `.mcp.json` without asking, including ones I never approved, unless a settings file rejects it, and a local server's start command runs too. Name any `.mcp.json` server that no settings file approves, and ask about it along with the spend. If I don't want it in the runs, offer to add it to `disabledMcpjsonServers` in `.claude/settings.local.json`, which the runner copies into each clone.
  - After my yes, save `batch-<arm>-<yyyymmdd-hhmm>.json` with `id` (its file name without `.json`, which is how the runner resumes it), `tasks` (the full path), `arm`, `repeats`, `model` and `effort`, and give me one line to paste into a PowerShell window opened from the Start menu: `node "<full path to run.mjs>" run "<full path to the batch file>"`. Tell me two things about that window: if the CLI has never been signed in there, run `claude` once and sign in with the same account first; and if `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_BASE_URL` is set there, the runner stops rather than bill that key or send code through that host. Add `"allowApiKey": true` or `"allowBaseUrl": true` to the batch only if I ask. Then stop and wait.
  - When I'm back, run `node run.mjs report <data folder> <baseline arm>` and show its table. Point out the configuration differences it lists between arms, so I can confirm that only the change I meant differs. Treat any drop in pass rate as a reason not to keep the change, never call a difference significant, and repeat that a few runs show only large effects. If the batch stopped early, the same line resumes it.

The runner, `~/.claude/skills/paired-check/run.mjs`, with exactly this content:

```js
// paired-check runner, playbook v7. Node 18+, no dependencies.
// Commands: where | validate <tasks.json> [task id] | run <batch.json> | report <data folder> [baseline arm] | selftest
// Only `run` starts `claude`, and it refuses to inside a Claude Code session. The runner itself makes no network calls.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const WIN = process.platform === 'win32';
const CONFIG = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const FLAGS = ['--print', '--output-format', '--max-turns', '--max-budget-usd', '--permission-mode', '--allowedTools', '--no-session-persistence', '--model'];
const CONFIG_FILES = ['CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md', '.mcp.json', '.claude/CLAUDE.md', '.claude/settings.json',
  '.claude/settings.local.json', '.claude/rules', '.claude/skills', '.claude/agents', '.claude/commands', '.claude/hooks'];

class Fatal extends Error {}
const sha = (d) => createHash('sha256').update(d).digest('hex');
const tail = (s, n = 600) => String(s || '').trim().slice(-n);
const readJson = (p, dflt) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { if (dflt !== undefined) return dflt; throw new Fatal(`can't read ${p}: ${e.message}`); } };
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true, ...opts });
  if (r.error) throw r.error;
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}
function git(cwd, ...args) {
  const r = sh('git', ['-c', 'core.quotepath=off', ...args], { cwd });
  if (r.code !== 0) throw new Error(`git ${args[0]} failed: ${tail(r.err, 300)}`);
  return r.out.trim();
}
const gitOk = (cwd, ...args) => sh('git', args, { cwd }).code === 0;
const lines = (s) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

function killTree(pid) {
  try { if (WIN) spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }); else process.kill(-pid, 'SIGKILL'); } catch {}
}
function runProc(cmd, args, { cwd, input = '', env = process.env, shell = false, timeoutMs = 0 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env, shell, windowsHide: true, detached: !WIN });
    const out = [], err = [];
    let killed = false;
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    const timer = timeoutMs ? setTimeout(() => { killed = true; killTree(child.pid); }, timeoutMs) : null;
    const done = (code, extra = '') => { if (timer) clearTimeout(timer);
      resolve({ code, killed, out: Buffer.concat(out).toString('utf8'), err: Buffer.concat(err).toString('utf8') + extra }); };
    child.on('error', (e) => done(-1, String(e)));
    child.on('close', (code) => { if (!WIN) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} } done(code); });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

// Commands from the project's command map are written for Claude Code's Bash tool, so on Windows run them with Git Bash.
function gitBash() {
  if (!WIN) return null;
  const env = process.env.CLAUDE_CODE_GIT_BASH_PATH;
  if (env && fs.existsSync(env)) return env;
  for (const p of lines(sh('where.exe', ['git']).out))
    for (const up of ['..', path.join('..', '..')]) { const c = path.resolve(path.dirname(p), up, 'bin', 'bash.exe'); if (fs.existsSync(c)) return c; }
  return null;
}
const shellCmd = (ctx, command, cwd, timeoutMs) => ctx.bash
  ? runProc(ctx.bash, ['-c', command], { cwd, timeoutMs })
  : runProc(command, [], { cwd, timeoutMs, shell: true });

function claudeCommand() {
  const stub = process.env.PAIRED_CHECK_STUB; // selftest only: a .mjs file that imitates claude
  if (stub) return { cmd: process.execPath, pre: [stub], stub: true };
  if (!WIN) return { cmd: 'claude', pre: [] };
  const found = lines(sh('where.exe', ['claude']).out);
  const exe = found.find((p) => /\.exe$/i.test(p));
  if (exe) return { cmd: exe, pre: [] };
  const shim = found.find((p) => /\.(cmd|bat)$/i.test(p));
  if (shim) return { cmd: shim, pre: [], viaCmd: true };
  throw new Fatal('claude is not on PATH in this terminal. Install the Claude Code CLI, open a new terminal, and run the same line again.');
}
function launchClaude(cl, args, opts) {
  if (!cl.viaCmd) return runProc(cl.cmd, [...cl.pre, ...args], opts);
  // A .cmd shim can only start through cmd.exe, so the prompt goes on stdin and the fixed arguments are quoted here.
  for (const a of args) if (/["%\r\n]/.test(a)) throw new Error(`can't pass this argument through cmd.exe safely: ${a}`);
  return runProc([cl.cmd, ...args].map((a) => `"${a}"`).join(' '), [], { ...opts, shell: true });
}
const claudeArgs = (b, turns, budget, allowed) => ['-p', '--output-format', 'json', '--no-session-persistence', '--model', b.model,
  '--max-turns', String(turns), '--max-budget-usd', String(budget), '--permission-mode', 'acceptEdits', '--allowedTools', ...allowed];
const childEnv = (b) => ({ ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1', ...(b.effort ? { CLAUDE_CODE_EFFORT_LEVEL: b.effort } : {}) });
function parseResult(out) {
  const pick = (j) => (Array.isArray(j) ? [...j].reverse().find((m) => m && m.type === 'result') || null : j && typeof j === 'object' ? j : null);
  const t = out.trim();
  if (!t) return null;
  try { return pick(JSON.parse(t)); } catch {}
  for (const l of t.split(/\r?\n/).reverse()) { try { const j = pick(JSON.parse(l)); if (j) return j; } catch {} }
  return null;
}

function hashInto(h, p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) { for (const n of fs.readdirSync(p).sort()) { h.update(n); hashInto(h, path.join(p, n)); } }
  else h.update(fs.readFileSync(p));
}
const hashPath = (p) => { if (!fs.existsSync(p)) return null; const h = createHash('sha256'); hashInto(h, p); return h.digest('hex').slice(0, 12); };

function context(tasksPath) {
  tasksPath = path.resolve(tasksPath);
  const set = readJson(tasksPath);
  const src = set.source;
  if (!src || !fs.existsSync(src)) throw new Fatal(`the task set's source folder is missing: ${src}`);
  if (!Array.isArray(set.tasks) || !set.tasks.length) throw new Fatal('the task set has no tasks');
  const tasks = set.tasks.map((t) => {
    if (!/^[A-Za-z0-9-]{1,24}$/.test(t.id || '')) throw new Fatal(`bad task id: ${t.id}`);
    for (const k of ['prompt', 'base', 'reference', 'acceptance', 'maxTurns', 'budgetUsd']) if (!t[k]) throw new Fatal(`task ${t.id} has no ${k}`);
    if (!Array.isArray(t.acceptanceFiles) || !t.acceptanceFiles.length) throw new Fatal(`task ${t.id} has no acceptanceFiles`);
    return { ...t, base: git(src, 'rev-parse', `${t.base}^{commit}`), reference: git(src, 'rev-parse', `${t.reference}^{commit}`) };
  });
  const work = path.join(os.tmpdir(), 'pc', sha(tasksPath).slice(0, 8));
  const noHooks = path.join(work, 'no-hooks');
  fs.mkdirSync(noHooks, { recursive: true });
  return { set, tasks, src, cd: path.resolve(src, git(src, 'rev-parse', '--git-common-dir')), work, noHooks,
    dataDir: path.dirname(tasksPath), bash: gitBash(),
    prepMs: (set.prepareTimeoutMin || 20) * 60000, acceptMs: (set.acceptanceTimeoutMin || 15) * 60000 };
}

// A clone is history-free when HEAD is the base, nothing else is reachable, and the reference commit doesn't exist in it.
function historyFree(dir, t, refs) {
  return git(dir, 'rev-parse', 'HEAD') === t.base && !git(dir, 'remote')
    && !gitOk(dir, 'cat-file', '-e', `${t.reference}^{commit}`)
    && git(dir, 'rev-list', '--all', '--count') === git(dir, 'rev-list', 'HEAD', '--count')
    && lines(git(dir, 'for-each-ref', '--format=%(refname)')).join() === refs.join();
}
function rmDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); return null; } catch { return dir; }
}
function baseRepo(ctx, t) {
  const dir = path.join(ctx.work, `b-${t.id}`);
  if (fs.existsSync(dir)) { try { if (historyFree(dir, t, ['refs/heads/pc-base'])) return dir; } catch {} rmDir(dir); }
  git(ctx.work, 'clone', '--quiet', '--no-checkout', '--no-local', '--no-tags', ctx.cd, dir);
  git(dir, 'remote', 'remove', 'origin');
  git(dir, 'update-ref', 'refs/heads/pc-base', t.base);
  git(dir, 'symbolic-ref', 'HEAD', 'refs/heads/pc-base');
  for (const r of lines(git(dir, 'for-each-ref', '--format=%(refname)'))) if (r !== 'refs/heads/pc-base') git(dir, 'update-ref', '-d', r);
  git(dir, 'reflog', 'expire', '--expire=now', '--all');
  git(dir, 'gc', '--quiet', '--prune=now');
  if (!historyFree(dir, t, ['refs/heads/pc-base'])) throw new Error(`couldn't build a history-free base for ${t.id}`);
  return dir;
}
function runClone(ctx, t, name) {
  const dir = path.join(ctx.work, name);
  rmDir(dir);
  git(ctx.work, 'clone', '--quiet', '--no-tags', baseRepo(ctx, t), dir);
  git(dir, 'checkout', '--quiet', '--detach');
  git(dir, 'branch', '--quiet', '-D', 'pc-base');
  git(dir, 'remote', 'remove', 'origin');
  git(dir, 'reflog', 'expire', '--expire=now', '--all');
  if (!historyFree(dir, t, [])) throw new Error(`the clone for ${t.id} isn't history-free`);
  return dir;
}
// Copy today's instructions and project settings into the clone, run prepare, and commit, so the run starts from a clean tree.
async function prepareClone(ctx, dir) {
  const nested = lines(sh('git', ['-c', 'core.quotepath=off', 'ls-files', '-co', '--exclude-standard'], { cwd: ctx.src }).out)
    .filter((f) => /(^|\/)(CLAUDE|AGENTS)\.md$/.test(f) && !f.startsWith('.claude/worktrees/'));
  const h = createHash('sha256');
  for (const rel of [...new Set([...CONFIG_FILES, ...nested])]) {
    const from = path.join(ctx.src, rel), to = path.join(dir, rel);
    rmDir(to);
    if (!fs.existsSync(from)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true });
    h.update(rel); hashInto(h, from);
  }
  if (ctx.set.prepare) {
    const p = await shellCmd(ctx, ctx.set.prepare, dir, ctx.prepMs);
    if (p.code !== 0) throw new Error(`prepare failed: ${tail(p.out + p.err)}`);
  }
  git(dir, 'add', '-A');
  if (sh('git', ['diff', '--cached', '--quiet'], { cwd: dir }).code !== 0)
    git(dir, '-c', `core.hooksPath=${ctx.noHooks}`, '-c', 'user.name=paired-check', '-c', 'user.email=paired-check@localhost',
      '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--no-verify', '-m', 'Local Claude Code configuration');
  git(dir, 'reflog', 'expire', '--expire=now', '--all');
  return { projectConfig: h.digest('hex').slice(0, 12), start: git(dir, 'rev-parse', 'HEAD') };
}
function writeBlob(ctx, rev, rel, dir) {
  const r = spawnSync('git', ['cat-file', '--filters', `${rev}:${rel}`], { cwd: ctx.src, maxBuffer: 1 << 28, windowsHide: true });
  if (r.status !== 0) throw new Error(`can't read ${rel} at ${rev.slice(0, 10)}`);
  const to = path.join(dir, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, r.stdout);
}
const writeAcceptance = (ctx, t, dir) => t.acceptanceFiles.forEach((rel) => writeBlob(ctx, t.reference, rel, dir));
function changes(dir, start) {
  git(dir, 'add', '-A');
  const tree = git(dir, 'write-tree');
  let added = 0, removed = 0;
  const files = [];
  for (const l of lines(git(dir, 'diff', '--numstat', '--no-renames', start, tree))) {
    const [a, r, f] = l.split('\t');
    if (a !== '-') { added += Number(a); removed += Number(r); }
    files.push(f);
  }
  return { added, removed, files };
}

async function validate(tasksPath, only) {
  const ctx = context(tasksPath);
  const chosen = only ? ctx.tasks.filter((t) => t.id === only) : ctx.tasks;
  if (!chosen.length) throw new Fatal(`no task with id ${only}`);
  const results = [];
  for (const t of chosen) {
    const res = { task: t.id, historyFree: false, failsAtBase: false, passesAtReference: false, note: '' };
    let dir;
    try {
      dir = runClone(ctx, t, `v-${t.id}`);
      res.historyFree = true;
      await prepareClone(ctx, dir);
      writeAcceptance(ctx, t, dir);
      res.failsAtBase = (await shellCmd(ctx, t.acceptance, dir, ctx.acceptMs)).code !== 0;
      const z = sh('git', ['-c', 'core.quotepath=off', 'diff', '--name-status', '--no-renames', '-z', t.base, t.reference], { cwd: ctx.src }).out.split('\0').filter(Boolean);
      for (let i = 0; i + 1 < z.length; i += 2) {
        if (z[i] === 'D') fs.rmSync(path.join(dir, z[i + 1]), { force: true });
        else writeBlob(ctx, t.reference, z[i + 1], dir);
      }
      if (ctx.set.prepare) await shellCmd(ctx, ctx.set.prepare, dir, ctx.prepMs);
      const a = await shellCmd(ctx, t.acceptance, dir, ctx.acceptMs);
      res.passesAtReference = a.code === 0;
      if (!res.failsAtBase) res.note = 'the acceptance command already passes at the base, so it can\'t tell a solved task from an unsolved one';
      else if (!res.passesAtReference) res.note = `fails at the reference: ${tail(a.out + a.err, 300)}`;
    } catch (e) { res.note = String(e.message || e); }
    if (dir) rmDir(dir);
    res.ok = res.historyFree && res.failsAtBase && res.passesAtReference;
    results.push(res);
    console.log(`${res.ok ? 'OK  ' : 'DROP'} ${t.id}${res.note ? ` - ${res.note}` : ''}`);
  }
  for (const t of chosen) rmDir(path.join(ctx.work, `b-${t.id}`));
  const file = path.join(ctx.dataDir, 'validation.json'), prev = readJson(file, null);
  const merged = new Map((prev && prev.set === ctx.set.id ? prev.results : []).map((r) => [r.task, r]));
  for (const r of results) merged.set(r.task, r);
  writeJson(file, { set: ctx.set.id, at: new Date().toISOString(), results: [...merged.values()] });
  return results;
}

function fingerprint(b, version) {
  const s = readJson(path.join(CONFIG, 'settings.json'), {});
  return { claude: version, model: b.model, effort: b.effort || null, runner: hashPath(SELF),
    git: sh('git', ['--version']).out.trim(), node: process.version, os: `${process.platform} ${os.release()}`,
    userSettings: hashPath(path.join(CONFIG, 'settings.json')), userClaudeMd: hashPath(path.join(CONFIG, 'CLAUDE.md')),
    userRules: hashPath(path.join(CONFIG, 'rules')), userSkills: hashPath(path.join(CONFIG, 'skills')), userAgents: hashPath(path.join(CONFIG, 'agents')), userOutputStyles: hashPath(path.join(CONFIG, 'output-styles')), userCommands: hashPath(path.join(CONFIG, 'commands')), installedPlugins: hashPath(path.join(CONFIG, 'plugins', 'installed_plugins.json')),
    enabledPlugins: Object.entries(s.enabledPlugins || {}).filter(([, v]) => v).map(([k]) => k).sort(),
    autoCompactWindow: s.autoCompactWindow ?? null, advisorModel: s.advisorModel ?? null };
}
const readResults = (dir) => { const p = path.join(dir, 'results.jsonl');
  return fs.existsSync(p) ? lines(fs.readFileSync(p, 'utf8')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []; };

async function run(batchPath) {
  const b = readJson(path.resolve(batchPath));
  for (const k of ['id', 'tasks', 'arm', 'repeats', 'model']) if (!b[k]) throw new Fatal(`the batch file has no ${k}`);
  const cl = claudeCommand();
  if (!cl.stub && process.env.CLAUDECODE)
    throw new Fatal('this terminal was started by Claude Code or an IDE (CLAUDECODE is set), so the runs would inherit its variables and differ from a normal session. Open PowerShell from the Start menu and paste the same line there. Don\'t unset the variable.');
  for (const [k, ok] of [['ANTHROPIC_API_KEY', b.allowApiKey], ['ANTHROPIC_AUTH_TOKEN', b.allowApiKey], ['ANTHROPIC_BASE_URL', b.allowBaseUrl]])
    if (process.env[k] && !ok) throw new Fatal(`${k} is set in this terminal, so the runs would use it instead of your plan. Unset it in this window, or tell /paired-check that you want it used.`);
  const ctx = context(b.tasks);
  let version = 'stub';
  if (!cl.stub) {
    const v = await launchClaude(cl, ['--version'], { cwd: ctx.work, timeoutMs: 60000 });
    if (v.code !== 0) throw new Fatal(`claude --version failed: ${tail(v.err || v.out)}`);
    version = v.out.trim();
    const smoke = await launchClaude(cl, claudeArgs(b, 1, 1, ctx.set.allowedTools || ['Read']),
      { cwd: ctx.work, input: 'Reply with the single word OK.', env: childEnv(b), timeoutMs: 180000 });
    const j = parseResult(smoke.out);
    if (!j || j.is_error) {
      const help = await launchClaude(cl, ['--help'], { cwd: ctx.work, timeoutMs: 60000 });
      const missing = FLAGS.filter((f) => !help.out.includes(f));
      throw new Fatal(`the one-turn test run failed, so nothing was started: ${tail(smoke.err || smoke.out)}`
        + (missing.length ? `\n--help doesn't mention ${missing.join(', ')}, so this claude may be too old.` : ''));
    }
  }
  const fp = fingerprint(b, version);
  const done = new Set(readResults(ctx.dataDir).filter((r) => r.batch === b.id && r.status !== 'setup-failure').map((r) => `${r.task}#${r.repeat}`));
  let setupFails = 0;
  for (let rep = 1; rep <= b.repeats; rep++) for (const t of ctx.tasks) { // round-robin, so a stopped batch stays balanced
    if (done.has(`${t.id}#${rep}`)) continue;
    const rec = { batch: b.id, set: ctx.set.id, arm: b.arm, task: t.id, repeat: rep, at: new Date().toISOString() };
    let dir;
    try {
      dir = runClone(ctx, t, `r-${t.id}-${rep}`);
      const { projectConfig, start } = await prepareClone(ctx, dir);
      rec.fingerprint = { ...fp, projectConfig };
      console.log(`[${b.arm}] ${t.id} #${rep}: running`);
      const t0 = Date.now();
      const r = await launchClaude(cl, claudeArgs(b, t.maxTurns, t.budgetUsd, t.allowedTools || ctx.set.allowedTools || ['Read']),
        { cwd: dir, input: t.prompt, env: childEnv(b), timeoutMs: (t.timeoutMin || 30) * 60000 });
      rec.wallMs = Date.now() - t0;
      const j = parseResult(r.out);
      if (!j && !r.killed) throw new Error(`claude returned no result: ${tail(r.err || r.out)}`);
      const limitHit = !!j && /^error_max/.test(String(j.subtype || ''));
      if (j && j.is_error && !limitHit && /limit|overloaded|log ?in|authenticat|unauthori[sz]ed|credit|api key|billing/i.test(String(j.result || '')))
        throw new Error(`claude stopped: ${tail(j.result, 300)}`);
      Object.assign(rec, { killed: r.killed, limitHit }, j ? { subtype: j.subtype, isError: !!j.is_error, turns: j.num_turns, durationMs: j.duration_ms,
        costUsd: j.total_cost_usd, usage: j.usage, models: Object.keys(j.modelUsage || {}), permissionDenials: (j.permission_denials || []).length } : {});
      // `usage` counts only the main loop; `modelUsage` also counts subagents and compaction, so tokens come from it when it has them.
      const mu = Object.values((j && j.modelUsage) || {}).filter((m) => m && m.inputTokens != null), add = (k) => mu.reduce((s, m) => s + (m[k] || 0), 0);
      if (mu.length) rec.usage = { input_tokens: add('inputTokens'), output_tokens: add('outputTokens'),
        cache_creation_input_tokens: add('cacheCreationInputTokens'), cache_read_input_tokens: add('cacheReadInputTokens') };
      const ch = changes(dir, start);
      Object.assign(rec, { added: ch.added, removed: ch.removed, filesChanged: ch.files.length, acceptanceEdited: t.acceptanceFiles.filter((f) => ch.files.includes(f)) });
      writeAcceptance(ctx, t, dir); // grading uses the reference tests, whatever the run did to them
      rec.status = (await shellCmd(ctx, t.acceptance, dir, ctx.acceptMs)).code === 0 ? 'pass' : 'fail';
      setupFails = 0;
    } catch (e) { rec.status = 'setup-failure'; rec.reason = tail(e.message || e, 500); setupFails++; }
    if (dir && !b.keep) { const left = rmDir(dir); if (left) { rec.leftover = left; console.log(`  couldn't remove ${left} (a locked file?); delete it later`); } }
    fs.appendFileSync(path.join(ctx.dataDir, 'results.jsonl'), JSON.stringify(rec) + '\n');
    console.log(`  ${rec.status}${rec.reason ? `: ${rec.reason}` : ''}${rec.usage ? ` (${fmt(tokens(rec.usage))} tokens, $${fmt(rec.costUsd, 2)})` : ''}`);
    if (setupFails >= 2) { for (const x of ctx.tasks) rmDir(path.join(ctx.work, `b-${x.id}`));
      throw new Fatal('two setup failures in a row, so the batch stopped. Fix the cause, then paste the same line to resume.'); }
  }
  for (const t of ctx.tasks) rmDir(path.join(ctx.work, `b-${t.id}`));
  console.log('Batch complete. Go back to Claude Code and type /paired-check to see the report.');
}

const tokens = (u) => (u ? (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) : null);
const fmt = (x, d = 0) => (x == null ? 'n/a' : Number(x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));
const pct = (a, b) => { if (a == null || b == null || b === 0) return 'n/a'; const v = Math.round(((a - b) / b) * 100) || 0; return `${v > 0 ? '+' : ''}${v}%`; };
function report(dataDir, baselineArm) {
  const all = readResults(dataDir);
  const graded = all.filter((r) => r.status === 'pass' || r.status === 'fail');
  const arms = new Map();
  for (const r of graded) { const k = `${r.set}\u0000${r.arm}`; if (!arms.has(k)) arms.set(k, []); arms.get(k).push(r); }
  const stats = [...arms.values()].map((rs) => {
    const known = rs.filter((r) => r.usage), pass = rs.filter((r) => r.status === 'pass').length;
    const T = known.reduce((s, r) => s + tokens(r.usage), 0), C = known.reduce((s, r) => s + (r.costUsd || 0), 0);
    const notes = [];
    const unknown = rs.length - known.length; if (unknown) notes.push(`${unknown} run(s) hit the time limit, so their tokens are missing and the totals are low`);
    const limits = rs.filter((r) => r.limitHit).length; if (limits) notes.push(`${limits} run(s) stopped at the turn or budget limit`);
    const edited = rs.filter((r) => (r.acceptanceEdited || []).length).length; if (edited) notes.push(`${edited} run(s) edited the hidden tests' files (restored before grading)`);
    const denials = rs.reduce((s, r) => s + (r.permissionDenials || 0), 0); if (denials) notes.push(`${denials} permission denial(s)`);
    const fps = new Set(rs.map((r) => JSON.stringify(r.fingerprint))); if (fps.size > 1) notes.push('the configuration changed during this arm');
    return { set: rs[0].set, arm: rs[0].arm, first: rs.map((r) => r.at).sort()[0], runs: rs.length, pass, fp: rs[0].fingerprint || {},
      tpa: pass ? T / pass : null, cpa: pass ? C / pass : null, medTok: median(known.map((r) => tokens(r.usage))),
      medLines: median(rs.map((r) => (r.added || 0) + (r.removed || 0))), notes };
  }).sort((a, b) => a.first.localeCompare(b.first));
  const out = [`# Paired check report, ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, ''];
  for (const set of [...new Set(stats.map((s) => s.set))]) {
    const ss = stats.filter((s) => s.set === set);
    const base = ss.find((s) => s.arm === baselineArm) || ss[0];
    out.push(`## Task set ${set} (baseline: ${base.arm})`, '',
      '| Arm | Passed | Tokens per accepted task | Cost per accepted task (API-price estimate) | Median tokens per run | Median lines changed | Notes |',
      '| --- | --- | --- | --- | --- | --- | --- |');
    for (const s of ss) out.push(`| ${s.arm} | ${s.pass}/${s.runs} | ${fmt(s.tpa)} | ${s.cpa == null ? 'n/a' : `$${fmt(s.cpa, 2)}`} | ${fmt(s.medTok)} | ${fmt(s.medLines)} | ${s.notes.join('; ') || ''} |`);
    for (const s of ss.filter((x) => x !== base)) {
      out.push('', `### ${s.arm} compared with ${base.arm}`, '');
      if (s.fp.model !== base.fp.model || s.fp.effort !== base.fp.effort) { out.push('Not comparable: the model or effort differs.'); continue; }
      out.push(`- Pass rate: ${s.pass}/${s.runs} against ${base.pass}/${base.runs}${s.pass / s.runs < base.pass / base.runs ? ' (lower, which is a reason not to keep the change)' : ''}`,
        `- Tokens per accepted task: ${pct(s.tpa, base.tpa)}; cost per accepted task: ${pct(s.cpa, base.cpa)}`);
      const diff = Object.keys({ ...base.fp, ...s.fp }).filter((k) => JSON.stringify(base.fp[k]) !== JSON.stringify(s.fp[k]));
      out.push(`- Configuration differences: ${diff.length ? diff.map((k) => `${k} (${JSON.stringify(base.fp[k])} → ${JSON.stringify(s.fp[k])})`).join('; ') : 'none found, so this compares two runs of the same setup'}`);
    }
    out.push('');
  }
  const setup = all.filter((r) => r.status === 'setup-failure').length;
  out.push(setup ? `${setup} setup failure(s) aren't counted above; results.jsonl has the reasons.` : 'No setup failures.', '',
    'A few runs show only large effects: read differences as signals, not proof. Each run used a fresh clone with auto memory off and fixed permissions, so memory tools and permission settings aren\'t measured, and short tasks can\'t exercise compaction settings. Costs are API-price estimates; on a subscription they\'re a relative measure, not a bill.');
  if (!graded.length) out.splice(2, 0, 'No graded runs yet.', '');
  const text = out.join('\n') + '\n';
  fs.writeFileSync(path.join(dataDir, 'REPORT.md'), text);
  return text;
}

function where() {
  const top = sh('git', ['rev-parse', '--show-toplevel']);
  if (top.code !== 0) throw new Fatal('not inside a git repository');
  const cd = path.resolve(top.out.trim(), git(top.out.trim(), 'rev-parse', '--git-common-dir'));
  const dir = path.join(CONFIG, 'paired-check', sha(WIN ? cd.toLowerCase() : cd).slice(0, 10));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const STUB = `import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
let prompt = ''; process.stdin.on('data', (d) => { prompt += d; }); process.stdin.on('end', () => {
  const problems = [];
  const log = execFileSync('git', ['log', '--all', '--format=%s'], { encoding: 'utf8' });
  if (/SECRET-FIX|later work/.test(log)) problems.push('future history is visible');
  if (!fs.readFileSync('CLAUDE.md', 'utf8').includes('current')) problems.push('instructions were not copied');
  if (process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY !== '1') problems.push('auto memory is on');
  if (process.env.CLAUDE_CODE_EFFORT_LEVEL !== 'medium') problems.push('effort not pinned');
  if (!prompt.includes('add.js')) problems.push('prompt missing');
  if (problems.length) { console.error(problems.join('; ')); process.exit(3); }
  if (process.env.STUB_MODE === 'good') {
    fs.writeFileSync('add.js', 'module.exports = (a, b) => a + b;\\n');
    fs.mkdirSync('test', { recursive: true }); fs.writeFileSync('test/add.test.js', 'process.exit(0);\\n');
  }
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 3, duration_ms: 900, total_cost_usd: 0.02,
    usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 20, cache_read_input_tokens: process.env.STUB_MODE === 'good' ? 800 : 1200 },
    modelUsage: { stub: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 20, cacheReadInputTokens: process.env.STUB_MODE === 'good' ? 800 : 1200 },
      'stub-subagent': { inputTokens: 1000, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 } }, permission_denials: [] }));
});
`;
async function selftest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pcst-'));
  const saved = { ...process.env };
  const tasks = path.join(root, 'data', 'tasks.json');
  try {
    const repo = path.join(root, 'repo'), data = path.join(root, 'data');
    fs.mkdirSync(repo); fs.mkdirSync(data);
    const g = (...a) => git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${root}`, ...a);
    const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.writeFileSync(path.join(repo, rel), text); };
    git(repo, 'init', '--quiet');
    put('add.js', 'module.exports = (a, b) => a - b;\n'); put('CLAUDE.md', '# old instructions\n');
    g('add', '-A'); g('commit', '--quiet', '-m', 'base');
    const base = git(repo, 'rev-parse', 'HEAD');
    put('add.js', 'module.exports = (a, b) => a + b;\n'); put('test/add.test.js', "process.exit(require('../add.js')(2, 3) === 5 ? 0 : 1);\n");
    g('add', '-A'); g('commit', '--quiet', '-m', 'SECRET-FIX make add add');
    const reference = git(repo, 'rev-parse', 'HEAD');
    put('later.txt', 'later\n'); g('add', '-A'); g('commit', '--quiet', '-m', 'later work');
    put('CLAUDE.md', '# current instructions\n'); // uncommitted on purpose: runs must see today's instructions
    writeJson(tasks, { id: 'selftest', source: repo, allowedTools: ['Read', 'Edit', 'Bash(node test/add.test.js)'],
      tasks: [{ id: 't1', prompt: 'Make add.js return the sum of its two arguments.', base, reference, acceptanceFiles: ['test/add.test.js'],
        acceptance: 'node test/add.test.js', maxTurns: 5, budgetUsd: 1, timeoutMin: 2 }] });
    const v = await validate(tasks);
    if (!v[0].ok) throw new Error(`validate: ${JSON.stringify(v[0])}`);
    fs.writeFileSync(path.join(root, 'stub.mjs'), STUB);
    process.env.PAIRED_CHECK_STUB = path.join(root, 'stub.mjs');
    for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL']) delete process.env[k];
    for (const arm of ['bad', 'good']) {
      process.env.STUB_MODE = arm;
      const bp = path.join(data, `batch-${arm}.json`);
      writeJson(bp, { id: `b-${arm}`, tasks, arm, repeats: 2, model: 'stub', effort: 'medium' });
      await run(bp);
    }
    const res = readResults(data);
    const want = (arm, status) => res.filter((r) => r.arm === arm && r.status === status).length === 2;
    if (!want('bad', 'fail') || !want('good', 'pass')) throw new Error(`run: ${JSON.stringify(res.map((r) => [r.arm, r.status, r.reason]))}`);
    if (!res.filter((r) => r.arm === 'good').every((r) => r.acceptanceEdited.includes('test/add.test.js'))) throw new Error('test edits were not detected');
    const text = report(data, 'bad');
    if (!/\| good \| 2\/2 \| 1,970 \|/.test(text) || !/Tokens per accepted task: n\/a/.test(text)) throw new Error(`report:\n${text}`);
    if (fs.readdirSync(path.join(os.tmpdir(), 'pc', sha(path.resolve(tasks)).slice(0, 8))).some((n) => /^[bvr]-/.test(n))) throw new Error('clones were left behind');
    return 'selftest passed';
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    rmDir(path.join(os.tmpdir(), 'pc', sha(path.resolve(tasks)).slice(0, 8)));
    rmDir(root);
  }
}

const [cmd, a1, a2] = process.argv.slice(2);
const commands = { where, validate: () => validate(a1, a2), run: () => run(a1), report: () => report(a1, a2), selftest };
if (!commands[cmd] || (['validate', 'run', 'report'].includes(cmd) && !a1)) {
  console.error('usage: node run.mjs where | validate <tasks.json> [task id] | run <batch.json> | report <data folder> [baseline arm] | selftest');
  process.exit(2);
}
Promise.resolve().then(commands[cmd]).then((r) => { if (typeof r === 'string') console.log(r.trimEnd()); })
  .catch((e) => { console.error(`paired-check: ${e instanceof Fatal ? e.message : e.stack || e}`); process.exit(1); });
```

Create `~/.claude/hooks/project-setup-nudge.js` and register it in `~/.claude/settings.json` as a `SessionStart` hook for new sessions (`startup`), using the documented `additionalContext` output. Use exec form: `"command": "node"`, with the script's full path as the only item in `"args"` (forward slashes are fine). Then no shell parses the Windows path, and no shell profile output lands in front of the JSON. Behavior:

- Resolve the repo with `git rev-parse --show-toplevel` and `git rev-parse --git-common-dir`. This also works in linked worktrees, whose `.git` is a file. Outside a git repo, or when the worktree root is inside the `pc` folder under Node's `os.tmpdir()` (where `/paired-check` keeps its clones; compare resolved paths, ignoring case), print nothing and record nothing. Otherwise, in a repo that isn't set up, one paired-check arm would get the note and a later arm reusing the same clone path wouldn't.
- Treat the repo as set up if `CLAUDE.md` or `.claude/CLAUDE.md` at the worktree root contains `efficiency:start`.
- Keep state in `~/.claude/project-setup-state.json`, keyed by the resolved common git directory, so all worktrees of one repo share it. Values are `offered` or `done`.
- Only if the repo isn't set up and has no state entry: print one line ("This repo hasn't been set up for Claude Code yet. Offer once to set it up with the project-setup skill.") and record `offered`, so the note appears at most once per repo.
- No network calls, no writes except its own state file, finish well under a second, and print nothing on any error.

### 7. Report, then ask me three questions

Report in a short table, and save the same report as `REPORT.md` next to `MANIFEST.json`. Cover:

- Each change, its file, and backup path.
- What changed from the earlier version of this setup, if one was installed, and anything I'd edited that you left alone.
- Each component's state: installed, configured, enabled, loaded, or verified.
- The lines I need to paste.
- What needs a full Desktop restart (quit completely, not just close the window).
- Anything skipped or removed, and why.
- How rollback works:
  - Remove only what `MANIFEST.json` says this setup added and that still matches its recorded hash.
  - If I've edited a file since, remove only this setup's marked block or keys and leave the rest.
  - Never copy a backup over a file I've changed.
  - Uninstall only plugins this setup installed, following Ponytail's documented uninstall steps for Ponytail.
  - Keep shared tools such as Git and Node, and keep `~/.claude/paired-check/` (my measurements) unless I ask to delete it. Remove `%TEMP%\pc\`, the runner's scratch folder, if it exists.
- A suggested next step, not run automatically: `/paired-check` once, to record a baseline for this repo, with its maximum spend. The runs themselves start from a separate terminal.

Then ask:

1. Cap auto-compaction at 300k tokens? Every request re-sends the whole conversation, and on 1M-context models the default doesn't compact until about 967K, so long sessions get expensive and can lose focus. The trade-off is that older details get summarized sooner, and Claude Code's own `/autocompact` screen calls the auto setting strongly recommended and warns that overriding it can raise usage when resuming long sessions. A `/paired-check` on my own long tasks is what settles it. On yes, set `"autoCompactWindow": 300000` in `~/.claude/settings.json` (unless a value is already set), and tell me that `/autocompact auto` restores the default.
2. Should Auto be the default permission mode for new local sessions? It removes most approval prompts. My permission rules decide first, reads and edits inside the project then run without a check, and a safety classifier reviews the rest, such as shell commands and network access. In Anthropic's own study it blocked 89% of planted dangerous commands, where people approving by hand caught 14%. On Pro, Max and Team plans its checks don't count toward my usage, unlike the advisor's. On native Windows there's no sandbox under it, so a shell command that the classifier or one of my allow rules lets through runs with my full user rights. Interactive terminal and VS Code sessions already start in Auto when no permission mode is set: from v2.1.283 per the permission-modes docs, and on every plan and provider since v2.1.284. The docs cover the desktop app separately. On yes, set `permissions.defaultMode` to `"auto"` in `~/.claude/settings.json` (Auto doesn't take effect from project or local settings), and tell me that folders with a remembered mode need Auto picked once in the mode selector. On no, keep an existing value other than `"auto"`; otherwise set `"default"` there so new sessions keep asking me. Then tell me that on Pro, Max and Team plans, Claude Code asks once, in a terminal or VS Code session, whether to switch that setting to Auto, and that declining keeps it.
3. Advisor: off (default), `opus` (a second Opus checks key decisions), or `fable` (strongest; needs Fable access, may bill usage credits, and first needs me to run `/model fable` once, accept, then `/model default` to switch back). Each consultation re-reads the whole conversation without caching, so it adds usage. On Pro, a Fable advisor bills usage credits from the start; on Max, it counts toward the 50% weekly Fable allowance first. If I pick one, set `advisorModel`, and append this line to the working rules file: "Consult the advisor before committing to a non-trivial approach, when an error keeps recurring, or before declaring a multi-step task done; skip it for small edits."

Finish by telling me to restart Desktop and then run `/setup-check`.

<!-- end of Part 1, playbook v7.3 -->

---

## Part 2: Decision record (reference only; don't act on it)

### v7 review: Jev, Hindsight, JevRouter, the Karpathy method, and Claude Projects

#### The separate-call test

Jev, TypeSafe's "System One" model (released 2026-09-15), answers typed questions (pick one, score, yes or no) with probabilities, in well under a second, at $0.042 per million input tokens with free output. It saves money by replacing a separate frontier-model call whose only product is a branch, and custom agent pipelines are full of those.

Inside Claude Code they mostly don't exist. The next tool, the next file, and whether the work is done are decided within the main model's own generation, over a context that's already cached, so there's no call to replace. Handing those decisions to Jev adds a network round trip, latency, and a third party that reads your prompts or code. TypeSafe's own page on coding agents says there's no setting that turns a coding agent into a Jev-powered agent, and points Jev at the software you build instead.

Claude Code does make separate model calls in a few places: compaction summaries, Auto mode's safety classifier, the advisor, subagents, and prompt suggestions. Compaction is the only one with a Jev replacement in circulation, and the one independent test of it recommends against adopting it (fast-jev-compaction, below). Auto mode's classifier is already native.

#### Verdicts

| Candidate | Verdict | Why |
| --- | --- | --- |
| Jev inside Claude Code (any hook, proxy or plugin that hands Claude Code's decisions to Jev) | Skip | Fails the separate-call test; sends prompts or code to TypeSafe; closed weights. On the vendor's own four-workflow evaluation it lands near mid-tier LLMs, around 68% agreement with a frontier consensus |
| Jev in software you build with Claude Code | Use where it fits | Classification, routing, relevance filtering and gating inside your own apps. Keep counting, arithmetic and dates in code, set thresholds from shadow-mode data, and version the questions like code |
| fast-jev-compaction (Claude Code plugin) | Skip | Hermes Agent ported it into their compaction evaluation and decided not to adopt it: the recall gain came from keeping text verbatim, not from Jev's judgment; at a matched token budget, Jev tied plain recency ordering (77.8% vs 77.8%); it kept about 2.1x the tokens per turn and compacted ever more often, breaking the prompt cache. It also needs the early-access function-hooks flag and sends the conversation's text and tool inputs to TypeSafe. v7 adopts the part that worked: verbatim constraints and identifiers in the compact instructions |
| Yoshi (context-pruning proxy) | Skip | Its own registered studies show no validated savings: 0.03% more input on a long Sonnet session and 34% less on one Fable diagnostic, with both runs 4 to 5 times slower and three judge failures each. It runs through `ANTHROPIC_BASE_URL` and sends code from Write, Edit and Bash arguments to TypeSafe with no zero-retention option |
| winnow, jev-pruner (tool-output judges) | Skip | jev-pruner has RTK's role and ceiling, since it only sees Bash output (over about 10,000 tokens), but it sends that output and the whole session history to TypeSafe. winnow reaches further: it judges Read, Bash and Grep results over 1,500 characters, and by default sends each one to TypeSafe. Both need Claude Code's early-access function-hooks flag, and neither has a paired test. One user's replay of 40 long Bash and Read outputs from their own Claude Code sessions found that no selector, even one shown the agent's next message, kept meaningfully more of the later-used lines than plain head and tail cut to the same size. It's a small sample scored with a rough proxy, and Jev wasn't in it. The new output-filtering rule covers the need natively |
| jev-guard and similar Jev permission gates | Skip | Duplicate Auto mode's native classifier (step 7) |
| jev-belay, limpet (Jev Stop hooks) | Skip | The same risks as Stop-hook test gates. `/goal` with a named verifier is native |
| jev-rules, skillranker, jev-skillful (per-prompt rule and skill routers) | Skip | Path-scoped rules and on-demand skills already load conditionally; per-prompt injection grows the history every turn |
| jevgrep (dzhng) | Skip (re-checked 2026-09-29) | Still macOS and Linux only (a Windows pull request is open, unmerged). Since v0.3 it sends source to Jev through whichever provider `jg auth` sets up (Vercel AI Gateway, TypeSafe, OpenRouter or OpenCode Zen). The author's own runs now report 8 of 10 tasks solved, the same as without it, at 25.8% lower total cost including Jev (v0.4.3); v0.5.0 cut Jev's charges by about 59% but cost 2 to 3% more in total. Each is one run per task on ten tuned Python tasks with a GPT-5.6 Sol agent, not Claude Code, against a saved baseline that wasn't rerun |
| JevRouter (BillionsBobby, open source) | Skip | Picks which tool, skill or subagent handles the next step. Its benchmark measures tool-call prediction (44% of first-five calls, versus 24% for DeepSeek V4.1 Flash, on 10 Toolathlon tasks), and its README says that isn't task completion. In Claude Code the main model already makes that pick in the same generation |
| The "JevRouter" offer ("99% of Opus 5.5 and GPT-6 Astra's intelligence for 40% of the cost", "30% off all frontier models") | Skip | I found no methodology, benchmark or terms behind the figures. Using a discounted-models gateway with Claude Code means pointing `ANTHROPIC_BASE_URL` at it: all code and prompts pass through a third party, outside your plan |
| OpenRouter's Jev Router (`typesafe/jev-router`, listed 2026-09-25; not the community jev-router in the next row) | Skip | A cache-aware router from TypeSafe and OpenRouter. Jev picks a model and an effort level per request, and it switches models only when it expects the gain to beat the cache it would lose. The router's own tokens are free; the models it picks are billed as usual. Its 237 versus 130 of 423 tasks is against OpenRouter's own Auto Router, on four unnamed agent benchmarks, with no per-task data published. One outside $1,000 run on DeepSWE found it about equal to GPT-6 Astra on low, slightly dearer and almost 5x slower, with no score published. In Claude Code it means pointing `ANTHROPIC_BASE_URL` at OpenRouter: billed to OpenRouter credits outside your plan, and every prompt and file goes to OpenRouter, to TypeSafe (under zero-retention terms) and to whichever provider serves the picked model. That may not be a Claude model, and OpenRouter's own Claude Code guide warns that other providers may not work correctly |
| Mid-session model routers (jev-router, jcm-router, Jevonian) | Skip | Each switch to a different model starts a new prompt cache for the whole conversation. Native `opusplan`, or a manual Sonnet switch for routine work, covers cost control |
| Official TypeSafe agent skill | Optional, project scope, only in repos whose code calls the TypeSafe API | Helps Claude write correct Jev code (question design, batching, thresholds). It changes nothing about how Claude Code itself runs. TypeSafe's steps (docs.typesafe.ai/agent-skill) run `claude plugin install` with no scope, which installs it for every project. Install it for that repo only: paste `/plugin marketplace add typesafe-ai/skills`, then `/plugin install typesafe@typesafe-ai`, and pick local scope (project scope to share it with the team). In a terminal, add `--scope local` to both of TypeSafe's commands |
| cobusgreyling/Jev | Learning only | An unofficial lab with examples and skills for writing Jev code; nothing to install into Claude Code |
| Open-Jev and OpenJev-Fast | Skip | An open replica and a faster server for it. OpenJev-Fast is tested only on an NVIDIA B300 and needs about 98 GiB of GPU memory |
| GPT Researcher's Jev context filter | Evidence only | A careful benchmark in web-research RAG: 73% of kept passages relevant versus 46% for embeddings, and reports preferred 15 to 3. Two lessons transfer: the relevance threshold drove most of the gain (without it, precision fell to 50%), and a plain keyword filter with a relative threshold did as well as embeddings. Neither makes Claude Code itself cheaper |
| Hindsight Coding Agents (vectorize-io) | Skip by default; optional one-repo experiment | See the next table |
| Karpathy's autoresearch loop | Adopt the discipline, not the overnight loop | `/paired-check`: an evaluator the agent can't touch (hidden tests restored before grading, clones with no later history), one change at a time, a results log, and a stop condition. An unattended loop fails the loop test here, because configuration changes don't repeat weekly and every iteration spends plan usage |
| Karpathy's LLM Wiki | Adopt "lint" for auto memory; don't build a wiki of your code | `/memory-lint`. For code, the code is the source of truth, and an LLM-written architecture wiki is a second copy that drifts |
| Bilevel autoresearch (a loop that tunes the loop) | Skip | Reported, in an article supplied by the author (not public), for ML-training search, not coding; a meta-loop multiplies token use; not verified here |
| The "BRAIN/REFLEX" prompt screenshot | Not used as-is | Several passages are garbled; it describes building a new orchestration framework rather than configuring Claude Code; its nightly self-improvement ships changes without review; and "eliminates hallucination drift" overstates what a schema guarantees. Kept: its closing "what could be wrong" check and its preference for failing safely over looking clever |
| "CLM" | Unresolved | No Jev project by that name turned up. If it meant claude-mem, the memory verdict below stands |

Hindsight, from its own docs:

| Aspect | What the docs say | What it means here |
| --- | --- | --- |
| Wiring | Three hooks in `~/.claude/settings.json` (SessionStart, UserPromptSubmit, Stop), a user-scope MCP server, and a companion skill | A second memory system beside native auto memory and CLAUDE.md |
| Where memory lives | Hindsight Cloud by default; or a self-hosted server; or a local daemon that needs `uv` and an LLM for extraction, falling back to the Claude Code CLI when no API key is set | By default, prompts and transcripts go to Vectorize; the local fallback spends your plan |
| Background work | A cold repo gets a headless `claude -p` codebase survey (Haiku, $2 cap by default), repeated every 20 commits; every reply is written back for extraction | Plan usage you don't see in the chat |
| Injection | A synthesis on the first prompt, and the page roster and tool guide re-injected every 10 turns. The legacy plugin recalled up to 1,024 tokens on every prompt | Recurring context cost |
| Updates | Re-stages its runtime from npm once a day by default | Conflicts with this setup's pinned, verified components |
| Evidence | State of the art on LongMemEval, a conversational-memory benchmark, reproduced by outside researchers. The vendor's own coding test (August 2026): 61 bug fixes it built so each hinges on a past decision, three runs per arm, Claude Code on Sonnet 5. With Hindsight, Claude needed 0.36 retries per task after a failed hidden test instead of 0.85, Claude Code's own cost fell 24%, and solve rates didn't change | Almost all of the gain came from decisions that lived only in past conversations. Claude mostly found decisions recorded in git by itself (0.2 retries per task without Hindsight), and git is the only source the hardened experiment below learns from. The cost figure leaves out Hindsight's own LLM calls, which build the memory and write the injected summary. No independent coding-agent test |

If you want to try Hindsight anyway, do it in one repo whose commit messages record real decisions, but expect little. In the vendor's own coding test (61 tasks, three runs, Sonnet 5), Claude Code found decisions in git history on its own, right first time 82% of the time without Hindsight and 92% with it. About nine tenths of the gain came from decisions that lived only in past conversations. Hindsight only sees those with `retainSessions` on, which sends every reply's transcript to an extraction LLM: the Claude Code CLI on my plan, or the provider of any API key it finds. Install with `npx @vectorize-io/hindsight-coding-agents install claude-code --server daemon`, then set `~/.hindsight/coding-agent.json` so it learns from git history only, retrieves without an LLM on the prompt path, and never updates itself:

```json
{
  "serverMode": "daemon",
  "optInOnly": true,
  "optInPaths": ["~/path/to/that-repo"],
  "autoInject": "pages",
  "retainSessions": false,
  "codebaseSurvey": false,
  "autoUpdate": false,
  "embedVersion": "0.10.1",
  "gitIngest": "message",
  "retainExtractionMode": "concise",
  "pageTriggerCron": "H H * * *"
}
```

The daemon stores memory locally, but extraction still calls an LLM. It takes the first key it finds in this order: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, and only then the Claude Code CLI on your plan. So before installing, force the plan with a user environment variable, `setx HINDSIGHT_API_LLM_PROVIDER claude-code`, run the install from a PowerShell window opened after that, check that its output says extraction will use claude-code, then quit and reopen Claude Code. The first session starts the daemon, and it keeps its first choice until it's stopped. Without the variable, any of those keys on this machine sends commit messages, and whatever Claude files or asks through Hindsight's tools, to that provider, billed to that key. `/paired-check` can't judge it: its runs use fresh clones outside `optInPaths`, with memory off, by design. Judge it after two weeks of normal work in that repo instead. Keep it only if it has visibly saved you re-explaining past decisions and the usage ring hasn't climbed; otherwise remove it with `npx @vectorize-io/hindsight-coding-agents uninstall claude-code`.

### v7.1 review: setup infographics, Graphify, and the AI-Native Builder Stack

Four sources, checked against primary documentation. None beats this setup for Claude Code. The two Cowork infographics are about a different tab, and the few tips that carry over are already here in a stronger form. The Graphify stack duplicates LSP and Grep and hooks into every search. The builder stack is a menu of services to build with, not a way to configure Claude Code. Adopted from them: the documented interview-then-spec habit, the two-corrections rule, narrow batching, and a production-safety line for repos that use hosted services.

| Idea (source) | Verdict here | Why |
| --- | --- | --- |
| `/about-me` and `/my-company` skills; delete the About Me file; keep global instructions empty (Cowork infographics) | Already covered, differently | In Claude Code, context that every session needs belongs in a few CLAUDE.md lines, and occasional context in a skill, which loads only when used. A controlled study found that context files mostly add cost and that agents follow them literally, so keep only lines that change behavior |
| `/anti-ai-writing` with a list of banned words (Cowork) | Optional, for prose only, written positively | Anthropic's prompting guide says to tell Claude what to do instead of what not to do. Describe the style you want (plain words, short paragraphs) rather than listing words to avoid. The working rules already ask for concise prose |
| `/skill-creator` (Cowork) | Optional, while writing a skill | The official plugin runs an eval loop on a skill. Install it with `/plugin install skill-creator@claude-plugins-official` when you need it, unless `anthropic-skills:skill-creator` already appears in my skill list: Desktop loads that one from my claude.ai account, and the two are nearly the same, so don't install both |
| Keep skills under 2,000 tokens (Cowork) | Stricter than needed | The official limit is 500 lines for SKILL.md, with details moved into reference files. A skill's body loads only when the skill is used |
| "Make it a skill" and Record skill (Cowork desktop app) | Cowork only | Not verified here. In Claude Code, `/skill-creator` or a hand-written SKILL.md does the same job |
| Projects where "every chat remembers everything" (Cowork) | Overstated | Knowledge that's always loaded costs tokens in every chat that uses it. For code, the shared memory is a committed CLAUDE.md; Part 4 covers Claude Projects threads |
| An AskUserQuestion interview, repeating "ask me more" until the output "can't fail" (Cowork) | Adopt, for larger or ambiguous features only | Anthropic documents the pattern: Claude interviews you, writes the spec to a file, and a fresh session implements it. It reduces ambiguity; it can't guarantee correct output, and on small, clear tasks it only adds round trips |
| Turn every setting off except connectors (Cowork) | Skip for Code | "Everything off" would disable auto memory and the verification features this setup relies on. Knowledge-work connectors (Gmail, Slack, Granola, Gamma) don't help coding and bring untrusted text into sessions; step 1 already flags servers unrelated to coding |
| Opus 4.8 at High as the default (Cowork) | Outdated | It predates Opus 5 and Opus 5.5, and Opus 5.5 at its default medium effort matches or beats Opus 5 at high on Anthropic's coding evaluations |
| A fresh session every 20 messages (Cowork) | Keep this setup's rule | A fixed count is arbitrary. `/clear` when the topic changes or after two failed corrections on the same issue (Anthropic's rule), plus the optional compaction cap, targets the actual problem |
| Don't send follow-ups; call out mistakes (Cowork) | Already covered | `/rewind` and editing the last prompt keep failed attempts out of the context; see Part 3 |
| Batch tasks into one message (Cowork) | Adopt narrowly | Related small fixes in one message save a full re-read of the conversation for each; unrelated work still belongs in separate sessions |
| Sonnet or Haiku for quick tasks (Cowork) | Already covered | Switch routine work to Sonnet when limits get tight; Since v2.1.198 the built-in Explore agent runs on the session's model, capped at Opus, not on Haiku. If searches get too costly, a user subagent named `Explore` with `model: haiku` replaces it. It doesn't keep the built-in's prompt or read-only limit, so give it read-only tools such as `Read, Grep, Glob` and `omitClaudeMd: true` |
| Wispr Flow dictation (Cowork) | Personal preference | Cloud dictation, so check its data policy first. Windows voice typing (Win + H) is built in |
| A Graphify + Obsidian map instead of the "pile" of files (Claude Code infographic) | Skip for code; conditional experiment for large non-code folders | See the next table |
| AI-Native Builder Stack (29 services for building apps) | Out of scope for this setup; a reasonable menu | Its criteria (a free tier, scale, and MCP or CLI support) choose services to build on, not ways to make Claude Code better or cheaper. The curator appears on Tiger Data's site as its developer advocate, and Tiger Data is one of his four database picks; the list doesn't mention that. If you use any of these services, connect them as described below |

Graphify, from its own README and benchmarks:

| Aspect | What the sources say | What it means here |
| --- | --- | --- |
| What it builds | A knowledge graph of a folder. Code is parsed locally with tree-sitter; docs, PDFs and images are read by your assistant's model, in parallel subagents | Code stays local, but extracting documents spends plan usage |
| How it steers Claude | `graphify claude install` adds a CLAUDE.md section and a PreToolUse hook that fires before search commands and before Read and Glob, nudging Claude toward the graph | A second owner for navigation beside LSP and Grep, injected into every search |
| The 71.5x claim | Its own figure, on 52 mixed files (code, papers and images), measured against reading every raw file. Its README now leads with memory benchmarks and drops the figure, but its how-it-works page still gives it | Claude Code doesn't read every file; it searches and reads line ranges. An outside test on a pure Python codebase found 7.3x against the same raw-file baseline |
| Task-level evidence | Its own code benchmark gives a fixed agent (not Claude Code) one Graphify tool beside grep and read on a large Python repo: key-fact coverage on 6 questions rose from 70.8% to 82.0%, at about 140K tokens per question. The harness for that run isn't in its repo. One small outside paired test in Claude Code (3 feature tickets, one session per arm) found blind quality scores about tied and cost mixed: higher with Graphify in the first round, lower in the other two | Unproven where it matters: 6 questions and 3 pairs are far too few to show a gain in solve rate or billed cost |
| "Bigger dot, bigger idea" | Node size is connection count | The most-connected node isn't the most important one; Graphify's own `--exclude-hubs` option exists to hide utility hubs from its rankings |
| Freshness | Code is rebuilt by `graphify update`, `--watch` or optional git hooks; changed docs and papers need `/graphify --update`, which uses the model. Its docs say to keep `graphify-out/` out of git and force-add only the graph and its report to share it | A snapshot that can drift. In a git repo, add `graphify-out/` to `.gitignore` yourself; Graphify doesn't do it |
| Privacy | No telemetry; the local query log has been off by default since v0.9.13 | Fine as it ships; leave `GRAPHIFY_QUERY_LOG_ENABLE` and `GRAPHIFY_QUERY_LOG` unset |

If you want to try it on a large folder of notes or papers that you query often, install only the command-line tool and run none of its install commands. `graphify install --project` adds the same search hooks as `graphify claude install`, and plain `graphify install` adds an always-loaded note to `~/.claude/CLAUDE.md`. Install it with `uv tool install "graphifyy[pdf]"`; without the pdf extra, PDFs come out empty and nothing warns you. In a separate terminal in that folder, build the graph with `graphify extract . --backend claude-cli`, which uses plan usage. To stay fully local, install `"graphifyy[pdf,ollama]"` instead and use `--backend ollama`. Always name the backend: without it, Graphify picks whichever provider's API key it finds. Then ask it questions with `graphify query "..."` when you want them. Judge it by whether the answers improve; `/paired-check` measures code tasks, not this.

Connecting hosted services, if you build on any of them:

- Prefer each service's CLI (such as `gh`, `vercel`, `wrangler`, `supabase` or `stripe`) over its MCP server. The docs note that CLI tools are more context-efficient, and you see exactly what ran.
- Add an MCP server only to the project that uses it (`.mcp.json` or local scope), never user-wide, and only when the CLI can't do the job.
- Give Claude development or test credentials, never production ones: test API keys, a development project or database branch, and read-only modes where offered. Supabase's server has project scoping and a read-only mode. Its docs now allow a production project when the task needs production evidence, if it is scoped, read-only and limited to the needed tools; this setup stays stricter.
- Treat what these tools return (tickets, emails, database rows) as untrusted text; that's the prompt-injection path Supabase warns about.
- Part 1's project section adds a line naming the services, so Claude defaults to test resources.

### Review of the external v5 critique

| Finding | Verdict | What v6 does |
| --- | --- | --- |
| Savings forecasts and the quality claim weren't established | Accepted | Estimates are labeled rough guesses, there's no quality guarantee, and an optional paired check is described below |
| The 300k compaction cap was presented as optimal | Partly accepted | It's now a consent question with the trade-off stated, not a silent default |
| Stock Ponytail restricts tests and explanations | Finding accepted (verified in its skill file); remedy rejected | Ponytail stays, as the only add-on with a measured saving. A standing rule makes it use the project's test framework and always report results |
| Automatic onboarding was paired with a manual-only skill | Accepted | `project-setup` is now model-invocable; `setup-check` stays manual |
| The startup note couldn't offer "once" and missed `.claude/CLAUDE.md` | Accepted | Git-based repo detection (works in worktrees), both locations checked, and per-repo `offered`/`done` state. The hook is kept because it costs nothing in repos that are already set up |
| Rollback could discard later edits | Accepted | Ownership manifest with hashes; owned-only removal; backups are never copied over later edits |
| The Windows LSP wrapper was overspecified | Partly accepted | The official plugin is tried first. The wrapper is used only after an observed spawn failure and kept only if it passes the real test |
| The TEMP-file LSP test was invalid | Accepted | Read-only navigation in the real project, plus diagnostics in an excluded scratch folder inside it |
| Delegation to subagents was mandatory | Accepted | Delegation is now conditional |
| Fail-fast runs were confused with full validation | Accepted | The command map separates quick checks from a complete acceptance run |
| Cache expiry was used as a reason to discard context | Accepted | The habit is now based on relevance, not elapsed time |
| Advisor and Auto mode were entangled with the baseline | Rejected | They remain optional questions; nothing changes without a yes |
| Windows bugs became product-wide exclusions | Partly accepted | security-guidance isn't newly installed on Windows, but an existing healthy install is kept. The hosted-MCP advice is removed |
| Overlapping tools were treated as identical | Partly accepted | Graft, RTK and Context Mode are reclassified as conditional experiments; bundle repos are named exactly |
| Monitoring was treated as proof | Accepted | An optional paired check is added (in v7, the `/paired-check` skill); the usage ring is monitoring only |
| Native run and verify recipes were missing | Accepted | Bundled `/run`, `/verify` and `/run-skill-generator` are covered. Setup reuses existing recipes and never runs the generator, because it commits files |
| Keep the command map in private per-worktree records | Rejected | Project CLAUDE.md loads every session, survives compaction, and is where the docs put build and test commands. Only the startup note's state is private |
| Drop Ponytail, Context7, frontend-design and the compaction cap | Rejected | That would be safer on paper but worse for your goals. Each is kept, with its conflict resolved or turned into a choice |

### Evidence at a glance

Independent paired A/B tests by JetBrains (SkillsBench, 80 to 86 tasks, Claude Code 2.1.20x, Sonnet 5), one independent test of Superpowers, jevgrep's own published run, and, new in v7, Hermes Agent's evaluation of Jev compaction plus the authors' own published runs for Yoshi, JevRouter, GPT Researcher's filter and Hindsight, and, new in v7.1, Dasein's SWE-bench Verified comparison (sponsor-run: headless Claude Code, Sonnet 4.6, 100 tasks, the official grader, one run per arm), Graphify's own and one outside benchmark, and ETH Zürich's study of context files:

| Tool | Advertised | Measured | Quality |
| --- | --- | --- | --- |
| RTK | 60 to 90% fewer tokens (since July 2026 its README says up to 90% of shell output, not of the bill) | About 7.6% more expensive per task at low effort and no difference at high effort (JetBrains); 13% higher total cost, and higher on 63 of 100 tasks (Dasein); on Terminal-Bench 2.1 with RTK 0.45.0, 5% lower total cost for Claude Code on Fable 5.0 but almost all of it from one task, about 1% more per task and within noise, and 5% more in total and 17% more per task for OpenCode on DeepSeek (Quesma, 1,740 attempts); 5.8% more over 18 Opus 5 runs per arm on six Aider Polyglot tasks (Glia); 4.8% less, not significant, in RTK's own 13-task rerun | Unchanged (JetBrains); 54 solved against 57 (Dasein); 83% passed against 84% on Fable and 69% against 71% on DeepSeek (Quesma); 17 of 18 against 18 of 18 (Glia) |
| Caveman | 65% fewer output tokens | About 8.5% fewer output tokens, even when forced on (JetBrains); 19% lower total cost, with about 30% less output (Dasein) | No detectable loss (JetBrains); 58 solved against 57 (Dasein) |
| Ponytail (v4.8.4, full mode, medium effort) | 54% less code, about 20% cheaper | About 15% less code and 10.3% cheaper per task | 65 tied, 9 slightly worse, 6 slightly better; not powered to prove equivalence |
| benjamin-plus v6 (JetBrains' own tool and runs, not independent: about 80 SkillsBench tasks, Claude Code 2.1.201, Sonnet 5 at low effort only) | Up to 18% lower cost and 22% fewer tokens, quality unchanged | 17.9% lower median cost per task (16.7% on totals), with its rules (about 745 tokens) injected into every session; the previous version measured 10% a day earlier (not significant, and flat on totals), and a later run on the same benchmark measured 9.1%; on Codex, the same text as a plain skill folder saved nothing | 7 better, 5 worse, 68 tied in the headline run, but 7 better, 12 worse, 60 tied in the later one; the authors agree its rule to stop once the task's named check passes can stop early in repos with broader test suites, which this benchmark can't show; not powered to prove equivalence |
| Superpowers v5.0.5 (one independent test: Codex with GPT-5.4 at high effort, 500 SWE-bench-family tasks, one run per arm; neither Claude Code nor the current v6) | Better results | About 40% more tokens per task (mostly cached input) and about 20% longer runs, both significant | 239 solved against 228 of 500, not significant |
| jevgrep (author's own run, 10 tasks, a different agent) | Same results at about 30% lower cost, counting only the coding agent's bill | About 24% lower total cost for the current release, including the search service's list-price charges, and about 26% for the release before; both are 2026-09-28 reruns of the same ten tuned tasks against one saved baseline, one run each. The first run's about 40% excluded those charges | 8 of 10 solved, the same as without it (the first run solved 7) |
| fast-jev-compaction (Hermes Agent's port, 3 transcripts plus a repeated-compaction simulation) | Instant compaction that keeps everything verbatim | 32 points more recall, but only by keeping about 2.1x the tokens per turn; at a matched budget, Jev tied recency ordering (77.8% vs 77.8%); the compaction step itself cost about a ninth as much | Maintainers concluded the gain wasn't Jev's judgment and didn't adopt it |
| Yoshi (its own registered studies, one trial per arm) | Context pruning, "measured, not claimed" | 0.03% more input on a long Sonnet session; 34% less on one Fable diagnostic; both runs 4 to 5 times slower, with three judge failures each | All answers passed; combined cost unknown |
| JevRouter (its own run, 10 Toolathlon tasks) | Faster agent decisions | 44% of first-five tool calls predicted, versus 24% for DeepSeek V4.1 Flash | Routing prediction only, not task completion |
| GPT Researcher's context filter (its own replay benchmark, 28 research tasks) | More relevant RAG context | 73% of kept passages relevant, versus 46% for embeddings, at the same cost per report | Reports preferred 15 to 3; web research, not coding |
| Hindsight (LongMemEval, reproduced by outside researchers) | State-of-the-art agent memory | Conversational-memory accuracy | No coding-agent test |
| Graphify (its own benchmark, plus one outside test) | 71.5x fewer tokens per query | 71.5x on 52 mixed files, and 7.3x on a pure Python codebase, both against reading every raw file | No task-level test |
| Context files such as AGENTS.md (ETH Zürich: SWE-bench Lite and 138 tasks from repos with their own files; several agents, Claude Code among them) | Better agent performance | Over 20% higher inference cost, from broader exploration and literally followed instructions | LLM-generated files slightly lowered success; developer-written files slightly raised it |

Why the measured numbers differ from the advertised ones:

- RTK's hook only sees the Bash tool. It never sees the PowerShell tool, which Claude Code now turns on by default on Windows for claude.ai accounts and then treats as the primary shell. It also never sees the built-in Read, Grep and Glob tools or MCP results, and most of the bill is cached re-reads of history. So in JetBrains' test RTK could save at most roughly 3% of input tokens. In Quesma's shell-heavy test, terminal output was only about 7% of Fable's input, and about half of Claude Code's Bash calls already limited their own output with head, tail or wc. Claude Code also caps Bash output itself. A result over about 30,000 characters goes to a file and Claude sees a 2,000-character preview, and a failed command's output is cut to about 10,000 characters. So by default the huge outputs behind RTK's biggest counts never reach the model whole. RTK's own counter estimates shell-output bytes divided by four, with no cap at what Claude would have seen. It reported about 96 million tokens saved during runs where the bill went up. It also reported 349 million (89%) in Quesma's DeepSeek runs in OpenCode, which cost more. The extra cost came with extra turns. JetBrains saw 13.8% more turns at low effort. In Quesma's DeepSeek runs each turn carried 7% less input, but there were 18% more turns. One attempt got stuck in a `find` rewrite loop of 339 errors and cost about 9 times its baseline (fixed in RTK 0.46.0). With Fable in Claude Code, Quesma's cost change was within noise, so there was no saving there either.
- Caveman compresses only the narration between tool calls. Code and tool calls, which dominate agent output, stay verbatim.
- Ponytail's savings concentrate where an agent would otherwise over-build. Installed as a plain skill, it activated zero times in ten sessions; only the plugin, which injects its rules through hooks, worked. The measured setup didn't re-inject rules into subagents. The current plugin does: each subagent the matcher lets through gets its own copy of the full ruleset, about 5,200 characters (roughly 1.3K tokens), which every API call in that subagent re-reads. In the main session, one small outside A/B (Ponytail issue #685: Sonnet 5, 5 single-turn tasks, 8 runs each) found the plugin added about 2.5K to 3K tokens that every call re-reads. It found the plugin cost-neutral against no add-on and about 7% dearer than a one-line request to leave a runnable check, while it wrote about 20% less code. No test has measured what the subagent copies cost. Two open pull requests would send subagents a condensed version about half the size.
- Ponytail's own rules ask for one small check instead of test frameworks, fixtures or per-function suites, unless you ask for more. They also ask for at most three short lines of explanation, unless you ask for a report. The standing rule in Part 1 is that request.
- An adversarial test suite against RTK v0.37.1 (April 2026) found compressions that stripped a detached-HEAD warning, dropped `[CRITICAL]` log severity, and hid skipped tests. Those three are fixed in v0.50.0 (September 2026), but the same kind of bug keeps turning up. In v0.50.0's own source, capped grep output still hides the extra lines with no way to get them back (#4098), `rtk golangci-lint` still turns exit 1 into exit 0 (#3870), `rtk log` still sums up a failed `dotnet test` run as 0 errors (#4018), and `rtk pytest` still reports a run with fixture errors as "N passed".
- Decision models save money by replacing separate decision calls, and Claude Code makes few of those (the separate-call test above).
- Pruning or rewriting earlier conversation invalidates the prompt cache from the first changed byte. Because most of an agent's bill is cached re-reads, a smaller context can still cost more; Hermes also saw pruning-only compaction fire ever more often, because the text it never prunes keeps accumulating.
- jevgrep's 40% excludes Jev's own charges, and Yoshi's percentages count accumulated input without cache pricing. Both authors say so.
- Graphify's baseline reads every raw file for every question, which no agent does, so its savings against Claude Code's real navigation are unmeasured.
- Dasein's benchmark is sponsor-run (its top arm is the sponsor's own product), with one run per arm. A gap of a few solves out of 100 is within noise; the cost differences are larger and more telling.

What the official Claude Code docs establish:

- On models with a native 1M window (Opus 5.5, Sonnet 5.5, Sonnet 5, Fable 5.1), Claude Code doesn't auto-compact until about 967K tokens by default. `autoCompactWindow` accepts 100,000 to 1,000,000, and `CLAUDE_CODE_AUTO_COMPACT_WINDOW` overrides it, the `--autocompact` flag and `/autocompact`.
- Every request re-sends the conversation at the cached rate, and model performance degrades as context fills.
- Opus 5.5 at its default medium effort matches or beats Opus 5 at high on Anthropic's coding evaluations; `max` is prone to overthinking.
- MCP tool schemas are deferred by default, and CLI tools such as `gh` are still more context-efficient than MCP servers.
- Keep each CLAUDE.md under about 200 lines, and cut any line whose removal wouldn't cause mistakes.
- On a subscription, the main conversation's prompt cache lasts an hour while I'm within my plan's included usage, and drops to five minutes once I'm drawing on usage credits (for example, Fable on Pro). The first message after a longer break reprocesses the whole context once.
- `/run` and `/verify` drive your real app, not just the tests. `/run-skill-generator` records a launch recipe and commits it as a project skill, and `/verify` can record its own.
- MEMORY.md loads its first 200 lines or 25KB into every session; topic files load only when needed. Near either limit, Claude Code reminds Claude to shorten it and drop stale entries. The reminder is triggered by size, not by whether entries are still accurate.
- Since v2.1.277, a repo with an `AGENTS.md` and no `CLAUDE.md` or `CLAUDE.local.md` loads AGENTS.md natively. Once a CLAUDE.md exists, only CLAUDE.md loads unless it imports `@AGENTS.md`, and the import never loads the file twice.
- On Opus 5.5, Sonnet 5.5 and Fable 5.1 with a subscription, changing effort mid-session keeps the prompt cache. Switching models, and each `opusplan` plan-mode toggle, starts a fresh one.

Headless mode (`claude -p`) can return JSON that includes cost and token usage, and `--max-turns` and `--max-budget-usd` bound a run. Claude Code v2.1.41 added a check that refused to start `claude` inside a Claude Code session, and v2.1.47 let non-interactive subcommands through (issue #25803). Current versions start nested sessions, `--version` included. `/paired-check`'s runner still starts from a separate terminal, so the Desktop session that prepared the runs can't touch them and they don't inherit its environment (`CLAUDECODE`, `CLAUDE_CODE_CHILD_SESSION` and the desktop app's own variables). It proves its flags there with a one-turn test run. Two more facts shape the runner: all worktrees of a repository share one auto memory folder, and `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` turns auto memory off for a session. The env-vars and settings-reference docs say `CLAUDE_CODE_EFFORT_LEVEL` takes precedence over `--effort`, `/effort`, `modelSettings` and `effortLevel`. A `maxEffortLevel` cap (v2.1.267 and later) still applies, so if any settings file caps effort below the batch's level, runs go at the cap while the batch still records the higher level.

Three more headless facts shape the runner. `total_cost_usd` and `modelUsage` are client-side estimates at API prices, not my plan usage. `--bare` skips CLAUDE.md, plugins, hooks, skills and auto memory and never uses a subscription login, so the runner must not pass it; the docs say it will become the default for `-p` in a future release, which is announced, not released. And in `-p` runs, a Fable request that bills usage credits is charged without the consent prompt.

### Native Claude Code features and settings

| Feature | Verdict | Why |
| --- | --- | --- |
| `autoCompactWindow` 300k | Opt-in (Part 1 step 7) | The biggest lever for long sessions; the trade-off is earlier summarization |
| Compact instructions in project CLAUDE.md | Use (Part 1 step 5) | Steer what every compaction keeps; v7 keeps constraints and identifiers verbatim |
| `/clear` between unrelated tasks | Use (habit) | Stale context costs tokens on every later message |
| `/compact` with a focus; `/rewind` then Summarize | Use (habit) | Keeps what matters and drops failed attempts. In the Desktop Code tab, `/rewind` or Esc twice only cuts the conversation back to an earlier message. It has no Summarize option and may not undo file edits, so check with git. There, trim with `/compact` and a focus |
| Subagents (built-in Explore) | Use when a summary is enough | Large reads stay in the subagent, but its work still counts toward usage |
| Side chat (`/btw`, Ctrl+;) | Use (habit) | Answers questions without adding to the main thread |
| Plan mode | Use for complex work | Prevents expensive rework when the first direction is wrong |
| `/goal` | Use for outcome-driven tasks | Keeps Claude working toward a stated finish line; name the command that proves it, so completion is checked rather than asserted |
| AskUserQuestion interview | Use for larger or ambiguous features | Anthropic's documented pattern: Claude interviews you, writes the spec to a file, and a fresh session implements it |
| `/loop` | In-session polling only | Reruns a prompt only while this session is open and idle, and each run is a full turn. Recurring loops expire after 7 days, and a fired run can't start manual-only skills such as `/verify`. For local work that passes the loop test, use a Desktop scheduled task instead (Routines page, New routine, Local). It runs only while the app is open and the computer is awake |
| Bundled `/run` and `/verify` | Use on demand | Check changes against the running app, not just tests |
| Bundled `/run-skill-generator` | Optional, once per project | Records the launch recipe so it isn't rediscovered; it commits a project skill |
| Bundled `/code-review` | Use on demand, before merging | Reviews the diff, a branch or a PR for bugs in a background subagent, at an effort level I pick. A background `--fix` edits outside checkpoints, so `/rewind` can't undo it; git can. `ultra` runs a deep multi-agent review in Anthropic's cloud; after three one-time free runs on Pro or Max, each run typically bills $5 to $25 in usage credits |
| Bundled `/simplify` | Skip | Four agents check the changed code for reuse, simplification, efficiency and abstraction level, then apply fixes. It doesn't look for bugs, and it overlaps Ponytail and `/ponytail-review` |
| Bundled `/debug` | Only when Claude Code itself misbehaves | Turns on debug logging and has Claude read this session's log to troubleshoot Claude Code, such as a hook or MCP server that fails. Logging starts when I run it, so I reproduce the problem after. It doesn't debug my code |
| Desktop Review code button | Use before committing | Built-in review focused on compile errors, logic bugs and security issues |
| Desktop auto-verify preview | Keep your current choice | Claude checks its own web UI changes with screenshots |
| Auto memory | Keep your current choice | Learns your corrections without extra setup |
| `/memory` | Use (monthly) | Opens the auto memory folder; `/memory-lint` does the review |
| Effort at Opus 5.5 default (medium) | Keep | Already strong; raising it globally mostly adds tokens |
| `ultrathink` keyword | Use for single hard turns | Deeper reasoning for one turn without changing the session |
| Advisor | Opt-in (Part 1 step 7) | Automatic second opinion at decision points; each call re-reads the conversation |
| Auto mode | Opt-in (Part 1 step 7) | Fewer approval prompts, with a safety classifier checking actions |
| Bash sandbox (`/sandbox`, auto-allow) | Skip on native Windows | The documented way to cut Bash prompts without a classifier, but it runs only on macOS, Linux and WSL2. On native Windows, commands run unsandboxed even with `sandbox.enabled` set, and Desktop hides its Local sandbox setting there. Desktop WSL sessions have it, but this setup targets Local sessions. Anthropic's standalone sandbox runtime has a Windows alpha, but it needs an admin install and can't reach tools installed under my profile. Auto mode stays the owner of approval prompts, with no sandbox behind it |
| `opusplan`, or Sonnet for routine tasks | Optional | Since v2.1.284 the `sonnet` alias is Sonnet 5.5, with a native 1M window and a list price of $2/$10 per Mtok against Opus 5.5's $4/$20. Cache reads cost $0.20 per Mtok on both, so only fresh input, cache writes and output are half price. The more of a session is cached history, the less Sonnet saves; in a long session it's closer to a third than a half. Each model switch, and each `opusplan` plan-mode toggle, starts a fresh prompt cache, so switch at the start of a task, not mid-task. |
| Dynamic workflows and `ultracode` | Per task only | Since v2.1.284, Ultracode is its own toggle in `/effort` (Tab, or `/effort ultracode off`) and no longer forces xhigh, so it stays on at any effort for the rest of the session. For one task, put the keyword `ultracode` in that prompt, or just ask for a workflow in plain words. That runs only that task as a workflow, leaves ultracode off, and keeps the large-run warning that ultracode skips. On a subscription workflow agents draw on my limits, so if I used `/effort ultracode`, turn it off after the task. |
| Agent teams | Skip | CLI-only, and about 7x the tokens when teammates plan |
| Fast mode | Skip | A speed feature, not a quality one, and it can add cost |
| Fallback model chain | Skip | Can finish a turn on a weaker model |
| MCP tool search (deferred schemas) | Keep the default | Only tool names load until a tool is used |
| Prompt suggestions | Leave as is | A small background request per reply; turn off only if limits are tight |
| PowerShell tool (preview) | Leave as detected | On by default on Windows for claude.ai and Console accounts when Git Bash is installed, unless feature-flag fetching is off (step 1 checks). Claude then uses it as the primary shell and keeps Bash for POSIX scripts. It doesn't load profiles. Neither shell tool is sandboxed on native Windows; the sandbox needs WSL2. A hook that inspects shell commands must match PowerShell as well as Bash |
| Usage ring, `/usage`, `/context` | Use to monitor | Shows context and plan usage, attribution, and cache misses |
| `/doctor prompt-audit` | Run once, then after big changes | Finds instructions newer models no longer need |
| `/insights` | Optional | Report on friction patterns; running it costs tokens |
| Headless `claude -p` | Only through `/paired-check`'s runner, started from a separate terminal | Spends the same plan; always bounded by turns, budget and time; started outside a session so runs don't inherit its environment |
| `claude plugin eval` | Optional, for a plugin's skills | Runs prompts in isolated sessions with and without a plugin and scores them. Run it from a terminal, not inside a session |
| Function hooks (early access, `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`) | Leave off | An early-access interface; the only component here that needed it is Skip |
| Statusline HUD | Skip | Desktop's usage ring covers it |
| OpenTelemetry export | Skip | Not needed for one user, and keeps data local |

### Official plugins (claude-plugins-official)

| Plugin | Verdict | Why |
| --- | --- | --- |
| LSP plugins (typescript, pyright, csharp, gopls, rust-analyzer, clangd, jdtls, kotlin, php, ruby, swift, lua) | Use once `/setup-check` passes; not paired-tested | Type errors after each Edit or Write, and symbol lookups instead of text search; npm-only servers may need the Windows fallback. No independent paired test of solve rate and billed cost with and without them was found, and the two small tests that exist cover lookups only, not diagnostics. One, with Claude told to prefer LSP, found 3 to 14% lower cost and no missed references. The other, a preliminary study on small repos with its own agent loop, found LSP lookups usually saved no tokens, and grep did better on multi-file renames. Diagnostics can go stale after Bash edits, formatter hooks or files created mid-session, so the project's own typecheck and tests decide. In a repo where they're mostly noise, disable the plugin for that repo |
| frontend-design | Use only for new frontends, repo scope | Activates automatically for UI work; kept out of repos with a design system |
| context7 (maintained by Upstash) | Use if you accept its hosted queries | Current library docs from Upstash's hosted server (no local process since August 2026). My rules keep code out of queries, but Upstash stores queries, keeps API logs for 30 days, and sends queries to LLM providers, including OpenAI, Google and Anthropic, to rank results. Anyone can add a library, so treat results as untrusted text; a prompt-injection flaw (ContextCrush) was fixed on Upstash's server in February 2026. In September 2026 a plugin change broke keyless use for about a day until Upstash patched its server; `/setup-check` catches that kind of break. The cost evidence is Upstash's own: about 35% cheaper than Claude Code's web tools on 100 docs questions, answer quality not measured |
| security-guidance | Don't add on Windows yet; keep an existing install only if its hooks run cleanly here and I accept its costs | Its hooks currently fail or loop on many Windows setups (see Windows notes). Where they run, the first session installs the Agent SDK into a venv of 300 MB or more, and `SECURITY_GUIDANCE_DISABLE=1` doesn't stop that. Each turn that changes files gets a background review, and each commit Claude makes gets a deeper multi-turn one. Both use Opus 4.7 by default and count toward my usage. On a subscription login those reviews may skip silently while the hooks still run (issue #5067) |
| code-review plugin, feature-dev, pr-review-toolkit | Skip | Compete to own planning, building and review; bundled `/code-review` and Desktop's Review code cover review |
| code-simplifier | Skip | Overlaps Ponytail |
| commit-commands | Optional | Manual git shortcuts; no quality effect |
| skill-creator | Often already on in Desktop through the claude.ai account, as `anthropic-skills:skill-creator`; install the plugin only where it's missing | Runs an eval loop comparing a skill's results with and without it. Desktop's `anthropic-skills:skill-creator` is the same skill with the same scripts; only its packaging step differs. Adding the plugin too would list two copies for Claude to choose between. Its description-tuning step runs each test query three times a round, for up to five rounds, with `claude -p` on my plan. Where the `/` menu doesn't show it: `/plugin install skill-creator@claude-plugins-official` |
| hookify | Skip | Not needed for this setup |
| ralph-loop | Skip | Autonomous loops burn tokens; `/goal` is native |
| CLAUDE.md maintenance plugins | Skip | `/doctor`, `/memory` and prompt-audit cover this |
| Output styles: the explanatory and learning plugins, and the built-in Explanatory, Learning and Proactive styles | Skip | Explanatory and Learning add prose by design, not better code. Proactive has Claude assume instead of asking on routine decisions and stay out of plan mode unless I ask, which cuts against the plan-first and interview habits for larger work |
| Built-in Concise output style (since v2.1.237) | Conditional experiment, tried before Caveman and never together with it | Leads with the result and drops preamble, narration and recaps. It keeps Claude Code's coding instructions and the full text of errors, failing tests, security warnings and destructive-action confirmations. It adds about 300 tokens to the system prompt and a one-line reminder each turn, against over 1,000 tokens and a reminder each turn for Caveman, with no hooks or third-party code. Its rules say they win over more general communication guidance and keep a caveat only when it changes my next step, so check that reports still carry the caveats and risks the standing rule asks for. It's an instruction, not a filter, and no paired test covers it yet. To try it, set `"outputStyle": "Concise"` (case-sensitive) in `~/.claude/settings.json` and compare it with one `/paired-check` trial; switching mid-session keeps the prompt cache |
| `/security-review` and the Claude Security plugin | Use on demand | Branch-wide or deep security passes when you ask |

### Community plugins, skills and tools

| Component | Verdict | Why |
| --- | --- | --- |
| Ponytail plugin, default mode, with the standing rule | Use | The only add-on with a significant measured saving; must run as the plugin; the rule keeps tests and reports intact |
| Ponytail skills `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt` | Optional, manual | Review a diff or repo for over-building when you ask; never run repo-wide cleanups automatically |
| Caveman | Conditional experiment, only after the built-in Concise style (was Skip before v7.1) | Four paired tests disagree on the size. JetBrains: about 8.5% fewer output tokens. Dasein (sponsor-run): 19% lower total cost with no solve loss. THOL (run by a competing tool's author, Sonnet 4.6): about 2% cheaper overall and 14% on long sessions, both within noise. An independent blog test on Sonnet 5 at high effort: about 24% cheaper with a small solve drop inside noise, but plain medium effort without Caveman was just as cheap. So try the built-in Concise style first: first-party and no install, though nobody has measured it in agent runs yet. In Desktop there's no picker: set `outputStyle` to `Concise` in my user settings (the name is case-sensitive). Caveman's terse narration is harder to read, and by its own estimate its rules add about 1,000 input tokens to every call. If Concise saves too little, install it with `/plugin marketplace add JuliusBrussee/caveman`, then `/plugin install caveman@caveman`, not the piped script (adding it through Desktop's Plugins menu has failed, Caveman issue 705), and decline its statusline offer. The plugin (v2.7.0) also brings 20 skills and 3 subagents, some overlapping Ponytail; leave out its separate proxy (`caveman claude`). On Windows, stop the trial at the first hook error or timeout: with Ponytail also installed, two prompt hooks run through Git Bash at once, which can crash or stall every prompt (Claude Code issue 90122) |
| RTK | Skip (was a conditional experiment; re-checked 2026-09-29) | No paired test of billed cost has found a reliable saving, RTK's own included. Cost rose at low effort and didn't change at high (JetBrains). It rose 13% (Dasein) and 5.8% on six tasks (Glia). RTK's own 13-task rerun came out 4.8% cheaper, which it calls cost-neutral. With Claude Code on Fable, Quesma's total bill fell 5%, almost all from one task; per task it was about 1% higher, within noise. Noisy output isn't an exception. Claude Code already caps long command output and saves the rest to a file, and JetBrains found it already truncates the huge outputs RTK claims to compress. The output-filtering rule covers what's left. In JetBrains' low-effort run, the pairs where RTK rewrote the most commands cost about 24% more. RTK's Claude Code hook matches only the Bash tool. On Windows with a claude.ai login, the PowerShell tool is on by default and Claude treats it as the primary shell. Reconsider only if an independent paired test shows a lower bill at an equal solve rate, and the hook covers PowerShell |
| Chisle | Skip | A competing automatic output filter with its own style rules |
| Context Mode | Conditional experiment | Only if one MCP server's huge outputs dominate usage; source-available under the Elastic License 2.0. It can't shrink another server's output. Its hooks only remind Claude now and then to fetch or filter that data inside its sandbox. The plugin hooks six events and saves its own snapshot at compaction, so it would be a second owner beside native compaction. Each time its server starts, it also adds a SessionStart hook to my user settings, and uninstalling leaves that hook behind. For a trial, use its MCP-only install (no hooks), pinned to a version, and tell Claude when to use its tools. Its last release was v1.0.169 in June 2026, and recent Windows bug reports have no replies |
| Graft (trailhq/Graft) and its fork aylith-labs/graft | Conditional experiment | Not a default: `graft init` wires four hooks, a statusline and an MCP server into the repo. Unless I pass `--no-global`, it also copies the hooks and server into my user-level Claude settings, so they fire in every project. It adds graph nodes to every prompt and rebuilds each turn. Its CLI-only structural mode (`graft build`, then `graft ask`) runs locally with no key and is worth a scoped trial for a large, unfamiliar codebase. Upstream sends anonymous usage events by default, one of them from `npm install` itself, so set `DO_NOT_TRACK=1` in the install shell only, then run `graft telemetry disable`. Its 33-against-27 SWE-bench result on 50 tasks is the vendor's own, and its token and cost savings count only the tasks both sides solved. The fork removes telemetry, the hosted upload feature and `init`, but has no releases or npm package, so it means building from source |
| Serena | Skip | Duplicates the official LSP plugins |
| Other code indexers (code-review-graph, jcodemunch, CBM, claude-context, JetBrains Context) | Skip | Duplicate LSP and Grep, and most install their own hooks and instructions. claude-context by default, and JetBrains Context always, send code chunks to cloud embedding services. JetBrains Context (CLI v0.9.14) is also closed source, installs by piping a remote script into PowerShell, needs a JetBrains account with an AI or IDE licence, and its only figure (up to 48% lower cost) is JetBrains' own claim. CBM's own paper found lower answer quality than plain file exploration (83% against 92%), with far fewer tokens. jcodemunch's one user-run A/B (25 runs per arm, one task, against Grep and Read without LSP) showed 20 against 18 successes and 5.7% lower cost, too few runs to count. No independent test shows any of them beating LSP plus Grep on solved tasks or billed cost |
| Graphify (safishamsi/graphify) | Skip for code; conditional experiment for large non-code folders | Duplicates LSP and Grep, hooks into every search, and its savings are measured against reading every raw file; see the v7.1 review |
| jevgrep (dzhng/jevgrep) | Skip (re-checked 2026-09-29) | Still macOS and Linux only; sends source to a hosted model through a paid Vercel AI Gateway key; the author's newest runs (ten tuned tasks, a reused baseline, Codex with GPT-5.6 Sol) matched the baseline's 8 of 10 at about 24% to 26% lower total cost including Jev's charges, which isn't a Claude Code test; Explore, Grep and LSP cover the need locally |
| Jev-based plugins, hooks, proxies and routers (fast-jev-compaction, Yoshi, winnow, jev-pruner, jev-guard, jev-rules, JevRouter and similar) | Skip | See the v7 review |
| TypeSafe agent skill (typesafe-ai/skills) | Optional, project scope | Only in repos whose code calls the TypeSafe API |
| benjamin-plus (JetBrains/benjamin-plus-skill) | Skip by default; conditional experiment | JetBrains' own five-rule habit set, about 745 tokens loaded every session: batch lookups, read small slices, probe dependencies once, stop when the task's own check passes, poll slowly. Its authors measured 17.9% lower median cost on SkillsBench (Sonnet 5, low effort only, no raw data published), 10% (not significant) with the previous version a day earlier, then 9.1% in a rerun ten days later where more tasks got worse than better (12 against 7, not significant). Nobody outside JetBrains has replicated it, it's untested on Opus or with Ponytail, and as a skill folder it saved nothing. Its stop rule clashes with my full acceptance checks (the maintainer agrees it can give a false green in repos with their own test suites), and its two-line closing and ban on tests the task didn't ask for clash with the standing request. By its authors' account, its polling rule does nothing in Claude Code. To try it, add the wording of rules 1 and 3 to `~/.claude/rules/token-efficiency.md` without rule 3's example commands, whose bug fixes are still unmerged (rule 2 is mostly there already). A trimmed set isn't what was measured, so keep it only if `/paired-check` shows lower billed cost at an equal solve rate |
| Superpowers | Skip by default (re-checked 2026-09-29) | The large independent test (v5.0.5 on Codex, 500 SWE-bench-style tasks) found no significant correctness gain, with about 40% more tokens, mostly cached input, and 20% longer runs. Since v6.0 (June 2026) it has trimmed its bootstrap and claims its subagent workflow uses almost half the tokens, but only in its own evals. On Claude Code there's only a small blog run (six sessions each way, no per-task data) that reported about 9% lower cost but more tokens on simple tasks; no paired Claude Code test is known. Its SessionStart hook loads the bootstrap every session, and brainstorming and plan approval add manual back-and-forth |
| claude-mem, Hindsight and memory MCP servers | Skip by default | Duplicate native auto memory; Hindsight's hardened one-repo experiment is in the v7 review |
| Karpathy LLM Wiki skills and plugins | Skip for code repos | Reasonable for a separate notes or research repo; for code, use `/memory-lint` and keep the code as the source of truth |
| Headroom, API-layer proxies, LiteLLM | Skip | Sit between you and the API, with cache and privacy risks. In Dasein's July SWE-bench run Headroom cost 44% more than no layer, with the worst cache reuse, and its own docs say code passes through unchanged. LiteLLM's PyPI package was hijacked with a credential stealer in March 2026 (versions 1.82.7 and 1.82.8) |
| Parsec, Fermat's Last Token, WOZCODE, tokenade | Skip | In Dasein's run Parsec came first (62 of 100 solved at 39% lower cost). Fermat and WOZCODE were cheaper than no layer but solved 2 fewer. Dasein makes Parsec, each layer has one reported run, and Fermat ran in September on a newer setup. The measured Parsec arm was Dasein's hosted service with extra private hooks, run before the local release existed. The local proxy sends context chunks to Dasein for scoring unless I host the scorer myself. Fermat is a paid local proxy that swaps in its own file tools. WOZCODE is a commercial plugin with a capped free tier; it replaces the built-in file tools, sends exploration to Haiku, and ran 23% slower. tokenade tops THOL, which its author runs; it's a closed binary that needs an account, rewrites Bash, Read and Glob output through hooks and moves auto-compact to 70% of the window |
| Bundles oratelecom/tokenwar, reni10/exodia-stack, sgaabdu4/claude-code-tips, vagkaratzas/token-saviour | Skip | Each installs several of the tools above at once; judge components individually instead |
| Caveman Code | Skip | A separate, now-frozen agent, not a Claude Code add-on |
| ccusage | Optional | Local usage report from session logs; the built-in usage views cover most needs |

### MCP servers

| Server | Verdict | Why |
| --- | --- | --- |
| Context7 (through its plugin) | Use if accepted | See official plugins |
| GitHub MCP | Skip | The `gh` CLI is more context-efficient, and Desktop's PR monitoring uses it |
| Playwright or Chrome DevTools MCP | Skip | Desktop's Browser pane, auto-verify and `/verify` already drive a browser; page snapshots are large |
| Claude in Chrome | Optional | For acting on sites where you're signed in |
| Chat-oriented servers in `claude_desktop_config.json` | Disable for Code if unused | They load into every local Code session |
| Serena, Context Mode, Graft servers | See above | Not defaults |
| Hindsight's knowledge-tools server | Skip by default | Part of the Hindsight integration |
| Hosted-service servers (databases, payments, hosting) | Project scope only, with development or test credentials | Prefer the service's CLI. If you add one, point it at one development project and use its read-only mode where offered. Supabase's docs now allow production only when a task needs it, and then scoped, read-only and with limited tool groups; see the v7.1 review |
| Knowledge-work plugins and connectors (sales, finance, small-business and similar plugins; Gmail, Slack, Granola, Gamma) | Skip for Code sessions | They don't help coding and bring untrusted text into sessions. Plugins turned on for my claude.ai account, by me or my organization, also load in Code sessions with their MCP servers and those servers' instructions. Desktop passes them into each local session itself, and signed-in terminal sessions sync them as `<name>@synced`. If I don't use one anywhere, turn it off in Customize. To keep one for Cowork only, set its id to false under `enabledPlugins` in `~/.claude/settings.json` (`<name>@synced` for terminal sessions; the docs give plugins that an app like Desktop passes in the id `<name>@inline`), then confirm with `/setup-check` that its servers are gone. A plugin my organization requires can't be turned off this way. For claude.ai connectors, use the Connectors switch in the composer's + menu, which also sets the default for new sessions |
| Jev MCP servers (jev-mcp and similar) | Skip | Every use is an extra call made from inside the session; see the separate-call test |

### Hooks

| Hook | Verdict | Why |
| --- | --- | --- |
| Ponytail's hooks | Use | How Ponytail stays active in every session and in code-writing subagents |
| Startup note for repos that aren't set up (Part 1 step 6) | Use | Git-aware, at most once per repo, silent in repos already set up |
| RTK rewrite hook | Skip | See RTK. The hook also sits in the permission path. It rewrites each supported Bash command to an `rtk` command. It checks my permission rules with its own matcher, and when it finds a matching allow rule it approves the command itself, with no prompt. Claude Code still applies my deny and ask rules, but to the rewritten `rtk` command. A high-severity bypass in that approval (GHSA-7gxq-fvfc-g327) was fixed in v0.42.2 in June 2026. Still open in September 2026: it reads an exact allow rule such as `Bash(git diff)` as a prefix, so `git diff --ext-diff` runs without a prompt (#3673). Its deny check misses commands behind an env assignment or a wrapper such as `timeout` (#4281). And if I allow `rtk` commands, the natural fix for prompts on them, anything wrapped in `rtk` escapes my per-command rules (#3970). Its default global install (`rtk init -g`) also adds `@RTK.md` to my global CLAUDE.md. That's always-loaded text telling Claude to treat condensed output as the complete result, which works against my output-filtering rule. Re-check these issues before any RTK trial |
| Auto-format on edit | Optional, project scope | Only in a repo that already has a formatter. Since v2.1.90 a PostToolUse formatter after Edit or Write no longer triggers the stale-file error, but Claude still has to re-read before editing lines the formatter changed. A formatter run through Bash or a pre-commit hook can still force a re-read. Don't copy the docs' example as is: it needs `jq`, and `xargs` strips the backslashes from Windows paths. Test the hook on a real Windows path first |
| Stop-hook test gates | Skip | Can loop and push fixes outside the task |
| security-guidance hooks | Don't add on Windows yet | See Windows notes |
| Custom preprocessing (for example grepping a huge log) | Optional | Official pattern; write one only for a specific recurring log |
| Per-prompt memory or rule injection (Hindsight recall, rule routers) | Skip | Adds text to the history every turn; native memory and path-scoped rules cover this |
| Tool-output judges (winnow, jev-pruner) | Skip | RTK's risks, plus every tool result leaves the machine |
| Jev Stop hooks (jev-belay, limpet) | Skip | See Stop-hook test gates |
| Compaction replacements through function hooks (fast-jev-compaction) | Skip | See the v7 review |

### Apps and CLI tools

| Tool | Verdict | Why |
| --- | --- | --- |
| Git for Windows | Required | Worktrees and the Bash tool |
| Node.js LTS | Required | Ponytail's hooks, the startup note, and npm-based language servers |
| Language server binaries | Required per language | The LSP plugins don't include them |
| GitHub CLI (`gh`) | Optional | Desktop PR status, CI auto-fix and auto-merge |
| Claude Code CLI (`claude`) | Optional | Needed only for `/paired-check`'s runner. Install it with `winget install --id Anthropic.ClaudeCode -e --scope user`, which puts `claude.exe` on my user PATH, not with the piped `install.ps1` script. If WinGet asks for admin rights, stop. WinGet can trail the current release by weeks (on 2026-09-29 it offered 2.1.268 while v2.1.284 was out, older than Opus 5.5's v2.1.280) and doesn't auto-update, so run `winget upgrade Anthropic.ClaudeCode` between comparisons, never during one, and before a `/paired-check` make sure `claude --version` is at least the version that added the batch's model. If WinGet is stuck, download that version's `win32-x64/claude.exe` (`win32-arm64` on an ARM PC) and `manifest.json` from `downloads.claude.ai/claude-code-releases/<version>/`, confirm the SHA256 matches the manifest and `Get-AuthenticodeSignature` shows Anthropic, PBC, then run `.\claude.exe install` from a Start-menu PowerShell window. That copy lives in `%USERPROFILE%\.local\bin` (add it to my user PATH if needed) and updates itself in the background, so check that `/paired-check`'s report shows the same `claude` version for every arm. Keep one install: a second one earlier on PATH wins silently, so `where.exe claude` should list only one. |
| ripgrep | Already bundled | Claude Code's Grep tool uses it |
| jq | Not needed | No bash JSON hooks in this setup |
| ast-grep | Optional | Syntax-aware search and codemods for large refactors (`npm i -g @ast-grep/cli`); add one rules line if you install it |
| uv or Python | Only if a language server needs it, or for the Hindsight experiment | Nothing else here requires Python |
| Scoop | Not needed | Its standard install pipes a remote script into PowerShell and needs ExecutionPolicy set to RemoteSigned, which the ground rules forbid. Scoop writes an `.exe` shim only when the target is an `.exe`, so it helps only for servers it packages itself, such as jdtls. The npm servers aren't in its Main or Extras buckets, and `npm -g` under Scoop's Node still writes `.cmd` shims, so it isn't a way around the npm language-server issue. Part 1 step 3 covers that. |
| WSL | Not targeted | Plugins don't load in Desktop WSL sessions; this setup covers Local sessions |
| Codex, Cursor, other clients | Out of scope | Configure separately if you use them |

### Conflicts checked

- Ponytail's defaults (one small check, at most three lines of explanation) conflict with keeping tests and full reports. The standing rule in the working rules is an explicit request, which Ponytail's own rules say to honor.
- Ponytail and frontend-design pull in opposite directions on UI. frontend-design is installed only for new frontends. Repos with a design system don't get it, and get a rule to reuse existing components instead.
- An official LSP plugin and a local Windows LSP plugin for the same language would duplicate diagnostics, so exactly one is kept per language.
- The bundled `/code-review`, the code-review plugin, feature-dev and Superpowers overlap. Only the bundled command, used on demand, is part of this setup.
- RTK, Chisle, Caveman and Context Mode would stack filters over the same output, so none is installed by default. Caveman and the built-in Concise output style would both own reply style, so a trial runs one or the other, never both. Concise tells Claude to mention a caveat only when it changes my next step, and says its rules win over more general communication guidance. It keeps error reports, failing test output and security warnings in full, but caveats and risks can drop out. That pulls against the standing rule to report caveats and risks, so a Concise trial has to check that reports still carry them.
- The advisor adds usage at every consultation. It's opt-in, and the rules tell Claude to skip it for small edits.
- Context7 and web search overlap on docs. The rules route library docs to Context7 and keep private code out of its queries.
- Hindsight would be a third memory, beside native auto memory and CLAUDE.md, with its own injection. Only native auto memory is kept, and `/memory-lint` keeps it accurate.
- fast-jev-compaction and native compaction would both own context size. Native compaction keeps the role, with stronger compact instructions.
- A proxy in `ANTHROPIC_BASE_URL` would stand between every request and the prompt cache. None is installed, and step 1 reports one if present.
- The output-filtering rule overlaps the "quiet output" part of the narrow-checks rule. They're complementary: one says check narrowly, the other says what may never be filtered away.
- `/memory-lint` and Claude Code's own size reminders touch the same file. The reminders handle size, the lint handles accuracy, and the lint changes nothing without approval.
- Desktop also loads the skills and plugins enabled on my claude.ai account into local Code sessions, from its own folder outside `~/.claude`. Its `consolidate-memory` skill would be a second owner of memory accuracy beside `/memory-lint`. Claude can invoke it on its own, and it merges, rewrites and retires auto-memory files with no backup or approval step. To keep it out of Code sessions, I can add a `Skill(anthropic-skills:consolidate-memory)` deny rule to my user settings. Switching the skill off in Customize would remove it from Cowork too. Claude Code also has an undocumented background consolidation, auto-dream, whose default is set on Anthropic's side. It would be a third owner if it's switched on for my account, and `"autoDreamEnabled": false` in my user settings keeps it off. The account's `skill-creator` is the same skill as the official plugin's, so the plugin isn't worth adding on top. Account plugins such as engineering bring their own code-review and testing skills beside the bundled `/code-review` and Ponytail. Every listed skill shares one description budget, 1% of the context window, and the least-used skills lose their descriptions first. This setup changes none of these without asking me.
- `/paired-check` spends plan usage, but only when I paste its runner line into a separate terminal, after confirming the maximum spend.

### What replaced each idea

| Original idea | Now |
| --- | --- |
| Graft structural queries | Official LSP plugins, plus Grep; Graft's CLI mode as an optional experiment |
| RTK output filtering | Quiet quick checks in the command map, narrow-first checks, conditional subagents, and (v7) the output-filtering rule that never drops errors or warnings |
| Context Mode for bulky logs | Subagents for large log analysis when a summary is enough |
| Adapted "efficiency-review" skill | The Ponytail plugin with a standing rule (a plain skill never activated in testing), plus `/ponytail-review` on demand |
| "project-efficiency" skill | The model-invocable `project-setup` skill, plus the startup note |
| "efficiency-health" skill | `/setup-check` |
| Global instruction block in CLAUDE.md | `~/.claude/rules/token-efficiency.md` |
| `DO_NOT_TRACK` for installs | Not needed; setting it globally would switch off the advisor |
| Paired A/B evaluation recipe | `/paired-check` (v7; a manual recipe in v6) |
| Backups, rollback, redacted report | Part 1 ground rules and step 7, with an ownership manifest |
| A Jev decision layer for Claude Code | Claude Code's own in-generation decisions, and Auto mode for action safety |
| Jev compaction | Native compaction plus verbatim compact instructions |
| Jev or Hindsight memory | Native auto memory, `/memory-lint`, and the git-history rule |
| Tool-output judges (winnow, jev-pruner) | The output-filtering rule |
| JevRouter and model routers | Native model choice; `opusplan` or Sonnet for routine work if limits get tight |
| Karpathy's autoresearch loop | `/paired-check`, run by hand with a budget |
| Karpathy's LLM Wiki | `/memory-lint` for the memory it already keeps |
| About-me and company-context skills (v7.1 review) | A few CLAUDE.md lines for what every session needs; a skill for occasional context |
| Banned-word lists | Positive style instructions |
| "Ask me questions" at the end of every prompt | An AskUserQuestion interview for larger features |
| A fresh session every 20 messages | `/clear` on a topic change or after two failed corrections |
| A Graphify map of the code | LSP plugins and Grep |
| An MCP server for every service | The service's CLI, project-scoped servers only where needed, and test credentials |

### Windows-specific notes

- Desktop inherits user and system environment variables but doesn't read PowerShell profiles, so profile aliases and functions never apply. After installing tools, fully restart Desktop so it sees the new PATH.
- npm-installed language servers (for example `typescript-language-server` and `intelephense`) exist only as `.cmd` or `.ps1` shims, which Claude Code failed to spawn in reported cases up to v2.1.212. Builds from about v2.1.200 to v2.1.212 also refused `.exe` servers such as rust-analyzer, clangd and csharp-ls, with a "not found or is in an unsafe location" error. An independent retest found both working in v2.1.231 and traced the fix to v2.1.213, which has no changelog entry. One open issue still reports that error on v2.1.260 when the server's path has non-ASCII letters, such as a Cyrillic user folder name. ruby-lsp (a RubyGems `.bat` stub) and jdtls (`jdtls.bat`) also start from batch files, so Part 1's fallback covers them too. Test the official plugin first; Part 1 step 3 covers the fallback.
- security-guidance still breaks on many Windows setups (checked 2026-09-29: issues #2697, #6186, #6249 and #6289 are open, on plugin v2.0.8). Plain `bash` can resolve to the WSL stub, so its hooks never run. With the Store or MSIX build of Python or Desktop, or a Python Install Manager alias, every hook can fail to find its files, and its Stop hook's rewake can loop endlessly. In Desktop, its hooks have also kept firing after the plugin was disabled or uninstalled (issues #94525 and #92146). Turning it off in the Desktop app's own plugin settings stopped them in new sessions. Even where it runs cleanly, Windows reports show a claude.ai sign-in gets only its per-edit pattern checks. The end-of-turn and commit reviews don't receive my sign-in, so they skip and say so only in `~/.claude/security/log.txt` (issue #96860). If `ANTHROPIC_API_KEY` is set, those reviews run on that key and its API billing instead. If you already have it and it runs cleanly, keep it for those pattern checks; otherwise wait for those issues to close.
- The PowerShell tool is still labeled a preview, but on Windows it's on by default for claude.ai and Console accounts, even with Git for Windows installed, and Claude then treats PowerShell as the primary shell; the Bash tool stays for POSIX scripts. That default needs feature-flag fetching, so any variable that turns fetching off (the ones step 1 checks for) puts commands back on Git Bash unless `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` is set; `CLAUDE_CODE_USE_POWERSHELL_TOOL=0` turns it off. It doesn't load profiles. Neither shell tool is sandboxed on native Windows: the built-in sandbox runs only on macOS, Linux and WSL2. Nothing at the OS level keeps shell commands inside the project folder (issue #79300), and checkpoints don't undo shell changes, so Claude Code's permission checks are the only gate: prompts, my rules and, in Auto mode, its classifier. Commit before risky work. Any hook that inspects shell commands must match both Bash and PowerShell.
- Plugins don't load in Desktop WSL sessions, and language servers don't start in cloud sessions. This setup targets Local sessions.
- If a local MCP server or hook fails under the MSIX Desktop build, diagnose that server. Don't move private work to a hosted service just to avoid a local bug.
- RTK has had a native Windows hook since v0.37.2. v0.50.0, from 2026-09-24, is current. Its winget package (`rtk-ai.rtk`) is a portable zip, which winget installs per user without admin. Its Claude Code hook still matches only the Bash tool. The pull request that would have added the PowerShell tool (#2075) was closed unmerged in August 2026. A maintainer said RTK's rewrite pipeline assumes bash and would corrupt PowerShell commands, so real support needs a larger rework. The feature request (#1319) is still open, and none of the open community pull requests that touch PowerShell has maintainer approval. When Claude Code's PowerShell tool is on, Claude uses PowerShell as its main shell, so RTK would see even fewer of my commands here. The Skip verdict above stands, more firmly on Windows.
- Most of the Jev command-line tools reviewed here target macOS and Linux first, and jevgrep supports only those. None is needed here.
- `/paired-check`'s runner is a Node script, so PowerShell's execution policy doesn't apply. Start it from a PowerShell window opened from the Start menu; in a terminal started by Claude Code it stops, because runs started there would inherit that session's variables and differ from a normal session. It keeps its clones under a short `%TEMP%\pc\` path (Windows' 260-character path limit bites deep dependency folders), runs the project's commands through Git Bash as Claude Code's Bash tool does, and passes the prompt on stdin so an npm-installed `claude.cmd` gets no quoting surprises. Antivirus or an open editor can lock a file in a clone; the runner then prints the path instead of retrying.

### Measuring

- Monitoring: glance at the usage ring next to the model picker once a week. Where your build supports them, `/usage` attributes recent usage to plugins, MCP servers and subagents and flags long context and cache misses, and `/context` shows what's loaded. Monitoring shows trends, not causes.
- Judge savings by your plan usage, not by any tool's own counter.
- Paired check: `/paired-check` (Part 1 step 6). It builds three to five tasks from your own commits and checks that each fails at its starting commit and passes at its reference commit. After each configuration change, you replay them from a separate terminal. Every run starts from a fresh clone with no later history, the reference tests stay hidden until grading and replace any edits the run made to them, and auto memory is off. So runs can't peek at the answer, weaken the check, or learn from each other. It compares pass rate, tokens and cost per accepted task (counting failed runs), and lists every configuration difference between arms. It detects large effects only; a handful of runs can't prove small ones.
- For normal sessions, logs under `%USERPROFILE%\.claude\projects\` record token usage per message if you want to look closer.

### Expected impact (rough guesses, not measurements)

The combined stack hasn't been tested, so treat these as expectations to check, not promises. `/paired-check` exists to replace this section with numbers.

- Short, focused tasks: little change.
- Typical feature work: modestly less usage, mostly from Ponytail (which measured about 10% on its own) and fewer exploratory reads.
- Long sessions, if you accept the 300k cap: fewer re-read tokens per turn. The net effect depends on how much summarization and re-reading follows. The verbatim compact instructions should mean less re-explaining of constraints after a compaction.
- Repos where old decisions are baked into code: fewer wrong "fixes" of deliberate behavior, from the git-history rule, at the cost of an occasional extra `git log` read.
- Repos whose MEMORY.md has grown stale: up to a few thousand fewer tokens at every session start after `/memory-lint`, and fewer outdated instructions.
- Quality: the component tests found no detectable loss, which isn't proof of equivalence. The standing rule, LSP diagnostics and final acceptance checks are there to protect it.

### What could be wrong

The assumptions most likely to flip a verdict here, and the cheapest test for each:

1. The separate-call test assumes Claude Code keeps making its decisions inside the main generation. If Anthropic or TypeSafe ship a native decision layer for coding agents (TypeSafe has said coding-focused releases are coming), re-run the Jev review.
2. The fast-jev-compaction verdict first rested on Hermes Agent's compaction and transcripts, not Claude Code's. Claude Code evidence now points the same way. Open issues show the saving lost on `--resume`, and requests blocked by the firewall in front of TypeSafe's API. One user's replay of 40 long Bash and Read outputs, drawn from about 1,000 tool calls in their own Claude Code sessions, found that no selector, even one shown the agent's next message, kept meaningfully more of the later-used lines than head and tail. Jev itself wasn't in that replay, and Claude Code's summarizer could still lose more than Hermes's. Test: a separate `/paired-check` task set of long tasks that actually reach compaction, with and without it, checking that each compaction went through Jev rather than falling back to the built-in summary. That's expensive, and only worth it if you accept sending conversation text to TypeSafe.
3. `/paired-check` runs headless in fresh clones, without the Desktop preview, auto-verify or auto memory, and a few runs only catch large effects. Treat it as a tripwire against regressions, not as proof of small gains. Its self-test proves the clones, grading and report on your machine, but the first real batch is also the first test of how it launches `claude` there.
4. The git-history rule could trigger lookups on code that's merely unclear rather than deliberate. If `/usage` or session logs show frequent history reads with no effect on the change, drop the line.
5. Hindsight's value is now vendor-measured but not independently tested. On the vendor's 61 bug-fix tasks, each built to hinge on a past decision seeded into memory, Claude Code on Sonnet 5 needed 57% fewer corrections and cost 24% less, over three runs per arm. Every task was solved either way. The cost counts only Claude Code's own spend, not the memory server's LLM calls. About 90% of the drop came from decisions found only in past conversations; on decisions in commit messages, Claude mostly mined the history on its own. The measured setup had past conversations in memory and an LLM synthesis on the first prompt. The hardened experiment has neither and learns from commit messages only, the arm least likely to help. The verdict is "untested independently", not "worse".
6. Part 1's project section is written by an LLM. In a controlled study, LLM-generated context files slightly lowered agents' success and raised cost by over 20%, largely through broader exploration and instructions followed literally. This section keeps to what that study found worth having (commands and non-obvious requirements, no overviews), but its effect here is unmeasured. Test: `/paired-check` with and without it, removing the section between batches.
7. Caveman's two paired tests disagree on its effect by more than 2x, the larger result comes from a sponsor-run benchmark on Sonnet 4.6, and neither used Opus 5.5. Both also predate the built-in Concise output style (v2.1.237), which trims narration without an add-on. Test: a `/paired-check` arm with `"outputStyle": "Concise"` in `~/.claude/settings.json` first, and a Caveman arm only if Concise saves too little. Keep either only if the pass rate holds and reports still carry caveats and risks.
8. The 300k compaction cap may cost more than it saves. Claude Code's own `/autocompact` text recommends the auto setting and warns about higher usage when resuming long sessions. Only a `/paired-check` on long tasks settles it.
9. The docs say `--bare` will become the default for `claude -p`. Bare runs skip CLAUDE.md, plugins and auto memory and don't use a subscription login, so `/paired-check` would then measure the wrong configuration or fail to sign in.
10. Context7's value here is untested. Upstash's own runs found it cheaper than Claude Code's web tools, with answer quality not measured, and better than no lookup on questions picked to post-date the model's training. Vercel's Next.js evals test bundled docs rather than Context7, and count a pass if any of four attempts passes. They show Opus 5.5 in Claude Code at 97% with or without docs, while Sonnet 5 rose from 81% to 97%. So on a popular framework Opus 5.5 may gain little. Test: a `/paired-check` arm with the plugin disabled, on a new task set whose allowed tools include Context7's two tools, WebSearch and WebFetch for both arms. Without those rules, headless runs deny Context7 and WebSearch, and WebFetch reaches only a built-in list of documentation sites.
11. The LSP plugins rest on the docs and small outside tests, not on a paired test of solve rate and billed cost. One Claude Code test of three reference-finding tasks, one run each, found them slightly cheaper and more complete than grep. A preliminary study with its own agent loop on small repos found the language server usually cost more tokens, saving them only with the weakest model, and grep did better on multi-file renames. Diagnostics can also mislead. A maintainer confirmed that Claude Code doesn't tell the language server about Bash edits, and that issue was closed without a fix. An open report shows pyright flagging a module created mid-session as an unresolved import until restart. So Claude can miss real errors or chase ones that aren't there. Test: `/paired-check` with the LSP plugins disabled in one arm; the report lists enabled plugins among the configuration differences. One unconfirmed report says headless runs keep the language server in sync after edits better than interactive sessions, so a good headless result may overstate what I get in Desktop. Treat it as a tripwire.

### When to revisit

- Run `/setup-check` monthly and after Desktop updates. Run `/doctor prompt-audit` after big instruction changes. Also run `/skill-doctor` monthly. It shows which skills cost context every turn but never get used, and which plugins I haven't used lately. It needs feature-flag fetching, so it's unavailable when any of the privacy variables from the setup check is set. If Desktop says the report isn't available on this connection and the CLI is installed, run `claude -p "/skill-doctor"` from a separate terminal instead. An open bug report says its usage and token counts can be inflated (issue #92326), so treat it as a pointer and check a skill before turning it off.
- security-guidance: add it once its Windows issues are fixed.
- Windows language servers: if the official plugin starts `.cmd` servers itself, remove any local LSP plugin.
- Before adding any token-saving tool, look for an independent paired test like the JetBrains series, then confirm it with `/paired-check`.
- jevgrep: reconsider only with Windows support, a local-only mode, and an independent Claude Code test.
- Jev in general: when there's an independent Claude Code paired test showing an equal solve rate and fewer tokens per accepted task, a zero-retention option, and Windows support without early-access flags.
- fast-jev-compaction: if a matched-budget test beats both recency ordering and the native summary on recall without raising tokens per turn.
- Hindsight: an independent coding-agent A/B, or two weeks of the one-repo experiment.
- Function hooks: when they leave early access.
- Graphify: this trigger fired in September 2026. An independent benchmark (ohta-rh/graphify-bench: graphify 0.9.53, headless Claude Code, one run per task) found that for Sonnet 5 on 45 code tasks it made no measurable difference to billed cost, with 78% accuracy against 84% without it. Against a baseline with subagents turned off, it cost more. With Haiku 4.5 it cut tokens but not billed cost. Its one clear win was Sonnet 5 on 20 questions that span docs and code, with lower cost and 80% accuracy against 70%. Skip for code stands. Reconsider only for a repo where most of my questions span its docs and its code, or if a repeated run on another codebase disagrees. Its repository has moved to Graphify-Labs/graphify (v0.9.71 on 2026-09-28), and the old links redirect. THOL's run, where Claude never called Graphify, measured only its idle overhead: unchanged within noise.
- Caveman: after your `/paired-check` trial.
- ablate (ablate-dev/ablate, a CLAUDE.md A/B tool): once it publishes live-agent results and hides later history from its worktrees, its section-by-section CLAUDE.md ablation could complement `/paired-check`.
- Ponytail: re-run `/setup-check` after major releases, and switch to `/ponytail lite` if it under-builds for your taste. Lite softens one stance line and one example; the rules stay the same (#664). v4.10.0 (2026-09-14) is the newest; the tested version was v4.8.4. v4.9.0 added the `PONYTAIL_SUBAGENT_MATCHER` setting that step 4 relies on, so I need v4.9.0 or later, and `/ponytail default <mode>`. It also fixed a Windows session freeze on stdin EOF (#443) and config.json being silently ignored when it starts with a BOM (#375). v4.10.0 mostly adds support for other agents and drops the `commandWindows` hook field, which Claude Code ignores; with Git installed, its hooks run `node` through Git Bash. `/ponytail-gain` isn't new. It still shows the old single-shot 80 to 94% figures that its README calls partly a baseline artifact, so treat it as the vendor's own scoreboard (grade C). Open Windows issues: the prompt hook can run past its 5-second limit, and Claude Code then drops its output, so a `/ponytail <level>` change may not be saved and subagents keep the old level (#763, #790); a console window can flash on each hook call (#791); and with no `node` on PATH every prompt shows a hook error (#645). If prompts stall or a window flashes, these bugs are the likely cause; check them before each update. Update through the plugin menu, then re-run `/setup-check`.
- `claude -p` defaults: if a release makes `--bare` the default for `-p`, stop using `/paired-check` until the runner passes whatever flag restores full loading and its self-test proves it.
- Desktop and Auto mode: confirm whether Desktop local sessions also start in Auto with no mode set, and update step 7 Q2.
- Cache lifetime: if the docs state how subscriptions meter one-hour cache writes for subagents, test `subagentPromptCacheTtl` with `/paired-check`.

### Sources

- JetBrains RTK test: https://blog.jetbrains.com/ai/2026/07/rtk-claude-code-token-savings/
- Quesma RTK cost benchmark (Terminal-Bench 2.1, 2026-09-11): https://quesma.com/blog/does-rtk-make-ai-coding-cheaper/
- Glia Intelligence RTK benchmark (July 2026): https://gliai.com/research/rtk-token-savings-benchmark
- RTK's own SkillsBench rerun (2026-08-07): https://www.rtk-ai.app/blog/rtk-on-skillsbench/
- How RTK's savings figures work: https://github.com/rtk-ai/rtk/blob/develop/docs/guide/resources/savings-explained.md
- RTK permission advisory: https://github.com/rtk-ai/rtk/security/advisories/GHSA-7gxq-fvfc-g327
- RTK PowerShell hook pull request, closed unmerged: https://github.com/rtk-ai/rtk/pull/2075
- Claude Code issue 90122 (on Windows, plugin hooks always run through Git Bash, and prompt-submit hooks from two or more plugins can crash it; open on 2026-09-29): https://github.com/anthropics/claude-code/issues/90122
- JetBrains Caveman test: https://blog.jetbrains.com/ai/2026/07/speak-to-ai-agents-like-cavemen-tosave-tokens/
- JetBrains Ponytail test: https://blog.jetbrains.com/ai/2026/07/ponytail-skill-claude-tested/
- Ponytail rules (tests and output sections): https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md
- RTK adversarial test suite: https://github.com/TheDecipherist/rtk-test
- Superpowers A/B test on Codex: https://norbert-laszlo.medium.com/can-a-plugin-improve-codex-benchmarking-the-superpowers-plugin-05d020066565
- Superpowers test setup (v5.0.5 snapshot, GPT-5.4, 500 tasks): https://github.com/Nobbettt/AgentStackBench
- Superpowers releases: https://github.com/obra/superpowers/releases
- benjamin-plus and its results: https://github.com/JetBrains/benjamin-plus-skill
- JetBrains Context data handling: https://www.jetbrains.com/help/jetbrains-console/getting-started-with-jetbrains-context.html
- jevgrep: https://github.com/dzhng/jevgrep
- Workflow-plugin overlap: https://www.buildthisnow.com/pt/blog/guide/mechanics/best-claude-code-plugins-2026
- Claude Code docs:
  - https://code.claude.com/docs/en/costs
  - https://code.claude.com/docs/en/model-config
  - https://code.claude.com/docs/en/context-window
  - https://code.claude.com/docs/en/memory
  - https://code.claude.com/docs/en/best-practices
  - https://code.claude.com/docs/en/desktop
  - https://code.claude.com/docs/en/skills
  - https://code.claude.com/docs/en/plugins/code-intelligence
  - https://code.claude.com/docs/en/advisor
  - https://code.claude.com/docs/en/security-guidance
  - https://code.claude.com/docs/en/changelog
  - https://code.claude.com/docs/en/plugins/manifest-reference (LSP server fields, including `diagnostics`)
- LSP evidence and issues (accessed 2026-09-29): CircleCI's LSP-versus-grep test, https://circleci.com/blog/claude-code-lsp/ ; Xu, "Does a Language Server Save Tokens for Coding Agents?", https://arxiv.org/abs/2608.13568 ; anthropics/claude-code issues #73961 (Windows spawn bisection), #78604, #15148 and #93474 (empty installs), #93321 (late diagnostics), #80267, #85225 and #76870 (stale state), #95507 (hint noise)
- Ponytail: https://github.com/DietrichGebert/ponytail
- RTK: https://github.com/rtk-ai/rtk
- Context Mode: https://github.com/mksglu/context-mode
- Graft: https://github.com/trailhq/Graft
- Context7 plugin: https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/context7
- Context7 data privacy: https://context7.com/docs/security/data-privacy
- Context7 against Claude Code's web tools (Upstash's own test, 2026-05-27): https://upstash.com/blog/context7-vs-web-search-benchmark
- Context7 against no lookup (guest post on Upstash's blog, 2026-07-20): https://upstash.com/blog/context7-vs-static-llm-knowledge-benchmarking-coding-assistants
- Context7 plugin failing with HTTP 401 when no API key is set (closed as fixed 2026-09-23): https://github.com/upstash/context7/issues/3167
- ContextCrush prompt injection in Context7 (CVE-2026-75130; Upstash deployed a fix 2026-02-23): https://noma.security/blog/contextcrush-context7-the-mcp-server-vulnerability
- Next.js agent evals, with and without bundled docs: https://nextjs.org/evals
- frontend-design plugin: https://github.com/anthropics/claude-plugins-official/tree/main/plugins/frontend-design
- Windows language-server spawn issue: https://github.com/anthropics/claude-code/issues/51191
- pyright-lsp silent spawn failure with npm shims: https://github.com/anthropics/claude-plugins-official/issues/4842
- typescript-lsp and TypeScript 7 (no tsserver): https://github.com/anthropics/claude-plugins-official/issues/4492
- security-guidance Windows issues:
  - https://github.com/anthropics/claude-plugins-official/issues/2697
  - https://github.com/anthropics/claude-plugins-official/issues/6186
  - https://github.com/anthropics/claude-plugins-official/issues/6289
- security-guidance cost issues:
  - https://github.com/anthropics/claude-plugins-official/issues/5331
  - https://github.com/anthropics/claude-plugins-official/issues/4894
  - https://github.com/anthropics/claude-plugins-official/issues/5558
- Edit tool "modified since read": https://github.com/anthropics/claude-code/issues/48390
- Added in v7:
  - TypeSafe, Jev with coding agents: https://docs.typesafe.ai/introduction/coding-agents
  - Hermes Agent's Jev compaction evaluation (PR #116246): https://github.com/NousResearch/hermes-agent/pull/116246
  - fast-jev-compaction: https://github.com/tamaratran/fast-jev-compaction
  - fast-jev-compaction, repeated-compaction issue: https://github.com/tamaratran/fast-jev-compaction/issues/70
  - fast-jev-compaction on Claude Code, resume, firewall and replay issues: https://github.com/tamaratran/fast-jev-compaction/issues/89, https://github.com/tamaratran/fast-jev-compaction/issues/97 and https://github.com/tamaratran/fast-jev-compaction/issues/99
  - Hindsight's coding-agent test (vendor-run): https://hindsight.vectorize.io/blog/2026/08/06/hindsight-0-9-0
  - graphify-bench, independent Claude Code test: https://github.com/ohta-rh/graphify-bench
  - TypeSafe's Jev Router on OpenRouter: https://openrouter.ai/typesafe/jev-router
  - Open-Jev: https://github.com/Zefan-Cai/Open-Jev
  - Context files with Claude Code and Codex: https://arxiv.org/abs/2607.27250
  - TypeSafe legal and zero data retention: https://docs.typesafe.ai/legal
  - Yoshi: https://github.com/compozy/yoshi
  - JevRouter: https://github.com/BillionsBobby/JevRouter
  - Awesome Jev (ecosystem index, including jev-guard, jev-rules, winnow, jev-pruner): https://github.com/valentynkit/awesome-jev-typesafe
  - cobusgreyling/Jev: https://github.com/cobusgreyling/Jev
  - OpenJev-Fast: https://yiqilyu.me/open-jev-fast/
  - GPT Researcher context filter: https://docs.gptr.dev/docs/gpt-researcher/gptr/context-filter
  - Hindsight: https://github.com/vectorize-io/hindsight
  - Hindsight Coding Agents: https://hindsight.vectorize.io/sdks/integrations/coding-agents
  - Hindsight Claude Code plugin (legacy): https://hindsight.vectorize.io/sdks/integrations/claude-code
  - Karpathy's LLM Wiki: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
  - Nested-session check: https://github.com/anthropics/claude-code/issues/25803 and https://github.com/anthropics/claude-code/issues/29543
  - Claude Code headless mode and CLI flags: https://code.claude.com/docs/en/headless and https://code.claude.com/docs/en/cli-reference
  - Effort precedence, tested on v2.1.220: https://wmedia.es/en/tips/claude-code-effort-not-the-level-you-think
  - Benchmark hygiene, future commits stripped before the agent starts: https://github.com/TokenRhythm/claw-swe-bench
  - Benchmark hygiene, agents' test edits reverted before grading: https://github.com/PrimeIntellect-ai/verifiers/pull/1212
  - The loop-engineering article, the Jev articles, the Claude Projects guide and the two screenshots supplied by the author, none of them public (claims checked against the primary sources above)
  - Projects in Claude Code, rechecked in v7.3 (accessed 2026-09-29): https://code.claude.com/docs/en/claude-projects and https://code.claude.com/docs/en/cloud-environments
- Added in v7.1:
  - Anthropic prompting best practices ("tell Claude what to do instead of what not to do"): https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
  - Claude Code best practices (the interview pattern and the two-corrections rule) and skills docs (the 500-line limit, skill-creator, `claude plugin eval`): the best-practices and skills pages listed above
  - Graphify: https://github.com/safishamsi/graphify and https://github.com/safishamsi/graphify/blob/v7/docs/how-it-works.md
  - Graphify on a pure Python codebase: https://exchangepedia.com/articles/graphify-honest-benchmark-real-codebase.html
  - Dasein Code-Compression Bench: https://github.com/daseinlabs/code-compression-bench
  - Context files study (Gloaguen et al., ETH Zürich): https://arxiv.org/abs/2602.11988
  - ablate: https://pypi.org/project/ablate-cli/
  - Supabase MCP security guidance: https://supabase.com/docs/guides/getting-started/mcp
  - Curator's role at Tiger Data: https://www.tigerdata.com/webinars/what-the-heck-is-time-series-data
  - The three setup infographics and the AI-Native Builder Stack, supplied by the author (not public)
- Added in v7.2 (all accessed 2026-09-29): Claude Code changelog and releases, v2.1.277 to v2.1.284 (v2.1.284 published 2026-09-28); code.claude.com docs pages headless, costs, prompt-caching, model-config, memory, advisor, settings-reference, setup and statusline; Claude Help Center, "Claude Fable models on your plan"; anthropics/claude-plugins-official issues #2697, #6186, #6249, #6289; anthropics/claude-code issues #51191, #94525, #31980, #42149; DietrichGebert/ponytail release v4.9.0 (2026-08-07); Quesma, "RTK reports huge token savings, but our cost benchmarks disagree"; Glia Intelligence, RTK token savings benchmark; JetBrains AI blog, rtk Claude Code token savings (2026-07-20).
- Added in v7.3 (all accessed 2026-09-29): code.claude.com docs pages permission-modes, env-vars, tools-reference, workflows, sandboxing, sandbox-environments, checkpointing, auto-mode-classifier-billing and output-styles, and the built-in style prompts in the Claude Code bundle; Claude blog, "Auto mode is now the default in Claude Code for Pro, Max, and Team plans" (2026-08-07); anthropics/claude-code issues #79300, #96324 and #97870; anthropics/sandbox-runtime README (v0.0.77); THOL, the Token-Harness Optimizer Leaderboard, run by the author of tokenade, one of the tools it ranks: https://pi-infected.github.io/token-harness-optimizer-leaderboard/ ; JuliusBrussee/caveman v2.7.0 (2026-09-15), its hooks README and docs/HONEST-NUMBERS.md.

---

## Part 3: Daily habits (for me)

- Start a fresh session, or run `/clear`, when switching to unrelated work. Keep a session going while its history is still useful.
- Ask side questions in a side chat (`/btw` or Ctrl+;) so they stay out of the main thread.
- Put related small fixes in one message, since each message re-reads the whole conversation. Keep unrelated work in separate sessions.
- Start complex or ambiguous work in Plan mode. For outcome-driven work, set a `/goal` with a clear finish line and the command that proves it, such as "the full test suite passes".
- For a larger or fuzzy feature, have Claude interview you first ("Interview me in detail using the AskUserQuestion tool, then write the spec to SPEC.md"), then implement it in a fresh session. For small, clear changes, just ask.
- Give verification targets: tests to pass, expected output, or a screenshot of the design you want. For app changes, run `/verify` before calling the work done.
- If Claude heads the wrong way, press Esc and use `/rewind` rather than arguing with it in context. If you've corrected it twice on the same issue, `/clear` and start again with a sharper prompt that includes what you learned.
- If Claude is about to "fix" something that looks deliberate, ask it to check the git history of those lines first.
- Put `ultrathink` in the one prompt that needs deep reasoning instead of raising effort for the whole session.
- Before starting a long new task in the same session, run `/compact` with a focus.
- After a long break, the first message re-reads the whole session at full price once. If the older history is no longer needed, compact before stepping away, while the cache is still warm, rather than after. On Pro and Max, resuming a session over 100k tokens after about an hour idle brings up an offer to resume from a summary (documented for CLI resumes); accept it on the same condition.
- Before committing, click Review code in the diff view. Before merging, run `/code-review`, and for a security pass on the branch, `/security-review`.
- Optionally, run `/run-skill-generator` once per project so `/run` and `/verify` stop rediscovering how to launch it. It commits a project skill.
- Run parallel tasks in separate sessions using the worktree option.
- If plan limits get tight, switch routine tasks to Sonnet.
- Before adding any tool, plugin or rule: `/paired-check` for a baseline, make that one change, then `/paired-check` again, pasting its runner line into a separate terminal each time. Keep the change only if the pass rate holds and tokens per accepted task fall.
- Only loop what passes the loop test: it repeats at least weekly, an automated check can fail it, the budget can absorb retries, and there's a stop condition.
- Weekly, glance at the usage ring, and in `/usage` check the Prompt cache (main) line and any behavior flags such as long context or cache misses. Monthly, run `/setup-check` and `/memory-lint`.

---

## Part 4: If I also use Claude Projects (reference only; don't act on it)

Projects in Claude Code (at claude.ai/code or in the desktop app's Code tab) runs a coordinator conversation that hands work to threads. It's a public beta on Pro and Max, rolling out gradually, starting with accounts that have no projects in claude.ai chat or Cowork; those older projects keep working as before. Threads run in the cloud unless I ask for one on my computer, which the project reaches through Remote Control. A thread on my computer is a Claude Code session in a folder I connect, so it uses my local setup, Part 1 included, plus the project instructions but not project memory. It runs in Auto mode unless Auto is unavailable or turned off on this computer, and only while the computer is awake with Remote Control on. Cloud threads get nothing from my machine, and the last column below is about them. Anthropic's Projects and cloud-environments docs now cover most of this; rows that cite the guide come from the third-party guide I supplied:

| This setup | Local Desktop sessions | Claude Projects threads |
| --- | --- | --- |
| Working rules (`~/.claude/rules/token-efficiency.md`) | Loaded every session | Your local `~/.claude` isn't there. Paste the rules into Project settings > Memory > Project instructions (up to 16,000 characters), which the coordinator and every new thread receive; edits reach only threads started afterward. Leave out the two marker comments, the LSP sentence (no language servers start there), the /clear line (a project manages context on its own) and, unless threads can reach Context7 through Project settings > Plugins or a claude.ai connector, the Context7 line. Don't repeat what the repo's CLAUDE.md already says |
| This project's CLAUDE.md section | Loaded every session | Threads clone the repo fresh from its default branch and read its CLAUDE.md, so they see the section only after you commit it. This setup never commits |
| Ponytail and other plugins | Installed through `/plugin` | Only plugins added in the project's Plugins settings load in threads; plugins enabled in a repo's `.claude/settings.json` don't |
| LSP plugins | After every edit | Language servers don't start in cloud sessions. Threads rely on Grep and tests, so have the environment's setup script install what the tests need |
| Auto memory and `/memory-lint` | Local folder | Threads read the project's MEMORY.md at startup. Review it from time to time; the guide suggests starting a thread to do the cleanup, so give that thread the `/memory-lint` steps |
| Permissions | Step 7 Q2 sets Auto or asking | Threads run in Auto when their model supports it, in the cloud and on my computer, whatever Q2 set, and a thread's approval prompt waits inside that thread. On my computer a thread leaves Auto only when Auto is unavailable or turned off in my Claude Code, such as with `disableAutoMode` set to `"disable"` in my settings, and that also removes Auto from my local sessions. Cloud threads apply a repo's permission rules and hooks only in a one-repo project |
| Model and effort | Opus 5.5 at medium (recommended) | A new project runs Opus with high effort for threads, which Anthropic says draws on my plan fastest, and low effort for the coordinator. Set Thread effort to medium in Project settings > General, matching Opus 5.5's own default. The guide's author also runs the coordinator at medium, which costs more than its default low; raise it only if routing goes wrong |
| Secrets | Your machine | Store keys as the environment's API credentials, not as environment variables, so they never reach the session |
| Network | Your machine | Keep the default Trusted access. For other domains, pick Custom, list them, and tick Also include default list of common package managers, which keeps the whole Trusted list. Left unticked, Custom allows only what I list, so package installs and the setup script can fail. Don't open Full. GitHub (through its own proxy), connectors and the hosts of my API credentials skip this list, so they need no entry |
| Setup cost | Not applicable | Install dependencies in the environment's setup script, not by asking Claude: the script runs before Claude starts, so it costs no tokens, and installs Claude makes mid-thread don't carry over to other threads. A script that finishes in under about five minutes is snapshotted and reused for about a week, until the script or the allowed domains change; a longer one isn't cached and can make new threads hang or time out. A script that exits non-zero stops threads from starting, so let optional installs fail quietly |
| Connectors | Your MCP servers | Make sure every connector a thread needs is fully connected first; failed calls to a disconnected one waste tokens. The coordinator itself has no connectors |
| Measuring | Usage ring, `/usage`, `/paired-check` | Project settings > Usage shows tokens by thread and by model, and how much went to the coordinator. Watch three cost traps: a follow-up to a thread idle longer than the cache lifetime (an hour within plan usage) re-reads its whole conversation, so for new work ask Claude for a fresh thread; an idle thread watching a pull request wakes up when CI fails or a review comment arrives, until I ask it to stop watching; and a thread that hits my plan limit resumes by itself when the limit resets. Click Stop in that thread, or pause the project to hold every thread |
