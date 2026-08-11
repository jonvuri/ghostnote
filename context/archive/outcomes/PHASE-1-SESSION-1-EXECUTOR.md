---
title: Phase 1, session 1 — the executor: write-set, stash, verify, revert
status: DONE 2026-07-26 — all six exit criteria met offline; the two live-only items
        (cursor pool, selection restore) are BUILT but UNPROVEN until session 5.
        Decisions recorded as DECISIONS D16. See the outcome log at the foot.
        ⚠ RE-OPENED and closed again 2026-08-07 for the D16 amendment block —
        `clip.delete` is `lossy` not `none`, `device.insert` has its exact
        inverse, and the fidelity floor is now a REFUSAL (D18c). See
        §Amendment, 2026-08-07 at the foot. ⚠ It adds a THIRD live-unproven
        item: the clip-length capture points a cursor.
        ⚠ A REVIEW PASS on the amendment (2026-08-07) fixed two defects it
        introduced. Its one OPEN item — the live `device.insert` mint — was
        BUILT 2026-08-08, along with the three Phase-0 wire defects that had
        left the live device path unable to run at all. See §Review pass at the
        foot. 241 tests green; every device behaviour is unproven until
        session 5 runs `C-device`.
updated: 2026-08-07
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
  ⚠ 2026-08-07: it now also accepts OPTIONAL `{ops, minted}`, which is where the
  one inverse that cannot be known before execution comes from. A slicing caller
  that omits them keeps reporting `device.insert` instead of undoing it — see the
  amendment below.
- **Branching is already free.** `Executor.revert` runs the plan through `run`,
  so a revert IS a take, and its own stash is the state it replaced.

---

## ⚠ Amendment, 2026-08-07 — the D16 amendment block, landed

`DECISIONS.md` D16's amendment (operator-approved, from
`../spike/E16-OPEN-QUESTIONS.md` §3.3.3/§3.3.4/§3.3.5/§3.3.6) plus D18c's
restatement of the floor. Offline against the fake, 231 tests green. Nothing else
was re-opened.

**1. `clip.delete` was `none` because of the ADAPTER, not the API.** `write-set.ts`
said *"neither its length nor its content has a readback"* and both halves were
false: content was always stashed (D16e — the whole clip channel), and the live
adapter was already reading `loopLength` off the cursor to pick a scan grid and
simply never wrote it into the clip entry. Meanwhile `StateValue.lengthBeats?`
was declared and **the fake populated it and live did not** — PHASE-0 §Risks'
named failure mode, sitting unexercised because nothing read the field. Now: both
adapters capture it, the label is derived from the same fact on both sides
(`absent → exact`, `present → lossy`), and `revertOps` **rebuilds the clip at its
captured length and refills it from the stash**. What that cannot carry is named
in the caveats rather than hidden — name, colour, loop start/end as distinct from
length, launch settings, and automation lanes.
> ⚠ The ORDER is the correctness: `clip.create` now runs FIRST in a revert plan,
> ahead of the notes. Replaying notes into a slot with no clip lands the cursor on
> a different clip, silently (E2) — the same measurement that already forced
> deletions to run last, aimed at the other end.

**2. `device.insert` had `clip.create`'s exact inverse all along.** It was filed
under `NO_DEVICE_READBACK`, a reason written about the *delete* direction. It is
out of `WriteSet.unrevertable`, which now holds exactly *the set a branch cannot
rescue* (`track.create`, `scene.create`). The inverse is emitted from
`receipt.minted` — **an OBSERVED chain index, never a counted one**, the same
discipline E2c forced on `track.create` — and multiple deletes are emitted
DESCENDING, because a chain re-indexes on delete (E3). An insert nobody watched
land is reported, not guessed at; that is the whole reason it is a mint.

