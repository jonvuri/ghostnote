---
title: Phase 8c4d follow-up — V17 harder medium-difficulty tuning
kind: plan
state: active
status: OpenAI stopped at the cost guard. The formal result is invalid, and the completed analysis family remains above the difficulty bound.
updated: 2026-09-29
parent: README.md
prev: 8c4d-follow-up-v16-medium-difficulty-tuning.md
next: 8c4d-follow-up-v18-low-effort-rehearsal.md
evidence: E187-E190; D21, D23-D24
---

# Phase 8c4d follow-up — V17 harder medium-difficulty tuning

## Purpose

Test one more task-only complexity increase at medium reasoning. Preserve the
v15 measurement design and the v16 provider settings. Use OpenAI as the first
and only approved provider stage.

This calibration cannot select a format or authorize Phase 8c4e.

## Directional workload

Use [`compact-format-v17`](../../../brain/benchmarks/compact-format-v17/README.md).
Run ten fresh prompts for each decision family and format. Run two literal
serialization controls for each format. Use one sample, no retry, and no repair.
The maximum is 66 OpenAI messages.

Keep these properties unchanged:

- the three v15 candidate hashes;
- OpenAI medium reasoning and the 12,000-token output limit;
- balanced adjacent three-format blocks;
- strict and loose parsing;
- case and component scoring;
- provider-default temperature;
- immutable identity and exact cost accounting; and
- explicit approval before provider access.

## Complexity change

Analysis has three independent cases in each prompt. The design intended hard
seventh and diminished chords, but the frozen seed expression selected a
different distribution. The actual 30 cases contain 18 major, 4 minor, 5
half-diminished-seventh, and 3 major-seventh chords. Each case has an
eight-value motif pair. All chord notes and eight distractors share one
interleaved source document. Each case and component keeps independent credit.

Affine continuation keeps six events. Each source voice selects a different
axis, semitone offset, output start, and rhythmic factor. The model maps output
IDs in source order and sorts the calculated notes canonically. The note schema
and component scorer do not change.

Literal serialization remains a positive control.

## Directional decision

Return `expand-confirmation` only when both decision families have median
format global component accuracy from 60 through 95 percent, all formats keep
at least 90 percent structural validity, and all operational gates pass.

Return `revise-harder` above the accuracy bound, `revise-easier` below the
floor guard, or `invalid` after an operational or structural failure.

Stop after OpenAI. Do not run Haiku for a non-promising result. A promising
OpenAI result still needs a new frozen Haiku supplement and explicit approval.

## Cost and approval

The measured-cost estimate is USD 0.450000. The OpenAI and total hard limit is
USD 0.650000. Reserve the full next-call bound before each request. Retain a
failed reservation. Do not retry automatically.

[E188](../../evidence/experiments/e188-v17-harder-direction-awaits-approval.md)
records the passing offline package and exact identities. The operator approved
the plan.

[E189](../../evidence/experiments/e189-v17-openai-stops-at-budget-and-remains-too-easy.md)
records the live result. The cost guard stopped after 58 provider completions
at USD 0.588167. The formal result is `invalid`. All analysis rows completed,
and their median format accuracy was 95.8333 percent. Recovery cannot make the
run eligible for expansion because that family is already above the frozen
upper bound. Do not recover this cohort or run Haiku.

[E190](../../evidence/experiments/e190-v17-analysis-composition-correction.md)
records the chord-composition correction. It does not change the frozen v17
files, hashes, responses, or scores.

## Acceptance criteria

- The 22 fixtures and all 30 analysis cases are internally unique.
- The cohort has no full, semantic, or analysis-case historical overlap.
- Every reference answer receives full case and component credit.
- A one-component mutation loses one component only.
- Every affine fixture uses all three voice rules and requires an output sort.
- Every scored requirement is visible in every prompt.
- Every request fits the 10,000-byte request limit.
- The schedule has 66 messages and contains OpenAI only.
- The approval binds the protocol, plan, cohort, candidates, runner, and cost.
- Haiku and confirmation remain separate approval-bound work.

## Retrospective target

Check internal subcase uniqueness directly. Whole-fixture freshness does not
prove that every case inside a multi-case prompt is unique.
