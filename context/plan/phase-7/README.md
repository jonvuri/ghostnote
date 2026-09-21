---
title: Phase 7 — Workstation dogfood iteration
kind: plan
state: planned
status: Ready. Contracts and verification rules are selected; start 7a.
updated: 2026-09-21
parent: ../ROADMAP.md
prev: ../phase-6/README.md
next: ../phase-8/README.md
---

# Phase 7 — Workstation dogfood iteration

## Purpose

Return to real musical work after the Phase 6 exploration. Implement one
independent module boundary at a time and test it with the host agent. Then test
the selected modules as a coordinated system with computer use.

The loop stays open until the operator closes it. Each run starts in a fresh
projectless chat and records the exact enabled modules and permissions.

## Surface states

- **Stable:** Existing public Ghostnote tools and their current compatibility
  promises.
- **Experimental:** Explicitly enabled Phase 7 dogfood tools. Their names,
  schemas, and presence can change after a run.

E110 blocks theory providers from the stable public surface until real tasks and
failure handling pass. Phase 7 uses experimental surfaces for that proof. A
successful dogfood run does not graduate a tool automatically.

## Operating modes

- **Stable-only:** Use only the existing stable Ghostnote surface.
- **Experimental workstation:** Use only the explicitly enabled Ghostnote
  modules and no computer use.
- **Hybrid:** Use Ghostnote for fast operations and feedback. Use computer use
  for visual or open-ended work.
- **Module-only:** Test one documentation, theory, capture, analysis, or Bitwig
  adapter module without requiring the others.

Do not switch modes silently. A computer-use result is UI-observed unless a
workstation module supplies independent semantic evidence. An external UI write
does not become a Ghostnote-owned reversible change.

## Interface discipline

Use the [6i contracts](../../evidence/format/WORKSTATION_CONTRACTS.md),
[interface inventory](../../evidence/format/WORKSTATION_INTERFACES.md), and
[seam map](../../evidence/format/WORKSTATION_SEAMS.md) as the Phase 7 baseline. Each
session must name the versions of every custom format that it accepts and
emits. A new format needs a distinct purpose, owner, authority, version,
failure rule, and conformance fixture. Do not add one when an existing format
already owns the same boundary.

Test each implemented seam with producer output that the real consumer accepts.
Keep projections and translations explicit. Do not silently treat the agent
context, agent proposal, deterministic public patch, exact-state record, or
extension wire format as interchangeable. Phase 7f reviews the complete
composition again with real work.

Start with complete exact state and compact context. Add the four-operation
agent proposal compiler next. Retain the deterministic musical v1 grammar and
existing write protections. Revise sensory packets to v1 as projections of
typed facts. Reference context reuses the same context and evidence boundaries.
Standalone groove proposals, broad theory, Musicpy, and librosa startup need a
selected task before implementation. No perceptual model is selected.

## Verification and timing

Apply the [6j operation rules](../../evidence/format/WORKSTATION_VERIFICATION.md)
to each selected task. Read-only providers do not need write settlement or a
reversal stash. Live reads still need target/coverage checks, grid/page settlement
and safe selection restoration. Agent writes retain exact validation, guards, independent
readback and partial-effect records. Capture returns an artifact before separate
analysis. Record cold/warm, host, provider and format spans without double counting.

The [reduction briefs](VERIFICATION_REDUCTIONS.md) are optional successors, not
permission to omit current checks. New module latency remains unknown until its
real producer/consumer connection exists. Record the advertised note-reader
width; the old 1.6–1.8 second exact-read results precede fine-grid expansion.

## Session order

1. [7a — symbolic context and read-only analysis](7a-symbolic-context-and-read-only-analysis.md).
2. [7b — agent patch execution and reference dogfood](7b-agent-patch-execution-and-reference-dogfood.md).
3. [7c — documentation provider](7c-documentation-provider.md).
4. [7d — audio facts and sensory packets](7d-audio-facts-and-sensory-packets.md).
5. [7e — audio capture and analysis composition](7e-audio-capture-and-analysis-composition.md).
6. [7f — hybrid workstation dogfood](7f-hybrid-workstation-dogfood.md).

The [workstation dogfood menu](MENU.md) remains a living task list. Pull a later
session forward only when an earlier result makes it the smaller or more useful
next proof. Keep read-only and risk-bearing implementation scopes separate.

## Loop rules

1. State the musical goal, operating mode, allowed tools, and acceptance criteria.
2. Capture a bounded project baseline through the Bitwig adapter.
3. Use the fastest reliable module for each operation. Do not reproduce a bulk
   operation through repeated UI gestures.
4. Keep Ghostnote and computer-use actions serialized.
5. Label evidence as exact, derived, agent-interpreted, UI-observed, or
   operator-confirmed.
6. Make subjective results auditionable. Record acceptance only after an
   explicit operator verdict.
7. Preserve accepted material. Reverse or remove rejected owned material only
   when the recorded boundary makes that safe.
8. Record latency, tool calls, operator intervention, incorrect targets,
   verification cost, and unsupported boundaries.
9. Record each custom format version that crossed a module seam and any
   projection, translation, default, or loss at that seam.

## Close condition

Close the loop only on an explicit operator request. Graduate experimental
interfaces one at a time after real-task and failure evidence. Hand selected
release or breadth work to Phase 8. Do not graduate an interface until its
producer and consumer pass the documented seam contract.
