---
title: E225 — Cache limit knee sweep
kind: evidence
state: active
updated: 2026-10-05
owner: phase-8h1a
---

# E225 — Cache limit knee sweep

## Status

[8h1a](../../plan/phase-8/8h1a-cache-limit-knee-sweep.md) is complete.
The first pass found the shadow cache memory model. The continuation completed
the warm-read, binding, flat-bank, deadline, and combined measurements. The
operator rates the UI as responsive enough. The normal hello passes. All live
cache results keep `complete:false` and `eligible:false`. E131 keeps stable
authority.

The middle allocation crashed Bitwig with a control-surface
`OutOfMemoryError`. Recovery restored protected `New 3`.
[D29](../../decisions/d29-saved-anchor-project-replaces-protected-new-3.md)
then replaced the protected project with the saved anchor `gn-scale-test`, so a
Bitwig restart is allowed. Later series used a fresh JVM for each allocation
load. The combined series kept that JVM across its tests to measure retained
heap and switch costs. Controller replacement at the end did not reset the JVM.

## Method

The research build allocates once from `~/.ghostnote/rig.json`. A new probe
method, `cache.configure`, sets the active observer prefix, bank sizes, width,
and every software limit at runtime. It refuses a value above the allocation and
changes nothing on refusal. A value `open` turns an estimate gate off, so the
extension does not compute that estimate. A research read, `promotedStart`, uses
cached membership and live values at occupied coordinates. It has no dense
oracle. A fixture writer writes a deterministic note set from a short spec.

Each arm checked the read against the declared fixture, targeted host reads at
the first, last, and final cells and all 16 channels, and, where possible, a
paired E131 read. Ping p95 used 40 samples. The live heap is the total of
`jcmd <pid> GC.class_histogram`, which forces a full collection. Earlier samples
from `Runtime` include garbage under ZGC; they are diagnostics only.

Bitwig Studio 6.0.6, API 25, runtime `phase-8-probe-v1`, 98 methods, hash
`d89cee6bf21c1f96`. The control-surface JVM is JDK 25 with ZGC and a 3 GiB
maximum heap. The extension shares this JVM.

## Memory model

| Term | Cost | Evidence |
|---|---|---|
| Clip width | None at constant content, through 4,194,304 steps | [width arms](../data/phase8h1a-knee/width/) |
| Sounding cell | About 350 bytes for each 1/512 cell where a note starts or sustains, for each cursor clip proxy bound to the clip | `NoteStep` count rose by exactly 1,048,576 for a 1,048,576-cell clip |
| Allocated observer | About 70 KiB, subscribed or not; about 33 KiB with no cursor slot bank | [observer loads](../data/phase8h1a-knee/observers/) |
| Flat bank track | About 39 KiB per allocated track | Equal 32,768-slot banks: 2,048×16 and 64×512 |
| Flat slot | About 3 KiB per slot (estimate) | 64×512 load, after the estimated small-bank baseline |
| Project track | About 0.93 MiB per track | Matched growth from 4 total tracks to 257; both bank shapes |

Bitwig keeps one `com.bitwig.flt.control_surface.proxy.NoteStep` (168 bytes)
for each sounding cell in the grid of each bound cursor clip. At 131,072 steps
with 4,096 notes of 32 cells, two proxies held 262,430 steps. At 524,288,
1,048,576, and 4,194,304 steps, notes were capped at 64 cells and two proxies
held about 524,200 steps. The live heap after the cold bind was 307–308 MiB at
each of these widths. A fully sustained clip of 1,048,576 cells added
1,048,576 steps and 346 MiB on the shadow bind.

The clip-length limit is therefore a sounding-cell budget, not a width. With
1 GiB of headroom, the cache can hold about 3 million resident sounding cells.

Each shadow cursor track was created with a `scenes`-sized launcher slot bank.
No code reads that bank. Binding uses the target track's `selectSlot(row)` and
the cursor clip's own slot. Occupancy uses the flat bank. With 0 cursor slots,
4,096 observers used 273 MiB instead of 422 MiB, and a binding read exactly.
The middle allocation had 2,048 observers by 256 scenes and a 1,024 by 256 flat
bank: about 786,000 slot proxies. This explains the 3.04 GiB heap at load with
nothing bound. The first pass did not rerun the full binding matrix. The continuation below
records its pass with zero cursor slots.

## Axes

### Occupancy at 131,072 steps

Current allocation: 512 observers, 512 tracks by 128 scenes. Every arm is exact.

| Notes | Warm read median | Enrichment host work | E131 read |
|---:|---:|---:|---:|
| 1,000 | 68 ms | — | 40.1 s |
| 4,096 | 118 ms | 43 ms | 40.4 s |
| 16,384 | 377 ms | — | refused |
| 65,536 | 1.52 s | 680 ms | refused after 80 s |
| 131,072 | 3.29 s | 1.32 s | refused after 127 s |

