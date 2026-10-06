---
title: E230 — Cold-reader promotion
kind: evidence
state: done
updated: 2026-10-05
owner: phase-8h3c
---

# E230 — Cold-reader promotion

## Status

[8h3c](../../plan/phase-8/8h3c-cold-reader-promotion.md) is complete.
The product reader serves every clip-note read and write preflight. All
acceptance cases and artifact verifiers pass. The operator closed the owned
project without saving and restored the normal controller. Fresh normal
hello passes. The anchor track IDs and rig config hash match. No fixture or
research archive remains. Changes are staged for review; no commit was made.

## Implementation

`ClipReader` replaces the research replay reader in every runtime profile.
It parks on the master track, then subscribes and binds from park. It uses
one `1/512` cursor with 4,194,304 steps and all 128 pitches. It follows D30
close and confirmation tasks. It restores the entry selection under the
E99 lease, confirms while subscribed, then unsubscribes. The deadline is 2 s. It refuses width, deadline,
duplicate cells, multiple replay batches, changed bound targets, and callbacks
after close. Later callbacks are counted in the next read and rig statistics.
Three repeated reads passed the master park route.

`notes-v1` uses E229 packed dictionaries for every field. It returns one page
for at most 131,072 notes. Larger captures use pages. The brain checks page
bounds, capture IDs, columns, field types, coordinates, and duplicate cells.
One snapshot acquires each clip once for all requested channels. A missing
or incompatible reader configuration refuses. There is no product scan fallback.

The extension write gate orders writes behind an open read. Deferred batches
and group expansion hold write leases. The queue has 256 entries. A queued
reply reports `queuedMs`. An unclassified method is a write.

[D31](../../decisions/d31-mutation-and-reversal-use-the-d23-cell-boundary.md)
and the D8 amendment adopt the occupied-cell boundary for mutation and reversal.
The writer keeps D9 grids. It can combine a normalized onset with a duration
from another D9 lattice. Values precede control enable flags on reconstruction.
Independent raw reads prove disabled-control preservation in the owned case.

## E131 retirement

- Product `LiveAdapter.readOne(notes)` uses only `clip.read` and its frozen pages.
  Executor stash, verification, preflight, reversal, musical patches, the note
  compiler, and exact-source tools all use this adapter route.
- `readFineClipNotes` and `reconcileExactNoteScans` moved to the named diagnostic
  `brain/src/probes/e131-diagnostic.ts`. Their reconciliation tests moved with them.
  No product module imports it. The 8h3c paired driver uses it as the control.
- Removed product `noteReadCursorRef`, `noteReadSteps`, and the pool note-scan
  fallback. The rig retains its fine cursor and raw scan wire for diagnostics
  and explicit writer partitions. No wire method was removed for E131: it used
  shared low-level cursor methods.
- Removed `ShadowReplayReader`, `ReplayEpoch`, `ReplayFetch`, and
  `ReplaySelectionActions`, their tests and Gradle tasks, `cacheReplayResearch`,
  and the `cache.shadow` replay operations. The earlier live replay drivers
  require their earlier research build. Their retained artifact verifiers still run.
- Added two product methods. Normal has 87 methods, capture 92, probe 100.
  The historical declaration inventory has 162 methods.
- Compatibility break: product note reads require `hello()` and `clip.read`.
  Older extensions and absent configurations refuse. Starts and fingerprints
  now use D31 cells. Legacy tools with “exact” in their names keep those names
  until interface simplification. Their timing fidelity is the D31 boundary.

## Verification

The saved brain check log records 1,886 passing tests. Review fixes then
added one test: removal matching fills absent fields with host defaults, and
the brain uses the `rig.info` page size as its only page limit. Brain check now
passes all 1,887 tests. Extension checks pass. Java capture, frame, gate, and classification
tests pass. Brain tests cover all-channel memoization, reader configuration
refusals, page identity and bounds, disabled-control write order, cell verification,
and targeted reversal. E228 verifies 1,042 verdicts, 500 qualifying binds,
and 250 playback binds. E229 verifies all 50 retained fetch trials.

