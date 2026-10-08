---
title: Phase 8h4f — Tracks, profile cut, and measurements
kind: plan
state: done
status: Complete (E239, D40). Live arms prove audio creation and Audio and Hybrid duplication (add_tracks, duplicate_track); every retained tool is on the shared result module; agent-native-v1 is the default with 41 tools; the E45/E48 workflow is 42 percent and the A/B recipe 57 percent faster than on stable-v1.
updated: 2026-10-08
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4e-device-structure-migration.md
next: 8h4g-performance-review-and-closeout.md
evidence: E16, E20c, E126, E135, E239; D8, D16, D18, D19, D20, D21, D40
---

# Phase 8h4f — Tracks, profile cut, and measurements

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
- E234 input: under `ALL_CHANNELS` (D33) a collapsed child is listed, but a
  read of a row other than 0 refuses `bound-target-mismatch` (E221). If
  [8h4a2](8h4a2-collapsed-child-reader-routes.md) finds no route, give that
  refusal a reason that says to expand the group.

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

Record the results in the
[performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md); they
are the input of 8h4g.

### 5. Records and closeout

[8h4g](8h4g-performance-review-and-closeout.md) owns the decision amendments
and the 8h closeout, after the performance review.

## Cost model (written at the session start)

Units from the [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md):
one wire call is one turn (about 24 ms). A structural stage (`track.create`,
`track.duplicate`, `track.delete`) releases every writer cursor (2 calls for
each pool cursor), waits the `cursorPoint` settle, and rescans the bank; a
minting stage polls the bank every 100 ms for at most 8 s. The `trackStruct`
settle (144 ms) follows a rename.

| Path | Typical case | Largest admitted case | Primitive and difference |
|---|---|---|---|
| `add_tracks`, one audio or instrument track | Mark, one create stage (about 12 turns and the mint poll, E16: 117–190 ms until visible), one rename stage (144 ms), one verify read: about 0.8–1.2 s | 8 names: 8 mint polls in one create batch, then one rename batch: about 3–4 s | `add_track` (instrument): the same ops; an audio track adds only the `kind` parameter, no turn |
| `duplicate_track`, Audio or Hybrid | Mark, track list, one duplicate stage (E16: 330–520 ms for a heavy track), one rename stage, one verify read: about 1.0–1.5 s | A track with plug-ins: plug-in load in the mint poll; E16 measured 376–520 ms until readable | `copy_track` (instrument): the same ops; a new kind adds no turn |
| Retained tools on the shared envelope | No host call added: the envelope maps the same reads and writes | Same | The call-budget test must not move |
| `check_bitwig_connection`, `list_tracks` | One mark (one turn), and one `tracks()` for `list_tracks` | Same | `check_connection`, `list_tracks`: the same calls |

Heap: no new host object in the normal profile. The probe profile marks 10
mixer and input values for each track, the sends, and a VU observer for the
arms only.

## Acceptance criteria

- Public clip operations name Launcher scope. Track operations name only the
  kinds that passed.
- Stable and default profile names state their compatibility. Every retired
  tool, format, method, and check has a migration or incompatibility row.
- Brain check, extension tests, wire goldens, context check, live comparisons,
  and `git diff --check` pass. Record the evidence as E239.

## Out of scope

- Removal of `stable-v1` (after 8i).
- External publication (Phase 9).
