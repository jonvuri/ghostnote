---
title: Phase 8c4c follow-up — Symbolic benchmark hardening
kind: plan
state: complete
status: V14 freezes the corrected benchmark and fresh targeted holdout.
updated: 2026-09-28
parent: README.md
prev: 8c4c-compact-bar-paired-development.md
next: 8c4d-compact-bar-targeted-holdout.md
evidence: E137-E177; D21, D23-D24
---

# Phase 8c4c follow-up — Symbolic benchmark hardening

[E178](../../evidence/experiments/e178-symbolic-benchmark-hardening-freezes-v14.md)
records the completed audit and the passing offline v14 package. No provider
request occurred.

## Purpose

Audit the complete symbolic-format benchmark history. Consolidate every known
experiment-design issue, fix the current measurement package, and freeze a
robust benchmark before targeted holdout.

[E177](../../evidence/experiments/e177-gemini-local-label-diagnostic-selects-local-labels.md)
shows a repeated local-label benefit on the post-hoc Gemini stress diagnostic.
[D24](../../decisions/d24-forward-compact-benchmarks-retain-fields-and-local-labels.md)
retains both `FIELDS` and local labels for this follow-up and later validation.

Use the
[symbolic benchmark design backlog](../../evidence/format/SYMBOLIC_BENCHMARK_DESIGN_BACKLOG.md)
as the issue authority. This session makes no provider call.

## Entry conditions

- Phase 8c4c retains `FIELDS` and local labels after the Gemini diagnostic.
- The two candidate definitions and the evidence limit of E177 are explicit.
- Historical packages, manifests, and decisions remain unchanged.

## Completion

The audit and v14 offline package satisfy the acceptance criteria. V14 freezes
three arm hashes, a fresh 20-fixture cohort, 108 balanced messages per
provider, two decision repeats, effective provider settings, byte and token
reporting, a USD 3.050000 total hard limit, and explicit stop rules.

The old reserved v10 holdout is retired. The v14 protocol SHA-256 is
`749f890e5093ebfafdcedd435f8d9c87039b6ee28815bef7b72f73b723937123`.
The run-plan SHA-256 is
`33062e821d4d1679c680e340e8637d57c3fa12f686ab4bfe3fc90064851646df`.
No provider or token-count request occurred.

## Audit scope

Read E137 through E177 and inspect every provider-bearing and deterministic
package from compact-bar v0 through compact-format v13. Trace each format
claim through its task, prompt, response state, parser, scorer, aggregation,
sampling plan, provider settings, cost guard, and decision rule.

Classify every finding as open, resolved regression, design choice, or
historical limit. Record the affected versions and the exact regression test
or protocol rule that closes it.

## Corrected benchmark

Create a new versioned package. Do not edit a frozen package. At minimum:

- compare only `FIELDS` and local labels as compact candidates;
- keep exact-object JSON as the structured control;
- exclude positional v1 and every other retired format from provider calls;
- state one causal estimand for each comparison;
- prove every scored requirement is visible in the prompt;
- calibrate decision families away from floors and ceilings;
- report strict conformance and diagnostic component accuracy separately;
- report planned and scored denominators separately;
- randomize or balance arm order and predeclare repeats;
- record effective provider sampling and output settings;
- keep unavailable, failed, initial, and repaired states separate;
- use exact cost accounting with a pre-call bound;
- preflight credentials and network access;
- report attempted, completed, failed, and stopped work accurately; and
- prove cohort freshness and immutable run identity.

Report prompt bytes, response bytes, input tokens, and output tokens for both
compact candidates. Keep these size results separate from musical quality and
strict conformance.

Decide whether the reserved Phase 8c4a holdout remains valid. Replace it with
a fresh frozen cohort if a task, scorer, prompt, candidate, or decision metric
changed in a way that can affect the holdout result.

## Acceptance criteria

- The backlog covers E137 through E177 and every benchmark package in scope.
- Each open issue has a tested repair or an explicit protocol decision.
- Historical claims state their remaining authority and comparability limits.
- The corrected package passes deterministic, mutation, visibility,
  aggregation, cost, and failure-state tests.
- Both retained candidates have immutable hashes in the corrected package.
- A fresh targeted-holdout plan states its cohort, providers, settings, calls,
  repeats, gates, cost, and stopping rule before approval.
- No provider call occurs.

## Retrospective target

Record which earlier cycle could have ended sooner with the corrected design.
Keep only controls that can change the product decision.

The v10 cycle could have ended before paid development if it had required
prompt-to-scorer visibility, repeat coverage, and retained realized order.
Those controls now run before approval. No additional process change is
needed.
