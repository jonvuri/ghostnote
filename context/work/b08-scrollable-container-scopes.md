# B08 — Scrollable container scopes and nested reach

Research brief, promoted from `later` on 2026-10-25 after a live run and a
review surfaced the same latent limit: a layer container inserted after
top-level position 2 has no observable chains until it is moved. The operator
confirmed the limit is unwanted and asked for it to be addressed by
construction rather than by a larger fixed bank.

## Goal

Remove the fixed three-position limit on layer-chain observation and writes
without adding permanently observed banks, by turning the fixed slot scopes
into scrollable windows. Establish, with live evidence, that a layer bank hung
off a slot of a scrollable `DeviceBank` retargets when that bank scrolls, and
measure the retarget cost. Then extend the same mechanism to the five-chain and
four-device nested windows and, if cheap, the 16-wide top-level bank.

Sources: [containers capability](../evidence/capability/containers.md) §6 for
the current scope design and the retarget-lag measurement; D6 and
[D7](../decisions/d7-pre-allocation-scaffold-sizes-settled-2026-07-25.md) for
init-only allocation and the five-wide observer amendment;
[E63](../evidence/experiments/e63-device-dogfood-exposes-ab-selection-gap.md)
for the first natural occurrence of the limit; wave-3 DP-3 in
[devices-and-parameters](../plan/overlap/wave-3/devices-and-parameters.md)
for the original candidate scope; the
[performance ledger](../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) row for
`containerScope` (about 190 ms, E238).

## What is known

### The limit and where it lives

- The extension observes a container's chains only through a `DeviceLayerBank`
  created at `init()`. `Rig.SLOT_SCOPES = 3` scopes hang off slots 0, 1, and 2
  of the 16-wide track device bank `cursorDeviceBanks[0]`
  (`extension/src/main/java/com/ghostnote/extension/Rig.java:247`, allocation
  at line 1214). Each scope holds `SLOT_LAYER_BANK = 5` chains with
  `SLOT_LAYER_DEVICE_BANK = 4` devices each, all marked permanently.
- The brain mirrors the limit as `LAYER_CHAIN_POSITIONS = 3`
  (`brain/src/surface/agent-native-devices.ts:81`). `read_devices` reports
  `layerChains: outside-limit` past position 2; `set_layer_chain_solo`,
  `rename_layer_chain`, `duplicate_layer_chain`, chain-targeted
  `move_devices`/`copy_devices`, and `compose_devices` refuse there
  (lines 227, 693, 764, 1123). The fake model carries `containerScopes = 3`
  (`brain/src/adapters/fake/model.ts:197`), and the live adapter reads
  `containerScopes` from the hello (`brain/src/adapters/live/adapter.ts:1445`).
- Only container internals are affected. A device at any position inside the
  16-wide bank is otherwise fully readable, controllable, movable, and
  deletable. Position 16 and later are outside the bank entirely.

### Why the scopes are fixed, and what must survive

- An earlier design read chains through `layerBank0`, which follows
  `cursorDevice0`. Two faults drove the fixed scopes: every `layer.*` call was a
  silent no-op when the cursor was elsewhere, byte-identical to an API refusal
  (E16o); and a rebuild needs a source chain in one container and a destination
  chain in another live at once, which one cursor cannot provide (E18 §3.1).
  Moving the cursor would also re-aim every parameter write in the same batch.
- Any replacement must keep: the container named by parameter, not by cursor
  state; at least two containers addressable simultaneously; and an identity
  guard that fails closed when the handle has not settled.
- The sizing came from the A/B and compose workflows, which are now recipes
  over generic tools rather than product objects. The managed alternate tools
  survive only in `stable-v1` (C01 retires them). The limit is therefore a
  product property of the observation design, not a workflow dependency.

### What the API offers (API 25 text, `reference/BitX/BitwigAPI/BitwigAPI25.txt`)

- `Bank<ItemType> extends ObjectProxy, Scrollable`: a bank "basically acts
  like a window moving over the list of underlying items." `Scrollable` has a
  settable `scrollPosition()`, `scrollIntoView(int)`, `scrollBy(int)`,
  `canScrollForwards()`, `canScrollBackwards()`.
