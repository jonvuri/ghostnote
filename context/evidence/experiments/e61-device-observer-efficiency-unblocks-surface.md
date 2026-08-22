---
id: E61
kind: evidence
state: active
source: phase-4-session-4h1-device-observer-efficiency
---

# E61 — Device observer efficiency unblocks the surface [K] (2026-08-22)

**Verdict: one bounded remote reply removes the page-selection loop. Exact,
target-bound scalar completion is stable for large VST3 and CLAP inventories.
Session 4i is unblocked.**

## Remote-page result

The extension now creates 16 independent remote-page cursors with eight
controls each. One `remote.list` reply returns the complete visible page bank,
including page names, exact existing-control counts, target identity, and one
observer generation per page. A generation must be current and two complete
replies must be equal.

The accepted Polysynth route exposed nine pages. One inventory used three
`remote.list` calls and no page-selection calls. It took 1,395 ms and 31 total
bridge requests. Change, independent readback, and exact replay used 18
`remote.list` calls, no page-selection calls, 182 total requests, and 8,263 ms.
E60 used 124 list calls, 56 page selections, 335 requests, and 14,243 ms for
the replay workload.

The configured 16-page bank is the explicit host window. A target that exceeds
it stays unstable. No repeated bridge-side page-selection loop remains.

## Large-plugin completion

`directparam.set` now arms one completion observer after its final exact target
guard and immediately before its only mutation. The reply carries that
generation. Readback accepts two equal callback replies only when the armed and
current track id, device name, device position, parameter id, generation, and
normalized value all agree.

The post-write path does not request a full DirectParameter inventory and never
replays a mutation. A silent callback or a silent host write still fails exact
readback. Full inventories used for reads and preflight can re-arm at most three
observer generations. This recovery is read-only and stays inside one
serialized cursor hold.

Three repeated managed trials passed both cold and warm builds. Each build
changed and read back native, preset, VST3, and CLAP scalar values, then restored
them exactly. There were no failed or non-taking scalar receipts.

| Trial | Cold build | Warm build | Cold reversal | Warm reversal |
|---|---:|---:|---:|---:|
| 1 | 49,458 | 48,440 | 16,712 | 16,475 |
| 2 | 48,836 | 48,463 | 16,267 | 16,083 |
| 3 | 46,968 | 47,712 | 16,023 | 16,598 |

Times are milliseconds. A fourth complete performance-regression run also
passed at 49,573 ms cold and 49,261 ms warm.

## Final performance budgets

These budgets replace the provisional E60 ceilings.

| Public operation | Budget |
|---|---:|
| Native inventory | 3,500 ms |
| Top-level scalar replay | 6,000 ms |
| Plugin insert | 2,000 ms |
| Plugin insert, inventory, and replay | 15,000 ms |
| Deep scalar replay | 9,000 ms |
| Remote inventory | 2,000 ms |
| Remote replay | 10,000 ms |
| Managed mixed build | 60,000 ms |
| Managed reversal | 20,000 ms |

Keep the E60 background-progress rule for operations above 2,000 ms.

## Shared regression and cleanup

The complete native, VST3, CLAP, deep, remote, managed, interference, reversal,
and clip workload passed. The clip exact-read median was 1,786 ms. The two-clip
workflow took 6,089 ms. Full live conformance passed 54/54 with six expected
skips. Cleanup removed all owned tracks, and the final read-only baseline passed
with seven tracks and no launcher residue.

## Decision impact

Keep one serialized device cursor. The bounded remote reply removed the
measured same-target loop. The interference proof still passes, and no wider
pool has a measured benefit. Session 4i can freeze the public device surface.

## Retrospective

The first larger polling window still allowed one observer generation to stay
stale. A bounded generation re-arm was clearer and more reliable than another
timeout increase. Keep generation recovery separate from mutation completion.
