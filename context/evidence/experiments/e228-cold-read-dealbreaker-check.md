---
title: E228 — Cold-read dealbreaker check
kind: evidence
state: done
updated: 2026-10-05
owner: phase-8h3a
---

# E228 — Cold-read dealbreaker check

## Status

[8h3a](../../plan/phase-8/8h3a-cold-read-dealbreaker-check.md) is complete.
Experiment 1 and the first selection matrix ran with `8h3a-dealbreakers-v1`.
The artifact verifier recomputed 1,042 verdicts, including three labelled
visual trials.
The source, ordered selection, write, and soak matrices are complete.
The operator was ready for five visual trials. All five passed the read and
selection checks. The operator saw track-selection flicker, but could not assign it to a phase.
The labelled repeat passed all three read, restore, and release checks.
The operator saw a selection change during each read, between `WATCH READ`
and `READ DONE`, and noticed no changes at other times. Full restoration
does not prevent visible interference. The user accepts temporary selection
changes for modal use. The original config and normal archive are restored,
and the research archive is removed. The operator confirmed owned-project
closure without saving and full normal controller replacement. Fresh normal
hello passes. No dealbreaker remains open.
All artifacts keep `complete:false` and `eligible:false`. D30 is not revoked.

The checked `8h3a-dealbreakers-v2` archive was freshly loaded
at `2026-10-05T10:08:31.484Z`. Hello passed with the v2 marker.
V2 adds a full selection restore and a guarded lease transfer for release.
The ordered selection matrix passed. The first replacement attempt still
returned v1. Live trials stopped until the next full replacement passed hello.

## Method

Fresh research hello passed: `phase-8-probe-v1`, 98 methods, hash
`d89cee6bf21c1f96`, initialization `2026-10-05T09:07:50.150Z`.
The owned unsaved project is `New 3`. D29 permits reuse of the retired name.
The anchor `gn-scale-test` stays open. The rig has 16 tracks, 64 rows, two
shadow views, and a reader width of 4,194,304 steps at 1/512 beat.

The fixtures and decoration follow E227. The fixture writer was rebound for
verification, then released to park. One-note copies also exist at rows 1 and
63. Each measured bind observes at least 2 s after its action and its last
callback. The reader preserves decoded notes at the D30 close. Later callbacks
cannot change this capture. Raw callback counts, batch tasks, value tasks,
Empty/note ordering, selection counters, and decoded rows are retained.

## 1. Bind source

Each of six pairs has 20 direct trials and 20 matching trials from park.
All 120 trials from park closed with an exact capture, no duplicate cell,
and no callback after close. None of the 120 direct trials received a
`clipExists` callback. A same-clip rebind also had no step callback.
The reader therefore needs a park source for the accepted D30 start signal.

| Pair | Direct batch task, median | Park close, median | Release last callback, median |
|---|---:|---:|---:|
| `n4096-64` → `n16384-512` | 128 ms | 124 ms | 99 ms |
| `sustain-2048` → `n131072-2048` | 501 ms | 338 ms | 146 ms |
| `n4096-64` → `empty-64` | 72 ms | 49 ms | no step callback |
| `empty-64` → `n4096-64` | 70 ms | 72 ms | 56 ms |
| `one-64` → `one-row-1` | 49 ms | 49 ms | 26 ms |
| `one-64` → `one-64` | no callback | 49 ms | 26 ms |

The direct task times are not valid read-close times. The start signal was
absent. The decoded rows at the end of the oracle were exact in the other
100 direct trials. This does not admit those reads. The same-clip trace had
no replay and could not decode the existing note.

Old Empty callbacks preceded the new notes in one batch in all 60 populated
pairs with notes in both clips. They did not interleave. Populated-to-empty
had only Empty callbacks; empty-to-populated had only note callbacks.
The shared-cell pair had no duplicate because its Empty callbacks came first.

The release times above measure the last step callback after the direct bind.
The driver also waits for a 1 s release oracle. That wait is not the measured
release cost. Empty-clip release needs a separate value-task cost measurement
if the product needs that number.

## 2. Row and selection: first matrix

The first matrix has 48 cases: rows 0, 1, and 63; the same or another mixer
track; equal or different selected rows; and restore at bind, close, release,
or no restore. Six more cases test point followed by `slot.select()` in the
same controller task.

When the target row differs from the selected row, pointing the track first
replays the old row, clears it, then replays the target row. The one-note cases
have 12 callbacks and two duplicate-cell events. Their final close capture is
exact, but the duplicate-cell rule refuses them. The slot-select route has the
same result. Select the row before pointing the reader as the next candidate.

