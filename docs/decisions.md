# Decisions

Generated from `registry/components/*.json` by `node engine/ep.mjs evidence render`; edit the registry, not this file.
Verdicts follow the admission rules in [docs/v8/03-admission-ledger.md](v8/03-admission-ledger.md). Tokens are estimates (bytes / 3.5).

## Adopt

| Component | On by default | Always-loaded tokens | Evidence | Kill test | Revisit when |
| --- | --- | --- | --- | --- | --- |
| Leave native defaults alone (`native-defaults`) | yes | 0 | E2 vendor, quality measured (Unknown); E4 none (Verified) | - | a user's own bench shows lower effort non-inferior at lower cost: offer it as a personal setting |
| Precedence sentence (`precedence`) | yes | 25 | E1 independent, quality measured (Verified) | - | a replication on current models finds no effect |
| Same-job overlap check in verify (`same-job-check`) | yes | 0 | E1 independent, quality measured (Verified); E1 independent, quality measured (Verified) | - | agents rank or dedupe skills natively |

## Trial

| Component | On by default | Always-loaded tokens | Evidence | Kill test | Revisit when |
| --- | --- | --- | --- | --- | --- |
| A/A batch for the noise floor (`aa-batch`) | no | 0 | E4 vendor, quality measured (Verified) | K-AA | K-AA result |
| Auto-compact window cap (`autocompact`) | no | 0 | E4 independent (Inferred) | K-AUTOCOMPACT | K-AUTOCOMPACT result; a change to the default window |
| Project command map (`command-map`) | yes | 100 | E1 independent, quality measured (Inferred) | K-CMDMAP | K-CMDMAP result |
| Compact instructions (`compact`) | yes | 80 | E4 independent (Inferred) | K-COMPACT | K-COMPACT result; native compaction keeps constraints verbatim |
| Concise output style (`concise`) | no | 0 | E2 independent, quality measured (Inferred); E2 vendor, quality measured (Inferred) | K-CONCISE | K-CONCISE result |
| Context7 docs lookup (`context7`) | no | 60 | E4 none (Assumption) | K-CONTEXT7 | K-CONTEXT7 result; the agent ships version-aware docs lookup |
| Firing-rate audit (TokenEconomizer idea TE-T4) (`firing-rate-audit`) | no | 0 | E4 none (Assumption) | K-TE-T4 | K-TE-T4 result |
| Loop signal (TokenEconomizer idea TE-T3) (`loop-signal`) | no | 0 | E4 none (Assumption) | K-TE-T3 | K-TE-T3 result |
| Official LSP plugins (`lsp`) | yes | 0 | E4 none (Assumption) | K-LSP | K-LSP result; a new official LSP plugin |
| Verify nudge (`nudge`) | no | 0 | E4 none (Assumption) | K-NUDGE | K-NUDGE result |
| claude plugin eval in CI for v8's skills (`plugin-eval-ci`) | no | 0 | E4 none (Verified) | K-EVALCI | K-EVALCI result |
| Ponytail (`ponytail`) | no | 1100 | E2 vendor, quality measured (Verified); E1 independent, quality measured (Verified); E5 user-generated, quality measured (Verified) | K-PONYTAIL | a new Ponytail release; K-PONYTAIL result; 2027-02-01 |
| retok (accounting cross-check) (`retok`) | no | 0 | E4 none (Verified) | K-RETOK | K-RETOK result |
| Working rules (`rules`) | yes | 225 | E4 none (Assumption); E1 independent, quality measured (Verified) | K-RULES | K-RULES result |
| Security-rule lint in verify (`security-rule-lint`) | yes | 0 | E4 independent (Verified) | K-SECLINT | K-SECLINT result |
| Repeated tool-error mining (TokenEconomizer idea TE-T2) (`tool-error-mining`) | no | 0 | E4 none (Assumption) | K-TE-T2 | K-TE-T2 result |
| Tool and MCP pruning, propose-only (TokenEconomizer idea TE-T1) (`tool-pruning`) | no | 0 | E4 none (Assumption) | K-TE-T1 | K-TE-T1 result |
| One-line minimal-change rule (`yagni-line`) | no | 35 | E5 user-generated, quality measured (Inferred) | K-PONYTAIL | K-PONYTAIL result |

## Assess

| Component | On by default | Always-loaded tokens | Evidence | Kill test | Revisit when |
| --- | --- | --- | --- | --- | --- |
| claude-token-efficient (`claude-token-efficient`) | no | 101 | E5 vendor (Verified) | - | beats Concise on the maintainer bench |
| frontend-design (official plugin) (`frontend-design`) | no | 0 | E4 none (Assumption) | - | the bench gains a UI grader |
| Harbor task format export (`harbor-export`) | no | 0 | E4 none (Verified) | - | a user asks for it |
| Bench tasks exported as claude plugin eval cases (`plugin-eval-export`) | no | 0 | E4 none (Verified); E4 none (Verified) | - | a user asks for it; the runner gains intervals and native Windows support |
| Mandatory reviewer-agent rules (`reviewer-rules`) | no | 0 | E4 independent (Verified) | - | - |
| Anytime-valid sequential stopping (`sequential-stopping`) | no | 0 | E4 none (Assumption) | - | - |
| Trace-driven tuning loops (`tuning-loops`) | no | 0 | E4 author (Verified) | - | an independent replication saving 15% or more at non-inferior quality |

