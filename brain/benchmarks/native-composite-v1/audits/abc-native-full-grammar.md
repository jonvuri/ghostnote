# ABC native grammar audit

## Findings

Broader ABC grammar recovers 12 native components in this cohort. OpenAI sequences 101 and 158 omit explicit accidentals on natural notes. They are valid public event syntax and recover 7/10 and 5/10 components. OpenAI 87 contains actual stacked-accidental errors. No guessed repair is credited.

| Provider | Original components | Full-grammar components | Valid profile-only rejects | Real token errors | Strict successes |
|---|---:|---:|---:|---:|---:|
| OpenAI | 226/333 (67.87%) | 238/333 (71.47%) | 2/15 | 1/15 | 3/15, unchanged |
| Gemini | 229/333 (68.77%) | 229/333 (68.77%) | 0/15 | 0/15 | 3/15, unchanged |

These component-weighted totals cover all 30 unique note outputs across five families. They are not the main six-family estimand. Equal-prompt means rise 44.52% to 52.52% for OpenAI and remain 59.21% for Gemini. Only the three structure-copy tasks pass in each provider.

The 12 recovered components close 12 of the 77-component OpenAI gap against ledger credit of 303/333. Gemini’s 81-component gap against 310/333 remains. No rejected response becomes a full task success. The main remaining problems are actual timing and pitch errors.

## Method and sources

Inventory all 30 complete responses. Deeply review 12: all three subset rejections, seven accepted errors, and two correct controls. Both providers and all five note-output families are covered. Selection targets defects; it is not random sampling.

The [JSON](abc-native-full-grammar.json) retains all full payloads, sequence IDs, hashes, token traces, independent notes, and component counts. Twelve deep cases also contain full prompts and tasks. Twenty-nine bodies have complete independent decodes. The invalid body retains fragments with unresolved starts.

