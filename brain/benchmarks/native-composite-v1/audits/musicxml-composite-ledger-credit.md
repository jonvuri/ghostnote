# MusicXML composite ledger-credit audit

## Finding

Only 12 of 30 unique composite MusicXML outputs have notation that agrees with
the ledger. Another 12 have valid notation with real musical disagreements.
Six have invalid notation documents. All six invalid cases are OpenAI outputs.
Broader MusicXML grammar rescues none of their subset rejections.

Ledger credit is 609/666 components (91.44 percent). Independent full-grammar
notation credit is 431/666 (64.71 percent). The net difference is 178 components,
or 26.73 percentage points. Whole-task passes fall from 11/30 to 6/30. Five of
the 11 ledger whole-task passes disappear. The effect is much larger for OpenAI
than Gemini in this cohort.

## Scope and method

Inventory all 30 unique composite MusicXML note outputs: 15 per provider.
Use repeat 1. Exclude analysis and sentinel repeats. Read 12 complete responses
and complete task contracts across both providers and all five note-output
families. Include high ledger credit with invalid notation, valid contradictions,
aligned correct controls, and an aligned but musically wrong control.
This is a defect sample. The 30-case totals cover the complete format cohort.

Validate each original notation block against the official MusicXML 4.0 XSD.
Independently decode all 24 valid blocks from their complete XML event streams.
Do not use the subset parser. Decode ledgers independently from the GN rows.
Compare exact voice, onset, duration and pitch multisets. Use exact fractions.

The [JSON](musicxml-composite-ledger-credit.json) contains all 30 case records,
all 24 decoded notation note sets, and 12 complete payloads, task objects,
ledger note sets and event traces. Numeric component totals use the unchanged
task checks and field matcher after independent decoding. Direct whole-task
checks agree for all valid notation and all ledgers. Frozen results stay intact.

## Grammar and validation

[Divisions](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/divisions/)
and [duration](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/duration/)
define quarter-beat values as duration/divisions. Notes and rests advance the
cursor; [chord tones](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/chord/)
share the preceding onset. [Backup](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/backup/)
and [forward](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/forward/)
move the cursor. [Pitch](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/pitch/)
requires step and octave; alter supplies chromatic semitones.

A [partwise score](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/score-partwise/)
has one [part list](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/part-list/)
followed by musical parts. Their definitions cannot be interchanged. Public
[voice](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/voice/)
values distinguish streams within parts. For these task roles, use the emitted
part-name before its lane suffix, as the prompt requires.

All valid blocks use partwise scores, one implicit measure per part, voice 1,
and sequential notes/rests. None uses ties, backup, forward, chord tones,
transposition, grace notes, or timewise structure. No unresolved public feature
could explain the disagreements found here.

