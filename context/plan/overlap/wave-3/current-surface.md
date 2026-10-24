---
title: Current normal tool surface
kind: note
state: active
updated: 2026-10-24
---

# Current normal tool surface

## Baseline and meaning

This inventory is the normal `agent-native-v1` surface on 2026-10-24.
It contains 45 tools, with descriptions `ghostnote-description-v53`.
It excludes the frozen `stable-v1` profile, research methods, and unregistered
workstation modules. A component in the repository is not a public tool.

Sources: [complete v53 descriptions](../../../evidence/data/phase9b-doctor/9b7-tool/descriptions-v53.json),
[description version](../../../../brain/src/surface/description-cohort.ts),
[product architecture](../../../PROJECT.md), and
[E343](../../../evidence/experiments/e343-grid-admission-gate-and-upgrade-tool.md).
The short scopes below are extracted from the description artifact. Read the
full description before defining a new acceptance test.

The installed host is Bitwig 6.1.4, API 25, on macOS. The normal-product
upgrade audit passed its selected scope in
[E330](../../../evidence/experiments/e330-update-audit-614-acceptance.md).
That does not rerun every historical capacity or audio test.
The deployed controller is the Grid research probe. This planning session
made no connection to Bitwig. See [NOW](../../../NOW.md) before live work.

## Connection and change records

| Tool | Short scope from v53 |
|---|---|
| `check_bitwig_connection` | Check that Bitwig runs with the matching Ghostnote extension, and read which project is open and how many tracks and scenes this connection can address. |
| `list_changes` | List the changes that this server process wrote, newest first, with what each one can and cannot put back. |
| `check_revert` | Read what revert_change would restore for one change, and what it would not, without a write. |
| `revert_change` | Reverse one change that this server process wrote, from what the change recorded before it ran. |
| `check_grid_support` | Read whether native Grid (Poly Grid, FX Grid, Note Grid) editing is admitted on the connected Bitwig build. |

## Tracks, scenes, and mixer

| Tool | Short scope from v53 |
|---|---|
| `list_tracks` | List every track that this connection can address, with its durable trackId. |
| `add_tracks` | Create instrument or audio tracks, each with its exact name. |
| `duplicate_track` | Duplicate one Instrument, Audio, or Hybrid track and give the copy an exact name. |
| `rename_track` | Rename tracks. |
| `add_scenes` | Add scenes at the end of the Launcher. |
| `delete_track` | Delete tracks with everything on them: every clip, device, and setting. |
| `delete_scene` | Delete scenes. |
| `read_track_mixer` | Read the mixer of tracks: volume, pan, mute, and solo. |
| `set_track_mixer` | Set the mixer of tracks: volume in dB, pan, mute, and solo. |

## Launcher clips and documents

| Tool | Short scope from v53 |
|---|---|
| `get_document_reference` | Return the Ghostnote Document 1.0 format reference and valid templates. |
| `read_launcher_clip` | Read one Launcher clip as a Ghostnote Document 1.0 snapshot. |
| `check_launcher_clips` | Check base refs from read_launcher_clip. |
| `edit_launcher_clip` | Edit one Launcher clip with a Ghostnote Document 1.0 patch or desired document. |
| `add_launcher_clip` | Create one Launcher clip in an empty slot from a Ghostnote Document 1.0 desired document without BASE (DOC ghostnote-document 1.0 desired, one CLIP). |
| `copy_launcher_clips` | Copy Launcher clips. |
| `move_launcher_clips` | Move a contiguous range of Launcher clips on one track, with their clip properties and automation. |
| `launch_clip` | Launch one Launcher clip with a grid and mode for this call, then read whether it is queued or playing. |
| `set_launcher_clip_launch_settings` | Set the launch grid and mode of Launcher clips: the settings that a person who clicks the clip in Bitwig uses. |
| `set_launcher_clip_properties` | Set properties of Launcher clips: name, colour, length, play start, and loop. |
| `delete_launcher_clip` | Delete Launcher clips. |
| `show_launcher_clip_in_detail_editor` | Open one Launcher clip in the Bitwig detail editor, request the edit layout, and fit the clip content. |

## Devices and layer chains

