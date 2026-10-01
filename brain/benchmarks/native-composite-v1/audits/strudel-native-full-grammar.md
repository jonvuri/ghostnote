# Strudel native full grammar audit

## Result

The narrow parser rejects eight of the 30 unique native note outputs.
All eight are valid in the official Strudel 1.2 engine. None completes its
musical task. Wider parsing recovers useful partial credit. It does not
recover a full task success.

| Provider | Frozen native components | Full grammar components | Ledger components | Recovered credit |
|---|---:|---:|---:|---:|
| openai | 219/333 (65.77%) | 269/333 (80.78%) | 307/333 (92.19%) | +15.02 points |
| gemini | 198/333 (59.46%) | 224/333 (67.27%) | 311/333 (93.39%) | +7.81 points |

This table covers all 30 retained Strudel native note outputs. It excludes
analysis answers and sentinel repeats. It is not an estimate for other
formats or future tasks. It compares counterfactual native partial credit
with the frozen composite ledger credit. It does not test composite notation.
OpenAI has four complete native tasks out of 15. Gemini has three. All were
already accepted by the subset parser. These counts do not change.

## Method

Read every full response and its full task contract. Validate the JavaScript
with `@strudel/transpiler@1.2.0`. Decode the original mini strings with
`@strudel/mini@1.2.0` and `@strudel/core@1.2.0`. Use the actual JavaScript
numeric value of each `.slow()` argument. Query one declared lane period.
Use event whole spans and the task convention of four beats per cycle.
All 119 complete note/slow/sound chains were checked. Control-pattern query
fragments with identical whole spans and pitch count as one logical event.
Convert named pitches with the official `noteToMidi` function. No payload
was edited. No provider call was made. Runtime packages and scratch scripts
were installed only in `/private/tmp`.

The [case record](strudel-native-full-grammar.json) retains all full payloads,
task contracts, hashes, decoded notes, independent contract checks, runtime
source hashes, package integrity values, and the exact decoding script.
The frozen scorer was used only to map independently decoded notes to its
existing partial-credit components. It was not the authority for grammar
or note meaning. Manual checks support each musical judgment below.

## Language findings

