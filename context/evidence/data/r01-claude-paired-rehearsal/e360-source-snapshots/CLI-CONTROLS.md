# R01 subscription CLI controls and model selection

The [E359 control probes](../../context/evidence/experiments/e359-r01-cli-controls-and-model-selection.md)
implement isolated invocation settings, raw Codex request capture, usage audits,
seeded paired ordering and bounded repair accounting.
[E360](../../context/evidence/experiments/e360-r01-historical-haiku-cli-capture.md)
adds successful historical-Haiku capture and the operator's subscription-usage
instruction. **Neither CLI is admitted
to scored trials yet.** The remaining gates below are concrete findings, not
musical failures. The [protocol](TRIAL-PROTOCOL.md#subscription-cli-route) governs
the eventual frozen pilot; the retained order is only an offline development
rehearsal. Reserved Ghostworks passages remain unopened.

## Models comparable to the first research round

The [historical inventory](MODEL-HISTORY.md) distinguishes the decisive FIELDS/JSON
matrix from earlier exploratory and side-ledger rounds. Match the actual model
and reasoning controls first; matching words such as “low” across generations
does not establish equal capability or compute.

| Decisive historical configuration | Subscription CLI selection | Result and comparability |
|---|---|---|
| `gpt-5.4-mini-2026-03-17`, low reasoning, 12,000 completion ceiling | `codex exec --model gpt-5.4-mini-2026-03-17 -c 'model_reasoning_effort="low"'` | The ChatGPT endpoint explicitly rejected this model. API availability does not imply subscription availability. |
| Small OpenAI class replacement | `codex exec --model gpt-6-luna -c 'model_reasoning_effort="low"'` | One correct unscored control edit. A newer small-model comparison, not an exact historical replication; served identity and output ceiling remain unverified. |
| `claude-haiku-4-5-20251001`, thinking enabled with budget 1,024, initial output ceiling 12,000 | `claude -p --model claude-haiku-4-5-20251001 --settings '{"alwaysThinkingEnabled":true}'` with child environment `MAX_THINKING_TOKENS=1024` and `CLAUDE_CODE_MAX_OUTPUT_TOKENS=12000` | E360 verifies the exact served model and request settings, with a correct unscored edit. Closest historical bridge; client context still differs from the API round. Do not pass adaptive `--effort` for this profile. |
| `gemini-3.8-flash`, low thinking, 12,000 output ceiling | Neither selected CLI provides this provider | This route does not reproduce the three-provider historical matrix. A Gemini CLI investigation would be a separate task. |

The historical Claude continuation batches used a 24,000 output ceiling. That
change must remain visible when comparing old data; the new proposed profile
pins the initial 12,000 ceiling. Earlier Sonnet 5 runs do not replace Haiku in
the decisive matrix. Current Ghostnote FIELDS also differs from the older
grammar, so rerun current baseline arms alongside candidates within each new
model; do not pool old success rates into the new comparison.

OpenAI documents model selection with `--model` and account-dependent access in
its [model guide](https://learn.chatgpt.com/docs/models). The retained local
[catalog metadata](../../context/evidence/data/r01-cli-controls/codex-catalog.json)
and actual rejected request provide the account-specific evidence here.
Anthropic documents the dated Haiku 4.5 ID in its
[model configuration guide](https://support.claude.com/en/articles/11940350-claude-code-model-configuration).
Its [thinking controls](https://code.claude.com/docs/en/model-config) distinguish
fixed budgets from newer adaptive models. The optional current Haiku 5.5 profile
uses `--effort low`; it is a class comparison, not a translation of a 1,024-token
fixed budget. These short selection examples are **not complete trial commands**.

## Invocation and capture

The [profiles and invocation builder](../../brain/benchmarks/r01-candidates/cli-controls.mjs)
pin Codex **0.163.0** and Claude Code **2.1.302**. The
[probe driver](../../brain/benchmarks/r01-candidates/cli-control-probe.mjs) checks
the installed version and subscription authentication, creates a fresh scratch
directory, supplies a fixed synthetic task through stdin, and records the
command, explicit environment, prompt/system/source hashes, raw output and
process outcome. Each invocation has a 120-second ceiling and no wrapper
retry, repair or fallback. It refuses an existing output directory and removes
its scratch directory after retaining captures. It does not modify user
configuration or authentication files.

Child environments inherit an allowlist of account-location, process, proxy
and certificate variables. API keys, provider/model overrides and explicit
token environment variables are excluded. Authentication checks require ChatGPT
or first-party Claude subscription login. This prevents accidental API-key use;
it does not independently prove an account cannot charge subscription credits.

Codex disables exposed execution tools, apps/plugins, web search, project
instructions and skill discovery through pinned flags, and supplies an explicit
base instruction file. The recorded v2 request nevertheless includes global
AGENTS preferences, bundled skill descriptions, and tools nested in an
`additional_tools` input block, including execution and collaboration tools.
The auditor inspects both top-level and nested tool declarations.
`--ignore-user-config` and
`project_doc_max_bytes=0` do not remove those separate instruction sources.
The latest invocation adds `skills.include_instructions=false` and
`skills.bundled.enabled=false`, supported by the
[configuration schema](https://learn.chatgpt.com/docs/config-schema.json), but
these additions have **not** been live-verified. They do not solve global AGENTS
discovery; see the [documented discovery rules](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

`CODEX_ROLLOUT_TRACE_ROOT` in the pinned binary retained request/response payloads
and logical inference events. Treat this as a version-specific research hook,
not a stable public API. The audit requires actual artifacts; setting the
variable alone proves nothing. Payloads expose model-visible instructions,
tools, generation settings and usage, but their responses omit the served
model. Requested-model fields and local catalog entries cannot fill that gap.

Claude uses a replacement system prompt, safe mode, empty tool/MCP sets,
disabled settings sources and session persistence, and one model turn.
Child settings request zero retries and disable nonstreaming/refusal fallbacks.
The [environment reference](https://code.claude.com/docs/en/env-vars) and
[CLI reference](https://code.claude.com/docs/en/cli-reference) describe these
controls. Local raw-body capture uses `OTEL_LOG_RAW_API_BODIES=file:...` with
OpenTelemetry exporters set to `none`, following the
[monitoring guide](https://code.claude.com/docs/en/monitoring-usage).
The actual capture schema, request count, instruction composition and retry
visibility were inspected in E360. Its loader validates index references,
request/response identities, orphan files and final usage. One indexed request
and response were captured, with no tools, the exact requested model and fixed
thinking settings. One logical request does not prove transport-level retry
absence; that gate remains open.

The operator instructed us to proceed while they monitor subscription usage
and reported no added credits. The [actual reply](../../context/evidence/data/r01-cli-claude-controls/operator-context.json)
is retained without inferring that a setting is disabled. The driver no longer
requires disabled-credit confirmation; optional operator context is provenance,
not a billing gate. API-key exclusion and subscription authentication remain.
Usage and overage events stay in the audit, but do not independently reject
an attempt under this operator-monitored policy. No account setting was changed.

## Audit and accounting

The [control auditor](../../brain/benchmarks/r01-candidates/cli-control-audit.mjs)
separates exact answer correctness from experimental eligibility. It retains
process errors, logical request counts, model/reroute evidence, effective
generation settings, advertised tools, instruction-source metadata and usage.
Missing evidence fails the relevant gate. Claude capture validation now passes,
but its client-context policy and transport-retry evidence remain pending.
Codex likewise remains pending transport-retry control, even if a synthetic
transcript supplies a served model.

The captured Claude context includes three system blocks (billing metadata,
SDK identity and the supplied instruction) and five client-added reminders
(environment, model identity, token budget, account context and date). The
exact payload is retained and counted. Before pairing, freeze which client
blocks are allowed and which volatile fields can differ; unknown instructions
must not be silently admitted. Final model-usage metadata lists a 32,000-token
capability, but the actual request correctly sets `max_tokens:12000`; inspect
the request when checking the effective ceiling.

- Codex `input_tokens` includes `cached_input_tokens`; never add the latter
  again. Claude cache-read and cache-creation input categories are additive.
- Final provider counters are the authority for reported consumption. Keep
  raw cache/reasoning categories, error attempts, repairs and time separately.
- Full serialized request-context hashes and local `o200k_base` counts allow
  reproducible comparisons of delivered content. They are not the provider's
  tokenizer or wire accounting: the retained Luna request is 6,549 local
  serialized-context tokens versus 5,263 reported input tokens. Subtracting
  those figures does not measure hidden instruction overhead.
- Fresh sessions do not imply cold caches. Randomize arms within paired blocks
  and retain cache counters; compare formats within each pinned model first.
- One logical inference event is not proof of one HTTP attempt. The rejected
  built-in-provider retry configuration prevents claiming transport retries
  are disabled. E355's wrapper retry limit remains valid within that scope.

## Paired order and repairs

The [offline planner](../../brain/benchmarks/r01-candidates/cli-trial-plan.mjs)
hashes the development manifest and exact model/settings configurations. A
seeded shuffle randomizes task/repetition blocks and then arms within each
block, separately per model. It retains every exclusion and diagnostic label,
pins prompt/request/input-fact hashes, and rejects mismatched paired facts.

The [retained rehearsal](../../context/evidence/data/r01-cli-controls/development-order.json)
uses seed `r01-cli-controls-v1`, one repetition, the two proposed configurations
above, a 120-second attempt limit and at most two explicit correction turns.
It contains **152 initial attempts** (124 primary, 28 diagnostic), **46 explicit
exclusions**, and a **456-attempt maximum** if every eligible task used both
repairs. None of these scheduled attempts ran. The schedule neither authorizes
that run nor freezes the held-out pilot.

`createRepairState` / `recordAttempt` preserve every submitted outcome. Task
failure can receive an explicit correction within the cap; transport/control
failure stops immediately. Success or exhausted budget closes the sequence.
There is no executor that silently submits repairs. The eventual runner must
retain the same structured feedback and previous prompt/answer history for all
arms and count the entire correction context. Wrapper retry/fallback flags are
explicitly distinguished from underlying CLI behavior.

## Remaining gates and next action

1. Freeze and validate the Claude client-context policy and retry accounting.
   E360 completes its historical-model probe: exact model, budget, output cap,
   raw capture schema and usage are verified. Subscription limits are monitored
   by the operator and are not a prerequisite for these runs.
2. Resolve Codex's tool/global-instruction isolation, served-model evidence,
   transport retries and effective output cap. Do not solve this by changing
   the operator's global files or silently relaxing the admission rules.
3. Connect eligible captures to the development scorer and explicit repair
   loop, then rehearse a small paired development block. A correct standalone
   two-note edit does not establish that end-to-end runner path.
4. Freeze model availability, selected tasks, actual attempt count, settings
   and stop rules before the held-out pilot or reserved-note access.

The historical OpenAI snapshot cannot be used through the tested subscription
route. The working recommendation is exact historical Haiku where admitted,
with Luna as a separately labeled newer small-model cohort. No provider is
silently substituted after a failure.
