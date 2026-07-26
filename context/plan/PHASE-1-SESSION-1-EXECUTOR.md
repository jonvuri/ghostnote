---
title: Phase 1, session 1 — the executor: write-set, stash, verify, revert
status: DONE 2026-07-26 — all six exit criteria met offline; the two live-only items
        (cursor pool, selection restore) are BUILT but UNPROVEN until session 5.
        Decisions recorded as DECISIONS D16. See the outcome log at the foot.
updated: 2026-07-26
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

---

# Outcome log (2026-07-26)

> **All six exit criteria met against the fake; 188 offline tests green in ~1.0s.**
> Decisions recorded as **D16**. Two items are built but unproven — see §Unproven.

## What shipped

`brain/src/engine/`, a library with **no module-level mutable state** (the §Risks
mitigation, taken literally — `Executor` holds an adapter and two injected
functions, and session 3 can create one per bridge connection without unpicking
anything):

| file | what |
|---|---|
| `write-set.ts` | `writeSet(ops)` / `writeSetOf(ops)`, `assertNever`-guarded; structural-risk derivation |
| `fidelity.ts` | labels derived from `ADDRESS_IDENTITY` + `NOTE_PROP_FIDELITY`, never attached by a caller |
| `revert.ts` | `revertOps` — pure, stash + targets in, ops + `unrestored` out |
| `take.ts` | the take value: stash, receipt, verify, values, §8c report |
| `executor.ts` | the pipeline, and the §8c disagreement detector |

Plus `adapters/live/pool.ts` (the cursor allocator), and the E2/E5/E8-D refusals
lifted to the executor.

## Decisions — recorded in full as D16, summarised here

- **Stable identity** (the `PROJECT_PLAN.md` §7 question this session owned):
  **track + slot re-resolution, scene ops force a re-point.** No synthetic clip
  id, no side table.
- **⚠ `gain` on revert: WITHHELD and reported.** Neither replayed (doubles again,
  compounding, on every revert) nor corrected (the guess D8 forbids). One edit —
  `NOTE_PROP_FIDELITY['gain'] = 'exact'` after a session-5 probe — retires it
  everywhere, because the withholding is derived from the table rather than
  naming `gain` anywhere.
- **⚠ `pressure` on revert: stripped, and the take says so.** A naive "apply the
  stash" *throws*, because `assertOpsWritable` refuses a property a human may
  legitimately have authored.
- **`fidelity: 'none'`: apply what can be applied, report the rest loudly.** With
  one asymmetry worth keeping: a clip that did NOT exist has an exact inverse
  (delete it), so reverting `[clip.create, note.write]` is genuinely lossless.
- **Stash granularity: the whole clip channel**, never a bounding range (E8-E).

## ⚠ Three things the build found

1. **A batch that bumps the scene epoch invalidates its OWN verify read.** Both
   adapters refuse a stale scene epoch, so the post-apply readback of a
   scene-relative address throws; re-minting at the new epoch would be exactly
   the guess E3's epoch prevents. The executor skips those addresses and reports
   them in `ApplyReport.unverified` — because *"no disagreement"* must never be
   read as *"it landed"*. Found by a test.
2. **The fake reported an empty clip where Bitwig reports NO clip.** A `notes`
   read on a content-less slot returned `{notes: []}` on the fake and `undefined`
   on live. The executor's E2 guard turns exactly that distinction into a
   refusal, so the fake would have certified a batch that mispoints live —
   PHASE-0 §Risks' named failure mode, caught only because the executor was built
   against the fake first. Fixed; `C-slot` now asserts it on both.
3. **"Verify the cursor's target before every write" cannot live near the write.**
   E15-D measured `cursor.status` lagging the cursor's real target by a turn, so
   an in-request check reads the PREVIOUS answer and would certify a mis-point.
   It is therefore an executor-level check against the stash — a `notes` address
   with no entry, in a batch that does not create that clip, is a refusal — which
   has the pleasant side effect of costing zero extra round-trips and being
   provable offline.

## Phase-0 carry-overs discharged (item 5)

- **`sceneBankSize: 0`** → the rig's `scenes` allocation, from `rig.info`.
  ⚠ There is still **no scene-side equivalent of the E5 overflow refusal**. It is
  implementable (`rig.info` reports the true `sceneCount`) but unmeasured, and
  standing rule 10 says nothing is banked from a doc pass. → session 5.
- **`read`'s unpopulatable `unreachable`** → fixed by splitting `refreshIndex`
  into `scanTracks` (never throws) and `assertBankVisible` (only `apply` calls
  it). Standing rule 5 is about *operating* half-blind, not about looking — and
  the old shape made the one call that could diagnose an oversized project the
  one call you could not make, including `hello()`. `resolve` now reports
  `outside-bank-window` rather than `absent` too.

## Unproven — carried to session 5

Everything below is written and typechecked and **has never touched Bitwig**:

- **The cursor pool.** Offline coverage is frame-level only (`E-pool` in
  `encoder.test.ts`): same clip → same cursor, structural op → invalidate, LRU
  eviction. Whether three pool cursors really hold three clips through a paced
  batch is E1's measurement, not this session's.
- **The trailing selection restore.** `selection.status` → `slot.select`, exactly
  as E14-F measured, but never run.
  ⚠ **Known cost, not a bug**: E14-F's "one restore per batch suffices" is per
  BATCH, and the adapter only sees one CALL — so the read→apply→read pipeline
  pays three capture/restore pairs. Hoisting it needs something that knows a
  pipeline is in progress, i.e. the daemon (session 3).
- **`hello()` no longer refuses an overflowing project**, which is a deliberate
  behaviour change to the one call that can report the problem.

## Handed to session 2

- Takes are in-memory values with everything a store needs: `id`, `at`, `ops`,
  `targets`, `stash`, `receipt`, `verify`, `values`, `fidelity`, `report`.
- **Partial revert is already a filter.** `revertOps` takes `{targets, unrevertable,
  stash}`, so slicing `targets` by `addressKey` prefix yields a plan for that
  slice with no new concepts — which is what the session-2 doc recommends.
- **Branching is already free.** `Executor.revert` runs the plan through `run`,
  so a revert IS a take, and its own stash is the state it replaced.