Read the author’s [ABC 2.1 standard](https://michaeleskin.com/abctools/abc_standard_v2.1.pdf), sections 3.1.7, 3.1.14, 4.1–4.5, 4.20, 7, and 11.3. The [official page](https://abcnotation.com/wiki/abc%3Astandard%3Av2.1) returned HTTP 403. The accessible PDF identifies Chris Walshaw and December 2011.

`L:1/48` gives 1/12 quarter-note beat per unit. Note/rest lengths multiply that unit. `C` is MIDI 60; `c` is 72. Commas lower octaves; apostrophes raise them. Mixed octave marks are explicitly legal. Explicit accidentals set pitch and bar carry. Default carry applies by pitch until the barline. Bare notes use carry, then the key. Each Voice has its own cursor. Nonconventional lengths can have undefined staff rendering.

All headers use K:C. The responses contain no ties, tuplets, chords, overlays, transposition, or inline fields. No repository ABC parser was used. A separate exact transcriber applies these public rules. The unchanged component rubric then tallies the notes. Direct contract checks establish strict success. Neither abc2midi nor abcm2ps was installed. Frozen artifacts remain unchanged.

## Limits

The invalid body has ten planned components. Granting all ten gives an optimistic OpenAI ceiling of 248/333 (74.47%). This is a bound, not an estimated decode. No engine error recovery is certified.

The role harmony rubric can pass on empty required onset groups. Counterfactual counts retain that policy. Full-task checks reject timing-shifted outputs. In the two bare-note recoveries, direct ordinal harmony inspection also confirms the pitches.

## Deep response judgments

| Provider / sequence | Family / variant | Original → full grammar | Judgment |
|---|---|---:|---|
| openai / 37 | continuation-motif / 6021 | 20 → 20 / 33 | Valid grammar, wrong affine music. First bass z151/14 gives 151/168 beats, not 151/14. Inner begins 55/56, not 165/14; lead begins 137/168, not 137/14. Bass F is 65 rather than expected 53. Two later bass lengths 15/4 mean 5/16 instead of 5/4. Score remains 20/33. |
| openai / 44 | generation-melody / 6001 | 2 → 2 / 7 | Valid grammar. z96/7 gives 8/7, not 2/7. D24 is MIDI 62 for 2 beats, below range 63..82 and outside the scale. Required duration is 1/2. Last ^A is 70, cadence class 10 instead of 3. Motif is wrong. Count and lead voice pass: 2/7. |
| openai / 58 | generation-progression / 6001 | 1 → 1 / 12 | Valid grammar. Actual starts [8/7,36/7,64/7,92/7] differ from [2/7,9/7,16/7,23/7]. Note 48 lasts 4 beats instead of 1. Bass [69,67,64,65] exceeds range 41..60. Exact count passes; all other frozen checks fail: 1/12. |
| openai / 80 | comprehension-structure / 6000 | 49 → 49 / 49 | Correct structure control. Twelve source notes match. B with three commas is MIDI 35. z12/7 gives 1/7 beat; length 60 means 5 beats. Lead lengths 6 and rests 3 give 1/2 and 1/4 beat. All 49 components pass. |
| openai / 87 | continuation-roles / 6002 | 0 → 0 / 10 | Real token errors: =_E and =_B combine natural and flat. Valid double flats use __. No accidental is removed. Three complete fragments remain, but their starts after malformed tokens are unresolved. Literal lengths 48 mean 4 beats. No initial rest is present. Whole valid-document credit remains 0/10. |
| openai / 101 | continuation-roles / 6001 | 0 → 7 / 10 | Valid bare C-comma (MIDI 48) and F (65), with K:C and no prior relevant accidental. Only the explicit-accidental profile rejects them. z1440/7 means 120/7 beats, four times required 30/7. Length 48 means 4 beats; z48 gaps give 8 beat steps. Recover 7/10; timing and duration still fail. |
| openai / 158 | continuation-roles / 6000 | 0 → 5 / 10 | Bare A48 is valid MIDI 69 in K:C; no prior A accidental applies. z1392/7 means 116/7 beats, not 29/7. Length 48 means 4 beats. Bass 69 exceeds maximum 61; first lead ^C is 61 below minimum 66. Bass leap 56 to 69 is 13 and lead leap 66 to 80 is 14, above limit 7. Recover 5/10; no full success. |
| gemini / 29 | comprehension-structure / 6000 | 49 → 49 / 49 | Correct structure control. Complete response matches OpenAI 80 and the source. Each Voice has its own timeline, so all keys lanes begin at 1/7. All 49 components pass. |
| gemini / 43 | continuation-motif / 6022 | 10 → 10 / 33 | Valid grammar, wrong affine music. First bass z97/14 gives 97/168, not 97/14. B9 is MIDI 71 for 3/4 beat, not expected 58 for 1/4. Inner d9 is 74 for 3/4, not 71 for 1/4. All eight onsets fail; most pitches and durations fail. Score remains 10/33. |
| gemini / 50 | continuation-roles / 6002 | 7 → 7 / 10 | Valid grammar. z1488/7 gives 124/7, not 31/7. Note 48 lasts 4 beats and z288/7 adds 24/7. Role starts [124/7,176/7,228/7,40] are wrong. Ordinal harmony, ranges, leap, collision, and cadence are correct. Timing and duration fail: 7/10. |
| gemini / 57 | generation-progression / 6001 | 1 → 1 / 12 | Valid grammar. z96/7 gives 8/7. Each note 48 lasts 4 beats, and each intervening z96/7 adds 8/7. Chord starts [8/7,44/7,80/7,116/7] are wrong. Later chord pitches and voice order also fail. Exact count passes; all other frozen checks fail: 1/12. |
| gemini / 178 | generation-melody / 6001 | 5 → 5 / 7 | Valid grammar. z96/7 gives 8/7, not 2/7. _E24 lasts 2 beats, not 1/2. Pitches [63,63,63,63,68,68,68,63] fit range, scale, and cadence; the last motif pair is 63 to 63 instead of +5. Rhythm and motif fail: 5/7. |

## Complete payload appendix

All deep cases below preserve the full response. Other full responses and all token traces are in the JSON.

### openai sequence 37: continuation-motif 6021

Task hash: `dedc4b8fd251f2342688cc4a6b39c10c9c9dfea91ac83969956fd881b4458c89`.
Payload hash: `2fb3e916a133870849c0041bfe523492091619efe9241f25e6e0134361c2ad19`.

```abc
%abc-2.1
X:1
T:Ghostnote generated benchmark
L:1/48
M:4/4
K:C
V:bass.1
z151/14 =F15/4 z135/4 ^C15/4 |
V:bass.2
z338/7 =F15/4 |
V:inner.1
z165/14 =A9/2 |
V:inner.2
z207/14 =F3/2 |
V:lead.1
z137/14 =G3 z3 ^A3 z3 =E9/2 |
```

### openai sequence 44: generation-melody 6001

Task hash: `82a383589fa99198a2f8e87c68adf45e16e91d9d601a988a72f391b8594e6707`.
Payload hash: `8e79cee8b35565c6be13053d0964d11df01b54f9c19c7064ef2f7d290ef53d0f`.

```abc
%abc-2.1
X:1
T:Ghostnote generated benchmark
L:1/48
M:4/4
K:C
V:lead.1
z96/7 =D24 |
V:lead.2
z320/7 =F18 |
V:lead.3
z432/7 ^F24 |
V:lead.4
z656/7 ^G24 |
V:lead.5
z768/7 ^D24 |
V:lead.6
z992/7 =F24 |
V:lead.7
z1104/7 ^F24 |
V:lead.8
z1328/7 ^A24 |
```

### openai sequence 58: generation-progression 6001

Task hash: `372c3a5e8b6a5fe00829c15162ee5a42804c123d29c7c52e7ef3f89260239d53`.
Payload hash: `25c767b4f34ddff08666038ce2e6fc43136f947449c4d6fdce0c0947e13ab3ea`.

```abc
%abc-2.1
X:1
T:Ghostnote generated benchmark
L:1/48
M:4/4
K:C
V:bass.1
z96/7 =A48 =G48 =E48 =F48 |
V:tenor.1
z96/7 =C48 _B48 _B48 =A48 |
V:alto.1
z96/7 =f48 =d48 =e48 =C48 |
V:soprano.1
z96/7 =a48 =g48 =g48 =f48 |
```

### openai sequence 80: comprehension-structure 6000

Task hash: `00c14be3706e2ea46ac30aacf1a2f05838e9cb35a7f8bae72338183f34b7bbd8`.
Payload hash: `b5843ead1f09d5b75af00da471e689b6baca54a3ed8b56589fda025dc3a13e36`.

```abc
%abc-2.1
X:1
T:Ghostnote generated benchmark
L:1/48
M:4/4
K:C
V:bass.1
z12/7 =B,,,60 =E,,60 |
V:keys.1
z12/7 =B,60 =E60 |
V:keys.2
z12/7 _E60 _A60 |
V:keys.3
z12/7 ^F60 =B60 |
V:lead.1
z12/7 =B,6 z3 ^C6 z3 _E6 z3 ^F6 |
```

### openai sequence 87: continuation-roles 6002

Task hash: `18fffcce3733a22c1777c2b5036802e82269b0098a9d8878223ff39b386caeda`.
Payload hash: `ab2c95dd75cc26511be8e6f656fe8d82660edb6ead2bae30dd02135c47a8e2a0`.

```abc
%abc-2.1
X:1
T:Ghostnote generated benchmark
L:1/48
M:4/4
K:C
V:bass.1
=_E48 =C48 =F48 =_E48 |
V:lead.1
=_B48 =_E48 ^F48 =_E48 |
```

### openai sequence 101: continuation-roles 6001

Task hash: `3f478b9d248072fed49dfa42e2a8d276ae064a1a8987cb11e37678450969b812`.
Payload hash: `bfdb0876e7edc143b2372dfc2c3eb366f9d3ca0d35ce480d01cd49c7c32ca60b`.

```abc
%abc-2.1
X:1
T:Ghostnote generated benchmark
L:1/48
M:4/4
K:C
V:bass.1
z1440/7 ^A,,48 z48 C,48 z48 ^C,48 z48 ^A,,48 |
V:lead.1
z1440/7 ^D48 z48 ^G48 z48 F48 z48 ^D48 |
```

### openai sequence 158: continuation-roles 6000

Task hash: `f17855168e80a8ce136b81873a09bae1bad711325972adf8aa01f9d8f27cf363`.
Payload hash: `7d8929f8bcc4b061f46c54a096fbdfe2739077e49288c28d328283d31d8e9d19`.

```abc
%abc-2.1
X:1
T:Ghostnote generated benchmark
L:1/48
M:4/4
K:C
V:bass.1
z1392/7 ^C,48 ^F,48 ^G,48 A48 |
V:lead.1
z1392/7 ^C48 ^F48 ^g48 ^f48 |
```

### gemini sequence 29: comprehension-structure 6000

Task hash: `00c14be3706e2ea46ac30aacf1a2f05838e9cb35a7f8bae72338183f34b7bbd8`.
Payload hash: `b5843ead1f09d5b75af00da471e689b6baca54a3ed8b56589fda025dc3a13e36`.

```abc
%abc-2.1
X:1
T:Ghostnote generated benchmark
L:1/48
M:4/4
K:C
V:bass.1
z12/7 =B,,,60 =E,,60 |
V:keys.1
z12/7 =B,60 =E60 |
V:keys.2
z12/7 _E60 _A60 |
V:keys.3
z12/7 ^F60 =B60 |
V:lead.1
z12/7 =B,6 z3 ^C6 z3 _E6 z3 ^F6 |
```

### gemini sequence 43: continuation-motif 6022

Task hash: `10780d3ee11f24cce6fe7ffec24a75fe1dea5b36d498d0fb6ad3ba9668f50524`.
Payload hash: `0d55bae32efbcb198ef2fa514780ded29e05cc21d99a7b2a290df5a96cb83643`.

```abc
%abc-2.1
X:1
T:Ghostnote generated benchmark
L:1/48
M:4/4
K:C
V:bass.1
z97/14 =B9 z3 _d36 |
V:bass.2
z265/14 =c36 |
V:inner.1
z167/14 =d9 z45 ^d27 |
V:lead.1
z132/7 =e27 z27 =g27 |
V:lead.2
z216/7 =c18 |

```

### gemini sequence 50: continuation-roles 6002

Task hash: `18fffcce3733a22c1777c2b5036802e82269b0098a9d8878223ff39b386caeda`.
Payload hash: `88b19cb97207676687b2eae51884ebc05fddf6104f2331a906a709306581829b`.

```abc
%abc-2.1
X:1
T:Ghostnote generated benchmark
L:1/48
M:4/4
K:C
V:bass.1
z1488/7 _E,48 z288/7 _A,,48 z288/7 _B,,48 z288/7 _E,48 |
V:lead.1
z1488/7 _e48 z288/7 _e48 z288/7 =f48 z288/7 _e48 |
```

### gemini sequence 57: generation-progression 6001

Task hash: `372c3a5e8b6a5fe00829c15162ee5a42804c123d29c7c52e7ef3f89260239d53`.
Payload hash: `0681c67229ee74d22873639d35fd367d96b13f296676c13b3b880fb34b3dae49`.

```abc
%abc-2.1
X:1
T:Ghostnote generated benchmark
L:1/48
M:4/4
K:C
V:soprano.1
z96/7 =A48 z96/7 =G48 z96/7 =F48 z96/7 =F48 |
V:alto.1
z96/7 =F48 z96/7 =D48 z96/7 _B48 z96/7 =C48 |
V:tenor.1
z96/7 =C48 z96/7 =D48 z96/7 =C48 z96/7 =A48 |
V:bass.1
z96/7 =A,48 z96/7 =G,48 z96/7 =E,48 z96/7 =F,48 |
```

### gemini sequence 178: generation-melody 6001

Task hash: `82a383589fa99198a2f8e87c68adf45e16e91d9d601a988a72f391b8594e6707`.
Payload hash: `dddc2aafe956462c49d665eea135ec08a9a3fd2442e635df7099b16c362d7cf3`.

```abc
%abc-2.1
X:1
T:Ghostnote generated benchmark
L:1/48
M:4/4
K:C
V:lead.1
z96/7 _E24 z4/21 _E18 z5/7 _E24 z3/7 _E24 z4/21 _A24 z4/21 _A24 z5/7 _A24 z3/7 _E24 |
```

## Retrospective

Keep missing explicit accidentals separate from malformed tokens. Show recovered music separately from profile compliance. Preserve full-task checks when component checks can pass on missing onset groups.
