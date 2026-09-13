---
title: E111 — The perceptual provider gate must measure listener agreement
kind: evidence
state: active
updated: 2026-09-13
parent: ../../plan/phase-6/6d2-perceptual-listener-agreement-evaluation.md
---

# E111 — The perceptual provider gate must measure listener agreement

## Verdict

Reopen the private perceptual-provider evaluation with a new gate. The E106
through E108 gate mostly tested facts that E105 already supplies. Those results
still show weak direct audio perception and poor confidence calibration. They do
not show whether a provider agrees with people about energy, affect, texture,
or musical character.

Use human judgments as the reference for perceptual claims. Start with pairwise
comparisons. They are easier to label consistently than absolute scores. Keep
absolute scores for profiles and change tracking after calibration.

Run a panel of specialist scorers before another general audio-language model:

1. Test Essentia arousal, valence, mood, aggression, danceability, and tonality
   heads.
2. Test AudioCommons Timbral Models for subjective timbre attributes.
3. Use Cyanite as the main commercial comparison if its remote terms and cost
   are acceptable.
4. Test a language model only for grounded explanation. Qwen3-Omni is the most
   useful new open candidate for this role.

Do not select a provider from this survey. Do not publish a perceptual tool
before the new controlled run passes. A production provider can be a group of
small classifiers. It does not have to be one general model.

## Why the old gate was misaligned

The old cohort asked models to find silence, tones, attacks, pulse rate,
brightness, and stereo width. These tasks were useful capability checks. Most
of them also have deterministic or bounded-estimate providers in E105.

The product gap is different. It includes questions such as:

- Does this version feel more energetic?
- Does it express darker or more positive affect?
- Does it feel aggressive, tense, warm, rough, or spacious?
- Did the edit move the result toward melody or toward texture?
- Does the arrangement build and release, or stay on one level?
- Is the feedback specific enough to guide the next edit?

No signal transform supplies an exact expected answer for these questions. A
human judgment distribution is the correct reference. Disagreement is part of
the result. It is not noise to discard.

Keep two old controls as preflight checks. A provider must not make confident
perceptual claims about digital silence. It must not judge a property that its
preprocessing removes. Pitch, onset count, and pulse rate do not remain
selection gates.

## Perceptual scope

The sibling `genre-popularity` project separates audible dimensions from
cultural, social, and historical genre identity. Keep that separation here.
An audio provider can describe a sonic-perceptual profile. It cannot determine
the complete identity of a genre from audio alone.

The first gate should cover these dimensions:

| Area | Dimensions | Why they matter |
|---|---|---|
| Affect | Valence, arousal, aggression | They separate positive or negative affect, activation, and hostility. |
| Organization | Melodic prominence, tonal stability, consonance or dissonance | They separate melody, stable pitch organization, and perceived harmonic tension. |
| Texture | Roughness or hardness, warmth, brightness | They describe the character between clean tone and noisy or abrasive texture. |
| Motion | Dance pull or groove | It describes felt movement beyond BPM. |
| Arrangement | Sonic density, tension arc | They describe how full the sound feels and how energy develops. |

Do not use one `noise versus harmony` score. That phrase combines at least four
independent judgments: roughness, consonance, tonal stability, and melodic
prominence. A distorted tonal drone and a soft atonal texture must be able to
receive different profiles.

Defer irony or sincerity, production intent, cultural lineage, scene identity,
and historical position. Audio alone cannot support these claims reliably.

## Revised evaluation design

### 1. Public listener-consensus control

Use MusAV as the first external control for valence and arousal. It contains
6,255 pairwise judgments over 2,092 track previews and 1,404 genres. Each pair
received three listener judgments. Its reported ordinal Krippendorff alpha is
`0.48` for arousal and `0.39` for valence. These values show why exact labels
are the wrong target.

Sample full-agreement and majority-agreement pairs. Include same-genre and
cross-genre pairs. Keep some `same` and low-agreement pairs for calibration.
Do not treat the majority label as certain when listeners disagree.

