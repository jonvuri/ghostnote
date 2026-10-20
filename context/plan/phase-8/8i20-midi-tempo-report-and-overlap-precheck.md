---
title: Phase 8i20 — MIDI tempo report and overlap pre-check
kind: plan
state: archived
status: Complete (E271). Issues D15 and D16 fixed; descriptions v52.
updated: 2026-10-19
parent: README.md
prev: 8i19-document-file-paths.md
---

# Phase 8i20 — MIDI tempo report and overlap pre-check

Historical Phase 8 record. Procedures and project retention instructions below
apply to the completed trials. Use the [dogfood archive](../../archive/outcomes/PHASE-8-DOGFOOD.md)
for results, related sessions, and the end of project tracking.

## Source and scope

[E270](../../evidence/experiments/e270-document-file-rerun.md) found three
problems in the MIDI and clip tools:

1. `read_midi_file` returns the complete source tempo map in
   `data.report.sourceTempoMap`, also with `documentOutputPath`. A 512-event
   map added 19,862 characters to the result.
2. The `targetBpm` text and the
   [contract](../../contracts/MIDI_FILE_CONVERSION.md) assume a 60 BPM
   placeholder. Ghostworks files now carry tempo maps.
3. `add_launcher_clip` refuses a same-key overlap only after it creates the
   empty clip, and the refusal names no notes.

Do not change the Document 1.0 codec, the controller, or a host call budget
other than the removed calls of item 3.

## Work

1. **Tempo summary.** Replace `report.sourceTempoMap` with
   `report.sourceTempo`: `events`, `changes` (events with a new value),
   `firstBpm`, `minBpm`, and `maxBpm`. The result size must not grow with the
   tempo map. Without `targetBpm`, the document keeps the map as tempo
   overlays. With `targetBpm`, the description states that a read without it
   returns the map.
2. **Equal tempo events.** Make one tempo overlay from consecutive source
   events with the same tempo. Report the count in `sourceTempo`. Timing does
   not change. Bump the conversion version, because the document changes.
   Check the export of the result against E265 and E267. Ghostworks also
   stops writing these events; this step covers files from other sources.
   The import loop skips a tempo equal to the last one it kept. The elapsed-time
   clock and the outside-clip loss count keep the complete source map.
3. **targetBpm text.** Remove the 60 BPM example from the parameter text and
   the contract. State that `targetBpm` replaces the source tempo map with one
   constant tempo and keeps elapsed time. Tell the agent to omit it when the
   file has its own tempo map. Do not imply that source files need correction.
4. **Overlap pre-check.** Run the same-key overlap check of a desired document
   in `add_launcher_clip` before any host call, and in an `intent: replace`
   edit before the write. The refusal detail lists at most 16 pairs (event IDs,
   channel, pitch, and onsets) and the total count. A patch edit keeps its
   check after the fresh read, with the same detail.

## Acceptance

- The 512-, 247-, and 489-event files of E270 give a read result of at most
  4 KB with `documentOutputPath`. Record the inline and file result sizes.
  Notes and timing round-trip through export as in E265.
- A constant-tempo map gives one tempo overlay. A variable map keeps each
  change. MIDI export of the result keeps the realized timing.
- An overlapping desired document refuses from `add_launcher_clip` with zero
  host calls and no effects. The detail names the pairs. Update the
  call-budget test and the ledger.
- Descriptions v52 with the artifact. Update the contract, D50, the ledger,
  E271, the issue log, the indices, and NOW. Stage only session changes.

## Cost

Item 1 to 3 are offline: no host call, turn, cold read, or write stage. The
summary removes about 39 bytes for each tempo event from the result. The
overlay merge is one pass over the tempo events. Item 4 adds one pass over the
document events, already done in the planner, and removes the clip creation of
a refused add: its resolve, occupancy read, and apply. Typical case: the
768–835-note E270 clips. Largest admitted: 16,384 notes.

## Retrospective target

Check each result field that copies source data for growth with the source.
A bound on notes does not bound the size of a report.
