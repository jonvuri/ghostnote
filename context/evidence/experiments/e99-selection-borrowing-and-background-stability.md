---
id: E99
kind: evidence
state: done
updated: 2026-09-05
parent: ../../plan/phase-5/5w-selection-borrowing-and-background-stability.md
---

# E99 — selection borrowing and background stability [K]

## Verdict

The repaired live matrix passes on Bitwig Studio 6.0.6 and Controller API 25.
One public existing-device wrapper and its reversal kept Bitwig in the
background for the complete workflow. Direct and remote scalar writes and
their reversals also stayed in the background. A 100 ms application monitor
observed only Cursor after the scripted leave from Bitwig.

The wrapper now owns one selection scope. It reuses a confirmed track or device
target only inside that scope. Every reuse checks its identity, route, pin,
generation, and structural-revision guards. A mismatch retargets before the
next read or write. A newer operator selection prevents an old restore.

## Follow-up review repair

The brain no longer reads selection state and then restores in a later wire
call. Each selection command in a composed scope carries one lease token. The
extension clears the lease when its selection observers report a different
track or launcher slot. The restore handler tests and consumes the lease before
it calls `selectSlot`. Fake transport tests cover a different operator target,
an away-and-back selection, and interference at the final handler boundary.

A failed device reuse check now clears the track hold when the track identity,
position, or pin differs. A focused test moves the complete track cursor and
proves a new `cursor.pointTrack` before the next parameter inventory.

The expanded live probe runs the same read set twice while Bitwig is frontmost
and twice after a scripted leave to another application. It compares cursor
points and the extension's observed selection-event revision. The frontmost
control made 34 points and produced one observed selection event. The scoped
background control made four points and produced no observed selection event.

The probe also runs and reverses one direct scalar and one remote scalar on the
native Tool device before the complete ColourCopy wrapper and reversal. The
adapter waits for the exact target-bound DirectParameter write callback before
it performs the complete cohort integrity read. A delayed top-level device
bank now retries until two complete consecutive readings agree.

## Live method matrix

The live trace started after target discovery and before the public wrapper.
It ended after public reversal. The trace merged adapter events, wire calls,
nested batch operations, workflow stages, and frontmost-application changes.

| Method | Frontmost control calls | Background workflow calls | Bitwig foreground transitions |
|---|---:|---:|---:|
| `cursor.pointTrack` | 34 | 20 | 0 |
| `slot.select` | 7 | 8 | 0 |
| `devcursor.selectAt` | 28 | 114 | 0 |
| `devcursor.selectInLayer` | 0 | 3 | 0 |
| `devcursor.selectFirstInSlot` | 16 | 64 | 0 |
| `devcursor.selectInSlot` | 0 | 0 | 0 |
| `devcursor.selectParent` | 0 | 0 | 0 |
| `chain.inventory` | 32 | 153 | 0 |
| `directparam.list` | 486 | 558 | 0 |
| `directparam.set` | 0 | 2 | 0 |
| `remote.list` | 54 | 111 | 0 |
| `remote.set` | 0 | 2 | 0 |
| `device.moveTo` | 0 | 1 | 0 |
| `chain.move` | 0 | 2 | 0 |

The monitor recorded one initial frontmost state, `Cursor`, and no transition.
This is a bounded host result for Bitwig Studio 6.0.6, Controller API 25, and
the accepted seven-track project. It does not claim that every plug-in UI or
Bitwig command is background-safe.

## Selection and target cost

The background workflow made 20 actual `cursor.pointTrack` calls. Confirmed
track reuse avoided 141 additional points, so the same call sequence would
have made 161 points without the fast path. It reused the exact confirmed
device target 31 times. Eight owned restore writes returned the entry launcher
selection after completed scopes.

The earlier DirectParameter acquisition moved the shared cursor to another
track before every target. The extension can now start a new observer
generation for the current route. The adapter removes that detour and performs
a full retarget only for a new or invalid target.

## Reuse and interference guards

A held track records the durable track id, current bank position, extension
generation, and local structural revision. Its next target-bound inventory
must return the same track id before the adapter retains it.

A held device also records the address route, device name, device position,
nested state, and extension route signature. Before reuse, `devcursor.status`
must confirm both pins and every recorded device and track field. A failed
check clears the hold and runs the complete target acquisition again.

Every accepted structural stage increments the local revision and clears all
track and device holds. Tests also force cursor drift and target mismatch. Both
cases retarget safely before later work.

Selection capture now covers the complete wrapper or reversal. Before restore,
the extension atomically checks and consumes the selection lease in the same
handler that can write. A focused test changes the user selection at this final
boundary and confirms that the old selection is not written back. Another test
confirms that an away-and-back user selection does not renew ownership.

## Live result and cleanup

The public wrapper moved the accepted top-level ColourCopy into one FX Layer,
added one LFO route to `Frequency`, verified its page and behavior, and returned
a complete reversal checkpoint. Public reversal restored
`Serato Sample | PITCHMAP | ColourCopy` with the original enabled states. The
native Tool scalar writes restored their exact entry values. The exact
seven-track entry list also passed.

- `npm run probe:phase5w-selection`: all live cases and exact cleanup pass.
- `npm run check`: type checking and 1,023 tests pass.
- `./gradlew test`: extension compilation passes.
- `npm run probe:hello`: deployment freshness passes.

## Retrospective

Count nested batch methods in the same trace as direct wire calls. This avoids
an incomplete cursor-cost summary. Keep reuse state inside one explicit
workflow scope so that a quiet gap cannot extend ownership. Use a known native
scalar for a method control when plug-in callback timing is not the subject.
