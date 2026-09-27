---
title: Phase 8c3 — Full symbolic-format matrix
kind: plan
state: planned
status: Run a fresh full matrix with the compact candidates selected by Phase 8c2.
updated: 2026-09-27
parent: README.md
prev: 8c2-compact-grammar-correction.md
next: 8f-consolidated-compact-bar-and-cache-contracts.md
evidence: E137, E140; D21, D23
---

# Phase 8c3 — Full symbolic-format matrix

## Purpose

Run the fresh retained symbolic-format comparison after Phase 8c2 selects one
or more compact candidates. Use the complete task matrix to decide whether the
selected compact direction can proceed to the public contract work in Phase
8f.

Do not use the Phase 8c2 development or holdout fixtures. Do not tune a compact
candidate during this session.

## Entry conditions

- Phase 8c2 records a passing fresh targeted holdout.
- It names the exact compact candidate versions for the full matrix.
- All candidate grammars, renderers, parsers, prompts, and scorers are frozen.
- The full-matrix cohort and decision rule are new and frozen before provider
  calls.

## Comparison scope

Use all nine Phase 8c1 task families, repeated-prompt sentinels, exact JSON,
one-cycle mini-notation, and the native and composite notation and model-token
controls. Add every compact candidate selected by Phase 8c2. Include
compact-bar v1 only when it has a named decision purpose and its cost is
approved.

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

- `proceed`: one or more compact candidates pass all frozen gates and can enter
  Phase 8f;
- `revise`: the result supports another bounded development session, but the
  retained cohort cannot be reused for tuning; or
- `block`: no compact candidate supports the current contract direction.

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

- No Phase 8c1 retained or Phase 8c2 development or holdout output is a fixture.
- Every compact candidate is unchanged from the passing Phase 8c2 holdout.
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

- Further compact-format development.
- Freezing the public compact-bar contract.
- Changing the cache contract or live Bitwig state.
- Fine-tuning or training a provider model.
- External publication.

## Retrospective target

Record whether the focused Phase 8c2 suite predicted the full matrix. Record
whether any decision-critical result depended on one provider or one task
family.
