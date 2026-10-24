---
title: External implementation register
kind: note
state: active
updated: 2026-10-24
---

# External implementation register

## Purpose

This register records what the pinned external projects implement, on the
same capability rows that the Ghostnote cells use. One row key therefore
holds a Ghostnote column and one column per project. The final report and
its visual artifact read this register and [`data/records.json`](data/records.json);
they do not need the wave-1 audit. Each external cell records the pinned
dispatch path, the success predicate that the code uses, one limiting
counterexample, and an evidence note that names the audit row or the
re-verification that produced it.

## Scope and freshness

The 12 local clones under `reference/` were re-read offline on 2026-10-24.
Each clone HEAD matches the pin in [sources](sources.md). Superpowers has no
clone; its one cell is a release claim. No web survey ran, so later upstream
versions are not represented. Every cited path was opened at the pinned
commit and the line number names the handler or function found there. Where
the wave-1 audit cited a file entry point, the register cites the handler
line instead. Cells marked "added during re-verification" were found in the
pinned source while confirming audit paths; they were not in the wave-1 audit.

Counts: 129 external cells on 59 rows across 13 projects.

| Project | Cells |
|---|---|
| `bitwig-control-deck` | 25 |
| `bwpreset` | 18 |
| `openwig` | 15 |
| `bitwig-extensions` | 28 |
| `WigAI` | 9 |
| `daw-mcp` | 4 |
| `bitwig_agent` | 12 |
| `acidcat` | 8 |
| `DrivenByMoss` | 3 |
| `BitX` | 3 |
| `bitwig-nitro-tools` | 2 |
| `bitwig-device-hacks` | 1 |
| `superpowers` | 1 |

## Evidence rules

- External cells carry a proof level only: Live, Checked offline, Source,
  Claim, or Not found. They carry no Ghostnote status, because the six
  statuses describe Ghostnote's commitment, not another project's.
- Source means the handler exists in the pinned clone and was read; it was
  not run here. Checked offline means the audit or review ran a local check
  against the clone. Claim means a README or release statement only.
- An upstream project's own live results, such as the bwpreset verification
  ledger on 6.1.3, are recorded in the evidence note and not as a Live level.
  Live is reserved for Ghostnote experiment records.
- Not found means the audit looked in the inspected scope and found no path.
  It is written only where that inspection is recorded. An absent cell means
  that no inspection is recorded, not that the capability is absent.
- The matrix rule applies to every cell: pinned path, actual success
  predicate, and one limiting counterexample.
- A short predicate such as "acknowledgment only" means the handler returns
  after the setter call without reading the result back.

## Matrix

Rows with at least one external cell. Each cell lists the verbs the project
implements on that row with the proof level; Checked means Checked offline.
The Ghostnote column lists its claim cells (Product, Component, or Research)
on the same row; its Candidate and Unresolved cells are in the feature-area
documents.

| Row | Ghostnote | bitwig-control-deck | bwpreset | openwig | bitwig-extensions | WigAI | daw-mcp | bitwig_agent | acidcat | DrivenByMoss | BitX | bitwig-nitro-tools | bitwig-device-hacks | superpowers |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `change.records` | read Product; revert Product | read Not found |  | revert Source | revert Source |  |  |  |  |  |  |  |  |  |
| `track.group-effect` |  |  |  |  | create Source |  |  | create Source |  |  |  |  |  |  |
| `track.state` |  |  |  |  | write Source |  |  |  |  |  |  |  |  |  |
| `track.mixer` | read Product; write Product; revert Product; persist Product | write Checked |  |  |  |  |  | write Source |  |  |  |  |  |  |
| `track.sends` |  |  |  |  | write Source |  |  |  |  | write Source | write Source |  |  |  |
| `track.routing` |  |  |  |  | write Source |  |  |  |  |  |  |  |  |  |
| `master.mixer` |  |  |  |  | write Source |  |  |  |  |  |  |  |  |  |
| `transport` |  | write Checked |  |  | write Source |  |  |  |  |  | write Source |  |  |  |
| `cue-markers` |  | read Source; create Source; write Source |  |  | read Source; create Source; write Source |  |  |  |  |  |  |  |  |  |
| `scene.existence` | create Product; delete Product |  |  |  | create Source; delete Source |  |  |  |  |  |  |  |  |  |
| `scene.properties` |  |  |  |  | write Source; move-or-copy Source |  |  |  |  |  |  |  |  |  |
| `groove` |  |  |  |  | read Source; write Source |  |  |  |  |  |  |  |  |  |
| `launcher.stop` |  |  |  | write Source | write Source |  |  |  |  |  |  |  |  |  |
| `project.save` |  |  |  | write Source |  |  |  |  |  |  |  |  |  |  |
| `clip.notes` | read Product; write Product; revert Product; persist Product | read Source; write Source |  |  |  | read Source; write Source | read Source; write Source | read Source; write Source |  |  |  |  |  |  |
| `clip.existence` | create Product; delete Product; move-or-copy Product; revert Product | create Source |  |  | create Source; delete Source; move-or-copy Source |  |  |  |  |  |  |  |  |  |
| `clip.properties` | read Product; write Product; revert Product |  |  |  | write Source |  |  |  |  |  |  |  |  |  |
| `clip.launch-settings` | write Product; revert Product |  |  |  | write Source |  |  |  |  |  |  |  |  |  |
| `clip.playback-start` | write Product |  |  |  | write Source |  |  |  |  |  | write Source |  |  |  |
| `clip.expression-fidelity` |  |  |  |  |  |  |  |  |  | write Source |  |  |  |  |
| `bwclip.file` |  |  |  |  |  |  |  |  | read Source |  |  |  |  |  |
| `midi.file` | read Product; create Product |  |  |  |  |  |  |  | create Source |  |  |  |  |  |
| `arranger.clip-notes` |  |  |  | read Source; create Source |  |  |  | read Source |  |  |  |  |  |  |
| `arranger.audio-clip` |  |  |  | create Source |  |  |  |  |  |  |  |  |  |  |
| `automation` |  |  |  | create Source; read Source |  |  |  |  |  |  |  |  |  |  |
| `arranger.record` |  | create Source |  |  |  |  |  |  |  |  |  |  |  |  |
| `device.order` | read Product; create Product; delete Product; move-or-copy Product; revert Product; persist Product | create Source; delete Checked |  | create Source; delete Source | create Source; delete Source | create Source |  | create Source |  |  |  |  |  |  |
| `device.enabled` | read Product; write Product; revert Product | read Source; write Not found |  |  | write Source | read Source |  | write Source |  |  |  |  |  |  |
| `device.controls` | read Product; write Product; revert Product | read Source; write Source |  | read Source | write Source | read Source; write Source |  | read Source; write Source |  |  |  |  |  |  |
| `device.units` |  |  | write Source |  |  |  |  |  |  |  |  |  |  |  |
| `remote-pages` |  |  | create Source |  |  |  |  |  |  |  |  |  |  |  |
| `container.layer-chains` | read Product; write Product; create Product; move-or-copy Product; revert Product | move-or-copy Source |  |  |  |  |  |  |  | read Source |  |  |  |  |
| `container.other-types` |  |  | create Source |  |  |  |  |  |  |  |  |  |  |  |
| `device.preset-export` |  | create Source |  |  |  |  |  |  |  |  |  |  |  |  |
| `preset.modulation` | read Product; write Product; revert Product; persist Product |  | read Source; write Source | write Not found |  |  |  |  | read Source |  |  |  |  |  |
| `preset.codec` |  |  | read Checked; write Checked |  |  |  |  |  | read Source; write Checked |  |  |  | write Source |  |
| `preset.footprints` |  |  | write Checked |  |  |  |  |  |  |  |  |  |  |  |
| `route.enabled` |  |  | write Source |  |  |  |  |  |  |  |  |  |  |  |
| `route.mode` |  |  | write Source |  |  |  |  |  |  |  |  |  |  |  |
| `route.scale-source` |  |  | write Source |  |  |  |  |  |  |  |  |  |  |  |
| `modulator.donor-free` |  |  | create Checked |  |  |  |  |  |  |  |  |  |  |  |
| `modulator.curves` |  |  | write Source |  |  |  |  |  |  |  |  |  |  |  |
| `preset.resources` |  |  | write Source |  |  |  |  |  |  |  |  |  |  |  |
| `preset.bindings` |  |  | write Source |  |  |  |  |  |  |  |  |  |  |  |
| `grid.offline-preset` |  |  | create Source |  |  |  |  |  |  |  |  |  |  |  |
| `host.descriptors` |  |  |  | read Source |  |  |  |  |  |  |  |  |  |  |
| `dsp.image` |  |  |  |  |  |  |  |  |  |  |  | read Source; write Claim |  |  |
| `library.search` |  |  |  |  |  |  |  |  | read Source |  |  |  |  |  |
| `sample.insertion` |  | create Source |  |  |  |  |  |  |  |  |  |  |  |  |
| `audio.capture` | create Component |  |  | create Source |  |  |  |  |  |  |  |  |  |  |
| `audio.facts` | read Component |  |  |  |  |  |  |  | read Source |  |  |  |  |  |
| `audio.features` |  |  |  |  |  |  |  |  | read Source |  |  |  |  |  |
| `audio.transform` |  |  |  |  |  |  |  |  |  |  |  |  |  | create Claim |
| `write.readback` | write Product | write Source |  |  |  | write Source | write Source | write Source |  |  |  |  |  |  |
| `write.selection` | write Product | write Source |  |  |  | write Source |  | write Source |  |  |  |  |  |  |
| `write.basis` | write Product | write Not found | write Source |  |  | write Not found | write Not found | write Not found |  |  |  |  |  |  |
| `write.destructive-separation` | delete Product | delete Source |  |  | delete Source |  |  |  |  |  |  |  |  |  |
| `cost.ledger` | read Product | read Source |  | read Source |  |  |  |  |  |  |  |  |  |  |
| `descriptions.versioning` | read Product | read Source | read Source |  |  |  |  |  |  |  |  |  |  |  |

