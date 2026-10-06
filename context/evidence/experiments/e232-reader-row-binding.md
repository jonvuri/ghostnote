---
title: E232 — Reader row binding
kind: evidence
state: done
updated: 2026-10-06
owner: phase-8h3c2
---

# E232 — Reader row binding

## Status

[8h3c2](../../plan/phase-8/8h3c2-reader-row-binding.md) is complete. The
product reader now binds the requested row on tracks with more than one clip.

**Cause.** The close pins the reader clip on its target track. The release
unsubscribes the clip. The next open sent the unpin while the clip was
unsubscribed, and the host did not apply it. The clip stayed pinned. Each
later visit to that track bound the pinned row. The pin stayed after a
controller reload.

**Fix.** The open task now subscribes on the prior target, removes the clip
and track pins, and then goes to park. The D30 close, confirmation, and
release order, the E99 lease, and the bound-target guard are unchanged. The
adapter retries one time after a row mismatch on the requested track. This
removes a pin that an earlier build left. The new build marker is
`openRule: subscribe-before-unpin-v1`.

## Method

The owned unsaved project was `New 3`, with 64 scenes. A row track has a
distinct clip in each of rows 0, 1, and 63. Each clip has its own length,
MIDI channel, start, and pitch:

| Row | Length | Note |
|---:|---:|---|
| 0 | 4 beats | channel 1, pitch 60, beat 0 |
| 1 | 8 beats | channel 2, pitch 61, beat 0.25 |
| 63 | 12 beats | channel 3, pitch 62, beat 0.5 |

The E131 fine cursor wrote each clip. That route points first and then
selects the slot.

A matrix reads all six orders of the three rows. Each order runs from three
entry selections: another track at row 0, the target slot, and another
populated row of the target track. Each of the 18 sequences uses its own
track. A second pass reads the same tracks again: 108 reads. A read passes
only when it binds the requested track and row, returns exactly the declared
note, keeps the D30 capture rules, and restores the slot track, slot row, and
mixer track.

The research build added probe-only routes to `clip.read` and a trace of
cursor values (`research-routes.patch.gz`). Each run changed one variable. The
driver is `brain/src/probes/phase8h3c2-rows.ts`.

## 1. Reproduction

On each track, the product route bound the row of its first read. Every later
read of another row refused with `bound-target-mismatch` and bound that first
row. The entry selection did not change the result. A controller reload kept
the same rows. Of the 108 reads, 72 refused. One more read failed only its
selection restore (see Open observation). No refused read published notes.

## 2. Candidates from the plan

All candidates ran on the same tracks. Each one gave the same stuck rows and
36 of 108 passing reads:

- Select the row one task before the point.
- Park on an owned track that has launcher slots, not on the master track.
- Point, then select the row through the reader cursor track, in the same task
  or one task later.

Three more candidates also failed in the same way: wait 100 ms after the
subscribe; point at the target while unsubscribed, select the row, and then
park; and the same with a subscription.

## 3. Cause

The rig fine cursor followed each row on the same tracks through the reader
cycle: pin, master park, select the row, and point in one request. The reader
differs in one step: it unsubscribes at release, and the next open unpins
while unsubscribed.

The trace shows the dropped unpin. At open, the local `clipPinned` value is
false after the unpin. After a subscribe on the prior target, the host
reports `clipPinned=true` (107 of 108 reads). A later `set(false)` with an
unchanged local value sends nothing. The pin belongs to the clip on the target
track: an unpin at the park track did not release it.

## 4. Fix candidates

| Candidate | Passed | Result |
|---|---:|---|
| Subscribe on the prior target, then unpin and park one task later | 108 | +45 ms park |
| **Subscribe, unpin, and park in the open task** | 108 | **selected** |
| Unpin at the park track after subscribe | 36 | no effect |
| Park, subscribe, and unpin in the open task | 36 | no effect |
| Unpin before unsubscribe at release | 6 | correct row; replay after release, `step-delta` |
| Unpin after the point in the bind task | 17 | correct row; old and new clips in one batch, `duplicate-cell` |
| Pin only the track at close | 74 | the close restore of another row on the target track moves the clip, `step-delta` |

The selected route keeps the D30 order. The prior clip replays once when the
open task subscribes. These callbacks go to no capture and arrive before the
park check. The reply reports them as `unpinCallbacks`.

