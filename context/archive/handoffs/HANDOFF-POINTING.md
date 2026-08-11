---
title: Handoff — the same-request pointing fault (FINDINGS E15-D)
status: CLOSED — see the resolution note below. The defect was real; the
        mechanism described here was not.
updated: 2026-07-25
parent: context/plan/PHASE-0-FOUNDATION.md
evidence: context/spike/FINDINGS.md §E15 (A–E)
---

> ## ✅ Resolved — and §2 and §4 below are wrong, on purpose
>
> Kept as written, because what it got wrong is the useful part of the record.
>
> **Pointing and acting in one request is sound.** Measured directly: point at B
> and `setNotes` in a single `batch.run` while the cursor is parked on A, and the
> note lands in B. Same for `clearNotes`, same for `setStepSize` + `setNotes`,
> same for two clips in one batch. `selectChannel`/`selectSlot` retarget the
> cursor for the calls that follow them in the same turn; only the *observable*
> `cursor.status` lags ~24ms. So all three options in §4 — including the
> recommended A — fix a problem that does not exist.
>
> **The real fault is §5.1, the one filed as "unverified, suspicious".**
> `cursor.setNoteProps` is the only write op whose handler READS first
> (`clip.getStep`), and that read is unusable for ~120ms after a `setStepSize`
> changed the grid — 0 of 3 properties landed at gaps ≤96ms, 3 of 3 at ≥120ms,
> silently. `C-pressure` failed only after `C-notes` because a readback leaves
> the cursor on the scan grid, so the next write changes it. The fix is the
> mirror image of `OP_SETTLE`: `OP_SETTLE_BEFORE`, waited *before* the props
> stage. Contract stays cursor-free, batch stays one turn.
>
> **And §5 turned up a bigger one.** `pressure` cannot be written at all — the
> value only ever enters the writing cursor's own cache (E15-E). That retracts
> E15-C and E2/e02e, and it is why `C-pressure` could pass in the first place.
>
> Full reasoning, measurements and rejected options: `FINDINGS.md` §E15-D and
> §E15-E. Probes: `npm run probe:e15d{,-props,-persist,-grid,-live}`.

# Handoff: fix the same-request pointing fault

You are picking up **ghostnote** immediately after Phase 0 tasks 1–4 (adapter
contract v0, fake adapter, offline suite, handler split). Everything from that
work is in the working tree, **uncommitted and intended to stay that way** — the
user reviews and commits. Your change lands **on top of the same changeset**.

Your job is one defect, done properly: **the live adapter points the cursor and
acts on it in the same request, which makes writes ordering-sensitive.** It is
recorded as **FINDINGS §E15-D**. Investigate it thoroughly, decide the fix
deliberately (there is a real architectural choice here — see §4), implement it,
and prove it live.

---

## 1. Read these first, in order

1. **`context/spike/FINDINGS.md` §E15** — the four Phase-0 findings. **A** (bank
   window), **B** and **C** (the two same-request faults already fixed), and
   **D** (yours). B and C are the pattern; read them closely, because your bug
   is the third member of the same family and the fix may or may not want the
   same shape.
2. **`context/PROJECT_PLAN.md` §4** — the standing rules. Rules 1 (readback is
   the only truth), 2 (address by identity; re-point after any structural op) and
   4 (the batch is the unit) all bear directly on this.
3. **`context/plan/PHASE-0-FOUNDATION.md`** — what this phase owes.
   ⚠ **E14 (the in-Bitwig UI probe) and the DECISIONS D6+ consolidation are
   still out of scope.** Do not start them.
4. `brain/src/contract/index.ts` and `brain/src/adapters/live/encoder.ts` — the
   seam you are working in. Every file opens with a doc comment citing the
   experiment behind each rule; match that density.

---

## 2. The defect

`pointFrames()` in **`brain/src/adapters/live/encoder.ts`** emits

    cursor.pointTrack { cursor, trackIndex }
    slot.select       { trackIndex, slotIndex, mechanism: 'track' }

