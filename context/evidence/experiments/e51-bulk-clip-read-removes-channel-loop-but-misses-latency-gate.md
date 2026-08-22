---
id: E51
kind: evidence
state: active
source: phase-4-session-4b
---

# E51 — Bulk clip read removes the channel loop but misses the latency gate [K] (2026-08-21)

**Verdict: one bounded extension reply now returns all 16 verbose MIDI channels
for one cursor page. A 32-beat exact read uses seven bulk requests instead of
112 channel requests and preserves the accepted notes. The median fell by 35
percent, not the required 50 percent. Session 4b remains active.**

## Before and after

The read-only baseline used row 5 of `Harmony – Open Minor` in project
`26.05-2 moon`. Three old-path reads took 5,323, 5,342, and 5,308 ms. The
baseline median was 5,323 ms. Each read returned the accepted 21 notes.

The bulk path took 3,527, 3,446, and 3,195 ms. The median was 3,446 ms. All
three reads returned the same 21 notes. Each read used seven bulk page requests.
The required maximum was 2,661.5 ms.

The two-empty-clip workflow used an owned scratch track with the same seven-track
entry shape as E48. It fell from E48's 13,436 ms to 10,072 ms. Exact reversal
restored both slots to empty. Directed cleanup removed the scratch track. The
accepted 7-by-8 launcher baseline passed after cleanup.

## Phase record

The median exact read reported these named costs:

| Phase | Time |
|---|---:|
| Target acquisition and pin confirmation | 240 ms |
| Metadata | 23 ms |
| Grid and page settlement | 1,349 ms |
| Page-turn requests | 76 ms |
| Seven bulk replies | 898 ms |
| Page reset | 302 ms |
| Reconciliation | less than 1 ms |
| Selection restoration | 47 ms |
| Coordinator and other bridge work | 511 ms |

The named record explains the complete wall time. The seven host scans used 757
ms inside the extension for the median sample. Settlement is now the largest
cost. Reconciliation is not material.

For two empty clips, executor verification used 7,423 of 10,072 ms. The workflow
made 14 bulk page requests. The host scans used 1,563 ms.

## Delivered boundary

`cursor.getNotesVerboseAllChannels` bounds `maxX` to the cursor window and
returns channel number, verbose notes, per-channel count, total count, host scan
time, and clip existence. The adapter refuses a missing, duplicate, or invalid
channel and inconsistent counts. Binary and triplet scans, all expression
fields, target and pin confirmation, page reset, selection restoration, and
reconciliation rules are unchanged.

Offline tests prove distinct results on all 16 channels and refusal of an
incomplete bulk reply. The full brain check passes 657 tests with typecheck. The
extension build and the 140-method live handshake pass.

## Next measurement

Do not reduce the 144 ms grid-settlement budget. Measure a larger dedicated
note-read cursor while the 512-step writer cursors stay unchanged. A 2,048-step
reader covers a 32-beat clip in one binary page and one triplet page. Measure its
init cost and exact-read time before changing the default. Also remove redundant
page-zero turns only when one settled grid-and-page transition proves the same
result.

## Retrospective

Bridge call count was not the only dominant cost. Measure host scanning and
settlement separately before predicting a latency result from request count.
