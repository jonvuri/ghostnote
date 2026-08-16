---
title: Current state
kind: status
state: active
updated: 2026-08-16
phase: phase-1
session: phase-1-session-5d-concurrent-editing
---

# Now

Run [Phase 1 session 5d](plan/phase-1/5d-concurrent-editing.md): prove pinned
writes and one final selection restore while a human edits elsewhere.

The approved [Session 5 program](plan/phase-1/5-proving.md) has nine focused
slices. Sessions 5a through 5c are complete (E23, E24, E25). Sessions 5d through
5i are planned. No other Session 5 exit criterion is complete.

## Start here

1. Read the Session 5 umbrella, then the 5d brief and its cited E8, E23, D6, D10,
   and D15 sections.
2. Build one human-assisted production-executor interference probe.
3. Keep the write target pinned while the operator changes tracks, clips, and
   one clip outside the write target.
4. Verify the target through an independent handle and measure one selection
   borrow plus one final restore.
5. Revert the owned write and leave the live project at the baseline below.

## Baseline

- Project: `gn-scale-test`; 10 launcher rows; 10 visible tracks.
- Observation record: exact empty schema-v1 canonical value.
- `Last change`: `Change · 4a-live-check`.
- Wire: 134 methods / `c2aa57be11e1f47e`.
- Description cohort: `ghostnote-description-v1`, 15 tools, SHA-256
  `9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.
- Session 5c restored the exact rig configuration and left no probe clip.

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

## Session 5c result

E25 proves the ordered cross-track event pair with the correct source and
destination durable ids. A real drag below an eight-row window emitted no event.
The mark reported `uncoveredIn: 'scenes'`, so the quiet result is explicitly
incomplete.

## Session 5c retrospective

Finish cleanup before closing a shared bridge client. Immediate reuse can race
the prior socket's close event. The focused probe now uses the safe order. No
repository instruction change is needed.
