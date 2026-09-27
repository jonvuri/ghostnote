---
title: Phase 8c4d — Compact-bar targeted holdout
kind: plan
state: planned
status: Test the frozen compact-bar candidate on a disjoint affected-family holdout.
updated: 2026-09-27
parent: README.md
prev: 8c4c-compact-bar-paired-development.md
next: 8c4e-compact-only-full-benchmark.md
evidence: E140-E146, E155; D21, D23
---

# Phase 8c4d — Compact-bar targeted holdout

## Purpose

Test whether the exact compact-bar candidate selected in development repeats
its result on unseen affected-family and guard fixtures.

## Entry conditions

- Phase 8c4c freezes one compact candidate and its complete hash.
- The candidate, task contracts, scorers, parser, and repair policy are
  unchanged after development.
- The targeted-holdout corpus and gates were frozen before development calls.
- The operator approves the exact holdout scope and provider cost.

## Holdout scope

Run the selected compact candidate and exact-object JSON on OpenAI, Gemini,
and Claude. If development selected the `FIELDS` candidate, also run
positional v1 to verify the claimed improvement. Do not run the rejected
`FIELDS` arm when development selected positional v1.

Use the fresh analysis, motif, progression, and guard fixtures reserved in
Phase 8c4a. Keep every provider and task family separate. Keep initial and
repaired responses separate.

## Decision rule

Use the paired margins, repeated-loss rule, syntax threshold, completion
threshold, size budget, and deterministic capability gates frozen before the
calls.

Return one result:

- `select-compact`: the candidate passes every frozen holdout gate;
- `revise`: the candidate misses a bounded gate that supports a new plan and
  a new cohort; or
- `stop`: the result does not justify more compact-bar provider work.

Do not tune against holdout responses. A `select-compact` result freezes the
candidate for the rest of the Phase 8c4 sequence. It does not yet unblock
Phase 8f.

## Acceptance criteria

- No holdout fixture appeared in calibration, development, or an earlier
  provider-bearing run.
- The candidate and measurement package match their frozen hashes.
- Every claimed delta is paired on the same fresh semantic fixture.
- Unavailable results stay outside scored denominators.
- The decision follows the frozen provider and family gates.
- The next full benchmark cannot change the candidate.

## Retrospective target

Record which development effects repeated and whether the focused suite
predicted each holdout failure.
