---
title: Phase 8c2.2 — Measurement repair and grouped compact iteration
kind: plan
state: complete
status: Stop custom compact. The grouped prompt has a single-note defect, and the two-provider improvement gate is unreachable.
updated: 2026-09-27
parent: README.md
prev: 8c2-compact-grammar-correction.md
next: 8c2-3-compact-json-factorial-and-native-decision.md
evidence: E140, E141, E142, E143, E144, E145, E146; D21, D23
---

# Phase 8c2.2 — Measurement repair and grouped compact iteration

## Purpose

Continue Phase 8c2 with a new protocol and fresh context. Repair the task
measurement before more provider calls. Then test one bounded compact-format
hypothesis that makes vertical and role relationships explicit without the
size of the full v0-style hierarchy.

This session does not reopen or revise the frozen Phase 8c2 runs. Their
`do-not-select` decision remains valid under their frozen gate. It does not
prove that label-only compact is equivalent to compact-bar v1 or that explicit
labels have no value.

Phase 8c3 stays closed. Phase 8c2.3 now owns the next structured-object
comparison. Phase 8f stays blocked until Phase 8c3 returns `proceed`.

## Starting evidence

[E142](../../evidence/experiments/e142-label-only-compact-fails-targeted-holdout.md)
records the completed Phase 8c2 holdout. Label-only compact passed the frozen
provider gate only on Claude. The result has three measurement limits that
must be resolved before another selection run:

- The revoice source used `5/4` durations, and the prompt required duration
  preservation. The canonical scorer answer used `3/2` durations.
- The revoice scorer required one exact pitch realization. The prompt allowed
  more than one valid realization for its named operations.
- The holdout produced 0/36 revoice passes and 2/36 progression passes across
  all arms and providers. Melody produced 33/36 passes. These floor and ceiling
  effects gave little format resolution.

Role continuation produced 26/36 passes and was the most informative hard
family. Label-only compact also passed 53/54 syntax checks, compared with 51/54
for compact-bar v1.

Each hard family had only three fixtures. One changed result moved the
four-family macro by 8.33 points. That step was larger than the frozen 5-point
improvement margin. Use a finer sample rule in the new development protocol.

These counts are post-run diagnostics. Do not use them to change the frozen
Phase 8c2 selection result.

## Frozen boundaries

- Keep every compact-bar v0, symbolic-format v1, and compact-format v2 file and
  hash unchanged.
- Keep all Phase 8c1 and Phase 8c2 provider responses unchanged.
- Use existing responses only to diagnose scorers and task difficulty. Do not
  use them for a new selection claim.
- Do not use a Phase 8c1 retained fixture or a Phase 8c2 development or holdout
  fixture in calibration, development, or holdout.
- Do not tune a candidate against a retained or holdout response.
- Keep one canonical representation. Do not add a second score or side ledger
  to a product candidate.
- Do not change the cache, runtime profile, or a live Bitwig project.

Create a new versioned package beside `compact-format-v2`. Do not repair the
frozen package in place.

## Workstream 1 — Measurement repair

Complete this work offline before a provider-bearing calibration run.

### Contract and scorer audit

For every retained task family in the new suite, write one table that maps
each instruction requirement to its scorer check. Refuse a task when its
reference answer contradicts the instruction.

Add positive, negative, and mutation tests for each check. A mutation test must
change one required property and prove that only the related check fails. Test
the final multi-provider aggregation command before provider calls.

### Revoice repair

Replace the one-answer equality check with a property-based scorer. Make the
prompt define each operation precisely. The task and scorer must agree on:

- note count and chord starts;
- preserved identity when the format represents identity;
- preserved duration, voice, velocity, and chord pitch classes;
- the exact meaning of `nearest`, `drop-2`, and `first-inversion`;
- range limits and voice order; and
- tie handling when more than one realization has the same movement.

Accept all outputs that satisfy the stated contract. Do not accept one hidden
reference realization as the only musical answer.

### Progression repair

Keep the complete musical contract, but report its components separately:

- chord starts and named voices;
- harmony and bass inversion;
- voice ranges and crossing;
- total voice leading; and
- cadence.

