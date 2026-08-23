---
title: Phase 5f — public modulator authoring surface
kind: plan
state: complete
status: Complete. E70 records the public schema, four live operations, and cleanup.
updated: 2026-08-23
parent: README.md
evidence: D1, D2, D3, E65, E66, E67, E68, E69
---

# Phase 5f — public modulator authoring surface

## Purpose

Expose the proved modulator editors through one public write tool. Keep binary
format details inside the authoring library.

## Scope

1. Express add, replace, retarget, and delete as named operations.
2. Use public modulator names instead of donor asset ids.
3. Use named target recipes instead of internal route strings.
4. Require an exact page or behavior witness for each edit.
5. Record each inserted edited preset as a reversible change.
6. Report public modulator inventory, exact witness results, and sampled-preset
   adjustment without exposing offsets or footprint values.

The first target recipe set contains Polysynth filter frequency, Polysynth
filter resonance, and Sampler amp attack. Add supports LFO, Random, and Vibrato
because those assets contain a route that the editor can retarget. Replace also
supports Classic LFO and Expressions.

## Acceptance criteria

- One public write tool reaches all four editor operations.
- Its schema contains no donor id, internal route string, list index, route
  index, removed footprint, or reference offset.
- Add always proves active behavior through one exact named target recipe.
- Replace, retarget, and delete require at least one exact page or behavior
  witness.
- The result reports a recorded change id and states that reversal removes only
  the inserted device while its proved position remains valid.
- Cancellation after a recorded insertion propagates. It never reports that
  nothing was written.
- Sampled presets use measured assets. Unsupported asset or resident footprint
  cases refuse before `apply()`.
- Offline tests cover all four operations, format-detail hiding, recorded
  changes, exact witnesses, and sampled-preset refusal.
- `npm run check` and the extension Gradle tests pass.

## Out of scope

- New donor assets or target recipes.
- Selected-list container editing on the public surface.
- Donor redistribution and first-run generation policy.
- Mutating a device that is already in the project. The operation loads an
  edited preset as a new device.

## Current verification

- `npm run check` passes 795/795.
- Focused description, authoring, and surface tests pass 81/81.
- `./gradlew test` passes from `extension/`.
- Live add, replace, retarget, and delete pass through `author_modulators`.
- Each focused live case reverses its insertion and restores the exact entry
  track list.

## Retrospective

Use the recorded change as the write boundary. Do not convert a later error
into a pre-write refusal.
