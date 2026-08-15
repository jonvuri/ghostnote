---
title: Phase 1, session 5 — proving it live: the exit-criteria sweep
kind: plan
state: planned
status: not started; revised for the two-representation take model
updated: 2026-08-14
parent: README.md
prev: 4-control-layer.md
next: 6-async.md
scope: PHASE-1-ENGINE.md §Exit criteria
evidence: E2, E5, E8, E8b, E15-A/E · D8, D15
needs: Bitwig foregrounded, a human at the keyboard
---

# Phase 1, session 5 — proving it live

> **Purpose.** Run Phase 1's exit criteria against real Bitwig, and convert the
> ones worth keeping into standing regressions. Sessions 1–4 were each verified
> against the fake plus a conformance pass; this session is the one that asks
> whether the *whole pipeline* holds while a human is playing.

## Why this is its own session

Standing rule 1 and D15: **readback is the only truth**, offline validation is
necessary and never sufficient. The Phase-0 suite already earned that reputation —
its conformance cases disagreeing with the fake is what surfaced E15-B and E15-C,
and E15-E then retracted two findings that had been "verified" through the cursor
that wrote them.

It is separate from session 4 rather than folded into it because a live sitting is
expensive and a control layer that is still being written is a bad thing to be
debugging during one. Build first, then prove.

## ⚠ First, settle the "21 properties" count

`PHASE-1-ENGINE.md` exit criterion 1 says "all 21 expression properties." D8's
table says "16 of 18." Both are right about different slices, and the executor
needs one number. The code already resolves it — `NOTE_PROP_FIDELITY`
([state.ts](../../../brain/src/contract/state.ts)) has exactly **21 keys**
(`velocity`, `duration`, and 19 `NoteProp` members), of which:

| count | class | meaning |
|---|---|---|
| **19** | `exact` | must round-trip losslessly through write → readback → revert |
| **1** | `unverified` (`gain`) | reads back **2×** written; labelled `lossy`, never corrected |
| **1** | `unwritable` (`pressure`) | refused at the contract boundary (E15-E) |

So exit criterion 1 reads: **19 properties round-trip exactly, gain is labelled,
pressure is refused** — and the sweep proves all three behaviours, not just the
first. Record the reconciliation so the next reader does not re-derive it.

## Scope

### In

1. **Exit criterion 1 — lossless revert.** A patch of N note ops applies, verifies
   by readback, and reverts, proven by a full round-trip across the 21-property
   table above. ⚠ **Verify through a DIFFERENT handle than the one that wrote**
   (standing rule 3a / D15): Bitwig's cursors cache what you wrote and report it
   back whether or not it landed. Two spike findings were wrong for exactly this
   reason. An independent cursor, or the same one after a re-point.
2. **Exit criterion 2 — under concurrent editing.** Re-run E8b as a standing
   regression: writes land on the pinned target through the user clicking,
   dragging and switching clips. The original measured **40/40 writes correct
   across 21 observed selection changes**. Add the D6 selection restore to what is
   asserted — the batch should cost exactly **one** observable selection change,
   restored at the end.
3. **Exit criterion 3 — stale revision rejected whole.** Live, applying zero ops.
4. **Exit criterion 4 — managed A/B in Bitwig.** Prove layer-chain alternates switch
   with container-local solo and clip-block alternates switch with per-slot launch.
   A mixed instruction produces two independent controls, not a compound switch.
   Also smoke ordinary `copy_track` and confirm it is reported outside managed
   take bookkeeping. No custom take switcher or daemon API is involved.
5. **Exit criterion 5 — bank-window overflow refuses loudly.** ⚠ Note the
   constraint: `LiveAdapter` declares `canOverflowBank: false` deliberately,
   because *manufacturing an overflowing project inside someone's real session is
   not something a test run may do*. The live evidence is banked in probe `e05b`,
   and `itemCount()` reporting the **project** total rather than the window
   (E15-A) is what makes the check implementable. So this criterion is met by the
   fake plus the banked probe, not by a fresh live overflow — say so explicitly
   rather than quietly downgrading it.
6. **Exit criterion 6 — the whole pipeline offline in CI.** ⚠ And note
   `PHASE-0-SESSION-2.md` item 5: **CI has never actually executed**;
   `.github/workflows/ci.yml` says so in its own header, and `.githooks/pre-commit`
   is the only gate that has ever run. If there is a remote by now, this is where
   that gets fixed.
7. **Deciding what becomes a standing regression** versus a one-shot verification,
   and wiring the former into the probe suite the way E8b and the conformance
   cases already are.

### Out

- New capability of any kind. If this session wants to build something, the
  something belongs in an earlier session and this one should be re-run after.
- Phase 2's musical vocabulary, however tempting once notes are landing reliably.
- The deferred-response protocol — session 6, and no exit criterion depends on it.

## ⚠ Carried in from session 3 (2026-08-08)

