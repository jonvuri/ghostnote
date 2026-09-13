---
title: E113 — Loudness beats the affect head, but the reference gate blocks selection
kind: evidence
state: active
updated: 2026-09-13
parent: ../../plan/phase-6/6d2-perceptual-listener-agreement-evaluation.md
---

# E113 — Loudness beats the affect head, but the reference gate blocks selection

## Verdict

Do not select a perceptual provider. Do not publish a perceptual tool.

Integrated loudness predicted 26 of 27 derived arousal pair directions. The
MuSe VGGish head predicted 12 of 27. The loudness result is strong, but it does
not pass the product gate. The public reference contains absolute continuous
ratings, not direct blind pair judgments. The source clips also differ by up to
20 LUFS because this run did not normalize loudness. The result can therefore
measure a cohort construction effect instead of a general arousal capability.

No other target dimension had a matching public listener reference. The run
measured provider coverage and operating limits for those dimensions. It did
not convert those outputs into perceptual facts or operator feedback.

## Frozen gate

The pre-registration file was written before provider-head inference. It was
2,911 bytes and had SHA-256
`eec0b3895857facaf1d76ae37aa56d6579ea1a23a4e1d35652ced9b49e0b94f4`.
The run used these rules:

- Chance accuracy was 0.50. A selected dimension needed a one-sided exact
  binomial result with `p < 0.05`.
- A selected dimension had to be within 0.10 of the median held-out listener.
- Bootstrap intervals used 10,000 resamples and seed 6202.
- High consensus meant a vote share of at least 0.80.
- Three repeated runs had to stay within `1e-6`.
- WAV, FLAC, and blind-alias scores had to stay within `1e-5`.
- Silence had to produce no confident perceptual direction.
- A provider could pass one dimension and fail all other dimensions.

The definitions were also frozen before inference.

| Dimension | Low end | High end |
|---|---|---|
| Valence | Negative expressed affect | Positive expressed affect |
| Arousal | Calm or low activation | Energetic or high activation |
| Aggression | Gentle or non-hostile | Forceful, abrasive, or hostile |
| Melodic prominence | Texture-led or no foreground melody | Distinct foreground melody |
| Tonal stability | Weak or unstable pitch center | Clear and stable pitch center |
| Dissonance | Fused or restful harmony | Beating, clashing, or tense harmony |
| Roughness | Smooth texture | Rough texture |
| Warmth | Cool or thin timbre | Warm or full timbre |
| Brightness | Dark timbre | Bright timbre |
| Dance pull | Weak felt movement | Strong felt movement beyond tempo alone |
| Sonic density | Sparse sound | Dense or full sound |
| Tension arc | Flat development | Clear build and release shape |

## Reference boundary

