---
title: E394 — The product's scrollable container scopes read and write layer chains at positions 3 and 5
kind: evidence
state: active
updated: 2026-10-25
owner: B08
---

# E394 — The product's scrollable container scopes read and write layer chains at positions 3 and 5

## Verdict

**B08 implementation verified live.** On Bitwig 6.1.4 (API 25) with the B08
normal build (`normal-v1`, 93 methods, hash `a44ce79ed75df81b`), the product
tools composed an FX Layer at top-level position 3 and another at position 5
of a scratch track, listed both containers' chains through `read_devices`,
and ran `set_layer_chain_solo`, `rename_layer_chain`,
`duplicate_layer_chain`, `copy_devices`, and `move_devices` (within the far
container, to the track end, and between the two far containers) with every
result proved by the tools' own readback and by two independent routes for
the solo. The scratch track was deleted; the project's eleven tracks, their
IDs, the `gn-lay4` structure, and the mixer selection were unchanged.

One defect surfaced and was fixed during the session: a scope scrolled while
cursor track 0 sat on a track with fewer devices clamps to position 0 and
stays there after the track gains devices. The adapter now re-issues the
scroll on every unsettled pass instead of waiting for a scope it already
asked for.

| Question | Outcome |
|---|---|
| `read_devices` lists chains at position 3 or later without a move | Yes: positions 3 and 5 listed with `coverage.layerChainPositions` covering every device position |
| The five chain tools work there | Solo (exclusive, off), rename, duplicate, copy into, move out of, and move between two far containers all applied and read back |
| `compose_devices` past position 2 | Two compositions at the track end (positions 3 and 5) with the container witness read through a scrolled scope |
| Independent readback (D15) | The solo read back through the cursor route (`devcursor.selectAt` 3, `layer.list`) and through a second scope aimed at 3 by a direct `chain.scroll` |
| Two scopes held at once | The move between containers 3 and 5 settled scope 2 at 3 and scope 1 at 5 |
| `containerScope` ledger row | About 305 ms, 11 turns, for one isolated far container read (one scroll); the resting positions keep the earlier 8-turn cost |
| Cleanup | Scratch track removed; 11 tracks with unchanged IDs, selection on `gn-sel`, `gn-lay4` four chains unchanged |

## Setup

- Bitwig 6.1.4, jar SHA-256 `5c2b1895…2469f` as in NOW. Normal archive
  `ghostnote-0.0.1.bwextension` SHA-256
  `d225c4389cd09a128621e6ea63f40347c3df9382a7029807c1966c91e89afc16`,
  deployed with `copyExtension`; the operator replaced the controller;
  `npm run probe:hello` passed with fresh initialization at
  `2026-10-25T23:37:26.947Z`. `rig.info` reported `containerScopes` 3 and
  `containerScopePositions` 16.
- Project `gn-scale-test`, 11 tracks, mixer selection on `gn-sel`
  (`6fb96670-abde-4958-9147-f573a4b43918`) before and after.
- Driver: `npm run probe:b08-live`
  ([source](../../../brain/src/probes/b08-scrollable-scopes-live.ts)). It
  builds the product workspace on a live adapter (with the handshake, which
  tells the adapter the bank width the scopes reach), and records every tool
  call with its wire summary, scroll frames, and the scope exchanges
  (`chain.scroll`, `chain.inventory`, `devcursor.selectAt` with replies).
  Records: [attempt 5](../data/b08-scrollable-scopes/attempt-5/), 29 files.
  [Attempt 4](../data/b08-scrollable-scopes/attempt-4/) is the failing run
  that diagnosed the clamp, and [attempt 2](../data/b08-scrollable-scopes/attempt-2/)
  the first run through the chain tools; attempts 1 and 3 refused or failed
  earlier (see below) and are kept only as summaries here.
- Scratch track `gn-b08i` (`78fcc039-6663-4f73-9d70-4ce3859fe43c`), built by
  the tools under test: Tool, Dual Pan, Ring-Mod, then the compositions.

## Observations

### Compositions past position 2

`compose_devices` (FX Layer, chains A [EQ-5] and B [Gate]) at the track end
landed at position 3 in 9.8 s (275 turns, one `chain.scroll` 2→3). The
container witness read, which proves the empty seed structure before the
chains are named, read the container through scope 2 on the first inventory
after the scroll (scope reply: position 3, requested 3, settled, `FX Layer`,
two chains). A second composition (FX Layer, chain X [Peak Limiter]) landed at
position 5 in 6.5 s with one scroll 2→5.

### Reads

`read_devices` on the four-device track: 1.2 s, 41 turns, 7 inventories,
scrolls 1→1 (a clamped resting scope repaired), 2→2, 2→3; the result listed
Tool, Dual Pan, Ring-Mod, and the FX Layer with chains A [EQ-5] and B [Gate],
`coverage.status` complete, `layerChainPositions` [0, 1, 2, 3]. The second
read: 1.1 s, 36 turns, scrolls 2→2 and 2→3. On the six-device track the read
cost 1.6 s, 54 turns, scrolls 2→2, 2→3, 2→4, 2→5: every position past the
scope count is read through scope 2 in turn, including non-container devices.

