---
title: Current state
kind: status
state: active
updated: 2026-08-16
phase: phase-1
session: phase-1-session-5d-repair-concurrent-selection
---

# Now

Run the [session 5d repair](plan/phase-1/5d-repair-concurrent-selection.md): stop
repeated selection borrowing and diagnose the independently observed property
loss before the 5d proof is repeated.

The approved [Session 5 program](plan/phase-1/5-proving.md) has nine focused
slices. Sessions 5a through 5c are complete (E23, E24, E25). E26 blocks 5d.
Sessions 5e through 5i remain planned. No other Session 5 exit criterion is
complete.

## Start here

1. Read E26, the 5d attempt result, and the focused repair brief.
2. Capture selection at pipeline entry, before the first asynchronous resolve.
3. Reuse a verified held cursor across nonstructural stages without changing the
   user's selection again. Keep structural invalidation unchanged.
4. Reproduce the missing pan value with control and interference cases through
   an independent handle.
5. Add focused regressions and leave the live project at the baseline below.

## Baseline

- Project: `gn-scale-test`; 10 launcher rows; 10 visible tracks.
- Observation record: exact empty schema-v1 canonical value.
- `Last change`: `Change · 4a-live-check`.
- Wire: 134 methods / `c2aa57be11e1f47e`.
- Description cohort: `ghostnote-description-v1`, 15 tools, SHA-256
  `9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.
- The 5d attempt reverted its write, removed both owned clips, restored the
  pre-probe selection, and left no probe residue.

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

## Session 5d attempt result

E26 shows that all 40 note identities landed on the pinned target while the
operator selected eight clips across five tracks. The selection trace recorded
10 target arrivals, and the executor restored a selection captured after the
pipeline began. Independent readback also found one missing pan value. The
planned clip drag did not complete and remains unmeasured.

## Session 5d retrospective

Do not use an optional property's default value as a live presence oracle.
Bitwig omits an explicit pan of zero from verbose readback. The standing probe
now uses non-zero pan values. No repository instruction change is needed.