The run used eight songs from the [MERP Hugging Face
dataset](https://huggingface.co/datasets/amaai-lab/MERP) at revision
`04d90b60d92f079f2e25759e48f233094f7af84a`. The annotation Parquet file had
SHA-256
`0469927620c4d9fb8a20cdcef7badd1eff15860f5af563d5c2101d654f73a13f`.
The annotations use CC BY 4.0. The dataset card says that audio uses a mixture
of Creative Commons terms, but it does not identify the license for each song.
This incomplete audio license chain is a selection blocker.

MERP contains per-listener arousal and valence traces on a `[-1, 1]` scale. It
does not contain blind pairwise prompts. For each pair, this run compared each
shared listener's mean value over seconds 15 through 44. A difference within
0.05 became `same`. A tied largest vote was withheld. A Bradley-Terry scale
used iterative Luce spectral ranking and ignored `same` votes.

This derived reference had 3 through 16 shared listeners per pair. It did not
provide `unclear`; all `unclear` counts are zero. These two differences from a
direct pair study prevent provider selection. MusAV was not used because its
restricted Zenodo route requires a user account, personal information, and an
academic or research-use agreement.

The ordinal Krippendorff alpha was 0.304 for arousal and 0.074 for valence. The
median held-out listener accuracy was 0.667 for both dimensions. This baseline
included 36 arousal listeners and 41 valence listeners with at least three
eligible decisions.

## Exact input bytes

Each input is a 30-second stereo PCM S24 WAV crop from source seconds 15
through 45. No loudness normalization was applied. The sample range is
inclusive. A lossless FLAC form was used only for the container control.

| Song | Source rate | Source sample range | Source SHA-256 | WAV SHA-256 | FLAC SHA-256 |
|---|---:|---|---|---|---|
| `00_366` | 48,000 | 720,000–2,159,999 | `d789bda402d61ed23f3f87a43b11aa673be6eb961366d03983037b2a017a01a5` | `9a05c2dcc716450c0a798452f8fd8a1c61ba3d5cb536ae721b6b2345805e8caa` | `4323c4ce5689fc45b52dc1b0e5894e09d99c8df6d2015f1dadb998114608922f` |
| `00_661` | 44,100 | 661,500–1,984,499 | `9158c687d14c1610412ac2b61e78d6ec4815698fbb0b7169b98d193a58b0f2fb` | `e6a978232ac28ef2baaa9f7d7adacd9946ddb846946f59f89a875fa06728f2a4` | `9e05acb584b1a2f7276dbcfc29c53edd813add76d947b0fc7505278341943203` |
| `01_154` | 44,100 | 661,500–1,984,499 | `62101d5b90c396e0d7253039eb0c1d6763fe0d7abac25bca3d65e13ba1211288` | `e430093bfd79a9fcc7b189c7decc6108aa56fe42983b0cd76ec2ebc83180c4a2` | `ed3652eaa6eeae03bb1de4dda9ad839cf95eba95a9982b1e727776d7c863cce6` |
| `01_177` | 44,100 | 661,500–1,984,499 | `0261f3213554436014696ddc2afc277aad6e85c73506cefd9d43b624edbc382d` | `8174d6be3a4604500e22ea04c6b12c96fd667d8a696cb9dd065610cbe9cea38f` | `8b4b1d01e502c7864cd023e9a2bc12bc62fe68ebb66b5ecbabde6adea3122d48` |
| `01_333` | 44,100 | 661,500–1,984,499 | `469f1d7f2e5da03a044e7b4151092466d9bd928f201404e6c1d38665b8dc6433` | `6dc56b8fb94f2347e6ee646606f0d98ea68fb572c5e329413a2495ff61f5774b` | `b5b860e7503992da3611149e8a7b045d640beba1afe8d2ee0d6f6e7d574032b0` |
| `10_130` | 48,000 | 720,000–2,159,999 | `0a9463c21edd89c374eda4b2e81fd428904610eccaafc681ce89fd0c270c826d` | `f01bafb7e7ba19d19108b602fc2b59cda7925f1b2a0bd0a5eb87578f703572b3` | `a28fbebf4139de0bfefa7533df9527b80061e01ffbaf9d24e3817b4a60758d69` |
| `10_404` | 44,100 | 661,500–1,984,499 | `4ec5ad513447b76ed6abfcc593059fb1ad768be42728164231bc0ac5b3c1e954` | `520805989c75a402938d0f7ea939eb2d1a455a7462db824d6997c596f302e703` | `497c5b3f9866ad4823e7604ffd59055bb061a1ce84203a939026509ad48162b7` |
| `11_801` | 44,100 | 661,500–1,984,499 | `139ba582874f71b62393be4ed626b212e2beb88e01ec5ba88e2566b8ab584c66` | `d7d4c678381ab27ecbf0a5120591c8a06d48a352adabd48e8608d58577209b18` | `d95203843aa2b375dc6e502f3d4b6410e28fd64150bfe7cc03a7add049a0e4b9` |

## Complete vote distributions

The cells are `A/B/same/unclear`. The reference direction follows the count.
`W` means that the largest vote count was tied and the pair was withheld.

| Pair | Arousal | Valence |
|---|---|---|
| `00_366` / `00_661` | 5/1/1/0, A | 3/4/0/0, B |
| `00_366` / `01_154` | 1/10/1/0, B | 5/5/2/0, W |
| `00_366` / `01_177` | 1/5/1/0, B | 0/5/2/0, B |
| `00_366` / `01_333` | 4/5/3/0, B | 1/11/0/0, B |
| `00_366` / `10_130` | 0/9/2/0, B | 2/9/0/0, B |
| `00_366` / `10_404` | 1/9/0/0, B | 1/8/1/0, B |
| `00_366` / `11_801` | 1/11/0/0, B | 4/8/0/0, B |
| `00_661` / `01_154` | 2/5/0/0, B | 2/3/2/0, B |
| `00_661` / `01_177` | 0/3/0/0, B | 3/0/0/0, A |
| `00_661` / `01_333` | 1/2/1/0, B | 1/3/0/0, B |
| `00_661` / `10_130` | 0/6/0/0, B | 1/5/0/0, B |
| `00_661` / `10_404` | 1/3/2/0, B | 1/5/0/0, B |
| `00_661` / `11_801` | 0/4/0/0, B | 2/2/0/0, W |
| `01_154` / `01_177` | 3/4/0/0, B | 3/4/0/0, B |
| `01_154` / `01_333` | 11/0/1/0, A | 3/8/1/0, B |
| `01_154` / `10_130` | 9/5/0/0, A | 1/12/1/0, B |
| `01_154` / `10_404` | 3/3/2/0, W | 0/7/1/0, B |
| `01_154` / `11_801` | 5/6/0/0, B | 4/7/0/0, B |
| `01_177` / `01_333` | 11/1/0/0, A | 6/6/0/0, W |
| `01_177` / `10_130` | 6/3/0/0, A | 3/5/1/0, B |
| `01_177` / `10_404` | 6/3/0/0, A | 1/7/1/0, B |
| `01_177` / `11_801` | 5/4/1/0, A | 4/6/0/0, B |
| `01_333` / `10_130` | 3/12/1/0, B | 8/8/0/0, W |
| `01_333` / `10_404` | 0/7/0/0, B | 0/7/0/0, B |
| `01_333` / `11_801` | 0/9/0/0, B | 2/6/1/0, B |
| `10_130` / `10_404` | 2/7/0/0, B | 5/2/2/0, A |
| `10_130` / `11_801` | 1/7/0/0, B | 4/4/0/0, W |
| `10_404` / `11_801` | 4/6/0/0, B | 6/4/0/0, A |

## Agreement results

The held-out median was 0.667. The gap column is provider accuracy minus this
median. The 95% interval is a pair bootstrap interval. Rank is Spearman
agreement between provider order and the Bradley-Terry reference order.

| Score and dimension | Correct | Accuracy | 95% interval | One-sided `p` | Rank | Human gap | High / low consensus |
|---|---:|---:|---|---:|---:|---:|---|
| Integrated LUFS, arousal | 26/27 | 0.963 | 0.889–1.000 | 0.000000209 | 0.881 | +0.296 | 12/12; 14/15 |
| Integrated LUFS, valence | 14/23 | 0.609 | 0.391–0.783 | 0.202 | 0.333 | -0.058 | 6/9; 8/14 |
| Dynamic complexity, arousal | 5/27 | 0.185 | 0.037–0.333 | 1.000 | -0.667 | -0.481 | 2/12; 3/15 |
| Dynamic complexity, valence | 5/23 | 0.217 | 0.043–0.391 | 0.999 | -0.738 | -0.449 | 1/9; 4/14 |
| MuSe arousal | 12/27 | 0.444 | 0.259–0.630 | 0.779 | -0.190 | -0.222 | 4/12; 8/15 |
| MuSe valence | 8/23 | 0.348 | 0.174–0.565 | 0.953 | -0.429 | -0.319 | 3/9; 5/14 |

No reference pair had a `same` majority. One arousal pair and five valence
pairs were withheld. The MuSe margins were all below the pre-registered
high-confidence margin of 2.0, so it had no high-confidence result or error.
For MuSe, the top arousal margin quartile reached 0.857 accuracy on 7 of 27
pairs. The top valence margin quartile was 0.000 on 6 of 23 pairs. This
selective result does not pass the full-coverage gate.

## Provider contracts and raw coverage

### Essentia deterministic floor

Essentia `2.1-beta6-dev` used native decoding and `MusicExtractor` mean and
standard-deviation aggregation. The eight-file run took 46.74 seconds and used
415,416,320 RSS bytes. Integrated LUFS and dynamic complexity were:

| Song | LUFS | Dynamic complexity | Danceability | Dissonance mean |
|---|---:|---:|---:|---:|
| `00_366` | -25.595 | 10.936 | 0.644 | 0.347 |
| `00_661` | -23.481 | 8.878 | 1.043 | 0.301 |
| `01_154` | -10.840 | 5.234 | 1.109 | 0.486 |
| `01_177` | -5.558 | 0.402 | 1.643 | 0.489 |
| `01_333` | -20.313 | 3.704 | 0.836 | 0.474 |
| `10_130` | -14.627 | 2.480 | 1.326 | 0.437 |
| `10_404` | -14.578 | 1.341 | 1.445 | 0.422 |
| `11_801` | -8.927 | 2.594 | 1.671 | 0.468 |

Three runs had the same output hash,
`90449353d1dff31e099adc97adfd487efd692a14827154221d709074553e2586`.
The maximum score difference was zero.

### Essentia ONNX heads

The run used Essentia `2.1-beta6-dev` and ONNX Runtime `1.30.0` on CPU. Each
file became 16 kHz mono audio through Essentia `MonoLoader` with resample
quality 4. The VGGish input used 400-sample frames, a 160-sample hop,
`TensorflowInputVGGish`, and non-overlapping 96-frame patches. Each file made
31 patches. The output is the mean across patches.

| Model | SHA-256 |
|---|---|
| `audioset-vggish-3.onnx` | `b0b7db5247b20b8db66aae82bdfb4a298d38a34df200dd19b2de355227c8dd49` |
| `muse-audioset-vggish-2.onnx` | `a9d92529836d4488f259059a91b8fcce8996410362a93e2517c258372ef03368` |
| `mood_aggressive-audioset-vggish-1.onnx` | `0a47dfff004a7610c5434e3bb4772173ecaebbd2e16f9b3b464447f950af0054` |
| `danceability-audioset-vggish-1.onnx` | `469e940a092306e1c641fe963b24e60bb6d7654d1126995420b1dd2ce771d367` |
| `tonal_atonal-audioset-vggish-1.onnx` | `6a731767bd470bbf96c724c99ad92c8b6b4cb72413465fd91919bcf513a779dc` |

The MuSe columns are `[valence, arousal]`. Aggression is the `aggressive`
class probability. Dance is the `danceable` class probability. Tonal is the
`tonal` class probability.

| Song | MuSe valence | MuSe arousal | Aggression | Dance | Tonal |
|---|---:|---:|---:|---:|---:|
| `00_366` | 5.491 | 4.950 | 0.655 | 0.701 | 0.022 |
| `00_661` | 5.702 | 4.824 | 0.436 | 0.377 | 0.042 |
| `01_154` | 5.096 | 4.785 | 0.790 | 0.590 | 0.009 |
| `01_177` | 5.533 | 5.173 | 0.877 | 0.541 | 0.003 |
| `01_333` | 4.887 | 4.668 | 0.465 | 0.438 | 0.009 |
| `10_130` | 5.007 | 4.651 | 0.635 | 0.614 | 0.012 |
| `10_404` | 5.097 | 4.780 | 0.744 | 0.708 | 0.008 |
| `11_801` | 4.973 | 4.626 | 0.767 | 0.695 | 0.008 |

The warm eight-file head run took 2.79 seconds and used 861,634,560 RSS bytes.
Three runs had the same output hash,
`7cf7263e613b0794d19106a1b49db43969062303e23a5b42f4e602e9c6071014`.

### MoSQITo and AudioCommons

MoSQITo `1.2.1` decoded float64 audio, averaged stereo channels, and used the
Daniel-Weber roughness and DIN sharpness methods. It resampled 44.1 kHz input
to the standard 48 kHz rate. The eight-file run took 242.70 seconds and used
430,407,680 RSS bytes.

AudioCommons Timbral Models `0.4.0` used its file decoder and default phase
correction setting. Its output range is 0 through 100. The normal dependency
resolver failed because the package declares the deprecated `sklearn`
package. The run installed the package without dependencies, replaced removed
`numpy.lib.pad` use, and changed four old librosa calls to use named arguments.
This compatibility shim prevents selection. The run took 68.28 seconds and
used 688,472,064 RSS bytes.

| Song | MoSQITo roughness | MoSQITo sharpness | AC hardness | AC roughness | AC warmth | AC brightness |
|---|---:|---:|---:|---:|---:|---:|
| `00_366` | 0.0168 | 0.7517 | 43.318 | 51.457 | 50.493 | 54.341 |
| `00_661` | 0.0410 | 0.7266 | 42.153 | 41.950 | 47.473 | 49.531 |
| `01_154` | 0.0838 | 1.6488 | 58.298 | 59.907 | 43.738 | 67.200 |
| `01_177` | 0.0599 | 1.5261 | 63.664 | 68.391 | 44.001 | 67.696 |
| `01_333` | 0.0336 | 1.4637 | 53.272 | 55.687 | 52.518 | 56.511 |
| `10_130` | 0.0899 | 1.0324 | 46.490 | 56.502 | 58.025 | 52.086 |
| `10_404` | 0.0547 | 0.9575 | 47.594 | 55.453 | 59.168 | 50.992 |
| `11_801` | 0.1776 | 1.5613 | 63.071 | 54.659 | 46.662 | 62.915 |

These results prove output coverage only. This cohort has no matching listener
votes for roughness, hardness, warmth, or brightness.

### Meta Audiobox-Aesthetics

Audiobox-Aesthetics `0.0.4` ran on CPU at Hugging Face revision
`9b1dd8e5df9af7216e836a98974fe3b82c56ded6`. The weight file had SHA-256
`a5a3c2412649cc2384ec525ffd5180ce6c4778f43bed6108e0a1303de04d014e`.
The package decoded float32 audio, averaged stereo channels, resampled to 16
kHz, used 10-second windows and hops, and returned a weighted mean.

| Song | Content enjoyment | Content usefulness | Production complexity | Production quality |
|---|---:|---:|---:|---:|
| `00_366` | 5.280 | 7.386 | 2.549 | 7.216 |
| `00_661` | 6.780 | 7.542 | 3.616 | 7.576 |
| `01_154` | 4.580 | 4.620 | 5.418 | 5.266 |
| `01_177` | 5.026 | 5.058 | 6.376 | 5.157 |
| `01_333` | 4.313 | 6.209 | 4.130 | 6.516 |
| `10_130` | 7.028 | 7.088 | 4.779 | 6.824 |
| `10_404` | 7.372 | 7.720 | 3.998 | 7.100 |
| `11_801` | 7.644 | 7.807 | 6.593 | 7.962 |

Model initialization took 1.33 seconds. The first eight-file run took 6.23
seconds. Warm repeats took 4.15 and 4.08 seconds. RSS use was 1,626,472,448
bytes. All three result hashes were
`a6f640de3a38fb83d136e4eef1248477fdd8640db5f2cda443bbfb591a1df6ad`.
The cohort has no listener reference for production complexity or density.
The public model information also does not prove that its training set excludes
MERP audio.

## Controls and limits

- WAV and FLAC decoded to the same PCM samples and sample rates.
- Actual Essentia-head and Audiobox reruns had zero score difference for FLAC
  files and two blind aliases.
- Pair order changed only the expected A or B label. It did not change scores.
- A digital-silence WAV had SHA-256
  `009a20ef0c960262dd58b4c472ebf2522ac1a4af9397824d2ddfa9665e434919`.
  Every raw scorer returned numeric labels for it. MuSe returned valence 5.280
  and arousal 4.215. Audiobox returned 3.235, 6.453, 1.703, and 6.735. The raw
  providers therefore fail the silence rule. A future wrapper must apply the
  E105 energy refusal before inference.
- No project cohort was created. One operator cannot supply three independent
  blind listener judgments. The Bitwig project and its capture baseline were
  not changed.
- Symbolic tension and stem loudness ratios were not scored. The public cohort
  has neither exact notes nor stems, and the local cohort lacks three listener
  judgments.
- No linear probe was fitted. The reference-license and direct-pair gates
  failed before model fitting.
- Cyanite was not called. No approved account, remote terms, cost limit, or
  proved deletion route was available.
- No grounded prose was generated because no perceptual dimension passed. No
  operator usefulness verdict was requested.

## Per-dimension decision

| Dimension | Decision and blocker |
|---|---|
| Arousal | Blocked. Loudness passed the statistical test, but the reference was derived, the audio license chain was incomplete, and loudness was not controlled. MuSe failed chance and human-gap criteria. |
| Valence | Blocked. MuSe failed chance and human-gap criteria. |
| Aggression | Blocked. The Essentia head ran, but no matching listener pair votes exist. |
| Melodic prominence | Blocked. The public cohort has no stems or matching votes. |
| Tonal stability | Blocked. The Essentia head ran, but no matching listener pair votes exist. |
| Dissonance | Blocked. MusicExtractor ran, but no matching listener pair votes exist. |
| Roughness | Blocked. MoSQITo and AudioCommons ran, but no matching listener pair votes exist. |
| Warmth | Blocked. AudioCommons ran through a compatibility shim and no matching listener pair votes exist. |
| Brightness | Blocked. MoSQITo sharpness is not a brightness reference. AudioCommons needed a shim. No matching listener pair votes exist. |
| Dance pull | Blocked. Two scorers ran, but no matching listener pair votes exist. |
| Sonic density | Blocked. Audiobox production complexity is not a validated density reference. No matching listener pair votes exist. |
| Tension arc | Blocked. The public cohort has no exact notes, sections, or matching votes. |

## License, platform, cost, and deletion

The host was macOS 15.7.7 on arm64 with Python 3.14.6. Essentia ONNX inference
worked. Essentia uses AGPLv3 for non-commercial use or a commercial license.
Its model files use CC BY-NC-SA 4.0. Both terms apply. ONNX Runtime uses MIT.
MoSQITo and AudioCommons use Apache-2.0. Audiobox-Aesthetics uses CC BY 4.0,
except for Microsoft WavLM code under MIT.

The run stayed local and cost $0. It uploaded no audio. Peak retained test data
was about 1.1 GB for the isolated environment, 396 MB for Audiobox weights,
289 MB for Essentia models, and 286 MB for the audio cohort. All downloaded
audio, weights, repositories, environments, aliases, results, and scorer
scripts were deleted after this evidence was written. The final result file
was 72,041 bytes with SHA-256
`6b1ec41755b54af5da61450f19d862602dec980ff6a8b480129e995c774e40ce`.
No live project or test artifact remains.

## Retrospective

No listener-agreement field predicted useful operator feedback because no
provider reached that test. Reference provenance was the decisive field. The
next perceptual cohort must collect direct blind pair votes, include `same` and
`unclear`, identify every audio license, and control loudness before any model
download.
