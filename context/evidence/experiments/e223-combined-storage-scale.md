---
title: E223 — Combined storage and topology scale
kind: evidence
state: active
updated: 2026-10-04
owner: phase-8g5c
---

# E223 — Combined storage and topology scale

## Status

[8g5c](../../plan/phase-8/8g5c-combined-storage-limit.md) is complete.
The operator confirmed the owned fixture New 8 and all completed controller
replacements. Three empty samples each pass at original capacities 0, 16, 64,
and 256. The quadratic route is too costly to load at 512. The counted route
has three fresh empty samples at 512 and three fresh disabled controls.

Flat, wide, nested, native move, collapse, expansion, and ungroup controls pass
at 256 instrument/audio tracks plus FX, Master, and up to two group wrappers.
Collapsed primary rebinding refuses `binding-budget`. The flat 512-channel
boundary and whole-project refusal at 513 pass. Three populated fresh-load
samples pass. Counted 512-channel capacity and a 24 MiB combined estimate limit
are implemented. Model boundaries pass. C3 content checks pass, but its ledger
verifier found an incomplete fingerprint reservation. C4 reserves the complete
witness. Live combined equality, two-byte excess, independent exact fallback,
recovery, JVM sampling, and eviction pass. The first owned clip is restored.
Final normal reload, the protected baseline check, and owned fixture discard pass.
All cache results keep `complete:false` and `eligible:false`. Do not enter 8h.

Entry HEAD is `bcfb5f4`. The entry index and worktree were clean. The earlier
NOW statement about staged 8g5b changes was stale. No entry changes needed
preservation in the index.

## Prepared controls

The research marker is `8g5c-allocation-v1`. The definition version is
`0.0.1-8g-controls-8g5c-allocation-1`. The original research archive was deployed with
SHA-256 `7cb670c478419f9eb4c3b4c02df41855cd184b21e04e500c905efcd74cd67df6`.
Research hello passes: profile `phase-8-probe-v1`, 97 methods, hash
`f03f19414f40e3d3`, expected marker, and fresh initialization
`2026-10-03T13:57:09.227Z` for the third capacity-256 sample. Freshness was checked against
the research archive and the preceding initialization.

`cacheTopologyTracks` selects 0, 16, 64, 256, or 512 for the sweep. Zero omits
topology allocation. The default remains 16. Other sweep settings stay equal:
512 flat bank tracks, 128 scenes, two shadow observers, lifecycle research,
delivery research, and `ALL_CHANNELS`. Slot observation uses the existing flat
bank. Topology and slot admission use the same configured capacity.

The present design allocates one root bank, one child bank for each flat bank
index, and one diagnostic parent handle for each index. These counts are source
calculations, not live allocation measurements:

| Capacity | Banks | Bank track handles | Parent handles |
|---:|---:|---:|---:|
| 0 | 0 | 0 | 0 |
| 16 | 17 | 272 | 16 |
| 64 | 65 | 4,160 | 64 |
| 256 | 257 | 65,792 | 256 |
| 512 | 513 | 262,656 | 512 |

The sweep allocates 512 indexed slot observers over 65,536 slot handles in each
arm. That is larger than the entry rig. The disabled-topology control permits
comparison at equal slot capacity.

`allocationStats` is an operation on the existing research `cache.shadow`
method. It reports shared JVM used, committed, and maximum heap bytes.
Topology construction records time and JVM values before and after allocation.
Topology reads report their elapsed time. These JVM values do not measure
topology-owned memory. No garbage collection is forced.

The [driver](../../../brain/src/probes/phase8g5c-storage.ts) checks the profile,
method count/hash, marker, full config, and initialization time. Initialization
must follow both the prior sample and the deployed research archive. Each
sample records the archive hash. It also records Bitwig process RSS and CPU
time before and after five seconds without bridge reads. CPU use comes from
the change in cumulative CPU time. The lifetime CPU percentage is raw data only.
Process RSS cannot establish topology-owned allocation.

A cold sample means a fresh controller in the shared JVM. A fresh JVM is not
measured. Restarting Bitwig would discard protected unsaved New 3.

## Entry and restoration state

The [entry baseline](../data/phase8g5c-storage/entry-baseline.json) matches the
adopted [New 3 baseline](../data/phase8g5a-group/new3-baseline.json). Normal hello
passed with 85 methods, hash `bba7383dce25c0f0`, and initialization time
`2026-10-03T09:22:01.778Z`. New 3 has not been saved or closed.