- `DeviceBank.getDevice(indexInBank)`: "the device index within this bank, not
  the position within the device chain." A one-wide device bank scrolled to
  position P exposes position P at bank index 0.
- `DeviceLayerBank extends ChannelBank<DeviceLayer>`, so chain windows scroll
  too, and the per-layer `DeviceBank` from `DeviceLayer.createDeviceBank`
  scrolls as well. `Device.createLayerBank` is declared on `Device`, so it hangs
  off a plain bank slot (already relied on).
- `Bank.setSizeOfBank(int)` (API 7) resizes within the init capacity; this is a
  secondary option and scrolling is the cleaner fit.
- Precedent in this repository: `BrowserDiscoveryProbe.java:118-156` sets
  `scrollPosition()` on browser filter columns and the results list and reads
  through the moved window. DrivenByMoss scrolls drum-pad and send banks with
  `scrollTo`. No external reference scrolls a device bank with a layer bank
  hung on it; that retargeting is inferred, not measured.
- Child proxies already follow their parent: the slot scopes retarget when
  `cursorTracks[0]` points at another track, with a measured settle of 100 ms
  for 6/6 correct reads and an eight-attempt identity retry
  ([containers](../evidence/capability/containers.md) §6). A scroll should
  behave the same way; the probe confirms or refutes this.

## Proposed mechanism

Allocate `SLOT_SCOPES` dedicated one-wide device banks on `cursorTracks[0]`
(`scopeBanks[s] = cursorTracks[0].createDeviceBank(1)`), each with its layer
bank and nested device banks exactly as the current scopes. A handler scrolls
scope `s` to the requested top-level position, waits until the scope's device
name and existence match the same position in the 16-wide bank, then reads or
writes. Positions 0 to 2 can keep a resting scroll of 0 so the common case does
not regress. Two scopes aimed at two positions preserve simultaneity for
relocation and composition. Permanently observed handles stay at 3 × 5 × 4.

Nested windows use the same pattern: scroll the layer bank for chain indices
past 4 and the per-layer device bank for device indices past 3, with the
existing `coverage` field stating window size and completeness.

The brain removes `LAYER_CHAIN_POSITIONS` as a hard ceiling and replaces the
plan-time refusals with the scroll-and-verify step, keeping `outside-limit`
only for the real bank edges. The fake model, wiremap comments, `CoreHandlers`
resource accounting, `read_devices` description, call-budget tests, and the
ledger `containerScope` row change together.

## Work and acceptance

Research first, as a bounded live probe on an owned scratch track in the
probe profile:

1. Build one scrollable one-wide device bank with a hung layer bank beside the
   existing scopes. On a track with four or more devices and a layer container
   at position 3 or later, set `scrollPosition` to that position and read chain
   count, names, and nested device names through the new scope. Compare with
   the same container read at position 0 through an existing scope.
2. Measure the retarget settle: reads at 0, 25, 50, 100, and 200 ms after the
   scroll, reporting correct-identity counts as containers.md §6 does.
3. Scroll out of range (past the item count) and record clamping and the
   `canScrollForwards` value.
4. Scroll the layer bank of a six-chain container and the device bank of a
   five-device chain; confirm the window moves and `itemCount` is total.
5. Write one solo through a scrolled scope and read it back independently
   through a different scope aimed at the same container (D15).

Acceptance for the research step: a verdict per question above with timings,
an E record, and a go or no-go for implementation. Implementation acceptance,
if go: `read_devices` lists chains for a container at position 3 or later
without a move; the five chain tools and `compose_devices` work there; offline
tests and call-budget tests updated; the ledger row for `containerScope`
re-measured; cleanup of the scratch track and preserved project state checked.

## Risks and open questions

- Retargeting of a hung layer bank after a device-bank scroll is unproved
  (`[U]`). If it fails, the fallback is a larger fixed bank, which the
  operator does not prefer.
- Retarget cost adds per-call latency the fixed scopes do not have. The
  resting-scroll choice keeps positions 0 to 2 at current cost.
- A scrolled window makes the bank index a hidden argument if a handler reads
  the window after another handler moved it. One foreground driver chain and
  the identity guard address this; the probe must show the guard fails closed.
