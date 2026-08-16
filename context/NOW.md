---
title: Current state
kind: status
state: active
updated: 2026-08-16
phase: phase-1
session: phase-1-session-5d-concurrent-editing-rerun
---

# Now

Run [session 5d](plan/phase-1/5d-concurrent-editing.md) again with a human at the
keyboard. E27 completed the focused selection and property repair.

The approved [Session 5 program](plan/phase-1/5-proving.md) has nine focused
slices. Sessions 5a through 5c and the 5d repair are complete (E23–E25, E27).
Session 5d remains unproved after the E26 attempt. Sessions 5e through 5i remain
planned. No other Session 5 exit criterion is complete.

## Start here

1. Read E26, E27, and the 5d proof brief.
2. Run `npm run probe:5d-concurrent` with Bitwig foregrounded.
3. During the write window, move the owned drag clip to its named destination.
4. Select at least two other clips on different tracks. Do not select the write
   target or the documented restore target.
5. Confirm one target arrival, one final restore, exact independent write
   readback, both drag events, exact revert, and no cleanup residue.

## Baseline

- Project: `gn-scale-test`; 10 launcher rows; 10 visible tracks.
- Observation record: exact empty schema-v1 canonical value.
- `Last change`: `Change · 4a-live-check`.
- Wire: 134 methods / `c2aa57be11e1f47e`.
- Description cohort: `ghostnote-description-v1`, 15 tools, SHA-256
  `9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.
- The E27 repair probe reverted both arms, removed its clip, restored the pre-run
  selection, and left no probe residue.

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

## Repair result

E27 captures selection at pipeline entry and reuses a cursor only after live
readback confirms its track and row. Nonstructural stages no longer point again;
structural operations still invalidate the hold. Focused offline tests and the
full 532-test check pass.

Two live repair runs found all 80 control pans and all 80 interference pans
through an independent cursor. No property-write defect was confirmed. The
human clip drag and complete selection trace remain for the 5d rerun.

## Session retrospective

Keep cursor allocator ownership separate from verified physical cursor state.
No repository instruction change is needed.