## Detail by feature area

The detail tables list every external cell once. The feature-area documents link here.

### Session and mixing

| Project | Row | Verb | Proof | Path | Predicate | Counterexample | Note |
|---|---|---|---|---|---|---|---|
| `bitwig-extensions` | `track.group-effect` | create | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TrackHandler.java:113` | track/createEffect calls Application.createEffectTrack(position); track/createGroup (line 216) calls cursorTrack.createParentTrack(SEND_COUNT, SCENE_COUNT). | The upstream test is a mock assertion that the call was made; no live verification in the repository. | Wave-3 SM-7 source; see Ghostnote E239, E16j, and E221. |
| `bitwig_agent` | `track.group-effect` | create | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:818` | A create_effect_track flag on track creation; group creation resolves a named action (line 2067) and moves tracks with afterTrackInsertionPoint().moveTracks (line 2037). | Named action for groups; D13 forbids named actions in Ghostnote; no readback of the created kind. | Not named in the audit; found during re-verification. |
| `bitwig-extensions` | `track.state` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TrackHandler.java:92` | track/setArm, track/setColor (line 150), and track/setMonitor (line 177). | Acknowledgment only. | Wave-3 SM-1 source. |
| `bitwig-control-deck` | `track.mixer` | write | Checked | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1297` | handleSetTrackMix writes normalized volume and pan and the booleans, then verifyReadback (line 1037) re-reads up to ten times at 100 ms until every requested field matches. Fake-host tests pass (test/controller.test.mjs:148, 159). | Normalized volume, not a dB law; no Master; fake-host tests only. | Audit A1; 8 of 8 controller tests ran during the audit. |
| `bitwig_agent` | `track.mixer` | write | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:2245` | Maps dB through 10^(dB/20) times 0.8 into a normalized fader value. | Not the measured Ghostnote raw law dB = 60 log10(raw); returns intended settings without a settlement comparison. | Audit A1. |
| `bitwig-extensions` | `track.sends` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/SendHandler.java:21` | send/setLevel, send/setMode (AUTO, PRE, POST; line 31), and send/setEnabled (line 44) on the cursor track's send bank. | Acknowledges the setter; no independent readback; no send-to-destination identity. | Audit A1; wave-1 O5. |
| `DrivenByMoss` | `track.sends` | write | Source | `reference/DrivenByMoss/src/main/java/de/mossgrabers/bitwig/framework/daw/data/ChannelImpl.java:545` | getSendBank wraps the channel send bank for controller use (LayerImpl extends it, data/LayerImpl.java:39). | Controller abstraction; no agent identity, readback, or change record. | Audit A1; wave-1 O5. |
| `BitX` | `track.sends` | write | Source | `reference/BitX/src/main/java/com/personal/BitXFunctions.java:867` | Send commands through track.sendBank(). | No readback. | Audit additional projects. |
| `bitwig-extensions` | `track.routing` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TrackHandler.java:221` | track/addNoteSource and track/removeNoteSource (line 226) on the cursor track. | Note sources only; no audio input or output routing handler. | Wave-3 SM-10 source. |
| `bitwig-extensions` | `master.mixer` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/MasterHandler.java:16` | master/setVolume, setPan, setMute, setSolo, setColor. | Acknowledgment only. | Wave-3 SM-3 source. |
| `bitwig-control-deck` | `transport` | write | Checked | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1060` | handleTransport: status, play, stop, toggle, set_tempo, set_position; set_tempo reports success only after Bitwig reads the new tempo back (test/controller.test.mjs:112, 122). | Tempo range 20 to 666; fake-host tests only; no record of the prior state. | Audit D6 and the wave-1 report. |
| `bitwig-extensions` | `transport` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TransportHandler.java:22` | play, stop, record, setTempo (line 57), setPosition, setLoop, setMetronome, loop range, punch, automation write modes, launch quantization. | Acknowledgment only; no record of prior state. | Wave-3 SM-4 source. |
| `BitX` | `transport` | write | Source | `reference/BitX/src/main/java/com/personal/BitXFunctions.java:557` | setBpm parses a command and sets transport.tempo as a normalized value, with a ramp over bars (line 612). | Command string input; normalized tempo math; no license file. | Audit additional projects. |
| `bitwig-control-deck` | `cue-markers` | read | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1088` | handleCueMarkers lists Arranger cue markers. | List only in this path; no durable identity beyond name and position. | Wave-1 O4. |
| `bitwig-control-deck` | `cue-markers` | create | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1088` | Creates a named marker set at exact beat positions, tracks insertions by fingerprint, verifies the set, and restores the transport position. | No deletion; name plus position is the fingerprint, not durable identity. | Wave-1 O4. |
| `bitwig-control-deck` | `cue-markers` | write | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1088` | Updates name, position, and colour of markers in the named set with readback. | Same fingerprint limit; concurrent human edits not handled. | Wave-1 O4. |
| `bitwig-extensions` | `cue-markers` | read | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ArrangerHandler.java:141` | cueMarker/list returns name, position, and colour from the cue marker bank. | Bank-sized list only. | Wave-1 O4. |
| `bitwig-extensions` | `cue-markers` | create | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ArrangerHandler.java:136` | cueMarker/addAtPlayhead calls transport.addCueMarkerAtPlaybackPosition. | Adds only at the playhead; no readback of the new marker. | Wave-1 O4. |
| `bitwig-extensions` | `cue-markers` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ArrangerHandler.java:175` | cueMarker/rename by bank index. | Index identity only. | Wave-1 O4. |
| `bitwig-extensions` | `scene.existence` | create | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/SceneHandler.java:29` | scene/create and scene/createFromPlaying (line 34). | Acknowledgment only. | Wave-3 SM-6 source. |
| `bitwig-extensions` | `scene.existence` | delete | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/SceneHandler.java:56` | scene/delete by index. | Index identity; no record for reversal. | Wave-3 SM-6 source. |
| `bitwig-extensions` | `scene.properties` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/SceneHandler.java:47` | scene/rename and scene/setColor (line 90). | Acknowledgment only. | Wave-3 SM-6 source. |
| `bitwig-extensions` | `scene.properties` | move-or-copy | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/SceneHandler.java:39` | scene/duplicate. | Clip references and automation fidelity not verified. | Wave-3 SM-6 source. |
| `bitwig-extensions` | `groove` | read | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/GrooveHandler.java:25` | groove/getState. | Units and scope not characterized here. | Wave-3 SM-8 source. |
| `bitwig-extensions` | `groove` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/GrooveHandler.java:36` | groove/setEnabled and groove/setParameter (line 45). | Acknowledgment only. | Wave-3 SM-8 source. |
| `openwig` | `launcher.stop` | write | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:1781` | track.stop and slot.stop. | No readback. | Wave-3 SM-9 source. |
| `bitwig-extensions` | `launcher.stop` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:63` | clip/stop on a slot. | No readback of stopped or still-queued state. | Wave-3 SM-9 source. |
| `openwig` | `project.save` | write | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:2069` | project.save invokes application.getAction("Save"). | The comment at line 2067 says a renamed action silently does nothing; the saved file is not verified. | Wave-3 SM-11 source. |

### Clips and arrangement

| Project | Row | Verb | Proof | Path | Predicate | Counterexample | Note |
|---|---|---|---|---|---|---|---|
| `bitwig-control-deck` | `clip.notes` | read | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1498` | readLauncherTemplate scans channel 0 at 0.25 beat for at most 64 beats; handleListClips (line 1964) lists slot metadata. | Not an exposed full-note reader; the active Arranger dispatch does not call it. | Audit C1. |
| `bitwig-control-deck` | `clip.notes` | write | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1417` | handleCreateNoteClip writes pages of setStep on channels 0 to 15 with grid-aligned starts; the final check proves the slot has content; notesWritten is the requested count. The MCP tool admits 750 notes (src/index.mjs:217); the controller validator admits 4,096. | Does not compare each written note with the request; replace=true deletes an occupied clip first (line 1435). | Audit C2. |
| `WigAI` | `clip.notes` | read | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:128` | A 256-step by 128-pitch launcher cursor clip; selects a slot, waits 500 ms, and returns a cache indexed by step and pitch. | No channel field in the result; current cursor only. | Audit C1. |
| `WigAI` | `clip.notes` | write | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:128` | Writes to the current cursor in a 256-step window, validating each note immediately before writing it. | A later invalid note can follow earlier writes. | Audit C2. |
| `daw-mcp` | `clip.notes` | read | Source | `reference/daw-mcp/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java:258` | Direct getStep(0, x, y) queries over the clip length at the cursor step size (line 294). | Bulk read is channel 0; follows the person's selected clip; capped to the cursor width. | Audit C1. |
| `daw-mcp` | `clip.notes` | write | Source | `reference/daw-mcp/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java:321` | setStep on the selected clip with an optional channel. | Returns success after setStep; no readback. | Audit C2. |
| `bitwig_agent` | `clip.notes` | read | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BitwigAgentExtension.java:152` | A 1,024-step launcher cursor clip at 0.25 beat (lines 25, 154) with a cache keyed by channel, step, and pitch. | Fixed 0.25-beat grid; cursor clip only. | Audit C1. |
| `bitwig_agent` | `clip.notes` | write | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:350` | Schedules selection and writing on the cursor clip at the fixed grid. | Fixed grid; no readback of each note. | Audit C2. |
| `bitwig-control-deck` | `clip.existence` | create | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1417` | Creates a clip in an empty slot, or in an occupied slot when replace=true, then checks hasContent. | replace=true removes the occupied clip without a record of it. | Audit C2 and S3. |
| `bitwig-extensions` | `clip.existence` | create | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:76` | clip/create in a slot. | No occupancy check recorded. | Registered handler; added during re-verification. |
| `bitwig-extensions` | `clip.existence` | delete | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:99` | clip/delete. | No record for reversal. | Registered handler; added during re-verification. |
| `bitwig-extensions` | `clip.existence` | move-or-copy | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:117` | clip/duplicate and clip/duplicateToSlot (line 124). | Destination occupancy not checked. | Registered handler; added during re-verification. |
| `bitwig-extensions` | `clip.properties` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:108` | clip/rename, setColor (line 196), setPlayStart (line 211), setPlayStop, setLoopStart, setLoopLength, setLoopEnabled. | Acknowledgment only. | Registered handler; added during re-verification. |
| `bitwig-extensions` | `clip.launch-settings` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:158` | clip/setLaunchQuantization and clip/setLaunchMode (line 165). | Acknowledgment only. | Registered handler; added during re-verification. |
| `bitwig-extensions` | `clip.playback-start` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:42` | clip/launch and scene/launch (line 135). | Acknowledgment only. | Registered handler; added during re-verification. |
| `BitX` | `clip.playback-start` | write | Source | `reference/BitX/src/main/java/com/personal/BitXFunctions.java:797` | JUMPTO launches a clip found by track name and clip name. | Name equality, not durable identity. | Audit additional projects. |
| `DrivenByMoss` | `clip.expression-fidelity` | write | Source | `reference/DrivenByMoss/src/main/java/de/mossgrabers/bitwig/framework/daw/CursorClipImpl.java:604` | updateStepPressure, Timbre (line 626), Pan (line 648), Transpose (line 674), Gain (line 704), and occurrence, recurrence, and repeat updates (lines 716 to 837). | Mature controller reference; does not prove that unobservable fields can be read back. | Wave-3 CA-1 source. |
| `acidcat` | `bwclip.file` | read | Source | `reference/acidcat/src/acidcat/core/formats/bitwig.py:267` | parse_notes extracts notes by byte signatures and nearby fields. | Not a clip-object grammar; ambiguous signature matches are possible. | Audit C1 and C5. |
| `acidcat` | `midi.file` | create | Source | `reference/acidcat/src/acidcat/commands/convert.py:3` | Converts a .bwclip to a Standard MIDI File through notes_to_smf at a chosen ticks per beat. | Not the Document 1.0 tempo, pairing, and publication contract. | Audit C5. |
| `openwig` | `arranger.clip-notes` | read | Source | `reference/openwig/src/openwig/read/notes.py:78` | collect_notes and collect_clips (line 106) interpret selected graph fields from the descriptor bridge (_descriptors, controller/openwig_bridge.control.js:560). | Upstream environment Windows and Bitwig 6.0.6; opt-in live tests were not run here; selected numeric IDs only. | Audit C3. |
| `openwig` | `arranger.clip-notes` | create | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:1005` | _insertClip and _clipCreateAndFill (line 1101) create and fill Arranger clips through internal reflection on the document thread. | Reflection on internal classes; version resolution required; no run on this workstation. | Audit C3. |
| `bitwig_agent` | `arranger.clip-notes` | read | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BitwigAgentExtension.java:61` | An Arranger cursor clip (1,024 steps at 0.25 beat) with play start and stop marked interested. | Selected Arranger cursor only; no exact identity or coverage. | Audit C3. |
| `openwig` | `arranger.audio-clip` | create | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:1075` | _insertAudioClip inserts an audio file as an Arranger clip; an opt-in live test exists (tests/test_autoadapt_live.py:131). | Opt-in upstream test only; file identity and saved content not proved here. | Audit C3. |
| `openwig` | `automation` | create | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:957` | _insertAutomationPoints writes breakpoints on a parameter's lane. | Owner identity, interpolation, and recovery not proved. | Wave-1 O12. |
| `openwig` | `automation` | read | Source | `reference/openwig/src/openwig/read/notes.py:151` | collect_breakpoints and collect_automation (line 200) read lanes from the graph. | Selected fields; no coverage proof. | Wave-1 O12. |
| `bitwig-control-deck` | `arranger.record` | create | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1755` | handleRecordLauncherArrangement records Launcher playback at 666 BPM, one source slot per track, merges intervals, and restores tempo and position; completion reports the requested intervals and transport state. | Does not enumerate the resulting Arranger clips or verify their bounds; handleArrangeLauncherClips (line 1547) is not dispatched (line 1989). | Audit C3. |

### Devices and parameters

| Project | Row | Verb | Proof | Path | Predicate | Counterexample | Note |
|---|---|---|---|---|---|---|---|
| `bitwig-control-deck` | `device.order` | create | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:764` | handleInsertDevice (browser), handleInsertBitwigDevice (stock UUID, line 878), and handleInsertClapDevice (line 825) insert and return a device snapshot. | Index and name targeting; no inventory of untouched devices. | Audit D1. |
| `bitwig-control-deck` | `device.order` | delete | Checked | `reference/bitwig-control-deck/controller/ControlDeck.control.js:2168` | Checks index and exact name, calls deleteObject, and after 250 ms returns previousCount and verifiedCount with success. | Does not compare the counts: the reproduction returned success with both counts 1 (context/evidence/data/overlap-audit/controller_noop_delete.mjs). | Audit D2; no-op delete reproduced during the audit and again in the wave-2 review. |
| `openwig` | `device.order` | create | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:2214` | Preset and audio insertion through host insertion points. | Real live loading; not exact-instance replacement with a checkpoint. | Audit P9. |
| `openwig` | `device.order` | delete | Source | `reference/openwig/src/openwig/song.py:330` | Track.delete_device on the selected device. | Selection-based; no durable target. | Audit D2. |
| `bitwig-extensions` | `device.order` | create | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/DeviceHandler.java:215` | device/insertBitwigDevice and device/insertPluginDevice (line 223). | Acknowledgment only. | Registered handler; added during re-verification. |
| `bitwig-extensions` | `device.order` | delete | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/DeviceHandler.java:252` | device/remove on the selected device. | Selection-based delete; no durable target or reversal record. | Audit D2. |
| `WigAI` | `device.order` | create | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:2578` | insertBitwigDeviceByUuid inserts at a position through device insertion points. | No readback of untouched devices. | Audit D1. |
| `bitwig_agent` | `device.order` | create | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:748` | insertBitwigDevice by a name-to-UUID map (line 585) or insertFile for a .bwpreset path at an insertion point. | Scheduled; the inserted device is not independently verified. | Audit D1 and P9. |
| `bitwig-control-deck` | `device.enabled` | read | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:311` | deviceSnapshot reports enabled (line 319). | No dedicated enabled-state setter in the registered tools. | Audit D8. |
| `bitwig-control-deck` | `device.enabled` | write | Not found | `reference/bitwig-control-deck/src/index.mjs:55` | None: the registered tools have no enabled-state setter. | bitwig_invoke_action (line 67) is a generic action, not an exact equivalent. | Audit D8 inspected the registered MCP tools in src/index.mjs. |
| `bitwig-extensions` | `device.enabled` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/DeviceHandler.java:106` | device/setEnabled on the cursor device. | Selected device, not a durable target. | Audit D8. |
| `WigAI` | `device.enabled` | read | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:965` | Reports bypassed as !isEnabled in device info. | Read only in the inspected path. | Audit D8. |
| `bitwig_agent` | `device.enabled` | write | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:973` | set_enabled on a device resolved by index or name. | Acknowledgment only. | Not named in the audit; found during re-verification. |
| `bitwig-control-deck` | `device.controls` | read | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:2348` | Enumerates stable DirectParameter IDs on the top-level device bank. | Nested remote controls are a separate selected path. | Audit D5. |
| `bitwig-control-deck` | `device.controls` | write | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:2348` | Writes a normalized value rounded to 128 levels (256 for MatrixBrute), then compares the observed value after 400 ms within 0.02, with a 1/16384 VST3 compensation (lines 2398 to 2420). | No whole-inventory collateral check; 0.02 tolerance is coarser than Ghostnote's 0.002 agreement. | Audit D5 and D6. |
| `openwig` | `device.controls` | read | Source | `reference/openwig/src/openwig/read/project.py:66` | _diff_device_params reads remote values and diffs them against a fresh copy inserted on a throwaway track. | A read that mutates the project; best-effort temporary-track removal. | Audit additional projects; wave-1 O12. |
| `bitwig-extensions` | `device.controls` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/DeviceHandler.java:130` | device/setParameterValue and device/setParameters through the cursor remote controls page. | Eight remote controls; not the DirectParameter inventory. | Audit D5. |
| `WigAI` | `device.controls` | read | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:115` | createCursorRemoteControlsPage; remote controls read by index or name. | Remote-page access only; not the DirectParameter inventory. | Audit D5. |
| `WigAI` | `device.controls` | write | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:115` | Sets a remote control value directly (line 498). | Eight remote controls per page; setter acknowledges the call. | Audit D5 and D6. |
| `bitwig_agent` | `device.controls` | read | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BitwigAgentExtension.java:130` | Remote-control pages on the cursor device. | Remote-page access only; not the DirectParameter inventory. | Audit D5. |
| `bitwig_agent` | `device.controls` | write | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:1029` | Sets a remote control matched by name or index (line 1175). | Returns current and displayed values immediately in the scheduled task without comparing them with the request. | Audit D5 and D6. |
| `bwpreset` | `device.units` | write | Source | `reference/bwpreset/bwpreset/units.py:109` | to_stored converts seconds, Hz, dB, rate, and beats through descriptors; a synced rate requires an explicit meter (tests/test_core_completion.py:271, 279). | Incomplete coverage; preset descriptors do not establish the inverse of a live DirectParameter normalized value. | Audit D5; wave-1 O9. |
| `bwpreset` | `remote-pages` | create | Source | `reference/bwpreset/bwpreset/build.py:882` | page and remote builders add remote pages and targets to a Grid patch offline. | Grid root only; live persistence of authored pages not verified here. | Wave-1 O8. |
| `bitwig-control-deck` | `container.layer-chains` | move-or-copy | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:937` | handleNestDevice moves a top-level child into a parent's native slot and checks the count plus a nested-bank or cursor witness. | Selects the current cursor slot, not the requested slotName; the first check assumes the child is at index 0 though insertion uses the chain end; not general cross-chain copy or move. | Audit D3. |
| `DrivenByMoss` | `container.layer-chains` | read | Source | `reference/DrivenByMoss/src/main/java/de/mossgrabers/bitwig/framework/daw/data/LayerImpl.java:39` | Layer bank navigation and controls. | Not an agent composition transaction. | Audit D4. |
| `bwpreset` | `container.other-types` | create | Source | `reference/bwpreset/bwpreset/slots.py:397` | insert_slot inserts a device preset into a slot offline and merges dependencies and attachments; tests cover collisions and nested targets. | Offline file edit on a Grid-rooted preset; no live insertion. | Audit D1 and D4. |
| `bitwig-control-deck` | `device.preset-export` | create | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1008` | handleSaveDevicePreset selects the device in the editor, invokes the Save to Library action after 180 ms, sends Enter after 700 ms, and reports saveToLibraryOpened true (bitwig_save_device_preset, src/index.mjs:193). | Fixed sleeps and a named action; the saved file is never read back. | Not in the wave-1 audit; found during re-verification of the controller file. |

