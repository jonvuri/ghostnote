---
title: Symbolic music prior-art comparison
kind: reference
state: active
updated: 2026-09-25
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
| Compact-bar | Agent task view | Bar structure, opaque IDs, rational time, and sparse edits | Current project baseline. It omits host-only fields and relies on the compiler. |
| ABC 2.1 | Human-readable notation, tune exchange, typesetting, and playback | Conventional pitch, rhythm, tuplets, voices, and metadata | The score view uses ABC labels. A counted `% GN` side ledger adds exact IDs and task fields. |
| LilyPond | High-quality music engraving from text input | Detailed notated music and layout | Screened out before model calls. The repository does not pin a LilyPond compiler for this cohort. |
| Tidal or Strudel mini-notation | Cyclic pattern construction and transformation | Terse subdivision, repetition, superposition, polymeter, and variation | Strudel runs one native pattern-expansion task. It is not scored on finite Ghostnote round-trip editing. |
| Alda | Text-based composition, playback, and interactive sequencing | Readable parts, notes, chords, voices, and programmatic composition | A valid Alda-style pitch sketch is paired with a counted `# GN` exact side ledger. |
| MIDI-Like | Autoregressive performance-event modeling | Ordered time shifts, note-on, note-off, and velocity events | A task profile adds opaque IDs, bars, harmony, and roles. |
| REMI+ | Bar-aware multi-track model input | Explicit bar, position, duration, and instrument structure | A task profile adds exact rational values, opaque IDs, and roles. |
| OctupleMIDI | Compound-event symbolic pretraining and understanding | One multi-field token per note | A task profile adds exact rational values, opaque IDs, harmony, and roles. |

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

All eight retained families passed their native task on both dated providers.
This includes the Strudel arm. Report native-purpose and Ghostnote round-trip
results separately.
