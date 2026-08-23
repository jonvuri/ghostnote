---
title: ghostnote project context
kind: project
state: active
updated: 2026-08-22
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
- Managed takes use two project-native representations: layer chains for device
  alternates and launcher clip blocks for clip alternates. Mixed instructions may
  create both independently; no compound-take linkage is promised.
- Track duplication is ordinary typed CRUD. It is observable as a session change
  but receives no managed-take lineage or lifecycle semantics.
- Tool names and descriptions are versioned and observed. They begin light rather
  than implementing the retired three-way dispatch classifier.
- Native Bitwig undo remains the human's. Reversal of agent edits belongs to
  ghostnote and is bounded to changes it can identify and restore safely.
- Destructive initiative is zero. Directed destructive operations are separated
  behind the D20 tool seam.
- The Phase 2 musical surface uses one versioned patch grammar for generation
  and transformation. Long musical work has explicit background completion and
  cooperative cancellation.
- The Phase 4 device surface discovers arbitrary DirectParameter ids, keeps
  native, VST3, CLAP, and preset sources explicit, and verifies scalar writes,
  bypass, insertion, and directed deletion by readback.
- Device positions are not identities. Managed chain work uses complete
  name-and-enabled guards and keeps mint provenance separate from current
  observed position.
- Modulator topology is authored by tested `.bwpreset` surgery through `bwmod`.

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