### Modulation and presets

| Project | Row | Verb | Proof | Path | Predicate | Counterexample | Note |
|---|---|---|---|---|---|---|---|
| `bwpreset` | `preset.modulation` | read | Source | `reference/bwpreset/bwpreset/build.py:465` | Patch.from_preset parses a supported preset graph for editing. | Requires a root Grid device; stock-device presets are not editable through it. | Audit P1. |
| `bwpreset` | `preset.modulation` | write | Source | `reference/bwpreset/bwpreset/build.py:345` | make_routing writes target, descriptor, amount, flags, and scale source with ownership checks; amount is in native units unless normalized=True uses a known descriptor range. | Grid-rooted API; live verification of edits is pending in docs/verification.md; the same field ID does not prove the same amount semantics as Ghostnote. | Audit P2 and P4. |
| `openwig` | `preset.modulation` | write | Not found | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:2237` | None: modulator.open_browser only opens the browser; the comment (line 2231) says mapping maps an existing modulator and does not insert one. | Not applicable. | Audit P2. |
| `acidcat` | `preset.modulation` | read | Source | `reference/acidcat/src/acidcat/core/formats/bitwig.py:208` | The device tree is a union of path strings. | Not a topology proof; targets and amounts are not resolved. | Audit P1. |
| `bwpreset` | `preset.codec` | read | Checked | `reference/bwpreset/bwpreset/codec.py:63` | Reader and read_value handle 21 value tags, object and list terminators, references, maps, tagged values, strings, arrays, and attachments; 24 of 24 Ghostnote files parse; 46 of 46 detached donors are consumed. | Corpus only; hostile or future input is not covered; no real 0x06 or 0x1a field was observed. | Audit F1; repeated in the wave-2 review (context/evidence/data/overlap-audit/offline_checks.py). |
| `bwpreset` | `preset.codec` | write | Checked | `reference/bwpreset/bwpreset/codec.py:264` | Writer and serialize (line 369) regenerate the graph with fresh reference indices; 24 byte-exact no-op round trips. | A no-op round trip is not semantic edit correctness or a valid live load after an edit. | Audit F2. |
| `acidcat` | `preset.codec` | read | Source | `reference/acidcat/src/acidcat/core/formats/bitwig.py:208` | parse_tree and parse_structure (line 300) use bounded scans and class-name token patterns to produce a path union and structure list. | Can omit unreferenced objects; heuristic metadata reading, not a recursive grammar. | Audit P1 and F1. |
| `acidcat` | `preset.codec` | write | Checked | `reference/acidcat/src/acidcat/core/write/edits.py:167` | edit_bitwig splices metadata strings in memory. | Changing creator on mp_bare.bwpreset added 35 bytes and kept the old body offset; bwpreset then failed to parse the result. Do not port. | Audit F2; reproduced during the audit without writing a file. |
| `bitwig-device-hacks` | `preset.codec` | write | Source | `reference/bitwig-device-hacks/README.md:1` | Modifies the Bitwig 2.0 Math device Nitro source and repacks it. | Bitwig 2.0 era; historical context only. | Audit additional projects. |
| `bwpreset` | `preset.footprints` | write | Checked | `reference/bwpreset/bwpreset/codec.py:229` | resolve_refs turns references into shared identities; serialization assigns fresh indices; parsed donor counts match all six measured footprints; the Expressions donor counts 8. | Detached counts are not insertion-boundary counts with shared or external references; no proof that an edited sampled preset loads. | Audit P8 and F3. |
| `bwpreset` | `route.enabled` | write | Source | `reference/bwpreset/bwpreset/model.py:85` | F_ROUTE_ENABLED 0x2D3B is written by make_routing. | Live verification pending upstream. | Audit P5. |
| `bwpreset` | `route.mode` | write | Source | `reference/bwpreset/bwpreset/model.py:86` | F_ROUTE_MODE 0x2C4C with seven named modes; codes 0, 2, 3, 4, 5, 6, 7. | Not a contiguous enum; live verification pending upstream. | Audit P5. |
| `bwpreset` | `route.scale-source` | write | Source | `reference/bwpreset/bwpreset/model.py:84` | F_ROUTE_SCALE_SOURCE 0x2D2C with ownership checks; deleting a module reindexes cables, routes, and remotes (tests/test_core_completion.py:157). | Live verification pending upstream. | Audit P5. |
| `bwpreset` | `modulator.donor-free` | create | Checked | `reference/bwpreset/bwpreset/encoding.py:10` | installed_key reads a 128-byte key from one obfuscated jar method; decode_stream (line 89) decodes salted 0004 streams; module_definition (definitions.py:12) and schema.load (schema.py:252) build templates from installed definitions. | installed_key fails on the installed 6.1.4 jar: com/bitwig/base/serial/file/sYG.class is absent; 43 decoded definitions are not 43 live-tested stock-device workflows. | Audit P7 and F4; the jar member check was repeated in the wave-2 review. No key was extracted. |
| `bwpreset` | `modulator.curves` | write | Source | `reference/bwpreset/bwpreset/curves.py:63` | Curve builds curve and envelope payload state. | Live behavior and save/reload pending upstream. | Wave-1 O13. |
| `bwpreset` | `preset.resources` | write | Source | `reference/bwpreset/bwpreset/assets.py:98` | Dependency and FileReference model sample, multisample, and wavetable resources; tests cover portable references, generated wavetables, and multisample authoring (tests/test_assets.py:42, 63, 79). | Upstream asset live checks pending; path resolution and signal behavior not proved here. | Wave-1 O13. |
| `bwpreset` | `preset.bindings` | write | Source | `reference/bwpreset/bwpreset/bindings.py:65` | DeviceSource and TrackSource (line 85) write selector-kind bindings. | An unavailable track or hardware port is not proved to refuse rather than rebind. | Wave-1 O13. |

### Grid and internal access

| Project | Row | Verb | Proof | Path | Predicate | Counterexample | Note |
|---|---|---|---|---|---|---|---|
| `bwpreset` | `grid.offline-preset` | create | Source | `reference/bwpreset/bwpreset/build.py:845` | Patch.add, modulator (line 853), page (line 882), and remote (line 888) build typed ports, module instances, cables, remote pages, and fragments; tests cover foreign ownership, dangling handles, failed import, and dependency boundaries. | Upstream ledger records Poly Grid loads on 6.1.3 only; FX Grid, Note Grid, feedback, and per-voice checks are pending (docs/verification.md:24). | Audit P3 and P6. Upstream live results are recorded here as a note, not as a Live level. |
| `openwig` | `host.descriptors` | read | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:560` | _descriptors, _descriptorShape (line 1128), and _resolverClasses (line 1386) walk class names, numeric property IDs, relationships, and values of live document objects. | No complete field-name table; the walker can fall back to including properties when its serialization filter is unresolved. | Audit F5. |
| `bitwig-nitro-tools` | `dsp.image` | read | Source | `reference/bitwig-nitro-tools/README.md:140` | Parses and decompiles compiled Nitro DSP and repacks the ZIP image byte-identically. | Does not implement parameter, modulation, or preset-edit contracts. | Audit F6. |
| `bitwig-nitro-tools` | `dsp.image` | write | Claim | `reference/bitwig-nitro-tools/README.md:151` | None: the README states that acceptance of a modified image is the one open, untested question (also line 180). | Unproved. | Audit F6 and F7. |

