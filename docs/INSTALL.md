# Install, uninstall and restore

This guide covers three jobs: installing the Efficiency Playbook, removing it, and putting Claude Code back to its defaults. The [README](../README.md) has the background on what each part does.

## Before you start

- **Claude Code** v2.1.281 or later. On Windows: `winget install --id Anthropic.ClaudeCode -e --scope user`, then open a new terminal.
- **Node.js 22 or later.** Check with `node --version`. If it's missing, the setup skill walks you through an install that needs no admin rights.
- **Git**, for project and local scope.

## Install (Claude Code)

### 1. Add the plugin

In a terminal, run these once each, in this order:

```bash
claude plugin marketplace add MrHashMe/efficiency-playbook
```

```bash
claude plugin install efficiency-playbook@efficiency-playbook
```

Or, inside a Claude Code terminal session, type `/plugin install efficiency-playbook --marketplace MrHashMe/efficiency-playbook` and choose **Install for you (user scope)**.

- **Desktop app:** run the two terminal lines above, then fully quit and reopen Desktop. `/plugin` lines don't run in the Code tab.
- **VS Code:** type `/plugins`, add `MrHashMe/efficiency-playbook` on the **Marketplaces** tab, then install `efficiency-playbook` with **Install for you**.
- **Stay on one release:** add `#v8.0.0` after the repo name in the first line.

Installing the plugin changes nothing yet. Setup, the next step, is what writes your configuration.

### 2. Run setup

1. Open a session in a project folder and type `/efficiency-playbook:setup`.
2. Choose a scope:

   | Scope | Affects | Writes to |
   | --- | --- | --- |
   | `user` | You, in every project | `~/.claude/rules/efficiency-playbook.md`, `~/.claude/settings.json` |
   | `project` | Everyone who clones the repo | `.claude/rules/efficiency-playbook.md`, `.claude/settings.json` (you review and commit them) |
   | `local` | You, in this repo only | `.claude/rules/efficiency-playbook.local.md`, `.claude/settings.local.json` (git-ignored) |

3. Read the plan. Each row shows the change, its always-loaded token cost, its evidence and anything it sends off your machine. Pick the groups to apply; conflicts are never applied unless you pick them.
4. Paste any `claude plugin` lines it prints, then start a new session (fully quit and reopen Desktop or VS Code).

### 3. Check it

Type `/efficiency-playbook:verify`. It reports drift, duplicates, oversized instructions and missing tools, each with a fix, and changes nothing. Run it again after Claude Code updates.

### Without the plugin

