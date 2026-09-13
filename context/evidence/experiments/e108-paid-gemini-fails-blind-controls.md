---
title: E108 — Paid Gemini fails blind controls
kind: evidence
state: active
updated: 2026-09-12
parent: ../../plan/phase-6/6d-perceptual-audio-model-evaluation.md
---

# E108 — Paid Gemini fails blind controls

## Verdict

Do not select Gemini 3.8 Flash as the perceptual provider. The paid retry
completed all 27 requests, but it passed only three of five classifications on
each repeat. It passed two, three, and three of four supported direction pairs.
The three decision hashes differed.

Gemini described exact digital silence as a melody, a pulsing tone, and
percussive bursts across the three repeats. It described a steady 440 Hz tone
as pulsing on every repeat. These wrong answers had confidence from `0.95` to
`0.98`. The model also selected the 440 Hz tone as higher than the 880 Hz tone
on every repeat.

The paid retry resolved the E107 service blocker. It did not produce a provider
that passed the blind gate. Keep the perceptual boundary private.

## Exact cohort

The retry regenerated the controlled cohort because E107 removed its owned
artifacts. Nine of eleven WAV sources reproduced byte for byte. A fresh Bitwig
capture and its low-pass transform received new identities.

The source format was stereo signed 24-bit PCM WAV at 44.1 kHz. The canonical
manifest SHA-256 was
`f233d56835ff4dbb3521ca4e8173b0e2194b3b944cff2405d80b89218bbdfd9c`.

| Blind alias | Role outside model input | Input SHA-256 | Exact range |
|---|---|---|---|
| `clip-4e29912c9cbf` | Digital silence | `4e29912c9cbf237e6b5c50a8eed475e056710fe0dd004b08130310921d6a2d7e` | Samples 0 through 44,099, each channel |
| `clip-a922f3e08f9e` | 440 Hz tone | `a922f3e08f9ed36da32e3f6c3701d45fa650743992a70307c6c7d2f79f5b6df3` | Samples 0 through 88,199, each channel |
| `clip-fc3da9f816a6` | 880 Hz tone | `fc3da9f816a640cb68f633542b7694a2ef1040e308018eb835869d90dd3f7658` | Samples 0 through 88,199, each channel |
| `clip-e488ba602639` | Three bursts | `e488ba6026396351561f5b5887feaa4c26958625877a02f7b7bcba66114c93bd` | Samples 0 through 88,199, each channel |
| `clip-a7d67683c007` | Six bursts | `a7d67683c0078be30e8ac6eb671b0045b2814cec850d83ba29b94a43107d31ef` | Samples 0 through 88,199, each channel |
| `clip-8decfd847e80` | 2 Hz amplitude modulation | `8decfd847e803e63ebbef71557c1f0c99529547d2f13e6cc38dede7a3de96003` | Samples 0 through 176,399, each channel |
| `clip-320552cd4cae` | 8 Hz amplitude modulation | `320552cd4caebe5e75726973abceeeedfb2e32b5dc169f98a06e7c51718eabac` | Samples 0 through 176,399, each channel |
| `clip-2494c90e9f98` | Bitwig capture | `2494c90e9f98d99ac96d7d58717fd9be538433f4e655b9961bbb599d579b20a2` | Samples 0 through 199,679, each channel |
| `clip-2404022b9b61` | 700 Hz low-pass capture | `2404022b9b61cab4ad71eb5e5a6d2c63fdb485c8eb8b665483ddcc18375f0ce8` | Samples 0 through 199,679, each channel |
| `clip-cb63f4ab36b3` | Exact correlated stereo | `cb63f4ab36b39ed1f537eff8e5a2e931f20d0e9617f1a30d866aa635eeee384c` | Samples 0 through 88,199, each channel |
| `clip-30de40c9c390` | Exact inverted stereo | `30de40c9c390fcf48382e12a45e3ac47d0bc37b25ed2a91354da6501257418c2` | Samples 0 through 88,199, each channel |

The fresh master recording SHA-256 was
`91ca81018c9c8e27801337b81da170af8821497de334c7e4613bca9434febc55`.
It covered eight beats at 110 BPM from one Polysynth track. It was stereo
24-bit PCM at 44.1 kHz, 1,198,264 bytes, and 4.527891 seconds long. Its mean
level was -39.7 dB, and its peak was -27.3 dB. The live capture probe passed all
six gates and restored the exact entry track list.

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

The four direction properties were higher pitch, more frequent attacks, faster
pulse, and brighter timbre. The adapter refused stereo width before inference
because Google documents that Gemini combines audio channels to mono.

## Result

The provider was the Gemini Developer API. The requested and returned model
value was `gemini-3.8-flash`. The API returned no request IDs.

| Task | Expected | Repeat 1 | Repeat 2 | Repeat 3 | Result |
|---|---|---|---|---|---|
| Silence class | Digital silence | Melody | Pulsing tone | Percussive bursts | Fail, unstable |
| Tone class | Steady pitched tone | Pulsing tone | Pulsing tone | Pulsing tone | Fail |
| Sparse-burst class | Percussive bursts | Percussive bursts | Percussive bursts | Percussive bursts | Pass |
| 2 Hz pulse class | Pulsing tone | Pulsing tone | Pulsing tone | Pulsing tone | Pass |
| Bitwig class | Synthesizer melody | Synthesizer melody | Synthesizer melody | Synthesizer melody | Pass |
| Higher pitch | 880 Hz, B | 440 Hz, A | 440 Hz, A | 440 Hz, A | Fail |
| More attacks | Six bursts, A | Three bursts, B | Six bursts, A | Six bursts, A | Unstable |
| Faster pulse | 8 Hz, B | 8 Hz, B | 8 Hz, B | 8 Hz, B | Pass |
| Brighter timbre | Original, A | Original, A | Original, A | Original, A | Pass |
| Stereo width | Unknown | Adapter refusal | Adapter refusal | Adapter refusal | Pass |

The decision hashes were:

- `5e6ec966d098b2ee5ba3be76e264b4412ebf12265aa1d7930970470bb24cd486`
- `b884d3e9438a24be97c9018aef8eb4e7ba5c2785eade7887e4909145ada9a0b6`
- `5beba7f343f7c7e4480b403504be5f23f3c19f70bec59c2aa9da452ec6295fa6`

Request latency ranged from 1,702 to 4,752 ms. Median latency was 2,182 ms.
The 27 responses used 5,721 input tokens, 1,328 candidate tokens, and 5,340
thinking tokens. At the documented standard paid rates on the run date, the
estimated cost was `$0.02930`. This is an estimate, not a billing record.

The canonical result SHA-256 was
`23a50318026ab3a7d71ae66ee324e74b58e7bf49ce0615018fcddbbc36279202`.
The serialized result file SHA-256 was
`991aa367d218cdf82ed3e60c524f1ecef6f8b49d1291907fbe630bc9b24537cf`.
The result contained no API key.

Audio was inline in each request. The probe created no Files API object. The
operator reported paid credits, but the API response did not expose the account
plan. Google service data controls apply to the request content.

Primary provider sources:

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
JSON, and Python environment were removed. Bitwig returned to an empty unsaved
four-track project with its audio engine inactive. No remote Files API artifact
existed.

## Retrospective

Exact silence exposed both false perception and unstable labels. Keep silence
as the first control for every perceptual provider.
