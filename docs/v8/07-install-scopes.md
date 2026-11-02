# 07. Install scopes

Status: draft for review, 2026-11-01. This file answers the requirement that the playbook can be installed for all of a user's projects or for one project only, for Claude Code (v8.0) and Codex (v8.1). Agent behavior is described as documented or read in source for Claude Code 2.1.316 and Codex CLI 0.166.0; sources and dates are in [14-sources.md](14-sources.md). Facts not yet exercised on a real install are listed in section 13 and tested by kill test K-SCOPE ([03-admission-ledger.md](03-admission-ledger.md)).

## 1. Three choices

Setup asks one question first.

| Choice in setup | Scope | Who it affects | Where v8 writes | Committed |
| --- | --- | --- | --- | --- |
| All my projects | `user` | You, in every project on this machine | The agent's user config folder (`~/.claude`, `<codex home>`) | Never in a repository |
| This project, for the team | `project` | Everyone who works in the repository and accepts their agent's prompts | Committed-safe files in the repository, plus the lock file `.efficiency-playbook.json` | You review and commit; v8 never commits |
| This project, just for me | `local` | You, in this repository only | Files git ignores, and the agent's per-project records | No |

Rules at every scope:

1. Each item is written at exactly one scope, the one the user chose for it. The only shared layer is the machine layer (section 2.3): machine tools and plugin installs in the per-user plugin cache, both reference-counted.
2. `project` scope writes only kinds that are safe to commit: owned rules files, owned instruction blocks, declarative plugin and marketplace enablement, and the lock. Never hooks, MCP servers, permission rules, `env` entries, or endpoint and credential settings (I6 and I7 in [10-threat-model.md](10-threat-model.md)). A component that runs hooks, keeps per-user state outside the scope, needs an `env` entry or needs a machine tool is never enabled at `project` scope either, because enablement there overrides each teammate's own user-scope choice. The lock can only recommend it, and each person's setup offers it at `local` or `user` (section 6).
3. `local` scope never changes a tracked file. It refuses a target that git tracks, such as a committed `settings.local.json`, and reports it. For every file it creates, it adds an owned line to the exclude file that `git rev-parse --git-path info/exclude` names, whether or not the file is ignored today (never to `.gitignore`, which is committed), and `verify` re-checks that each local file is still untracked and ignored (`EP-LOCAL-EXPOSED`). All worktrees of a repository share that exclude file.
4. Removing one scope never changes another scope's items (section 7).
5. v8 never grants workspace or project trust in either agent. Trust prompts belong to the agent and the user.
6. `project` and `local` need a git working tree whose top level isn't the home folder, a parent of it or an agent config folder. In a non-git folder, or under a home folder kept as a dotfiles repository, setup offers `user` only and says why: there the "repository" files would be the user's own config and load in every project.

## 2. Where each item goes

### 2.1 Claude Code

| Item | `user` | `project` | `local` |
| --- | --- | --- | --- |
| Working rules and other always-loaded text | Owned file `~/.claude/rules/efficiency-playbook.md` | Owned file `<repo>/.claude/rules/efficiency-playbook.md`, always written in full (section 3.3, rules 3 and 4) | Owned file `<repo>/.claude/rules/efficiency-playbook.local.md`, git-ignored |
| Command map | Not used | Section of the project rules file | Section of the local rules file |
| Settings keys (for example the auto-compact window cap, when its Trial is on) | `~/.claude/settings.json` | Not written: settings that change agent behavior stay personal | `<repo>/.claude/settings.local.json` |
| Plugin enablement | `claude plugin install <id> --scope user` (`enabledPlugins` in `~/.claude/settings.json`) | `--scope project`, only for plugins allowed there (section 1, rule 2): `enabledPlugins` plus `extraKnownMarketplaces` in `<repo>/.claude/settings.json`, with the release tag in the marketplace source if P0 confirms the field (section 13, item 14); each teammate's agent prompts to add the marketplace and install | `--scope local`: `enabledPlugins` in `<repo>/.claude/settings.local.json`; `false` here is also how one person opts out of a team plugin |
| v8's own skills | Inside the plugin, enabled at the chosen scope | Same | Same |
| Optional nudge hook | `~/.claude/settings.json`, with its script in the config folder (`~/.claude/efficiency-playbook/nudge.mjs`), so a synced config folder never points at another machine's state root. The hook reads cached findings only, makes no network call and sets a 5-second timeout | Never | Never |
| Optional MCP server (Context7, has egress) | `claude mcp add --scope user` | Never | Not offered |
| Machine tools | Machine layer (2.3) | Machine layer | Machine layer |

