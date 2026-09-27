---
title: Phase 8c4f — Full-matrix decision and optional rerun
kind: plan
state: planned
status: Decide whether to buy one fresh paired full matrix, then record the final Phase 8f gate.
updated: 2026-09-27
parent: README.md
prev: 8c4e-compact-only-full-benchmark.md
next: 8f-consolidated-compact-bar-and-cache-contracts.md
evidence: E137, E140, E155; D21, D23
---

# Phase 8c4f — Full-matrix decision and optional rerun

## Purpose

Make the operator decision about a fresh full matrix after the complete
compact-bar recovery sequence. Run the matrix only when its expected decision
value justifies its cost.

## Entry conditions

- Phase 8c4e returns `matrix-plausible`.
- The selected compact candidate and measurement package remain frozen.
- The proposed matrix has a fresh frozen cohort, exact arms, hashes, models,
  settings, calls, provider costs, paired gates, and stopping rule.
- Corrected-run and stopped-attempt costs from Phase 8c3 are available for the
  spending decision.

## Operator choices

The operator can select one of three paths.

### Run the fresh matrix

Require explicit approval for the named run. Use the complete Phase 8c3 arm
taxonomy with the selected compact candidate added or substituted according
to the frozen protocol. Any arm reduction must be declared before approval
and must not be called a full matrix.

Run OpenAI, Gemini, and Claude on the same fresh semantic fixtures. Report
every provider and family before pooled totals. Keep syntax, musical success,
capabilities, repair recovery, size, tokens, latency, cost, and
nondeterminism separate.

Return `proceed`, `revise`, or `block` from the frozen paired gates. Only
`proceed` unblocks Phase 8f on the full-matrix path.

### Skip the matrix and proceed

The operator can explicitly accept the remaining evidence limit and proceed
to Phase 8f without a new full paired matrix. Record that the decision rests
on fresh focused paired development and holdout, a fresh compact-only full
benchmark, and historical Phase 8c3 context. Do not claim that compact beat
the old matrix on paired fresh evidence.

This is a product-direction decision, not a counterfactual benchmark pass.
Record the reason that another matrix was not worth its expected cost.

### Stop or revise

Keep Phase 8f blocked. Any further representation change requires a new plan
and new cohorts. Do not tune against the Phase 8c4e full cohort.

## Cost authorization

Approval from calibration, development, holdout, or the compact-only run does
not approve a matrix. Before matrix calls, report exact calls, model settings,
estimated cost by provider and in total, protocol and cohort hashes, and the
allowed retry policy. Stop if the approved scope changes materially.

## Acceptance criteria

- The operator choice and its evidence basis are explicit.
- A matrix, when approved, uses fresh paired fixtures and the frozen candidate.
- An incomplete result does not enter a scored denominator as a failure.
- No result is tuned or retried outside the frozen policy.
- Phase 8f is unblocked only by a matrix `proceed` result or an explicit
  operator decision to proceed with the stated evidence limit.
- The final report reconciles cost with API records and provider dashboards.

## Retrospective target

Record whether the compact-only screen changed the matrix decision and whether
the final evidence was worth its total provider cost.
