---
title: Phase 8h4f — Tracks, profile cut, and 8h closeout
kind: plan
state: planned
status: Planned. Proves track kinds for the track names, applies the vocabulary to the retained tools, makes agent-native-v1 the default, and closes 8h.
updated: 2026-10-06
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4e-device-structure-migration.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E16, E20c, E126, E135; D8, D16, D18, D19, D20, D21
---

# Phase 8h4f — Tracks, profile cut, and 8h closeout

## Decisions taken in planning

- **Track arms are in scope.** Run focused live audio-track creation and
  Audio/Hybrid duplication arms. Use the broader `add_tracks` or
  `duplicate_track` name only for the kinds that pass.

## Work, in order

### 1. Track kinds

For audio-track creation and for Audio and Hybrid duplication, check fresh
identity, type, content, routing, mixer state, audibility, cost, and bounded
readback. Then name `add_track` (`add_instrument_tracks` or `add_tracks`) and
`copy_track` (`duplicate_instrument_track` or `duplicate_track`) by the
result. A failed arm is a proof gap, not a host refusal; record it so.

### 2. Retained tools on the vocabulary

- `check_connection` → `check_bitwig_connection`.
- Move `list_tracks`, `list_changes`, `check_revert`, `revert_change`,
  `rename_track`, `list_modulator_types`, `set_device_enabled`, and the
  destructive tools to the shared result module. Keep the destructive names
  separate (D20). Keep compact success results and detailed receipts on
  failure or request.
- Check that every `agent-native-v1` tool uses one address, health, result,
  and error vocabulary. Add a schema test over the full tool list.

### 3. Profile cut

- Make `agent-native-v1` the default profile. Keep `stable-v1` selectable as
  the rollback through 8i, unchanged.
- Measure the normal tool count from the schemas. The target is at most 42.
  Record the `tools/list` bytes against the 159,464-byte baseline.

### 4. Measurements and reductions

Run the representative workflows of 8h4c–8h4e through both profiles: a
compact read, a 16-note insertion, an E45/E48-style clip workflow, a
27-control write, and the A/B recipe. Record tool calls, result bytes, and
wall time. For each removed guard or verification step, name the failure it
covered, the replacement evidence, and the saved work.

### 5. Records and closeout

- Amend D8, D16, D18, D19, and D21 with the implemented surface. Update
  `PROJECT.md` and the workstation contract, interface, and verification
  references. Update the 8h parent to complete.
- Write the 8h retrospective target: the simplification that removed the most
  agent work and the retained safeguard that costs the most. Carry both into
  the 8i charter.

## Acceptance criteria

- Every 8h parent acceptance criterion is met or has an explicit open record.
- Public clip operations name Launcher scope. Track operations name only the
  kinds that passed.
- Stable and default profile names state their compatibility. Every retired
  tool, format, method, and check has a migration or incompatibility row.
- Brain check, extension tests, wire goldens, context check, live comparisons,
  and `git diff --check` pass. Record the evidence as E239.

## Out of scope

- Removal of `stable-v1` (after 8i).
- External publication (Phase 9).
