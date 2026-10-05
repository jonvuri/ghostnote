---
title: E227 — Replay cold read
kind: evidence
state: active
updated: 2026-10-05
owner: phase-8h2a
---

# E227 — Replay cold read

## Status

[8h2a](../../plan/phase-8/8h2a-replay-cold-read.md) is complete. Experiments 1
to 4 ran. All 160 binds from an empty park target delivered the complete step
replay in one batch. The task from the first callback saw every callback. The
task from the target `clipExists` value callback also saw every callback, also
for an empty clip. Decode from callbacks only was exact at every size. The
complete read took 46–698 ms; E131 took 11.3–11.7 s at 64 beats.

Edits by the user or the host need no refusal: the replay is one coherent
snapshot. The only gap is Ghostnote's own writes. A Ghostnote write issued
during the replay is applied after it, and in 6 of 10 trials its delta arrived
after the confirmation task. Ghostnote must therefore not write while a read is
open. 8h2b enforces this with a write queue. See section 3.

The user accepted the completion and start rules as named assumptions in
[D30](../../decisions/d30-replay-batch-and-start-signal-are-named-assumptions.md).
All results keep `complete:false` and `eligible:false`.

## Method

The research build `8h2a-replay-v1` (profile `phase-8-probe-v1`, 98 methods,
hash `d89cee6bf21c1f96`) adds `ShadowReplayReader`. It is one cursor track and
launcher cursor clip, 4,194,304 steps wide (8,192 beats) at 1/512 beat, with
128 keys. `cache.shadow` operations `replayAct`, `replayStatus`, and
`replayNotes` drive it. No bridge method was added.

`replayAct` can start a new epoch in the same call as the cursor action, so
times are from the action. `ReplayEpoch` records each note-step callback and
decodes NoteOn cells into notes. It never calls `getStep`. A callback that
arrives while no batch task is pending schedules a zero-delay task (D27). That
task records the callback count and schedules one confirmation task. Value
observers on `clipExists`, `sceneIndex`, `loopLength`, `playStop`, and the
track `channelId` each schedule a task too. A second NoteOn or an Empty
callback for a decoded note counts as a duplicate cell.

The config had the 8h1a width config at 4,194,304 steps, 2 cache views, a 16×16
bank, the knee fixture writer, and no sounding proxies. The owned project
`New 2` had a park track with no clip and one track for each fixture, with the
clip at row 0. A point action alone therefore binds the clip.

| Fixture | Beats | Notes | Duration cap | Sounding cells |
|---|---:|---:|---:|---:|
| `empty-64` | 64 | 0 | — | 0 |
| `one-64` | 64 | 1 at cell 0 | 4 | 4 |
| `final-8192` | 8,192 | 1 at cell 4,194,303 | 1 | 1 |
| `n4096-64` | 64 | 4,096 | 64 | 32,768 |
| `n16384-512` | 512 | 16,384 | 64 | 262,144 |
| `n4096-8192` | 8,192 | 4,096 | 64 | 262,081 |
| `n131072-2048` | 2,048 | 131,072 | 4 | 524,285 |
| `sustain-2048` | 2,048 | 16,384 | 64 | 1,048,513 |

Spec fixtures use the 8h1a even-spread writer. Then the writer decorates notes
by index mod 8: 0 disables chance, 1 and 5 set gain, 2 and 6 set the chance
value, 3 and 7 mute, and 4 keeps the defaults. The `one-64` note gave the host
defaults: gain 0, chance 1, chance on, not muted.

Each trial points the reader at the fixture track. It observes for at least
2 s after the action and after the last callback (the late-callback oracle).
Then it reads all decoded notes and points the reader back to the park track.
The first trial of each fixture also takes heap samples (`jcmd
GC.class_histogram`) and targeted `getStep` reads through the fixture writer.

## 1. Batch shape and completion

| Fixture | Callbacks | Bind → first | First → last | Read complete (median / p95 / max) |
|---|---:|---:|---:|---:|
| `empty-64` | 0 | — | — | 46 / 52 / 53 ms |
| `one-64` | 4 | 20–27 ms | < 1 ms | 46 / 54 / 58 ms |
| `final-8192` | 1 | 21–27 ms | 0 ms | 48 / 52 / 52 ms |
| `n4096-64` | 32,768 | 20–27 ms | 2–7 ms | 48 / 53 / 53 ms |
| `n16384-512` | 262,144 | 21–137 ms | 14–71 ms | 103 / 190 / 195 ms |
| `n4096-8192` | 262,081 | 20–94 ms | 10–54 ms | 79 / 153 / 155 ms |
| `n131072-2048` | 524,285 | 44–405 ms | 45–283 ms | 155 / 667 / 668 ms |
| `sustain-2048` | 1,048,513 | 72–385 ms | 62–316 ms | 178 / 658 / 698 ms |

Each row has 20 trials. Every populated trial had exactly one batch. Its task
saw all callbacks, its confirmation saw no more, and no callback arrived in the
2 s oracle. The read complete time is the batch task time; for `empty-64` it
is the `clipExists` task time. No chain was needed.

One batch can last 316 ms. The controller thread runs no other task during
that time. The decode handler was 26 ms median and 111 ms maximum of it at
one million cells. Ping p95 was 23–26 ms after each fixture's trials.

## 2. Start signal

Candidate 1 passes. In all 160 trials the `clipExists` value callback for the
target arrived, and its scheduled task saw every step callback of the binding.
`loopLength`, `playStop`, and the track `channelId` passed too. `sceneIndex`
gave no callback, because the park and target rows are both 0.

An empty clip gives a `clipExists` callback and no step callback. The task from
that callback therefore closes an empty read in about 46 ms. Candidates 2 and 3
did not run, because candidate 1 passed.

