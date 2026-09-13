---
title: E114 — Bar context and guarded note patches pass two models
kind: evidence
state: active
updated: 2026-09-13
parent: ../../plan/phase-6/6f-agent-facing-symbolic-representation.md
---

# E114 — Bar context and guarded note patches pass two models

## Verdict

Select compact bar-synchronized events as the agent musical context. Select
`ghostnote-note-patch-v0` JSON as the exact edit request. Keep the complete
note state in the host. The compiler expands each request against that state,
checks the source hash and note identities, applies a named default policy for
new notes, and produces complete candidate state before any adapter write.

The bar context passed all six requested patches and all 20 compiler
constraints across the two models. It used 3,828 GPT input tokens and 4,625
Gemini input tokens. This was 51% to 56% less than exact JSON. It passed 7 of
12 exact structural questions. The exact control also passed 7. The pattern
arm passed 8. The ABC arm passed 3.

The exact and bar contexts each produced six of six valid patches and passed
all 20 constraints. The pattern context produced five of six valid patches and
passed 13 of 14 counted constraints. GPT copied a visible mute value into each
new pattern-arm note. The strict default policy rejected those host-only
fields. ABC produced four of six schema-valid patches, but it passed only 12 of
19 counted constraints because the notation omitted opaque note identities.

This is a direct API result. It confirms the selection across two frontier text
models, but it is not a fresh host-agent session proof. Phase 7 must test the
selected context through the real host-agent surface before publication.

## Controlled cohort

The probe generated all notes. It used no third-party composition. The same
three canonical states and task text were used for every arm.

| Fixture | Coverage | Purpose | SHA-256 |
|---|---:|---|---|
| Short | 8 notes, 2 tracks, 1 bar | Exact reconstruction and expression fields | `8d983cf090e90f445697e3b20e911ff115c6638d758e296e49414cc299fba696` |
| Medium | 21 notes, 3 tracks, 2 bars | Structural questions and all edit tasks | `8be33b5c062faed8edcd5bfaff44c303523ffe155a47a4cffe4af7effeb96052` |
| Long | 84 notes, 3 tracks, 8 bars | Repetition and context scaling | `0d1a0f94e06997f9896bf488c18f0edca89bb182bdb015d7cd249d52d8722380` |

The cohort covers monophony, polyphony, synchronized tracks, binary and
triplet time, one off-grid start, overlaps, repeated motifs, section regions,
velocity, channel, mute, release velocity, and four note-expression fields.
Every medium note used an opaque identity. This prevented the notation arm
from guessing IDs from track and note order.

The cohort manifest hash was
`8265abd03f3b3d24377ecaa1dd8be9a722cb8381e8007d99891b92374ad9ae62`.
The four rendered representations had combined hash
`0232da68a38d17a51999cf8bc39725deded762fab2d5f391ab58c3efcc415794`.

## Arms

| Arm | Context bytes | Exact fields in model context | Expansion boundary |
|---|---:|---|---|
| Exact JSON | 24,425 | All fields | None; exact control |
| Bar events | 7,158 | ID, track, rational bar time, pitch, velocity, mute | Host keeps channel, release velocity, and expression |
| ABC 2.1 profile | 1,537 | Synchronized voices and pitch, with rounded timing | IDs and performance fields are unavailable |
| Pattern DSL | 4,031 | Roles, regions, opaque IDs, rational musical events, motif and repeated-block forms | Host expands patterns and keeps channel, release velocity, and expression |

The pattern arm compresses the long fixture as one musical block plus
four deterministic uses. Each use states the beat offset and ID and track
prefix rules. This is where pattern expansion occurs. The selected bar form
does not quantize. Its times stay rational. The ABC control alone rounds starts
to 1/12 beat and durations to 1/48 beat before the model sees them.

## Task results

Each initial call answered six tasks: exact structural questions, no-change
reconstruction, a local transpose, a density reduction, a four-note
continuation, and an echo of a deliberately invalid patch. A second call got
the exact validator errors and repaired that patch.

| Arm | Structure, GPT | Structure, Gemini | Exact reconstruction | Valid patches | Compiler constraints | Repair |
|---|---:|---:|---|---:|---:|---:|
| Exact JSON | 3/6 | 4/6 | 2/2 exact | 6/6 | 20/20 | 2/2 |
| Bar events | 3/6 | 4/6 | 2/2 refused with omitted fields | 6/6 | 20/20 | 2/2 |
| ABC 2.1 | 2/6 | 1/6 | 2/2 refused with omitted fields | 4/6 | 12/19 | 2/2 |
| Pattern DSL | 4/6 | 4/6 | 2/2 refused with omitted fields | 5/6 | 13/14 | 2/2 |

All eight initial responses parsed as JSON and contained the required result
groups. Every arm exposed the stale source hash, unknown note identity, and
negative start in the invalid patch. Every repair used one additional turn and
one additional model call. The repaired patch was identical across all eight
runs and moved only the named note to beat `1/3`.

The exact control reconstructed every short-fixture field in both runs. The
other arms did not claim exact reconstruction. The pattern arm named channel,
release velocity, and expression as omitted. The bar arm named the same field
groups. The ABC arm also named identity, velocity, mute, and exact timing or
pitch coverage according to the model response. No semantic edit claimed to
preserve a field that its context had omitted. Preservation came from host
patch expansion, not from model reconstruction.