E131 refuses a source above 4,096 notes. It reads the complete clip before it
refuses. No host knee appeared: ping p95 stayed at 25 ms and each enrichment
batch stayed below the 50 ms limit. Warm reads pass 100 ms from about 4,096
notes, so 8h1 must evaluate compact note storage or a persistent buffer.
About half of a large warm read is research diagnostics in each poll response.

### Width at constant content

Two observers, 16 tracks by 16 scenes, 4,096 notes. Every arm is exact.

| Steps | Bars | Live heap after warm reads | Warm read | E131 read |
|---:|---:|---:|---:|---:|
| 131,072 | 64 | 235 MiB | 100 ms | 40.7 s |
| 524,288 | 256 | 316 MiB | 95 ms | 256 s |
| 1,048,576 | 512 | 316 MiB | 86 ms | 711 s |
| 4,194,304 | 2,048 | 317 MiB | 94 ms | not run |

The 131,072 row holds fewer sounding cells because its notes are shorter.

### Edit bursts

| Burst | Write | Dirty coordinates | Drain | Read after |
|---|---:|---:|---:|---:|
| Native transpose, 4,096 notes | 22 ms | 262,144 | 0.54–0.59 s | 153–157 ms |
| Reconstruct, 16,384 notes | 172–174 ms | 262,144 | 0.54–0.55 s | 387–398 ms |
| Reconstruct, 65,536 notes | 707–731 ms | 262,144 | 0.84–0.86 s | 1.47–1.68 s |

Every transpose and restore read is exact. A fully sustained clip drained
1,049,473 coordinates in 1.9 s in 29 batches, the largest 41 ms.

### Observers

| Allocated | Live heap at load | Construction | Initialization |
|---:|---:|---:|---:|
| 2 | 139 MiB | 2 ms | 115 ms |
| 512 | 175 MiB | 31 ms | 156 ms |
| 1,024 | 209 MiB | 50 ms | 160 ms |
| 2,048 | 284 MiB | 91 ms | 213 ms |
| 4,096 | 422 MiB | 152 ms | 272 ms |
| 4,096, 0 cursor slots | 273 MiB | 150 ms | 264 ms |

Subscribing or unsubscribing every observer changed neither the live heap nor
CPU nor ping. In one 512-channel project, 512 observers bound with ping p95 at
23 ms. Unused handles bound in parallel at 327 ms each. A used handle needs a
canary window. The step window is global, so canary rebinds are serial at about
5.8 s each. A 512-handle rewarm would take about 50 minutes.

Warm reads slow down with the allocation. The same 4,096-note clip needed 32 ms
of enrichment host work with 2 observers, 43 ms with 512, and 211 ms with 4,096.
The first pass suspected a sum over every view in the enrichment path. The
continuation below attributes the slowdown to `physicalPending()` and records
the maintained-count fix.

### Project size

At 512 tracks by 128 scenes, inventory publication found 1,022 occupied slots in
1.28 s. Larger banks are not isolated.

## Implementation knees fixed in this pass

| Defect | Effect | Fix |
|---|---|---|
| A reconcile read past the 40 ms soft budget failed the clip | Random `INVALID` at about 3,000 coordinates per batch | Only the 50 ms hard limit fails the clip, as in enrichment |
| Each step callback and hint admission computed the full census | About 1 s host stall for 64,000 hints | An `open` gate computes no estimate; a callback uses a direct pending count |
| `addCandidateBytes` computed the combined census for each note | Quadratic enrichment; 16,384 notes took 3.5 s | No census when the combined gate is open |
| Hint transfer had no budget | 87–93 ms reconcile calls | Transfer uses half of the batch budget |
| Each reconcile batch copied the complete dirty map; the canary copied every hint | Failure at about 1 million pending coordinates | Bounded 256-coordinate slices; in-place canary walk |

`setIsSubscribed` is not available in API 25. Subscription is counted, so the
control calls `subscribe` and `unsubscribe` once on each transition.

## Exact reader findings for 8h2

- Without `adapter.hello()`, `acquire_clip_note_source` reads through pool
  cursor 0 at a 1-beat step. It truncates every onset to a whole beat and still
  reports a complete source. It must refuse when the fine reader is not set.
- The E131 source limit is 4,096 notes. The reader scans the complete clip
  before it refuses, up to 127 s in this sweep.
- E131 time grows with clip length: 40.7 s, 256 s, and 711 s at 131,072,
  524,288, and 1,048,576 steps.

## Continuation

