---
title: Session and mixing inputs
kind: note
state: active
updated: 2026-10-24
---

# Session and mixing inputs

User outcomes include preparing tracks, controlling playback, balancing a
mix, setting returns, and marking song sections. These are separate dimensions.

## Current boundary

The [normal surface](current-surface.md) lists tracks by durable ID, including
children of collapsed groups. It creates Instrument and Audio tracks,
duplicates, renames, and deletes tracks. It adds and deletes scenes. It reads
and sets track volume, pan, mute, and solo on at most eight tracks per call.
The mixer excludes Master and refuses automated volume or pan writes.

Sources: [v53 descriptions](../../../evidence/data/phase9b-doctor/9b7-tool/descriptions-v53.json),
[E257](../../../evidence/experiments/e257-track-mixer.md), and
[E330](../../../evidence/experiments/e330-update-audit-614-acceptance.md).
The volume law is `dB = 60 * log10(raw)`; do not reuse it for a send without
proof. Solo is nonexclusive. A track creation position is not controllable by
the current tool. New track and scene changes do not have automatic deletion
through `revert_change`.

`launch_clip` exists. A normal transport stop tool does not. The operator
stops playback after a launch. A probe or internal handle is not public
transport coverage. Scene deletion shifts later row addresses. Bank coverage
must remain explicit; see [bank evidence](../../../evidence/capability/banks.md).

## Work records

| ID | Capability | Status | Qualifier | Cells | Source route | Required proof or decision |
|---|---|---|---|---|---|---|
| SM-1 | Extend track state: arm, active state, colour | Candidate | — | `track.state` read, `track.state` write | Gig Maestro TrackHandler setArm and setColor; existing mixer and track contracts | Decide exposed fields. Prove each domain, automation behavior, selection effects, and guarded inverse. Name and four mixer fields already exist. |
| SM-2 | Send discovery, level, enabled state, and pre/post mode | Candidate | — | `track.sends` read, `track.sends` write | Gig Maestro SendHandler (send/setLevel, send/setMode AUTO/PRE/POST, send/setEnabled); DrivenByMoss LayerImpl | Bind source send to destination identity. Test reordered sends, duplicate destination names, unavailable targets, automation, and independent readback. Measure units and observer cost. |
| SM-3 | Master mixer | Candidate | — | `master.mixer` read, `master.mixer` write | Gig Maestro MasterHandler; current track mixer refusal | Decide a separate target contract. Prove Master identity under bank overflow and distinguish master fader control from audio capture. |
| SM-4 | Transport: tempo, meter, position, play/stop, loop, metronome, recording | Candidate | — | `transport` read, `transport` write | Gig Maestro TransportHandler; existing extension handles | Inventory each verb separately. Separate transport effects from reversible scalar changes. Define stop and cleanup authority, concurrent playback changes, and readback. Meter needs its own source and host check. |
| SM-5 | Cue markers: list, add, rename, position, colour | Candidate | — | `cue-markers` read, `cue-markers` create, `cue-markers` write, `cue-markers` delete | Control Deck handleCueMarkers (restores transport position); Gig Maestro ArrangerHandler | Duplicate names and equal positions must stay distinguishable. Test sorting, capacity, concurrent edits, and transport restoration. Treat deletion as a separate directed operation. |
| SM-6 | Scene names, colours, duplication, and launch controls | Candidate | — | `scene.properties` read, `scene.properties` write, `scene.properties` move-or-copy | Gig Maestro SceneHandler; existing scene handlers | Preserve row identity rules and clip references through insertion and deletion. Full scene content and automation fidelity need separate evidence. |
| SM-7 | Effect, Group, and Hybrid creation, grouping, and routing | Unresolved | the add_tracks description overstates: E239 names createEffectTrack as not measured, not absent; group creation has typed-proxy and named-action evidence only | `track.group-effect` create, `track.group-effect` write | Gig Maestro track/createEffect (Application.createEffectTrack) and track/createGroup (Track.createParentTrack); Ghostnote E239 (effect route named, not measured), E16j (named action Create Group Track makes a group; D13 forbids named actions), E221 and the research handler branch.createParentTrack (parent handles return proxies; no route proof); existing add_tracks limits | Measure Application.createEffectTrack on the current build first; if it makes an Effect track, correct the add_tracks description in that session. For groups, settle by readback whether createParentTrack creates a group or returns a proxy; the research handler exists. Do not use the named action as an identity-safe fallback (D13). Listing children does not prove membership edits. |
| SM-8 | Global groove controls | Candidate | — | `groove` read, `groove` write | Gig Maestro GrooveHandler | Separate global shuffle and accent controls from editing note timing. Prove units, scope, enabled state, playback effect, and restoration. |
| SM-9 | Launcher clip and track stop | Candidate | distinct from transport stop (SM-4) | `launcher.stop` write | Gig Maestro clip/stop; openwig track.stop and slot.stop | Define the stop target (slot, track, or all) and its readback (stopped or still queued). No change record applies, as for launch_clip. Check interaction with a person's concurrent launch. |
| SM-10 | Track input and output routing | Unresolved | note-source input only in the pinned clones; no audio routing handler found | `track.routing` read, `track.routing` write | Gig Maestro track/addNoteSource and track/removeNoteSource; the Bitwig API source and destination selectors are not inspected here | Survey the API routing objects on the current build first. Decide whether routing belongs to the product at all. Prove identity of routing targets by name collision tests before any write. |
| SM-11 | Project save | Candidate | action-based route only | `project.save` write | openwig project.save through the GUI action Save; Ghostnote action evidence records focus hazards | A named action is not an identity-safe route: prove that the saved file changed (hash before and after) and that focus did not redirect the action. Decide whether the operator keeps save authority, as current live-work rules assume. |

