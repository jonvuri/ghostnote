---
title: E118 — Task-routed sensory packets improve bounded decisions
kind: evidence
state: active
updated: 2026-09-20
parent: ../../plan/phase-6/6h-agent-sensory-packet-utility.md
---

# E118 — Task-routed sensory packets improve bounded decisions

## Verdict

Select task-routed paired evidence for bounded MIDI and audio decisions. Keep
exact source state outside the packet except when a patch needs note identities.
Send only fields that support the declared decision. Include the paired delta,
coverage, uncertainty or refusal rule, and decision purpose.

The task-routed arm reached 18 of 18 correct decisions and 10 of 10 safe
controls across GPT-5.4 Mini and Gemini 3.8 Flash. Raw facts reached 15 of 18
correct decisions. Raw identity reached 12 of 18. The routed arm used less than
half the input tokens of the raw-fact arm on both models.

The result selects an experimental `ghostnote-sensory-packet-v0` shape for
Phase 7 planning. Session 6i must audit this custom interface and can merge or
revise it. It is not a public tool or stable product contract.

## Cohort and separation

The deterministic cohort hash was
`988ac06f0616dfb421a97c8c0bc6121cdedf7c0108e3f63282d3a1c79d174656`.
It used generated MIT project fixtures only. The MIDI sources were complete
eight-beat note lists. The audio sources were four-second stereo 24-bit PCM WAV
files at 44.1 kHz.

The run covered nine paired decisions, one edit choice from a fixed reversible
set, and one guarded MIDI patch. The paired decisions covered voice leading,
syncopation, MIDI no-change, an undefined aesthetic request, level-matched
brightness, explicit loudness, audio no-change, silence, and conflicting
presence cues.

Every arm used the same source pairs, tasks, output shape, and model settings.
The arm changed only the supplied evidence. Facts and estimates stayed in the
input manifest. Agent interpretations stayed in the response. The blind key
and operator verdict stayed outside both records. No response field could
contain an operator verdict.

## Exact source identity

| Case | A source and SHA-256 | B source and SHA-256 |
|---|---|---|
| MIDI voice leading | `voice-A` `fb84bd37557171830d33717f9161ad15000d49f015bb82be7e4f8d272fe850d2` | `voice-B` `f38e15459f48b42b030e5163cdddf5de5998b002bb50ff620e4767d7d5885b46` |
| MIDI syncopation | `sync-A` `36f1f682e3237484f82ca3363274da9db6d429fb4aa8a4916ec7d0f9fea2aaf9` | `sync-B` `43d86886718de91ac38299187b574556548ca90e666ed4a2f2c0894ecb818fa0` |
| MIDI no-change | `same-A` `54e1687c320eb2d43a75852915f4d39172814b6ba907b695fff6d374efcefb1c` | `same-B` `afc3a8e557e91e0771741ae9479b18bd0e04c8967e5c9c4fe5ff8b579108d92e` |
| MIDI compelling | `compelling-A` `9680d4dec1f3c0cb4efccb8cb8bd475d1c6e12b3a6f6a537f206deaa6a2d9c6e` | `compelling-B` `3ebbcb9e9f1b4d1fff5e448f9dc1559d25cc3ce1a5a79eed365024d59f05aa67` |
| Audio brightness | `brightness-A` `69be4de7391b91c0b1b0faa648478cb7e3032b0c7f3620215afa7c170fafff09` | `brightness-B` `03cb1e5ba6bd7762af29e812b77a4f1f008e303facd7b52b4cdec84d039f052a` |
| Audio loudness | `loudness-A` `aa2104b48487f887d58abb358b85cde7594cd96d5397f2cab367ac1ce7670ab4` | `loudness-B` `9c04179da1385305ef87a303e16ef303420f9162e084861b947443ee315b4cd8` |
| Audio no-change | `audio-same-A` `f10eadf0d582cabd2df667196a3492c6849a63986849353685741782d8fb9549` | `audio-same-B` `f10eadf0d582cabd2df667196a3492c6849a63986849353685741782d8fb9549` |
| Audio silence | `silence-A` `9f8b353cfc3da23638f91bdb9da5fc4c34013b4f2cb65e52a5f63d56e77c8254` | `silence-B` `9f8b353cfc3da23638f91bdb9da5fc4c34013b4f2cb65e52a5f63d56e77c8254` |
| Audio presence | `presence-A` `75fbcda70e7a58b944affb032e360d22203e81497a21112022c25447f11166ec` | `presence-B` `2e59335c12c95a55a4b8c876a795b8149bd02c0493f4f1f7f2a15e767f49b2e3` |

