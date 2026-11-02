<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.svg">
    <img alt="Efficiency Playbook: evidence-based, token-efficient setup for Claude Code and Codex" src="assets/banner-light.svg" width="100%">
  </picture>
</p>

# Efficiency Playbook

An evidence-based, token-efficient setup for **Claude Code** and **Codex**, packaged as one plugin that works in both. In Claude Code, version 8 replaces the long playbook with a tested engine. It installs a small setup at user, project or local scope, shows every change with its token cost, evidence and data egress, asks before it writes, and can undo each apply byte for byte. Each of the 51 tools, plugins and settings that were evaluated has a verdict and evidence in [docs/decisions.md](docs/decisions.md) (for example, why RTK is rejected).

Unofficial; not affiliated with Anthropic or OpenAI. Canonical repo: https://github.com/MrHashMe/efficiency-playbook (renamed from `claude-code-efficiency-setup`; old links redirect). Don't install forks or copies from elsewhere.

| | Claude Code | Codex |
| --- | --- | --- |
| How it works | The v8 engine (`engine/ep.mjs`), driven by four explicit-only skills | [PLAYBOOK-CODEX.md](PLAYBOOK-CODEX.md) (v1.0), unchanged from 7.4 until the engine's Codex adapter in 8.1 |
| Commands | `/efficiency-playbook:setup`, `:verify`, `:bench`, `:memory-lint` | `$efficiency-playbook:setup` in the CLI; `@` in the ChatGPT desktop app |
| Where it runs | Terminal, VS Code, Desktop Code tab | CLI and the ChatGPT desktop app. The IDE extension can't run plugins, but it uses the result |
| Requires | Windows, macOS, Linux or WSL; Claude Code v2.1.281 or later; Node.js 22 or later; Git for project and local scope | Windows 10 or 11, Codex CLI 0.158.0 or later, Git for Windows |

## Install

Step by step, including uninstalling and restoring Claude Code to its defaults: [docs/INSTALL.md](docs/INSTALL.md).

### Claude Code

Run these two commands once each, in this order. The first adds this repo as a plugin source (a "marketplace"), and the second installs the plugin from it:

    claude plugin marketplace add MrHashMe/efficiency-playbook
    claude plugin install efficiency-playbook@efficiency-playbook

In a Claude Code terminal session, this one line does both. Confirm adding the marketplace, then choose **Install for you (user scope)**:

    /plugin install efficiency-playbook --marketplace MrHashMe/efficiency-playbook

A user-scope install is shared by the terminal, VS Code and Desktop on the same computer.

- **VS Code.** Type `/plugins`, add `MrHashMe/efficiency-playbook` on the **Marketplaces** tab, then install `efficiency-playbook` from the **Plugins** tab with **Install for you**.
- **Desktop app.** `/plugin` lines don't run in the Code tab, and its plugin browser (**+ → Plugins → Add plugin**) lists only marketplaces you've already added. Run the two lines above once in a terminal, then fully quit and reopen Desktop. On Windows, the CLI installs with `winget install --id Anthropic.ClaudeCode -e --scope user`; open a new terminal window afterwards. We don't recommend **Customize → Plugins** for this plugin: it adds the plugin to your whole claude.ai account, including Cowork and Chat, where setup can't run.
- **Node.js.** The engine needs Node 22 or later. If it's missing, the setup skill stops and walks you through an install that needs no admin rights: on Windows, the official `.zip` from [nodejs.org](https://nodejs.org/en/download), checked against its `SHASUMS256.txt`, unpacked under `%LOCALAPPDATA%\Programs` and added to your user PATH (winget's Node package installs for all users, so it asks for admin); on macOS, Homebrew if you have it; otherwise the official tarball under `~/.local`.
- **Pinning.** Add `#v8.0.0` after the repo name. A pinned install stays on that release, and `claude plugin update` reports it as up to date. To move to a newer release, run `claude plugin marketplace remove efficiency-playbook` (this uninstalls the plugin, not your setup), add it again with the new tag, install, and run `/efficiency-playbook:setup`.

### Codex

In a terminal, run these once each, in this order, then start a new Codex session:

    codex plugin marketplace add MrHashMe/efficiency-playbook
    codex plugin add efficiency-playbook@efficiency-playbook

Instead of the second line, you can type `/plugins` in the Codex CLI and install the plugin from the efficiency-playbook tab. No `codex` command yet? Install the CLI with `npm install -g @openai/codex` (needs Node.js).

