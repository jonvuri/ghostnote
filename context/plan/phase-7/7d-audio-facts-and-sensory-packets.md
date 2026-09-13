---
title: Phase 7d — Audio facts and sensory packets
kind: plan
state: planned
updated: 2026-09-13
parent: README.md
prev: 7c-documentation-provider.md
next: 7e-audio-capture-and-analysis-composition.md
---

# Phase 7d — Audio facts and sensory packets

## Purpose

Implement the selected E105 facts and the minimal 6h sensory packet as an
independent file-analysis module. It must work without Bitwig or audio capture.

## Work

1. Verify the absolute input path, SHA-256, format, sample range, and channels
   before provider startup.
2. Keep FFprobe and FFmpeg behind a typed executable adapter.
3. Keep librosa in an isolated long-lived worker.
4. Expose only facts and paired deltas selected by the 6h task evidence.
5. Keep exact facts, estimates, agent interpretations, and operator verdicts
   separate.
6. Prove silence, no-change, level-controlled, hash-mismatch, and missing-
   provider behavior with owned fixtures.

## Acceptance criteria

- Every fact has source identity, provider version, unit, result kind,
  coverage, and uncertainty or tolerance.
- A missing provider reduces declared capability without disabling other
  providers or workstation modules.
- Silence does not receive voiced pitch or a perceptual label.
- Diagnostic images do not become numeric or aesthetic facts.
- The module works against verified local files without a Bitwig connection.
- Focused tests, the full brain check, context check, and `git diff --check`
  pass.

## Out of scope

- Capturing audio from Bitwig.
- A perceptual-label provider.
- Broad metrics that did not improve a 6h task.
- A stable public contract.

## Retrospective target

Record which sensory field justified its runtime and token cost.
