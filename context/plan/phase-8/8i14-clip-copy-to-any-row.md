---
title: Phase 8i14 clip copy to any row
kind: plan
state: archived
status: Complete (E263). `copy_launcher_clips` copies a clip to any empty slot of an Instrument or Hybrid track with `slot.copyTo`; S4 rerun passed with one copy write.
updated: 2026-10-19
parent: README.md
prev: 8i13-automated-dogfood-stretch-set.md
next: 8i15-device-add-revert-report.md
evidence: E20b, E43, E262, E263
---

# Phase 8i14 clip copy to any row

Historical Phase 8 record. Procedures and project retention instructions below
apply to the completed trials. Use the [dogfood archive](../../archive/outcomes/PHASE-8-DOGFOOD.md)
for results, related sessions, and the end of project tracking.

Complete: [E263](../../evidence/experiments/e263-clip-copy-to-any-row.md).
The result differs from this plan in two places. Every copy uses the new
route, also the next row, so `slot.duplicateClip` is no longer sent. The
tool admits Instrument and Hybrid tracks and refuses other track types.

Issue D9 of the [issue log](8i-dogfood-issues.md)
([E262](../../evidence/experiments/e262-automated-dogfood-stretch-set.md), S4):
`copy_launcher_clips` copies a clip only into the slot directly below it.
A copy from row 0 to row 2 took each agent three writes (copy to row 1,
copy to row 2, remove the row 1 copy). The route fails when the next row
holds a clip.

## What is known

- The tool uses `slot.duplicateClip` (`ClipLauncherSlot.duplicateClip()`).
  The call has no destination. The copy lands in the next row and replaces
  a clip there with no occupancy event (E20b,
  [E43](../../evidence/experiments/e43-clip-metadata-and-duplication-routes.md),
  [capability](../../evidence/capability/clips.md)). `duplicateObject`
  does the same. `Clip.duplicateContent` edits the source.
- The tool refuses every other destination with code `unsupported`,
  reason `copy-destination` (`copyLauncherClips`,
  `brain/src/surface/agent-native-clips.ts`). The description says "The
  host can copy a clip only into the slot directly below it". No evidence
  supports "only": no session tested another copy route.
- `slot.moveTo` reaches any row with
  `dest.replaceInsertionPoint().moveSlotsOrScenes(source)`
  (`TrackHandlers.slotMoveTo`). The planning agent recalls a sibling
  `copySlotsOrScenes` on `InsertionPoint`; it did not check the API
  reference. No file in `extension/`, `brain/`, or `context/` names the
  method. Confirm that it exists in host API 25 before the probe.
- The handler note warns that the verbs of `InsertionPoint` do not behave
  alike (`moveDevices` overturned E4d). A working move proves nothing
  about the copy.
- `move_launcher_clips` refuses when the row before or after the
  destination holds a clip (role `boundary`). In S4 this refused the
  move of the row 1 copy to row 2 (row 3 held a clip). Find the evidence
  for the boundary rule before step 4.

## Work

1. **API check.** Confirm `InsertionPoint.copySlotsOrScenes` in the
   API 25 reference: its parameters, and the insertion points that a
   `ClipLauncherSlot` gives (`replaceInsertionPoint`, and any other).
   If the method does not exist, go to step 4.
2. **Probe** (research profile, `./gradlew copyProbeExtension`, operator
   replaces the controller with `ghostnote probe`). Add a probe method
   `slot.copyTo` with the parameters of `slot.moveTo`, and a driver
   `phase8i14-copy.ts probe` in `gn-scale-test` on scratch tracks. Read
   the full column and the track list before and after each case, as
   `slot.duplicateClip` does. Cases:
   - same track, an empty row that is not the next row, down and up;
   - another instrument track, same row and another row;
   - an occupied destination: is the clip replaced, and does an
     occupancy event fire;
   - occupied rows before and after the destination: does any other
     slot change;
   - a row past the last scene; a group track slot; an audio track
     destination for a note clip;
   - the copy: notes on all 16 channels, name, colour, loop and play
     fields, and launch settings equal the source (`clip.read` and the
     metadata block); a 16,384-note clip;
   - a playing source clip;
   - the mixer selection and the slot selection before and after;
   - several sources in one call, if the method takes several.
   Record what the acknowledgement says and how the copy is proved
   (occupancy and content, not the reply).
3. **Decision rule.** Use `copySlotsOrScenes` as the product route when
   it copies to an empty slot with equal content, changes no other slot,
   and leaves the source in place. Keep `duplicateClip` when the
   measurements show a case that only it handles.
4. **Fallback.** When step 1 or 3 fails: compose the copy in the tool as
   `slot.duplicateClip` and `slot.moveTo` in one batch, admitted only
   when the next row is empty. Measure a failed second stage and its
   restore. State the limit that stays (a source with an occupied next
   row) in the description and the E record.
5. **Product.** Promote the method to the normal profile (method count
   and hash, golden, `rig.info` build marker). Change the
   `clip.duplicate` op and wire map to carry the destination, or add an
   op. In `copy_launcher_clips`: admit any empty destination slot that
   the probe proved, keep the preflight (source occupied, destination
   empty, each slot once), keep the occupancy report and the dry run, and
   keep the refusal for each destination that the probe did not prove.
   Decide from the probe whether the copy moves the selection; if it
   does, add the op to `movesMixerSelection` and the fake.
6. **Revert.** `revert_change` removes a copy while it is unchanged, for
   each new destination form. Add the cases to the revert tests.
7. **Description.** Replace the next-row sentence with the proved rule.
   Bump `TOOL_DESCRIPTION_VERSION` (v47) and the public artifact. Update
   the capability document: the "next row only" statement and its reason.
8. **Deploy and verify.** `./gradlew copyExtension`, the operator
   replaces the controller with `ghostnote`, `npm run probe:hello`, then
   the live acceptance (`phase8i14-copy.ts accept`).
9. **Rerun S4** with both clients (runbook; the S4 task file and
   `phase8i13-stretch.ts s4`). Expected: one write for the copy.

## Cost model

Baseline: `copy_launcher_clips`, one clip, 924 ms: mark 1, tracks 1,
read 3, resolve 1, apply 1, delta 1
([ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md), E247). The S4
workaround cost three tool calls (about 1.0 s, 1.0 s, and 1.2 s).

Expected with the new route: the same stages and turn count as the
baseline for one clip; the apply stage is one host call for each copy.
The largest admitted case stays 8 copies of 16,384 notes (`clipCopyBatch`,
about 12 s). Measure one clip and the largest case, and the revert of
each. With the fallback, the apply stage has two host calls for each
copy; give the measured cost. Update the call-budget test and the ledger
when the call count changes, and state the cost in the E record.

## Acceptance

- An E record (E263) with its index row: the API check, each probe case
  with its result, the decision, and the measurements.
- `copy_launcher_clips` copies one clip to an empty slot that is not the
  next row, on the same track, in one call, with a verified readback and
  a working revert. Another-track copies are admitted only when the
  probe proved them.
- An occupied destination refuses with code `occupied` before any write.
- No other slot, no mixer value, and no selection changes (or the tool
  restores the selection, as in E258).
- Unit tests, the call-budget test, and the D44 limit test pass; the
  largest admitted case and its revert are measured.
- Descriptions v47 and the public artifact; the capability document
  agrees with the product.
- S4 rerun, both clients: the goal is met and the copy is one write.
  Mark D9 in the issue log with the result.
- `gn-scale-test` is at its baseline; no probe residue.

## Out of scope

Scene copies, copies of a range of rows in one argument, a change to the
`move_launcher_clips` boundary rule, and the other issue-log rows.
