---
title: ghostnote project context
kind: project
state: active
updated: 2026-08-10
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
- Branching is the D18 hybrid: track fork, layer chain, and clip block. The agent
  chooses at L3-open; a silent record later compares that choice with a
  deterministic classifier without exposing choice-mapping to the agent.
- Native Bitwig undo remains the human's. Reversal of agent edits belongs to
  ghostnote and is bounded to changes it can identify and restore safely.
- Destructive initiative is zero. Directed destructive operations are separated
  behind the D20 tool seam.
- Modulator topology is authored by tested `.bwpreset` surgery through `bwmod`.

## Stable constraints

- Identity, never mutable bank index, is the basis of track addressing.
- Bank windows are explicit resource budgets; operations outside observable
  windows refuse rather than guess.
- Correctness claims require readback or controlled live evidence.
- Named actions are not a general escape hatch. The one sanctioned group-track
  construction is a measured exception with a forced order.
- Refusals should be predictable and actionable; internal classifier guidance
  must not leak into the agent's choice surface.

For exact wording and amendments, use the [decision index](decisions/INDEX.md).
For product sequencing, use the [roadmap](plan/ROADMAP.md). The original project
plan and pre-spike prompt are retained in [archive](archive/README.md).

