---
title: Phase 8c4f format selection outcome
kind: outcome
state: complete
updated: 2026-10-01
source: ../../plan/phase-8/8c4f-full-matrix-decision.md
---

# Phase 8c4f format selection outcome

## Final operator outcome

The operator reviewed the corrected full matrix and adjudicated addendum,
then selected FIELDS and JSON for exact model note and rhythm communication.
[D25](../../decisions/d25-fields-json-document-format-and-publication.md)
records the selection and opens Phase 8f. The operator also approved the
three-session specification, codec, and host-binding plan, rational-only
timing, optional overlays, and the Phase 9b publication handoff.

The full matrix ran; this was not the skip-matrix path. The final gate is an
operator product decision with the reported evidence limits. It does not
rewrite any frozen benchmark verdict. Retained matrix cost is USD 15.72944325.
Retained diagnostic cost is USD 2.52608325; the discarded Claude diagnostic
attempt cost USD 0.35133900. The matrix r9 incomplete read can have an unknown
additional provider charge. No new call is needed for this closeout.

The [review](../../evidence/format/FORMAT_BENCHMARK_PRODUCT_REVIEW.md) is the
current synthesis. [E209](../../evidence/experiments/e209-offline-score-repair-updates-eight-arm-matrix.md)
and [E213](../../evidence/experiments/e213-audit-adjudications-update-native-composite-scoring.md)
retain the different assessment denominators. Costs retain the accounting
limits reported by [E211](../../evidence/experiments/e211-native-composite-diagnostic-closes-with-two-providers.md).
No provider dashboard reconciliation is newly claimed by this closeout.

## Retrospective

Check each arm's actual schema before applying older coverage claims. Label
notation and ledger score channels separately in summary tables.

## Historical plan

The following plan body records the original options and gate policy.
D25 supplies the later explicit operator selection.

# Phase 8c4f — Full-matrix decision and optional rerun

## Purpose

Make the operator decision about a fresh full matrix after the complete
compact-bar recovery sequence. Run the matrix only when its expected decision
value justifies its cost.

## Entry conditions

- Phase 8c4e returns `matrix-plausible`.
- Both compact candidates and the provider request package remain stable.
- Fixtures, provider responses, scoring, diagnostics, and decision policy have
  separate versions. A deterministic scoring or policy repair can reuse a
  retained provider response.
- The proposed matrix has a fresh frozen cohort, exact arms, hashes, models,
  settings, calls, provider costs, paired gates, and stopping rule.
- Corrected-run and stopped-attempt costs from Phase 8c3 are available for the
  spending decision.

## Operator choices

The operator can select one of three paths.

### Run the fresh matrix

Require explicit approval for the named run. Include `FIELDS`, local labels,
and the exact-object JSON control. Any additional arm needs explicit operator
approval. Do not restore a retired format by default.

Run OpenAI, Gemini, and Claude on the same fresh semantic fixtures. Report
every provider and family before pooled totals. Keep syntax, musical success,
capabilities, repair recovery, size, tokens, latency, cost, and
nondeterminism separate.

Return `proceed`, `revise`, or `block` from the frozen paired gates. Only
`proceed` unblocks Phase 8f on the full-matrix path.

### Skip the matrix and proceed

The operator can explicitly accept the remaining evidence limit and proceed
to Phase 8f without a new full paired matrix. Record that the decision rests
on fresh focused paired development and holdout, a fresh two-candidate full
benchmark, and historical Phase 8c3 context. Do not claim that the retained
candidates beat the old matrix arms on paired fresh evidence.

This is a product-direction decision, not a counterfactual benchmark pass.
Record the reason that another matrix was not worth its expected cost.

### Stop or revise

Keep Phase 8f blocked. Any further representation change requires a new plan
and new cohorts. Do not tune against the Phase 8c4e full cohort.

## Cost authorization

Approval from calibration, development, holdout, or the two-candidate run does
not approve a matrix. Before matrix calls, report exact calls, model settings,
estimated cost by provider and in total, protocol and cohort hashes, and the
allowed retry policy. Stop if the approved scope changes materially.

## Acceptance criteria

- The operator choice and its evidence basis are explicit.
- A matrix, when approved, uses fresh paired fixtures and both frozen
  candidates.
- An incomplete result does not enter a scored denominator as a failure.
- Provider request changes remain explicit. Deterministic rescoring can reuse
  retained responses when it does not change the task or model output.
- Phase 8f is unblocked only by a matrix `proceed` result or an explicit
  operator decision to proceed with the stated evidence limit.
- The final report reconciles cost with API records and provider dashboards.

## Retrospective target

Record whether the two-candidate screen changed the matrix decision and whether
the final evidence was worth its total provider cost.
