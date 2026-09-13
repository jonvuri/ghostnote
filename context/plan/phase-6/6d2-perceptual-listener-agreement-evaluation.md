---
title: Phase 6d2 — Perceptual listener-agreement evaluation
kind: plan
state: complete
status: Complete. E113 selects no provider and records the reference blockers.
updated: 2026-09-13
parent: README.md
prev: 6e-semantic-music-analysis-and-manipulation.md
next: 6f-workstation-interface-and-verification-synthesis.md
---

# Phase 6d2 — Perceptual listener-agreement evaluation

## Purpose

Test whether specialist audio models can support useful perceptual feedback.
Measure agreement with people instead of recovery of deterministic signal
facts. Keep aesthetic authority with the operator.

## Starting facts

- E105 owns deterministic audio facts and bounded signal estimates.
- E106 through E108 show that CLAP, GPT-Audio, and Gemini fail factual controls
  or confidence calibration.
- E111 shows that those controls do not measure the target perceptual gap.
- The `genre-popularity` dimensional framework separates audible dimensions
  from cultural, social, and historical genre identity.
- Essentia, AudioCommons Timbral Models, and Cyanite expose specialist outputs
  that map to the target dimensions.
- E112 adds three cheaper routes to the same dimensions: standardized
  psychoacoustic metrics, symbolic tension over the 6e notes, and a small probe
  over a frozen embedding fitted on published listener ratings. It also records
  an arm64 blocker for `essentia-tensorflow` and an ONNX route around it.

## Work

1. Freeze bipolar definitions for valence, arousal, aggression, melodic
   prominence, tonal stability, consonance or dissonance, roughness or
   hardness, warmth, brightness, dance pull, sonic density, and tension arc.
2. Resolve dataset and model licenses before download. Use a bounded MusAV
   subset if its research terms fit. Otherwise, create a Creative Commons
   pairwise cohort with the same method.
3. Build a project cohort from exact Bitwig captures. Cover complete phrases,
   loops, and isolated sounds. Record hash, sample range, channel intent, and
   loudness treatment.
4. Gather at least three blind listener judgments per public or local pair.
   Store operator judgments separately. Include `same` and `unclear`.
5. Measure the free deterministic floor first: MoSQITo psychoacoustic metrics,
   Essentia `MusicExtractor` descriptors, symbolic tension from the 6e notes,
   and stem loudness ratios. Report how far these alone agree with listeners.
6. Run a bounded set of Essentia heads through `onnxruntime`. The arm64 host
   has no working `essentia-tensorflow` build. Start with the VGGish
   arousal-valence heads and the narrow aggressive, danceability, and tonal or
   atonal heads. Add Meta Audiobox-Aesthetics and the AudioCommons attributes
   that MoSQITo does not model.
7. Run Cyanite as the commercial comparison only with approved remote terms,
   bounded cost, and proved deletion. Keep a music-specialist audio-language
   model optional for explanation.
8. Measure pairwise agreement, rank agreement, human-relative gap,
   calibration, selective accuracy, stability, coverage, latency, memory,
   disk, cost, and privacy.
9. Test grounded feedback that uses only passed perceptual scores and E105
   facts. Ask the operator to rate truth, specificity, and usefulness.
10. Select providers per dimension, or record a precise blocker. Do not require
    one provider to cover every dimension.
11. Remove all owned audio, model caches, remote files, and result artifacts.
    Restore the documented Bitwig baseline.

## Evaluation rules

- Pre-register thresholds before provider inference.
- Report every dimension separately.
- Compare provider agreement with a held-out listener baseline.
- Split results by listener consensus, source type, and musical coverage.
- Treat provider scores as uncalibrated until the cohort proves otherwise.
- Refuse silence and properties removed by preprocessing.
- Do not require pitch, onset, or pulse-rate accuracy for selection.
- Never report a model label as an exact fact or operator verdict.
- Keep the control corpus separate from the training corpus of any tested head.
  A head named after DEAM, emoMusic, or MuSe cannot be scored on that corpus.
- Fit pairwise votes with a stated estimator before any absolute score.
- Record the complete license chain. Essentia needs both a library term and a
  model term.

## Acceptance criteria

- Each reference answer contains the complete listener vote distribution.
- Each model result names the exact input bytes, range, preprocessing, model,
  provider version, task schema, and output coverage.
- Pairwise accuracy beats chance for every selected dimension.
- Each selected dimension is within ten percentage points of the median
  held-out listener on the same pairs.
- Bootstrap intervals, low-consensus behavior, and high-confidence errors are
  explicit.
- Alias, order, and lossless-container controls do not cause unexplained
  direction changes.
- Grounded prose contains no unsupported observation and receives a separate
  operator usefulness verdict.
- License, platform, latency, memory, disk, cost, privacy, and deletion limits
  are explicit.
- The result selects replaceable providers per dimension or records a precise
  blocker.
- No retained live project or test artifact remains.

## Out of scope

- Automatic aesthetic acceptance.
- Training or fine-tuning an audio encoder. A linear probe over a frozen
  embedding, fitted on published listener ratings, is in scope and must state
  its training split.
- Complete genre identification from audio.
- Cultural, geographic, social, or historical inference from audio alone.
- A public perceptual tool before the private gate passes.

## Retrospective target

Record which listener-agreement field best predicted useful operator feedback.

## Result

[E113](../../evidence/experiments/e113-loudness-beats-the-affect-head-but-the-reference-gate-blocks-selection.md)
completes the session. Integrated loudness predicted 26 of 27 derived arousal
pair directions. The MuSe affect head predicted 12 of 27. No provider was
selected because the reference was not a direct pair study, loudness was not
controlled, the public audio license chain was incomplete, and other
dimensions lacked matching listener votes. The raw scorers also labeled
silence. All owned test artifacts were removed, and the Bitwig baseline was not
changed.

Reference provenance was the decisive field. No provider reached the grounded
feedback test, so no listener-agreement field could predict operator
usefulness. A future run must collect direct pair votes and control loudness
before it downloads models.
