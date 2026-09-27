---
title: Phase 8c4b — Focused compact-bar calibration
kind: plan
state: active
status: Await operator approval for the frozen Phase 8c4b calibration plan.
updated: 2026-09-27
parent: README.md
prev: 8c4a-benchmark-contract-repair.md
next: 8c4c-compact-bar-paired-development.md
evidence: E140-E146, E155-E156; D21, D23
---

# Phase 8c4b — Focused compact-bar calibration

## Purpose

Test the repaired task contracts for floors, ceilings, parser defects, and
provider-specific ambiguity. Calibration is diagnostic. It cannot select a
format.

## Entry conditions

- Phase 8c4a passes every offline test.
- The calibration corpus, package, protocol, and run-plan hashes are frozen.
- The exact models, settings, output limits, call counts, and provider costs
  are recorded.
- The operator explicitly approves this named calibration run.

Approval for this run does not approve development.

## Run scope

Run positional compact-bar v1, compact-bar with `FIELDS`, and exact-object
JSON on OpenAI, Gemini, and Claude. Use the same semantic fixture and repaired
task wording for every eligible arm.

Cover analysis, motif, and progression on every provider. Include enough
multiline and repeated-prompt sentinels to test framing and variation. Keep
syntax, musical properties, component checks, initial output, and repair-turn
output separate.

## Eligibility and stopping rule

Use the exact-object arm to show that each task is solvable. Use both compact
arms to find compact-specific framing defects. Freeze the eligibility band in
Phase 8c4a.

Return one result:

- `repair-measurement`: a decision family is at a floor or ceiling, a task and
  scorer disagree, output states enter the wrong denominator, or a grammar
  example is defective;
- `proceed-development`: every decision family is informative on the frozen
  provider rule and no unresolved parser or scorer defect remains; or
- `stop`: the repaired suite cannot provide useful format resolution at a
  justified cost.

If the result is `repair-measurement`, stop provider work. Repair the package
offline and use a new calibration cohort. Do not use calibration outcomes to
select between the compact arms.

## Outputs

- Three provider manifests and a calibration report.
- Initial and repaired syntax and musical results.
- Family eligibility and component-resolution tables.
- Provider cost, latency, token, output-size, and nondeterminism summaries.
- A frozen development proposal only when the result is
  `proceed-development`.

## Acceptance criteria

- No calibration fixture appeared in an earlier provider-bearing run.
- Every provider runs the same eligible semantic fixtures.
- Unavailable results stay outside scored denominators.
- The report cannot select a format from calibration data.
- The result follows the frozen stopping rule.
- Actual cost is reconciled with API records and provider dashboards.
- No calibration fixture enters development or holdout.

## Retrospective target

Record whether each repaired contract moved the affected task away from a
floor, ceiling, or ambiguity without making it trivial.
