---
title: E248 — Writer cursor width
kind: evidence
state: done
updated: 2026-10-08
owner: phase-8h4g
---

# E248 — Writer cursor width

## Status

[8h4g](../../plan/phase-8/8h4g-performance-review-and-closeout.md) step 6 is
complete. The pool writer cursors now have the reader width (4,194,304 steps).
Every admitted clip is one writer page at every grid. The review case
went from 111 s to about 2 s. The background route stays out of
`agent-native-v1` ([D41](../../decisions/d41-the-writer-window-is-the-reader-width.md),
D39 amendment). A writer parks on an empty window after each write, so a held
writer keeps no clip content in the heap.

## The defect

A review of the first 8h4g session found a valid edit above the 60 s client
timeout (E45): 512 notes on a 2,048-beat clip, four beats apart, with
duration 1/512 and every velocity changed. A 1/512 duration forces the 1/512
grid. Each note is then on its own 512-step writer page, and the E46 check of
each distinct page costs about 210 ms (grid settle, scroll, status). The write
cost scales with the **distinct writer pages**, not with the note count. The
16,384-note worst case of E247 had 8 pages. The reader admits up to 8,192
pages of 512 steps.

## Cost model (before the probe)

- Init and heap at load: no change. E225 found no width cost of a cursor clip
  through 4,194,304 steps at constant content, and E52 found no init cost at
  2,048.
- Page checks: at most one for each view (cursor, clip, grid). The review case
  goes from 512 page checks to 1, and the 16,384-note worst case from 8 to 1.
- Risk, retained heap: a bound cursor clip holds one host `NoteStep` for each
  sounding cell of its window (E225: about 350 bytes). A wide writer at the
  1/512 grid holds the whole clip: up to about 700 MiB at the reader limit
  (2,097,152 cells), for each of the 8 pool cursors. At 512 steps a writer
  holds one window only.
- Risk, grid settle: the 144 ms settle before a property stage may be too
  short for a clip-wide window.

## Method

`phase8h4g-writer-width.ts` (new) in the owned project "New 6", normal
profile, 89 methods, `0ef817f4bac8a8a7`: `entry` (init time and the live heap
after a full collection, `jcmd GC.class_histogram`), `reviewer` (the review
case: add, read, whole-clip velocity edit), `far` (an 8,192-beat clip with a
note on the last 1/512 cell, a beat-96 note as in E46, and a row of 1/64 notes
over 16 beats as in E44; then pan on the far and the beat-96 notes through
`setNoteProps`, and removal of the far note through `clearStep`), and `heap`
(N one-beat notes on 1/512 starts, 512 sounding cells each; ZGC "used" sampled
every 100 ms during the add and during a plain read of the same clip, as in
E246). The wide width ran first as a `rig.json` override, then as the
extension default.

## Results

| Case | 512 steps | 4,194,304 steps |
|---|---:|---:|
| Init (construction / initialization) | 38 / 57 ms | 35 / 50 ms |
| Live heap after entry | 402 MiB | 359 MiB |
| Review case `add_launcher_clip` | 111,419 ms; 513 scrolls, 515 status reads | 2,293 ms; 2 scrolls, 3 status reads |
| Review case whole-clip edit | 110,838 ms | 1,781 ms |
| Far end add / pan / remove | 3,295 / 3,835 / 1,559 ms | 2,423 / 2,154 / 1,407 ms |
| 1,024 one-beat 1/512 notes, add | 16,373 ms (64 pages) | 2,475 ms |
| 16,384-note whole-clip edit (E247 worst) | 8,337 ms (E247) | 6,588 ms (plan 1,195, write 3,710, readback 637) |
| `add_launcher_clip`, 16,384 notes | 8,172 ms (E247) | 6,418 ms |

Every write read back `verified`. The far note, its pan (-0.25), the beat-96
pan (0.5), the E44 row, and the removal were exact at the far end of the
window.

### Heap

| Writer state, 524,288 cells (1,024 notes) | Held `NoteStep` | Live heap change |
|---|---:|---:|
| 512 steps, held | 16,368 | +7 MiB |
| 4,194,304 steps, held | 534,528 | +176 MiB (about 336 bytes a cell) |
| 4,194,304 steps, parked after the write | 10,240 | +4 MiB |

The retained heap was the risk of the model. The adapter now parks each
writer that a write used at the end of the apply: `cursor.setStepSize` to a
1-beat grid and `cursor.scrollToStep` to step 8,192 (the reader width), for
each writer, sent together (one turn, no settle). No admitted clip has a cell
there. The next write confirms its own page first, so the park needs no
check.

