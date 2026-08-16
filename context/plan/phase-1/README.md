---
title: Phase 1 — write engine and managed takes
kind: plan
state: active
updated: 2026-08-16
parent: ../ROADMAP.md
active_session: 5-proving.md
---

# Phase 1 — write engine and managed takes

## Outcome

Deliver a typed write engine with verified application, bounded reversal,
ordinary track-copy CRUD, two autonomous managed-take representations, Bitwig
status and change navigation, and live proof of the complete path.

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
3. ~~[3g — observation and v1 description program](3g-record.md)~~ — done
   - ~~[3g-a — observation contract and capture
     protocol](3g-a-observation-contract.md)~~ — done; strict schema-v1 record,
     canonical codec, capture protocol and failure report verified offline
   - ~~[3g-b — per-project persistence transport](3g-b-persistence.md)~~ — done;
     hidden project store, safe legacy probe, and exact readback verified live
   - ~~[3g-c — v1 description cohort freeze](3g-c-description-freeze.md)~~ — done;
     exact 15-tool public artifact frozen as `ghostnote-description-v1`
   - ~~[3g-d — production event instrumentation](3g-d-instrumentation.md)~~ —
     done; shared capture and preserving production MCP smoke verified live
   - ~~[3g-e — reporting and live closure](3g-e-reporting.md)~~ — done; lossless
     raw view, descriptive cross-tab, restart survival, visibility, and exact
     cleanup verified live
4. ~~[4 — Bitwig status and change navigation](4-control-layer.md)~~ — done
   - ~~[4a — status surface and panel cleanup](4a-status-surface.md)~~ — done;
     reduced pane, truthful status, edit repair, and restart persistence verified
     live
   - ~~[4a review follow-up](4a-review-follow-up.md)~~ — done; probe cleanup is
     failure-safe and each status update is bound to its write project
   - ~~[4b — navigation to a recorded clip change](4b-change-navigation.md)~~ —
     done; explicit durable targeting, ambiguity, missing-target refusal, Edit
     layout, and fitted content verified live
5. [5 — live proving program](5-proving.md) — active; the focused re-cut was
   approved 2026-08-16
   - ~~[5a — selection preservation](5a-selection.md)~~ — complete; B4 passes
     8/8 live with cleanup (E23)
   - ~~[5b — note fidelity and gain](5b-fidelity.md)~~ — complete; 20 exact
     properties, measured gain inverse, and pressure refusal (E24)
   - ~~[5c — observer drag boundaries](5c-drag-boundaries.md)~~ — complete;
     cross-track identity pair and below-window limit measured (E25)
   - [5d — concurrent editing](5d-concurrent-editing.md) — attempted three
     times; E30 stopped setup on an owned cleanup fingerprint mismatch
   - ~~[5d repair — concurrent selection](5d-repair-concurrent-selection.md)~~ —
     complete; eager capture, verified cursor reuse, and pan diagnosis (E27)
   - ~~[5d repair — cursor confirmation](5d-repair-cursor-confirmation.md)~~ —
     complete; pin-aware bounded confirmation and early cleanup pass (E29)
   - [5d repair — owned cleanup
     fingerprint](5d-repair-owned-cleanup-fingerprint.md) — preserve safe
     cleanup across host-normalized readback (E30)
   - [5e — refusal boundaries](5e-refusal-boundaries.md) — exit criteria 3 and 5
   - [5f — managed A/B](5f-managed-ab.md) — exit criterion 4
   - [5g — full live conformance](5g-live-conformance.md) — B7 only
   - [5h — CI and regression policy](5h-ci.md) — exit criterion 6
   - [5i — Phase 1 closeout](5i-closeout.md) — decision and phase closure
6. [6 — async completion](6-async.md), optional

Completed session records stay in their session briefs and under
`archive/outcomes/`. [NOW](../../NOW.md) contains only the next-session handoff.
The original combined Phase 1 plan, including re-plan and renumbering history,
remains in `archive/plans/PHASE-1-ENGINE.md`.

## Phase exit

- All supported writes travel through executor → stash recording.
- Track copy works as ordinary CRUD; layer-chain and clip-block takes work through
  the production surface without runtime operator assistance.
- The layer-chain lifecycle includes both winner collapse and selective reduction
  while several alternates survive; both are Phase 1 requirements.
- Reversal and destructive boundaries match D18–D20.
- A human can compare two takes from Bitwig without a ghostnote-specific A/B UI.
- Live conformance covers the address, write, branch, and control paths.
