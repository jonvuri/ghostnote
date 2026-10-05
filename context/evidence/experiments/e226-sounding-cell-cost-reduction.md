---
title: E226 — Sounding-cell cost reduction
kind: evidence
state: active
updated: 2026-10-05
owner: phase-8h1b
---

# E226 — Sounding-cell cost reduction

## Status

[8h1b](../../plan/phase-8/8h1b-sounding-cell-cost-reduction.md) is complete.
Experiments 1 to 4 ran. Unsubscribe releases a bound grid, and resubscribe
replays it in about 130 ms. A sounding-cell budget evicts and readmits exactly.
The coarse sentinel fails at 1/16 beat, because a 1/512 nudge inside one coarse
cell has no callback. Thus 1/4 and 1 beat were not tested, and experiment 5 did
not run. All results keep `complete:false` and `eligible:false`.

## Method

The research build `8h1b-sounding-v2` (profile `phase-8-probe-v1`, 98 methods,
hash `d89cee6bf21c1f96`) adds two proxies when `cacheSoundingResearch` is set:

- a release proxy at 1/512 beat, 1,048,576 steps wide; and
- a sentinel proxy, 32,768 steps wide, with a step size set at runtime.

Both proxies record note-step callbacks in bounded traces. The `cache.shadow`
operations `sounding*` move, pin, subscribe, scroll, and step each research
cursor. They also apply matrix edits through the fixture writer in one call, and
run the admission policy `SoundingCellBudget`. No bridge method was added.

The config had 2 cache views, a 16×16 bank, no cursor slot bank, and width
1,048,576. Bitwig was restarted before the first load. The owned project
`New 2` had four tracks: dense, park, canary, and matrix. The park track has no
clip, so a cursor on it holds an empty slot. The live set is from
`jcmd <pid> GC.class_histogram`, with the count of
`com.bitwig.flt.control_surface.proxy.NoteStep`.

The `sustain` fixture has 16,384 notes of 64 cells: 1,048,513 sounding cells.
The `half` fixture has 524,225 cells.

## 1. Release of a bound proxy

The release proxy bound to `sustain` added exactly 1,048,513 note steps and
280 MiB of live heap (about 280 bytes for each cell). The live heap was 233 MiB
when the proxy was released and 513 MiB when it was bound.

| Action | Frees the grid | Restore | Replay of 1,048,513 cells |
|---|---|---|---|
| Unsubscribe the clip | Yes, all cells | Subscribe | 130 ms |
| Unpin track and clip | No | Pin | none needed |
| Select an empty slot | No; the cursor stays on its last clip | Rebind | none needed |
| Point to another track (empty selected slot) | Yes, all cells | Rebind | 150 ms |
| Step size 1 beat | 98 % (18,271 coarse steps stay) | Step 1/512 | 244 ms |
| Scroll past the clip | Yes, all cells | Scroll to 0 | 105 ms |

Each restore brought back all 1,048,513 cells. The replay time is from the action
to the last callback. The fixture writer also released its grid when it moved
to the park track. Ping p95 was 25 ms.

## 2. Cursors that can hold a resident clip

| Cursor | Width | Holds when bound | At 1/512 | After release |
|---|---:|---:|---:|---:|
| Cache views 0 and 1 | 1,048,576 | 1,048,513 | — | 0 |
| Cache authority | 1,048,576 | 1,048,513 | — | 0 |
| Knee fixture writer | 1,048,576 | 1,048,513 | — | 0 |
| E131 fine cursor | 2,048 | 6,013 | 2,048 | 0 |
| Note observer | 2,048 | 6,013 | 2,048 | 0 |
| Pool cursors 0–7 | 512 | 1,405 each | 512 | 0 |

Each cursor was released to the park track. A windowed cursor holds only its
window, so only the full-width cursors need the release rule.

### Release rule for 8h1

- A full-width cursor that leaves cache residence unsubscribes its clip. This
  keeps its pins and target. Readmission subscribes again and treats the
  replay as a rebind. It needs the same identity, settlement, and step-window
  checks as a rebind, because the clip can change while unsubscribed.
- Point to an empty park target or scroll past the clip when the cursor must
  keep its subscription.
- Unpin or an empty slot selection is not a release.
- Release the authority and any research fixture after each use. They hold the
  full grid while they stay on a clip.

