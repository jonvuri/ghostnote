---
title: Phase 1 — write engine and managed takes
kind: plan
state: active
updated: 2026-08-16
parent: ../ROADMAP.md
active_session: 3g-e-reporting.md
---

# Phase 1 — write engine and managed takes

## Outcome

Deliver a typed write engine with verified application, bounded reversal, ordinary
track-copy CRUD, two autonomous managed-take representations, a human control
surface, and live proof of the complete path.

## Current model

The project is the take log. Managed takes use two complementary mechanisms;
track copying remains separate CRUD:

| Capability | Role | Current state |
|---|---|---|
| Clip block | Beat-aligned, position-continuous clip A/B | session 3e done; production MCP smoke 9/9 |
| Track copy | General coarse track duplication, not a managed take | complete; production MCP smoke 6/6 |
| Layer chain | Managed device alternate | complete lifecycle closed and live-proved through 3f-i |

Layer and clip alternates created in one instruction are independent. Tool naming
and descriptions begin light and are versioned for later observation; the old
three-way dispatch classifier is retired.

## Execution order

1. ~~[3e — clip block](3e-clip-block.md)~~ — done
2. ~~[3f — track-copy CRUD and layer-chain lifecycle](3f-fork-chain.md)~~ — done;
   complete lifecycle and 3g mechanics handoff verified live
3. [3g — observation and v1 description program](3g-record.md)
   - ~~[3g-a — observation contract and capture
     protocol](3g-a-observation-contract.md)~~ — done; strict schema-v1 record,
     canonical codec, capture protocol and failure report verified offline
   - ~~[3g-b — per-project persistence transport](3g-b-persistence.md)~~ — done;
     hidden project store, safe legacy probe, and exact readback verified live
   - ~~[3g-c — v1 description cohort freeze](3g-c-description-freeze.md)~~ — done;
     exact 15-tool public artifact frozen as `ghostnote-description-v1`
   - ~~[3g-d — production event instrumentation](3g-d-instrumentation.md)~~ —
     done; shared capture and preserving production MCP smoke verified live
   - [3g-e — reporting and live closure](3g-e-reporting.md) — ready
4. [4 — control layer](4-control-layer.md)
5. [5 — live proving](5-proving.md)
6. [6 — async completion](6-async.md), optional

Completed session records are listed in [NOW](../../NOW.md) and live under
`archive/outcomes/`. The original combined Phase 1 plan, including re-plan and
renumbering history, remains in `archive/plans/PHASE-1-ENGINE.md`.

## Phase exit

- All supported writes travel through executor → stash recording.
- Track copy works as ordinary CRUD; layer-chain and clip-block takes work through
  the production surface without runtime operator assistance.
- The layer-chain lifecycle includes both winner collapse and selective reduction
  while several alternates survive; both are Phase 1 requirements.
- Reversal and destructive boundaries match D18–D20.
- A human can compare two takes from Bitwig without a ghostnote-specific A/B UI.
- Live conformance covers the address, write, branch, and control paths.
