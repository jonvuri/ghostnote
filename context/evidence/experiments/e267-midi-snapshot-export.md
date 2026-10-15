---
title: E267 — MIDI snapshot export
kind: evidence
state: done
updated: 2026-10-15
owner: phase-8i18
---

# E267 — MIDI snapshot export

## Result

[8i18](../../plan/phase-8/8i18-midi-snapshot-export.md) fixes issue D13 from
[E266](e266-inline-midi-operator-trial.md). `write_midi_file` accepts a normal
`read_launcher_clip` snapshot directly. It keeps the document kind and coverage.
It no longer validates the snapshot as a desired document.

Each clip must have complete coverage from zero to its length on all 16
channels. The covered fields must include `id`, `clip`, `at`, `duration`,
`pitch`, `velocity`, `channel`, `mute`, and `releaseVelocity`. An explicit list
is valid. Other fields can remain unobserved. Supplied nondefault fields and
loop metadata still need loss acceptance. Missing required coverage refuses
before publication, even with `acceptLoss: true`; a missing-field error names
the clip and fields and tells the agent not to change coverage to `all`.

No Document 1.0 codec or live adapter changes. Input validation still checks
all document invariants. Export removes one redundant full validation and adds
one coverage check per clip. The filesystem publication and verification code
are unchanged.

Descriptions are `ghostnote-description-v50`, 44 tools, fingerprint
`c4ab80749ce8a870c67b3198354ebd22508e2b0ef2d8e009c6f749c3fe19ba84`.
Only the MIDI writer description and document input description changed.
The [artifact](../data/phase8i18-midi-snapshot/descriptions-v50.json) records
the complete cohort; v49 remains frozen. The controller remains 8i15.

## Replay and cost

The [replay data](../data/phase8i18-midi-snapshot/replay.json) uses the original
three snapshot strings from rollout lines 190–192. Export supplies only a new
temporary destination, 110 BPM, and loss acceptance for the loop. It does not
rewrite document kind, coverage, notes, or other data. All three output hashes
match the trial's successful exports exactly. All readbacks are `verified`.
Generated MIDI files are removed after the run.

| Snapshot | Notes | Write and verify |
|---|---:|---:|
| Syncopated | 72 | 15.6 ms |
| Light | 92 | 10.9 ms |
| Driving | 100 | 10.3 ms |
| Generated sequential notes | 16,384 | 375.7 ms |

The maximum case used 35.8 MiB heap and 315.0 MiB RSS after export. These are
process snapshots, not peak memory. The largest note case is sequential; it
is not a worst-case overlap or metadata benchmark. E265's 16,384-note desired
export took 455.6 ms. This snapshot run removes a validation pass, but the
process state and input differ, so it is not a controlled speed comparison.
All cases use zero host calls, turns, cold reads, and host write stages.
No live path changed; no controller deployment or live rerun was required.

Reproduce from `brain/` with the trial's local rollout path:

```sh
node --expose-gc --import tsx src/probes/phase8i18-midi-snapshot.ts /absolute/rollout.jsonl
```

## Verification

Focused conversion and file-tool tests pass (29 tests). The new tool-to-tool
test creates a fake clip, calls the public Launcher reader, passes its unchanged
snapshot to the file writer, then compares reimported note values. It uses
channel 16 and a nondefault release velocity. The file tools have no workspace
access. Other new tests cover explicit field lists, missing fields, channels,
spans, partial or unavailable coverage, empty snapshots, multiple clips,
input immutability, and loss checks. Missing coverage cannot publish a file.

`npm run check` passes: TypeScript and all 2,357 tests. Context links and
`git diff --check` pass. The real snapshot replay above also passes.

## State and limits

No live project or operator MIDI file was changed. E266 records the last
observed `lie sword` state. The 8i gate close-out and 8i17 provider survey remain
separate planned work. Missing required coverage is deliberately strict; export
does not synthesize unknown MIDI values. Unobserved non-MIDI fields are not
claimed as observed or preserved.

## Retrospective

Test public tool pairs with the producer's actual coverage and defaults. A
full desired fixture does not test export of an observed snapshot. The new
integration test owns this boundary; no repository instruction change is needed.