A review found that the first version of the park used the grid of the last
confirmed view. The preflight confirms a repeated view once, so a write of
grids 1/512, 1/4, 1/512 recorded 1/4 while the batch ended on 1/512: the park
landed at beat 64, inside the clip. The park now sets its own grid. An offline
test pins this case, and a live mixed-grid add (1,024 notes, channel 8 on the
1/4 grid) verified and held 4,864 `NoteStep` (+1 MiB) after the park
([heap-1024-mixed](../data/phase8h4g-review/writer-width/final/heap-1024-mixed-4194304.json)).
The other final-build runs used the first version; the frames of a single-grid
write (all of them except this case) park at the same position.

The transient during a write is not parked: the writer holds the written
clip until the park, then the verify read binds the reader.

| Sounding cells (parked) | Add, ZGC used peak | Read alone, used peak |
|---:|---:|---:|
| 1,048,576 | 1,836 MiB | 1,332 MiB |
| 1,572,864 | 2,468 MiB | 1,732 MiB |
| 2,097,152 (reader limit), override | 2,786 MiB | 2,168 MiB |
| 2,097,152 (reader limit), default | 2,450 MiB | 2,196 MiB |

Maximum: 3,072 MiB. "Used" includes garbage (E246). Each add at the limit
read back `verified` in 3.3–3.5 s, and the extension answered after it.
E246's read alone at the limit peaked at 2,604 MiB. The parked writer's cells
are garbage when the reader binds, so the live set is about the larger of the
two and not their sum. At 512 steps the same add needs 257 page checks
(about 54 s).

The live heap after the final runs rose from 359 to 495 MiB with no
`NoteStep` retained (16 after the release). The deleted fixture tracks stay
in the Bitwig undo history. This is not a writer cost.

### Costs that moved

- Each apply that writes notes sends one more wire call and turn (the park,
  about 24 ms). `phase8h4c-edit.ts cost`: one read and one 16-note insertion
  1,790–1,832 ms (E247: 1,857–1,951 ms). The removed page checks of a
  multi-page clip are larger than the park.
- E236 matrix A to D, unattended, `verify-offline` with no issue: whole-clip
  edits of notes with nondefault expression 5,683 → 1,929 ms and
  6,913 → 1,934 ms (each property stage was a page per channel). The other
  steps are within ±5 percent of E247.
- 8h4d workflow (`verify-offline`, no issue): `agent-native-v1` 8 calls,
  6,745 ms (E247: 6,895); `stable-v1` 12,773 ms.

### Scaling after the change

The page checks of a write are now at most one for each view (cursor, clip,
grid). The remaining write cost scales with the property stages (one for each
channel with nondefault expression, each after a grid settle), the planner
(notes), and the capture (sounding cells, bounded by the reader limit).
Nothing in an admitted write scales with the clip length.

## Extension changes

- `RigConfig.fineSteps` default 512 → 4,194,304. `rig.json` can still set it.
  The rig config file did not change (SHA-256 `256bbf07…`). A review (P2)
  found that an override back to 512 still allowed direct writes of 111 s.
  The live adapter now refuses every note write before mutation when the
  writer width is not the reader width (`WriterWidthError`, tool code
  `unhealthy`; D41). The extension keeps the override for research.
- `cursor.getNotes`, `cursor.getNotesVerbose`, and
  `cursor.getNotesVerboseAllChannels` call `getStep` for each cell of the
  window. A scan of a window wider than 8,192 steps now needs `maxX`
  (a refusal otherwise); `cursor.getNotes` accepts `maxX`. No product path
  calls them. Without the guard, a raw call on a writer cursor would scan
  536 million cells on the control-surface thread.
- No wire method changed: 89 methods, `0ef817f4bac8a8a7`. Archive SHA-256
  `e030bfd6349f5acb3de4849a50a2b4b2784cf6d8ed33fff87e245b728f9bbea2`.

## Verification

- Offline: the review case needs one page at the reader width and 512 at
  512 steps; a write ends with the two park frames; a mixed-grid write parks
  at 8,192 beats; a 512-step, 2,048-step, or unreported writer refuses
  `note.write` and `note.remove` with no cursor or batch frame, and a
  clip-wide clear still runs. A live far-end check after the guard: add
  2,532 ms, pan 2,163 ms, remove 1,401 ms, all `verified`. Three 2i tests now check the
  reset to page zero before the park.
- Extension tests (20 reader groups) and archive registrations.
- Fresh hello after the operator replaced the controller: `normal-v1`,
  initialization `2026-10-08T05:21:10.834Z`, `fineSteps` 4,194,304.
- Live artifacts: [writer-width](../data/phase8h4g-review/writer-width/)
  (the root has the 512-step baseline and the unparked heap; `parked/` has
  the override runs; `final/` has the default build: all the drivers above,
  `accept.json.gz`, `cost.json`, and the workflow).

## Retrospective

The cost model named the retained heap before the probe, and the first heap
run measured it. This made the park a planned part of the change and not a
late fix. A worst case needs the quantity that the cost scales with; the
model for this change named it: cells in the window.