The edit source was `edit-base`, with SHA-256
`b81ed31643f1b5d7a5d26072b1a9201e38a10f4767ac2ea693453eab50f880b0`.
Every measurement record copied its source identity and complete coverage.

## Agent results

Both models received a literal result and patch shape. No arm needed a schema
correction or retry. All six arms selected the correct fixed edit. All six
patches passed the source hash, operation, collision, property, and invariant
checks.

| Model and arm | Correct decisions | Safe controls | Edit | Patch | Unsupported claims |
|---|---:|---:|---:|---:|---:|
| GPT, raw identity | 5/9 | 3/5 | 1/1 | 1/1 | 1 |
| GPT, raw facts | 6/9 | 3/5 | 1/1 | 1/1 | 2 |
| GPT, task-routed | 9/9 | 5/5 | 1/1 | 1/1 | 0 |
| Gemini, raw identity | 7/9 | 5/5 | 1/1 | 1/1 | 0 |
| Gemini, raw facts | 9/9 | 5/5 | 1/1 | 1/1 | 0 |
| Gemini, task-routed | 9/9 | 5/5 | 1/1 | 1/1 | 0 |

Raw identity correctly abstained from audio directions that hashes could not
support. It could not answer the controlled brightness or loudness tasks. GPT
also invented a MIDI register difference in the no-change pair.

The raw-fact prompt exposed all absolute fields without pairing or task routes.
GPT misread three values. It called unequal voice movement equal, and it called
equal MIDI register and crest values unequal. These were confident errors.
Gemini read the same raw facts correctly. The cross-model difference is the
reason to route and pair the fields instead of depending on the agent to search
a large inventory.

The routed arm made all required abstentions. It did not give directional
labels to silence, no-change, the undefined `compelling` request, or the
undefined `presence` request. It made no unsupported material prediction.

## Prompt and operation cost

The arm prompt hashes were the same across providers. Raw identity was 43,497
UTF-8 bytes, raw facts was 84,373 bytes, and task-routed was 38,195 bytes.

| Model and arm | Input tokens | Output tokens | Calls | Latency |
|---|---:|---:|---:|---:|
| GPT, raw identity | 12,329 | 1,715 | 1 | 9,969 ms |
| GPT, raw facts | 24,687 | 1,797 | 1 | 10,703 ms |
| GPT, task-routed | 10,254 | 1,709 | 1 | 8,477 ms |
| Gemini, raw identity | 15,050 | 1,641 | 1 | 6,174 ms |
| Gemini, raw facts | 30,860 | 1,666 | 1 | 6,500 ms |
| Gemini, task-routed | 13,002 | 1,759 | 1 | 6,609 ms |

The direct client added about 5.3 MB and 5.7 MB to its resident high-water mark
on the first GPT and Gemini arms. Later arms added less than 0.4 MB. These
measurements do not include provider memory.

## Selected minimal packet

Every selected field uses one common envelope. It contains the packet schema,
field ID, source ID and SHA-256, provider name and version, kind, value, unit,
coverage, uncertainty or refusal rule, and explicit decision purpose. A paired
comparison also contains A, B, and `B_minus_A`. A task route contains an
explicit limit. An unmapped request refuses before broad analysis.

The minimal MIDI packet uses the exact-note probe `phase6h-v0`. Phase 7 must
replace the probe name with the selected exact-note module identity. The
selected payload is:

| Field | Type and unit | Coverage and uncertainty | Decision purpose |
|---|---|---|---|
| Exact note IDs and patch source hash | Exact note list | Complete declared clip coverage; no inferred label | Resolve guarded patch targets |
| Mean adjacent motion | Deterministic derived metric, semitones | Complete note list; exact under the declared formula | Compare voice movement |
| Weak-eighth onset ratio | Deterministic derived metric, ratio | Complete note list; onset-placement proxy only | Compare the declared syncopation proxy |
| Median register | Deterministic derived metric, MIDI note number | Complete note list; exact under the declared formula | Compare or preserve register |
| Note count | Deterministic fact, count | Complete note list | Check count preservation |
| Candidate property delta | Deterministic derived metric, ratio | Declared candidate operation and complete target notes | Select one reversible edit |

