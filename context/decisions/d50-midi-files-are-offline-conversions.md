---
id: D50
kind: decision
state: active
updated: 2026-10-15
source: phase-8i16
---

# D50 — MIDI files are offline conversions

The operator requested two tools to convert filesystem MIDI to and from inline
Document 1.0. The first version returns complete documents. It adds no excerpts,
temporary document outputs, or analysis provider. See
[E265](../evidence/experiments/e265-inline-midi-file-conversion.md) and the
[file contract](../contracts/MIDI_FILE_CONVERSION.md).

1. `read_midi_file` and `write_midi_file` do not access Bitwig. A filesystem
   write is named in `file`, with `reversible: false`; `effects` stays empty.
   It has no project change ID or `revert_change` route. A failed verification
   read does not hide a completed file write.
2. Export creates a new file. An existing path refuses. This keeps the write
   tool outside the destructive replacement boundary. Publication is atomic.
3. Import preserves source beats by default. `targetBpm` preserves elapsed time
   through the source tempo map, then converts to target beats before R07
   normalization. Export `bpm` changes playback tempo without rescaling notes.
4. MIDI note-off pairing is FIFO within each track, channel, and pitch. The
   result names this rule and counts overlapping note-ons. A MIDI stream does
   not identify the intended voice. Refuse unmatched notes and normalized
   collisions. Export refuses note ends that cannot survive the pairing rule.
   Do not shorten notes to repair overlaps introduced by grid normalization.
5. Report source omissions and export losses. Export of unsupported nondefault
   document data requires explicit `acceptLoss`. Report metadata and release
   velocity rounding. Keep the public report compact.

The first export implementation refused all same-pitch overlaps. Four of the
six operator files then could not export: R07 normalization had introduced
small overlaps. FIFO pairing preserves their normalized note values on reimport.
This is a deterministic conversion convention, not a claim that every MIDI
player assigns overlapping voices in the same way.

The [8i17 survey](../plan/phase-8/8i17-midi-musical-navigation-survey.md) remains
separate. The operator will first evaluate unaided agent use and real token
cost. Provider surveys must test musical navigation before a compact overview
becomes a product promise.

## Snapshot coverage (8i18)

[E267](../evidence/experiments/e267-midi-snapshot-export.md) keeps snapshots
as observed documents. Require complete clip and channel coverage for the MIDI
fields, with an explicit field list permitted. Unobserved non-MIDI fields stay
unknown. Do not change the input to desired or claim `fields: "all"`. Existing
loss checks still apply to supplied nondefault values.

## Document files (8i19)

[D51](d51-document-file-paths.md) adds `documentOutputPath` to
`read_midi_file` and `documentPath` to `write_midi_file`. The inline document
stays the default. The file rules above also apply to document files.
