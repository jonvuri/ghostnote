---
title: Phase 7d — Audio facts and sensory packets
kind: plan
state: complete
status: Complete. Verified local audio facts route through sensory v1; 7e is next.
updated: 2026-09-23
parent: README.md
prev: 7c-follow-up-automatic-user-guide-cache.md
next: 7e-audio-capture-and-analysis-composition.md
---

# Phase 7d — Audio facts and sensory packets

## Purpose

Implement the selected E105 facts and the minimal 6h sensory packet as an
independent file-analysis module. It must work without Bitwig or audio capture.

## Work completed

1. Added stable, bounded local-file verification before executable discovery
   and after analysis.
2. Added a typed FFprobe/FFmpeg adapter with independent discovery, deadlines,
   cancellation, bounded output and temporary copies of retained bytes.
3. Added selected loudness, 85% rolloff, crest and thresholded-silence facts.
   No selected task needs librosa, so no Python worker starts.
4. Added pure sensory v1 routing for brightness, loudness, crest and silence.
5. Preserved source, permission, provider, formula, unit, tolerance and complete
   selected coverage in each field.
6. Added controlled success, refusal, source-change, provider-failure and
   comparison-compatibility fixtures.
7. Reproduced the E118 brightness, loudness, crest and silence controls through
   the real adapter without a Bitwig connection.

## Result

[E124](../../evidence/experiments/e124-audio-facts-and-sensory-packets-connect-verified-files.md)
records the contracts, retained source hashes, real provider results, timings
and cleanup. It closes supplied-file S12, audio S13 and the audio part of S17.
Capture-to-artifact S12 remains 7e work.

The silence gate uses -90 dBFS and a 0.05-second minimum interval. It permits at
most one uncovered sample across the complete selected range. This permits low
analog noise; it does not require digital zero. Brightness uses 85% rolloff only
when the pair is level-matched within 0.2 LU.

## Acceptance record

| Criterion | Result |
|---|---|
| Fact metadata | Each fact includes source and permission identity, provider versions, unit, kind, coverage, formula/settings and tolerance. |
| Provider isolation | Missing or timed-out executables degrade only audio capability. Another registered module stays available. |
| Silence | Thresholded complete-range silence sets dependent loudness and rolloff to null. No pitch or perceptual label exists. |
| Diagnostics | No diagnostic image is part of `audio-facts-v0`. |
| Independent file analysis | The module-only E124 run uses verified temporary files and no Bitwig connection. |
| Verification | The 19 focused tests, full brain check, context check, real FFmpeg probe and diff check pass. |

## Verification cost

Nine-source verification took 5.650 ms. One-time executable discovery took
75.336 ms. Requests took 87.488–249.168 ms. Four sensory routes took 1.076 ms
inclusive. E124 keeps provider processes, output validation and final path
verification separate. These values are one-machine observations, not an SLA.

## Out of scope

- Capturing audio from Bitwig.
- A perceptual-label provider.
- Broad metrics that did not improve a 6h task.
- A stable public contract.

## Retrospective

Rolloff justified its provider cost only for the level-controlled brightness
task. Crest, loudness and silence routes did not start it. Review also made the
one-sample silence allowance global, linked request cancellation to startup,
and preserved provider timeout codes.
