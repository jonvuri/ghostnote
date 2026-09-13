---
title: E115 — Established syntax does not beat compact bar context
kind: evidence
state: active
updated: 2026-09-13
parent: ../../plan/phase-6/6f1-established-symbolic-representations-and-model-familiarity.md
---

# E115 — Established syntax does not beat compact bar context

## Verdict

Keep the E114 compact bar form as the only context finalist for sessions 6f2
and 6g. MIDI-Like, REMI+, OctupleMIDI, and synchronized ABC did not give a
stable cross-model advantage. The bar form was also the smallest retained
published-label arm.

Do not claim that any result proves private training-data contents. No
established arm met the behavioral familiarity rule across both models. A
published-label advantage had to appear before examples and become smaller
after equal grammar instruction.

Keep `ghostnote-note-patch-v0` and the E114 compiler boundary. All 120 initial
task patches were schema-valid. The compiler, not the model, supplied omitted
host fields and checked complete candidate state. All ten repair tasks passed
after exact error feedback. No output became a live Bitwig write.

## Deterministic screen

The probe generated 153 notes across 13 bars. The short, medium, and long
fixtures had 12, 47, and 94 notes. Their meters included 4/4, 3/4, and 5/4.
The material included rational off-grid starts, triplets, swung offsets,
polyphony, chromatic voice leading, `Cmaj9#11`, `E7alt`, `Am11`, and a quartal
voicing. The medium source hash was
`45d76157a50c9aed69ae42cdd20008c314338ad3a5546ba1a4490843e9dd7a72`.

The deterministic screen reconstructed every represented core field for five
arms, two vocabularies, and three context sizes. All 30 round trips were exact.
The cohort hash was
`ed90ac5de4056feac1756d30888a20a20dcbd59ce511352a155fe430010a9e49`.
The combined representation hash was
`7e00f3ecd9fff5bd342eff2b5d6b8f210dce03e1c7bdb869980fc7a677bd1fa1`.

Each retained arm carried opaque note identity, exact rational start and
duration, pitch, velocity, meter, role, and harmony. The MIDI-Like, REMI+, and
OctupleMIDI arms used explicit task extensions for fields that their base form
does not own. ABC used an explicit `% GN` side plane. All arms omitted channel,
mute, release velocity, and note expression. The prompt named these omissions.
The host patch compiler preserved or defaulted them under the named E114
policy.

The screen rejected TidalCycles mini-notation before model calls. The bounded
pattern could not carry stable finite note identities and independent
performed durations. An exact side ledger would duplicate the score and make
the call a test of that ledger instead of Tidal.

## Controlled tasks

Each retained arm used the same source states, task text, model settings, and
patch compiler. Each arm had four conditions:

- published labels without an example;
- neutral renamed labels without an example;
- published labels with one grammar example; and
- renamed labels with the same grammar example.

Renaming changed labels only. Values and event structure stayed equal. A
masked no-music control kept labels but removed all musical values.

Each call answered exact metrical, harmonic, rhythmic, and performed-timing
questions. It reconstructed every represented short-fixture note. It
transformed existing notes, transferred a rhythm into `E7alt`, continued the
lead over `G13alt`, and echoed an invalid patch. Published grammar calls then
repaired the invalid patch after the compiler reported a stale hash, an
unknown note identity, and a negative start.

## Cross-model results

The primary run used `gpt-5.4-mini-2026-03-17`, JSON mode, and low reasoning.
The confirmation run used `gemini-3.8-flash`, JSON response mode, temperature
0, and low thinking. Both endpoints returned the requested model names.

The table shows the published-label, grammar-supplied condition. Each score has
five structural checks, one exact reconstruction check, 14 compiler
constraints, and one masked-control check.

| Arm | GPT score | Gemini score | GPT input | Gemini input | GPT input/note | Gemini input/note |
|---|---:|---:|---:|---:|---:|---:|
| Bar events | 21/21 | 21/21 | 5,029 | 5,640 | 32.87 | 36.86 |
| MIDI-Like | 19/21 | 21/21 | 6,744 | 8,871 | 44.08 | 57.98 |
| REMI+ | 18/21 | 21/21 | 7,333 | 8,343 | 47.93 | 54.53 |
| OctupleMIDI | 18/21 | 21/21 | 8,770 | 10,024 | 57.32 | 65.52 |
| Synchronized ABC | 18/21 | 19/21 | 6,077 | 7,067 | 39.72 | 46.19 |

