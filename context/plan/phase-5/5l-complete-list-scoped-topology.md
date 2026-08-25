---
title: Phase 5l — complete list-scoped topology
kind: plan
state: planned
status: Planned after 5k. Complete all five editors on one semantic container location.
updated: 2026-08-25
parent: README.md
evidence: D1, D2, D3, E13, E66, E67, E68, E71
---

# Phase 5l — complete list-scoped topology

## Purpose

Remove the current core restriction that permits only retarget on a selected
container list. Make add, replace, retarget, amount, and delete correct at any
semantic modulator location.

## Scope

1. Resolve the semantic location from 5k to one internal list before editing.
2. Support add, replace, retarget, amount, and delete on that list.
3. Recompute the container-wide ordered unique modulator GUID references after
   any add, replace, or delete. Keep sibling-list content unchanged.
4. Preserve the list-local instance-id rule and the global `f4` and `f6`
   invariants.
5. Relocate every sampled-preset reference stub when object footprints change.
6. Report the selected semantic location and public before and after
   inventories. Keep binary selectors internal.
7. Prove one outer-container list and one nested-device list live, including
   reversal and exact cleanup.

## Acceptance criteria

- All five operations pass on plain and selected-list fixtures.
- Add, replace, and delete rebuild the exact container-wide GUID reference set.
- Retarget and amount do not change object counts or unrelated metadata.
- Every sibling list keeps the same semantic content.
- Sampled container tests prove all reference-stub deltas or refuse before a
  write when a footprint is unknown.
- Missing, stale, ambiguous, and unsupported semantic locations refuse before
  `apply()`.
- Live outer and nested cases pass exact page or DirectParameter behavior
  witnesses, reversal, and cleanup.
- The Python oracle, full brain check, and extension tests pass.

## Out of scope

- New donor assets.
- Public MCP write tools.
- Creating containers or moving live devices.

## Handoff

Session 5n exposes these complete operations after Session 5m completes the
general donor catalog.
