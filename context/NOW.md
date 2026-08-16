---
title: Current state
kind: status
state: active
updated: 2026-08-15
phase: phase-1
session: phase-1-session-3g-d
---

# Now

Phase 1 is **ready to begin session 3g-d**. Sessions 3g-a through 3g-c defined
the record, verified per-project persistence, and froze the public cohort.

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
- The wire golden is 149 methods / `bd01617c718f5c50`.

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

## Session 3g-b — complete 2026-08-15, verified live

The extension now creates one hidden 262144-character observation setting during
`init()`. Dedicated product methods read and replace its opaque string. Generic
UI setting methods remain probe-only. The brain owns canonical JSON and schema
validation through a separate `Session.observations` store. It polls bounded
exact readback and reports absence, downcast refusal, overflow, stale readback,
and detected project-name changes separately. Bitwig API 25 exposes no stable
project id, so same-name tab switches remain indistinguishable. `DocumentState`
still scopes the value per project. The retired E20d capacity probe now refuses
before it can replace production observation data.

Brain typecheck and **478/478** offline tests pass, including **18/18** focused
observation tests. Extension Gradle test, context check, and `git diff --check`
pass. Live, exact empty, populated, and Unicode values round-tripped; overflow
did not replace the prior value. A marker survived save, controller reload,
project switching, and full application restart. Another project did not reuse
it. Cleanup removed the marker and the two reloaded `gn-conf-*` fixtures. The
project is again at its 10-track baseline with Master visible. The operator
confirmed that the observation row is absent from the settings pane.

The review fix makes the E20d capacity probe refuse before record access and
names the lossy foreground-project guard accurately. API 25 source confirms
that it exposes no stable project id. The reloaded build passed the live hello
and preserving persistence smoke. Empty, populated, Unicode, bounded readback,
and overflow refusal passed, and the original record was restored exactly.

## Session 3g-c — complete 2026-08-15

The explicit manifest contains the six device-alternate tools, six clip-block
tools, ordinary `copy_track`, and two support tools. `add_scenes` supplies missing
clip rows. `delete_track` supplies directed track-copy cleanup. The canonical
public artifact includes each name, title, description, draft-7 input schema,
and derived privilege annotations. `ghostnote-description-v1` maps to SHA-256
`9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.

The wording now states the two-position device-container observation limit,
audible device seams, and clip-launch playback reversal limit. `copy_track`
remains ordinary editing. All lexical bans remain in force. The 3f-i identities,
privilege classes, input identities, and emitted operations are unchanged.

Brain typecheck and **480/480** offline tests pass. Context check and
`git diff --check` pass. No live project mutation was required.

## Session 3g-d — next

Instrument the shared production execution path. Record confirmed device and
clip creations as independent managed events, and record confirmed `copy_track`
use as ordinary use. Stamp every entry with the frozen v1 identifier.

## Planning retrospective

Build a description fingerprint from the same draft-7 input conversion that the
MCP server sends. A different schema draft can make a false golden.
