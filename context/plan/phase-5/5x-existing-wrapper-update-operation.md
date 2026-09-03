---
title: Phase 5x — existing-wrapper update operation
kind: plan
state: planned
status: Planned. Evaluate a safe operation that adds or changes wrapper modulators.
updated: 2026-09-03
parent: README.md
prev: 5w-selection-borrowing-and-background-stability.md
evidence: D1, D3, D5, D15, E4f, E87, E89-E91, E96, dogfood session 01a0690e-1761-76b1-9e8e-635bfa35e583
---

# Phase 5x — existing-wrapper update operation

## Purpose

Evaluate how simple it is to add a public update operation for an existing
Ghostnote wrapper. If a bounded design can preserve proved state and recover
from partial failure, implement it. Otherwise record the exact missing
capability and split implementation into a later focused session.

## Starting facts and questions

The follow-up in dogfood session
`01a0690e-1761-76b1-9e8e-635bfa35e583` asked for one fourth modulator. The
public surface had no update operation. The agent reversed the accepted
three-modulator wrapper and created a new four-modulator wrapper. This replaced
the owned container and relied on remembered settings instead of proving that
all prior modulator state survived.

The current wrapper checkpoint describes the existing device, owned container,
positions, and scalar fingerprint. It does not provide a live preset export or
a complete editable snapshot of modulator objects and settings. Phase 5
records that the Controller API has no preset save or export operation.
`author_modulators` can edit a saved preset file, but the live wrapper is not
such a file.

Evaluate the operator's proposal to provide an update operation. Do not assume
that reverse-and-rebuild is equivalent to an in-place update. Determine the
state, checkpoint, and host capabilities required for an honest result.

## Work order

1. Define the user-visible update contract for the observed add-one-modulator
   case. Decide whether replace, retarget, amount, and delete share the same
   safe boundary or need later sessions.
2. Inventory what the wrapper checkpoint, live container inventory, remote
   pages, parameter reads, original composition request, and temporary composed
   preset can reconstruct. Mark every unobserved setting and opaque state.
3. Evaluate these strategies separately:
   - edit the current live wrapper without replacing it;
   - retain an owned source artifact that future updates can edit and reload;
   - perform one guarded rebuild behind an update operation;
   - refuse legacy wrappers that lack enough provenance.
4. For each strategy, record host/API feasibility, code scope, migration needs,
   state fidelity, rollback boundary, selection cost, and failure recovery.
   Use the 5u settlement policy, 5v value contract, and 5w selection rules.
5. Choose the smallest design that can state its fidelity honestly. If no
   design preserves required state, do not expose an update tool that implies
   in-place preservation.
6. If the design is bounded, implement the engine and public operation with a
   new checkpoint version. Return before and after modulator inventories,
   retained scalar settings, target routes, stage receipts, and a reversal or
   recovery checkpoint.
7. Add tests for add-one, repeated same type, later-column placement, stale
   checkpoint, operator edit, interrupted update, failed verification, retry,
   and reversal. Test every additional edit verb only if the operation exposes
   it. Refuse unsupported legacy wrappers before mutation.
8. Prove the add-fourth case in a disposable live project. Confirm that the
   existing ColourCopy instance and all proved prior modulator state remain, or
   label each rebuild qualification explicitly. Restore the baseline.

## Acceptance criteria

- A feasibility record compares the candidate strategies and gives a concrete
  implementation estimate before code changes start.
- The chosen result states whether it is in-place, reload-based, or rebuilt.
- No result claims preservation for state that Ghostnote did not observe and
  compare.
- A supported add-fourth request keeps the same existing device instance,
  parameter fingerprint, earlier routes, earlier proved settings, and compact
  tile placement.
- A stale checkpoint or unobserved legacy state refuses before destructive
  replacement.
- Partial failure leaves the existing device reachable and returns one exact
  recovery path.
- Tests cover every exposed edit verb, interference, repeated calls, reversal,
  and exact cleanup.
- If safe implementation is not bounded, the session produces a focused
  follow-up plan and leaves the public surface unchanged.

## Out of scope

- Pretending that reverse-and-rebuild is atomic.
- Reconstructing arbitrary opaque plug-in or modulator state from screenshots.
- Adding a Controller API preset-export capability that the host does not
  provide.
- The final operator verdict and Phase 5 closeout.

## Handoff

Return to session 5t. Run a new projectless ColourCopy dogfood task with the
four repairs, then complete the 5s closeout matrix after an explicit operator
verdict.
