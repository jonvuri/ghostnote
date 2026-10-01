# LilyPond composite ledger credit audit

## Scope and method

This audit covers all 30 unique LilyPond composite note outputs: 15 per provider across five note-output families. It excludes analysis answers and sentinel repeats. Twelve complete responses receive deep manual review. Both providers and all five families are covered. The sample emphasizes full or high ledger scores with notation discrepancies, plus aligned correct controls. It is targeted, not random.

The [JSON evidence](lilypond-composite-ledger-credit.json) retains all 30 full responses, task/prompt/payload hashes, independent notation and ledger transcriptions, exact agreement checks, and component counts. The deep cases also retain full prompts and tasks. No frozen artifact or response text was changed.

The GN separator and ledger are wrapper fields. Only the notation segment is LilyPond input. Note transcription uses official full-language rules, not the benchmark parser. MIDI pitch follows absolute Dutch note names; each Voice has a separate rational time cursor. The existing scorer only tallies these independent values under its original component rubric. Direct contract checks determine strict task success.

No LilyPond executable was installed. Manual grammar review resolves 29 complete scores. One literal Scheme-error response has no certified full music decode; its known entries are retained separately.

## Rules used

The Dutch names `ees` and contracted `as` are valid flats. An apostrophe raises one octave; a comma lowers one. See [Writing pitches](https://lilypond.org/doc/v2.24/Documentation/notation/writing-pitches). Quarter duration factors specify exact rational beats. See [Writing rhythms](https://lilypond.org/doc/v2.24/Documentation/notation/writing-rhythms). Named Voice sequences run in parallel. See [Creating and referencing contexts](https://lilypond.org/doc/v2.24/Documentation/notation/creating-and-referencing-contexts).

The literal `a#4*1` does not mean A-sharp in this grammar. `#` introduces Scheme input. The [official 2.24.4 lexer](https://github.com/lilypond/lilypond/blob/v2.24.4/lily/lexer.ll) sends it to the Scheme reader. The [parser](https://github.com/lilypond/lilypond/blob/v2.24.4/lily/parser.yy) accepts normal note durations or duration objects; raw Scheme sharp spelling is neither. The undefined Scheme expression is not silently changed to `ais4*1`. See also [LilyPond Scheme syntax](https://lilypond.org/doc/v2.24/Documentation/extending/lilypond-scheme-syntax).

## Full population results

| Provider | Ledger components | Notation components through full grammar | Exact agreement | Ledger strict task success | Notation strict task success | Agreement and task success |
|---|---:|---:|---:|---:|---:|---:|
| openai | 292/333 (87.69%) | 274/333 (82.28%) | 4/15 | 6/15 | 3/15 | 2/15 |
| gemini | 301/333 (90.39%) | 286/333 (85.89%) | 8/15 | 5/15 | 4/15 | 4/15 |

The ratios weight components across the five note-output families. They are not the main six-family paired estimand. Equal-prompt means are 87.52% ledger versus 79.84% notation for OpenAI, and 88.28% versus 79.81% for Gemini.

OpenAI loses 18 of 292 ledger component credits when the notation itself is scored. Gemini loses 15 of 301. The strict validity rule gives zero notation credit to Gemini sequence 62, which contains the Scheme error. If all 12 components were granted to that response, the maximally optimistic ceiling would be 298/333 (89.49%); this is not an estimated decode. No compiler error-recovery performance was tested.

Full grammar recovers two false subset failures: OpenAI 84 gains 8/10 notation components from valid `ees`; Gemini 69 gains 9/12 from valid `as`. Gemini 69 also changes from subset disagreement to exact notation/ledger agreement. The other rejected notation contains the Scheme error.

Three OpenAI ledger-perfect responses have failing notation: structure 184, melody 141, and progression 105. One Gemini ledger-perfect response has failing notation: melody 147. Conversely, OpenAI 98 has different bass pitches in the two channels, but both satisfy the task. Agreement and task validity are separate properties.

The role component rubric has a caveat: harmony checks inspect only required onset groups. With all notes at wrong onsets, harmony can pass on empty groups. OpenAI 84 therefore receives 8/10 notation components despite incorrect timing and actual harmony. Direct full-contract checks label it a failure. Component totals remain sensitivity results under the frozen rubric.

## Deep case judgments

| Provider / sequence | Family / variant | Ledger → notation components | Judgment |
|---|---|---:|---|
| openai / 6 | continuation-motif / 6020 | 27 → 17 / 33 | Both channels fail the task. Ledger 27/33, notation 17/33. First notation bass is fis (MIDI 54), while ledger bass is 44 and task requires 44. First notation bass onset 1/14 agrees with that ledger row but task requires 78/7. Inner notation a is 57, ledger and task require 80; inner notation onset 9/28 differs from ledger50/7. Other onset/pitch discrepancies remain. |
| openai / 84 | continuation-roles / 6002 | 9 → 8 / 10 | Valid full-language ees; sharp-only profile fails. Notation starts 0,1,2,3 rather than 31/7,38/7,45/7,52/7. Lead pitches [81,80,81,75] differ from ledger [70,68,70,63]. Bass also differs. Frozen rubric grants 8/10 to decoded notation, but harmony passes vacuously at absent required starts; direct musical inspection finds wrong harmony too. Ledger 9/10 also fails harmony, so neither is full success. |
| openai / 98 | continuation-roles / 6001 | 10 → 10 / 10 | Both channels are fully task-correct (10/10) despite a mismatch. First notation bass ais is MIDI 58; ledger is 46. Both fit range 39..58 and allowed class 10. Notation bass [58,51,53,58] has maximum leap 7, within 8. Ledger bass [46,51,53,58] has maximum leap 5. Same exact starts, durations, and lead notes. A notation/ledger mismatch does not by itself imply musical failure. |
| openai / 105 | generation-progression / 6000 | 12 → 9 / 12 | Ledger is fully task-correct (12/12). Valid notation bass [55,53,62,63] differs from ledger [43,41,50,51]. Last two bass pitches exceed maximum 60. Bass crosses tenor in chords three and four. Chord four bass and soprano are both MIDI 63, so strict distinct-pitch order fails. Movement is 30, within 32. Notation 9/12. |
| openai / 141 | generation-melody / 6002 | 7 → 4 / 7 | Ledger is fully task-correct (7/7). Valid notation has no initial offset and pitches [60,61,53,58,53,54,70,63], instead of ledger [72,73,77,70,77,78,82,75]. Rhythm, range, and motif fail; scale and cadence still pass. Notation 4/7. |
| openai / 184 | comprehension-structure / 6001 | 49 → 46 / 49 | Ledger is exact (49/49). Notation is valid and profile-compliant, but inserts extra rests into lead. Lead starts [2/7,19/21,40/21,61/21], not ledger [2/7,13/21,9/7,41/21]. First lead start passes; three others fail. Notation 46/49, not full success. |
| gemini / 26 | comprehension-structure / 6000 | 49 → 49 / 49 | Aligned correct control. Twelve note tuples match ledger and source. b-double-comma is MIDI 35 at1/7 for5 beats. Both channels49/49. |
| gemini / 33 | continuation-roles / 6001 | 10 → 10 / 10 | Aligned correct role control. Bass [51,48,46,51], lead [70,68,65,63]. Exact required starts 30/7,37/7,44/7,51/7, duration 1, harmony, ranges, leaps, collision avoidance and cadence pass. Both channels10/10. |
| gemini / 48 | continuation-motif / 6022 | 27 → 24 / 33 | Both channels fail the affine task. Ledger 27/33 versus notation24/33. Inner f-prime/fis-prime are 65/66; ledger71/72 are the correct expected inner pitches. Lead g-double-prime is 79 versus ledger/task77; other lead values also differ. Bass and inner starts match the expected origins, but the lead2 onset 141/14 differs from expected139/14 in both channels. |
| gemini / 62 | generation-progression / 6001 | 9 → 0 / 12 | Literal a#4*1 is not a Dutch sharp pitch. Official2.24.4 lexer treats # as Scheme input. The parser accepts note durations from unsigned duration tokens or duration objects, not a raw Scheme sharp spelling. Here the Scheme reader receives 4*1, with no definition for that symbol. The response has a Scheme error; no ais repair is credited. Fifteen other pitch/duration entries are transcribed, with later tenor starts left unknown. Ledger 9/12 is retained primary credit. Whole valid-document notation credit is 0/12; runtime error-recovery music is not certified. |
| gemini / 69 | generation-progression / 6000 | 9 → 9 / 12 | Valid Dutch contracted as-prime = A-flat, MIDI 68. The profile rejects it, but every notation tuple matches the ledger exactly. Both channels9/12 under the component rubric. This restores one agreement classification. Harmony, range, and voice crossing still fail; no full task success. |
| gemini / 147 | generation-melody / 6002 | 7 → 6 / 7 | Ledger is fully task-correct (7/7). Valid notation uses repeated1/6 rests, giving starts [3/7,23/21,37/21,17/7,65/21,79/21,31/7,107/21]; ledger requires [3/7,23/21,10/7,44/21,17/7,65/21,24/7,86/21]. Pitches and all other contract checks pass. Notation6/7. |

## Full response appendix

Each block contains the complete response payload, including its ledger. Other inventory payloads and all independent note tuples are in the JSON.

### openai sequence 6: continuation-motif 6020

Task hash: `7e1cc1b56671909d5e94801571b506443467a9175413b51f3237e78d8a2efb9a`.
Payload hash: `b682216433160068c412c9f296791aa781d954ace1f9f7e1461887326ae7a96e`.

```text
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { r4*1/14 fis4*1/4 r4*5/4 a,4*1/8 r4*1/8 ais,4*1/4 }
    \new Voice = "inner.1" { r4*9/28 a4*1/2 r4*1/2 e'4*1/8 }
    \new Voice = "lead.1" { r4*12/7 f''4*3/8 r4*3/8 a'4*3/4 ais'4*3/2 }
  >>
}
--- GN SIDE LEDGER ---
GN event-1 bass 1/14 1/4 44 84
GN event-2 inner 50/7 1/2 80 84
GN event-3 lead 107/14 3/8 77 84
GN event-4 lead 235/28 3/4 69 84
GN event-5 lead 64/7 3/2 70 84
GN event-6 inner 57/7 1/8 73 84
GN event-7 bass 11/2 1/8 53 84
GN event-8 bass 111/14 1/4 52 84
```

### openai sequence 84: continuation-roles 6002

Task hash: `18fffcce3733a22c1777c2b5036802e82269b0098a9d8878223ff39b386caeda`.
Payload hash: `a2e415ce409c7b43269228bff93650cae8a0b21614e566cd8271c6f4a2f358bc`.

```text
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { c4*1 a4*1 f4*1 c4*1 }
    \new Voice = "lead.1" { a''4*1 gis''4*1 a''4*1 ees''4*1 }
  >>
}
--- GN SIDE LEDGER ---
GN event-1 bass 31/7 1 48 84
GN event-2 lead 31/7 1 70 84
GN event-3 bass 38/7 1 45 84
GN event-4 lead 38/7 1 68 84
GN event-5 bass 45/7 1 41 84
GN event-6 lead 45/7 1 70 84
GN event-7 bass 52/7 1 48 84
GN event-8 lead 52/7 1 63 84
```

### openai sequence 98: continuation-roles 6001

Task hash: `3f478b9d248072fed49dfa42e2a8d276ae064a1a8987cb11e37678450969b812`.
Payload hash: `9c31fcc8deeb783c0a6c9438abed800040ba5927c23097382d652c723581d8da`.

```text
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { r4*30/7 ais4*1 dis4*1 f4*1 ais4*1 }
    \new Voice = "lead.1" { r4*30/7 dis'4*1 gis'4*1 ais'4*1 dis''4*1 }
  >>
}
--- GN SIDE LEDGER ---
GN event-1 bass 30/7 1 46 84
GN event-2 bass 37/7 1 51 84
GN event-3 bass 44/7 1 53 84
GN event-4 bass 51/7 1 58 84
GN event-5 lead 30/7 1 63 84
GN event-6 lead 37/7 1 68 84
GN event-7 lead 44/7 1 70 84
GN event-8 lead 51/7 1 75 84
```

### openai sequence 105: generation-progression 6000

Task hash: `aeb50bc7c508c8279146cd7835e7dff836b3b8f50eb928e5d471b117e0503b71`.
Payload hash: `00a64b379e8031de0424c194d15f276a118cb3ec0ced6486aab97c7c3acbe821`.

```text
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { r4*1/7 g4*1 f4*1 d'4*1 dis'4*1 }
    \new Voice = "tenor.1" { r4*1/7 ais4*1 gis4*1 f4*1 g4*1 }
    \new Voice = "alto.1" { r4*1/7 dis'4*1 c'4*1 ais4*1 ais4*1 }
    \new Voice = "soprano.1" { r4*1/7 g'4*1 gis'4*1 gis'4*1 dis'4*1 }
  >>
}
--- GN SIDE LEDGER ---
GN event-1 bass 1/7 1 43 84
GN event-2 bass 8/7 1 41 84
GN event-3 bass 15/7 1 50 84
GN event-4 bass 22/7 1 51 84
GN event-5 tenor 1/7 1 58 84
GN event-6 tenor 8/7 1 56 84
GN event-7 tenor 15/7 1 53 84
GN event-8 tenor 22/7 1 55 84
GN event-9 alto 1/7 1 63 84
GN event-10 alto 8/7 1 60 84
GN event-11 alto 15/7 1 58 84
GN event-12 alto 22/7 1 58 84
GN event-13 soprano 1/7 1 67 84
GN event-14 soprano 8/7 1 68 84
GN event-15 soprano 15/7 1 68 84
GN event-16 soprano 22/7 1 63 84
```

### openai sequence 141: generation-melody 6002

Task hash: `58427f81ae668d45ab63a761f1b9ca8eb40e4c218c01499cb92de6dbfe0271d1`.
Payload hash: `885bc929fe9159017c45163df722bafb32024ffc4b510eb59780c79742dda123`.

```text
\version "2.24.4"
\score {
  <<
    \new Voice = "lead.1" { c'4*1/2 cis'4*1/2 f4*1/2 ais4*1/2 f4*1/2 fis4*1/2 ais'4*1/2 dis'4*1/2 }
  >>
}
--- GN SIDE LEDGER ---
GN event-1 lead 3/7 1/2 72 84
GN event-2 lead 23/21 1/2 73 84
GN event-3 lead 10/7 1/2 77 84
GN event-4 lead 44/21 1/2 70 84
GN event-5 lead 17/7 1/2 77 84
GN event-6 lead 65/21 1/2 78 84
GN event-7 lead 24/7 1/2 82 84
GN event-8 lead 86/21 1/2 75 84
```

### openai sequence 184: comprehension-structure 6001

Task hash: `438c07f6748ab2fa127c755d543b337846461b1d06c0259ee0db6526bdce579e`.
Payload hash: `8f9455673766b6e2a993ee36b1cfedf26d89b5394cac2535751089ec65d6afcc`.

```text
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { r4*2/7 gis,4*3 cis4*3 }
    \new Voice = "keys.1" { r4*2/7 gis'4*3 cis''4*3 }
    \new Voice = "keys.2" { r4*2/7 c''4*3 f''4*3 }
    \new Voice = "keys.3" { r4*2/7 dis''4*3 gis''4*3 }
    \new Voice = "lead.1" { r4*2/7 gis'4*1/3 r4*2/7 ais'4*1/3 r4*2/3 c''4*1/3 r4*2/3 dis''4*1/3 }
  >>
}
--- GN SIDE LEDGER ---
GN event-1 bass 2/7 3 44 84
GN event-2 keys 2/7 3 68 84
GN event-3 keys 2/7 3 72 84
GN event-4 keys 2/7 3 75 84
GN event-5 lead 2/7 1/3 68 84
GN event-6 lead 13/21 1/3 70 84
GN event-7 lead 9/7 1/3 72 84
GN event-8 lead 41/21 1/3 75 84
GN event-9 bass 23/7 3 49 84
GN event-10 keys 23/7 3 73 84
GN event-11 keys 23/7 3 77 84
GN event-12 keys 23/7 3 80 84
```

### gemini sequence 26: comprehension-structure 6000

Task hash: `00c14be3706e2ea46ac30aacf1a2f05838e9cb35a7f8bae72338183f34b7bbd8`.
Payload hash: `fb8c4f6fc443a6c4670d41a10d6035038024b2d52276b07c2848452f2b8a29e6`.

```text
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
--- GN SIDE LEDGER ---
GN event-1 bass 1/7 5 35 84
GN event-2 keys 1/7 5 59 84
GN event-3 keys 1/7 5 63 84
GN event-4 keys 1/7 5 66 84
GN event-5 lead 1/7 1/2 59 84
GN event-6 lead 25/28 1/2 61 84
GN event-7 lead 23/14 1/2 63 84
GN event-8 lead 67/28 1/2 66 84
GN event-9 bass 36/7 5 40 84
GN event-10 keys 36/7 5 64 84
GN event-11 keys 36/7 5 68 84
GN event-12 keys 36/7 5 71 84
```

### gemini sequence 33: continuation-roles 6001

Task hash: `3f478b9d248072fed49dfa42e2a8d276ae064a1a8987cb11e37678450969b812`.
Payload hash: `e388c63781d971b598a889456f1b14d413998db1725559ba56a8948fd20ccdfd`.

```text
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { r4*30/7 dis4*1 c4*1 ais,4*1 dis4*1 }
    \new Voice = "lead.1" { r4*30/7 ais'4*1 gis'4*1 f'4*1 dis'4*1 }
  >>
}
--- GN SIDE LEDGER ---
GN e1 bass 30/7 1 51 84
GN e2 bass 37/7 1 48 84
GN e3 bass 44/7 1 46 84
GN e4 bass 51/7 1 51 84
GN e5 lead 30/7 1 70 84
GN e6 lead 37/7 1 68 84
GN e7 lead 44/7 1 65 84
GN e8 lead 51/7 1 63 84
```

### gemini sequence 48: continuation-motif 6022

Task hash: `10780d3ee11f24cce6fe7ffec24a75fe1dea5b36d498d0fb6ad3ba9668f50524`.
Payload hash: `0918364615433242064e788b62cbf9beee459342b4d94770cf178cd39f6d8738`.

```text
\version "2.24.4"
\score {
  <<
    \new Voice = "bass.1" { r4*97/14 f4*1/4 r4*1/4 fis4*1 }
    \new Voice = "bass.2" { r4*111/14 g4*1 }
    \new Voice = "inner.1" { r4*167/14 f'4*1/4 r4*5/4 fis'4*3/4 }
    \new Voice = "lead.1" { r4*66/7 g''4*3/4 r4*3/4 ais''4*3/4 }
    \new Voice = "lead.2" { r4*141/14 f''4*1/2 }
  >>
}
--- GN SIDE LEDGER ---
GN event-1 bass 97/14 1/4 53 84
GN event-2 bass 103/14 1 54 84
GN event-3 bass 111/14 1 55 84
GN event-4 inner 167/14 1/4 71 84
GN event-5 lead 66/7 3/4 77 84
GN event-6 lead 141/14 1/2 75 84
GN event-7 inner 188/14 3/4 72 84
GN event-8 lead 151/14 3/4 80 84
```

### gemini sequence 62: generation-progression 6001

Task hash: `372c3a5e8b6a5fe00829c15162ee5a42804c123d29c7c52e7ef3f89260239d53`.
Payload hash: `f5c7d22d7ed23ef8ac34d1c9c733ad2563857a930fc059ef91ef1733fdc389a0`.

```text
\version "2.24.4"
\score {
  <<
    \new Voice = "soprano.1" { r4*2/7 a'4*1 g'4*1 e''4*1 f'4*1 }
    \new Voice = "alto.1" { r4*2/7 f'4*1 d'4*1 c''4*1 c''4*1 }
    \new Voice = "tenor.1" { r4*2/7 c'4*1 a#4*1 g'4*1 a4*1 }
    \new Voice = "bass.1" { r4*2/7 a4*1 g4*1 e4*1 f4*1 }
  >>
}
--- GN SIDE LEDGER ---
GN e1 soprano 2/7 1 69 84
GN e2 alto 2/7 1 65 84
GN e3 tenor 2/7 1 60 84
GN e4 bass 2/7 1 45 84
GN e5 soprano 9/7 1 67 84
GN e6 alto 9/7 1 62 84
GN e7 tenor 9/7 1 58 84
GN e8 bass 9/7 1 43 84
GN e9 soprano 16/7 1 76 84
GN e10 alto 16/7 1 72 84
GN e11 tenor 16/7 1 67 84
GN e12 bass 16/7 1 52 84
GN e13 soprano 23/7 1 65 84
GN e14 alto 23/7 1 72 84
GN e15 tenor 23/7 1 57 84
GN e16 bass 23/7 1 53 84
```

### gemini sequence 69: generation-progression 6000

Task hash: `aeb50bc7c508c8279146cd7835e7dff836b3b8f50eb928e5d471b117e0503b71`.
Payload hash: `2b198ebcbaeabd112618e1ead5476757afa599e4565708eb69a8bfb0ef25801a`.

```text
\version "2.24.4"
\score {
  <<
    \new Voice = "soprano.1" { r4*1/7 g'4*1 as'4*1 f'4*1 g'4*1 }
    \new Voice = "alto.1" { r4*1/7 dis'4*1 c'4*1 c'4*1 dis'4*1 }
    \new Voice = "tenor.1" { r4*1/7 ais4*1 f4*1 gis4*1 ais4*1 }
    \new Voice = "bass.1" { r4*1/7 g4*1 f4*1 d4*1 dis4*1 }
  >>
}
--- GN SIDE LEDGER ---
GN event-01 soprano 1/7 1 67 84
GN event-02 soprano 8/7 1 68 84
GN event-03 soprano 15/7 1 65 84
GN event-04 soprano 22/7 1 67 84
GN event-05 alto 1/7 1 63 84
GN event-06 alto 8/7 1 60 84
GN event-07 alto 15/7 1 60 84
GN event-08 alto 22/7 1 63 84
GN event-09 tenor 1/7 1 58 84
GN event-10 tenor 8/7 1 53 84
GN event-11 tenor 15/7 1 56 84
GN event-12 tenor 22/7 1 58 84
GN event-13 bass 1/7 1 55 84
GN event-14 bass 8/7 1 53 84
GN event-15 bass 15/7 1 50 84
GN event-16 bass 22/7 1 51 84
```

### gemini sequence 147: generation-melody 6002

Task hash: `58427f81ae668d45ab63a761f1b9ca8eb40e4c218c01499cb92de6dbfe0271d1`.
Payload hash: `385084d43e1e4747a96eb17c047dc977664ebe587a5ff64b2fab57cedbd7c86e`.

```text
\version "2.24.4"
\score {
  <<
    \new Voice = "lead.1" { r4*3/7 dis'4*1/2 r4*1/6 dis'4*1/2 r4*1/6 f'4*1/2 r4*1/6 ais'4*1/2 r4*1/6 gis'4*1/2 r4*1/6 gis'4*1/2 r4*1/6 ais'4*1/2 r4*1/6 dis''4*1/2 }
  >>
}
--- GN SIDE LEDGER ---
GN e1 lead 3/7 1/2 63 84
GN e2 lead 23/21 1/2 63 84
GN e3 lead 10/7 1/2 65 84
GN e4 lead 44/21 1/2 70 84
GN e5 lead 17/7 1/2 68 84
GN e6 lead 65/21 1/2 68 84
GN e7 lead 24/7 1/2 70 84
GN e8 lead 86/21 1/2 75 84
```

## Interpretation and limits

The ledger advantage partly reflects reliable values outside the notation. Its size falls when actual notation is read, even after valid flat spellings recover credit. These responses do not support a claim that full composite documents are consistently correct.

Task validity can remain high despite an exact notation/ledger mismatch when the task permits alternate voicings. Whole-document reliability still requires agreement between its representations.

This audit covers one format and five note-output families. It does not estimate other formats or new tasks. The Scheme-error case remains unresolved for exact runtime recovery. Native notation has a separate full-grammar audit; compare those decoded values only with the same task and validity rules.

## Retrospective

Future reports must show ledger task validity, notation task validity, and exact cross-representation agreement separately. Do not treat an empty required onset group as positive harmony evidence.