The plugin's files always live in the per-user plugin cache, whatever scope enables it; enabling a plugin for a project never copies it into the repository.

### 2.2 Codex

`<codex home>` is `CODEX_HOME`, or `~/.codex` when it isn't set.

| Item | `user` | `project` | `local` |
| --- | --- | --- | --- |
| Instruction text | Block in the global file Codex reads: `<codex home>/AGENTS.override.md` when it is non-empty, otherwise `<codex home>/AGENTS.md` | Block in the repository root `AGENTS.md` | Not available (2.4) |
| Command map | Not used | Section of the project block | Not available |
| Config keys | Owned keys in `<codex home>/config.toml`, comments and order kept | Not written: settings that change agent behavior stay personal, as for Claude Code. (Codex reads `<repo>/.codex/config.toml` only after the user trusts the project, and ignores provider, base-URL, `notify`, profile and telemetry keys there.) | Not available |
| Plugin enablement | `codex plugin marketplace add <source> --ref vX.Y.Z`, then `codex plugin add <id>` (installs into the user cache and enables it in user config) | Only for plugins allowed at `project` (section 1, rule 2): `[marketplaces.<name>]` with `source` and `ref`, and `[plugins."<id>"] enabled = true`, in `<repo>/.codex/config.toml` (trusted projects only); the plugin's files still live in the user cache | Not available |
| v8's own skills | Inside the Codex plugin (`codex-skills/`, `allow_implicit_invocation: false`) | Same | Not available |
| Optional nudge hook (v8.1) | `<codex home>/hooks.json`; Codex skips a new or changed hook until the user reviews it in `/hooks` | Never | Not available |
| Machine tools | Machine layer | Machine layer | Not available |

v8 never installs skills into a `.agents/skills` folder. Other agents read `~/.agents/skills` too, and the Agent Skills format has no explicit-only field, so an agent whose own flag v8 doesn't set may load those skills automatically; v7.4's two copies there are removed on migration ([11-migration-and-roadmap.md](11-migration-and-roadmap.md)).

### 2.3 Machine layer

Tools several scopes need, such as `typescript-language-server` or the npm user-prefix fix on Windows, are installed once per machine at user level, never system-wide, and recorded in `machine.json` with the scopes that use them. Plugin installs in the per-user plugin cache are recorded the same way: each scope that enables a plugin through v8 adds a reference. Uninstalling a scope drops its reference. A tool or plugin is removed only when no scope refers to it and v8 installed it; tools v7 installed are kept by default, as v7's rollback did.

### 2.4 Why Codex has no `local` scope in v8.1

As far as the 0.166.0 source shows, Codex has no per-user, per-repository location for instructions or config that is neither committed nor a replacement for the team's files:

- `AGENTS.override.md` in a folder replaces that folder's `AGENTS.md`, because Codex takes one file per folder. A personal override would hide the team's instructions.
- `.codex/config.toml` has no local variant, and profiles are user-level files chosen per run with `--profile`, not per project.

When Codex is selected and the user picks "This project, just for me", setup explains this and offers `user` or `project` instead. If a later Codex release adds a per-project user layer, the Codex adapter gains `local` without other changes (section 13, item 11).

### 2.5 Relocated, synced and WSL config folders

