---
title: E112 — An independent survey adds probe, psychoacoustic, and symbolic perceptual routes
kind: evidence
state: active
updated: 2026-09-13
parent: ../../plan/phase-6/6d2-perceptual-listener-agreement-evaluation.md
---

# E112 — An independent survey adds probe, psychoacoustic, and symbolic perceptual routes

## Verdict

Keep the E111 gate. Change the candidate set before the run starts.

The E111 survey looked only for finished perceptual scorers. Three other routes
reach the same dimensions, and two of them need no model license at all:

1. A frozen audio embedding plus a small probe fitted on published listener
   ratings. Two 2026 papers show this route for timbre and for groove.
2. Standardized psychoacoustic metrics for roughness, sharpness, and loudness.
3. Symbolic tension and structure measures over the exact notes from 6e.

The staged plan also has one platform blocker and one measurement risk:

- The host is macOS 15.7.7 on arm64. `essentia-tensorflow` publishes an arm64
  wheel only for CPython 3.14. An ONNX route exists and avoids the problem.
- The plan tests Essentia DEAM and emoMusic heads. DEAM is also the first
  alternative reference corpus. Using it as a control would test a model on its
  own training data.

CLAP was discarded too early for the pairwise task. E106 rejected it on
absolute factual controls. New evidence shows the CLAP family is weak on
absolute timbre descriptors but much stronger on the direction of a timbre
change, which is the shape of the product question.

## 1. Platform check for the first named candidate

The 6d2 plan runs Essentia heads first. The current host cannot run them by the
documented route.

| Check | Result |
|---|---|
| Host | macOS 15.7.7, arm64 |
| `essentia-tensorflow` 2.1b6.dev1438 wheels | `cp314` only, for macosx_15_0_arm64, macosx_15_0_x86_64, and manylinux x86_64 |
| Earlier `essentia-tensorflow` releases | No arm64 wheel in any release up to dev871 |
| `essentia` 2.1b6.dev1438 wheels | Same three targets, `cp314` only |
| MTG/essentia issue 1486 | Open since 2025-08-16. `import essentia.tensorflow` fails on osx-arm64 after a successful pip install |

E105 already recorded the matching fact: Python 3.13 resolves the older
dev1389, and the dev1438 wheels need Python 3.14.

An ONNX route removes the TensorFlow dependency. Each URL below returned HTTP
200 on 2026-09-13:

| Model file | Role |
|---|---|
| `feature-extractors/vggish/audioset-vggish-3.onnx` | Embedding extractor, 288,570,178 bytes |
| `classification-heads/emomusic/emomusic-audioset-vggish-2.onnx` | Arousal and valence, 53,216 bytes |
| `classification-heads/deam/deam-audioset-vggish-2.onnx` | Arousal and valence |
| `classification-heads/muse/muse-audioset-vggish-2.onnx` | Arousal and valence |
| `classification-heads/mood_aggressive/mood_aggressive-audioset-vggish-1.onnx` | Aggression |
| `classification-heads/danceability/danceability-audioset-vggish-1.onnx` | Dance pull |
| `classification-heads/tonal_atonal/tonal_atonal-audioset-vggish-1.onnx` | Tonal stability |
| `classification-heads/mtg_jamendo_moodtheme/...-discogs-effnet-1.onnx` | Mood and theme |
| `feature-extractors/musicnn/msd-musicnn-1.onnx` | Embedding extractor |

The complete VGGish head family that E111 names is therefore reachable with
`onnxruntime` alone. Two limits remain. The guessed dynamic-batch path for
Discogs-EffNet returned 404, so the EffNet input contract needs a separate
check. The mel-band input must match `TensorflowInputVGGish`, which is a
signal algorithm in the plain `essentia` wheel and needs no TensorFlow.

### License consistency

E105 rejected Essentia for its AGPLv3 or commercial terms. E111 records only
the CC BY-NC-SA 4.0 model terms. Both apply at the same time. A shipped product
needs a proprietary Essentia license and a proprietary model license, or a
different provider. State this once in the plan so the decision is explicit.

## 2. Route the survey missed: embedding plus probe on published ratings

