---
title: Phase 1 — write engine and managed takes
kind: plan
state: active
updated: 2026-08-15
parent: ../ROADMAP.md
active_session: 3f-fork-chain.md
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
| Layer chain | Managed device alternate | address, creation, relocation and switching complete; 3f-e live green, 3f-f active |

Layer and clip alternates created in one instruction are independent. Tool naming
and descriptions begin light and are versioned for later observation; the old
three-way dispatch classifier is retired.

## Execution order

1. ~~[3e — clip block](3e-clip-block.md)~~ — done
2. [3f — track-copy CRUD and layer-chain lifecycle](3f-fork-chain.md) — active;
   3f-e switching complete, 3f-f bootstrap and creation surface next
3. [3g — observation, descriptions, and v1 freeze](3g-record.md)
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