- **Relocated.** `CLAUDE_CONFIG_DIR` and `CODEX_HOME` move the user config folder, and each folder is a separate user scope (S-8). On Windows, a variable set only in a PowerShell profile reaches the terminal but not the Desktop app, which doesn't read PowerShell profiles; on macOS and Linux the app reads what the login shell exports when the app starts, so a change needs an app restart. `inspect` therefore resolves each agent's config folder and the state root twice, from its own environment and from the persistent user environment that apps started from the desktop inherit, and the plan warns when they differ (`EP-SURFACE-SPLIT`), since a user-scope install would then load on one surface only.
- **Synced.** A config folder inside a synced folder (OneDrive, iCloud Drive, Dropbox) or a git repository reaches other machines, but the state root never syncs (05). `inspect` reports it (`EP-CONFIG-SYNCED`), each state item records the machine id, and the plan says that changes there reach every machine that syncs the folder. User scope also keeps a small lock in the config folder (`efficiency-playbook.lock.json`, same format as the project lock in section 6), so another machine that syncs the folder can rebuild ownership instead of meeting unknown files.
- **WSL.** To the engine a WSL distribution is a separate machine, with its own home folder, config folders, plugin cache and state root, so it is installed and verified apart from Windows. Surfaces mix the two sides (a WSL project's `.mcp.json` run on Windows: CC#102712; nothing shows which side's settings a session reads: CC#106526), so `inspect` says which side it runs on. A repository on a Windows drive opened from both sides gets two independent installs, and each side's uninstall removes only what that side recorded.

## 3. Instruction files

### 3.1 What Claude Code loads

- **Always:** `~/.claude/CLAUDE.md`, every `.md` file under `~/.claude/rules/`, the project's `CLAUDE.md` or `.claude/CLAUDE.md` in the working folder and its parents, the project's `.claude/rules/` (a rule with `paths:` frontmatter is documented to load only when matching files are in play, but open reports show such rules loading at session start or not at all, so the budget counts them as always loaded: CC#16299, CC#96361), `CLAUDE.local.md`, and whatever those files import with `@path`. Imports don't reduce cost: imported text is loaded in full. An import that doesn't resolve, or whose path has a space, loads nothing and reports nothing (CC#88813, CC#96192), so v8 writes no imports.
- **`AGENTS.md`:** read only when no `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` exists in the working folder or above it (Claude Code 2.1.277 and later; 2.1.281 extended it to Bedrock, Vertex AI, Microsoft Foundry and LLM-gateway sessions and to sessions with telemetry off). That is the default; the "Project instructions" option in `/config` (`instructionFiles`, below) can change it, so the engine reads the effective value (section 13, item 12). Claude Code never reads `AGENTS.override.md`, `AGENTS.local.md` or anything under `.agents/`.
- **Ancestor folders count.** Claude Code reads `CLAUDE.md` from the working folder and every folder above it, and when no `CLAUDE.md` counts it also reads `.claude/AGENTS.md` in the folders above (memory docs, read 2026-11-01). So on the machine where this design was written, a third-party pack's `~/.claude/AGENTS.md` loads as project instructions in every repository under the home folder that has no `CLAUDE.md` (observed in a Claude Code session on 2026-11-01). The user file `~/.claude/CLAUDE.md` doesn't count: it loads alongside a project's `AGENTS.md` and doesn't stop it from loading (same docs). An open report says the opposite (CC#103458, 2026-10-19); a contributor traced that decision in the public `agents-md` module source, not in the packaged 2.1.302 or 2.1.303 loader, so the duplicate report in section 3.3 is checked against `/memory` rather than assumed.
- **`instructionFiles`** is that "Project instructions" option: a setting of the built-in plugin that reads `AGENTS.md`, under `pluginConfigs` → `cc-plugin-agents-md@builtin` → `options` (the ID was `agents-md@builtin` before 2.1.285; 2.1.285 and later read either). It picks which files load: `claude-md-or-agents-md` (the default), `claude-md-and-agents-md`, `claude-md` or `managed-only`. It is read only from user settings, `--settings` and managed settings, not from project or local settings, so a project install can't change it (memory docs, read 2026-11-01).
- **Auto memory** is on by default, per project; the first 200 lines or 25 KB of its index load in every session.

### 3.2 What Codex loads

- **Global:** `<codex home>/AGENTS.override.md` if it is non-empty, otherwise `<codex home>/AGENTS.md`.
- **Project:** walking from the project root down to the working folder, one file per folder (`AGENTS.override.md` first, then `AGENTS.md`), joined together. The total is capped by `project_doc_max_bytes` (32 KiB by default), and text past the cap is cut without a warning. Project files are skipped only when the project is explicitly marked untrusted.
- **Skills:** `~/.agents/skills`, found through the home folder rather than `CODEX_HOME`; the repository's `.agents/skills` folders from the working folder up to the root; and an undocumented repository `.codex/skills`. The repository folders load without a trust check (T20 in 10).

### 3.3 How v8 places text

1. **Claude Code: whole owned files, never shared ones.** v8 writes its text into files it fully owns under `rules/` folders. It never creates or edits `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md`: creating any of them in a repository that relies on `AGENTS.md` would silently stop Claude Code from reading the team's `AGENTS.md`, and editing them mixes owned and user text. Owned files need no markers and are removed by hash on uninstall.
2. **Codex: one marked block in the file Codex actually reads.** At user scope that is the override file when it is non-empty; at project scope it is the repository root `AGENTS.md`. v8 never creates an `AGENTS.override.md`. Markers are `<!-- ep:begin <id> -->` and `<!-- ep:end <id> -->`, and their bytes count toward the budget because Codex keeps HTML comments in context. If the user later empties their own text in `AGENTS.override.md`, v8's block alone would keep the file non-empty and Codex would keep ignoring `<codex home>/AGENTS.md`; `verify` reports that case (`EP-INSTRUCTIONS-NOT-LOADED`) and the next plan offers to move the block.
3. **Each agent gets its own copy.** With both agents selected for a project, v8 writes the full Claude Code rules file and the Codex block in `AGENTS.md`. When Claude Code also reads that `AGENTS.md`, the shared text loads twice in Claude Code, about 400 to 550 tokens per session (the working rules, plus the command map when there is one), and `verify` reports it (`EP-DUPLICATE-BLOCK`). v8 doesn't try to serve both agents from one copy: whether Claude Code reads `AGENTS.md` depends on files outside the repository and on each person's setup (a personal `CLAUDE.local.md`, a `CLAUDE.md` in a parent folder or in a monorepo package, the "Project instructions" option), so a shared copy would make the committed bytes differ between machines and could silently drop the rules for teammates who don't run v8. A team `CLAUDE.md` that imports `@AGENTS.md`, as v7 set up, loads the block as well and is reported the same way.
4. **Project files are self-contained; duplicates are reported, not hidden.** Committed files must work for teammates who have no user-scope install, so a project install carries the working rules the maintainer selects plus the project-only fragments. On a machine that also has the user-scope install, the same rules then load twice, about 400 tokens per session (the working rules). `verify` reports `EP-DUPLICATE-BLOCK` with that cost, and when the agent has a native way to skip one file for one project (Claude Code's `claudeMdExcludes`, which skips instruction files by path or glob at any settings layer; whether it also covers a user-level rules file is to be confirmed: section 13, item 4) the plan offers it at `local` scope. That exclusion records the scope that makes it safe and is re-checked like other local choices (section 5). Within one scope the renderer never places a fragment twice for one agent.
5. **Caps are checked before writing.** After rendering, v8 checks every instruction file it writes against the agent's caps: Codex's 32 KiB total for project docs, summed along the path from the repository root to every folder that has an `AGENTS.md`, because Codex joins one file per folder and cuts the end; and Claude Code's guidance of under 200 lines per instruction file, which is advice rather than a cut-off, so a longer file gets a warning. `EP-SIZE-CAP` blocks a write that would push any of those paths past the Codex cap, because the overflow would be cut silently. `verify` also reports an auto memory index longer than the 200 lines or 25 KB that Claude Code loads at session start.
6. **Branches and worktrees.** Committed files belong to a branch, so the lock in the current checkout decides what is installed at `project` scope: a checkout without the lock has no project install, whatever another branch holds, and `verify` reports nothing for that scope there. Ownership of project files is derived, not remembered. A committed file or block is v8's when it matches what the lock renders at the lock's engine version, and the command map, whose commands only a person confirms, is checked against a hash the lock carries. Any clone can then verify, upgrade and uninstall the team install: a co-maintainer's, a new laptop's, or the same repository under another path. Local files are per worktree. Git doesn't copy ignored files into a new worktree, and Claude Code Desktop, which starts sessions in worktrees under `<repo>/.claude/worktrees/`, copies only the files listed in `.worktreeinclude`. In a new worktree the local rules, local keys and a local `false` for a team plugin are therefore missing until setup re-creates them, and in Desktop the plan says so before the user picks `local`. When the repository has no `.worktreeinclude`, v8 offers an untracked one, excluded like its other local files, if P0 confirms Claude Code honors it (section 13, item 13); a committed one v8 doesn't edit, and the plan shows the lines the team could add. Journals record the worktree they ran in, and `rollback` refuses to run in another.

## 4. Settings, plugins and policy

### 4.1 Claude Code

- **Settings precedence**, highest first: managed, command-line flags, local, project, user. A scalar key takes the highest scope's value; arrays such as permission rules merge. Hooks from every level run; an identical handler in two settings files runs once, but a plugin's or skill's copy of the same handler runs separately.
- **Plugin enablement** resolves local over project over user. That is how "Disable for me" works: `false` at local scope switches a team plugin off for one person.
- **The plugin cache is per user.** A project-enabled plugin still needs each collaborator's one-time install, which their agent prompts for.
- **One scope per key.** v8 writes a settings key only at the scope the user chose and never the same key at two scopes. `ep show` prints each effective value with the scope it comes from.
- **Keys that only work at some scopes.** `instructionFiles` works only at user, `--settings` and managed level, and since 2.1.285, on Windows, project and local `env` can't set some variables. The adapter's key table records where each key works, and a registry entry that places a key where it is ignored fails CI instead of being written silently.
- **Managed settings** are read-only inputs. A plugin or marketplace that policy blocks becomes a `blocked-by-policy` row and is never retried another way. If the operating system denies reading the managed settings file, Claude Code starts without its policies (2.1.285); `verify` reports that state (`EP-POLICY-UNREADABLE`) instead of treating it as "no policy".

### 4.2 Codex

- **Config precedence**, highest first: command-line flags, project `.codex/config.toml` (closest to the working folder wins), a `--profile` file, user `config.toml`, cloud-managed config, system config (`%ProgramData%\OpenAI\Codex\config.toml` on Windows).
- **Trust.** Project config is ignored unless the user's config marks that path `trust_level = "trusted"`. v8 never writes trust. Until the user trusts the project, `verify` reports its project items as inactive (`EP-CODEX-PROJECT-UNTRUSTED`).
- **Auto-update.** At startup Codex checks every Git marketplace with `git ls-remote` and force-reinstalls its plugins when the revision changed, unless the marketplace was added at a tag or a full commit SHA. v8 installs with `--ref vX.Y.Z`, and `verify` reports an unpinned entry for this plugin (`EP-MARKETPLACE-UNPINNED`, T19 in 10).
- **Hooks** at either level need the user's review in `/hooks` for each new content hash, so an upgrade that changes a hook switches it off until reviewed (`EP-CODEX-HOOK-UNTRUSTED`).
- **MCP:** `codex mcp add` writes user config only; v8 adds no MCP servers at project scope anyway.
- **No root plugin manifest.** Codex 0.166.0 prefers a root Agent Plugins `plugin.json` over `.codex-plugin/plugin.json`, and with a root manifest it loads skills only from `skills/`, which holds the Claude Code skills. The repository keeps `.codex-plugin/plugin.json` and `codex-skills/` until the two skill folders are merged.

## 5. How scopes combine

| Combination | Instructions | Settings and plugins | What v8 does |
| --- | --- | --- | --- |
| `user` only | User rules in every project | User keys and plugins everywhere | Nothing extra |
| `project` only | Project rules for everyone in that repository | Team plugins after each person's install prompt | The lock lists components and recommendations; a teammate's setup offers the team plugins not yet installed, and the recommended components at `local` or `user` scope |
| `local` only | Your rules in that repository | Your keys and plugins | Ignored files only |
| `user` + `project` | Both load; identical working rules load twice on your machine | A plugin enabled at both scopes loads once | Reports the duplicate rule tokens (`EP-DUPLICATE-BLOCK`) and offers a native exclusion where one exists |
| `project` + `local` | Both load | Local wins, to add to or opt out of the team's set | Local never repeats a project item |
| `user` + `local` | Both load | Local wins | Local never repeats a user item |
| Both agents in one project | Claude Code loads its rules file, and also the `AGENTS.md` block when it reads `AGENTS.md` | Each agent's own enablement | Reports the duplicate (section 3.3, rule 3) |
| One component through two channels (a plugin and copied files, or two marketplaces) | Both copies load | Hooks run twice | `verify` reports `EP-ROLE-CONFLICT`. On the machine where this design was written, one pack installed both ways lists every agent twice and pays about 7,800 tokens of descriptions twice |

A local choice can depend on another scope: an item skipped because `user` or `project` already provides it, an exclusion of the user rules file, or a `false` that opts out of a team plugin. Each records the scope and item it depends on. A pull can remove the team's install, a branch can lack it, and the user scope can be uninstalled; every `verify` and plan re-checks those records and reports the ones whose reason is gone (`EP-LOCAL-STALE`), with a row to restore the item or drop the exclusion.

## 6. Team and personal use

### What a teammate experiences

1. After pulling, the project rules (the `.claude/rules/` file or the `AGENTS.md` block) load in their next session.
2. Claude Code prompts them to add the marketplace and install the enabled plugins. Codex reads the project's plugin enablement only after they trust the project.
3. Optionally they run setup in the repository. The plan is limited to what the committed configuration needs on their machine (`EP-PLUGIN-NOT-INSTALLED` rows for team plugins not yet installed), plus an offer of the components the lock recommends and of personal extras, at `local` or `user` scope. Machine tools come only with a recommended component the teammate opts into, and each component passes its own checks first: a language-server plugin brings its server and is enabled only after the server starts on that machine.
4. Nothing executes without a native prompt, because v8 commits no hooks, MCP servers or permission rules.

### The lock file

`.efficiency-playbook.json` at the repository root holds the engine version, the selected agents, the components rendered into committed files with their options, and the personal components the team recommends, nothing else (I5). It lets v8 on any machine know which committed files it renders, and therefore which files it owns (section 3.3, rule 6). Content hashes aren't stored, because rendering is deterministic for a given engine version and `ep verify --ci --scope project` re-renders and compares. The one exception is a hash of the command-map section: its commands are confirmed by a person and never stored in the lock, so the hash is how another machine, or CI, tells an edited map from v8's own. An engine whose version differs from the lock's only reports, and names the version to install (`EP-LOCK-ENGINE-MISMATCH`): an older engine doesn't know newer ids, and a newer one would report false drift. The maintainer moves the lock to a new engine version with an upgrade plan. The first time v8 meets a lock it didn't write on this machine, it asks "Trust this repository's configuration?" and shows every row.

### Removing for the team or for yourself

- **For the team:** `ep uninstall --scope project` removes the committed files and the lock from the working tree, and the maintainer commits the removal. Teammates' plugins stay installed until they remove them with their agent. v8 never uses the agent's "Uninstall for everyone".
- **For yourself:** opt out of a team plugin with `false` at `local` scope, or remove your own extras with `ep uninstall --scope local`.
- **v8 itself:** v8's engine lives in its plugin, so removing the plugin strands any scope that still has items. State records the absolute folder of every repository and worktree where v8 applied a plan on this machine (state is per user and never committed), `ep show --installs` lists every scope that still has items, and the uninstall report suggests removing the plugin only when that list is empty.

## 7. Removing a scope safely

v8 removes or restores only items it owns at that scope, each checked by hash; an edited item becomes a diff and a question. Removed files move to the quarantine folder in the state root. The order is: owned text and keys, then plugin enablement, then marketplaces left with no plugins, then machine tools whose reference count reached zero.

v8 never:

- removes a marketplace that still provides a plugin v8 doesn't own, because removing a marketplace uninstalls all of its plugins;
- runs `claude plugin prune`, which removes auto-installed dependencies other plugins may rely on, or "Uninstall for everyone";
- deletes a third-party component's own state while another scope may still use it. A component's own cleanup step, such as Ponytail's `scripts/uninstall.js`, which Ponytail's install guide requires before the plugin is removed, runs only in the step that removes the plugin from the machine (section 2.3), after consent, and only when no scope v8 can see still enables the plugin, whether v8 or the user enabled it. Enablement in a repository v8 has never touched can't be seen, so that row says so and is unchecked by default;
- removes an exclude line it didn't add, or one that a local file in another worktree still needs.

## 8. Third-party components and scope

- **User-wide state.** Some components keep per-user state whatever scope enables them. Ponytail 5.3.3 writes its mode flags, config, status-line copy and band ledger per user even when enabled for one project, and `/ponytail default` changes the global default; an open issue (#1162) shows a project's "off" default leaking into sessions in other projects. The registry lists that state per component (`userStateOutsideScope`), the plan shows it on the row, and such a component is never enabled at `project` scope (section 1, rule 2). To switch Ponytail off for one project, v8 sets its plugin enablement to `false` at `local` scope, which stops its hooks, rather than using Ponytail's environment variables.
- **Language servers** are machine tools (2.3), whichever scope enabled the plugin that needs them.
- **Context7** (opt-in, sends library names and questions to its service) is offered at user scope only.

## 9. Checking what loads

Files on disk aren't the effective configuration, so v8 checks both.

- `ep show` (all scopes by default) lists, per agent, every instruction file, rule, settings key and plugin that applies in the current folder and the scope it comes from, computed with each agent's loading rules from section 3. It flags items that exist but won't load (`EP-INSTRUCTIONS-NOT-LOADED`), text cut by a cap (`EP-SIZE-CAP`), keys shadowed by a higher scope, duplicates, and instruction files in ancestor folders that load into every repository below them (`EP-ANCESTOR-INSTRUCTIONS`).
- The agent's own reports serve as cross-checks. In Claude Code: `/memory` (loaded instruction files), `/context` (tokens per item), `/status` (settings sources and version) and `claude plugin details <id>` (a plugin's always-on tokens). Kill test K-TOKENS requires v8's estimate and these reports to agree within 10%.
- Surfaces are checked separately where they can differ. The Claude Code Desktop app runs its own copy of Claude Code with its own version, and on Windows it doesn't read PowerShell profiles for `PATH`; plugins aren't available in WSL sessions. `EP-AGENT-BELOW-MIN` is evaluated per surface.
- **Start folders and cloud sessions.** What loads depends on where a session starts. In a monorepo, a session started in a package folder walks up from there, and a package with its own `CLAUDE.md` changes whether `AGENTS.md` loads (3.1); whether Claude Code also reads the root's `.claude/settings.json` and `.claude/rules/` from a package folder is to be confirmed (section 13, item 16). `ep show --from <folder>` computes the effective set for another start folder, and in a monorepo `verify` lists the package folders whose sessions would miss project items. Cloud sessions (Claude Code on the web, Codex cloud tasks) start from a fresh clone, so they get committed `project` files and nothing from `user` or `local` scope (to be confirmed, item 16); the scope question in setup says so.

## 10. The next-session rule

Changes to the tool list (plugins, MCP servers) apply cleanly to new sessions, and resuming an older session after such a change rewrites its prompt cache once. Instruction files are read at session start. So every apply ends with "start a new session", and v8 never pushes changes into a running session through hooks. Writes are atomic per file because sessions may be open while setup runs; an organization's `ConfigChange` hook can block a write partway through an apply, and the journal records which rows completed. A session left open can also undo an apply later: some host commands rewrite a whole settings file from the copy the session read at start (CC#93742, reproduced on 2.1.283). So the report asks to close other sessions of that agent first, and the next `verify` reports any owned key that vanished as `EP-DRIFT-MISSING`.

## 11. Minimum versions

| Agent | Floor for v8 | Why |
| --- | --- | --- |
| Claude Code, every surface | 2.1.281 | Fix for CVE-2026-86063, which its reporters call Plugin4Shell (advisory GHSA-pq7j-f95f-qfcv, 2.1.179); `AGENTS.md` reading (2.1.277, extended in 2.1.281 to Bedrock, Vertex AI, Microsoft Foundry, LLM-gateway and telemetry-off sessions), which section 3.3 (rules 1 and 3) and acceptance tests 4 and 5 rely on |
| Claude Code on Windows | 2.1.309 recommended; `verify` warns below it. 2.1.309 is also npm's `stable` tag on 2026-11-01 | Fixes for the PowerShell tool skipping deny and ask rules when its command parser failed to start (2.1.285), UNC-path reads without a prompt (2.1.292), Git Bash `rm -rf` in bypass mode (2.1.296) and `cd` auto-approval (2.1.309) |
| Codex CLI | 0.165.0 | Git plugin SHA verification (0.146.0); a marketplace URL validation gap closed (0.165.0) |

Per-component minimums live in the registry; these are the floors for v8 itself.

## 12. Acceptance tests (K-SCOPE)

Run on Windows, Linux and macOS with current CLIs, in throwaway config folders and fixture repositories. Tests 5, 6, 7 and 12 need the Codex adapter and gate v8.1; the rest gate P0.

1. **Project isolation.** Install at `project` scope in repository A; in repository B nothing from v8 loads, checked with `ep show` and the agent's own reports. The write paths of the three scopes never overlap, and with a home folder that is a git repository, or in a non-git folder, setup offers only `user`.
2. **Local stays local.** Install at `local` scope; `git status` is clean; a fresh clone has no v8 files; a tracked `settings.local.json` is refused; uninstalling in one worktree keeps an exclude line that another worktree's local file still needs; removing the scope everywhere leaves the exclude file as it was.
3. **User plus project.** The duplicate is reported with the right token count; uninstalling `project` leaves `user` intact and the reverse. With a language-server plugin enabled at `user` and at `local` in one repository, its server stays until the last of the two is uninstalled.
4. **`AGENTS.md` keeps loading.** In a repository with `AGENTS.md` and no `CLAUDE.md`, with and without a user `~/.claude/CLAUDE.md` (CC#103458), after a Claude Code project install, Claude Code still loads `AGENTS.md`, and v8 created no `CLAUDE.md` or `CLAUDE.local.md`.
5. **Both agents.** With both agents selected, the committed files are byte-identical on two fixture machines, one of them with a personal `CLAUDE.local.md`; where Claude Code also loads `AGENTS.md`, `verify` reports the duplicate with its token count.
6. **Codex trust.** In an untrusted project, project items are reported inactive; after the user trusts it, they are active; v8 never wrote `trust_level`.
7. **Codex cap.** With an existing root `AGENTS.md` near 32 KiB, or a package `AGENTS.md` whose path from the root totals near 32 KiB, the plan blocks the project block with `EP-SIZE-CAP`.
8. **Uninstall collateral.** With another plugin from the same marketplace, a shared dependency and a teammate-enabled project plugin present, uninstall removes only owned items, and the dry run lists only those (L-12).
9. **Policy.** With managed settings that block a marketplace, the row is `blocked-by-policy` and nothing is retried.
10. **Branches and worktrees.** In a new Desktop worktree, project files are present and recognized as owned from the lock; local files are reported missing and re-created on consent. On a branch without the lock, nothing is reported for `project` scope. `rollback` started in another worktree refuses.
11. **Windows.** A non-ASCII user name, PowerShell 5.1 only, and Git Bash only. A config folder inside OneDrive: `EP-CONFIG-SYNCED` is reported, a second fixture machine that syncs the folder rebuilds ownership from the user lock, and the nudge hook never points into another machine's state root.
12. **Codex pin.** After install the marketplace entry carries the tag, and a new commit on `main` doesn't change the installed plugin.
13. **Second machine.** A co-maintainer's clone under a different path spelling verifies, upgrades and uninstalls the project install, and catches an edited command map. An engine whose version differs from the lock's only reports.
14. **Personal components.** Ponytail and language-server plugins can't be placed at `project` scope. A lock that recommends them gets each teammate an offer at `local` or `user` scope, and a teammate's own user-scope `false` for Ponytail stays in effect.
15. **Shared third-party state.** With Ponytail enabled at user scope and at `local` scope in one repository, uninstalling `local` doesn't run Ponytail's cleanup step or touch its per-user state.
16. **Stale local choices.** After the team's install is removed by a pull, or the user scope is uninstalled, `verify` reports each local choice that depended on it (`EP-LOCAL-STALE`).
17. **Start folders.** In a monorepo fixture, sessions started at the root, in a package with its own `CLAUDE.md`, in a fresh worktree and in a fresh clone without user config load what `ep show --from` predicts, checked with `/memory` and `/context`.

## 13. Facts to confirm in P0

Read in documentation or source but not yet exercised:

1. Claude Code loads git-ignored files under `<repo>/.claude/rules/` (needed for `local` scope). No documentation says ignored files are skipped: the memory docs say rule files are discovered recursively, and only search tools such as Grep respect `.gitignore` (read 2026-11-01).
2. `claude plugin install --scope local` writes only `<repo>/.claude/settings.local.json`, and `#<tag>` in `claude plugin marketplace add` pins that tag. Both are documented (read 2026-11-01; a marketplace `ref` takes a branch or tag, and commit pins are documented only for plugin entries) but not yet exercised.
3. Whether a session in `<repo>/.claude/worktrees/<name>` also loads the enclosing checkout's `CLAUDE.md` and `.claude/rules/`. The walk up from the working folder suggests it does for `CLAUDE.md`; the worktrees page says only that the worktree's own files load. (Settled from the docs: `~/.claude/CLAUDE.md` doesn't stop a project's `AGENTS.md` from loading, section 3.1.)
4. `claudeMdExcludes` exists, works at any settings layer and also applies to `AGENTS.md` (memory docs, read 2026-11-01). To confirm: whether it can skip a user-level rules file under `~/.claude/rules/` for one project.
5. Codex: a marketplace declared only in project config is installed automatically, or needs `codex plugin add`.
6. Codex: project-level `[[skills.config]]` applies.
7. Codex: duplicate skill names still break `$name` invocation.
8. Codex: `codex exec --json` usage includes subagent tokens.
9. Codex: what `--ignore-user-config` skips (needed for bench isolation).
10. Codex: the `owner/repo@tag` shorthand used in v7.4's README still works alongside `--ref`.
11. Codex: no per-project user layer exists for instructions or config (2.4).
12. Claude Code: the "Project instructions" option in `/config`, which decides whether `AGENTS.md` loads, is `instructionFiles`, read only from user settings, `--settings` and managed settings (3.1; memory docs, read 2026-11-01). To confirm: that a value in project or local settings is ignored.
13. Claude Code Desktop honors an untracked `.worktreeinclude` that `.git/info/exclude` hides, so local files follow into new worktrees (3.3, rule 6).
14. Claude Code: a Git marketplace source in `extraKnownMarketplaces` accepts a tag or commit, so a project install can pin the version teammates get (2.1).
15. Codex: with a root Agent Plugins `plugin.json`, skills load only from `skills/` (read in the 0.166.0 source; matters only if that manifest is ever added).
16. Which project files a session started in a monorepo package folder loads (the root's `.claude/settings.json` and `.claude/rules/`), and what cloud sessions load: Claude Code on the web and Codex cloud tasks (section 9). An open report says cloud sessions ignore committed marketplaces and plugin enablement while hooks from the same file run (CC#78119).
17. Codex: whether `codex exec` applies the same trust checks as an interactive session: project `.codex/` layers only in trusted projects, and review for hooks that aren't managed (10 T17).
