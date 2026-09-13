---
title: Phase 6d — Perceptual audio-model evaluation
kind: plan
state: complete
status: Complete. E106 through E108 reject local CLAP, GPT-Audio, and Gemini.
updated: 2026-09-13
parent: README.md
prev: 6c-deterministic-audio-analysis-tool-survey.md
next: 6e-semantic-music-analysis-and-manipulation.md
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

## Result

[E106](../../evidence/experiments/e106-local-clap-does-not-clear-the-perceptual-provider-gate.md)
rejects two local CLAP checkpoints as a general perceptual provider. Both had
repeatable scores and passed four simple directional controls. The general
checkpoint missed sparse bursts. The music checkpoint classified every input
as silence.

The stereo control forced a correct adapter refusal because both checkpoints
used mono input. At the E106 run, GPT-Audio-1.5 and Gemini 3.8 Flash were
suitable frontier candidates, but the environment had no authenticated
provider. No remote project audio was sent. Keep the provider boundary private
until the exact blind cohort passes on an approved remote account.

[E107](../../evidence/experiments/e107-gpt-audio-fails-blind-controls-and-gemini-is-unavailable.md)
resolves the authentication blocker. GPT-Audio-1.5 repeated the same choices
three times, but it passed only three of five classifications and two of four
supported direction pairs. Gemini 3.8 Flash returned `503 UNAVAILABLE` on
three bounded attempts.

[E108](../../evidence/experiments/e108-paid-gemini-fails-blind-controls.md)
resolves the Gemini service blocker with a paid retry. Gemini completed all 27
requests, but it passed only three of five classifications on each repeat. It
passed two, three, and three of four supported direction pairs, and its three
decision hashes differed. No remote provider is selected.

The session closes without a Qwen API run. The provider survey is not
exhaustive. A future candidate must pass the same blind cohort before the
perceptual boundary can reopen.

[E111](../../evidence/experiments/e111-perceptual-provider-gate-must-measure-listener-agreement.md)
supersedes that last requirement. The factual cohort remains negative evidence
for direct audio perception and confidence calibration. It does not measure
agreement with listeners on the intended perceptual dimensions. Phase 6d2
reopened the private evaluation with a human-agreement gate and specialist
classifiers. [E113](../../evidence/experiments/e113-loudness-beats-the-affect-head-but-the-reference-gate-blocks-selection.md)
completes that evaluation without selecting a provider.
