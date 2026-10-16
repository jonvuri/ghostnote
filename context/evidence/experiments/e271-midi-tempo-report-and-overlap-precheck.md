---
title: E271 — MIDI tempo report and overlap pre-check
kind: evidence
state: done
updated: 2026-10-16
owner: phase-8i20
---

# E271 — MIDI tempo report and overlap pre-check

## Result

[8i20](../../plan/phase-8/8i20-midi-tempo-report-and-overlap-precheck.md)
fixes issues D15 and D16 and the `targetBpm` text from
[E270](e270-document-file-rerun.md).

1. **Tempo summary (D15).** `read_midi_file` returns `data.report.sourceTempo`
   in place of `sourceTempoMap`: `events`, `changes` (events with a new
   value), `equalMerged`, `firstBpm`, `minBpm`, and `maxBpm`. Without
   `targetBpm`, the document keeps the map as tempo overlays.
2. **Equal tempo events.** Consecutive source tempo events with the same
   value make one tempo overlay. The conversion version is now
   `midi-document-v2`. The elapsed-time clock and the outside-clip count use
   the complete source map, so timing does not change.
3. **targetBpm text.** The parameter text, the tool description, and the
   [contract](../../contracts/MIDI_FILE_CONVERSION.md) have no 60 BPM example.
   They state that `targetBpm` replaces the source map with one constant tempo
   and keeps elapsed time, and that the agent omits it when the file has its
   own tempo map.
4. **Overlap pre-check (D16).** `add_launcher_clip` and an
   `edit_launcher_clip` with `intent: replace` check the same-key overlaps of
   the desired document before any host call. The refusal is `unsupported`,
   stage `input`, `detail.reason: overlap`, with `detail.overlaps` (at most
   16 pairs in onset order: `first`, `second`, `channel`, `pitch`,
   `firstAt`, `secondAt`) and `detail.overlapPairs` (the total). A patch edit
   keeps the planner check after the fresh read, at stage `plan`, with the
   same detail. The planner and the pre-check share one function
   (`sameKeyOverlaps` in `brain/src/bindings/ghostnote-document.ts`).

Descriptions are `ghostnote-description-v52`, 44 tools, fingerprint
`ccc7d870105b85d34da8e725b15b61c7315e7f5315d031ff68988830606bc3ea`. Changed
descriptions: `read_midi_file` (description and `targetBpm`),
`add_launcher_clip`, and `edit_launcher_clip`. The other 41 tools are
unchanged. The [artifact](../data/phase8i20-tempo-report/descriptions-v52.json)
records the complete cohort; v51 is frozen. The controller remains 8i15. The
Document 1.0 codec does not change.

## Cost

Cost model before the work (plan): items 1 to 3 are offline, with no host
call, turn, cold read, or write stage. The summary removes about 39 bytes for
each tempo event. The overlay merge is one pass over the tempo events. Item 4
adds one pass over the document events and removes the clip creation of a
refused add. Typical case: the 768–835-note E270 clips. Largest admitted:
16,384 notes.

Measured. The [acceptance data](../data/phase8i20-tempo-report/acceptance.json)
and the [v1 baseline](../data/phase8i20-tempo-report/baseline-v1.json) come
from the same driver on this build and on commit `be007fa`:

| File (tempo events) | Notes | v1 file result | v2 file result | v2 inline result |
|---|---:|---:|---:|---:|
| `feeding time` medium guitar (512) | 3,243 | 21,573 B | 1,834 B | 466,176 B |
| `good lies` medium drums (247) | 1,485 | 11,194 B | 1,773 B | 223,494 B |
| `losing you` large drums (489) | 1,850 | 20,655 B | 1,774 B | 355,035 B |
| `namisora` medium piano (1) | 2,740 | 1,705 B | 1,745 B | 214,999 B |

The report is 592–671 bytes. The removed map cost 38–39 bytes for each event,
as the model stated. The 40-byte growth for one event is the fixed summary.
Read times did not change (v1 92–322 ms inline, v2 93–328 ms). The documents
have the same size and the same tempo overlays as v1.

A refused overlap add made 12 adapter calls before (mark 2, tracks 2, read 3,
resolve 1, apply 1, delta 2, clipRead 1) and left an empty clip with a change
ID. A refused replace edit made 4 (mark, tracks, clipRead, delta). Both now
make none. On the live path this removes about 10 control turns and the
creation of a refused add. The success budgets do not change; the existing
call-budget tests assert them. The pre-check runs the planner check one more
time: offline median 2.9 ms for 835 sequential notes, 51.2 ms for 16,384, and
60 ms for 16,384 notes of one key at 114,660 overlap pairs. Most of the time is
the sort with exact rationals. This is 0.2 percent of the 22.2 s largest
admitted add (E256). No live measurement ran: no live-path call changed on
success.

## Verification

- `conversion.test.ts`: a variable map with equal events gives two overlays
  and `equalMerged: 2`; the target-tempo import is the same with and without
  the equal events; export and reimport keep notes and tempo overlays. A
  constant map gives one overlay.
- `midi-files.test.ts`: a generated 512-event map (256 changes) gives the
  summary, 256 overlays, and a file-mode result of at most 4 KB.
- `call-budget.test.ts`: an overlapping desired document refuses from
  `add_launcher_clip` and from a replace edit with zero adapter calls, no
  effects, no new clip, 16 listed pairs, and the total 133. A patch overlap
  refuses at stage `plan` with its one pair.
- `npm run check` passes: TypeScript and all 2,372 tests.
- `check-publication-candidates.py --write` updated the hashes of the two
  binding sources. The HOST-BINDING `overlap` rule does not change; only the
  refusal detail is new.
- The driver checks for each file: inline and file results, write from the
  file, reimport, equal notes, and equal tempo overlays. Realized timing: the
  largest deviation of an exported note from its source, in seconds through
  each tempo map, is 0.70–2.81 ms, equal to v1. It is the R07 normalization
  of the read (1/512 beat), not a tempo change.

Reproduce from `brain/`:

```sh
node --import tsx src/probes/phase8i20-tempo-report.ts /absolute/a.mid /absolute/b.mid
```

## State and limits

No live project was opened or changed. No client trial used v52.

The equal merge does not change the E270 Ghostworks files. Their "constant"
maps are not equal: the `good lies` drums range from 125.98716 to 125.98769
BPM, and the `losing you` drums from 139.99883 to 139.99981 BPM. Each event
has a new value, so `changes` equals `events`. A merge with a tolerance would
change the realized timing, so it is not done. The bound comes from the
summary. E270 stated "247 events at 126 BPM"; the values round to that.

The pre-check refuses a desired document only for a same-key overlap. The
other planner refusals (pressure, repeat, timing, and range) still come after
the clip exists in an add.

## Retrospective

The plan target held: the note bound did not bound the report. The other
read result fields were checked for growth with the source. `ignored` has
one row for each event kind. `tracks` has one row for each musical track (at
most 256) with its name, and a track name has no length bound; this is a
limit, not a planned change. No instruction change is needed.
