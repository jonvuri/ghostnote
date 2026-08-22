---
id: E52
kind: evidence
state: active
source: phase-4-session-4b
---

# E52 — Dedicated read window closes the exact-read gate [K] (2026-08-21)

**Verdict: a dedicated 2,048-step note cursor reduces the accepted 32-beat
exact-read median to 1,744 ms. The required maximum was 2,661.5 ms. Writer
cursors stay at 512 steps. Session 4b is complete.**

## Controlled comparison

The comparison used row 5 of `Harmony – Open Minor` in project `26.05-2 moon`.
Each arm used the same extension build, project, and rig sizes. Only the note
reader width changed.

| Reader | Samples | Median | Bulk pages | Grid settlement |
|---|---|---:|---:|---:|
| 512 steps | 2,842, 2,911, 3,113 ms | 2,911 ms | 7 | 1,014–1,015 ms |
| 2,048 steps | 1,821, 1,744, 1,450 ms | 1,744 ms | 2 | 289–290 ms |

All six reads returned the accepted 21 notes. The 2,048-step median is 67
percent below the 5,323 ms historical baseline. It passes the half-time gate by
917.5 ms. A second three-read run had a 1,666 ms median.

The 512-step arm used 445–703 ms of host scan time. The 2,048-step arm used
226–594 ms. The larger window did not add a consistent host-scan cost. The saved
time came from five fewer page replies and fewer complete settlements.

## Init and cursor boundary

The 512-step arm reported 94 ms of rig construction and 142 ms of extension
initialization. The 2,048-step arm reported 54 ms and 83 ms. The larger read
window did not increase measured init cost.

`fineSteps` remains 512 and sizes all writer cursors. The new
`noteReadSteps` setting sizes only the independent `fine` read cursor. Its
selected default is 2,048.

Each grid change now sends page zero before one complete 144 ms settlement. It
does not reduce the D9 budget. A one-page scan does not send a redundant page
reset. A multi-page scan still restores page zero and settles before release.

## Workflow and regression result

The two-empty-clip workflow fell from the 13,436 ms E48 baseline to 6,265 ms.
It made four bulk page requests. Exact reversal restored both slots. Cleanup
removed the owned track and restored the entry selection.

The current live regression passed a triplet start, triplet duration, expression
readback, repeated selection interference, reversal, and selection restoration.
The 128-beat long-clip probe passed its multi-page note and expression check and
removed its disposable clip. Background completion and cancellation passed.
The accepted 7-by-8 project baseline passed after cleanup.

The archived Phase 2h aggregate refused before mutation because its retired
`gn-scale-test` identities are not the current accepted project. The current
focused probes cover the affected boundaries.

## Retrospective

Cursor allocation was not the limiting cost. Page settlement was. Keep writer
and read widths separate when their coverage needs differ.
