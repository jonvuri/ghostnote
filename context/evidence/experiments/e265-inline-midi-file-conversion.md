---
title: E265 — Inline MIDI file conversion
kind: evidence
state: done
updated: 2026-10-14
owner: phase-8i16
---

# E265 — Inline MIDI file conversion

## Result

[8i16](../../plan/phase-8/8i16-midi-file-conversion.md) adds `read_midi_file`
and `write_midi_file` to `agent-native-v1`. Read returns the complete Document
1.0 FIELDS text inline. Write creates and verifies a new MIDI file. Neither
tool accesses Bitwig. There are no excerpts, temporary document outputs, or
analysis libraries. The [contract](../../contracts/MIDI_FILE_CONVERSION.md)
and [D50](../../decisions/d50-midi-files-are-offline-conversions.md) specify
timing, note pairing, loss, and filesystem effects.

Descriptions are `ghostnote-description-v49`, 44 tools, fingerprint
`e379ac34a5c2f1b25e95c02e6ba42ad5f613b4bc43f94497532ff8ad12270a59`.
The [artifact](../data/phase8i16-midi-files/descriptions-v49.json) records the
cohort. The default server instructions distinguish project effects from file
writes. The stable profile and controller archive are unchanged.

## Conversion

The parser accepts SMF 0 and 1 with quarter-note tick timing. It bounds bytes,
tracks, events, and notes. It checks framing, running status, channel data,
and terminal end-of-track events. Format 2 and SMPTE division refuse.

Exact rational arithmetic integrates the source tempo map before the existing
R07 normalization. With `targetBpm: 120`, the operator's 60 BPM transcriptions
have twice the source beat positions and durations. Source beats remain the
default. A tempo change inside a held note uses both tempo intervals.

Onsets floor to 1/512 beat. Durations round to the nearest cell, ties up, with
a one-cell minimum. Import keeps leading silence and one clip per musical
track. Tempo and meter become declared overlays. Unsupported source events
are counted. No harmonic or arrangement claim is inferred.

Each note-off closes the earliest open note of the same track, channel, and
pitch. The report names this FIFO rule and warns about overlapping note-ons.
Unmatched notes and normalized address collisions refuse. Initially export
refused all same-pitch overlaps. This blocked four operator files because
normalization introduced small overlaps. Export now preserves FIFO-compatible
overlaps, including equal-end release order. Nested note ends and same-pitch
overlaps across tracks refuse. No note is shortened.

Export uses 512 PPQ with exact realized note timing. It checks global tempo
and meter compatibility, reports rounding, and requires `acceptLoss: true`
for unsupported nondefault document data. It validates before publication.
A private staging file is synced, then linked atomically to a new destination.
An existing path refuses. Verification failure retains `applied: true` and the
file identity. There is no project change ID or file revert.

## Operator files and cost

The [acceptance data](../data/phase8i16-midi-files/acceptance.json) records all
six local files and a generated 16,384-note case, with source/output hashes.
The driver imports at 120 BPM, exports, reimports, compares normalized note
values, and repeats the source import. All seven cases pass. All write
readbacks are `verified`. Original files are unchanged. Generated outputs
were removed. No personal note content is stored in the repository.

| Case | Notes | FIELDS bytes | Read ms | Write and verify ms |
|---|---:|---:|---:|---:|
| Large bass | 1,216 | 91,714 | 55.4 | 44.8 |
| Large voice | 153 | 11,916 | 6.6 | 12.2 |
| Large pad | 33 | 3,054 | 2.8 | 6.3 |
| Large drums | 1,567 | 116,430 | 59.6 | 54.9 |
| Medium bass | 1,682 | 126,871 | 66.4 | 59.1 |
| Medium drums | 1,485 | 110,375 | 52.1 | 50.8 |
| Generated maximum note count | 16,384 | 674,732 | 522.7 | 455.6 |

The maximum case returned 692,377 bytes including the envelope. Its heap after
import was 135.2 MiB and RSS was 423.5 MiB. Operator cases had 43.9–91.3 MiB
heap after import. These are process snapshots, not peak memory measurements;
the process also loaded the complete tool surface. The generated case has
sequential notes. It is not a worst-case dense overlap or metadata benchmark.

All cases use zero host calls, turns, cold reads, and host write stages, as
planned. Existing live-path costs do not change. There is no host primitive
comparison or live rerun for this offline path. The accepted bounds are 8 MiB,
256 source tracks, 262,144 MIDI events, and 16,384 notes; Document 1.0 bounds
also apply. No extension deployment is needed.

Reproduce from `brain/`:

```sh
node --expose-gc --import tsx src/probes/phase8i16-midi-files.ts '/Users/jonvuri/Dropbox/ghostworks/shards/good lies'
```

## Verification

Synthetic tests cover exact timing and normalization, held-note tempo changes,
all channels, running status, velocity-zero note-offs, FIFO release order,
metadata conflicts, loss acceptance, malformed input, and size limits.
Filesystem tests cover absent paths, symlinks, existing destinations, concurrent
publication, publication failure, and failed or differing verification reads.
MCP registration returns the full document beyond 24,000 characters. The new
call-budget case proves zero host calls for both tools.

`npm run check` in `brain/` passes: TypeScript and all 2,351 tests.
`LANG=en_US.UTF-8 ruby context/check.rb` passes: 611 active documents and
intact links. `git diff --check` passes. The six operator files and the
maximum-note fixture pass the acceptance driver.

## Limits and next work

This conversion does not apply sustain or controller effects to note lengths.
MIDI has no note identity; FIFO is a stated convention. Strict malformed-file
refusals do not attempt recovery. Export refuses replacement and cannot encode
all document fields. Client result truncation remains outside the tool's full
output guarantee. No agent trial or actual client token measurement was run.

The separate [8i17 plan](../../plan/phase-8/8i17-midi-musical-navigation-survey.md)
records earlier provider findings and reopens the survey for musical navigation.
It includes the unaided full-document baseline and real client token accounting.
The 8i gate close-out remains a separate planned session.

## Retrospective

Use real transcription fixtures before fixing an overlap policy: independent
onset and duration normalization can create overlaps. When a tool is added,
check the server list, profile inventory, and document-help consumer tests
before freezing its description fingerprint. This session adds those checks;
no repository instruction change is needed.
