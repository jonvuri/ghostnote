---
title: Phase 6c — Deterministic audio-analysis tool survey
kind: plan
state: complete
status: Complete. E105 selects FFmpeg and a long-lived librosa worker.
updated: 2026-09-12
parent: README.md
prev: 6b-exact-version-offline-documentation-retrieval.md
next: 6d-perceptual-audio-model-evaluation.md
---

# Phase 6c — Deterministic audio-analysis tool survey

## Purpose

Select small independent providers for deterministic facts about captured
audio. Measure established local tools before Ghostnote adds an analysis
implementation.

## Starting facts

- E103 proves a host-native route to one exact project-local WAV.
- Each capture has exact identity, source range, format, and hash.
- `ffmpeg` and `ffprobe` are installed and already supplied format and level
  evidence in session 6a.
- Analysis must remain independent of perceptual or aesthetic judgment.

## Work

1. Define a small controlled audio cohort with silence, tones, impulses,
   transients, stereo differences, and one bounded Bitwig capture.
2. Compare `ffmpeg`, spectrogram generation, and mature local libraries for
   signal, spectral, temporal, pitch, stereo, and modulation facts.
3. Record license, platform support, release activity, startup cost, query
   latency, memory, disk cost, determinism, and failure behavior.
4. Require exact source identity and explicit units for every result.
5. Compare results with known signal construction and at least one independent
   check. State tolerances before the run.
6. Select small replaceable provider interfaces or record a precise blocker.
7. Remove every owned audio and generated analysis artifact after the proof.

## Acceptance criteria

- Each selected fact has a typed unit, coverage statement, and measured error
  or tolerance.
- The result separates exact signal facts from estimates and model judgments.
- Repeated analysis of the same bytes is deterministic.
- Latency, memory, disk footprint, startup cost, and failure behavior are
  measured.
- Provider licenses and platform boundaries are explicit.
- The result selects independent provider boundaries or records precise
  blockers.
- No retained live project or test artifact remains.

## Out of scope

- Perceptual model evaluation or aesthetic acceptance.
- A public audio-analysis tool before the provider boundary passes.
- Changes to the session 6a capture route.
- Music-theory analysis of project notes.

## Retrospective target

Record which independent signal check caught the most misleading tool output.

## Result

[E105](../../evidence/experiments/e105-ffmpeg-and-librosa-form-the-audio-fact-boundary.md)
selects two private provider boundaries. Use `ffprobe` and `ffmpeg` for exact
stream identity, signal aggregates, silence, spectral rolloff, and diagnostic
spectrograms. Use a long-lived librosa worker for voiced pitch, onsets, stereo
correlation, and amplitude-modulation rate.

All selected facts passed their declared tolerances and repeated three times
with stable result hashes. Essentia passed most accuracy checks but had a
31-second import and a restrictive license boundary. Aubio did not build in the
current Python and NumPy environment. No public tool or audio artifact remains.

The digital-silence fixture caught the most misleading output. Raw YIN returned
a numeric pitch for silence. The selected pYIN route requires voiced state and
returns null for that input.

Session 6d is next.
