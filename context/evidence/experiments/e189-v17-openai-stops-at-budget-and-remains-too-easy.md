---
title: E189 — V17 OpenAI stops at budget and remains too easy
kind: evidence
state: active
updated: 2026-09-29
parent: ../../plan/phase-8/8c4d-follow-up-v17-harder-medium-difficulty.md
---

# E189 — V17 OpenAI stops at budget and remains too easy

## Verdict

The approved v17 OpenAI run stopped safely at its cost guard after 58 of 66
provider completions. The formal frozen decision is `invalid` because provider
completion was 87.8788 percent and three positive-control cells had only 50
percent coverage.

The completed analysis family still gives a bounded difficulty result. All 30
analysis messages completed. Its median format component accuracy was 95.8333
percent, above the frozen 95 percent upper bound. Additional calls cannot
change that completed family. The run therefore cannot reach
`expand-confirmation` through recovery.

Do not spend on a recovery or Haiku supplement for this cohort. Increase task
difficulty again.

## Operational result

| Metric | Result |
|---|---:|
| Planned messages | 66 |
| Provider completions | 58 |
| Scored messages | 58 |
| Unavailable responses | 0 |
| Budget-stopped rows | 1 |
| Actual cost | USD 0.588167 |
| Overall components | 1,872/1,924 (97.2973%) |
| Average per-case component accuracy | 97.1092% |
| Perfect cases | 237/258 (91.8605%) |
| Structural parse | 58/58 (100%) |
| Canonical form | 54/58 (93.1034%) |

The guard stopped before planned sequence 59 because the next USD 0.063000
maximum-call reservation would have exceeded the USD 0.650000 hard limit. It
made no request for that row. The run had no transport or unavailable-response
failure.

## Completed analysis family

| Format | Components | Accuracy | Perfect cases |
|---|---:|---:|---:|
| `FIELDS` | 228/240 | 95.0000% | 26/30 |
| Local labels | 230/240 | 95.8333% | 23/30 |
| Exact JSON | 233/240 | 97.0833% | 25/30 |
| Median | — | 95.8333% | — |

Analysis improved materially from the v16 ceiling, but it missed the frozen
upper bound by 0.8333 percentage points.

E190 corrects the analysis composition. The 30 cases were not all hard seventh
or diminished chords. They contained 18 major, 4 minor, 5
half-diminished-seventh, and 3 major-seventh chords. The scores remain valid for
these actual tasks, but they do not support the intended chord-composition
claim.

## Partial affine family

| Format | Scored messages | Components | Accuracy | Perfect cases |
|---|---:|---:|---:|---:|
| `FIELDS` | 8/10 | 344/344 | 100% | 48/48 |
| Local labels | 9/10 | 364/387 | 94.0568% | 49/54 |
| Exact JSON | 8/10 | 344/344 | 100% | 48/48 |

The partial median is 100 percent. Local labels became informative, but the
other two formats remained at a ceiling on their completed rows. Treat this as
directional evidence only because the family is incomplete.

## Artifacts

| Item | SHA-256 |
|---|---|
| Manifest identity | `90d8b1c2c8e7144fb9ac362431195bfb0f49972790c8e92a5e6ef51c85ba89b5` |
| Manifest file | `92c97346d95e9e7cbc314483656e18da34083747c8a01dedf93c87554f9605db` |
| Assessment file | `f28012a59267fb617b7f313e72d35c5403c684a52393970c21cefd09f0f84cbd` |

The manifest reproduces under the frozen v17 validator. The assessment records
the frozen summary inputs and the recovery bound.

## Retrospective

The v16 measured-cost estimate did not cover the longer v17 prompts and
reasoning. Future tuning plans must estimate cost from prompt size and task
complexity, not only the prior call count and provider setting.
