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

## Session 1 result

Complete on 2026-10-26, verified live in
[E354](../evidence/experiments/e354-extension-owned-container-scopes-live.md).
The extension route was taken; the brain-side alternative above is not
needed and is kept only as the record of the choice.

- Extension: `ContainerScopes` (`extension-owned-scopes-v1`) owns the three
  B08 scope banks. An aim settles one scope per distinct absolute position:
  it polls every 5 ms with `host.scheduleTask` until cursor track 0 reports
  the expected track and `Rig.scopeSettled` holds, re-issues an unsettled
  scroll every 10 polls (E353), and refuses after 400 polls with
  `track-not-confirmed`, `scope-not-settled`, or `scopes-unavailable`. Scope
  choice: settled at the position; else asked for it; else the resting scope
  for a position inside the scope count; else a displaced scope, highest
  slot first; else the highest free slot; a slot chosen for one position of
  the aim is excluded for the others. The aim holds a new
  `WriteGate.writeLease()` (writes and clip reads wait, plain reads run) and
  runs in the request's own task when everything is already settled.
  `chain.observe {position, expectedTrackChannelId}` replies with the settled
  scope in the `chain.inventory` scope shape, the reference `deviceCount`,
  `cursorScope`, and the `aim` report. `chain.scroll` is retired; the chain
  writes are `onAsync` and take `position` plus absolute `chainIndex`
  (`chain.move`: `srcPosition`/`srcChain`, `dstPosition`/`dstChain`; a
  named-slot endpoint names its container position). `batch.run` is
  `onAsync` too: it runs ops in order and continues from a deferred op's
  reply (`HandlerRegistry.invokeAsync`), refusing the clip-read class inside
  a batch (review fix). Normal profile 93 methods, hash
  `d6decf985f6b1f36`; `rig.info` carries `containerScopeRoute` and
  `containerScopeStatus`. `ContainerScopesTest` covers the policy and the
  lease offline against an in-memory scope model.
- Brain: `LiveAdapter.containerScope` points cursor 0 when it is not held,
  sends one `chain.observe`, re-points once on `track-not-confirmed`, and
  maps a refusal to `unsupported`; the named-slot descent keeps the cursor
  route (`devcursor.selectAt`, `devcursor.selectFirstInSlot`,
  `chain.inventory` for `cursorScope`, re-selecting the parent on every
  pass because each `selectFirstInSlot` appends a route step; review fix).
  `scopeSlots`, `scopeSlotOf`,
  `chooseScope`, the encoder's `scopeSlot`, and the `hold` argument are gone.
  `chain.inventory` stays on the wire as the raw multi-scope read for the
  descent and for independent readback. Offline: the B08 scroll tests became
  B17 observe tests; the stubs answer `chain.observe`.
- Cost: an isolated far container read is 6 turns and about 140 ms (was 11
  turns, 305 ms); a resting read 6 turns and about 120 ms (was 8, 190 ms);
  every chain write found its scope already settled (1 poll, 0 scrolls).
- Interface decisions for sessions 2 and 3: positions and chain and device
  indices on the wire are absolute; `scope.chains[].index` and
  `devices[].index` stay absolute when the windows page; a paged reply
  extends `scope.chains` and each chain's `devices` and keeps
  `chainCount`/`deviceCount` as the totals, so `chainsComplete` and
  `devicesComplete` describe the stitched container; `requireChainIndex`
  and the `srcDevice` bound in `ContainerHandlers` are the only places that
  still refuse an index past the first window page; session 2 retains
  these write limits, and session 3 lifts them with write paging. A deferred op inside `batch.run` must release its
  lease before it replies. The resting-scope preference for positions 0 to
  2 keeps scope 2 shuttling on a structure read; that policy now lives in
  `ContainerScopes.choose` for P01.

## Session 2 implementation and live handoff

Implemented on 2026-10-26 and **verified live on 2026-10-27** in
[E356](../evidence/experiments/e356-paged-device-and-layer-reads-live.md).
The earlier host-state corrections are retained in
[E355](../evidence/experiments/e355-paged-read-host-state-corrections.md).
Current normal archive SHA-256:
`081cdbb46b410bb651f3f01cb3af436b32fb75d1285c3fcff5f03db0624813f7`.
The v3 replacement, overflow acceptance, and scratch cleanup are complete.

- `WindowPager` pages existing handles, using the reported scroll position,
  absolute device positions and layer channel-ID witnesses, population count, and a repeated page in
  the next scheduled task. Final pages overlap because the host clamps to
  `count - width`; the stitch includes each absolute index once. Polls are
  5 ms, unsettled scrolls reissue every 10 polls, and each page refuses after
  400 polls. A population change after the first accepted page refuses.
