---
title: Phase 1, session 1 — the executor: write-set, stash, verify, revert
status: not started
updated: 2026-07-25
parent: PHASE-1-ENGINE.md
prev: PHASE-0-SESSION-2.md
next: PHASE-1-SESSION-2-TAKES.md
scope: PHASE-1-ENGINE.md items 2, 3, 5
evidence: E2, E3, E5, E8, E15-B/D/E/F · D5, D6, D8, D9, D10
---

# Phase 1, session 1 — the executor

> **Purpose.** Make §8b real as a *library*: `resolve → stash → apply → verify →
> report`, plus the revert that the stash exists for. Entirely offline against the
> Phase-0 fake. No daemon, no disk, no UI, no musical vocabulary — this session
> produces the one component every later session and every later phase composes.

## Why this is first

Phase 0 built the **seam** (`brain/src/contract/`) and Phase 1 must build the
**machine that drives it**. The contract already has the four primitives the
pipeline needs — `resolve`, `read`, `apply`, `settle`
([adapter.ts:52-93](../../brain/src/contract/adapter.ts#L52-L93)) — and
`adapter.ts`'s own header already spells the pipeline out. Nothing calls them in
sequence yet.

Everything downstream needs this first: the take store (session 2) persists what
this produces, the daemon (session 3) hosts it, the control layer (session 4)
triggers its revert. Building it against the fake means the hardest logic in the
phase is written where a bug is a failing test in 1.3s rather than a live sitting.

## Scope

### In

1. **Write-set derivation.** `writeSet(ops): Address[]` — the pivot the whole
   design turns on. §8b's claim is that a patch has a *known* write-set before
   execution; this is the function that makes it true. Every `Op` variant maps to
   the addresses it touches, with `assertNever` making a new Phase-4/5 variant a
   compile error rather than a silent gap in a snapshot.
2. **The pipeline, as one function.** Resolve the write-set → `read` it (the
   stash) → `apply` → `read` again (verify) → produce the §8c report: *what
   applied, what didn't take, and what readback disagrees with the request about*.
   Two reads, one method — they are the same operation at different moments, which
   is exactly why the stash doubles as Phase 3's diff source (§8f).
3. **Fidelity labelling, derived rather than remembered.**
   `ADDRESS_IDENTITY` ([address.ts:105](../../brain/src/contract/address.ts#L105))
   plus `NOTE_PROP_FIDELITY`
   ([state.ts](../../brain/src/contract/state.ts)) already carry everything
   needed. D5's rule is that the label is part of the schema *from the first
   write* — so it is computed by the executor, never attached by a caller.
4. **Revert materialization.** `revertOps(stash): Op[]` — turning captured *state*
   back into *ops*. This is the genuinely new logic in the session and it is
   where the fidelity labels earn their keep (see Decisions).
5. **Resolver discipline** (scope item 3). Today `LiveAdapter` hardcodes cursor
   `'0'` ([adapter.ts:79](../../brain/src/adapters/live/adapter.ts#L79)). This
   session gives it a real pool: allocation across a batch's addresses,
   **verify the cursor's target before every write** (E2 — a mis-point is
   undetectable afterwards from the cursor's own state), re-point after any
   structural op, and the **trailing selection restore D6 says Phase 1 owes**
   (one restore per batch suffices — E14-F2/F3/F4).
6. **The revision guard, lifted and asserted.** Largely already works — each stage
   guards on what the previous returned
   ([adapter.ts:390](../../brain/src/adapters/live/adapter.ts#L390)). This session
   owes the test that a stale `ifRevision` rejects the batch **whole, applying
   zero ops**, at the executor level rather than the adapter level.
7. **Phase-0 carry-overs that belong to the executor**, from
   `PHASE-0-SESSION-2.md` item 5: `sceneBankSize: 0` hardcoded in
   `LiveAdapter.hello()`, and `read` declaring an `unreachable` array it can never
   populate (`refreshIndex()` throws `BankWindowOverflowError` first). Both are
   small; both become wrong the moment session 2 reads them.

### Out

- **Persistence and branching** — session 2. This session's takes are in-memory
  values, which is enough to test every rule about them.
- **The daemon** — session 3. But see the first Risk: the engine must be written
  as a hosted library, not a module with state.
- **Any UI** — session 4. Reverts are invoked from tests here.
- **Partial revert** — session 2, because slicing needs the store's addressing.
- **Musical vocabulary** — Phase 2. This session writes the notes it is told to.

## Decisions this session must make

- **Stable identity for clips, scenes and devices** — `PROJECT_PLAN.md` §7's open
  question, owned here. Tracks are solved (`channelId`, E2f); everything else is
  `positional` in `ADDRESS_IDENTITY`. *Recommendation: decide that track+slot
  re-resolution is sufficient and that scene ops force a re-point*, which is the
  cheapest answer that is not wrong, and record it as a D-entry. Inventing a
  synthetic clip id would mean maintaining a side-table across a DAW we do not
  control.
- **⚠ What revert does about `gain`.** The sharpest trap in the phase. Gain reads
  back **2× written** (E2), so a stash records 1.4 for a note written at 0.7 —
  and replaying that stash doubles it *again*. `GAIN_READ_SCALE = 2` exists in
  `state.ts` as documentation that nothing applies. D8 is explicit: *"the inverse
  is unverified, so it is labelled, never corrected."* Either keep labelling, or
  spend a live probe verifying the inverse before enabling the one-line
  correction — but do not guess, because a wrong correction makes **every** take
  restore wrong gain, silently.
- **⚠ What revert does about `pressure`.** A human may have authored pressure in
  a clip we are about to overwrite. Readback captures it; `assertOpsWritable`
  ([ops.ts:152](../../brain/src/contract/ops.ts#L152)) then **refuses to replay
  it**. So the stash→ops path must strip it and the take must say so. A revert
  that throws because of a property the user authored is a worse failure than one
  that reports "restored all but pressure."
- **What revert does with `fidelity: 'none'` entries.** A `track.create` has no
  readback that could reproduce it. *Recommendation: apply what can be applied and
  report the rest loudly* — D5's "a revert never silently under-delivers" is a
  constraint on reporting, not a reason to refuse the whole operation.
- **Stash granularity for an unranged `note.write`.** Whole clip channel, or a
  bounding range around the written notes? Whole-channel is safer (it captures
  notes the write will truncate — E8's same-pitch adjacency) and is what partial
  revert will want to slice in session 2.

## Exit criteria

1. Against the fake, offline: a patch of N note ops **applies, verifies by
   readback, and reverts** to a byte-identical note set across every writable
   expression property.
2. `revertOps` round-trips through `planStages` correctly — in particular the
   generated `note.props` ops stay **interleaved with their creates**, so a
   multi-clip revert does not silently lose expression (E15-F, and the fake's
   `propsReadsTurnStartClip` trap should be what catches a regression).
3. A stale-revision batch is rejected **whole**, applying zero ops, asserted at
   the executor.
4. A batch touching an address outside the bank window is a **loud refusal**, not
   a partial operation (E5, standing rule 5).
5. Every take value carries a fidelity label computed from its write-set, and a
   revert that cannot fully restore says exactly what it could not.
6. New conformance cases in `contract/conformance/suite.ts` so session 5 can run
   the same assertions live with no new test code.

## Risks

- **⚠ The engine acquires module-level state and session 3 has to unpick it.**
  The daemon will host one engine per bridge connection, and possibly re-create it
  when Bitwig restarts. Mitigation: explicit session state passed in or held on an
  instance, no module-level mutable anything. Cheap now, expensive later — naming
  it here is the mitigation.
- **Revert looks trivial and is not.** "Apply the stash" hides note removal
  (a revert must `note.clear` before `note.write`, or it merges instead of
  restoring), the gain trap, the pressure trap, and structural ops with no
  inverse. Budget for it accordingly.
- **The fake certifies the executor's own assumptions.** The classic fake-adapter
  failure (PHASE-0 §Risks), and this session is where it would bite hardest.
  Mitigation: exit criterion 6 — every assertion goes in the conformance suite,
  which session 5 runs against real Bitwig.
