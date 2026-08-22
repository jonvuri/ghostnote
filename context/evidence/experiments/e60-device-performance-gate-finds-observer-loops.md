---
id: E60
kind: evidence
state: active
source: phase-4-session-4h-device-performance-gate
---

# E60 — Device performance gate finds observer loops [K] (2026-08-22)

**Verdict: complete device workflows are correct but not ready for the public
surface. Repeated guarded observer acquisition, verification, and chain reads
dominate. Cold plugin load does not. A wider cursor pool is not justified.**

## Complete measurements

Times are milliseconds. Server time is extension execution reported by the
wire reply. Host-settle time is wall time outside measured server and bridge
request time. Each replay row includes change, independent readback, and exact
restore.

| Workload | Wall | Server | Bridge requests | Host settle | Dominant phase |
|---|---:|---:|---:|---:|---|
| Native project enumeration | 2,797 | 0.0 | 81 | 918 | observer stabilization |
| Native scalar replay | 6,059 | 0.6 | 127 | 3,162 | verification |
| VST3 insert, inventory, replay | 11,872 | 2.3 | 252 | 6,260 | verification |
| CLAP insert, inventory, replay | 12,499 | 2.1 | 267 | 6,545 | verification |
| Deep-route construction | 2,060 | 0.0 | 47 | 1,011 | construction |
| Depth-1 scalar replay | 8,169 | 0.5 | 179 | 4,116 | verification |
| Depth-2 scalar replay | 9,403 | 34.3 | 210 | 4,542 | verification |
| Drum-pad scalar replay | 8,032 | 0.2 | 176 | 4,015 | verification |
| Depth-2 remote inventory | 2,337 | 0.0 | 55 | 1,073 | observer stabilization |
| Depth-2 remote replay | 14,243 | 0.6 | 335 | 6,662 | verification |
| Managed cold build | 50,203 | 18.4 | 1,163 | 23,717 | planned settlement |
| Managed warm build | 50,426 | 16.1 | 1,170 | 23,716 | planned settlement |
| Managed cold reversal | 16,127 | 1.4 | 438 | 6,040 | stash |
| Managed warm reversal | 16,651 | 1.8 | 449 | 6,326 | stash |

The VST3 insertion was 1,575 ms. Its first complete inventory was 1,402 ms.
The CLAP insertion was 1,576 ms. Its first inventory was 1,624 ms. Verification
then used 8,894 ms for VST3 and 9,295 ms for CLAP. Plugin construction is
separate from ghostnote overhead in these rows.

The managed cold and warm builds differ by less than one percent. Warm loading
does not reduce the workflow cost. The managed build used 12 extension batches,
but 1,163 to 1,170 total bridge requests. It repeated 124 track lists, 124
cursor points, about 118 device lists, and 84 DirectParameter list reads.

## Observer findings

One remote inventory must select and settle every page because the extension
has one cursor remote page. A depth-2 remote change and replay used 124
`remote.list` calls and 56 page selections. This is a repeated page loop. No
current bounded reply can preserve all page identities and controls.

Large plugin inventories can also make the adapter's immediate post-write
observer generation unstable. Exact later readback still proved the landed and
restored value. A measured same-generation reuse trial was rejected. The
observer values stayed stale after the write. The trial was removed.

These costs are on one serialized cursor, but a wider pool is not the current
answer. The repeated work is mainly sequential proof for one target or one
remote page set. A wider pool would add isolation work without removing those
loops.

## Budgets and progress thresholds

Keep the existing 24 ms cursor-point, 194 ms parameter-live, and 600 ms device-
insert settle budgets. This session did not measure a safe lower boundary.

Use these measured ceilings for session 4i:

| Public operation | Budget |
|---|---:|
| Native inventory | 3,500 ms |
| Top-level scalar replay | 7,000 ms |
| Plugin insert | 2,000 ms |
| Plugin insert, inventory, and replay | 15,000 ms |
| Deep scalar replay | 11,000 ms |
| Remote inventory | 3,000 ms |
| Remote replay | 16,000 ms |
| Managed mixed build | 60,000 ms |
| Managed reversal | 20,000 ms |

Any public operation with a budget above 2,000 ms must return background
status. It must report the first progress state by 2,000 ms, report each phase
change, and report a heartbeat at least every 5,000 ms.

## Shared regression and cleanup

The exact 32-beat clip median was 1,936 ms. This stays below the fixed 2,661.5
ms gate. Two empty 32-beat clips took 6,352 ms, compared with 6,265 ms in E52.
Reversal restored both slots. All device probes removed their owned tracks and
restored the entry selection and seven-track baseline.

## Decision impact

Session 4i remains blocked. The focused observer-efficiency follow-up must
replace the remote page loop with a bounded complete reply or prove that the
Bitwig API cannot support one. It must also make plugin post-write readback
stable without replaying a mutation. Only then can the public schema freeze.

## Retrospective

The gate found a product design problem, not only a slow implementation loop.
The current observer shape exposes one remote page at a time. Keep the
performance trace. Do not add cursor concurrency until bounded replies remove
same-target repetition.
