---
title: Phase 8h4a5 — Collapsed-child cursor route and parameter settle
kind: plan
state: done
status: Complete (E243). Clip metadata and launch reads use clip.read; cursor.pointExpanded reaches every row of a collapsed child; a same-type device settles on its name and value callbacks.
updated: 2026-10-07
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4a4-cursor-track-identity.md
next: 8h4b-document-read-and-identity-registry.md
evidence: E221, E230, E234, E240, E241, E242, E243; D30, D32, D33, D34
---

# Phase 8h4a5 — Collapsed-child cursor route and parameter settle

## Result

Complete ([E243](../../evidence/experiments/e243-collapsed-cursor-and-parameter-settle.md)).
P1 showed that a pinned cursor keeps its row across a collapse, so the route
expands for each point (D34 unchanged; no D35). Two plan assumptions were
wrong. `list_tracks` does not know a track's parent: a visible-only track bank
now marks a collapsed child `hidden` in `track.list`. No hop makes the ID
observer fire (P5): the settle uses the name and value callbacks (P4). The
session also fixed `clip.launchSettings`, which wrote row 0 of a collapsed
child (P2).

## Why

E242 fixed the cursor target check, and found two limits. Both fail closed,
but both block planned work:

1. **Rows other than 0 of a collapsed child.** A slot selection on a child of
   a collapsed group does not take (E240, E241). A pool cursor therefore stays
   on row 0, and each cursor-pointed address on another row refuses with
   `AddressUnresolvedError`. The reader solved this for note reads (D34), but
   the pool cursors still serve these jobs (`adapter.ts`):
   - writes: the stage check before `clip.update` and the note writes
     (`confirmClipMutationStage`), and the write frames, which reuse the
     pinned cursor (`shouldPointClip`);
   - `clipMetadata` when the same read does not capture the clip's notes
     (`readClipMetadata`), which the executor reads before `clip.update`;
   - `clipLaunch`, which the write set also reads for its replay stash
     (`write-set.ts`);
   - `clipPlay` (`Clip.playingStep`);
   - the note observer arm (`armNoteWake`, cursor `observer`).

   In the anchor this affects `gn-E16` rows 1-15. 8h4c edits there would
   reach it.
2. **Same device type on two tracks.** `Rig.beginDirectParameterObservation`
   clears the parameter IDs when the target track changes. Bitwig calls the
   ID observer only when the ID list changes. After a Polysynth on one track,
   a Polysynth on another track gives the same list, so `idsGeneration` stays
   -1. The device then reads without `params`, and each parameter read or
   `param.set` on it is unstable. A move of cursor 0 to a track with no device
   first makes the callback arrive (E242 `device-ids-observer.log`). This does
   not depend on groups. 8h4e device work reaches it.

The operator decided to fix both in one session before 8h4b. Do the
consolidation first: each read that `clip.read` can serve leaves the cursor
path. Then the cursor route for collapsed children has fewer users.

## Read first

- [E242](../../evidence/experiments/e242-cursor-track-identity.md), the
  limits and the driver `brain/src/probes/phase8h4a4-cursor-identity.ts`.
- [D34](../../decisions/d34-the-reader-expands-collapsed-parent-groups.md)
  and the expansion in `ClipReader.java` (finders, `parent0`,
  `expandParents`, `collapseParents`, the restore order).
- [E241](../../evidence/experiments/e241-expand-parent-acceptance.md), the
  five defects that the first expansion build had. The new route can repeat
  them.
- `ClipMetadata.java`, and in `adapter.ts`: `pointAtClip`,
  `confirmClipMutationStage`, `readClipMetadata`, the `clipLaunch` and
  `clipPlay` cases of `readOne`, `metadataOf`, `armNoteWake`, and
  `preserveSelection`.
- `Rig.java` around `beginDirectParameterObservation` and the
  DirectParameter observers. Also the remote-page observers, which can have
  the same fault.

## Work, in order

### 1. Probes (probe profile, owned unsaved project)

Answer these questions before any product change. Record each answer in
E243, with the data in an artifact. A question that has no answer stops the
part of the work that depends on it.

Fixture: tracks `before`, `in`, `in2` (inside one group), and `after`. Clips
in rows 0, 1, and 2 of each track. Use a Polysynth on `before` and `in`, and
a different native instrument on `in2` and `after`. A nested group is needed
only for step 3.

- **P1, pinned cursor across a collapse.** With the group expanded, point a
  pool cursor at `in` row 1, pin the clip and the track, and confirm. Collapse
  the group. Does `cursor.status` still report `in` row 1? Does a
  `cursor.setNotes` and a `cursor.setClipMetadata` through that cursor land
  in row 1 (check with `clip.read`)? Does `cursor.launchSettings` and
  `cursor.playState` read row 1? Repeat with the person's selection inside
  the group and outside it.
- **P2, same-request point.** With the group collapsed and no cursor held,
  does a `batch.run` with `pointFrames` and `cursor.setNotes` for `in` row 1
  write row 1, row 0, or nothing? The product does not send this, because
  the stage check refuses first. The answer decides how strict the guard
  must stay.
- **P3, side effects of an expansion.** Does an expand and collapse change
  the scene epoch, the content epoch, the structural revision, the
  `track.list` order, or `selection.status`? Does the mixer selection move?
- **P4, DirectParameter callbacks on a same-type switch.** Point cursor 0 at
  `before` (Polysynth), then at `in` (Polysynth). Do the name, normalized
  value, and display observers fire for `in`, although the ID observer does
  not? Do they fire when the two Polysynths have equal values? Do the
  remote-page observers settle on the second Polysynth?
