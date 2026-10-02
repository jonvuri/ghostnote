---
title: E138 — Cache identity and lifecycle rules pass live recovery
kind: evidence
state: active
updated: 2026-09-25
parent: ../../plan/phase-8/8d-cache-identity-and-lifecycle.md
---

# E138 — Cache identity and lifecycle rules pass live recovery

## Verdict

A session-local logical clip ID can follow ordinary content edits and one
unambiguous move. It cannot safely follow a duplicate, replacement, ambiguous
equal-content match, project change, reopen, or controller reload.

Scene compaction explains the E134 stale-address result. A held clip proxy kept
the correct content but reported scene row 12 after the clip moved to row 11.
The repair used the structural event, durable track `channelId`, repaired row,
and a new observer binding. It did not trust the stale proxy index.

The probe-only lifecycle model and live probes implement the
[cache identity and lifecycle rules](../format/CACHE_IDENTITY_AND_LIFECYCLE.md).
No product cache was added.

## Method

The live run used exact runtime profile `phase-8-probe-v1`, 95 methods, and
method hash `226dd8c1467c7c3b`. The stable comparison runtime remains
`normal-v1`, 85 methods, and hash `bba7383dce25c0f0`.

Each populated live arm used this order:

1. Replay through a populated canary.
2. Settle the target observer.
3. Normalize all 16 MIDI channels on the D23 `1/512` plane.
4. Compare the probe cache with a new settled `1/512` authority cursor.
5. Run the E131 acquisition separately and record its diagnostic result.

For a deleted or empty slot, the cache and fresh authority state were both
empty. E131 was recorded as unavailable because its acquisition contract needs
an existing clip.

## Lifecycle matrix

| Case | Result | Evidence |
|---|---|---|
| Note add, remove, move, field edit | Retain logical ID and advance content generation | Live cache, fresh `1/512`, and E131 matched |
| Clip create, clear, refill | Create minted; clear and refill retained | Live cache, fresh `1/512`, and populated E131 matched |
| Clip duplicate | Mint a new ID | Equal source and copy content did not grant identity |
| Identical clips | Ambiguous without address events | Model entered `ambiguous`; it did not select by order |
| Clip move | Retain on one ordered empty-to-fill pair | Live address events and authority fingerprint agreed |
| Clip delete | Retire | Observer and fresh authority became empty; E131 was unavailable |
| Clip replace | Retire the destination ID and mint | Live replacement content matched both authorities |
| Scene create after clip | Repair without moving the clip | Live cache and both authorities matched |
| Scene delete after clip | Repair without moving the clip | Live cache and both authorities matched |
| Scene delete before clip | Shift row, reject old callback, and rebind | Stale proxy index was reproduced; repaired state matched |
| Scene delete at clip | Retire | Empty launcher event, cache, and fresh authority agreed |
| Track create | Re-resolve by source `channelId` | Live cache and both authorities matched |
| Track duplicate | Mint a new `channelId` and clip IDs | Copied content matched; identity stayed distinct |
| Track move | Retain by `channelId`; invalidate bindings | Model test passed; no new live reorder claim was made |
| Group topology change | Complete rebuild | Rebuilt live state matched both authorities |
| Track delete | Retire all clips on the deleted `channelId` | Live identity disappeared |
| User clip create | Mint | Bitwig UI emitted one filled address; empty clip matched cache, fresh authority, and E131 |
| Save | Retain | Extension generation and normalized state stayed unchanged |
| Switch away | Invalidate | Old track ID and target address were absent |
| Switch back | New project generation and rebuild | Rebuilt cache, fresh authority, and E131 matched |
| Close and reopen | New project generation and rebuild | Rebuilt cache, fresh authority, and E131 matched |
| Controller reload | New extension and project generations | Rebuilt cache, fresh authority, and E131 matched |
| Late callback | Reject | A changed epoch or generation invalidated its token |
| Interrupted rebuild | Reject staging, then retry | Partial state did not publish; complete retry matched |

Bitwig exposes no track-reorder named action. Its typed `moveTracks` route is a
prior measured no-op. E138 therefore verifies the track-index rule in the
probe-only state model and uses live track create, duplicate, group, and delete
changes for address re-resolution. It does not overstate a new live track-move
result.

The UI-assisted run also tested project lifecycle because the Controller API
cannot close, reopen, or foreground an arbitrary project safely. The user
reloaded the controller when requested. The probe then observed the extension
generation change from `0ed7...` to `e159...` and rebuilt in local project
generation 5.

The probe received each lifecycle event as a command argument. It then advanced
its local project generation. These runs prove recovery after a declared event.
They do not prove automatic project-switch or reopen detection. The switch-away
arm also checked the changed project name and absence of the old track UUID.
It did not test two projects with the same name. The controller-reload arm did
observe a new extension generation.

## Costs

The measured scene-row repair, track re-resolution, observer rebind, and
settlement took 1,155.078 ms. The measured group-topology inventory, identity
rebuild, observer rebind, and settlement took 4,388.368 ms.

These values compare two real recovery paths in the small fixture. They are not
product budgets. Phase 8e owns scale, tail latency, and degradation limits.

## Recovery conclusions

Save alone is not an identity event. Project switch, switch back, reopen, and
controller reload are identity events because the Controller API cannot prove
clip continuity across them. A new project generation invalidates host handles,
logical clip IDs, dirty work, observer bindings, rebuild staging, and agent
patch bases.

Incremental repair is safe only when the structural row or address event is
complete and exact. Event gaps, topology changes, ambiguity, binding failures,
interrupted work, and authority mismatches require a complete rebuild.

Fingerprint equality is only a change and conflict witness. It never chooses
between identical clips. Replacement always retires the old destination
identity. A complete rebuild mints identities unless a complete event window
proves same-address continuity in the same project generation.

## Verification and cleanup

The focused lifecycle and wire-map tests passed 61 tests. The complete brain
check passed 1,195 tests. Extension tests and the probe archive build passed.
The context check passed 370 active documents with intact links. The
autonomous matrix and every UI-assisted project-lifecycle command passed on the
exact probe archive.

The autonomous run restored the exact four track IDs, eight scenes, and zero
occupied launcher slots. The UI-assisted run restored the same project
baseline. Its temporary state file and saved project package were removed. The
original scratch project is active. The stable extension was restored. Its
live handshake reports `normal-v1`, 85 methods, and hash
`bba7383dce25c0f0`.

## Retrospective

The lifecycle model made an unsupported track-reorder route visible before it
could become a cache assumption. Future lifecycle plans must classify each arm
as live, model-only, or unavailable before the run.
