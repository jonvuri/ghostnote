# ABC composite ledger-credit audit

## Finding

The ledger-only score hides real musical contradictions in this ABC cohort.
Only 5 of 30 unique composite note outputs agree with their ledgers. All five
are structure-copy cases. No generation or continuation notation agrees.
The other 25 include 21 decodable notation bodies with musical contradictions
and four bodies with real note-token errors.

Ledger credit is 613/666 components (92.04 percent). Independent ABC decoding
gives the notation 432/666 components (64.86 percent). The net difference is
181 components, or 27.18 percentage points. Whole-task successes fall from
15/30 to 5/30. Ten of the 15 credited whole-task successes disappear.

## Scope and method

Inventory all 30 unique ABC composite note outputs: 15 OpenAI and 15 Gemini.
Use repeat 1. Exclude analysis answers and sentinel repeats. Review 12 complete
responses in detail: both providers, all five note-output families, two aligned
controls, and two extra cases with high credit or a profile rejection. Select
these cases to expose defects. This is not a random sample.

Read every complete ABC body. Independently decode its pitches, rests, durations,
and voice timelines. Do not call the repository ABC parser. Inspect each selected
ledger and complete task contract. The JSON contains the full 12 payloads, task
objects, token traces, and hashes. It also contains independently decoded notes
for all 26 decodable bodies.

The numeric component calculation uses the unchanged task checks and field
matcher after independent notation decoding. Thus it retains the original
musical requirements. It does not change the frozen assessment. The direct
contract checks in the JSON provide an additional whole-task check.

## Grammar basis

