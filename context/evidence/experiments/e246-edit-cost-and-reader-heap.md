---
title: E246 — Edit cost and reader heap guard
kind: evidence
state: done
updated: 2026-10-07
owner: phase-8h4c2
---

# E246 — Edit cost and reader heap guard

## Status

[8h4c2](../../plan/phase-8/8h4c2-edit-cost-and-reader-heap.md) is complete.
One read and one 16-note insertion on the typical clip take 1,892 ms
(E236: 7,176 ms; target 2,000 ms). A whole-clip velocity edit takes 1,772 ms,
27 percent of E236 A3 (target: at most 50 percent). Every E236 matrix A edit
reads back `verified`, and both reversal routes restore the exact raw state.
The cold reader refuses a clip above 2,097,152 sounding cells with
`sounding-cell-limit`; the tools return `outside-limit`, and the extension
stays alive.

The plan's two causes accounted for about 60 percent of the cost. The rest was
host round trips: each wire call takes one control-surface turn of about
24 ms. The operator chose to remove these too (adapter changes 3 and 4 below).
[D38](../../decisions/d38-a-shared-preflight-read-is-the-stash-only-on-the-targeted-route.md)
limits the shared read to the targeted route. Tool descriptions are at v29.

## Changes

1. **Lowering against the host insertion values.** The planner omits each
   portable group of a new note or a changed field that has its portable
   default, then each raw value that equals the host insertion value
   (HOST-BINDING "Defaults and proposed changes"). A new note with default
   values writes no property. A 16-note insertion is one stage (E236: 32).
   The readback compares each raw field with the host insertion value for an
   omitted field.
2. **Reads.** The executor verify read covers the complete clip with its D32
   source and is the tool readback (D15: a new `clip.read` capture). On the
   targeted route the tool read is also the executor stash read
   (`snapshotPreflight`); the executor judges the reference on it again with a
   new delta and mark, and skips its separate resolve. Other routes keep the
   executor stash read (D38). A targeted edit reads the clip twice (E236:
   four times); any other edit three times.
3. **Note-step wake off.** The E54 wake pointed a second cursor and waited one
   grid settle (about 450 ms) to end the 25 ms `noteWrite` wait early. It is an
   adapter option now (`noteWake`), off by default. The executor verify read
   still checks every result.
4. **Marks.** A mark is `revision.get` plus the `track.list` bank scan. The
   adapter now sends both together: one turn, not two. A `ContentDelta`
   carries the mark that closes it (`mark`), so a caller that needs a mark
   after a read uses it instead of another request.
5. **Sounding-cell limit.** `ClipReader.SOUNDING_CELLS = 2,097,152`. The
   capture counts NoteOn and NoteSustain callbacks before the close; past the
   limit it stops decoding, and the confirmation refuses
   `sounding-cell-limit`. The reply adds `sounding`, `heapBindMb`,
   `heapCloseMb`, and `heapMaxMb`; `rig.info` adds `soundingCells` and the
   build marker `limitRule: sounding-cell-limit-v1`. The brain checks the
   value at the read and maps the refusal (and `clip-beyond-reader-width`) to
   `ClipReadLimitError`, code `outside-limit`. No wire method changed:
   88 methods, `68d457c4c4d1d7b3`.

The fake adapter now reports release velocity and the four enable flags on
every note read, as the live reader does (D31). A trap knob
(`setPartialNoteReads`) keeps the partial-read refusal testable.

## Heap ladder

`phase8h4c2-ladder.ts ladder` on the unchanged build, owned unsaved project
`New 2`. 4,096 legato notes on 16 channels at fixed cells per note. Bitwig's
Java heap holds the extension: ZGC (generational), `-Xms300m -Xmx3g`, 388 MiB
used at entry. `jcmd GC.heap_info` sampled every 100 ms; ZGC "used" includes
garbage that is not yet collected.

| Cells per note | Sounding cells | Read ms | Heap before | Peak used |
|---:|---:|---:|---:|---:|
| 64 | 262,144 | 194 | 366 MiB | 552 MiB |
| 512 | 2,097,152 | 553 | 786 MiB | 2,604 MiB |
| 1,024 | 4,194,304 | 801 | 2,874 MiB | 3,072 MiB (the maximum) |