Isolated far container read (the ledger row): scope 2 was rested at 2, then
one structure read of the device at position 3 was timed, five trials:

| Trial | Total | Turns | Wire busy |
|---|---|---|---|
| 1 | 307 ms | 11 | 254 ms |
| 2 | 303 ms | 11 | 250 ms |
| 3 | 307 ms | 11 | 255 ms |
| 4 | 299 ms | 11 | 247 ms |
| 5 | 306 ms | 11 | 254 ms |

Each trial sent one `chain.scroll`. The earlier fixed-scope cost was about 8
turns (190 ms, E238); the scroll adds the scroll frame and a second
select-and-inventory pass.

### Chain tools at position 3

| Tool | Result | Time | Turns | Scrolls |
|---|---|---|---|---|
| `set_layer_chain_solo` A exclusive | applied; readback A true, B false | 810 ms | 27 | none (scope 2 already at 3) |
| `set_layer_chain_solo` A off | applied | 822 ms | 27 | none |
| `rename_layer_chain` B → B2 | applied | 927 ms | 27 | none |
| `duplicate_layer_chain` A → C | applied; order A, C, B2 (the copy lands after its source) | 1.26 s | 33 | none |
| `copy_devices` top-level Tool → chain C | applied; C holds EQ-5, Tool | 1.47 s | 48 | none |
| `move_devices` C device 1 → track end | applied; order Tool, Dual Pan, Ring-Mod, FX Layer, Tool | 1.47 s | 48 | none |
| `move_devices` container 3 chain B2 device 0 → container 5 chain X | applied; X holds Peak Limiter, Gate; B2 empty | 2.46 s | 80 | 2→3, 2→5, 2→3, 1→5 |

The last row shows the hold: the tool's own structure reads aimed scope 2 at
3 and then at 5; the adapter's relocation preflight then re-aimed scope 2 at
3 for the source and, with scope 2 held, aimed scope 1 at 5 for the
destination, so both endpoints were settled when the move frame was sent.

### Independent readback of the solo

After the exclusive solo of A at position 3 (written through scope 2):

- Cursor route: `cursor.pointTrack` 0, `devcursor.selectAt` 3, 200 ms,
  `layer.list` read A true, B false. The device cursor was returned to 0.
- Second scope: `chain.scroll` slot 1 to 3, 100 ms, `chain.inventory` read
  scope 1 at position 3, requested 3, settled, chains A true, B false. Scope 1
  was scrolled back to 1.

### The clamped scope (attempts 3 and 4, fixed)

Attempt 4's compose witness never settled: eight inventories in a row reported
scope 1 at position 0 with requested 1 and scope 2 at position 0 with
requested 3, both showing `Tool` (position 0), while `deviceCount` was 4. The
requests came from the previous run, when cursor track 0 was on another
track; when the cursor moved to the new scratch track (empty at that moment),
the one-wide banks clamped to 0 and did not move when devices were added.
The adapter treated a scope whose `requestedPosition` already matched as
"waiting" and never scrolled again, so the read exhausted its eight passes
and the composition failed at `container-witness` with the inserted
container left in place for `revert_change`; the driver deleted the scratch
track with it.

The fix re-issues the scroll on every unsettled pass. In attempt 5 the same
state (scope 2 at 0, requested 3) was repaired by one `chain.scroll` 2→3; the
next inventory, 123 ms later, reported the scope settled at 3. The offline
host model now covers this case
(`B08 container scope: a scope clamped on an earlier track is re-aimed`).

Attempts 1 and 2 refused earlier: the staged composition engine kept its own
`topLevelContainerPositions: 3` capacity (now 16), and the driver had not run
the adapter handshake, so the adapter did not know the bank width and treated
position 3 as past the scopes. Attempt 2 (handshake added) then passed every
step through `copy_devices` before an expectation about the duplicate's
position (it lands after its source, not at the end) stopped the run; its
records were kept during the session and superseded by attempt 5.

### Cleanup and preserved state

`delete_track` removed `gn-b08i`; `list_tracks` listed the original 11 tracks
with the same IDs in the same order; `selection.status` read the mixer
selection on `gn-sel` before and after; `read_devices` on `gn-lay4` (through
the running MCP server) read the four-chain Instrument Layer (Phase-4,
Polysynth, Organ, Sampler) unchanged. The final inventory before deletion
showed scopes 0, 1, and 2 at positions 0, 1, and 5. No scratch object, solo
flag, or popup remains. No full note-content, device-state, or saved-file
equality is claimed.

## Implications

- The ledger row `containerScope` gains a far-position variant: about 305 ms
  and 11 turns with one scroll, against about 190 ms and 8 turns at a resting
  position.
- A `read_devices` on a track with many devices past position 2 aims one scope
  at each of them in turn, containers or not; the scope choice (highest slot
  first) also sends scope 2 back to position 2 on every read. A cheaper
  policy for structure reads (skip the scope for a device the bank already
  shows is not a container, or rotate the far scope) is a P01 candidate.
- The running MCP server keeps the brain it started with: product tools
  through it still carry the v54 descriptions and the three-position checks
  until it restarts; position 0 through 2 reads through it worked against the
  new extension because the scopes rest there.