### Media and analysis

| Project | Row | Verb | Proof | Path | Predicate | Counterexample | Note |
|---|---|---|---|---|---|---|---|
| `acidcat` | `library.search` | read | Source | `reference/acidcat/src/acidcat/mcp_server/schema.py:46` | search_samples by BPM, key, duration, tags, text, format, and preset metadata over registered libraries. | Index freshness and invalidation were not inspected. | Wave-1 O6. |
| `bitwig-control-deck` | `sample.insertion` | create | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:735` | handleInsertSampleFile inserts a sample file on the selected track; handleInsertSample (line 674) uses the browser. | Destination occupancy and sample identity are not verified. | Audit D1; wave-1 O6. |
| `openwig` | `audio.capture` | create | Source | `reference/openwig/src/openwig/wire/render.py:16` | render_to_wav records the default WASAPI loopback while the arrangement plays and checks for silence. | Windows only; system output, not Bitwig's bounce; no master-file identity contract. | Audit A2. |
| `acidcat` | `audio.facts` | read | Source | `reference/acidcat/src/acidcat/core/analysis/features.py:104` | extract_audio_features computes spectral centroid, rolloff, RMS, and tempo features with librosa. | No integrated loudness, crest contract, bounded silence intervals, or verified source-byte identity. | Audit A3. |
| `acidcat` | `audio.features` | read | Source | `reference/acidcat/src/acidcat/mcp_server/schema.py:235` | analyze_sample, detect_bpm_key (line 252), and find_similar (line 198) are registered MCP tools. | Provider cost and uncertainty not characterized here. | Audit A3. |
| `superpowers` | `audio.transform` | create | Claim | `https://github.com/kalifrn6-art/bitwig-superpowers` | Release notes claim stems and Audio to MIDI menu features for Bitwig 6.1.1 to 6.1.3. | No implementation source; not auditable or portable; a closed jar patch. | Audit A4. |

