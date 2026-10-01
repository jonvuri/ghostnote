# Strudel composite ledger credit audit

## Result

Ledger credit exceeds the independently decoded notation credit. The effect
remains after the full Strudel grammar recovers valid flats and zero weights.
All 30 notation programs are valid in the official 1.2 runtime. Most do not
represent the ledger notes. Many errors concern timing normalization.

| Provider | Ledger components | Full grammar notation | Aligned outputs | Full tasks: ledger / notation |
|---|---:|---:|---:|---:|
| openai | 307/333 (92.19%) | 255/333 (76.58%) | 6/15 | 7 / 4 |
| gemini | 311/333 (93.39%) | 223/333 (66.97%) | 3/15 | 6 / 3 |

This table covers all 30 unique Strudel composite note outputs. Exclude
analysis answers and sentinel repeats. It is the complete retained format
population. It is not a representative estimate for other formats or tasks.
The ledger exceeds notation by 15.62 points for OpenAI and 26.43 for Gemini.
Three perfect ledgers from each provider have wrong notation.

Both asymmetries matter together. From the [native grammar audit](strudel-native-full-grammar.md),
full-grammar native component accuracy is 80.78% for OpenAI and 67.27% for
Gemini. The composite notation values here are 76.58% and 66.97%. Thus native
notation leads composite notation by 4.20 points and 0.30 points on this
finite population. The frozen primary ledger comparison had the opposite
direction. These are note-output totals, not the six-family primary matrix.

## Method and sources

Read every complete response and task contract. Use the pinned official
Strudel 1.2 packages recorded in the [case record](strudel-composite-ledger-credit.json).
Validate JavaScript with the official transpiler. Decode full note/slow/sound
chains with the official mini/core engine. The strings and numeric slow
arguments are not changed. Read ledger GN lines independently. Compare
exact multisets of voice, onset, duration, and pitch. Use each task contract
to judge both representations. The frozen scorer maps decoded notes to
supplemental component credit; it does not decide public grammar meaning.

The engine returns fragments when a sound control crosses a cycle boundary.
Merge fragments only when they share a whole event span and pitch within
one lane. Preserve events in different lanes and musical overlaps. For
example, Gemini 145 retains all eight simultaneous-lane notes. Query one
declared lane period, because later pattern repetitions are outside the
finite task. Use nominal whole-event durations; no audio playback is tested.

