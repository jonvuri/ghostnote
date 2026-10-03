---
title: Phase 8g5b — Slot inventory delivery
kind: plan
state: active
status: Pending. Run after 8g5a. Live slot inventory must be cached, not refused.
updated: 2026-10-03
parent: 8g-shadow-project-cache.md
prev: 8g5a-group-topology-support.md
next: 8g5c-combined-storage-limit.md
---

# Phase 8g5b — Slot inventory delivery

## Why

Live slot inventory refuses because it is outside step coverage. D26 and D27
cover only step content in watched clips. A question such as "which slots hold
clips" therefore always reads the host. The API does push slot content:
`ClipLauncherSlotBank.addHasContentObserver` and `slot.hasContent()` exist, and
[E16s](../../evidence/experiments/e16s-a-clip-move-is-detectable-pushed-and-is-ours-to-perform-k-2026-0.md)
measured create, delete, API move, and human drag as pushed events.
No 8g session measured these observers as a continuity rule.

## Entry and scope

Read E16s, E216, D26, D27, the inventory coordinator, and the
[continuity protocol](../../evidence/format/PHASE8G_PROJECT_CONTINUITY.md).
Use the child-bank route proved in [E221](../../evidence/experiments/e221-group-topology-candidates.md).
Its limit is 16 flat tracks. Parent handles remain diagnostic. Collapsed child
clip rebinding refuses, although membership passes. Read occupancy independently
of that clip-binding limit. New 3 is the protected baseline; keep its empty
clip and dirty marker. Never save or close it. Do not enter 8h.

## Known risk

E216 found that value observers coalesce: 21 of 35 project detours delivered
equal identity values and no change. A `hasContent` value can also coalesce.
For occupancy, an equal final value is still correct. For clip identity, it is
not: a delete and recreate at one slot can look like one unchanged clip. Keep
occupancy claims separate from identity claims.

## Work and independent oracles

1. Subscribe `hasContent` for the full declared slot space of the selected
   topology. Record the observer and handle cost.
2. Repeat the E216 detour method for slot values. Measure whether every
   delivered occupancy change in a detour gives a callback. Measure coalescing
   separately for occupancy and for identity.
3. Define a slot-delta window like the 8g2b step-delta window. A window
   confirms in a later callback under D27. Any slot or structure callback in
   the window refuses.
4. Native controls: create, delete, duplicate, move, and drag clips; insert and
   delete scenes; switch projects. Compare each published inventory with an
   independent full slot scan after settlement.
5. If the measurements support it, ask the user to accept a D28 named
   assumption for slot delivery. Do not assume acceptance.

## Acceptance criteria

- Published occupancy equals the independent scan in every trial, with zero
  foreign slots after detours.
- Clip identity across delete and recreate is refused or minted new; it is
  never inferred from equal occupancy.
- Slots in grouped tracks are covered through the 8g5a topology.
- Cleanup, normal reload, and all checks pass as in 8g5a.

## Stopping rule

If a measured occupancy change arrives with no callback, keep the refusal and
record the case. Do not use a periodic poll as a hidden substitute for delivery.
