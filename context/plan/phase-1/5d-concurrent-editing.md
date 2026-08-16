---
title: Phase 1, session 5d — concurrent editing
kind: plan
state: complete
status: Complete 2026-08-16. The fourth proof passes 16/16 live (E32).
updated: 2026-08-16
parent: 5-proving.md
prev: 5c-drag-boundaries.md
next: 5e-refusal-boundaries.md
scope: Phase 1 exit criterion 2
evidence: E8, E23, E26, E27, E28, E29, E30, E31, E32 · D6, D10, D15
needs: Bitwig foregrounded; a human at the keyboard
---

# Phase 1, session 5d — concurrent editing

> **Purpose.** Re-run the E8b interference proof through the production executor
> and include the selection guarantee delivered by session 5a.

## Scope

1. Pin a production write target by durable track identity and verified clip
   row.
2. Stream a comparable multi-write batch while the operator clicks tracks,
   switches clips, and drags a clip outside the write target.
3. Read the target through an independent handle. Confirm that every write lands
   on the pinned target and nowhere else.
4. Measure the user selection. The executor may borrow once and must restore the
   original selection once after apply, verify, and reporting finish.
5. Revert the owned write, remove the probe clip if it created one, and restore
   the initial selection.
6. Keep the probe runnable as a human-assisted standing regression.

## Out of scope

- the B5 drag-boundary measurements;
- stale-revision rejection;
- managed A/B;
- full live conformance.

## Exit criteria

1. All requested writes land on the pinned target through observed user changes.
2. Independent readback finds no write on an unintended target.
3. The selection count is exactly one borrow and one restore, and the final
   selection matches the initial selection.
4. Revert restores the owned content exactly and cleanup leaves no residue.
5. Focused tests, the full offline check, the context check, and
   `git diff --check` pass.

## Attempt result

The production executor ran 40 property-bearing note writes while the operator
selected eight other clips across five tracks. All 40 note identities landed on
the pinned `gn-B` target. Independent readback found no write on another clip.

The proof failed two criteria. The selection trace recorded 10 target arrivals
because later production stages pointed again after each human selection. Lazy
capture also saved a human selection made after pipeline entry, so the executor
did not restore the selection measured before the run. Independent readback and
the executor report also agreed that one requested pan value did not land.

The planned outside-target drag did not complete. No drag event was reported,
so that subclaim remains unmeasured. Cleanup reverted the write exactly, removed
both owned clips, restored the pre-probe selection, and preserved the observation
baseline. E26 records the result. Run the focused
[5d repair](5d-repair-concurrent-selection.md) before this proof is repeated.

The focused repair is now complete. E27 confirms eager entry capture, verified
cursor reuse across nonstructural stages, structural invalidation, and exact pan
readback under automated selection interference.

## Rerun result

The rerun stopped during setup, before the human prompt and production write
window. The fixed witness cursor did not confirm one occupied clip after the
single 25 ms check in `pointAtClip`. The adapter failed closed, so no concurrent
editing claim was measured.

Cleanup removed the write target but initially refused the drag clip because
the complete grid capture failed before the probe assigned its cleanup
fingerprint. Directed readback confirmed the exact owned pitch-108 note before
deletion. Final readback found all three claimed cells empty, restored the entry
selection, preserved the empty observation record, and found the transport
stopped. E28 records the result.

Run the focused [cursor confirmation repair](5d-repair-cursor-confirmation.md)
before this proof is repeated. The repair is complete. E29 confirms bounded
pin-aware confirmation, early cleanup fingerprints, and three clean live
sweeps. Repeat this human proof next.

## Third attempt result

The third attempt stopped during the first independent fingerprint check. Both
owned notes had the requested four base fields. Live readback also supplied
release velocity, four enabled state flags, and recurrence. The strict complete
record comparison rejected the sparse stored write recipes. The human prompt
and production write window did not start.

Automatic cleanup refused both mismatched fingerprints. Directed cleanup
matched the complete live records from the failed output and deleted only the
two owned clips. Final readback found all three claimed cells empty and restored
the documented selection, observation, and transport baseline. E30 records the
result.

Run the focused [owned cleanup fingerprint
repair](5d-repair-owned-cleanup-fingerprint.md) before this proof is repeated.
The repair is complete. E31 confirms separate creation and exact fingerprints,
safe promotion, drift refusal, and a clean 9/9 live sweep. Repeat this human
proof next.

## Fourth attempt result

The human-assisted proof passed all 16 live checks. The production executor
applied and verified 40 note writes while the operator moved the drag clip and
selected five cells across four tracks. Independent readback found every write
on the pinned `gn-B` target, found no target write on the moved clip, and found
no change on a non-probe clip.

The selection monitor missed no counter change. It recorded one target borrow
and one final restore. The executor reported the moved clip through both durable
track identities. Revert restored the exact target fingerprint. Automatic
cleanup removed both owned clips, restored the entry selection, and preserved
the observation baseline. The full offline check passes 540/540. The context
check and `git diff --check` pass. E32 records the result. Session 5e is next.

## Session retrospective

Distinguish a sparse creation recipe from the exact host-normalized readback.
Keep the existing non-zero pan values because Bitwig omits an explicit zero from
verbose readback. The human instructions were exact and sufficient. No
repository instruction change is needed.