E111 searched for finished scorers. The stronger 2026 results fit a small probe
on a frozen embedding, trained on ratings that listeners already produced.

| Source | What it shows |
|---|---|
| TTP-RANE, arXiv 2606.30369 (2026-06) | Predicts Reymore's 20 timbre traits from CLAP embeddings and a no-hidden-layer MLP. Pearson r of 0.663 against ratings from 243 musicians. Applied to synthesizer output. Code and audio under CC BY 4.0 |
| Deep groove prediction, arXiv 2603.27237 (SMC 2026) | Probes seven pretrained encoders, including CLAP, M2D, MatPac+, MusicFM, and MERT, against the Senn groove ratings. Code at `github.com/ax-le/deep_groove_prediction` |

This route matters for three reasons. It fits the target dimension instead of a
near neighbor. It produces a calibrated scalar with a known reference cohort. A
probe over a permissive embedding can avoid the NC model terms that block every
finished scorer in the E111 table.

TTP-RANE is also the closest published match to this project's material,
because it scores synthesizer sounds, not complete commercial mixes.

The 6d2 plan lists `training or fine-tuning a new model` as out of scope. A
linear probe over frozen embeddings is a different operation. Decide whether it
is in scope, and write the decision down. If it stays out of scope, the timbre
and groove dimensions lose their best current evidence.

## 3. Route the survey missed: standardized psychoacoustics

Roughness, sharpness, and loudness have published hearing models and formal
standards. They are deterministic, need no training data, and carry no model
license.

| Candidate | Output | Boundary |
|---|---|---|
| MoSQITo 1.2.1 | Loudness ISO 532-1, sharpness DIN 45692, roughness after Daniel and Weber, ECMA-418-2 loudness, roughness, and tonality | Apache-2.0 Python. Last release 2024-04-22 |
| AudioCommons Timbral Models | Eight rated attributes from listener studies at the University of Surrey | Apache-2.0. The PyPI release `timbral-models` 0.4.0 dates from 2019-01-25 |

E111 selects the AudioCommons models as the first timbre candidate. That choice
carries an unmaintained 2019 dependency chain and a sound-effect design target.
MoSQITo covers roughness and sharpness through current standards and stays
maintained. Use MoSQITo as the deterministic floor, below the model layer, and
keep AudioCommons only for the attributes MoSQITo does not model, such as
warmth and depth.

These metrics are facts about a hearing model. They are not listener judgments.
They still need the same cohort test, because agreement with this project's
listeners is the open question.

## 4. Route the survey missed: symbolic tension and structure

E111 lists `tension arc` as a target dimension and gives it no provider. Phase
6e already produces exact notes.

| Candidate | Output | Boundary |
|---|---|---|
| midi-miner | Spiral-array tonal tension: cloud diameter, cloud momentum, tensile strain. Track classification into melody, bass, and harmony | Python, from Guo and Herremans, arXiv 1910.02049 |
| Partitura 1.9.0 | Exact symbolic data, key estimation, voice separation, tonal tension | Already retained by E110 as a future candidate |
| allin1 1.1.0 | Beats, downbeats, and functional segments such as intro, verse, and chorus | Last release 2023-10-10. Depends on madmom 0.16.1 from 2018, whose terms mix BSD and CC BY-NC-SA. Install risk on arm64 is real |
| Demucs 4.1.0 | Stem separation | MIT. Released 2026-07-11 |

Two dimensions become cheaper with these tools. Melodic prominence can start as
a measured stem or track loudness ratio, which is a fact with stated coverage,
not a model label. Tension arc can start as a tension curve over the exact
notes, plus segment boundaries for the shape.

Test them against the same listener cohort. A symbolic curve is still a claim
about perception.

## 5. Candidates to add to the scorer table

