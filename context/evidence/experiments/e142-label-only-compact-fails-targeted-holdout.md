---
title: E142 — Label-only compact fails the targeted holdout
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c2-compact-grammar-correction.md
---

# E142 — Label-only compact fails the targeted holdout

## Verdict

Do not select label-only compact for Phase 8c3. It passed the frozen provider
gate only on Claude. It did not improve the hard-family macro over compact-bar
v1 on OpenAI or Gemini. The gate required a 5-point improvement on at least two
providers.

Close Phase 8c2 with `do-not-select`. Phase 8c3 has no eligible compact
candidate. Keep Phase 8f blocked. A later compact-format attempt needs a new
plan, a new hypothesis, new fixtures, and new approval before provider calls.
Do not revise label-only compact from this holdout result.

## Fixed holdout

The run ID was `phase8c2-targeted-holdout-r1`. The protocol SHA-256 was
`1d3787c4230d8c50f2f261a6c9a975bc03e9d79b574c2ca735dab3eb5ca615b5`.
The operator approved the exact 216-call scope before provider calls.

Each provider ran 18 calls on each of four arms. The arms were compact-bar v1,
label-only compact, exact JSON, and native MIDI-Like. All 216 calls returned
successfully. Each provider returned the requested model.

The fresh corpus SHA-256 was
`c85e511dbcc05aad7f5cd70c64447aa44e9948dd9372f9dbf741fbde52b82b76`.
It had no fixture-hash overlap with the initial development cohort or the
retained symbolic-format v1 cohort.

The corrected
[report](../../../brain/benchmarks/compact-format-v2/runs/2026-09-27-holdout-summary.json)
has SHA-256
`18c3a6fd8e5235e23c9ddc3682dacb818e8585620a9e67e382d32bcde759fd87`.

## Candidate result

| Provider | Hard macro delta | Guard delta | Candidate-only losses | Input ratio to exact | Output ratio to exact | Gate |
|---|---:|---:|---:|---:|---:|---|
| OpenAI | 0.00 points | +33.33 points | 1/18 | 0.736 | 0.623 | fail |
| Gemini | 0.00 points | 0.00 points | 0/18 | 0.703 | 0.586 | fail |
| Claude | +8.33 points | +33.33 points | 1/18 | 0.768 | 0.587 | pass |

OpenAI had one candidate-only progression loss. Claude had one candidate-only
role-continuation loss. Each family stayed within the maximum of one loss.
Every provider passed the guard, paired-loss, input-size, and output-size
conditions. OpenAI and Gemini failed only the hard-improvement condition.

The label-only fixed-ID motif result was 3/3 on every provider. Compact-bar v1
was 3/3 on OpenAI, 2/3 on Gemini, and 3/3 on Claude. Thus, the corrected motif
contract found one baseline variation. It did not change the selection result.

The initial focused suite did not predict a repeatable hard-family improvement.
Label-only compact passed the development gate on all three providers, but its
hard improvement repeated only on Claude in the fresh holdout.

## Validity limit

The frozen `do-not-select` decision remains the authority for this protocol.
Do not treat it as proof that label-only compact is equivalent to compact-bar
v1 or that explicit labels have no value.

The revoice source used `5/4` durations, and its prompt required duration
preservation. The canonical scorer answer used `3/2` durations and required
one exact pitch realization. Every revoice arm scored 0/3 on every provider.
Across all four arms and three providers, revoice passed 0/36 and progression
passed 2/36. Melody passed 33/36. These floor and ceiling effects limited the
format resolution.

Each hard family had three fixtures. One changed result moved the four-family
macro by 8.33 points, which was larger than the 5-point improvement gate. Use
the old responses only for diagnosis. Phase 8c2.2 owns a repaired scorer, a
finer fresh suite, and any new selection claim.

## Cost

| Provider | Approved estimate | Recorded cost | Calls |
|---|---:|---:|---:|
| OpenAI | USD 0.415715 | USD 0.318270 | 72 |
| Gemini | USD 0.264139 | USD 0.202205 | 72 |
| Claude | USD 1.470455 | USD 1.236459 | 72 |
| Total | USD 2.150309 | USD 1.756934 | 216 |

The manifests use API-reported token usage and the provider prices verified on
2026-09-27. The operator dashboards remain the external spend authority.

## Run identities

| Provider | Raw-run SHA-256 | Manifest SHA-256 |
|---|---|---|
| OpenAI | `8d0a30991c6d806f729fe8ccf8e3d4857fd571da16bba8f4bbe7b730382c5da4` | `7f0eb7c657192960401135a929f0503eddffe3934e242b4087ef4b6bb36387c2` |
| Gemini | `cb8ad2c4d978a5d0113a58cf30ead9bfb89fc33bc26d9aeaaa2d75a07c215edf` | `81464ae1989f498c392cc58e0225f0179bd98fa6a1ef8e5bcf320f31ffb60377` |
| Claude | `574b3a59e80e03ae1e3279a84a53f033c4dcac84f6057493a6f592620b5a95a6` | `4aaf0d8345187d553df34c91817a285bee8116181bb55dc6154bd9b7cf8962d1` |

## Reporting correction

The frozen protocol omitted the `collections.defaultdict` import from its
reporting-only path. Provider collection and per-response scoring were not
affected. The separate `holdout_report.py` reporter supplies the missing
import without changing the provider-bearing protocol. It verifies every
manifest hash, raw-run hash, call count, returned model, protocol hash, and
approval before it applies the frozen gate.

## Verification

The reporter self-test passes 9 checks. The holdout self-test passes 70 checks.
The holdout deterministic package still has SHA-256
`273b3cbc1099abc2fbf15f2fa5a7854a78a12916ebbea94177bd55f4616f1225`.
No live Bitwig project or cache changed.

## Retrospective

Test instruction-to-scorer agreement and each provider-reporting path before
provider calls. Deterministic reference generation did not find the revoice
contract defect or the missing reporting import.
