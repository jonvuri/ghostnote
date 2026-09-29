---
title: Phase 8c4e — Compact-candidate full benchmark
kind: plan
state: blocked
status: Blocked pending affine seed-dependence and ID-free freshness repair.
updated: 2026-09-29
parent: README.md
prev: 8c4d-follow-up-v18-low-effort-rehearsal.md
next: 8c4f-full-matrix-decision.md
evidence: E137, E140, E155, E174-E193; D21, D23-D24
---

# Phase 8c4e — Compact-candidate full benchmark

## Purpose

Measure both frozen compact candidates across the complete benchmark at the
lowest useful provider cost. Compare their quality and token size. Use this
result to decide whether a fresh full matrix is worth running.

This session does not claim a paired format advantage. The Phase 8c3 matrix
can provide historical context only because its fixtures and task contracts
are different.

## Entry conditions

- The v18 rehearsal is accepted as valid development evidence.
- Affine musical content depends on the fresh cohort seed.
- Affine and serialization freshness use an ID-free content hash.
- Both candidates, prompts, scorers, parsers, and repair policy remain frozen.
- A new full-suite cohort has no semantic overlap with any earlier
  provider-bearing cohort.
- Absolute gates and the matrix-value rule are frozen before calls.
- The operator approves the exact calls and provider cost.

The entry condition is not open. E192 records the completed v18 rehearsal.
E193 validates the run and finds a cross-cohort affine freshness flaw. Repair
that flaw before freezing the 8c4e cohort. No additional v18 provider run is
needed.

Reuse the v18 task schemas, scorers, and applicable assertions. Do not import
the stress-affine generator unchanged. Make its musical values and rules depend
on the new seed. Add an ID-free content hash and check its internal and
historical overlap. Create new fixture instances, cohort hashes, provider
schedule, cost plan and approval, and responses.

## Run scope

Run only `FIELDS` and local labels on OpenAI, Gemini, and Claude. Cover all
nine Phase 8c3 task families and the required repeated-prompt sentinels. Use
the repaired task contracts. Do not restore another format arm.

Report case and component musical accuracy, syntax, completion,
repair recovery, prompt and output size, input and output tokens, latency,
nondeterminism, and cost for each candidate.
Treat output-limit and unavailable results as unavailable, not musical
failures.

## Absolute and matrix-value decisions

Freeze absolute provider and family thresholds from calibration, development,
holdout, and the unmodified Phase 8c3 compact diagnostic. Do not derive a
threshold after seeing this run.

Return one evidence result:

- `matrix-plausible`: both candidates pass every absolute gate and have no
  unresolved recurring provider-family defect;
- `revise`: one or both candidates miss a bounded gate that justifies a new
  plan and new cohorts; or
- `stop`: the candidates do not justify a fresh full matrix or Phase 8f.

For `matrix-plausible`, prepare the exact fresh-matrix scope, calls, model
settings, expected cost by provider, hashes, paired gates, and stopping rule.
Do not make matrix calls in this session.

## Historical comparison limit

Compare this run with Phase 8c3 only as a directional diagnostic. Clearly
identify changes in fixtures, task contracts, arms, and denominators. Do not
call the historical comparison paired, and do not use it to estimate a causal
format delta.

## Acceptance criteria

- The full cohort is fresh and frozen before calls.
- Both candidates match their targeted-holdout hashes.
- Every full-suite family runs on all approved providers.
- Absolute thresholds and the matrix-value rule were fixed before calls.
- Musical results use independent cases and components, not a whole-response
  pass.
- The report gives enough cost and effect information for an operator matrix
  decision without assuming that the matrix will run.

## Retrospective target

Record whether the targeted suite predicted the full two-candidate result and
whether any remaining uncertainty can change the product decision.
