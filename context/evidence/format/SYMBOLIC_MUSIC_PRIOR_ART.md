---
title: Symbolic music prior-art comparison
kind: reference
state: active
updated: 2026-09-27
parent: COMPACT_BAR_RATIONALE.md
---

# Symbolic music prior-art comparison

## Fair comparison rule

Each family is judged first by its native purpose. A score notation is not a
failed live pattern language. A pattern language is not a failed finite note
database. A model token stream is not a public interchange format.

The Phase 8c benchmark adds task fields when a family does not own them. It
counts every extension, grammar instruction, and side ledger in bytes and
provider input tokens.

## Matrix

| Family | Native purpose | Native strength | Ghostnote comparison treatment |
|---|---|---|---|
| Exact JSON | Complete object exchange | Explicit fields and exact reconstruction | Complete control. It retains every benchmark note field. |
| Compact-bar | Agent task view | Bar structure, opaque IDs, rational time, and sparse edits | Current project baseline. The v1 shorthand needs a fresh-cohort correction to the labeled v0 spelling. |
| ABC 2.1 | Human-readable notation, tune exchange, typesetting, and playback | Conventional pitch, rhythm, tuplets, voices, and metadata | The native arm uses ABC only. The composite arm adds a counted `% GN` side ledger. |
| LilyPond | High-quality music engraving from text input | Detailed notated music and layout | Screened out before model calls. The repository does not pin a LilyPond compiler for this cohort. |
| Tidal or Strudel mini-notation | Cyclic pattern construction and transformation | Terse subdivision, repetition, superposition, polymeter, and variation | The v1 mini arm expands one declared cycle. It has no stable finite identity claim. |
| Alda | Text-based composition, playback, and interactive sequencing | Readable parts, notes, chords, voices, and programmatic composition | The native arm uses an Alda-style score. The composite arm adds a counted `# GN` side ledger. |
| MIDI-Like | Autoregressive performance-event modeling | Ordered time shifts, note-on, note-off, and velocity events | The native arm uses musical events only. The composite arm adds exact Ghostnote task fields. |
| REMI+ | Bar-aware multi-track model input | Explicit bar, position, duration, and instrument structure | The native arm uses the model-token structure. The composite arm adds exact Ghostnote task fields. |
| OctupleMIDI | Compound-event symbolic pretraining and understanding | One multi-field token per note | The native arm uses compound note tokens. The composite arm adds exact Ghostnote task fields. |

## Direct sources

- [ABC 2.1 standard](https://abcnotation.com/wiki/abc%3Astandard%3Av2.1)
  defines tune fields, tuplets, playback, typesetting, and multiple voices.
- [LilyPond text input](https://lilypond.org/doc/v2.23/Documentation/web/text-input)
  describes text that compiles to engraved music.
- [Tidal documentation](https://tidalcycles.org/docs/) defines Tidal as software
  for musical patterns. Its [mini-notation reference](https://tidalcycles.org/docs/reference/mini_notation/)
  defines grouping, repetition, superposition, and polymeter.
- [Strudel mini-notation](https://strudel.cc/learn/mini-notation/) describes a
  compact language for rhythmic patterns.
- [Alda](https://github.com/alda-lang/alda) defines a text-based music
  programming language. Its [note reference](https://alda.readthedocs.io/en/latest/notes/)
  documents its MML-derived pitch and duration syntax.
- [This Time with Feeling](https://arxiv.org/abs/1808.03715) is the source for
  the performance-event family used by the MIDI-Like profile.
- [Pop Music Transformer](https://arxiv.org/abs/2002.00212) introduces REMI for
  beat- and bar-aware music modeling.
- [FIGARO](https://arxiv.org/abs/2201.10936) uses REMI+ for controllable
  multi-track generation.
- [MusicBERT](https://arxiv.org/abs/2106.05630) introduces OctupleMIDI for
  symbolic music understanding and pretraining.

## Interpretation

The side-ledger arms are composite representations. Their Ghostnote results do
not show that base ABC or Alda carries opaque live note identity. The model
token profiles also contain task extensions that are not part of the cited base
representations.

The Phase 8c v0 run found that all eight retained families passed their native
task on its two dated providers. This includes the Strudel arm. The expanded
v1 run uses separate native and composite arms across three providers and nine
task families. Native musical success varied by provider and task.

[E140](../experiments/e140-expanded-symbolic-format-comparison-requires-revision.md)
shows that side ledgers added input tokens, output bytes, and alignment
failures. Their identity capability did not turn a native musical result into a
product-contract result. Report native-purpose, side-ledger, stable-identity,
and preservation results separately.
