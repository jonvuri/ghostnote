---
title: E182 — V15 validity ladder completes
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4d-follow-up-v15-validity-ladder.md
---

# E182 — V15 validity ladder completes

## Verdict

The approved Gemini continuation completed the frozen v15 validity ladder.
All three providers completed and scored 108/108 messages. No response failed
or was unavailable. The completed summary returns `operator-review`.

The continuation did not repeat the 69 completed Gemini calls. It resumed at
planned sequence 70. A separate cost amendment increased Gemini's cumulative
provider limit from USD 0.550000 to USD 1.000000. The overall USD 6.350000
limit did not change.

This result does not authorize Phase 8c4e. The operator must decide whether
the benchmark is valid and whether the full benchmark can start.

## Operational result

| Provider | Completed | Scored | Failed | Unavailable | Cost, USD |
|---|---:|---:|---:|---:|---:|
| OpenAI | 108/108 | 108 | 0 | 0 | 0.708237 |
| Gemini | 108/108 | 108 | 0 | 0 | 0.790205 |
| Claude Haiku | 108/108 | 108 | 0 | 0 | 2.020264 |
| **Total** | **324/324** | **324** | **0** | **0** | **3.518706** |

The 39 new Gemini calls added USD 0.290866. Gemini finished USD 0.209795 below
its amended provider limit. The complete run finished USD 2.831294 below the
unchanged overall limit.

## Component result

| Provider | Global components | Global accuracy | Average case accuracy | Perfect cases |
|---|---:|---:|---:|---:|
| OpenAI | 3,341/3,396 | 98.38% | 98.48% | 441/462 (95.45%) |
| Gemini | 3,396/3,396 | 100.00% | 100.00% | 462/462 (100.00%) |
| Claude Haiku | 3,322/3,396 | 97.82% | 97.89% | 430/462 (93.07%) |

| Provider | Format | Global accuracy | Average case accuracy | Perfect cases |
|---|---|---:|---:|---:|
| OpenAI | `FIELDS` | 98.76% | 98.81% | 147/154 (95.45%) |
| OpenAI | Local labels | 98.76% | 98.86% | 149/154 (96.75%) |
| OpenAI | Exact JSON | 97.61% | 97.75% | 145/154 (94.16%) |
| Gemini | `FIELDS` | 100.00% | 100.00% | 154/154 (100.00%) |
| Gemini | Local labels | 100.00% | 100.00% | 154/154 (100.00%) |
| Gemini | Exact JSON | 100.00% | 100.00% | 154/154 (100.00%) |
| Claude Haiku | `FIELDS` | 97.53% | 97.73% | 146/154 (94.81%) |
| Claude Haiku | Local labels | 98.06% | 98.05% | 144/154 (93.51%) |
| Claude Haiku | Exact JSON | 97.88% | 97.89% | 140/154 (90.91%) |

OpenAI and Haiku show strong but non-perfect performance for each format.
Gemini is at the ceiling for every format and difficulty cell. Thus the ladder
is informative for two providers but does not stretch Gemini at medium
reasoning.

No format has a consistent accuracy lead across OpenAI and Haiku. Local labels
have the highest average case accuracy for both. `FIELDS` has more perfect
Haiku cases. Exact JSON has fewer perfect cases for both providers. These are
descriptive results only. The protocol gives the operator selection authority.

## Validity audit

The continuation validator confirmed that the first 69 Gemini rows are equal
to the original partial manifest. It checked the frozen schedule, realized
ordinals, provider settings, cumulative cost, raw-response chain, and every
retained score. The completed three-provider summary preserves the original
protocol and run-plan hashes.

The original incomplete manifest and summary remain unchanged. The completed
manifest and summary are append-only artifacts for the same run ID.

## Identity

| Artifact | SHA-256 |
|---|---|
| Cost amendment | `5e4fde7597033f987ccd4b9c1fb4c1eecfde9dc9540779c3cd45f342c7b63eb3` |
| Completed Gemini raw run | `3cc69585c6231b546031b122437b9fb77972c732bfd66032dd328043325afbf2` |
| Completed Gemini manifest | `287184ec749aff41c15f4505dd4d1cafb27b37a0d70278df51566c47aa05214c` |
| Completed summary | `11af720fd7e9a94a18f5ae8bcc82008f6356317db019a806c7b735c69693ba8c` |

## Retrospective

The append-only continuation kept the frozen experiment identity and retained
the original operational stop. Future run plans must allocate each provider
from measured cost at the intended reasoning setting.
