---
title: E158 — Compact calibration r2 awaits approval
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4b-focused-compact-calibration.md
---

# E158 — Compact calibration r2 awaits approval

## Verdict

The offline measurement repair passes. Calibration r2 is frozen at the
provider approval gate. Do not make a provider call until the operator approves
the exact protocol hash, run-plan hash, call limit, and cost limit.

The new package is
[`compact-format-v5`](../../../brain/benchmarks/compact-format-v5/README.md).
It does not change the retained v4 package or its calibration r1 artifacts.

## Measurement repair

- Every document-output prompt states the exact `BASE` or `base_sha256` value
  and the exact `SOURCE` or `source_id` value that the scorer requires.
- The deterministic suite checks output-context visibility for every document
  task and every arm. Focused mutations isolate the context scorer.
- Motif now uses six notes. One compound operation inverts and transposes
  pitches, and scales onset offsets and durations.
- Progression now uses three chord classes, one doubled class, no extra class,
  and a fixed same-voice movement limit of 54.
- The calibration, development, and holdout cohorts have no full or semantic
  overlap with each other. They have no semantic overlap with retained
  provider-bearing cohorts.
- The harness requires all three provider credential names before its first
  provider call.

The offline screen passes 222 checks. The calibration corpus SHA-256 is
`7fe3da450e8242c462a30571234927df713bed7afe89f381f9abb2b0b23d9b09`.
The cohort-manifest SHA-256 is
`cbf5fa573e266ba68a3412412afe8873092cb0ddad58163d91db14eecbb03123`.
The deterministic package SHA-256 is
`003c23ef91c8c1e85cddd87022ad73cfc09c2909727bc79dfd81cb1f73d5ee72`.

## Frozen calibration r2

The run ID is `phase8c4b-focused-compact-calibration-r2`. The protocol
SHA-256 is
`7e0d81e85b2b1caafda9fe7921ab7aefa0e3cd8e679775a136e912caa2dfe143`.
The run-plan SHA-256 is
`3d1abc5800507163f34ec64fc9039ddec95ef55adc7429fb8f2940e0f430b89f`.

Each provider has 69 initial jobs. At most 69 repair calls can follow. The
maximum is 138 calls per provider and 414 calls in total.

The maximum estimated cost is USD 5.095635:

| Provider | Maximum calls | Maximum estimated cost |
|---|---:|---:|
| OpenAI | 138 | USD 1.262826 |
| Gemini | 138 | USD 0.601556 |
| Claude | 138 | USD 3.231253 |
| Total | 414 | USD 5.095635 |

The estimate uses the larger retained mean call cost from calibration r1 or
the prior retained basis, plus 25 percent. No provider call occurred in this
repair session. The pending approval record rejects a provider run before it
reads the credential file.

## Approval boundary

Approval must name the run and exact hashes. It must allow no more than 414
calls and USD 5.095635. Approval for calibration r1 does not carry to r2.

Phase 8c4b remains active. Phase 8c4c and Phase 8f remain blocked.

## Retrospective

A new seed does not prove a new semantic fixture when generators use small
modular ranges. Keep the full and semantic hash audit as the cohort authority.
