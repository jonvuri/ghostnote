---
title: E354 — Extension-owned container scopes read and write layer chains at positions 3 and 5 in fewer turns
kind: evidence
state: active
updated: 2026-10-26
owner: B17
---

# E354 — Extension-owned container scopes read and write layer chains at positions 3 and 5 in fewer turns

## Verdict

**B17 session 1 verified live; no behavior change, fewer turns.** On Bitwig
6.1.4 (API 25) with the B17 normal build (`normal-v1`, 93 methods, hash
`d6decf985f6b1f36`, build marker `extension-owned-scopes-v1`), the extension
owns the container scopes: `chain.observe {position, expectedTrackChannelId}`
replaces `chain.scroll` plus `chain.inventory` for the product container read,
and the six chain writes (`chain.select`, `chain.duplicate`, `chain.setName`,
`chain.activate`, `chain.setSolo`, `chain.move`) name absolute positions and
chain indices and settle their own scope before they act. The E353 shape
repeated with the same results: compositions at positions 3 and 5, both
containers listed by `read_devices`, the five chain tools and a move between
the two far containers applied and read back, the solo read back through the
cursor route and the raw scope inventory, and cleanup with the project's
eleven tracks, the `gn-lay4` structure, and the mixer selection unchanged. The
extension aimed its scopes 136 times with no refusal. The brain holds no scope
state and sends no scroll.

| Question | Outcome |
|---|---|
| Same results as E353 at positions 3 and 5 | Yes: every assertion of the E353 driver holds (names, chain contents, coverage, cleanup) |
| Fewer turns | One isolated far container read: 6 turns, about 138 ms (E353: 11 turns, about 305 ms); a resting position: 6 turns, about 119 ms (E353: 8 turns, about 190 ms); `read_devices` on the four-device track 22 turns (41); the cross-container move 56 turns (80) |
| The extension settles the scope | A far position settles on the second 5 ms poll after one scroll (about 24 ms, as E352 measured); a position already settled answers in the request's own task (1 poll, no scroll) |
| Writes settle their own scope | Every chain write ran with 1 poll and 0 scrolls: the brain's preceding observation had settled the scope at the position, and the write re-established it by position, not by slot |
| Independent readback (D15) | The exclusive solo read back through the cursor route (`devcursor.selectAt` 3, `layer.list`: A true, B false) and through the raw `chain.inventory` (scope 2 settled at position 3: A true, B false) |
| Two scopes in one operation | The move between containers 3 and 5 is one `chain.move` frame naming both positions; it applied and read back (X holds Peak Limiter and Gate; B2 empty) |
| Cleanup | Scratch track removed; 11 tracks, selection on `gn-sel` before and after, `gn-lay4` chains Phase-4, Polysynth, Organ, Sampler unchanged |

## Setup

- Bitwig 6.1.4, jar SHA-256 `5c2b1895…2469f` as in NOW. Normal archive
  `ghostnote-0.0.1.bwextension` SHA-256
  `f286e47e02b3cb4da7689ba0c1f687ace23e590e8958f012ad1712a08f12cbc7`,
  deployed with `copyExtension`; the operator replaced the controller;
  `npm run probe:hello` passed with the B17 marker and fresh initialization at
  `2026-10-27T03:15:16.520Z` (UTC). `rig.info` reports `containerScopeRoute`
  and `containerScopeStatus` (`pollMs` 5, `maxPolls` 400).
- Project `gn-scale-test`, 11 tracks, mixer selection on `gn-sel`
  (`6fb96670-abde-4958-9147-f573a4b43918`) before and after.
- Driver: `npm run probe:b17-live`
  ([source](../../../brain/src/probes/b17-extension-scopes-live.ts)), the
  E353 driver re-pointed at the B17 wire. It records every tool call with its
  wire summary and the scope operations (`chain.observe` and the chain writes
  sent as top-level frames) with the extension's `aim` report (polls, scrolls,
  settle time); chain writes inside a `batch.run` are not itemized.
  Records: [attempt 2](../data/b17-extension-scopes/attempt-2/), 33 files.
  [Attempt 1](../data/b17-extension-scopes/attempt-1/) is the failing run
  that diagnosed the batch executor (below); its cleanup removed the scratch
  track.
- Scratch track `gn-b17s` (`15b2d8b7-3e06-432f-8f52-6c28f4d87170`), built by
  the tools under test: Tool, Dual Pan, Ring-Mod, then the compositions.

## Observations

### The first attempt: deferred replies inside `batch.run`

Attempt 1 stopped at the first composition's `prepare-entries` stage ("the
entry names were not proved") with no chain write on the wire. The chain
writes travel inside `batch.run`, whose executor dispatched ops through
`HandlerRegistry.invoke`, which refuses a handler that replies later. The
executor now runs ops in order and continues from a deferred op's reply, and
a scope operation releases its write lease before it replies, so the next op
of the batch can open the next scope operation in the same task. The fix
changed no method name (same hash); the operator replaced the controller
again before attempt 2.

### Compositions past position 2

`compose_devices` (FX Layer, chains A [EQ-5] and B [Gate]) at the track end
landed at position 3 in 8.8 s (252 turns; E353: 9.8 s, 275 turns). Its 18
observations of position 3 all settled through scope 2; the first scrolled
(2 polls, 1 scroll, 25.6 ms), the rest found it settled (1 poll). A second
composition (FX Layer, chain X [Peak Limiter]) landed at position 5 in 5.8 s
(E353: 6.5 s).

