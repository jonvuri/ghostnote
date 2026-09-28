---
title: Phase 8c4d — Compact-bar targeted holdout
kind: plan
state: planned
status: V14 is frozen and awaits exact provider approval.
updated: 2026-09-28
parent: README.md
prev: 8c4c-follow-up-symbolic-benchmark-hardening.md
next: 8c4e-compact-only-full-benchmark.md
evidence: E137-E178; D21, D23-D24
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

The offline conditions are complete in
[`compact-format-v14`](../../../brain/benchmarks/compact-format-v14/README.md).
The provider-approval condition remains open.

## Holdout scope

Run `FIELDS`, local labels, and exact-object JSON on OpenAI, Gemini, and Claude
Haiku. Exact JSON is the structured control. Do not run positional v1 or any
other retired format.

Use eight fresh four-case analysis fixtures, eight fresh input-bearing affine-
continuation fixtures, and four fresh document-serialization guards. Run two
repeats for each decision fixture and one repeat for each guard. This is 108
messages per provider and 324 messages in total.

Do not use the old Phase 8c4a or v10 reserved holdout. Candidate, prompt, task,
scorer, sampling, and decision metrics changed. The v14 cohort has no full,
semantic, or analysis-case overlap with the frozen historical snapshot.

Keep every provider and task family separate. V14 makes no repair call and no
automatic retry. It retains unavailable, failed, initial, and absent repaired
states separately.

## Decision rule

Use the frozen two-row noninferiority margin, repeated-loss rule, 87.5 percent
syntax threshold, 95 percent completion threshold, exact-control gate,
informative-family band, size budget, and deterministic capability gates.
Report prompt bytes, response bytes, input tokens, and output tokens for both
compact candidates.

Return one result:

- `retain-both`: both candidates pass every frozen holdout gate;
- `revise`: one or both candidates miss a bounded gate that supports a new
  plan and a new cohort; or
- `stop`: the result does not justify more compact-bar provider work.

Do not tune against holdout responses. A `retain-both` result freezes both
candidates for the rest of the Phase 8c4 sequence. It does not yet unblock
Phase 8f. Any decision to remove one retained candidate needs explicit
operator direction.

Use OpenAI `gpt-5.4-mini-2026-03-17`, Gemini `gemini-3.8-flash`, and Claude
`claude-haiku-4-5-20251001` with the exact v14 settings. The recent-cost
estimate is USD 2.715000. The provider hard limits total USD 3.050000.

Stop before calls on identity, freshness, deterministic, credential, network,
or cost-capacity failure. Stop a provider on the first transport or budget
failure, or after three unavailable responses.

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
