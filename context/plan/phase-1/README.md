---
title: Phase 1 — write engine and branching
kind: plan
state: active
updated: 2026-08-11
parent: ../ROADMAP.md
active_session: 3f-fork-chain.md
---

# Phase 1 — write engine and branching

## Outcome

Deliver a typed write engine with verified application, bounded reversal, three
usable branch mechanisms, a human control surface, and live proof of the complete
path.

## Current model

The project is the take log. Branching uses three complementary mechanisms:

| Mechanism | Best fit | Current state |
|---|---|---|
| Clip block | Beat-aligned, position-continuous clip A/B | session 3e done; production MCP smoke 9/9 |
| Track fork | Coarse track-wide branch | wire proven; product mechanism in 3f |
| Layer chain | Device-scoped branch | partial wire; nested addressing in 3f |

The agent chooses freely under D18. Correctness preconditions and refusals may be
described, but the deterministic choice classifier must remain invisible to the
agent-facing surface.

## Execution order

1. ~~[3e — clip block](3e-clip-block.md)~~ — done
2. [3f — track fork and layer chain](3f-fork-chain.md) — next
3. [3g — record, classifier, and v1 freeze](3g-record.md)
4. [4 — control layer](4-control-layer.md)
5. [5 — live proving](5-proving.md)
6. [6 — async completion](6-async.md), optional

Completed session records are listed in [NOW](../../NOW.md) and live under
`archive/outcomes/`. The original combined Phase 1 plan, including re-plan and
renumbering history, remains in `archive/plans/PHASE-1-ENGINE.md`.

## Phase exit

- All supported writes travel through executor → stash recording.
- Track fork, layer chain, and clip block work through the production surface.
- Reversal and destructive boundaries match D18–D20.
- A human can compare two takes from Bitwig without a ghostnote-specific A/B UI.
- Live conformance covers the address, write, branch, and control paths.
