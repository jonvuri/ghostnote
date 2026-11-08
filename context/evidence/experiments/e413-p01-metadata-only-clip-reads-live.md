---
title: E413 — P01 metadata-only clip reads, live
kind: evidence
updated: 2026-11-08
owner: P01
---

# E413 — P01 metadata-only clip reads, live

**Positive.** `set_launcher_clip_properties` and
`set_launcher_clip_launch_settings` no longer replay the clip's notes. One
clip takes 0.77–0.81 s for any clip size (HEAD: 1.1–1.5 s for a typical clip,
2.8 s for 16,384 notes). Eight clips of 16,384 notes take 4.1–4.3 s for a
rename (23.7 s) and for launch settings (16.4 s); their reverts take
7.2–7.5 s (36.9 s and 22.1 s). Every write and revert agreed with a separate
full `clip.read` capture. A cursor readback can lag a write by more than
90 ms; the executor now reads again, without repeating the write, while a
written field still reads its old value.

## Change under test

Brain only; the extension and wire are unchanged.

- **Pointed metadata reads** (`LiveAdapter.read`). A snapshot that reads a
  clip's notes, length or D32 source keeps one shared `clip.read` capture. A
  clip read only for `clipMetadata` or `clipLaunch` is pointed with a pool
  cursor and read with `cursor.clipMetadata` / `cursor.launchSettings`, which
  were already registered in the normal profile. E234 measured the cursor
  metadata reply byte-equal to the capture's block; both launch routes call
  `ClipLaunch.read`. An empty slot is never pointed at (E2).
- **Read as stash (D65).** Both tools run in one selection scope and pass
  their fresh read to the executor as the stash (`parameterPreflight`, as
  `set_track_mixer` does). The executor's resolve and stash reads are gone;
  its verify read is the one independent readback. The cursor point is held
  from the read through the write and the readback. Launch settings now read
  the prior values in the tool's own read.
- **Bounded reread.** After a `clip.update` or `clip.launchSettings`, while
  a written field (colour excepted, D42) reads its old value, the executor
  settles 144 ms and reads again, at most four times. The write is never
  repeated. Each field is expected from the last op that wrote it.
- **Unchanged.** `revert_change` keeps its own stash and verify reads (now
  pointed reads). Reads with notes or sources, `clip.delete` stashes and
  whole-clip `edit_launcher_clip` routes keep the capture. Descriptions v64
  state the new property timing (8 clips: about 4 s, any size).

## Session

Bitwig 6.1.4 / API 25, project `gn-scale-test`. `probe:hello` passed with the
normal build already loaded (`normal-v1`, 94 methods, `526cd7e3760580cc`,
fresh initialization, B18 marker), so no controller replacement was needed
([operator record](../data/p01-clip-metadata-live/operator.json)).

The [driver](../../../brain/src/probes/p01-clip-metadata-live.ts) refuses
another probe driver or bridge client and checks the project and scratch
identity before every write. It owns one scratch track with eight clips of
16,384 notes (rows 0–7) and one typical clip (row 8). For each case it reads
the metadata, launch settings and channel-1 notes of every target through a
full `clip.read` capture, writes through MCP dispatch, compares the tool's
readback with a new capture, reverts, and compares a third capture with the
first (colour within one byte, D42). It then deletes the track and compares
the track list, the scene count and the selection with the start. The HEAD
baseline (`008f7a7a`) ran the same driver in a temporary worktree in the same
session. [Summary](../data/p01-clip-metadata-live/summary.json).

## Results

Milliseconds / wire turns. Change runs 2 and 3 use the final code; run 1
preceded the bounded reread and needed none.

| Case | Baseline (HEAD) | Change runs 1, 2, 3 |
|---|---:|---:|
| Typical clip, rename | 1,518 / 43 | 778, 768, 790 / 30 |
| Its revert | 1,291 / 41 | 1,256, 1,272, 1,298 / 46 |
| Typical clip, colour and length | 1,308 / 42 | 751, 774, 791 / 30 |
| Typical clip, launch settings | 1,122 / 34 | 771, 789, 794 / 30 |
| Its revert | 1,223 / 38 | 1,257, 1,301, 1,305 / 46 |
| 16,384 notes, rename 1 | 2,844 / 45 | 735, 790, 809 / 30–31 |
| Its revert | 2,845 / 45 | 1,265, 1,395, 1,355 / 46–48 |
| 16,384 notes, rename 8 | 23,708 / 170 | 4,178, 4,263, 4,100 / 119–120 |
| Its revert | 36,901 / 162 | 7,094, 7,449, 7,162 / 190–193 |
| 16,384 notes, launch settings 8 | 16,392 / 128 | 4,148, 4,285, 4,123 / 121–122 |
| Its revert | 22,124 / 139 | 7,125, 7,489, 7,167 / 193–194 |
| No-op rename (no write) | 410 / 12 | 538, 572, 565 / 18 |

A write makes two cursor reads per clip (the tool's read and the verify
read) and no `clip.read`. A revert makes three. A typical-clip revert stays
about 1.3 s: its separate stash, verify and resolve reads now point a cursor
instead of capturing a small clip. A no-op now points a cursor (about 0.15 s
more than capturing a typical clip); it still writes nothing.

## Stopped runs and findings

- **Stale cursor readback (product, fixed).**
  [Run](../data/p01-clip-metadata-live/stopped-change-stale-readback/) on the
  change before the bounded reread: a one-clip rename at row 0 returned
  `differs` (name observed `""`). An independent capture showed the name
  written on row 0 and rows 1–8 unchanged, so the write was correct and the
  readback stale. The verify read came about 90 ms after `batch.run`. The
  executor's existing reread covered note writes only. The bounded reread
  now covers clip metadata and launch settings; offline tests cover a lag of
  two reads, a persistent difference (four rereads, then `differs`) and a
  clean read (no reread).
- **Spurious group route (pre-existing).** When a pool cursor was last held
  on another row of the same track, the first point can still report that
  row after the settle. `pointAtClip` treats a same-track, other-row answer
  as a collapsed-group child and uses `cursor.pointExpanded`, which confirms
  the requested row (145 ms). It occurred 1 time at HEAD and 2–5 times per
  change run; it preceded the stale readback above. No wrong-row write was
  observed: each write's target agreed with the capture.
- **Driver colour tolerance.**
  [Run](../data/p01-clip-metadata-live/stopped-baseline-colour-tolerance/)
  on HEAD: the driver demanded exact restored colour bytes; Bitwig restored
  blue 110 as 109 (D42). The revert itself reported `verified`. The driver
  now compares a written colour within one byte.
- **Late track removal (pre-existing).** `delete_track` of the scratch track
  (eight clips of 16,384 notes) returned `readback.status: differs` with no
  removed IDs in every run, HEAD included; the track left `track.list` about
  25 ms later. The driver waits for the removal.
- **Slot selection without a prior.** The project started with no launcher
  slot selected. The adapter cannot clear a slot selection (`no-prior`), so
  the first stopped run left a slot selection on FX 1, row 8 (index 9). Later
  runs started from that selection and restored it exactly; the driver
  compares only the mixer selection when no slot was selected at the start.

After each stopped run the scratch track was deleted and the track list, the
10 scenes and the selection were checked. Every completed run ended with the
original track list, scene count and selection.

## Verification

TypeScript typecheck and all 2,661 brain tests pass, including the updated
call budgets (`read 2`, no `resolve`, for both tools), the adapter route test
and the three reread tests. The description cohort is v64
(`7b3ba5b955dfff60418a8f32f9da1c38bcf515252ffd2e16cb7a6acad33564a7`).
