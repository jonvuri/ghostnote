---
title: E164 — Haiku output-limit repair awaits approval
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4b-focused-compact-calibration.md
---

# E164 — Haiku output-limit repair awaits approval

## Verdict

The offline Haiku output-limit repair passes. Calibration r5 is frozen at the
provider approval gate. Do not make a token-count or message request until the
operator approves the exact protocol hash, run-plan hash, call limit, and cost
limit.

The new package is
[`compact-format-v8`](../../../brain/benchmarks/compact-format-v8/README.md).
It does not change v5, v6, v7, or a retained provider result.

## Output-limit repair

R4 used a 5,000-token total output limit inherited from the Sonnet and Gemini
harness. Haiku used the complete limit in reported thinking on three calls and
returned no answer.

R5 increases `max_tokens` to 12,000. It keeps the manual thinking target at
1,024 tokens. The request does not set temperature or `effort`. All other
prompt, scorer, repair, and eligibility contracts stay unchanged.

## Fresh cohort

R5 uses a fresh five-task Haiku cohort and one named repeated-prompt sentinel.
It keeps the easy-tier batch-count schedule of 1, 2, 2, 3, and 3 cases. Seed
12000 produces no whole-task or individual-case semantic overlap with the
earlier v5 or v6 calibration and validation material.

The corpus SHA-256 is
`1b056340b189b8a5fbef255bed783c1fe4dd706a266593abb12d9fbfdf7b599b`.
The cohort-manifest SHA-256 is
`3ffcd022545ace31e6c47a766788ceb6e23b442354925eca111cd7d4461ccbd0`.
The dependency-manifest SHA-256 is
`2f43ca6ef2f22312e47f77202bf11f036ceb8b346cd48f6de313d285fe602990`.

Retain Gemini's complete and eligible 3/5 r3 gate. Do not rerun Gemini,
OpenAI, or Sonnet. R5 is a provider-specific settings repair. Gemini and Haiku
use matched difficulty schedules, not identical fixtures.

The Phase 8c4b acceptance criteria now state this narrow settings-repair
exception. It does not permit prompt, scorer, generator, difficulty, or
eligibility changes after a provider result.

## Cost guard

Before every message request, the harness uses Anthropic's free token-count
endpoint with the same model, thinking, messages, and output schema. It adds a
128-token margin and rejects a request above the 5,000-token input ceiling.

Each message reserves USD 0.065 before inference. This amount covers the
5,000-input-token ceiling and 12,000-output-token ceiling at the frozen Haiku
rates. The harness settles a successful request to its measured cost. A failed
message request keeps its full reservation.

Stop before a request that would exceed 12 message attempts or USD 0.780000.
The harness makes no automatic message retry. It permits at most 12 free
token-count requests.

The offline screen passes 97 checks. It covers the exact request, fresh cohort,
scorer contracts, aggregation boundaries, input rejection, call limit, cost
reservation, settlement, and approval gate.

## Frozen calibration r5

The run ID is `phase8c4b-analysis-haiku-calibration-r5`. The protocol SHA-256
is `eb547c673e5603f623c6962015dff3e78bebaabb0a505ca076ce55dd2fa395c9`.
The run-plan SHA-256 is
`01d95131dd2e22a45d815d42b6e64191eb085f99a90f82ebcb79822e0b5286ad`.

Haiku has six initial calls and at most six repair calls. The maximum is 12
message requests, 12 free token-count requests, and USD 0.780000. No provider
or token-count request occurred in this preparation.

## Decision

Return `analysis-repair-pass` only when all five fresh Haiku initial results
are scored and Haiku passes 1 through 4. Return `repair-measurement` after a
floor, ceiling, or incomplete result.

A pass restores only the analysis entry condition beside the retained r2
motif and progression results. It cannot select a format or approve Phase
8c4c provider calls.

## Approval boundary

Approval must name the run and exact hashes. It must allow no more than 12
Haiku message requests, 12 free token-count requests, and USD 0.780000. R4
approval does not carry to r5.

Phase 8c4b remains active. Phase 8c4c and Phase 8f remain blocked.

## Retrospective

Treat thinking targets and total output limits as different controls. Price
the complete token-bound path and reserve cost before each provider request.

## Follow-up

The operator approved the exact r5 boundary. Haiku then produced a complete
eligible result. [E165](e165-haiku-r5-passes-and-opens-paired-development.md)
records `analysis-repair-pass` and the consolidated Phase 8c4b
`proceed-development` result.