| Tool | Short scope from v53 |
|---|---|
| `read_devices` | Read the complete top-level device order of one track, and the layer chains of each container at top-level positions 0 through 2. |
| `read_device_controls` | Read the controls of one device: the complete stable DirectParameter inventory, or with view remote-controls the visible remote pages. |
| `set_device_controls` | Set DirectParameters by ids from read_device_controls, or set returned remote controls by their exact page and control names and positions. |
| `add_devices` | Append devices at the end of the top-level device order of one track. |
| `set_device_enabled` | Enable or bypass top-level devices. |
| `delete_device` | Remove top-level devices by current position after a fresh complete read of the device order. |
| `compose_devices` | Create one complete container with explicit sources: an Instrument Layer or FX Layer with one through five named layer chains of one through four devices each, or a Drum Machine with one through 16 pads. |
| `duplicate_layer_chain` | Copy one complete layer chain, with its devices and device state, to a new layer chain with a new unique name. |
| `rename_layer_chain` | Give one layer chain a new durable name. |
| `move_devices` | Move devices, with their device state, on one track. |
| `copy_devices` | Copy devices into a layer chain on the same track: top-level devices, or the devices of another layer chain. |
| `set_layer_chain_solo` | Set the container-local solo of one layer chain. |

## Preset modulation

| Tool | Short scope from v53 |
|---|---|
| `list_modulator_types` | Read the measured modulator catalog for the current Bitwig host: each supported public type, its category, operations, sampled-preset standing, witness mode and requirement, and provenance, and the complete host inventory, where each excluded type has a reason. |
| `read_preset_modulation` | Read one human-saved Bitwig preset from an explicit absolute path. |
| `edit_preset_modulation` | Create an edited copy of one human-saved preset and append it as a new device. |
| `wrap_existing_device_modulation` | Place one current top-level device inside one owned FX Layer without creating a replacement device instance. |
| `reverse_existing_device_modulation_wrap` | Reverse one checkpoint that wrap_existing_device_modulation returned. |

## MIDI files

| Tool | Short scope from v53 |
|---|---|
| `read_midi_file` | Read a local Standard MIDI File as a complete Ghostnote Document 1.0 FIELDS desired document, inline in data.document. |
| `write_midi_file` | Write a complete Ghostnote Document 1.0 FIELDS or JSON document to a new local MIDI file. |

## Capability rows for the current surface