The minimal audio packet uses FFmpeg 8.1.2. It did not need a librosa field for
this cohort. The selected payload is:

| Field | Type and unit | Coverage and uncertainty | Decision purpose |
|---|---|---|---|
| Integrated loudness | Estimate, LUFS | Complete stereo stream; null after the silence gate | Check level matching or answer an explicit loudness task |
| Spectral rolloff | Estimate, Hz | Median of complete 8,192-sample Hann frames; null on silence | Compare brightness only when the task declares this proxy |
| Crest | Deterministic derived metric, dB | Complete-stream peak and RMS; null on silence | Compare dynamic behavior or detect no change |
| Silence duration | Thresholded fact, seconds | Complete mix; -90 dBFS for at least 0.05 seconds | Refuse unsupported pitch, spectrum, and timbre directions |

The edit route also exposed register span, adjacent movement, and onset density.
Neither model cited them for the edit or patch. They added ceremony and are not
in the selected minimal edit packet. The raw sample-peak field also had no
decision in this cohort. Keep it in a general audio fact result only when a
clipping or headroom task needs it.

The `compelling` and `presence` metrics were contradiction controls. They are
not selected as routes for those words. A production router must return an
unmapped-property limit unless the task supplies an operational definition.

## Level controls

The brightness pair measured -24.0 LUFS for both sources. Its rolloff values
were 226.099 Hz and 3,999.790 Hz. The presence pair also measured -24.0 LUFS
for both sources. Its rolloff favored B by 5,001.090 Hz, while its crest favored
A by 12.866 dB. The route refused to convert these conflicting facts into a
presence verdict.

The explicit loudness pair was not level-matched. It measured -26.7 and -14.7
LUFS. The audio no-change pair had the same content hash and equal 1.755905 dB
crest. Both silence aliases had the same content hash, four seconds of detected
silence, and no rolloff result.

## Patch and operator verdict

Every model and arm produced the same compiled patch. Its SHA-256 was
`69c7fc8424f690a295f105f8047767009a0805aa270c6789829359c798a34b78`.
It moved four integer-beat notes to weak eighths. It preserved note count,
pitch, velocity, duration, register, track, channel, mute, release velocity,
and note expression. The weak-eighth onset ratio changed from 0.0 to 0.5.

The blind ballot compared this shared patch with a no-change control over four
bars and fixed backing. It asked one direct question about offbeat pull. The
rendered candidates measured -20.1 and -20.0 LUFS. The operator selected the
patch and reported that the other candidate made no pull. The operator judged
the change audible and musically material. The cannot-decide rate was 0 of 1.

This verdict validates the patch property and materiality. It does not select
one packet arm for musical quality because all agent arms produced the same
patch. The objective decision and abstention results select the routed packet.

## Provenance, records, and cleanup

GPT requested `gpt-5.4-mini-2026-03-17`. Gemini requested
`gemini-3.8-flash`. Both used low reasoning or thinking. Gemini used temperature
zero. The direct HTTPS client sent generated MIDI and text measurements only.
It did not upload audio, repository code, or live project data.

The manifest file was 121,423 bytes with SHA-256
`74aa4cf9504e236372ce6ee8599f99de4b379c8ec639835e06479d421dcf4ad6`.
The GPT result hash was
`58f6552faebe0e949d102d07970bbba60a76037361171de717aad25fc9427c65`.
The Gemini result hash was
`e8b6d562a3441a5fd765fd05bbfa86fb47ec74932ce311c909c9624f4789f0a4`.
The summary hash was
`02cc67701c62f8fe948bbb11bca50fe47dc2b4f3789ea6d6cd7286714703dbd9`.

No live project was opened or changed. No public perceptual provider or broad
analysis tool was added. All generated WAV files, model responses, summaries,
ballot files, and Python bytecode were removed after the evidence was recorded.

## Retrospective

Paired decision fields improved accuracy and reduced tokens. The raw inventory
made one model misread simple values. Register span, adjacent movement, and
onset density in the edit route added ceremony. Future packets must start from
the decision and add only the evidence needed to make or refuse it.
