---
title: Phase 8i16 — Inline MIDI file conversion
kind: plan
state: done
status: Complete. E265 verifies both offline tools and all six operator files.
updated: 2026-10-14
parent: README.md
next: 8i17-midi-musical-navigation-survey.md
---

# Phase 8i16 — Inline MIDI file conversion

## Scope

The operator requested an isolated session before the 8i gate close-out.
Implement `read_midi_file` and `write_midi_file`. Return the complete imported
Document 1.0 FIELDS text inline. Do not add excerpts, temporary document files,
analysis libraries, or automatic Bitwig writes. The operator will test unaided
agent edits and actual token use. Plan the analysis survey separately in
[8i17](8i17-midi-musical-navigation-survey.md); it can run independently.

Read an absolute local MIDI path. Preserve beats by default. An optional
`targetBpm` maps elapsed time through the source tempo map to the supplied
constant tempo before R07 normalization. The operator's `good lies` files use
placeholder 60 BPM; the song is 120 BPM. Thus positions and durations double.
Keep leading silence, channels, note velocities, release velocities, track
names, and supported tempo and meter data. Use one document clip per musical
track. Report unsupported events. Pair note-offs FIFO within each track, channel, and
pitch; warn about overlaps. Refuse unmatched notes and normalized collisions. Do not infer musical structure or loop boundaries.

Write a complete inline FIELDS or JSON document to an absolute MIDI path.
Validate before mutation. Refuse an existing destination in this first version;
use a new filename. Publish a complete file atomically, verify its bytes, and
report that the filesystem write has no Ghostnote project change ID or revert.
Use 512 ticks per quarter note for exact realized note timing. Report metadata
rounding and require explicit acceptance of unsupported nondefault document data.

## Acceptance

- Support Standard MIDI File formats 0 and 1 with quarter-note tick timing.
  Refuse format 2, SMPTE timing, malformed or truncated data, unmatched note
  pairs, and bounded-resource violations with useful errors.
- Parse running status and velocity-zero note-off; preserve channels 1 to 16.
- Use exact source-time arithmetic. Test tempo changes inside held notes,
  60-to-120 conversion, onset floor, duration rounding, and collisions.
- Preserve supported note values through export and reimport. Stable inputs and
  options produce stable documents and MIDI bytes. Metadata loss is explicit.
- Complete output is inline, with no silent truncation or per-note diagnostic
  expansion. Limits are explicit. Test full output beyond 24,000 characters.
- Both tools make zero host calls and work without a live adapter.
- Test absent paths, existing files, symlinks, failed publication, and failed
  verification. A failed verification after publication keeps `applied: true`.
- Test the six operator files locally. Keep their note content outside the
  repository. Commit only generated fixtures and aggregate evidence.
- Update descriptions to v49, tool contracts, cohort tests, E265, the evidence
  index, and NOW. Run focused tests, full brain checks, context and diff checks.

## Cost model

No live path changes. Typical and maximum calls use zero host turns, zero cold
host reads, and zero host write stages. Import reads one local file. Export
writes one complete staging file, publishes it, then reads the destination.
These are local filesystem stages, not temporary document outputs.

Bound input at 8 MiB, 256 tracks, 262,144 MIDI events, and 16,384 notes.
The existing import report bounds overlap pairs at 131,072. Heap includes the
input, decoded notes, normalization report, document validation copies, and full
serialized response. Measure typical operator files and a 16,384-note generated
case. The host costs in the performance ledger remain unchanged.

## Retrospective target

Check whether conversion rules, metadata loss, and filesystem effects have clear
owners. Keep this session separate from musical-navigation claims.

## Result

[E265](../../evidence/experiments/e265-inline-midi-file-conversion.md) records
the acceptance, cost, and limits. [D50](../../decisions/d50-midi-files-are-offline-conversions.md)
sets the file-effect and timing rules. All six operator files and the generated
16,384-note case preserve normalized notes through export and reimport.