GPT passed 367 of 420 objective checks across all 20 conditions. Gemini passed
418 of 420. GPT reconstructed the short fixture exactly in 14 of 20 calls.
Gemini passed all 20. Both models returned 60 of 60 schema-valid patches. GPT
passed 269 of 280 task constraints. Gemini passed all 280. The missed GPT
constraints were mainly the required continuation ending and one transfer
check. These were musical constraints, not parser failures.

All 40 responses included the required result groups and exposed all three
invalid-patch errors. All 40 masked controls returned unavailable. All five
repair calls per model produced the exact requested move and preserved every
other note.

## Familiarity control

The values are published score minus renamed score. Positive means that the
published labels scored higher.

| Arm | GPT, no example | GPT, grammar | Gemini, no example | Gemini, grammar |
|---|---:|---:|---:|---:|
| Bar events | -2 | +2 | +1 | 0 |
| MIDI-Like | 0 | +5 | 0 | 0 |
| REMI+ | +1 | +2 | 0 | 0 |
| OctupleMIDI | 0 | 0 | 0 | 0 |
| Synchronized ABC | 0 | +1 | 0 | -2 |

No established arm had a positive pre-example advantage that became smaller
after instruction on both models. The isolated Gemini bar result matches that
shape, but the bar form is a project baseline, not an established-format
familiarity case. The result supports grammar quality and explicit field
coverage. It does not support a model-familiarity claim.

The compact bar prompt also had the lowest token count. OctupleMIDI had the
highest fragmentation because each compound event was one space-delimited
lexeme with many tokenizer pieces. Published-label representation sizes were
11,623 bytes for bar events, 15,230 for MIDI-Like, 14,970 for REMI+, 16,728 for
OctupleMIDI, and 12,791 for synchronized ABC.

GPT input tokens per represented bar were 386.85, 518.77, 564.08, 674.62, and
467.46 in table order. Gemini values were 433.85, 682.38, 641.77, 771.08, and
543.62. GPT input tokens per space-delimited prompt lexeme were 2.091, 4.431,
4.821, 16.423, and 3.271. Gemini values were 2.345, 5.829, 5.485, 18.772, and
3.804. Published grammar-call latency was 6,080, 6,515, 4,568, 4,315, and 8,987
ms for GPT. It was 4,496, 3,340, 3,274, 10,847, and 5,081 ms for Gemini.

## Provider behavior and run identity

The final OpenAI run used 178,615 input tokens, 34,887 output tokens, and
101,632 cached input tokens across 25 calls. The final Gemini run used 208,061
input tokens, 28,082 output and thinking tokens, and 56,676 cached input tokens
across 25 calls.

The final Gemini run retried one malformed JSON repair response and then
passed. Two earlier temporary Gemini attempts ended before producing a run
artifact: one returned HTTP 503, and one returned malformed JSON. The final
probe keeps bounded retry accounting for HTTP 429 and 5xx responses and for
invalid JSON.

The OpenAI raw run hash was
`29f446de0214f6666713468c93691f43d98348ad841f3126cf295f5c23e31a86`.
The Gemini raw run hash was
`332bab20d75656e35650faacbeae4b89634331342b0712f7a9dd4ea627abb494`.
Raw responses and summaries remained temporary and were removed after this
record was written.

## Selection boundary

Use compact bar events for 6f2 and 6g. Keep roles, regions, opaque identities,
rational performed positions and durations, pitch, velocity, mute, meter, and
harmony in the task-specific view. Session 6f2 must add nominal timing,
realized timing, and simultaneous timing references. It must not replace exact
performed positions with inferred groove intent.

Do not promote an established token stream only because its labels look
familiar. MIDI-Like, REMI+, and OctupleMIDI were larger and did not improve the
cross-model result. ABC required a side plane and still lost task accuracy.

The continuation checks measured harmony, exact groove positions, identity,
defaults, and preservation. They did not measure aesthetic preference. No
blind operator ranking was collected. Sessions 6f2 and 6g own randomized
operator trials for groove and continuation quality.

## Cleanup

The study used generated notes only. It retained no third-party composition,
model cache, or generated music file. It did not open or change a live Bitwig
project. Temporary raw responses, summaries, and bytecode were removed.

## Retrospective

The masked-value control separated label guessing from score reading. The most
useful familiarity control was the pre-example published-versus-renamed delta.
Equal examples did not produce a stable cross-model familiarity result.
