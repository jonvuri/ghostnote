---
title: Phase 8h4g — Performance review and 8h closeout
kind: plan
state: planned
status: Planned. Examines the cost of every agent-native-v1 path against its probes and earlier product paths, removes waste, and closes 8h.
updated: 2026-10-07
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4f-tracks-profile-cut-and-closeout.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E45, E54, E227, E229, E231, E234, E236, E246; D8, D15, D16, D18, D19, D21, D38
---

# Phase 8h4g — Performance review and 8h closeout

## Why

8h4c shipped an edit path that took 7.2 s for a 16-note insertion and a reader
that could exhaust the Bitwig heap. The plan had estimated cost from operation
counts; the person found the problem from the wall times. 8h4c2
([E246](../../evidence/experiments/e246-edit-cost-and-reader-heap.md)) found
that most of the remainder was host round trips, not reads. Other paths can
have the same gap between the probe that justified them and the product path
that wraps them. This session looks for it across the whole surface before 8i.

## Entry

Read the [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md),
E246, E227 (sections 1 and 4), E229, E234, E54, and the 8h4f measurements.
Read `brain/src/surface/call-budget.test.ts` and the live adapter frame test.

## Work, in order

### 1. Inventory

For each `agent-native-v1` tool and route, record from a live wire trace
(the `phase8h4c-edit.ts cost` method: executor phases and every wire call
with its time): the wall time, the host turns, the cold reads, the write
stages, the fixed settles, the brain processing time, and the result bytes.
Use the typical case and the largest admitted case.

### 2. Examine each path from three angles

- **Waste.** Calls and work that the result does not need: repeated marks,
  a `tracks()` after a mark that scanned the bank, selection borrows and
  restores around reads that point no cursor, a writer cursor point for each
  apply, two marks in `check_launcher_clips`, the extra delta of a repeated
  read, settles that a readback already covers, and requests that could go
  out together in one turn.
- **Scaling.** Costs that grow with the wrong quantity: work per clip,
  channel, note, device, or parameter that could be per call; sequential
  loops over host objects; whole-document validation and cloning per event;
  property stages per channel on expressive clips.
- **Wall clock against a reference.** Each path against its probe or
  primitive (for example the E227 replay read, 48 ms, against the
  420 ms product read), against the earlier product path that it replaced,
  and against the 60 s client timeout. Name each gap of more than about
  2x and explain it, or remove it.

### 3. Brain planning

Profile `planLauncherClipEdit` and the codec offline at 4,096 and 16,384
notes. E246 measured 12.0 s of planning for 16,384 notes; processing that
input should take a small fraction of the host write. Find where the time
goes (validation, `cloneJson`, `mappedNote` called twice for each changed
note, the materialization, projection, and hashing) and fix the largest
causes. Add an offline time budget test.

### 4. Reductions

Remove the waste that has a safe replacement. For each removed call, guard,
or settle, name the failure it covered and the evidence that still covers it.
Keep D15 (independent post-write evidence) and D38. Update the call-budget
tests and the ledger. Rerun the live matrices that the changes touch.

### 5. Records and closeout

Moved here from 8h4f, so 8h closes after the review.

- Amend D8, D16, D18, D19, and D21 with the implemented surface. Update
  `PROJECT.md` and the workstation contract, interface, and verification
  references. Update the 8h parent to complete.
- Write the 8h retrospective target: the simplification that removed the most
  agent work and the retained safeguard that costs the most. Carry both into
  the 8i charter.

## Acceptance criteria

- Every `agent-native-v1` tool and route has a ledger row with its current
  cost, its reference, and its call budget.
- Every gap of more than about 2x against its reference is removed or has a
  named cause.
- Planning for 16,384 notes is a small fraction of the host write, with an
  offline time budget test.
- Every 8h parent acceptance criterion is met or has an explicit open record.
- Brain check, extension tests, wire goldens, context check, live
  comparisons, and `git diff --check` pass. Record the evidence as E247.

## Out of scope

- New features and new host capabilities.
- Changes that remove independent post-write evidence (D15) or widen the
  shared read beyond D38.
