---
title: Current state
kind: status
state: active
updated: 2026-08-16
phase: phase-1
session: phase-1-session-5d-repair-cursor-confirmation
---

# Now

Run the focused [5d cursor confirmation
repair](plan/phase-1/5d-repair-cursor-confirmation.md). E28 stopped the human
rerun during setup, before the operator prompt and production write window.

The approved [Session 5 program](plan/phase-1/5-proving.md) has nine focused
slices. Sessions 5a through 5c and the first 5d repair are complete (E23–E25,
E27). Session 5d remains unproved after E26 and E28. Sessions 5e through 5i
remain planned. No other Session 5 exit criterion is complete.

## Start here

1. Read E28 and the cursor confirmation repair brief.
2. Add a bounded retry for exact clip cursor confirmation. Keep failure bounded.
3. Store exact owned cleanup fingerprints before the complete grid capture.
4. Add the focused lag, refusal, and early-cleanup regressions.
5. Run the focused live cursor sweep three times, then run all offline gates.
6. Leave the human 5d proof for the next session.

## Baseline

- Project: `gn-scale-test`; 10 launcher rows; 10 visible tracks.
- Observation record: exact empty schema-v1 canonical value.
- `Last change`: `Change · 4a-live-check`.
- Wire: 134 methods / `c2aa57be11e1f47e`.
- Description cohort: `ghostnote-description-v1`, 15 tools, SHA-256
  `9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.
- E28 directed cleanup removed its one verified pitch-108 clip. Final readback
  found the `gn-B`, `gn-lay`, and `gn-lay4` row-10 cells empty, selection at
  track 0 row 1, the exact empty observation record, and the transport stopped.

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

## Failure result

The production adapter sends a clip point, waits 25 ms, and checks status once.
The 5d witness scan saw one valid occupied clip fail that check. D6 requires
polling, and existing measurements show that follower state can need about 100
ms. The adapter refused safely, but the proof did not start.

The standing probe also stores its cleanup fingerprints after the complete grid
capture. The early failure left its drag baseline unassigned, so automatic
cleanup refused a correct owned fingerprint. The focused repair covers both
gaps before another 5d run.

## Session retrospective

Store owned cleanup fingerprints before a larger diagnostic can fail. No
repository instruction change is needed.
