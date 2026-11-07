---
title: E358 — P01 offline attribution of retained composition traces
kind: evidence
updated: 2026-10-29
owner: P01
---

# E358 — P01 offline attribution of retained composition traces

This is an offline reanalysis of the successful October 27
[E357](e357-integrated-paged-writes-live.md) traces. No new Bitwig run, latency
claim or runtime-route proof is made. The source exchanges and earlier E
records are unchanged.

## Reproduction

From the repository root:

```sh
python3 context/evidence/data/p01-offline-audit/summarize.py
```

The [script](../data/p01-offline-audit/summarize.py) produces the retained
[summary](../data/p01-offline-audit/summary.json), with SHA-256 digests of both
compressed source files. It counts every recorded transport call and reply
byte and groups request durations by method. `batch.run` counts as one
transport call, not as one call per internal operation.

Request durations overlap (notably `revision.get` and `track.list`). Their sum
is **not** wall time. The script separately computes the union of in-flight
intervals. Time outside that union includes settling, scheduling and local
work; it is not an isolated CPU or sleep measurement. Bytes are recorded reply
bytes, not request bytes, heap size or retained-stash size.

## Results

| Metric | Five devices, one chain at 17 | Six one-device chains at 18 |
|---|---:|---:|
| Tool elapsed | 26,321.083 ms | 44,410.786 ms |
| Transport calls | 565 | 703 |
| Reply bytes | 582,169 | 791,977 |
| Union of in-flight intervals | 23,181.986 ms | 39,673.587 ms |
| Time outside those intervals | 3,139.097 ms | 4,737.199 ms |
| `device.list`: calls / summed request time | 86 / 12,111.904 ms | 103 / 14,431.317 ms |
| `chain.observe`: calls / summed request time | 26 / 2,174.702 ms | 45 / 12,508.131 ms |
| `batch.run`: calls / summed request time | 12 / 2,569.485 ms | 20 / 4,762.058 ms |
| `track.list` / `revision.get`: calls | 122 / 96 | 149 / 118 |
| `directparam.*`: calls | 0 | 0 |

The five-device trace contains five discarded population-changing
`device.list` reads; the six-chain trace contains seven. All report
`window population changed during paging`, the already documented E357 retry
case. These are successful final attempts, not aggregates over failed attempts.

## Interpretation and boundary

The overflow fixture cannot be explained by parameter proof alone: it makes
no DirectParameter calls. Repeated complete top-level inventories, dense
container reads, cursor acquisition and stage machinery dominate its trace.
`stableTop` brackets an adapter device read with two marks; the live adapter
itself takes two equal complete bank replies. `addEntry` adds fresh top-level
and structure proofs around insertion and relocation, on top of the executor
and adapter's own checks. These source paths explain why changing only the
six-unit weights or scalar fingerprints would miss this fixture's cost.

The request-duration totals do not classify every read as removable. Initial
target/input validation, object landing and final independent readback remain
necessary. The [P01 obligation table](../../work/p01-edit-path-performance.md#call-and-obligation-audit)
separates those uses from intermediate proof, concurrency and recovery work.
It also records the offline scope-policy implementation and its live boundary.

D44 remains six units. Direct chain insertion must first be proved for native,
VST3, CLAP and preset sources, followed by a measured composition/reversal
boundary under D55. No projected millisecond saving or new latency ceiling is
asserted from this reanalysis.
