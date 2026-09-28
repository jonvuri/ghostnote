---
title: E162 — Haiku substitution awaits approval
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4b-focused-compact-calibration.md
---

# E162 — Haiku substitution awaits approval

## Verdict

The offline Haiku substitution passes. Calibration r4 is frozen at the
provider approval gate. Do not make a provider call until the operator
approves the exact protocol hash, run-plan hash, call limit, and cost limit.

The new package is
[`compact-format-v7`](../../../brain/benchmarks/compact-format-v7/README.md).
It does not change the frozen v6 package or any r3 result.

## Provider-tier correction

GPT-5.4 Mini and Gemini 3.8 Flash are cost-efficient model tiers. Sonnet 5 is
a higher-capability and higher-cost tier. Its r3 ceiling made the comparison
less informative and increased cost.

Calibration r4 substitutes `claude-haiku-4-5-20251001`. It retains Gemini's
complete 3/5 r3 result. It authorizes zero new Gemini, OpenAI, or Sonnet calls.

Haiku uses manual extended thinking. The request sets the minimum supported
1,024-token budget and a 5,000-token total output limit. It does not send the
unsupported Sonnet `effort` setting or a temperature.

## Frozen cohort reuse

R4 reuses the exact v6 easy cohort. Haiku has not received this cohort. The
reuse gives a direct matched comparison without rerunning Gemini.

The harness verifies the v6 core, cohort manifest, deterministic manifest,
Gemini manifest, r3 summary, Gemini raw-run hash, every prompt hash, the
retained 3/5 gate, and every generated fixture formula before it reads a
credential. No prompt, fixture, scorer, repair rule, or eligibility boundary
changed.

This is a narrow exception to the fresh-cohort rule for a new model. It does
not permit a Gemini or Sonnet rerun or task tuning from r3 responses.

The offline screen passes 85 checks. The easy-cohort SHA-256 is
`edd1f29d71d049d3f9bfda1915a62879d23143abc596053070441015a2607374`.
The dependency-manifest SHA-256 is
`82622f1e09c21e67115ac23f4a0f79f739ee3cc045b0d36f01427ff8575ee209`.
The deterministic package SHA-256 is
`b6f5a49e86042f15631956e69fda7329b6b20b4c9ca1e1fb9a6b0bbff6f8fb67`.

## Frozen calibration r4

The run ID is `phase8c4b-analysis-haiku-calibration-r4`. The protocol SHA-256
is `5d481e5be3975f023c6284bfc76ac31ca88f266c4845e2294d9b42787348a211`.
The run-plan SHA-256 is
`ab4410d6330f15cf6237467b3f70325bebbc559e1481ff3df54a00bf20ecbcc5`.

Haiku has six initial calls and at most six repair calls. The maximum is 12
calls and USD 0.188385. The estimate reprices the maximum observed r3 Sonnet
easy-tier call at Haiku rates and adds 25 percent.

No provider call occurred in this preparation. The pending approval record
rejects a provider run before it reads the credential file.

## Decision

Retain Gemini's complete 3/5 result. Return `analysis-repair-pass` only when
all five unique Haiku initial results are scored and Haiku passes 1 through 4.
Return `repair-measurement` after a floor, ceiling, or incomplete result.

A pass restores only the analysis entry condition beside the retained r2
motif and progression results. It cannot select a format or approve Phase
8c4c provider calls.

## Approval boundary

Approval must name the run and exact hashes. It must allow no more than 12
calls and USD 0.188385. R3 approval does not carry to r4.

Phase 8c4b remains active. Phase 8c4c and Phase 8f remain blocked.

## Retrospective

Match provider capability and cost tiers before freezing a cross-provider
calibration. An unseen replacement model can use an unchanged frozen cohort
without repeating retained providers.

## Follow-up

The operator approved the exact r4 boundary. Haiku then produced an incomplete
result. [E163](e163-haiku-r4-is-incomplete-under-extended-thinking.md) records
`repair-measurement`, the output-limit failures, and the cost-control finding.