- `setSizeOfBank` may interact with marked handles; not needed for the primary
  route and not investigated here.

## Result

Research complete on 2026-10-25: **go**.
[E352](../evidence/experiments/e352-scrollable-container-scopes-retarget-live.md)
records the probe. A layer bank hung off a one-wide scrollable device bank on
cursor track 0 retargeted to the container at the scrolled position every
time, including position 3, with the complete identity correct on the first
read at 0 ms wait (6/6 at each fixed wait; polled first-correct 23 ms, which
is one status round trip). Out-of-range scrolls clamp to `itemCount - 1`. The
nested chain window (width 3 over 5 chains) and device window (width 2 over 4
devices) scroll with `itemCount` reporting the total. A solo written through a
scrolled scope at position 3 read back through an independent scope and the
cursor route and was cleared. Two scopes at two containers read correctly in
one reply.

Deviations from the plan above: the nested windows were made narrower than
the product's (3 and 2 instead of 5 and 4) so that compose-built content
needed scrolling; the six-chain and five-device shapes were not built. The
guard's refusal path could not be shown live because no stale state was
observable at wire granularity; it is covered by the offline host models.

Implementation notes from the probe: identity must not rest on the slot name
(two containers of one kind share it); guard on the requested position, the
reported position, the reference bank's name there, and the chain name, and
refuse a clamped request. A read past position 2 costs the fixed-scope read
plus one scroll request; resting positions 0 to 2 need no scroll. Re-measure
the `containerScope` ledger row during implementation. After a controller
replacement, a running MCP server needs a reconnect before product tools
answer (E352).

Probe sources: `extension/.../ScopeScrollProbe.java`, `ScopeScrollHandlers.java`,
`brain/src/probes/b08-scope-scroll-lib.ts` with offline tests, and
`npm run probe:b08-scope`. The probe profile now has 120 methods.

## Implementation

Complete on 2026-10-25, verified live in
[E394](../evidence/experiments/e394-scrollable-container-scopes-product-live.md).

- Extension: each of the three product scopes is a one-wide `DeviceBank` on
  cursor track 0 (`Rig.scopeBanks`), resting at its own index, with the layer
  bank and nested device banks hung off its slot. `chain.scroll` (new product
  method; normal profile 93 methods, hash `a44ce79ed75df81b`) aims a scope.
  `chain.inventory` reports `position`, `requestedPosition`, `settled`
  (`Rig.scopeSettled`: reported equals requested, and the slot agrees with
  the 16-wide reference bank on existence, name, and device position), the
  reference `deviceCount`, and `deviceBankSize`. Every chain write takes the
  scope slot plus the container `position` and refuses an unsettled scope;
  `chain.move` names scopes for chain endpoints and positions for named-slot
  endpoints. The cursor-bound named-slot route reaches the whole bank.
- Brain: `LiveAdapter.containerScope` finds a settled scope at the position,
  scrolls one when needed (own scope for a resting position; otherwise a
  displaced scope, then the highest slot), re-issues the scroll on every
  unsettled pass (a bank scrolled on a track with fewer devices clamps and
  stays, E394), answers an empty position from the reference count, and
  records the scope for the encoder. Relocations and chain-create batches
  hold their scopes so two containers stay settled at once; the relocation
  preflight reads only endpoint containers. The fake's reach is the bank
  width. The five chain tools, `compose_devices` (engine capacity 16), and
  `read_devices` (chains at every bank position; `coverage.layerChainPositions`
  lists the positions read; `layerChains: outside-limit` gone) changed with
  descriptions v55. Call-budget tests cover a container at position 3; the
  conformance suite's blind position is the bank edge.
- Nested windows (more than five chains or four devices in a chain) stay at
  their fixed sizes; the inventory still reports completeness. Scrolling
  them is a follow-up if a workflow needs it.
- Cost: an isolated far container read is about 305 ms and 11 turns (one
  scroll); resting positions keep about 190 ms. A `read_devices` aims one
  scope at every position past 2 in turn, containers or not, and sends scope
  2 back to 2 on each read; a cheaper structure-read policy is a P01
  candidate.
- The running MCP server keeps the brain it started with; restart it to serve
  v55 and the new reach.
