# R01 subscription CLI controls and model selection

The [E359 control probes](../../context/evidence/experiments/e359-r01-cli-controls-and-model-selection.md)
implement isolated invocation settings, raw Codex request capture, usage audits,
seeded paired ordering and bounded repair accounting.
[E360](../../context/evidence/experiments/e360-r01-historical-haiku-cli-capture.md)
adds successful historical-Haiku capture and the operator's subscription-usage
instruction. [E361](../../context/evidence/experiments/e361-r01-claude-controls-and-paired-rehearsal.md)
closes the Claude context and transport-retry gates and rehearses the paired
runner. **Luna is admitted under the pinned Codex 0.163.0 context policy**
([E363](../../context/evidence/experiments/e363-r01-codex-luna-admission.md)).
Historical Haiku remains admitted for development rehearsal. **Haiku 5.5 is
admitted under context policy v2**
([E364](../../context/evidence/experiments/e364-r01-haiku55-admission.md));
its effort is calibrated to `low` ([E365](../../context/evidence/experiments/e365-r01-haiku-effort-calibration.md)). No pilot
trial has run; the rigorous stage still needs a freeze
([trial stages](PILOT-DRAFT.md#trial-stages)). Reserved passages remain unopened.

E362 established isolated-home suppression of global AGENTS and skills.
D57 removes the hard output-ceiling requirement; D58 moves retries into reporting.
E363 implements the remaining fixed context policy and verifies the normal
runner with a fresh, correct, admitted Luna edit.

<a id="subscription-model-selection"></a>

[D55](decisions/d55-r01-luna-model-selection-evidence.md)
relaxes model admission for Luna on Codex 0.163.0: captured
matching requests, successful completion and no observed reroute or conflicting
model evidence suffice. The audit reports `modelSelectionPass` independently
of `modelVerified`; missing server attestation remains visible. Claude retains
the matching served-model requirement. Earlier evidence records retain the
policy in force when they were written.

[D56](decisions/d56-r01-codex-reject-tool-use.md) subsequently
allows unused Codex tool declarations as fixed, accounted context. Any tool
invocation attempt still fails admission. E363 implements the context allowlist;
arbitrary client instructions and tool-definition drift still fail admission.

## Models comparable to the first research round

The [historical inventory](MODEL-HISTORY.md) distinguishes the decisive FIELDS/JSON
matrix from earlier exploratory and side-ledger rounds. Match the actual model
and reasoning controls first; matching words such as “low” across generations
does not establish equal capability or compute.

| Decisive historical configuration | Subscription CLI selection | Result and comparability |
|---|---|---|
| `gpt-5.4-mini-2026-03-17`, low reasoning, 12,000 completion ceiling | `codex exec --model gpt-5.4-mini-2026-03-17 -c 'model_reasoning_effort="low"'` | The ChatGPT endpoint explicitly rejected this model. API availability does not imply subscription availability. |
| Small OpenAI class replacement | `codex exec --model gpt-6-luna -c 'model_reasoning_effort="low"'` | Correct unscored edits; model selection passes D55 without independent server attestation. A newer small-model comparison, not an exact historical replication; other admission gates remain open. |
| `claude-haiku-4-5-20251001`, thinking enabled with budget 1,024, initial output ceiling 12,000 | `claude -p --model claude-haiku-4-5-20251001 --settings '{"alwaysThinkingEnabled":true}'` with child environment `MAX_THINKING_TOKENS=1024` and `CLAUDE_CODE_MAX_OUTPUT_TOKENS=12000` | E360 verifies the exact served model and request settings, with a correct unscored edit. Closest historical bridge; client context still differs from the API round. Do not pass adaptive `--effort` for this profile. |
| `gemini-3.8-flash`, low thinking, 12,000 output ceiling | Neither selected CLI provides this provider | This route does not reproduce the three-provider historical matrix. A Gemini CLI investigation would be a separate task. |

The historical Claude continuation batches used a 24,000 output ceiling. That
change must remain visible when comparing old data; the new proposed profile
uses client-default output limits under D57. Earlier Sonnet 5 runs do not replace Haiku in
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
and certificate variables. Codex overrides `CODEX_HOME` with a fresh private
directory containing only a copy of file-backed ChatGPT authentication, removed
with the scratch directory after each attempt. No configuration, instructions
or skills are copied; keychain-only auth is not supported by this helper.
API keys, provider/model overrides and explicit
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
The current invocation uses `skills.include_instructions=false` and
`skills.bundled.enabled=false`, supported by the
[configuration schema](https://learn.chatgpt.com/docs/config-schema.json).
E362 verifies that these flags together with an isolated `CODEX_HOME` suppress
skills and global AGENTS. Stronger experimental flags remove collaboration
tools but leave four function tools advertised. E363 promotes those controls
into the normal invocation and pins the remaining team/environment context
in the versioned policy. See the [documented discovery rules](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

In that stronger capture the four remaining tools are `functions.exec`
(JavaScript execution), `functions.wait` (resume an execution),
`functions.request_user_input` (Plan-mode questions), and
`functions.request_user_input_async` (asynchronous questions). Correction to
E362's tool-summary sentence: nested patch/resource/clock descriptions occur
in the baseline isolated capture, **not** the stronger namespace-exclusion
capture. The stronger capture retains generic executor documentation but no
named nested helper declarations. Neither probe executed tools.

Under D56, the current Codex experiment requires **no tool use**; unused
advertised tools no longer fail admission by themselves. Any invocation,
including a failed or blocked call, rejects the submission. This prevents
code-assisted arithmetic/validation, external information and user answers
from changing the task's capabilities. The auditor checks request/response
call items, stdout and raw trace execution events, so a plain final answer
cannot hide earlier calls. Separately, the context policy must enumerate allowed
client blocks, preserve exact task bytes, account for their context cost and
permit only specified variable fields. It does not require an empty client
prompt: Claude already admits known reminders. E363 supplies that policy for
Codex's team-role/mode text and environment block. These requirements
support equal capabilities and known instructions across arms within a cohort.

`CODEX_ROLLOUT_TRACE_ROOT` in the pinned binary retained request/response payloads
and logical inference events. Treat this as a version-specific research hook,
not a stable public API. The audit requires actual artifacts; setting the
variable alone proves nothing. Payloads expose model-visible instructions,
tools, generation settings and usage, but their responses omit the served
model. Requested-model fields and local catalog entries do not establish
independent served identity; D55 accepts request-based selection for the
pinned Luna cohort without filling that observability gap.

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
thinking settings.

One logical request alone does not prove transport-level retry absence. E361's
[local fault suite](../../brain/benchmarks/r01-candidates/claude-transport-faults.mjs)
runs the pinned binary against a loopback fake endpoint: under the trial
settings, HTTP 500/529/429 and connection resets each produce one HTTP attempt
and one captured request file, while positive controls with one permitted retry
produce two of each and an `api_retry` stream event. D58 makes this historical
evidence optional reporting; it is no longer an admission prerequisite. The
suite uses a dummy API key, not the OAuth route.
Stream-idle and stale-connection paths were not exercised.

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
Missing required model, settings, context or usage evidence fails its gate.
Every captured request is checked. Claude also requires validated capture.

The **retry policy** follows
[D58](decisions/d58-r01-retries-are-reporting.md). Retries,
recovered errors and client fallback notices are reported, not disqualifying.
A final successful answer remains eligible after normal model self-correction.
Report captured request/response counts, inference failures, notices, elapsed
time and client-reported usage. HTTP-attempt totals are unknown without direct
measurement; reported tokens may omit interrupted or retried generation.
Actual model switching, terminal failure, tool use and unexpected context
remain failures. Explicit scorer-guided corrections after a submission still
use the two-correction budget. The wrapper itself does not retry.

The [Codex context policy](../../brain/benchmarks/r01-candidates/codex-context-policy.mjs)
`r01-codex-context-policy-v2` pins the complete model-visible request template:
the four function declarations, base instruction, team-role instruction,
no-proactive-delegation instruction, environment block and exact task bytes.
Only message/turn IDs, creation times, scratch cwd/root, date, prompt-cache key
and client transport metadata vary. Request output caps remain observations.
Since [D62](decisions/d62-r01-codex-access-programs-optional.md),
the request-level `access_programs` field may be absent; the audit reports the
absence, and a present value must still equal the template (v1 required it).
Every request must match; altered tools, injected instructions, different task
bytes or environment permissions fail. The normal runner now includes E362's
stronger namespace exclusions. Any tool invocation still fails independently.

The **token-use policy** now follows
[D57](decisions/d57-r01-natural-token-use.md): no required hard
output ceiling for either pilot cohort. Current profiles omit research caps;
the audit records observed request limits but never fails on their absence or
mismatch. Historical reproduction settings remain available. Client/provider
limits can still apply. The 120-second timeout is unchanged. Calibrate Haiku
5.5 adaptive effort against Luna low-effort generated-token usage on matched
development tasks; choose one setting across formats before the rigorous run.
E365 chooses `low`, the lowest supported level; Haiku still generates 6.1× Luna `low` by median.

The captured Claude context includes three system blocks (billing metadata,
SDK identity and the supplied instruction) and five client-added reminders
(environment, model identity, token budget, account context and date). The
exact payload is retained and counted. The versioned
[context policy](../../brain/benchmarks/r01-candidates/claude-context-policy.mjs)
`r01-claude-context-policy-v1` allows exactly these blocks, request fields and
betas for Claude Code 2.1.302 and Haiku 4.5, with six named volatile fields
(billing suffix and prompt ID, metadata identifiers, working directory, account
email, date). The task text must equal the delivered prompt byte for byte. Any
other block or change fails admission; a CLI update requires a new version. Final model-usage metadata lists a 32,000-token
capability, but the actual request correctly sets `max_tokens:12000`; inspect
the request when reporting the observed ceiling.

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
The [paired runner](../../brain/benchmarks/r01-candidates/cli-paired-runner.mjs)
submits corrections only through that state. Each correction is a fresh
single-turn submission with the original prompt, every previous answer and
identical-form feedback (reason code plus native validation message), and its
context is counted. Expected values and golden responses are never disclosed.
Control and transport failures halt the sequence; quota evidence pauses it.
Wrapper retry/fallback flags are distinguished from underlying CLI behavior.
Each submission carries its retry report. The historical rehearsal entry point
accepts `-` for its optional transport-summary argument. The
[pilot runner](../../brain/benchmarks/r01-candidates/cli-pilot-runner.mjs) uses the
same sequence for both cohorts; a quota submission is retained outside the
repair state and resumes as a new `resumed-after-quota` submission.

## Remaining gates and next action

1. Done in E361: Claude context policy, transport evidence and the 11-attempt
   paired development rehearsal (15 admitted submissions). Subscription limits
   are operator-monitored and not a prerequisite.
2. Done in E363: Codex/Luna admission, including isolated home, fixed context
   and no actual tool use. Model selection follows D55, output length D57,
   and retry reporting D58. No Codex gate remains for the pinned configuration.
3. Done in E364: Haiku 5.5 admission under context policy v2, which the
   auditor selects by model. Done in E365: effort calibrated to `low`, with
   the remaining 6.1× median generated-token gap reported.
4. Under the [trial stages](PILOT-DRAFT.md#trial-stages),
   development runs need cohort admission but no freeze. Freeze settings,
   tasks, attempt count and stop rules before the rigorous stage.

The historical OpenAI snapshot cannot be used through the tested subscription
route. The operator chose current Haiku 5.5 and Luna as the pilot cohorts
(2026-10-26); historical Haiku remains admitted for development rehearsal
only. No provider is silently substituted after a failure.
