---
title: Phase 8h2b — Exact reader consolidation
kind: plan
state: planned
status: Planned. Select the exact clip reader, then remove the 1/768 view and fix or refuse the disabled-control loss on the selected route.
updated: 2026-10-05
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h2a-replay-cold-read.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E131, E139, E214, E219, E224, E225, E227; D8, D9, D23
---

# Phase 8h2b — Exact reader consolidation

## Why

Cache promotion (8h1) uses the stable
[E131 reader](../../evidence/experiments/e131-consolidated-clip-acquisition.md)
as its exact fallback. The 8g shadow exact fallback
(`ShadowAuthorityFallback.java`) stays a comparison oracle only. The two
readers differ:

| | E131 (`readFineClipNotes`, `adapter.ts`) | Shadow exact fallback |
|---|---|---|
| Cursor | Shared fine cursor; moves the visible selection | Dedicated pinned observer; no selection move |
| Extent | Clip extent: `max(playStop, loopEnd)` | Fixed configured coverage |
| Paging | 2,048-step pages, settlement at each page and grid | One unpaged view |
| Grids | `1/512` and `1/768`, reconciled | `1/512` only (D23) |
| Guards | Project, generation, and content drift | Step-delta window (D26, D27), identity guard, storage admission |
| Output | Normalized notes and the exact source for write guards | Normalized notes only |

[D23](../../decisions/d23-normalized-clip-acquisition-uses-one-1-512-view.md)
selected one `1/512` view for normalized acquisition. It explicitly kept the
E131 dual-grid implementation and D8 checkpoint fidelity unchanged until a
later session adopts the boundary. No session owned that change. This plan
owns it.

[E224](../../evidence/experiments/e224-final-shadow-acceptance.md) found that
a stable transpose through the E131 reconstruct path enables disabled chance,
occurrence, recurrence, and repeat controls on notes that the patch did not
mention, and resets disabled recurrence values. The
[migration contract](../../contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md)
requires refusal of reconstruction that would lose such state.

[E225](../../evidence/experiments/e225-cache-limit-knee-sweep.md) adds three
reader findings. Without `adapter.hello()`, the exact source tool reads a
1-beat pool grid, truncates onsets, and still reports a complete source; it
must refuse instead. The 4,096-note source limit refuses only after a full scan
of up to 127 s. Read time grows with clip length: 40.7 s, 256 s, and 711 s at
64, 256, and 512 bars.

## Entry

[8h2a](8h2a-replay-cold-read.md) is complete. Its replay reader is a
candidate in step 1 below; if 8h2a accepted it, compare the others against it.
[E227](../../evidence/experiments/e227-replay-cold-read.md) found that a
Ghostnote write issued during the replay can follow the step-delta
confirmation. Step 4 adds a write queue so that Ghostnote never writes while a
read is open. Read D30.
8h1 is complete, or 8h1 explicitly records that it refuses the E131 loss
before a write. Read E131, E139, E214, E219, E224, D8, D9, D23, and the
migration contract. Keep stable authority until this session selects and
verifies a replacement.

## Work, in order

### 1. Select the exact reader

Do this first. Other E131 work is wasted if the route changes.

1. Measure E131 and the shadow exact fallback on the same owned clips:
   1, 4, 16, and 64 bars; sparse and dense; all 16 channels. Record wall time,
   host work, settlement time, bridge bytes, and the visible selection change.
   Do not assume that the unpaged route is faster. At 2,048 cells E224 measured
   2.52 s for the shadow fallback, and E131 measured 0.8–2.4 s. E214 measured
   about 4.6 s of host work for one 131,072-cell dense scan. E131 cost is
   dominated by settlement for each page and grid.
2. Include a third candidate: sparse acquisition through a pinned step-data
   observer that reads only occupied coordinates (E131 sparse proof, E139).
   State its replay proof. The 8g canary rule applies if it reuses a recorder.
3. For each candidate, state the write-guard gap. The shadow fallback returns
   no exact source today. Name which writer and checkpoint guards need exact
   source, and whether a `1/512` normalized source satisfies them under D23.