- `device.list` is now asynchronous and takes a write lease. `chain.observe`
  pages the five-chain window and each four-device window under its existing
  lease. Each moved window returns to zero before the reply, so existing
  fixed-index writes retain their meaning. A window that never moved needs
  no restoration pass. Restoration failure latches an explicit write refusal
  until controller initialization; queued requests and batch continuations
  honor it, diagnostic reads remain available, and leases are released.
- The wire retains absolute indices and adds `paged`, page counts, and raw
  window positions. `device.list` carries all top-level devices;
  `chain.observe` carries the stitched container at any absolute position.
  Beyond the reference bank, scope settlement uses the confirmed track,
  total count, and the scope device's absolute position. Where the reference
  bank covers the position, name/existence agreement remains required.
  The farther scope guard is proved at position 17 in E356. Layer channel indices
  are diagnostic only: `LayerPageWitness` uses within-session channel IDs
  to reject old pages under newly reported positions, conflicting overlap,
  duplicate IDs, and incorrect restoration. It does not assume that
  `DeviceLayer.channelIndex()` is an index inside the layer bank.
- No new host banks or device handles are allocated. New subscriptions are
  top-level bank scroll positions and device positions; layer-bank scroll
  positions and channel indices; nested bank scroll positions and device
  positions. `rig.stats.resources.pagingMarkedValues` counts them (229 with
  the default eight cursors). Profile counts/hashes and wire goldens are
  unchanged: normal 93 methods, `d6decf985f6b1f36`. The deliberate build marker
  is `paged-windows-v3`; `windowWriteBlock` reports a restoration failure.
- Fake and live adapters accept complete paged readings while retaining
  incomplete treatment for legacy replies. `read_devices` visits every
  top-level position, reports page counts and window widths, and can list
  six chains, five devices per chain, and seventeen top-level devices.
  Width-derived write limits remain: the product and shared preflight
  refuse chain writes outside their first window. Named-slot and parameter
  cursor paging are outside this session. Descriptions are **v56**; writes
  and broader cap retirement remain session 3.
- Verification: `npm run typecheck`; all 2,552 brain tests (2,547 passed in
  the sandbox; five TCP client tests passed when rerun with local-network
  access); `./gradlew check`; 87 focused surface tests after adding public
  page counts. The pager harness covers boundary counts, overlapping final
  pages, delayed witnesses, clamped-scroll repair, timeouts, restoration,
  nested leases, and refusal of queued/batch writes after restoration failure.
  Live/fake conformance covers all three required overflow shapes; their
  public read call budget stays one `devices` and one `read` adapter call.

After any new deployment, wait for operator replacement with normal
**ghostnote**, then run `npm run probe:hello` from `brain/`, checking
fresh initialization and `paged-windows-v3`. Re-read project, targets,
selection, and competing clients. The read-only driver is
`brain/src/probes/b17-paged-reads-live.ts`:

```sh
node --import tsx src/probes/b17-paged-reads-live.ts --out NEW_DIRECTORY
```

It expects a `gn-b17r` scratch track in `gn-scale-test`: at least
17 top-level devices, with a six-chain layer container last and five devices
in at least one chain. `--devices` declares the exact count (default 17; E356
used `--devices 18`). It records public and raw reads, page
counts, isolated observe cost, restored window positions, repeated content,
track list, and selection preservation. Fixture preparation and cleanup are separate from this read-only driver.
Use current product tools within their caps, then ordinary Bitwig edits for
the overflow boundaries. Create fourteen top-level Tools before composing the
container at position 14; composition needs one extra scratch slot. Append
one Tool, then move it before the container to reach position 15. Copy from
a different chain when growing chain A. Product writes cannot yet exceed
the widths; do not lift their guards for fixture setup. Inspect existing
fixtures first to avoid redundant setup. E356 records the passing reads and live costs; the ledger now includes them.

### First live attempt and corrections

The operator replied **“Controller replaced”**. `npm run probe:hello`
passed on the first session-2 archive (`14f9de17…7f437`), marker
`paged-windows-v1`, initialized `2026-10-27T04:18:09.455Z`. The process check
found no foreground probe. One old Ghostnote MCP server, PID 46491, was
connected and left alone. Artifacts are retained under
[attempt-1](../evidence/data/b17-paged-reads/attempt-1/hello.log).

