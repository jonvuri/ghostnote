---
title: Phase 8c4d follow-up — V15 validity ladder
kind: plan
state: complete
status: V15 is complete and awaits the operator's benchmark decision.
updated: 2026-09-28
parent: README.md
prev: 8c4d-compact-bar-targeted-holdout.md
next: 8c4e-compact-only-full-benchmark.md
evidence: E179-E182; D21, D23-D24
---

# Phase 8c4d follow-up — V15 validity ladder

## Purpose

Replace the invalid v14 decision design with a fresh validity run. Measure
whether all three formats can show useful musical performance across a clear
difficulty ladder. Give the operator enough evidence to decide whether the
full benchmark is worth running.

This is not a format-selection holdout. Exact-object JSON is a format, not a
capability control. No automatic musical threshold selects or rejects a
format.

## Frozen repair

Use [`compact-format-v15`](../../../brain/benchmarks/compact-format-v15/README.md).
It makes these changes:

- parenthesizes the affine pitch expression and gives one neutral numeric
  example;
- uses JSON key and string terminology for the exact JSON serialization task;
- uses positive-control, light, moderate, and stress work;
- gives analysis fixtures 1, 2, or 4 independent cases;
- retains every planned case and component after a parse failure;
- removes whole-response musical scores;
- reports global component accuracy, average per-case component accuracy, and
  perfect case count and rate;
- sets OpenAI and Gemini reasoning to medium; and
- sets Haiku thinking to 4,096 tokens and its total output ceiling to 24,000.

## Run scope

Run `FIELDS`, local labels, and exact-object JSON on OpenAI, Gemini, and Claude
Haiku. Use eight analysis fixtures, eight affine fixtures, and four literal
serialization fixtures. Repeat analysis and affine work twice. Run the
serialization guard once. This is 108 messages per provider and 324 messages
in total.

Shuffle task groups independently per provider. Keep all three formats in one
balanced block for each task and repeat. Do not retry or repair.

The planning estimate is USD 4.750000. The provider hard limits total USD
6.350000.

## Measurement and authority

Keep provider, family, difficulty, and format cells separate. Report response-
level parsing and canonical form as conformance only. Report musical quality
at case and component granularity.

Return `operator-review` when the operational completion and coverage checks
pass. Return `invalid` otherwise. The operator decides whether performance is
decent but not flawless and whether Phase 8c4e can start.

## Approval

[E180](../../evidence/experiments/e180-v15-validity-ladder-awaits-approval.md)
records the passing offline package and exact hashes. The operator approved
that protocol, run plan, cohort, candidates, and USD 6.350000 hard limit before
the first live call.

## Result

[E181](../../evidence/experiments/e181-v15-validity-ladder-is-incomplete.md)
records the original safe Gemini cost stop at 69/108.
[E182](../../evidence/experiments/e182-v15-validity-ladder-completes.md)
records the approved append-only continuation. It resumed at sequence 70 under
a USD 1.000000 cumulative Gemini limit. The overall USD 6.350000 limit did not
change.

All providers completed and scored 108/108 messages. No response failed or was
unavailable. Total cost was USD 3.518706. The summary returns
`operator-review`. OpenAI and Haiku show high, non-perfect case and component
accuracy for all three formats. Gemini is perfect across the complete ladder.
The operator must decide whether the benchmark is valid and whether Phase 8c4e
can start.

## Acceptance criteria

- The v15 cohort has no full, semantic, or analysis-case overlap with the
  frozen historical snapshot.
- Every prompt exposes the affine formula, task values, output grammar, and
  required document context.
- Every reference answer receives full component credit.
- Parse failures keep fixed case and component denominators.
- No musical decision uses a whole-response pass.
- The three required component summaries exist at every primary report cell.
- Declared provider settings equal the effective request settings.
- Approval binds the protocol, plan, cohort, candidates, and cost limit.

## Retrospective target

Check whether the difficulty ladder produces useful positive and stress cases
without making one dense response the unit of musical success.
