---
title: Current state
kind: status
state: active
updated: 2026-08-15
phase: phase-1
session: phase-1-session-3g-b
---

# Now

Phase 1 is **ready to begin session 3g-b**. Session 3g-a defined and verified the
observation record before any storage or production instrumentation change.

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

## Session 3g-a — complete 2026-08-15

The strict schema-v1 envelope separates instruction observations, managed events,
and ordinary track-copy uses. Stable entry and execution ids prevent one tool
execution from producing two result rows. Correlation records provenance only;
mixed device and clip events keep independent identities and lifecycles.

The canonical codec rejects malformed data, unknown schema versions, broken
references, duplicate identities, and complete values over capacity. It never
truncates or evicts. The capture protocol keeps operator response `silent` until
explicit input supplies `accepted` or `vetoed`. A confirmed project write followed
by a failed record update reports both facts as a partial success.

Brain typecheck and **467/467** offline tests pass, including **10/10** focused
observation tests. Context check and `git diff --check` pass. No live Bitwig run
was required.

## Session 3g-b — next

Implement the per-project persistence transport in
[3g-b-persistence.md](plan/phase-1/3g-b-persistence.md). Keep the extension value
opaque. The brain owns schema validation and canonical JSON.

The parent [3g program](plan/phase-1/3g-record.md) then runs the v1 description
freeze, production instrumentation, and live reporting as independent sessions.

## Planning retrospective

No instruction change is needed. Reading the later 3g briefs with 3g-a made the
identity and failure seams clear before code was written.
