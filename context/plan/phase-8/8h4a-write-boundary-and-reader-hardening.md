---
title: Phase 8h4a — Write boundary and reader hardening
kind: plan
state: planned
status: Planned. Closes the E233 apply window, the stale selection after a project switch, the per-clip metadata point, and group-slot handling before new tools use them.
updated: 2026-10-06
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h3e-cache-machinery-trim.md
next: 8h4b-document-read-and-identity-registry.md
evidence: E3, E75, E99, E222, E230, E232, E233; D27, D30, D31, D32
---

# Phase 8h4a — Write boundary and reader hardening

## Why

E233 left four engine defects. The new document tools (8h4b–8h4d) depend on
all of them, so fix them first, below the tool surface:

1. **Scene change before the apply.** The D32 verdict checks the scene guard
   at a mark after the stash read. `batch.run` checks only `ifRevision`, which
   counts Ghostnote writes. A human scene insert or delete between that mark and
   the apply is not checked. The batch can then write into the clip that slid
   into the row.
2. **Stale selection after a project switch.** In Q, `selection.status`
   reported the track index from P. `preserveSelection` sent `slot.status` for
   that index and the host refused. A tool with an outer selection scope then
   refuses until the selection changes.
3. **Metadata point cost.** The `clip.read` reply has no name, colour, play
   start, or loop flag. Each checked clip needs a cursor point for
   `cursor.clipMetadata`, about 300 ms. A 16-clip survey takes 8.8 s against
   3.5 s for notes only.
4. **Group-slot handling.** A group track's own launcher slots mirror its
   child occupancy (E222). The product inventory is flat and does not treat
   them specially.

## Decisions taken in planning

- **Group slots refuse.** `list_tracks` marks group tracks. A clip read,
  write, snapshot, or check on a group track's own slot refuses with reason
  `group-slot` and names the child tracks. A collapsed child stays
  addressable by its `channelId` (E222).

## Work, in order

### 1. Scene guard at the apply

- Add optional `expectedGeneration`, `expectedProject`, and
  `expectedSceneEpoch` parameters to `batch.run`. The extension compares them
  on the controller thread, before the first operation, with the same rule as
  `slot.launchWithOptions`. A mismatch returns a typed refusal and runs no
  operation.
- The executor sends the stash-read mark with every batch whose write set has
  a scene-relative address. A refusal maps to `StaleAddressError` with no host
  mutation. Keep `ifRevision`.
- The fake adapter enforces the same guard. Add a fake case: a scene delete
  after the post-read mark and before the apply refuses, and the next clip is
  not written.
- State in the pull snapshot contract that the scene guard is checked at the
  read mark, the post-read mark, and the apply. Check whether one
  controller-thread task can still interleave a scene change between the guard
  and the operations (D27). Record the result; do not claim a host fence.

### 2. Selection after a project change

- `preserveSelection` treats a selection whose generation or project differs
  from the current mark as no selection. It does not restore it and does not
  send `slot.status` for its index.
- If `selection.status` still reports a stale index after a project change,
  record the host behavior and refuse to restore. Do not refuse the operation.
- Remove the 8h3e workaround in `check_clip_snapshots` only if the general
  fix covers it. Add a fake case for each tool that has an outer selection
  scope.

### 3. Metadata in the read reply

- Add one metadata block to the `clip.read` reply. It holds the same fields,
  types, and raw values as `cursor.clipMetadata`. Read it from the cursor that
  `clip.read` already binds. Do not add a second point.
- The fingerprint keeps `ghostnote-launcher-source/1` only if the block is
  byte-equal to the `cursor.clipMetadata` reply in canonical JSON. Prove this
  with a live comparison on every E233 fixture shape and a wire test. If it is
  not equal, bump the domain to `/2`, refuse `/1` references with
  `incomparable`, and record the break.
- The live adapter uses the block and stops the metadata point for snapshot
  reads, checks, and the survey.

### 4. Group-slot refusal

- Carry the track kind from `track.list` into the product track list. Mark
  `group` in `list_tracks`.
- Add reason `group-slot` to address resolution for clip reads, writes,
  snapshot acquisition, and checks. Name the child tracks when the list holds
  them.
- Copy, move, and launch on a group track's own slot also refuse. Record any
  group operation that already behaves differently.

## Live acceptance

Use the normal archive in owned unsaved projects (D29). Deploy with
`./gradlew copyExtension` and ask the operator to replace the controller.

1. **Apply guard.** Hold a batch between the stash read and the apply. The
   operator inserts a scene above the target. The batch refuses before a host
   mutation. A raw read before and after shows no change. Repeat with a scene
   delete.
2. **Selection.** Select a track in P, switch to Q, then run each tool that
   has an outer selection scope. No tool refuses because of the old selection.
   The selection in Q does not change.
3. **Metadata.** For each E233 fixture shape, the `clip.read` block equals the
   `cursor.clipMetadata` reply. The 16-clip survey runs again. Record wall time
   and result bytes against E233 (8.75 s) and E231 (3.47 s).
4. **Group slots.** Group two tracks with clips, as the operator. Each content
   tool refuses with `group-slot`. The child clips read and check, also with
   the group collapsed.

## Acceptance criteria

- `batch.run` refuses a changed scene epoch, generation, or project before any
  operation, in the live and the fake adapter.
- No tool refuses because of a selection from an earlier project.
- Snapshot checks make no metadata point. The fingerprint domain is unchanged,
  or the `/2` break is recorded with its refusal.
- Group-slot refusals are explicit, with unit and live cases.
- The new normal method count and hash are recorded. Fresh normal hello passes
  with the deliberate markers.
- The pull snapshot contract, D32, and E234 state the new guards.
- Brain check, extension check, wire goldens, retained offline verifiers,
  context check, and `git diff --check` pass. Owned projects are closed without
  saving; `gn-scale-test` matches its baseline.

## Out of scope

- New public tools and names (8h4b–8h4f).
- Promotion of topology or group inventory. The product inventory stays flat.