**3. The floor is a REFUSAL** (`engine/floor.ts`). Predicate unchanged —
*the batch's own labelled fidelity is worse than `exact`*, over `targets` only —
response changed: `UnprotectedWriteError`, thrown between the stash and the first
write, never an automatic fork. Two clearances, kept distinct so the record can
tell them apart: `branch-protected` (D18c) and `own-changeset-reversal`
(D19/D20). The refusal text names what cannot be restored and what would clear
it, and **names no mechanism** — a redirect arriving through an error message is
the choice-mapping leak wearing a disguise, and `X-floor` asserts its absence.
§3.3.6's hard-coded member (`insertFileAt where:'replace'`) is a switch over the
op union that matches nothing today and fails to compile when Phase 5 adds the
variant.

### The one judgement call, stated

**A revert is not gated by the floor.** No decision says this in those words; D19
says reversal rides the ordinary surface bounded to our own changesets, D20 says
own changesets are ungated, and D16d says D5's rule is *"a constraint on
REPORTING, not a reason to refuse the whole operation"*. Gating it would mean a
lossy take could never be undone at all — the deadlock reading. So
`Executor.revert` clears its own plan and the fidelity machinery reports, exactly
as before. If that reading is wrong, the fix is one argument in one place.

### ⚠ Added to "unproven — carried to session 5"

- **The clip-length capture points a cursor.** `Clip.getLoopLength()` needs a
  cursor on the clip, so a `clip`/`slot` read of an OCCUPIED slot now points and
  therefore steals and restores the user's selection, where a metadata-only read
  used to be free. An EMPTY slot still costs nothing and is still never pointed at
  (E2). The point is memoised per `read` call, so the common shape — a clip target
  and its notes target side by side — costs one point and one settle rather than
  two. All of it is unmeasured live.
  > A cheaper route may exist (a length on `slot.status`), but `ClipLauncherSlot`
  > exposing one is a doc-pass guess and standing rule 10 refuses those. If the
  > flicker is a problem in session 5, that is the probe to run.

