---
title: Phase 1, session 5 — live proving program
kind: plan
state: active
status: Re-cut approved 2026-08-16. Sessions 5a through 5c and the 5d repair are
        complete. Repeat 5d next. Sessions 5e–5i are planned.
updated: 2026-08-16
parent: README.md
prev: 4b-change-navigation.md
next: 5a-selection.md
scope: Phase 1 exit criteria
evidence: E2, E5, E8, E15-A/E, E19, E21, E23, E24, E25, E26, E27 · D6, D8, D15–D20
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
| [5d — concurrent editing](5d-concurrent-editing.md) | Pinned writes while the human edits | criterion 2 |
| [5d repair — concurrent selection](5d-repair-concurrent-selection.md) | Stop repeated UI borrowing and diagnose one property loss | complete, E27 |
| [5e — refusal boundaries](5e-refusal-boundaries.md) | Stale revision and bank-window refusal | criteria 3 and 5 |
| [5f — managed A/B](5f-managed-ab.md) | Both native A/B mechanisms and ordinary track copy | criterion 4 |
| [5g — full live conformance](5g-live-conformance.md) | Complete load run with `C-minted` green | B7 |
| [5h — CI and regression policy](5h-ci.md) | Real remote CI proof and regression classification | criterion 6 |
| [5i — Phase 1 closeout](5i-closeout.md) | Decision audit, corrections, and phase handoff | criteria 7 and 8 |

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