Status, qualifier, and cell values come from [`data/records.json`](data/records.json); `data/check_records.py` verifies that this table agrees with it. IDs are navigation keys, not priorities. External implementations on these rows, with pinned paths, predicates, and counterexamples, are in the [external register](external-register.md#session-and-mixing).

## Direct source locations

- Gig Maestro [SendHandler](../../../../reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/SendHandler.java)
  dispatches `send/setLevel`, `send/setMode` (`AUTO`, `PRE`, `POST`), and
  `send/setEnabled`. Its result acknowledges a setter; it does not supply
  Ghostnote's independent verification.
- Gig Maestro [TrackHandler](../../../../reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TrackHandler.java),
  [MasterHandler](../../../../reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/MasterHandler.java),
  [TransportHandler](../../../../reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TransportHandler.java),
  [SceneHandler](../../../../reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/SceneHandler.java),
  [ArrangerHandler](../../../../reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ArrangerHandler.java),
  and [GrooveHandler](../../../../reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/GrooveHandler.java)
  are operation leads, not complete product contracts.
- Control Deck [controller](../../../../reference/bitwig-control-deck/controller/ControlDeck.control.js):
  `handleCueMarkers` and its dispatch. It restores transport position after
  marker creation. Verify that preservation in the adopted path.
- DrivenByMoss [LayerImpl](../../../../reference/DrivenByMoss/src/main/java/de/mossgrabers/bitwig/framework/daw/data/LayerImpl.java)
  gives controller abstractions. [Sources](sources.md) records all pins and terms.
- [Action evidence](../../../evidence/capability/actions.md) records focus
  hazards. A named action is not a general safe implementation route.
- Gig Maestro [ClipHandler](../../../../reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java)
  registers `clip/stop`; openwig's bridge has `track.stop` and `slot.stop`
  (SM-9). These stop a clip or track, not the transport.
- Gig Maestro TrackHandler registers `track/createEffect`
  (`Application.createEffectTrack`) and `track/createGroup`
  (`Track.createParentTrack`). The v53 `add_tracks` description says Bitwig has
  no route for Hybrid, Group, or Effect tracks. Ghostnote's own records are
  narrower: E239 names the effect route as not measured, E16j shows that the
  named action `Create Group Track` makes a group (D13 forbids named actions),
  and E221 with the research handler `branch.createParentTrack` found parent
  handles that return proxies. SM-7 measures the typed routes before either
  statement is used.
- Gig Maestro TrackHandler registers `track/addNoteSource` and
  `track/removeNoteSource`. No audio input or output routing handler was found
  in the pinned clones (SM-10).
- openwig's bridge saves the project through the GUI action `Save`
  (`project.save`). Its own comment says a renamed action silently does
  nothing (SM-11).

## Planning inputs

[Phase 10](../../phase-10/README.md) already lists most of this breadth, but
some of its rows now mix completed and missing work. Reconcile by verb.
Sends and cue markers can be bounded public-API projects. That is a relative
scope assessment, not a measured schedule or a claim that they are most useful.

For the later vision review, distinguish mixing an existing project from
building a session and from operating a live performance. Those uses can
give different priorities to the same controls.
