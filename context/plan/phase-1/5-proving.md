---
title: Phase 1, session 5 — live proving program
kind: plan
state: complete
status: Complete 2026-08-16. Sessions 5a through 5i and all focused repairs are
        complete. All eight program exit criteria are closed from linked
        evidence.
updated: 2026-08-16
parent: README.md
prev: 4b-change-navigation.md
next: 5a-selection.md
scope: Phase 1 exit criteria
evidence: E2, E5, E8, E15-A/E, E19, E21, E23, E24, E25, E26, E27, E28, E29, E30, E31, E32, E33, E34, E35, E36, E37, E38, E39 · D6, D8, D14, D15–D20
needs: Bitwig foregrounded for live sessions; a human where each brief says so
---

# Phase 1, session 5 — live proving program

> **Purpose.** Prove each Phase 1 exit criterion in a focused session. Convert
> useful checks into regressions, then close the phase from explicit evidence.

## Current state

The original combined sweep stopped after B4. Session 5a is complete: the
executor owns one lazy selection-preservation scope across resolve, stash,
apply, verify, and reporting. `probe:5-selection` passes 8/8 live and leaves no
residue (E23).

Session 5b is also complete: 20 properties are exact, gain uses the E24 inverse,
and pressure is refused. Earlier evidence remains valid, but the remaining
briefs must make each phase-exit claim explicit.

Session 5c is complete. E25 confirms the ordered cross-track event pair by both
durable identities. It also confirms that a below-window drag is silent and
that the mark reports the uncovered scene dimension.

Session 5d was attempted. E26 confirms pinned note identities, but repeated
production stages re-borrow selection under human changes and one pan write did
not pass independent readback. The focused repair is complete. E27 confirms
eager selection capture and verified cursor reuse. Its independent control and
interference cases found no property-write defect. Run the 5d proof again.

The rerun stopped before the human window. E28 found that clip cursor
confirmation checks status only once after 25 ms, although D6 requires polling.
It also found that early grid-capture failure leaves the probe without its owned
cleanup fingerprint. The focused repair is complete. E29 confirms pin-aware
bounded confirmation, early cleanup fingerprints, and three live cursor sweeps.
Run the human 5d proof again.

The third attempt also stopped before the human window. E30 found that the
standing probe compares a sparse write recipe with complete host-normalized
note readback. Both owned notes gained the same live properties, so strict
cleanup comparison refused them. Directed exact cleanup restored the fixture.

The focused owned cleanup fingerprint repair is complete. E31 confirms safe
early matching, exact independent-read promotion, post-promotion refusal, and a
9/9 live cleanup sweep with no directed cleanup. Repeat the human 5d proof.

Session 5d is complete. E32 confirms that all 40 writes land on the pinned
target while the operator moves another clip and selects clips across four
tracks. Independent readback found no unintended write. The executor borrowed
selection once, restored it once, reverted exactly, and cleaned up both owned
clips.

Session 5e is complete. E33 confirms that a stale two-operation batch rejects
with zero stages and zero independent-read mutation. The current-revision
control applies and cleans up. Fake regression plus E5/e05b, E15-A, E16r, and
E21 qualifies every bank-window boundary without a fresh live overflow.

Session 5f is complete. E34 confirms that a human can switch device and clip
alternates through independent Bitwig-native controls. One mixed instruction
keeps its managed results correlated but separate. Track copy stays ordinary.

The first Session 5g run completed at 52 passed, 1 failed, and 6 skipped.
`C-minted` passed under full load. `C-twoclips` read clip A's pan value from
clip B. E35 records the result and exact cleanup. The focused repair is
complete. E36 confirms that both cursor tracks and clips need pin confirmation
before a hold is reusable. Independent two-clip readback and exact cleanup pass.
Rerun 5g.

The second Session 5g run again completed at 52 passed, 1 failed, and 6
skipped. `C-twoclips` and `C-minted` passed. The later two-clip revert case
timed out while it confirmed cursor 0 on clip A, before independent note
readback. E37 records the result and exact cleanup.

The focused confirmation repair is complete. E38 separates target acquisition
from pin settlement, keeps pending pins active while it polls, and preserves the
eight-attempt refusal. The focused two-clip revert and independent readback pass
with exact cleanup. Rerun 5g in one complete invocation.

Session 5g is complete. E39 records one unfiltered live invocation with 53
passes, no failures, and 6 qualified skips. `C-minted`, `C-twoclips`, and the
later two-clip revert all pass under full-suite load. Cleanup removed the two
generated tracks by durable identity and restored the exact project baseline.

Session 5h is complete. GitHub Actions run 31974448060 passed the brain and
extension jobs for exact candidate
`01b716265a20cbf91e6c2c1e357fb69d489ee707`. E40 records the remote proof and
the four-class regression policy.

Session 5i is complete. The decision audit passed without an amendment. The six
original Phase 1 criteria map to E24, E32, E33, E34, and E40. The bank-window
claim keeps its existing-live-plus-fake qualification. The
[Phase 1 outcome](../../archive/outcomes/PHASE-1.md) records the final map and
standing regression matrix. Optional async completion is deferred to Phase 2.

## The 21-property contract

