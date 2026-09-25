---
title: Cache identity and lifecycle rules
kind: reference
state: active
updated: 2026-09-25
parent: ../../plan/phase-8/8d-cache-identity-and-lifecycle.md
evidence: E2f, E16l, E16s, E19, E131-E134, E138; D23
---

# Cache identity and lifecycle rules

## Scope

These rules are the Phase 8d input to the internal cache contract. They do not
define a product cache or a public compact-bar syntax.

Only a complete normalized state is publishable. A caller must use the E131
reader or refuse when cache health or coverage is incomplete.

## Identity domains

| Value | Meaning | Stability |
|---|---|---|
| Project generation | One local cache identity domain | Changes on project switch, switch back, reopen, or controller reload |
| Logical clip ID | One opaque session-local clip reference | Follows only a proved continuous clip or one unambiguous move |
| Current address | Durable track `channelId` plus current scene row | Track ID is durable in one loaded project; row changes after scene edits |
| Slot identity | Project generation, structural epoch, track ID, and row | Changes when the structure that gives the slot its meaning changes |
| Content generation | Monotonic revision of one logical clip | Changes when normalized content changes |
| Content fingerprint | Equality and conflict witness for normalized content | Never identifies a clip by itself |
| Observer binding generation | One observer-to-address binding | Changes on every rebind or structural repair |

Two clips can have the same fingerprint. A slot can receive a different clip.
A logical clip can move to a different slot. These values are not substitutes
for each other.

## Registry state machine

The registry uses these health states:

| State | Meaning | Read policy |
|---|---|---|
| Invalid | The identity domain or published base is no longer valid | Refuse or use exact fallback |
| Rebuilding | A complete inventory is in private staging | Keep the prior generation private; do not publish staging |
| Warming | Observer replay has not passed a populated-canary settlement check | Refuse or use exact fallback |
| Complete | Coverage and normalized state are complete for the declared range | Publish an immutable snapshot |
| Dirty | One or more coordinates need an authority read | Do not publish those coordinates as current |
| Repairing | Known structural changes are being applied and observers are rebinding | Refuse affected coverage until complete |
| Ambiguous | More than one identity outcome fits the evidence | Refuse identity reuse; rebuild or mint new IDs |

An empty inventory is a complete result only after full enumeration. It must
not be confused with an invalid or not-yet-replayed registry.

A rebuild is atomic. It starts with a project generation, structural epoch,
and rebuild generation token. It publishes only if all three still match. An
abort invalidates the staging result. A retry starts with a new rebuild
generation.

Each observer callback carries the project generation, structural epoch,
binding generation, and rebuild generation that created its binding. Reject
the callback when any field differs from current state. A callback is a
channel-free coordinate invalidation. The authority read reconciles all 16
MIDI channels.

## Identity transition rules

| Event | Logical identity result | Required action |
|---|---|---|
| Note add, remove, move, or field edit | Retain | Increment content generation after a fresh normalized read |
| Clip clear or refill | Retain | Read the complete normalized clip again |
| Clip create | Mint | Bind and warm a new entry |
| Clip duplicate | Mint | Never reuse the source ID, even when content is equal |
| Clip delete | Retire | Remove the address and reject pending work |
| Clip replacement at one slot | Retire old, mint new | Do not preserve the old destination ID |
| Exact clip move | Retain | Require one ordered empty-to-fill pair, a known-empty destination, a complete event window, and an authority fingerprint match |
| Incomplete or many-candidate move | Do not guess | Mark ambiguous, mint after rebuild, or refuse |
| Scene insert or delete at a known row | Retain unaffected clips | Repair rows, increment the structural epoch, and rebind |
| Scene delete at a clip | Retire that clip | Repair later rows and rebind |
| Track index change | Retain by `channelId` | Re-resolve the current index and rebind |
| Track duplicate | Mint track and clip identities | Treat copied content as equality only |
| Track delete | Retire clips on that `channelId` | Reject their pending work |
| Group or flat-inventory topology change | Mint by default | Complete rebuild |
| Save | Retain | No cache invalidation when the loaded project and extension generations stay unchanged |
| Project switch, switch back, or reopen | Invalidate all | Start a new project generation and complete rebuild |
| Controller reload | Invalidate all | Detect a new extension generation and complete rebuild |

Same-address identity can survive an internal rebuild only when a complete
event window proves continuous occupancy in the same project generation.
Without that proof, a rebuild mints a new logical ID.

## Repair and rebuild boundary

Incremental repair is sufficient for:

- exact note-coordinate invalidations followed by authority reads;
- exact launcher empty or fill events with a complete event window;
- a scene insertion or deletion with one known row; and
- a track index change that resolves through the same `channelId`.

A complete rebuild is required for:

- project switch, switch back, reopen, or controller reload;
- an event gap, truncated event window, or unattributable structural event;
- group visibility or flat-track topology change;
- unknown structural order;
- identical-candidate ambiguity;
- observer binding or canary failure;
- interrupted rebuild; or
- authority mismatch after repair.

Scene compaction needs special care. A held clip proxy can keep the correct
content while its `sceneIndex` stays at the old row. The structural event, not
the proxy index, is the address authority. Increment the structural epoch,
repair stored rows, resolve the track by `channelId`, and bind a new proxy at
the repaired row.

## Facts that the Controller API cannot prove

The measured API cannot prove:

- a durable Launcher-clip identity;
- identity from content equality when several clips are equal;
- that a same-name project is the prior project instance;
- save completion as a new identity boundary;
- close and reopen continuity;
- exact observer replay completion without a populated canary and quiet
  settlement rule;
- UI primary focus or the result of a focus-sensitive command; or
- a safe track reorder route. The typed `moveTracks` route is a measured no-op,
  and the named-action list has no track-reorder command.

Use explicit application lifecycle signals for project foreground changes.
Use a new project generation when continuity cannot be proved.

## Inputs for Phase 8f

The compact-bar clip reference needs:

- an opaque session-local logical clip ID;
- the project generation;
- the last confirmed track ID and scene row;
- the structural epoch;
- the normalized content generation and fingerprint;
- a declared cache health and coverage state; and
- a fresh-base rule for patches.

A patch base is valid only in the same project generation and against the
expected content fingerprint. Ambiguous or incomplete state must refuse. Note
identity remains the D23 tuple of MIDI channel, pitch, and `1/512` cell within
the declared normalized view.
