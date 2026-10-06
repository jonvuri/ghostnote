---
title: Phase 8h3c — Cold-reader promotion
kind: plan
state: done
status: Complete. Product cold reads, normalized mutation, disabled controls, and write queues pass E230. Fixtures are removed and fresh normal hello passes.
updated: 2026-10-05
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h3b-replay-fetch-cost.md
next: 8h3d-change-awareness.md
evidence: E131, E139, E214, E219, E224, E225, E226, E227, E228, E229, E230; D8, D9, D23, D26, D27, D30, D31
---

# Phase 8h3c — Cold-reader promotion

## Result

Complete in [E230](../../evidence/experiments/e230-cold-reader-promotion.md).
All eight paired fixtures match E131 inside D31. All refusal and gate cases
pass. Raw disabled controls are preserved. E131 is retained only as a named
diagnostic. Brain check passes 1,887 tests; extension checks and artifact
verifiers pass. Owned fixtures are removed, the owned project is closed
without saving, and fresh normal hello passes. Changes are staged only.

## Why

The replay cold reader ([E227](../../evidence/experiments/e227-replay-cold-read.md),
[D30](../../decisions/d30-replay-batch-and-start-signal-are-named-assumptions.md))
reads a complete clip exactly in 46–698 ms. The stable
[E131 reader](../../evidence/experiments/e131-consolidated-clip-acquisition.md)
takes 40.7 s, 256 s, and 711 s at 64, 256, and 512 bars (E225). This session
replaces E131 on every product path, for reads and for writes. E131 is
retired, unless [8h3a](8h3a-cold-read-dealbreaker-check.md) finds a
dealbreaker.

| | E131 (`readFineClipNotes`, `adapter.ts`) | Replay cold reader |
|---|---|---|
| Cursor | Shared fine cursor; moves the visible selection | Dedicated pinned cursor; selection effect per 8h3a |
| Extent | Clip extent: `max(playStop, loopEnd)` | Full width, 4,194,304 steps (E225) |
| Paging | 2,048-step pages, settlement at each page and grid | One bind; one replay batch (D30) |
| Grids | `1/512` and `1/768`, reconciled | `1/512` only (D23) |
| Guards | Project, generation, and content drift | D30 close, duplicate-cell refusal, step-delta window (D26, D27) |
| Output | Normalized notes and the exact source for write guards | Normalized notes only |

[D23](../../decisions/d23-normalized-clip-acquisition-uses-one-1-512-view.md)
settles one 1/512 view with occupied-cell rounding. Triplet and other sub-cell
onsets are not kept. No other triplet policy is needed.

[E224](../../evidence/experiments/e224-final-shadow-acceptance.md) found that
a stable transpose through the E131 reconstruct path enables disabled chance,
occurrence, recurrence, and repeat controls on notes that the patch did not
mention, and resets disabled recurrence values. The
[migration contract](../../contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md)
requires refusal of reconstruction that would lose such state.

E225 also found that the exact source tool, without `adapter.hello()`, reads a
1-beat pool grid, truncates onsets, and reports a complete source. The new
reader must refuse when its configuration is absent.

## Entry

8h3a is complete, and no dealbreaker is open. Use its product rules: bind
source, selection restore, delivery barrier, and tripwire.
[8h3b](8h3b-replay-fetch-cost.md) is complete; use its fetch format. Read
E131, E139, E214, E219, E224, E227, D8, D9, D23, D30, and the migration
contract.

## Work, in order

### 1. Product reader

The product park target is the master track. It has no Launcher clips.
Prove this route with three repeated owned reads before other live cases.
If it fails, stop live work and ask the operator.

Move `ShadowReplayReader` from research to a product reader in the normal
profile:

1. One reader cursor, 1/512, 4,194,304 steps wide. This is the product clip
   width limit (E225). Clips beyond it refuse clearly.
2. The read follows D30: open, bind under the 8h3a bind-source rule, close at
   the later of the first-callback task and the `clipExists` task, decode
   from callbacks only, confirm while subscribed, and then release (park or
   unsubscribe, E226). E228 ran its oracle before explicit release.
3. One read is open at a time. Other reads wait in order.
4. A read has a deadline, for example 2 s, well above the E227 maximum of
   698 ms. At the deadline the read refuses and releases.
