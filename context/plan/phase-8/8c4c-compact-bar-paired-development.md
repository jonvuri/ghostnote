---
title: Phase 8c4c — Compact-bar paired development
kind: plan
state: complete
status: The operator retains FIELDS and local labels for benchmark hardening.
updated: 2026-09-28
parent: README.md
prev: 8c4b-focused-compact-calibration.md
next: 8c4c-follow-up-symbolic-benchmark-hardening.md
evidence: E137, E140-E146, E155, E165-E177; D21, D23-D24
---

# Phase 8c4c — Compact-bar paired development

[E177](../../evidence/experiments/e177-gemini-local-label-diagnostic-selects-local-labels.md)
records the completed 32-call diagnostic. Local labels passed 8/8 analysis
responses. Current `FIELDS` passed 1/8. All frozen gates passed, so local
labels passed the diagnostic selection rule. This post-hoc, Gemini-only result
cannot select a public format or start holdout.

[D24](../../decisions/d24-forward-compact-benchmarks-retain-fields-and-local-labels.md)
retains both `FIELDS` and local labels for forward work. This avoids selecting
only on cases chosen against `FIELDS` and preserves a useful token-size
comparison. Positional v1 and all other earlier compact arms are historical
only.

[E176](../../evidence/experiments/e176-gemini-local-label-diagnostic-awaits-approval.md)
freezes the 32-call Gemini diagnostic. It uses two audited analysis cases and
two audited progression cases, with four repeats for current `FIELDS` and
local labels. Current `FIELDS` remains the default. Progression musical pass
cannot promote local labels.

[E175](../../evidence/experiments/e175-fresh-failure-audit-finds-fields-good-enough.md)
records the direct audit of 75 paired outputs. It finds no remaining simple
`FIELDS` defect. Current `FIELDS` is a defensible practical choice. The only
new format hypothesis worth a small test is a compact row with repeated local
labels.

The
[symbolic benchmark design backlog](../../evidence/format/SYMBOLIC_BENCHMARK_DESIGN_BACKLOG.md)
retains all experiment-design findings in current context. After the local-row
decision, complete the separate benchmark-hardening follow-up before targeted
holdout.

[E174](../../evidence/experiments/e174-fresh-full-family-comparison-favors-fields-over-v1.md)
records the completed 243-call comparison. `FIELDS` beat positional v1 on
every provider and is the only compact candidate worth retaining. It did not
match exact JSON on OpenAI or Gemini. Progression remained at a reasoning
floor. Do not start holdout or another provider run yet.

[E173](../../evidence/experiments/e173-fresh-full-family-comparison-awaits-approval.md)
records the passing offline v12 package and its approval boundary.

[E172](../../evidence/experiments/e172-prompt-screen-validates-fields-repair.md)
records the completed 72-call screen. `FIELDS` passed strict syntax on all 24
of its results. It led output serialization, but did not improve input
comprehension. The diagnostic cannot select a format or start holdout.

[E171](../../evidence/experiments/e171-failure-audit-and-small-screen-awaits-approval.md)
records the direct failure audit and frozen screen.

[E170](../../evidence/experiments/e170-paired-development-returns-revise.md)
records the frozen procedural `revise` result. Do not select a compact arm or
start Phase 8c4d from that result.

[E168](../../evidence/experiments/e168-paired-development-awaits-approval.md)
records the passing offline package and the original provider approval
boundary. The operator later approved the exact development r1 plan.

[E169](../../evidence/experiments/e169-paired-development-cost-budget-correction.md)
replaces the excessive maximum-token multiplication with a USD 5.000000 hard
cumulative budget and a 48-repair cap per provider.

[E165](../../evidence/experiments/e165-haiku-r5-passes-and-opens-paired-development.md)
satisfied the Phase 8c4b entry condition.

[E167](../../evidence/experiments/e167-openai-r6-adds-the-third-analysis-provider.md)
records the complete OpenAI supplement. OpenAI, Gemini, and Haiku are eligible
on the repaired analysis measurement.

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

Run all three arms on OpenAI, Gemini, and Haiku. Use analysis, motif, and
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

Sum exact provider cost line items before one final aggregate rounding step.
Assert that the reported aggregate and cost-guard total match.
