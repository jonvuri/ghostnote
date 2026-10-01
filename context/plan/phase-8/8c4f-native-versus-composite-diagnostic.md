---
title: Phase 8c4f — Native versus composite diagnostic
kind: plan
state: complete
updated: 2026-09-30
phase: phase-8-agent-native-live-engine
session: phase8c4f-native-composite-closeout
---

# Phase 8c4f — Native versus composite diagnostic

## Goal

Run the separate diagnostic required by the
[eight-arm matrix plan](8c4f-follow-up-eight-arm-full-matrix.md). Compare each
native notation with its composite form on eligible tasks and common fields.
Use the [corrected matrix](../../evidence/experiments/e209-offline-score-repair-updates-eight-arm-matrix.md)
as baseline context. Do not pool these runs or treat their different component
denominators as the same metric.

## Frozen scope

This section records the original approved scope. The run checkpoint below
records the operator's later decision to close with two providers.

Use ABC 2.1, Strudel 1.2.0, LilyPond 2.24.4, and MusicXML 4.0. Each has native
and composite arms. Score voice, start, duration, and pitch. Exclude stable
note IDs, velocity, document metadata, sparse edits, and exact preservation.

Use three fresh tasks in each of six families: structure comprehension,
analysis comprehension, progression generation, melody generation, motif
continuation, and role continuation. Repeat the first fixture in each family
once as an exact sentinel. This is 24 messages per arm, 192 per provider, and
576 messages in total. Claude can make at most 192 token-count requests.

Keep the matrix models and low-effort settings. Keep the 12,000-token output
limit and omit temperature. The
[protocol](../../../brain/benchmarks/native-composite-v1/PROTOCOL.md) defines
the subsets, native assumptions, task transforms, scoring, uncertainty,
provider settings, price sources, and stop rules.

## Preparation acceptance criteria

1. Freeze all 18 unique tasks, native eligibility cells, paired prompts,
   reference outputs, and provider schedules.
2. Prove that both conditions carry the same common musical values. Native
   prompts must contain no Ghostnote ledger or note identity requirement.
3. Verify input and reference round trips in every subset. Test rational timing,
   overlap lanes, explicit ABC accidentals, and Strudel weight/slow semantics.
4. Verify common-field matching, exact note count, empty-output failure,
   generation constraints, analysis group selection, and affine references.
5. Verify that incomplete pairs and sentinel repeats do not enter the primary
   paired denominator.
6. Retain the corrected matrix hash and all provider/family baseline cells.
7. Freeze reproducible cost estimates, exact model/settings hashes, and hard
   limits. Verify approval before credential or network access.
8. Pass focused tests, the complete brain check, `context/check.rb`, and
   `git diff --check`. Stage only this session. Do not commit.

## Approval and cost

The run ID is `phase8c4f-native-composite-diagnostic-r1`. The
[frozen run plan](../../../brain/benchmarks/native-composite-v1/runs/diagnostic-r1-plan.json)
has hash `7c51f49328c0392cabb36b41fe68b7f739427afdabe547f69cb64d63d8858dfe`.

| Provider | Messages | Estimated USD | Hard limit USD |
|---|---:|---:|---:|
| OpenAI | 192 | 1.824038 | 2.75 |
| Gemini | 192 | 0.470684 | 1.00 |
| Claude Haiku | 192 | 5.038000 | 7.00 |
| Total | 576 | 7.332722 | 10.75 |

Estimate from retained matrix token usage by provider, format, and family.
Assume no native cost saving. Prices were checked on 2026-09-30. The runner
rejects execution after the frozen price period ends on 2026-12-31.

The operator approved this exact plan. The
[approval record](../../../brain/benchmarks/native-composite-v1/runs/diagnostic-r1-approval.json)
retains the statement. Approval must match the run,
protocol, plan, cohort, candidate, schedule, and cost hashes. Record the
operator's statement. The provider attempt record prevents a second execution
under this run ID. Recovery needs a separate freeze and approval.

Stop on the first transport, budget, approval, model identity, freshness, or
deterministic-screen failure. Stop after three unavailable outputs. Make no
automatic retry, repair, or continuation call. Retain failed reservations.

## After approval

Run each provider once. Verify and retain raw payloads, usage, costs, identity,
completion, and scores. Report native minus composite effects by provider,
family, and format. Report incomplete pairs, subset conformance, notation and
ledger agreement, costs, tokens, latency, and sentinel outcomes separately.
Manually audit one case in each provider, family, and format pair.

This small diagnostic has coarse uncertainty. It does not establish provider
training familiarity or full native capabilities. It cannot select a product
format or authorize Phase 8f automatically.

## Run checkpoint

[E211](../../evidence/experiments/e211-native-composite-diagnostic-closes-with-two-providers.md)
records the approved execution and audit. OpenAI and Gemini each have 192
scored outcomes and 72 complete unique pairs. The operator chose to skip
Claude, remove its diagnostic results, and close with two providers. No
Claude recovery is planned. Retained results cost USD 2.52608325. Total
incurred cost remains USD 2.87742225, including the discarded Claude attempt.
The original approval and attempt controls remain unchanged. No retry or
recovery is authorized. Product format choice still needs operator review.

## Full grammar follow-up

The operator requested manual review of the native profile penalty and
composite ledger credit. Three auditors completed eight format assignments.
[E212](../../evidence/experiments/e212-full-grammar-audit-measures-native-composite-asymmetries.md)
records public grammar judgments, independent note values, and sensitivity
results for all 240 unique note outputs. No provider call or frozen score
change was made. Read these results before the product format decision.

The operator then requested integration of the adjudications into scoring.
[E213](../../evidence/experiments/e213-audit-adjudications-update-native-composite-scoring.md)
records a separate revised policy, assessment, and report. Both note conditions
use audited notation values. Analysis scores remain unchanged. All 48 paired
cells were recomputed. The original frozen assessment remains available.

## Boundaries and retrospective

Keep previous frozen packages and responses unchanged. Keep the cache,
`normal-v1`, and live Bitwig projects unchanged.

Keep native timing tests separate from ledger alignment tests. A valid ledger
can hide an incorrect native timing interpretation. Record this check before
each later notation freeze.

Put a primary group before sentinel repeats in a later schedule. An early
stop after a repeat group can leave no complete primary pair.