Keep an all-constraints primary result only when calibration shows that the
task is not at a floor across exact JSON and native MIDI-Like. Preserve the
component vector even when the primary result fails.

### Diagnostic re-score

Apply the repaired scorer to the existing Phase 8c2 outputs only as a labeled
post-run diagnostic. Report whether the old provider gate would change, but do
not replace its frozen decision or hashes. Record the measurement findings in
new evidence.

## Workstream 2 — Grouped-label compact

Test one representation hypothesis: explicit onset or chord groups make
vertical and role relationships easier to use than independent positional or
labeled event rows.

Build one `grouped-label-compact` candidate with these properties:

- one block for each onset or chord group;
- one shared onset and duration when the notes share them;
- explicit SATB voice slots or named role slots inside the block;
- explicit field labels for values that are not carried by the block;
- stable event IDs and sparse patch support where the source format has them;
- one canonical score representation with no side ledger; and
- no derived harmony or task answer that is absent from the source semantic
  fixture.

Use labeled event rows for cases that do not have a useful vertical group.
Define one unambiguous canonical ordering. Add renderer, parser, round-trip,
identity, exact-preservation, sparse-patch, size, and token-estimate tests.

The candidate is one bounded change from label-only compact. Do not add the
full v0 hierarchy in this iteration.

## Workstream 3 — Fresh suite and calibration

Generate three disjoint cohorts:

1. a calibration cohort;
2. a development cohort; and
3. a targeted holdout cohort.

Record every fixture hash and prove that the cohorts have no overlap with each
other or with Phase 8c1 and Phase 8c2 fixtures.

### Task roles

Use progression generation, role continuation, and repaired revoicing as the
decision-critical families. Use melody generation as a regression family
unless calibration removes its ceiling effect. Keep fresh structure, local
transformation, rhythm transformation, and fixed-ID motif guards.

Use unique semantic fixtures for effect estimation. Use repeated identical
prompts only for a named nondeterminism sentinel.

### Calibration run

The calibration run is diagnostic. It cannot select a format. Its purpose is
to reject floor, ceiling, prompt, parser, and scorer defects before the larger
development run.

Use compact-bar v1, label-only compact, grouped-label compact, exact JSON, and
native MIDI-Like. Use OpenAI, Gemini, and Claude with matched low-effort
settings. Freeze its fixtures, prompts, scorers, models, settings, stopping
rule, scope, and cost before calls.

Do not carry a calibration fixture into development or holdout. If a
decision-critical family remains at a floor or ceiling across the controls,
stop provider work and repair the measurement offline. Do not compensate by
adding more calls to an uninformative family.

Before calls, freeze the calibration eligibility band. By default, pool exact
JSON and native MIDI-Like per provider. A decision-critical family is eligible
only when its primary pass rate is from 0.20 through 0.90 on at least two
providers. A different band needs an offline rationale before approval.

### Development sample

After calibration passes, freeze a fresh paired development protocol. Use the
same eligible semantic fixture and task wording for every arm.

Target 8–12 unique fixtures for each decision-critical family. Select the exact
count before calls from a stated resolution calculation. The smallest possible
hard-macro step must be no larger than 5 points. Use enough fresh regression
and guard fixtures to detect one repeated family loss.

The development arms are:

1. compact-bar v1;
2. label-only compact;
3. grouped-label compact;
4. exact JSON; and
5. native MIDI-Like.

Keep syntax, musical properties, stable identity, exact preservation, sparse
editing, input tokens, output bytes, latency, and provider variation separate.

## Gates and stopping rules

Freeze the exact numeric gate before the development calls. At minimum, the
grouped candidate must:

- improve the paired decision-critical macro over compact-bar v1 by at least 5
  points on at least two providers;
- avoid a hard-macro regression larger than 5 points on another provider;
- have at most one candidate-only loss per provider and family;
- avoid a guard regression larger than 5 points against compact-bar v1 or
  label-only compact;
- preserve the useful label-only syntax behavior;
- keep its input-token ratio to exact JSON at or below 0.90;
- keep its output-byte ratio to exact JSON at or below 0.80; and
- pass deterministic identity, preservation, sparse-patch, and round-trip
  checks where those capabilities apply.

