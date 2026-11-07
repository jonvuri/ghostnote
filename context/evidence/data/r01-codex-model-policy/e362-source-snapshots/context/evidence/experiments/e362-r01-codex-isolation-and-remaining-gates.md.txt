---
title: E362 — R01 Codex isolation and remaining admission gates
kind: evidence
state: done
updated: 2026-10-26
owner: R01
---

# E362 — R01 Codex isolation and remaining admission gates

## Outcome

**Luna remains unadmitted.** The operator requested a focused investigation of
all Codex gates, suggesting an isolated `CODEX_HOME`, and asked us to stop if
any remained blocked after reasonable effort. Isolation works for global
AGENTS and skills. Two direct subscription probes completed the synthetic
velocity edit correctly. Further tool controls reduced but did not eliminate
advertised tools. Local fault tests establish a promising custom-provider
retry configuration, not subscription-route admission. Investigation stopped
with the gates below open. No pilot, reserved-source access or Bitwig work ran.

| Gate | Evidence and remaining work |
|---|---|
| Global AGENTS and skills | Both captured subscription requests omit `agents_md.instructions` and skill metadata. Each used a fresh home containing only a private copy of file-backed ChatGPT authentication, with the existing skill-suppression flags. No operator configuration was edited. This isolation mechanism is implemented in the probe and attempt runners. |
| Tool exposure | The baseline isolated request still advertises ten tools. Explicit native multi-agent suppression and namespace exclusions reduce this to `functions.exec`, `functions.wait`, `functions.request_user_input`, and `functions.request_user_input_async`. `exec` still describes nested patch/resource/clock capabilities. No tools executed, but advertising them fails the gate. |
| Remaining client context | Permission and collaboration-mode blocks can be removed; multi-agent role/mode and environment blocks remain. A versioned exact context policy is still needed after the final invocation is chosen. Removing AGENTS/skills alone is not full context admission. |
| Served model | Both trace responses contain `response_id`, `upstream_request_id`, `token_usage`, and `output_items`, but no served-model field. Requested `gpt-6-luna` and catalog metadata are not independent proof. An `openai-model` header string exists in the binary; its presence in actual subscription responses was not verified. |
| Transport retries | A custom provider accepts `request_max_retries=0` and `stream_max_retries=0`. Local 500, 429 and disconnected-stream tests each receive one HTTP request; a one-retry positive control receives two. All four traces report just one logical inference. Subscription behavior, successful capture, auth-refresh paths and idle-timeout coverage remain unverified. The built-in provider's rejected retry overrides remain unresolved. |
| Output ceiling | Neither subscription request has `max_output_tokens`. Strict configuration rejects `max_output_tokens=12000` before inference. The inspected schema has no completion-ceiling setting; `tool_output_token_limit` limits stored tool output, not generation. No effective 12,000-token ceiling is established. This is a finding about the tested controls, not proof that every possible transport adaptation is impossible. |