Use `/usr/bin/xmllint`, libxml2 2.9.13, offline with the official
[W3C schema tag v4.0](https://raw.githubusercontent.com/w3c/musicxml/v4.0/schema/musicxml.xsd).
Rewrite only the two schema import paths to local files. Record original and
local schema hashes in JSON. XSD validation proves structure and data types;
it does not prove task correctness, metric engraving, or playback. No renderer
or sequencer import was run. No missing tag, octave, or part definition was
supplied. An invalid document receives zero full-document notation credit.
This is conservative relative to a separate fragment-salvage policy.

## Complete population totals

| Provider | Ledger credit | Full-grammar notation | Ledger whole passes | Notation whole passes | Agreement | XSD valid |
|---|---:|---:|---:|---:|---:|---:|
| openai | 298/333 | 143/333 | 6/15 | 1/15 | 3/15 | 9/15 |
| gemini | 311/333 | 288/333 | 5/15 | 5/15 | 9/15 | 15/15 |
| all | 609/666 | 431/666 | 11/30 | 6/30 | 12/30 | 24/30 |

The full-grammar component totals equal the subset notation diagnostic totals.
There is no recovered component credit. The six invalid documents are OpenAI
57, 79, 86, 93, 114 and 136. The ledgers get 137 credited components from these
documents. Across the 24 valid notation documents, the net ledger advantage
is another 41 components. These two sources sum to the 178-component gap.

If an illustrative gate retains ledger credit only when all four musical
fields agree, it retains 271/666 components (40.69 percent): OpenAI 67/333;
Gemini 204/333. It removes 338 components, or 50.75 percentage points. This
strict sensitivity policy also discards useful partial values. It is not an
approved replacement score.

An arithmetic upper bound can assume every one of the 139 planned components
in the six invalid documents passes. That unearned oracle completion would
raise notation credit to 570/666, still 39 components below the ledger. This
bound is not a parser result or a repair estimate. Actual credit remains 431/666.

## Complete-response reviews

Identifiers are provider planned sequence numbers. Full text and task objects
are in `detailed_cases` in the JSON. Public validity, profile compliance,
musical task correctness and ledger agreement remain separate fields.

### openai sequence 8: continuation-motif

Variant 6020. Ledger 26/33; notation 27/33.

Valid notation, real disagreement, with errors in both channels. First bass rest 624/56 = 78/7 agrees. After duration 14 and rest 470, second bass starts 1108/56 = 277/14, not ledger 99/7 or demanded 177/14. Inner second onset 484/56 = 121/14 and pitch 75 contradict ledger 57/7, pitch 73. Lead notation durations 21/56, 42/56, 84/56 meet the task, while ledger doubles them. Notation 27/33 slightly exceeds ledger 26/33; neither completes the task.

Task hash: `7e1cc1b56671909d5e94801571b506443467a9175413b51f3237e78d8a2efb9a`.
Prompt hash: `dd79fde7a5aa50c70ef982747fd8f4e398959c8a072cf9c537787f091ec0b01a`.
Payload hash: `baec5b301c315f8d8051efb544f6f794a5f0f5d6034e0685a1ae51e3ae8b811f`.

### openai sequence 57: generation-progression

Variant 6001. Ledger 12/12; notation 0/12.

Ledger earns 12/12, but notation is malformed XML: three part declarations open <part> and close </score-part>. This is not legal public MusicXML. Lane suffixes such as bass.bass also violate the requested local numeric-lane profile, but the closing-tag error independently prevents full-document credit. No tag was changed. Notation 0/12.

Task hash: `372c3a5e8b6a5fe00829c15162ee5a42804c123d29c7c52e7ef3f89260239d53`.
Prompt hash: `ad820c65a09107135c16d4747298fe96f875aa21daf531138e917f267a296ef8`.
Payload hash: `0397c3bafbc8417488a3008ebda5439b0191bcafc4906903c95fd5e77aac47b0`.

### openai sequence 79: comprehension-structure

Variant 6000. Ledger 49/49; notation 0/49.

Ledger copies the source exactly,49/49. The XML is well-formed but invalid MusicXML. <part> declarations occur inside part-list, followed by empty score-part definitions with missing part-name. The local error about unique lane names is not merely a public-format false alarm. No part-name was moved to another element. Notation 0/49.

Task hash: `00c14be3706e2ea46ac30aacf1a2f05838e9cb35a7f8bae72338183f34b7bbd8`.
Prompt hash: `6a5dd2f8a26222c67c8c1cb9cc9b1dc9dcaca8b6b9b1c046402abebed7d3a98b`.
Payload hash: `a4cc5fb99f1c6c9e0d5492068b113d7c1474d60e599dca4804ed53445547bf1f`.

### openai sequence 86: continuation-roles

Variant 6002. Ledger 10/10; notation 0/10.

Ledger meets all role constraints,10/10. Notation opens <part-part> for the lead declaration and closes </score-part>. This is an actual XML mismatch. No typo was repaired. Notation 0/10.

Task hash: `18fffcce3733a22c1777c2b5036802e82269b0098a9d8878223ff39b386caeda`.
Prompt hash: `aef964b2f8deec747429b2d8256a5220060634fea48578479d0bf8913b2ead67`.
Payload hash: `07606b96c1440e6a2858e58f7e87003c7977e9f2904d2107602637d0a459185a`.

### openai sequence 93: generation-melody

Variant 6000. Ledger 6/7; notation 0/7.

The ledger earns 6/7; cadence fails because final 83 has pitch class 11 instead of required 6. The notation last pitch has stepB but no octave. MusicXML requires octave; it cannot be inferred from preceding notes. Full-document notation 0/7. Other complete note fragments are intelligible but do not supply the missing octave.

Task hash: `6a9856f9692ec65f3aac41a5273f8d9f821e8fe5a9685731c6c0183e6110242e`.
Prompt hash: `5528a35de41a0ca2c670d2ed1d24ce41534473dcdc3253861916d13efd2cda46`.
Payload hash: `55e910ea9ff90ea96ffb214da7bd33b96e4e58b8bcce37e6bec061b6432e405d`.

### openai sequence 178: comprehension-structure

Variant 6001. Ledger 49/49; notation 49/49.

Aligned correct copy control. All 12 notes agree with the ledger and source. Divisions 21 and rest 6 give 2/7; durations 63 give 3 beats. Lead durations 7 and explicit rests match the source grid. Both 49/49.

Task hash: `438c07f6748ab2fa127c755d543b337846461b1d06c0259ee0db6526bdce579e`.
Prompt hash: `38208fc3e3927bf2ef344023f7ff7b519585396eaa99d481eda61a47dbdcadaa`.
Payload hash: `298dc630e42dc821a77142483ed22f8ce13640718254aad07cb98c91bfcb8d62`.

### gemini sequence 28: comprehension-structure

Variant 6000. Ledger 49/49; notation 49/49.

Aligned correct copy control. Divisions 28 and rest 4 give 1/7; duration 140 gives 5 beats. Bass B1 is 35; E2 is 40. All 12 notes agree with ledger and source. Both 49/49.

Task hash: `00c14be3706e2ea46ac30aacf1a2f05838e9cb35a7f8bae72338183f34b7bbd8`.
Prompt hash: `6a5dd2f8a26222c67c8c1cb9cc9b1dc9dcaca8b6b9b1c046402abebed7d3a98b`.
Payload hash: `ba3d6aa775fb78b4e285c8b879c109b00801d38527970577beb7e73e98e75474`.

### gemini sequence 49: continuation-roles

Variant 6002. Ledger 10/10; notation 10/10.

Aligned correct role control. Divisions 7 and rest 31 give 31/7; notes last one beat and produce subsequent required starts. Bass 51, 48, 46, 51 and lead 70, 68, 65, 63 meet all range, harmony, leap, collision, cadence checks. Both 10/10.

Task hash: `18fffcce3733a22c1777c2b5036802e82269b0098a9d8878223ff39b386caeda`.
Prompt hash: `aef964b2f8deec747429b2d8256a5220060634fea48578479d0bf8913b2ead67`.
Payload hash: `fc1d2fbd67e3488b7106e3b8f072fec4736dc48453dd0704b9a9dd5e1c9a4336`.

### gemini sequence 71: generation-progression

Variant 6000. Ledger 10/12; notation 10/12.

Aligned but musically imperfect progression control. Both channels contain the same sixteen events. Second-chord tenor and alto are both 60, so strict voice order fails. Third-chord pitch classes are 2, 8, 10, missing required 5. Agreement does not imply task success. Both 10/12.

Task hash: `aeb50bc7c508c8279146cd7835e7dff836b3b8f50eb928e5d471b117e0503b71`.
Prompt hash: `babf25c6fbb488653db67496885997efcf388aa5d5e1b87414652bc0f4379ea0`.
Payload hash: `0ae519f065bc4f899f8ab21612ffa794a578e5bd984a2ce7a6c7a6cfc5152564`.

### gemini sequence 149: generation-melody

Variant 6002. Ledger 5/7; notation 4/7.

Valid notation, genuine onset disagreement. Divisions 42 and repeated duration 21 plus rest 7 force 2/3-beat spacing. Third starts 37/21 instead of ledger 10/7. The ledger uses the requested starts. Both channels have pitch 84 above maximum 82 and contain forbidden pitch classes; those common errors are separate. Notation loses the rhythm component:4/7 versus ledger 5/7.

Task hash: `58427f81ae668d45ab63a761f1b9ca8eb40e4c218c01499cb92de6dbfe0271d1`.
Prompt hash: `ed2b259cb2775749eee4aa4459f20039d3561fd68b6f572fbb2b7b86b3f5b36b`.
Payload hash: `a0ae740bc0081761c8496af9ed4d96ddb6558d2ecba9df269bb6eb57b860ac72`.

### gemini sequence 163: continuation-motif

Variant 6021. Ledger 31/33; notation 26/33.

Valid notation, genuine pitch/duration disagreement. Bass duration 14/56 = 1/4 contradicts ledger 5/16. Second bass C#3 is 49, not ledger 50. Lead F4, A4, D4 give 65, 69, 62, not ledger 67, 70, 64. Both channels also have inner pitches 71, 67 instead of task 69, 65. Notation 26/33 versus ledger 31/33.

Task hash: `dedc4b8fd251f2342688cc4a6b39c10c9c9dfea91ac83969956fd881b4458c89`.
Prompt hash: `c8af9919b10c2cb57cfc30bcab47ea79b394212882c64f99ef55cf9290776eea`.
Payload hash: `dc65d13ec147d6d5a1ad281a2afb9193e6ef297fa99d88cdf677c9cecb0d9d4f`.

### gemini sequence 177: generation-melody

Variant 6001. Ledger 6/7; notation 5/7.

Valid notation, genuine onset disagreement. Rest 48/168 gives 2/7; first duration 84 and rest 28 give second 20/21. After second duration 63, third begins 223/168 rather than ledger 9/7 = 216/168. Later onsets also differ. Both channels fail cadence: final 80 has pitch class 8, not 3. Ledger 6/7; notation 5/7.

Task hash: `82a383589fa99198a2f8e87c68adf45e16e91d9d601a988a72f391b8594e6707`.
Prompt hash: `2bffdec45bd0f68abebeeb0ee4135dc854ff65c135a1fc8f6b077c3b3e0a56f4`.
Payload hash: `08839470c0b7a5e2dc19b68d95f06e9fb632cc56a60d7cbc6572d6dedaab5f53`.

## All 30 cases

| Provider / sequence | Family | Ledger | Notation | XSD valid | Profile parse | Agreement |
|---|---|---:|---:|---|---|---|
| openai / 8 | continuation-motif | 26/33 | 27/33 | yes | yes | no |
| openai / 36 | continuation-motif | 16/33 | 14/33 | yes | yes | no |
| openai / 43 | generation-melody | 6/7 | 5/7 | yes | yes | no |
| openai / 57 | generation-progression | 12/12 | 0/12 | no | no | no |
| openai / 79 | comprehension-structure | 49/49 | 0/49 | no | no | no |
| openai / 86 | continuation-roles | 10/10 | 0/10 | no | no | no |
| openai / 93 | generation-melody | 6/7 | 0/7 | no | no | no |
| openai / 100 | continuation-roles | 9/10 | 9/10 | yes | yes | yes |
| openai / 107 | generation-progression | 12/12 | 10/12 | yes | yes | no |
| openai / 114 | comprehension-structure | 49/49 | 0/49 | no | no | no |
| openai / 136 | generation-progression | 11/12 | 0/12 | no | no | no |
| openai / 143 | generation-melody | 6/7 | 3/7 | yes | yes | no |
| openai / 157 | continuation-roles | 9/10 | 9/10 | yes | yes | yes |
| openai / 178 | comprehension-structure | 49/49 | 49/49 | yes | yes | yes |
| openai / 185 | continuation-motif | 28/33 | 17/33 | yes | yes | no |
| gemini / 7 | generation-melody | 5/7 | 4/7 | yes | yes | no |
| gemini / 21 | comprehension-structure | 49/49 | 49/49 | yes | yes | yes |
| gemini / 28 | comprehension-structure | 49/49 | 49/49 | yes | yes | yes |
| gemini / 35 | continuation-roles | 10/10 | 10/10 | yes | yes | yes |
| gemini / 42 | continuation-motif | 31/33 | 25/33 | yes | yes | no |
| gemini / 49 | continuation-roles | 10/10 | 10/10 | yes | yes | yes |
| gemini / 64 | generation-progression | 9/12 | 9/12 | yes | yes | yes |
| gemini / 71 | generation-progression | 10/12 | 10/12 | yes | yes | yes |
| gemini / 78 | continuation-motif | 29/33 | 20/33 | yes | yes | no |
| gemini / 92 | continuation-roles | 9/10 | 9/10 | yes | yes | yes |
| gemini / 113 | generation-progression | 9/12 | 9/12 | yes | yes | yes |
| gemini / 149 | generation-melody | 5/7 | 4/7 | yes | yes | no |
| gemini / 156 | comprehension-structure | 49/49 | 49/49 | yes | yes | yes |
| gemini / 163 | continuation-motif | 31/33 | 26/33 | yes | yes | no |
| gemini / 177 | generation-melody | 6/7 | 5/7 | yes | yes | no |

## Interpretation and limits

Ledger-only credit can hide unusable XML structure as well as wrong musical
values. For OpenAI the notation loses 155/333 components relative to its ledger.
For Gemini it loses 23/333. Some individual notation values are more accurate
than their ledger values, as OpenAI sequence 8 shows. Agreement can also coexist
with musical failure, as Gemini sequence 71 shows.

Report ledger recovery, notation accuracy, and agreement separately. These
are exact cohort counts, not a general MusicXML or provider performance forecast.
Components weight families differently. This audit does not review analysis
answers or replace the frozen assessment. Fragment recovery from invalid scores
would need its own explicit policy and evidence.

## Provenance

- gemini manifest: `990038af3365f7831bb3a9c97bb50ccf39f01a5fbcba57cf9a6708d891b35937`.
- openai manifest: `742f428bb5539c1a53f4c1c3ec62ffe827dc121e1cc1a95ce819bee45d8c14fe`.
- Original schema hash: `b151d97b92ce96b6317b57a89b471601c74270ae6e078145477a977393a64193`.
- Local schema hash: `a9973e5b953c00b6561e54d8f45f6cda7369c3b04f9eb67f39a0cd1d62fd2209`.
- Audit JSON hash: `d4551a8f8a2b426c0f8efaa0ddc9ac4ba0b269eccd98142fa7ba4af67bb7362d`.
- Verified both retained manifest hashes and all 12 full payload hashes.
- Verified independent whole-contract checks for all 24 decoded blocks and all 30 ledgers.
- No provider request, frozen result edit, cache edit, or live-project action occurred.

## Retrospective

A ledger can conceal a malformed notation header even when every musical ledger
value is correct. Keep document validity as a separate acceptance condition.
