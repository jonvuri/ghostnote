# Phase 8c4f external-format probe protocol

## Purpose

Check that three notable public text formats work with the repaired full task
suite before a large matrix run. This probe measures harness validity and gives
directional results. It does not select a final format.

## Scope

Run two fresh fixtures from each of the nine decision families. Run one literal
serialization control. Run all 19 tasks on each of these composite arms:

- ABC 2.1;
- Strudel 1.2.0 mini-notation; and
- LilyPond 2.24.4.

This gives 57 Gemini calls. Use `gemini-3.8-flash` with low thinking. Make no
retry or repair call.

The Strudel result is a composite result. It does not claim that native
mini-notation represents stable note identity, velocity, or every finite edit
operation. The side ledger supplies those values. The parser checks the public
notation against the ledger for voice, start, duration, and pitch.

## Repairs carried forward

The analysis key moves with every transposed fixture. The offline screen checks
the full analysis reference contract.

The affine prompt defines `first_voice_start` as the earliest source start in
the applicable voice.

The revoice prompt defines the operation, first-chord behavior, candidate
shifts, range filter, movement cost, tie break, output voice, duration,
velocity, IDs, and exact note count.

Revoice scoring ignores synthetic IDs. It finds maximum field agreement within
each exact onset. One wrong field loses one component. An extra or missing note
also fails the exact-count component.

## Measurement

Component accuracy is primary. Structural and canonical rates are diagnostics.
Report each family and format separately. Do not pool providers or formats.

After the run, inspect one complete prompt, raw payload, parse result, reference,
and component score from every family-format cell. Record any prompt, parser,
reference, alignment, provider, schedule, or cost issue before interpreting the
aggregate.

## Freshness and reuse

Keep fixture schemas, scoring, adapters, and policy stable. Before later
provider work, change only the cohort, seed, variant offset, musical parameters,
and resulting prompts needed to make the run fresh. ID-only changes do not count
as fresh work.

The full template uses seven fixtures in each decision family, two literal
controls, and one sentinel repeat in each decision family. This is 74 messages
per arm and provider.

## Approval and cost

The recent-cost estimate is USD 0.180000. The Gemini and total hard limit is USD
0.350000. Reserve the full next-call bound before each request. Retain a failed
reservation.

No provider request is approved by this package. Approval must match the frozen
protocol hash, run-plan hash, cohort hash, candidate hashes, schedule, model,
settings, and hard limit.
