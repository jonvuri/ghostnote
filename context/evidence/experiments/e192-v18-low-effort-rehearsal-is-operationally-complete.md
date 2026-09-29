---
title: E192 — V18 low-effort rehearsal is operationally complete
kind: evidence
state: active
updated: 2026-09-29
parent: ../../plan/phase-8/8c4d-follow-up-v18-low-effort-rehearsal.md
---

# E192 — V18 low-effort rehearsal is operationally complete

## Verdict

OpenAI completed and scored all 66 approved low-effort messages. The run had no
failed, unavailable, or budget-stopped row. It cost USD 0.261846 against the USD
0.650000 hard limit.

The frozen summary contains `decision: invalid`. One stress-analysis `FIELDS`
response omitted the complete `motif_relations` field. That cell had four
structural passes in five prompts, or 80 percent. The protocol incorrectly
encoded 90 percent as a minimum validity gate.

The operator clarified that 90 percent was a maximum task-performance target
and lower performance was acceptable. The omitted field is a measured model
failure, not an experiment-integrity failure. Treat the run as operationally
valid. Keep the frozen automated label unchanged for auditability.

The completed measurements are valid development evidence. Stress analysis
reached the intended 90 percent maximum target. Stress affine continuation had
a 99.5349 percent median and remained too easy. Do not recover this cohort.

## Operational result

| Metric | Result |
|---|---:|
| Planned and completed messages | 66/66 |
| Scored messages | 66 |
| Failed responses | 0 |
| Unavailable responses | 0 |
| Budget-stopped rows | 0 |
| Actual cost | USD 0.261846 |
| Cost remaining | USD 0.388154 |

## Elemental format-isolation result

| Family | `FIELDS` | Local labels | Exact JSON |
|---|---:|---:|---:|
| Analysis component accuracy | 87.5000% | 82.5000% | 95.0000% |
| Affine component accuracy | 95.3488% | 100.0000% | 96.7442% |

All six elemental cells passed the frozen 80 percent component threshold. All
responses parsed structurally. Elemental affine is a capability and format
isolation check, so its high accuracy is expected.

## Real-use stress result

| Family | `FIELDS` | Local labels | Exact JSON | Median |
|---|---:|---:|---:|---:|
| Analysis component accuracy | 90.0000% | 90.0000% | 76.6667% | 90.0000% |
| Affine component accuracy | 99.5349% | 99.5349% | 90.2326% | 99.5349% |

Stress analysis met the intended maximum target. Lower performance is
acceptable. Stress affine missed the difficulty target because both compact
formats were almost perfect.

The analysis results show meaningful reasoning pressure. Exact JSON had the
lowest stress-analysis accuracy even though all exact JSON responses parsed.
This is evidence about sampled model behavior, not a stable format effect.

## Conformance

All affine and serialization responses parsed structurally. One of five stress
analysis `FIELDS` responses did not. Canonical affine rates were lower than
component accuracy because models often returned correct notes in a
noncanonical order. Keep canonical conformance separate from musical component
accuracy.

All three serialization arms scored 100 percent component, structural, and
canonical accuracy.

## Artifacts

| Item | SHA-256 |
|---|---|
| Manifest identity | `480d6688d0ba5c383811b65a2659b7994d0b9538a5f3fbaa533d780bbbba69a5` |
| Raw response set | `de979ddc9f1e342cdf9d2aa6420ffe3339ab2f43d9e0ca01245b552638709114` |
| Manifest file | `45fbb24a262a945728b03b8e71f692896c0296d09f64270286c1130881b023b2` |
| Summary identity | `33bbcccc4c6f8615fb7580d0efaf828d59e0e2ae180044adc07395af35f01bed` |
| Summary file | `3b3aaf38d1045c4ad47a26a3cb7b25ad6ade2f72be357efdfb4fd3bcfc70aedb` |

The manifest and all retained scores reproduce under the frozen v18 validator.

## Interpretation limit

Five prompts per stratum give a 20-point prompt-level step. Cases and
components within a prompt are not independent trials. This run is a coarse
development rehearsal, not an effect estimate.

The reusable suite passed its v18 reference, scoring, and distribution checks.
E193 records the sampled audit and one cross-cohort freshness flaw that must be
repaired before 8c4e freezes a new cohort.

## Retrospective

Do not make returned model conformance a gate on experiment validity. Keep it
as a benchmark outcome. Future small rehearsals must also state maximum
difficulty targets with the correct direction.
