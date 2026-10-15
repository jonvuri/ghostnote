---
title: E266 — Inline MIDI operator trial
kind: evidence
state: done
updated: 2026-10-15
owner: phase-8i18
---

# E266 — Inline MIDI operator trial

## Scope and source

The operator requested review and registration of the MIDI work in
thread `codex://threads/01a13aa5-5bb9-7e42-a526-77de86bc1f2a`.
It ran on 2026-10-14 with descriptions v49. Ghostworks operations are outside
this record. This is an operator trial, not an automated 8i12/8i13 fixture run.

The [extract](../data/phase8i18-midi-snapshot/trial.json) stores MIDI call
arguments without note content, result summaries, durations, and original
rollout line numbers. It identifies and hashes the local rollout. Large source
results in that log are truncated; the extract marks them. The scripts had the
full result in memory. No source note content is copied into the repository.

## Task and result

The agent extracted three distinct four-bar drum grooves from the large
`good lies` transcription and put them on track 1, scenes 1–3, in `lie sword`.
It read the 1,567-note source once with source beats, then used `targetBpm: 126`
after a pulse estimate. The operator chose playback at the project's 110 BPM.
The agent selected source bars 5–8, 23–26, and 41–44. It mapped kick 35 to 36.
The operator verified the clips, moved the snares from 38 to 37, and saved.

The later export task read the three current Launcher clips. It wrote
`good lies/extracted-drums/syncopated.mid`, `light.mid`, and `driving.mid`.
All three write readbacks were `verified`; a separate reimport compared their
note rows. The [independent check](../data/phase8i18-midi-snapshot/independent-check.txt)
used a separate raw SMF decoder. It confirms:

| File | Notes | Size | Source bars | Result |
|---|---:|---:|---|---|
| `syncopated.mid` | 72 | 674 bytes | 5–8 | Exact snapshot notes and matching file hash |
| `light.mid` | 92 | 815 bytes | 23–26 | Exact snapshot notes and matching file hash |
| `driving.mid` | 100 | 880 bytes | 41–44 | Exact snapshot notes and matching file hash |

Each file has 512 PPQ, an end at tick 8,192 (16 beats), and tempo 545,455
microseconds per quarter (approximately 110 BPM). Notes match the source spans
under the 126 BPM conversion and the two pitch mappings. Durations, channels,
velocities, release velocities, and timing offsets match. The first onsets are
0.0859375, 0.09375, and 0.08203125 beat after the selected bar origin.

Only loop metadata was omitted, with explicit `acceptLoss`. Tempo rounding
was reported. The output is one four-bar pass; MIDI does not carry the clip's
loop behavior. This record does not judge Ghostworks asset registration.

## P2: snapshot export mismatch (issue D13)

At rollout line 200, `write_midi_file` refused the valid snapshot from
`read_launcher_clip`: R03, `desired coverage must contain complete state`.
The reader declared the fields it observed. Export changed `kind` to `desired`
before validation, so the omitted articulation and repeat fields caused refusal.

At line 205 the agent changed the document to `desired` and coverage to `all`.
This passed the coverage check. Line 207 then refused the loop loss as expected;
lines 214–216 exported after acceptance. The workaround did not change notes,
but an agent must not need to claim unobserved fields to export a snapshot.
The operator authorized the fix in [8i18](../../plan/phase-8/8i18-midi-snapshot-export.md).
[E267](e267-midi-snapshot-export.md) records the fix and direct replay.

## Cost and agent method

There were seven MIDI reads and five MIDI write attempts. Two writes refused
before mutation: the snapshot mismatch and the expected loop-loss check.
The full drum reads took 83.8–99.3 ms; the bass comparison read took 159.0 ms.
Successful file writes took 16.6–28.5 ms. Export verification reads took
12.2–28.1 ms. These are MCP tool durations, not whole script or model latency.
The four-bar exports are much smaller than the full source.

The source FIELDS document was about 116 KB. The agent stored the complete
result in `functions.store`, parsed note rows in JavaScript, and printed a
short head, pitch counts, per-bar counts, and selected onset patterns. It did
not send every source note to model context. It also generated timing claims
in JavaScript; their full text stayed in stored documents. This is evidence
for agent-written analysis on one drum extraction task, not proof that a
summary can identify arbitrary arrangement roles.

Avoidable work included repeated broad tool-catalog output, a repeated drum
read, and the snapshot repair. The operator added narrower tool-discovery
instructions during the trial. The whole-thread token counters include
Ghostworks, computer use, discovery, and repeated cached context. They cannot
be assigned to MIDI conversion alone. No isolated billed-token comparison is
claimed. The [8i17 survey](../../plan/phase-8/8i17-midi-musical-navigation-survey.md)
will keep this trial as an unaided-agent example.

## Tempo and limits

The earlier implementation session used the operator's 120 BPM estimate.
This trial inferred 126 BPM. A raw-MIDI hat-grid check gives normalized
sixteenth-note coherence 0.894 at 126 BPM and 0.065 at 120 BPM. This supports
the agent's choice for these transcription coordinates; it is not an audio
tempo measurement. Future comparisons must fix the source tempo explicitly.

The review did not reread the live project or audition audio. The last trial
read had three 16-beat clips with the operator's snare corrections. Preserve
them and the exported files. Check current project and selection before live
work. This registration makes no project or filesystem music change.

## Retrospective

A producer-to-consumer test would have caught the field-coverage mismatch.
Use a real Launcher read result in the MIDI export regression test. Keep
rollout logging truncation separate from the full result stored by the agent.
