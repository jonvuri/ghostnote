---
title: Phase 8c2.3 — Compact JSON factorial and native product decision
kind: plan
state: complete
status: Targeted holdout selected tuple JSON with MIDI integers for Phase 8c3.
updated: 2026-09-27
parent: README.md
prev: 8c2-2-measurement-repair-and-grouped-compact-iteration.md
next: 8c3-full-symbolic-format-matrix.md
evidence: E140, E142, E146, E147, E148, E149, E150, E151, E152; D21, D23
---

# Phase 8c2.3 — Compact JSON factorial and native product decision

## Purpose

Decide whether a compact structured object can replace exact object JSON
without a material accuracy loss. Separately measure whether native MIDI-like
notation is a better musical interface when full object capabilities are not
required.

Phase 8c2.2 closed the custom compact-text search. This session does not
repair compact-bar, label-only compact, or grouped-label compact. It tests a
new structured-object direction.

## Current checkpoint

[E147](../../evidence/experiments/e147-compact-json-calibration-awaits-approval.md)
records the complete offline prototype and the frozen calibration plan. The
plan has 210 calls and an estimated cost of USD 2.090578. No provider call is
approved. Stop at the approval boundary.

[E148](../../evidence/experiments/e148-compact-json-calibration-requires-measurement-repair.md)
records the completed r1 result. Progression was at a floor, revoicing was at
a ceiling, and the JSON prompt omitted exact multi-voice order and task
metadata.

[E149](../../evidence/experiments/e149-compact-json-r2-stops-at-settings-repair.md)
records the completed r2 cheap stage. Role continuation reached a ceiling,
and the inherited provider helper did not apply the declared output limit.

[E150](../../evidence/experiments/e150-compact-json-r3-passes-and-development-freezes.md)
records the passing r3 settings repair and frozen development plan. The plan
has 200 cheap-provider calls and up to 100 conditional Claude calls.

[E151](../../evidence/experiments/e151-compact-json-development-freezes-targeted-holdout.md)
records the completed 300-call development run and its `freeze-holdout`
decision. Exact-object MIDI is the control and fallback. Exact-object
pitch-class/register and tuple MIDI are experimental holdout cells. Native
MIDI-like did not qualify. The 180-call targeted holdout had separate
approval.

[E152](../../evidence/experiments/e152-tuple-json-midi-passes-targeted-holdout.md)
records `select-for-phase8c3`. Tuple JSON with MIDI integers passed on OpenAI
and Claude. Exact-object pitch-class/register passed only on Gemini and is
rejected. Exact-object MIDI remains the full-capability fallback. Phase 8c2.3
is complete.

## Experimental design

Run the native MIDI-like arm with the four JSON arms on one fresh cohort. Use
separate isolated model calls and randomize arm order. This keeps provider,
fixture, and time effects paired and avoids a second provider run.

Keep native MIDI-like outside the JSON factorial. It does not share the same
schema, identity, preservation, or sparse-patch capabilities. Do not include
it in a JSON main effect or interaction estimate.

The JSON factorial has two independent factors:

| Cell | Shape | Pitch value |
|---|---|---|
| `exact-object-json-midi` | named objects | MIDI integer |
| `exact-object-json-pc-register` | named objects | `[pitch_class, octave]` |
| `tuple-json-midi` | named collections of fixed tuples | MIDI integer |
| `tuple-json-pc-register` | named collections of fixed tuples | `[pitch_class, octave]` |

Add `midi-like-native` as the fifth, separate arm. Use it only for common
musical metrics, size, latency, and a separate capability comparison.

## Frozen boundaries

- Keep compact-bar v0, symbolic-format v1, compact-format v2, and
  compact-format v3 files and provider responses unchanged.
- Do not reuse a Phase 8c1, 8c2, or 8c2.2 calibration, development, or holdout
  fixture in a new cohort.