The normal archive hash is `ca139a3e62a55e68`. Its reader marker is
`clip-reader-v1`. The revised build also requires
`closeRule: confirm-before-release-v1`. Fresh initialization and this marker must pass hello
before live work. The original rig config SHA-256 remains
`256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.

Offline logs and their SHA-256 manifest are in
[phase8h3c-promotion](../data/phase8h3c-promotion/).
`phase8h3c-promotion.ts verify-offline <dir>` checks the saved logs, test
counts, Java reader groups, and retained E228 and E229 verifier results.
The manifest records archive deployment, saved checks, and live acceptance.

## Live driver and verifier

`brain/src/probes/phase8h3c-promotion.ts` refuses the saved anchor and requires
an owned unsaved `New N` project. Its `smoke` command records three repeated
master-park reads before paired reads. It writes raw JSON-RPC response lines,
byte counts, capture fields, and entry and exit selections.
`verify-smoke` decodes the saved frames and checks the declared note, park,
batch, callback, and response-byte evidence. `paired`, `refusals`, `queue`,
`disabled`, and `cleanup` provide the other live cases. `selection` checks
three changed entry selections. Each accepted artifact has a matching verifier.

`verify-paired` recomputes both E131 grids from the raw scan replies, joins
them, decodes the cold frames, and checks all eight declared fixtures.
`verify-refusals`, `verify-queue`, and `verify-disabled` check their raw
captures, response bytes, queued replies, raw control preservation, and the
mixed onset-duration case. Live artifacts must pass these checks before an
acceptance claim. The paired verifier test passes the eight-fixture matrix
and refuses changed controls, missing cases, and incorrect byte totals.

`faults` injects synthetic duplicate and step-delta capture events only in
the research profile. It records the diagnostic parameter in each reply,
then reads again without a fault. Normal and capture profiles reject the
parameter before host changes. `verify-faults` checks refusal and recovery.
These cases test the guards; they do not claim a natural host fault.

## First live gate: refused

The operator confirmed controller replacement. Hello passed `normal-v1`,
87 methods, hash `ca139a3e62a55e68`, and marker `clip-reader-v1`.
Initialization was `2026-10-05T14:15:07.962Z`, after archive deployment.

The driver created one disposable track in the owned unsaved `New 5` project.
It wrote one note at beat 1, channel 15, pitch 127. The first read reached
park in 18.31 ms with zero extra park polls. It bound the correct channel
and row, saw one onset in one batch, and closed at 94.59 ms. Confirmation
refused with `step-delta`: 128 callbacks arrived after close. The reply took
120.02 ms inside the reader; the driver measured 170.51 ms with track lookup.
The entry and exit slot track, row, and mixer track were all `[0,0,0]`.
The lease restore reported success.

This proves park reachability for one bind. It does not prove the complete
master route or a successful product read. The callback source is not yet
identified. Do not suppress the tripwire to make the smoke run pass.

The driver stopped after one read. It removed the owned track and checked
the original owned-project track IDs. Reader subscription and read gate
were closed, with no queued writes. The saved anchor was not mutated.
Automatic approval review blocked the UI action to discard `New 5`.
The operator then closed it without saving. The anchor is active. A normal
hello after cleanup passed and retained the anchor track IDs. Its log is
`normal-hello-after-cleanup.log`. No fixture remains.

Artifacts: `smoke.json.gz`, `state.json`, and `cleanup.json` in the evidence
directory. `verify-stopped-smoke <smoke> <cleanup>` checks the raw reply,
refusal, park and bind times, selection restore, fixture write, owned-project
cleanup, and closed gate. It passes. Both verifier tests pass, including damaged wire, selection, and
cleanup cases. Type checking passes. A refused run cannot pass `verify-smoke`.

## Revised close sequence

The operator authorized investigation after the refused smoke run.
[E228](e228-cold-read-dealbreaker-check.md) checked the read oracle before its
explicit unsubscribe release. The initial product implementation reversed
this order. It unsubscribed in the close task, before confirmation. This
put release callbacks in the tripwire window. Their state was not recorded in the first build. The revised repeat below
tests unsubscribe as the cause.

The revised reader confirms while subscribed. Every callback after close
and before release still refuses, including an Empty state. It then marks
the release phase and unsubscribes. A later task reports release callback
counts by state and up to eight raw coordinate samples. The write gate stays
closed until that task replies. Non-empty release callbacks before the reply
also refuse. The frozen close copy cannot change in either phase.

Release counters remain in rig statistics and the next read. They are not
evidence of a changed source clip. The revised smoke run shows a valid read window and identifies the release
callbacks below. D30 is not weakened.

Extension checks pass, including 13 reader test groups. The release regression
retains a pre-release Empty callback in the tripwire count, counts all three
post-release states, and checks that the close copy stays frozen. The normal
archive is deployed with `closeRule: confirm-before-release-v1`. The operator replaced the controller, and fresh hello passed before the retry. The original
failed-run artifacts remain intact.

## Revised master gate: passed

Fresh normal hello passed after operator replacement. Initialization was
`2026-10-05T14:45:02.234Z`, after deployment. The close-rule marker matched.
The driver used the owned unsaved `New 6` project.

Three repeated reads passed the declared one-note fixture at beat 1,
channel 15, pitch 127. Park took 20.25–25.10 ms with zero extra polls.
Reader time was 139.77–147.40 ms; driver wall time was 192.94–198.23 ms.
Each read saw 128 callbacks, one onset, one batch, no duplicate, and zero
callbacks after close before release. Each release then sent 128 Empty
callbacks, with no Sustain or NoteOn callback. All eight saved samples per
read refer to channel 15, pitch 127, within cells 512–639. This is the
sounding interval of the fixture note. Release counts also appeared in the
next read. Entry and exit selection stayed `[0,0,0]`.

This supports unsubscribe as the cause of the first build's false refusal.
The first build did not record callback states, so this is an inference
from the revised phase order and the repeat results. The tripwire remains
active until unsubscribe. `verify-smoke` passes the retained
`smoke-confirm-before-release.json.gz` artifact.

## Paired reads and selection: passed

All eight fixtures match E131 after D31 onset normalization. Each fixture
covers all 16 channels. Sparse notes occur every 4 beats; dense notes occur
every 1/4 beat. Each note has a 1/4-beat duration. The verifier recomputes
both diagnostic grids from their raw replies and compares the decoded frames.

| Bars | Density | Notes | Cold wall, ms | Cold bytes | E131 wall, ms | E131 bytes |
|---:|---|---:|---:|---:|---:|---:|
| 1 | sparse | 16 | 219.20 | 2,863 | 1,041.66 | 17,575 |
| 1 | dense | 256 | 222.97 | 3,939 | 1,184.70 | 244,527 |
| 4 | sparse | 64 | 224.82 | 3,114 | 3,105.38 | 67,852 |
| 4 | dense | 1,024 | 255.32 | 7,256 | 2,888.75 | 975,911 |
| 16 | sparse | 256 | 226.50 | 3,967 | 9,780.76 | 270,033 |
| 16 | dense | 4,096 | 270.65 | 20,570 | 10,398.40 | 3,902,273 |
| 64 | sparse | 1,024 | 243.70 | 7,229 | 37,670.09 | 1,078,763 |
| 64 | dense | 16,384 | 926.66 | 133,807 | 51,883.01 | 15,607,901 |

Costs include track lookup, capture, and page replies. They exclude the entry
and exit selection queries. Response bytes include JSON-RPC framing. These
are one paired trial per fixture, with the default normal rig. The largest
fixture has 2,097,152 sounding callbacks. All captures fit one wire page.
Unit tests cover larger paged frames. The paired entry and exit selections
are `[0,0,0]` for both readers.

Three further cases read row 0 while the entry selects another track at row 1,
the owned track at row 1, or another track at row 0. Each restores the full
captured slot track, row, and mixer track. `slot.select` does not select the
mixer track. The first selection attempt assumed that it did; its failed
probe assertion is retained. The corrected artifact passes `verify-selection`.

## Refusals and write gate: passed normal cases

A clip of 8,193 beats refuses `clip-beyond-reader-width`. A 1 ms deadline
refuses `deadline`; the next read succeeds. A new adapter without hello
refuses absent configuration and sends no `clip.read`. The deadline can
expire before target bind and leave the mixer at master park. Its reply
reports `refused-before-bind`; do not infer selection restoration from that
refusal. Successful bound reads restore their entry selection.

The gate matrix passes all five cases:

- An edit sent during an open read waits 276.19 ms. Every raw field of the
  captured pre-write state matches a separate read before the edit. A later
  read has velocity 64.
- A write just before bind is present in the capture at velocity 80.
- A delayed two-operation batch holds its write lease. The read waits and
  has the final velocity 100.
- A 1 ms deadline releases a waiting write after 72.59 ms. The next capture
  has velocity 90.
- Of 280 unclassified `track.setName` writes, 256 wait and 24 refuse before
  execution. Admitted writes wait 286.25–6,449.73 ms. The final observed name
  is the last admitted name. The fixture name is then restored.

The queue probe required three corrections. The host velocity setter returns
float32, so fixture checks use MIDI velocity; preservation checks still
compare every raw field exactly. Concurrent request slicing included unrelated
writes and measured bytes before they completed. Each capture now records
only its own requests. The final name observer also needed settlement after
the last setter reply. Failed attempts remain in the evidence directory;
only `queue.json.gz` passes `verify-queue` and supplies acceptance.

## Disabled controls and normalized reconstruction: passed

Channel 3 has disabled chance, occurrence, recurrence, and repeat controls,
with non-default raw values: chance 0.3, occurrence PREV, recurrence `[8,85]`,
and repeat count -2 with non-default curves. Release velocity is 0.5.
The executor clears and reconstructs the clip while it transposes channel 0
by 12 semitones. Channel 3 is unmentioned by the transpose. Independent raw
reads before and after reconstruction match every channel 3 field exactly.
The cold frame also retains all four false flags and the raw recurrence.
The mutation is applied with no verification disagreement.

A separate 1/6-beat onset with a 1/3-beat duration is inserted, then restored
at its normalized cell start, `85/512`. The result has cell 85 and retains
the supported triplet duration. Both operations verify with no disagreement.
`verify-disabled` passes the raw replies and the mixed-lattice capture.

## Research refusal controls and cleanup: passed

The operator fully replaced the controller with `ghostnote 8g controls`.
Fresh hello passed `phase-8-probe-v1`, 100 methods, hash
`4232fd6c9f325749`, and the close-rule marker. Initialization was
`2026-10-05T15:24:47.482Z`, after research archive deployment.

The synthetic duplicate case records one duplicate and refuses
`duplicate-cell`. The synthetic post-close Empty event records one
`afterClose` callback and refuses `step-delta`. Each following read succeeds.
These events change capture input only; they do not mutate a host note.
`verify-faults` passes the raw parameters, replies, counts, and recovery frames.
These cases prove the refusal controls; they do not claim a natural host fault.

The fixture track is removed. All four original owned-project track IDs
match. The reader is unsubscribed and closed; the write gate has no open
read, waiting request, or lease. Research statistics record four reads,
two refusals, zero late callbacks, and 512 release Empty callbacks.
The operator closed `New 6` without saving and fully restored normal
`ghostnote`. Final hello passes `normal-v1`, 87 methods, hash
`ca139a3e62a55e68`, reader revision `clip-reader-v1`, and
`closeRule: confirm-before-release-v1`. Initialization is
`2026-10-05T15:29:49.499Z`, after final archive deployment.
The read-only `baseline` record names `gn-scale-test` and matches all ten
anchor track IDs from the earlier normal hello. The original rig config
hash is unchanged. The generated research archive is removed.

`verify-offline` passes the final SHA-256 manifest, saved offline checks,
all seven live acceptance verifiers, raw cleanup replies, both final
profile hello logs, and the anchor baseline. Failed first attempts are
retained and do not supply acceptance.

## Retrospective

Specify the product park target before implementation. Add the normalized
onset plus triplet-duration case to the acceptance matrix. Keep read
confirmation before explicit release; E228 states that its oracle preceded
unsubscribe. Link each product phase to the measured research phase. Record only owned
requests when a probe measures concurrent costs. Check selection semantics
and host setter precision before exact fixture assertions.
