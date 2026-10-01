# MusicXML native full-grammar audit

## Finding

The native subset imposed one recoverable penalty in these 30 unique note
outputs. OpenAI sequence 135 contains a normal MusicXML time signature. The
local element whitelist rejects it. Read directly, it earns 11/12 components
instead of zero. It still fails the soprano range requirement.

The other two rejected outputs are invalid documents. Sequence 106 is not
well-formed XML. Sequence 113 has an invalid MusicXML score tree. Broader
MusicXML grammar does not make either valid. No response text was repaired.

Native component credit rises from 510/666 (76.58 percent) to 521/666
(78.23 percent). This adds 1.65 percentage points. Whole-task successes stay
11/30. The corresponding composite ledgers earn 609/666 (91.44 percent).
Their lead shrinks from 14.86 to 13.21 percentage points. This remaining gap
still includes the separate ledger-only scoring asymmetry. It is not a
comparison of two complete valid documents.

## Scope and method

Inventory all 30 unique native MusicXML note outputs: 15 OpenAI and 15 Gemini.
Use repeat 1. Exclude sentinel repeats and comprehension analysis. Inspect
12 complete responses and complete contracts. Include all three native subset
rejections, all five note-output families, both providers, accepted errors,
and correct controls. Select for defects, not as a random performance sample.

Validate the unmodified response text against the official MusicXML 4.0 XSD.
Then independently decode all 28 valid scores from the XML event stream. Do
not use the repository notation parser. Use exact fractions. Preserve rests,
durations, chromatic alterations, octave values and part names as emitted.
The [JSON](musicxml-native-full-grammar.json) contains all 30 case records,
all 28 decoded note sets, and the 12 full payloads and task objects.

For numeric comparison, feed independently decoded notes into the unchanged
task checks and field matcher. Direct whole-contract checks agree with the
result for all 28 decoded documents. This is an offline sensitivity result.
The frozen scores and observations remain unchanged.

## Official grammar basis

- [Divisions](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/divisions/) and [duration](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/duration/): duration/divisions gives quarter-note beats. Normal notes and rests advance the cursor.
- [Pitch](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/pitch/) and [alter](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/alter/): step, semitone alteration and octave define the pitch.
- [Voice](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/voice/), [backup](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/backup/), [forward](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/forward/) and [chord](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/chord/): voices identify event streams; backup/forward move the cursor; chord tones share the preceding onset without advancing it.
- [Partwise](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/score-partwise/), [timewise](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/score-timewise/) and [part list](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/part-list/): partwise scores contain parts with measures; timewise scores contain measures with parts. One part list identifies the parts.
- [Time](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/time/): a beats/beat-type pair can declare a time signature within attributes.

All valid emitted scores are partwise with one implicit measure per part. They
use voice 1 and sequential notes/rests. None uses backup, forward, chord tones,
ties, transposition, grace notes, or a timewise score. The required role comes
from part-name before the lane suffix. There is no unresolved public feature
that could shift the decoded event values.

## Schema verification and limits