Three items with no session of their own, homed here because this is the live
sweep. B4/B5 in [SESSION-3](../../archive/outcomes/PHASE-1-SESSION-3-BRIDGE.md) §The full carry-forward;
B7 in [SESSION-3C](../../archive/outcomes/PHASE-1-SESSION-3C-WINDOW.md) §Carry-forward.

- **B4 — hoist the selection capture/restore.** `LiveAdapter.captureSelection`'s
  ⚠ note blames the daemon for being unable to reduce the executor's three
  save/restore pairs per pipeline to one. There is no daemon (D4 rev), and the
  component that knows a pipeline is in progress is the **executor**. A plain
  refactor with no blocker; the user-visible symptom is selection flicker, not a
  wrong result.
- **B5 — two drags E19 did not measure.** ⚠ A **cross-track** drag: PART B moved
  a clip within one track, so both content events carried the same `channelId`,
  and "two tracks produce two ids" is an INFERENCE. Rule 10 says an inference is
  not a measurement. And a drag **below the bank window**, which session 3's B2
  predicts fires nothing at all — worth confirming as a known limit rather than
  discovering it as a bug.
- ⚠ **B7 — `C-minted` fails in a FULL live conformance run and nowhere else**, and
  it is the suite's only red (session 3c: 43/1/6). ⚠ Verified PRE-EXISTING against
  the pre-session tree, so it is a standing defect rather than a regression. It
  passes in isolation and in every 3–5 case subset tried; the full 50-case run is
  what breaks it, which is the load-dependent signature of the cause: **the
  `track.create` mint diffs the bank after a fixed `trackStruct` budget (144 ms)
  where a readback exists.** Under load the create has not landed, the diff sees no
  new `channelId`, and the mint is withheld — failing CLOSED, which is why it is a
  flake and not a wrong answer. ⚠ `budgets.ts`'s own header already prescribes the
  fix in words: *"where a readback exists, use it instead of a budget —
  `refreshIndex` re-reads the bank rather than waiting out a track create."* Poll
  the bank for the new id instead of waiting the number.
  > ⚠ **AMENDED 2026-08-14 — the fix has LANDED offline, so B7 is now a live
  > verification, not an investigation.** The track-copy groundwork preserved from
  > the retired 3f slice generalised it: `LiveAdapter` polls the bank for a
  > previously unseen `channelId` on every minting stage — `track.create` included,
  > not only `track.duplicate` — for a bounded 8 s, and still reports no mint if
  > that window expires. That is exactly the prescription above, and it was never
  > specific to track takes. ⚠ **It is unproven live.** What this session owes is
  > the full ~50-case conformance run under load with `C-minted` green, and a
  > statement in the findings if it is not — a fix that only passes in isolation is
  > the same flake with a longer timeout.

## Decisions this session must make

- **⚠ Whether to verify `gain`'s inverse mapping** and enable the correction. This
  is the one open fidelity question in the phase, `GAIN_READ_SCALE` is sitting in
  `state.ts` unused waiting for it, and a live sitting is exactly what it needs.
  *Recommendation: measure it here if the sitting has room, but change nothing
  without the measurement* — a wrong correction makes every take restore wrong
  gain, silently.
- **Which regressions are worth their runtime.** The E8b interference test needs a
  human clicking, which means it can never run unattended. Decide what the
  unattended subset is.
- **What "done" looks like for Phase 1** — i.e. whether session 6 is required
  before Phase 2 starts. *Recommendation: no.*

## Exit criteria

All six of `PHASE-1-ENGINE.md`'s, each with evidence appended to `FINDINGS.md`
under a new E-number, and each either ● or explicitly qualified (as criterion 5
must be). Plus:

7. The active decision set carries clip/scene/device identity, the retired-store
   amendments, two-representation take semantics, ordinary track-copy semantics,
   partial-revert granularity, and the gain verdict.
8. `PHASE-1-ENGINE.md` status updated, and any premise of it that turned out
   wrong recorded **as a correction rather than a rewrite** — the house rule from
   `DECISIONS.md`'s header, and the reason Phase 0's outcome log is its most
   useful section.

## Risks

- **⚠ The sitting reveals a design problem, not a bug.** The most likely candidate
  is stale-take detection under concurrent editing (session 3), because it is the
  only part of the phase whose correctness genuinely depends on a human behaving
  unpredictably. Mitigation: budget for the sitting producing a session 3.5
  rather than a green tick, which is what happened to Phase 0 twice and was the
  most valuable thing it produced both times.
- **Verification through the writing handle creeps back in.** It is the natural
  way to write a test and it has already cost this project two wrong findings.
  Mitigation: make the independent-handle read structural in the harness, not a
  discipline each test remembers.
- **Green offline, wrong live.** The fake-divergence risk, arriving on schedule.
  Mitigation: every disagreement between fake and live is a FINDINGS entry and a
  fake fix, not a test tweak — that loop is what produced E15-B through E15-F.
