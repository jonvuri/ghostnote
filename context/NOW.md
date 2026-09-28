---
title: Current state
kind: status
state: active
updated: 2026-09-28
phase: phase-8-agent-native-live-engine
session: phase8c4c-paired-development-preparation
---

# Now

[Phase 8c4b](plan/phase-8/8c4b-focused-compact-calibration.md) is complete with
`proceed-development`.
[E167](evidence/experiments/e167-openai-r6-adds-the-third-analysis-provider.md)
records the complete and eligible OpenAI r6 supplement. OpenAI passed 1/5,
Gemini retains 3/5, and Haiku retains 1/5. All three provider tiers are
eligible on the repaired analysis measurement.

OpenAI and Haiku used identical fixtures. Gemini used the matched-difficulty
r3 cohort. Do not pool the three scores as one identical-fixture estimate.
Calibration did not select a compact arm.

R6 made 11 OpenAI requests and cost USD 0.047251 of the approved USD 0.738000.
No request retried or reached the output limit. The OpenAI manifest SHA-256 is
`1ef50f195f33bcd87349cf68cd03ead2cf82134a7271db7a5b914df37207cf57`.
The summary SHA-256 is
`86a23a942b0c943c2308e9c0035be88f85113c7c235c0370a074e0deab6fb0f2`.

The per-call cost sum and committed guard total round to USD 0.047251. The
settled counter is USD 0.047249 because it rounds after each call. This does
not affect the run. Repair aggregate rounding before the Phase 8c4c approval
gate. The operator owns the provider-dashboard comparison.

## Immediate work

1. Read the Phase 8c4c plan and prepare its fresh paired development package
   offline for OpenAI, Gemini, and Haiku.
2. Freeze the fixture count, paired gates, model tiers, call limit, and cost
   guard before provider approval.
3. Sum exact cost line items and round only the final aggregate.
4. Keep all calibration fixtures out of the development effect estimate.
5. Keep v4 through v9, r1 through r6, the cache, `normal-v1`, and live Bitwig
   projects unchanged.

Phase 8f remains blocked. Do not make a Phase 8c4c provider call, change a
frozen calibration package, or change the cache, stable `normal-v1` runtime,
or a live Bitwig project.

## Retrospective

Add an exact aggregate-cost reconciliation assertion before the next approval
gate. Iterative currency rounding created a small avoidable discrepancy.
