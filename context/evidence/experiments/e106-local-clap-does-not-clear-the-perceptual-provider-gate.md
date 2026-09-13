---
title: E106 — Local CLAP does not clear the perceptual provider gate
kind: evidence
state: active
updated: 2026-09-12
parent: ../../plan/phase-6/6d-perceptual-audio-model-evaluation.md
---

# E106 — Local CLAP does not clear the perceptual provider gate

## Verdict

Do not select a perceptual provider yet. Two local CLAP checkpoints gave fully
repeatable scores, but neither result supports a general perceptual feedback
interface. The general checkpoint classified four of five controls. It called
three sparse bursts digital silence. The music checkpoint classified only
silence and called all five inputs silence.

Both checkpoints selected the expected clip in four simple directional pairs.
The adapter refused a stereo-width pair because both checkpoints accept mono
input. This directional result is useful evidence, but it is not sufficient.
CLAP returns relative similarity scores. It cannot explain a judgment, report
uncertainty, or refuse an ambiguous supported task.

Two frontier providers remain suitable candidates. OpenAI GPT-Audio-1.5 and
Google Gemini 3.8 Flash accept audio input. This environment had no API key and
no authenticated browser surface for either provider. Therefore, no project
audio was sent to a remote provider. A provider comparison without the same
input bytes would not meet this session's controls.

The precise blocker is an approved, authenticated remote provider boundary.
The next remote run must use paid service terms, record the returned provider
version, send this exact blind cohort three times, and remove remote file state.

## Blind cohort

The probe used content-derived aliases in every provider input. The role map
and expected values did not enter model input. Each task supplied one clip or
one ordered pair. Two directional answers were first and two were second.
Thus, file names and pair order did not reveal the answer.

The source format was stereo signed 24-bit PCM WAV at 44.1 kHz. The manifest
hash was
`c2673b8be84bb376e3a6cb71fe26cc56c3de5790bb874c2323f9c2cbd9f9f2e5`.

| Blind alias | Role outside model input | Input SHA-256 | Exact range |
|---|---|---|---|
| `clip-4e29912c9cbf` | Digital silence | `4e29912c9cbf237e6b5c50a8eed475e056710fe0dd004b08130310921d6a2d7e` | Samples 0 through 44,099, each channel |
| `clip-a922f3e08f9e` | 440 Hz tone | `a922f3e08f9ed36da32e3f6c3701d45fa650743992a70307c6c7d2f79f5b6df3` | Samples 0 through 88,199, each channel |
| `clip-fc3da9f816a6` | 880 Hz tone | `fc3da9f816a640cb68f633542b7694a2ef1040e308018eb835869d90dd3f7658` | Samples 0 through 88,199, each channel |
| `clip-e488ba602639` | Three bursts | `e488ba6026396351561f5b5887feaa4c26958625877a02f7b7bcba66114c93bd` | Samples 0 through 88,199, each channel |
| `clip-a7d67683c007` | Six bursts | `a7d67683c0078be30e8ac6eb671b0045b2814cec850d83ba29b94a43107d31ef` | Samples 0 through 88,199, each channel |
| `clip-8decfd847e80` | 2 Hz amplitude modulation | `8decfd847e803e63ebbef71557c1f0c99529547d2f13e6cc38dede7a3de96003` | Samples 0 through 176,399, each channel |
| `clip-320552cd4cae` | 8 Hz amplitude modulation | `320552cd4caebe5e75726973abceeeedfb2e32b5dc169f98a06e7c51718eabac` | Samples 0 through 176,399, each channel |
| `clip-5b6fe842fc8d` | Bitwig capture | `5b6fe842fc8d88d7cdd9fea3c6eabb6ef5549a054490ca0f5fb0278583c60524` | Samples 0 through 199,679, each channel |
| `clip-0d34d2a0be50` | 700 Hz low-pass form of Bitwig capture | `0d34d2a0be5012be81c80f32d9bbefd1370057cd1ff5212e0e6da072498d77e0` | Samples 0 through 199,679, each channel |
| `clip-cb63f4ab36b3` | Exact correlated stereo | `cb63f4ab36b39ed1f537eff8e5a2e931f20d0e9617f1a30d866aa635eeee384c` | Samples 0 through 88,199, each channel |
| `clip-30de40c9c390` | Exact inverted stereo | `30de40c9c390fcf48382e12a45e3ac47d0bc37b25ed2a91354da6501257418c2` | Samples 0 through 88,199, each channel |