| Candidate | Relevant output | Boundary | Why it belongs |
|---|---|---|---|
| Meta Audiobox-Aesthetics 0.0.4 | Production quality, production complexity, content enjoyment, content usefulness | CC BY 4.0 code and weights, except MIT code from microsoft/unilm. pip installable. WavLM encoder. Trained on more than 20,000 human-rated samples | The only listener-trained scorer found with permissive terms. Production complexity maps to sonic density. Its authors report production complexity is weakly correlated with the other axes, so it carries its own information. It targets generated audio, so measure it on real captures before use |
| MS-CLAP 1.3.4 | Zero-shot audio and text similarity | MIT | A distinct model from the two LAION checkpoints that E106 rejected, with product-compatible terms |
| MuQ-MuLan | Music and text joint embedding | MIT code, CC BY-NC 4.0 weights | arXiv 2510.14249 reports it best at encoding effect-induced timbre change, with mean Pearson r of 0.535 and a correct slope in 78.3 percent of cases |
| CDPAM and DPAM | Perceptual distance trained on human just-noticeable-difference judgments | `cdpam` 0.0.6 from 2021 | Answers the preflight question `is this edit audible at all`, before any direction question. Domain is speech and codec perturbation, so treat the transfer as unproven |
| Music Flamingo | Music captions and question answering with harmony, structure, and timbre terms, over tracks up to 15 minutes | NVIDIA non-commercial research license | A closer explanation comparator than a general omni model |
| Qwen3.5-Omni | Audio understanding and instruction following | Apache-2.0 repository. 30B mixture of experts with 3B active | Supersedes the Qwen3-Omni that E111 names. MLX and mlx-vlm make a local arm64 run plausible |
| minzwon sota-music-tagging-models | Music tags trained on MTAT, MSD, and MTG-Jamendo | MIT | A license-clean tagging baseline for cohort coverage checks |
| MusicFM | Music foundation embeddings, trained on Creative Commons FMA audio | Open code and weights | A license-clean embedding for the probe route in section 2 |

### Checked and rejected

Record these so the next session does not survey them again.

| Candidate | Reason |
|---|---|
| openSMILE and eGeMAPS | Speech parameter set. Dual license. The open build may not ship inside a commercial product without a paid audEERING license, and the restriction reaches the extracted features |
| audEERING wav2vec2 arousal, valence, and dominance | Strong dimensional speech model, trained on MSP-Podcast. Research-only terms. The music transfer is unproven |
| PANNs and BEATs | Sound-event tagging over AudioSet. Useful as an embedding or a coverage check, not as a perceptual scorer |
| Audio Flamingo 3 and Audio Flamingo Next | Research-only license, like Music Flamingo, and less music-specific |
| Musiio | No longer a standalone product after the SoundCloud acquisition |
| Genre classifiers | E111 already excludes them for the right reason |

## 6. Reference-data candidates beyond MusAV

MusAV audio needs a request and non-commercial terms. These alternatives are
worth checking first, because several give per-annotator votes.

| Corpus | Content | Why it helps |
|---|---|---|
| DEAM | 1,802 excerpts and songs, per-second and static valence and arousal, CC BY-NC | Large and directly dimensional |
| MERP | 54 full songs, 277 cleaned raters, with rater demographics, preferences, and musical background | Matches the E111 rule that operator agreement is its own metric |
| PMEmo | 794 excerpts, 457 annotators, with per-annotator ratings and electrodermal signals | Large annotator pool for a held-out listener baseline |
| Reymore timbre ratings | 20 timbre dimensions, 243 musicians, 34 orchestral instruments | The reference behind TTP-RANE |
| CCMusic timbre set | 61 instruments, 34 trained listeners, 16 descriptors | A second timbre reference with named listeners |
| SongEval | 2,399 full songs, 16 professional annotators, five aesthetic dimensions, with an open toolkit | Covers coherence and structure clarity, near the arrangement dimension |
| MTG-Jamendo | More than 55,000 tracks, 195 tags, Apache-2.0 | Cohort coverage. The dataset terms are permissive even though the Essentia weights are not |

### Contamination risk

E111 proposes the Essentia DEAM, emoMusic, and MuSe heads. Each head is named
after its training corpus. If the same corpus becomes the external control, the
result measures memorization, not agreement. Pick the control corpus and the
head families so that they do not overlap, and state the split in the result.

## 7. Method libraries the plan needs

The plan collects pairwise votes and then reports rank agreement and
calibration. It names no estimator for the step between.

