---
title: E107 — GPT-Audio fails blind controls and Gemini is unavailable
kind: evidence
state: active
updated: 2026-09-12
parent: ../../plan/phase-6/6d-perceptual-audio-model-evaluation.md
---

# E107 — GPT-Audio fails blind controls and Gemini is unavailable

## Verdict

Do not select a remote perceptual provider. GPT-Audio-1.5 returned the same
choices on three repeats, but it passed only three of five classifications and
two of four supported direction pairs. It gave confidence from `0.85` to
`0.99` to every wrong answer. Repeatability did not imply accuracy.

Gemini 3.8 Flash accepted the API key and exposed the requested model. Its
inference endpoint then returned `503 UNAVAILABLE` for three bounded attempts.
It produced no judgment. The precise remaining blocker is Gemini service
availability for this model and account.

Keep the perceptual boundary private. Deterministic E105 facts remain the only
selected audio-analysis results. The operator keeps aesthetic authority.

[E108](e108-paid-gemini-fails-blind-controls.md) later resolves the Gemini
service blocker. Its paid retry completes all 27 requests and rejects Gemini
on accuracy and repeatability.

## Follow-up boundary

E106 removed its local cohort after the proof. Thus, its bounded Bitwig bytes
could not be reused. This follow-up regenerated the same controlled design.
Nine of eleven source WAV files reproduced byte for byte. A fresh E103 capture
and its low-pass transform had new exact identities.

Both API keys passed a no-charge model metadata request before inference. The
probe loaded simple name-value pairs from the local `.env` file without shell
evaluation. The file was ignored by Git and restricted to its owner. No key
entered a result artifact or command output.

## Exact cohort

The source format was stereo signed 24-bit PCM WAV at 44.1 kHz. The manifest
SHA-256 was
`2fbdb0492134d7b1ef8d959a37cad69cbf272326b3ed304a93dcdd4728cfe1d5`.

| Blind alias | Role outside model input | Input SHA-256 | Exact range |
|---|---|---|---|
| `clip-4e29912c9cbf` | Digital silence | `4e29912c9cbf237e6b5c50a8eed475e056710fe0dd004b08130310921d6a2d7e` | Samples 0 through 44,099, each channel |
| `clip-a922f3e08f9e` | 440 Hz tone | `a922f3e08f9ed36da32e3f6c3701d45fa650743992a70307c6c7d2f79f5b6df3` | Samples 0 through 88,199, each channel |
| `clip-fc3da9f816a6` | 880 Hz tone | `fc3da9f816a640cb68f633542b7694a2ef1040e308018eb835869d90dd3f7658` | Samples 0 through 88,199, each channel |
| `clip-e488ba602639` | Three bursts | `e488ba6026396351561f5b5887feaa4c26958625877a02f7b7bcba66114c93bd` | Samples 0 through 88,199, each channel |
| `clip-a7d67683c007` | Six bursts | `a7d67683c0078be30e8ac6eb671b0045b2814cec850d83ba29b94a43107d31ef` | Samples 0 through 88,199, each channel |
| `clip-8decfd847e80` | 2 Hz amplitude modulation | `8decfd847e803e63ebbef71557c1f0c99529547d2f13e6cc38dede7a3de96003` | Samples 0 through 176,399, each channel |
| `clip-320552cd4cae` | 8 Hz amplitude modulation | `320552cd4caebe5e75726973abceeeedfb2e32b5dc169f98a06e7c51718eabac` | Samples 0 through 176,399, each channel |
| `clip-e528c1fa7f95` | Bitwig capture | `e528c1fa7f953784fa42f45bd7fb5cb2aff0b54113459f2d40e6fcf3dba2e3f7` | Samples 0 through 199,679, each channel |
| `clip-cf6a25393d1f` | 700 Hz low-pass capture | `cf6a25393d1f7dc88a040aaa72656b675785e2adda3c9f8c4b94e56af4dee177` | Samples 0 through 199,679, each channel |
| `clip-cb63f4ab36b3` | Exact correlated stereo | `cb63f4ab36b39ed1f537eff8e5a2e931f20d0e9617f1a30d866aa635eeee384c` | Samples 0 through 88,199, each channel |
| `clip-30de40c9c390` | Exact inverted stereo | `30de40c9c390fcf48382e12a45e3ac47d0bc37b25ed2a91354da6501257418c2` | Samples 0 through 88,199, each channel |

The fresh master recording SHA-256 was
`a9b8737df993076f00ba404107be9cd883962b2f357c6d960d8c43d59b3db43c`.
It covered eight beats at 110 BPM from one Polysynth track. It was stereo
24-bit PCM at 44.1 kHz, 1,198,264 bytes, and 4.527891 seconds long. Its mean
level was -39.8 dB, and its peak was -27.3 dB.

## Exact prompts

Each classification request used this prompt, with the exact alias inserted:

> You receive one audio clip named `<alias>`. The name is a blind content hash.
> Choose exactly one label from `["digital silence", "a steady pitched tone",
> "short percussive bursts", "a repeating pulsing tone", "a short synthesizer
> melody", "unknown"]`. Choose unknown when the audio is insufficient. Return
> only JSON with choice, confidence from 0 to 1, and a brief reason. Do not infer
> from the file name.

