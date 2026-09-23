---
title: Phase 7d — Audio facts and sensory packets
kind: plan
state: planned
updated: 2026-09-21
parent: README.md
prev: 7c-follow-up-automatic-user-guide-cache.md
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
3. Keep optional worker startup isolated. Add a long-lived librosa worker only
   when a selected task requires one of its E105 fields.
4. Expose only facts and paired deltas selected by the 6h task evidence.
5. Keep exact facts, estimates, agent interpretations, and operator verdicts
   separate.
6. Prove silence, no-change, level-controlled, hash-mismatch, and missing-
   provider behavior with owned fixtures.

## Selected implementation boundary

Implement [audio-facts-v0 and sensory v1](../../evidence/format/WORKSTATION_CONTRACTS.md).
Close [S12, S13 and the audio part of S17](../../evidence/format/WORKSTATION_SEAMS.md).
The first file comparison uses FFmpeg/FFprobe and the E118 loudness, rolloff,
crest, and silence fields. It needs no librosa field or Bitwig connection.

Validate bytes before startup and after analysis. Record channel, sample and
frame coverage, exact formula/settings, unit, provider version, and tolerance.
Convert the probe's inclusive sample descriptions to structured exclusive ends.
Revise the frozen `ghostnote-sensory-packet-v0` into a v1 projection of the
returned facts. Do not create a second measurement provider or exact-note store.
Reject incompatible pairs and unmapped properties before broad analysis.

## Verification cost

Use the [6j operation and timing rules](../../evidence/format/WORKSTATION_VERIFICATION.md)
for this session. Measure implemented seam costs separately from host/provider
work. Keep unknown costs explicit. Any proposed reuse must pass its
[equivalent-evidence brief](VERIFICATION_REDUCTIONS.md).

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
