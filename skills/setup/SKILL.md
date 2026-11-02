---
description: Install, upgrade or remove the Claude Code efficiency setup at user, project or local scope. Shows every change with its token cost and evidence, and asks before making it. Run only when the user types /efficiency-playbook:setup.
argument-hint: "[user|project|local] [uninstall]"
disable-model-invocation: true
---

Arguments: $ARGUMENTS

The engine does every read and write; this skill only talks with the user. Run it as `node "${CLAUDE_PLUGIN_ROOT}/engine/ep.mjs" <command> --json` and read the envelope (`ok`, `data`, `findings`, `error`). Exit codes: 0 done, 1 findings, 2 usage, 3 blocked, 4 stale plan. Never edit the files it manages yourself, never write the plugin's own path into a file, and never commit or push.

## First
1. Run `node --version`. If Node is missing or older than 22, stop and walk the user through an install without admin rights, then wait until `node --version` reports 22 or later. Windows: download the x64 `.zip` of the current LTS from https://nodejs.org/en/download, compare `Get-FileHash` with the `SHASUMS256.txt` beside it, unpack it under `%LOCALAPPDATA%\Programs`, and add the folder that holds `node.exe` to the user PATH (Start, then "Edit environment variables for your account"), then open a new terminal. winget's Node package installs for all users and asks for admin, so don't offer it. macOS: `brew install node` if Homebrew is there. Otherwise, and on Linux: the official `.tar.xz`, checked against `SHASUMS256.txt`, unpacked under `~/.local`, with its `bin` folder on PATH. Never pipe a downloaded script into a shell.
2. Take the scope from the arguments, or ask, with three options:
   - user: every repository on this machine, for you only (files in your Claude config folder).
   - project: this repository, for everyone who clones it (files you review and commit).
   - local: this repository, for you only (git-ignored files).
   Project and local need a git repository. If this folder isn't one, say so and offer user scope.
3. Run `inspect` and say in two lines what it found: the Claude Code version, existing installs per scope, and any v6 or v7 setup that the plan will migrate.

## Install or upgrade
1. Run `plan --scope <scope>`. If a finding is EP-ANSWER-NEEDED (project or local scope), find the repository's quick check and full acceptance commands in its package.json scripts, Makefile, justfile, pyproject.toml, Cargo.toml or CI workflow. Let the user confirm or correct them. Write `{"commandMap":{"quick":["..."],"full":["..."]}}` to a file in your scratchpad or the system temp folder, never in the repository, and run `plan` again with `--answers <that file>`.
2. Show the rows grouped by their `group` value, each with a plain label: `core` is the rules file, `migration` removes a v6 or v7 setup, and every other value is a component id, such as `lsp` (code navigation), `concise` (output style), or `context7` (docs lookup). For each row give the change in plain words, the target, `alwaysLoadedTokens`, the verdict with its evidence ids where it has one, and the egress. Whenever the egress isn't `none`, say what is sent and to whom. Show conflict and blocked rows apart, with before and after; they're never approved by default. Then list `data.options`, the components that are off by default, with the same facts.
3. Ask which groups to apply (multi-select, default rows preselected) and which options to add. If the answer changes the plan, run `plan` again with `--with <ids>` or `--without <ids>`, and show what changed.
4. Whatever the permission mode, wait for the user's answer to step 3 before this step; never choose for them. Run `apply --scope <scope> --plan <hash> --approve <selector>`, where the selector is `default`, `group:<value>` entries with those same values, or row ids, comma-separated. On exit 4, show the fresh plan and ask again. On exit 3, report `error` (its code and message) and stop.
5. For each EP-MANUAL-STEP finding, give the user the exact command to paste, one per line.
6. Run `verify --scope <scope>`.
7. Report in at most 15 lines:
   - what changed, per group;
   - the always-loaded tokens added at this scope;
   - anything that now sends data off the machine;
   - verify problems, with their fix hints;
   - the undo command, written out in full the way you ran the engine: `node "<plugin root>/engine/ep.mjs" rollback --scope <scope> --last`, with the real path. That path changes when the plugin updates; `/efficiency-playbook:setup uninstall` always works.
   For project scope, add the `git status` lines and the suggested `git add` list from the apply result; the user commits. End with: "After each update of this plugin, run /efficiency-playbook:setup again."

## Argument `uninstall`
1. Run `uninstall --scope <scope>` and show every row: what is removed, and what goes back to its value from before the install. Files the user edited after the install are conflicts. Leave them unless the user picks them by id.
2. After a yes, apply that plan as in step 4 above, then run `verify --scope <scope>`.
3. Give the paste lines from the EP-MANUAL-STEP findings for plugins this setup installed. To remove this plugin as well, the last line is `claude plugin marketplace remove efficiency-playbook`, which also uninstalls it. In Desktop, + → Plugins → Manage plugins removes the plugin but keeps its marketplace. Then fully quit and reopen Desktop.