The [pilot](../../../spec/r01-research/PILOT-DRAFT.md#provider-admission-and-model-cohort)
keeps Luna pending. Resolving only the response-header or retry question would
not admit it while tools and the ceiling remain unverified.

## Experiments and limits

All inference used Codex **0.163.0**, requested **`gpt-6-luna`**, low reasoning,
ChatGPT authentication and the same two-note task as E359, with a 120-second
process limit and no wrapper retry. The
[artifact manifest](../data/r01-codex-admission/manifest.json) pins the binary,
sources and retained files. Earlier E records and their raw captures are unchanged.

| Probe | Result | Provider usage |
|---|---|---|
| [Isolated home](../data/r01-codex-admission/isolated-home/manifest.json) | Correct answer; ten advertised tools; one logical inference; 3,732.84 ms | 4,743 input including 3,456 cached; 55 output; zero reasoning |
| [Additional tool exclusions](../data/r01-codex-admission/exclude-tools/manifest.json) | Correct answer; four advertised tools; one logical inference; 3,691.67 ms | 3,027 input, zero cached; 55 output; zero reasoning |
| [Ceiling configuration](../data/r01-codex-admission/output-cap/manifest.json) | Rejected locally as unknown configuration; no inference | No provider usage |

Times and token counts are observations, not comparative format results.
The stronger invocation is retained as an experiment; it is not promoted to an
admitted profile. Exact extra flags are in its manifest. The
[catalog](../data/r01-codex-admission/catalog/stdout.jsonl) selects
`tool_mode: code_mode_only` and `multi_agent_version: v2` for Luna, which is a
possible explanation for controls not removing every tool. That causal
explanation was not independently established. Three prompt-debug attempts
are retained, including two option-order/support failures before the successful
inspection; none performed inference.

The [local fault records](../data/r01-codex-admission/faults/summary.json) use
dummy credentials, an isolated home, a loopback Responses endpoint and closed
external HTTP proxies. They do not forward requests or use subscription auth.
The positive control is particularly useful: **two HTTP requests correspond to
one trace `inference_started`**, proving that this trace is insufficient to
count transport attempts. These are exploratory tests, not a complete admitted
fault suite or an authentication-route equivalence claim.

A proposed loopback gateway forwarding one authenticated request to the same
ChatGPT subscription endpoint was rejected by automatic approval review because
it would proxy sensitive request context and authorization. **No gateway was
created or run.** That path would require explicit operator approval; local-only
dummy-credential testing proceeded instead. No API-funded route was used.

## Implementation and verification

`prepareCodexHome` creates a mode-0700 home and a mode-0600 authentication copy,
refuses reuse, API credentials and incomplete file-backed subscription auth,
and copies no config or instruction files. Each runner removes the whole scratch
directory in `finally`; authentication is never included in retained artifacts.
This helper supports file-backed ChatGPT auth only. Manifests distinguish the
isolated home from inherited environment and pin the probe binary and sources.

The audit now exposes `outputCeilingVerified` and rejects absent/mismatched
ceilings. Codex profiles declare the required 12,000-token ceiling without
pretending the CLI sends it. The audit also explicitly reports the pending
Codex context policy. Fresh audits of these captures remain failing. These
changes close audit omissions, not the underlying admission gates.

**58 focused tests pass**, including retained-capture regressions, HTTP versus
logical-count checks, credential exclusion, private-copy permissions, source
preservation, attempt cleanup, Claude controls, paired-runner stops and repair
accounting. The native-Node test command initially failed to load a TypeScript
dependency; rerunning with the required `tsx` loader passed:

```sh
cd brain
node --import tsx --test benchmarks/r01-candidates/cli-controls.test.mjs benchmarks/r01-candidates/cli-control-audit.test.mjs benchmarks/r01-candidates/codex-isolation.test.mjs benchmarks/r01-candidates/claude-controls.test.mjs benchmarks/r01-candidates/cli-paired-runner.test.mjs benchmarks/r01-candidates/cli-trial-plan.test.mjs
```

The stronger probe's preserved-state record verifies unchanged source auth,
config and AGENTS bytes. Local tests verify source preservation and removal of
private credentials. Changed documentation links/anchors, artifact/source
hashes and diff whitespace were checked. The repository-wide link checker
still reports pre-existing missing reference files and relocated historical
snapshot links; none originate in this task's changed documentation.
Retained request/response text was
checked for credential-shaped strings before staging.

## Reproduction and possible next work

The evidence directory retains the exact exploratory scripts, probe-time module
snapshots and all invocation manifests. Scripts originally lived under
`.tmp/r01-codex-admission/` and import the benchmark modules relative to that
location. To reproduce the experiments, reconstruct that layout in a disposable
checkout using `source-snapshots/`; use the script version whose SHA-256 matches
the attempt manifest. Do not run them against later invocation code and claim
the old settings. Current offline audits use `auditProbe(directory)`; regression
tests read the retained evidence without inference.

Potential follow-up paths are a deliberately versioned client catalog/tool
configuration or client change for the remaining tools; native response-header
capture or an approved gateway for served identity; the tested custom-provider
retry settings validated on the subscription route; and a transport/client
capability that actually sends and enforces the required output ceiling.
None is an admitted solution yet. Further work should resolve feasibility
before building a full runner around these mechanisms.

Official OpenAI documentation inspected:
[state environment variables](https://learn.chatgpt.com/docs/config-file/environment-variables),
[configuration sample](https://learn.chatgpt.com/docs/config-file/config-sample),
[configuration schema](https://learn.chatgpt.com/docs/config-schema.json), and
[model selection](https://learn.chatgpt.com/docs/models). The schema snapshot is
retained; it is current documentation, not a schema guaranteed to match the
pinned binary. Strict CLI validation and captured behavior establish the
specific findings above.