State the paired denominator, discordant pairs, effect size, and uncertainty
for every provider and family. Do not use only a pooled macro result. Make the
margin attainable at the frozen sample resolution.

Use these terminal decisions:

- `repair-measurement`: calibration finds another floor, ceiling, or contract
  defect. Stop provider calls and repair offline.
- `stop-custom-compact`: grouped-label compact fails the development gate. Do
  not start another syntax search in this session. Prepare an exact JSON versus
  native MIDI-Like product decision.
- `freeze-holdout`: grouped-label compact passes development. Freeze one fresh
  targeted holdout without changing the candidate.
- `select-for-phase8c3`: the candidate passes the fresh holdout.
- `do-not-select`: the candidate fails the fresh holdout. Keep Phase 8c3 and
  Phase 8f blocked.

The holdout must use a new cohort and the same decision rule that was frozen
before its calls. A holdout pass selects the exact candidate version for Phase
8c3. It does not unblock Phase 8f.

## Cost authorization

Calibration, development, and holdout are three separate named runs. Approval
for one run does not approve the next run.

Before each provider-bearing run, state:

- every arm, family, fixture count, repeat count, and provider;
- the expected call count for each provider and in total;
- the exact model and inference settings;
- the estimated cost for each provider and in total;
- the protocol, corpus, and run-plan hashes; and
- the stopping rule and allowed follow-up.

Do not make provider calls until the operator explicitly approves that named
run. Stop and request new approval when the scope, model, settings, or estimate
changes materially. Record usage and calculated API cost after each provider.
The operator dashboards remain the external spend authority.

## Outputs

- A new versioned compact-format benchmark package.
- A task-to-scorer contract table and mutation tests.
- A corrected property-based revoice scorer.
- Component progression diagnostics and calibrated task eligibility.
- One grouped-label grammar, renderer, parser, and capability report.
- Separate calibration, development, and holdout cohorts and hashes.
- One approval, manifest, and cost record for every provider-bearing run.
- A paired report with provider, family, token, size, latency, and variation
  results.
- New evidence that distinguishes the frozen Phase 8c2 result from the new
  measurement and format result.
- A short handoff that either names the exact Phase 8c3 candidate or records
  the stop decision.

## Acceptance criteria

- Frozen v0, v1, and v2 packages and run manifests remain unchanged.
- The new revoice instruction and scorer agree on every preserved property.
- Revoice accepts all valid tied realizations and rejects one-property
  mutations.
- Progression reports each named contract component.
- The aggregation path has an offline test before provider calls.
- Calibration rejects uninformative decision families before development.
- Calibration, development, and holdout use disjoint fresh fixtures.
- The development sample has a hard-macro step no larger than 5 points.
- Every claimed format delta is paired and states its denominator.
- Every provider-bearing run has a prior exact estimate and explicit approval.
- No holdout fixture or response is used to revise the candidate.
- Initial and repaired responses remain separate.
- No API key, provider cache, third-party composition, live project mutation,
  or temporary generated music remains in the repository.
- Focused benchmark tests, the complete brain check, `context/check.rb`, and
  `git diff --check` pass.

## Out of scope

- Reinterpreting or overwriting the frozen Phase 8c2 decision.
- Reusing Phase 8c1 or Phase 8c2 fixtures for selection.
- Testing several new compact grammars in an open-ended search.
- Running the Phase 8c3 full retained matrix.
- Freezing the public compact-bar contract.
- Changing the cache contract or live Bitwig state.
- Fine-tuning or training a provider model.
- External publication.

## Closeout

OpenAI and Gemini made the frozen two-provider improvement gate unreachable.
The operator accepted `stop-custom-compact` without running Claude. The
three-provider development run remains incomplete and has no formal summary
decision. Do not repair or resume it.

This result closes incremental compact-bar text development. It does not prove
that every representation more compact than exact JSON must fail. Phase 8c2.3
therefore tests compact JSON as a new structured-object direction.

## Retrospective target

Record whether contract mutation tests and calibration prevented another paid
measurement defect. Record whether onset grouping improved vertical tasks
without losing the label-only syntax and guard behavior.
