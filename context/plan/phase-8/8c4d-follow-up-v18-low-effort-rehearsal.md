---
title: Phase 8c4d follow-up — V18 low-effort rehearsal
kind: plan
state: complete
status: OpenAI completed 66/66. The run is valid development evidence after an interpretation correction and sampled audit.
updated: 2026-09-29
parent: README.md
prev: 8c4d-follow-up-v17-harder-medium-difficulty.md
next: 8c4e-compact-only-full-benchmark.md
evidence: E189-E193; D21, D23-D24
---

# Phase 8c4d follow-up — V18 low-effort rehearsal

## Purpose

Run the last development rehearsal before Phase 8c4e. Test the chosen task
structure at OpenAI low effort. Preserve the v15 formats, component scorer,
parsers, and operational controls.

This rehearsal can freeze a reusable task design. It cannot select a format or
authorize live Phase 8c4e work.

## Workload

Use [`compact-format-v18`](../../../brain/benchmarks/compact-format-v18/README.md).
Run five fixtures per stratum, decision family, and format. Run two literal
serialization controls per format. Use one sample, no retry, and no repair.
The maximum is 66 OpenAI messages.

The elemental stratum isolates format handling:

- analysis has one chord and motif case;
- affine continuation has one global rule; and
- serialization copies literal values.

The real-use stress stratum keeps useful task interactions:

- analysis has three interleaved cases, eight-value motifs, four distractors,
  and a declared mixed chord distribution; and
- affine continuation has voice-conditioned rules, source-bound output IDs,
  and a final canonical sort.

Use common rational denominators. Do not increase distractor count. Report the
two strata separately. Do not publish one pooled musical headline.

## Measurement

The prompt is the experimental unit. Cases and components are outcomes within
a prompt. Report these values for each family, stratum, and format:

- global component accuracy;
- average per-case component accuracy;
- perfect case count and rate;
- structural parse conformance; and
- canonical form conformance.

Five prompts give a 20-point prompt-level step. Use this run only for coarse
validity and calibration. Do not report it as an effect estimate.

## Decision

Return `freeze-for-8c4e` only when all operational gates pass and all of these
conditions hold:

- every elemental arm reaches 80 percent component accuracy;
- each stress-family median is from 50 through 95 percent;
- no stress arm is below 40 percent;
- every serialization arm reaches 90 percent; and
- every scored cell reaches 90 percent structural validity.

Return `revise` when a valid run misses a task gate. Return `invalid` for an
operational or structural failure. Exact JSON is a valid format. It has no
separate capability-control gate.

## Transfer to Phase 8c4e

`suite.py` owns the reusable task schemas, generators, and exact distribution
checks. Phase 8c4e can reuse these items unchanged:

- candidate definitions and hashes;
- task schemas and generator logic;
- parsers and component scorers;
- report schema and offline assertions; and
- cost and approval guards.

Phase 8c4e must create fresh fixture instances, cohort seed and hashes,
provider schedule, approval and cost plan, and provider responses. The
development cohort must not enter the confirmatory run.

## Provider, cost, and stop

Use `gpt-5.4-mini-2026-03-17` at low reasoning with a 12,000-token output
limit. The measured-cost estimate is USD 0.400000. The provider and total hard
limit is USD 0.650000. Reserve the full next-call bound before each request.
Retain a failed reservation.

Stop after OpenAI. Do not run Gemini, Haiku, medium effort, or Phase 8c4e under
this approval.

## Result

[E192](../../evidence/experiments/e192-v18-low-effort-rehearsal-is-operationally-complete.md)
records the completed run. OpenAI completed 66/66 messages with no failed,
unavailable, or budget-stopped row. The run cost USD 0.261846.

The frozen summary contains `decision: invalid` because the protocol encoded
90 percent structural validity as a minimum. The operator clarified that 90
percent was a maximum task-performance target. The omitted output field is a
measured model failure, not an invalid experiment. The run is operationally
valid development evidence.

Stress analysis reached the maximum target at 90 percent median component
accuracy. Stress affine remained too easy at 99.5349 percent.

E193 records the sampled end-to-end audit. It found no flaw in the v18 run. It
did find that a new cohort can repeat the stress-affine content while changing
only synthetic IDs. Do not import the suite unchanged. Repair seed dependence
and ID-free freshness in the 8c4e package. Do not rerun v18.

## Acceptance criteria

- The 22 fixtures and 20 analysis cases are internally unique.
- The cohort has no full, semantic, or analysis-case historical overlap.
- The exact elemental and stress chord distributions match the protocol.
- Every reference answer receives full case and component credit.
- A one-component mutation loses one component only.
- Every stress affine fixture covers all voice rules and requires output sort.
- Every scored requirement is visible in every prompt.
- Every request fits the 10,000-byte request limit.
- The schedule has 66 OpenAI-low messages.
- The approval binds the protocol, plan, cohort, candidates, runner, and cost.

## Retrospective target

Check whether one shared suite module lets Phase 8c4e change only cohort and
run-plan data. Do not copy task logic into another wrapper.