## 3. Decode and exactness

All 160 decoded reads matched the declared fixture on channel, cell, pitch,
velocity, duration, gain, chance, chance enable, and mute. The first trial of
each fixture matched targeted `getStep` reads at the first, last, middle, and
final notes and the first note of each of the 16 channels. Paired E131 reads
of `one-64` and `n4096-64` were exact (section 4).

### Concurrent edit

The fixture writer stayed on the target. One velocity edit of the last note ran
either in the bind call, before the replay (`pre-replay`), or from inside the
reader observer at half of the replay callbacks (`in-replay`).

| Fixture | Mode | Trials | Batches | Duplicate cell | Changed before confirmation |
|---|---|---:|---:|---:|---:|
| `n16384-512` | pre-replay | 5 | 1 | 5 | 0 |
| `n16384-512` | in-replay | 5 | 2 | 5 | 0 |
| `n4096-64` | pre-replay | 5 | 1 | 5 | 0 |
| `n4096-64` | in-replay | 5 | 2 | 5 | 4 |

- A pre-replay edit is inside the replay batch: the edited note arrives twice.
  The duplicate-cell rule refuses it at the completion task.
- An in-replay edit is applied after the replay batch. The replay is a coherent
  snapshot from before the edit. Its delta came 23–95 ms after the
  confirmation at `n16384-512`, and before it in 4 of 5 trials at `n4096-64`.
  The step-delta window therefore confirmed a pre-edit read in 6 of 10 trials.
  The 2 s oracle saw every delta.

The plan asked that a concurrent edit refuse the read. That is stricter than
correctness needs:

- An edit by the user or the host is either inside the one-batch snapshot or
  delivered later as a separate change (D26). The read is correct as of its
  snapshot. No refusal is needed. The duplicate-cell rule still refuses an
  edit that lands inside the replay batch.
- A Ghostnote write during the read is the real gap. The read can return
  without the write that Ghostnote itself issued. The bridge runs requests as
  separate tasks and can answer them out of order, so a convention is not
  enough. 8h2b queues every Ghostnote write behind an open read.

The criterion is therefore met for edits by the user or the host, and it is
replaced by the 8h2b write queue for Ghostnote's own writes.

### Fixture finding

A settled host read of gain is twice the written value (as E2 records). An
immediate read returns the cached written value. A repeated equal setter
leaves the writer's cache at the written value, while a fresh replay shows the
host value. The driver therefore rebinds the writer before it verifies a
fixture. A retried partial decoration doubled gain in a first run; no retained
artifact uses that run.

## 4. Cost

| Fixture | Decode handler (median / max) | Bridge | Fetch | Heap while bound | Release last callback |
|---|---:|---:|---:|---:|---:|
| `one-64` | < 1 ms | < 1 KiB | 24 ms | +0 MiB | 23 ms |
| `n4096-64` | 2.8 / 3.5 ms | 211 KiB | 40 ms | +9 MiB | 36 ms |
| `n16384-512` | 12 / 30 ms | 872 KiB | 70 ms | +79 MiB | 74 ms |
| `n4096-8192` | 11 / 20 ms | 223 KiB | 39 ms | +71 MiB | 105 ms |
| `n131072-2048` | 19 / 111 ms | 6.7 MiB (8 pages) | 379 ms | +170 MiB | 103 ms |
| `sustain-2048` | 26 / 111 ms | 878 KiB | 66 ms | +313 MiB | 141 ms |

The bound heap is one `NoteStep` for each sounding cell, as in E225. Each
release to the park track delivered one Empty callback for each cell. It then
returned the note-step count to the baseline of 8 at every size. The fetch
time is the brain wall time for all `replayNotes` pages.

| Reader | 4,096 notes, 64 beats | Larger clips |
|---|---:|---:|
| Replay cold read (this record) | 48 ms + 40 ms fetch | 178 ms median, 698 ms max at 1,048,513 cells |
| E131 | 11.3–11.7 s (16 bars) | 40.7 s at 64 bars; 711 s at 512 bars (E225) |
| Shadow exact fallback | — | about 1 s for each 2,048 steps (8h2a plan) |
| Cache readmission (E226) | — | 6–7.4 s at 0.5–1 M cells |
| E225 warm cache read | 118 ms | 377 ms at 16,384; 3.29 s at 131,072 notes |

## Named assumptions

The user accepted these in
[D30](../../decisions/d30-replay-batch-and-start-signal-are-named-assumptions.md):

1. **Replay batch.** A cursor clip proxy that binds a clip delivers its
   complete step replay in one delivery batch. With D27, the task scheduled
   from the first replay callback runs after the complete replay.
2. **Start signal.** The target `clipExists` value callback arrives in the
   replay batch or after it. The task that it schedules therefore closes the
   read, also for an empty clip.

The evidence is 160 of 160 trials from one host version and controller-issued
binds. It does not cover native input, a target that changes during the bind,
or other host versions.

## Artifacts and restoration

Data is in [phase8h2a-replay](../data/phase8h2a-replay/). The
`smoke-one-64.json` file is a two-trial pipeline check.
`brain/src/probes/phase8h2a-replay-artifacts.test.ts` recomputes each
completion, start, and window verdict from the raw epochs.

The original rig config (SHA-256 `256bbf07…43b0`) is restored. The research
archive is removed and the normal archive is deployed. The operator closed
`New 2` without saving and replaced the controller. The UI shows
`gn-scale-test`. The normal hello passes: `normal-v1`, 85 methods, hash
`bba7383dce25c0f0`. Initialization at `2026-10-05T07:48:57.336Z` is newer than
deployment. `restoration.json` records this.
