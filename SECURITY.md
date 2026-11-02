# Security policy

## Reporting a vulnerability

Report it privately through GitHub: the repository's **Security** tab, then **Report a vulnerability**. If that button isn't there, open an issue that only asks for a private contact, with no details. Please don't describe the problem in a public issue. This is a one-maintainer project, so replies are best effort. Fixes ship as a new release, and the advisory names the first fixed version.

Only the latest release is supported. Pin a tag if you need to stay on one; see the README.

## What counts

The engine edits agent configuration on your machine, so these are in scope:

- a write outside the scope's allowed paths: the agent's config folder and the state folder for user scope, the repository plus the state folder for project and local scope;
- opening or printing a credential file, or a secret in any output;
- an apply that the journal can't undo, or an uninstall that leaves owned bytes behind;
- `bench` running repository or arm configuration (hooks, MCP servers, scripts, task commands) that its listing didn't show, or running anything before its printed code was typed back;
- any network call that the registry doesn't list as the component's egress;
- a skill that loads into the model's context without being typed (they're all explicit-only).

Out of scope: what third-party plugins do after you install them (the registry records their verdicts and egress, but doesn't sandbox them), and anything that needs an attacker who can already write to your config folder.

The design and threat model are in [docs/v8/10-threat-model.md](docs/v8/10-threat-model.md).

## EU Cyber Resilience Act

Position as of 2026-11-02: this project is free, MIT-licensed software that is developed and published outside any commercial activity. There's no paid version, paid support or monetized service. So the maintainer reads it as outside the scope of Regulation (EU) 2024/2847, and the maintainer as neither a manufacturer nor an open-source software steward under it. This is the maintainer's reading, not legal advice.

The maintainer will reassess this position, and update this section, if:

- the plugin, support for it, or a service built on it is offered for payment or monetized in another way;
- it's published or maintained on behalf of a company, as part of that company's commercial activity;
- a legal person begins to steward it systematically for commercial use;
- the European Commission's guidance or the Act's application changes what counts as a commercial activity for free software.

Until then, the reporting channel above is the way to report vulnerabilities.