Each direction request used this prompt, with the exact aliases and property
inserted:

> You receive `A=<alias>` and `B=<alias>`. Which clip best matches
> `<property prompt>`? Choose A, B, same, or unknown. Return only JSON with
> choice, confidence from 0 to 1, and a brief reason. Do not infer from the file
> names.

The four property prompts were `a high-pitched steady tone`, `frequent short
percussive attacks`, `a rapidly pulsing tone`, and `a bright synthesizer
timbre`. Two expected answers were A and two were B.

The adapter refused stereo width for both remote candidates before inference.
Google documents mono channel combination. The OpenAI endpoint does not
document channel preservation. An unknown channel boundary cannot support a
stereo judgment.

## GPT-Audio-1.5 result

The provider was the OpenAI Chat Completions API. The requested and returned
model value was `gpt-audio-1.5`. The API exposed no immutable snapshot. The 27
responses reported five system fingerprints:
`fp_48745f786d`, `fp_731884b159`, `fp_a3e283dc0f`, `fp_af7f7f4737`, and
`fp_ffff4c600f`.

| Task | Expected | Returned on all three repeats | Confidence | Result |
|---|---|---|---|---|
| Silence class | Digital silence | Digital silence | `0.95` | Pass |
| Tone class | Steady pitched tone | Steady pitched tone | `0.95` | Pass |
| Sparse-burst class | Percussive bursts | Digital silence | `0.99` | Fail |
| 2 Hz pulse class | Repeating pulsing tone | Steady pitched tone | `0.95` | Fail |
| Bitwig class | Short synthesizer melody | Short synthesizer melody | `0.90` to `0.95` | Pass |
| Higher pitch | 880 Hz, B | 880 Hz, B | `0.90` | Pass |
| More attacks | Six bursts, A | Three bursts, B | `0.85` | Fail |
| Faster pulse | 8 Hz, B | 2 Hz, A | `0.90` | Fail |
| Brighter timbre | Original, A | Original, A | `0.70` | Pass |
| Stereo width | Unknown | Adapter refusal | Not applicable | Pass |

All three choice hashes were
`7a64d6eeec08f7537a6223d6db97f1527e67729203e014920afcfb4b0a2b040b`.
The explanation wording varied slightly. One confidence changed from `0.95`
to `0.90`. Do not treat the reported confidence as calibrated probability.

The one-repeat result file SHA-256 was
`07d11d2165a623dde8e6f2c5b20fa56d2db45913871effcc1f865a33f3bda63e`.
The two-repeat result file SHA-256 was
`de5cb2cfd70938369cad55f8ebde6d243642aaaad7e07e742c75e8a2cc86ef80`.
Together they contained 27 distinct request IDs. Neither file contained an API
key.

Request latency ranged from 855 to 2,223 ms. Median latency was 1,226 ms. The
27 successful requests used 1,155 audio-input tokens, 2,904 text-input tokens,
and 1,036 text-output tokens. They used no audio-output tokens. At the current
documented rates, estimated cost was `$0.05458`.

Audio was inline in each request. The probe did not use the Files API, so it
created no remote file object to delete. Standard OpenAI API data controls and
retention still apply to request content.

Reject this model for the general perceptual boundary. Its stable wrong answers
are more dangerous than an explicit refusal.

## Gemini 3.8 Flash result

The Gemini metadata endpoint returned HTTP 200 for
`models/gemini-3.8-flash`. The first inference request returned HTTP 400
because the REST schema subset rejected `additionalProperties`. The corrected
request removed that field.

Three corrected attempts then returned HTTP 503 with status `UNAVAILABLE` and
the same high-demand message. Each stopped on the first classification input,
which was synthetic digital silence. Gemini received no Bitwig capture. It
returned no model version, judgment, token use, or billable cost.

The probe made no automatic retry. The operator authorized three bounded manual
attempts. Google states that failed 400 and 500 requests do not incur token
charges, although they count against quota.

The request carried audio inline. It created no Files API object. The API does
not expose the key's billing plan, so this run did not independently confirm
paid-service data terms.

Do not infer a quality verdict from this failure. Gemini remains unmeasured.
Its precise blocker is repeated service unavailability on the first controlled
input.

Primary provider sources:

- <https://developers.openai.com/api/docs/models/gpt-audio-1.5>
- <https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create>
- <https://developers.openai.com/api/docs/guides/your-data>
- <https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash>
- <https://ai.google.dev/gemini-api/docs/generate-content/audio>
- <https://ai.google.dev/gemini-api/docs/pricing>

## Separation of authority

- Known construction supplied tone, burst, modulation, and stereo controls.
- One declared low-pass transform supplied the brightness direction.
- Model text supplied only model-classified judgments.
- No operator aesthetic verdict was requested or recorded.

No model output replaced a deterministic fact. No model selected an aesthetic
result for the operator.

## Cleanup

The disposable Bitwig project, three master recordings, derived cohort, result
JSON, Python environment, and package cache were removed. Bitwig returned to an
empty unsaved four-track project. No remote Files API artifact existed.

## Retrospective

High confidence did not identify wrong answers. Require controlled accuracy and
confidence calibration before repeatability can support provider selection.
