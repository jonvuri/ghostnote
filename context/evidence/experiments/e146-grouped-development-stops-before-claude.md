---
title: E146 — Grouped development stops before Claude
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c2-2-measurement-repair-and-grouped-compact-iteration.md
---

# E146 — Grouped development stops before Claude

## Verdict

Stop before Claude under the operator's conditional approval. OpenAI and
Gemini expose a new grouped single-note prompt defect. They also make the
frozen two-provider improvement gate unreachable. Claude is not approved
after this review.

The frozen three-provider development run is incomplete. Do not report its
formal terminal decision from the normal summarizer. Keep all responses and
do not repair or resume this run. The approval record is closed, so the
provider harness rejects a later Claude attempt.

## Completed providers

OpenAI and Gemini each completed 220/220 calls. They returned the requested
models with no transport errors or response repairs.

| Provider | Estimate | Recorded cost | Calls | Raw-run SHA-256 | Manifest SHA-256 |
|---|---:|---:|---:|---|---|
| OpenAI | USD 1.462711 | USD 0.793032 | 220 | `85c4167f5b7849ad57a82dc6401f9eaae54aa5db40b5ce64e7741fa923c102c3` | `198ae6ec9eb7aa2d6e3769cf73a597ae63b477c94e024713f735c107585290ab` |
| Gemini | USD 0.982603 | USD 0.484986 | 220 | `bdaaaf59e77bf300f9b0aa685104f6cb53384d70eb1c07b3a60e65b355e5f3bc` | `937b5044cba1daa710a764bbc0faf50672aa6c51b6afe2a1f34d1f0bab9a0871` |
| Total | USD 2.445314 | USD 1.278018 | 440 | — | — |

The operator should compare the recorded costs with the provider dashboards.

## New prompt defect

The grouped parser requires this exact single-note row:

```text
N ID <id> VOICE <voice> START <start> DURATION <duration> PITCH <pitch> VELOCITY <velocity>
```

The frozen prompt only says to use a labeled `N` row. It does not state the
field order, and its only example is a multi-note `G` block. OpenAI and Gemini
therefore produced several plausible `N` layouts. All eight grouped melody
responses failed syntax, while every compact-bar and label-only melody
response parsed and passed.

This is a prompt specification defect. It is not evidence that single-note
rows are intrinsically unusable. The deterministic test used the renderer's
exact output, so it did not expose the missing instruction.

## Unreachable improvement gate

The single-note defect affects the melody regression family, not the three
decision-critical families. Those decision results independently make the
main development gate unreachable.

| Provider | Grouped | Compact bar | Paired effect | Grouped-only wins | Grouped-only losses |
|---|---:|---:|---:|---:|---:|
| OpenAI | 14/24 | 17/24 | -0.125000 | 3 | 6 |
| Gemini | 16/24 | 18/24 | -0.083333 | 0 | 2 |

The frozen gate needs a grouped improvement of at least 0.05 on two
providers. Neither completed provider improves. Only Claude remains, so the
minimum of two improving providers cannot be reached.

Revoice controls also passed 32/32 across the two providers. This is a new
control ceiling in the larger fresh sample. It further limits interpretation
of that family.

## Partial report

The integrity-checked partial report returns `stop-before-claude`. Its SHA-256
is `fa6370fa12f42540a0b9ceee9ea7e77ba49519c4eb63b75e9ee0d4f10e34e719`.
It records no formal development decision because the frozen three-provider
run is incomplete.

Do not reuse these development fixtures for a repaired provider run. A new
run would need fresh fixtures, a new protocol and plan, a new cost estimate,
and explicit approval.

## Post-review closeout

The operator accepted the terminal `stop-custom-compact` result because the
frozen improvement gate is unreachable. This is an operator closeout, not the
formal result of the incomplete three-provider summarizer. Do not run Claude
or reopen the approval record.

This result closes the incremental compact-bar text line. It does not show
that all formats more compact than exact JSON have no potential. Phase 8c2.3
tests compact JSON as a different structured-object direction with fresh
fixtures and a new protocol.

## Retrospective

Renderer round trips do not prove that a model prompt states every grammar
form. Add one explicit grammar template and one example for each permitted row
type before a future provider freeze.
