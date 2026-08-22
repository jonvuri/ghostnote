---
id: E53
kind: evidence
state: active
source: phase-4-session-4b-note-completion-signals
---

# E53 — Note-step observer is a partial wake hint [K] (2026-08-21)

**Verdict: `Clip.addNoteStepObserver()` can wake exact verification after most
note mutations. It is not a completion fence. Four enable fields produce no
callback. Exact bulk readback must remain the success proof.**

## Existing cost shape

The controlled baseline used two empty 32-beat clips on one owned track. It ran
the current public `write_notes` path and exact reversal. Note count did not
increase request, stage, page-turn, settle, or verification counts.

| Case | Time | Requests | Stages | Page turns | Bulk reads | Verification |
|---|---:|---:|---:|---:|---:|---:|
| 1 basic note | 4,301 ms | 89 | 1 | 8 | 4 | 1,233 ms |
| 16 basic notes | 4,011 ms | 89 | 1 | 8 | 4 | 1,030 ms |
| 64 basic notes | 4,105 ms | 89 | 1 | 8 | 4 | 1,132 ms |
| 16 expression notes | 5,656 ms | 101 | 2 | 14 | 4 | 1,090 ms |
| Four writer pages | 11,684 ms | 149 | 5 | 38 | 4 | 1,217 ms |
| Two clips, basic | 7,790 ms | 174 | 1 | 16 | 8 | 2,653 ms |
| Two clips, expression | 11,444 ms | 199 | 4 | 28 | 8 | 2,879 ms |

The basic cases each used four cursor-point settles, ten grid-change settles,
and one note-write settle. Expression properties added dependency stages and
grid settlement. Writer pages added five dependency stages and 52 grid-change
settles. Clips increased target acquisition and exact reads. The next session
must optimize distinct clips, pages, and dependency turns. It must not describe
note count as the current source of repeated cost.

## Observer matrix

One dedicated pinned 2,048-step cursor held an init-only note-step observer.
Each arm recorded a target generation, durable track ID, track index, slot,
grid, page, callback sequence, and callback time. The log is bounded at 16,384
events. Callback failures cannot escape into the control thread.

The matrix passed note add, single clear, move, full clear, all 16 MIDI channels
in one turn, a triplet note on channel 15, a binary note at the 32-beat edge,
and notes across four writer pages. The first callback arrived in 39–44 ms.
The first exact complete read arrived in 74–259 ms. A mutation produced from one
to 16 callbacks. A callback did not identify the submitted batch.

All 20 contract-writable note entries passed exact readback on binary and
triplet grids. Numeric fields, enum fields, recurrence, and `isMuted` produced
callbacks. Their first exact read after a callback was complete in the sampled
cases. These four fields produced zero callbacks on both grids:

- `isChanceEnabled`
- `isOccurrenceEnabled`
- `isRecurrenceEnabled`
- `isRepeatEnabled`

Their bounded fallback read observed the exact value after 439–470 ms. Pressure
was not tested as a write because E24 classifies it as unwritable.

## Scope and interference

A fresh controller reload delivered zero initial callbacks. Cursor point, pin,
grid, and page changes also delivered zero callbacks while the generation was
unarmed. An edit on another clip delivered zero eligible callbacks. Events from
an old target could not enter a new generation.

A foreign edit on the armed clip delivered two eligible callbacks. The exact
read found both the intended and foreign note and exposed the conflict. Target
matching therefore prevents stale or unrelated wakes, but it cannot prove
ownership of same-target activity.

At the accepted `256/128/8/16/64` scaffold, the extension reported one observer
cursor and one note-step observer. Rig construction took 64 ms. Extension
initialization took 88 ms. Thirty pings measured 24.18 ms at p50, 27.38 ms at
p95, and 27.70 ms maximum. No sample exceeded the 100 ms boundary.

## Classification

| Operation class | Classification | Next-session rule |
|---|---|---|
| Add, clear, move, full clear, channel batch, and writer-page batch | Wake hint | Wake one exact read early. Keep timeout and fallback. |
| Numeric, enum, recurrence, and mute properties | Wake hint | Wake one exact read early. Keep timeout and fallback. |
| Four enable fields | Unusable | Use bounded polling or the measured fixed fallback. |
| Same-target activity | Wake noise | Exact read must detect the intended result or a conflict. |

No measured class has a completion fence. The next session can use an eligible
event only to schedule exact verification. It cannot return success from the
event itself.

Cleanup removed the owned track and both clips. It restored the exact entry
track, slot, and mixer selection. The accepted seven-track project baseline
passed after cleanup.

## Retrospective

Callback support differs by property. Test each control field. Do not infer its
signal from the related value field.