1. Flat names and numeric MIDI values are public syntax. `bb3` is MIDI 58.
   These forms violate the requested sharp-name profile. They do not make
   the music unreadable in Strudel. See the [official note rules](https://strudel.cc/learn/notes/).
2. Weights divide a cycle in proportion to their sum. `.slow()` scales the
   cycle span. Extra rests therefore change every onset and duration when
   the model fails to adjust the span. See [mini notation](https://strudel.cc/learn/mini-notation/)
   and [time modifiers](https://strudel.cc/learn/time-modifiers/).
3. `~@0` is valid grammar. In the pinned 1.2 implementation, zero weight is
   replaced with the default weight of one. This follows the fallback in
   [mini.mjs](https://unpkg.com/@strudel/mini@1.2.0/mini.mjs).
   The official runtime confirms the changed timing. Removing such a rest
   would repair the response; the audit does not remove it.
4. `g#4@21/2` means weight 21 followed by an item slow operator of two.
   It does not mean weight 10.5. The [versioned grammar](https://unpkg.com/@strudel/mini@1.2.0/krill.pegjs)
   separates decimal numeric weights from slash slow operators. The runtime
   confirms event spans that cross their allotted child span.
5. `setcpm(60)` means 60 cycles per minute. Strudel does not assign a fixed
   number of quarter-note beats to a cycle. The four-beat mapping is the
   benchmark prompt convention. See [cycles](https://strudel.cc/understand/cycles/).

## Per-case judgments

All 30 responses pass the official JavaScript and mini syntax checks.
The eight profile rejections are OpenAI sequences 3, 46, 60, 96, and 110,
and Gemini sequences 38, 59, and 166. Every accepted response gives the
same component credit under the official engine as under the subset parser.
The full grammar audit found no extra hidden syntax rejection.

| Case | Family / variant | Profile parse | Components: frozen → full grammar | Full task |
|---|---|---|---|---|
| openai-3 | continuation-motif / 6020 | reject | 0/33 → 22/33 | fail |
| openai-39 | continuation-motif / 6021 | pass | 15/33 → 15/33 | fail |
| openai-46 | generation-melody / 6001 | reject | 0/7 → 2/7 | fail |
| openai-60 | generation-progression / 6001 | reject | 0/12 → 10/12 | fail |
| openai-74 | comprehension-structure / 6000 | pass | 49/49 → 49/49 | pass |
| openai-81 | continuation-roles / 6002 | pass | 8/10 → 8/10 | fail |
| openai-96 | generation-melody / 6000 | reject | 0/7 → 6/7 | fail |
| openai-103 | continuation-roles / 6001 | pass | 8/10 → 8/10 | fail |
| openai-110 | generation-progression / 6000 | reject | 0/12 → 10/12 | fail |
| openai-117 | comprehension-structure / 6002 | pass | 49/49 → 49/49 | pass |
| openai-131 | generation-progression / 6002 | pass | 8/12 → 8/12 | fail |
| openai-138 | generation-melody / 6002 | pass | 7/7 → 7/7 | pass |
| openai-160 | continuation-roles / 6000 | pass | 7/10 → 7/10 | fail |
| openai-181 | comprehension-structure / 6001 | pass | 49/49 → 49/49 | pass |
| openai-188 | continuation-motif / 6022 | pass | 19/33 → 19/33 | fail |
| gemini-2 | generation-melody / 6000 | pass | 3/7 → 3/7 | fail |
| gemini-24 | comprehension-structure / 6002 | pass | 49/49 → 49/49 | pass |
| gemini-31 | comprehension-structure / 6000 | pass | 49/49 → 49/49 | pass |
| gemini-38 | continuation-roles / 6001 | reject | 0/10 → 6/10 | fail |
| gemini-45 | continuation-motif / 6022 | pass | 11/33 → 11/33 | fail |
| gemini-52 | continuation-roles / 6002 | pass | 7/10 → 7/10 | fail |
| gemini-59 | generation-progression / 6001 | reject | 0/12 → 10/12 | fail |
| gemini-66 | generation-progression / 6000 | pass | 1/12 → 1/12 | fail |
| gemini-73 | continuation-motif / 6020 | pass | 12/33 → 12/33 | fail |
| gemini-95 | continuation-roles / 6000 | pass | 8/10 → 8/10 | fail |
| gemini-116 | generation-progression / 6002 | pass | 1/12 → 1/12 | fail |
| gemini-152 | generation-melody / 6002 | pass | 4/7 → 4/7 | fail |
| gemini-159 | comprehension-structure / 6001 | pass | 49/49 → 49/49 | pass |
| gemini-166 | continuation-motif / 6021 | reject | 0/33 → 10/33 | fail |
| gemini-180 | generation-melody / 6001 | pass | 4/7 → 4/7 | fail |

## Manual evidence and complete responses

### openai-3: continuation-motif 6020

Numeric MIDI tokens are valid. Durations are correct. All onsets are far too early. Bass pitches are two semitones below the affine target. The other five pitches are correct. First bass starts at 1/14, but the task requires 78/7. The payload is not repaired.

Retained source: `runs/openai.json`, planned sequence 3.
Payload SHA-256: `1aa5c9319af4ee3984cd0118f0457aeedc483f412f7e3e35681cb15e0f7b56fd`.

```javascript
setcpm(60)
bass_1: note("~@4 42@14 ~@70 51@7 ~@7 50@14").slow(29/56).sound("piano")
inner_1: note("~@18 80@28 ~@28 73@7 ~@35").slow(29/56).sound("piano")
lead_1: note("~@32 80@7 ~@7 88@14 87@28 ~@28").slow(87/56).sound("piano")
```

### openai-39: continuation-motif 6021

Public syntax and profile syntax are valid. All output starts omit the required continuation origin. Inner pitches are five semitones too low. Duration factors are wrong. First inner starts at 2/7, not 165/14.

Retained source: `runs/openai.json`, planned sequence 39.
Payload SHA-256: `a24ccf5dcbac87326da87daf1761833d7ccc782b3babef4c5c9e5f430ed34aa4`.

```javascript
setcpm(60)
inner_1: note("~@8 e4@21 ~@105").slow(67/56).sound("piano")
inner_2: note("~@22 c4@7 ~@105").slow(67/56).sound("piano")
bass_1: note("~@36 f3@7 ~@49 d3@28 ~@14").slow(67/56).sound("piano")
bass_2: note("~@53 f3@14").slow(67/56).sound("piano")
lead_1: note("~@50 g4@14 a#4@14 e4@21 ~@35").slow(67/56).sound("piano")
```

### openai-46: generation-melody 6001

A trailing ~@0 is valid public syntax but violates the positive-weight profile. Version 1.2 replaces its zero weight with default weight 1. The final lane has total weight 749, not 748. Its onset is 62084/15729 rather than 83/21, and duration is 374/749 rather than 1/2. Earlier lane timing is correct. Pitches 60 and 62 violate the minimum 63, and the scale, motif, and cadence fail. Deleting the rest would be a repair and is not done.

Retained source: `runs/openai.json`, planned sequence 46.
Payload SHA-256: `82cc626fdd948d8e86c542ae70dd6eb18a5c68fce41ca5580ec869391a370f92`.

```javascript
setcpm(60)
lead_1: note("~@48 c4@84 ~@616").slow(187/168).sound("piano")
lead_2: note("~@160 d4@63 ~@525").slow(187/168).sound("piano")
lead_3: note("~@216 f4@84 ~@448").slow(187/168).sound("piano")
lead_4: note("~@328 g4@84 ~@336").slow(187/168).sound("piano")
lead_5: note("~@384 f4@84 ~@280").slow(187/168).sound("piano")
lead_6: note("~@496 g4@84 ~@168").slow(187/168).sound("piano")
lead_7: note("~@552 a4@84 ~@112").slow(187/168).sound("piano")
lead_8: note("~@664 d5@84 ~@0").slow(187/168).sound("piano")
```

### openai-60: generation-progression 6001

Flats bb3 and bb4 are valid and denote MIDI 58 and 70. All chord onsets are correct. The fourth chord lasts 5/7 rather than 1. Chord two lacks pitch class 2. All ranges, inversions, strict order, movement, and final bass cadence pass.

Retained source: `runs/openai.json`, planned sequence 60.
Payload SHA-256: `b4209ab24495f6d1b0a25e3dd5db8ed73b9462d5544f96c1bd68869826d29fd1`.

```javascript
setcpm(60)
bass_1: note("~@2 a2@7 g2@7 e3@7 f3@5").slow(1).sound("piano")
tenor_1: note("~@2 a3@7 g3@7 g3@7 a3@5").slow(1).sound("piano")
alto_1: note("~@2 f4@7 bb3@7 bb3@7 c4@5").slow(1).sound("piano")
soprano_1: note("~@2 c5@7 bb4@7 c5@7 c5@5").slow(1).sound("piano")
```

### openai-74: comprehension-structure 6000

Correct copying control. Engine notes match all 12 input notes. Bass starts 1/7, lasts 5, and changes from MIDI 35 to 40 at 36/7. The lead has its four required starts and 1/2 durations.

Retained source: `runs/openai.json`, planned sequence 74.
Payload SHA-256: `46675a303b3d5c629551fb41f43cd75f863aa755752b648ce0d0c795d8487e40`.

```javascript
setcpm(60)
bass_1: note("~@1 b1@35 e2@35").slow(71/28).sound("piano")
keys_1: note("~@1 b3@35 e4@35").slow(71/28).sound("piano")
keys_2: note("~@1 d#4@35 g#4@35").slow(71/28).sound("piano")
keys_3: note("~@1 f#4@35 b4@35").slow(71/28).sound("piano")
lead_1: note("~@4 b3@14 ~@7 c#4@14 ~@7 d#4@14 ~@7 f#4@14 ~@203").slow(71/28).sound("piano")
```

### openai-81: continuation-roles 6002

Valid syntax with correct one-beat durations. Both voices start at 0,1,2,3 rather than 31/7,38/7,45/7,52/7. Pitches fit the role checks. Full task fails on absolute starts.

Retained source: `runs/openai.json`, planned sequence 81.
Payload SHA-256: `2ea4916ceee9439edb52fdb23145e7633c2e75a503a06a52ad1c91de696a8f1a`.

```javascript
setcpm(60)
bass_1: note("a#2@1 c3@1 a#2@1 a#2@1").slow(1).sound("piano")
lead_1: note("d#4@1 g#4@1 f4@1 d#4@1").slow(1).sound("piano")
```

### openai-96: generation-melody 6000

Numeric MIDI tokens are valid. Pitch sequence 75,76,78,73,80,81,83,78 meets range, scale, transposed motif, and cadence. Seven starts are correct. Note seven starts at 59/21 rather than 22/7. It is almost correct music, but it is not a complete task success.

Retained source: `runs/openai.json`, planned sequence 96.
Payload SHA-256: `e7a21c28ee5bf3623b097f561b3ba26d2053d545590e169604c41609aaba5427`.

```javascript
setcpm(60)
lead_1: note("~@12 75@21 ~@303").slow(1).sound("piano")
lead_2: note("~@40 76@42 ~@254").slow(1).sound("piano")
lead_3: note("~@96 78@42 ~@198").slow(1).sound("piano")
lead_4: note("~@124 73@42 ~@170").slow(1).sound("piano")
lead_5: note("~@180 80@42 ~@114").slow(1).sound("piano")
lead_6: note("~@208 81@42 ~@86").slow(1).sound("piano")
lead_7: note("~@236 83@42 ~@58").slow(1).sound("piano")
lead_8: note("~@292 78@42 ~@2").slow(1).sound("piano")
```

### openai-103: continuation-roles 6001

Valid profile. Both voices start at 0,1,2,3 rather than 30/7,37/7,44/7,51/7. Durations and the remaining role checks pass. Full task fails on absolute starts.

Retained source: `runs/openai.json`, planned sequence 103.
Payload SHA-256: `84a83c4f5cd0f6693c6e18ca2e73667044eb46f7f3ec5371e0f05c545a331e98`.

```javascript
setcpm(60)
bass_1: note("f3@1 c3@1 f3@1 f3@1").slow(1).sound("piano")
lead_1: note("d#4@1 d#4@1 f4@1 d#4@1").slow(1).sound("piano")
```

### openai-110: generation-progression 6000

Flats eb3, bb3, ab4, ab5, bb5, and eb5 are valid public pitches. All starts are correct. The last chord lasts only 1/7 rather than 1. Chord one lacks pitch class 3. Remaining role checks pass.

Retained source: `runs/openai.json`, planned sequence 110.
Payload SHA-256: `aa7d4913cef06222320e45882227976f80fa5b93184a4b654e1d20580290b32e`.

```javascript
setcpm(60)
bass_1: note("~@1 g3@7 f3@7 d3@7 eb3@1").slow(23/28).sound("piano")
tenor_1: note("~@1 bb3@7 c4@7 d4@7 bb3@1").slow(23/28).sound("piano")
alto_1: note("~@1 g4@7 ab4@7 f4@7 g4@1").slow(23/28).sound("piano")
soprano_1: note("~@1 g5@7 ab5@7 bb5@7 eb5@1").slow(23/28).sound("piano")
```

### openai-117: comprehension-structure 6002

Correct copying control. All 12 decoded notes match the source. The first chord starts 3/7 and lasts 3; the second starts 24/7 and lasts 3.

Retained source: `runs/openai.json`, planned sequence 117.
Payload SHA-256: `06d98784f047e9b71529b9a299a90c99554c9d9feee04cb9c51044969bcb86e6`.

```javascript
setcpm(60)
bass_1: note("~@3 c2@21 f2@21").slow(45/28).sound("piano")
keys_1: note("~@3 c4@21 f4@21").slow(45/28).sound("piano")
keys_2: note("~@3 e4@21 a4@21").slow(45/28).sound("piano")
keys_3: note("~@3 g4@21 c5@21").slow(45/28).sound("piano")
lead_1: note("~@9 c4@7 d4@7 ~@7 e4@7 ~@7 g4@7 ~@84").slow(45/28).sound("piano")
```

### openai-131: generation-progression 6002

Valid profile and exact timings. Bass pitch classes are 4,3,1,2 instead of 8,6,3,4. Harmony and cadence therefore fail. Parser breadth cannot correct these pitches.

Retained source: `runs/openai.json`, planned sequence 131.
Payload SHA-256: `484160ae8ee7bbe802c99b4d40099930f5aefc8d4c246d2421a48029799854af`.

```javascript
setcpm(60)
bass_1: note("~@3 e3@7 d#3@7 c#3@7 d3@7").slow(31/28).sound("piano")
tenor_1: note("~@3 b3@7 a3@7 a3@7 b3@7").slow(31/28).sound("piano")
alto_1: note("~@3 e4@7 c#4@7 b3@7 e4@7").slow(31/28).sound("piano")
soprano_1: note("~@3 g#4@7 f#4@7 d#4@7 g#4@7").slow(31/28).sound("piano")
```

### openai-138: generation-melody 6002

Correct melody control. Eight note lanes have the required onsets and 1/2 durations. Pitches 72,73,77,70,77,78,82,75 fit the range and scale; the second four are the first four plus five semitones; final pitch class is 3.

Retained source: `runs/openai.json`, planned sequence 138.
Payload SHA-256: `e36f9c9486f6e04125f82775a32750df8a0240d4aea331bda07436138cf0db47`.

```javascript
setcpm(60)
lead_1: note("~@18 c5@21 ~@171").slow(5/4).sound("piano")
lead_2: note("~@46 c#5@21 ~@143").slow(5/4).sound("piano")
lead_3: note("~@60 f5@21 ~@129").slow(5/4).sound("piano")
lead_4: note("~@88 a#4@21 ~@101").slow(5/4).sound("piano")
lead_5: note("~@102 f5@21 ~@87").slow(5/4).sound("piano")
lead_6: note("~@130 f#5@21 ~@59").slow(5/4).sound("piano")
lead_7: note("~@144 a#5@21 ~@45").slow(5/4).sound("piano")
lead_8: note("~@172 d#5@21 ~@17").slow(5/4).sound("piano")
```

### openai-160: continuation-roles 6000

Valid profile, but starts 0,7/4,7/2,21/4 replace 29/7,36/7,43/7,50/7. Every duration is 7/4 rather than 1. These are actual timing errors.

Retained source: `runs/openai.json`, planned sequence 160.
Payload SHA-256: `8e7c8829d94f34c852103c58e9a686b93727d23f5deae882ae70dea4d11fbf67`.

```javascript
setcpm(60)
bass_1: note("c#3@1 d#3@1 c#3@1 c#3@1").slow(7/4).sound("piano")
lead_1: note("f#5@1 b5@1 e5@1 f#5@1").slow(7/4).sound("piano")
```

### openai-181: comprehension-structure 6001

Correct copying control. All 12 notes match the source, including fractional lead timings. Bass starts 2/7, lasts 3, and then starts 23/7.

Retained source: `runs/openai.json`, planned sequence 181.
Payload SHA-256: `411ef1fbac4c5d30409b0a1de209a6e8b7c887899769af61722db462ecc853aa`.

```javascript
setcpm(60)
bass_1: note("~@2 g#2@21 c#3@21").slow(11/7).sound("piano")
keys_1: note("~@2 g#4@21 c#5@21").slow(11/7).sound("piano")
keys_2: note("~@2 c5@21 f5@21").slow(11/7).sound("piano")
keys_3: note("~@2 d#5@21 g#5@21").slow(11/7).sound("piano")
lead_1: note("~@6 g#4@7 a#4@7 ~@7 c5@7 ~@7 d#5@7 ~@84").slow(11/7).sound("piano")
```

### openai-188: continuation-motif 6022

Valid profile. All continuation onsets omit the required origins. Durations are correct. Several pitches fail the affine transform. First bass is MIDI 61 at 3/7, but must be MIDI 58 at 97/14.

Retained source: `runs/openai.json`, planned sequence 188.
Payload SHA-256: `645583c58d3cf0dd27b7863f0a307874f52b9f4fd39cdae32970725d30207ad4`.

```javascript
setcpm(60)
bass_1: note("~@12 c#4@7 ~@7 c#4@28 ~@77").slow(131/112).sound("piano")
bass_2: note("~@40 c4@28 ~@63").slow(131/112).sound("piano")
inner_1: note("~@54 g4@7 ~@35 g4@21 ~@14").slow(131/112).sound("piano")
lead_1: note("~@68 d#5@21 ~@21 g#5@21").slow(131/112).sound("piano")
lead_2: note("~@82 e5@14 ~@35").slow(131/112).sound("piano")
```

### gemini-2: generation-melody 6000

Valid profile. Weights total 82, while slow is 80/21. The first note starts and lasts 160/287, rather than 1/7 and 1/4. Later durations are 320/287 rather than 1/2. Pitches also fail the scale, motif, and cadence.

Retained source: `runs/gemini.json`, planned sequence 2.
Payload SHA-256: `d28e7de0affce80c39acbd6953c656f2a647957835ab524d9229cc7b0026925e`.

```javascript
setcpm(60)
lead_1: note("~@3 f#4@3 ~@4 g#4@6 ~@8 a#4@6 ~@1 c#5@6 ~@8 d#5@6 ~@4 f5@6 ~@8 f#5@6 ~@1 g#5@6").slow(80/21).sound("piano")
```

### gemini-24: comprehension-structure 6002

Correct copying control. All 12 decoded notes match the source. Source beat timing is preserved, including the four lead notes.

Retained source: `runs/gemini.json`, planned sequence 24.
Payload SHA-256: `06d98784f047e9b71529b9a299a90c99554c9d9feee04cb9c51044969bcb86e6`.

```javascript
setcpm(60)
bass_1: note("~@3 c2@21 f2@21").slow(45/28).sound("piano")
keys_1: note("~@3 c4@21 f4@21").slow(45/28).sound("piano")
keys_2: note("~@3 e4@21 a4@21").slow(45/28).sound("piano")
keys_3: note("~@3 g4@21 c5@21").slow(45/28).sound("piano")
lead_1: note("~@9 c4@7 d4@7 ~@7 e4@7 ~@7 g4@7 ~@84").slow(45/28).sound("piano")
```

### gemini-31: comprehension-structure 6000

Correct copying control. All 12 decoded notes match the source. Bass and keys start 1/7 and 36/7, with five-beat durations.

Retained source: `runs/gemini.json`, planned sequence 31.
Payload SHA-256: `46675a303b3d5c629551fb41f43cd75f863aa755752b648ce0d0c795d8487e40`.

```javascript
setcpm(60)
bass_1: note("~@1 b1@35 e2@35").slow(71/28).sound("piano")
keys_1: note("~@1 b3@35 e4@35").slow(71/28).sound("piano")
keys_2: note("~@1 d#4@35 g#4@35").slow(71/28).sound("piano")
keys_3: note("~@1 f#4@35 b4@35").slow(71/28).sound("piano")
lead_1: note("~@4 b3@14 ~@7 c#4@14 ~@7 d#4@14 ~@7 f#4@14 ~@203").slow(71/28).sound("piano")
```

### gemini-38: continuation-roles 6001

Zero-weight rests are valid public syntax. Version 1.2 gives each ~@0 a default weight of 1. Total lane weight is 61, not 58. Notes start 1740/427,2204/427,2668/427,3132/427 and last 58/61. The task requires starts 30/7,37/7,44/7,51/7 and duration 1. Bass MIDI 36 violates minimum 39. Correct harmony, leaps, collisions, and cadence can still receive credit.

Retained source: `runs/gemini.json`, planned sequence 38.
Payload SHA-256: `ea689c9095ef50a5e9ee59849c5ccd33f6b6d59901fad08c5482fe542408102d`.

```javascript
setcpm(60)
bass_1: note("~@30 d#2@7 ~@0 c2@7 ~@0 f2@7 ~@0 d#2@7").slow(58/28).sound("piano")
lead_1: note("~@30 a#4@7 ~@0 g#4@7 ~@0 a#4@7 ~@0 d#5@7").slow(58/28).sound("piano")
```

### gemini-45: continuation-motif 6022

Valid profile. Bass and lead use incorrect total-span normalization. Inner notes retain correct durations but begin 167/28 and 209/28, half the required absolute onsets. Several pitches are wrong. Full task fails without any grammar rejection.

Retained source: `runs/gemini.json`, planned sequence 45.
Payload SHA-256: `ad2089d16282e0ba44d26365633918e4e45c011ecaf74e5564e69c69e3d6e285`.

```javascript
setcpm(60)
bass_1: note("~@97 c3@7 ~@7 c#3@28 ~@77").slow(109/56).sound("piano")
bass_2: note("~@125 d3@28 ~@63").slow(109/56).sound("piano")
inner_1: note("~@167 g#4@7 ~@35 a4@21 ~@14").slow(61/28).sound("piano")
lead_1: note("~@132 e4@21 ~@21 g4@21").slow(97/56).sound("piano")
lead_2: note("~@146 d4@14 ~@35").slow(97/56).sound("piano")
```

### gemini-52: continuation-roles 6002

Valid profile. Total weight is 62 but slow gives a span of 59/7. First onset is 59/14 rather than 31/7; durations are 59/62 rather than 1. The complete timing contract fails. One pitch also violates its harmony set.

Retained source: `runs/gemini.json`, planned sequence 52.
Payload SHA-256: `c62b376a32f980a7e967db9e30e2368f9c744230d06466dec1849ce97092cd9c`.

```javascript
setcpm(60)
bass_1: note("~@31 d#2@7 ~@1 g#2@7 ~@1 a#2@7 ~@1 d#2@7").slow(59/28).sound("piano")
lead_1: note("~@31 a#4@7 ~@1 c5@7 ~@1 f4@7 ~@1 d#4@7").slow(59/28).sound("piano")
```

### gemini-59: generation-progression 6001

Flats bb3 are valid public pitches. All 16 onsets and durations are correct. Tenor MIDI 48, alto MIDI 53, and soprano MIDI 57 are below their ranges. Chord two lacks pitch class 2. Remaining constraints pass.

Retained source: `runs/gemini.json`, planned sequence 59.
Payload SHA-256: `43c5f1de200ff40778c6725f3ecdf3f668ebe319d41dca32c973f7c345a55ac9`.

```javascript
setcpm(60)
bass_1: note("~@2 a2@7 g2@7 e2@7 f2@7 ~@5").slow(5/4).sound("piano")
tenor_1: note("~@2 c3@7 d3@7 c3@7 c3@7 ~@5").slow(5/4).sound("piano")
alto_1: note("~@2 f3@7 f3@7 g3@7 a3@7 ~@5").slow(5/4).sound("piano")
soprano_1: note("~@2 a3@7 bb3@7 bb3@7 c4@7 ~@5").slow(5/4).sound("piano")
```

### gemini-66: generation-progression 6000

Valid profile. Weights total 32, but slow gives a span of 29/7. First onset is 29/224 instead of 1/7; durations are 29/32 instead of 1. Several voices are below their ranges. Timing is not a parser artifact.

Retained source: `runs/gemini.json`, planned sequence 66.
Payload SHA-256: `730091e2978226b3a41a0470e1d89179b83302845974affd5374cc6686b9ff50`.

```javascript
setcpm(60)
bass_1: note("~@1 g2@7 f2@7 d2@7 d#2@7 ~@3").slow(29/28).sound("piano")
tenor_1: note("~@1 d#3@7 c3@7 c3@7 a#2@7 ~@3").slow(29/28).sound("piano")
alto_1: note("~@1 a#3@7 g#3@7 g#3@7 g3@7 ~@3").slow(29/28).sound("piano")
soprano_1: note("~@1 d#4@7 f4@7 f4@7 d#4@7 ~@3").slow(29/28).sound("piano")
```

### gemini-73: continuation-motif 6020

Valid profile. Bass first starts 39/7 rather than 78/7. Inner first starts 25/7 rather than 50/7. Lead normalization gives onset 21935/4004 rather than 107/14 and duration 615/572 rather than 3/8. Pitches also fail the affine transform.

Retained source: `runs/gemini.json`, planned sequence 73.
Payload SHA-256: `bcb97adae9e11d9f8023965fe276f7d4b47d1d3feb71b0ad5c3454ea36dc0330`.

```javascript
setcpm(60)
bass_1: note("~@156 d#4@7 ~@35 g#4@7 ~@14 g4@7").slow(113/56).sound("piano")
inner_1: note("~@100 d4@14 ~@14 g#3@7 ~@81").slow(27/14).sound("piano")
lead_1: note("~@107 e4@21 ~@21 c5@42 b4@84 ~@11").slow(205/56).sound("piano")
```

### gemini-95: continuation-roles 6000

Valid profile with correct role timings and ranges. First lead MIDI 70 has pitch class 10, outside [1,6,9]. Bass leap 42 to 51 is 9, greater than allowed 7. Thus this is a musical error control, not a parsing rejection.

Retained source: `runs/gemini.json`, planned sequence 95.
Payload SHA-256: `2c51869ffab451163cf693406ac6cbafb3bae60df96aa18ab4e4efcd0d74add2`.

```javascript
setcpm(60)
bass_1: note("~@29 f#2@7 d#3@7 c#3@7 f#2@7").slow(57/28).sound("piano")
lead_1: note("~@29 a#4@7 b4@7 g#4@7 f#4@7").slow(57/28).sound("piano")
```

### gemini-116: generation-progression 6002

Valid profile. Total weight is 35 but slow gives a span of 32/7. First onset is 96/245 instead of 3/7; durations are 32/35 instead of 1. Bass, tenor, and alto notes also fall below their ranges.

Retained source: `runs/gemini.json`, planned sequence 116.
Payload SHA-256: `302c838c6eed3a34b2f017593732787a95c48edb99cb4a3b68315c1ed0e071c1`.

```javascript
setcpm(60)
bass_1: note("~@3 g#2@7 f#2@7 d#2@7 e2@7 ~@4").slow(8/7).sound("piano")
tenor_1: note("~@3 e3@7 c#3@7 b2@7 b2@7 ~@4").slow(8/7).sound("piano")
alto_1: note("~@3 b3@7 a#3@7 f#3@7 g#3@7 ~@4").slow(8/7).sound("piano")
soprano_1: note("~@3 e4@7 f#4@7 f#4@7 e4@7 ~@4").slow(8/7).sound("piano")
```

### gemini-152: generation-melody 6002

Valid profile. Weights total 92; slow is 97/84. First onset is 291/644 instead of 3/7, and all durations are 97/276 instead of 1/2. MIDI 61 falls below range minimum 63. The motif and scale pass, but final pitch class 8 fails cadence 3.

Retained source: `runs/gemini.json`, planned sequence 152.
Payload SHA-256: `644436b2e569122143237ae1c5ef64da5ef16587b4077a6fa1af47c8fdbabc3c`.

```javascript
setcpm(60)
lead_1: note("~@9 d#4@7 ~@6 c#4@7 ~@1 f4@7 ~@6 d#4@7 ~@1 g#4@7 ~@6 f#4@7 ~@1 a#4@7 ~@6 g#4@7").slow(97/84).sound("piano")
```

### gemini-159: comprehension-structure 6001

Correct copying control. All 12 notes match the source. Engine confirms each fractional lead duration and onset.

Retained source: `runs/gemini.json`, planned sequence 159.
Payload SHA-256: `411ef1fbac4c5d30409b0a1de209a6e8b7c887899769af61722db462ecc853aa`.

```javascript
setcpm(60)
bass_1: note("~@2 g#2@21 c#3@21").slow(11/7).sound("piano")
keys_1: note("~@2 g#4@21 c#5@21").slow(11/7).sound("piano")
keys_2: note("~@2 c5@21 f5@21").slow(11/7).sound("piano")
keys_3: note("~@2 d#5@21 g#5@21").slow(11/7).sound("piano")
lead_1: note("~@6 g#4@7 a#4@7 ~@7 c5@7 ~@7 d#5@7 ~@84").slow(11/7).sound("piano")
```

### gemini-166: continuation-motif 6021

Expressions such as g#4@21/2 are valid public syntax. They mean weight 21 with item slowing by 2, not weight 21/2. Leading ~@604/7 similarly uses weight 604 and a slow operator. Lead first starts 3699/442, not 137/14; its third duration is 567/221, not 3/8. Other lanes have very large wrong onsets and durations. All eight voices and note count earn credit, with one accidental additional matching pitch under assignment. Treating slash as a fractional weight would silently change the music.

Retained source: `runs/gemini.json`, planned sequence 166.
Payload SHA-256: `d097035f2150cd4b2b60133da5361809d325236edb2f4b89a4d6e493eb7c3c55`.

```javascript
setcpm(60)
lead_1: note("~@137 a4@7 c#5@7 g#4@21/2 ~@49/2").slow(189/56).sound("piano")
bass_1: note("~@604/7 f#3@35/8 ~@305/8 e3@35/2 ~@35/4").slow(1243/112).sound("piano")
bass_2: note("~@1413/14 f#3@35/4").slow(1553/112).sound("piano")
inner_1: note("~@165/14 f4@21/8 ~@105/8").slow(153/16).sound("piano")
inner_2: note("~@347/14 d4@7/8 ~@105/8").slow(153/16).sound("piano")
```

### gemini-180: generation-melody 6001

Valid profile. Weights total 922 while slow gives span 206/21. First onset is 1648/3227 instead of 2/7; first duration is 412/461 instead of 1/2. MIDI 61 is below range minimum 63. Scale and cadence pass, but motif and rhythm fail.

Retained source: `runs/gemini.json`, planned sequence 180.
Payload SHA-256: `f3e211eec0245c50659060bef780dd07f3ce468364b30359371fcc899872330e`.

```javascript
setcpm(60)
lead_1: note("~@48 d#4@84 ~@28 c#4@63 ~@55 f4@84 ~@28 d#4@84 ~@28 g#4@84 ~@28 f#4@84 ~@28 a#4@84 ~@28 d#5@84").slow(103/42).sound("piano")
```

## Limits

The checks cover nominal event time and pitch. They do not test audio
playback, sample availability, or a complete public conformance suite.
Voice prefixes use the stated task convention. Repeating later cycles are
outside the finite task. The component totals retain the frozen score
policy and its partial-credit weighting. No uncertainty about flat, numeric,
zero-weight, or slash semantics remains in this retained set. A broader
Strudel program can require additional language rules.

## Action

Report subset compliance separately from public readability. Add engine
decoding as a separate observation policy before a future comparison.
Do not replace the frozen scores with these audit estimates. A full-grammar
native metric still leaves a ledger advantage in these Strudel tasks:
11.41 points for OpenAI and 26.13 points for Gemini. Those remaining gaps
are comparisons with ledger values, not proof of coherent composite notation.

## Retrospective

Pin engine packages before claiming public syntax failure. A one-line
runtime probe resolves zero-weight and slash semantics more clearly than
assuming mathematical fraction notation.