- [Official note rules](https://strudel.cc/learn/notes/) permit flats and MIDI numbers.
- [Official mini notation](https://strudel.cc/learn/mini-notation/) defines weights and rests.
- [Time modifiers](https://strudel.cc/learn/time-modifiers/) define slow scaling.
- [Version 1.2 mini source](https://unpkg.com/@strudel/mini@1.2.0/mini.mjs) replaces zero weight with default one.
- [Version 1.2 grammar](https://unpkg.com/@strudel/mini@1.2.0/krill.pegjs) distinguishes weights and slash slow operators.
- [Cycles](https://strudel.cc/understand/cycles/) explains cycles per minute. Four beats per cycle is the task convention.

## Per-case judgments

| Case | Family / variant | Notation profile | Ledger → notation components | Full grammar aligned |
|---|---|---|---|---|
| openai-4 | continuation-motif / 6020 | pass | 23/33 → 17/33 | no |
| openai-40 | continuation-motif / 6021 | pass | 28/33 → 14/33 | no |
| openai-47 | generation-melody / 6001 | pass | 7/7 → 7/7 | yes |
| openai-61 | generation-progression / 6001 | reject | 11/12 → 11/12 | yes |
| openai-75 | comprehension-structure / 6000 | pass | 49/49 → 49/49 | yes |
| openai-82 | continuation-roles / 6002 | pass | 10/10 → 4/10 | no |
| openai-89 | generation-melody / 6000 | pass | 6/7 → 5/7 | no |
| openai-104 | continuation-roles / 6001 | pass | 10/10 → 9/10 | no |
| openai-111 | generation-progression / 6000 | pass | 11/12 → 11/12 | yes |
| openai-118 | comprehension-structure / 6002 | pass | 49/49 → 49/49 | yes |
| openai-132 | generation-progression / 6002 | pass | 11/12 → 1/12 | no |
| openai-139 | generation-melody / 6002 | pass | 7/7 → 4/7 | no |
| openai-153 | continuation-roles / 6000 | pass | 9/10 → 6/10 | no |
| openai-182 | comprehension-structure / 6001 | pass | 49/49 → 49/49 | yes |
| openai-189 | continuation-motif / 6022 | pass | 27/33 → 19/33 | no |
| gemini-3 | generation-melody / 6000 | pass | 6/7 → 5/7 | no |
| gemini-17 | comprehension-structure / 6002 | pass | 49/49 → 49/49 | yes |
| gemini-32 | comprehension-structure / 6000 | pass | 49/49 → 49/49 | yes |
| gemini-39 | continuation-roles / 6001 | pass | 10/10 → 7/10 | no |
| gemini-46 | continuation-motif / 6022 | pass | 33/33 → 10/33 | no |
| gemini-53 | continuation-roles / 6002 | reject | 10/10 → 7/10 | no |
| gemini-60 | generation-progression / 6001 | pass | 10/12 → 1/12 | no |
| gemini-67 | generation-progression / 6000 | pass | 8/12 → 1/12 | no |
| gemini-74 | continuation-motif / 6020 | pass | 27/33 → 14/33 | no |
| gemini-96 | continuation-roles / 6000 | pass | 9/10 → 6/10 | no |
| gemini-117 | generation-progression / 6002 | pass | 9/12 → 1/12 | no |
| gemini-145 | generation-melody / 6002 | pass | 6/7 → 4/7 | no |
| gemini-160 | comprehension-structure / 6001 | pass | 49/49 → 49/49 | yes |
| gemini-167 | continuation-motif / 6021 | pass | 30/33 → 15/33 | no |
| gemini-181 | generation-melody / 6001 | reject | 6/7 → 5/7 | no |

OpenAI 61 is a profile rejection that actually matches its ledger. Its flats
are valid public syntax. This changes one alignment result from the frozen
assessment. Gemini 53 and 181 also use public syntax outside the profile,
but their actual timing still disagrees with their ledgers. No syntax repair
is included in the estimates.

## Manual evidence and complete responses

### openai-4: continuation-motif 6020

The notation omits all leading rests, so all three voices start at zero. The ledger uses the required later origins. Both representations also fail parts of the task: seven notes replace eight, and bass and inner durations are wrong. Ledger earns 23/33; notation earns 17/33.

Retained source: `runs/openai.json`, planned sequence 4.
Payload SHA-256: `bc24780c28778311da2f18de55a81bd7dde027be9bfc1b648101f5eeb98c23c9`.

```text
setcpm(60)
bass_1: note("g#2@28 ~@80 f3@28 ~@83").slow(219/224).sound("piano")
inner_1: note("g#5@56 c#5@14").slow(5/16).sound("piano")
lead_1: note("g#5@21 ~@21 e6@42 ~@48 d#6@84").slow(27/28).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 bass 78/7 1/2 44 84
GN event-2 bass 177/14 1/2 53 84
GN event-3 inner 50/7 1 80 84
GN event-4 inner 57/7 1/4 73 84
GN event-5 lead 107/14 3/8 80 84
GN event-6 lead 235/28 3/4 88 84
GN event-7 lead 10 3/2 87 84
```

### openai-40: continuation-motif 6021

Notation starts at zero and contains different pitches: first inner is MIDI 73, but the ledger says 69. Lead starts at zero with MIDI 64, but the ledger first lead has MIDI 67 at 267/28. The ledger is not fully correct either: lead origins and some bass durations fail. Credit drops from 28/33 to 14/33 when notation is used.

Retained source: `runs/openai.json`, planned sequence 40.
Payload SHA-256: `bf667f4d11da3be4827069b0cdcd227ae5453b9a7e999561b4b8a9b60b770f15`.

```text
setcpm(60)
inner_1: note("c#5@3 d5@1").slow(1/8).sound("piano")
bass_1: note("c#3@1 b2@2 c#3@1").slow(5/4).sound("piano")
lead_1: note("e4@1 f4@1 d4@1").slow(3/8).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 inner 165/14 3/8 69 84
GN event-2 inner 337/28 1/8 65 84
GN event-3 bass 151/14 5/4 53 84
GN event-4 lead 267/28 1/4 67 84
GN event-5 lead 137/14 1/4 70 84
GN event-6 lead 281/28 3/8 64 84
GN event-7 bass 93/7 5/2 50 84
GN event-8 bass 779/56 5/4 53 84
```

### openai-47: generation-melody 6001

Aligned correct control. All eight notation notes match the ledger in voice, onset, duration, and pitch. Both meet melody range, scale, transposed motif, and cadence. Final lane omits its trailing rest rather than adding a zero rest. Both score 7/7.

Retained source: `runs/openai.json`, planned sequence 47.
Payload SHA-256: `d9aa6d3ab722cda07512632353e70486200f5b7d65b1e2d12c14e233e4dc8ee0`.

```text
setcpm(60)
lead_1: note("~@48 c5@84 ~@616").slow(187/168).sound("piano")
lead_2: note("~@160 c#5@63 ~@525").slow(187/168).sound("piano")
lead_3: note("~@216 f4@84 ~@448").slow(187/168).sound("piano")
lead_4: note("~@328 a#4@84 ~@336").slow(187/168).sound("piano")
lead_5: note("~@384 f5@84 ~@280").slow(187/168).sound("piano")
lead_6: note("~@496 f#5@84 ~@168").slow(187/168).sound("piano")
lead_7: note("~@552 a#4@84 ~@112").slow(187/168).sound("piano")
lead_8: note("~@664 d#5@84").slow(187/168).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 lead 2/7 1/2 72 84
GN event-2 lead 20/21 3/8 73 84
GN event-3 lead 9/7 1/2 65 84
GN event-4 lead 41/21 1/2 70 84
GN event-5 lead 16/7 1/2 77 84
GN event-6 lead 62/21 1/2 78 84
GN event-7 lead 23/7 1/2 70 84
GN event-8 lead 83/21 1/2 75 84
```

### openai-61: generation-progression 6001

The notation uses valid flats bb3. The subset rejects them, but the official engine gives exactly the ledger notes. This is a false frozen disagreement caused by the profile boundary. Both representations still lack pitch class 4 in the third chord, and both score 11/12. Public readability and alignment do not imply full task correctness.

Retained source: `runs/openai.json`, planned sequence 61.
Payload SHA-256: `e377df0150b4803eaba5682e48a078a3b9df93fcd84c33268b0c86d07de75a6a`.

```text
setcpm(60)
bass_1: note("~@2 a2@7 g2@7 e3@7 f3@7").slow(15/14).sound("piano")
tenor_1: note("~@2 a3@7 bb3@7 g3@7 a3@7").slow(15/14).sound("piano")
alto_1: note("~@2 c4@7 d4@7 bb3@7 c4@7").slow(15/14).sound("piano")
soprano_1: note("~@2 f4@7 g4@7 g4@7 f4@7").slow(15/14).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 bass 2/7 1 45 84
GN event-2 tenor 2/7 1 57 84
GN event-3 alto 2/7 1 60 84
GN event-4 soprano 2/7 1 65 84
GN event-5 bass 9/7 1 43 84
GN event-6 tenor 9/7 1 58 84
GN event-7 alto 9/7 1 62 84
GN event-8 soprano 9/7 1 67 84
GN event-9 bass 16/7 1 52 84
GN event-10 tenor 16/7 1 55 84
GN event-11 alto 16/7 1 58 84
GN event-12 soprano 16/7 1 67 84
GN event-13 bass 23/7 1 53 84
GN event-14 tenor 23/7 1 57 84
GN event-15 alto 23/7 1 60 84
GN event-16 soprano 23/7 1 65 84
```

### openai-75: comprehension-structure 6000

Aligned copying control. All 12 ledger and notation notes match the source. Both score 49/49.

Retained source: `runs/openai.json`, planned sequence 75.
Payload SHA-256: `46314fec8b028b203a39eeabdac9272b692144c079187be740ae4ff0010b2119`.

```text
setcpm(60)
bass_1: note("~@1 b1@35 e2@35").slow(71/28).sound("piano")
keys_1: note("~@1 b3@35 e4@35").slow(71/28).sound("piano")
keys_2: note("~@1 d#4@35 g#4@35").slow(71/28).sound("piano")
keys_3: note("~@1 f#4@35 b4@35").slow(71/28).sound("piano")
lead_1: note("~@4 b3@14 ~@7 c#4@14 ~@7 d#4@14 ~@7 f#4@14 ~@203").slow(71/28).sound("piano")
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

### openai-82: continuation-roles 6002

The ledger meets all role constraints and scores 10/10. The notation starts at zero, not 31/7. Weights total nine and .slow(2) gives an eight-beat span, so every note lasts 8/9 rather than 1. Notation pitches also differ: first bass MIDI 48 replaces ledger 39; first lead78 replaces70. Its second lead is MIDI 60, below range63. Notation scores 4/10. This is a valid public program with a wrong musical result.

Retained source: `runs/openai.json`, planned sequence 82.
Payload SHA-256: `b272c0d83c8d56921fdb51ab67d76427bd2c728436c4b6fd67df1018b4a61722`.

```text
setcpm(60)
bass_1: note("c3@1 ~@3 g#3@1 ~@1 f3@1 ~@1 c3@1").slow(2).sound("piano")
lead_1: note("f#5@1 ~@3 c4@1 ~@1 f5@1 ~@1 c4@1").slow(2).sound("piano")
--- GN SIDE LEDGER ---
GN event-b1 bass 31/7 1 39 84
GN event-b2 bass 38/7 1 44 84
GN event-b3 bass 45/7 1 41 84
GN event-b4 bass 52/7 1 39 84
GN event-l1 lead 31/7 1 70 84
GN event-l2 lead 38/7 1 63 84
GN event-l3 lead 45/7 1 65 84
GN event-l4 lead 52/7 1 63 84
```

### openai-89: generation-melody 6000

Timing matches in both representations. The second half pitches differ: notation has 80,81,83,85; ledger has 78,80,81,83. Notation fails the motif and final cadence, whereas ledger only fails cadence. Notation credit is 5/7 and ledger credit6/7.

Retained source: `runs/openai.json`, planned sequence 89.
Payload SHA-256: `3fcecf71b03e71145cadb3084f5bcaaade55075f16020ca6aec9ba143ddd677e`.

```text
setcpm(60)
lead_1: note("~@12 c#5@21 ~@63 e5@42 ~@42 g#5@42 ~@42 b5@42 ~@30").slow(1).sound("piano")
lead_2: note("~@40 d#5@42 ~@42 f#5@42 ~@42 a5@42 ~@42 c#6@42 ~@2").slow(1).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 lead 1/7 1/4 73 84
GN event-2 lead 10/21 1/2 75 84
GN event-3 lead 8/7 1/2 76 84
GN event-4 lead 31/21 1/2 78 84
GN event-5 lead 15/7 1/2 78 84
GN event-6 lead 52/21 1/2 80 84
GN event-7 lead 22/7 1/2 81 84
GN event-8 lead 73/21 1/2 83 84
```

### openai-104: continuation-roles 6001

The ledger is fully correct at 10/10. Notation has correct timing but a different bass sequence: 49,52,49,49 instead of46,44,46,46. Notation fails harmony and gets9/10. The documents are not aligned even though their main timing is correct.

Retained source: `runs/openai.json`, planned sequence 104.
Payload SHA-256: `892ab562b1a1684e1acc084f6a613f351e35e24e4228f25510336a6a4df8d999`.

```text
setcpm(60)
bass_1: note("~@30 c#3@7 ~@26").slow(9/4).sound("piano")
bass_2: note("~@37 e3@7 ~@19").slow(9/4).sound("piano")
bass_3: note("~@44 c#3@7 ~@12").slow(9/4).sound("piano")
bass_4: note("~@51 c#3@7 ~@5").slow(9/4).sound("piano")
lead_1: note("~@30 d#4@7 ~@26").slow(9/4).sound("piano")
lead_2: note("~@37 d#4@7 ~@19").slow(9/4).sound("piano")
lead_3: note("~@44 f4@7 ~@12").slow(9/4).sound("piano")
lead_4: note("~@51 d#4@7 ~@5").slow(9/4).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 bass 30/7 1 46 84
GN event-2 bass 37/7 1 44 84
GN event-3 bass 44/7 1 46 84
GN event-4 bass 51/7 1 46 84
GN event-5 lead 30/7 1 63 84
GN event-6 lead 37/7 1 63 84
GN event-7 lead 44/7 1 65 84
GN event-8 lead 51/7 1 63 84
```

### openai-111: generation-progression 6000

Aligned progression control with one shared musical defect. All16 notation notes match the ledger. Chord two lacks pitch class0. Both score 11/12; neither is a full task success.

Retained source: `runs/openai.json`, planned sequence 111.
Payload SHA-256: `fdd8ae73fe200aa9f705b57faff2a07c5e465663a91e715c6505f8d795846f79`.

```text
setcpm(60)
bass_1: note("~@1 g2@7 f2@7 d3@7 d#3@7 ~@20").slow(7/4).sound("piano")
tenor_1: note("~@1 g3@7 f3@7 f3@7 g3@7 ~@20").slow(7/4).sound("piano")
alto_1: note("~@1 a#3@7 g#3@7 a#3@7 a#3@7 ~@20").slow(7/4).sound("piano")
soprano_1: note("~@1 d#4@7 g#4@7 d4@7 d#4@7 ~@20").slow(7/4).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 bass 1/7 1 43 84
GN event-2 tenor 1/7 1 55 84
GN event-3 alto 1/7 1 58 84
GN event-4 soprano 1/7 1 63 84
GN event-5 bass 8/7 1 41 84
GN event-6 tenor 8/7 1 53 84
GN event-7 alto 8/7 1 56 84
GN event-8 soprano 8/7 1 68 84
GN event-9 bass 15/7 1 50 84
GN event-10 tenor 15/7 1 53 84
GN event-11 alto 15/7 1 58 84
GN event-12 soprano 15/7 1 62 84
GN event-13 bass 22/7 1 51 84
GN event-14 tenor 22/7 1 55 84
GN event-15 alto 22/7 1 58 84
GN event-16 soprano 22/7 1 63 84
```

### openai-118: comprehension-structure 6002

Aligned copying control. Both documents preserve all 12 source notes and score 49/49.

Retained source: `runs/openai.json`, planned sequence 118.
Payload SHA-256: `1711a9ebb8030157f8f455f6af1d49ece04b100cee623173c217462aa1811ae0`.

```text
setcpm(60)
bass_1: note("~@3 c2@21 f2@21").slow(45/28).sound("piano")
keys_1: note("~@3 c4@21 f4@21").slow(45/28).sound("piano")
keys_2: note("~@3 e4@21 a4@21").slow(45/28).sound("piano")
keys_3: note("~@3 g4@21 c5@21").slow(45/28).sound("piano")
lead_1: note("~@9 c4@7 d4@7 ~@7 e4@7 ~@7 g4@7 ~@84").slow(45/28).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 bass 3/7 3 36 84
GN event-2 keys 3/7 3 60 84
GN event-3 keys 3/7 3 64 84
GN event-4 keys 3/7 3 67 84
GN event-5 lead 3/7 1/3 60 84
GN event-6 lead 16/21 1/3 62 84
GN event-7 lead 10/7 1/3 64 84
GN event-8 lead 44/21 1/3 67 84
GN event-9 bass 24/7 3 41 84
GN event-10 keys 24/7 3 65 84
GN event-11 keys 24/7 3 69 84
GN event-12 keys 24/7 3 72 84
```

### openai-132: generation-progression 6002

Ledger scores 11/12. Notation weights total35, but .slow(31/28) sets span 31/7. First onset is93/245, not 3/7; every duration is31/35, not 1. Third bass is MIDI 52 rather than ledger 51. Notation scores 1/12. The high ledger score conceals large timing and pitch disagreements.

Retained source: `runs/openai.json`, planned sequence 132.
Payload SHA-256: `b758cc14efb94a92cfafd765bb5947937cb4678ddfe948fe0fab5b994b9f9fe1`.

```text
setcpm(60)
bass_1: note("~@3 g#2@7 f#2@7 e3@7 e3@7 ~@4").slow(31/28).sound("piano")
tenor_1: note("~@3 b3@7 a3@7 f#3@7 b3@7 ~@4").slow(31/28).sound("piano")
alto_1: note("~@3 e4@7 c#4@7 a3@7 g#4@7 ~@4").slow(31/28).sound("piano")
soprano_1: note("~@3 g#4@7 a4@7 b4@7 b4@7 ~@4").slow(31/28).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 bass 3/7 1 44 84
GN event-2 tenor 3/7 1 59 84
GN event-3 alto 3/7 1 64 84
GN event-4 soprano 3/7 1 68 84
GN event-5 bass 10/7 1 42 84
GN event-6 tenor 10/7 1 57 84
GN event-7 alto 10/7 1 61 84
GN event-8 soprano 10/7 1 69 84
GN event-9 bass 17/7 1 51 84
GN event-10 tenor 17/7 1 54 84
GN event-11 alto 17/7 1 57 84
GN event-12 soprano 17/7 1 71 84
GN event-13 bass 24/7 1 52 84
GN event-14 tenor 24/7 1 59 84
GN event-15 alto 24/7 1 68 84
GN event-16 soprano 24/7 1 71 84
```

### openai-139: generation-melody 6002

Ledger meets every melody check and scores 7/7. Notation starts at 193/420, not 3/7, and uses duration 193/630, not 1/2. Notes three and four are MIDI 67 and69 rather than ledger 68 and70, and both are outside the allowed scale. The notation motif fails. Its score is4/7.

Retained source: `runs/openai.json`, planned sequence 139.
Payload SHA-256: `6909810a2ff64a88ea7d1a607d9328fe17f52eff18a742f907aa900762824bb9`.

```text
setcpm(60)
lead_1: note("~@3 d#4@2 ~@1 f4@2 ~@1 g4@2 ~@1 a4@2 ~@1 g4@2 ~@1 a4@2 ~@1 c5@2 ~@2 d#5@2 ~@3").slow(193/168).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 lead 3/7 1/2 63 84
GN event-2 lead 23/21 1/2 65 84
GN event-3 lead 10/7 1/2 68 84
GN event-4 lead 44/21 1/2 70 84
GN event-5 lead 17/7 1/2 68 84
GN event-6 lead 65/21 1/2 70 84
GN event-7 lead 24/7 1/2 73 84
GN event-8 lead 86/21 1/2 75 84
```

### openai-153: continuation-roles 6000

Notation timing matches the ledger, but second bass is50 instead of47, third bass40 instead of44, and final lead65 instead of66. Notation fails harmony, range, role leap, and cadence. Ledger has 9/10, notation 6/10.

Retained source: `runs/openai.json`, planned sequence 153.
Payload SHA-256: `f09b270cf659e81b46ed8b51da5c30159bb354042b8a81af0104c02660f1bc48`.

```text
setcpm(60)
bass_1: note("~@29 c#3@7 d3@7 e2@7 c#3@7").slow(57/28).sound("piano")
lead_1: note("~@29 c#5@7 b4@7 e4@7 f4@7").slow(57/28).sound("piano")
--- GN SIDE LEDGER ---
GN event-b1 bass 29/7 1 49 84
GN event-b2 bass 36/7 1 47 84
GN event-b3 bass 43/7 1 44 84
GN event-b4 bass 50/7 1 49 84
GN event-l1 lead 29/7 1 73 84
GN event-l2 lead 36/7 1 71 84
GN event-l3 lead 43/7 1 64 84
GN event-l4 lead 50/7 1 66 84
```

### openai-182: comprehension-structure 6001

Aligned copying control. Both documents preserve all 12 source notes and score 49/49.

Retained source: `runs/openai.json`, planned sequence 182.
Payload SHA-256: `6df726e0b738ce1ebb61b4df5e900afb8d2cb3f880702f90ad54f9a8869f62e3`.

```text
setcpm(60)
bass_1: note("~@2 g#2@21 c#3@21").slow(11/7).sound("piano")
keys_1: note("~@2 g#4@21 c#5@21").slow(11/7).sound("piano")
keys_2: note("~@2 c5@21 f5@21").slow(11/7).sound("piano")
keys_3: note("~@2 d#5@21 g#5@21").slow(11/7).sound("piano")
lead_1: note("~@6 g#4@7 a#4@7 ~@7 c5@7 ~@7 d#5@7 ~@84").slow(11/7).sound("piano")
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

### openai-189: continuation-motif 6022

Notation has early starts, while some ledger rows use correct late origins. First notation bass54 at 3/7 replaces ledger 58 at 97/14. Inner last notation 73 at 24/7 replaces ledger 72 at 72/7. The ledger also has wrong entries. Its27/33 drops to notation 19/33.

Retained source: `runs/openai.json`, planned sequence 189.
Payload SHA-256: `7f1c34921f265ca20a2985ed8bf007c22f97bf16b52026455062182c12f58dc7`.

```text
setcpm(60)
bass_1: note("~@12 f#3@7 ~@7 c4@28 ~@77").slow(131/112).sound("piano")
bass_2: note("~@40 c#4@28 ~@63").slow(131/112).sound("piano")
inner_1: note("~@54 b4@7 ~@35 c#5@21 ~@14").slow(131/112).sound("piano")
lead_1: note("~@68 c#5@21 ~@21 e5@21").slow(131/112).sound("piano")
lead_2: note("~@82 b4@14 ~@35").slow(131/112).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 bass 97/14 1/4 58 84
GN event-2 bass 52/7 1 59 84
GN event-3 bass 111/14 1 60 84
GN event-4 inner 167/14 1/4 71 84
GN event-5 lead 66/7 3/4 73 84
GN event-6 lead 41/14 1/2 76 84
GN event-7 inner 72/7 3/4 72 84
GN event-8 lead 55/14 3/4 71 84
```

### gemini-3: generation-melody 6000

The same pitches appear in both documents. The notation weights total98 and .slow(213/84) sets span 71/7. First onset is213/686 rather than1/7, and first duration 355/686 rather than1/4. The scale also fails in both. Ledger 6/7 becomes notation 5/7.

Retained source: `runs/gemini.json`, planned sequence 3.
Payload SHA-256: `55f3fe0b042f0ad5b50e7d9afd9e824b202e281c24bdc1eb605883baa7c3004a`.

```text
setcpm(60)
lead_1: note("~@3 f#4@5 ~@2 g#4@10 ~@4 a#4@10 ~@2 c#5@10 ~@4 b4@10 ~@2 c#5@10 ~@4 d#5@10 ~@2 f#5@10").slow(213/84).sound("piano")
--- GN SIDE LEDGER ---
GN e1 lead 1/7 1/4 66 84
GN e2 lead 10/21 1/2 68 84
GN e3 lead 8/7 1/2 70 84
GN e4 lead 31/21 1/2 73 84
GN e5 lead 15/7 1/2 71 84
GN e6 lead 52/21 1/2 73 84
GN e7 lead 22/7 1/2 75 84
GN e8 lead 73/21 1/2 78 84
```

### gemini-17: comprehension-structure 6002

Aligned copying control. Both documents preserve all 12 source notes and score 49/49.

Retained source: `runs/gemini.json`, planned sequence 17.
Payload SHA-256: `1711a9ebb8030157f8f455f6af1d49ece04b100cee623173c217462aa1811ae0`.

```text
setcpm(60)
bass_1: note("~@3 c2@21 f2@21").slow(45/28).sound("piano")
keys_1: note("~@3 c4@21 f4@21").slow(45/28).sound("piano")
keys_2: note("~@3 e4@21 a4@21").slow(45/28).sound("piano")
keys_3: note("~@3 g4@21 c5@21").slow(45/28).sound("piano")
lead_1: note("~@9 c4@7 d4@7 ~@7 e4@7 ~@7 g4@7 ~@84").slow(45/28).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 bass 3/7 3 36 84
GN event-2 keys 3/7 3 60 84
GN event-3 keys 3/7 3 64 84
GN event-4 keys 3/7 3 67 84
GN event-5 lead 3/7 1/3 60 84
GN event-6 lead 16/21 1/3 62 84
GN event-7 lead 10/7 1/3 64 84
GN event-8 lead 44/21 1/3 67 84
GN event-9 bass 24/7 3 41 84
GN event-10 keys 24/7 3 65 84
GN event-11 keys 24/7 3 69 84
GN event-12 keys 24/7 3 72 84
```

### gemini-32: comprehension-structure 6000

Aligned copying control. Both documents preserve all 12 source notes and score 49/49.

Retained source: `runs/gemini.json`, planned sequence 32.
Payload SHA-256: `46314fec8b028b203a39eeabdac9272b692144c079187be740ae4ff0010b2119`.

```text
setcpm(60)
bass_1: note("~@1 b1@35 e2@35").slow(71/28).sound("piano")
keys_1: note("~@1 b3@35 e4@35").slow(71/28).sound("piano")
keys_2: note("~@1 d#4@35 g#4@35").slow(71/28).sound("piano")
keys_3: note("~@1 f#4@35 b4@35").slow(71/28).sound("piano")
lead_1: note("~@4 b3@14 ~@7 c#4@14 ~@7 d#4@14 ~@7 f#4@14 ~@203").slow(71/28).sound("piano")
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

### gemini-39: continuation-roles 6001

Ledger meets every role constraint and scores 10/10. Six notation events match the ledger. The third bass and lead lanes set span 7 with total weight 56, so onset is11/2 rather than44/7 and duration 7/8 rather than1. Notation gets7/10. This isolates timing disagreement without pitch disagreement.

Retained source: `runs/gemini.json`, planned sequence 39.
Payload SHA-256: `521517adfb10b84709d97e42f38b71d85b54a5ce04e58adaae0b547a45e489e8`.

```text
setcpm(60)
bass_1: note("~@30 d#3@7 ~@11").slow(12/7).sound("piano")
bass_2: note("~@37 g#2@7 ~@4").slow(12/7).sound("piano")
bass_3: note("~@44 a#2@7 ~@5").slow(7/4).sound("piano")
bass_4: note("~@51 d#3@7 ~@5").slow(9/4).sound("piano")
lead_1: note("~@30 a#4@7 ~@11").slow(12/7).sound("piano")
lead_2: note("~@37 c5@7 ~@4").slow(12/7).sound("piano")
lead_3: note("~@44 f5@7 ~@5").slow(7/4).sound("piano")
lead_4: note("~@51 d#5@7 ~@5").slow(9/4).sound("piano")
--- GN SIDE LEDGER ---
GN b1 bass 30/7 1 51 84
GN b2 bass 37/7 1 44 84
GN b3 bass 44/7 1 46 84
GN b4 bass 51/7 1 51 84
GN l1 lead 30/7 1 70 84
GN l2 lead 37/7 1 72 84
GN l3 lead 44/7 1 77 84
GN l4 lead 51/7 1 75 84
```

### gemini-46: continuation-motif 6022

Perfect33/33 ledger, but notation 10/33. First bass is MIDI 53 at 97/28 with duration 1/8, whereas ledger and task require MIDI 58 at 97/14 with duration 1/4. Inner pitches67,68 replace71,72, and their times halve. Lead pitches79,77,82 replace77,75,80 and also have wrong normalization. Every note is real and readable; all fail at least one task field.

Retained source: `runs/gemini.json`, planned sequence 46.
Payload SHA-256: `68e36817c234b64e45093cec67d50823305aa1f6598214a140bc3c42ad6deabe`.

```text
setcpm(60)
bass_1: note("~@194 f3@7 ~@7 f#3@28 ~@70").slow(153/112).sound("piano")
bass_2: note("~@222 g3@28 ~@56").slow(153/112).sound("piano")
inner_1: note("~@334 g4@7 ~@35 g#4@21 ~@3").slow(200/112).sound("piano")
lead_1: note("~@264 g5@21 ~@21 a#5@21").slow(163/112).sound("piano")
lead_2: note("~@278 f5@14 ~@35").slow(163/112).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 bass 97/14 1/4 58 84
GN event-2 bass 104/14 1 59 84
GN event-3 bass 111/14 1 60 84
GN event-4 inner 167/14 1/4 71 84
GN event-5 lead 66/7 3/4 77 84
GN event-6 lead 139/14 1/2 75 84
GN event-7 inner 188/14 3/4 72 84
GN event-8 lead 153/14 3/4 80 84
```

### gemini-53: continuation-roles 6002

Ledger is fully correct at 10/10. Notation contains three ~@0 tokens per lane. They are valid grammar, but version 1.2 gives each a weight of one. With total weight 63 and span 59/7, first onset becomes1829/441, not 31/7, and duration 59/63, not 1. Pitches match the ledger. Notation scores 7/10. Wider parsing recovers readability, not musical equality.

Retained source: `runs/gemini.json`, planned sequence 53.
Payload SHA-256: `4d2bb18790f4baf079decb835b1ab912e6af0f9dbc66d804de1bda760947c783`.

```text
setcpm(60)
bass_1: note("~@31 d#2@7 ~@0 d#2@7 ~@0 f2@7 ~@0 d#2@7 ~@1").slow(59/28).sound("piano")
lead_1: note("~@31 a#4@7 ~@0 g#4@7 ~@0 f4@7 ~@0 d#4@7 ~@1").slow(59/28).sound("piano")
--- GN SIDE LEDGER ---
GN e1 bass 31/7 1 39 84
GN e2 bass 38/7 1 39 84
GN e3 bass 45/7 1 41 84
GN e4 bass 52/7 1 39 84
GN e5 lead 31/7 1 70 84
GN e6 lead 38/7 1 68 84
GN e7 lead 45/7 1 65 84
GN e8 lead 52/7 1 63 84
```

### gemini-60: generation-progression 6001

Pitches match the ledger, but notation .slow(5/7) gives span 20/7 for total weight 35. First onset is8/49, not 2/7, and durations are4/7, not 1. Low bass and tenor pitches already fail ledger ranges. Ledger 10/12 becomes notation 1/12.

Retained source: `runs/gemini.json`, planned sequence 60.
Payload SHA-256: `8c1edfa3790a613103938b728a5133f44a2dec6d476eeec8e27645ff41fb76ee`.

```text
setcpm(60)
bass_1: note("~@2 a2@7 g2@7 e2@7 f2@7 ~@5").slow(5/7).sound("piano")
tenor_1: note("~@2 f3@7 d3@7 c3@7 c3@7 ~@5").slow(5/7).sound("piano")
alto_1: note("~@2 c4@7 a#3@7 g3@7 a3@7 ~@5").slow(5/7).sound("piano")
soprano_1: note("~@2 c5@7 d4@7 a#3@7 f4@7 ~@5").slow(5/7).sound("piano")
--- GN SIDE LEDGER ---
GN e1 bass 2/7 1 45 84
GN e2 bass 9/7 1 43 84
GN e3 bass 16/7 1 40 84
GN e4 bass 23/7 1 41 84
GN e5 tenor 2/7 1 53 84
GN e6 tenor 9/7 1 50 84
GN e7 tenor 16/7 1 48 84
GN e8 tenor 23/7 1 48 84
GN e9 alto 2/7 1 60 84
GN e10 alto 9/7 1 58 84
GN e11 alto 16/7 1 55 84
GN e12 alto 23/7 1 57 84
GN e13 soprano 2/7 1 72 84
GN e14 soprano 9/7 1 62 84
GN e15 soprano 16/7 1 58 84
GN e16 soprano 23/7 1 65 84
```

### gemini-67: generation-progression 6000

Pitches match the ledger. The notation span 20/7 and total weight 35 yield first onset 4/49 rather than1/7 and duration 4/7 rather than1. Ledger also has range and harmony defects. Ledger 8/12 becomes notation 1/12.

Retained source: `runs/gemini.json`, planned sequence 67.
Payload SHA-256: `17e49f23862fb3769a1fe82009ab0704d9a82216b83414c9f4532ea3a7c4cce7`.

```text
setcpm(60)
bass_1: note("~@1 g2@7 f2@7 d2@7 d#2@7 ~@6").slow(5/7).sound("piano")
tenor_1: note("~@1 d#3@7 c3@7 c3@7 a#2@7 ~@6").slow(5/7).sound("piano")
alto_1: note("~@1 a#3@7 g#3@7 f3@7 g3@7 ~@6").slow(5/7).sound("piano")
soprano_1: note("~@1 g4@7 c4@7 g#3@7 d#4@7 ~@6").slow(5/7).sound("piano")
--- GN SIDE LEDGER ---
GN e1 bass 1/7 1 43 84
GN e2 bass 8/7 1 41 84
GN e3 bass 15/7 1 38 84
GN e4 bass 22/7 1 39 84
GN e5 tenor 1/7 1 51 84
GN e6 tenor 8/7 1 48 84
GN e7 tenor 15/7 1 48 84
GN e8 tenor 22/7 1 46 84
GN e9 alto 1/7 1 58 84
GN e10 alto 8/7 1 56 84
GN e11 alto 15/7 1 53 84
GN e12 alto 22/7 1 55 84
GN e13 soprano 1/7 1 67 84
GN e14 soprano 8/7 1 60 84
GN e15 soprano 15/7 1 56 84
GN e16 soprano 22/7 1 63 84
```

### gemini-74: continuation-motif 6020

Notation and ledger differ in pitch and timing. First bass notation MIDI 50 at 18408/1631 with duration 118/233 replaces ledger 44 at 78/7 with duration 1/4. Inner first pitch80 and onset 50/7 match, but duration 1 replaces ledger 1/2. Lead durations3/14,3/7,6/7 replace3/8,3/4,3/2. Ledger also has affine errors. Ledger 27/33 becomes notation 14/33.

Retained source: `runs/gemini.json`, planned sequence 74.
Payload SHA-256: `a7ead2830305d62a0f3d744ec29d3fc311fbd556c97618a7176a5f92d1ae401b`.

```text
setcpm(60)
bass_1: note("~@156 d3@7 ~@42 f#3@7 ~@7 f3@14").slow(59/14).sound("piano")
inner_1: note("~@100 g#5@14 ~@28 c#5@7 ~@87").slow(59/14).sound("piano")
lead_1: note("~@107 c6@3 ~@6 g#6@6 g6@12 ~@102").slow(59/14).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 inner 50/7 1/2 80 84
GN event-2 lead 107/14 3/8 84 84
GN event-3 inner 57/7 1/8 73 84
GN event-4 lead 119/14 3/4 92 84
GN event-5 lead 133/14 3/2 91 84
GN event-6 bass 78/7 1/4 44 84
GN event-7 bass 177/14 1/8 53 84
GN event-8 bass 127/7 1/4 52 84
```

### gemini-96: continuation-roles 6000

Pitches match the ledger, but total weight 67 and .slow(4/1) give first onset 464/67 rather than29/7 and duration 112/67 rather than1. Ledger already has two lead pitches below the required range. Ledger 9/10 becomes notation 6/10.

Retained source: `runs/gemini.json`, planned sequence 96.
Payload SHA-256: `8a8904d649f9d6e485617cb77187e7526f191aaa0489744dfb31878e8991e037`.

```text
setcpm(60)
bass_1: note("~@29 f#2@7 ~@3 b2@7 ~@4 c#3@7 ~@3 f#2@7").slow(4/1).sound("piano")
lead_1: note("~@29 f#4@7 ~@3 d#4@7 ~@4 c#4@7 ~@3 f#4@7").slow(4/1).sound("piano")
--- GN SIDE LEDGER ---
GN e1 bass 29/7 1 42 84
GN e2 bass 36/7 1 47 84
GN e3 bass 43/7 1 49 84
GN e4 bass 50/7 1 42 84
GN e5 lead 29/7 1 66 84
GN e6 lead 36/7 1 63 84
GN e7 lead 43/7 1 61 84
GN e8 lead 50/7 1 66 84
```

### gemini-117: generation-progression 6002

Pitches match the ledger. Totalweight35 and span 32/7 give first onset 96/245, not 3/7, and duration 32/35, not 1. Ledger 9/12 becomes notation 1/12. Public syntax is valid.

Retained source: `runs/gemini.json`, planned sequence 117.
Payload SHA-256: `a5fa775eb7611aefe2cb8f60c54a40ba450da06cdfb2c450c79e5fa854cac015`.

```text
setcpm(60)
bass_1: note("~@3 g#2@7 f#2@7 d#2@7 e2@7 ~@4").slow(8/7).sound("piano")
tenor_1: note("~@3 e3@7 c#3@7 f#3@7 g#3@7 ~@4").slow(8/7).sound("piano")
alto_1: note("~@3 b3@7 a#3@7 a#3@7 b3@7 ~@4").slow(8/7).sound("piano")
soprano_1: note("~@3 e4@7 f#4@7 d#4@7 e4@7 ~@4").slow(8/7).sound("piano")
--- GN SIDE LEDGER ---
GN e1 bass 3/7 1 44 84
GN e2 bass 10/7 1 42 84
GN e3 bass 17/7 1 39 84
GN e4 bass 24/7 1 40 84
GN e5 tenor 3/7 1 52 84
GN e6 tenor 10/7 1 49 84
GN e7 tenor 17/7 1 54 84
GN e8 tenor 24/7 1 56 84
GN e9 alto 3/7 1 59 84
GN e10 alto 10/7 1 58 84
GN e11 alto 17/7 1 58 84
GN e12 alto 24/7 1 59 84
GN e13 soprano 3/7 1 64 84
GN e14 soprano 10/7 1 66 84
GN e15 soprano 17/7 1 63 84
GN e16 soprano 24/7 1 64 84
```

### gemini-145: generation-melody 6002

Two lead lanes share the same starts. Their eight pitches match the ledger as a multiset, but they play simultaneous four-note sequences rather than one ordered eight-note sequence. Actual starts are24/73,200/219,368/219,488/219, and durations56/219. The ledger has eight distinct specified starts with duration 1/2. Ledger 6/7 becomes notation 4/7. Meaningful overlap is preserved, not deduplicated.

Retained source: `runs/gemini.json`, planned sequence 145.
Payload SHA-256: `e6134bd8d783da8601fd09f55af06579110f1b0e8f89322ba18a103b853b05a4`.

```text
setcpm(60)
lead_1: note("~@9 d#4@7 ~@9 f4@7 ~@14 g#4@7 ~@8 c5@7 ~@5").slow(2/3).sound("piano")
lead_2: note("~@9 g#4@7 ~@9 a#4@7 ~@14 c#5@7 ~@8 f5@7 ~@5").slow(2/3).sound("piano")
--- GN SIDE LEDGER ---
GN e1 lead 3/7 1/2 63 84
GN e2 lead 23/21 1/2 65 84
GN e3 lead 10/7 1/2 68 84
GN e4 lead 44/21 1/2 72 84
GN e5 lead 17/7 1/2 68 84
GN e6 lead 65/21 1/2 70 84
GN e7 lead 24/7 1/2 73 84
GN e8 lead 86/21 1/2 77 84
```

### gemini-160: comprehension-structure 6001

Aligned copying control. Both documents preserve all 12 source notes and score 49/49.

Retained source: `runs/gemini.json`, planned sequence 160.
Payload SHA-256: `6df726e0b738ce1ebb61b4df5e900afb8d2cb3f880702f90ad54f9a8869f62e3`.

```text
setcpm(60)
bass_1: note("~@2 g#2@21 c#3@21").slow(11/7).sound("piano")
keys_1: note("~@2 g#4@21 c#5@21").slow(11/7).sound("piano")
keys_2: note("~@2 c5@21 f5@21").slow(11/7).sound("piano")
keys_3: note("~@2 d#5@21 g#5@21").slow(11/7).sound("piano")
lead_1: note("~@6 g#4@7 a#4@7 ~@7 c5@7 ~@7 d#5@7 ~@84").slow(11/7).sound("piano")
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

### gemini-167: continuation-motif 6021

First inner notation MIDI 68 at 165/56 replaces ledger 69 at 165/14. Lead starts137/70 rather than137/14, and first pitch64 replacesledger67. Other voices have additional timing and pitch disagreements. The ledger itself has three onset errors. Ledger 30/33 becomes notation 15/33.

Retained source: `runs/gemini.json`, planned sequence 167.
Payload SHA-256: `7cf69b7ececfbee5f7f80bf0d3ab3a1dcc488e6a6bc1fa06c6162f03f19b1bb9`.

```text
setcpm(60)
bass_1: note("~@151 f3@7 ~@57 d#3@28 ~@3").slow(67/70).sound("piano")
bass_2: note("~@221 f3@28").slow(249/280).sound("piano")
inner_1: note("~@165 g#4@21 ~@86").slow(68/56).sound("piano")
inner_2: note("~@179 e4@7 ~@86").slow(68/56).sound("piano")
lead_1: note("~@137 e4@7 g4@7 c#4@11").slow(81/140).sound("piano")
--- GN SIDE LEDGER ---
GN event-1 inner 165/14 3/8 69 84
GN event-2 inner 179/14 1/8 65 84
GN event-3 bass 151/14 5/16 53 84
GN event-4 lead 137/14 1/4 67 84
GN event-5 lead 140/14 1/4 70 84
GN event-6 lead 144/14 3/8 64 84
GN event-7 bass 186/14 5/4 50 84
GN event-8 bass 221/14 5/4 53 84
```

### gemini-181: generation-melody 6001

The notation uses valid flats eb4,ab4,bb4. Pitches match the ledger, so its frozen subset rejection is not public unreadability. Timing differs: first onset 118/385 rather than2/7, first duration 59/110 rather than1/2, and second duration 472/1155 rather than3/8. Ledger 6/7 becomes full-grammar notation 5/7. It still fails cadence.

Retained source: `runs/gemini.json`, planned sequence 181.
Payload SHA-256: `014ea4c9d14a7eabe69ef1f1868d66b42030cb1e0851431de544e66c3c1d2f8b`.

```text
setcpm(60)
lead_1: note("~@12 eb4@21 ~@7 f4@16 ~@3 eb4@21 ~@7 f4@21 ~@7 ab4@21 ~@7 bb4@21 ~@7 ab4@21 ~@7 bb4@21").slow(59/42).sound("piano")
--- GN SIDE LEDGER ---
GN e1 lead 2/7 1/2 63 84
GN e2 lead 20/21 3/8 65 84
GN e3 lead 9/7 1/2 63 84
GN e4 lead 41/21 1/2 65 84
GN e5 lead 16/7 1/2 68 84
GN e6 lead 62/21 1/2 70 84
GN e7 lead 23/7 1/2 68 84
GN e8 lead 83/21 1/2 70 84
```

## Limits and action

The values concern nominal event time and pitch. They do not prove sample
availability, acoustic quality, or full public language conformance. The
task voice prefixes and four-beat cycle mapping are local conventions.
The aggregate component totals retain the frozen contract weighting.
No finding here replaces the retained assessment.

Use separate measures for ledger recovery, notation task accuracy, and
notation/ledger agreement. A future comparison should declare which of
these is the product acceptance condition. A ledger-only score cannot
establish that the complete composite document represents correct music.

## Retrospective

Inspect at least one perfect ledger with bad alignment before summarizing
composite musical success. Full-grammar decoding is needed on both sides
when the goal is notation quality.
