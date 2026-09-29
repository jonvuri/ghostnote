# Phase 8c4e full compact-candidate protocol

## Purpose

Measure the frozen `FIELDS` and local-label candidates across the full task
suite. Decide whether a fresh full format matrix is plausible. This run does
not select a public format or authorize a matrix.

## Workload

Run seven fresh fixtures for each of the nine Phase 8c3 task families. Repeat
the first prompt in each family as a nondeterminism sentinel. Run two literal
serialization controls without repeats. This gives 148 messages per provider
and 444 messages in total.

The analysis contract uses three cases per prompt. The continuation-motif
contract uses seed-dependent, voice-conditioned affine rules and a final
canonical sort. The other seven families use the frozen Phase 8c3 theory
contracts with fresh musical values.

The prompt is the experimental unit. Cases and components are outcomes within
one prompt. Report providers, families, and candidates separately.

## Freshness

Each task has a full hash and an ID-free content hash. The content hash excludes
synthetic cohort, fixture, source-note, output-note, and group IDs. It includes
musical values, transformation rules, contracts, and references.

Require zero internal or historical overlap for full, semantic, analysis-case,
and ID-free content hashes. A different cohort name is not fresh evidence.

## Decisions

Provider completion must reach 95 percent. Each provider-family-candidate cell
must score at least 80 percent of its planned prompts.

A decision cell must reach 70 percent for global component accuracy, average
case accuracy, and canonical conformance. It must reach 80 percent structural
conformance. A serialization cell must reach 90 percent component, structural,
and canonical conformance.

Return `matrix-plausible` when every cell passes and no sentinel has a recurring
defect. Return `revise` for at most three isolated failed cells when the same
candidate-family pair does not fail on two providers. Return `stop` otherwise.

Structural and canonical failures are benchmark outcomes. They do not make a
completed experiment invalid. Ninety percent is a maximum task-calibration
target, not a minimum validity threshold.

## Providers and cost

Use the frozen low-effort settings in the run plan. Make no retry or repair
call. Stop one provider on its first transport or budget failure or after three
unavailable responses.

The measured-cost estimate is USD 4.270000. Provider hard limits are USD
0.950000 for OpenAI, USD 0.600000 for Gemini, and USD 4.000000 for Claude
Haiku. The total hard limit is USD 5.550000. Reserve the full next-call bound
before each request. Retain a failed reservation.

No provider request is approved by this package. Approval must match every
frozen identity, schedule, and cost field.
