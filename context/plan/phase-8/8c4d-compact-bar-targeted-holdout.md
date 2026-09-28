---
title: Phase 8c4d — Compact-bar targeted holdout
kind: plan
state: planned
status: Test FIELDS and local labels after the complete benchmark-hardening audit.
updated: 2026-09-28
parent: README.md
prev: 8c4c-follow-up-symbolic-benchmark-hardening.md
next: 8c4e-compact-only-full-benchmark.md
evidence: E137-E177; D21, D23-D24
---

# Phase 8c4d — Compact-bar targeted holdout

## Purpose

Test both retained compact candidates on unseen affected-family and guard
fixtures. Measure quality and token size on the same paired work.

## Entry conditions

- The hardening follow-up freezes `FIELDS` and local labels with complete
  hashes.
- The symbolic benchmark hardening follow-up closes or explicitly accepts
  every issue in its design backlog.
- Both candidates, task contracts, scorers, parsers, and repair policy are
  frozen in one new versioned measurement package.
- The targeted-holdout corpus and gates are fresh and frozen before holdout
  calls. The hardening audit decides whether the old reserved corpus remains
  valid.
- The operator approves the exact holdout scope and provider cost.

## Holdout scope

Run `FIELDS`, local labels, and exact-object JSON on OpenAI, Gemini, and
Claude. Exact JSON is the structured control. Do not run positional v1 or any
other retired format.

Use the fresh analysis, motif, progression, and guard fixtures reserved in
Phase 8c4a. Keep every provider and task family separate. Keep initial and
repaired responses separate.

## Decision rule

Use the paired margins, repeated-loss rule, syntax threshold, completion
threshold, size budget, and deterministic capability gates frozen before the
calls. Report prompt bytes, response bytes, input tokens, and output tokens
for both compact candidates.

Return one result:

- `retain-both`: both candidates pass every frozen holdout gate;
- `revise`: one or both candidates miss a bounded gate that supports a new
  plan and a new cohort; or
- `stop`: the result does not justify more compact-bar provider work.

Do not tune against holdout responses. A `retain-both` result freezes both
candidates for the rest of the Phase 8c4 sequence. It does not yet unblock
Phase 8f. Any decision to remove one retained candidate needs explicit
operator direction.

## Acceptance criteria

- No holdout fixture appeared in calibration, development, or an earlier
  provider-bearing run.
- Both candidates and the measurement package match their frozen hashes.
- Every claimed delta is paired on the same fresh semantic fixture.
- Unavailable results stay outside scored denominators.
- The decision follows the frozen provider and family gates.
- The next full benchmark cannot silently remove either candidate.

## Retrospective target

Record which development effects repeated and whether the focused suite
predicted each holdout failure.