MusAV also provides a useful published baseline. The evaluated Essentia models
reached up to `90.30%` pairwise arousal accuracy and `81.16%` valence accuracy
on strict subsets. The best model varied with the dimension and subset. This
supports a multi-model comparison instead of one assumed winner.

MusAV audio is available only by request for non-commercial research. Its
annotation metadata uses CC BY-NC-SA 4.0. Confirm that this use and its cleanup
rules fit the project before download. If access is not suitable, reproduce its
pairwise method on a small Creative Commons cohort instead of using weak genre
labels as truth.

### 2. Project-relevant listener cohort

Build a small cohort from exact Bitwig captures. Include complete musical
phrases, loops, and isolated sound-design sources. Cover tonal, atonal, noisy,
sparse, dense, rhythmic, ambient, acoustic-like, and synthetic material.

Ask listeners one bipolar question per pair. Offer `A`, `B`, `same`, and
`unclear`. Randomize aliases and order. Store the operator judgment separately
from other listener judgments. For a personal workflow, report agreement with
the operator as its own metric. Do not turn it into a general quality claim.

Use perceived or expressed emotion, not the emotion induced in the listener.
State this distinction in every affect prompt.

### 3. Counterfactual and nuisance controls

Use musically plausible edits to create nearby pairs, but do not assign an
expected answer from the edit. The listeners still supply the expected
direction. Good edits include arrangement thinning, added saturation, changed
voicing tension, reduced melodic foreground, and changed build shape.

Add nuisance variants for alias, pair order, lossless container, leading
silence, and loudness normalization. A semantic result should not flip only
because a blind alias or order changed. Report loudness as a causal input to
arousal, not as a nuisance, unless both clips were normalized before listening.

### 4. Grounded explanation test

Give an explanation model only these inputs:

- the two source identities and ranges;
- deterministic E105 facts and their deltas;
- perceptual scores and uncertainty from passed classifiers; and
- the requested comparison dimension.

Ask it for a short description of the change and one bounded edit suggestion.
Listeners then rate truth, specificity, usefulness, and unsupported claims.
This test measures explanation quality without asking a general model to infer
every observation directly from audio.

## Scoring

Report each dimension separately. Do not hide a failed dimension in one mean.

| Measure | Meaning |
|---|---|
| Listener agreement | Ordinal Krippendorff alpha or the exact pair vote distribution. |
| Pairwise agreement | Model direction versus the listener consensus, split by consensus strength. |
| Human-relative gap | Model agreement compared with a held-out listener against the other listeners. |
| Rank agreement | Spearman correlation between model scores and listener median scores. |
| Calibration | Confidence or margin versus listener consensus and model error. |
| Selective accuracy | Accuracy after low-margin results become `same` or `unknown`. |
| Stability | Choice and score changes across repeats, pair order, aliases, and nuisance variants. |
| Coverage | Supported dimensions, clip types, time spans, and channel behavior. |
| Usefulness | Blind operator rating of grounded feedback and edit suggestions. |

Set pass thresholds before inference. A practical initial rule is that a
provider must beat chance, remain within ten percentage points of the median
held-out listener, and avoid confident errors on the high-consensus subset for
each dimension it claims. Use bootstrap intervals because the local cohort is
small. A provider can pass one dimension and fail another.

## Candidate survey