The same 45 tools, as capability rows with the seven verb columns of the
[record conventions](README.md#record-conventions), plus six cross-cutting
rows (readback, selection, basis, destructive separation, cost ledger, and
description versioning) that the [external register](external-register.md)
compares across projects. Each cell gives its status and proof level; a Live
proof names its Bitwig build. An empty cell records no
standing. Rows that hold only Planned, Candidate, or Unresolved cells are in
the feature-area documents and in [`data/records.json`](data/records.json);
`python3 -I data/render_tables.py matrix` prints the complete matrix.

Proof rule for product cells: Live 6.1.4 where the
[E330](../../../evidence/experiments/e330-update-audit-614-acceptance.md)
matrix names the boundary, otherwise the latest 6.0.6 record. Offline file
tools are Checked offline. A persist cell is present only where a save and
reopen test exists (E328 fixture equality); an empty persist cell means not
separately proved, not failed.

| Row | read | write | create | delete | move-or-copy | revert | persist |
|---|---|---|---|---|---|---|---|
| `connection.health` Connection: health, open project, and addressable window | Product; Live 6.1.4 |  |  |  |  |  |  |
| `change.records` Change records: list, preview, and reversal | Product; Live 6.1.4 |  |  |  |  | Product; Live 6.1.4 |  |
| `track.inventory` Track: list and durable identity | Product; Live 6.1.4 |  |  |  |  |  |  |
| `track.existence` Track: existence: Instrument and Audio |  |  | Product; Live 6.1.4 | Product; Live 6.1.4 | Product; Live 6.1.4 |  |  |
| `track.name` Track: name |  | Product; Live 6.0.6 |  |  |  | Product; Live 6.0.6 |  |
| `track.mixer` Track: mixer: volume, pan, mute, and solo | Product; Live 6.1.4 | Product; Live 6.1.4 |  |  |  | Product; Live 6.1.4 | Product; Live 6.1.4 |
| `scene.existence` Scene: existence |  |  | Product; Live 6.0.6 | Product; Live 6.0.6 |  |  |  |
| `clip.notes` Launcher clip: notes and expression as a Ghostnote Document 1.0 | Product; Live 6.1.4 | Product; Live 6.1.4 |  |  |  | Product; Live 6.1.4 | Product; Live 6.1.4 |
| `clip.existence` Launcher clip: existence in a slot |  |  | Product; Live 6.1.4 | Product; Live 6.1.4 | Product; Live 6.1.4 | Product; Live 6.1.4 |  |
| `clip.properties` Launcher clip: name, colour, length, play start, and loop | Product; Live 6.1.4 | Product; Live 6.0.6 |  |  |  | Product; Live 6.0.6 |  |
| `clip.launch-settings` Launcher clip: launch grid and mode |  | Product; Live 6.0.6 |  |  |  | Product; Live 6.0.6 |  |
| `clip.playback-start` Launcher clip: launch |  | Product; Live 6.0.6 |  |  |  |  |  |
| `clip.editor-view` Launcher clip: detail editor view |  | Product; Live 6.0.6 |  |  |  |  |  |
| `midi.file` Standard MIDI File: notes as a Ghostnote Document 1.0 (offline) | Product; Checked offline |  | Product; Checked offline |  |  |  |  |
| `device.order` Device: top-level order | Product; Live 6.1.4 |  | Product; Live 6.1.4 | Product; Live 6.1.4 | Product; Live 6.1.4 | Product; Live 6.1.4 | Product; Live 6.1.4 |
| `device.enabled` Device: enabled state | Product; Live 6.1.4 | Product; Live 6.1.4 |  |  |  | Product; Live 6.1.4 |  |
| `device.controls` Device: DirectParameters and remote controls (normalized) | Product; Live 6.1.4 | Product; Live 6.1.4 |  |  |  | Product; Live 6.1.4 |  |
| `container.layer-chains` Container: layer chains and drum pads | Product; Live 6.1.4 | Product; Live 6.0.6 | Product; Live 6.1.4 |  | Product; Live 6.0.6 | Product; Live 6.1.4 |  |
| `modulator.catalog` Modulator catalog: admitted types and host inventory | Product; Live 6.0.6 |  |  |  |  |  |  |
| `preset.modulation` Saved preset: modulators and routes (target and amount) | Product; Live 6.1.4 | Product; Live 6.1.4 |  |  |  | Product; Live 6.1.4 | Product; Live 6.1.4 |
| `device.modulation-wrap` Existing device: wrap for modulation in an owned FX Layer |  | Product; Live 6.0.6 |  |  |  | Product; Live 6.0.6 |  |
| `grid.admission` Grid: exact-build admission | Product; Live 6.1.4 |  |  |  |  |  |  |
| `audio.capture` Master output: capture to a verified file |  |  | Component; Live 6.0.6 |  |  |  |  |
| `audio.facts` Audio file: loudness, rolloff, crest, and silence facts | Component; Checked offline |  |  |  |  |  |  |
| `write.readback` Any write: independent readback of the result |  | Product; Live 6.1.4 |  |  |  |  |  |
| `write.selection` Any write: independence from the person's selection, and restoration after |  | Product; Live 6.0.6 |  |  |  |  |  |
| `write.basis` Document write: observed-base check, sparse patch, and repair on refusal |  | Product; Live 6.1.4 |  |  |  |  |  |
| `write.destructive-separation` Destructive operation: separate directed tools with current-structure guards |  |  |  | Product; Live 6.1.4 |  |  |  |
| `cost.ledger` Operation cost: measured call budgets and performance ledger | Product; Live 6.1.4 |  |  |  |  |  |  |
| `descriptions.versioning` Tool descriptions: versioned description cohort | Product; Checked offline |  |  |  |  |  |  |

The `write.*`, `cost.ledger`, and `descriptions.versioning` rows are
cross-cutting: they describe contracts that every write tool shares, so the
comparison with other projects can show them beside the object rows. External
implementations on all rows are in the [external register](external-register.md).

### Claim details

Every claim cell records its path, success predicate, and one limiting
counterexample (the matrix rule). The E records in parentheses are the proof.

| Row | Verb | Path | Predicate | Counterexample |
|---|---|---|---|---|
| `connection.health` | read | `check_bitwig_connection` (E330, E318, E319) | Matching extension build, an open project, a held track handle, and track and scene counts inside the window. | A target past the addressable window is invisible, not empty; health is outside-limit and other tools refuse. |
| `change.records` | read | `list_changes; check_revert` (E330, E264) | Lists every change this server process wrote with what each can and cannot put back; check_revert compares each place without a write. | An edit from before this connection or by a person is not listed; records do not survive a new server session. |
| `change.records` | revert | `revert_change` (E330, E264) | Writes only places that still hold what the change left; reports notRestored and removed; the reversal is its own change. | Device adds on one track must revert newest first or the call refuses; a removed device has redoFidelity none. |
| `track.inventory` | read | `list_tracks` (E330, E326) | Every addressable track with a durable trackId and kind, including children of collapsed groups. | coverage.status partial when the project has more tracks than the window; group tracks refuse clip tools with group-slot. |
| `track.existence` | create | `add_tracks` (E330, E320) | Each fresh trackId is read back, then named in a second change. | No position is accepted; the tool refuses Hybrid, Group, and Effect; revert_change does not remove a new track. |
| `track.existence` | delete | `delete_track` (E330, E320, E329) | readback.removed names each deleted trackId after the delete. | A group delete removes its children; nothing can rebuild the track, and a new track has a new trackId. |
| `track.existence` | move-or-copy | `duplicate_track` (E330, E320) | A fresh trackId directly after the source, with clips, devices, mixer, sends, and input copied by Bitwig. | Group, Effect, and Master refuse; revert_change does not remove the copy. |
| `track.name` | write | `rename_track` (E258, E252) | The trackId is unchanged and the previous name is recorded. | At most 64 tracks per call; a larger request refuses before any write. |
| `track.name` | revert | `revert_change` (E258) | Puts the recorded previous name back. | A name a person changed since stays. |
| `track.mixer` | read | `read_track_mixer` (E330, E325, E257) | volume.db, pan, mute, solo, and automated flags for at most 8 tracks. | A Master track refuses with unsupported. |
| `track.mixer` | write | `set_track_mixer` (E330, E325, E327, E257) | Independent readback of each written field: verified, differs, or unavailable. | A field with automation refuses before any write; at most 8 tracks per call. |
| `track.mixer` | revert | `revert_change` (E330, E327) | Restores each field that still holds what the change left. | A field a person changed since stays; a field with automation now refuses. |
| `track.mixer` | persist | `set_track_mixer; project save by the operator` (E328, E330) | Full observable fixture equality after save and reopen. | No separate test saved and reloaded each mixer field alone. |
| `scene.existence` | create | `add_scenes` (E264, E247) | New rows exist past the old ones; existing rows keep their numbers. | revert_change cannot remove a scene: the scene layout has no readback. |
| `scene.existence` | delete | `delete_scene` (E263, E252) | Highest rows first so all rows in one call refer to the layout before it. | A row address from before the call names another scene after it (stale-address); every clip in the scene goes with it. |
| `clip.notes` | read | `read_launcher_clip; check_launcher_clips; get_document_reference` (E330, E320) | One fresh complete read with a base sha256 and ref; a repeated read of an unchanged clip returns the same ref and IDs. | Pressure always reads 0; an onset finer than 1/512 beat is not observable; limits 16,384 notes, 8,192 beats, 2,097,152 sounding cells. |
| `clip.notes` | write | `edit_launcher_clip` (E330, E320) | Base ref check before the write; independent readback of all 16 channels with discrepancies listed. | Two notes of one channel and pitch that overlap refuse; a whole-clip rewrite loses pressure a person set. |
| `clip.notes` | revert | `revert_change` (E330, E320) | Restores recorded note state while the clip still holds what the change left. | Pressure cannot be restored because it is not observable. |
| `clip.notes` | persist | `edit_launcher_clip; project save by the operator` (E328, E330) | Full observable fixture equality after save and reopen. | No separate test saved and reloaded one edited clip alone. |
| `clip.existence` | create | `add_launcher_clip` (E330, E320) | Two changes, the empty clip then its content, with an independent read and a new base ref. | An occupied slot refuses (Bitwig would create a new scene past the reachable rows); a missing row refuses. |
| `clip.existence` | delete | `delete_launcher_clip` (E330, E320) | Notes, length, name, colour, loop, and launch settings are recorded first; the slot stays empty. | At most 4 clips per call; a rebuilt clip loses its play-stop marker and automation. |
| `clip.existence` | move-or-copy | `copy_launcher_clips; move_launcher_clips` (E330, E320, E263) | Preflight occupancy of every slot; the copy carries notes, properties, and launch settings; the move carries properties and automation. | Occupied destinations refuse because Bitwig replaces silently; a move is not reversed by revert_change (next.reverse instead). |
| `clip.existence` | revert | `revert_change` (E330, E320) | Removes a clip the change put in an empty slot, or rebuilds a deleted clip from its record. | A clip has no durable identity, so a move is not reversed. |
| `clip.properties` | read | `read_launcher_clip` (E330, E320) | The CLIP record carries length, loop, and name with the notes. | Colour and play start are recorded only by the write tools as prior values. |
| `clip.properties` | write | `set_launcher_clip_properties` (E262, E252) | Readback of each written property; a colour byte may read one off and is verified within that tolerance. | Bitwig lightens a very dark colour (black reads back 81,81,81) and the result is differs; at most 8 clips per call. |
| `clip.properties` | revert | `revert_change` (E262) | Puts back only the properties the change wrote. | A later change to another property stays. |
| `clip.launch-settings` | write | `set_launcher_clip_launch_settings` (E237, E272) | Prior values recorded; the connection confirms at most 8 clips in one write. | Does not configure Next Actions and does not start playback. |
| `clip.launch-settings` | revert | `revert_change` (E237) | Restores the recorded grid and mode. | A value a person changed since stays. |
| `clip.playback-start` | write | `launch_clip` (E247, E234) | Reads whether the clip is queued or playing after the launch; that result is the only playback-state read. | There is no normal transport stop and no standalone playback-state read; the operator stops playback. |
| `clip.editor-view` | write | `show_launcher_clip_in_detail_editor` (E259, E237) | Opens the clip, requests the edit layout, and fits the content. | A scene or project change during the call refuses with target-changed; no project content changes. |
| `midi.file` | read | `read_midi_file` (E265, E269) | A complete desired document with tempo-map integration, FIFO note pairing, and counted omissions. | Format 2, SMPTE timing, unmatched notes, and normalized collisions refuse; controllers and pitch bend are omitted. |
| `midi.file` | create | `write_midi_file` (E265, E267) | Exported bytes are read again; readback.status verified, differs, or unavailable. | An existing destination refuses with occupied; loops and unsupported fields need acceptLoss. |
| `device.order` | read | `read_devices` (E330, E320) | Complete top-level order with name and enabled state; coverage states bank size and completeness. | A partial view is not evidence that the hidden tail is empty; read again after each structural edit. |
| `device.order` | create | `add_devices` (E330, E320, E264) | Each insertion reads the complete order first and is proved by readback. | A relative preset path, another extension, or a missing file refuses because the host accepts all three and does nothing; about 1 s per device. |
| `device.order` | delete | `delete_device` (E330, E320) | Fresh complete read, higher positions first, readback lists removed layer chains. | A layer chain cannot be deleted by a typed route; at most 10 devices per call. |
| `device.order` | move-or-copy | `move_devices; copy_devices` (E330, E320, E262) | Complete source and destination structure read first; the same instance after a move; readback of the final order and touched chains. | Two devices with one name refuse (no reading could tell the move from no move); revert_change neither moves back nor removes a copy. |
| `device.order` | revert | `revert_change` (E330, E264) | Deletes the added device at its position with an order guard. | Deletes, moves, and copies are not reversed; adds on one track revert newest first or refuse. |
| `device.order` | persist | `add_devices; compose_devices; project save by the operator` (E328, E330) | Full observable fixture equality after save and reopen. | No separate test saved and reloaded one structural change alone. |
| `device.enabled` | read | `read_devices` (E330, E320) | Enabled state is part of the device order read. | Devices past the bank window are not read. |
| `device.enabled` | write | `set_device_enabled` (E330, E320) | Order guard before each setting and independent readback of each state. | A position is valid only until the next device-order edit; at most 32 settings per call. |
| `device.enabled` | revert | `revert_change` (E330, E320) | Restores the previous state while the position is valid. | After a device-order edit the position guard refuses. |
| `device.controls` | read | `read_device_controls` (E330, E320, E254) | Complete stable DirectParameter inventory, or visible remote pages; distinguishes missing target, unreachable bank, and unstable reading. | An empty plug-in list means the engine is off or the plug-in is unloaded; display text can arrive late (displayComplete false). |
| `device.controls` | write | `set_device_controls` (E330, E320, E254) | Complete inventory readback for each DirectParameter write; an unrequested change stops the cohort. | A semantic value request returns unsupported before any read; at most 64 settings on 4 routes; about 2.3 s for one Polysynth control. |
| `device.controls` | revert | `revert_change` (E330, E320) | Restores the base value while the device route is valid. | A route invalidated by a structural edit refuses. |
| `container.layer-chains` | read | `read_devices` (E330, E320) | Each container lists its layer chains with name, solo, mute, volume, pan, colour, and ordered devices. | A device after position 2 reports layerChains outside-limit. |
| `container.layer-chains` | create | `compose_devices` (E330, E320, E247) | Complete request validation before the first write; readback of the complete structure; native composition offline or guarded host stages. | A five-chain shape can exceed the six-unit budget; the final container position must be 0 through 2. |
| `container.layer-chains` | move-or-copy | `duplicate_layer_chain; copy_devices` (E238, E264) | A fresh container read proves the copy and its position. | No typed route deletes one layer chain, so revert_change cannot remove the copy; at most 5 chains per container. |
| `container.layer-chains` | write | `rename_layer_chain; set_layer_chain_solo` (E270, E238) | A fresh container read proves the new name or solo state. | A blank, used, or ambiguous name refuses; there is no automatic reversal for either tool. |
| `container.layer-chains` | revert | `revert_change` (E330, E320) | Reverses the whole composition: moved devices go back and only owned sources and the owned container are removed. | Duplicate, rename, and solo have no automatic reversal. |
| `modulator.catalog` | read | `list_modulator_types` (E239, E96) | Each supported type with operations, sampled standing, witness mode, and provenance; each excluded type with a reason. | The host inventory is the 6.0.6 census, not a new census of 6.1.4. |
| `preset.modulation` | read | `read_preset_modulation` (E330, E323, E324) | Fingerprint, structure, modulator locations, and complete inventories; an ambiguous structure is unsupported, never guessed. | An unresolved target is marked, not resolved. |
| `preset.modulation` | write | `edit_preset_modulation` (E330, E323, E324) | Pre-write checks, then an exact inserted-host or remote-page check after insertion; the route claim, not the sound. | A tier-1-only type refuses on a sampled preset; enabled state, mode, and scale source are not editable. |
| `preset.modulation` | revert | `revert_change` (E330, E323) | Removes only the inserted device while its last proved position is valid. | The saved preset file was never changed, so there is nothing to restore there. |
| `preset.modulation` | persist | `edit_preset_modulation; project save by the operator` (E329, E330) | Before and after persistence observations and restored fixture equality after reopen. | Not every donor was revalidated on 6.1.4. |
| `device.modulation-wrap` | write | `wrap_existing_device_modulation` (E252, E262, E91) | Parent-child edge, enabled state, and parameter-base fingerprint proved after the move. | 16 modulators refuse (remote-page window); opaque state is preserved by instance identity, not by byte readback. |
| `device.modulation-wrap` | revert | `reverse_existing_device_modulation_wrap` (E252, E91) | Moves the same device back to its prior position and removes only the empty owned container. | A change by another writer refuses before the affected stage; a partial reversal never removes a container that still holds the device. |
| `grid.admission` | read | `check_grid_support` (E343) | An accepted doctor record for the exact jar fingerprint and connected host version. | Two accepted builds do not establish automatic future-build compatibility; no normal Grid write tool exists. |
| `audio.capture` | create | `brain/src/audio/ (audio-capture module); Bitwig MasterRecorder` (E125) | Recorder ownership, saved-project association, file settlement, SHA-256, and sample range. | 788 ms lead and 273 ms tail; not an isolated track stem; 2 to 32 beats from beat zero on a quarter-beat grid. |
| `audio.facts` | read | `brain/src/audio/ (audio-facts module)` (E124) | Facts tied to verified bytes, channel scope, and sample range. | Stereo 24-bit PCM WAVE at 44.1 kHz only, at most 16 MiB, range 0.05 to 60 s. |
| `write.readback` | write | `every write tool; readback.status (brain/src/surface/readback-unavailable.test.ts)` (E258, E254, E330) | Independent readback after each write; verified, differs, and unavailable are distinct; recorded effects are kept when readback fails. | Does not identify who caused a concurrent external delta; modulation behavior is not sampled on each default call (E254). |
| `write.selection` | write | `durable trackId, route guards, owned pinned cursors, selection leases (brain/src/adapters/live/adapter.ts)` (E258, E77, E99, E250) | A write does not rely on the person's entry selection; slot and mixer selection are restored for the proved operations, with a mixer-selection-moved warning otherwise. | chain.create leaves device-layer selection unrestored; a person's mixer click inside the write turn can be replaced (E258). |
| `write.basis` | write | `read_launcher_clip; edit_launcher_clip; check_launcher_clips` (E233, E235, E236, E253, E260, E330) | The base ref binds an edit to observed content; note identities support targeted changes; invalid document input returns repair information. | Claims and overlays stay local to one server session; a new server session cannot use them (E260). |
| `write.destructive-separation` | delete | `delete_track; delete_scene; delete_device; delete_launcher_clip (D20)` (E264, E330) | Destructive verbs are separate directed tools; each reads the current structure first and refuses a target that moved. | A revert can itself remove an object (E264); a group delete removes its children. |
| `cost.ledger` | read | `context/contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md; brain/src/surface/call-budget.test.ts` (E330, E248, E247) | Per-tool wire-call budgets are tested; measured cost rows name build, workload, and boundary; D44 limits follow measurements. | No comparable workload was run against another server; grouped-note and Grid-research timing comparisons are unresolved (E330). |
| `descriptions.versioning` | read | `TOOL_DESCRIPTION_VERSION ghostnote-description-v53; context/evidence/data/phase9b-doctor/9b7-tool/descriptions-v53.json` (E343) | A separate description cohort with a public artifact and consumer tests; a changed description bumps the version. | Versioning does not prove that a client understood the current wording; no client trial of v53 is recorded. |

## Boundaries that change feature scoring

- `check_grid_support` is an admission read. No product Grid edit tool exists yet.
- `launch_clip` starts a Launcher clip. There is no normal transport stop tool.
- Track listing includes children of collapsed groups. Group creation and
  complete group editing are different capabilities. The `add_tracks`
  description says Bitwig has no route for Hybrid, Group, or Effect tracks.
  Its source, E239, names `Application.createEffectTrack` as not measured, so
  that sentence overstates for Effect tracks. Group creation has typed-proxy
  research (E221, `branch.createParentTrack`) and a named-action result that
  D13 forbids (E16j). A pinned source calls both routes. SM-7 holds the
  measurement.
- Track mixer tools exclude Master. They expose volume, pan, mute, and solo.
- Device parameter control does not imply physical-unit input, automation
  authoring, remote-page authoring, or general modulator creation in place.
- MIDI-file conversion does not imply `.bwclip` import or live audio editing.
- Capture and audio analysis have module evidence, but no tool in this list.
- A change record does not guarantee a complete inverse. Read each tool's
  fidelity and removal contract.

See the six feature-area files in [the input index](README.md) for limits,
sources, and candidate work. The number of tools is not a feature score.