### Cross-cutting

| Project | Row | Verb | Proof | Path | Predicate | Counterexample | Note |
|---|---|---|---|---|---|---|---|
| `bitwig-control-deck` | `change.records` | read | Not found | `reference/bitwig-control-deck/src/index.mjs:55` | None: no checkpoint or change log. | Not applicable. | Audit S2. |
| `openwig` | `change.records` | revert | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:2061` | app.undo and app.redo call application undo and redo (song.py:454). | Application undo, not a guarded inverse of a named agent change. | Audit S2. |
| `bitwig-extensions` | `change.records` | revert | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TransactionHandler.java:96` | session/transaction with rollback undoAll calls application undo once per completed operation. | One RPC operation equal to one undo event is not established; no named-effect ownership; a human action can intervene. | Audit S2. |
| `bitwig-control-deck` | `write.readback` | write | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1037` | verifyReadback re-reads up to ten times at 100 ms until check() reports no mismatch; parameters, tempo, mixer, and selected structural facts are verified. | Clip write checks occupancy only; bitwig_invoke_action acknowledges invocation only; device delete accepts a no-op. | Audit S1 and D6. |
| `WigAI` | `write.readback` | write | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:498` | Setters acknowledge the call. | No comparison with the requested value. | Audit D6. |
| `daw-mcp` | `write.readback` | write | Source | `reference/daw-mcp/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java:321` | None beyond the setter return. | No readback. | Audit D6. |
| `bitwig_agent` | `write.readback` | write | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:1175` | Returns current and displayed values in the scheduled task. | No comparison with the requested value. | Audit D6. |
| `bitwig-control-deck` | `write.selection` | write | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:291` | selectTrack takes explicit index and name, then calls selectInMixer and selects a cursor device with waits. | Index plus name is not durable identity with duplicate names or a changed chain; no entry-selection restoration. | Audit D7 and S4. |
| `WigAI` | `write.selection` | write | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:115` | Explicit indices mixed with shared selected cursors. | No lease or restoration. | Audit D7 and S4. |
| `bitwig_agent` | `write.selection` | write | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BitwigAgentExtension.java:152` | Explicit indices mixed with shared selected cursors. | No lease or restoration. | Audit D7 and S4. |
| `bitwig-control-deck` | `write.basis` | write | Not found | `reference/bitwig-control-deck/src/index.mjs:55` | None: note arrays without a base reference or repair information. | Not applicable. | Audit C4 inspected the MCP request schemas. |
| `bwpreset` | `write.basis` | write | Source | `reference/bwpreset/tests/test_core_completion.py:111` | Graph ownership, fragments, invalid-handle checks, and atomic validation of some offline edits (lines 126, 157, 195). | Offline Grid preset graphs, not live clip documents. | Audit C4. |
| `WigAI` | `write.basis` | write | Not found | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:128` | None. | Not applicable. | Audit C4 inspected the request schemas. |
| `daw-mcp` | `write.basis` | write | Not found | `reference/daw-mcp/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java:258` | None. | Not applicable. | Audit C4. |
| `bitwig_agent` | `write.basis` | write | Not found | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:350` | None. | Not applicable. | Audit C4. |
| `bitwig-control-deck` | `write.destructive-separation` | delete | Source | `reference/bitwig-control-deck/src/index.mjs:171` | bitwig_delete_track and bitwig_delete_device (line 311) require the current index and exact name. | bitwig_invoke_action (line 67) exposes a generic action ID; bitwig_create_note_clip replace=true deletes a clip. | Audit S3. |
| `bitwig-extensions` | `write.destructive-separation` | delete | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TransactionHandler.java:20` | A generic dispatcher and transaction run any registered operation. | No narrow destructive-tool boundary. | Audit S3. |
| `bitwig-control-deck` | `cost.ledger` | read | Source | `reference/bitwig-control-deck/test/controller.test.mjs:55` | Bounded queues, timeouts, and stalled-request tests. | Not a measured per-tool cost contract. | Audit S5. |
| `openwig` | `cost.ledger` | read | Source | `reference/openwig/src/openwig/read/notes.py:51` | walk_track bounds depth (16) and nodes (9,000); waits between reads. | No performance ledger or per-tool cost. | Audit S5. |
| `bitwig-control-deck` | `descriptions.versioning` | read | Source | `reference/bitwig-control-deck/src/index.mjs:55` | Package version and tool schemas with descriptions. | No separate description-cohort process. | Audit S6. |
| `bwpreset` | `descriptions.versioning` | read | Source | `reference/bwpreset/docs/completion-status.md:1` | Agent skill, completion status document, and package version. | No separate description cohort. | Audit S6. |

## By project

Pins and reuse declarations are in [sources](sources.md). The verb list is the project's coverage on each row.

### bitwig-control-deck

reference/bitwig-control-deck, 45933855dcbfd1bd130beea18dd3f02bf794a838; MIT

| Row | Verb | Proof | Path |
|---|---|---|---|
| `clip.notes` | read | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1498` |
| `clip.notes` | write | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1417` |
| `clip.existence` | create | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1417` |
| `arranger.record` | create | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1755` |
| `device.order` | create | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:764` |
| `sample.insertion` | create | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:735` |
| `device.order` | delete | Checked offline | `reference/bitwig-control-deck/controller/ControlDeck.control.js:2168` |
| `container.layer-chains` | move-or-copy | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:937` |
| `device.controls` | read | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:2348` |
| `device.controls` | write | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:2348` |
| `device.enabled` | read | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:311` |
| `device.enabled` | write | Not found | `reference/bitwig-control-deck/src/index.mjs:55` |
| `track.mixer` | write | Checked offline | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1297` |
| `transport` | write | Checked offline | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1060` |
| `cue-markers` | read | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1088` |
| `cue-markers` | create | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1088` |
| `cue-markers` | write | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1088` |
| `device.preset-export` | create | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1008` |
| `write.readback` | write | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:1037` |
| `write.selection` | write | Source | `reference/bitwig-control-deck/controller/ControlDeck.control.js:291` |
| `write.basis` | write | Not found | `reference/bitwig-control-deck/src/index.mjs:55` |
| `change.records` | read | Not found | `reference/bitwig-control-deck/src/index.mjs:55` |
| `write.destructive-separation` | delete | Source | `reference/bitwig-control-deck/src/index.mjs:171` |
| `cost.ledger` | read | Source | `reference/bitwig-control-deck/test/controller.test.mjs:55` |
| `descriptions.versioning` | read | Source | `reference/bitwig-control-deck/src/index.mjs:55` |

