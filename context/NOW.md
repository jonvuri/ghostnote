---
title: Current state
kind: status
state: active
updated: 2026-08-15
phase: phase-1
session: phase-1-session-3f-i
---

# Now

Phase 1 is **ready to resume at session 3f-i**. Session 3f-h selective
reduction is complete and verified live.

## Baseline

- `copy_track`, nested chain addressing, autonomous Instrument/FX container
  creation, ordered fill, exact exclusive switching, winner collapse and
  selective reduction are production-reachable.
- Container reads and writes use cursor-free `Rig.slotLayerBanks`. Only the first
  two top-level device positions have container scopes; a rebuild that cannot
  hold both old and replacement containers inside them refuses before insertion.
- Chains are addressed by container position plus durable name. Their
  `channelId` is only a within-turn creation witness.
- Only `chain.relocate` may route nested devices. Every other nested-device write
  remains behind `assertDevicesRoutable`.
- Device alternates carry devices and device state, not clips, sends, routing or
  track-mixer state. Cross-device modulation remains unmeasured and unclaimed.
- The wire golden remains 147 methods / `7f212c48cd3dab75`; 3f-h added no
  extension method.

## Session 3f-h — complete 2026-08-15, verified live

`remove_device_alternate` is a separately permissioned destructive tool. It
removes one explicitly named alternate only when at least two named survivors
remain.

Before writing, it requires the complete top-level order, a complete unique
sibling set, every survivor's complete ordered devices, and exact
name/mute/solo/volume/pan/colour state. It also proves one temporary top-level
bank position and an allocated container scope are available. The replacement
container role is supplied by the caller and reported as **not independently
observed**, because the current device observer exposes no instrument/effect
role.

The replacement is created at the track tail while the original still exists.
Survivor names are created in captured order, devices are moved survivor by
survivor and re-read on both sides, and zero-or-one prior solo state is restored
through `chain.activate`. Every final state field is compared with its captured
value; any difference is reported rather than claimed restored. The original
container is deleted only after the complete replacement structure and state are
readable. Final success requires both the complete top-level device order and the
reduced container contents at the original signal position. Every answer after
the first write reports partial work honestly; an unreadable deletion is neither
reported removed nor not removed.

One pre-existing creation defect surfaced in the three-entry fixture:
`create_device_alternates` copied every new entry from the first one, so
beside-source placement reversed entries three and four while the tool promised
caller order. Each entry now copies its immediate predecessor, preserving order
for both beside-source and tail placement, with final independent readback still
the authority.

Verification at this boundary:

- brain typecheck and **456/456** offline tests pass, including full multi-device
  selective rebuild, unknown-state preflight, temporary-scope preflight,
  unconfirmed-removal reporting and the shared conformance row;
- extension Gradle test passes and `git diff --check` is clean;
- live conformance passes **52/0/6**, including `C-chain-reduce` against Bitwig;
- production MCP smoke passes **18/18, P0-P17**, exercising create, fill, switch,
  selective reduction, state comparison, winner collapse and exact cleanup;
- production cleanup removed both minted track ids, then conformance cleanup
  removed `gn-conf-A` and `gn-conf-B`. The project is back to its documented
  10-track baseline with Master visible and no probe residue.

## Session 3f-i — lifecycle closeout and 3g handoff

Purpose: close the complete device-alternate lifecycle as one mechanically
accurate production cohort and prepare the observation/version handoff to 3g.

Acceptance:

1. Re-review every device-alternate tool name, description, input and result as
   one lifecycle: inspect, create, fill, switch, collapse and selective reduction.
2. Resolve the live `add_track` mismatch exposed by the 3f-h production fixture:
   the tool accepts requested names, but `track.create` does not encode them and
   the fresh track read back as `Inst 11`. Fix the contract or the surface claim;
   do not carry “create by name” into the freeze unchanged.
3. Exercise the complete production lifecycle with no residue and keep all
   destructive permission names narrow.
4. Give 3g stable tool/event identities and the exact mechanical description
   cohort it will observe and version. 3g owns the cohort-wide wording review and
   v1 freeze.
5. Pass brain checks, extension build, live conformance, production smoke,
   context and diff checks, and leave the project at its documented baseline.

Session 3g does not start until this closeout is complete.
