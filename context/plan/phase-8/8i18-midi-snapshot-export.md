---
title: Phase 8i18 — MIDI snapshot export
kind: plan
state: done
status: Complete. E266 records the trial; E267 verifies direct snapshot export.
updated: 2026-10-15
parent: README.md
prev: 8i16-midi-file-conversion.md
---

# Phase 8i18 — MIDI snapshot export

## Source and scope

The operator requested registration of the MIDI trial in thread
`01a13aa5-5bb9-7e42-a526-77de86bc1f2a` and a fix for its P2 finding.
Register the MIDI work only. Leave Ghostworks operations outside this record.
The [8i16 contract](../../contracts/MIDI_FILE_CONVERSION.md) promises export
of complete snapshots. The normal Launcher reader returns explicit observed
fields; export changes the snapshot to `desired`, then rejects that field list.
The trial agent changed the coverage to `all` to pass the check.

Keep snapshots as snapshots. Require complete coverage of each clip from zero
to its length, all 16 channels, and each MIDI note field: `id`, `clip`, `at`,
`duration`, `pitch`, `velocity`, `channel`, `mute`, and `releaseVelocity`.
Do not infer unobserved fields or change the input coverage. Keep the existing
loss checks for supplied nondefault data. `acceptLoss` cannot bypass missing
required coverage. Do not change the Document 1.0 codec or a live path.

## Acceptance

- Record the trial as E266 with a bounded extract, original rollout line
  references, MIDI call costs, the independent file checks, and the P2 issue.
- A normal `read_launcher_clip` result exports directly, without document edits.
  Compare the saved MIDI note values with the snapshot in a tool-to-tool test.
- Test explicit field coverage, missing release velocity, partial status,
  incomplete spans or channels, empty clips, and multiple clips. Missing
  required coverage refuses before any file publication, even with `acceptLoss`.
- Keep loss acceptance for loops and supplied nondefault fields. Keep desired
  input, source import, and file publication behavior unchanged.
- Replay all three trial snapshots offline to temporary MIDI files. Check their
  bytes against the trial outputs. Do not access or change the live project.
- Run focused tests, the full brain check, context and diff checks. Update the
  contract, description version and artifact, E267, indices, and NOW. Stage only
  session changes; do not commit.

## Cost

Zero host calls, turns, cold reads, or host write stages. Add one coverage check
per clip and remove the second full document validation. Typical input is a
72–100-note snapshot from E266. The largest admitted note count remains 16,384;
measure both cases offline. Local export still stages, publishes, then verifies
a file. No extension deployment or live performance rerun is needed.

## Retrospective target

Check the boundary between public tools with the producer's actual output.
Do not substitute a hand-written full desired document for a read snapshot.

## Result

[E266](../../evidence/experiments/e266-inline-midi-operator-trial.md) registers
the operator trial and issue D13. [E267](../../evidence/experiments/e267-midi-snapshot-export.md)
records the fix, direct tool-pair test, unchanged snapshot replay, and cost.
All three replayed snapshots produce the trial's exact MIDI bytes.
