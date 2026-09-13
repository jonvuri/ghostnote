---
title: Phase 6d — Perceptual audio-model evaluation
kind: plan
state: planned
status: Next. Test bounded perceptual classification and directional judgment.
updated: 2026-09-12
parent: README.md
prev: 6c-deterministic-audio-analysis-tool-survey.md
---

# Phase 6d — Perceptual audio-model evaluation

## Purpose

Determine whether audio-capable models add reliable perceptual feedback to the
deterministic facts from E105. Keep aesthetic authority with the operator.

## Starting facts

- E103 supplies one exact project-local WAV route.
- E105 supplies deterministic signal, spectral, temporal, pitch, stereo, and
  modulation facts with explicit coverage and units.
- GPT-5.6 Sol does not accept audio. Use an explicit audio-capable provider.
- Model output is a judgment. It is not an exact signal fact.

## Work

1. Define blind controlled A/B tasks for classification and directional change.
2. Include simple synthetic controls and bounded Bitwig captures with exact
   source identity.
3. Compare suitable frontier audio models and smaller music-focused models.
4. Record model version, prompt, input range, latency, cost, privacy boundary,
   repeatability, refusal behavior, and platform boundary.
5. Compare each judgment with deterministic E105 facts where they apply.
6. Keep operator audition verdicts separate from model responses.
7. Select a replaceable provider boundary or record a precise blocker.
8. Remove every owned audio and generated result artifact after the proof.

## Acceptance criteria

- Every model result names its exact input bytes, range, prompt, model, and
  provider version.
- Blind labels prevent file names or ordering from revealing the answer.
- Repeated classification and directional results have measured agreement.
- Deterministic facts, model judgments, and operator verdicts remain separate.
- Latency, cost, privacy, failure behavior, and platform limits are explicit.
- The result selects a bounded provider interface or records a precise blocker.
- No retained live project or test artifact remains.

## Out of scope

- Automatic aesthetic acceptance.
- Training or fine-tuning a model.
- A public perceptual-analysis tool before the provider boundary passes.
- Replacing deterministic E105 facts with model estimates.

## Retrospective target

Record which blind control best exposed an unsupported model claim.
