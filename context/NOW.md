---
title: Current state
kind: status
state: active
updated: 2026-08-16
phase: phase-1
session: phase-1-session-5e-refusal-boundaries
---

# Now

Run [Session 5e refusal boundaries](plan/phase-1/5e-refusal-boundaries.md).
Session 5d is complete. E32 confirms that 40 production writes remained on the
pinned target while the operator moved another clip and selected clips across
four tracks. Independent readback found no unintended write. Selection had one
borrow and one restore. Revert and automatic cleanup restored the fixture.

The approved [Session 5 program](plan/phase-1/5-proving.md) has nine focused
slices. Sessions 5a through 5d and all three 5d repairs are complete (E23–E25,
E27, E29, E31, E32). Sessions 5e through 5i remain planned. Phase 1 exit
criterion 2 is complete.

## Start here

1. Read the 5e refusal-boundaries brief and its linked evidence and decisions.
2. Prove stale-revision rejection and the current-revision positive control.
3. Use the existing live evidence for bank-window qualification. Do not create
   a fresh live overflow.
4. Restore the complete fixture baseline and record new evidence.
5. Do not combine this proof with Session 5f.

## Baseline

- Project: `gn-scale-test`; 10 launcher rows; 10 visible tracks.
- Observation record: exact empty schema-v1 canonical value.
- `Last change`: `Change · 4a-live-check`.
- Selection: track 0, row 1.
- Transport: stopped.
- Wire: 134 methods / `c2aa57be11e1f47e`.
- Description cohort: `ghostnote-description-v1`, 15 tools, SHA-256
  `9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.
- E32 automatic cleanup removed both exact probe-owned clips. Final checks found
  no non-probe grid change, restored selection to track 0, row 1, and preserved
  the exact observation value.

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

The exact human instructions were sufficient. No repository instruction change
is needed.
