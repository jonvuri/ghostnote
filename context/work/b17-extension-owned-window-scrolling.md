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

The operator agreed on 2026-10-27 to checkpoint the offline chain-control
work and divide the remainder into **four fresh sessions**. This replaces
the original three-session plan and its requirement to deploy after every
session. Sessions 1 and 2 are verified live; session 3 is an offline
implementation checkpoint, not completed host acceptance. Sessions 4–6 are
separate implementation checkpoints, followed by one coordinated deployment
and live acceptance in session 7.

| Session | Scope | Status |
| --- | --- | --- |
| 1 | Extension-owned scopes; absolute wire positions and indices | Complete, live E354 |
| 2 | Paged top-level and nested reads | Complete, live E356 |
| 3 | Write-window foundation and paged chain controls | Checkpointed; offline checks pass; not deployed |
| [4](#session-4--nested-move-and-copy-paging) | Nested move/copy paging | Next; fresh session |
| [5](#session-5--top-level-mutation-paging) | Top-level mutation paging | Queued; fresh session |
| [6](#session-6--cap-retirement-and-composition) | Cap retirement and composition | Queued; fresh session |
| [7](#session-7--integrated-live-acceptance) | Integrated deployment and live acceptance | Queued; fresh session |

Each fresh session starts with `context/NOW.md`, its section below, and the
relevant implementation/result sections. Record the completed scope, checks,
remaining limitations, and next entry point in this brief and NOW. Stage
only task changes; do not commit. Public width caps stay in place during
sessions 4 and 5. Session 6 changes admission only after the corresponding
write routes are implemented and tested. Keep D44's device-unit budget and
the separate named-slot and parameter limits throughout this work.

### Session 4 — Nested move and copy paging

**Entry:** the [session-3 chain-control checkpoint](#session-3-chain-control-integration),
`ContainerHandlers.chainMove`, `ContainerScopes.aimIndependent`,
`WindowAccess`, and the registered-handler test pattern in
`ChainControlHandlersTest`. The existing `chain.move` handler still uses its
first-window bounds; independent same-container scopes are available but
not yet used by it.

Implement source-device acquisition beyond the four-device window and
source/destination chain acquisition beyond the five-chain window. Use
independent scopes when distant chains in one container cannot share a
window. Hold both endpoint identities through the transfer. Restore device
windows before their enclosing chain windows; retain correct partial
results and latch failed restoration before releasing the lease. Do not
repeat an uncertain move or copy.

Cover chain-to-chain and chain-to-track transfers, top-level-to-chain
transfers within the currently supported top-level reach, same-container
and different-container endpoints, and shifted source indices after moves.
Do not lift top-level or named-slot bounds to make a mixed route pass;
session 5 owns top-level overflow acquisition, and named-slot paging remains
outside B17's proved routes.

**Exit:** registered-handler tests exercise overflow sources and destinations,
simultaneously held endpoints, preservation of unrelated devices, identity
refusals, partial effects, restoration failures, and queued/batch behavior.
Run relevant adapter/encoder and call-budget tests, plus extension checks.
Document the endpoint interface and any mixed-route work left for session 5.
Leave public width caps intact and do not deploy.

### Session 5 — Top-level mutation paging

**Entry:** session 4's endpoint interface and tests; `DeviceHandlers`,
`DeviceWindow`, the complete-chain fingerprints in both adapters, and the
session-2 regression cases for seventeen- and eighteen-device tracks.

Extend insertion, deletion, enabled-state changes, and reordering beyond
sixteen top-level devices. Validate complete paged fingerprints and acquire
the intended handles. Reordering must hold source and anchor when they
cannot fit in one physical window. Resolve the pool-cursor ownership issue
explicitly: the existing container scopes belong to cursor 0. Complete the
top-level overflow endpoints of the mixed move/copy routes from session 4.

**Exit:** handler and adapter tests cover the first and last positions of
seventeen- and eighteen-device tracks, distant reorder endpoints, insertion
across the boundary, mixed transfers, identity/refusal paths, restoration,
and preservation of unrelated state. Keep read completeness separate from
write support while public caps remain. Run relevant shared regressions,
wire goldens, and call-budget tests. Record any remaining admission changes
for session 6; do not deploy.

### Session 6 — Cap retirement and composition

**Entry:** the completed write routes and limitations recorded by sessions
3–5. Audit every width-derived refusal before removing it.

Update shared preflight, live and fake adapters, public schemas and
descriptions, and composition together. Extend composition beyond its
five-entry preset seed; a schema change alone cannot supply that shape.
Retire the 5 × 4 composition limits while preserving D44's device-unit time
budget. Resolve the earlier proposed product bounds explicitly: a physical
window width alone is not a reason to impose a replacement capacity.
Retain named-slot and parameter restrictions where those routes remain
unproved.

**Exit:** live/fake offline conformance covers the newly admitted shapes,
including six chains, five devices in a chain, and more than sixteen
top-level devices. Regress incomplete observations and unsupported routes;
bump `TOOL_DESCRIPTION_VERSION` with the changed description artifact and
update affected help, inventory, and tests. Run extension checks, brain
checks, wire goldens, call budgets, and documentation checks. Prepare the
scratch acceptance driver and an explicit expected profile/build-marker
handoff for session 7. No deployment or live overflow call runs against the
still-installed session-2 build in this session.

### Session 7 — Integrated live acceptance

**Entry:** session 6's checked implementation, descriptions, acceptance
driver, and build expectations. Re-read NOW; earlier project, target,
selection, client, and controller claims have expired across these sessions.

Deploy normal **ghostnote** from `extension/` with `./gradlew copyExtension`.
Controller replacement is operator-only: state which product to load, retain
the actual confirmation, then run `npm run probe:hello` from `brain/`.
Verify the normal profile, expected method count/hash, fresh initialization,
and deliberate markers, including the chain-control marker. Restart the
brain/MCP server as needed so it serves the matching implementation.

Check project, targets, selection, and competing drivers/clients before any
write. Use one foreground driver and one live writer on owned scratch
objects. Run step 6 of [work and acceptance](#work-and-acceptance): compose
two containers, grow one to six chains and one chain to five devices, solo
and rename the sixth chain, and move the fifth device out. Also exercise
same-container distant transfers and top-level insertion, enabled-state
changes, deletion, and reordering beyond sixteen devices. Include a
container beyond the first top-level page.

**Exit:** independently read back each tool's result under D15/D55; inspect
uncertain effects before further work and never automatically repeat the
write. Remove owned scratch objects and verify preserved project/selection
state. Record the acceptance, cleanup, and fixture-specific read/write costs
in a new E record, update its index and the performance ledger, and update
capability summaries, NOW, and backlog status. Keep earlier E/D records
unchanged. B17 is complete only after this live acceptance passes; any
failure leaves an explicit remaining task and an accurate state handoff.

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

## Session 3 start: offline write-window foundation

Started on 2026-10-27. This first implementation pass adds the navigation
primitives; it does **not** expand product write reach or lift any cap yet.
No archive was deployed, no live write ran, and no controller replacement
is pending. The installed session-2 build and its live evidence remain the
current product baseline.

- `WindowAccess.withWindow` acquires an absolute range in one existing
  window, requires repeated position-witnessed snapshots in separate tasks,
  rejects population changes before work, and runs its work callback once.
  It uses the earliest window that holds both endpoints, so a first-page
  target needs no scroll. Distant endpoints require independent handles.
  Nested work keeps the outer view held until the inner view restores zero.
  A failed inner restoration still attempts to restore the outer view.
- The helper permits population changes caused by work and retains the
  work result, `workStarted`, and any error through restoration. It never
  retries work. A restoration failure remains `WindowPager.RestoreFailure`;
  handlers must latch it before releasing their write lease. Restoration
  explicitly requests zero to supersede any pending nonzero request.
  The caller supplies track/target identity checks, owns the lease, and
  maintains the window's identity witnesses across structural edits. These
  are integration obligations, not host behavior proved by this harness.
- `ContainerScopes.aimIndependent` holds one scope per endpoint, including
  two endpoints at the same container position. `Settled.slotAt` resolves
  them by request order; ambiguous `slotOf` use refuses. This supports a
  future move between distant chains in one container without moving the
  source's bank while resolving the destination. Existing `aim` callers
  retain their distinct-position sharing and wire behavior.
- Offline verification: `./gradlew check`, including eleven `WindowAccessTest`
  groups and twelve `ContainerScopesTest` groups. The new coverage includes
  all three window boundaries, target mapping, identical layer names with
  delayed channel-ID witnesses, clamped-scroll repair, bounded refusals,
  population changes, applied/partial results, exactly-once work, nested
  restoration, and queued-write refusal after a restoration failure.
  Profile inventories/hashes, build marker, public descriptions, and current
  runtime costs are unchanged; no new live measurement is claimed.

The remaining work is assigned to [sessions 4–7](#sessions). The next
fresh session is [nested move/copy paging](#session-4--nested-move-and-copy-paging).

## Session 3 chain-control integration

Implemented on 2026-10-27; **verified offline, not yet deployed or checked
in Bitwig**. This completes the chain-control task and is the session-3
checkpoint. The operator agreed to continue the remaining work in fresh
[sessions 4–7](#sessions); this checkpoint does not claim live acceptance.

`ChainControlHandlers` now registers `chain.select`, `chain.duplicate`,
`chain.setName`, `chain.activate`, and `chain.setSolo`. Their absolute
container positions and chain indices can exceed the physical windows.
The existing relocation handler retains its bounds until its two endpoints
can be acquired safely. Public preflight and schema caps remain in place,
so the normal tools do not yet admit overflow writes.

The controls take one scope lease, page chain metadata (IDs, names, and solo
flags), resolve the target, and use `WindowAccess` to acquire its page.
They do not read nested devices or allocate additional host handles. Rename
searches the complete metadata by channel ID; it never substitutes an index.
Activation clears observed sibling solos in groups that fit a window before
enabling the target, including when the target was already soloed. A later
failure reports possible partial effects and retains completed clears.
There is no independent per-stage result readback inside these handlers;
the tool's final independent readback remains required.

Duplication keeps the separate, earlier `chain.select` operation required
by E17ak. Its restoration witness accepts the original ID order while the
duplicate has not arrived, or the E353 projection with one new ID immediately
after the source. It rejects unexpected placement and duplicate identities.
The handler never repeats duplication, including after a no-op, a thrown
partial write, or a failed restoration. The acknowledgement alone does not
claim that a copy was created; the brain still identifies the copy from the
independent reading and renames that ID.

The brain sends its freshly observed `expectedChannelId` for selection,
duplication, activation, and solo, alongside the existing name and track
guards. An older extension that omits source IDs now refuses before
selection/duplication; the selection cleanup runs on that failure. Rename
continues to send its required `channelId`. No extra wire request was added.

Integration also corrected `WindowPager` restoration: it now explicitly
requests zero to supersede pending navigation and restores the outer window
after a nested restoration failure. Restoration errors latch refusal before
lease release; batch continuations can start their next aim only afterward.
`rig.info.layerControlRoute` reports the new deliberate marker
`paged-chain-controls-v1`. The existing read marker remains `paged-windows-v3`;
method profiles/hashes and descriptions v56 are unchanged.

Verification: `./gradlew check`; twelve registered-handler test groups;
`npm run typecheck`; all 2,574 brain tests, including local TCP tests and
the existing tool call budgets; documentation links and diff checks.
The handler model exercises the actual registered handlers at container
position 17 and chains 0, 5, and 10, with delayed position/item observers,
identical names, shifted duplication identities, multi-page activation,
partial effects, navigation refusal, queued-write blocking, and batch
continuation. These are offline results; live costs and host behavior remain
to be established during [session 7](#session-7--integrated-live-acceptance). The
[performance ledger](../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) records
the changed internal traversal without assigning a new latency measurement.

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
