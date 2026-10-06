---
title: E231 — Change awareness without a resident grid
kind: evidence
state: done
updated: 2026-10-06
owner: phase-8h3d
---

# E231 — Change awareness without a resident grid

## Status

[8h3d](../../plan/phase-8/8h3d-change-awareness.md) is complete. The
selected design for [8h3e](../../plan/phase-8/8h3e-cache-machinery-trim.md)
is **pull only**. Pull detected every test edit. Clip-level values reported
no note edit. Watched clips also detected every note edit, but they save only
latency, not agent work. All research replies keep `complete:false` and
`eligible:false`.

The session also found a product reader defect: the 8h3c reader does not
bind a requested row other than the row that its cursor holds for that track.
The bound-target check refuses each mismatch, so no wrong data is published.
[8h3c2](../../plan/phase-8/8h3c2-reader-row-binding.md) fixes it before 8h3e.

## Method

The research build adds `ChangeWatchProbe` (marker `8h3d-watch-v1`) to the
probe profile when the rig config sets `changeWatchCursors`. It adds no bridge
method: the probe profile keeps 100 methods and hash `4232fd6c9f325749`.
`cache.shadow` operations `watch*` drive it.

- **Candidate 3, watched clips.** Each of 32 watches is one cursor at the
  reader width and grid, 4,194,304 steps at `1/512` beat. It binds by the 8h3c
  route: master park, subscribe, select the row, point, and close at the D30
  task. It refuses a callback before its confirmation, a second batch, a
  duplicate cell, or a different bound target. After the confirmation it
  stays subscribed. Each later note-step callback is a change (D26). A bind
  holds a write-gate lease, so a clip read waits for it.
- **Candidate 2, clip-level values.** One cursor binds the clip with a
  one-cell view and no note-step observer. It records callbacks of 13 clip
  values (`exists`, loop start and length, play start and stop, loop enable,
  shuffle, accent, color, and four scroll flags) and 6 slot values (`name`,
  `color`, `hasContent`, `isPlaying`, `isRecording`, `isPlaybackQueued`). The
  flat-bank `hasContent` observer is counted by the rig content epoch.
- **Pull fingerprint.** `pull-fp-v1` is a SHA-256 of every raw note field,
  sorted by channel, cell, and pitch, plus the bound loop start, loop end, and
  play stop. It excludes read IDs, timings, and callback counts.

The research rig config had 96 tracks, 16 scenes, the knee fixture writer at
4,194,304 steps, and 32 watches. The owned project was `New 2`. The E227
fixtures used the even-spread writer without decoration. **Typical density** is
16 bars with 256 notes, one every 1/4 beat, each 1/8 beat long, on all 16
channels: 16,321 sounding cells. The last note ends at the clip end.

Ghostnote edits used the research writer: add a note, delete it, change a
velocity, and move a note start by one `1/512` cell. An executor `note.insert`
tested the product write path. The operator moved one note in the Bitwig
editor. A loop-length change was the positive control for clip-level values.
Every edit ran while no agent call was in progress, except the gate case.

## 1. Pull

### One clip at each E227 size

Three reads per fixture. Each read matched every declared note. The three
fingerprints of each fixture were equal.

| Fixture | Notes | Wall, ms (three reads) | Response bytes |
|---|---:|---|---:|
| `empty-64` | 0 | 203, 192, 191 | 4,061 |
| `one-64` | 1 | 210, 241, 219 | 4,175 |
| `final-8192` | 1 | 215, 236, 244 | 4,161 |
| `n4096-64` | 4,096 | 224, 239, 214 | 50,705 |
| `n16384-512` | 16,384 | 215, 188, 207 | 181,658 |
| `n4096-8192` | 4,096 | 185, 183, 194 | 50,567 |
| `n131072-2048` | 131,072 | 603, 633, 620 | 1,404,999 |
| `sustain-2048` | 16,384 | 329, 296, 330 | 181,646 |

Wall time includes track lookup, capture, and all pages. The bytes are higher
than E230 for equal note counts, because these fixtures vary pitch, channel,
velocity, and duration.

### Surveys