into the **same `batch.run`** as the op that follows it. Every op in one
`batch.run` executes in **one control-surface turn** (that is the whole point of
the batch — E8's 232× win). But E1 measured that pointing settles in ~25ms and
established the rule *poll until `trackPosition` and `sceneIndex` confirm the
target, never blind-sleep*. So an op that re-points the cursor and then writes,
inside a single request, can write **through a cursor still attached to the
previous clip**.

There is no error. The write lands somewhere real, and `cursor.status` looks
healthy afterwards — the same silent-wrong-result signature as the E2 empty-slot
trap.

### Reproduction

```sh
cd brain
npm run probe:conformance                                   # C-pressure FAILS
npx tsx --test --test-name-pattern="C-pressure" src/probes/conformance.live.ts   # PASSES
```

It fails only when it runs **after `C-notes`**, which pointed the same pool
cursor at a different clip. Current live score: **15 pass / 1 fail / 3 skipped**
(the 3 skips are correctly fake-only). Offline is **118/118 green** and must stay
that way.

---

## 3. Why this matters more than one red test

Phase 1 is the write engine: *snapshot the write-set → apply optimistically →
read back → revert by replaying the stash*. Every one of those steps points a
cursor. If pointing is unreliable inside a batch, then **the snapshot can be
taken from the wrong clip and the revert can restore into the wrong clip** —
silently, because nothing in the response says which clip was actually touched.
That is the failure mode the entire safety design exists to prevent.

It is also the last member of a family that has already cost this project twice.
Both siblings looked like small bugs and both turned out to be the same
structural fact: **Bitwig's write APIs are not readable or re-targetable within
the request that issued them.**

---

## 4. The design choice — decide it, do not default to it

⚠ **The code comment currently in `encoder.ts` suggests "a `cursor.point` op
variant or point-hoisting in `planStages`". That was a first guess written while
closing out the session, not a conclusion. Re-derive it.**

The strongest counter-argument, which you should weigh seriously:

> **The contract has no concept of a cursor, deliberately.** `Address` is
> `channelId` + scene index; `Op` is musical intent. Cursor pools are a
> Bitwig-API implementation detail (E1's non-following `CursorTrack` +
> `PinnableCursorClip`), and the fake models pointing internally
> (`traps.ts:pointAtSlot`) precisely because it is *not* contract surface.
> Adding a `cursor.point` op would leak the wire's mechanism into the typed seam
> that exists to hide it — and would force the fake to implement an op that means
> nothing to it.

That points at the fix living **inside `LiveAdapter`**, not in `planStages`:
point, then **poll `cursor.status` until `trackPosition` and `sceneIndex` match**
(exactly E1's rule, which the read path already half-implements), and only then
send the batch — with the point frames removed from it. Cost is one extra
round-trip per distinct target clip per batch, which is cheap and bounded.

Options to evaluate, with the tension named:

| Option | Where | Pro | Con |
|---|---|---|---|
| **A. Point-and-poll in `LiveAdapter`** | live adapter | Contract stays cursor-free; matches E1's measured rule directly; fake unaffected | Extra round-trips; `apply()` gets more procedural |
| **B. `cursor.point` op + stage break** | contract | Uniform with the B/C fix; planner stays the single place staging is decided | Leaks the cursor into the contract; fake must implement a no-op-ish variant |
| **C. Point-hoisting in `planStages`** | contract | No new op variant | Planner would need to know which ops imply pointing — i.e. wire knowledge in a wire-free module |

Recommendation to start from: **A**, unless you find something that breaks it.
Whichever you choose, **write down why in `FINDINGS.md` §E15-D** — convert it
from ◐ to ● with the reasoning, because the next person will ask.

---

## 5. Investigate these too — they are probably the same bug

Do not fix only the reported symptom. The same family very likely has more
members, and finding them now is cheaper than finding them in Phase 1.

1. **`cursor.setStepSize` inside a batch — UNVERIFIED, suspicious.**
   `encodeOp('note.write')` emits `setStepSize` and then `setNotes` **in the same
   request**. E2 explicitly says `setStepSize` "works at runtime but **needs a
   settle wait — not instant**", and the read path already had to be given a
   `trackStruct` settle after it for exactly this reason (see the ⚠ comment in
   `adapter.ts`'s notes read). If the grid has not changed when `setNotes` runs,
   **every `x` index is interpreted against the old grid** and the notes land at
   the wrong beats — silently. **Measure this directly.** It may be the same
   root cause as the reported symptom.
2. **`note.clear`** — also points and then acts (`cursor.clearNotes`) in one
   request. Same exposure. A clear that lands on the wrong clip is destructive.
3. **Cross-op pointing within one stage.** Stage 0 coalesces every `instant` op.
   Two `note.write`s to *different* clips currently share one request, with two
   point sequences in it. Even with a fix, decide explicitly whether ops
   targeting different clips may share a stage at all.
4. **Does the read path have the same fault?** `LiveAdapter.readOne` points,
   `settle('cursorPoint')`, then scans — separate requests, so probably sound,
   but it settles rather than polls. E1's rule is poll-and-verify; a fixed 25ms
   sleep is not the same guarantee.

---

## 6. Rules that constrain the fix

These are hard-won and violating one is a defect, not a style choice
(`PROJECT_PLAN.md` §4):

- **Readback is the only truth.** Verify pointing by reading `cursor.status`
  back, not by waiting and assuming.
- **Never point at an empty slot.** It silently lands on the wrong clip and
  status looks healthy (E2). Any point path must guarantee the clip exists first.
- **The batch is the unit.** Do not solve this by reverting to one-op-per-request
  — that is the 232× regression E8 exists to prevent. Extra requests are
  acceptable *per distinct target*, not per op.
- **Preserve the offline suite's meaning.** If the fix changes staging, the fake
  must model the same constraint, or it goes back to certifying behaviour that
  does not work live. That is exactly how findings B and C were caught.
- **The wire method table is frozen.** `extension/methods.golden.json` records
  all 84 methods and `wiremap.test.ts` enforces it both ways. Adding a wire
  method means regenerating the golden *and* re-verifying live with
  `npm run probe:hello`. Prefer composing existing methods.

---

## 7. The working rig

**Bitwig 6.0.6 must be running** with the ghostnote controller added. The
extension hot-reloads on **content** change (`touch` does not do it — E5).

```sh
# deploy + prove the extension is alive and the wire table is unchanged
cd extension && ./gradlew copyExtension && cd ../brain && npm run probe:hello

# offline — must stay 118/118 green, no Bitwig involved
npm run check

# the live suite you are fixing
npm run probe:conformance

# ⚠ ALWAYS run this after a live conformance run
npx tsx src/probes/conformance-cleanup.ts
```

**`probe:hello` is the first thing after any deploy.** A marked handle that
throws at `init()` takes the whole extension down before the bridge binds
(E7-0), and the symptom is an unexplained connection timeout.

### Project hygiene — this one matters

The Bitwig project is the user's, not a scratch file. Baseline is exactly:

    Instrument Layer | Hybrid 2 | gn-A | gn-B | FX 1 | Master

An earlier version of the conformance harness littered it with 11 tracks and
pushed `Master` out of the bank window. The harness now cleans up after itself
and `conformance-cleanup.ts` is the standalone repair. **Leave the project at
that baseline when you stop**. `npm run probe:hello` reports `itemCount` vs
`bankSize` in section D of its output; if `itemCount > bankSize` the contract
will (correctly) refuse to do anything at all until you clean up.

---

## 8. Where the code is

| File | Role |
|---|---|
| `brain/src/adapters/live/encoder.ts` | **`pointFrames()` is the defect.** Pure `Op → Frame[]`; the ⚠⚠ comment marks the spot |
| `brain/src/adapters/live/adapter.ts` | `apply()` / `read()`; where option A would live |
| `brain/src/contract/stages.ts` | `planStages` + `splitNoteWrite` — **the worked example of fixing findings B and C** |
| `brain/src/contract/ops.ts` | The `Op` union; `note.props` and `OP_SETTLE` show how a stage break is forced |
| `brain/src/adapters/fake/traps.ts` | `pointAtSlot` — the fake's model of the empty-slot trap |
| `brain/src/contract/conformance/suite.ts` | The failing case (`C-pressure`) and the shared assertions |
| `brain/src/adapters/live/transport.ts` | `RecordingTransport` — assert on emitted frames offline, no DAW needed |

Offline frame assertions go in `encoder.test.ts` (16 cases, the Class-A trap
tests). Direct model traps go in `fake/model.test.ts`. Anything both adapters
must exhibit goes in the conformance suite.

---

## 9. Definition of done

1. `npm run probe:conformance` — **all non-skipped cases pass, in a full run,
   repeatably**, not just in isolation. Run it three times.
2. `npm run check` still **118+/118 green** offline, and the fake models whatever
   constraint you discovered (otherwise it certifies a fix that is not real).
3. The `setStepSize`-in-batch question from §5.1 is **measured and answered**,
   not assumed — either "sound, here is the evidence" or fixed alongside.
4. **`FINDINGS.md` §E15-D updated ◐ → ●** with the measurement, the decision, and
   why the rejected options were rejected. Add new sub-findings if §5 turns any up.
5. The `⚠⚠ KNOWN ISSUE` comment in `encoder.ts` is replaced by a description of
   the actual rule.
6. `cd extension && ./gradlew build` still clean; `npm run probe:hello` still
   10/10 if you touched the extension.
7. The user's Bitwig project is back to its 6-track baseline.

## 10. Working agreement

- **Do not run git write commands.** No commits, no branches. The user reviews
  and commits; your work stacks onto the existing uncommitted changeset.
- Current branch `initial-spike`, HEAD `20d5918`. Everything from Phase 0 tasks
  1–4 is uncommitted — `git status` will show ~10 modified files, one deletion
  (`ProbeHandlers.java`, split into `handlers/`), and several new directories.
  **That is expected. Do not "clean up" or revert any of it.**
- Stop and check in before anything destructive to the user's project, and before
  adding a wire method.
- Report failures with the output. A probe that fails because it documents a trap
  (several of `e01a`/`e02`'s do) is not the same as a regression — if in doubt,
  build the pre-split extension in a `git worktree` at HEAD and diff the two, the
  way E15-D itself was confirmed.
