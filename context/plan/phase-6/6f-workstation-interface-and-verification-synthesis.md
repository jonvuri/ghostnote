---
title: Phase 6f — Workstation interface and verification synthesis
kind: plan
state: planned
status: Next. Select module interfaces and prepare the Phase 7 dogfood surface.
updated: 2026-09-13
parent: README.md
prev: 6e-semantic-music-analysis-and-manipulation.md
---

# Phase 6f — Workstation interface and verification synthesis

## Purpose

Combine the Phase 6 results into independent workstation interfaces. Define the
smallest safe surface for Phase 7 dogfood.

## Starting facts

- E103 proves exact project-local master capture.
- E104 selects exact-version SQLite FTS5 document retrieval.
- E105 selects FFmpeg and a long-lived librosa worker for audio facts.
- E106 through E108 reject the tested perceptual providers.
- E109 selects a private exact-note boundary for structural analysis and
  constrained transforms.
- E110 selects Music21 for private semantic analysis and Musicpy as a voicing
  specialist candidate.

## Work

1. Define small, versioned interfaces for Bitwig operations, documentation,
   note analysis, audio capture, and audio facts.
2. Define artifact identity, provenance, coverage, and failure fields shared by
   the interfaces.
3. Record which Phase 6 probes are retained, replaced, or removed.
4. Finish the verification-cost audit for target guards, settlement, readback,
   recovery, and full-state scans.
5. Define explicit hybrid, Ghostnote-only, computer-use, and operator-verdict
   rules.
6. Prepare a bounded public dogfood menu for Phase 7.
7. Remove generated and live test artifacts.

## Acceptance criteria

- Each module can fail without disabling unrelated modules.
- Each read result declares source identity, provider version, and coverage.
- Each risk-bearing write keeps exact target guards and independent readback.
- The interface does not report model or rule labels as exact facts.
- The operator retains every aesthetic acceptance decision.
- The verification audit classifies costs as essential, reducible, or
  historical.
- Phase 7 receives a small dogfood menu with explicit authority rules.
- No retained live project or test artifact remains.

## Out of scope

- A second production DAW adapter.
- A public perceptual provider.
- Broad theory or audio-analysis tools without a Phase 7 task.
- Removing proved safety checks only to reduce latency.

## Retrospective target

Record which shared field prevented the most adapter-specific special cases.
