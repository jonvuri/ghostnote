# V18 low-effort rehearsal protocol

## Purpose

Check whether the selected task design is valid at OpenAI low effort before
Phase 8c4e. This rehearsal does not estimate a format effect and does not
select a format.

## Workload

Run three formats on one provider:

- `compact-bar-fields`
- `compact-bar-local-labels`
- `exact-object-json`

Use five elemental and five real-use stress fixtures for each decision family.
Use two literal serialization controls. This gives 66 messages. Use one sample,
no retry, and no repair.

Elemental analysis has one chord and motif case. Elemental affine continuation
has one global rule. Stress analysis has three interleaved cases, eight-value
motifs, four distractor notes, and an asserted mixed chord distribution. Stress
affine continuation has voice-conditioned rules, source-bound output IDs, and
a canonical output sort. Fractions use common denominators.

## Measurement

The prompt is the experimental unit. Cases and components are outcomes within
the prompt. Report global component accuracy, average per-case component
accuracy, and perfect case count and rate. Also report structural and canonical
conformance.

Report elemental and stress results separately. Do not publish one pooled
musical headline. Five prompts give a 20-point prompt-level step. Treat this as
a coarse validity and calibration check, not an effect estimate.

## Decision

Return `freeze-for-8c4e` only when all operational gates pass, every elemental
arm reaches 80 percent component accuracy, each stress-family median is from 50
through 95 percent, no stress arm is below 40 percent, and every serialization
arm reaches 90 percent. Every scored cell must reach 90 percent structural
validity.

Return `revise` for a valid run that misses a task gate. Return `invalid` for an
operational or structural failure. Exact JSON is a format. It is not a separate
capability control.

## Provider and cost

Use `gpt-5.4-mini-2026-03-17` with low reasoning and a 12,000-token output
limit. The measured-cost estimate is USD 0.400000. The provider and total hard
limit is USD 0.650000. Reserve the full next-call bound before each request.
Retain a failed reservation.

Stop after OpenAI. This approval does not include Gemini, Haiku, medium effort,
or Phase 8c4e.

## Transfer boundary

Phase 8c4e can reuse the candidate identities, task schemas and generator
logic, parsers, scorers, report schema, offline assertions, and guards. It must
create fresh fixture instances, cohort hashes, provider schedules, approvals,
cost limits, and responses.