All three rungs read every note, and the extension answered after each. At
4.2 million cells the heap reached its maximum during the read. E236 recorded
the failure at 8.4 million cells (65,536 quarter-beat notes: "Java heap
space"); this ladder did not repeat it. The limit is 2,097,152 cells: half the
highest rung that passed, and the E236 16,384-note fixture, which passed. The
heap is shared with Bitwig, so the margin also covers other projects.

`phase8h4c2-ladder.ts limit` with the guarded build:

| Fixture | Sounding cells | Result | Read ms | Heap at close |
|---|---:|---|---:|---:|
| 16,384 quarter-beat notes | 2,097,152 | 16,384 notes | 538 | 2,070 MiB |
| 16,400 quarter-beat notes | 2,099,200 | `sounding-cell-limit` | 498 | 2,794 MiB |

`read_launcher_clip` on the second clip returns `outside-limit`; ping and
`rig.stats` answer after it. The guard refuses after the replay batch: the
host builds its `NoteStep` objects before the extension can count them. It
therefore protects only up to the size that the replay itself survives (at
least 4.2 million cells, below 8.4 million). The limit table names this.

## Cost

`phase8h4c-edit.ts cost` profiles one read and one 16-note insertion on a
rewritten typical clip, three runs each, with executor phases and wire calls.

| Build state | Total ms | Wire calls | Read tool ms | Edit tool ms |
|---|---:|---:|---:|---:|
| Changes 1–2 | 2,994–3,005 | 81–83 | 570–612 | 2,390–2,424 |
| Changes 1–3 and the resolve skip | 2,233–2,240 | 56–58 | 512–561 | 1,672–1,721 |
| Changes 1–4 | 1,877–1,936 | 56–58 | 419–459 | 1,449–1,470 |

Change 4 does not reduce the call count: the two calls of a mark share one
turn.

In the first row, `clip.read` took 573 ms of the 3,000 ms. `track.list` took
about 470 ms, `revision.get` about 330 ms, `slot.status` about 275 ms, and the
second cursor point of the wake about 450 ms. Artifact:
[cost.json](../data/phase8h4c2-cost/cost.json) (the last row).

## Live acceptance

`GN_8H4C_UNATTENDED=1 phase8h4c-edit.ts accept` (the E236 driver) in `New 2`.
The unattended flag skips the B pressure steps and the C project switch, which
add nothing new to this session. A raw writer-cursor note stands in for the C
stale edit. `verify` reports no issue
([accept.json.gz](../data/phase8h4c2-cost/accept/accept.json.gz)).

| Step | Route | Wall ms | E236 wall ms |
|---|---|---:|---:|
| A1 add | targeted | 1,495 | 3,337 |
| A2 remove | targeted | 1,477 | 3,167 |
| A3 velocity | whole-clip | 1,772 | 6,574 |
| A4 pitch | targeted | 1,694 | 3,591 |
| A5 1/512 nudge | targeted | 1,843 | 4,179 |
| A6 expression member | whole-clip | 5,675 | 16,213 |
| A6 gain 0, 0.5, 8 | whole-clip | 6,898 | 16,293 |
| A7 name, length, loop | `clip.update` only | 1,642 | 2,692 |
| B desired document | targeted | 4,680 | 9,860 |
| D cost (read 423 + edit 1,469) | targeted | 1,892 | 7,176 |
| D targeted | targeted | 2,080 | 4,212 |
| D whole-clip | whole-clip | 1,870 | 6,531 |

A6 still writes property stages: the typical clip's notes have host values, but
the A6 notes carry nondefault expression values. The refusals (pressure,
repeat, overlap, past the end, stale, scene append) wrote nothing and took
about 400 ms. Both reversals restored equal raw reads; the concurrent note
blocked a reversal.

**Worst case at the limit.** 16,384 quarter-beat notes (2,097,152 cells), one
desired document that changes every velocity (whole-clip):
read 4,102 ms, edit 47,977 ms (plan 12,003, write 31,609, readback 2,412),
`verified` ([worst-16384.json.gz](../data/phase8h4c2-cost/worst-16384.json.gz)).
E236: 73,040 ms. It is under the 60 s client timeout now; 8h4d keeps the
asynchronous route. The plan time rose from 9.9 s: the planner maps each
changed note twice to find its default groups.

## Verification

Brain check (2,010 tests), binding tests (33), document conformance and
artifacts, extension check (19 reader groups), the publication inventory, the
context check, and `git diff --check`. Fresh hello after the operator replaced
the controller: `normal-v1`, 88 methods, `68d457c4c4d1d7b3`, initialization
`2026-10-07T14:49:01.524Z`, the 8h4a–8h4c2 markers. Archive SHA-256
`34491a92d80ae2a037d274166fdda92717af5333c7cc8fb08f5e017fa82208f6`.

## Retrospective

The plan estimated the cost from stage and read counts. A wire trace with
per-call times showed the larger remainder (round trips) in one profiled run.
Profile the wire calls before a cost plan names its causes. The shared-read
step relied on the revision guard for a person's edit; the 8h4a rule that the
revision counts only Ghostnote writes was in the executor comments, not in the
plan's entry list.
