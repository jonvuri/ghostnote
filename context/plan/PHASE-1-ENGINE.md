---
title: Phase 1 — The write engine & takes
status: not started — split into six sessions 2026-07-25 (see §Session index)
updated: 2026-07-25
parent: ../PROJECT_PLAN.md
prev: PHASE-0-FOUNDATION.md
next: PHASE-2-CLIPS.md
sessions: PHASE-1-SESSION-1-EXECUTOR.md … PHASE-1-SESSION-6-ASYNC.md
---

# Phase 1 — The write engine & takes

## Session index

Split 2026-07-25. Sessions 1–5 are a dependency chain; session 6 is optional and
may slip to Phase 2. The offline/live boundary is the load-bearing part of the
ordering: the three hardest sessions are provable against the Phase-0 fake, and
the two that need a human at the keyboard come after the things they verify are
already written.

| # | Session | Scope items | Needs | Doc |
|---|---|---|---|---|
| 1 | ● **The executor** — write-set, stash, verify, revert, resolver discipline | 2, 3, 5 | offline | [SESSION-1](PHASE-1-SESSION-1-EXECUTOR.md) — **DONE 2026-07-26**, decisions as D16 |
| 2 | **The take store** — persistence, branching, partial revert | 4 | offline | [SESSION-2](PHASE-1-SESSION-2-TAKES.md) |
| 3 | **`ghostnoted`** — process, lifecycle, observers, local API | 1 | live daemon | [SESSION-3](PHASE-1-SESSION-3-DAEMON.md) |
| 4 | **The control layer** — the in-Bitwig pane | 6 | ⚠ human | [SESSION-4](PHASE-1-SESSION-4-CONTROL-LAYER.md) |
| 5 | **Proving it live** — the exit-criteria sweep | §Exit | ⚠ human | [SESSION-5](PHASE-1-SESSION-5-PROVING.md) |
| 6 | **Async batch completion** *(optional)* | 7 | — | [SESSION-6](PHASE-1-SESSION-6-ASYNC.md) |

⚠ **Two of this doc's own premises were superseded by Phase 0's second session**,
which closed the day after this doc was written. Both are reconciled in the
session docs rather than rewritten here, per `DECISIONS.md`'s house rule that the
retraction is usually the more useful record:

- **⚠ Exit criterion 4 is RELAXED — take A/B leaves Phase 1.** D14 moved take
  navigation to the Phase-3 web view because the controller pane cannot be pinned
  and closes on click-away. **Resolved 2026-07-25: D14 wins.** Shipping the enum
  button group would satisfy criterion 4 on paper — it works, ● at 2–12 options —
  but A/B happens *while listening*, and a chooser that closes on click-away means
  re-opening a pop-over between every comparison. That is the core verb not
  working, not a wart on it. **Phase 1's in-Bitwig surface is revert, status and
  navigation**; criterion 4 moves to Phase 3 with the rest of take navigation. See
  [SESSION-4](PHASE-1-SESSION-4-CONTROL-LAYER.md) §Exit criterion 4 is RELAXED.
  > ⚠ **The consequence, stated so it is not discovered later.** Phase 1 ships a
  > branchable take store whose motivating verb no human ever exercises inside the
  > phase. Two things follow: [SESSION-2](PHASE-1-SESSION-2-TAKES.md)'s exit
  > criteria carry the *whole* weight of proving the store is right, and **Phase 3
  > stops being optional-feeling** — it is now where takes become usable at all.
  > The P2↔P3 seam (`PROJECT_PLAN.md` §5) is worth re-reading before Phase 2
  > starts.
- **"The Studio I/O panel" (§Scope 6) has not existed since Bitwig 5.0.** The API
  is untouched; only where Bitwig draws it moved (D14, E14).
- **"All 21 expression properties" (exit criterion 1) vs. D8's "16 of 18."**
  Reconciled against the code in [SESSION-5](PHASE-1-SESSION-5-PROVING.md):
  `NOTE_PROP_FIDELITY` has 21 keys — **19 exact, `gain` unverified, `pressure`
  unwritable**.

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
   > ⚠ **TWO CORRECTIONS, both from E14/D14 the day after this was written.**
   > (a) There is no **"Studio I/O panel"** — Bitwig 5.0 moved the per-controller
   > surface to a pane opened from the controller icons in the **top right**. The
   > API is untouched; only the drawing moved. (b) **The take switcher is CUT.**
   > The pane cannot be pinned and closes on click-away, so A/B-while-listening
   > does not work there. Phase 1 ships **revert, status and navigation**; take
   > switching goes to Phase 3. See §Session index and
   > [SESSION-4](PHASE-1-SESSION-4-CONTROL-LAYER.md).
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
   > ⚠ **RELAXED 2026-07-25 — this criterion MOVED TO PHASE 3, it did not pass.**
   > D14 measured the pane closing on click-away, which makes A/B-while-listening
   > unworkable there. Phase 1 proves the **store-side** half headlessly (two takes
   > exist, are distinguishable, switchable through the daemon API); the human
   > workflow is unproven until Phase 3. Full reasoning in §Session index.
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
