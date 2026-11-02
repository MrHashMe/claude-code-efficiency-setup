---
description: Check the efficiency setup for drift, duplicate or oversized instructions, missing tools and unreadable managed settings, and explain each finding with its fix. Changes no configuration. Run only when the user types /efficiency-playbook:verify.
argument-hint: "[user|project|local]"
disable-model-invocation: true
---

Arguments: $ARGUMENTS

Run `node "${CLAUDE_PLUGIN_ROOT}/engine/ep.mjs" verify --deep --scope <scope> --json` for the scope in the arguments. With none, run it for user scope, plus project and local scope when an entry of `show --installs --json` has folders inside this repository (the list covers every repository). `--deep` also asks each code-navigation tool to answer `--version`. Verify changes no configuration file. With the nudge installed, it refreshes the nudge's summary in the engine's state folder, and that's all it writes. This skill changes nothing.

Then:
1. Explain the `error` and `warn` findings first, then `info`, each in one or two plain lines: what it means here and the fix. Name files the way the finding names them.
2. Drift (EP-DRIFT-EDITED, EP-DRIFT-MISSING): offer both ways out. To keep the user's edit, do nothing; the next setup shows the file as a conflict and leaves it unless the user picks it. To put the owned version back, run /efficiency-playbook:setup and pick that row.
3. Instructions that cost tokens twice or load too much (EP-DUPLICATE-BLOCK, EP-PACK-PRESENT, EP-ANCESTOR-INSTRUCTIONS, EP-SIZE-CAP): give the token cost the finding reports and the fix it names, such as a `claudeMdExcludes` entry. For files the engine doesn't own, give the user the edit to make; don't make it.
4. Report-only findings (EP-HIDDEN-UNICODE, EP-SECURITY-RULE-UNENFORCED): name the file and say why it matters. For a prose security rule, suggest the permission rule or setting that would enforce it.
5. Policy (EP-POLICY-UNREADABLE): a managed settings file couldn't be read, so what it allows is unknown. Name the file, and say that the organization's managed settings win and only an administrator can change them.
6. Machine facts (agent version, a missing tool): say what to install or update, with a user-level command where there is one.
7. End with one line: clean, or the number of problems and the first one to fix.

If the user asks what is installed, run `show --scope <scope> --json`. It lists each owned item with its status (ok, edited, missing) and where its value comes from.