### Reads

`read_devices` on the four-device track: 667 ms, 22 turns, 4 observations
(E353: 1.2 s, 41 turns, 7 inventories, 3 scrolls). Scope 1 needed one scroll
at its own position 1 (clamped while the track was shorter, the E353 case,
repaired by the extension's re-scroll), and scope 2 moved 3→2→3 because a
position inside the scope count prefers its resting scope. The second read:
645 ms, 22 turns, with the same 2→3 pair. The read of the six-device track:
843 ms, 29 turns, 6 observations, 4 scrolls (E353: 1.6 s, 54 turns). The
read policy (scope 2 shuttling between its rest and the far positions) is
the P01 candidate E353 named; it now costs one observation per position
instead of a scroll frame plus a select-and-inventory pass.

Isolated container structure read, five trials each, the track not held:

| Position | Trials (ms) | Turns | Scope | E353 |
|---|---|---|---|---|
| 3 (scope rested at 2 before each trial) | 133, 145, 134, 138, 139 | 6 | 2 polls, 1 scroll, about 24 ms settle | 11 turns, about 305 ms |
| 0 (resting) | 114, 119, 121, 118, 125 | 6 | 1 poll, no scroll | 8 turns, about 190 ms |

The six turns are `revision.get`, `track.list`, `selection.status`,
`devcursor.pin`, `cursor.pointTrack`, and `chain.observe`. The far read costs
one scroll settle (about 24 ms) more than the resting read; the brain's
select-and-inventory passes and the scroll frame are gone.

### Chain tools at position 3

| Tool | Result | Time (E353) | Turns (E353) |
|---|---|---|---|
| `set_layer_chain_solo` A exclusive | applied; readback A true, B false | 585 ms (810) | 22 (27) |
| `set_layer_chain_solo` A off | applied | 566 ms (822) | 22 (27) |
| `rename_layer_chain` B → B2 | applied | 697 ms (927) | 22 (27) |
| `duplicate_layer_chain` A → C | applied; order A, C, B2 | 1.06 s (1.26) | 27 (33) |
| `copy_devices` top-level Tool → chain C | applied; C holds EQ-5, Tool | 1.39 s (1.47) | 45 (48) |
| `move_devices` C device 1 → track end | applied; order Tool, Dual Pan, Ring-Mod, FX Layer, Tool | 1.39 s (1.47) | 45 (48) |
| `move_devices` container 3 chain B2 device 0 → container 5 chain X | applied; X holds Peak Limiter, Gate; B2 empty | 1.82 s (2.46) | 56 (80) |

`chain.select` and `chain.setName` (sent as top-level frames by the create)
each reported 1 poll and 0 scrolls: the brain's observation immediately
before had settled scope 2 at position 3, and the write named the position
and found it settled. The cross-container move's `chain.move` frame named
`srcPosition` 3, `srcChain`, `dstPosition` 5, and `dstChain` inside its
`batch.run`; the final inventory showed scope 2 settled at 5 and scopes 0 and
1 at rest.

### Independent readback of the solo

After the exclusive solo of A at position 3:

- Cursor route: `cursor.pointTrack` 0, `devcursor.selectAt` 3, 200 ms,
  `layer.list` read A true, B false. The device cursor was returned to 0.
- Raw inventory: `chain.inventory` reported scope 2 at position 3, requested
  3, settled, chains A true, B false; scopes 0 and 1 settled at their rests.

### Scope status and cleanup

`rig.info` after the last write: 136 aims, 0 refusals, no operation open.
`delete_track` removed `gn-b17s`; `list_tracks` listed the original 11
tracks; `selection.status` read the mixer selection on `gn-sel` before and
after; `read_devices` on `gn-lay4` read the four-chain Instrument Layer
(Phase-4, Polysynth, Organ, Sampler) before and after. The scopes rested at
positions 0, 1, and 5 of the deleted track; the extension re-aims them on the
next operation. No scratch object, solo flag, or popup remains. No full
note-content, device-state, or saved-file equality is claimed.

## Implications

- The `containerScope` ledger row becomes: about 6 turns and 120 ms at a
  resting position, about 140 ms at a far position (one scroll settle of
  about 24 ms inside the extension).
- The brief's wire shape holds for sessions 2 and 3: absolute `position`,
  absolute chain and device indices, `expectedTrackChannelId` polled by the
  extension, one reply carrying the settled scope (`scope`), the reference
  `deviceCount`, and the `aim` report. Paging will extend `scope.chains` and
  the per-chain `devices` with absolute indices across pages.
- `batch.run` now replies later when an op does; the ops still run in order.
  A deferred op inside a batch must release any lease before it replies. An
  independent review after this run found two defects, fixed offline with
  tests and not re-run live: the batch executor dispatched every deferred
  handler, including `clip.read` and `cursor.pointExpanded`, whose completion
  closes a read the batch never opened (it now refuses the clip-read class
  inside a batch); and the brain's named-slot descent repeated
  `devcursor.selectFirstInSlot` without `devcursor.selectAt`, stacking a
  second route step so a retry could never settle (it re-selects the parent
  on every pass, as before B17). The archive with the executor fix is
  `de1ace51bcd018c7d00e74ff67799327a5ab71127d9f3a21415d7577b15d9def`; the
  live run above used `f286e47e…cbc7`, which differs only by that refusal.
- The structure-read policy (scope 2 shuttling) remains a P01 candidate; it
  is now entirely inside the extension's `choose`.
