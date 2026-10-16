---
title: MIDI file conversion
kind: contract
state: active
updated: 2026-10-15
parent: ../plan/phase-8/8i16-midi-file-conversion.md
evidence: E265, E267, E269
---

# MIDI file conversion

`read_midi_file` and `write_midi_file` are offline tools in `agent-native-v1`.
They use the existing Document 1.0 codec. They make no Bitwig call and need no
controller replacement. Source: `brain/src/midi/` and
`brain/src/surface/midi-files.ts`. Conversion version: `midi-document-v1`.

## Read

Input: an absolute `path`, optional `targetBpm` greater than zero and at most
1000, and optional `documentOutputPath`. Output: `ghostnote-midi-file-read/1`,
with the full FIELDS desired document in `data.document`, a content hash, and
`data.report`. With `documentOutputPath`, the tool writes the same document to
that new file. `data.documentFile` then replaces `data.document` and
`data.documentBytes`. See [Document files](#document-files).

```json
{"path":"/music/bass.mid","targetBpm":120}
```

Without `targetBpm`, source ticks divided by ticks per quarter note give beats.
With it, integrate elapsed seconds through the source tempo map, then multiply
by `targetBpm / 60`. Convert onset and note end independently through that map;
subtract to get the source duration. Apply the existing R07 onset floor and
nearest-duration rules once. A file encoded at 60 BPM needs `targetBpm: 120`
when one encoded beat represents one second of a 120 BPM song. This doubles
beat positions and durations. It does not infer tempo, meter, or a downbeat.
The MIDI default tempo is 120 BPM when no source tempo exists at tick zero.

Each musical track becomes a clip, with stable source-order IDs, its end-of-track
length, name, channels, pitches, velocities, and release velocities. Keep leading
silence. A conductor-only track does not become a musical clip. A wholly empty
file yields one empty clip. A named empty non-conductor track stays a clip.
No loop or play range is inferred. Tempo and meter become declared overlays;
these are file metadata, not harmonic analysis. A target tempo replaces the
source tempo map in the document. The report keeps the original tempo map.

Note-offs close the earliest open note with the same track, channel, and pitch
(FIFO). MIDI has no note ID. Count overlapping note-ons and warn when this rule
is needed. A velocity-zero note-on is a note-off with conventional release
velocity 64. An unmatched note-off, an unclosed note, or a zero-duration note
refuses. A normalized address collision refuses with source IDs; no winner is
selected and no note is shortened.

Unsupported source events are counted in `report.ignored`. This includes program
changes, CC (including sustain), pitch bend, pressure, SysEx, and unmapped meta
events. Sustain does not extend note duration. A nonzero MIDI port refuses.
Track text uses UTF-8; invalid UTF-8 uses Latin-1 with a reported conversion.
Meter click fields are reported when not the exported defaults of 24 and 8.
Meter values outside Document 1.0 limits refuse. Source tempo over 1000 BPM
requires a target tempo. Metadata outside all retained clip spans is reported.

The public normalization report has counts, not a row for each note or overlap.
The pure converter retains the full R07 report in `normalization` for inspection
and tests. The tool returns no excerpt or summary-only mode. It does not
truncate the document. Client output limits are outside this conversion
contract; `documentOutputPath` keeps the document out of the result.

## Write

Input: an absolute new `.mid` or `.midi` `path`, exactly one of inline
`document` and `documentPath`, optional `format` (`fields` by default, or
`json`), optional `bpm`, and optional `acceptLoss` (false by default). Native
JSON objects require `format: json`. `format` describes only the inline
document; with `documentPath` it refuses, because the file content sets the
encoding.
Accept complete desired documents and snapshots from `read_launcher_clip`.
Keep the snapshot kind and coverage unchanged. Each clip needs complete coverage
from zero to its length on all 16 channels. An explicit field list must include
`id`, `clip`, `at`, `duration`, `pitch`, `velocity`, `channel`, `mute`, and
`releaseVelocity`; `fields: "all"` also qualifies. Other fields can remain
unobserved. Supplied nondefault fields still follow the loss rules below.
Missing required coverage refuses even with `acceptLoss`. Do not change coverage
to `all` to bypass an unknown value. Refuse patches. All clips start at the same
file origin. See [E267](../evidence/experiments/e267-midi-snapshot-export.md).

Write SMF format 1, one track per clip plus the conductor track, at 512 ticks per
quarter note. Realized note timing is exact. Export current tempo and meter
maps when compatible across clips. Missing tempo at zero uses 120 BPM. `bpm`
overrides tempo without changing beat positions; replacing a supplied tempo map
requires loss acceptance. Metadata positions round to the nearest tick, ties up.
Tempo rounds to integer microseconds per quarter; release velocity rounds to
0 through 127. Report these conversions in `report.rounding`.

A FIFO-compatible same-pitch overlap is preserved. A nested end order or a
same-pitch overlap across tracks refuses. Equal-tick note-offs precede note-ons;
equal-end note-offs keep onset order, including their release velocities.

Unsupported nondefault event fields, non-tempo/meter overlays, stale overlays,
loop/play ranges, document metadata, and extensions require `acceptLoss: true`.
The refusal lists `detail.losses`. Accepted muted or zero-velocity notes are
omitted. A note tail past clip length extends the MIDI track and is an explicit
loss. Export does not render repeats, chance, expression, or interpretive claims.
Document IDs and overlay provenance are not MIDI identities.

## Document files

[D51](../decisions/d51-document-file-paths.md) adds document files to the
document tools. `documentPath` replaces inline `document` in
`add_launcher_clip`, `edit_launcher_clip`, and `write_midi_file`; exactly one
is required. `documentOutputPath` adds a file output to `read_launcher_clip`
and `read_midi_file`. Paths are absolute on the server filesystem.

Input files are regular files with no symbolic link, at most 8 MiB (R28), and
valid UTF-8. Detect the encoding from the first record after leading white
space: `DOC` and a space or tab is FIELDS; `{` is JSON. Other content refuses
with `invalid-input`. The codec then applies all R11 rules, including the BOM
refusal. Codec errors keep their rule, line, and repair. For the clip writers,
`format` then sets only the encoding of returned documents. The write result
has `documentFile`: path, detected format, bytes, and SHA-256.

An output file must not exist, and its parent must exist. The tool checks this
before any MIDI read or host call; a refusal is `occupied` or `invalid-input`.
Publication uses the same staged, atomic no-replace link as MIDI export, then
an independent read compares the bytes. `data.documentFile` has path, format,
bytes, SHA-256, and `readback.status`: `verified`, `differs`, or
`unavailable`. An empty Launcher slot writes no file. A document file has no
change ID and no revert.

The recommended names are `.gndoc` for FIELDS and `.gndoc.json` for JSON. The
tools do not check names. `.gn` is avoided: GN build files use it.

## Filesystem and result

Use paths on the Ghostnote server filesystem. Read regular files only; source
symlinks refuse. Read bounds and file size checks prevent unbounded reads.
The output parent must exist. An existing output path, including a symlink,
refuses with `occupied`. There is no overwrite option.

Validate before writing. Write and sync a private staging file in the destination
directory, then publish with an atomic no-replace hard link. Remove staging data.
This staging file is internal; it is not a temporary document output.

The write result is `ghostnote-midi-file-write/1`. `file` holds path, SHA-256,
byte count, and `reversible: false`. `effects` is empty: there is no project
change ID and `revert_change` cannot undo the file write. An independent read
checks the bytes. A successful read with different bytes gives `differs`. A
failed read gives `unavailable` and a warning, while `applied` stays true. Do not
repeat an applied write because verification failed. See
[D50](../decisions/d50-midi-files-are-offline-conversions.md).

## Limits and checks

Input/output byte limit: 8 MiB. Note limit: 16,384. Source track limit: 256;
export clip limit: 255 plus the conductor. MIDI event limit: 262,144. Document
limits still apply, including 32,768 overlays and 131,072 overlap pairs in each
normalization comparison. A refusal returns no partial document or output file.
Format 2, SMPTE division, malformed framing, oversized deltas, and unsupported
metadata values refuse. Running status ends at a meta or SysEx event.

Synthetic tests cover parsing, exact conversion, FIFO pairing, export loss,
metadata conflicts, malformed data, limits, filesystem races at publication,
verification failure, and complete MCP output. Run the local acceptance driver:

```sh
cd brain
node --expose-gc --import tsx src/probes/phase8i16-midi-files.ts /absolute/midi/directory
```

The driver uses 120 BPM, verifies round trips and repeatability, and deletes its
generated MIDI outputs. It prints only aggregate measurements and hashes. The
operator's source files are not changed or copied into the repository.
