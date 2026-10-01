# LilyPond native grammar audit

## Scope and method

This audit tests the narrow-parser penalty for LilyPond 2.24.4 native outputs. It inventories all 30 unique note-output cases from OpenAI and Gemini. Analysis answers and sentinel repeats are excluded. All three subset rejections were reviewed. Twelve full responses received deep manual review: three rejections, six accepted error cases, and three controls. Selection is targeted, not random.

The [JSON evidence](lilypond-native-full-grammar.json) retains all 30 full payloads, provider sequence IDs, payload hashes, task hashes, independent note transcriptions, and component counts. The 12 deep cases also retain the full prompt and task.

No local LilyPond executable was available. Grammar judgments use the official 2.24.4 manual. No claim of successful compilation or engraving is made. The emitted syntax is simple enough to decode directly. No repository LilyPond parser was used for the independent transcription. The existing component scorer only tallied the transcribed notes under the original rubric. Frozen results remain unchanged.

## Full-language rules

The default Dutch pitch vocabulary accepts `bes`, `ees`, and `aes`. Sharp and flat suffixes alter the note pitch. In absolute mode, `c` is MIDI 48; each apostrophe raises one octave and each comma lowers one octave. No language or relative-mode command occurs in these responses. See [Writing pitches](https://lilypond.org/doc/v2.24/Documentation/notation/writing-pitches).

A quarter note has duration one beat. Its `*N/M` factor scales its exact duration. Rest durations advance the same rational cursor. See [Writing rhythms](https://lilypond.org/doc/v2.24/Documentation/notation/writing-rhythms) and [Writing rests](https://lilypond.org/doc/v2.24/Documentation/notation/writing-rests).

Named Voice expressions use separate timelines within simultaneous music. The lane suffix is a Ghostnote convention; it is removed to recover the task voice. See [Creating and referencing contexts](https://lilypond.org/doc/v2.24/Documentation/notation/creating-and-referencing-contexts) and [Single voice](https://lilypond.org/doc/v2.24/Documentation/notation/single-voice).

## Findings

All 30 payloads use valid full-language syntax by manual inspection. Three fail only because the repository profile excludes flat spellings. All three also have musical errors. No rejected response becomes a strict musical success. No full-language syntax failure or unresolved note decode was found.

| Provider | Profile rejections | Original components | Full-grammar components | Gain | Strict successes |
|---|---:|---:|---:|---:|---:|
| openai | 2/15 | 246/333 (73.87%) | 275/333 (82.58%) | 8.71 points | 4/15, unchanged |
| gemini | 1/15 | 275/333 (82.58%) | 283/333 (84.98%) | 2.40 points | 3/15, unchanged |

These are component-weighted ratios over the five note-output families, not the main six-family paired estimand. Equal-prompt means rise from 69.67% to 79.71% for OpenAI, and from 75.02% to 80.36% for Gemini. The composite ledger component ratios in the same 15 tasks are 292/333 (87.69%) and 301/333 (90.39%). Thus the grammar penalty removes 29 of OpenAI's 46-component gap and 8 of Gemini's 26-component gap. The remaining gaps are real native task errors under this rubric. Composite notation reliability is outside this audit.

OpenAI motif variant 6022 gains 20/33; OpenAI roles variant 6002 gains 9/10; Gemini roles variant 6001 gains 8/10. These are exact recovered counts for the rejected inventory, not extrapolations from the targeted sample.

The prompt explicitly required sharp pitch names. These flat spellings violate the requested profile. The penalty is valid under the frozen profile contract, but it understates recoverable full-language musical content.

## Deep case judgments

Every decoded note tuple is retained in the JSON. The table states representative independent checks.

| Provider / sequence | Family / variant | Original → full grammar | Judgment |
|---|---|---:|---|
| openai / 5 | continuation-motif / 6020 | 18 → 18 / 33 | Valid grammar. Inner gis-prime is MIDI 68, but affine rule requires 80. Bass begins 1/14 instead of 78/7. All eight onsets and seven pitches fail matched components. Durations and voices are correct. 18/33 is a real musical error score. |
| openai / 48 | generation-melody / 6001 | 5 → 5 / 7 | Valid grammar. Second note onset is 2/7+1/2+1/12=73/84, not 20/21. Pitches [72,77,68,70,77,70,73,75]; second motif pair should transpose 77 to 82, but gives 70. Rhythm and motif fail. 5/7 is correct. |
| openai / 62 | generation-progression / 6001 | 8 → 8 / 12 | Valid grammar. Chord two gives bass/tenor/alto/soprano [55,62,57,67], pitch classes {2,7,9} instead of {2,7,10}; tenor is above alto. Same-voice movement totals 36, above 33. Chord three also omits pitch class 10. 8/12 is correct. |
| openai / 76 | comprehension-structure / 6000 | 49 → 49 / 49 | Correct control. Every source note is copied. b-double-comma is MIDI 35; r4*1/7 gives the required origin. Twelve notes, exact voice/start/duration/pitch multiset. 49/49. |
| openai / 83 | continuation-roles / 6002 | 0 → 9 / 10 | Valid bes and ees. All onsets, durations, pitches, ranges, harmony, cadence, and voice count pass. Bass 58 to 48 leaps 10 semitones; maximum is 9. Recover 9/10 components. No full success. |
| openai / 140 | generation-melody / 6002 | 7 → 7 / 7 | Correct generation control. Eight parallel lead lanes have exact rational starts, each duration 1/2. Pitches [72,73,75,70,77,78,80,75] form four +5 pairs; cadence class 3, scale, and range pass. Overlapping lanes correctly represent the requested rhythm. 7/7. |
| openai / 190 | continuation-motif / 6022 | 0 → 20 / 33 | Valid Dutch flats. bes = B-flat, MIDI 58. All eight onsets retain source positions, not the required output origins. Bass pitches are correct; inner and lead pitches are wrong. For inner source MIDI 60: 2*63-60+5=71, but b is 59. Recover 20/33 components, not a full success. |
| gemini / 4 | generation-melody / 6000 | 5 → 5 / 7 | Valid grammar. Second onset is 1/7+1/4+1/6=47/84, not 10/21. ais-prime is MIDI 70, pitch class 10, which is outside the scale. Rhythm and mode fail. All four motif pairs transpose by 5. 5/7 is correct. |
| gemini / 25 | comprehension-structure / 6000 | 49 → 49 / 49 | Correct control. The complete payload is identical to the OpenAI structure control. Twelve source notes and all musical values match. 49/49. |
| gemini / 40 | continuation-roles / 6001 | 0 → 8 / 10 | Valid ees, bes, and aes. Bass pitches [51,48,53,51], lead [70,68,65,63]. Every voice starts at 0,1,2,3 rather than 30/7,37/7,44/7,51/7. The ordinal harmony, ranges, leap, collision, and cadence checks pass. Recover 8/10 components under the frozen rubric; the full contract fails. |
| gemini / 61 | generation-progression / 6001 | 8 → 8 / 12 | Valid grammar. Chord one [45,52,60,65] contains E (class 4) instead of only F-major classes {0,5,9}. Chord two [43,50,59,65] has classes {2,5,7,11}, not {2,7,10}. Last tenor c is MIDI 48 below minimum 49; chord three crosses bass 52 above tenor 48. 8/12 is correct. |
| gemini / 75 | continuation-motif / 6020 | 17 → 17 / 33 | Valid grammar. All three voices begin at beat 0; required origins are 78/7,50/7,107/14. All durations and voice fields pass. Most pitches fail. 17/33 is a real musical error score. |

## Full response appendix

The appendix contains the complete payload for each deep case. The JSON contains all inventory payloads and hashes.

### openai sequence 5: continuation-motif 6020

Task hash: `7e1cc1b56671909d5e94801571b506443467a9175413b51f3237e78d8a2efb9a`.
Payload hash: `09d49c9553ca6e1b79fccaad73d4ac8c75eccd6d27e61fb224c6b6a7c5e5ef3d`.

```lilypond
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { r4*1/14 gis,4*1/4 r4*5/4 gis,4*1/8 r4*1/8 g4*1/4 }
    \new Voice = "inner.1" { r4*9/28 gis'4*1/2 r4*1/2 cis'4*1/8 }
    \new Voice = "lead.1" { r4*12/7 gis'4*3/8 r4*3/8 e''4*3/4 dis''4*3/2 }
  >>
}
```

### openai sequence 48: generation-melody 6001

Task hash: `82a383589fa99198a2f8e87c68adf45e16e91d9d601a988a72f391b8594e6707`.
Payload hash: `8521cf0876280f016fc96fc34ea37dccb23dcfac87e300bc1801853c82e0e5a0`.

```lilypond
\version "2.24.4"
\score {
  <<
    \new Voice = "lead.1" { r4*2/7 c''4*1/2 r4*1/12 f''4*3/8 r4*1/12 gis'4*1/2 r4*1/42 ais'4*1/2 f''4*1/2 ais'4*1/2 cis''4*1/2 dis''4*1/2 }
  >>
}
```

### openai sequence 62: generation-progression 6001

Task hash: `372c3a5e8b6a5fe00829c15162ee5a42804c123d29c7c52e7ef3f89260239d53`.
Payload hash: `c4822d6bf6921ef9a1d628b2872a7e385b6e663a57e6facd81f05c886f444110`.

```lilypond
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { r4*2/7 a4*1 g4*1 e4*1 f4*1 }
    \new Voice = "tenor.1" { r4*2/7 c'4*1 d'4*1 c'4*1 a4*1 }
    \new Voice = "alto.1" { r4*2/7 f'4*1 a4*1 e'4*1 c'4*1 }
    \new Voice = "soprano.1" { r4*2/7 a'4*1 g'4*1 g'4*1 f'4*1 }
  >>
}
```

### openai sequence 76: comprehension-structure 6000

Task hash: `00c14be3706e2ea46ac30aacf1a2f05838e9cb35a7f8bae72338183f34b7bbd8`.
Payload hash: `4b2dcd13d654a61d150575b396401e4a2e572dcc34edad66bcedd22a5a7977f0`.

```lilypond
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { r4*1/7 b,,4*5 e,4*5 }
    \new Voice = "keys.1" { r4*1/7 b4*5 e'4*5 }
    \new Voice = "keys.2" { r4*1/7 dis'4*5 gis'4*5 }
    \new Voice = "keys.3" { r4*1/7 fis'4*5 b'4*5 }
    \new Voice = "lead.1" { r4*1/7 b4*1/2 r4*1/4 cis'4*1/2 r4*1/4 dis'4*1/2 r4*1/4 fis'4*1/2 }
  >>
}
```

### openai sequence 83: continuation-roles 6002

Task hash: `18fffcce3733a22c1777c2b5036802e82269b0098a9d8878223ff39b386caeda`.
Payload hash: `a8b5e27fcd892678187ffde4ff576a3a11bdd13dc538d9e82e095840f135b49e`.

```lilypond
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { r4*31/7 bes4*1 c4*1 cis4*1 bes4*1 }
    \new Voice = "lead.1" { r4*31/7 ees'4*1 ees'4*1 bes'4*1 ees'4*1 }
  >>
}
```

### openai sequence 140: generation-melody 6002

Task hash: `58427f81ae668d45ab63a761f1b9ca8eb40e4c218c01499cb92de6dbfe0271d1`.
Payload hash: `97103ca01ddeee6fb9aeb3cb66b284aa7e2608f0a554b813f6b6f92701ff25cc`.

```lilypond
\version "2.24.4"
\score {
  <<
    \new Voice = "lead.1" { r4*3/7 c''4*1/2 }
    \new Voice = "lead.2" { r4*23/21 cis''4*1/2 }
    \new Voice = "lead.3" { r4*10/7 dis''4*1/2 }
    \new Voice = "lead.4" { r4*44/21 ais'4*1/2 }
    \new Voice = "lead.5" { r4*17/7 f''4*1/2 }
    \new Voice = "lead.6" { r4*65/21 fis''4*1/2 }
    \new Voice = "lead.7" { r4*24/7 gis''4*1/2 }
    \new Voice = "lead.8" { r4*86/21 dis''4*1/2 }
  >>
}
```

### openai sequence 190: continuation-motif 6022

Task hash: `10780d3ee11f24cce6fe7ffec24a75fe1dea5b36d498d0fb6ad3ba9668f50524`.
Payload hash: `c9cdf169547998a849e5ad34db73fe3a5a1d2a01a52b2a705b015fdf51db0a04`.

```lilypond
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { r4*3/7 bes4*1/4 r4*1/4 b4*1 }
    \new Voice = "bass.2" { r4*10/7 c'4*1 }
    \new Voice = "inner.1" { r4*27/14 b4*1/4 r4*5/4 c'4*3/4 }
    \new Voice = "lead.1" { r4*17/7 f'4*3/4 r4*3/4 gis'4*3/4 }
    \new Voice = "lead.2" { r4*41/14 d'4*1/2 }
  >>
}
```

### gemini sequence 4: generation-melody 6000

Task hash: `6a9856f9692ec65f3aac41a5273f8d9f821e8fe5a9685731c6c0183e6110242e`.
Payload hash: `068e13eb843318d890c529885fcc8b36393f65fb15d92350138428f97dd4878e`.

```lilypond
\version "2.24.4"
\score {
  <<
    \new Voice = "lead.1" { r4*1/7 fis'4*1/4 r4*1/6 gis'4*1/2 r4*1/6 ais'4*1/2 r4*1/6 cis''4*1/2 r4*1/6 b'4*1/2 r4*1/6 cis''4*1/2 r4*1/6 dis''4*1/2 r4*1/6 fis''4*1/2 }
  >>
}
```

### gemini sequence 25: comprehension-structure 6000

Task hash: `00c14be3706e2ea46ac30aacf1a2f05838e9cb35a7f8bae72338183f34b7bbd8`.
Payload hash: `4b2dcd13d654a61d150575b396401e4a2e572dcc34edad66bcedd22a5a7977f0`.

```lilypond
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { r4*1/7 b,,4*5 e,4*5 }
    \new Voice = "keys.1" { r4*1/7 b4*5 e'4*5 }
    \new Voice = "keys.2" { r4*1/7 dis'4*5 gis'4*5 }
    \new Voice = "keys.3" { r4*1/7 fis'4*5 b'4*5 }
    \new Voice = "lead.1" { r4*1/7 b4*1/2 r4*1/4 cis'4*1/2 r4*1/4 dis'4*1/2 r4*1/4 fis'4*1/2 }
  >>
}
```

### gemini sequence 40: continuation-roles 6001

Task hash: `3f478b9d248072fed49dfa42e2a8d276ae064a1a8987cb11e37678450969b812`.
Payload hash: `ee1ad5d43d8d3cd1c2d2576e2f37c371162bd7c4fe98254e26cb38feba2601a0`.

```lilypond
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { ees4*1 c4*1 f4*1 ees4*1 }
    \new Voice = "lead.1" { bes'4*1 aes'4*1 f'4*1 ees'4*1 }
  >>
}
```

### gemini sequence 61: generation-progression 6001

Task hash: `372c3a5e8b6a5fe00829c15162ee5a42804c123d29c7c52e7ef3f89260239d53`.
Payload hash: `1c71c76d5cba7dd9f9f87ffa3a717ee6838d8218611548da138be6d64e436725`.

```lilypond
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { r4*2/7 a,4*1 g,4*1 e4*1 f4*1 }
    \new Voice = "tenor.1" { r4*2/7 e4*1 d4*1 c4*1 c4*1 }
    \new Voice = "alto.1" { r4*2/7 c'4*1 b4*1 g4*1 a4*1 }
    \new Voice = "soprano.1" { r4*2/7 f'4*1 f'4*1 e'4*1 f'4*1 }
  >>
}
```

### gemini sequence 75: continuation-motif 6020

Task hash: `7e1cc1b56671909d5e94801571b506443467a9175413b51f3237e78d8a2efb9a`.
Payload hash: `f11abce7ad40cd958a2bf27e6c8f86da7c1c76241e02cee65549280203224dd9`.

```lilypond
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { dis4*1/4 r4*5/4 ais4*1/8 r4*1/8 a4*1/4 }
    \new Voice = "inner.1" { f'4*1/2 r4*1/2 ais4*1/8 }
    \new Voice = "lead.1" { dis''4*3/8 r4*3/8 gis''4*3/4 g''4*3/2 }
  >>
}
```

## Limits and next action

This audit does not establish an effect for untested task shapes or other notation formats. It does not use a compiler. It does not claim that a narrow profile is intrinsically wrong. The relevant finding is measurable lost component credit from three valid flat-spelled outputs, with persistent musical errors after recovery.

Keep profile compliance separate from full-language recoverability in future reports. Check composite notation under the same full-language rules before comparing complete-document reliability.

## Retrospective

The prompt and scorer made the sharp-only boundary explicit. The earlier result summary needed the same boundary. Report profile failure, public-language failure, and recovered musical accuracy in separate fields.
