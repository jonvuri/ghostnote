---
title: Phase 8c4e — Compact-candidate full benchmark
kind: plan
state: complete
status: The adaptive component assessment is matrix-plausible. Every measured cell passes; Claude analysis remains unavailable.
updated: 2026-09-29
parent: README.md
prev: 8c4d-follow-up-v18-low-effort-rehearsal.md
next: 8c4f-full-matrix-decision.md
evidence: E137, E140, E155, E174-E196; D21, D23-D24
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

E192 records the completed v18 rehearsal. E193 validates that run and records
the cross-cohort affine freshness flaw. E194 records the repaired 8c4e package
and frozen run plan. No additional v18 provider run is needed.

Reuse the v18 task schemas, scorers, and applicable assertions. Do not import
the stress-affine generator unchanged. Make its musical values and rules depend
on the new seed. Add an ID-free content hash and check its internal and
historical overlap. Create new fixture instances, cohort hashes, provider
schedule, cost plan and approval, and responses.

## Frozen preparation result

[`compact-format-v19`](../../../brain/benchmarks/compact-format-v19/README.md)
freezes the fresh cohort, two candidates, 148-message provider schedules,
absolute gates, matrix-value rule, and cost guard. It covers all nine Phase
8c3 families and two literal serialization controls.

Affine musical values and voice rules now depend on the cohort seed. Every
task has an ID-free content hash. The audit found no internal or historical
full, semantic, or analysis-case overlap. It found no ID-free content overlap
with v18 or another stored content hash.

The measured-cost estimate was USD 4.270000. The total hard limit was USD
5.550000. The operator approved the exact plan on 2026-09-29.

## Result

[E195](../../evidence/experiments/e195-v19-openai-makes-stop-irreversible.md)
records the completed OpenAI stage and the `stop` result. OpenAI completed all
148 messages at USD 0.713277. Five cells outside the defective revoice family
failed frozen gates. The frozen `revise` bound permits at most three failed
cells. The result cannot change if every unrun provider passes.

The between-provider rule stopped the run before Gemini and Claude Haiku. They
made no call. The stop avoided 296 messages and an estimated USD 3.520000.

The audit found one measurement defect. The revoice exact scorer requires 16
synthetic output IDs that the prompt does not provide. Keep the frozen package
and manifest unchanged. Exclude the two revoice cells and their sentinel flags
from candidate interpretation. They are not needed for the `stop` decision.

## Adaptive decision update

The operator replaced the strict decision interpretation after reviewing the
OpenAI results. This benchmark is a product benchmark, not a confirmatory
scientific experiment. Carry completed provider results and useful fixtures
forward when a measurement issue is repairable without a new provider call.

Use global component accuracy as the product gate. Require 70 percent for each
decision-family cell and 90 percent for each serialization cell. Keep provider
completion and scored coverage as operational gates. Report structural parse,
canonical form, and average case accuracy as diagnostics. Do not use them as
separate product gates.

For revoice, align notes within each exact onset without coupling field errors.
Score voice, start, duration, pitch, velocity, and exact note count. Do not
require an output ID that the prompt did not disclose. Keep ID behavior as a
diagnostic.

Retain the completed OpenAI manifest. Do not rerun it. Continue the unchanged
Gemini and Claude Haiku schedules under the existing approval and cost limits.
The provider prompts, fixture parameters, models, and request settings remain
unchanged. E195 remains the result of the earlier strict policy. It does not
control the updated product decision.

## Adaptive result

[E196](../../evidence/experiments/e196-v19-adaptive-component-assessment-is-matrix-plausible.md)
records `matrix-plausible`. OpenAI and Gemini completed and passed all 20 cells.
Claude passed all 18 measured cells across eight families. Its two analysis
cells remain unavailable after repeated output limits.

The sampled audit found that the analysis freshness transform did not update
`key_tonic_pc`. The corrected assessment excludes the invalid function
component and retains the other seven analysis components. It also prevents
coupled revoice field errors and requires the expected note count. All measured
cells still pass. Across all providers, `FIELDS` is more accurate in aggregate
and produces 42.3 percent fewer response bytes than local labels.

Known provider cost is USD 2.838976250. The maximum exposure is USD
3.102976250 after a conservative USD 0.264000 reservation for two unretained
Claude recovery requests. Do not make fresh matrix calls in this session.

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

The targeted suite did not catch the restored revoice contract defect. The
adaptive assessment repaired that scoring layer without discarding provider
responses. Separate fixtures, responses, scoring, diagnostics, and policy so a
future repair can replace only the invalid layer.