5. Keep the duplicate-cell refusal, the step-delta window, and the 8h3a
   tripwire. A tripwire event is reported, not hidden.
6. Restore the visible selection by the 8h3a rule, if the bind moves it.
7. Use the 8h3b fetch format, with new wire goldens: `packedDict`
   (E229), one page up to 131,072 notes, encoded on the controller thread.
   Encode the close-task copy. Decode in the brain and fill omitted
   defaults.
8. The reader refuses when its configuration is absent.

### 2. Write guards on the new source

Name each writer and checkpoint guard that reads E131's exact source. Move
each to the normalized 1/512 source of the new reader. Remove the `1/768`
view, the dual-grid reconciliation, and its page and settlement cost. Record
D23 adoption for mutation and reversal in D8 or a new decision.

### 3. Fix or refuse the disabled-control loss

If the writer still reconstructs, preserve the enable flag and raw value of
chance, occurrence, recurrence, and repeat on every note that the patch does
not mention. If preservation is not proved, refuse the write before any host
mutation. Reproduce the E224 fixture: disabled controls with non-default
values, a transpose of other notes, and an independent raw read after the
write.

### 4. Queue Ghostnote writes behind an open read

A queued write is cheaper than a wasted read and a retry. Put the queue in the
extension, where every bridge request and internal task runs on the controller
thread. A brain-side queue does not cover other clients or deferred tasks.

1. **Classification.** Every bridge method is either a read or a project write.
   Undo, redo, and app actions are writes. A method that has no
   classification is a write. A test over each runtime method table checks
   this.
2. **Open read.** A read opens just before its bind. It closes after its D30
   close task and its step-delta confirmation, when its decoded state is
   captured. The release is a cursor move, not a project write, and needs no
   queue.
3. **Queue.** A write request that arrives while a read is open waits in a
   FIFO queue. When the read closes, the queued writes run in arrival order,
   each in its own task. Each response reports its queued time. A write is
   never dropped or reordered.
4. **In-progress writes.** Some writes continue in later tasks, for example
   `batch.run` with a delay and group expansion after a create. Such a write
   holds a write lease until its last task ends. A read does not open while a
   lease is held; it waits for the lease. Internal tasks that write use the
   same gate as bridge requests.
5. **Earlier writes.** Apply the 8h3a delivery barrier before a read opens
   after a write.
6. **Bounds.** The queue has a length limit. A write above it refuses before
   any host mutation, with a clear reason. The read deadline drains the queue.

### 5. Retire E131

Remove E131 from every product read, write, preflight, and reversal path. Use
it only as the paired comparison for this session's acceptance runs. Then
remove it, or keep it only as a named diagnostic. Record the retirement:
removed methods, tools, profiles, and tests, and any compatibility break.

## Acceptance criteria

- The replay reader serves every product clip read and every write preflight.
  No product path calls E131.
- Paired reads against E131 are exact on owned clips of 1, 4, 16, and 64 bars,
  sparse and dense, on all 16 channels. Paired reads record wall time, bridge
  bytes, and the selection effect.
- The read refuses clearly for a clip beyond the width limit, a deadline, a
  duplicate cell, a step-delta violation, and an absent configuration.
- No `1/768` code or cost remains on the product path. D8 or a new decision
  records the D23 boundary for mutation and reversal.
- A normalized cell start with a triplet duration reconstructs and verifies
  inside D31. Unsupported durations still refuse before mutation.
- The E224 disabled-control case preserves all unmentioned state or refuses
  before mutation.
- The write queue passes live tests: the E227 in-replay edit, sent as a bridge
  write during an open read, runs after the read closes, and the read holds
  the pre-write state. A write just before a bind, a delayed `batch.run`, a
  read deadline, a full queue, and an unclassified method each behave as
  step 4 states.
- The E131 retirement record is complete.
- Brain check, extension check, wire goldens, artifact verifiers, context
  check, focused live reads and writes, fresh normal hello, and
  `git diff --check` pass. Owned fixtures are removed.

## Out of scope

- Change awareness without a resident grid (8h3d).
- Cache machinery and its promotion (8h3e).
- Interface simplification and public naming (8h4).
