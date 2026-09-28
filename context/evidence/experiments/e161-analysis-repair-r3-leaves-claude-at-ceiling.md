---
title: E161 — Analysis repair r3 leaves Claude at a ceiling
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4b-focused-compact-calibration.md
---

# E161 — Analysis repair r3 leaves Claude at a ceiling

## Verdict

Return `repair-measurement` and stop provider work. Gemini is informative on
the easy tier. Claude passes every easy-tier task and remains at a ceiling.
The frozen rule requires both providers to be informative on the same first
eligible Gemini tier.

The retained
[report](../../../brain/benchmarks/compact-format-v6/runs/2026-09-28-analysis-report.md)
and
[summary](../../../brain/benchmarks/compact-format-v6/runs/2026-09-28-analysis-summary.json)
record the result. The summary SHA-256 is
`73f343eb9bb675d688f2fffe118cf795f598b33130df0aab697d75c7372a9c72`.

## Result

| Provider | Unique initial result | Rate | Gate |
|---|---:|---:|---|
| Gemini | 3/5 | 0.60 | eligible |
| Claude | 5/5 | 1.00 | ceiling |

All unique initial results were scored. Both providers returned the requested
model. No transport retry, unavailable result, or failed result occurred.

Gemini passed chord identity, bass, motif relation, and rhythm on all five
tasks. It passed root, quality, inversion, and function on three. Claude
passed every component on every task.

Gemini's repeated sentinel differed from its unique copy. Both initial
answers failed. The sentinel repair passed, while the two unique-task repairs
did not. Claude returned the same passing answer for the unique task and its
sentinel. Repairs did not enter the primary score.

## Stopping rule

Gemini entered the eligibility band on the easy tier. The frozen ladder then
stopped, so Gemini medium and hard did not run. Claude used its one conditional
run on the same easy tier. Its ceiling returns `repair-measurement`.

Running a harder tier now would change the stopping rule after observing the
result. Any further provider work needs a new package, cohort, protocol, run
plan, and approval.

## Usage

| Provider | Calls | Cost | Manifest SHA-256 | Raw-run SHA-256 |
|---|---:|---:|---|---|
| Gemini | 9 | USD 0.019342 | `4931455793fa10ff25c7e541354328bbff342003d6fe51d99752e175bc663ef7` | `b4cf34804b322f7c6c1bbb508e357b291a100850e88797f6eda0761df6a96d4a` |
| Claude | 6 | USD 0.147045 | `b7aed802738307a51668923a93f3d9c115af6311977b1506c2184c7e097adab4` | `81aaf76e074fae27bc5b16418cd16fdc89248e6baa0c86c0d4372d2ebab73333` |
| Total | 15 | USD 0.166387 | - | - |

The result is below the approved 48 calls and USD 1.137431. The API records
are reconciled in the report. The operator owns the separate provider-dashboard
comparison.

## Consequence

The retained r2 motif and progression results do not combine with this failed
analysis repair. Phase 8c4c and Phase 8f remain blocked. Do not select a format.

## Retrospective

The Gemini-first gate avoided two unused Gemini tiers and any unnecessary
Claude repeat. A future repair must pre-register how it finds Claude's useful
difficulty without changing the rule after seeing a provider result.

## Follow-up

The operator selected Haiku 4.5 as a cost-tier correction instead of another
Sonnet difficulty search. [E162](e162-haiku-substitution-awaits-approval.md)
records a new package and protocol. It reuses the unchanged easy cohort only
for unseen Haiku and retains Gemini without a rerun.
