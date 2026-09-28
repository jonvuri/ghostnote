---
title: E165 — Haiku r5 passes and opens paired development
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4b-focused-compact-calibration.md
---

# E165 — Haiku r5 passes and opens paired development

## Verdict

Return `analysis-repair-pass`. Haiku is complete and informative at 1/5. The
retained Gemini gate is informative at 3/5. Combined with the retained r2
motif and progression gates, Phase 8c4b returns `proceed-development`.

The retained
[report](../../../brain/benchmarks/compact-format-v8/runs/2026-09-28-analysis-report.md)
and
[summary](../../../brain/benchmarks/compact-format-v8/runs/2026-09-28-analysis-summary.json)
record the result. The summary SHA-256 is
`6849b0cb364fd596a3940ea107dbf54f282b2a1e22a4f138e5ec647b4ab55455`.

## Result

| Provider | Unique initial result | Complete | Gate |
|---|---:|---:|---|
| Gemini | 3/5 | yes | eligible |
| Haiku | 1/5 | yes | eligible |

Haiku passed variant 1. Variant 2 failed root pitch class and rhythm. Variants
3, 4, and 5 failed syntax because they did not use the required `ANALYSIS` row
form. All five unique results were scored. No result was unavailable or
failed.

Four tasks received repairs. Variants 2, 3, and 5 repaired to a complete pass.
Variant 4 still failed four chord checks. Repairs do not enter the initial
gate.

## Output-limit finding

No response reached the 12,000-token output limit. The largest response used
5,013 tokens, just above the old 5,000-token limit. The increased ceiling
removed all three r4 output-limit failures.

The unique variant 1 task and its sentinel returned the same passing payload.
The repeated-prompt result was stable.

## Usage

| Calls | Input tokens | Output tokens | Thinking tokens | Mean latency | Cost |
|---:|---:|---:|---:|---:|---:|
| 10 | 16,700 | 28,286 | 27,306 | 28.854 s | USD 0.158130 |

The run made 10 of 12 approved Haiku message requests and 10 of 12 approved
free token-count requests. Every request stayed within its reservation. The
guard committed and settled USD 0.158130, with no failed reservation. No
transport retry occurred.

The requested and returned model was `claude-haiku-4-5-20251001`. No Gemini,
OpenAI, or Sonnet call occurred. The Haiku manifest SHA-256 is
`7b2933d28a54d27635adc85b05839bb987460a46ae92e2dedd8805d26d63f1b1`.
The raw-run SHA-256 is
`d908d4ca992512ddff139dea179b8739b3572d1f14c6a7dc1fc19f08cda67af1`.

## Consolidated calibration result

The retained r2 result makes motif informative on two providers and
progression informative on three. R5 makes analysis informative on Gemini and
Haiku. Every decision family meets the two-provider rule.

Phase 8c4b is complete with `proceed-development`. This result does not select
a format. Phase 8c4c can start offline preparation, but it needs a fresh
development corpus, frozen decision gates, a run plan, and separate operator
approval before provider calls.

## Retrospective

The 5,000-token inherited limit caused the incomplete r4 result. Separating
the thinking target from the total output limit repaired completeness without
raising the thinking target. Keep token counting and pre-call cost reservation
in later provider harnesses.