- Do not tune a representation against development or holdout responses.
- Keep one canonical representation per arm. Do not add a side ledger or a
  second pitch encoding.
- Keep the semantic facts and task wording equal across the four JSON arms.
  Change only shape and pitch encoding.
- Do not change the cache, runtime profile, or a live Bitwig project.

Create a new versioned benchmark package beside `compact-format-v3`. Do not
change a frozen package in place.

## Workstream 1 — Canonical representations

Define a complete, versioned exact-object schema. Represent each named value
as an object field. Use one integer from 0 through 127 for each MIDI pitch.

Define a complete, versioned tuple schema. Keep named top-level collections
such as `bars`, `tracks`, `regions`, and `notes`. Use fixed field order only
inside each collection. Do not put all entity types in one heterogeneous
tagged array. Include stable IDs and all required metadata in their specified
tuple positions.

For pitch-class/register cells, replace the pitch value only. Use
`[pitch_class, octave]`, where pitch class is from 0 through 11 and MIDI pitch
is `12 * (octave + 1) + pitch_class`. Reject values outside the MIDI range.
Do not include both MIDI and pitch-class/register values.

Define exact-object and tuple sparse-patch forms. They must have equivalent
identity, preservation, omission, and conflict semantics. Native MIDI-like can
omit these capabilities only when the capability report states the omission.

Add parser, renderer, schema, canonical-order, round-trip, identity,
preservation, sparse-patch, invalid-value, size, and token-estimate tests for
all applicable arms.

## Workstream 2 — Tasks, prompts, and fresh cohorts

Audit each task and scorer before provider calls. Map every instruction to a
scorer check. Add positive, negative, and one-property mutation tests. Give
the model an exact template and example for every permitted grammar form.

Create three disjoint cohorts:

1. calibration;
2. development; and
3. targeted holdout.

Record every semantic fixture hash. Prove that no cohort overlaps another
cohort or a prior provider-bearing cohort.

Use calibration only to find floor, ceiling, prompt, parser, or scorer
defects. Recheck progression and revoicing. Demote a family to a regression
or component diagnostic when it does not resolve format effects. Freeze the
eligibility bands before calibration calls.

Select 8–12 unique development fixtures for each eligible decision family.
Freeze the exact count from a resolution calculation. Keep the smallest
possible primary macro step at or below 5 percentage points. Use repeated
identical prompts only for a named nondeterminism sentinel.

Use arm-neutral pitch ranges and transformations. A task must have the same
musical answer under MIDI and pitch-class/register encoding.

## Workstream 3 — Analysis and product decision

Report these paired JSON contrasts by provider and task family:

- tuple shape at MIDI: tuple MIDI minus exact-object MIDI;
- tuple shape at pitch-class/register: tuple pitch-class/register minus
  exact-object pitch-class/register;
- pitch encoding in objects: object pitch-class/register minus object MIDI;
- pitch encoding in tuples: tuple pitch-class/register minus tuple MIDI; and
- interaction: the difference between the two pitch-encoding effects.

For each contrast, state the paired denominator, discordant pairs, effect
size, and uncertainty. Do not use only a pooled result.

Compare native MIDI-like with the JSON cell selected by the frozen hierarchy
only on common musical metrics, size, tokens, and latency. Report
full-document fidelity, stable identity, exact preservation, sparse editing,
and conflict behavior in a separate capability table. Native MIDI-like cannot
become the complete product representation unless one canonical form supplies
all required capabilities.

## Gates and stopping rules

Freeze numeric gates before development calls. The frozen rule must include:

- a non-inferiority margin for tuple accuracy against exact-object JSON;
- a material input-token or output-byte reduction for tuple JSON;
- a pitch-class/register improvement rule for pitch-critical checks;
- a maximum regression for all other eligible families;
- deterministic identity, preservation, patch, and round-trip requirements;
  and
- a rule for provider disagreement and unattainable sample resolution.