### bwpreset

reference/bwpreset, 202bf50c31ac551f1e5d345bab5a39c1bed32a12; MIT

| Row | Verb | Proof | Path |
|---|---|---|---|
| `preset.codec` | read | Checked offline | `reference/bwpreset/bwpreset/codec.py:63` |
| `preset.codec` | write | Checked offline | `reference/bwpreset/bwpreset/codec.py:264` |
| `preset.footprints` | write | Checked offline | `reference/bwpreset/bwpreset/codec.py:229` |
| `preset.modulation` | read | Source | `reference/bwpreset/bwpreset/build.py:465` |
| `preset.modulation` | write | Source | `reference/bwpreset/bwpreset/build.py:345` |
| `route.enabled` | write | Source | `reference/bwpreset/bwpreset/model.py:85` |
| `route.mode` | write | Source | `reference/bwpreset/bwpreset/model.py:86` |
| `route.scale-source` | write | Source | `reference/bwpreset/bwpreset/model.py:84` |
| `grid.offline-preset` | create | Source | `reference/bwpreset/bwpreset/build.py:845` |
| `remote-pages` | create | Source | `reference/bwpreset/bwpreset/build.py:882` |
| `modulator.donor-free` | create | Checked offline | `reference/bwpreset/bwpreset/encoding.py:10` |
| `device.units` | write | Source | `reference/bwpreset/bwpreset/units.py:109` |
| `container.other-types` | create | Source | `reference/bwpreset/bwpreset/slots.py:397` |
| `modulator.curves` | write | Source | `reference/bwpreset/bwpreset/curves.py:63` |
| `preset.resources` | write | Source | `reference/bwpreset/bwpreset/assets.py:98` |
| `preset.bindings` | write | Source | `reference/bwpreset/bwpreset/bindings.py:65` |
| `write.basis` | write | Source | `reference/bwpreset/tests/test_core_completion.py:111` |
| `descriptions.versioning` | read | Source | `reference/bwpreset/docs/completion-status.md:1` |

