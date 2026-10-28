---
title: E357 — Integrated paged writes and cap retirement
kind: evidence
state: active
updated: 2026-10-27
owner: B17
---

# E357 — Integrated paged writes and cap retirement

## Result

**B17 session 7 is complete.** Bitwig 6.1.4 / API 25 accepted composition,
chain controls, transfers, and top-level mutations beyond the 16-device,
5-chain, and 4-device windows. Each successful tool returned its independent
readback. Two integration defects were found and corrected in the brain;
the affected steps then passed. Both owned scratch tracks were removed.
All eleven original track/device inventories and the selected track match
the baseline. No playback launch or project save ran.

The normal extension has 93 methods, hash `d6decf985f6b1f36`, and markers
`paged-windows-v3`, `paged-chain-controls-v1`, `paged-chain-moves-v2`, and
`paged-device-mutations-v1`. Descriptions remain v57 (46 tools). The
[operator record](../data/b17-integrated-live/operator.json) retains the reply
**“Controller replaced”**. The [handshake](../data/b17-integrated-live/hello.log)
passed on initialization `2026-10-28T02:58:49.135Z`, after deployment; the
local session date is October 27. Built and installed archive SHA-256:
`ac17f782d2ac4252c8259c06aee242d08f2356ac48072853973ef499c6eee5d8`.
No further extension deployment was needed for the brain fixes.

## Attempts and corrections

The [source driver](../../../brain/src/probes/b17-integrated-live.ts) uses one
foreground transport, guards the project and owned scratch identity, records
other clients, and stops on failure without retrying writes or deleting evidence.
The process check was narrowed to brain entry points: unrelated editor ACP
servers also have `dist/index.js` entry points. A bridge-connection inspection
found only Bitwig's listener, and the actual acceptance client lists are empty.

1. **Attempt 1:** seventeen Tools were inserted and verified. Composition
   inserted an empty FX Layer seed at position 17, but the subsequent paged
   `device.list` encountered the insertion's delayed item-count update and
   refused the mixed traversal. The tool incorrectly said “Nothing was written.”
   [Independent inspection](../data/b17-integrated-live/inspection-1.json.gz)
   confirmed the seed and no inserted source devices. The inspected owned track
   `f11d8e43-b4af-4f63-b94a-11f635dfcd38` was removed;
   [cleanup](../data/b17-integrated-live/cleanup-1.json.gz) verifies all originals
   and selection. The read adapter now retries this exact discarded read once,
   as it already did for an arriving track identity. Restoration failures,
   repeated read failures, and writes are not retried. Composition now reports
   possible effects if its first apply throws without a receipt, and supplies
   neither a false no-write claim nor an invented reversal ID.
2. **Attempt 2:** preflight stopped before creating scratch because a concurrently
   running offline probe-file test matched the driver check. That suite finished
   before the next attempt. No process was stopped and no live write ran.
3. **Attempt 3:** on owned `gn-b17w`, ID
   `d5082b46-5af5-4672-81ba-3b14f59a42bb`, all composition, chain-control,
   transfer, and reorder checks passed. Deleting the Gate at position 19 then
   refused before `batch.run`: the executor's ordinary device snapshot tried
   `devcursor.selectAt {deviceIndex:19}`, beyond the fixed parameter bank.
   [Inspection](../data/b17-integrated-live/inspection-3.json) confirmed twenty
   devices, Gate still at 19, and the completed transfers intact. Parameter
   acquisition now respects the physical bank reported by `device.list`;
   ordinary device snapshots fall back to paged structure when scalar access
   is unreachable. This permits structural deletion without claiming scalar
   state or lifting parameter/named-slot restrictions.
4. The [continuation](../data/b17-integrated-live/finish-live.mts) checked the
   exact inspected fixture, project, selection, clients, build markers and
   freshness, then completed only the remaining deletion, measurements and
   cleanup. [Its result](../data/b17-integrated-live/finish/020-result.json)
   passes. No successful composition or transfer was replayed.

The [summary](../data/b17-integrated-live/summary.json) retains every tool
result, arguments, elapsed time, wire count, and wire errors. Large raw exchange
files are losslessly compressed as `.json.gz`; small records and continuation
inputs remain JSON. All attempts remain available in the
[data directory](../data/b17-integrated-live/).

## Accepted behavior

- Seventeen top-level Tools were created. A five-device chain was composed in
  an FX Layer at position 17, then duplicated through six chains A–F. A second
  FX Layer with six one-device chains G0–G5 was composed at position 18,
  exercising growth beyond the five-chain preset seed.
