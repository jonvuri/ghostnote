---
title: Phase 1, session 5e — refusal boundaries
kind: plan
state: complete
status: Complete 2026-08-16. Stale rejection passes 11/11 live; bank qualification is complete (E33).
updated: 2026-08-16
parent: 5-proving.md
prev: 5d-concurrent-editing.md
next: 5f-managed-ab.md
scope: Phase 1 exit criteria 3 and 5
evidence: E5, E8, E15-A, E16r, E21, E33 · D6, D10, D15
needs: Bitwig foregrounded for stale-revision proof
---

# Phase 1, session 5e — refusal boundaries

> **Purpose.** Prove that stale state and bank-window blindness fail closed before
> a partial operation can occur.

## Stale revision

1. Read a revision, create an intervening revision change, and submit a batch
   against the stale value.
2. Confirm rejection of the complete batch and zero applied operations through
   independent readback.
3. Submit the same operation against the current revision as the positive
   control, then remove it.
4. Keep the autonomous case in the standing conformance suite.

## Bank-window qualification

1. Confirm that the fake covers track overflow, scene-window refusal, unreachable
   rows, and pre-mutation structural budgets.
2. Cite E5/e05b, E15-A, E16r, and E21 as the live proof. State that project totals
   are reported independently from the configured windows.
3. Do not create a fresh live overflow. Such a run can mint an object that the
   same window cannot address or remove.
4. State the qualification in the phase-exit result. The criterion is met by
   fake regression plus banked live evidence, not by a new destructive sweep.

## Exit criteria

1. A stale batch rejects whole and independent readback proves zero mutation.
2. The current-revision control applies and cleans up.
3. Every overflow path has an offline refusal regression with a cited live basis.
4. The final evidence does not overstate fresh live coverage.
5. The project remains at baseline.
6. Focused tests, the full offline check, the context check, and
   `git diff --check` pass.

## Result

The focused live probe passed 11/11. An intervening writer advanced revision
617 to 618. The two-operation batch submitted against revision 617 rejected
with no applied stages. Independent cursor readback found zero notes. The same
two writes applied against revision 618, and independent readback found both.

Cleanup removed the positive-control clip. It restored the documented 10-track,
10-scene fixture, track 0 row 1 selection, exact empty observation record, and
stopped transport.

The fake refusal matrix passed 20/20. It covers track overflow, cumulative track
growth, cumulative scene growth, unreachable rows, snapshot blind spots, and
incomplete observer windows. E5/e05b, E15-A, E16r, and E21 supply the banked live
basis. Project totals are reported independently from configured track and scene
windows. No fresh live overflow was created, and no new destructive overflow
coverage is claimed.

The full offline check passes 541/541. The context check and
`git diff --check` pass. E33 records the result. Session 5f is next.

## Session retrospective

The batch receipt lists encoded wire calls. Count semantic write calls when a
probe compares a receipt with contract operations. No repository instruction
change is needed.
