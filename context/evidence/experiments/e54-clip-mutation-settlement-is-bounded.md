---
id: E54
kind: evidence
state: active
source: phase-4-session-4b-clip-mutation-settlement
---

# E54 — Clip mutation settlement is bounded [K] (2026-08-21)

**Verdict: the controlled two-clip expression write now completes in 7,749 ms
median, below the fixed 9,000 ms gate and the 11,444 ms E53 baseline. Exact
bulk readback remains the success proof.**

## Controlled result

The workflow used two empty 32-beat clips on one owned track in project
`26.05-2 moon`. It wrote 21 and 22 expression notes, read both clips exactly,
reversed the change, deleted the track, and restored the entry selection.

| Measure | E53 baseline | E54 result |
|---|---:|---:|
| Time | 11,444 ms | 7,524 and 7,749 ms |
| Requests | 199 | 173 and 178 |
| Stages | 4 | 4 |
| Page turns | 28 | 10 |
| Bulk page reads | 8 | 8 |

The 7,749 ms median is 32 percent below the baseline. It passes the fixed 9,000
ms gate by 1,251 ms. The stage and exact-read counts did not change. Fewer
controller and writer-page turns produced the saving.

## Settlement boundary

Adjacent note writes now share one transport frame only when they have the same
clip, MIDI channel, and exact grid. The encoder does not move a write across
another operation. Note creation still precedes property reads, and property
turns for different clips remain separate under E15-F.

The live adapter caches each confirmed pinned writer target, grid, and page for
one batch. It verifies every required boundary before mutation. It restores and
verifies page zero once after the batch or on failure. Structural operations
clear the cache and release the physical writers.

The E53 note observer is now a product wake path for one confirmed existing
clip. An arm records the observer generation, durable track ID, track index,
slot, and callback sequence. Only an exact matching event can end the
`noteWrite` wait early. Silence, dropped history, a mismatched event, or a wire
failure uses the measured fixed fallback. The observer never proves success.

## Exact reconciliation

The executor reads each touched clip once after its final mutation and compares
the complete expected state on all 16 MIDI channels. It finds a missing,
changed, or unexpected note. The comparison includes measured host defaults,
including release velocity `100 / 127`, enabled occurrence, recurrence and
repeat controls, and recurrence `[1, 1]`.

An incomplete or changed first read gets one settled exact retry. The executor
does not replay the mutation. An unexpected same-target note reports a conflict
immediately. If a later guarded dependency stage rejects after an earlier stage
landed, the executor reads the partial state and reports the remaining delta.
The stash keeps changed targets as session writes and can restore their captured
state. It does not claim a later target whose exact state did not change. A
changed note clip retains all 16 captured channels for a safe clear-and-replay.

## Verification and cleanup

The controlled workflow passed exact expression readback, the performance gate,
exact reversal, selection restoration, and scratch-track cleanup. Live exact-
read interference, 128-beat paging, background cancellation, and full
conformance also passed. Full conformance passed 54 cases with six expected
skips. The documented cleanup removed its two generated fixture tracks.

The offline brain check passed 670 tests. Extension tests, the context check,
and the diff check passed. The accepted 7-track, 8-row project baseline passed
after all cleanup.

## Retrospective

Fewer controller and writer-page turns saved the time. The observer did not
serve the two-clip performance sample, and the workflow kept all eight exact
bulk page reads. Keep those causes separate in later performance reports.
