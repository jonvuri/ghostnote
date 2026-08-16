---
title: Current state
kind: status
state: active
updated: 2026-08-16
phase: phase-1
session: phase-1-session-5d-repair-owned-cleanup-fingerprint
---

# Now

Run the focused [5d owned cleanup fingerprint
repair](plan/phase-1/5d-repair-owned-cleanup-fingerprint.md). E30 stopped the
third human proof attempt during setup. Live readback contained host-normalized
note properties that were absent from the sparse stored cleanup recipe.

The approved [Session 5 program](plan/phase-1/5-proving.md) has nine focused
slices. Sessions 5a through 5c and the first two 5d repairs are complete
(E23–E25, E27, E29). Session 5d remains unproved after E26, E28, and E30.
Sessions 5e through 5i remain planned. No other Session 5 exit criterion is
complete.

## Start here

1. Read E30 and the owned cleanup fingerprint repair brief.
2. Separate the sparse creation fingerprint from the exact verified readback.
3. Add early-match, exact-promotion, and refusal regressions.
4. Run the focused live setup and cleanup sweep.
5. Run all offline gates. Leave the human 5d proof for the next session.

## Baseline

- Project: `gn-scale-test`; 10 launcher rows; 10 visible tracks.
- Observation record: exact empty schema-v1 canonical value.
- `Last change`: `Change · 4a-live-check`.
- Selection: track 0, row 1.
- Transport: stopped.
- Wire: 134 methods / `c2aa57be11e1f47e`.
- Description cohort: `ghostnote-description-v1`, 15 tools, SHA-256
  `9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.
- E30 directed cleanup removed both exact probe-owned clips. Final readback held
  revision 515, scene epoch 2, and content epoch 302. It found the three claimed
  row-10 cells empty and restored the other documented baseline state.

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

A cleanup fingerprint must distinguish the sparse write recipe from the exact
host-normalized readback. No repository instruction change is needed.
