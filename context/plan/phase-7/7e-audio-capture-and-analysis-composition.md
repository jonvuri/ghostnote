---
title: Phase 7e — Audio capture and analysis composition
kind: plan
state: planned
updated: 2026-09-13
parent: README.md
prev: 7d-audio-facts-and-sensory-packets.md
next: 7f-hybrid-workstation-dogfood.md
---

# Phase 7e — Audio capture and analysis composition

## Purpose

Implement the E103 MasterRecorder boundary as an independent capture module.
Compose one exact capture with the 7d file-analysis module without coupling
their lifecycles or failures.

## Work

1. Require a known saved project directory before capture starts.
2. Snapshot the project-local recording directory and control the exact source
   and musical range.
3. Start, observe, stop, and settle MasterRecorder through the typed Bitwig
   adapter.
4. Accept exactly one new stable lossless audio artifact. Refuse zero, multiple,
   changed, or unsettled candidates.
5. Return artifact identity without starting an analysis provider.
6. Pass the verified artifact explicitly to 7d in a separate composed call.
7. Prove capture-only, analysis-only, capture-failure, and analysis-failure arms.

## Acceptance criteria

- Capture and analysis have separate contracts, capabilities, and failures.
- The artifact includes source, range, path, format, channels, sample rate,
  duration, byte count, hash, and provider versions.
- An unsaved or unknown project path refuses before recording.
- Capture failure does not disable file analysis. Analysis failure does not
  hide or misidentify a successful capture.
- Owned live and filesystem artifacts are removed after the proof.
- Focused tests, the full brain check, extension tests, required live checks,
  context check, and `git diff --check` pass.

## Out of scope

- System loopback capture.
- Automatic analysis inside the capture provider.
- Perceptual labels or aesthetic acceptance.
- A stable public contract.

## Retrospective target

Record which explicit artifact field kept capture and analysis independent.