The old phase plan says "all 21 expression properties." D8 says "16 of 18."
These statements count different slices. `NOTE_PROP_FIDELITY` has 21 keys:

| Count | Class | Required proof |
|---|---|---|
| 20 | exact | Apply, read through an independent handle, and revert exactly. |
| 1 | unwritable: `pressure` | Refuse at the contract boundary. |

E24 settles this reconciliation. Gain writes requested value divided by two.
Later plans must say that 20 of 21 properties are exact and pressure is refused.

## Program order

| Session | Focus | Phase exit |
|---|---|---|
| [5a — selection preservation](5a-selection.md) | One executor-owned selection scope | B4; complete |
| [5b — note fidelity and gain](5b-fidelity.md) | Independent-handle round-trip and gain decision; complete, E24 | criterion 1 |
| [5c — observer drag boundaries](5c-drag-boundaries.md) | Cross-track and below-window drag measurements; complete, E25 | B5 |
| [5d — concurrent editing](5d-concurrent-editing.md) | Pinned writes while the human edits; complete, E32 | criterion 2 |
| [5d repair — concurrent selection](5d-repair-concurrent-selection.md) | Stop repeated UI borrowing and diagnose one property loss | complete, E27 |
| [5d repair — cursor confirmation](5d-repair-cursor-confirmation.md) | Retry lagging clip confirmation and preserve cleanup fingerprints | complete, E29 |
| [5d repair — owned cleanup fingerprint](5d-repair-owned-cleanup-fingerprint.md) | Promote host-normalized readback to the exact owned fingerprint | complete, E31 |
| [5e — refusal boundaries](5e-refusal-boundaries.md) | Stale revision and bank-window refusal; complete, E33 | criteria 3 and 5 |
| [5f — managed A/B](5f-managed-ab.md) | Both native A/B mechanisms and ordinary track copy; complete, E34 | criterion 4 |
| [5g — full live conformance](5g-live-conformance.md) | Complete load run with `C-minted` green; complete, E39 | B7 |
| [5g repair — two-clip property isolation](5g-repair-two-clip-properties.md) | Diagnose and repair E35's cross-clip pan read; complete, E36 | repair only |
| [5g repair — two-clip revert confirmation](5g-repair-two-clip-revert-confirmation.md) | Poll pin settlement without restarting a confirmed target; complete, E38 | repair only |
| [5h — CI and regression policy](5h-ci.md) | Real remote CI proof and regression classification; complete, E40 | criterion 6 |
| [5i — Phase 1 closeout](5i-closeout.md) | Decision audit, corrections, and phase handoff; complete | criteria 7 and 8 |

The order is deliberate:

- 5b can change gain fidelity behavior, so it precedes final conformance.
- 5d depends on the selection scope proven in 5a.
- 5c is a separate human measurement. It does not share a run with B7.
- 5f can expose a production-workflow defect, so it precedes final conformance.
- 5g runs after all earlier implementation changes.
- 5h proves the exact candidate revision after the operator pushes it.
- 5i closes only after every preceding proof is complete.

## Program rules

1. Readback is the only truth. A write must be verified through a different
   handle, or through the same handle after a re-point (D15).
2. A proving session does not add new capability. If evidence reveals a defect,
   record it and create a focused repair session before the proof is rerun.
3. Every live session confirms the documented fixture identities before its
   first destructive operation.
4. A probe claims an empty row from live readback. It does not assume that a
   fixed row is empty (E23).
5. Every live session restores the project baseline, including selection,
   observation data, tracks, scenes, clips, and temporary configuration.
6. Do not manufacture a real bank overflow. Criterion 5 uses fake coverage and
   the existing banked live probes because a fresh overflow can strand objects.
7. Add new measurements as new E-number evidence files. Do not rewrite old
   experiment records.
8. Each brief decides whether its proof is unattended, human-assisted, or a
   one-shot measurement. Session 5h records the final regression matrix.

## Program exit

1. The complete 21-property contract has an independent-handle verdict.
2. Pinned writes and one selection restore hold while the human edits.
3. Stale revision rejects the complete batch and applies zero operations.
4. Layer and clip alternates switch through independent Bitwig-native controls.
5. Bank-window overflow refuses before mutation, with the live qualification
   stated explicitly.
6. The offline pipeline passes in remote CI for the candidate revision.
7. Active decisions contain the final identity, stash, managed-take, track-copy,
   partial-revert, verification, and gain rules.
8. The current Phase 1 plan records corrections and closes from linked evidence.

The archived combined engine plan remains historical. Session 5i records the
final correction in the current Phase 1 plan and outcome documents instead of
rewriting archived prose.

## Closeout

All eight program exit criteria are complete. E24 proves criterion 1. E32 proves
criterion 2. E33 proves criteria 3 and 5. E34 proves criterion 4. E40 proves
criterion 6. The Session 5i decision audit proves criterion 7, and this closed
plan plus the Phase 1 outcome record proves criterion 8.

Criterion 5 is qualified. Its regression is the fake refusal matrix, supported
by the existing live bank measurements in E5/e05b, E15-A, E16r, and E21. Phase 1
does not claim a fresh destructive overflow sweep. E39 provides the final full
live conformance result: 53 runnable cases passed and 6 deliberate skips retain
their named evidence.