### Cost of the prior-clip replay

| Prior clip | Route | Reads | Stray callbacks | Park, median | Wall, median |
|---|---|---:|---:|---:|---:|
| Typical, 16,384 cells | before fix | 32 | 0 | — | 218.2 ms |
| Typical, 16,384 cells | selected | 32 | 65,536 | — | 218.7 ms |
| 1,048,576 cells | before fix | 6 | 0 | 24.9 ms | 239.7 ms |
| 1,048,576 cells | selected | 6 | 2,097,152 | 113.8 ms | 312.7 ms |

The large rows give the typical read that follows a 1,048,576-cell read.
Typical density is the E231 fixture: 256 notes in 64 beats, each 1/8 beat
long. Thus the cost is about 1 ms after a typical clip, and about 73 ms after
the E227 upper size.

### Pins from an earlier build

The new open removes the pin of the prior target only. A track that an
earlier build pinned refuses one read: 17 of 18 first reads in one run. That
refused read leaves the reader on the track. The next open removes the pin,
and every later read passed. The adapter therefore retries one time after
`bound-target-mismatch` when the bound track is the requested track and the
bound row differs. A second mismatch refuses. Another bound track refuses with
no retry.

## 5. Acceptance

The product build ran in the probe profile, so that `legacy-open` (the 8h3c
open order) could force a mismatch.

- **Fresh tracks:** 108 of 108 reads passed with zero refusals, in both
  passes. The second pass has history on every track.
- **Tracks from the research runs:** 107 of 108 passed. The one refusal was
  the first read of the one track that an earlier route left pinned.
- **Alternating rows:** 40 of 40 reads passed, rows 1 and 0 in turn on two
  tracks.
- **Guard:** on fresh tracks, `legacy-open` pinned row 0. Its reads of rows 1
  and 63 refused with `bound-target-mismatch` and bound row 0. Product reads
  then bound rows 1, 63, and 0. Next, `legacy-open` pinned three tracks. The
  adapter read row 1, row 63, and row 1. The first two refused once and then
  passed; the third had no old pin and passed at once. Each returned its
  declared note.

The normal build ran the E230 cases at row 0 and at row 1. For row 1, row 0
held a different clip: 3 beats, one note on channel 10 at pitch 100.

- Smoke: three repeated reads passed.
- Paired: all eight fixtures match the E131 control at both rows.
- Selection: three changed entry selections restore at both rows. In the
  first row-1 attempt, the entry was the target slot itself, so the selection
  did not change and the driver assertion failed. The reads were correct.
  That attempt is retained and does not supply acceptance.
- Gate: all five write-gate cases pass at both rows.

The E230 verifiers now also check that each capture is of the requested track
and row, and that each artifact requests its recorded row.

## Open observation

One read of 2,200 matrix and alternate reads did not restore the slot
selection. It was the first read of the first reproduction run. The slot
selection stayed on the target track, not the entry track. The mixer track
was restored. No other read showed this. The cause is not known.

## Artifacts and verification

Data is in [phase8h3c2-rows](../data/phase8h3c2-rows/).
`brain/src/probes/phase8h3c2-rows.ts verify-offline <dir>` checks every claim
above from the retained artifacts, including the E230 cases through their
verifiers. `phase8h3c2-rows.test.ts` runs it. `research-routes.patch.gz` keeps
the research routes; the product build keeps only `legacy-open`.

Brain check passes 1,898 tests. Extension check passes, with 15 reader test
groups. Both logs are retained.

## Restoration

The drivers deleted all owned tracks. The `New 3` track list matched its
entry list. The reader was closed, and the write gate had no open read,
waiting request, or lease. The operator closed `New 3` without saving. The
research archive is removed. The rig config is unchanged (SHA-256
`256bbf07…43b0`).

Fresh normal hello passes `normal-v1`, 87 methods, hash `ca139a3e62a55e68`,
`clip-reader-v1`, `confirm-before-release-v1`, and
`subscribe-before-unpin-v1`. Initialization is `2026-10-06T04:40:55.408Z`,
after deployment. The normal archive SHA-256 is
`a9e7b69b060e317d8ef569d5cde76099d5fa5a0b536067440b7a464f0a549ea1`. The
anchor `gn-scale-test` matches all ten track IDs of the E231 baseline.