| Candidate | Relevant output | Boundary | Survey result |
|---|---|---|---|
| Essentia emotion heads | Valence and arousal regression; happy, sad, relaxed, aggressive, danceability, MIREX mood, MTG-Jamendo mood and theme, approachability, and tonal or atonal scores | Local mono 16 kHz inference. The models are CC BY-NC-SA 4.0 unless a proprietary license is obtained. The measured Python import cost in E105 was high. | First local candidate. Use a long-lived worker. Start with the EmoMusic VGGish and MusiCNN arousal-valence heads, then the narrow mood heads. |
| AudioCommons Timbral Models 0.4.1 | Human-rated hardness, depth, brightness, roughness, warmth, sharpness, boominess, and reverb | Local Python. Apache-2.0. The project is not maintained. It was designed mainly for sound effects, not complete mixes. | First timbre candidate. Test isolated sounds and mixes as separate coverage classes. |
| Cyanite current model outputs | Versioned valence-arousal, mood, character, movement, energy change, segment scores, keywords, and generated descriptions | Remote asynchronous API. Standard uploads persist until deletion. Business deployments can use spectrogram upload or a managed deployment. Current public API pricing starts with a subscription and usage fees. | Strongest commercial comparison. It has the closest ready-made schema, but it needs an approved account, cost, deletion proof, and independent accuracy measurement. |
| Music2Emo 1.0 | Valence, arousal, and categorical mood from MERT plus key and chord features | Local research code on Python 3.10 and Torch 2.3.1. The repository gives no clear software license. MERT weights have a non-commercial license. | Retain for a research comparison only after license review. Its published multi-dataset results make it more relevant than raw MERT. |
| MuQ-MuLan | Zero-shot music and text similarity for free descriptors | Local 700M-parameter model with strict 24 kHz input. Weights are CC BY-NC 4.0. The open checkpoint differs from the larger paper training run. | Better zero-shot music candidate than another CLAP checkpoint. Use only for descriptor ranking. It has no calibrated scalar or refusal interface. |
| Qwen3-Omni | Direct audio description and instruction following | The repository uses Apache-2.0. The open model is a 30B mixture-of-experts system. Local use needs substantial compute. A hosted API creates a remote boundary. | Use as the new explanation comparator, not as the only scorer. Its music benchmarks do not establish agreement on these perceptual dimensions. |
| E106 through E108 providers | CLAP similarity and general audio-language judgments | Existing local and remote boundaries | Keep as baselines. Their old factual errors do not automatically fail the new perceptual gate, but their poor calibration prevents selection without new evidence. |

The survey does not select genre classifiers as the core provider. Genre labels
mix audible sound with lineage, community, geography, and history. Genre scores
can help check cohort coverage or find references. They must not become the
ground truth for perceptual dimensions.

## Proposed provider boundary

Keep four replaceable layers:

1. E103 and E105 own capture, source identity, coverage, and signal facts.
2. Specialist perceptual scorers return one declared dimension each.
3. A fusion step compares calibrated scores and preserves disagreement.
4. A text model turns only those results into grounded feedback.

Every perceptual result must include the source hash, sample range, channel
policy, loudness preprocessing, provider, immutable model identity when
available, training taxonomy, raw score, calibrated score or margin, coverage,
and unsupported fields. Mark it `model-classified`. Store listener and operator
judgments as separate result kinds.

The explanation layer must cite the fields that support each sentence. It must
not invent genre identity, production intent, listener emotion, or an operator
verdict.

## Primary sources

- <https://essentia.upf.edu/models.html>
- <https://archives.ismir.net/ismir2022/paper/000078.pdf>
- <https://github.com/AudioCommons/timbral_models>
- <https://audiocommons.github.io/assets/files/AC-WP5-SURREY-D5.8%20Release%20of%20timbral%20characterisation%20tools%20for%20semantically%20annotating%20non-musical%20content.pdf>
- <https://github.com/AMAAI-Lab/Music2Emotion>
- <https://github.com/tencent-ailab/MuQ>
- <https://github.com/QwenLM/Qwen3-Omni>
- <https://docs.cyanite.ai/docs/guides/model-outputs/>
- <https://docs.cyanite.ai/docs/intro/>
- <https://cyanite.ai/faq/>

## Retrospective

The old gate matched the easiest source of ground truth instead of the product
gap. Future model gates must start with the decision that the model will
support, then select the correct reference authority.