4. Select one route with the measured reason. Record the decision. If the
   selected route is not E131, migrate the stable read path and its guards to
   it, and keep E131 only as a diagnostic control until retirement is recorded.

### 2. Remove the `1/768` view

Apply D23 to the selected route. Read one `1/512` view with nearest-cell
handling as the host binding specifies.

The removal changes a write boundary. D9 grids can write triplet onsets.
A triplet onset read at `1/512` rounds down to its cell. A reconstruct write
from that base would move unmentioned triplet notes. Before removal, select
one policy and test it:

- the writer stops reconstructing unmentioned notes; or
- reconstruction refuses when an unmentioned note has a sub-cell source onset;
  or
- D8 checkpoint fidelity is explicitly amended to the D23 boundary.

Remove the dual-grid reconciliation, its page and settlement cost, and any
`1/768` observer. Record D23 adoption for mutation and reversal in D8 or a new
decision.

### 3. Fix or refuse the disabled-control loss

If the selected writer still reconstructs, preserve the enable flag and raw
value of chance, occurrence, recurrence, and repeat on every note that the
patch does not mention. If preservation is not proved, refuse the write before
any host mutation. Reproduce the E224 fixture: disabled controls with
non-default values, a transpose of other notes, and an independent raw read
after the write.

### 4. Queue Ghostnote writes behind an open read

A queued write is cheaper than a wasted read and a retry. Put the queue in the
extension, where every bridge request and internal task runs on the controller
thread. A brain-side queue does not cover other clients or deferred tasks.

1. **Classification.** Every bridge method is either a read or a project write.
   Undo, redo, and app actions are writes. A method that has no
   classification is a write. A test over each runtime method table checks
   this.
2. **Open read.** A read opens just before its bind or resubscribe. It closes
   after its D30 close task and its step-delta confirmation, when its decoded
   state is captured. The release after the read is a cursor move, not a
   project write, and needs no queue. More than one read can be open; writes
   wait for all of them.
3. **Queue.** A write request that arrives while a read is open waits in a
   FIFO queue. When the last open read closes, the queued writes run in arrival
   order, each in its own task, as they would run without the queue. Each
   response reports its queued time. A write is never dropped or reordered.
4. **In-progress writes.** Some writes continue in later tasks, for example
   `batch.run` with a delay and group expansion after a create. Such a write
   holds a write lease until its last task ends. A read does not open while a
   lease is held; it waits for the lease. Internal tasks that write use the
   same gate as bridge requests.
5. **Earlier writes.** E227 did not test a write sent in the request just
   before a bind. Measure it. If its delta can arrive in or after the replay,
   a read opens only after a delivery barrier for the last write, for example
   a confirmed step callback or one later host cycle.
6. **Bounds.** A read has a deadline, for example 2 s, well above the E227
   maximum of 698 ms. At the deadline the read refuses and closes, and the
   queue drains. The queue has a length limit; a write above it refuses before
   any host mutation, with a clear reason.
7. **Backstops.** Keep the duplicate-cell refusal and the step-delta window.
   They refuse a read when an edit by the user or the host lands inside the
   replay batch.

## Acceptance criteria

- One exact reader is selected with paired measurements and a recorded reason.
- The selected route reads one `1/512` view. No `1/768` code or cost remains on
  the product path.
- The triplet write policy is selected and tested. D8 or a new decision records
  the fidelity boundary.
- The E224 disabled-control case preserves all unmentioned state or refuses
  before mutation.
- 8h1 cache fallback uses the selected route without new eligibility gaps.
- The write queue passes live tests: the E227 in-replay edit, sent as a bridge
  write during an open read, runs after the read closes, and the read holds
  the pre-write state. A write sent just before a bind, a delayed
  `batch.run`, a read deadline, a full queue, and an unclassified method each
  behave as step 4 states.
- Brain check, extension check, wire goldens, artifact verifiers, context check,
  focused live reads and writes, fresh normal hello, and `git diff --check`
  pass. Owned fixtures are removed.

## Out of scope

- Cache admission and eligibility changes (8h1).
- Interface simplification and public naming (8h3).