- Public reads report the complete nineteen-device track and both complete
  containers. The sixth chain was exclusively soloed and renamed `Sixth`.
- Copying the Tool at position 16 into A grew A from five to six devices.
  Moving A's fifth device, Dual Pan, to the track end passed. Moving the fifth
  device from `Sixth` to A used distant chains in one container; moving that
  Dual Pan from A to G5 used distinct containers. Independent structure reads
  confirmed A's five Tools, G5's Tool/Dual Pan, and retained sixth-chain solo.
- Dual Pan at top-level position 19 was disabled, moved before position 0,
  read back still disabled, then deleted. Gate was inserted at position 19
  and, after the snapshot fix, deleted with verified readback. The final
  nineteen-device structure and nested transfer results remained correct.
- Raw nested chain/device windows are zero after the timed reads. Top-level
  restoration is an extension invariant covered by its harness; no separate
  raw top-bank-position reading is claimed.

## Fixture-specific costs

These are single tool samples unless otherwise stated, not latency guarantees.
The first container is considerably denser than E356: six chains contain
29 devices after the transfers (five each in A–E, four in `Sixth`). The second
has seven devices across six chains. Wire counts include existing product
preflight and staged verification, not just the mutation command.

| Operation | Wire turns | Time |
|---|---:|---:|
| Compose five devices in one chain at 17 | 565 | 26,321 ms |
| Compose six one-device chains at 18 | 703 | 44,411 ms |
| Duplicate E to sixth chain F, five devices per chain | 34 | 7,131 ms |
| Solo sixth / rename sixth | 29 / 29 | 4,956 / 5,045 ms |
| Copy top-level Tool into A | 57 | 6,653 ms |
| Move fifth device out to track end | 57 | 6,625 ms |
| Move between distant chains in one container | 63 | 8,867 ms |
| Move between containers | 70 | 7,708 ms |
| Disable top-level device 19 | 29 | 1,741 ms |
| Move device 19 before device 0 | 42 | 2,050 ms |
| Insert Gate at 19 / delete Gate at 19 | 46 / 64 | 2,576 / 3,135 ms |
| Full final `read_devices` | 68 | 3,319 ms |
| Isolated structure read at 17, five trials | 6 each | median 862 ms, range 845–884 ms |

The six-unit composition is below D44's exceptional 45-second ceiling, but
above its 30-second target and close to the ceiling. The recorded reason is
this overflow fixture's repeated paged inventories, the extra seed-growth
stage, and the existing insert-then-move stages: 703 wire turns. D44's six-unit
admission stays unchanged; P01 owns removal of the repeated proof work under
D55 and remeasurement. No broader latency bound or new live reversal timing
is established here. Reversal correctness remains covered by the overflow
composition regression suite.

The read-settlement correction adds one `device.list` and the existing
cursor-settle wait only when that read is discarded for a changing population.
The five-device composition observed five such discarded reads, each followed
by a successful new read; no mutation was repeated. Normal-path adapter call
budgets remain unchanged.

For reproduction, deploy normal ghostnote, obtain controller replacement,
run `npm run probe:hello`, refresh operator context and clients, then run from
`brain/`:

```sh
node --import tsx src/probes/b17-integrated-live.ts --out NEW_DIRECTORY
```

The isolated measurement times five consecutive `adapter.read` calls with
`structure:true` for position 17 after the final full scratch read. No deliberate
scope displacement is inserted between samples. Do not substitute E356's
smaller-fixture timing or its displacement protocol.

## Preservation and checks

The [final state](../data/b17-integrated-live/final-state.json) confirms eleven
tracks, ten scenes, `gn-scale-test`, mixer selection `gn-sel` (index 8, channel
`6fb96670-abde-4958-9147-f573a4b43918`), no selected Launcher slot, no open
scope and no write block. Selection revision advanced 1 → 5 during the two
scratch lifecycles; the selected identity was preserved. Every original
`read_devices.data` equals its baseline, including `gn-lay4`. Saved-file
identity, scalar parameters on unrelated devices, and exact UI-panel layout
were not measured.

Extension [checks](../data/b17-integrated-live/extension-check.log) pass;
[brain checks](../data/b17-integrated-live/brain-check.log) pass all **2,601 tests**,
including typecheck, profile artifacts, wire goldens and call budgets. New
regressions cover bounded population-read retry, refusal of restoration-error
retry, truthful unacknowledged insertion effects, and deletion through the full
executor at positions 16 and 19 while parameter access remains unreachable.