The slot and mixer selection can differ. A slot restore alone does not restore
the mixer track. The first driver also used its intended entry selection in
some restore parameters, rather than the observed entry selection. V2 captures
the actual slot and mixer values and restores both under one E99 lease.

Parking changes the mixer selection and clears a lease for the prior target.
The first restore after release therefore refuses. V2 can transfer that lease
to the park action only when it is still owned. A lost lease cannot be renewed.
The restore consumes the lease before either selection write.

## 2b. Ordered route and full restore

All 48 v2 cases passed at rows 0, 1, and 63. Select the target row while the
reader stays at park, then point the reader in the same controller task.
Every replay had four callbacks in one batch, an exact capture, no duplicate,
and no callback after close. The D30 close median was 49–51 ms by restore
case; the maximum was 74 ms.

Restore in the bind task refused in all 12 cases. The slot and mixer observers
had not yet reached the borrowed selection. Restore at close succeeded in all
12 cases and preserved the pinned read. Restore after release also succeeded
in all 12 cases. Each restored all three entry values: slot track, slot row,
and mixer track. The release path transferred the lease while it was owned.

A bind made zero or one slot-selection event and one or two total selection
events. A successful full restore made zero to two slot events and two to four
total events, including the bind. These counters do not prove visual silence.
The labelled operator check confirms visible interference with close-task
restore. Full restoration alone does not meet the visual requirement. The
user accepts temporary changes for modal use. A lost lease must refuse
restoration.


### Selection-preserving release

Five additional row-1 reads passed with close-task restore, followed by
unsubscribe. All three entry selection values stayed equal after both restore
and release. The reader was unsubscribed, and no release action moved the
selection. The read oracle ran before this explicit release. The driver then
returned to park and restored the subscription.

The candidate product rule is close-task restore under the E99 lease, then
unsubscribe to release without another selection change. Capture the original
selection before preparing park for the next read. Select the target row while
at park, then point the reader. A lost lease must refuse restoration. Five
later trials ran after
the operator confirmed readiness. Their recorded checks also passed. The
operator saw track-selection flicker but could not assign it to a phase.
Three trials with terminal phase labels and a countdown also passed all
automated checks. Their D30 close times were 48.6, 49.0, and 73.8 ms. These
times do not measure the duration of the visible change. The operator saw a
selection change between `WATCH READ` and `READ DONE` in each trial. No
changes were noticed at other times. The visible effect is confirmed; the
user accepts the selection rule for modal use.

The accepted rule restores slot track, slot row, and mixer track at close
under the E99 lease, then unsubscribes for release. The agent controls Bitwig
during the workflow. A lost lease still refuses restoration. The modal-use
rule does not remove the guards for operator input.

No verified arbitrary-clip reader avoids selection borrowing. E131 uses the
shared fine cursor and moves visible selection. Its live acquisition check
left the mixer selection changed. Reads from an already-bound cursor or a
resident cache can avoid a new selection change; target acquisition still
uses selection. See [D6](../../decisions/d6-addressing-pinned-non-following-cursors-identity-never-index-set.md)
and [E131](e131-consolidated-clip-acquisition.md).

## 3. Earlier Ghostnote writes

All ten trials at each ordinary-write gap (zero, one, and two controller tasks)
passed. The changed velocity was in the single replay batch. No duplicate or
callback after close occurred. The zero-gap bind was the next bridge request.

All ten delayed-batch trials failed: the close capture held the old velocity,
and one later delta made a second batch, one duplicate, and one callback after
close. `batch.run` with `delayMs` returns after it schedules the operations.
It does not confirm execution. The write ran during the read, 100 ms after
the first batch operation. This is the concurrent-write condition excluded
by D30, not a late replay from an executed earlier write.

The fixture-writer callback candidate did not confirm its own field setter.
One attempt used 100 immediate requests; a second used a 5 s deadline and
10 ms polling. Both timed out. No trial used that receipt as proof of delivery.
The driver restored the velocity and parked both cursors after each timeout.
The callback cause is not established.

The passing barrier checks the fixture's execution counter in a later
controller task. All ten delayed writes then produced an exact read with one
batch, no duplicate, and no callback after close. The confirmation took
141–147 ms after the scheduling reply (median 146 ms), including the 100 ms
scheduled delay and bridge polling. This is not a fixed host-settle delay.

Product rule: finish every scheduled Ghostnote write before the bind task.
A scheduling acknowledgement is insufficient. The 8h3c write queue must track
actual operation completion. The fixture counter is research instrumentation;
it is not a proposed public write-completion interface. Ordinary synchronous
writes required no extra gap in these trials.

## 4. Soak: playback correction

The first 500 binds all passed, but only 125 ran during playback. The driver
called `transport.play()` at the start of each intended playback group. Each
second call toggled transport off. The artifact verifier rejected the claimed
playback state. No replay violation occurred.