Each survey reads every clip once and compares its fingerprint with a
baseline. Two clips were edited between the baseline and the third pass: a
velocity edit on the first and a `1/512` nudge on the last.

| Clips | Baseline | Current pass | After edits | Stale found |
|---:|---:|---:|---:|---|
| 16 | 3.51 s | 3.40 s | 3.47 s | exactly the two edited clips |
| 64 | 12.79 s | 12.72 s | 12.87 s | exactly the two edited clips |

This is about 200 ms per clip of typical density. The current pass found no
stale clip.

### Agent cost

A survey is one tool call in both outcomes. A size proxy for its result is
one reference, fingerprint, and verdict per clip, plus compact note rows
only for a stale clip:

| Clips | All current | Two stale |
|---:|---:|---:|
| 16 | 2,055 bytes | 11,922 bytes |
| 64 | 8,247 bytes | 18,114 bytes |

A stale clip needs a new snapshot before a patch with either design. This
proxy is not the 8h4 format.

## 2. Edit matrix

The edit clip is `gn-8h3d-edit` row 0, at typical density. Watch 0 and the
values cursor observed it through all cases.

| Edit | Pull | Watch | Edit to stale | Watch callbacks | Value observers |
|---|---|---|---:|---:|---|
| None (control) | current | current | — | 0 | none |
| Add | stale | stale | 66 ms | 16 | none |
| Delete | stale | stale | 37 ms | 16 | none |
| Velocity | stale | stale | 41 ms | 64 | none |
| `1/512` nudge | stale | stale | 40 ms | 3 | none |
| Executor `note.insert` | stale | stale | 1,370 ms | 128 | none |
| Bitwig editor move (operator) | stale | stale | — | 128 | none |
| Loop length 64 → 32 beats | stale | current | — | 0 | `clip.loopLength` |

- Edit-to-stale time is from the edit request to the first change callback,
  on the brain clock. The executor time starts before its preflight read and
  includes its write and verification read.
- The operator moved a MIDI channel 11 note (host channel 10, pitch 94) from
  cell 11,564 (beat 22.59, near 6.3.3) to cell 11,948 (beat 23.34, near
  6.4.2). The decoded diff contained only that note.
- No clip, slot, or flat-bank value reported any note edit, including the
  sub-cell nudge. Loop and length changes reach `clip.loopLength`, but not the
  note-step observer (also E226). Do not test clip-level values for note
  change awareness again.
- A product read of the watched clip added no watch callback. Each case's
  count before its mark equals the prior case's final count. Before the
  executor case, a clear of an earlier run's note added 128 callbacks; that
  was an edit, not a read.

### Write during a read of a watched clip

A velocity write sent during an open read waited 173 ms in the write queue.
The read returned the prior velocity, 64. The next read had the new velocity,
105, and a different fingerprint. The watch marked the change 221 ms after
the write request, after the read closed. Gate order and watch detection agree.

## 3. Watched clips

Each count bound watches to that many typical clips, one per track, at row 0.
Heap is the live set from `jcmd GC.class_histogram`.

| Watches | Live heap before → watching → released | NoteSteps added | Bind median / max | Ping p95 before / watching | Edit to stale |
|---:|---|---:|---|---|---:|
| 1 | 377 → 382 → 377 MiB | 16,321 | 240 / 240 ms | 25.1 / 25.1 ms | 43 ms |
| 8 | 377 → 416 → 381 MiB | 130,568 | 166 / 239 ms | 25.0 / 25.0 ms | 40 ms |
| 32 | 381 → 535 → 396 MiB | 522,272 | 166 / 243 ms | 25.1 / 24.7 ms | 24 ms |

- Heap is one `NoteStep` per sounding cell: about 300 bytes per cell, or
  4.8 MiB per typical clip. A 1 M-cell clip costs about 300 MiB (E226).
- Release returned the `NoteStep` count to its baseline of 826 each time.
- Idle watches did not change ping latency.
- Only the edited watch became stale. A read of a watched clip did not mark it.

## Selection: pull only

Select **pull only** for 8h3e. Keep `ChangeWatchProbe` as research.

Watched clips save no measurable agent work in the realistic workflows:

