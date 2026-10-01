---
title: External notation ranking for Phase 8c4f
kind: evidence
state: complete
updated: 2026-09-30
phase: phase-8-agent-native-live-engine
session: phase8c4f-extensible-matrix-and-external-probe
---

# External notation ranking for Phase 8c4f

This ranking weighs general notability and practical use. It does not rank
compactness or Ghostnote suitability alone.

1. **MusicXML 4.0.** It is the strongest practical interchange comparator. The
   W3C report states that more than 250 applications support MusicXML. It is an
   interchange control, not a compact agent-facing candidate.
2. **ABC 2.1.** ABC reports about 130 compatible programs and a large public
   tune corpus. It is the strongest compact, text-authored candidate in this
   review.
3. **LilyPond 2.24.4.** It is a stable, production text notation and typesetting
   system. It is more suitable for a full finite-score probe than mini-notation.
4. **TidalCycles and Strudel mini-notation.** It has substantial practical use
   in live coding, algoraves, workshops, and browser music. It ranks above Alda
   by practical cultural use. Its native model is cyclic and does not cover all
   finite identity tasks.
5. **Alda 2.4.7.** It is a real executable composition language with current
   packaging, but its practical user base is smaller.
6. **MIDI-like event tokens.** This is a broad model-engineering family, not one
   public notation standard.
7. **FIGARO REMI+.** It has research code and a demo, but little evidence of a
   musician-facing ecosystem.
8. **MusicBERT OctupleMIDI.** It is a model encoding for dataset and ML work. It
   is not a practical authoring or interchange notation.

The first probe uses ABC, LilyPond, and Strudel. MusicXML is omitted because it
tests verbose interchange rather than the text-format question. Strudel remains
in the probe because of its practical notability. Its result is labeled
composite and is not a native full-suite claim.

Sources:

- [MusicXML 4.0](https://www.w3.org/2021/06/musicxml40/)
- [ABC adoption](https://abcnotation.com/about)
- [abcjs uses](https://docs.abcjs.net/overview/purpose)
- [LilyPond 2.24 documentation](https://lilypond.org/doc/v2.24/Documentation/notation/)
- [Tidal showcase](https://tidalcycles.org/docs/showcase/)
- [Strudel mini-notation](https://strudel.cc/learn/mini-notation/)
- [Alda repository](https://github.com/alda-lang/alda)
- [FIGARO REMI+](https://github.com/dvruette/figaro)
- [MusicBERT OctupleMIDI](https://github.com/microsoft/muzic/blob/main/musicbert/README.md)

The former `one-cycle-mini` arm is a custom Ghostnote `cycle(...)` syntax. It is
not Tidal or Strudel mini-notation. The former MIDI-like, REMI+, and
OctupleMIDI arms are adapted rational profiles. New reports must name them as
profiles unless a pinned external dialect is implemented.
