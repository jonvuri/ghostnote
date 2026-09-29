---
title: E187 — V16 OpenAI direction requires harder tasks
kind: evidence
state: active
updated: 2026-09-29
parent: ../../plan/phase-8/8c4d-follow-up-v16-medium-difficulty-tuning.md
---

# E187 — V16 OpenAI direction requires harder tasks

## Verdict

OpenAI completed the v16 directional stage, but the increased complexity was
not enough. Both decision families had median format global component accuracy
of 100 percent. The frozen decision is `revise-harder`.

The operator required a stop after OpenAI if it did not clear the difficulty
bar. Haiku made no request.

## Operational result

| Metric | Result |
|---|---:|
| Planned messages | 66 |
| Provider completions | 66 |
| Scored messages | 66 |
| Failed or unavailable | 0 |
| Actual cost | USD 0.382806 |
| Global components | 1,782/1,788 (99.6644%) |
| Perfect cases | 243/246 (98.7805%) |
| Structural parse | 66/66 (100%) |
| Canonical form | 65/66 (98.4848%) |

## Decision families

| Family | FIELDS | Local labels | Exact JSON | Median |
|---|---:|---:|---:|---:|
| Analysis | 100% | 100% | 96.25% | 100% |
| Affine continuation | 99.3023% | 100% | 100% | 100% |

The serialization positive control was 100 percent for every format.

Only six components were wrong. Exact JSON missed three related harmonic
analysis values in one case. `FIELDS` missed two affine start values and one
document `SOURCE` value. Local labels were perfect in every decision and guard
cell. These sparse misses do not supply useful format differentiation.

## Early stop

Haiku attempted zero token counts and zero messages. The stop avoided the USD
1.250000 measured-cost estimate and the USD 1.750000 Haiku hard limit.

## Artifact identity

| Item | SHA-256 |
|---|---|
| OpenAI manifest | `8a1fd6ea38e6a381ea2bcaca0da67b0742583ca40b60842b7a1991cc5146dc36` |
| OpenAI file | `8b62b4bf0cdd93656f963dcbc0e6f73455fbfdeb4114eb633ee865edd4ffce21` |
| OpenAI assessment | `f0f16c2d3d4255aa80c5c6ed13bb0f3bffcb4cc5e0836ded5f1bff8ccba86f03` |

The manifest reproduces under the frozen supplement validator.

## Next direction

Increase reasoning depth inside each family without changing the formats or
component scorer. Keep the next paid screen small. Use the faster provider as
an early gate before Haiku.

## Retrospective

Cross-provider early stopping saved time and cost because the first provider
showed a clear ceiling. Future tuning plans should predeclare this gate.
