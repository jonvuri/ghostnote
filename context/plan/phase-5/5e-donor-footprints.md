---
title: Phase 5e — donor scope and footprint completion
kind: plan
state: complete
status: Complete. E69 records the cohort, two footprints, refusals, and cleanup.
updated: 2026-08-23
parent: README.md
evidence: D2, D3, E12, E13, E67, E69
---

# Phase 5e — donor scope and footprint completion

## Purpose

Complete the sampled-preset cohort for the current donor library. Record an
exact footprint and its source for each donor in that cohort.

## Sampled-preset cohort

The cohort contains the five current assets that load on sampled presets.
Existing measurements cover `lfo-sampler`, `random-sampler`, and
`random-poly`. This session adds `classiclfo-poly` and `vibrato-poly`.

`lfo-poly` stays Tier 1 only. It duplicates the LFO type, has no route, and adds
no sampled-preset capability beyond `lfo-sampler`. Its `null` footprint keeps
the refusal path real and tested. `expressions-poly` also stays Tier 1 only. A
bounded live sweep rejected every possible footprint from `0x0a` through
`0x39`. The 459-byte donor cannot contain more than 57 minimum-sized objects,
and the field walk reached 14 objects before the known deep-list limit.

## Scope

1. Triangulate the Classic LFO and Vibrato footprints on a sampled Sampler
   preset.
2. Require the predicted delta to load and both neighboring deltas to reject.
3. Record each result and its provenance in the generated donor index.
4. Prove all five cohort donors can be added to a sampled preset offline.
5. Prove `lfo-poly` and `expressions-poly` still refuse before execution on a
   sampled preset.

## Acceptance criteria

- Each required donor has one exact, non-null footprint.
- The live sweep reports one load and two rejects for each new measurement.
- The sampled-preset cohort is explicit in the asset documentation.
- Offline tests add every cohort donor and validate all stub relocations.
- The Tier-1-only donors remain `null` and refuse before `apply()`.
- The live proof removes its owned track and restores the exact entry track
  list.
- `npm run check` and the extension Gradle tests pass.

## Out of scope

- New donor types or preset fixtures.
- A public modulator-authoring surface.
- Redistribution and first-run generation policy.

## Current verification

- `npm run check` passes 788/788.
- The focused authoring and `bwmod` tests pass 63/63.
- `npm run probe:phase5e-footprints` passes all six live load cases and exact
  seven-track cleanup.
- `./gradlew test` passes from `extension/`.

## Retrospective

A failed footprint bracket does not prove that the footprint is farther away.
Bound the full candidate range by donor size before expanding a sweep.
