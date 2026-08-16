---
title: Current state
kind: status
state: active
updated: 2026-08-16
phase: phase-1
session: phase-1-session-5g-repair-two-clip-revert-confirmation
---

# Now

Complete the [two-clip revert confirmation
repair](plan/phase-1/5g-repair-two-clip-revert-confirmation.md). E37 records the
second full conformance attempt. `C-twoclips` and `C-minted` passed, but the
later two-clip revert case timed out before independent readback because cursor
0 did not confirm clip A within eight attempts.

The approved [Session 5 program](plan/phase-1/5-proving.md) has nine focused
slices. Sessions 5a through 5f, all three 5d repairs, and the first 5g repair
are complete (E23–E25, E27, E29, E31–E34, E36). Session 5g remains open.
Sessions 5h and 5i remain planned. Phase 1 exit criteria 2 through 5 are
complete.

## Start here

1. Read the repair brief, E37, E36, E29, D6, and D15.
2. Trace target and dual-pin confirmation as separate states.
3. Reproduce the complete two-clip revert ordering in a focused probe.
4. Repair only the confirmed bounded-confirmation cause and add regressions.
5. Run the focused live proof and restore the complete baseline.
6. Leave the full conformance rerun for the next session.

## Baseline

- Project: `gn-scale-test`; 10 launcher rows; 10 visible tracks.
- Observation record: exact empty schema-v1 canonical value.
- `Last change`: `Change · 4a-live-check`.
- Selection: track 0, row 1.
- Transport: stopped.
- Wire: 134 methods / `c2aa57be11e1f47e`.
- Description cohort: `ghostnote-description-v1`, 15 tools, SHA-256
  `9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.
- E37 cleanup removed both generated conformance tracks. Final checks found the
  same 10 tracks, 10 scenes, 22 occupied cells, selection at track 0 row 1,
  stopped transport, and exact observation value. All three cursor tracks and
  clips were unpinned on `gn-lay` row 0. `Last change` was restored.

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

Report target confirmation and pin confirmation as separate states. A generic
point timeout hides which state did not settle. No repository instruction
change is needed.