The exact and bar patches preserved every identity and every field outside the
requested operation. Their continuation patches inserted four unique notes at
beats 8 through 11. After compilation, all inserted notes had complete exact
state. No timing, polyphony, velocity, mute, release, channel, or expression
field changed outside the declared operations.

ABC could not ground the local and semantic edits. GPT produced schema-valid
patches against real but incorrect identities. The compiler applied them, but
the task constraints rejected both results. Gemini invented systematic
identities that did not exist, so the compiler rejected both patches. Opaque
source IDs prevented these errors from passing.

## Patch and default contract

`ghostnote-note-patch-v0` has a required canonical source hash and a bounded
operation list.

- `transpose` and `delete` name existing opaque note IDs.
- `move` names one existing note ID and one rational start.
- `insert` supplies ID, track, rational start and duration, MIDI pitch, and
  velocity.
- Existing-note operations preserve every field that the operation does not
  name.
- Insertions must select `track-neutral-v0`. The compiler gets the unique
  channel from the target track. It sets mute to false, release velocity to 64,
  pressure, timbre, and pan to 0, and gain to 1.
- The compiler rejects a stale hash, unknown or duplicate ID, invalid rational
  time, unsupported operation, incomplete musical input, an ambiguous source
  channel, or model-supplied host-only fields under the default policy.

This rule keeps complete exact state outside the agent response. It also makes
defaulting explicit and testable. A later product compiler can add other named
policies. It must not use an implicit default.

## Tokens, latency, and model boundary

The denominator for tokens per note and bar is all 113 represented notes and
11 represented bars in one arm prompt.

| Provider and arm | Input | Output | Input / note | Output / note | Input / bar | Output / bar | Latency |
|---|---:|---:|---:|---:|---:|---:|---:|
| GPT, exact JSON | 8,761 | 2,171 | 77.53 | 19.21 | 796.45 | 197.36 | 7,873 ms |
| GPT, bar events | 3,828 | 1,858 | 33.88 | 16.44 | 348.00 | 168.91 | 6,074 ms |
| GPT, ABC | 1,290 | 1,647 | 11.42 | 14.58 | 117.27 | 149.73 | 6,532 ms |
| GPT, pattern DSL | 2,253 | 1,790 | 19.94 | 15.84 | 204.82 | 162.73 | 6,513 ms |
| Gemini, exact JSON | 9,519 | 1,364 | 84.24 | 12.07 | 865.36 | 124.00 | 3,789 ms |
| Gemini, bar events | 4,625 | 1,495 | 40.93 | 13.23 | 420.45 | 135.91 | 4,352 ms |
| Gemini, ABC | 1,523 | 1,132 | 13.48 | 10.02 | 138.45 | 102.91 | 2,968 ms |
| Gemini, pattern DSL | 2,750 | 1,357 | 24.34 | 12.01 | 250.00 | 123.36 | 3,729 ms |

The primary run used OpenAI Chat Completions through Python
`urllib.request`, model `gpt-5.4-mini-2026-03-17`, JSON mode, and low reasoning.
The confirmation run used Gemini Generate Content through the same client,
model `gemini-3.8-flash`, JSON response MIME type, temperature 0, and low
thinking. Both endpoints returned the requested model names. The probe source
contains the exact common task template. Arm prompts differed only by the arm
name and representation text.

The final OpenAI run used 35,658 input tokens, including 28,160 cached tokens,
and 7,847 output tokens across eight calls. The estimated cost was `$0.04305`
at the documented GPT-5.4 Mini rates. The final Gemini run used 41,485 input
tokens and 5,720 output and thinking tokens across eight calls. Its estimated
introductory cost was `$0.05256`. These are estimates, not billing records.
The raw OpenAI run hash was
`065caadb8239f7834a22a5d03b69a74dcb52b99695ca6aaca536670007efa51e`.
The raw Gemini run hash was
`edc45b9f1ca2ed57c017abf98e73ad7f7074819cc377bbc9ae860c8db28b80f4`.

Primary model sources:

- <https://developers.openai.com/api/docs/models/gpt-5.4-mini>
- <https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash>
- <https://ai.google.dev/gemini-api/docs/latest-model>

## Selection boundary

Use bar-synchronized events for agent musical context. Include roles, regions,
opaque IDs, rational bar positions and durations, pitch, velocity, and mute.
Keep channel, release velocity, and note expression in exact host state. Give
the model only the coverage needed for its task.

Use guarded JSON patches only for agent edit requests. The compiler owns exact
state capture, source guards, identity resolution, pattern expansion, named
defaults, collision and range checks, and complete candidate-state validation.
An adapter can write only that compiled state. Independent exact readback still
verifies a later live write.

Do not use ABC as the editing boundary. It is useful only as a compact notation
view when identity, off-grid time, performance fields, and exact reconstruction
are not required. Keep the pattern DSL as a future compression candidate. It
used fewer tokens and answered one more structural check, but its visible mute
field leaked into one GPT insertion. Do not use full exact JSON as the normal
context. It used about twice the selected input tokens and did not improve
structure or patch validity.

This session did not rank continuation quality. It checked only syntax,
identity, time, range, default, and preservation constraints. Session 6g owns
musical continuation and structural-transfer quality.

## Cleanup

No model output was sent to Bitwig. The run used no live project. The temporary
raw responses and summaries were removed after this evidence was recorded. No
model cache or generated music file remains.

## Retrospective

Opaque note IDs prevented a false notation success. Strict rejection of
model-supplied host-only defaults separated the selected bar form from the
smaller pattern form. Future symbolic tests must use both controls from the
first retained run.
