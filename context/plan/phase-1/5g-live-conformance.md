---
title: Phase 1, session 5g — full live conformance
kind: plan
state: complete
status: COMPLETE 2026-08-16. The third complete run passed 53/53 runnable
        cases with 6 qualified skips and exact cleanup. See E39.
updated: 2026-08-16
parent: 5-proving.md
prev: 5f-managed-ab.md
next: 5h-ci.md
scope: Session 3c carry-in B7; final live integration proof
evidence: E15, E21, E35, E36, E37, E38, E39 · D15
needs: Bitwig foregrounded
---

# Phase 1, session 5g — full live conformance

> **Purpose.** Prove the complete adapter contract under full-suite load, with
> the repaired mint polling path green.

## Preconditions

- Sessions 5b through 5f are complete.
- Their implementation changes are deployed and the extension is reloaded.
- `probe:hello` confirms the expected deployed build and wire contract.
- The documented fixture identities and project baseline match.

## Scope

1. Record track, scene, clip, selection, and observation baselines.
2. Run the complete live conformance suite in one invocation. Do not replace it
   with isolated cases or small subsets.
3. Require `C-minted` to pass in the full run. A pass in isolation is not proof
   of the load-dependent fix.
4. Record all passes, failures, and deliberate skips. Keep the live overflow
   limits qualified by session 5e evidence.
5. Run the conformance cleanup path and confirm that the project returns to the
   recorded baseline.

## Exit criteria

1. The complete live suite has no unexpected failure.
2. `C-minted` is green under full-suite load.
3. Every skip has an explicit evidence source and is not reported as a pass.
4. Track and scene counts, fixture identities, clips, selection, and observation
   data match the pre-run baseline.
5. The result receives a new E-number.
6. The context check and `git diff --check` pass.

This is a verification session. If it fails, record the failure and create a
focused repair session. Rerun 5g after that repair.

## First attempt

The complete live suite ran once and reported 52 passed, 1 failed, and 6
skipped. `C-minted` passed under full-suite load. `C-twoclips` failed because
clip B read back clip A's pan value, `-0.25`, instead of its requested `0.5`.
E35 records the run, the deliberate limits, and exact cleanup.

The cleanup path removed both generated conformance tracks. Final readback
matched all 10 durable tracks, 10 scenes, 22 occupied launcher cells, selection,
observation data, cursor state, status, and stopped transport.

The focused [two-clip property repair](5g-repair-two-clip-properties.md) is
complete. E36 confirms independent two-clip readback and exact cleanup. Rerun
this session in one complete invocation.

## Second attempt

The complete live suite ran once and again reported 52 passed, 1 failed, and 6
skipped. `C-twoclips` passed with the E36 repair. `C-minted` also passed under
full-suite load. The later two-clip revert case failed before independent note
readback because cursor 0 did not confirm `gn-conf-A` row 0 within eight
attempts.

Cleanup removed both generated conformance tracks. Final readback matched the
10 durable tracks, 10 scenes, 22 occupied cells, selection, observation data,
cursor state, status, and stopped transport. E37 records the run and cleanup.

The focused [two-clip revert confirmation
repair](5g-repair-two-clip-revert-confirmation.md) is complete. E38 keeps
pending pin requests active after target confirmation and records the failed
confirmation state separately. Run this session again in one complete
invocation.

## Completion

The third complete live suite ran once without a filter. It reported 53 passed,
0 failed, and 6 skipped. `C-minted`, `C-twoclips`, and the later two-clip revert
all passed under full-suite load. The six runner skips retain their explicit E2,
E5, E8, E16r, E19, E21, and E33 qualifications. They are not fresh passes.

Cleanup removed the two generated conformance tracks by their durable
identities. Final readback matched the 10 durable tracks, 10 scenes, 22
occupied cells, selection, observation data, cursor state, status, and stopped
transport. E39 records the run and exact cleanup. Session 5h is next.
