---
title: Phase 7e — Audio capture and analysis composition
kind: plan
state: planned
updated: 2026-09-20
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

## Selected implementation boundary

Implement [audio-capture-v0](../../evidence/format/WORKSTATION_CONTRACTS.md)
and close [S11, capture-to-S12, and capture startup in S17](../../evidence/format/WORKSTATION_SEAMS.md).
The current product wire map does not expose `masterRecorder.*`. Add the typed
adapter route and make its version/deployment check explicit. Do not call the
raw probe client from a public tool.

Capture is a state-changing operation. Refuse an already active recorder before
starting. Establish the saved-directory association, control the master source,
and use bounded stop/settle handling. Record known artifacts and uncertain
effects on failure. Use a header reader with an explicit dependency; capture
does not start loudness or librosa analysis. Musical range and sample coverage
remain separate because E103 does not prove sample-exact start/stop alignment.

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
