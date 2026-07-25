---
title: Phase 1 — The write engine & takes
status: not started
updated: 2026-07-24
parent: ../PROJECT_PLAN.md
prev: PHASE-0-FOUNDATION.md
next: PHASE-2-CLIPS.md
---

# Phase 1 — The write engine & takes

> **Purpose.** Build the machine that makes optimistic application safe, and prove it
> on the one object class where fidelity is exact. Everything after this phase writes
> through this engine and checkpoints into this store. It is the only hard universal
> prerequisite in the plan.

## Why this is second, and why on clips

INITIAL_PROMPT §8a: removing the approval gate removes the mutation-free preview that
would have been the safety net, so *"undo becomes load-bearing infrastructure, not an
ergonomic nicety."* E3 turned that from a premise into a measurement — a 4-note write
takes exactly 4 undos, there is no grouping hook for writes, and the stack is
project-global, so "undo the agent's last batch" maps onto Bitwig's history at no
depth. Owning revert is mandatory.

Clip notes are where that machinery should be born: `setStep → getStep` round-trips
**exact** across all 21 expression properties (E2), so the snapshot is lossless and a
revert bug is unambiguous rather than a fidelity argument. Structural and device ops
have low checkpoint fidelity by comparison — the wrong place to debug a checkpoint
engine.

## Scope

### In

1. **`ghostnoted` — the daemon (D4).** Owns the single bridge connection, the
   adapter, the take store and the change log. Spawn-on-demand from its first client
   is the expected lifecycle. It is also the only process that can usefully hold
   Bitwig observers, which is what makes the change log trustworthy while the user is
   editing concurrently (§8d).
2. **The execution pipeline** — §8b, made real:
   ```
   materialize patch → explicit IDs → known write-set
   → read prior state of exactly those addresses → stash
   → apply optimistically (one batch, staged pacing)
   → read back and verify
   → report: what applied, what didn't take
   ```
3. **The address resolver.** `channelId` UUID as the durable key, resolved to a live
   index on demand, then a pinned non-following pool cursor as the fast handle
   (E1/E2f). Verify the cursor's target before every write; re-point after any
   structural op. **Bank-window overflow detection that refuses to operate** rather
   than working half-blind (E5, standing rule 5).
4. **The take store (D5).** Branchable, project-keyed, on disk. A batch creates a
   take; takes can be compared, jumped between, and **partially reverted by musical
   address** — the write-set is already addressed, so slicing it is natural.
5. **The revision guard.** Lift E8's monotonic counter: it lives on the executor,
   thread-confined to the control-surface thread (no locking — that confinement is
   what makes check-then-apply-then-bump atomic for free). `ifRevision` mismatch
   rejects the **whole batch, applying nothing**.
6. **The in-Bitwig control layer**, per the Phase-0 E14 verdicts. Target shape:
   revert buttons and a take switcher in the Studio I/O panel, `showInEditor()`
   navigation to what changed, and popup notifications as progress signal (E8
   proved they interleave into a paced batch without stalling it).
7. **Async batch completion** — the deferred-response protocol E8 flagged as an open
   Phase-1 build item, so a paced batch can report *completion* rather than only
   acceptance.

### Out

- Musical vocabulary of any kind — Phase 1 writes the notes it is told to write.
- The web UI (Phase 3). Phase 1's visual surface is Bitwig's own.
- Devices, params, modulators. The engine must be *general* over object classes, but
  Phase 1 only exercises the note class.

## The takes model (D5)

The reframe in `PROJECT_PLAN.md` §3 drives this. Concretely, a take is:

- **Addressed, not positional.** Its content is the prior state of exactly the
  addresses the batch wrote — the §8b stash. This is also the "before" side of
  Phase 3's diff: **one mechanism, two features** (§8f).
- **Branchable.** Reverting to an earlier take and proceeding does not destroy the
  branch you left. "Go back to the sparse hats, keep the new bass" must be
  expressible.
- **Fidelity-labelled.** Exact for notes and scalar params; low for structural
  create/delete and anything without readback. A take must carry *what it can and
  cannot restore*, so a revert never silently under-delivers.
- **Snapshot of what was read, never what was requested.** E8's note-adjacency
  finding: consecutive same-pitch notes truncate each other, so a written duration
  is not guaranteed to survive. Readback is the source of truth, everywhere.
- **Human-owned.** The agent may read and explain the log; it may never mutate it
  (§8g, standing rule 8).

## Decisions this phase must make

- **Take store schema and retention.** Depth, pruning, and whether takes survive
  project close. `getDocumentState()` settings persist in the project document —
  which makes the *active take pointer* a natural project-scoped value even though
  take *contents* live in the daemon's store.
- **Stable identity for clips, scenes and devices.** Open question from E2f. Tracks
  are solved; slots are addressed within a track and scene indices compact under
  deletion (E3). Decide the addressing scheme for the rest, or decide that
  track+slot re-resolution is sufficient and scene ops always force a re-point.
- **Daemon lifecycle.** Spawn-on-demand vs. login agent; what happens to in-flight
  state when Bitwig restarts or the project changes.
- **Partial-revert granularity.** By track, clip, time range, pitch range, or
  arbitrary write-set subset. Cheapest useful answer first.
- **What happens when the user edits inside the write-set after the agent wrote.**
  The revision guard catches the *ordering* case; a stale take is a different
  problem. Detection matters more than resolution here — surface it, don't guess.

## Exit criteria

1. A patch of N note ops **applies, verifies by readback, and reverts losslessly**,
   with the revert proven by a full property round-trip across all 21 expression
   properties.
2. It does so **while the user is actively editing** — the E8b test, re-run as a
   standing regression: writes land on the pinned target through concurrent
   selection changes.
3. A stale-revision batch is **rejected whole**, applying zero ops.
4. **Two takes can be A/B compared and switched between from inside Bitwig**, with
   no terminal and no web UI.
5. A project larger than the bank window causes a **loud, explicit refusal**, never
   a partial operation.
6. The whole pipeline is exercised offline against the Phase-0 fake in CI.

## Risks

- **Take branching is more design than expected.** It is a graph, not a stack, and
  the temptation is to over-model. Mitigation: the concrete requirement is A/B
  comparison and partial revert — build exactly that, resist a general VCS.
- **Daemon lifecycle bugs are the classic time sink** (stale sockets, orphaned
  processes, two daemons racing). Mitigation: the extension's revision counter is
  already the cross-process arbiter of ordering (E8); lean on it rather than
  inventing daemon-side locking.
- **The control layer depends on E14.** If the Studio I/O panel disappoints, exit
  criterion 4 needs another home — pulling Phase 3 forward is the fallback, which is
  why the seam is named in `PROJECT_PLAN.md` §5.
- **Fidelity labelling gets skipped** under time pressure, and a later phase reverts
  a device insert believing it was exact. Mitigation: the label is part of the take
  schema from the first write, not an addition.