- **P5, an in-extension hop.** Find the cheapest way to make the ID observer
  fire again from inside the extension, for example a device selection that
  has no device (`selectAt` past the bank end) or a point to a track with no
  device. Measure the time. It must not move the person's selection.

### 2. Clip reads through `clip.read`

- Add a `launch` block to the `clip.read` reply: `launchQuantization`,
  `launchMode`, and `useLoopStartAsQuantizationReference`, read in the
  reader turn through the reader's clip, with the same validation as
  `cursor.launchSettings`. Keep it out of the `metadata` block, so the D32
  source fingerprint (`ghostnote-launcher-source/1`) does not change. Bump the
  reader marker to `clip-reader-v3`; `probe:hello` checks it.
- Brain: serve `clipMetadata` from the `clip.read` metadata block always, also
  when the read does not request notes. Serve `clipLaunch` from the new
  block. One snapshot still reads each clip once. Keep the cursor read
  methods for diagnostics, but no product read uses them.
- `clipPlay` stays on the cursor path: `playingStep` is a live value, and the
  reader closes after its read.
- Group slots still refuse `group-slot`.

### 3. Cursor point route for collapsed children

Choose the design from P1 and P3:

- **If a pinned cursor keeps its row across a collapse:** a new extension
  method points one pool cursor through the D34 expansion: expand each
  collapsed parent (up to three levels), select the slot, pin the clip and
  the track, wait for the host to report the target, then collapse. Share
  the finder and parent code with `ClipReader`; do not copy it. Follow the
  D34 restore order: restore the person's selection while the group is still
  expanded, collapse after the host reports the restore, then select the
  entry mixer track again.
- **If it does not:** the expansion must last for the whole operation. Open
  it at the first point on a collapsed child, and close it in the
  `preserveSelection` exit, after the selection restore, in the D34 order. A
  refusal or a thrown error must also close it.

In both designs:

- `pointAtClip` uses the new route only for a target whose parent group is
  collapsed (`list_tracks` already knows the parent and its state). Other
  targets keep the present route with no extra cost.
- Writes keep the pinned cursor (`shouldPointClip`). The stage check confirms
  by `channelId` and row, as now.
- The write gate holds a lease during the expansion, as the reader does. A
  new method name moves the method hash: update the goldens, and add a build
  marker that `probe:hello` checks.
- A target that the route cannot reach still refuses. Map it to the
  `collapsed-group-row` reason, not a bare `AddressUnresolvedError`, so the
  agent gets the same advice as from the reader.
- The note observer arm uses the same route.

### 4. DirectParameter settle

From P4 and P5:

- If the value or name observers fire on a same-type switch, settle the
  generation on those callbacks and keep the ID list when the new device
  reports the same IDs. Do not keep values from the earlier device.
- Otherwise make `beginDirectParameterObservation` force a new ID callback
  with the P5 hop, inside the extension, when the target changes.
- Fix the remote-page settle in the same way if P4 shows the same fault.
- A device that still does not settle reports unstable, as now.

### 5. Live acceptance

Before the matrix, run each product tool that takes a clip or a device
address once on the fixture (8h4a2 retrospective).

Owned unsaved project, normal profile, the fixture from step 1. Read each
target from a fresh adapter, so that no held cursor can make a result pass
(8h4a4 retrospective). For each track and rows 0, 1, and 2, with the group
expanded, then collapsed:

- reads: `clip`, `clipLaunch`, `clipPlay`, `clipMetadata`, notes;
- writes: note insert and remove, `clip.update` and restore,
  `clip.launchSettings` and restore; check each result with `clip.read`, and
  check that no other row changed;
- the note observer arm;
- the person's own path: select a slot of `in`, collapse the group, then read
  and write `in` row 2;
- one refusal after an expansion (for example a stale scene epoch): the next
  read must find the group collapsed;
- a child of a nested group, with the outer group collapsed;
- devices: on each track in the order `before`, `in`, `in2`, `after`,
  `before`, and with no hop: device read, parameter read, `param.set` and
  restore, and the remote controls.

Anchor, read only, `Group 5` collapsed: `clip`, `clipLaunch`, `clipPlay`,
and `clipMetadata` of `gn-E16` rows 0, 1, and 15, of `gn-A`, and of `gn-sel`.
Then check the anchor against its baseline.

Measure the time of a cursor read and a write on a collapsed child, and on a
track in no group. A track in no group must have no extra cost.

### 6. Records

E243 (probes and acceptance). Record a D35 only if the collapse rule for a
cursor point changes D34 (for example, the expansion lasts for a whole
operation). Update E242 to say which limits are fixed. Update the 8h plan and
`context/NOW.md`.

## Acceptance criteria

- Every row of a child of a collapsed group (up to three levels) reads and
  writes through the cursor route in the normal profile, also on the
  person's own path. No read or write reaches another row.
- `clipMetadata` and `clipLaunch` reads make no cursor point. The D32
  fingerprint does not change.
- After each read, write, and refusal, the groups that the route expanded
  are collapsed, or the record states where one stays expanded. The person's
  selection is restored as D34 requires.
- A device on a track that follows a device of the same type on another
  track reads its parameters, sets a parameter, and restores it, with no
  driver workaround. The remote controls of that device settle.
- A track in no group and a device after a different device type have no
  new cost.
- Unit tests: the `clip.read` launch block and its validation; metadata
  without a notes request; the route choice in `pointAtClip`; the
  `collapsed-group-row` mapping; and the DirectParameter settle on equal ID
  lists (extension test).
- Brain check, extension check, wire goldens, retained offline verifiers
  (E241, E242, E243), context check, and `git diff --check` pass. Fresh
  normal hello passes with the new markers. The anchor matches its
  baseline; owned projects close without saving.
