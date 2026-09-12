---
title: Phase 7 — Workstation dogfood iteration
kind: plan
state: planned
status: Starts after Phase 6 selects the first composed workstation surface.
updated: 2026-09-12
parent: ../ROADMAP.md
prev: ../phase-6/README.md
next: ../phase-8/README.md
---

# Phase 7 — Workstation dogfood iteration

## Purpose

Return to real musical work after the Phase 6 exploration. Test the music
workstation as a set of independent modules and as a coordinated system with
computer use.

The loop stays open until the operator closes it. Each run starts in a fresh
projectless chat and records the exact enabled modules and permissions.

## Operating modes

- **Workstation-only:** Use only public Ghostnote workstation modules.
- **Hybrid:** Use Ghostnote for fast operations and feedback. Use computer use
  for visual or open-ended work.
- **Module-only:** Test one documentation, theory, capture, analysis, or Bitwig
  adapter module without requiring the others.

Do not switch modes silently. A computer-use result is UI-observed unless a
workstation module supplies independent semantic evidence. An external UI write
does not become a Ghostnote-owned reversible change.

## First session

[7a — workstation dogfood menu](7a-workstation-dogfood-menu.md) owns the first
session and the continuing menu. Select one real musical goal at run time. The
hybrid three-voice preset orchestration is the preferred first retry when Phase
6 makes the required feedback path available.

## Loop rules

1. State the musical goal, operating mode, allowed tools, and acceptance criteria.
2. Capture a bounded project baseline through the Bitwig adapter.
3. Use the fastest reliable module for each operation. Do not reproduce a bulk
   operation through repeated UI gestures.
4. Keep Ghostnote and computer-use actions serialized.
5. Label evidence as programmatically verified, UI-observed, model-classified,
   or operator-confirmed.
6. Make subjective results auditionable. Record acceptance only after an
   explicit operator verdict.
7. Preserve accepted material. Reverse or remove rejected owned material only
   when the recorded boundary makes that safe.
8. Record latency, tool calls, operator intervention, incorrect targets,
   verification cost, and unsupported boundaries.

## Close condition

Close the loop only on an explicit operator request. Hand the selected release
or breadth work to Phase 8.
