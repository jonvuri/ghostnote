---
title: Phase 8c4d follow-up — V16 medium-difficulty tuning
kind: plan
state: active
status: OpenAI returns revise-harder. Haiku did not run. Gemini is excluded.
updated: 2026-09-29
parent: README.md
prev: 8c4d-follow-up-v15-validity-ladder.md
next: 8c4d-follow-up-v17-harder-medium-difficulty.md
evidence: E182-E183; D21, D23-D24
---

# Phase 8c4d follow-up — V16 medium-difficulty tuning

## Purpose

Tune task difficulty at medium reasoning before Phase 8c4e. Preserve the v15
experiment design and increase task content complexity only. Start with the
analysis and affine families that v15 already validates.

This calibration cannot select a format or authorize the full benchmark.

## Measurement interpretation

The symbolic tasks have no binary negative class. Interpret the requested 90
percent target as approximately 90 percent global component accuracy. Lower
accuracy is acceptable unless all formats reach a reasoning floor.

Keep global component accuracy, average per-case component accuracy, and
perfect case count and rate. Do not restore whole-response musical scoring.

## Minimal directional stage

Use [`compact-format-v16`](../../../brain/benchmarks/compact-format-v16/README.md).
Run Gemini first because Gemini saturated every v15 cell at medium thinking.

Use ten fresh prompts for each decision family and one sample for each format.
This gives a 10-point prompt-level step. It is a directional resolution, not a
population MDE or power claim. Use two literal serialization prompts as
positive controls. The total is 66 messages.

Keep these v15 properties unchanged:

- the three candidate hashes;
- medium Gemini thinking and the 12,000-token output limit;
- balanced adjacent three-format blocks;
- strict and loose parsing;
- case and component scoring;
- provider-default temperature;
- no retry or repair; and
- immutable identity, exact cost, and approval checks.

## Complexity change

Analysis uses one hard seventh or diminished chord per prompt, an eight-value
motif relation, and eight represented distractor notes. The output fields and
definitions do not change.

Affine continuation keeps the repaired v15 formula and its neutral example.
It uses six interleaved multi-voice events, irregular rational timing, and less
convenient rational factors. The output schema and component scorer do not
change.

Literal serialization remains a positive control. Do not tune it toward a
musical failure rate.

## Directional decision

Return `expand-confirmation` only when both decision families have median
format global component accuracy from 60 through 95 percent, all formats keep
at least 90 percent structural validity, and all operational gates pass.

Return `revise-harder` above the accuracy bound, `revise-easier` below the
floor guard, or `invalid` after an operational or structural failure.

Do not add providers or fixtures automatically. A promising result needs a
new fresh confirmation cohort, exact scope, cost plan, hashes, and explicit
approval.

## Execution and recovery boundary

[E183](../../evidence/experiments/e183-v16-medium-difficulty-direction-awaits-approval.md)
records the passing offline package and exact identities. The operator approved
it. The first Gemini request returned HTTP 400 before a provider completion.

[E184](../../evidence/experiments/e184-v16-medium-difficulty-direction-stops.md)
records the stopped manifest. It also freezes a recovery supplement. The
supplement permits one added attempt for the failed first case, carries the USD
0.054000 failed reservation, and keeps the USD 0.650000 cumulative hard limit.
It adds safe provider HTTP error capture.

[E185](../../evidence/experiments/e185-v16-gemini-recovery-confirms-region-stop.md)
records the approved recovery. Gemini returned `FAILED_PRECONDITION` because
the user location is not supported. The recovery stopped after its one added
attempt. Do not make another request from this environment. A supported
execution environment or a different provider route needs a new frozen plan
and approval.

## Other-provider supplement

The operator excluded Gemini temporarily and requested the other providers.
[E186](../../evidence/experiments/e186-v16-other-provider-direction-awaits-approval.md)
freezes the same 66-row workload for OpenAI and Haiku. It changes no task,
format, scorer, or decision rule.

OpenAI uses medium reasoning and a 12,000-token output limit. Haiku uses 4,096
thinking tokens and a 24,000-token output limit. Each provider has 66 messages.
Haiku also has at most 66 token-count requests. No request retries or repairs.

The measured-cost estimate is USD 0.450000 for OpenAI and USD 1.250000 for
Haiku. The provider hard limits are USD 0.650000 and USD 1.750000. The total
hard limit is USD 2.400000. The operator approved the supplement.

[E187](../../evidence/experiments/e187-v16-openai-direction-requires-harder-tasks.md)
records the OpenAI result. OpenAI completed 66/66 at 99.6644 percent global
component accuracy. Both decision families had median format accuracy of 100
percent, so the frozen decision is `revise-harder`. The operator required an
early stop at that outcome. Haiku made no request.

## Acceptance criteria

- Only task content and run scope differ from v15.
- Every reference answer receives full component credit.
- One-property failures remain granular.
- The cohort has no full, semantic, or analysis-case historical overlap.
- Ten unique prompts exist per format and decision family.
- The original run plan contains only Gemini and at most 66 messages.
- The other-provider supplement contains only OpenAI and Haiku and at most 66
  messages per provider.
- Each provider hard limit is enforced before every request.
- The other-provider total hard limit is USD 2.400000.
- Confirmation remains a separate approval-bound run.

## Retrospective target

Check whether prompt-level resolution and component-level measurement were
stated separately. Do not call a ten-prompt screen a powered comparison.