The Bitwig source came from a fresh E103 capture. Its source SHA-256 was
`34fd7b66e22950e5a512d95c4fcbfbb09e2c3b621dd7ce88ec1c3a31056de14a`.
It covered eight beats at 110 BPM from one Polysynth track. The master file was
stereo 24-bit PCM at 44.1 kHz and was 4.527891 seconds long. The cohort rewrote
the decoded samples with a stable WAV writer, which explains its different
input hash.

## Tasks and prompts

The classification prompt was the exact ordered label list below:

1. `digital silence`
2. `a steady pitched tone`
3. `short percussive bursts`
4. `a repeating pulsing tone`
5. `a short synthesizer melody`

The model scored every label against one blind clip. The selected label had the
highest score. The five clips were silence, the 440 Hz tone, three bursts, the
2 Hz pulsing tone, and the Bitwig capture.

Each directional task scored one exact text prompt against both blind clips:

| Task | Exact prompt | Control expected direction |
|---|---|---|
| Pitch | `a high-pitched steady tone` | 880 Hz over 440 Hz |
| Attack density | `frequent short percussive attacks` | Six bursts over three bursts |
| Pulse rate | `a rapidly pulsing tone` | 8 Hz over 2 Hz |
| Brightness | `a bright synthesizer timbre` | Original capture over its 700 Hz low-pass form |
| Stereo width | `a wide stereo sound` | Unknown at a mono provider boundary |

The first three expectations came from known construction. They fit the E105
pitch, onset, and modulation boundaries. The brightness pair used one declared
filter transform. The stereo pair had exact correlations of `1.0` and `-1.0`
before mono preprocessing. No model score replaced these facts.

The prepared frontier classification prompt was:

> You receive one audio clip named `<alias>`. The file name is blind. Choose
> exactly one supplied label, or `unknown` when the audio is insufficient.
> Return JSON with `choice`, `confidence`, and `reason`. Do not infer from the
> file name.

The prepared frontier directional prompt was:

> You receive `A=<alias>` and `B=<alias>`. Which clip has `<property>`? Return
> `A`, `B`, `same`, or `unknown`, with confidence and a brief reason. Do not
> infer from the file names.

These frontier prompts produced no model result because no authenticated
provider was available.

## Local model results

Both runs used Python 3.13.5, PyTorch 2.14.0, Transformers 5.17.0, and librosa
1.0.0 on macOS 15 ARM64. Librosa decoded each exact input, mixed it to mono,
and resampled it to 48 kHz. The CLAP processor then used its pinned defaults.

| Checkpoint | Exact revision | Weight SHA-256 | Classification | Direction | Three-repeat agreement |
|---|---|---|---:|---:|---|
| `laion/clap-htsat-unfused` | `8fa0f1c6d0433df6e97c127f64b2a1d6c0dcda8a` | `1cd3c601bc4afe0fa87be3de4c13dd2cfadd249fac1e29acf74a9b296c3219bb` | 4 of 5 | 4 of 4 | Exact choices and scores |
| `laion/larger_clap_music` | `a0b4534a14f58e20944452dff00a22a06ce629d1` | `5c289311f4a030d768af7ffbfdecd01b008aa64824211899a4e59f4f9d154fd1` | 1 of 5 | 4 of 4 | Exact choices and scores |

The general checkpoint's choice hash was
`d43e22cd88417d72f7001d0725c00fac82cb1790954f15f19265495f09b4e759`.
Its score hash was
`d619e337161358ae02b171923046ab8731a3c7662ad1141b1fe7ecade8380976`.
The music checkpoint's corresponding hashes were
`d95991a0a5c06dd84a920fed196984d8a2b5e34f58947f0cf2249574d8c462a0`
and
`9528a67773fb219b39e292a5705bdefd7a569257b11d0d90fbd4f0bda96bc516`.

The general checkpoint called the three-burst clip silence on every repeat. Its
silence score was `7.3111`, and its burst score was `6.6238`. The music
checkpoint selected silence for every classification input. Its directional
choices were correct, but three score differences were below `0.0004`. Do not
use these scores as calibrated confidence.