Read the author’s [ABC 2.1 standard](https://michaeleskin.com/abctools/abc_standard_v2.1.pdf),
sections 3.1.7, 4.1–4.5, 4.20, 7, and 11.3. The
[official location](https://abcnotation.com/wiki/abc%3Astandard%3Av2.1)
returned HTTP 403. The accessible copy identifies Chris Walshaw and December 2011.

Decode `L:1/48` as 1/12 quarter-note beat per unit. A multiplier of 48 means
four beats. `C` is MIDI 60; `c` is 72. Commas lower an octave; apostrophes raise
an octave. Accidentals precede the pitch. Explicit accidentals override the key
signature. A voice has its own timeline. Rests advance it. Default accidentals
carry to the bar end. Nonconventional rational lengths remain legal, although
their staff rendering can be undefined. These responses use no ties, tuplets,
chords, overlays, transposition, or inline fields. Only OpenAI sequence 187 has
an unmarked pitch: isolated `f` in `K:C`, with no preceding F in that lane.

This is an event-grammar judgment, not an external-engine conformance certificate.
Underfull and overfull bars remain as written. Do not infer a missing rest,
change `L:`, move an accidental, or transpose a voice to fit the ledger.

## Population totals

| Provider | Ledger credit | Subset notation credit | Full-grammar notation credit | Ledger whole passes | Notation whole passes | Agreement |
|---|---:|---:|---:|---:|---:|---:|
| openai | 303/333 | 200/333 | 218/333 | 9/15 | 2/15 | 2/15 |
| gemini | 310/333 | 214/333 | 214/333 | 6/15 | 3/15 | 3/15 |
| all | 613/666 | 414/666 | 432/666 | 15/30 | 5/30 | 5/30 |

Three OpenAI profile rejections are valid ABC event syntax: sequences 59
(`K:F`), 130 (`K:E`), and 187 (bare `f`). They recover 18 of 666 components
relative to the subset diagnostic, or 2.70 percentage points. They recover
zero whole-task successes and zero notation/ledger agreement cases. Broader
ABC grammar does not remove their timing and pitch errors.

Four rejections are real note-token errors: OpenAI 38 and 159; Gemini 58 and
165. They receive zero full-document notation credit here. Their complete
leading rests or other complete tokens already show contradictions. A tolerant
engine might recover fragments, but this audit makes no guessed repair.

An illustrative consistent-document gate would retain the ledger score only
when all four musical fields agree. It would retain 245/666 components (36.79
percent): OpenAI 98/333; Gemini 147/333. This removes 368 components, or 55.26
percentage points. This is a strict policy sensitivity case, not an approved
replacement score. It discards useful partial values in inconsistent documents.

## Detailed full-response review

The identifiers below are provider planned sequence numbers. Each full response
and task is in `detailed_cases` in the [JSON](abc-composite-ledger-credit.json).
A notation score of zero for a malformed body means no full-document credit;
it does not mean every recoverable fragment is musically wrong.

### openai sequence 38: continuation-motif

Variant 6021. Ledger 30/33; notation 0/33.

Real syntax error: =_B stacks a natural and a flat. Independent leading rests disagree. Most are four times the ledger value; one inner onset agrees. The second inner lane is 337/28, but the first inner lane is 330/7 rather than 165/14.

Task hash: `dedc4b8fd251f2342688cc4a6b39c10c9c9dfea91ac83969956fd881b4458c89`.
Payload hash: `61910136794581b258349e2120f3f7c3ac6bec3c7d2780291fd557b583aa435e`.

### openai sequence 45: generation-melody

Variant 6001. Ledger 7/7; notation 6/7.

No leading rest. First onset is zero, not 2/7. ^D24 has duration 2 beats, not 1/2. Pitch sequence agrees with the ledger. Rhythm does not.

Task hash: `82a383589fa99198a2f8e87c68adf45e16e91d9d601a988a72f391b8594e6707`.
Payload hash: `8f82bad433a28d39add93bcbcc59ee32eec97eac4857cef87ded6dfb374a7b1e`.

### openai sequence 59: generation-progression

Variant 6001. Ledger 11/12; notation 1/12.

K:F is valid public ABC and causes a false subset rejection. Explicit accidentals override its key signature. Nevertheless, z96/7 is 8/7 beat, lengths 48 mean four beats, gaps 48 mean four beats, and every notation pitch is one octave above its ledger value.

Task hash: `372c3a5e8b6a5fe00829c15162ee5a42804c123d29c7c52e7ef3f89260239d53`.
Payload hash: `7c19ea026d0f15699a8aa8da47e3595ac5f1c5ba4334d68c971aa3451c1fbfbc`.

### openai sequence 73: comprehension-structure

Variant 6000. Ledger 49/49; notation 49/49.

Aligned control. All 12 events match the source and ledger.

Task hash: `00c14be3706e2ea46ac30aacf1a2f05838e9cb35a7f8bae72338183f34b7bbd8`.
Payload hash: `88921a68b5c83d87ec170b3fc53da1e09a46f523c83de6c01ab4d5f505608ed1`.

### openai sequence 159: continuation-roles

Variant 6000. Ledger 10/10; notation 0/10.

Real syntax error: =^C and repeated =^F stack a natural with a sharp. Complete leading rests already disagree: z198/7 is 33/14, not29/7.

Task hash: `f17855168e80a8ce136b81873a09bae1bad711325972adf8aa01f9d8f27cf363`.
Payload hash: `209f3610ecfdc0302a5c83df42e7b5de7c3f8515574575beaf6b43146bed97c1`.

### openai sequence 187: continuation-motif

Variant 6022. Ledger 32/33; notation 16/33.

f without an explicit natural is valid ABC in K:C. It is MIDI77 in this lane. The subset rejection is a false grammar alarm. All notation onsets and durations are four times the ledger values; one lead pitch is also wrong against the task. No complete notation success is recovered.

Task hash: `10780d3ee11f24cce6fe7ffec24a75fe1dea5b36d498d0fb6ad3ba9668f50524`.
Payload hash: `e58ab69294fca53ccc6257b1c1fed0a8c9f11e7e24d190a30df1c846d9833429`.

### gemini sequence 37: continuation-roles

Variant 6001. Ledger 10/10; notation 7/10.

Complete valid tokens give genuine timing errors. z1440/7 is120/7 beat, not30/7. _E, is51 and _e is75, so pitches agree, but durations48 mean4 beats and gaps48/7 mean4/7 beat.

Task hash: `3f478b9d248072fed49dfa42e2a8d276ae064a1a8987cb11e37678450969b812`.
Payload hash: `a0c3db209b1770919494d86f450bc768a997bba854d36785606fc9d716135432`.

### gemini sequence 58: generation-progression

Variant 6001. Ledger 11/12; notation 0/12.

Real syntax error: B_ places a flat after the pitch. Complete bass tokens independently contradict ledger timing and pitch: A, is MIDI57, not45; length48/1 is four beats, not one.

Task hash: `372c3a5e8b6a5fe00829c15162ee5a42804c123d29c7c52e7ef3f89260239d53`.
Payload hash: `b45ab8c1f9f0b3a57db491fd923a4d9779529d5f04d75c64755575f24235116c`.

### gemini sequence 151: generation-melody

Variant 6002. Ledger 7/7; notation 6/7.

z144/7 is12/7 beat, not3/7. _E24 lasts2 beats, not1/2. Ledger pitches agree; rhythm does not.

Task hash: `58427f81ae668d45ab63a761f1b9ca8eb40e4c218c01499cb92de6dbfe0271d1`.
Payload hash: `701d6a584242bc46b77ebc0f0abda989f786dc9973349113b406b21616ab4653`.

### gemini sequence 158: comprehension-structure

Variant 6001. Ledger 49/49; notation 49/49.

Aligned control. Flats and sharps are valid ABC accidentals. All 12 events match the source and ledger.

Task hash: `438c07f6748ab2fa127c755d543b337846461b1d06c0259ee0db6526bdce579e`.
Payload hash: `df6b2990a50cf5f63e94f484e6550ee38e979787e7d7e64d053c5df467fda892`.

### gemini sequence 165: continuation-motif

Variant 6021. Ledger 28/33; notation 0/33.

Real syntax errors: d# and A# put accidentals after pitches. Earlier complete tokens already give wrong timing and pitch. No full-document recovery is assigned.

Task hash: `dedc4b8fd251f2342688cc4a6b39c10c9c9dfea91ac83969956fd881b4458c89`.
Payload hash: `5d7b2aae7d03d328c13df6d07d3e41974c95020151c949e495b1f1e3b77a06b0`.

### gemini sequence 179: generation-melody

Variant 6001. Ledger 7/7; notation 6/7.

z96/7 is 8/7 beat, not 2/7. _E24 is 2 beats, not 1/2. All ledger pitches agree; notation timing does not.

Task hash: `82a383589fa99198a2f8e87c68adf45e16e91d9d601a988a72f391b8594e6707`.
Payload hash: `39d8d843f9eb70fe501c73445458ed9c80a1c8aad8f90bcd8829b3fbf1e81b2e`.

## Complete inventory

Public means the emitted ABC event grammar is decodable. It does not certify
metric engraving or external-engine behavior. Profile means the fixed subset
accepts the notation. Agreement compares all four musical fields.

| Provider / sequence | Family | Ledger | Notation | Public | Profile | Agreement |
|---|---|---:|---:|---|---|---|
| openai / 2 | continuation-motif | 10/33 | 26/33 | decodable | yes | no |
| openai / 38 | continuation-motif | 30/33 | 0/33 | token error | no | no |
| openai / 45 | generation-melody | 7/7 | 6/7 | decodable | yes | no |
| openai / 59 | generation-progression | 11/12 | 1/12 | decodable | no | no |
| openai / 73 | comprehension-structure | 49/49 | 49/49 | decodable | yes | yes |
| openai / 88 | continuation-roles | 10/10 | 7/10 | decodable | yes | no |
| openai / 95 | generation-melody | 7/7 | 6/7 | decodable | yes | no |
| openai / 102 | continuation-roles | 10/10 | 5/10 | decodable | yes | no |
| openai / 109 | generation-progression | 11/12 | 1/12 | decodable | yes | no |
| openai / 116 | comprehension-structure | 49/49 | 49/49 | decodable | yes | yes |
| openai / 130 | generation-progression | 11/12 | 1/12 | decodable | no | no |
| openai / 137 | generation-melody | 7/7 | 3/7 | decodable | yes | no |
| openai / 159 | continuation-roles | 10/10 | 0/10 | token error | no | no |
| openai / 180 | comprehension-structure | 49/49 | 48/49 | decodable | yes | no |
| openai / 187 | continuation-motif | 32/33 | 16/33 | decodable | no | no |
| gemini / 1 | generation-melody | 5/7 | 4/7 | decodable | yes | no |
| gemini / 23 | comprehension-structure | 49/49 | 49/49 | decodable | yes | yes |
| gemini / 30 | comprehension-structure | 49/49 | 49/49 | decodable | yes | yes |
| gemini / 37 | continuation-roles | 10/10 | 7/10 | decodable | yes | no |
| gemini / 44 | continuation-motif | 31/33 | 18/33 | decodable | yes | no |
| gemini / 51 | continuation-roles | 9/10 | 6/10 | decodable | yes | no |
| gemini / 58 | generation-progression | 11/12 | 0/12 | token error | no | no |
| gemini / 65 | generation-progression | 8/12 | 1/12 | decodable | yes | no |
| gemini / 80 | continuation-motif | 29/33 | 11/33 | decodable | yes | no |
| gemini / 94 | continuation-roles | 9/10 | 7/10 | decodable | yes | no |
| gemini / 115 | generation-progression | 9/12 | 1/12 | decodable | yes | no |
| gemini / 151 | generation-melody | 7/7 | 6/7 | decodable | yes | no |
| gemini / 158 | comprehension-structure | 49/49 | 49/49 | decodable | yes | yes |
| gemini / 165 | continuation-motif | 28/33 | 0/33 | token error | no | no |
| gemini / 179 | generation-melody | 7/7 | 6/7 | decodable | yes | no |

## Limits and recommendation

These are exact counts for this emitted-response cohort. They do not estimate
performance on new tasks. A component is not a response: the 666 components
weight families differently. Do not generalize the pooled fraction to all
formats or providers. This audit does not review native ABC outputs or analysis
answers. The four malformed documents use a conservative zero-credit policy.

For a product interpretation, report ledger recovery, notation task accuracy,
and cross-document agreement separately. Show the common musical-field gate
as a sensitivity result. Avoid naming ledger accuracy “composite musical
success” without this qualification.

## Provenance and verification

- gemini manifest: `990038af3365f7831bb3a9c97bb50ccf39f01a5fbcba57cf9a6708d891b35937`.
- openai manifest: `742f428bb5539c1a53f4c1c3ec62ffe827dc121e1cc1a95ce819bee45d8c14fe`.
- Audit JSON hash: `26bd0fd8b336407ac199084479a98ed280feb0b1acf4b14561e87eb9185cc841`.
- Verified every selected full payload hash against its retained manifest.
- Direct checks found two selected notation whole-task passes, both aligned controls.
- For all 26 decodable bodies, the independent timeline calculation used exact fractions.
- No provider request, frozen result edit, cache edit, or live-project action occurred.

## Retrospective

Keep notation values and ledger values as separate observations. A broad grammar
audit must precede any claim that a notation failure is a public-format error.