The 125 affected raw trials are retained as `soak-toggle-*.json.gz`. The
verifier recomputes their read verdicts, but excludes them from the required
500-bind set and the playback cost comparison. Their `playing:true` report
field records the requested mode; their raw transport state is false.

The corrected driver changes transport only when its observed state differs
from the required state. It waits for that state and checks it after each
bind. All 125 replacement playback cases passed. All primary trials retain
the 2 s oracle after both action and last callback. The driver resumes from
retained artifacts and stops transport and parks both cursors on completion.

### Qualified soak and tripwire

All 500 qualifying binds passed: 250 stopped and 250 playing. Each of the ten
fixtures has 25 trials in each transport state. All captures are exact, with
one replay batch for populated clips, no duplicate cell, and no callback after
close. Empty clips close on the value task alone. The 125 extra stopped
attempts also passed their read checks. With the later labelled visual trials,
the verifier recomputed 1,042 raw verdicts across all retained data.

| Fixture | Idle close, median | Playing close, median | Maximum close, both states |
|---|---:|---:|---:|
| `n4096-64` | 70 ms | 68 ms | 93 ms |
| `n16384-512` | 122 ms | 106 ms | 162 ms |
| `n131072-2048` | 314 ms | 286 ms | 380 ms |
| `sustain-2048` | 271 ms | 249 ms | 707 ms |
| `n4096-8192` | 118 ms | 95 ms | 140 ms |

The rig's normal observers and two shadow cache views were loaded. Transport
playing is the measured load condition. This does not prove performance for
other host loads or versions.

| Watch after close | Trials | Added wall time, median | p95 |
|---|---:|---:|---:|
| 0 ms | 170 | 22.5 ms | 26.1 ms |
| 50 ms | 170 | 67.8 ms | 74.5 ms |
| 100 ms | 160 | 112.1 ms | 122.5 ms |

These costs include the bridge status request. They do not measure the cost of
an extension-only timer. Select no fixed watch for the product. Keep a tripwire
on every step callback after close and before release. Such a callback must
flag the read and refuse its capture; it must not change the frozen notes.
The research implementation uses one condition and a counter increment in the
existing observer. Its CPU cost was not isolated. A fixed watch adds delay and
cannot detect a callback that arrives after that watch.

D30 is not revoked. The tested route starts at park, selects the row before
pointing, and finishes scheduled writes before the bind task. Native edits,
other host versions, and a target that changes during a bind remain excluded.
The user accepts the visible selection effect for modal use. No tested
dealbreaker remains open. Product promotion remains in 8h3c.

## Artifacts

Data is in [phase8h3a-dealbreakers](../data/phase8h3a-dealbreakers/).
`source.json.gz` and `selection.json.gz` are the retained v1 matrices.
`selection-ordered.json.gz` retains the 48 passing v2 cases.
`selection-release.json.gz` retains the five unsubscribe release checks.
`visual.json.gz` retains the five visual trials.
`visual-labelled.json.gz` retains three trials with phase timestamps.
`operator-visual.json` records the operator's phase-specific report.
`writes.json.gz` retains all 50 write cases and the execution barriers.
`write-barrier-attempts.json` records the two rejected callback candidates.
`source-smoke.json.gz` is the six-pair pipeline check.
`summary.json` is recomputed by
`brain/src/probes/phase8h3a-dealbreakers-artifacts.ts --out <summary.json>`.
The verifier checks every stored verdict against the raw capture and tasks.
The v1 and v2 markers remain distinct.

## Verification and restoration

Brain type checking and all 1,869 tests pass. Extension checks, active wire
goldens, context links, and diff whitespace pass. The complete artifact
verifier passes 1,042 verdicts, 500 qualifying binds with 250 playing, and
the operator acceptance and restoration gates. All research results remain
`complete:false` and `eligible:false`.

The original config hash is `256bbf07…43b0`. The normal archive is restored,
and the research archive is removed. The operator closed `New 3` without
saving and replaced the controller. Normal hello passes with `normal-v1`,
85 methods, and hash `bba7383dce25c0f0`. Initialization at
`2026-10-05T12:05:58.299Z` is after deployment at
`2026-10-05T12:04:23.220Z`. The active project has none of the fixture track
IDs. [restoration.json](../data/phase8h3a-dealbreakers/restoration.json)
records these checks. No test residue remains.

## Retrospective

Give the operator visible phase labels and a countdown before a read.
Capture the actual slot and mixer selection. An intended selection command
can leave a different state. Compare the result with the full entry state.
Check transport state before each trial. `play()` toggles playback; it is not
an idempotent setter. Test that a write observer reports its own setters before
using it as a delivery barrier.