[Entry bytes](../data/phase8g5c-storage/entry.json) preserve the original config
with SHA-256 `256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.
The disk config is restored to these exact bytes. The normal archive is deployed.
The [normal deployment](../data/phase8g5c-storage/normal-deployment.json) pins its
hash and time after the completed C4 budget trial. The operator confirmed normal replacement and discarded New 8 without saving.
The protected New 3 check passes.

New 8 was confirmed as the owned fixture. Its
[initial baseline](../data/phase8g5c-storage/new8-baseline.json) records four
UUID-bearing tracks, eight scenes, and zero occupied slots. The session then
created 508 tracks and six clips. Both group wrappers and the capacity-excess
track were removed by their proved UUIDs. Before final discard, New 8 has 512
flat channels and six occupied slots. Its first row-0 clip has all 64 original
notes and unchanged metadata. The final budget journal proves this restoration.

## Live controls

The [first sample](../data/phase8g5c-storage/empty-0-1.json) has SHA-256
`5c7c5d4eb0ff8bba3c1a66accc5d186413c10dfbe0a405cbe66345e9707ee1b4`.
It measures unused rig capacity in the operator-declared empty New 8 fixture.
Topology allocation is disabled. The first sample values are:

| Quantity | Value | Scope |
|---|---:|---|
| Rig construction | 105.856 ms | Fresh controller, shared JVM |
| Initialization | 125.414 ms | Fresh controller, shared JVM |
| JVM used heap, sample start/end | 450 / 452 MiB | Shared JVM; sampled after initialization |
| Host RSS, start/end | 1,296.328 / 1,296.266 MiB | Main host process |
| Audio engine RSS, start/end | 149.609 / 149.609 MiB | Separate audio engine process |
| Idle interval | 5.042 s | No bridge reads in the interval |
| Host idle CPU | 4.562% | One core is 100% |
| Audio engine idle CPU | 3.967% | One core is 100% |

The launcher process is reported separately in the raw sample. RSS is not a
heap measurement. The verifier recomputes CPU from cumulative time and checks
freshness, config, capacities, and method identity. False freshness, wrong
project, partial track windows, false CPU summaries, and changed rig settings
refuse in the focused tests.

The [second sample](../data/phase8g5c-storage/empty-0-2.json) has SHA-256
`e11559bc8ddc75fed3f2a2a3d6045adfd40f76c77ea6fc978721c43a0c96e4fe`.
Its config and ordered track UUIDs equal the first sample. The same host and
audio engine processes stayed alive. The controller has a new initialization.

| Quantity | Second sample |
|---|---:|
| Rig construction | 52.254 ms |
| Initialization | 53.527 ms |
| JVM used heap, sample start/end | 594 / 594 MiB |
| Main host RSS, start/end | 1,448 / 1,447.969 MiB |
| Audio engine RSS, start/end | 149.594 / 149.594 MiB |
| Host idle CPU | 5.358% |
| Audio engine idle CPU | 4.564% |

The [third sample](../data/phase8g5c-storage/empty-0-3.json) has SHA-256
`379765c72178d455f5133bb74efd39547e7d002dbee819547f5e9a8e47257fe1`.
Its config and ordered track UUIDs equal the other controls. The controller
initialization is new; the host and audio engine processes are unchanged.

| Quantity | Third sample |
|---|---:|
| Rig construction | 40.739 ms |
| Initialization | 41.980 ms |
| JVM used heap, sample start/end | 890 / 892 MiB |
| Main host RSS, start/end | 1,582.453 / 1,583.813 MiB |
| Audio engine RSS, start/end | 149.625 / 149.625 MiB |
| Host idle CPU | 5.357% |
| Audio engine idle CPU | 4.563% |

Initialization ranges from 41.980 to 125.414 ms, with median 53.527 ms in three
samples. Rig construction ranges from 40.739 to 105.856 ms, with median
52.254 ms. The JVM is shared and is not restarted. Heap and RSS variation
cannot be attributed to topology allocation, which is disabled in all three
samples. The remaining enabled-topology samples are pending.

The [artifact index](../data/phase8g5c-storage/artifacts.json) pins twenty raw files, including the new deployment and diagnostic records.
The [verifier](../../../brain/src/probes/phase8g5c-storage-artifacts.ts) checks
their bytes, recomputes every control, checks unique initialization times and
equal fixture UUIDs, and reports the measured arms. It grants no populated scale
or combined storage acceptance. Run it from `brain/` with
`node --import tsx src/probes/phase8g5c-storage-artifacts.ts`.

## First enabled allocation

The [first capacity-16 sample](../data/phase8g5c-storage/empty-16-1.json) has
SHA-256 `a243822d4b62d874a9d3e7a7b229f47bf1b0b6e009a40b0a71ba6bd088dc6f29`.
Its four flat UUIDs and root UUIDs equal the independent New 8 baseline. No group
is declared or reported. Both raw candidate reads agree. The membership callback
count is 1,618 before and after the read; it includes initialization callbacks.
No native topology change is measured in this sample.

| Quantity | First capacity-16 sample |
|---|---:|
| Topology banks / bank track handles / parent handles | 17 / 272 / 16 |
| Topology construction | 3.007750 ms |
| JVM used heap immediately before/after topology construction | 812 / 816 MiB |
| Rig construction / total initialization | 39.696 / 41.377 ms |
| Membership snapshot read | 0.532041 ms |
| JVM used heap, sample start/end | 864 / 866 MiB |
| Main host RSS, start/end | 1,674.750 / 1,674.719 MiB |
| Audio engine RSS, start/end | 149.641 / 149.641 MiB |
| Host / audio engine idle CPU | 4.958% / 4.165% |

Read time covers the membership snapshot. Candidate diagnostics and bridge time
are outside that measurement. The JVM samples cover the shared JVM. Their
4 MiB change during construction is not a topology-owned heap measurement.
One enabled sample cannot establish initialization variation or populated scale.
The empty-tree verifier checks UUIDs, order, group flags, complete banks, and
callback equality. Missing roots, reversed rows, foreign children, callback
changes, and false ordering claims refuse in focused tests.

## Second enabled allocation

The [second capacity-16 sample](../data/phase8g5c-storage/empty-16-2.json) has
SHA-256 `39ef041f7efbcbeb5dc70ae3232b8fe8dea902826729e0138c0a0ac71aacc511`.
The config, archive, process IDs, and ordered fixture UUIDs match the first
sample. The four roots match the independent baseline. Both raw candidate
reads agree. The callback count remains 1,618 across the membership read.

| Quantity | Second capacity-16 sample |
|---|---:|
| Topology banks / bank track handles / parent handles | 17 / 272 / 16 |
| Topology construction | 1.231291 ms |
| JVM used heap immediately before/after topology construction | 846 / 850 MiB |
| Rig construction / total initialization | 52.483 / 54.296 ms |
| Membership snapshot read | 0.363834 ms |
| JVM used heap, sample start/end | 634 / 634 MiB |
| Main host RSS, start/end | 1,359.453 / 1,359.453 MiB |
| Audio engine RSS, start/end | 70.266 / 70.297 MiB |
| Host / audio engine idle CPU | 4.765% / 4.169% |
| Idle interval | 5.037 s |

The audio engine process is unchanged, but its RSS is lower than in the first
sample. Shared JVM used heap is also lower. No collection or process restart
was requested. These values do not measure topology-owned allocation. The
third capacity-16 sample and all larger capacities remain pending.

## Third enabled allocation and capacity-16 variation

The [third capacity-16 sample](../data/phase8g5c-storage/empty-16-3.json) has
SHA-256 `df2e234ea2bbf41e1c429dc8ed09d68ab4b8e81b72a98e128119496d8d4929c0`.
Its config and four UUIDs match the preceding samples. Both candidate reads
agree. The membership callback count remains 1,618 across the read.

| Quantity | Third capacity-16 sample |
|---|---:|
| Topology banks / bank track handles / parent handles | 17 / 272 / 16 |
| Topology construction | 0.974250 ms |
| JVM used heap immediately before/after topology construction | 840 / 842 MiB |
| Rig construction / total initialization | 45.967 / 47.381 ms |
| Membership snapshot read | 0.752833 ms |
| JVM used heap, sample start/end | 884 / 886 MiB |
| Main host RSS, start/end | 1,455.422 / 1,456.422 MiB |
| Audio engine RSS, start/end | 70.766 / 70.781 MiB |
| Host / audio engine idle CPU | 4.976% / 3.981% |
| Idle interval | 5.024 s |

Capacity-16 initialization ranges from 41.377 to 54.296 ms, with median
47.381 ms. Topology construction ranges from 0.974250 to 3.007750 ms, with
median 1.231291 ms. Membership reads range from 0.363834 to 0.752833 ms, with
median 0.532041 ms. Shared JVM and whole-process values cannot establish
exclusive topology allocation. All larger capacities remain unmeasured.

## First capacity-64 allocation

The [first capacity-64 sample](../data/phase8g5c-storage/empty-64-1.json) has
SHA-256 `26967a29554d8ac79e48f05b29cfa74beb3a8d541237573bc5d3819058fa78fa`.
The four flat UUIDs and root UUIDs match the independent New 8 baseline.
Both candidate reads agree. The membership callback count remains 21,730
across the read. It includes initialization callbacks; no native topology
change is measured here. The host and audio engine process IDs are unchanged.

| Quantity | First capacity-64 sample |
|---|---:|
| Topology banks / bank track handles / parent handles | 65 / 4,160 / 64 |
| Topology construction | 11.263666 ms |
| JVM used heap immediately before/after topology construction | 864 / 910 MiB |
| Rig construction / total initialization | 48.736 / 50.091 ms |
| Membership snapshot read | 0.741375 ms |
| JVM used heap, sample start/end | 950 / 952 MiB |
| Main host RSS, start/end | 1,591.250 / 1,591.688 MiB |
| Audio engine RSS, start/end | 71.984 / 71.938 MiB |
| Host / audio engine idle CPU | 5.160% / 4.167% |
| Idle interval | 5.039 s |

The 46 MiB shared JVM change during topology construction is not an exclusive
allocation measurement. This arm still uses the empty fixture. Two more fresh
initializations at this capacity and all larger arms remain pending.

## Second capacity-64 allocation

The [second capacity-64 sample](../data/phase8g5c-storage/empty-64-2.json) has
SHA-256 `d4a50e34a587d564af9f3befec1b9d3b5e63902fe50639b233e797be5c82bec6`.
The config, archive, process IDs, and four ordered UUIDs match the first sample.
Both candidate reads agree. The four roots match the independent baseline.
The membership callback count remains 21,730 across the read.

| Quantity | Second capacity-64 sample |
|---|---:|
| Topology banks / bank track handles / parent handles | 65 / 4,160 / 64 |
| Topology construction | 9.928458 ms |
| JVM used heap immediately before/after topology construction | 862 / 906 MiB |
| Rig construction / total initialization | 56.046 / 57.176 ms |
| Membership snapshot read | 0.573792 ms |
| JVM used heap, sample start/end | 950 / 952 MiB |
| Main host RSS, start/end | 1,659.125 / 1,660.203 MiB |
| Audio engine RSS, start/end | 72.391 / 72.375 MiB |
| Host / audio engine idle CPU | 5.175% / 3.981% |
| Idle interval | 5.024 s |

These values retain the same shared JVM and process attribution limits. The
third capacity-64 initialization and the larger arms remain pending. No
populated fixture or native topology change is measured in this sample.

## Third capacity-64 allocation and variation

The [third capacity-64 sample](../data/phase8g5c-storage/empty-64-3.json) has
SHA-256 `ad62d10dc816126c2a0ba1da7f51455ce77ab1976f8c6e851a1ac86e25f5c04e`.
The config, archive, process IDs, and four ordered UUIDs match the other samples.
Both candidate reads agree. The four roots match the independent baseline.
The membership callback count remains 21,730 across the read.

| Quantity | Third capacity-64 sample |
|---|---:|
| Topology banks / bank track handles / parent handles | 65 / 4,160 / 64 |
| Topology construction | 13.653750 ms |
| JVM used heap immediately before/after topology construction | 618 / 664 MiB |
| Rig construction / total initialization | 109.148 / 110.265 ms |
| Membership snapshot read | 1.317625 ms |
| JVM used heap, sample start/end | 636 / 638 MiB |
| Main host RSS, start/end | 1,411.891 / 1,411.828 MiB |
| Audio engine RSS, start/end | 78.797 / 78.750 MiB |
| Host / audio engine idle CPU | 5.164% / 4.369% |
| Idle interval | 5.035 s |

Capacity-64 initialization ranges from 50.091 to 110.265 ms, with median
57.176 ms. Topology construction ranges from 9.928458 to 13.653750 ms, with
median 11.263666 ms. Membership reads range from 0.573792 to 1.317625 ms,
with median 0.741375 ms. The third initialization occurred more than two hours
after the second. The JVM and host processes stayed alive. The shared memory
values cannot establish exclusive allocation. Larger arms remain unmeasured.

## First capacity-256 allocation

The [first capacity-256 sample](../data/phase8g5c-storage/empty-256-1.json) has
SHA-256 `03b6aa0a17ec3aa36571c2fae32df28aec986857a98287d9ede785f6a4a2cc74`.
The four flat UUIDs and roots match the independent New 8 baseline. Both
candidate reads agree. The membership callback count remains 332,578 across
the read. It includes initialization callbacks; no native topology change is
measured. The host and audio engine process IDs are unchanged.

| Quantity | First capacity-256 sample |
|---|---:|
| Topology banks / bank track handles / parent handles | 257 / 65,792 / 256 |
| Topology construction | 149.977083 ms |
| JVM used heap immediately before/after topology construction | 904 / 1,290 MiB |
| Rig construction / total initialization | 202.867 / 203.971 ms |
| Membership snapshot read | 1.220500 ms |
| JVM used heap, sample start/end | 1,308 / 1,310 MiB |
| Main host RSS, start/end | 2,258.547 / 2,258.438 MiB |
| Audio engine RSS, start/end | 79.875 / 79.828 MiB |
| Host / audio engine idle CPU | 5.573% / 4.180% |
| Idle interval | 5.024 s |

The construction time is substantially higher than the capacity-64 samples.
This value measures initial topology allocation, not an incremental cache-bank
build. The 386 MiB shared JVM change is not an exclusive allocation
measurement. The empty-tree result does not accept the current quadratic design
for populated scale. Repeat this arm and measure the 512-channel candidate
before selecting the final design and capacity.

## Second capacity-256 allocation

The [second capacity-256 sample](../data/phase8g5c-storage/empty-256-2.json) has
SHA-256 `3e24f4894062029ff4ee1c4562e293d9506dbbcebd710f35fd14131381705e52`.
The config, archive, process IDs, and four ordered UUIDs match the first sample.
Both candidate reads agree. The four roots match the independent baseline.
The membership callback count remains 332,578 across the read.

| Quantity | Second capacity-256 sample |
|---|---:|
| Topology banks / bank track handles / parent handles | 257 / 65,792 / 256 |
| Topology construction | 152.139125 ms |
| JVM used heap immediately before/after topology construction | 1,570 / 2,298 MiB |
| Rig construction / total initialization | 189.331 / 190.333 ms |
| Membership snapshot read | 1.866334 ms |
| JVM used heap, sample start/end | 2,240 / 2,242 MiB |
| JVM maximum heap | 3,072 MiB |
| Main host RSS, start/end | 3,012.297 / 3,012.219 MiB |
| Audio engine RSS, start/end | 79.859 / 79.844 MiB |
| Host / audio engine idle CPU | 4.975% / 3.980% |
| Idle interval | 5.025 s |

The shared JVM values include other allocations and previous controller
lifetimes. The 728 MiB change during construction is not an exclusive topology
measurement. Both capacity-256 construction samples exceed 149 ms. Complete
the third sample, then assess this quadratic design before loading capacity
512. The final design must still support the required base tracks and extra
channels. A changed design requires fresh correctness and cost measurements.
No populated scale or storage result is accepted.

## Third capacity-256 allocation and variation

The [third capacity-256 sample](../data/phase8g5c-storage/empty-256-3.json) has
SHA-256 `1cda90108a719a06589a8d5d4b60552c0a977a9a9535f04990c66c39515174dd`.
The config, archive, process IDs, and four ordered UUIDs match the other samples.
Both candidate reads agree. The four roots match the independent baseline.
The membership callback count remains 332,578 across the read.

| Quantity | Third capacity-256 sample |
|---|---:|
| Topology banks / bank track handles / parent handles | 257 / 65,792 / 256 |
| Topology construction | 269.520416 ms |
| JVM used heap immediately before/after topology construction | 2,552 / 2,270 MiB |
| Rig construction / total initialization | 322.914 / 324.243 ms |
| Membership snapshot read | 0.834958 ms |
| JVM used heap, sample start/end | 2,184 / 2,186 MiB |
| JVM maximum heap | 3,072 MiB |
| Main host RSS, start/end | 3,776.328 / 3,776.281 MiB |
| Audio engine RSS, start/end | 79.891 / 79.844 MiB |
| Host / audio engine idle CPU | 5.175% / 3.981% |
| Idle interval | 5.024 s |

Capacity-256 initialization ranges from 190.333 to 324.243 ms, with median
203.971 ms. Topology construction ranges from 149.977083 to 269.520416 ms,
with median 152.139125 ms. Membership reads range from 0.834958 to 1.866334 ms,
with median 1.220500 ms. Shared JVM used heap fell during the third
construction. No collection was requested. These values cannot establish
exclusive topology allocation or a retained allocation delta.

## Smaller research route prepared for 512

The original route allocates 65,792 bank track handles at 256. Its three
construction samples all exceed 149 ms. At 512 it would allocate 262,656
handles and 512 diagnostic parents. Do not load that quadratic arm before
changing the design. This is a measured reason to change the allocation route;
it does not select a smaller final track limit or establish a 512-channel result.

The prepared route allocates one root bank and one single-handle child bank
per flat index. It allocates no diagnostic parent handles. At 512 it has 513
banks and 1,024 bank track handles. These are source counts, not live costs.
The default route and topology capacity remain unchanged until live acceptance.

The official local API 25 `Bank.itemCount()` reports the underlying total count,
including items outside its window. The new route reads each group's direct
bank count. It requests the last bank offset once and refuses while that
window is pending. At the observed offset it requires the owner's UUID and
both group flags false. A missing or foreign master witness refuses. The
route requires the master to be last; the earlier route was position independent.
This restriction must be checked in the new live fixtures.

After this witness, count minus one gives the direct degree. Flat UUID preorder
and all direct degrees determine one ordered forest: each row fills the next
parent's available child position. The route checks the resulting root UUIDs
against the separate root bank and requires complete closure. UUIDs come from
the flat bank; occupancy supplies no identity. Two independent reads must agree
within the callback sequence. Degree, flat order, root, group, or window callbacks
retire cache state. A boundary move can preserve flat order but changes degrees.
Native changes must prove that retirement live. No host-input ordering is claimed.

The [deployment record](../data/phase8g5c-storage/counted-deployment.json) pins
marker `8g5c-counted-allocation-v2`, definition `0.0.1-8g-controls-8g5c-counted-2`,
archive SHA-256 `193162d254b012d23212d741363a1ee82799d4cc333bc4c4006e76444375d715`,
and the counted-512 config. The archive is deployed. Its first fresh hello and empty measurement pass
below. Populated route acceptance remains open.

The driver accepts `counted-<capacity>` for config and sample capacity arguments.
The verifier checks its distinct marker, config, route, handle counts, and UUID
oracle. The artifact summary keeps original and counted samples in separate
arms. It grants no populated scale or storage acceptance. Measure three fresh
counted-512 empty initializations, then repeat affected populated correctness,
callback, settlement, retirement, and cost checks. Include a disabled-topology
control with the new build. The 256 base-track minimum and extra channel
capacity remain required.

## First counted-512 allocation

The operator confirmed replacement. Hello passes with 97 methods, hash
`f03f19414f40e3d3`, marker `8g5c-counted-allocation-v2`, and fresh initialization
`2026-10-03T14:30:20.894Z`. The
[completed sample](../data/phase8g5c-storage/counted-empty-512-1.json) has SHA-256
`ef58ecd68c6c3501946831b5e6aa4f6a164861a7f2d9baabad5dbebdfb1ef51a`.
Its four flat UUIDs and roots match the independent baseline. Both candidate
reads agree. The callback count remains 9,750 across the membership read.
This count includes initialization; no native change is measured.

| Quantity | First counted-512 sample |
|---|---:|
| Topology banks / bank track handles / parent handles | 513 / 1,024 / 0 |
| Topology construction | 7.028791 ms |
| JVM used heap immediately before/after topology construction | 1,284 / 1,296 MiB |
| Rig construction / total initialization | 77.467 / 99.537 ms |
| Membership snapshot read | 1.503625 ms |
| JVM used heap, sample start/end | 1,360 / 1,362 MiB |
| Main host RSS, start/end | 2,052.438 / 2,053.547 MiB |
| Audio engine RSS, start/end | 79.047 / 79.047 MiB |
| Host / audio engine idle CPU | 5.175% / 3.981% |
| Idle interval | 5.024 s |

The host and audio engine process IDs are unchanged. The 12 MiB shared JVM
change during construction is not an exclusive allocation measurement. This
fixture has no groups. It proves the empty route at configured capacity, not
populated scale or group membership. Two more fresh counted-512 samples and
the new-build disabled control remain pending.

### Format-revision diagnostic

The [first attempt](../data/phase8g5c-storage/counted-empty-512-1-diagnostic.json)
has SHA-256 `11080bb4b70fccd90fdae41c588c6ef1b4d1cf555d0f51c9dc5b201f3b0718b8`.
It stopped before process and idle measurements. The TypeScript verifier
expected the new build marker in `allocationStats.revision`. That field still
reports the allocation format revision `8g5c-allocation-v1`. The deployed handler
uses this same format for both routes. The sampler now stores the build marker
from probe info in a separate field and checks it independently. Wrong format,
wrong marker, missing counted marker, and wrong route still refuse.

No Java code or archive changed for this correction. The completed attempt
uses the same confirmed fresh controller initialization. Both raw files are
pinned. The verifier binds them to equal config, UUIDs, and initialization time.
It excludes the refused attempt from sample counts. There is one counted-512
initialization, not two. The completed idle interval has no bridge traffic.

## Second counted-512 allocation

The [second counted-512 sample](../data/phase8g5c-storage/counted-empty-512-2.json)
has SHA-256 `3284189e1c2115f7472f3e59c43dda9b7782e395453a79c3d87937c590179104`.
Hello passes with the new marker and fresh initialization
`2026-10-03T14:40:47.994Z`. The config, archive, process IDs, and four ordered
UUIDs match the first sample. Both candidate reads agree. The four roots
match the independent baseline. The callback count remains 9,750 across the read.

| Quantity | Second counted-512 sample |
|---|---:|
| Topology banks / bank track handles / parent handles | 513 / 1,024 / 0 |
| Topology construction | 4.525041 ms |
| JVM used heap immediately before/after topology construction | 1,506 / 1,518 MiB |
| Rig construction / total initialization | 55.036 / 56.438 ms |
| Membership snapshot read | 3.460166 ms |
| JVM used heap, sample start/end | 1,538 / 1,540 MiB |
| Main host RSS, start/end | 2,248.484 / 2,249.594 MiB |
| Audio engine RSS, start/end | 79.078 / 79.063 MiB |
| Host / audio engine idle CPU | 5.174% / 3.980% |
| Idle interval | 5.025 s |

These are shared JVM and whole-process samples. The 12 MiB change during
construction is not an exclusive allocation measurement. The third counted-512
sample and the new-build disabled control remain pending. This fixture has no
groups; populated scale and group correctness remain open.

## Third counted-512 allocation and variation

The [third counted-512 sample](../data/phase8g5c-storage/counted-empty-512-3.json)
has SHA-256 `0b1dda2fd6b60e127c7c68d69e3ef83ec3ec359af7aad203a998b8f83816cd24`.
Hello passes with the new marker and fresh initialization
`2026-10-03T14:48:47.567Z`. The config, archive, process IDs, and four ordered
UUIDs match the other samples. Both candidate reads agree. The four roots
match the independent baseline. The callback count remains 9,750 across the read.

| Quantity | Third counted-512 sample |
|---|---:|
| Topology banks / bank track handles / parent handles | 513 / 1,024 / 0 |
| Topology construction | 3.728208 ms |
| JVM used heap immediately before/after topology construction | 1,738 / 1,750 MiB |
| Rig construction / total initialization | 65.837 / 67.064 ms |
| Membership snapshot read | 1.202625 ms |
| JVM used heap, sample start/end | 1,770 / 1,772 MiB |
| Main host RSS, start/end | 2,520.484 / 2,521.672 MiB |
| Audio engine RSS, start/end | 79.109 / 79.078 MiB |
| Host / audio engine idle CPU | 6.169% / 3.980% |
| Idle interval | 5.025 s |

Counted-512 initialization ranges from 56.438 to 99.537 ms, with median
67.064 ms. Topology construction ranges from 3.728208 to 7.028791 ms, with
median 4.525041 ms. Membership reads range from 1.202625 to 3.460166 ms, with
median 1.503625 ms. The artifact verifier marks this empty arm measured.
Populated scale and combined storage acceptance remain false.

The new-build control uses the same rig settings and counted flag, with zero
topology capacity. Repeat it three times to report variation within this build.
The original disabled controls remain a separate arm. Do not subtract shared
JVM or process values to claim exclusive topology allocation.

## First new-build disabled control

The [first disabled control](../data/phase8g5c-storage/counted-empty-0-1.json)
has fresh initialization `2026-10-03T15:03:07.314Z`. The marker, research
profile, archive, and counted config pass. Topology allocation is absent.
The four fixture UUIDs and eight scenes remain unchanged. The rig still has
512 indexed slot observers over 65,536 slot handles.

| Quantity | First new-build disabled control |
|---|---:|
| Rig construction / total initialization | 32.864 / 34.161 ms |
| JVM used heap, sample start/end | 680 / 680 MiB |
| Main host RSS, start/end | 2,508.750 / 2,508.719 MiB |
| Audio engine RSS, start/end | 79.172 / 79.125 MiB |
| Host / audio engine idle CPU | 4.969% / 4.174% |
| Idle interval | 5.031 s |

Shared JVM heap has fallen since the preceding sample. No forced collection
or process restart occurred. These values cannot measure exclusive topology
memory. Two more fresh controls remain pending.

## Second new-build disabled control

The [second disabled control](../data/phase8g5c-storage/counted-empty-0-2.json)
has SHA-256 `c9e044316dbd55d949ca2809f6b20817ec53eceeb5e49c44073bb3e607aaad33`.
Hello passes with the research profile, 97 methods, the new marker, and fresh
initialization `2026-10-03T15:16:02.277Z`. The archive, config, process IDs,
four fixture UUIDs, and eight scenes match. No topology is allocated.

| Quantity | Second new-build disabled control |
|---|---:|
| Rig construction / total initialization | 33.438 / 35.179 ms |
| JVM used heap, sample start/end | 572 / 572 MiB |
| Main host RSS, start/end | 1,728.453 / 1,728.453 MiB |
| Audio engine RSS, start/end | 78.859 / 78.859 MiB |
| Host / audio engine idle CPU | 4.964% / 4.170% |
| Idle interval | 5.036 s |

One final fresh control remains pending. Shared JVM and process values do not
measure exclusive topology memory. No fixture content changed.

## Third new-build disabled control and variation

The [third disabled control](../data/phase8g5c-storage/counted-empty-0-3.json)
has SHA-256 `98ab8396c4376e13ee0cf2888bec467b813d161686b89d91b707714d0a73546a`.
Hello passes with the same profile, method table, marker, archive, config, and
fixture UUIDs. Its fresh initialization is `2026-10-03T15:18:34.883Z`.
No topology is allocated. No fixture content changed.

| Quantity | Third new-build disabled control |
|---|---:|
| Rig construction / total initialization | 34.910 / 36.017 ms |
| JVM used heap, sample start/end | 836 / 836 MiB |
| Main host RSS, start/end | 1,713.281 / 1,713.281 MiB |
| Audio engine RSS, start/end | 78.906 / 78.859 MiB |
| Host / audio engine idle CPU | 5.161% / 4.168% |
| Idle interval | 5.038 s |

Both new-build arms now have three fresh samples with equal rig settings.
Each uses a fresh controller in the same JVM. The sampler requests no forced
collection. Shared JVM and process values do not measure exclusive topology
memory.

| Timing (ms) | Disabled control, min / median / max | Counted-512, min / median / max |
|---|---:|---:|
| Total initialization | 34.161 / 35.179 / 36.017 | 56.438 / 67.064 / 99.537 |
| Rig construction | 32.864 / 33.438 / 34.910 | 55.036 / 65.837 / 77.467 |
| Topology construction | Not allocated | 3.728208 / 4.525041 / 7.028791 |
| Membership read | Not allocated | 1.202625 / 1.503625 / 3.460166 |

The artifact verifier marks the new-build control and counted-512 empty arm
measured. Populated scale and combined storage acceptance remain false.
Disk config is restored to counted-512, SHA-256 `caacbe1f…26d91`. Runtime
still uses counted-0 until the next operator replacement.

## Prepared flat population driver

The [driver](../../../brain/src/probes/phase8g5c-scale.ts) requires the counted-512
runtime and the exact empty New 8 baseline. It records mutation intent before
each native API Instrument create. A bounded census must prove one new UUID,
with every prior UUID, name, type, and relative order preserved. Each mutation
and observed placement stays in the journal. It stops at 256 instrument/audio
tracks, with the baseline FX and Master channels retained. The flat topology
oracle comes from the baseline and these census deltas, outside the topology
candidate. No population command has run. Slot scale, groups, and native
retirement remain open.
The driver requires initialization after the final disabled control and the
same initialization throughout population. A controller change stops the run.

## Populated flat fixture

Fresh hello passes at `2026-10-03T15:24:30.361Z`, with the counted-512 config,
research profile, 97 methods, hash `f03f19414f40e3d3`, and the counted marker.
The [population journal](../data/phase8g5c-storage/flat-population.json.gz)
proves 254 Instrument creates. Each adds one UUID and preserves all prior
UUIDs, names, types, and relative order. The two initial base tracks remain.
The result has 256 instrument/audio tracks, FX, and Master: 258 channels.
Creation took 125.898 s. The flat tree matches the independent census.
Delivered topology callbacks rise from 9,750 to 12,290.

The [empty check](../data/phase8g5c-storage/flat-empty-check.json.gz) measures
the populated fixture after creation. Its initialization values were captured
while the fixture was empty; they are not populated cold-initialization costs.
No host process restart or forced JVM collection occurred.

| Quantity | Populated flat fixture |
|---|---:|
| Three topology reads | 3.152500 / 1.816625 / 1.091000 ms |
| Callback sequence during all three reads | 12,290, unchanged |
| Full stable rig slot scans, before/after | 30.026 / 21.537 ms |
| Empty occupancy rebuild, wall time | 973 ms |
| Empty occupancy rebuild, last host batch | 33.702 ms |
| Cells enumerated / occupied slots | 2,064 / 0 |
| JVM used heap, idle start/end | 608 / 668 MiB |
| Main host RSS, idle start/end | 3,573.547 / 3,573.547 MiB |
| Audio engine RSS, idle start/end | 76.031 / 76.031 MiB |
| Host / audio engine idle CPU | 5.958% / 4.369% |
| Idle interval | 5.035 s |

The rig scans read all 128 configured slots for each existing track. The
inventory enumerates eight current scenes. The source still reuses 512 indexed
slot observers over 65,536 handles, with no added host handles. Heap and RSS
include the project, host, and other extensions. They do not measure the
topology domain alone. Populated cold initialization and full working-set heap
remain open.

## Flat note and occupancy controls

The [seed report](../data/phase8g5c-storage/flat-seed.json.gz) proves four owned
clips: rows 0 and 1 on Inst 1 and Inst 256. Each has 64 notes across all 16 MIDI
channels. Inst 1 uses pitches 60–63; Inst 256 uses pitches 72–75.
Two independent note reads agree. Both row-0 cache comparisons
match independent settled authority, including all declared fields and metadata.
Ping p95 is 25.111 / 25.166 ms. One retained snapshot estimates 133,000 bytes;
two retained snapshots together estimate 266,002 bytes. These are estimates,
not heap measurements.

The [wide-group arm](../data/phase8g5c-storage/wide-arm.json.gz) records two
full independent slot scans through stable handlers, with at most 64 concurrent
requests. They take 883 and 880 ms. Both scans and the declared four slots match
confirmed occupancy. The populated rebuild takes 553 ms wall time; its last
host batch takes 15.420 ms. A new primary note comparison matches authority.
Scan 4 is then held at membership, armed `2026-10-03T15:40:43.021Z`.

The operator is asked to group all 256 instrument/audio tracks through native
track-header selection. The declared result is an expanded top-level wrapper
named `gn-8g5c-wide`, with FX and Master outside. No group result is read yet.
The next read must capture retirement, the census delta, and the counted master
witness. Group correctness and scale acceptance remain false.

The four large raw captures are compressed without a byte change. The artifact
index pins both compressed and raw bytes and hashes. Saved source paths retain
their original `.json` names; source resolution accepts the pinned `.json.gz`
archive. Original raw copies remain in `/private/tmp/ghostnote-8g5c-raw/`.

## Native wide group and recovery

The operator confirms an expanded top-level `gn-8g5c-wide` group around all
256 base tracks, with FX and Master outside. The
[first read](../data/phase8g5c-storage/wide-first-read.json.gz) records one new
Group UUID, `e7258067-7c98-45cf-ba5a-8c8f0b6878c4`, with all prior UUIDs, names,
types, and relative order preserved. The oracle uses the declared operation
and this census delta. It does not use candidate membership to declare children.

The armed comparison retires with `window-changed`. Window changes rise from
zero to one, with three completed authority scans at both endpoints. No current
payload remains. Automatic identity invalidations rise from 255 to 256.
Confirmed occupancy is retired. Terminal status has no active `scanId`; the
verifier checks the captured counters and `scanActive:false`. Its first attempt
refused an assumed terminal ID before any recovery call. The raw first read
was preserved. No extension change was needed.

The held arm reports 30,782,242.458 ms before retirement. This interval includes
the overnight operator wait. It cannot establish a native settlement deadline
or input-to-callback latency. New recovery attempts stay within their budgets.

The [wide result](../data/phase8g5c-storage/wide-result.json.gz) passes closure
and exact external membership at 259 channels. The direct child count is 257:
256 base tracks plus the group master. The one-handle window at offset 256
reports the owner's UUID with `isGroup:false` and `expanded:false`. The separate
root bank reports the group, FX, and Master in order. All three counted source
reads agree with their second reads and the external oracle.

| Quantity | Wide group |
|---|---:|
| Three topology reads | 6.232750 / 6.621917 / 5.143625 ms |
| Callback sequence during all three reads | 13,076, unchanged |
| Change from flat arm sequence | 786 delivered topology callbacks |
| Two complete independent slot scans | 882 / 882 ms |
| Inventory cells / published clips | 2,072 / 4 |
| Group mirror slots excluded | 2 |
| Occupancy rebuild, wall / last host batch | 811 / 36.561 ms |
| First / last note reacquisition and comparison, wall | 7,194 / 7,195 ms |
| First / last binding replay | 1,547.803 / 1,554.337 ms |
| First / last ping p95 | 25.195 / 25.034 ms |

Both note clips reacquire through their populated canaries and match independent
settled authority. Both full slot scans and confirmed occupancy match the four
declared clips. The two mirror slots are diagnostics and publish no clip refs.
This proves the expanded wide case. Nested, collapsed, move, 512 total-channel
equality, excess, and the selected final scope remain open.

## Nested trial arm

The [nested arm](../data/phase8g5c-storage/nested-arm.json.gz) records a new
passing primary comparison, the checked wide topology, and the next native
declaration. It selects only Inst 1 and Audio 2, under the known wide UUID.
The declared new wrapper is expanded, named `gn-8g5c-inner`, and is the first
child of the wide group. Scan 8 is held at membership, armed
`2026-10-04T00:24:00.117Z`. The result follows below.

## Native nested group and recovery

The operator confirms the declared first-child group. The
[first read](../data/phase8g5c-storage/nested-first-read.json.gz) records new UUID
`dd56523f-a20c-4ff9-a3c6-1777e5eecaad`. The fixture has 260 channels. The
terminal comparison is `window-changed`, with no payload and no active scan.
Window changes increase from one to two. Completed authority scans stay at six.
Identity invalidations increase from 256 to 257. Registry and occupancy retire.
The first topology read takes 3.552 ms at callback sequence 13,349.

The independent oracle comes from the declared native selection, one new UUID,
and retained UUID order. Outer direct degree is 255: inner plus the remaining
254 base tracks. Inner degree is two. The outer source count is 256, with its
same-UUID master at offset 255. The inner source count is three, with its
same-UUID master at offset two. Both masters have the required non-group flags.

Native grouping renumbers 254 generated names. Former Inst 3 becomes Inst 2;
former Inst 256 becomes Inst 255. UUIDs, order, and channel types persist. The
first verifier refused the name mismatch before live recovery or any fixture
write. The corrected oracle uses UUIDs and types. Current source names still
must match the current census. The raw first read is preserved.

The [nested result](../data/phase8g5c-storage/nested-result.json.gz) passes.
Three checked reads take 2.115, 2.192, and 1.764 ms. Two independent full slot
scans take 879 and 885 ms across 2,080 cells. They prove four real occupied slots
and four group mirror slots. Confirmed publication takes 348 ms wall time,
340.023 ms rebuild elapsed time, and 22.437 ms in the last batch. Published
occupancy excludes all group mirrors. Both row-0 clips reacquire and match
independent authority. Driver reacquisition and comparison take 7,177 and
7,185 ms. This proves the expanded nested case; final scale remains open.

## Boundary move arm

The [boundary arm](../data/phase8g5c-storage/boundary-arm.json.gz) holds scan 12
at membership, armed `2026-10-04T00:45:32.446Z`. A new primary comparison
matches authority before the arm. The operator must move Audio 2 UUID
`546078ce-c28c-4350-bc0d-0554d69b29f6` from inner to wide, immediately after
inner and before UUID `21c75765-14f0-4ee1-80fa-b0ae85c73ba6`, currently Inst 2.
Both groups stay expanded. The declared flat UUID order is unchanged. The new
outer direct degree must be 256 and inner degree one. The result follows below.

## Native boundary move and recovery

The operator confirms the declared placement. The
[first read](../data/phase8g5c-storage/boundary-first-read.json.gz) records the
same complete 260-channel UUID order. Membership changes: outer direct degree
becomes 256 and inner degree becomes one. The counted windows have counts 257
and two, with same-UUID masters at offsets 256 and one. The read takes
3.248 ms at callback sequence 13,355; the arm read sequence was 13,349.

The old comparison is `window-changed`, without a payload or active scan.
Window changes increase from two to three. Completed authority scans stay at
nine. Identity invalidations increase from 257 to 258. Registry and occupancy
retire. These results prove delivery for this move; input ordering is not proved.
Bitwig renumbers 254 generated names again: Inst 2 becomes Inst 3, and Inst 255
becomes Inst 256. UUIDs, order, and types remain unchanged.

The [boundary result](../data/phase8g5c-storage/boundary-result.json.gz) passes
against the declared UUID move. Three reads take 2.827, 2.975, and 2.335 ms at
unchanged sequence 13,355. Two independent 2,080-cell slot scans take 877 and
880 ms. They prove four real clips and four excluded group mirror slots.
Confirmed publication takes 451 ms wall time, 438.010 ms rebuild elapsed time,
and 15.287 ms in the last batch. Both note clips reacquire and match fresh
authority. Driver reacquisition and comparison take 7,082 and 7,275 ms.
Flat UUID order alone would miss this native membership change.

## Inner collapse arm

The [collapse arm](../data/phase8g5c-storage/collapse-arm.json.gz) holds scan 16
at membership, armed `2026-10-04T00:56:48.042Z`. A fresh primary comparison
matches authority before the arm. The declared action collapses only inner UUID
`dd56523f-a20c-4ff9-a3c6-1777e5eecaad`. Wide stays expanded. UUID order and
direct degrees must remain unchanged. The result follows below.

## Native inner collapse and binding refusal

The operator confirms collapse of only inner. The
[first read](../data/phase8g5c-storage/collapse-first-read.json.gz) records the
complete 260-channel UUID tree. Both direct degrees and UUID master windows
are unchanged. Wide is expanded; inner is collapsed. The read takes 1.576 ms
at callback sequence 13,356. The terminal comparison is `window-changed`, with
no current payload or active scan. Window changes increase from three to four.
Completed authority scans stay at 12. Identity invalidations increase from
258 to 259. Registry and occupancy retire before new acquisition.

The [first attempt](../data/phase8g5c-storage/collapse-result-diagnostic.json.gz)
checks the tree, two full slot scans, and confirmed occupancy. Primary canary
rebinding refuses `binding-budget` after 5,090 ms. That view keeps 32 physical
hints. The reachable end view settles and verifies its canary, but the driver's
check waits for all physical hints to drain. It times out after 40 seconds
without starting a tail authority comparison. The raw failure is pinned and
excluded from passing results. Fallback responses omit some per-view fields;
read the separate `status` operation before explicit retirement.

The [retry](../data/phase8g5c-storage/collapse-result.json.gz) adds explicit
retirement of the refused view. Three checked reads take 1.476, 1.667, and
2.241 ms. Two independent 2,080-cell scans take 884 and 879 ms. Confirmed
publication takes 350 ms wall time. Four real clips publish; four group mirror
slots are excluded. Primary rebinding again refuses `binding-budget`, after
5,098 ms. Its separate status has 64 pending hints; retirement clears them to
zero. The reachable end clip then reacquires and matches fresh authority in
7,313 ms. A final checked tree proves that these binding calls left inner
collapsed. No collapsed primary note comparison is claimed.

These results retain E221's collapsed-child binding refusal at the larger
scope. They prove collapsed membership and occupancy, plus content recovery
outside that collapsed group. Expansion recovery remains open.

## Inner expansion arm

The [expansion arm](../data/phase8g5c-storage/expand-arm.json.gz) holds scan 19
at membership, armed `2026-10-04T01:34:22.742Z`. A new comparison on the last
base track matches authority before the arm. The declared native action expands
only inner UUID `dd56523f-a20c-4ff9-a3c6-1777e5eecaad`. Wide stays expanded.
UUID order and direct degrees must stay unchanged. The result follows below.

## Native expansion and recovery

The operator confirms expansion of inner. The
[first read](../data/phase8g5c-storage/expand-first-read.json.gz) records the
same complete 260-channel UUID tree and direct degrees. Both groups are now
expanded. Both last-position UUID masters match. Callback sequence is 13,357.
The terminal comparison is `window-changed`, without a payload or active scan.
Window changes increase from four to five. Completed authority scans stay at
14. Identity invalidations increase from 259 to 260. Registry and occupancy
retire before new acquisition.

The [expanded result](../data/phase8g5c-storage/expand-result.json.gz) passes.
Three reads take 4.372, 2.269, and 2.382 ms. Two independent 2,080-cell slot
scans take 927 and 881 ms. Confirmed publication takes 651 ms wall time,
627.580 ms rebuild elapsed time, and 0.814 ms in the last batch. Four real clips
publish; four group mirror slots are excluded. Both row-0 clips reacquire and
match fresh authority in 7,065 and 7,195 ms. The collapsed-primary rebinding
refusal remains a limit; this result proves expanded recovery.

## Native ungroup arm for the capacity boundary

The [ungroup arm](../data/phase8g5c-storage/ungroup-arm.json.gz) holds scan 23
at membership, armed `2026-10-04T01:44:29.053Z`. A new primary comparison
matches authority before the arm. The operator must use native Ungroup on inner,
then wide, and keep every child track and clip. The declared result restores
all original 258 UUIDs to the flat tree. No ungroup result is read yet.

E2c and E2f show that `Application.createInstrumentTrack(position)` can place a
new track at a different index. API 25 describes the position in the main-track
list. A grouped create cannot provide an independent parent oracle from its
requested index alone. Restore a flat fixture before extending it. Locate each
new UUID by a complete census delta, then verify its actual position before the
next create. Native Ungroup preserves the clips needed for fresh content checks.

## Native ungroup and flat restoration

The operator ungrouped inner, then wide, with all children preserved. The
[first read](../data/phase8g5c-storage/ungroup-first-read.json.gz) captures
automatic retirement: `windowChanges` is 6 and `authorityScans` stays 17.
All original 258 UUIDs and types return in their original flat order. The
[result](../data/phase8g5c-storage/ungroup-result.json.gz) confirms four real
clips, no group mirrors, flat membership, and both fresh note matches.

## Populated 512-channel boundary

The [second population journal](../data/phase8g5c-storage/512-population.json.gz)
proves 254 more creates in 139.254 seconds. Each create has a durable intent,
a unique new Instrument UUID, unchanged prior UUID order, and verified actual
placement before FX. New 8 now has 510 instrument/audio tracks, FX, and Master.
All 508 created tracks are owned test tracks. No group wrappers remain.

The new last Instrument is Inst 510, flat index 509, UUID
`bbf38868-23f6-4869-a66b-9d0f167ee3bb`. Its row-0 target and row-1 canary each
have 64 notes over all 16 channels, with pitches 84 through 87. The earlier
first and original end tracks keep their four clips. The native note verifier
accepts pitch 84 only when the caller declares it. Its default remains 60 or 72.

The [boundary result](../data/phase8g5c-storage/512-result.json.gz) passes:

| Quantity | Value |
|---|---|
| Flat topology reads | 1.429, 1.080, 1.121 ms |
| Independent scans | 4,096 cells each; 1,691 and 1,684 ms |
| Confirmed occupancy | Six real clips; publication wall time 236 ms |
| First, original end, new end content comparisons | Match; 7,044, 6,996, 7,009 ms |
| Idle interval | At least five seconds; no bridge reads |
| Main process interval CPU; RSS | 9.56% of one core; 4,001,552 KiB at both ends |
| Audio process interval CPU; RSS | 3.78% of one core; 73,072 KiB at both ends |
| Shared JVM used bytes, before and after idle | 1,361,051,648; 1,363,148,800 |
| Shared JVM committed; maximum bytes | 3,217,031,168; 3,221,225,472 |

The allocation is still 513 banks, 1,024 bank track handles, zero parent handles,
and zero topology StepData observers. Occupancy reuses 512 indexed observers
and 65,536 slot handles. The project has eight scenes; configured coverage is
128 scenes. JVM values use no forced GC. These warm measurements include a
shared JVM and whole processes; they do not attribute memory to the cache.
They are not populated cold samples or a full working-set heap result.

## Capacity excess and recovery

The [excess capture](../data/phase8g5c-storage/512-excess.json.gz) adds one
owned empty Instrument before FX. `itemCount` becomes 513 while only 512 rows
fit the bank. The visible UUID prefix proves the new track at index 510 and
only the known Master outside the window. Normal full-project admission refuses
this partial census. Membership returns `flat-topology-window-incomplete`.
Inventory refuses `slot-coverage-track-limit`; rebuild, point, and exact reads
refuse `group-topology-unproved`. No occupancy or registry is admitted.
The active comparison retires without another authority scan.

Cleanup is limited to that one new UUID. All eight slots on that track are
empty. Its deletion restores the exact prior 512 UUID census. Confirmed
occupancy returns all six clips, and first and new end note comparisons match.
The final verifier then fails because it expected the inventory refusal reason
for rebuild. The raw capture is unchanged. The corrected verifier requires the
actual route-specific reasons. A separate
[confirmation](../data/phase8g5c-storage/512-excess-confirmation.json.gz) pins
the diagnostic's exact raw hash and independently reads restored membership
and six occupied slots. Both verification paths pass. Do not repeat this
mutation to replace the diagnostic.

## Populated fresh-load preparation

The same counted C2 archive is deployed again: SHA-256 `193162d2…75d715`, marker
`8g5c-counted-allocation-v2`. Config bytes remain counted-512, SHA-256
`caacbe1f…26d91`. The
[anchor](../data/phase8g5c-storage/populated-anchor.json) independently checks
the full 512 UUID census, flat tree, six occupied slots, and allocation. It
records the new archive modification time and current controller init.
No fresh populated sample was captured at preparation.

The allocation driver now requires this anchor for every `populated` sample.
It checks a newer initialization after deployment, the exact full census,
all flat UUID roots, two rig scans, 4,096 enumerated cells, six confirmed clips,
and an unchanged final census and initialization. A passing flag cannot supply
the fixture oracle. The five-second idle interval precedes the occupancy rebuild.
Fresh controller loads share the existing JVM and do not establish cold JVM cost.

## First populated fresh-load sample

The operator replaced the controller. Research hello passes: profile
`phase-8-probe-v1`, 97 methods, hash `f03f19414f40e3d3`, marker
`8g5c-counted-allocation-v2`, fresh init `2026-10-04T02:29:54.218Z`.
Archive bytes and counted-512 config remain unchanged.

The [first sample](../data/phase8g5c-storage/counted-populated-512-1.json.gz)
passes the full independent 512-track oracle and six-slot occupancy oracle.
The final UUID census and controller init are unchanged. Its 4,096-cell rebuild
publishes six clips. No note or project mutation runs in this sample.

| Quantity | Value |
|---|---|
| Total initialization; rig construction | 131.900; 110.894 ms |
| Topology construction; sampled membership read | 6.545; 10.452 ms |
| Shared JVM used bytes around topology construction | 1,094,713,344; 1,109,393,408 |
| Shared JVM used bytes around idle interval | 1,352,663,040; 1,354,760,192 |
| Shared JVM committed; maximum bytes | 1,501,560,832; 3,221,225,472 |
| Idle interval | 5,034 ms; no bridge reads |
| Main process interval CPU; RSS | 7.75% of one core; 2,185,824 KiB at both ends |
| Audio process interval CPU; RSS | 4.17% of one core; 75,152 to 75,184 KiB |
| Confirmed occupancy publication wall time | 2,102 ms |
| Rebuild elapsed; last batch | 2,091.063; 12.622 ms |

This is a fresh controller in the same JVM and Bitwig processes. The JVM uses
no forced GC. Its memory delta and process RSS do not measure cache-owned
memory. There is one of three required populated samples; variation and final
capacity selection remain open. The artifact summary reports populated arms
separately from empty arms and keeps scale and combined acceptance false.

## Second populated fresh-load sample

The operator replaced the controller again. Research hello passes with the same
97-method profile, hash, C2 marker, and archive. Fresh init is
`2026-10-04T02:34:36.717Z`, later than sample 1. Counted-512 config is unchanged.

The [second sample](../data/phase8g5c-storage/counted-populated-512-2.json.gz)
passes the same independent 512-track and six-slot oracles. All 4,096 cells are
enumerated. The final UUID census and initialization are unchanged. No note or
project mutation runs in this sample.

| Quantity | Value |
|---|---|
| Total initialization; rig construction | 38.671; 37.538 ms |
| Topology construction; sampled membership read | 4.298; 5.026 ms |
| Shared JVM used bytes around topology construction | 1,493,172,224; 1,505,755,136 |
| Shared JVM used bytes around idle interval | 1,732,247,552; 1,734,344,704 |
| Shared JVM committed; maximum bytes | 2,711,617,536; 3,221,225,472 |
| Idle interval | 5,037 ms; no bridge reads |
| Main process interval CPU; RSS | 10.52% of one core; 3,406,240 to 3,407,792 KiB |
| Audio process interval CPU; RSS | 4.37% of one core; 75,936 to 75,952 KiB |
| Confirmed occupancy publication wall time | 1,435 ms |
| Rebuild elapsed; last batch | 1,417.144; 21.266 ms |

The two total initialization values differ by 93.229 ms. Their median is
85.286 ms; topology construction spans 4.298–6.545 ms, with median 5.421 ms.
These are provisional two-sample values. The controller loads share a JVM;
JVM memory and whole-process RSS cannot attribute cache memory or explain the
variation. No forced GC runs. Sample 3 and final capacity selection remain open.

## Third populated fresh-load sample

The operator replaced the C2 controller again. Research hello passes with 97
methods, hash `f03f19414f40e3d3`, marker `8g5c-counted-allocation-v2`, and fresh
init `2026-10-04T02:38:33.942Z`.

The [third sample](../data/phase8g5c-storage/counted-populated-512-3.json.gz)
checks all 512 UUIDs and the six occupied slots against the independent anchor.
Confirmed inventory enumerates all 4,096 actual cells. The final census and
initialization are unchanged. No fixture mutation runs.

| Quantity | Value |
|---|---|
| Total initialization; rig construction | 50.512; 49.216 ms |
| Topology construction; sampled membership read | 3.201; 3.712 ms |
| Shared JVM used bytes around topology construction | 1,459,617,792; 1,472,200,704 |
| Shared JVM used bytes around idle interval | 1,702,887,424; 1,704,984,576 |
| Shared JVM committed; maximum bytes | 3,051,356,160; 3,221,225,472 |
| Idle interval | 5,035 ms; no bridge reads |
| Main process interval CPU; RSS | 7.75% of one core; 3,768,464 KiB, unchanged |
| Audio process interval CPU; RSS | 4.37% of one core; 76,592 to 76,608 KiB |
| Confirmed occupancy publication wall time | 1,115 ms |
| Rebuild elapsed; last batch | 1,093.390; 30.225 ms |

Across three populated loads, initialization is 38.671–131.900 ms, with median
50.512 ms. Topology construction is 3.201–6.545 ms, with median 4.298 ms. These
are fresh controller loads in one shared JVM. No forced GC or process restart
runs. JVM and process values cannot attribute cache-owned memory or explain the
variation.

## Selected capacity and combined limit

Select 512 total channels with the counted route. The flat boundary leaves 256
positions beyond the required 256 instrument/audio tracks. Group wrappers, FX,
and Master consume these positions. The configured flat bank, topology bound,
and occupancy bound must agree. The research defaults now select 512 counted
channels and `ALL_CHANNELS` when no explicit settings exist. Normal defaults
stay unchanged. Group diagnostic capacity also rises to 512. The prior live
scope includes 510 flat instrument/audio tracks and separate wide and nested
controls at 256 base tracks. No 510-child group result is claimed.

Select a 24 MiB combined extension-owned estimate limit. This is lower than the
sum of the individual 16 MiB domains. It bounds concurrent authority and retained
snapshot work while leaving room for recorder and inventory costs. It is a
source estimate limit, not a heap budget.

The seven domains are recorder, snapshots, authority staging, registry,
identity/witness, topology, and slot inventory. Topology bookkeeping is
`304 + 20 * capacity` bytes, or 10,544 bytes at 512. Retained topology text adds
`40 + 2 * characters`. Registry guard text adds `128 + 2 * characters` for its
structure and loaded-instance witnesses. Slot-source bookkeeping is 96 bytes;
the window adds `296 + 2 * nonce characters`, plus 128 bytes for a retained read.
Host objects, handles, and transient diagnostic copies are excluded. The ledger
reports JVM attribution limits separately.

Growth checks include other retained domains and the new allocation. A new
comparison releases its prior payload before authority staging. Snapshot
candidate excess drops all enriched payloads in reference order, including
adapter history references. It preserves confirmed authority for exact fallback.
Recorder or authority excess refuses growth. Private registry excess aborts
without partial publication. Explicit retry can recover. Individual limits
retain priority. Model checks cover equality, one-byte excess, two residents,
authority refusal, registry atomic refusal, and explicit recovery. They do not
replace live budget boundaries.

C3 marker is `8g5c-combined-storage-v3`; definition is
`0.0.1-8g-controls-8g5c-combined-3`. The deployed archive SHA-256 is
`2294c6d3851cd6e57540d7b21f28b0be87c926313ea05a84f6fb81282aa8a673`.
The [deployment anchor](../data/phase8g5c-storage/combined-deployment.json) pins
archive time, config, prior C2 init, full census, and six occupied slots. The
counted-512 config SHA-256 remains `caacbe1f…26d91`. This anchor precedes the
C3 live result below.

## C3 live diagnostic and witness correction

The operator replaced the C3 controller. Research hello passes: 97 methods,
hash `f03f19414f40e3d3`, and fresh init `2026-10-04T03:20:52.451Z`. The fixture
keeps all 512 UUIDs and six occupied slots. All three row-0 note controls match
fresh authority. Both residents are retired, and no fixture mutation runs.

The final independent ledger assertion fails: `3280 !== 3196` for identity and
witness storage after the first comparison. The oracle and the new candidate
reservation assumed a 64-character hash. The actual fingerprint includes
`shadow-normalized-v1:`. Each witness costs 210 bytes, not 168. The first
comparison has two witnesses, which accounts for the 84-byte oracle difference.
Candidate reservation missed 42 bytes before first snapshot publication.

The [raw diagnostic](../data/phase8g5c-storage/combined-baseline-diagnostic.json.gz)
is unchanged. `baselinePassed` stays false. The corrected TypeScript verifier
recomputes all actual ledger values from the raw capture and independently
acquired notes. The last publication has these seven domains:

| Domain | Estimated bytes |
|---|---:|
| Recorder | 960 |
| Retained snapshots | 265,994 |
| Comparison authority | 116,736 |
| Registry and guard | 230,250 |
| Identity and witnesses | 4,120 |
| Topology and witness | 222,024 |
| Slot source and window | 592 |
| Total at publication | 840,676 |

Cold inventory totals 455,726 bytes. After three controls, the two-resident
working set totals 723,940 bytes. After retirement, it totals 456,986 bytes.
Witnesses remain in the identity domain. These small controls do not saturate
combined storage.

| Shared JVM sample | Used bytes | Committed bytes |
|---|---:|---:|
| Before content reads | 1,371,537,408 | 1,371,537,408 |
| Two residents | 1,096,810,496 | 3,221,225,472 |
| After eviction | 1,111,490,560 | 3,221,225,472 |

Maximum heap is 3,221,225,472 bytes. No forced GC runs. These are shared JVM
samples and cannot attribute cache-owned memory. C3 initialization takes
74.551 ms, rig construction 61.317 ms, and topology construction 4.014 ms.

C4 derives its witness reservation from the full fingerprint format. A new
model test checks first snapshot equality and one-byte excess before any prior
snapshot witness exists. It also checks that publication converts the reserved
witness into retained text without hidden growth. C4 marker is
`8g5c-combined-storage-v4`, accounting revision `8g5c-resource-accounting-v3`,
and definition `0.0.1-8g-controls-8g5c-combined-4`. The deployed archive SHA-256 is
`e51ea24917b4c856df4aed6106e3b1a662f068ef5f54669f81ed35ee31328d73`.
The [C4 anchor](../data/phase8g5c-storage/combined-witness-deployment.json) pins
this archive and unchanged fixture against the C3 diagnostic. No C4 live result
exists yet.

## C4 baseline and live combined boundary

The operator confirmed C4 replacement. Research hello passes with 97 methods,
hash `f03f19414f40e3d3`, marker `8g5c-combined-storage-v4`, and fresh initialization
`2026-10-04T03:48:31.888Z`. The archive is `e51ea249…328d73`. Counted-512 config
is unchanged, SHA-256 `caacbe1f…26d91`.

The first C4 baseline comparison refused `authority-host-work-budget`. Its
measured host work was 88.696 ms against 50 ms. The
[immutable diagnostic](../data/phase8g5c-storage/combined-baseline-host-budget-diagnostic.json.gz)
keeps `baselinePassed:false`. No note mutation ran. One explicit
[baseline retry](../data/phase8g5c-storage/combined-baseline.json.gz) passed all
three 64-note controls and all seven independently calculated ledger domains.
Both residents were retired. Cold publication reserves the full 210-byte
versioned witness; its candidate peak equals the publication total.

The budget driver calibrated 127 native velocities. It read all acquired fields
through the fine cursor and calculated payload costs independently. The solver
selected 6,315 notes across all 16 channels: 5,353 at velocity input 1 and 962 at
input 5. Another clip retained 64 notes. The fixed estimate was 590,716 bytes.

| Domain at equality publication | Estimated bytes |
|---|---:|
| Sparse recorder and physical hints | 22,856 |
| Retained snapshots | 13,167,422 |
| Confirmed comparison authority | 11,518,560 |
| Registry bookkeeping and captured guard | 230,250 |
| Identity and versioned witnesses | 4,120 |
| Topology bookkeeping and retained text | 222,024 |
| Slot source and confirmed window | 592 |
| **Combined total** | **25,165,824** |

Equality publishes a complete matching snapshot at exactly 24 MiB. One velocity
change increases the projected total by two bytes, to 25,165,826. Enrichment
refuses `combined-storage-budget` and drops all enriched payloads in reference
order. It returns the already confirmed 6,315-note authority. Both actual view
status reads show no historical payload. Snapshot storage is zero. The
independent exact reader then acquires all 6,315 notes without cache membership
or new residence. Metadata and every acquired field match the independent fine
cursor. Exact fallback does not claim cache eligibility.

Two harness failures are preserved. The
[reader diagnostic](../data/phase8g5c-storage/combined-budget-reader-diagnostic.json.gz)
used `read` to inspect status. That operation starts a comparison. The subsequent
exact reader did not start, and polling timed out. The corrected driver uses
`status`, verifies exact startup, and persists its progress. A separate
[startup diagnostic](../data/phase8g5c-storage/exact-reader-first-diagnostic.json.gz)
records idle and binding polls only; it proves no content result.

The [drain diagnostic](../data/phase8g5c-storage/combined-budget-drain-diagnostic.json.gz)
passed calibration, equality, excess, history shedding, and independent exact
fallback. Recovery waited for a global drain while the primary view still held
a hint. Both failed attempts restored all 64 original notes, metadata, the 512
UUIDs, and six occupied slots. Neither claims completed budget acceptance.

The [accepted budget journal](../data/phase8g5c-storage/combined-budget.json.gz)
continues from the immutable drain diagnostic. It pins that source's raw hash
and preserves every earlier observation unchanged. It does not repeat
calibration, equality, excess, or exact reading. The continuation retires both
views, writes the equality fixture, reacquires the other clip, then reacquires
the primary clip. Recovery matches at exactly 24 MiB. Eviction reports zero
residents. Final restoration verifies all 64 original notes through two readers,
unchanged metadata, 512 track UUIDs, six slots, and zero pending physical hints.
The artifact verifier rejects altered source observations or a false raw hash.

## JVM values around the working set

| Observation | Used heap, MiB | Committed heap, MiB | Capture scope |
|---|---:|---:|---|
| First C4 pre-content baseline | 1,224 | 1,344 | Fresh controller, shared JVM |
| Before explicit baseline retry | 1,266 | 3,072 | Same controller after refused read |
| Two small baseline residents | 1,106 | 3,072 | Same controller |
| Configured full two-resident equality set | 1,710 | 3,072 | 6,315 primary notes plus 64 other notes |
| After recovery and explicit eviction | 1,564 | 2,964 | Same controller, continuation |

Maximum heap is 3,072 MiB. No forced GC or JVM restart runs. The working sample
comes from the equality arm. The eviction sample follows the recovery
continuation. Shared JVM timing and collection can change these values. Their
difference does not measure cache-owned memory. The source estimates exclude
host handles, host objects, transient diagnostic copies, and JVM heap.

## Final restoration

The exact original config is restored. `copyExtension` deployed normal
`ghostnote-0.0.1.bwextension`, SHA-256 `fd1e32ea…3e03f4`. The operator confirmed
full controller replacement, discarded only New 8 without saving, and selected
New 3. Normal hello passes: profile `normal-v1`, 85 methods, hash
`bba7383dce25c0f0`, fresh initialization `2026-10-04T04:25:55.814Z`. Research
allocation is disabled. The init follows the deployed normal archive.

The [final protected check](../data/phase8g5c-storage/new3-final-baseline.json)
matches the [adopted baseline](../data/phase8g5a-group/new3-baseline.json) twice.
It checks all four UUIDs, eight scenes, the full slot census, selection, all ten
cursor targets, the fine reader, clip metadata, launch settings, and empty notes
on all 16 channels. The reader is unpinned at its original target and grid.
No clip content is changed. A read-only screenshot shows only the `New 3 *` tab.
New 3 was not saved or closed.

The research archive was removed only after its SHA-256 matched the C4 anchor.
The [cleanup record](../data/phase8g5c-storage/cleanup.json) pins the normal
archive, exact config hash, adopted baseline hash, fresh init, and operator
confirmation. The artifact index now pins 65 files. The final verifier checks
session completion separately from cache eligibility. Its project-scale and
combined-cache acceptance flags stay false until 8g5 decides the final gate.
The budget journal's accepted flag applies only to its measured boundary arms.

Run 8g5 next. Reuse these completed controls when their code dependencies remain
unchanged. Carry D28, E222 identity limits, and the collapsed-child rebinding
refusal into its supported-state matrix. Do not enter 8h.

## Verification

Extension `check` passes, including all four archive registrations and 29
topology test groups. Capacity equality at 512 and whole-tree refusal above
capacity pass in the model. Brain typecheck and 1,757 tests pass. The new tests
check equal sweep settings, allocation counts, invalid memory claims, and CPU
interval calculations. These checks do not satisfy live scale acceptance.
Active wire, E222 artifact, context, and diff checks also pass.
After the first live sample, typecheck and all four focused allocation tests pass.
The offline `verify` driver mode recomputes the first sample from its raw data.
After the second sample and fixture capture, typecheck and the four focused
tests pass. Both live control samples recompute and have equal config and UUIDs.
After the third sample, typecheck, six focused tests, and the pinned artifact
verifier pass. The full brain check has not been repeated after these focused
additions. Its last count remains 1,757 tests.
After the first enabled sample, typecheck, seven focused tests, and the
seven-file artifact verifier pass. The empty membership tree matches its UUID
oracle. Populated scale and storage acceptance remain false.

After the second enabled sample, typecheck, seven focused tests, and the
eight-file artifact verifier pass. Both empty membership trees match their UUID
oracle. Live acceptance remains open.

After the third enabled sample, the nine-file artifact verifier and context
and diff checks pass. All three capacity-16 samples match the fixture UUIDs.
No executable code changed after the seven focused tests passed.

After the first capacity-64 sample, the ten-file artifact verifier and context
and diff checks pass. No executable code changed after the seven focused tests.

After the second capacity-64 sample, the eleven-file artifact verifier and
context and diff checks pass. No executable code changed.

After the third capacity-64 sample, the twelve-file artifact verifier and
context and diff checks pass. No executable code changed.

After the first capacity-256 sample, the thirteen-file artifact verifier and
context and diff checks pass. No executable code changed.

After the second capacity-256 sample, the fourteen-file artifact verifier and
context and diff checks pass. No executable code changed.

After the third capacity-256 sample and counted-route preparation, extension
`check` passes with 35 topology test groups and all four archive registrations.
Brain typecheck and 1,762 tests pass. Eight focused tests and the sixteen-file
artifact verifier pass after deployment. Context and diff checks pass. The
smaller route has model evidence only; every counted live check remains open.

After the first counted-512 sample and sampler correction, typecheck, nine
focused tests, and the eighteen-file artifact verifier pass. The last full brain
check remains 1,762 tests from before this correction. Extension checks and
archive registrations are unchanged. Context and diff checks pass. Populated
scale and combined storage acceptance remain false.

After the second counted-512 sample, the nineteen-file artifact verifier and
context and diff checks pass. No executable code changed.

After the third counted-512 sample, nine focused tests, the twenty-file
artifact verifier, and context and diff checks pass. The fixture is unchanged.
Populated scale and combined storage acceptance remain false.

After the first new-build disabled control, typecheck, eleven focused tests,
and the twenty-one-file artifact verifier pass. The new tests reject partial
censuses, ambiguous create deltas, changed prior tracks, and false flat trees.
The population driver has no live result.
The full brain check passes all 1,765 tests. Context and diff checks pass.

After the second new-build disabled control, the twenty-two-file artifact
verifier and context and diff checks pass. No executable code changed.

After the third new-build disabled control, typecheck, eleven focused tests,
and the twenty-three-file artifact verifier pass. The summary checks three
disabled controls and their exact initialization range and median. The driver
now checks fresh initialization and refuses a controller change during the run.
The last full brain check remains 1,765 tests from before these changes.

After flat population, note controls, and the wide-group arm, brain typecheck
and all 1,770 tests pass. The 27-file artifact verifier replays every create,
checks both end-track note comparisons, and verifies the independent slot scans
and confirmed publication. Mutants reject missing creates, foreign state,
partial scans, false authority matches, and an inactive arm. Compression tests
check both archive and raw capture hashes. Group scale and combined storage
acceptance remain false.

After native wide recovery and the nested arm, brain typecheck and all 1,773
tests pass. The 30-file artifact verifier checks native retirement, the external
256-child oracle, both UUID master reads, group-slot exclusion, and both note
reacquisitions. Mutants reject wrong child counts, master UUIDs, master offsets,
stale retirement, admitted stale registry state, and a changed nested declaration.
Final populated scale and combined storage acceptance remain false.

After nested recovery and the boundary arm, brain typecheck and all 1,775 tests
pass. The 33-file artifact verifier checks both group masters, changed generated
names with stable UUIDs, four mirror-slot exclusions, both note comparisons, and
the declared boundary move. Mutants reject changed types, foreign master UUIDs,
stale retirement, missing mirror exclusions, and a changed move selection.
Final scale and combined storage acceptance remain false.

After boundary recovery and the inner collapse arm, brain typecheck and all
1,777 tests pass. The 36-file artifact verifier checks changed direct degrees
with unchanged flat UUID order, both master offsets, automatic retirement,
independent occupancy, both note comparisons, and the declared inner collapse.
Mutants reject a stale tree, changed flat order, stale invalidation counters,
wrong master offsets, a failed tail comparison, and a collapsed outer declaration.
Final scale and combined storage acceptance remain false.

After collapsed controls and expansion arming, brain typecheck and all 1,780
tests pass. The 40-file artifact verifier preserves the queue-drain diagnostic
and checks collapsed membership, both UUID masters, full occupancy, primary
binding refusal, explicit hint retirement, the tail content match, and the
expansion declaration. Mutants reject a false collapsed note match, residual
hints, a missing per-view status, automatic UI expansion during binding, a false
passing diagnostic, and an expansion arm with the wrong content comparison.
Final scale and combined storage acceptance remain false.

After expanded recovery and native ungroup arming, brain typecheck and all
1,783 tests pass. The 43-file artifact verifier checks automatic retirement,
expanded membership, independent occupancy, both recovered note clips, and the
child-preserving ungroup declaration. Mutants reject a stale collapsed tree,
a changed expansion flag, an extra authority scan, admitted stale registry state,
a failed primary comparison, loss of child preservation, and foreign flat UUIDs.
Native ungroup and the 512 populated boundary remain open. Final scale and
combined storage acceptance remain false.

After flat restoration and 512 boundary controls, brain typecheck and all
1,789 tests pass. The 50-file artifact verifier checks both create journals,
full boundary occupancy, three independent content matches, the preserved
capacity verifier diagnostic, exact-UUID cleanup, restored membership, and the
populated reload anchor. Mutants reject incomplete journals, wrong actual
positions, partial slot scans, false end content, wrong cleanup UUIDs, admitted
partial projects, stale fresh-load times, and an altered fixture oracle.
Final scale and combined storage acceptance remain false.

After the first populated fresh-load sample, all 35 focused 8g5c tests and
brain typecheck pass. The 51-file artifact verifier recomputes the recorded
full fixture oracle and reports one populated sample separately from the empty
arms. The last full brain check has 1,789 passing tests. No extension code
changed. Final scale and combined storage acceptance remain false.

After the second populated fresh-load sample, all 35 focused 8g5c tests pass.
The 52-file artifact verifier checks two distinct fresh initialization epochs
and recomputes the provisional populated ranges and medians. The last full
brain check has 1,789 passing tests. No executable extension or probe code
changed. Final scale and combined storage acceptance remain false.

After the third populated load, all three samples recompute from 53 pinned
files. C3 extension `check` passes with 17 authority groups, 75 adapter groups,
39 core groups, 17 registry groups, 38 topology groups, and all four archive
registrations. Brain typecheck and all 1,792 tests pass. Artifact, context, and diff checks
pass. The artifact index now pins 54 files. C3 live checks remain open.

C4 extension `check` passes with 40 core groups, including cold witness
reservation equality and excess, and all four archive registrations. The
corrected oracle verifies the C3 diagnostic without changing its failure flag.
The artifact index pins 56 files. The native-calibration model checks exact
combined equality with all 16 channels and a two-byte excess. Brain typecheck
and all 1,794 tests pass. Artifact, context, and diff checks pass. C4 live checks
remain open.

After C4 baseline, live boundary controls, and recovery continuation, brain
typecheck and all 1,799 tests pass. The 63-file artifact verifier checks eight
diagnostic captures, including both restored budget failures and the reader
startup record. It independently verifies equality, excess, exact fallback,
recovery, eviction, and unchanged continuation source observations. Active
wire, context, and diff checks pass.

The final extension repeat failed `authorityMovedClip` during concurrent brain
and extension suites. The isolated 75-group adapter test passed. A full extension
repeat with no concurrent suite passed: 17 authority groups, 75 adapter groups,
40 core groups, 9 handle groups, 17 registry groups, 1 observer group, 7 scene
groups, 38 topology groups, and all four archive registrations. No Java change
or extra research reload was needed. Final protected restoration is pending.

After final operator restoration, normal hello and both protected baseline
checks pass. The 65-file artifact verifier verifies the final normal runtime,
archive and config hashes, zero protected content changes, and exact adopted
state. Cleanup tests reject foreign UUIDs, reader residue, changed clip values,
stale initialization, and false fixture or archive removal claims. Final brain
typecheck and all 1,800 tests pass. Extension and all four archive registrations
pass. Artifact, active wire, context, and diff checks pass. Session changes are
staged for review; no commit is made.

## Retrospective

Record the scope of a cold sample before the sweep. A fresh controller in a
shared JVM cannot establish fresh-JVM allocation cost. Compare research
initialization against the distinct research archive path.
Capture the empty fixture baseline as soon as the operator confirms ownership.
Assess measured allocation costs before increasing capacity. Keep different
allocation routes in separate evidence arms.
Check allocation format revisions and build markers as separate fields.
Retain refused attempts and exclude them from fresh initialization counts.
The second disabled control needs no further instruction change.
Limit parallel independent slot reads to 64 requests. Preserve exact raw capture
bytes and their hashes when compression changes the archive filename.
Check terminal status fields before requiring an active scan ID. Record operator
wait separately from settlement measurements.

Use UUIDs for native group declarations. Bitwig can renumber generated names.
Use current names only for operator instructions.

Declare UUID child lists before native moves. Flat order can stay unchanged when
membership changes. No further instruction change is needed for this trial.

Retire a refused view before waiting for all physical hint queues to drain.
Read per-view status separately; fallback responses omit some view fields.

Read the create-position evidence before extending a grouped fixture. Restore a
flat tree first, then locate each new track by UUID delta. No further change is
needed for the expansion trial.

Check each handler's refusal reason before setting the final verifier assertion.
Preserve a successful live recovery when only the final verifier is wrong;
validate the immutable diagnostic and capture a fresh read-only confirmation.

The first populated fresh-load trial needs no further instruction change.

The second populated fresh-load trial needs no further instruction change.

Charge both core and adapter payload references when defining a shedding rule.
Keep source estimate checks free from host reads and diagnostic recursion.

Derive reserved fingerprint storage from its complete versioned format. Check
first publication separately from a warm snapshot retry.

Use `status` for a read-only view inspection. Check whether a handler starts a
comparison before using it in a diagnostic. Retire every other view before a
global hint drain. Preserve completed live arms and continue only missing work.