## Hold

| Component | On by default | Always-loaded tokens | Evidence | Kill test | Revisit when |
| --- | --- | --- | --- | --- | --- |
| benjamin-plus (`benjamin-plus`) | no | 745 | E2 vendor, quality measured (Verified); E2 vendor, quality measured (Verified) | - | an independent paired result; a Codex maintainer bench win |
| Caveman (plugin) (`caveman`) | no | 1000 | E1 independent, quality measured (Verified); E2 vendor, quality measured (Verified); E5 vendor (Verified); E5 user-generated (Verified); E4 none (Verified) | - | an independent paired test shows lower cost per accepted task than Concise |
| Code-graph indexers (codegraph, Graft) (`code-graph-indexers`) | no | 0 | E5 vendor (Verified); E2 vendor, quality measured (Unknown); E4 none (Unknown) | - | independent paired evidence on Claude Code |
| Context Mode (`context-mode`) | no | 0 | E4 none (Verified); E4 none (Unknown); E4 none (Verified) | - | a user's dominant MCP server isn't covered by native caps |
| ECC and other large packs (`ecc`) | no | 33456 | E4 maintainer (Verified) | - | an independent paired quality-and-token result for the pack |
| OptScale Kompressor (`kompressor`) | no | 0 | E2 vendor, quality measured (Verified) | - | ships without a proxy, with independent evidence |
| Path-scoped rules for owned text (`path-scoped-rules`) | no | 0 | E5 user-generated (Verified); E5 user-generated (Verified); E5 user-generated (Verified) | - | a sentinel test on the installed version: the rule is absent at session start and present after reading, editing and creating a matching file |
| security-guidance (official plugin) (`security-guidance`) | no | 0 | E5 user-generated (Unknown) | - | its Windows issues are closed |
| Superpowers (`superpowers`) | no | 1900 | E1 user-generated, quality measured (Verified); E5 user-generated (Verified); E4 none (Verified) | - | an independent paired result on Claude Code for v7 or later |
| Usage dashboards and statuslines (`usage-dashboards`) | no | 0 | E4 none (Unknown) | - | native reports lose per-session detail |

## Reject

| Component | On by default | Always-loaded tokens | Evidence | Kill test | Revisit when |
| --- | --- | --- | --- | --- | --- |
| Cache keepalives and warmers (`cache-keepalives`) | no | 0 | E4 none (Verified); E5 user-generated (Unknown) | - | a native regression shown by a paired test |
| Caveman CLI, proxy and cloud router (`caveman-cli`) | no | 0 | E4 none (Verified); E4 none (Verified) | - | - |
| Shipping a Claude mod (`claude-mod`) | no | 0 | E4 none (Verified); E4 none (Verified) | - | - |
| Headroom (`headroom`) | no | 0 | E5 vendor (Verified); E5 vendor (Verified); E2 vendor, quality measured (Verified); E5 vendor (Verified) | - | an independent paired test with lower cost per accepted task, with nothing in the request path |
| lean-ctx (`lean-ctx`) | no | 0 | E5 vendor (Verified) | - | - |
| TokenEconomizer LLM judge and micro-skill proposer (`llm-judge`) | no | 0 | E4 none (Inferred) | - | - |
| Permission allowlists to cut prompts (`permission-allowlists`) | no | 0 | E4 none (Verified); E4 none (Verified) | - | auto mode stops being the default |
| Proxies and gateways (`proxies`) | no | 0 | E4 none (Verified); E4 none (Verified); E4 none (Verified) | - | - |
| RTK (`rtk`) | no | 0 | E1 independent, quality measured (Verified); E2 vendor, quality measured (Verified); E2 vendor, quality measured (Unknown); E5 user-generated (Verified); E5 user-generated (Verified); E5 user-generated (Verified); E4 none (Verified) | - | an independent paired test with at least 5% lower cost per accepted task at non-inferior quality, including the PowerShell tool |
| Serena (`serena`) | no | 0 | E4 none (Inferred) | - | independent paired evidence on Claude Code |
| squeez (`squeez`) | no | 0 | E5 vendor (Verified); E4 none (Unknown) | - | - |
| token-optimizer (alexgreensh) (`token-optimizer`) | no | 0 | E4 none (Verified); E5 vendor (Unknown) | - | - |
| TokenEconomizer (as a bundle) (`tokeneconomizer`) | no | 0 | E2 vendor, quality measured (Verified); E2 vendor, quality measured (Unknown); E4 none (Verified) | - | independent replication with intervals on its shipped default |
