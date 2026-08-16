---
id: E26
kind: evidence
state: active
source: phase-1-session-5d-concurrent-editing
---

# E26 — The production executor re-borrows selection under interference [K] (2026-08-16)

**Verdict: Phase 1 exit criterion 2 is not yet met. The write target stays
pinned, but repeated production stages steal selection again after each human
change. One requested note property also failed independent readback.**

## Live result

The probe verified all 10 fixture identities and claimed zero-based row 9 on
three documented tracks only after live readback showed each slot empty. It
created a write target on `gn-B`, a drag clip on `gn-lay`, and reserved the same
row on `gn-lay4` as the drag destination.

The production executor sent 40 property-bearing note writes. The normal stage
planner expanded them into write and property stages. This made an approximately
nine-second interference window without using the old raw `delayMs` probe path.
The operator selected eight other clips across five tracks during that window.

The selection monitor observed every counter increment. It recorded 10 arrivals
at the write target, not one. Each later stage pointed the non-following cursor
again after the operator changed selection. The lazy selection capture also
saved the first human selection instead of the selection measured before the
pipeline. The executor therefore returned to that later selection, not to the
initial `gn-B` row 0 selection.

## Write readback

All 40 requested note identities landed on the pinned `gn-B` clip. A cursor that
the writer could not allocate independently read the complete target. It found
39 of 40 requested pan values. Pitch 74 at beat 1 kept the note, velocity, and
duration but omitted its requested pan of 0.25. The executor's internal verify
reported the same disagreement.

A full independent scan found no change on any non-probe clip. The planned drag
did not complete, so no source-empty or destination-fill event occurred. That
part of the 5d proof remains unmeasured; it is not a quiet success.

## Cleanup

The executor reverted the target to its exact independent-read baseline. The
probe removed both owned clips, restored the pre-probe selection, and preserved
the exact empty schema-v1 observation record. The project ended at the documented
baseline with no probe residue.

`probe:5d-concurrent` remains the human-assisted standing probe. It exits with a
failure until the repair closes the measured gaps. The full offline gate passes
529/529. The context check and `git diff --check` also pass.

## Decision impact

The failure does not overturn durable addressing. Every note identity landed on
the intended track and row through active track and clip changes. It does show
that one executor-owned selection scope is not sufficient by itself. Repeated
point frames inside the scope can repeatedly change the UI selection.

A focused repair session must:

1. capture the pipeline-entry selection before the first asynchronous resolve;
2. avoid a new UI selection change when a non-following cursor is already pinned
   to the verified target;
3. diagnose and cover the independently confirmed property loss;
4. rerun 5d, including the outside-target clip move.

## Retrospective

Score default-valued optional note properties carefully. Bitwig omits an
explicit pan of zero from verbose readback. The probe now uses only non-zero pan
values, so absence means that the requested property did not land. No repository
instruction change is needed.