Download the source archive of the [latest release](https://github.com/MrHashMe/efficiency-playbook/releases/latest), unpack it, and from that folder run:

```bash
node engine/ep.mjs plan --scope user
```

It prints the plan and the exact `apply` command to run once you've read it.

## Install (Codex)

```bash
codex plugin marketplace add MrHashMe/efficiency-playbook
```

```bash
codex plugin add efficiency-playbook@efficiency-playbook
```

Start a new Codex session and type `$efficiency-playbook:setup`. Codex uses the v7.4 playbook (Windows only) until the engine's Codex adapter ships in 8.1.

## Uninstall

### Claude Code

1. **Remove the setup.** Type `/efficiency-playbook:setup uninstall` for user scope, or add `project` or `local` (for example `/efficiency-playbook:setup local uninstall`). Repeat for every scope you set up. Approve the plan: it removes what the playbook owns and puts every setting it changed back to the value it had before the install. Files you edited after the install are shown as conflicts and kept unless you pick them.
2. **Remove the plugin:**

   ```bash
   claude plugin marketplace remove efficiency-playbook
   ```

   This also uninstalls the plugin. In Desktop, **+ → Plugins → Manage plugins** removes the plugin but keeps the marketplace registered.
3. **Restart.** Fully quit and reopen Desktop or VS Code, or start a new terminal session.

Do step 1 before step 2: the uninstall runs from the plugin's own engine.

**If the plugin is already gone,** run the engine from a release archive (see [Without the plugin](#without-the-plugin)). Its state is outside the plugin, so it still knows what to remove:

```bash
node engine/ep.mjs uninstall --scope user
```

It prints a plan and the `apply` command to confirm it. To undo only the most recent apply instead of everything, use `node engine/ep.mjs rollback --scope user --last`.

**Project scope:** uninstall edits `.claude/settings.json` and removes `.claude/rules/efficiency-playbook.md` in your working tree. Review and commit those changes so teammates get them too.

### Codex

1. Type `$efficiency-playbook:setup rollback` and approve what it removes.
2. Then run:

   ```bash
   codex plugin remove efficiency-playbook@efficiency-playbook
   ```

   ```bash
   codex plugin marketplace remove efficiency-playbook
   ```

3. Start a new thread (fully quit and reopen the app).

### What stays behind

- **The state folder**, with journals, backups and quarantined files: `%LOCALAPPDATA%\efficiency-playbook` on Windows, `~/.local/state/efficiency-playbook` elsewhere. Nothing reads it once you've uninstalled. Keep it if you might want an old file back, or move it to the Recycle Bin.
- **Node.js and Git**, if setup helped you install them. They are ordinary installs; remove them the usual way if nothing else needs them.
- **Plugins you enabled from the plan's paste lines** (for example a language server or Ponytail). Uninstall lists the `claude plugin` lines that remove them.

## Restore Claude Code to its defaults

Uninstalling the playbook puts back what it changed. That brings back your own pre-install setup, not a factory-fresh Claude Code. To go all the way back to defaults, move your own customizations aside. Rename files rather than deleting them, so you can bring any of them back.

**Keep these:** `~/.claude/.credentials.json` (your login; on macOS it's in the Keychain instead) and `~/.claude/projects/` (your session history).

These hold customizations, and Claude Code recreates defaults when they're missing:

| Path | Holds |
| --- | --- |
| `~/.claude/settings.json` | Settings, permissions, hooks, enabled plugins |
| `~/.claude/CLAUDE.md` and `~/.claude/rules/` | Your instructions for every project |
| `~/.claude/skills/`, `~/.claude/agents/`, `~/.claude/commands/` | Your own skills, subagents and commands |
| `~/.claude/plugins/` | Installed plugins and added marketplaces |
| `~/.claude/keybindings.json` | Custom key bindings |

On Windows `~` is `%USERPROFILE%`. If you set `CLAUDE_CONFIG_DIR`, use that folder instead.

**Windows (PowerShell)**: close every Claude Code window first, then run:

```powershell
$b = "$env:USERPROFILE\.claude\backup-defaults-$(Get-Date -Format yyyyMMdd-HHmmss)"; New-Item -ItemType Directory $b | Out-Null
foreach ($p in 'settings.json','CLAUDE.md','rules','skills','agents','commands','plugins','keybindings.json') { $s = "$env:USERPROFILE\.claude\$p"; if (Test-Path $s) { Move-Item $s $b } }
"Moved to $b"
```

**macOS and Linux**: close every Claude Code window first, then run:

```bash
b="$HOME/.claude/backup-defaults-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$b"
for p in settings.json CLAUDE.md rules skills agents commands plugins keybindings.json; do [ -e "$HOME/.claude/$p" ] && mv "$HOME/.claude/$p" "$b/"; done
echo "Moved to $b"
```

Then start Claude Code. You stay logged in, with default settings and no plugins, rules or custom skills. To bring something back, move it out of the backup folder into `~/.claude`.

Two more places hold settings, if you want those reset too:

- **`~/.claude.json`** stores user-scope MCP servers, which folders you trust, and per-project state. Rename it to reset them. Claude Code then repeats its first-run questions, and you may need to sign in again.
- **Each repository** can have `.claude/settings.json`, `.claude/settings.local.json`, `.claude/rules/`, `CLAUDE.md`, `CLAUDE.local.md` and `.mcp.json`. These are part of that project, not of Claude Code. Remove the local ones (`settings.local.json`, `CLAUDE.local.md`) if you added them, and leave committed ones to the project's owners.

Organization-managed settings (`managed-settings.json`, set by an administrator) can't be reset this way, and they still apply.