### openwig

reference/openwig, d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d; GPL-3.0-or-later

| Row | Verb | Proof | Path |
|---|---|---|---|
| `arranger.clip-notes` | read | Source | `reference/openwig/src/openwig/read/notes.py:78` |
| `arranger.clip-notes` | create | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:1005` |
| `arranger.audio-clip` | create | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:1075` |
| `automation` | create | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:957` |
| `automation` | read | Source | `reference/openwig/src/openwig/read/notes.py:151` |
| `host.descriptors` | read | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:560` |
| `device.controls` | read | Source | `reference/openwig/src/openwig/read/project.py:66` |
| `device.order` | create | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:2214` |
| `preset.modulation` | write | Not found | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:2237` |
| `device.order` | delete | Source | `reference/openwig/src/openwig/song.py:330` |
| `change.records` | revert | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:2061` |
| `audio.capture` | create | Source | `reference/openwig/src/openwig/wire/render.py:16` |
| `launcher.stop` | write | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:1781` |
| `project.save` | write | Source | `reference/openwig/src/openwig/controller/openwig_bridge.control.js:2069` |
| `cost.ledger` | read | Source | `reference/openwig/src/openwig/read/notes.py:51` |

### bitwig-extensions

reference/bitwig-extensions (Gig Maestro), de79a747a62b50e1488cc9ef49617d129804e3ff; README says MIT, no license file

| Row | Verb | Proof | Path |
|---|---|---|---|
| `track.sends` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/SendHandler.java:21` |
| `track.state` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TrackHandler.java:92` |
| `track.group-effect` | create | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TrackHandler.java:113` |
| `track.routing` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TrackHandler.java:221` |
| `master.mixer` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/MasterHandler.java:16` |
| `transport` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TransportHandler.java:22` |
| `cue-markers` | read | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ArrangerHandler.java:141` |
| `cue-markers` | create | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ArrangerHandler.java:136` |
| `cue-markers` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ArrangerHandler.java:175` |
| `scene.existence` | create | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/SceneHandler.java:29` |
| `scene.existence` | delete | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/SceneHandler.java:56` |
| `scene.properties` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/SceneHandler.java:47` |
| `scene.properties` | move-or-copy | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/SceneHandler.java:39` |
| `groove` | read | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/GrooveHandler.java:25` |
| `groove` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/GrooveHandler.java:36` |
| `launcher.stop` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:63` |
| `clip.playback-start` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:42` |
| `clip.properties` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:108` |
| `clip.launch-settings` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:158` |
| `clip.existence` | create | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:76` |
| `clip.existence` | delete | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:99` |
| `clip.existence` | move-or-copy | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ClipHandler.java:117` |
| `device.enabled` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/DeviceHandler.java:106` |
| `device.controls` | write | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/DeviceHandler.java:130` |
| `device.order` | create | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/DeviceHandler.java:215` |
| `device.order` | delete | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/DeviceHandler.java:252` |
| `change.records` | revert | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TransactionHandler.java:96` |
| `write.destructive-separation` | delete | Source | `reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TransactionHandler.java:20` |

### WigAI

reference/WigAI, 6b567eb90ad3702a88f80398cf6ecbd74d1b5306; README says MIT, no license file

| Row | Verb | Proof | Path |
|---|---|---|---|
| `clip.notes` | read | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:128` |
| `clip.notes` | write | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:128` |
| `device.controls` | read | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:115` |
| `device.controls` | write | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:115` |
| `device.order` | create | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:2578` |
| `device.enabled` | read | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:965` |
| `write.readback` | write | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:498` |
| `write.selection` | write | Source | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:115` |
| `write.basis` | write | Not found | `reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:128` |

### daw-mcp

reference/daw-mcp, a30cbf62f8741265550fc2d638b0cd56559255e6; MIT; local lockfile change not used as evidence

| Row | Verb | Proof | Path |
|---|---|---|---|
| `clip.notes` | read | Source | `reference/daw-mcp/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java:258` |
| `clip.notes` | write | Source | `reference/daw-mcp/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java:321` |
| `write.readback` | write | Source | `reference/daw-mcp/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java:321` |
| `write.basis` | write | Not found | `reference/daw-mcp/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java:258` |

### bitwig_agent

reference/bitwig_agent, e17ac4033a7c5619e2371d0d733b0a4bb4b686d4; MIT

| Row | Verb | Proof | Path |
|---|---|---|---|
| `clip.notes` | read | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BitwigAgentExtension.java:152` |
| `clip.notes` | write | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:350` |
| `arranger.clip-notes` | read | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BitwigAgentExtension.java:61` |
| `device.order` | create | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:748` |
| `device.controls` | read | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BitwigAgentExtension.java:130` |
| `device.controls` | write | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:1029` |
| `device.enabled` | write | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:973` |
| `track.mixer` | write | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:2245` |
| `track.group-effect` | create | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:818` |
| `write.readback` | write | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:1175` |
| `write.selection` | write | Source | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BitwigAgentExtension.java:152` |
| `write.basis` | write | Not found | `reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:350` |