By default, retain pitch-class/register only when it improves pitch-critical
checks on at least two providers and causes no regression larger than 5
percentage points elsewhere. Freeze any different rule with an offline
rationale before calls.

Freeze a hierarchical JSON selection rule before development. Select tuple
shape only when it passes both the accuracy and compactness gates. Otherwise,
retain exact-object JSON. Within the selected shape, retain
pitch-class/register only when it passes the pitch gate. Otherwise, retain
MIDI integers. If an interaction makes this order ambiguous, freeze each
eligible cell for holdout instead of choosing one after inspection.

Use these terminal decisions:

- `repair-measurement`: calibration finds a contract, prompt, floor, or
  ceiling defect. Stop provider work and repair it offline.
- `stop-compact-json`: no tuple cell meets the frozen development gate. Retain
  the selected exact-object cell as the full-capability fallback.
- `freeze-holdout`: one or more JSON cells meet the development gate. Freeze
  them without revision for a fresh targeted holdout.
- `select-for-phase8c3`: one or more frozen JSON cells pass holdout and the
  product capability gate.
- `select-native-limited`: native MIDI-like wins its common musical comparison
  but does not meet the full representation contract. Record its limited use.
- `do-not-select`: the frozen candidate or candidates fail holdout.

A result can select both a complete JSON representation and a limited native
interface when their product roles are distinct. `select-native-limited` does
not satisfy the Phase 8c3 entry condition without a selected full-capability
representation.

## Provider authorization

Calibration, development, and holdout are separate named runs. Approval for
one run does not approve another. A conditional cheap-provider-first order
must be part of the named plan and must state when a later provider is allowed.

Before each provider-bearing run, freeze and state:

- every arm, family, fixture count, repeat count, and provider;
- expected calls for each provider and in total;
- exact models and inference settings;
- estimated cost for each provider and in total;
- protocol, cohort, scorer, and run-plan hashes; and
- stopping rules and allowed follow-up.

Do not make provider calls without explicit operator approval for that exact
run. Record usage and calculated API cost after each provider. The operator's
provider dashboards remain the external spend authority.

## Outputs

- One new versioned benchmark package for all five arms.
- Complete exact-object and named-collection tuple schemas and patch forms.
- Fresh calibration, development, and holdout cohorts with overlap proofs.
- Task-to-scorer contracts and mutation tests.
- One factorial report and one separate native capability comparison.
- Approval, manifest, integrity, and cost records for each provider run.
- Evidence that names the exact candidate and role selected for Phase 8c3.
- A short next-session handoff.

## Acceptance criteria

- Frozen v0, v1, v2, and v3 packages and responses remain unchanged.
- The four JSON cells contain equal semantic facts.
- Each pitch has exactly one canonical encoding in each cell.
- Tuple and object patches have equivalent semantics.
- Deterministic tests cover bounds, round trips, identity, preservation,
  sparse patches, invalid tuples, metadata, and every prompt grammar form.
- Cohorts are fresh and disjoint from each other and all prior provider runs.
- Calibration rejects uninformative decision families before development.
- Every JSON effect is paired and native remains outside the factorial.
- Every provider-bearing run has a prior exact estimate and explicit approval.
- No holdout fixture or response is used to revise a candidate.
- Focused tests, the complete brain check, `context/check.rb`, and
  `git diff --check` pass.
- No API key, provider cache, third-party composition, live project mutation,
  or temporary generated music remains in the repository.

## Out of scope

- Another compact-bar, label-only, grouped, or custom text syntax iteration.
- Reusing Phase 8c1, 8c2, or 8c2.2 provider fixtures for selection.
- Running the Phase 8c3 full retained matrix.
- Freezing the public musical document contract.
- Changing the cache contract or live Bitwig state.
- Fine-tuning or training a provider model.
- External publication.

## Retrospective target

Record whether the concurrent native anchor improved comparison quality
without confusing the JSON factorial. Record whether complete prompt examples
prevented another paid grammar defect.
