# B17 — Scrolling windows inside the extension, and the window-derived caps

Implementation brief, opened on 2026-10-25 after B08 shipped scrollable
top-level scopes. The operator asked that the remaining fixed windows be
lifted as well, reads first, now that
[E352](../evidence/experiments/e352-scrollable-container-scopes-retarget-live.md)
has proved the nested windows scroll the same way.

## Goal

Make every top-level device, every layer chain of a container, and every
device inside a chain observable, whatever their count, by scrolling the
three remaining fixed windows instead of treating their width as the reach:
the 16-wide top-level device bank (`RigConfig.deviceBank`), the five-chain
window (`SLOT_LAYER_BANK`), and the four-device window
(`SLOT_LAYER_DEVICE_BANK`). Move the scroll-and-settle logic, including
B08's top-level container scopes, out of the brain into opaque extension
operations that scroll as needed and reply once. Then retire the product
limits that exist only because of the window widths. Reads come first;
writes follow when the read is proved.

Sources: [B08 brief](b08-scrollable-container-scopes.md) and
[E353](../evidence/experiments/e353-scrollable-container-scopes-product-live.md)
for the shipped top-level mechanism and its guard; E352 §4 for the nested
window measurements (chain window moved over 5 chains, device window over 4
devices, `itemCount` total, over-range clamps); `ScopeScrollProbe.java`
(`scrollLayers`, `scrollDevices`) for the probe operations;
[containers capability](../evidence/capability/containers.md) §6 and §7.

## What is known

- The product inventory already reports `chainCount` (`itemCount` of the
  layer bank) and `deviceCount` per chain, so a reader can tell a full window
  from an overflowing one today; it reports the overflow as incomplete and
  the tools refuse on it (`chainsComplete`, `devicesComplete`).
- Every chain write carries `layerIndex`, the index **inside the chain
  window**, checked against `expectedName`. Device relocations inside chains
  carry `srcDevice`/`srcLayer`, likewise window-relative. A scrolled window
  makes these indices depend on the window position, exactly as the B08 top
  level did; the fix is the same: the request names the window position and
  the extension refuses an unsettled or differently positioned window.
- E353 found that a scroll issued while the bank has fewer items clamps and
  stays after the bank grows. Nested windows will show the same behaviour
  when a container gains chains or a chain gains devices; the brain must
  re-issue a nested scroll on every unsettled pass, as it now does at the
  top level.
- Limits that derive from the window widths: `duplicate_layer_chain` refuses
  at 5 chains; `compose_devices` admits 1 to 5 chains of 1 to 4 devices
  (`GENERAL_DEVICE_COMPOSITION_CAPACITIES.entriesPerLayer`,
  `devicesPerEntry`); `move_devices`/`copy_devices` refuse a destination
  chain with 4 devices; `read_devices` reports `capacity` and
  `deviceCapacity`; the fake carries `chainBankSize` and
  `chainDeviceBankSize`. The D44 device-unit budget (6 units) is a time
  bound and stays; see P01 for its re-weighting.

- **The 16-wide top-level bank is also a window.** Every top-level read
  and write (`device.list`, insertion proofs, moves, deletes, controls) goes
  through `cursorDeviceBanks`, 16 wide; position 16 and later is
  `outside-bank-window` everywhere, and B08's scopes reach only inside it.
  The B08 brief named scrolling it as optional; it was not done.
- **Deferred extension replies are an established product mechanism.**
  `HandlerRegistry.onAsync` hands a handler a `Bridge.Reply` that it calls
  later. The normal profile already uses it for `clip.read` (8h3c) and
  `cursor.pointExpanded` (8h4a5): each schedules host tasks, polls until the
  host settles, replies once, and holds the `WriteGate` read lease so no
  write interleaves. The Grid probe, doctor, and engine handlers use the
  same path. Nothing in the record rejects it. What was rejected is a
  different thing: MCP-level background operations, where a tool returns a
  handle and the agent polls (D39; its 8h4g amendment removed the route
  from `agent-native-v1` because the worst case fell far under the 60 s
  client timeout and polling cost every agent a second envelope). An
  extension operation that settles internally and replies once is a single
  synchronous tool call from the agent's side. The early E8 note that "the
  Bridge writes a handler's response when it returns" predates `onAsync`.
- Constraints that carry over: a handler cannot see its own scroll in the
  same turn (E2, E352), so settling is a scheduled poll; D27 (a zero-delay
  task runs after the rest of the delivery batch) bounds what one poll can
  observe; the `WriteGate` has a read lease only, so an async operation that
  writes (solo, rename, move) needs a write-lease variant.

## Proposed mechanism

**Extension-owned scrolling (first).** Replace the brain's scope choice,
settle polling, scope hold, and stuck-scroll repair with async extension
operations that name targets by absolute position: for example
`container.read {position}` and the chain writes taking `position` and
absolute chain and device indices. Each picks a scope, scrolls the
top-level, chain, and device windows as needed, polls with
`host.scheduleTask` until `scopeSettled` holds (bounded attempts, re-issuing
a stuck scroll, E353), performs the read or write, and replies once. A
two-container move is one operation that holds both scopes. The brain's
`containerScope`, `chooseScope`, `scopeSlots`, and the encoder's scope slot
go away; `chain.scroll` and the window-relative indices leave the wire
(check probe consumers first). Expected saving: two to three wire turns per
far read, about 50 to 75 ms, and one owner for the guard. D55 applies: the
operation trusts the proved route and the tool keeps one readback at the
end.