- **`clip.create` onto an OCCUPIED slot**, which the amendment made reachable and
  did not measure. Reverting a `clip.create` that landed on a slot which already
  held a clip now emits `clip.create` at the captured length into a slot that is
  still occupied. The fake models that as *overwrite the length, keep the notes*
  ([fake/adapter.ts:414](../../brain/src/adapters/fake/adapter.ts#L414)) — which
  is a GUESS, not a measurement. If Bitwig's `createEmptyClip` no-ops on an
  occupied slot instead, the revert restores the notes and silently keeps the
  length the batch imposed, which is the quiet under-delivery D5 forbids.
  > The probe is two calls: create a clip at 8 beats, create again at 4 in the
  > same slot, read the length back. Until it runs, the `clip.delete` direction
  > (empty slot, the flagship case) is the only one with a modelled basis.

- **The `lengthBeats` readback itself.** The live adapter refuses to default it —
  absent means absent, and `revertOps` then declines to rebuild the clip rather
  than invent a length. Whether `getLoopLength()` reports a usable number for a
  launcher clip through a pool cursor is exactly the sort of thing that has been
  wrong before (E15-D), and `C-clip` in the conformance suite is what will say so.

---

## ⚠ Review pass, 2026-08-07 — two defects in the amendment, fixed; one left open

A read of the amendment against the code it changed. **234 tests green.** Both
fixes were confirmed by running the new assertion against the PRE-fix file first
and watching it fail — a test that has never failed has not been shown to test
anything.

**1. FIXED — the clip-length capture could return another clip's music.** The new
per-`read` point memo
([live/adapter.ts:418](../../brain/src/adapters/live/adapter.ts#L418)) remembered
*which CLIPS we had pointed at*, but `CursorPool` **evicts** (LRU). A read
addressing more clips than the pool holds hands a revisited clip a DIFFERENT
cursor, and the clip-keyed memo then skipped the point and read through a cursor
still sitting on the clip it was evicted for — E2's silent mispoint arriving
through the mechanism built to prevent it, straight into the stash a revert
replays. Reachable today, because `note.write`/`note.props` carry a `channel`, so
one clip legitimately appears twice in a write-set with others in between. The
memo now records **cursor → clip** and asks *is THIS cursor on THIS clip*, which
cannot be wrong that way.
> ⚠ The real finding underneath it: **`LiveAdapter.read` had no offline harness
> at all**, so a mispoint was unfalsifiable outside a sitting. `live/adapter.test.ts`
> is that harness — a stub transport that MODELS THE CURSOR, answering from
> whichever clip a cursor is really on, the way Bitwig does. A stub that answered
> from the address the adapter *asked about* would only ever assert the adapter's
> own belief back at it. Against the pre-fix adapter the case returns pitch 62
> for clip 0. It also locks in the memo's benefit (one point for a clip+notes
> pair) and E2's empty-slot rule, so the fix cannot be undone by reverting to
> "just always point".

**2. FIXED — a clip captured with no length was labelled `lossy`, not `none`.**
Both adapters report `lossy` and both are right about their own READBACK; what
neither can know is that `revertOps` then withholds the clip *and* its notes, so
nothing about the address survives. `TakeStore.summarize` lists exactly the
`none` values as `unrestorable`, so the clip dropped out of the take listing and
the loss surfaced only mid-revert — the "never silently under-delivers" half of
D5 failing. The consequence is now derived once in `fidelity.ts` (`restorability`,
worst-wins like everything else there) rather than in each adapter, which is the
same reason the label is computed rather than attached (D5).

### ✅ CLOSED — `device.insert` is minted by the live adapter (2026-08-08)

Amendment 2 took `device.insert` out of `WriteSet.unrevertable` and made its
inverse depend entirely on `receipt.minted`. The fake mints it
([fake/adapter.ts:482](../../brain/src/adapters/fake/adapter.ts#L482)); the live
adapter still mints `track.create` and nothing else
([live/adapter.ts:655](../../brain/src/adapters/live/adapter.ts#L655)). So live,
every insert falls to the *"nobody watched it land"* branch and the device stays
in the chain. The fallback REPORTS rather than guessing, so nothing is silently
wrong — but the amendment's headline capability is offline-only.

> ⚠ This is precisely the failure mode amendment 1 congratulates itself for
> catching — `lengthBeats` declared, fake populated it, live did not — reintroduced
> one section later for `minted`. And unlike `lengthBeats` nothing will catch it:
> `C-minted` covers `track.create` only, and there is **no conformance case for
> `device.insert` at all**, so exit criterion 6 is not met for this amendment.

**Built 2026-08-08. 241 tests green.** `apply` now brackets every insert stage
with two OBSERVATIONS of the chain (`deviceChain` → `device.list`) and mints from
the diff, the same shape as the bank diff after a `track.create`. `C-device` is in
the conformance suite, so session 5 runs the same assertions live.

The diff **fails closed**, which is the whole design: the index a mint reports is
the index a revert DELETES. Every insert handler in the extension uses
`endOfDeviceChainInsertionPoint()`, so the new device is the last one — and that
is *verified*, not assumed. Every entry the chain already had must still be
exactly where it was. A chain that grew by two, a prefix that moved, or a view
partial against `itemCount` (E5's rule one level down) all mint NOTHING and the
insert is reported as un-undoable, exactly as an unobserved one already was.

> ⚠ `C-device` inserts TWICE and asserts the second index is `first + 1`, then
> reverts both and asserts a third insert lands back at `first`. One insert would
> pass with a hardcoded 0; and because every assertion is relative, the case holds
> on a fixture track that already carries an instrument. There is no device
> readback in v0, so where the NEXT insert lands is the only contract-surface
> evidence that a delete really happened.

### ⚠ What building it uncovered — the live device path had never run

The mint was the smaller half. Reading the Java to write the diff turned up that
**no device op could have worked live at all**, which is why nothing had ever
noticed the missing mint:

- **`device.insert` sent `trackIndex`; the handler reads `params.get("cursor")`.**
  Not a wrong value — a missing key, so the insert would have thrown inside the
  extension on the first live call.
- **`device.delete` sent `cursor: trackIndex`.** Worse, because it is silent:
  every device handler resolves `rig.cursorTrack(ref)` / `rig.cursorDeviceBanks[ref]`
  by POOL index, so a bank row number addresses whichever cursor shares that
  number and deletes from *its* chain, reporting `ok`.
- **`device.insertClap` sent `uuid`; the handler reads `clapId`.**

All three are Phase-0 carry-overs, not amendment damage. Fixed by encoding
device ops as **point, then act** in one request: `CursorPool.cursorForTrack`
allocates a cursor for a TRACK out of the same LRU (the rig allocates
`CursorTrack` + `PinnableCursorClip` + `DeviceBank` as one unit per slot, so a
cursor pointed at a track for device work is the same handle that was holding a
clip — one map makes that unrepresentable-otherwise), and the encoder emits the
point immediately in front of the op.

> ⚠ Consequence worth naming: `cursor.pointTrack` is `CursorTrack.selectChannel`,
> which this codebase has already observed SETTING the UI selection. So device ops
> now borrow the user's selection and are in the capture/restore set
> (`borrowsSelection`, was `pointsAtAClip`). Leaving them out would have made the
> op class with the slowest settle (600ms, E3) the one that never gives the
> selection back.

### ⚠ Two defects the mint work left behind, found by review and fixed (2026-08-08)

Both were in the SHAPE the amendment gave the inverse, not in the mint itself,
and both were reproduced before being fixed.

**1. `TakeStore.planRevert` would not undo an insert — the store path was the one
that could not.** `revertOps` took a single optional `(ops, minted)` pair, so
`store/graph.ts` composed a walk by flattening several takes and had to decline
inserts entirely: op index 0 means a different op in every take. That reasoning is
right about a walk that flattens and wrong about the fix — **stop flattening**.
`RevertInput.batches` is now a LIST of per-take `(ops, minted)` pairs, so a
single-take undo *and* a multi-take walk both emit the delete, ordered descending
across the whole set because the hazard is the chain's shape (E3), not which take
caused it.
> ⚠ The old message told the reader to *"revert that take on its own to remove
> it"* — which is precisely what `planRevert` is. Advice that points back at the
> path that just declined is worse than no advice. A SLICED revert still declines,
> and that one is honest: slicing selects addresses, an insert has none, so
> "restore just this clip" has no reading under which a device also vanishes.

**2. An insert nobody watched land said NOTHING before revert time.** Taking
`device.insert` out of `WriteSet.unrevertable` was right when the mint lands — the
take genuinely is restorable, and `exact` is the true label. It was wrong when the
mint does not: `unrevertable: []`, `values: []`, `fidelity: 'exact'`, no caveat,
while the device sits in the chain. `writeSetOf` cannot know — it runs before the
apply — so the EXECUTOR stamps it on when the receipt comes back
(`unobservedInserts`), through the same field `track.create` has always used. It
reaches the store's walk and the plan's `unrestored` without either learning a new
concept, and `deviceRemovals` matches on `(op, opIndex)` so the fact is reported
once rather than twice.
> ⚠ One claim in the report did NOT hold up and the fix does not chase it:
> *"`TakeStore.summarize().unrestorable` stays empty"* is true, but it is true of
> `track.create` and `scene.create` too and always has been — `unrevertable` has
> never fed `unrestorable`, which is built from `values`. That is a pre-existing
> property of every op with no prior address, not a regression this amendment
> caused, and inventing an address to put in `values` to fix it would corrupt the
> walk's address-keyed state. Left alone deliberately.

### ⚠ Still unproven — carried to session 5

- **All of it.** The diff, the pointing, the CLAP key: every one of these is read
  off the Java rather than measured, and reading the Java is exactly how the three
  defects above survived a whole phase. `C-device` is what will say so.
- **Where a fresh instrument track's chain starts.** The case is relative on
  purpose, so it does not care — but nothing here has measured whether a live
  fixture track carries a default device.
- **The `blind` guard has never seen a real overflow.** `rig.config.deviceBank`
  bounds the view and `itemCount` reports the truth, but no probe has built a
  chain long enough to cross it.
