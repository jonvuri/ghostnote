---
title: Phase 1, session 5g — full live conformance
kind: plan
state: planned
status: Not started. Runs after sessions 5b–5f.
updated: 2026-08-16
parent: 5-proving.md
prev: 5f-managed-ab.md
next: 5h-ci.md
scope: Session 3c carry-in B7; final live integration proof
evidence: E15, E21 · D15
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
4. Record all passes, failures, and deliberate skips. Keep the six live overflow
   skips qualified by session 5e evidence.
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
