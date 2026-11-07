---
title: E380 — R01 round 2 Codex catalog refresh and cohort admission probes
kind: evidence
state: done
updated: 2026-10-28
owner: R01
---

# E380 — R01 round 2 Codex catalog refresh and cohort admission probes

Date: 2026-10-28. Stage: **development**, round 2
([brief](../../work/r01-round-2-difficulty-scaling.md) step 2). Three unscored
subscription CLI probes ran within the operator's standing scope, together
with one catalog read that performs no inference. No API billing or Bitwig
contact occurred.

## Pins

Claude Code 2.1.302 (binary `5262ce9d…`, first-party subscription auth) and
Codex 0.163.0 (binary `88133672…`, ChatGPT auth) match the R01-D1 pins. All
246 existing focused tests passed before any change.

## Catalog

`codex debug models` (driver
[`codex-catalog.mjs`](../../../brain/benchmarks/r01-candidates/codex-catalog.mjs),
isolated `CODEX_HOME` and the trial flags, 383 ms) returned ten models
([capture](../data/r01-round2-admission/catalog/manifest.json), stdout
SHA-256 `7e2c291a…`). Compared with the 2026-10-26 capture:

- **New: `gpt-6.1-terra`** ("GPT-6.1 Terra Codex model"), default effort
  `low`, efforts `low` to `ultra`, `code_mode_only`, multi-agent v2.
- `gpt-5.6-terra` ("Older balanced model for straightforward work") remains.
  Its entry changed in model messages, instruction and review flags,
  experimental tools and base instructions.
- `gpt-6-luna`'s entry is byte-identical, so its E363 admission stands.

R01-D9 named `gpt-5.6-terra` because no GPT-6 Terra was listed. Both Terra
models were therefore probed.

## Probes

Each probe made one invocation of
[`cli-control-probe.mjs`](../../../brain/benchmarks/r01-candidates/cli-control-probe.mjs)
with the retained two-note velocity edit. Retained captures and audits are in
[`r01-round2-admission/`](../data/r01-round2-admission/).

| Profile | Model and settings | Answer | Input / output (reasoning) tokens | Elapsed | Tools advertised | Context policy |
|---|---|---|---|---|---|---|
| `codex-terra` | `gpt-5.6-terra`, `low` | correct | 2,745 / 55 (0) | 7.36 s | 3 | v4, own template |
| `codex-terra-6-1` | `gpt-6.1-terra`, `low` | correct | 3,021 / 55 (0) | 3.84 s | 4 | v4, Luna's template |
| `claude-historical-uncapped` | `claude-haiku-4-5-20251001`, thinking 1,024, no cap | correct | 611 / 208 (150 thinking) | 4.69 s | 0 | v1 |

Every probe has one captured request, no inference failure, no client retry
event and no tool use.

- **Haiku 4.5** passes every gate under context policy v1 without a policy
  change. The served model is verified from the response. The request carries
  `thinking: {type: enabled, budget_tokens: 1024}` and the client default
  `max_tokens` of 32,000, with no `CLAUDE_CODE_MAX_OUTPUT_TOKENS`. The
  subscription still serves it.
- **Both Terra probes failed the v3 policy** only because v3 pins
  `gpt-6-luna`. Normalized against Luna's template, the `gpt-6.1-terra`
  request differs only in `model`. The `gpt-5.6-terra` request has three
  differences. It omits the `request_user_input_async` tool declaration. It
  sends a `multi_agent.usage_hint` block (2,235 characters, without the
  `<multi_agent_role>` wrapper and one `send_message` paragraph) in place of
  `multi_agent.role_instructions`. Neither is model-chosen content: both come
  from the model's catalog entry.
- **Policy v4** ([R01-D13](../../../spec/r01-research/decisions/r01-d13-round-2-admission-and-offline-design.md))
  selects the template by model. Luna's template is unchanged, `gpt-6.1-terra`
  shares it, and `gpt-5.6-terra` uses a template built from its one captured
  request by
  [`build-terra-template.mjs`](../data/r01-round2-admission/build-terra-template.mjs),
  with the auditor's normalization. Model selection for Terra uses D55's
  request basis (`r01-codex-terra-request-model-v1`). Codex responses name no
  served model, so `modelVerified` stays false.
- Under v4, both Terra probes pass every gate (`controlPass: true`). Luna's
  retained E363 probe still passes, and so does every retained policy test.

## Verification

Tests cover the v4 template selection: each Terra probe passes only its own
template, a relabeled Luna request fails `gpt-5.6-terra`'s template, an
unlisted model fails the profile gate, and a modified hint fails. They also
cover the retained probes' audits and the three new profiles' invocations.
250 focused tests passed after step 2.

## Limits

One small edit per model is admission evidence, not calibration. The
`gpt-5.6-terra` template rests on one captured request. A client or catalog
change that alters its hint or tools fails the audit and needs a new
template. Which Terra joins round 2 is the operator's choice; the default
remains `gpt-5.6-terra` under R01-D9.