**Window paging.** The same operations page the nested windows and the
top-level bank: the extension scrolls each window over `itemCount` and
stitches the pages into one reply, so `chainsComplete` and
`devicesComplete` describe the whole container and `read_devices` sees
every top-level device. The details below are the brain-side alternative,
kept for reference if the extension route is refused at implementation.

Extension: two product methods, `chain.scrollLayers {slot, position}` and
`chain.scrollDevices {slot, layerIndex, position}`, each recording the
requested position on the scope; `chain.inventory` reports, for the chain
window and for each chain's device window, `position`, `requestedPosition`,
`itemCount`, `canScrollForwards`, and a `settled` flag (reported equals
requested, position inside `itemCount`). Chain writes accept optional
`layerWindow` and `deviceWindow` positions and refuse a window that is not
settled there. Nothing is allocated beyond today's 3 × 5 × 4 handles.

Brain: `containerScope` reads a container in pages when `chainCount` exceeds
the window or a chain's `deviceCount` exceeds its window, scrolling the
nested window, re-reading, and stitching the pages into one
`ObservedContainer` whose `chainsComplete`/`devicesComplete` describe the
stitched result. Each observed chain keeps its absolute index; the encoder
sends the window position alongside the window-relative index. `read_devices`
`coverage` reports the window sizes and the pages read. The fake pages the
same way so the conformance suite covers overflow on both adapters.

Caps: `duplicate_layer_chain` and the relocation destination refuse only at
a stated product bound (propose 16 chains and 16 devices per chain, the
top-level bank width, so one number recurs) rather than the window width;
`compose_devices` keeps the device-unit time budget as its only admission
limit and loses the 5 × 4 shape cap; descriptions and schemas change
together (description version bump).

## Work and acceptance

0. Move B08's top-level scope logic into async extension operations with a
   write lease; prove on the E353 scratch shape that reads and writes at
   positions 3 and 5 are unchanged in result and cheaper in turns; retire
   `chain.scroll` and the brain's scope state.
1. Extension methods and inventory fields, offline host model, goldens,
   `RuntimeProfile` sizes, resource accounting.
2. Paging of the chain and device windows and of the 16-wide top-level
   bank inside those operations; fake paging; conformance cases for 6
   chains, 5 devices in a chain, and 17 top-level devices on both adapters.
3. `read_devices` lists a 6-chain container and a 5-device chain completely;
   call-budget rows for each.
4. Writes: solo, rename, duplicate, move, and copy addressed to a chain or
   device past the first window page, guarded by window position.
5. Retire the width caps listed above; bump descriptions; update the ledger
   rows for container reads of overflowing containers.
6. Live check on a scratch track: compose two containers, grow one to 6
   chains with `duplicate_layer_chain`, grow one chain to 5 devices with
   `copy_devices`, read both, write a solo and a rename on the sixth chain,
   move the fifth device out, read back independently, clean up, and
   re-measure the container read cost at 6 chains.

Acceptance: the brain holds no scope or window state; an overflowing
container and a track with more than 16 devices read complete; every chain
and device tool works outside the first window page; the width caps are
gone from schemas, descriptions, and refusals; offline suite, goldens, and
a live E record with cleanup and preserved-state checks.

## Sessions

B17 runs as three sessions. Each one deploys, is checked live, and leaves
the product consistent if work stops after it. At the end of each session,
record in this brief what was proved and any interface decisions the next
session inherits.

1. **Extension-owned scopes (step 0).** This session makes no behavior
   change. It moves the scope logic into async extension operations with a
   write lease, retires `chain.scroll`, and removes the brain's scope state.
   A live check on the E353 shape must show the same results in fewer turns.
   This session decides between the extension route and the brain-side
   alternative, so the later sessions start only after it. It also fixes the
   wire shape for the later sessions: absolute `position`, absolute chain and
   device indices, and a reply that can carry stitched pages. Sessions 2 and
   3 extend that interface; they do not redesign it.
2. **Paged reads (steps 1–3).** The operations page the chain and device
   windows and the 16-wide top-level bank. This session adds fake paging,
   conformance cases for 6 chains, 5 devices, and 17 top-level devices, a
   complete `read_devices` result, and call-budget rows, followed by a
   reads-only live check.
3. **Writes past the first page and cap retirement (steps 4–6).** The writes
   and the cap retirement land together: a cap lifted before writes reach the
   later pages would expose tools that fail. This session also bumps the
   descriptions, updates the ledger rows, and runs the full step 6 live check
   for the E record.

Sessions 2 and 3 share the paging internals and may run as one session if
session 2 finishes early.

## Risks and open questions

- A paged read is two or more inventories per container; a container with
  many chains pays more. The P01 scope policy work bounds the common case;
  this brief accepts the paged cost for the rare one.
- Within one page the order of chains is the bank order; across pages the
  stitch assumes the bank did not change between reads. The existing
  `expectedName` guards and the chain `channelId` witness cover a write; a
  read that changes between pages should be re-read, bounded by attempts.
- `duplicate_layer_chain` always appends after its source (E353), so a copy
  of a chain on page one can land on page two; the create's minted-chain
  diff must run over the stitched reading.
