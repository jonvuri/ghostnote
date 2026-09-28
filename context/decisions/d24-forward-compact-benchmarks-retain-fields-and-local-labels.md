---
id: D24
kind: decision
state: active
source: phase-8c4c-operator-selection
---

# D24 — Forward compact benchmarks retain `FIELDS` and local labels **[SETTLED 2026-09-28]**

Retain two compact music-document candidates in forward Phase 8c work:

1. `FIELDS`, with one global six-field declaration and positional note rows;
2. local labels, with the six short labels repeated on every note row.

Keep exact-object JSON as the structured control and complete-state fallback.
It is not a compact candidate.

Retire positional compact-bar v1 and every other earlier compact experiment
from new provider-bearing comparisons and product selection. Preserve all
historical packages, results, and decisions unchanged. The hardening audit can
use their outputs as offline regression fixtures, but it must not restore them
as paid comparison arms.

This decision does not reject the E177 result. Local labels won all frozen
Gemini stress gates. Those cases were selected because exact JSON passed and
`FIELDS` failed in v12. Keeping both candidates avoids making the final format
choice only on cases selected against `FIELDS`.

The evidence before E177 also remains relevant. The original compact-bar
format was the strongest musical arm in the first fixed comparison. `FIELDS`
then improved on positional compact-bar v1 across every provider in v12.

The two retained formats also define a useful size contrast. `FIELDS` stays
close to positional compact-bar size. Local labels repeat semantic bindings
and use more bytes and tokens. Future paired reports must measure quality,
strict conformance, prompt bytes, response bytes, input tokens, and output
tokens for both candidates on the same fixtures and settings.

The corrected benchmark, targeted holdout, and compact full benchmark must
carry both candidates unless a later explicit operator decision changes this
policy. They must not treat E177 as authority to remove `FIELDS`.

D24 does not select a public grammar or unblock Phase 8f. That decision still
needs the hardened benchmark sequence and the later product gate.
