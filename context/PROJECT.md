---
title: ghostnote project context
kind: project
state: active
updated: 2026-10-08
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
- Writes pass through one executor and stash boundary with readback verification,
  concurrency reporting, and fidelity-aware reversal.
- The default tool profile is `agent-native-v1` (D40): 39 tools on one
  address, health, result, and error vocabulary. `stable-v1` is the frozen
  rollback through 8i.
- Launcher clips are read and edited as Ghostnote Document 1.0 documents:
  `read_launcher_clip` returns a base ref, and `edit_launcher_clip` takes a
  sparse patch or a desired document against it (D21, D25). Every read is a
  fresh `clip.read` capture; a reference that is not `current` refuses (D32).
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