- **ChatGPT desktop app.** The app and the CLI share the Codex home (`%USERPROFILE%\.codex`), so after the two lines above, fully quit and reopen the app. The app's own **Add marketplace** screen has an open bug on Windows ([openai/codex#21959](https://github.com/openai/codex/issues/21959)), so use the CLI lines.
- **IDE extension.** It doesn't load plugins. Run the setup once from the CLI or the app; the extension then uses the same global rules, config and skills.
- **Pinning.** Each time Codex starts, it checks this repo and, if `main` has a new commit, reinstalls the plugin from it. To stay on one release, add it as `MrHashMe/efficiency-playbook@v8.0.0` instead (if you already added it, first run `codex plugin marketplace remove efficiency-playbook`). A pinned install doesn't update on its own or with `codex plugin marketplace upgrade`. To move to a newer release, run `codex plugin marketplace remove efficiency-playbook`, add it again with the new tag, then run `codex plugin add efficiency-playbook@efficiency-playbook`.

### Without the plugin

- **Claude Code.** Download the source archive of the [latest release](https://github.com/MrHashMe/efficiency-playbook/releases/latest), unpack it, and run the engine from that folder: `node engine/ep.mjs plan --scope user`. It prints the rows and the `apply` command to run after you've read them.
- **Codex.** Download `PLAYBOOK-CODEX.md` from the latest release, open a new session in your project, and say: `Read <full path to the file> up to "## Part 2" and execute Part 1.` Changes then go through the agent's normal permission prompts only.

## First run (Claude Code)

1. Open a session in a project folder and type `/efficiency-playbook:setup`, or `/efficiency-playbook:setup project` to skip the scope question.
2. Pick the scope (see below), read the plan, and pick the groups to apply. Each row shows its always-loaded token cost, its verdict and evidence, and anything it sends off your machine. Rows that would overwrite something you changed are conflicts, and they're never applied unless you pick them.
3. Paste any `claude plugin` lines it gives you, then open a new session (fully quit and reopen Desktop or VS Code).
4. Type `/efficiency-playbook:verify` now and after Claude Code updates. It reports drift, duplicate or oversized instructions, missing tools and unreadable managed settings, each with its fix, and changes no configuration.

Upgrading from v7: the first user-scope plan migrates what v7's `MANIFEST.json` records. It moves `token-efficiency.md` to quarantine and removes the v7 skills and session-start hook, with backups. It keeps the settings you chose (such as `autoCompactWindow`) as owned items. Files you edited after v7 installed them are shown as conflicts and left alone.

## Scopes

| Scope | Who it affects | Files it writes | Ownership record |
| --- | --- | --- | --- |
| user | You, in every repository | `rules/efficiency-playbook.md` and `settings.json` in your Claude config folder (`~/.claude`, or `CLAUDE_CONFIG_DIR`) | the state folder; `efficiency-playbook.lock.json` beside them lists the components |
| project | Everyone who clones the repository | `.claude/rules/efficiency-playbook.md` and `.claude/settings.json`, which you review and commit | `.efficiency-playbook.json` in the repository |
| local | You, in this repository | `.claude/rules/efficiency-playbook.local.md` and `.claude/settings.local.json`, plus a block in `.git/info/exclude` so git ignores them | the state folder only |

The engine keeps its journals, backups and quarantine in a state folder outside the repository: `%LOCALAPPDATA%\efficiency-playbook` on Windows, and `$XDG_STATE_HOME/efficiency-playbook` (default `~/.local/state/efficiency-playbook`) elsewhere. It never commits or pushes. After a project apply, it prints the `git status` lines and a suggested `git add` list.

## What it changes (Claude Code)

On by default:
- Working rules (about 225 tokens at user scope): read line ranges instead of whole files, delegate only when a summary is enough, check narrowly then fully, keep caveats in short replies. Also one sentence that says the existing code wins when these rules disagree with it.
- The official language-server plugin for each language whose server is already on your PATH. The engine installs no servers itself.
- At project and local scope: the repository's command map (quick check and full acceptance commands, confirmed by you) and compact instructions that say what to keep through compaction.

Off by default, offered in the plan with their costs: an auto-compaction cap (`autoCompactWindow: 300000`), the Concise output style, Context7 for current library docs, Ponytail v5.3.3 (about 1,100 tokens of hook-injected rules per session), a one-line YAGNI rule, and a session-start nudge that shows at most once a week when verify found problems.

Everything else that was evaluated, such as RTK, proxies and other context tools, isn't installed. [docs/decisions.md](docs/decisions.md) gives each one's verdict, evidence and the trigger that would make us look again.

## Commands

| Skill | What it does |
| --- | --- |
| `/efficiency-playbook:setup [user\|project\|local] [uninstall]` | Plan, approve, apply and verify at one scope, or remove it |
| `/efficiency-playbook:verify [scope]` | Check with fix hints; changes no configuration |
| `/efficiency-playbook:bench` | Measures whether a configuration change helps on your repository: tasks mined from your commits, hidden acceptance tests, validation and paired runs under a spend cap that you start from your own terminal (each lists what it will execute and waits for you to type back a code), and cost per accepted task with intervals |
| `/efficiency-playbook:memory-lint` | Reviews this repository's auto memory for stale, contradicted, duplicate or misplaced entries, and changes only what you approve |

The skills call the engine, which you can also run directly: `node <plugin folder>/engine/ep.mjs <inspect|plan|apply|verify|show|uninstall|rollback|bench|evidence|selftest> [--scope user|project|local] [--json]`. Exit codes are 0 for done, 1 for findings, 2 for a usage error, 3 when blocked, and 4 when the plan is stale. `rollback --scope <scope> --last` undoes the last apply.

## Privacy

The plugin has no hooks, MCP servers or network calls unless you opt in. Its skills run only when you type them. The engine runs `git` and the `claude` CLI on your machine, plus each enabled language server with `--version` when verify runs with `--deep` (the verify skill always does), and reads only the files its scope needs. It never opens credential files, and it removes secrets from what it prints. Context7 is the one optional component that sends data: each lookup sends a library name and a short question the agent writes, plus your IP address and client name, to Upstash. Upstash keeps the questions for its benchmarks, keeps API logs for 30 days, and has OpenAI, Google and Anthropic models rank the results. Bench runs are normal Claude Code sessions on your plan, in scratch clones of your repository. See [SECURITY.md](SECURITY.md) to report a problem.

## Update

- **Claude Code.** Run `claude plugin update efficiency-playbook@efficiency-playbook` (or, in a terminal session, `/plugin` → **Installed** → **Update now**). Auto-update is off for third-party marketplaces; in a terminal session you can turn it on under `/plugin` → **Marketplaces** → efficiency-playbook → **Enable auto-update**. Then run `/efficiency-playbook:setup` again; a plan with no rows means you're current.
- **Codex.** Codex updates the plugin by itself at startup unless you pinned a tag (see Pinning); `codex plugin marketplace upgrade efficiency-playbook` checks now. Then run the setup command again in a new session.

To hear about releases, use **Watch → Custom → Releases** on GitHub.

## Uninstall

**Claude Code**
1. Type `/efficiency-playbook:setup uninstall` (add `project` or `local` for those scopes) and approve the plan. It removes what it owns and puts every setting it changed back to the value it had before the install. Files you edited since then stay unless you pick them.
2. Run `claude plugin marketplace remove efficiency-playbook` (or, in a terminal session, `/plugin marketplace remove efficiency-playbook`). This also uninstalls the plugin. In Desktop, **+ → Plugins → Manage plugins** uninstalls the plugin but leaves the marketplace registered.
3. Fully quit and reopen Desktop.

**Codex**
1. Type `$efficiency-playbook:setup rollback` and approve what it removes. It removes the blocks, skills and `config.toml` keys its manifest records, and puts back each key's earlier value. The `AGENTS.md` sections that `$project-setup` later added to other repos stay.
2. In a terminal, run `codex plugin remove efficiency-playbook@efficiency-playbook`, then `codex plugin marketplace remove efficiency-playbook`.
3. Start a new thread (fully quit and reopen the app).

## Not in 8.0

- The engine's Codex adapter (8.1). Until then, Codex uses the v7.4 playbook above, on Windows only.
- `verify --ci` for team CI and `evidence fresh`, the maintainer's evidence refresh (8.2).
- Cloud sessions, Codex cloud tasks, Claude Cowork and Chat.
- Not built yet: detection of client mods, a version check for the Claude Code that the Desktop app bundles, signed release attestations, and three verify checks from the design: a list of hooks, MCP servers and other executable settings the engine doesn't own, a check that the plugin's own files are unchanged, and a warning for a marketplace added without a tag or commit pin.

[PLAYBOOK.md](PLAYBOOK.md) is the v7.3 Claude Code playbook. It is kept as a manual, Windows-only guide and is no longer updated; the engine and the registry replace it. The full v8 design is in [docs/v8](docs/v8/README.md).

## License

MIT, for the author's own text and code. Third-party material quoted or summarized in the docs and the registry belongs to its owners.

## Maintaining

Before a release, run these from the repository root:

    node --test "test/*.test.mjs"
    node engine/ep.mjs selftest
    node scripts/check.mjs

`scripts/check.mjs` checks that:
- the version markers and both plugin manifests agree, and nothing loads into every session;
- the skills are explicit-only, and each stays under 60 lines;
- the registry validates, and `docs/decisions.md` is its rendering (after editing `registry/`, run `node engine/ep.mjs evidence render --write`);
- owned rules stay within their token budgets and use plain wording;
- the engine stays within its size budgets and runs no git command that writes, except in the bench's scratch clones;
- text files use LF without a BOM, and the files where instructions live have no hidden characters.

Bump `version` in `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` for every release, because Claude Code installs update only when it changes. Then tag `v<version>`, and CI publishes the release. Codex is different: each time it starts, it reinstalls unpinned copies from the latest commit on `main` whether or not `version` changed, so anything pushed to `main` reaches those users.
