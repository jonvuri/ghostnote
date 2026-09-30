---
title: Phase 8c4f follow-up — Eight-arm matrix continuation
kind: plan
state: complete
updated: 2026-09-30
phase: phase-8-agent-native-live-engine
session: phase8c4f-eight-arm-matrix-complete
---

# Phase 8c4f follow-up — Eight-arm matrix continuation

## Goal

Complete the missing Gemini and Claude rows from the approved eight-arm matrix.
Reuse every retained response and frozen score.

## Scope

- Gemini repeated source sequence 564 and ran sequences 565 through 592.
- Claude repeated source sequences 67, 137, and 138 at a 24,000-token limit.
- Claude ran original sequences 139 through 195 before an HTTP 503 stop.
- Retain all completed continuation rows.
- The first approved resume selected sequence 195 and sequences 196 through
  592.
- R6 recovered sequence 195 and completed through sequence 339.
- R7 recovered sequence 340.
- R8 recovered sequence 341 and continued through sequence 556. Sequence 409
  is unavailable. The cost guard stopped before sequence 557.
- Do not call OpenAI.
- Keep the original tasks, prompts, candidate definitions, models, and request
  settings.

## Run policy

An unavailable response is a measured provider outcome. Retain it and continue
to the next pending row. Retry HTTP 503 or a read timeout only under a frozen
bounded policy. Stop on the final allowed retry, another transport failure, a
budget failure, or an identity or deterministic-screen failure. Make no repair
call.

## Cost

Successful earlier continuation calls cost USD 0.1151175 for Gemini and USD
1.175156 for Claude. R6 through r8 cost USD 6.668147. The exact total matrix
cost is USD 15.04678425.

The frozen r9 supplement estimates USD 0.750000 for 36 calls. Its hard limit is
USD 1.000000. The cumulative matrix hard limit is USD 16.04678425.

R9 completed two calls at USD 0.083737 and stopped on an incomplete response
body at sequence 559. The frozen r10 recovery has 34 calls, a USD 0.650000
estimate, and a USD 0.916263 hard limit.

R10 completed all 34 calls at USD 0.598922. The exact measured matrix cost is
USD 15.72944325. The incomplete r9 response can add an unknown provider charge.

## Acceptance criteria

1. Validate both retained source manifests and the frozen assessment.
2. Select only rows whose retained state is failed or `not-attempted`.
3. Preserve original planned sequence, arm, family, variant, task, and prompt
   identity.
4. Retain unavailable responses without retry and continue.
5. Stop on the final allowed transport failure or one budget failure.
6. Merge results by original planned sequence without replacing an attempted
   row.
7. Reproduce all retained and continuation scores.
8. Report provider coverage before any cross-provider aggregate.

## Approval

The r10 recovery was approved and completed. No continuation call remains.

## Boundaries

Do not change the original provider manifests or frozen scores. Do not change
the cache, `normal-v1`, or a live Bitwig project.
