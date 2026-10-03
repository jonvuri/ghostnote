---
title: Current state
kind: status
state: active
updated: 2026-10-03
phase: phase-8-agent-native-live-engine
session: 8g5b-complete
---

# Now

Next session: [8g5c — Combined storage limit](plan/phase-8/8g5c-combined-storage-limit.md).

[8g5b](plan/phase-8/8g5b-slot-inventory-delivery.md) is complete.
[E222](evidence/experiments/e222-slot-delivery-and-occupancy-window.md) measured
zero missed occupancy deliveries and zero foreign slots. The user accepted
[D28](decisions/d28-slot-occupancy-delivery-is-a-named-assumption.md). Live
occupancy now publishes only through a confirmed slot-delta window. Any slot or
structure callback refuses with `slot-window-changed`.

Identity is never inferred from occupancy. Same-callback delete and recreate
was silent in 30 of 30 runs; 10 witness runs proved a new clip. A project switch
at equal occupancy was also silent. Each rebuild mints new references. Group
tracks' own slots mirror their children and are not clips. Carry both limits
into the 8g5 supported-state matrix, with the collapsed-child rebinding refusal.

Scope is still 16 flat tracks and 128 scenes. The occupancy source adds no host
handles; it reuses 256 rig `hasContent` observers over 32,768 slots. Heap is
unmeasured. 8g5c must support at least 256 instrument/audio tracks plus group,
FX, and Master capacity. It tests 512 total channels, raises the topology and
occupancy limits together, and adds both domains to the resource ledger.

Only protected `New 3 *` remains open. Never save or close it. Its
[final check](evidence/data/phase8g5b-slot/new3-final-baseline.json) matches the
[adopted baseline](evidence/data/phase8g5a-group/new3-baseline.json), including
its reader and empty clip. New 6 and New 7 were discarded without saving.

Normal hello passes: 85 methods, hash `bba7383dce25c0f0`, fresh init
`2026-10-03T09:22:01.778Z`. Config SHA-256 is `256bbf07…43b0`. The research
archive is removed. The deployed normal archive predates a research-only D28
label change. Brain typecheck and 1,754 tests pass. Extension, archive,
artifact, wire, context, and diff checks pass.

Run 8g5c, then 8g5. All cache results remain `complete:false` and
`eligible:false`. Do not enter 8h. Entry HEAD is `8e907e0`. Session changes
are staged; no commit is made.

## Retrospective

Declare legitimate intermediate states before an analyzer classifies foreign
reads. Prove an identity claim with content, not occupancy. Ask the operator
where a native command placed its result before reading state.
