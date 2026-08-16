---
id: E25
kind: evidence
state: active
source: phase-1-session-5c-drag-boundaries
---

# E25 — Cross-track drags carry both durable identities, and below-window drags are silent [K] (2026-08-16)

**Verdict: the cross-track observer model is correct, and the scene window is a
known limit. A covered drag emits source-empty then destination-fill with the
correct durable identity on each event. A drag below the scene window emits no
event. The same mark reports `uncoveredIn: 'scenes'`, so the quiet result does
not claim a complete observation.**

## Cross-track drag

The probe claimed zero-based row 9 only after live readback showed it empty on
both documented tracks. It created one owned clip on `gn-B`. The operator
dragged it horizontally to `gn-lay`.

The observer emitted exactly two events in order:

```text
{seq:300, channelId:"78a40fcf-3eae-48fc-badf-1ff18900166b", slotIndex:9, filled:false}
{seq:301, channelId:"d367ac16-b7bd-4662-971f-fe924ec033a3", slotIndex:9, filled:true}
```

The first identity is `gn-B`. The second identity is `gn-lay`. The window was
complete: it was not truncated, discontinuous, unattributable, or uncovered.
The scene epoch stayed at 2 through the move.

## Below-window drag

The probe restored and removed the cross-track clip. It then claimed empty rows
9 and 8 on `gn-B` and created one new owned clip at row 9. It saved the exact
operator configuration, changed only `scenes` and `stamp`, and reloaded the
extension with an eight-row scene window. The project kept its existing 10
scenes. No scene was added.

The mark before the drag reported `{count:10, bankSize:8}`. The operator moved
the clip from row 9 to row 8. Both rows were outside the observer window. The
content epoch stayed at 148, and the delta was:

```text
events=[] truncated=false discontinuous=false uncovered=true uncoveredIn="scenes"
```

The probe then restored the exact prior configuration and reloaded the
extension. Full-window readback proved that row 9 was empty and row 8 was full.
This separates a real silent drag from no drag.

## Cleanup and standing probe

`probe:5c-read-cross` moved the first clip back, removed it, and restored the
initial selection. `probe:5c-read-below` restored the exact configuration,
verified the second move, moved that clip back, removed it, and restored the
initial selection. Both paths restored `Last change` and preserved the exact
empty schema-v1 observation record. All 10 track identities and the 10-scene
project baseline matched after cleanup.

The first preflight found an uninitialized empty observation value. The harness
now converts only `""` to the documented empty schema-v1 record. It refuses any
other mismatch. The first cross-track cleanup also exposed a client close-order
race. Cleanup now finishes before it closes the shared bridge client.

`phase5c-drag-boundaries.ts` remains as four human-assisted commands. It creates
only a clip in a row that live readback proved empty. It never adds a scene.

## Retrospective

Close a shared bridge client only after cleanup finishes. Immediate reuse after
close can race the old socket's close event. The focused harness now enforces
this order. No repository instruction change is needed.
