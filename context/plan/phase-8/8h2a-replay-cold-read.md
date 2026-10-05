---
title: Phase 8h2a — Replay cold read
kind: plan
state: complete
status: Complete. One-batch replay and the clipExists start signal pass 160 of 160 binds (D30); Ghostnote writes must queue behind an open read (8h3c).
updated: 2026-10-05
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h1b-sounding-cell-cost-reduction.md
next: 8h3a-cold-read-dealbreaker-check.md
evidence: E131, E214, E216, E217, E218, E224, E225, E226, E227; D23, D26, D27, D30
---

# Phase 8h2a — Replay cold read

## Status

Complete. [E227](../../evidence/experiments/e227-replay-cold-read.md) records
experiments 1 to 4:

- All 160 binds from an empty park target delivered the complete replay in one
  batch. The task from the first callback saw every callback. No chain was
  needed.
- The task from the target `clipExists` value callback also saw every
  callback, also for an empty clip. It is the start signal; candidates 2 and 3
  did not run.
- Decode from callbacks only was exact at every size, up to 1,048,513 cells
  and 131,072 notes. The complete read took 46–698 ms. E131 took 11.3–11.7 s
  at 64 beats.
- Edits by the user or the host need no refusal: the read is a coherent
  snapshot, and the duplicate-cell rule refuses an edit inside the replay
  batch. A Ghostnote write issued during the replay is applied after it; the
  window confirmed that pre-edit read in 6 of 10 trials. 8h3c queues
  Ghostnote writes behind an open read instead of refusing the read.
- The user accepted both rules as named assumptions in
  [D30](../../decisions/d30-replay-batch-and-start-signal-are-named-assumptions.md).

## Why

[E226](../../evidence/experiments/e226-sounding-cell-cost-reduction.md) bound
a full-width 1/512 proxy to a clip with 1,048,513 sounding cells. The host
pushed one note-step callback for each cell, with its values, 130–150 ms after
the bind. The first and last callbacks were 33 ms apart. This push is a
complete discovery read: it reports every non-empty cell, including cells that
the cache has not seen. Empty cells cost nothing.

The current readers do not use the push as the read:

- E131 pages a 2,048-step window and settles each page. It takes 40.7 s to
  711 s at 64 to 512 bars (E225).
- The shadow exact fallback scans `getStep` over the full grid, at about
  1 s per 2,048 steps.
- A cache readmission takes 6–7.4 s (E226): about 4 s for the canary bind and
  2–3 s to drain the replay as dirty work. Then it reads values with `getStep`.

If the replay alone is a correct cold read in about 150 ms, the cache becomes
much less important. 8h1 must then be planned again. This session ran before
8h1 and 8h2b. Both were later replaced by [8h3c](8h3c-cold-reader-promotion.md) and [8h3e](8h3e-cache-machinery-trim.md).

Two facts are not known. The replay settlement now waits at least 1.5 s and
ten quiet 50 ms polls (the `settling` phase in `ShadowCacheProbe`). That is not a
completion proof:

1. **Completion.** [D27](../../decisions/d27-later-callback-ordering-is-a-named-assumption.md)
   accepts that a zero-delay task scheduled from a callback runs after the
   rest of that delivery batch. If one replay is one batch, a task scheduled
   from the first replay callback marks the end of the replay. E226 suggests
   one batch, but it did not measure batch boundaries.
2. **Start.** An empty target gives no callback. Silence therefore cannot tell
   an empty clip from a replay that has not arrived. The 8g canary stage solves
   this today, at a cost of about 4 s.

Under [D23](../../decisions/d23-normalized-clip-acquisition-uses-one-1-512-view.md)
the reader uses one 1/512 view. It has no 1/768 view.

## Entry

Start from the 8h1b research build. It has a full-width release proxy with
bounded note-step traces, research cursor actions, and the knee fixture writer.
Read E226, E217, E218, D26, D27, and D23. Use an owned project; never use
`gn-scale-test` (D29).

## Experiments, in order

### 1. Replay batch shape and completion

Add a research reader proxy at 1/512 with the largest research width. On each
bind, schedule one zero-delay task from the first callback of the new binding.
Record the callbacks before and after that task. Keep observing for at least
2 s as the oracle for a late callback.

Bind from an empty park target, at least 20 times for each fixture:

- an empty clip, one note, and a note at the final cell;
- 4,096, 16,384, and 131,072 notes;
- the 1,048,513-cell sustained fixture;
- widths from 64 to 8,192 beats.

A fixture passes when no callback for the binding arrives after the task.
A late callback refuses a single-task completion signal. Then measure a chain:
each task re-arms while callbacks arrive in its batch. Record the batch count,
bind-to-first-callback latency, and first-to-last time.

### 2. Start signal

Find a positive signal that the target binding is delivered, also for an
empty clip. Test in this order and stop at the first that passes every trial:

1. The order of the target's value callbacks (clip exists, slot scene index,
   loop length, play stop) and its step replay. If a value callback always
   arrives in the replay batch or after it, a scheduled task from that callback
   can close the read.
2. Resubscribe of a pinned, unsubscribed proxy. Check whether resubscribe gives
   a value callback for an empty clip.
3. A park target with known content. Use this only if a populated park target
   can exist without a write to the user's project.

Record a refusal if no candidate passes. Then the canary stays and only the
completion result applies.

### 3. Decode and exactness

Build normalized notes from the callbacks only: one note for each NoteOn cell,
with channel, pitch, cell, and the note-step values. Do not call `getStep`.
Compare with the declared fixture, targeted reads at the first, last, and final
cells and all 16 channels, and a paired E131 read up to 4,096 notes. Include
non-default velocity, gain, chance, mute, and duration values.

Guard the read with the step-delta window (D26, D27). Write to the clip during
one replay. The read must refuse.

### 4. Cost

For each fixture, measure the complete read: point, delivery, completion,
decode, and release. Also measure bridge bytes, peak live heap during the read,
and the note-step count after release. The release must return the count to the
baseline (unsubscribe or park, E226). Compare with E131, the shadow exact
fallback, and E225 warm cache reads.

## Acceptance criteria

- Experiment 1 records the batch shape for each fixture and accepts or refuses
  a completion signal.
- Experiment 2 accepts a start signal or records a refusal.
- Experiment 3 decodes exact notes from callbacks only at each tested size, and
  a concurrent edit refuses the read.
- Experiment 4 records complete read time, peak heap, and release at each size,
  with paired E131 times.
- If a new named assumption is proposed, the user decides it in a decision
  record. Research results keep `complete:false` and `eligible:false`.
- Owned projects are closed without saving. The normal extension is restored
  with a fresh normal hello.
- Brain check, extension check, wire goldens, artifact verifiers, context
  check, and `git diff --check` pass.

## Out of scope

- Migration of the stable read path and its write guards (8h3c).
- Removal of the E131 1/768 view and the disabled-control fix (8h3c).
- Cache promotion (8h1). [8h3e](8h3e-cache-machinery-trim.md) replaces it.