The v8 build removes a sum over all views from each enriched coordinate.
`physicalHints` is updated when a hint is added, removed, or cleared. `info`
reports a separate recount. Poll and acquire replies carry pool counts instead
of every pool slot. Open eligibility gates compute no recorder or pending total.

The same 4,096-note fixture is exact in each row:

| Allocated observers | Warm median | Enrichment work | Reply size |
|---:|---:|---:|---:|
| 2 (v7 control) | 100 ms | 32 ms | — |
| 512 (v8) | 108 ms | About 36 ms | About 159 KB |
| 4,096 (v8) | 116 ms | About 41 ms | About 159 KB |

Before v8, the 4,096-observer row took 335 ms, with 211 ms of enrichment
work and a 408 KB reply. The allocation no longer causes that slowdown.

The zero-slot binding matrix passes at the final scene. An unused handle binds
in 1.8 s. A canary rebind takes 3.7 s. Both escape paths take 5.5 s. All four
reads are exact, all dense comparisons match, and both exact fallbacks are
exact. Ping p95 is 25 ms.

### Flat bank and project size

Both flat-bank loads allocate 512 observers with zero cursor slots. The live
heap is 328 MiB for 2,048×16 and 252 MiB for 64×512. Each bank has 32,768
slots. Their difference gives about 39 KiB per allocated bank track. The
estimated 3 KiB per slot uses a 156 MiB baseline for 512 observers and a
16×16 bank. That baseline is derived from the earlier observer loads; it is
not a separate fresh-load measurement.

With the same dense fixture bound, project growth is nearly equal:

| Flat bank | 4 total tracks | 257 total tracks | Growth for 253 new tracks |
|---|---:|---:|---:|
| 2,048×16 | 411.7 MiB | 647.5 MiB | 235.8 MiB |
| 64×512 | 335.5 MiB | 572.9 MiB | 237.4 MiB |

This supports about 0.93 MiB per project track, independent of bank shape.
The large-bank run reaches 886.6 MiB at 513 total tracks and 1,364.3 MiB at
1,025. The added objects are obfuscated host project-model classes. Slot proxy
counts do not change.

Switch callbacks drain in 74–281 ms, with up to 1,042 callbacks. Full-bank
inventory publication takes 0.08 / 0.19 / 0.29 / 0.92 s at 4 / 257 / 513 /
1,025 total tracks. The 64-track bank cannot publish complete inventory for a
257-track project. Its rerun records that refusal and still measures the heap.

The interrupted driver had two errors. Population waited for the visible bank
count to grow after the bank was full. Inventory then waited for full coverage
outside that bank. Population now uses the project item count and inserts each
new track inside the visible window. Switch measurement records the coverage
refusal before inventory polling.

### Deadlines

Replay settles in about 1.53 s even at one million sounding cells, because the
1.5 s floor dominates. Nine serial canary rebinds take 3.70–3.80 s across small
and 4,096-note clips. A 512-handle rewarm therefore needs about 32 minutes.
A per-handle deadline does not bound that complete working set.

Keep replay at 5 s, enrichment at 5 s for up to 131,072 notes, and inventory
rebuild at 40 s. The largest enrichment wall is 3.3 s; the largest inventory
publication is 0.92 s. The dense authority oracle costs about 1 s per 2,048
steps. Its large-width scan must stay outside the promoted-read deadline and
remain research only.

### Combined row

The fresh combined JVM allocates 4,096 observers, zero cursor slots, a 512×128
bank, and 4,194,304 steps. Initial live heap is 456 MiB; controller init is
362 ms, including 131 ms for cache-bank construction. Ping p95 is 23 ms.
The operator reports slow full Bitwig startup. Its wall time was not measured.
The controller init timer does not measure the complete application startup.

The owned project has 512 total tracks and 128 actual scenes. The 512 empty
observers bind in 90.1 s with 4,096 observers active. The driver uses known
unused physical handles 256–767, in 32 waves of 16. Each wave takes 2.77–2.87 s.
The largest poll batch is 41.8 ms. Ping p95 is 24.7 ms. Live heap is 1,560 MiB.
This row measures physical observers, not pool reservation throughput.

A 256-handle wave first failed `binding-budget`: separate acquire calls delayed
the first poll past 5 s. The corrected driver pumps every small wave through
`batch.run`, then checks each handle's settled phase. The 5 s deadline stays
in force. The failed attempt remains a diagnostic.

The 131,072-note fixture spans 4,194,304 steps and caps each note at one
sounding cell. Every complete and targeted read is exact. Warm median is
2.82 s, versus 3.3 s in the earlier isolated occupancy row. Ping p95 is 24.6 ms.
Heap rises from 1,745 MiB after binding to 2,009 MiB after warm reads. Retained
enrichment and publication data adds about 264 MiB, or about 2 KiB per note,
in this arm. Sounding cells are not the only large heap term.

