---
title: E225 — Cache limit knee sweep, first pass
kind: evidence
state: active
updated: 2026-10-05
owner: phase-8h1a
---

# E225 — Cache limit knee sweep, first pass

## Status

[8h1a](../../plan/phase-8/8h1a-cache-limit-knee-sweep.md) is partly complete.
This pass found the memory model of the shadow cache and four implementation
knees. It did not select final limits. Open rows are listed at the end. All live
cache results keep `complete:false` and `eligible:false`. E131 keeps stable
authority.

The middle allocation crashed Bitwig with a control-surface
`OutOfMemoryError`. Recovery restored protected `New 3`.
[D29](../../decisions/d29-saved-anchor-project-replaces-protected-new-3.md)
then replaced the protected project with the saved anchor `gn-scale-test`, so a
Bitwig restart is allowed. Later series used a fresh JVM for each load.

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
| Flat bank and project | Large; not isolated | The heap rose from 1.0 to 2.0–2.7 GiB when the project grew to 512 channels |

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
nothing bound. The full binding matrix with 0 cursor slots is not rerun.

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
The suspected cause is in this code: each enriched coordinate checks
`eligibility`, which calls `recorderTotal`, which sums the hint queues of every
view. This is not yet measured.

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

## Draft limit table

| Parameter | Draft | Reason | State |
|---|---|---|---|
| Clip width | 4,194,304 steps | No cost through the largest test | Selected |
| Resident sounding cells | A budget, about 3 million per GiB | 350 bytes per cell per bound proxy | Value open |
| Occupied coordinates per clip | No host knee through 131,072 | Speed rule open | Open |
| Pending dirty coordinates | Time-bounded drain | 1 million drained in 1.9 s within batch limits | Design for 8h1 |
| Allocated observers | About 1,024 for a 50 ms construction budget | Warm-read slowdown unattributed | Open |
| Cursor slot bank | 0 slots | Saves half the cost per observer | Binding matrix open |
| Flat bank | Not isolated | Large heap term | Open |
| Estimate gates | Remove | Their computation cost grew with the data | Selected |
| Deadlines | Not derived | Rebind serialization dominates | Open |

## Open rows

1. Attribute the warm-read slowdown with 4,096 allocated observers.
2. Rerun the binding matrix with 0 cursor slots: high rows, canary rebinds,
   the dense comparison path, and exact fallback.
3. Isolate the flat bank: tracks and scenes separately, and a project switch.
4. Derive replay, enrichment, and rebuild deadlines; measure serial rebinds.
5. Run one combined arm near the selected values in a fresh JVM, with an
   operator rating of UI responsiveness.

## Artifacts and restoration

Data is in [phase8h1a-knee](../data/phase8h1a-knee/). Files with
`diagnostic` or `superseded` in the name record failed or superseded attempts.
`brain/src/probes/phase8h1a-knee-artifacts.test.ts` recomputes the claims above
from the raw samples. The original rig config SHA-256 `256bbf07…43b0` is
restored. The research archive is removed and the normal extension is deployed.