Use `/usr/bin/xmllint`, libxml2 2.9.13, with `--nonet --noout --schema`.
Download the schema and its two imports from the official
[W3C repository tag v4.0](https://raw.githubusercontent.com/w3c/musicxml/v4.0/schema/musicxml.xsd).
Rewrite only the two schema import locations to local files. The initial HTML
listing extraction did not preserve XML escapes; it was rejected before any
case result was accepted. Validation used the raw official files.

XSD validation passed 28 responses and rejected two. It proves structural
and data-type conformance. It does not prove correct task values, metric
engraving, performance, or import behavior. No score renderer or sequencer
was run. In sequence 135, the single implicit measure spans 31/7 beats under
4/4. Keep this overfull metric warning separate from the clear event values.
Do not silently split the measure or change its durations.

## Complete population results

| Provider | Original native | Full-grammar native | Composite ledger | Native whole passes | Public XSD pass |
|---|---:|---:|---:|---:|---:|
| openai | 216/333 | 227/333 | 298/333 | 5/15 | 13/15 |
| gemini | 294/333 | 294/333 | 311/333 | 6/15 | 15/15 |
| all | 510/666 | 521/666 | 609/666 | 11/30 | 28/30 |

OpenAI recovers 11/333 components, or 3.30 percentage points. Its remaining
gap to the composite ledger is 71/333, or 21.32 percentage points. Gemini has
no subset rejections, no recovered credit, and a remaining gap of 17/333, or
5.11 percentage points. This native audit does not validate the composite
notation. Do not interpret those gaps as full-document composite superiority.

## Complete-response case reviews

Sequence numbers are provider planned sequence IDs. Full responses, task
objects, independent traces and request/response hashes are in `detailed_cases`
in the JSON.

### openai sequence 7: continuation-motif

Variant 6020. Original 20/33; independent 20/33.

Accepted, schema valid, but wrong affine result. Bass leading rest 8/56 = 1/7, not demanded 78/7. Its first duration 28/56 = 1/2, not 1/4. Inner initial pitch 80 agrees but duration 1 is twice the demanded 1/2. Lead pitches and durations agree, but all lead starts are too early. Bass final pitch 53 should be 52. These are response errors, not parser penalties.

Task hash: `7e1cc1b56671909d5e94801571b506443467a9175413b51f3237e78d8a2efb9a`.
Prompt hash: `6bbb64607615ad94904a9c904098c683b05659d81abe52b800d77dc621c637d3`.
Payload hash: `a5c4fdbdea5d49329fafb77f1648a0201be710f5095d522a3107130c2e7b9b9e`.

### openai sequence 42: generation-melody

Variant 6001. Original 5/7; independent 5/7.

Accepted and schema valid. No leading rest: first onset 0 instead of 2/7. Correct listed durations do not create the required onset gaps. Motif fails: third pitch 65 moves to 70 at note 7, but second pitch 63 moves to 70 rather than 68. Range, scale, cadence, count and lead voice pass.

Task hash: `82a383589fa99198a2f8e87c68adf45e16e91d9d601a988a72f391b8594e6707`.
Prompt hash: `0d7b98d0d294502bf687c65103de3e5fe80e84069ef0d51eb667511b7fddc81d`.
Payload hash: `46717391782024accca355d70567205594f4fac04177ac1a59c6802d0d9d897c`.

### openai sequence 106: generation-progression

Variant 6000. Original 0/12; independent 0/12.

Real XML error. <part-list> opens and never closes before </score-partwise>. Score parts and musical parts are interleaved inside it. This is not an alternative valid MusicXML grammar. No closing-tag insertion or tree rearrangement is permitted. Full-document credit remains 0/12.

Task hash: `aeb50bc7c508c8279146cd7835e7dff836b3b8f50eb928e5d471b117e0503b71`.
Prompt hash: `1b73fab94b50ec675060a134650db8a0624159048812eccf01f18b84a4fc793a`.
Payload hash: `c601186010ba156b4f00e2a069e955aae0466f70c7fd5cee77da53f8e22ae602`.

### openai sequence 113: comprehension-structure

Variant 6002. Original 0/49; independent 0/49.

Well-formed XML but invalid MusicXML score grammar. Five sibling <part-list> elements contain <part> music. A partwise score needs one part-list followed by part children. The error is not just order in our local part-matching check. No nested part is moved out. Full-document credit remains 0/49. Some nested note fragments are intelligible, but fragment extraction is a separate recovery policy.

Task hash: `b91221e83809d80f80925e722e813624e18a03886e4454d22233982d4bb6a882`.
Prompt hash: `13510cc950726bd697a24e29369ae223ca016819731f809d4f71798253f4b6ce`.
Payload hash: `dadf078afa104a4a38c1ca5bbd2b525642d5ce09839009aa52a6fbc08f9b5792`.

### openai sequence 135: generation-progression

Variant 6002. Original 0/12; independent 11/12.

One true subset penalty. <time><beats>4</beats><beat-type>4</beat-type></time> is legal in attributes and does not change quarter-beat divisions. The original file passes the 4.0 XSD. Divisions 7, leading rest 3, and duration 7 give onsets 3/7, 10/7, 17/7, 24/7 and one beat notes. Recover 11/12 task components. Soprano B3 is MIDI 59, below required 61 at chords 1 and 3, so range fails and no whole-task success is recovered. The single implicit measure spans 31/7 beats under 4/4: an overfull metric warning remains. XSD validity does not certify engraving or playback.

Task hash: `bdebfe7e6bb6ab7ba0ea263395013bb5f21f8bff3f4de4d31e256131f5c78011`.
Prompt hash: `f5999fe93c9924427ce247ea3d73a26c1c3f266c9630d1060919c66151a20094`.
Payload hash: `bcf440be32c5069c106950ebdcc62cc3cec578187f90c9197cd8a367d3b25c20`.

### openai sequence 156: continuation-roles

Variant 6000. Original 10/10; independent 10/10.

Accepted correct role-continuation control. Leading rest 29/7 establishes the required first onset. Four one beat notes produce the next listed starts. Bass 49, 47, 44, 45 and lead 66, 71, 68, 66 meet harmony, range, leap, collision and cadence checks. Full task 10/10.

Task hash: `f17855168e80a8ce136b81873a09bae1bad711325972adf8aa01f9d8f27cf363`.
Prompt hash: `affc5508ab3b052b41c449e93d0aae6ba12f93139cc828af5bedfe71c574bbb8`.
Payload hash: `428d483da019157e4317c74de2008b68fcb18a8d0fcdb10ae5a6ff66aa960a81`.

### gemini sequence 70: generation-progression

Variant 6000. Original 12/12; independent 12/12.

Accepted correct progression control. Parts appear soprano, alto, tenor, bass, with matching part-list order. That display order does not rename the roles. Divisions 7 and rest 1 yield first onset 1/7; durations 7 yield one beat chords . All four harmonic/inversion groups, strict voice order, ranges, movement and cadence pass. Full task 12/12.

Task hash: `aeb50bc7c508c8279146cd7835e7dff836b3b8f50eb928e5d471b117e0503b71`.
Prompt hash: `1b73fab94b50ec675060a134650db8a0624159048812eccf01f18b84a4fc793a`.
Payload hash: `e9392a17c1c4f796d54c5587e1cf0905182bb7002348b074cc72a4940ec62958`.

### gemini sequence 91: continuation-roles

Variant 6000. Original 8/10; independent 8/10.

Accepted, schema valid, but no leading rests. Starts 0, 1, 2, 3 should be 29/7, 36/7, 43/7, 50/7. Pitch-based checks mostly pass; exact start/density checks fail. A broad parser cannot invent the omitted rest. Credit stays 8/10.

Task hash: `f17855168e80a8ce136b81873a09bae1bad711325972adf8aa01f9d8f27cf363`.
Prompt hash: `affc5508ab3b052b41c449e93d0aae6ba12f93139cc828af5bedfe71c574bbb8`.
Payload hash: `d655f6cafd0e58b7e5616a3018b79c0fd8827047ae7e40b1c63cfef38c885d39`.

### gemini sequence 148: generation-melody

Variant 6002. Original 5/7; independent 5/7.

Accepted, schema valid, but repeated seven-division gaps impose a constant 2/3-beat onset step with divisions 42. Third onset 74/42 = 37/21 should be 10/7 = 30/21. Pitch differences preserve the first three motif pairs, but fourth 72 moves to 75 instead of 77. Rhythm and motif fail. Credit stays 5/7.

Task hash: `58427f81ae668d45ab63a761f1b9ca8eb40e4c218c01499cb92de6dbfe0271d1`.
Prompt hash: `878480838cdcb3794c2e89afaa3a73cf23b079c7844c3b71f19f342bb9fb7531`.
Payload hash: `f9f2ba224f356efc4bb248e5ffa0b667f2fb8cabc7f434d9aef081906acd5ff9`.

### gemini sequence 155: comprehension-structure

Variant 6001. Original 49/49; independent 49/49.

Accepted correct structure-copy control. Divisions 21 and leading rest 6 give 2/7. Sustained durations 63 give 3 beats. Lead duration 7 gives 1/3 beat and explicit rests match the source onset grid. Sharp spellings are enharmonic with the source flats. All 12 events match all four fields. Credit 49/49.

Task hash: `438c07f6748ab2fa127c755d543b337846461b1d06c0259ee0db6526bdce579e`.
Prompt hash: `9b20a96bb1eb11a592450260a793fe1d6f4f5b53309c2fc8dbba343260e11863`.
Payload hash: `9fbc891f1a0df6ea1df2c5855fdb36b3d34614d7bee92fed7bbd9b3e105f7966`.

### gemini sequence 162: continuation-motif

Variant 6021. Original 21/33; independent 21/33.

Accepted and schema valid, but affine pitches are wrong: inner 71, 67 should be 69, 65; bass 55, 52, 55 should be 53, 50, 53; lead 64, 67, 61 should be 67, 70, 64. Inner duration 11/28 should be 3/8; its second 3/28 should be 1/8. Bass 9/28 should be 5/16; lead last 11/28 should be 3/8. Onsets are correct. These exact rounding/pitch errors remain under full MusicXML semantics. Credit 21/33.

Task hash: `dedc4b8fd251f2342688cc4a6b39c10c9c9dfea91ac83969956fd881b4458c89`.
Prompt hash: `c68ae71050f71eaf6162a99677f1d5ed74f5da24c877e279a312db317b971088`.
Payload hash: `85aedb9226882f00b21b0d083d3975aac9257ec16bb2833f8581d5e13fcd4c2b`.

### gemini sequence 184: generation-melody

Variant 6001. Original 6/7; independent 6/7.

Accepted, schema valid melody with correct motif and listed note lengths. Divisions 168: rest 48 gives 2/7; first note 84 plus rest 28 produce second onset 160/168 = 20/21. After the second duration 63 there is no rest or backup: third starts 223/168, not 9/7 = 216/168. Later onsets also differ. Rhythm alone fails. Credit 6/7.

Task hash: `82a383589fa99198a2f8e87c68adf45e16e91d9d601a988a72f391b8594e6707`.
Prompt hash: `0d7b98d0d294502bf687c65103de3e5fe80e84069ef0d51eb667511b7fddc81d`.
Payload hash: `047ef2f0b6ac083f5f5aea7a2a559a4a45c6ea7d4d4d2b07722ef8b99edbc933`.

## All 30 cases

| Provider / sequence | Family | Profile | Public XSD | Original credit | Independent credit | Whole task |
|---|---|---|---|---:|---:|---|
| openai / 7 | continuation-motif | yes | yes | 20/33 | 20/33 | fail |
| openai / 35 | continuation-motif | yes | yes | 22/33 | 22/33 | fail |
| openai / 42 | generation-melody | yes | yes | 5/7 | 5/7 | fail |
| openai / 64 | generation-progression | yes | yes | 12/12 | 12/12 | pass |
| openai / 78 | comprehension-structure | yes | yes | 49/49 | 49/49 | pass |
| openai / 85 | continuation-roles | yes | yes | 10/10 | 10/10 | pass |
| openai / 92 | generation-melody | yes | yes | 3/7 | 3/7 | fail |
| openai / 99 | continuation-roles | yes | yes | 7/10 | 7/10 | fail |
| openai / 106 | generation-progression | no | no | 0/12 | 0/12 | fail |
| openai / 113 | comprehension-structure | no | no | 0/49 | 0/49 | fail |
| openai / 135 | generation-progression | no | yes | 0/12 | 11/12 | fail |
| openai / 142 | generation-melody | yes | yes | 4/7 | 4/7 | fail |
| openai / 156 | continuation-roles | yes | yes | 10/10 | 10/10 | pass |
| openai / 177 | comprehension-structure | yes | yes | 49/49 | 49/49 | pass |
| openai / 192 | continuation-motif | yes | yes | 25/33 | 25/33 | fail |
| gemini / 6 | generation-melody | yes | yes | 5/7 | 5/7 | fail |
| gemini / 20 | comprehension-structure | yes | yes | 49/49 | 49/49 | pass |
| gemini / 27 | comprehension-structure | yes | yes | 49/49 | 49/49 | pass |
| gemini / 34 | continuation-roles | yes | yes | 10/10 | 10/10 | pass |
| gemini / 41 | continuation-motif | yes | yes | 25/33 | 25/33 | fail |
| gemini / 56 | continuation-roles | yes | yes | 10/10 | 10/10 | pass |
| gemini / 63 | generation-progression | yes | yes | 11/12 | 11/12 | fail |
| gemini / 70 | generation-progression | yes | yes | 12/12 | 12/12 | pass |
| gemini / 77 | continuation-motif | yes | yes | 25/33 | 25/33 | fail |
| gemini / 91 | continuation-roles | yes | yes | 8/10 | 8/10 | fail |
| gemini / 120 | generation-progression | yes | yes | 9/12 | 9/12 | fail |
| gemini / 148 | generation-melody | yes | yes | 5/7 | 5/7 | fail |
| gemini / 155 | comprehension-structure | yes | yes | 49/49 | 49/49 | pass |
| gemini / 162 | continuation-motif | yes | yes | 21/33 | 21/33 | fail |
| gemini / 184 | generation-melody | yes | yes | 6/7 | 6/7 | fail |

## Interpretation

The full public grammar restores one useful partial result. It does not
restore a whole-task success or explain most of the native/ledger difference
for MusicXML in this cohort. Accepted errors include missing leading rests,
wrong affine origins, wrong pitches, and rational values rounded to the wrong
division grid. Broad grammar cannot repair those values.

These totals describe these exact emitted responses. Components weight task
families differently. They are not a forecast for new tasks or a general
MusicXML capability estimate. Fragment recovery from an invalid XML tree
would be a different policy and remains outside these totals.

## Provenance

- gemini manifest: `990038af3365f7831bb3a9c97bb50ccf39f01a5fbcba57cf9a6708d891b35937`.
- openai manifest: `742f428bb5539c1a53f4c1c3ec62ffe827dc121e1cc1a95ce819bee45d8c14fe`.
- Original official schema hash: `b151d97b92ce96b6317b57a89b471601c74270ae6e078145477a977393a64193`.
- Local schema hash after import path changes: `a9973e5b953c00b6561e54d8f45f6cda7369c3b04f9eb67f39a0cd1d62fd2209`.
- Audit JSON hash: `76417fd294ae87d55d34f0a6d84ca516016f8b90442c719f00c8457421e6f73c`.
- Verified both retained manifest hashes and all 12 full payload hashes.
- Verified independent whole-contract checks for all 28 decoded responses.
- No provider call, frozen response edit, cache edit, or live-project action occurred.

## Retrospective

Keep XSD validity, prompt-profile compliance, and musical task correctness
as separate results. Obtain the raw tagged schema for validation; do not
extract executable schema text from a formatted HTML listing.
