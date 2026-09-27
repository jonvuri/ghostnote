---
title: Phase 8c3 — Full symbolic-format matrix
kind: plan
state: complete
status: The full matrix blocks both candidates and keeps Phase 8f blocked.
updated: 2026-09-27
parent: README.md
prev: 8c2-3-compact-json-factorial-and-native-decision.md
next: 8c4a-benchmark-contract-repair.md
evidence: E137, E140, E152, E153, E154, E155; D21, D23
---

# Phase 8c3 — Full symbolic-format matrix

## Purpose

Run the fresh retained symbolic-format comparison after Phase 8c2.3 selects
one or more agent-facing representations. Use the complete task matrix to
decide whether the selected direction can proceed to public contract work in
Phase 8f.

Do not use a Phase 8c2, 8c2.2, or 8c2.3 calibration, development, or holdout
fixture. Do not tune a candidate during this session.

## Current checkpoint

[E155](../../evidence/experiments/e155-full-symbolic-matrix-blocks-phase-8f.md)
records the retained full matrix. Exact-object JSON fails 16 paired gates.
Tuple JSON fails 30. Gemini is incomplete because two responses reached the
output limit. OpenAI and Claude independently fail both candidates. The frozen
decision is `block`, no candidate is selected, and Phase 8f stays blocked.

Post-run diagnostics do not change this decision. They motivate the new
[Phase 8c4 recovery sequence](8c4a-benchmark-contract-repair.md), which uses
new contracts, packages, and cohorts.

## Entry conditions

- Phase 8c2.3 records a passing fresh targeted holdout.
- It names the exact candidate versions and product roles for the full matrix.
- All candidate grammars, renderers, parsers, prompts, and scorers are frozen.
- The full-matrix cohort and decision rule are new and frozen before provider
  calls.

## Comparison scope

Use all nine Phase 8c1 task families, repeated-prompt sentinels, exact JSON,
one-cycle mini-notation, and the native and composite notation and model-token
controls. Add every candidate selected by Phase 8c2.3. Include compact-bar v1
only when it has a named decision purpose and its cost is approved.

Run OpenAI, Gemini, and Claude with matched settings. Use the same semantic
fixture for every eligible arm. Keep musical success, syntax, identity,
preservation, output size, token use, nondeterminism, and provider variation
separate.

Use the corrected composite measurement classes from Phase 8c2. Report exact
score-ledger disagreements separately from score parsing, ledger parsing, and
other output failures.

## Cost authorization

The former USD 5 soft ceiling does not apply. Before every provider-bearing
pilot or retained run, give the operator the exact scope, expected calls by
provider, model settings, and estimated cost by provider and in total. Make no
provider call until the operator explicitly approves that named run.

Approval does not carry to another run. Stop and request new approval if the
scope or estimate changes materially. Record API-reported actual cost after
each run. The operator's provider dashboards remain the external spend
authority.

## Decision rule

Freeze the sample rule, rate margin, repeated-loss rule, and syntax and
capability gates before retained calls. Evaluate each provider and task family
before pooled totals.

Return one decision:

- `proceed`: one or more candidates pass all frozen gates and can enter Phase
  8f;
- `revise`: the result supports another bounded development session, but the
  retained cohort cannot be reused for tuning; or
- `block`: no candidate supports the current contract direction.

If the decision is not `proceed`, keep Phase 8f blocked. Do not revise a format
against the retained cohort.

## Outputs

- A new full-matrix protocol and generated retained cohort.
- Deterministic capability and scorer verification.
- Three provider manifests and one complete paired report.
- Provider, token, size, latency, cost, nondeterminism, and failure-class
  summaries.
- A `proceed`, `revise`, or `block` decision for Phase 8f.
- Updated compact-format evidence and a short next-session handoff.

## Acceptance criteria

- No Phase 8c1 retained, Phase 8c2 development or holdout, Phase 8c2.2
  calibration or development, or Phase 8c2.3 calibration, development, or
  holdout output is a fixture.
- Every candidate is unchanged from the passing Phase 8c2.3 holdout.
- All retained arms pass deterministic capability checks before provider calls.
- Every provider-bearing run has a prior named cost estimate and explicit
  operator approval.
- OpenAI, Gemini, and Claude run the same eligible retained cohort.
- Every claimed format delta uses paired fresh fixtures and states its
  denominator.
- Initial and repaired responses remain separate.
- Broad composite failures are not reported as score-ledger disagreements.
- The complete brain check, `context/check.rb`, and `git diff --check` pass.
- No API key, provider cache, third-party composition, live project mutation,
  or temporary generated music remains in the repository.

## Out of scope

- Further representation development.
- Freezing the public compact-bar contract.
- Changing the cache contract or live Bitwig state.
- Fine-tuning or training a provider model.
- External publication.

## Retrospective target

Record whether the focused Phase 8c2.3 suite predicted the full matrix. Record
whether any decision-critical result depended on one provider or one task
family.
