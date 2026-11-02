# 09. Evaluation plan

Status: draft for review, 2026-11-01. Three things get evaluated: components (does X help on this user's tasks), v8 itself (is it cheaper and more reliable than v7), and the engine's correctness (fixtures and unit tests, specified in [04-requirements.md](04-requirements.md)). This file covers the first two.

Why personal measurement: public leaderboards rank harness choices unstably for a given deployment (predictive-validity study, HF 2606.19704, 2026-06), and the effect of a harness component depends on model and task mix (empirical harness study, HF 2609.20804, 2026-09). So the user's own history is the test set, and every verdict says who measured it and where.

## Bench v2 (successor of `/paired-check`)

### Tasks

A task is a base commit, a reference commit, a prompt, hidden acceptance files and acceptance commands, mined from the user's repository history (merged commits or PRs that touched tests).

- **Prompt style.** Short and casual, stating the wanted behavior and why, like a real request (RealSWE, HF 2608.27831, 2026-08). The prompt never names files from the reference diff unless a real user would.
- **Hidden acceptance.** Test files from the reference commit are copied in only after the run.
- **Prepare and acceptance commands** are given by the user when tasks are drafted, and shown again before every `validate` and `run`, which go on only when the user types back the code they print (M-9).

### Admission gates (a task enters the set only if all pass)

| Gate | Check | Source |
| --- | --- | --- |
| G1. History-free | A clone at the base commit contains no later objects, refs or reflog entries | v7 `historyFree` |
| G2. Fails at base | Acceptance fails with no change (null arm) | v7 `failsAtBase`; SelfBench "nop" |
| G3. Passes at reference | Acceptance passes with the reference diff applied (oracle arm) | v7 `passesAtReference`; SelfBench "oracle" |
| G4. Deterministic | Base fails 3 of 3 runs and reference passes 3 of 3; otherwise the task is flaky and dropped | SelfBench "determinism" (mupt-ai/self-bench, release prod-20261101-6cb6593, 2026-11-01) |
| G5. Review (optional) | An independent reviewer (a different model family when available) checks that the prompt doesn't leak the solution and that acceptance isn't trivially gameable | Independent critics did best among verification strategies (HF 2610.34577, 2026-10) |

### Arms and isolation

An arm is a named configuration. Two ways to define one, in order of preference:

1. **Overlay arm.** Base configuration plus an overlay (extra settings file, plugin directory, appended instructions) passed through the agent's per-run flags, so the user's live configuration is never edited. The exact flags are listed in 06 once confirmed on current releases (P0 kill test K-ARMS).
2. **Live arm** (v7 behavior). The user switches configuration between batches; the engine records a fingerprint per run and refuses to pool runs whose fingerprints differ.

Every run records a fingerprint: agent and version, model (as the transcript reports it, since a configured model can be silently overridden), effort, permission mode, settings hash per scope, enabled plugins with versions, owned content hashes, and environment flags that change behavior (including privacy variables that switch off flag-gated features).

**Delivery check.** Each run confirms that its arm actually took effect: the arm's rule text is in the loaded context, its plugin is enabled at the recorded version, its hooks fired, and content the arm excludes is absent (`--setting-sources project` still loads user memory on 2.1.312: CC#87590). A run whose arm didn't deliver is excluded and reported, never counted as a result for that arm.

**Same starting state.** Every arm starts with auto memory off, a fresh session and no state persisted from earlier runs, because auto memory is on by default and would carry lessons from one arm into the next. Tasks used to tune a configuration are tagged `tuning` and never used to judge it.

**Reference arms.** A component must beat cheap alternatives, not only "nothing":

- **Lower effort.** The same configuration at a lower effort setting. In TokenEconomizer's vendor-run study, medium effort alone cut cost 16.8 to 28.9% at a 1.8 to 4.7 point pass-rate loss (arXiv 2610.22732, 2026-10-15). A component that doesn't beat lower effort at equal quality isn't worth its complexity.
- **One-line rule.** For rule-injecting components, a one-sentence instruction with the same intent. A user-run comparison found Ponytail 4.x cost 6.9% more than a one-sentence prompt asking for a runnable check, and about the same as no add-on, +0.7% [−6.5, +9.8] (ponytail issue #685, 2026-08-04; user-generated, single report).

### Run protocol

- More tasks beat more repeats: the default is at least 8 tasks with `k = 2` runs per arm (8 × 2 rather than v7's 5 × 3). Arms are interleaved per task in a balanced order (A B B A on one task, B A A B on the next) so time-of-day drift falls on both arms equally. In an unchanged control, JetBrains measured a cost drift of +10.5% (median; +20.5% on totals) between runs on 2026-08-15 and 2026-08-16 (vendor-run), enough to fake a result when arms run in separate batches as v7's do.
- Every run gets its own clone path, and the first request's cache-read tokens are logged. Claude Code can reuse a cached prompt prefix between back-to-back sessions in the same folder with the same starting state, so with v7's shared clone path the second arm could look cheaper because of order alone (inferred from the prompt-caching docs, not measured; the A/A batch would show it).
- Before any run, `ep bench plan` shows the minimum detectable effect for the chosen size and the maximum spend (tasks × arms × k × per-run cap), and the user confirms both.
- Optional A/A batch: the same arm run twice as if it were two arms, to see the noise floor on this machine and repository before trusting an A/B result (Trial K-AA).
- Per-run limits: `--max-turns`, `--max-budget-usd`, wall-clock timeout, fixed before the run. There is no early abort of runs that look like they're failing: predicting a run's failure from its early steps did no better than chance in a recent study (arXiv 2610.35971, 2026-10).
- Refuses to run inside an agent session (`CLAUDECODE` set) and refuses API-key or custom-endpoint billing unless `--allow-api-billing` is passed (v7 rules, kept).
- Headless Claude Code runs skip the workspace-trust prompt (whether `codex exec` applies Codex's trust checks is unverified), so repository settings hooks, environment entries, helper commands and MCP servers would apply without approval. Before every `validate` and `run`, the bench lists what will execute and goes on only when the user types back a fresh code from that listing at a terminal; nothing is remembered (M-9).
- Codex arms run through `codex exec --json`. Its usage is cumulative per thread, so the engine reads the last `turn.completed` usage (input, cached input, cache-write input, output, reasoning); there is no cost field, so cost comes from the price table. Codex finds `~/.agents/skills` through the home folder, not `CODEX_HOME`, so each Codex arm gets its own home folder and `CODEX_HOME` (Codex 0.166.0 source). An isolated home has no login, so Codex arms use API-key auth and run only with `--allow-api-billing`; the engine never copies `auth.json`.
- Headless hygiene for every arm: a fresh session per run, no session persistence, an identical explicit MCP configuration in all arms (Claude Code: `--strict-mcp-config` with an explicit `--mcp-config`), and a recursion-guard environment variable. TokenEconomizer's helper calls cost about 40 times more than intended when every MCP server attached to a headless call (its issue #87, fixed 2026-10-30).

### Metrics per run (`results.jsonl`, one line per run)

A `started` line goes in before each paid run and counts at the per-run spend cap until its result line follows, so a run that was killed or interrupted is never counted as free. The result line holds: task, arm, repetition, fingerprint, delivery-check result, pass, tokens by type (input, cache read, 5-minute and 1-hour cache writes, output) and by model (subagents included), API-price estimate (labeled), turns, duration, exit status, lines changed, diff size relative to the reference patch (over-building shows up here; arXiv 2608.13292), and tool-action flags (writes outside the clone, network commands, deleted tests) because a correct result can hide unsafe steps (HF 2605.14271, 2026-05).

Failed, timed-out and capped runs count with everything they spent, up to the run cap; dropping them would make an arm that fails expensively look cheap. Usage-limit errors and infrastructure failures are recorded as missing data, not as task failures, and the report says how many there were. A headless process still alive after its final result record (CC#103116) is stopped and scored on that result.

Cost accounting rules:

- Deduplicate usage records by message id (the stream output and transcripts repeat a message's usage across content blocks), and include subagents' records.
- Price with a dated, per-model table in the registry, including cache-read multipliers and one-hour cache writes. As read on 2026-11-01, Anthropic lists cache reads at 0.05x input for Opus 5.5 and Sonnet 5.5 and 0.025x for Fable and Mythos 5.1, and one-hour cache writes at 2x. TokenEconomizer's flat 0.10x assumption skews savings on those models. An unknown model id is an error, never a fallback price.
- Charge a component's own helper model calls to its arm.

### Statistics

- **Primary outcomes:** pass rate, and cost per accepted task = API-price-weighted cost of everything spent on a task in an arm, including failed attempts, divided by accepted runs. The headline is cost, not raw tokens: in one public data set cache reads were 96.4% of tokens but 54.8% of cost, and output was 1.0% of tokens but 27.0% of cost. Token counts by type are shown next to it.
- **Per-task view first:** the cost ratio per task (arm B over arm A), summarized by the geometric mean, the median and a sign count (how many tasks got cheaper). Pooled ratios (total B over total A) let one large task dominate and are not used for decisions.
- **Pairing and intervals:** paired by task. With at least 8 to 10 tasks, cluster bootstrap over tasks (resample tasks with all their runs, 10,000 resamples), percentile 95% intervals for the pass-rate difference and the geometric-mean cost ratio. With fewer tasks the report shows per-task results and the sign count only, and says that no interval is reliable at that size (with 5 tasks, the smallest possible exact p-value is 0.0625).
- **Decision rule, fixed before the run:** an arm "wins" when the cost-ratio interval lies entirely below 1 and the pass-rate difference interval lies entirely above `−δ` (non-inferiority margin, default δ = 5 percentage points). If either interval crosses its bound, the result is `inconclusive`. The report never uses the word "significant". v7's rule (any drop in passes rejects the change) would reject 20 to 39% of changes that do no harm when one or two of its five tasks are flaky, passing 50 to 90% of runs (our calculation: with 3 runs per arm, each arm's passes on m flaky tasks with pass rate q follow Binomial(3m, q), so the changed arm passes fewer with probability (1 − Σₖ P(X = k)²) / 2), which is why it is replaced.
- **Confirmation:** a `wins` result that would change a default is re-run once on fresh runs of the same tasks before the registry verdict changes.
- **Secondary metrics** (turns, duration, lines changed, diff size, flags) are descriptive only; no decision is taken on them.
- **Sample-size helper:** `ep bench plan` estimates the minimum detectable effect from a pilot's per-task variance: MDE ≈ (1.96 + 0.84) × sd(per-task difference) / √n. It tells the user how many tasks a conclusive answer would need, before money is spent. As a rough guide from v7-sized pilots (our calculation, not a measurement): 5 tasks × 2 runs can detect only cost changes of about 34 to 46%, 8 × 2 about 25 to 35%, and a 10% change needs roughly 19 to 41 tasks × 5 runs. Most single-user benches will therefore end `inconclusive` for small effects, and the report says so rather than implying there is no effect. Small samples also flip signs: one public comparison of Ponytail measured +9.6% cost on a 10-task smoke run and −10.3% cost on 80 tasks (BenchKeeper #19, user-generated, restating JetBrains' staged runs).
- **Reliability:** pass^k (all k repetitions pass) per arm, reported alongside pass rate.
- **No peeking:** one analysis at the end. An optional single interim look exists only with a pre-declared stricter threshold.

### Report

A table per arm (passed, cost per accepted task with interval, median tokens per run, median lines changed, flags), the decision-rule outcome in one line, and a cost-versus-pass-rate scatter marking non-dominated arms (Pareto view). Cost is labeled "API-price estimate"; subscription plan usage is not inferred.

### Validity threats, stated in every report

Small task counts; tasks mined from one repository may not represent future work; public repositories may be in the model's training data; model updates between runs (fingerprints catch version changes, not silent server-side changes); prompt-cache state and cache lifetimes (subagents and compaction use a shorter cache lifetime than the main conversation); infrastructure noise (the A/A batch measures it); tests are a partial definition of quality (G5 and the review flag help); requirements in real work evolve after the first attempt (HF 2610.35488, 2026-10), which this bench does not model. Public coding benchmarks have their own validity problems (OpenAI stopped reporting SWE-bench Verified in February 2026 and in July 2026 called about 30% of SWE-bench Pro tasks broken), which is one more reason the user's own tasks are the test set.

**Native plugin evals are a different instrument.** `claude plugin eval` loads only the plugin under test (no user settings, instruction files, other plugins or memory), runs 3 times per arm and reports no uncertainty. It is useful in CI for v8's own skills (Trial K-EVALCI) but can't answer "does this help in my setup"; bench v2's overlay arms run on the user's real configuration for that.

## Component admission protocol

How a registry verdict is set or changed (ledger rules in [03-admission-ledger.md](03-admission-ledger.md)):

| Evidence tier | Meaning | Can support |
| --- | --- | --- |
| E1 | Independent paired measurement with quality measured, method public | Adopt |
| E2 | Vendor or author measurement with method public, quality measured | Adopt only with a passing maintainer bench run; labeled vendor-run |
| E3 | Maintainer reference bench (public fixture tasks, fingerprints published) | Trial to Adopt |
| E4 | Mechanism argument or documentation only | Trial or Assess |
| E5 | Anecdote, forum or social posts | Assess at most; corroborate from a primary source |

The maintainer reference bench is a public task set from this repository's history plus a few permissively licensed open-source repositories, run on Windows and Linux before any verdict changes. Results go into the registry entry with date, fingerprint and the label "maintainer-run".

## Evaluating v8 itself

| Question | Method | Pass bar |
| --- | --- | --- |
| Is setup cheaper? | Run v7.3 setup and v8 setup on the same Windows VM snapshot with the same sample repo and the same answers, 5 times each; compare total session tokens (all models) | v8 median at most one third of v7.3 (N-2) |
| Is setup reliable? | 20 fixture variations (empty config, v7 installed, edited v7 files, conflicting plugins, managed policy, cloud-synced home, non-ASCII user name, PowerShell 5.1 only, Git Bash only, only one of the two agents installed, a monorepo started from a package folder) | `verify` passes after every apply; zero unconsented writes; zero lost user edits |
| Do scopes behave as specified? | The acceptance tests in [07-install-scopes.md](07-install-scopes.md) | All pass on windows, ubuntu and macos CI |
| Is the report short and accurate? | Review of 10 setup transcripts against the engine's own plan and journal | Report at most 15 lines; no row in the report missing from the journal or vice versa |
| Does the default configuration still pay for itself? | Maintainer reference bench, v8 default arm versus agent defaults, quarterly and after major agent releases | Decision rule above: not inferior on pass rate, cost ratio below 1, or the component loses its Adopt verdict |