| Library | Role |
|---|---|
| `choix` 0.4.1 | Bradley-Terry and Plackett-Luce fits. Turns pairwise votes into a latent scale with intervals |
| `krippendorff` 0.8.2 | The ordinal alpha that the acceptance criteria require |

Both are small, current, and pure Python.

## 8. Was anything discarded unfairly

CLAP, in part. E106 rejected two LAION checkpoints because one missed sparse
bursts and the other called every input silence. Those are correct factual
failures. They do not settle the pairwise question. arXiv 2510.14249 compares
MS-CLAP, LAION-CLAP, MuQ-MuLan, and OpenFLAM against human timbre descriptors.
LAION-CLAP led on absolute descriptors with a positive correlation on 12 of 16,
but a weak mean r of 0.117. MuQ-MuLan led on effect-induced change with a mean
r of 0.535. The pattern is that these embeddings carry direction better than
level. The product asks for direction. TTP-RANE then reaches r of 0.663 on the
same family of embeddings with a probe on top.

So keep the E106 verdict for direct factual claims and for raw zero-shot
scoring. Re-enter the CLAP family as an embedding under a fitted probe, and as
a paired-direction candidate.

Essentia's non-neural descriptors were also passed over. E105 tested only
loading, pitch, onset, envelope, and correlation, and its own retrospective
says the probe was narrow. `MusicExtractor` reports dissonance, inharmonicity,
spectral complexity, dynamic complexity, danceability, and chord change rate.
Those map to consonance or dissonance, sonic density, and tonal stability with
no neural head and no CC BY-NC-SA model file. Only the AGPL library term
applies. Measure them beside the heads.

## Suggested order for the 6d2 run

1. Freeze definitions, thresholds, and the cohort. Fit the vote model with
   `choix` and report alpha with `krippendorff`.
2. Run the free deterministic layer first: MoSQITo metrics, Essentia
   `MusicExtractor` descriptors, symbolic tension from the 6e notes, and stem
   ratios from Demucs. Record how far these alone agree with listeners.
3. Run Essentia heads through `onnxruntime`, not `essentia-tensorflow`. Keep
   the head family separate from the control corpus.
4. Run Audiobox-Aesthetics and the AudioCommons attributes that MoSQITo does
   not cover.
5. Fit probes over frozen embeddings for timbre and groove, if the scope
   decision in section 2 allows it.
6. Use Cyanite only under the approved remote boundary, as the plan already
   states.
7. Compare explanation quality with Music Flamingo or Qwen3.5-Omni, under the
   grounded-input rule from E111.

Steps 2 through 5 need no remote account and no paid license. A negative result
there is still useful, because it sets the floor that any model must beat.

## Primary sources

- <https://pypi.org/pypi/essentia-tensorflow/json>
- <https://github.com/MTG/essentia/issues/1486>
- <https://essentia.upf.edu/models.html>
- <https://essentia.upf.edu/reference/std_TensorflowInputVGGish.html>
- <https://arxiv.org/html/2606.30369v1>
- <https://arxiv.org/abs/2603.27237>
- <https://github.com/ax-le/deep_groove_prediction>
- <https://arxiv.org/html/2510.14249>
- <https://github.com/facebookresearch/audiobox-aesthetics>
- <https://github.com/Eomys/MoSQITo>
- <https://github.com/ruiguo-bio/midi-miner>
- <https://github.com/mir-aidj/all-in-one>
- <https://huggingface.co/nvidia/music-flamingo-hf>
- <https://github.com/tencent-ailab/MuQ>
- <https://github.com/minzwon/sota-music-tagging-models>
- <https://mtg.github.io/mtg-jamendo-dataset/>
- <https://cvml.unige.ch/databases/DEAM/>
- <https://www.mdpi.com/1424-8220/23/1/382>
- <https://github.com/ASLP-lab/SongEval>
- <https://pypi.org/project/choix/>

## Retrospective

E111 searched for products that already answer the question. It did not search
for the reference data plus a small fitted layer. Future provider surveys
should ask a second question after `who sells this answer`: which public human
ratings exist for this dimension, and what is the smallest model that maps a
frozen embedding onto them.
