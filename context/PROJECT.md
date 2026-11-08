---
title: ghostnote project context
kind: project
updated: 2026-10-26
---

# ghostnote

ghostnote is a personal Bitwig Studio MCP server: a thin Java extension and a
TypeScript brain that let an agent author music through a typed, verifiable
surface without relying on the user's UI selection.

## Current architecture

- The system is stateless across clients; the Bitwig project is the durable take
  log. There is no daemon and no persistent take graph.
- The extension owns observers and durable project-facing identity. The MCP
  server owns its bridge connection.
- Addressing uses stable identity where Bitwig exposes it and bounded positional
  addressing for clips/scenes, which have no durable identity.
- Existing writes use the executor and stash with readback verification,
  concurrency reporting, and fidelity-aware reversal. D54 makes custom recovery
  optional for new capabilities; [P01](BACKLOG.md) assesses existing costs.
- The default tool profile is `agent-native-v1` (D40): 47 tools on one
  address, health, result, and error vocabulary, descriptions v66. The 8i
  gate is closed (E272); `stable-v1` is the frozen rollback until its
  [C01 removal](BACKLOG.md). `check_grid_support` reports the Grid admission
  gate (D52, E343); the product refuses native Grid writes without an
  accepted doctor record for the jar fingerprint.
- Launcher clips are read and edited as Ghostnote Document 1.0 documents:
  `read_launcher_clip` returns a base ref, and `edit_launcher_clip` takes a
  sparse patch or a desired document against it (D21, D25). Every read is a
  fresh `clip.read` capture; a reference that is not `current` refuses (D32).
  `get_document_reference` returns the format reference and templates with
  no host call, and a refused document returns a repair (E255).
  `add_launcher_clip` takes overlay claims in one call and binds them to the
  new clip (D47). The document writers take `documentPath` and the readers
  take `documentOutputPath`, so a large document stays out of the
  conversation (D51). `read_midi_file` and `write_midi_file` convert MIDI
  files offline, with no host call (D50). `list_launcher_slots` lists the
  occupied slots of every addressable track in one host call (D71).
- Track mixers are read and set in exact dB, pan, mute, and nonexclusive
  solo on durable track IDs (`read_track_mixer`, `set_track_mixer`, D48).
  The volume unit is the host raw value; automation refuses before a write.
- A write whose readback read fails reports `unavailable` and keeps its
  effect; clip and track writes restore the person's selection or warn
  (E258).
- Device branching uses ordinary layer-chain operations (`compose_devices`,
  `duplicate_layer_chain`, `set_layer_chain_solo`, `move_devices`, D18). There
  is no managed device-alternate lifecycle in the default profile.
- Track duplication is ordinary typed CRUD. It is observable as a session change
  but receives no managed-take lineage or lifecycle semantics.
- Tool names and descriptions are versioned and observed. They begin light rather
  than implementing the retired three-way dispatch classifier.
- Native Bitwig undo remains the human's. Reversal of agent edits belongs to
  ghostnote and is bounded to changes it can identify and restore safely.
- Destructive initiative is zero. Directed destructive operations are separated
  behind the D20 tool seam.
- The agent owns generation and transformation. The Phase 2 musical patch
  grammar and its background operations stay on `stable-v1` only. In
  `agent-native-v1` every write is a direct call; the largest clip edit takes
  about 7 s (E247, E248). Writer cursors have the reader width (D41).
- A clip property write sets only the changed fields. Any RGB colour is
  accepted and verified within one byte (D42, E249).
- The [performance ledger](contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) holds
  the measured cost and the call budget of each tool.
- The Phase 4 device surface discovers arbitrary DirectParameter ids, keeps
  native, VST3, CLAP, and preset sources explicit, and verifies scalar writes,
  bypass, insertion, and directed deletion by readback.
- `resolve_device_name` (V14, E351) turns one exact stock-device, VST3, CLAP,
  or Bitwig-preset name into an `add_devices` source from the running host's
  installation, preferences, plug-in indexes, and content locations, with no
  Bitwig call and explicit coverage. A name in two kinds or locations is
  ambiguous until `sourceKind` or `root` selects one.
- Device positions are not identities. Managed chain work uses complete
  name-and-enabled guards and keeps mint provenance separate from current
  observed position.
- Modulator topology is authored by tested `.bwpreset` surgery through `bwmod`.
- The public authoring surface uses named modulator operations and one
  `compose_devices` operation with a private offline and a staged backend.
  Binary format, donor, route, and asset controls stay below the public
  boundary.
- Read-only preset inspection binds public device and entry paths to complete
  modulator inventories. It returns a file fingerprint for later guarded writes.
- The product ships one provenance-recorded four-entry template. The composer
  can retain one through four entries. A separate one-entry seed supports typed
  live duplication.

## Stable constraints

- Identity, never mutable bank index, is the basis of track addressing.
- Bank windows are explicit resource budgets; operations outside observable
  windows refuse rather than guess.
- Correctness claims require readback or controlled live evidence.
- Named actions are not a product escape hatch. E22 proved `Group` follows
  unobservable primary focus and can misdispatch into a device chain.
- Mechanical functionality is autonomous: required assets are provisioned at
  build time, never authored or primed by the operator at runtime.
- Refusals should be predictable and actionable; description changes follow
  repeated cross-session evidence unless safety demands immediate containment.

For exact wording and amendments, use the [decision index](decisions/INDEX.md).
For product sequencing, use the [roadmap](plan/ROADMAP.md). The original project
plan and pre-spike prompt are retained in [archive](archive/README.md).
