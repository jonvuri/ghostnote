---
title: Phase 8c4c — Compact-bar paired development
kind: plan
state: planned
status: Compare positional compact-bar with one minimal self-describing variant on fresh paired fixtures.
updated: 2026-09-27
parent: README.md
prev: 8c4b-focused-compact-calibration.md
next: 8c4d-compact-bar-targeted-holdout.md
evidence: E137, E140-E146, E155; D21, D23
---

# Phase 8c4c — Compact-bar paired development

## Purpose

Decide whether one fixed `FIELDS` declaration improves compact-bar enough to
replace positional compact-bar v1. Keep exact-object JSON as a task control.

This session can select a candidate for holdout. It cannot select a public
format or unblock Phase 8f.

## Entry conditions

- Phase 8c4b returns `proceed-development`.
- The three arms and repaired contracts are unchanged from calibration.
- A fresh development corpus and a paired decision rule are frozen.
- The operator approves the exact development scope and provider cost.

## Development scope

Run all three arms on OpenAI, Gemini, and Claude. Use analysis, motif, and
progression as decision families. Use the frozen guard families to detect a
regression outside the known failures.

Use 8–12 unique fixtures for each decision family. Freeze the exact count from
a resolution calculation. The smallest decision-macro step must be no larger
than five percentage points. Repeated prompts are sentinels and do not replace
unique fixtures.

Report each provider and family before any pooled result. Report paired
denominators, discordant rows, candidate-only losses, syntax, repair recovery,
tokens, bytes, latency, and uncertainty.

## Candidate rule

Freeze exact numeric gates before calls. At minimum, the selected compact arm
must:

- stay within the frozen paired musical margin of exact-object JSON on every
  provider;
- have no repeated candidate-only loss in a provider and family;
- avoid a decision-macro regression larger than five percentage points on any
  provider against positional compact-bar v1;
- meet the frozen initial-syntax and completion thresholds;
- pass every deterministic document and patch capability gate; and
- keep the fixed header within the frozen size and token budgets.

Select the `FIELDS` arm only when it passes these gates and has a measured
benefit over positional v1. A benefit can be fewer repeated musical losses,
fewer framing failures, or a predeclared improvement in the affected-family
macro. Do not select it only because it has more explicit syntax.

If `FIELDS` does not qualify, select positional v1 only if v1 passes the
absolute and exact-object gates. Otherwise, return `revise` or `stop`.

Return one result:

- `freeze-fields-holdout`;
- `freeze-v1-holdout`;
- `revise`; or
- `stop`.

Do not change the selected arm after the result.

## Acceptance criteria

- All claimed format effects use paired fresh fixtures.
- Calibration data does not enter the development effect estimate.
- Initial and repaired results remain separate.
- A selected candidate has one canonical note plane and stable event IDs.
- Selection follows the frozen per-provider and per-family gates.
- A new holdout plan states its exact candidate hash, calls, cost, and stopping
  rule before approval.

## Retrospective target

Record whether the fixed header changed comprehension or only added tokens.
Record whether any benefit repeated across providers.
