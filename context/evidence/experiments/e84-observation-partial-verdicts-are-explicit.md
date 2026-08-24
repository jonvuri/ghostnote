---
id: E84
kind: evidence
state: active
source: dogfooding-d02-session-9
---

# E84 — Observation partial verdicts are explicit [K] (2026-08-24)

**Verdict: one observation can now store accepted and vetoed sub-scopes without
assigning either verdict to the complete instruction. Explicit rationales and
operator responses are write-once, and repeated equal values are idempotent.**

## Record model

Observation schema v3 adds `mixed` as an instruction-level response. A mixed
response has two through 16 caller-supplied `responseItems`. Each item keeps its
exact JSON sub-scope and an explicit `accepted` or `vetoed` response. A valid
mixed response must contain both states.

The Session 9 regression stores `rhythm` as accepted and `chord timbre` as
vetoed. The instruction stays `mixed`. Its original `rawScope` and existing
`resultIds` stay unchanged.

Schemas v1 and v2 migrate to v3. Their `silent`, `accepted`, and `vetoed`
responses keep the same meaning. Migration does not add scoped response items
to an old record.

## Enrichment conflicts

The public `record_observation` description now states that the first explicit
rationale and first explicit response are write-once. A partial verdict uses
`responseItems` instead of a whole-instruction `operatorResponse`.

A different second rationale refuses with stable wording. The result names the
preserved rationale and states that the record did not change. The public
regression confirms that this conflict does not call the record replacement
boundary. Repeating an equal rationale, whole response, or scoped response is
idempotent.

## Reporting

Reports count a partial verdict once as `mixed` at the instruction level. They
also count its accepted and vetoed items under `scopedOperatorResponses`.
Instruction response rates use the instruction count. Scoped response rates use
the scoped-item count. The same aggregation is present in totals, requested
scope summaries, and result-profile cross-tabs.

## Verification

- Focused observation, schema, and public-surface cohort: 115/115 pass.
- Complete brain check: 885/885 pass.
- TypeScript typecheck: pass.
- Diff whitespace check: pass.
- Bitwig writes: none required or made.

## Retrospective

Count a partial verdict at both levels: once for the instruction and once per
explicit response item.
