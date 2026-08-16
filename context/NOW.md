---
title: Current state
kind: status
state: active
updated: 2026-08-16
phase: phase-1
session: phase-1-session-5g-live-conformance-third-attempt
---

# Now

Rerun [Session 5g live conformance](plan/phase-1/5g-live-conformance.md) in one
complete invocation. E38 completes the focused repair for E37. Target
acquisition and dual-pin settlement are now separate bounded states. The
focused two-clip revert and independent readback pass with exact cleanup.

The approved [Session 5 program](plan/phase-1/5-proving.md) has nine focused
slices. Sessions 5a through 5f, all three 5d repairs, and both 5g repairs are
complete (E23–E25, E27, E29, E31–E34, E36, E38). Session 5g remains open.
Sessions 5h and 5i remain planned. Phase 1 exit criteria 2 through 5 are
complete.

## Start here

1. Read the 5g brief, E38, E37, E36, E35, D6, and D15.
2. Confirm the live handshake, deployed build freshness, and fixture baseline.
3. Run `probe:conformance` once, without a filter or a second live invocation.
4. Record all passes, failures, and qualified skips.
5. Remove the two generated conformance tracks by their durable identities.
6. Restore and verify the complete baseline.

## Baseline

- Project: `gn-scale-test`; 10 launcher rows; 10 visible tracks.
- Observation record: exact empty schema-v1 canonical value.
- `Last change`: `Change · 4a-live-check`.
- Selection: track 0, row 1.
- Transport: stopped.
- Wire: 134 methods / `c2aa57be11e1f47e`.
- Description cohort: `ghostnote-description-v1`, 15 tools, SHA-256
  `9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.
- E38 cleanup removed both temporary clips. Final checks found the same 10
  tracks, 10 scenes, 22 occupied cells, selection at track 0 row 1, stopped
  transport, and exact observation value. All three cursor tracks and clips
  were unpinned on `gn-lay` row 0. `Last change` was restored.

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

A cleanup probe must restore the documented fixture selection. Restoring only
its entry selection can preserve residue from an earlier failed run. No
repository instruction change is needed.