### acidcat

reference/acidcat, 2d0a0479bd4527b1ffcb8610b3568788198c749c; MIT

| Row | Verb | Proof | Path |
|---|---|---|---|
| `bwclip.file` | read | Source | `reference/acidcat/src/acidcat/core/formats/bitwig.py:267` |
| `midi.file` | create | Source | `reference/acidcat/src/acidcat/commands/convert.py:3` |
| `preset.codec` | read | Source | `reference/acidcat/src/acidcat/core/formats/bitwig.py:208` |
| `preset.modulation` | read | Source | `reference/acidcat/src/acidcat/core/formats/bitwig.py:208` |
| `preset.codec` | write | Checked offline | `reference/acidcat/src/acidcat/core/write/edits.py:167` |
| `audio.facts` | read | Source | `reference/acidcat/src/acidcat/core/analysis/features.py:104` |
| `audio.features` | read | Source | `reference/acidcat/src/acidcat/mcp_server/schema.py:235` |
| `library.search` | read | Source | `reference/acidcat/src/acidcat/mcp_server/schema.py:46` |

### DrivenByMoss

reference/DrivenByMoss, 836117be7c17318a0f93cb414e333516a91a5436; LGPLv3

| Row | Verb | Proof | Path |
|---|---|---|---|
| `track.sends` | write | Source | `reference/DrivenByMoss/src/main/java/de/mossgrabers/bitwig/framework/daw/data/ChannelImpl.java:545` |
| `container.layer-chains` | read | Source | `reference/DrivenByMoss/src/main/java/de/mossgrabers/bitwig/framework/daw/data/LayerImpl.java:39` |
| `clip.expression-fidelity` | write | Source | `reference/DrivenByMoss/src/main/java/de/mossgrabers/bitwig/framework/daw/CursorClipImpl.java:604` |

### BitX

reference/BitX, 23768a4e9dbcf161e4a4b53a732ff704d10039cb; no license file identified

| Row | Verb | Proof | Path |
|---|---|---|---|
| `transport` | write | Source | `reference/BitX/src/main/java/com/personal/BitXFunctions.java:557` |
| `track.sends` | write | Source | `reference/BitX/src/main/java/com/personal/BitXFunctions.java:867` |
| `clip.playback-start` | write | Source | `reference/BitX/src/main/java/com/personal/BitXFunctions.java:797` |

### bitwig-nitro-tools

reference/bitwig-nitro-tools, a34c1d61c7e48b1531fb3fba5e4c06d9e1e0cf16; MIT

| Row | Verb | Proof | Path |
|---|---|---|---|
| `dsp.image` | read | Source | `reference/bitwig-nitro-tools/README.md:140` |
| `dsp.image` | write | Claim | `reference/bitwig-nitro-tools/README.md:151` |

### bitwig-device-hacks

reference/bitwig-device-hacks, 59aa058e3fc725d202b6309c5251960a588e37a2; MIT

| Row | Verb | Proof | Path |
|---|---|---|---|
| `preset.codec` | write | Source | `reference/bitwig-device-hacks/README.md:1` |

### superpowers

no clone; public installer repository only (https://github.com/kalifrn6-art/bitwig-superpowers)

| Row | Verb | Proof | Path |
|---|---|---|---|
| `audio.transform` | create | Claim | `https://github.com/kalifrn6-art/bitwig-superpowers` |

## Wave-1 audit rows and their register cells

Every row of the wave-1 capability audit maps to register cells or to a stated exclusion. The audit itself is historical; this table is the only link the later report needs.

| Audit row | Register cells |
|---|---|
| C1 Read launcher MIDI clips | `clip.notes` read; `bwclip.file` read |
| C2 Write launcher MIDI clips | `clip.notes` write; `clip.existence` create |
| C3 Arranger clips | `arranger.record` create; `arranger.clip-notes` read and create; `arranger.audio-clip` create |
| C4 Versioned document, sparse patch, repair | `write.basis` write |
| C5 Offline MIDI file read and write | `midi.file` create; `bwclip.file` read |
| C6 Built-in generation | No cell: generation stays with the driving agent; openwig's deterministic builders are under `arranger.clip-notes` create |
| D1 Insert a device | `device.order` create; `sample.insertion` create; `container.other-types` create |
| D2 Delete a device | `device.order` delete |
| D3 Move or copy across chains | `container.layer-chains` move-or-copy |
| D4 Layer chains and containers | `container.layer-chains` read; `container.other-types` create |
| D5 Direct parameters past remote controls | `device.controls` read and write; `device.units` write |
| D6 Write checked by readback | `write.readback` write; `device.controls` write; `track.mixer` write; `transport` write |
| D7 No dependence on selection | `write.selection` write |
| D8 Device enable and bypass | `device.enabled` read and write |
| P1 Read preset modulator topology | `preset.modulation` read; `preset.codec` read |
| P2 Add or edit modulators on stock devices | `preset.modulation` write (bwpreset Source with Grid-root limit; openwig Not found) |
| P3 Modulators on Grid devices | `grid.offline-preset` create |
| P4 Routing target and amount | `preset.modulation` write |
| P5 Routing mode, scale source, enabled | `route.enabled`, `route.mode`, `route.scale-source` write |
| P6 Grid patch authoring | `grid.offline-preset` create; `remote-pages` create |
| P7 Modulator without a donor | `modulator.donor-free` create |
| P8 Sampled presets and stubs | `preset.footprints` write |
| P9 Apply to a live device | `device.order` create (openwig, bitwig_agent) |
| A1 Mixer | `track.mixer` write; `track.sends` write |
| A2 Capture master output | `audio.capture` create |
| A3 Audio facts | `audio.facts` read; `audio.features` read; `library.search` read |
| A4 Stem separation and audio to MIDI | `audio.transform` create |
| S1 Readback on every write | `write.readback` write |
| S2 Change log and guarded revert | `change.records` read and revert |
| S3 Separate destructive tools | `write.destructive-separation` delete |
| S4 Selection restored after a write | `write.selection` write |
| S5 Call budgets and ledger | `cost.ledger` read |
| S6 Versioned tool descriptions | `descriptions.versioning` read |
| F1 Full parse of the 0002 stream | `preset.codec` read |
| F2 Write 0002 | `preset.codec` write |
| F3 Load gates and footprints | `preset.footprints` write |
| F4 Decode 0004 definitions | `modulator.donor-free` create; Nitro under `dsp.image` |
| F5 Ramona field names | `host.descriptors` read |
| F6 Nitro DSP decompile | `dsp.image` read and write |
| F7 Live load proof | Recorded as evidence notes on `grid.offline-preset` create and `dsp.image` write; Ghostnote live proof is on its own cells |