The adapter returned `unknown` for stereo width before inference. This refusal
was correct because the provider input was mono. It was an adapter capability
check, not a CLAP judgment.

## Latency, memory, disk, and cost

Each query included five classifications, four supported direction pairs, and
one stereo refusal. Startup includes Python imports and model loading.

| Checkpoint | Startup | First query | Warm queries | Peak resident memory | Converted copy bytes |
|---|---:|---:|---:|---:|---:|
| General CLAP | 2,622 ms | 1,823 ms | 1,070 to 1,086 ms | 1,175,404,544 | 614,431,440 |
| Music CLAP | 2,114 ms | 2,703 ms | 1,557 to 1,562 ms | 1,436,663,808 | 776,327,440 |

Local inference had no request cost. The temporary environment was 1.0 GiB.
The Hugging Face cache was 2.6 GiB because Transformers retained original and
converted weights. These values are development costs, not a production
package size.

## Candidate boundaries

| Candidate | Capability and platform | Cost and privacy | Result |
|---|---|---|---|
| General CLAP | Local zero-shot audio and text similarity. Apache-2.0. Mono 48 kHz input in this probe. | No request cost. Audio stays local after download. | Reject as the general provider. It missed sparse bursts and has no judgment or refusal text. |
| Music CLAP | Local music-specific zero-shot similarity. Apache-2.0. Mono 48 kHz input. | No request cost. Audio stays local after download. | Reject. It classified only one of five controls. |
| MERT v1 95M | Local music representation model. It needs a downstream task head. CC-BY-NC-4.0. | No request cost after download. Commercial use needs license review. | Do not run for this prompt-based task. It has no zero-shot text boundary. |
| GPT-Audio-1.5 | Remote audio and text input with text output. Chat Completions does not support structured output for this model. | Audio input is $32 per million tokens. API data is not used for training by default. Standard abuse logs can retain content for 30 days. | Suitable frontier candidate. Blocked by missing API access. |
| Gemini 3.8 Flash | Remote audio and text input with structured output. It combines channels to mono and uses 32 audio tokens per second. | Paid input is $0.75 per million tokens through 2026. Free-tier content can improve Google products. Paid content does not. | Suitable frontier candidate for mono tasks. Blocked by missing API access. |
| Current Claude models | Remote text and image input only. | Not applicable. | Reject for direct audio input. |

Primary sources:

- <https://huggingface.co/laion/clap-htsat-unfused>
- <https://huggingface.co/laion/larger_clap_music>
- <https://huggingface.co/m-a-p/MERT-v1-95M>
- <https://developers.openai.com/api/docs/models/gpt-audio-1.5>
- <https://developers.openai.com/api/docs/guides/your-data>
- <https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash>
- <https://ai.google.dev/gemini-api/docs/audio>
- <https://ai.google.dev/gemini-api/docs/pricing>
- <https://platform.claude.com/docs/en/models/overview>

## Failure behavior and provider contract

A missing input failed in 0.44 seconds. A changed input hash failed in 0.43
seconds. Both failures occurred before the Python model stack imported. The
provider did not retry either error.

A future provider must:

1. Accept absolute paths, SHA-256 values, exact sample ranges, channel intent,
   one task schema, and one exact prompt.
2. Verify all input identities and formats before local inference or remote
   upload.
3. Keep deterministic facts outside the model prompt and response.
4. Return provider, model, returned model version, prompt, input identities,
   raw response, parsed choice, confidence, latency, token use, and cost.
5. Refuse any property that preprocessing removes. Stereo judgment needs a
   provider that preserves channels.
6. Run each blind task three times. Report choice agreement separately from
   accuracy against controls.
7. Mark every result `model-classified`. Never mark it `operator-confirmed`.
8. Delete remote files after each proof and fail if deletion is not confirmed.

Do not add a public perceptual-analysis tool from this result.

## Operator verdict

No operator aesthetic verdict was requested or recorded. The controls had
known or deterministic expected directions. Their accuracy does not mean that
either model can accept a sound-design result for the operator.

## Cleanup

The disposable Bitwig project, its three master recordings, all derived WAV
files, both model caches, the Python environment, and every result JSON were
removed. Bitwig returned to an empty unsaved four-track project.

## Retrospective

The inverted-stereo pair exposed the clearest unsupported claim. Mono
preprocessing removes the property before inference. Require a capability check
before every perceptual prompt.
