---
title: Phase 8c2 — Compact-format development loop
kind: plan
state: completed
status: Label-only compact failed the targeted holdout. No candidate enters Phase 8c3.
updated: 2026-09-27
parent: README.md
prev: 8c1-expanded-symbolic-format-comparison.md
next: 8c2-2-measurement-repair-and-grouped-compact-iteration.md
evidence: E137, E140, E141, E142; D21, D23
---

# Phase 8c2 — Compact-format development loop

## Purpose

Use focused tests to find why compact-bar v1 failed selected musical tasks and
to develop a better compact format. Compare labels, hierarchy, and explicit
field structure before another full matrix run.

This is a development loop. It can contain one or more iterations after the
initial six-arm run. Use new generated development fixtures for each stated
hypothesis. End with a fresh targeted holdout. Phase 8c3 owns the full retained
matrix and the decision that can unblock Phase 8f.

Do not tune against the Phase 8c1 retained outputs. Use them only to select
stress families and controls. Keep all v0 and v1 retained files and hashes
unchanged.

## Initial six arms

Run these arms on the same eligible semantic fixtures:

1. Compact-bar v1 shorthand as the development baseline.
2. A label-only compact arm that adds explicit field labels to the v1 rows.
3. A full v0-style compact arm with labeled events and structural headers for
   score, fields, omissions, bars, tracks, roles, voices, and regions.
4. Exact JSON as the complete structured control.
5. MIDI-Like native as the strongest concise native control.
6. MIDI-Like composite as a side-ledger diagnostic, not as a proposed product
   format.

The label-only arm and full v0-style arm must be separate. The v0-style arm
must pass renderer parity against the fixed v0 grammar. The parity check must
fail if a renderer replaces labeled events or required structure with the v1
positional shorthand.

The initial development package is
[compact-format v2](../../../brain/benchmarks/compact-format-v2/README.md).
Its run ID is `phase8c2-initial-six-arm-r1`. The protocol SHA-256 is
`b29699fc48f002fd7130cacf543405cbc768feb79f7a9f1d29cf2e6b59643a2d`.
The approved run plan is
[initial-six-arm-r1-plan.json](../../../brain/benchmarks/compact-format-v2/runs/initial-six-arm-r1-plan.json).
All 324 calls completed. [E141](../../evidence/experiments/e141-label-only-compact-enters-targeted-holdout.md)
selects label-only compact for the fresh targeted holdout. Full v0-style
compact did not pass the development gate.

## Focused suite

The initial suite must include the 8c1 stress families:

- progression generation;
- melody generation;
- role continuation; and
- chord revoicing.

Use motif continuation as the repeated-prompt sentinel. Add small structure,
local-transformation, and rhythm-transformation guards so an improvement does
not hide a regression on easier tasks. Use fresh generated fixtures that are
not copies or close parameter variants of retained 8c1 fixtures.

Run OpenAI, Gemini, and Claude with matched low-effort settings. Use the same
semantic fixture, task wording, and scoring rule for every eligible arm. Keep
native musical success separate from stable identity, exact preservation, and
sparse-edit capability.

## Targeted holdout

The frozen holdout package is
[documented here](../../../brain/benchmarks/compact-format-v2/HOLDOUT.md).
Its run ID is `phase8c2-targeted-holdout-r1`. Its protocol SHA-256 is
`1d3787c4230d8c50f2f261a6c9a975bc03e9d79b574c2ca735dab3eb5ca615b5`.
The exact
[run plan](../../../brain/benchmarks/compact-format-v2/runs/targeted-holdout-r1-plan.json)
received separate operator approval before provider calls.

The arms are label-only compact, compact-bar v1, exact JSON, and native
MIDI-Like. Each provider gets 72 calls. The total scope is 216 calls. The
fixtures have no hash overlap with the initial development or retained v1
cohorts. The motif prompt gives the required new-note IDs. Do not revise the
candidate from the holdout result.

All 216 calls completed. [E142](../../evidence/experiments/e142-label-only-compact-fails-targeted-holdout.md)
records `do-not-select`. Label-only compact passed the provider gate only on
Claude. It had no hard-family macro improvement over compact-bar v1 on OpenAI
or Gemini. No compact candidate enters Phase 8c3, and Phase 8f stays blocked.

The recorded holdout cost was USD 1.756934 against the approved USD 2.150309
estimate. The corrected report SHA-256 is
`18c3a6fd8e5235e23c9ddc3682dacb818e8585620a9e67e382d32bcde759fd87`.
The frozen protocol had a reporting-only missing import. The separate reporter
verified the run identities and applied the unchanged gate without changing
the provider-bearing protocol.