- **Repeated patches in one session.** Every executor write already reads
  its write set before the first write (the stash read). 8h3e can compare the
  fingerprint of that read with the snapshot fingerprint, with no extra tool
  call. A watch can only skip a read that the write path does anyway.
- **Project survey.** Both designs need one tool call. Both need a new
  snapshot for each stale clip, so the result size is the same. Watches save
  only latency: about 200 ms per typical clip, 12.8 s for 64 clips. A survey
  is an occasional orientation step, not an inner loop.
- **Cost and risk.** A watch holds about 300 bytes per sounding cell while it
  is open, and needs a budget, a release rule, identity checks after project
  change, and the bind route. That route has the row defect below. Pull is
  correct by construction if the reader is correct, and it holds nothing.

Reconsider watched clips only if 8i dogfood shows that survey latency limits
ordinary work. The measured costs above are the starting point.

### Snapshot lifetime and the stale verdict

- A snapshot is the decoded clip read with its `pull-fp-v1` fingerprint and
  the clip reference (8h3e identity). It has no time limit. It stays a valid
  base until a read at use time gives a different fingerprint, or the
  identity domain changes.
- At use time Ghostnote reads the clip again. Equal fingerprints: the
  snapshot is current, and the patch applies against it. Different
  fingerprints: the snapshot is stale. The agent receives a stale verdict with
  the new snapshot, and must rebase or confirm before a write. Ghostnote never
  applies a patch to a stale base.
- A survey returns one verdict per clip and the new snapshot only for stale
  clips.
- Clip extent is part of the fingerprint, so a loop or length change also
  makes a snapshot stale.

## Reader row finding

The product reader refuses every read of a row other than 0 on tracks with
more than one clip. It reports `bound-target-mismatch` with bound row 0, in
four entry selections, including the target row itself. A distinct row-1
clip proves a real bind of row 0: the read had 4 callbacks and a 64-beat loop,
not the 8-beat row-1 clip. Single-clip tracks read correctly.

The watch probe uses the same route. On one track it bound row 1 for every
request, row 0 or row 1. On the single-clip edit track it bound row 0
correctly. The bound row therefore follows host state for each cursor and
track. A `selectSlot` call in the same task before the point does not control
it. E228 read rows 1 and 63 with a different park track. E230 read only
row 0. The cause is not yet identified. A slot-less master park is one
candidate. The guard holds: no mismatch was published.

The first survey layout used four 16-row tracks and stopped at this
refusal. The surveys and watches above use 64 single-clip tracks at row 0.
`fixtures-first-attempt.log` retains the first fixture run; it also stopped
once on a call-stack overflow in the driver, fixed before the retained runs.
One loop of both surveys failed with no retained output; the retained surveys
are separate later runs.

## Artifacts and restoration

Data is in [phase8h3d-change](../data/phase8h3d-change/).
`brain/src/probes/phase8h3d-change.ts verify-offline <dir>` checks every claim
above from the retained artifacts. `phase8h3d-change.test.ts` runs it.
Brain check passes 1,894 tests, including seven new 8h3d tests. Extension
check passes. Both logs are retained. `config-entry-32-tracks.json` is the first research config; the 96-track config
in `config-entry.json` supplied the surveys and watches.

The driver deleted all 81 owned tracks. The four original owned-project track
IDs matched. The reader was closed, and the write gate had no open read,
waiting request, or lease. The operator closed `New 2` without saving and
restored the normal controller. The original rig config is restored (SHA-256
`256bbf07…43b0`). The research archive is removed.

Fresh normal hello passes `normal-v1`, 87 methods, hash `ca139a3e62a55e68`,
`clip-reader-v1`, and `confirm-before-release-v1`. Initialization is
`2026-10-06T03:18:15.343Z`, after deployment. The normal archive SHA-256 is
`4ce50cd267c3b61fb1dc3af56eb7794ff7ab40f9f74fca85e697b4ddb4e4f1bc`. It differs
from E230 because the jar now contains the research class; only the probe
profile allocates it. The anchor `gn-scale-test` matches all ten track IDs of
the E230 baseline (`baseline.json`).