Experiment 3 below released each evicted view to the park track. It did not
test unsubscribe through the cache configuration.

## 3. Admission by resident sounding cells

`SoundingCellBudget` admits a clip after its read, because the cache knows
the cells only from the read. The cells are the sum of note durations in
1/512-beat cells. It refuses a clip above the per-clip limit or the budget.
It does not exceed the budget for a busy resident. Otherwise it evicts the
least recently used residents until the clip fits. A warm read refreshes that
order. The caller releases each evicted proxy.

The research budget was 1,200,000 cells and the per-clip limit 1,100,000.
The cycle `sustain`, `half`, `sustain`, `half` evicted the other clip at each
later step:

| Step | Evicted | Bind | Drain | Read | Total | Release | Note steps |
|---|---|---:|---:|---:|---:|---:|---:|
| sustain | — | 4.05 s | 2.79 s | 0.39 s | 7.25 s | — | 1,048,641 |
| half | sustain | 4.43 s | 2.44 s | 0.26 s | 7.13 s | 0.28 s | 524,289 |
| sustain | half | 3.95 s | 1.76 s | 0.29 s | 6.02 s | 0.31 s | 1,048,641 |
| half | sustain | 4.38 s | 2.80 s | 0.18 s | 7.36 s | 0.27 s | 524,289 |

Every read was exact. Note steps followed the resident clip. The count was
always the resident cells plus 128 unrelated host steps. Ping p95 was 25 ms.
A readmission through a canary rebind takes 6–7.4 s. An unsubscribe release
could replace that rebind with a replay of about 130 ms. 8h1 must still
prove the identity checks for that path.

### Retained data

The live heap was 401 MiB before admission with no grid bound, after the earlier
experiments in the same JVM. The release baseline was 233 MiB. With
only `half` resident, the heap was 625 MiB; the grid accounts for about 141 MiB.
This session did not isolate the retained read-data term. It did not change the
research diagnostics either. Both remain 8h1 work (E225).

## 4. Coarse sentinel detection matrix

The matrix clip is 64 beats. Each row edits its own 1,024-cell region. A row
passes when the sentinel delivers a callback at the coarse cell of each edited
note start and at the coarse projection of each 1/512 recorder callback.

At 1/16 beat (32 cells), 33 of 34 rows pass:

| Edit | Result |
|---|---|
| 1/512 nudge inside one coarse cell | **Miss.** The 1/512 recorder has 3 callbacks; the sentinel has none |
| Nudge across a coarse boundary | Pass |
| Velocity, gain, mute, chance off, chance value | Pass |
| Chance value with chance off (disabled control) | Pass |
| Duration change inside the coarse footprint | Pass |
| Delete and re-add in one update | Pass |
| First or second same-pitch, same-channel note in one coarse cell | Pass |
| Velocity on each of the 16 channels | Pass |
| Final cell: field edit and added note | Pass |
| Loop length and clip length, shorten and restore | Pass; neither recorder has a callback |

The miss refuses the coarse sentinel at 1/16 beat. A coarser step contains
every 1/16 in-cell nudge, so 1/4 and 1 beat were not tested. Experiment 5
(batched fine acquisition) did not run. The cache keeps a full-width 1/512
proxy for each resident clip; the sounding-cell budget bounds the cost.

Loop and length changes deliver no note-step callback at either resolution.
Clip-extent changes need the metadata observers.

A first run is retained as `matrix-32-chance-default-diagnostic.json`. It
assumed that new notes have chance off. The host creates notes with chance on,
so its `chance-enabled` row was a no-op with no callback at either resolution.
The corrected plan disables chance instead.

## Artifacts and restoration

Data is in [phase8h1b-sounding](../data/phase8h1b-sounding/). The file
`release-empty-slot-wait-diagnostic.json` is the first release run. It waited
for an empty-slot move that never happens.
`brain/src/probes/phase8h1b-sounding-artifacts.test.ts` recomputes the claims
above from the raw samples.

The original rig config (SHA-256 `256bbf07…43b0`) is restored. The research
archive is removed and the normal archive is deployed. The operator closed
`New 2` without saving and replaced the controller. The UI shows
`gn-scale-test`. The normal hello passes: `normal-v1`, 85 methods, hash
`bba7383dce25c0f0`. Initialization at `2026-10-05T06:02:58.322Z` is newer than
deployment. `restoration.json` records this.