## Iteration rules

After the initial run, classify failures before changing a format. Each later
iteration must name one bounded hypothesis, its affected syntax, and its
expected effect. Candidate hypotheses include:

- keyed or self-describing event fields;
- canonical role lanes and voice ordering;
- explicit bar, meter, harmony, track, and region hierarchy;
- onset or chord-group blocks for vertical relationships; and
- another bounded single-representation change supported by the prior result.

Test at least the hypotheses that the initial result supports. More than one
later iteration is allowed. Do not add a second score or exact side ledger to
a compact product candidate. A candidate must keep one canonical musical
representation.

For each iteration:

1. Freeze a versioned protocol, fixtures, prompts, scorer, and stopping rule.
2. Run deterministic rendering, parsing, capability, and scorer checks.
3. Prepare the provider call count and cost estimate.
4. Get explicit operator approval for that named run.
5. Run the same approved scope on all three providers.
6. Record results, actual API cost, token use, output size, and the next
   hypothesis or stop decision.

Do not change a protocol after provider calls start. If the result suggests a
new syntax, create a new protocol and new development fixtures.

## Cost authorization

The former USD 5 soft ceiling does not apply to Phase 8c2 or Phase 8c3. Before
every provider-bearing pilot, diagnostic, development, or holdout run, give
the operator:

- the exact arm, task, trial, and provider scope;
- the expected call count for each provider and in total;
- the model and inference settings; and
- the estimated cost for each provider and in total.

Do not make provider calls until the operator explicitly approves that named
run. Approval for one run does not approve a later iteration. Stop and request
new approval if the scope or estimate changes materially. Record API-reported
actual cost after each run. The operator's provider dashboards remain the
external spend authority.

## Measurement correction

Do not use one broad `alignment failure` label for every composite exception.
Report these classes separately:

- an explicit score and side-ledger disagreement;
- a missing or invalid side ledger;
- a native-score parse failure; and
- another output or patch parse failure.

Show each numerator and its eligible denominator. Keep side-ledger failures
separate from product-format capability. A side ledger can diagnose exact task
fields, but it is not a compact-format solution.

## Development and holdout gates

Freeze numeric margins before the first provider-bearing development run.
Keep them unchanged for comparable later iterations. A candidate can enter the
fresh targeted holdout only when it:

- improves the hard-family macro result over compact-bar v1;
- has no repeated candidate-only loss that is hidden by pooled results;
- does not regress the easy guard families beyond the frozen margin;
- passes deterministic syntax, identity, preservation, and sparse-patch
  checks where those capabilities apply; and
- keeps an acceptable size and token advantage over exact JSON.

The holdout must use unseen generated fixtures. Freeze its candidates,
controls, protocol, sample rule, and decision gate before provider calls. Do
not revise a candidate from its holdout result. A passing holdout selects one
or more compact candidates for Phase 8c3. It does not unblock Phase 8f.

## Outputs

- A versioned development package beside the fixed v0 and v1 packages.
- Renderer-parity and deterministic conformance tests for each compact arm.
- One manifest and cost record for every approved run.
- Iteration notes that connect each change to observed evidence.
- A fresh targeted holdout with a candidate-selection decision.
- A short handoff that names the compact candidates for Phase 8c3.

## Acceptance criteria

- The fixed v0 and v1 packages and hashes remain unchanged.
- No 8c1 retained output is a development or holdout fixture.
- The initial run contains all six named arms and all three providers.
- Later iterations follow the frozen, one-hypothesis rule.
- Every provider-bearing run has a prior named cost estimate and explicit
  operator approval.
- Every claimed format delta uses paired fixtures and reports its denominator.
- Broad composite parse failures are not reported as score-ledger
  disagreements.
- Initial and repaired responses remain separate.
- Provider variation, cost, token use, output size, and product capability
  remain explicit.
- The final targeted holdout is fresh and frozen before provider calls.
- No API key, provider cache, third-party composition, live project mutation,
  or temporary generated music remains in the repository.
- Focused benchmark tests, the complete brain check, `context/check.rb`, and
  `git diff --check` pass.

## Out of scope

- The full retained symbolic-format matrix, which belongs to Phase 8c3.
- Freezing the public compact-bar contract.
- Changing the cache contract or live Bitwig state.
- General musical-aesthetic ranking.
- Fine-tuning or training a provider model.
- External publication.

## Retrospective target

The label-only change did not cause a repeatable hard-family improvement. The
focused suite passed on all providers, but the fresh holdout passed only on
Claude. Exercise the final aggregation path before future paid calls.
