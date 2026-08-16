---
title: Current state
kind: status
state: active
updated: 2026-08-15
phase: phase-1
session: phase-1-session-3g-a
---

# Now

Phase 1 is **ready to begin session 3g-a**. The complete 3f device-alternate
lifecycle is closed and verified live. Session 3g is split into five focused
briefs.

## Baseline

- `copy_track` remains ordinary track CRUD. Device alternates and clip blocks are
  independent managed representations.
- The device lifecycle is production-reachable through stable inspect, create,
  fill, switch, selective-reduction and winner-collapse tool identities.
- Device alternates carry devices and device state, not clips, sends, routing or
  track-mixer state. Cross-device modulation remains unmeasured and unclaimed.
- Container reads and writes use cursor-free `Rig.slotLayerBanks`; only the first
  two top-level device positions have observable container scopes.
- Chains are addressed by container position plus durable name. Their
  `channelId` is only a within-turn creation witness.
- Only `chain.relocate` may route nested devices. Every other nested-device write
  remains behind `assertDevicesRoutable`.
- The wire golden remains 147 methods / `7f212c48cd3dab75`.

## Session 3f-i — complete 2026-08-15, verified live

The six-tool device-alternate cohort was reviewed as one lifecycle. Its public
names, privilege classes, input identities and emitted contract operations are
now guarded together for the 3g handoff; 3g still owns the cohort-wide wording
review and v1 description freeze. A successful `create_device_alternates` call
is one device-alternate event. Inspection, filling, switching and both reduction
operations act on that existing event and do not create another one.

`add_track` now implements its claimed exact-name behavior. It creates the
tracks, reads back each fresh durable id, applies a separate typed rename through
that id, and independently confirms every requested name. Its production result
distinguishes creation confirmation from name confirmation. The lifecycle smoke
proved the requested source name in Bitwig rather than accepting the create
acknowledgement.

Verification at this boundary:

- brain typecheck and **457/457** offline tests pass;
- extension Gradle test, context check and `git diff --check` pass;
- live conformance passes **52/0/6**;
- production MCP smoke passes **18/18, P0-P17** across create, fill, switch,
  selective reduction, state comparison, winner collapse and exact cleanup;
- production cleanup removed both minted track ids, then conformance cleanup
  removed `gn-conf-A` and `gn-conf-B`. The project is at its documented 10-track
  baseline with Master visible and no probe residue.

## Session 3g-a — next

Define the observation contract and capture protocol in
[3g-a-observation-contract.md](plan/phase-1/3g-a-observation-contract.md).
Separate instruction observations, successful managed events, and ordinary
track-copy use before storage or production instrumentation changes. Preserve
the 3f-i mechanical identities and event boundary.

The parent [3g program](plan/phase-1/3g-record.md) then runs per-project
persistence, the v1 description freeze, production instrumentation, and live
reporting as independent sessions.

## Planning retrospective

Define record entry types before storage and instrumentation plans. This prevents
successful events, vetoes, and ordinary operations from sharing one ambiguous
row model.