1. The first inventory reached `gn-sel` while cursor 0's track identity was
   still arriving. `device.list` refused with “track changed during paging.”
   The brain previously propagated this read-only transient. It now waits
   the existing cursor-settle interval and retries that specific read once;
   the reply must still pass track identity/count checks. Other failures,
   including restoration refusal, are never retried by this path. The
   [captured exchange](../evidence/data/b17-paged-reads/attempt-1/track-arrival-refusal.json)
   retains the mixed-track refusal. The next inventory read all eleven
   tracks successfully; none had seventeen devices (maximum eight).
2. The `gn-lay4` layer read then refused and latched the write block. The
   [exchange](../evidence/data/b17-paged-reads/attempt-1/layer-read-refusal.json)
   and [diagnostics](../evidence/data/b17-paged-reads/attempt-1/refusal-diagnostics.json)
   show the original four chains, all windows at zero, zero leases/waiters,
   unchanged track list, and unchanged selection. The build required
   `layer.channelIndex() == bank position + slot`; that interpretation was
   unproved. The first archive did not report the observed channelIndex,
   so its exact values and the predicate responsible for the refusal are
   not claimed established. The corrected build uses channel-ID page
   witnesses and reports raw channel indices and window diagnostics for
   the next live check.
3. Repeated scroll-to-zero attempts had incorrectly made an unreadable
   resting window take a restoration pass and then latch its failure. The
   pager now tracks whether it ever requested or observed a nonzero window.
   A failed read that stayed at zero returns its read refusal without
   claiming restoration failed. A window that may have moved still must
   restore, and a failed restoration still latches refusal.

The corrections pass `npm run typecheck`, 197 live-adapter/call-budget tests,
and `./gradlew check`. New harness cases reject stale layer IDs after a
scroll with identical names and arbitrary channelIndex values, verify
nonoverlapping and overlapping pages and restoration, and distinguish an
unreadable resting window from failed restoration. The new brain regression
covers one successful track-arrival retry, bounded repeated refusal, and
no retry on restoration failure.

### Second live attempt and current handoff

The second actual operator reply was **“Controller replaced”**. The fresh
v2 handshake, nonlocal layer indices, successful baseline, stale non-layer
count, fixture writes, and cleanup are recorded once in
[E355](../evidence/experiments/e355-paged-read-host-state-corrections.md).
The v3 correction completes a non-layer scope without traversing its stale
layer bank. It leaves real layer containers and unknown capabilities on the
guarded path and preserves named-slot completeness. `ContainerPagingTest`
regresses the captured Tool/five-chain-count shape. `./gradlew check` and
brain typecheck pass after this correction.

The v3 replacement and live acceptance subsequently passed in E356.

## Session 2 result and session 3 handoff

Complete on 2026-10-27, with the read-only acceptance and cleanup recorded in
[E356](../evidence/experiments/e356-paged-device-and-layer-reads-live.md).
The fixture had eighteen top-level devices, a six-chain FX Layer at position
17, and five Tools in chain A. This proves all three overflow routes; the
exact seventeen-device boundary remains covered offline. `read_devices`
reported complete data twice, with two top-level pages, two chain pages, and
two device pages for A. The extension restored the raw nested windows and
released its lease without a refusal latch. Original tracks, `gn-lay4`, and
selected targets were verified after removing the scratch track.

The inherited interface is unchanged: absolute positions and indices, one
extension reply carrying the stitched result, and no brain window state.
The measured overflow adapter read is six turns / median 505 ms; top-level
`device.list` is one turn / median 144 ms; full fixture `read_devices` is
65 turns / about 2.6 s. These fixture-specific values are in the ledger.

Session 3 can now add guarded write paging and retire the width-derived caps
together. Preserve population/identity checks, restored windows, write leases,
and the refusal latch. Keep D44's time budget until P01 re-derives it. Writes
still use the first windows; named-slot and parameter paging are outside the
proved session-2 routes. The v3 normal build is running and no replacement
or scratch cleanup is pending. Revalidate live context before new work.

The session-2 review caught a write-parity regression: complete paged reads
allowed the fake to enable or delete devices on tracks wider than sixteen,
while the extension rejected their full-chain fingerprints. Both adapters now
check the physical write width separately from read completeness at the
device-mutation boundary, using the existing observation. This adds no wire
calls. Regression tests cover both tools at the first and last positions of
seventeen- and eighteen-device tracks, refuse before a live mutation frame,
preserve complete reads and fake state, and retain successful writes on a
sixteen-device track. These cases reproduced the mismatch before the fix.

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