A native +12 transpose and its restore each drain 262,144 dirty coordinates in
1.62–1.90 s. Both complete reads are exact. The largest measured heap is
2,013 MiB, only 35 MiB below the 2 GiB research stop. No sustained fixture is
added to this combined load.

Full research reconcile calls take 143 ms on the cold bind and up to 210 ms
on the edit drain. `reconcileMs` includes `status`, which calls `info` and builds
full diagnostics. `info` calls the full cache census repeatedly. The cache-work
budget is 40 ms, but the complete research call is not bounded by that budget.
The full controller-turn limit therefore does not pass at this scale. These
values select research bounds; they do not authorize promotion of this reply
path. Remove or budget the full census and historical payload before promotion.
The next storage session must also address the retained 264 MiB term.

The final scene, row 127, reads exactly in 73 ms at the combined allocation.
Its paired E131 read is exact in 2.16 s. The selected 5 / 5 / 40 s deadlines
apply to the combined arms.

The first switch to the anchor takes 10.0 s; the second takes 2.63 s. Return to
`New 2` takes 0.54–0.56 s. Each switch delivers 1,032 slot callbacks. Drain to
the last observed callback includes activation and takes 0.56–10.05 s. Complete
inventory publishes 1,019 occupied slots in 3.73 s, inside the 40 s deadline.
The heap after switching is 1,621 MiB. The driver must wait for the destination
project before it measures a quiet drain; the old check ended before activation.
The slow first switch is a combined-scale performance knee. The operator
reports: “UI seems responsive enough.”

Two fixture writers overlapped during setup. They lost one state entry and
added foreign notes. Targeted reads passed, but the full compact read detected
the extra notes. Both affected owned slots were deleted. Only the clean,
serially recreated dense fixture is retained. The driver now rejects any cold,
warm, targeted, or burst read with issues. A process lock prevents another live
driver from starting before the first exits. The failed data remains diagnostic.

## Selected research limits

These are research selections for later promotion. This session does not
change the normal runtime limits.

| Parameter | Selection | Reason |
|---|---|---|
| Clip width | 4,194,304 steps | Largest exact width; no width heap cost |
| Occupied coordinates per clip | 131,072 | Largest exact occupancy; warm read about 3.3 s |
| Resident sounding cells | Budget by cells across bound proxies; value follows 8h1b | About 350 bytes per cell; one million cells passed |
| Pending dirty coordinates | Time-bounded drain | About one million drained in 1.9 s; keep batch and ping limits |
| Allocated observers | 4,096, with a 200 ms construction budget | Largest passing allocation; construction about 150 ms |
| Bound observers | 512 demonstrated | Larger resident working sets remain limited by sounding-cell heap |
| Cursor slot bank | 0 slots | Binding matrix passes; saves about 149 MiB at 4,096 observers |
| Flat bank | At most 65,536 slots; 512×128 measured | Avoid the failed 786,000-slot load; constrain the track×scene product |
| Project size | 1,024 channels at 16 scenes; 512 total tracks at 128 scenes | Scene count and retained values also consume heap; keep the 2 GiB stop |
| Estimate gates | Remove from promotion | Full-data estimates caused host-work stalls |
| Replay / enrichment / rebuild | 5 s / 5 s / 40 s | Measured largest passing rows with margin |

The combined load confirms exact reads, selected deadlines, and sampled ping
at these values. It reaches 2,013 MiB and exposes long diagnostic calls. Its
operator rates the UI as responsive enough. 8h1b follows before promotion.

## Verification and handoff

Brain check passes with 1,843 tests. Extension check, wire goldens, context
check, and diff checks pass. Session changes are staged for review. No commit
was made. 8h1b must reduce retained read data and remove or budget the full
research diagnostics before promotion.

## Artifacts and restoration

Data is in [phase8h1a-knee](../data/phase8h1a-knee/). Files with
`diagnostic` or `superseded` in the name record failed or superseded attempts.
`brain/src/probes/phase8h1a-knee-artifacts.test.ts` recomputes the claims above
from the raw samples. The original rig config SHA-256 `256bbf07…43b0` was restored after the first
pass. The continuation restored those original bytes, removed the v8 research
archive, and deployed the normal archive after the combined row. The operator
closed the owned project without saving and replaced the controller. The UI
shows only `gn-scale-test`; its unsaved marker remains. No research wrote to
the anchor. The normal hello passes: `normal-v1`, 85 methods, hash
`bba7383dce25c0f0`. Initialization at `2026-10-05T04:23:10.842Z` is newer
than deployment. The default rig config has no shadow observers or knee
research flag. `continuation/restoration.json` records the restored identity.
