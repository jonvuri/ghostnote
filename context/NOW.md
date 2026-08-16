---
title: Current state
kind: status
state: active
updated: 2026-08-16
phase: phase-1
session: phase-1-session-5d-concurrent-editing-rerun
---

# Now

Run the human-assisted [5d concurrent-editing
proof](plan/phase-1/5d-concurrent-editing.md) again. Both focused repairs are
complete. E29 confirms bounded pin-aware cursor pointing, failure-safe owned
cleanup, and three clean live cursor sweeps.

The approved [Session 5 program](plan/phase-1/5-proving.md) has nine focused
slices. Sessions 5a through 5c and both 5d repairs are complete (E23–E25, E27,
E29). Session 5d remains unproved after E26 and E28. Sessions 5e through 5i
remain planned. No other Session 5 exit criterion is complete.

## Start here

1. Read E26 through E29 and the 5d concurrent-editing brief.
2. Run `npm run probe:5d-concurrent` with Bitwig foregrounded.
3. Move the owned drag clip and change selection as the prompt directs.
4. Confirm pinned writes, independent readback, one borrow and restore, exact
   revert, cleanup, and final fixture state.
5. Record a new evidence result. Do not combine a new repair with the proof.

## Baseline

- Project: `gn-scale-test`; 10 launcher rows; 10 visible tracks.
- Observation record: exact empty schema-v1 canonical value.
- `Last change`: `Change · 4a-live-check`.
- Selection: track 0, row 1.
- Transport: stopped.
- Wire: 134 methods / `c2aa57be11e1f47e`.
- Description cohort: `ghostnote-description-v1`, 15 tools, SHA-256
  `9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.
- E29 changed no project content. Three live sweeps held revision 509, scene
  epoch 2, and content epoch 298. Directed cleanup restored the documented
  selection after two failed diagnostic sweeps.

Confirm these track identities before a destructive live sweep:

| Track | Durable id |
|---|---|
| Instrument Layer | `98ba8aa3-dbce-4e51-8bb2-de9302542b6e` |
| Hybrid 2 | `4a6a024a-f213-48f1-9029-532fc077d857` |
| gn-A | `d61c23c2-4f85-4eee-bc08-8bb9baf6ff63` |
| gn-B | `78a40fcf-3eae-48fc-badf-1ff18900166b` |
| Group 5 | `ae4caa0f-f689-4f17-88cf-a5ae0d9ebdd3` |
| gn-lay | `d367ac16-b7bd-4662-971f-fe924ec033a3` |
| gn-lay4 | `9a88b37d-337a-4ef2-96a8-a147419d7cda` |
| gn-sel | `6fb96670-abde-4958-9147-f573a4b43918` |
| FX 1 | `52bd865e-c958-4bda-b9d3-97d0ea2f463a` |
| Master | `834e65ab-efa4-4bc6-ae9d-4eafd818d16e` |

## Session retrospective

A point operation must own pin state. It must not depend on cursor state from an
earlier probe. No repository instruction change is needed.
