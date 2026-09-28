---
title: Phase 8c4b — Focused compact-bar calibration
kind: plan
state: complete
status: Complete. R6 adds OpenAI as the third eligible analysis provider.
updated: 2026-09-28
parent: README.md
prev: 8c4a-benchmark-contract-repair.md
next: 8c4c-compact-bar-paired-development.md
evidence: E140-E146, E155-E167; D21, D23
---

# Phase 8c4b — Focused compact-bar calibration

[E157](../../evidence/experiments/e157-focused-compact-calibration-requires-measurement-repair.md)
records `repair-measurement` for calibration r1. Motif is at an exact-object
ceiling. Progression is at a floor and has an unstated output-context
requirement. [E158](../../evidence/experiments/e158-compact-calibration-r2-awaits-approval.md)
records the offline repair and frozen calibration r2 package.
[E159](../../evidence/experiments/e159-compact-calibration-r2-requires-analysis-repair.md)
records `repair-measurement` for r2. Motif and progression are informative.
Analysis is at a ceiling on two providers.
[E160](../../evidence/experiments/e160-analysis-repair-r3-awaits-approval.md)
records the frozen three-tier analysis repair. Run Gemini first. Run Claude
only when Gemini enters the eligibility band.
[E161](../../evidence/experiments/e161-analysis-repair-r3-leaves-claude-at-ceiling.md)
records `repair-measurement` for r3. Gemini is informative on the easy tier,
but Claude remains at a ceiling. Stop provider work. Do not run a later tier.
[E162](../../evidence/experiments/e162-haiku-substitution-awaits-approval.md)
records the frozen Haiku substitution. It retains Gemini and authorizes only
Haiku on the unchanged easy cohort.
[E163](../../evidence/experiments/e163-haiku-r4-is-incomplete-under-extended-thinking.md)
records `repair-measurement` for r4. Haiku scored two of five unique tasks.
Three tasks reached the output limit without an answer. Stop provider work.
[E164](../../evidence/experiments/e164-haiku-output-limit-repair-awaits-approval.md)
records the frozen r5 output-limit repair. It uses a fresh Haiku cohort, a
12,000-token output limit, and a token-bound live cost guard. No r5 request is
approved.
[E165](../../evidence/experiments/e165-haiku-r5-passes-and-opens-paired-development.md)
records `analysis-repair-pass` for r5. Haiku is complete and informative at
1/5. Combined with retained r2, every decision family meets the provider rule.
Return `proceed-development`.
[E166](../../evidence/experiments/e166-openai-analysis-supplement-awaits-approval.md)
records the pre-run freeze for an optional OpenAI-only supplement. It reuses
the exact r5 measurement for a provider that had not seen the cohort. It
cannot change the completed r5 decision.
[E167](../../evidence/experiments/e167-openai-r6-adds-the-third-analysis-provider.md)
records the complete and eligible OpenAI result at 1/5. Gemini, Haiku, and
OpenAI are eligible on the repaired analysis measurement. Phase 8c4b remains
complete with `proceed-development`.

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
- Every provider runs the same eligible semantic fixtures. A pre-registered
  provider-specific settings repair can retain a complete provider gate and
  use a fresh cohort from the unchanged generator and difficulty schedule.
- Unavailable results stay outside scored denominators.
- The report cannot select a format from calibration data.
- The result follows the frozen stopping rule.
- Actual cost is reconciled with API records and provider dashboards.
- No calibration fixture enters development or holdout.

## Retrospective target

Record whether each repaired contract moved the affected task away from a
floor, ceiling, or ambiguity without making it trivial.

R4 adds a cost-control requirement. A provider plan must price its maximum
token path and enforce the approved accumulated cost before each conditional
call.
