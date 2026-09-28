---
title: Current state
kind: status
state: active
updated: 2026-09-28
phase: phase-8-agent-native-live-engine
session: phase8c4c-symbolic-benchmark-hardening
---

# Now

[Phase 8c4c](plan/phase-8/8c4c-compact-bar-paired-development.md) is complete.
[E177](evidence/experiments/e177-gemini-local-label-diagnostic-selects-local-labels.md)
records the frozen Gemini diagnostic result: `select-local-labels`.
[D24](decisions/d24-forward-compact-benchmarks-retain-fields-and-local-labels.md)
supersedes that single-candidate consequence for forward work. Retain both
`FIELDS` and local labels as compact candidates.

All 32 approved requests completed for USD 0.057254. No request failed,
retried, or reached a budget stop. Both arms passed syntax on all 16
responses.

Local labels passed 8/8 analysis responses and 64/64 field checks. Current
`FIELDS` passed 1/8 responses and 37/64 checks. Local labels passed both
analysis cases on all four repeats. Every frozen selection gate passed.

Progression was diagnostic only. Local labels passed 3/8 and `FIELDS` passed
1/8. Do not use this difference as promotion evidence because the task remains
at a reasoning floor.

The result is limited to post-hoc Gemini stress cases. It does not establish a
fresh family effect, cross-provider benefit, public format, or holdout result.

E177 remains strong evidence for local binding on its post-hoc stress cases.
It is not authority to remove `FIELDS`. Earlier evidence found that compact-bar
was the strongest musical format and that `FIELDS` improved on positional v1.
The two retained arms also preserve a useful quality-versus-token-size
comparison.

The
[symbolic benchmark hardening follow-up](plan/phase-8/8c4c-follow-up-symbolic-benchmark-hardening.md)
is ready. Audit E137 through E177 and compact-bar v0 through compact-format
v13. Create a new corrected package and freeze both candidate definitions
before targeted holdout.

Use exact-object JSON as the structured control. Retire positional v1 and all
other earlier compact formats from new provider calls. Preserve their frozen
artifacts for history and offline regression tests.

## Immediate work

1. Complete the offline symbolic benchmark-hardening follow-up.
2. Update the durable design backlog with every affected benchmark version.
3. Freeze one corrected package, both candidate hashes, fresh validation
   scope, size metrics, cost, and stopping rule before provider approval.
4. Do not make a provider call, start targeted holdout, change the cache,
   change `normal-v1`, or change a live Bitwig project.

Phase 8c4d and Phase 8f remain blocked.

## Retrospective

Keep multiple candidates when the main tradeoff is still useful to measure.
Retire arms that cannot change the product decision.
