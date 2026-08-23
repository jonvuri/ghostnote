---
title: Phase 5d — container cross-device routing
kind: plan
state: complete
status: Complete. E68 records selected-list routing, nested readback, reversal, and cleanup.
updated: 2026-08-23
parent: README.md
evidence: D1, D3, E11e, E13, E65, E66, E67, E68
---

# Phase 5d — container cross-device routing

## Purpose

Prove one explicit container-list retarget through the checkpointed executor.
Verify that an outer container modulator reaches one exact control on a nested
device.

## Scope

1. Select list 0 in the human-saved `gn_crossdev_outer` Chain preset.
2. Retarget its outer LFO from nested Delay+ Mix to nested Polysynth filter
   frequency.
3. Validate the selected list before the project write.
4. Verify one outer `LFO` page and nested `FILTER/Filt Freq` behavior.
5. Add the measured `CHAIN` slot cursor route to internal device addressing.
6. Reverse the take and restore the exact entry track list.

## Acceptance criteria

- A missing list selection refuses before `apply()`.
- Offline tests prove that one selected list changes and sibling lists keep the
  same semantic content.
- Validation checks the selected list and its metadata reference.
- The focused live proof reports the old and new cross-device paths.
- The nested witness has no automation, stable base value, and positive
  base-to-`modulatedValue` divergence.
- Named slots cannot collide with layer-chain names in address keys.
- An empty named slot cannot resolve to its current parent.
- A named-slot witness refuses every index except 0 before `apply()`.
- Reversal and cleanup leave no track, device, or temporary-file residue.
- `npm run check` and the extension Gradle tests pass.

## Out of scope

- Container add, replace, or delete. Selected-list editing supports retarget in
  this session.
- New donor assets or footprint measurements.
- Public MCP tools.

## Current verification

- `npm run check` passes 788/788.
- Focused live-adapter and authoring tests pass 108/108.
- The extension Gradle tests pass.
- `npm run probe:hello` passes, including deploy freshness.
- `npm run probe:phase5d-authoring` passes selected-list validation, the outer
  page witness, nested behavior, reversal, and exact seven-track cleanup.
- [E68](../../evidence/experiments/e68-container-cross-device-routing-is-live.md)
  records the implementation, proof, cleanup, and qualifications.

## Implementation finding

The routing path and the observer path use different names. The Ramona path
contains `DEVICE_CHAIN/Chain`. The device cursor must descend through the named
`CHAIN` slot. A layer-chain address cannot observe that slot. Because an empty
slot leaves the cursor unchanged, the observer selects the parent, confirms it,
and repeats the slot descent before readback.
