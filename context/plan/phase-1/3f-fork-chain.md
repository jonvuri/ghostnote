---
title: Phase 1, 3f epic — track-copy CRUD and the layer-chain lifecycle
kind: plan
state: complete
status: SESSION 3f-i COMPLETE 2026-08-15, VERIFIED LIVE. The complete
        device-alternate lifecycle, exact add_track naming and the stable 3g
        mechanics handoff are green. Next is session 3g.
updated: 2026-08-15
parent: README.md
prev: 3e-clip-block.md
next: 3g-a-observation-contract.md
scope: revised D18
evidence: E16 duplicate/readback rows; E17; E18a/c/e/g/h; E22; D13, D18–D20
---

# Phase 1, 3f epic — track-copy CRUD and the layer-chain lifecycle

> **Purpose.** Land an ordinary typed track-copy operation, then complete the
> autonomous device-take representation. Do not restore grouped track forks or
> begin the session-3g observation record here.

## Boundary inherited from this session

E22 is closed and committed. `Group` follows Bitwig's unobservable primary focus;
with device focus it created an Instrument Layer while every track identity and
selection guard passed. A runtime operator prime is therefore not an acceptable
precondition.

The product path has been trimmed accordingly:

- no `track.group` contract operation;
- no `make_track_copy`/grouped-fork surface;
- no group topology or reversal semantics in the fake or engine;
- no production mapping to `branch.groupTrack`;
- the E22 extension hook and mixer observer remain registered only to keep the
  committed regression probe reproducible, and `branch.groupTrack` is explicitly
  product-banned.

The worktree deliberately preserves reusable track-copy groundwork: the typed
`track.duplicate` op, fake cloning, live encoding to the measured
`branch.duplicateTrack` route, expected-channel-id guard, one-row bank precondition,
bounded fresh-ID polling, and ordinary change/reversal reporting.

## Step 5 — complete: `copy_track`

Expose track duplication as direct CRUD, not as a take verb.

Acceptance:

1. `copy_track` takes one durable track address and an explicit copy name.
2. It refuses before writing if the observable track bank has no row available.
3. The extension verifies `expectedChannelId` immediately before calling the
   measured typed duplication route.
4. Structural readback polls within a bound and returns the fresh durable track
   identity; no successful receipt is inferred from acknowledgement alone.
5. The copy carries the source's ordinary track contents supported by Bitwig and
   is renamed through the typed surface.
6. It is recorded in the ordinary session change report. Automatic reversal says
   the copied track remains; directed `delete_track` is the separate cleanup.
7. It creates no take/branch record, grouping, lineage link, A/B semantics, or
   implicit cleanup promise.
8. Tool naming and description are versionable and factual. Observation can later
   detect when agents choose this coarse operation instead of scoped layer/clip
   operations.
9. ⚠ The description states the mechanical costs plainly (revised D18c): the copy
   is **immediately audible** if the source was, instantiating its device chain
   **can glitch the audio and adds engine load** (E16 row C5: 5/5 real vs 0/3
   placebo), it **consumes one bank row**, it **receives a fresh durable id**, and
   **automatic reversal will not remove it**.
10. ⚠ **Supported track types are only the ones measured.** Anything else refuses
    rather than assuming `Channel.duplicate()` behaves identically on every
    channel kind; widening the set is a measurement, not a default.
11. ⚠ The word `duplicate` was banned on the surface (`naming.ts`) and required
    an explicit review for this tool: either write the description in the
    surface's own vocabulary, or reopen that one entry deliberately with its
    reason rewritten. Do not delete the entry silently.
12. Offline checks, extension tests, and a clean live smoke pass before its commit.

Completion record, 2026-08-15:

- the public tool accepts one durable instrument-track id and one non-empty copy
  name;
- the structural copy and its typed rename are two ordinary recorded changes,
  because the rename address does not exist until bounded readback returns it;
- a missing fresh id is reported as unconfirmed rather than promoted from the
  acknowledgement;
- unsupported track kinds and a full observable bank refuse before the first
  write;
- the description carries the audibility, glitch/load, bank-row, fresh-id and
  directed-cleanup facts in COPY vocabulary; the `duplicate` ban was reviewed and
  deliberately kept;
- brain checks passed 357/357, the extension build passed, production MCP smoke
  passed 6/6 with cleanup, and live conformance passed 46/0/6. Both the new
  `C-track-copy` row and the formerly load-dependent `C-minted` row passed live.

## Step 6 — continue the layer-chain lifecycle

The centre of gravity is the address grammar. Today's `DeviceAddress` is flat;
a device inside a layer chain is not expressible. Extend it without breaking
canonical `addressKey`, slice prefixes, stash keys, or existing top-level device
addresses.

Build toward these autonomous operations:

1. Address a layer container, a named/indexed chain within it, and a device within
   that chain through stable observable structure.
2. Bootstrap both supported container cases autonomously. A fresh FX Layer's
   shipped chain is sufficient for FX/Master; the zero-chain Instrument Layer
   case uses a bundled/provisioned seed asset. Runtime operator-authored presets
   are forbidden as a functionality dependency.
3. Fill a chain by moving/copying/inserting devices and verify placement through a
   handle other than the writer.
4. Switch alternates with `DeviceLayer.solo()`, retaining E17's container-local
   exclusivity and proving unrelated tracks do not flip.
5. Support directed reduction autonomously. The common winner-only collapse moves
   the winner's devices out and deletes the layer container. Selective removal
   while several alternates survive is also a **Phase 1 requirement** and uses
   the measured rebuild route unless implementation evidence forces a recorded
   correction.

Correctness gates for collapse/rebuild:

- preserve the order of multiple devices;
- restore the intended signal-chain position, not merely `chainEnd`;
- report or restore chain-level state that does not move with devices;
- measure the audible effect on the real track;
- keep cross-device modulation outside the claim until the indexed path is tested.

The seed asset is a build-time dependency and may require its own small asset task,
but it must ship as part of the feature rather than as operator setup.

### Remaining execution slices

Session 3f is now an epic of verified vertical slices. The lettering is the
execution order and the boundary between commits; no slice weakens Step 6's
acceptance.

| Slice | Scope | Exit boundary |
|---|---|---|
| **3f-c — live closure** | Re-run the post-`chain.create` review fixes against Bitwig before adding capability. | Full live conformance is green; paired-name and projected bank-capacity batches refuse before a copy and leave a disposable container unchanged. The refused-rename path remains an explicit offline boundary unless it can be constructed safely without a production fault hook. |
| **3f-d — relocation** | Add one typed, slot-scoped fill/extract primitive covering the required top→chain, chain→top and chain→chain directions. Promote `chain.move` only through the verb that owns it. | Source and destination are both proved through structural readback independent of the writer; move conserves population, copy adds exactly one, multiple devices preserve order, and a chain holding a device joins conformance live. No switching or destruction. |
| **3f-e — switching** | Observe and set container-local exclusive solo through a stable `ChainAddress`, and expose the corresponding production operation. | The addressed alternate becomes active, siblings in its container become inactive as measured, unrelated tracks do not flip, and both fake and live adapters agree. No creation or reduction work is mixed in. |
| **3f-f — bootstrap and creation surface** | Bundle/provision the Instrument Layer seed, prove its first addressable chain, and expose production inspection/creation/fill tools for both container cases. | FX/Master and Instrument paths are autonomous, require no operator-authored preset, return only independently resolved structure, state their object scope honestly, and pass production MCP smoke. This slice makes only the minimum deliberate `naming.ts` changes its tools require. |
| **3f-g — winner collapse** | Implement the common directed destructive lifecycle: extract the named winner, restore its intended top-level signal position, then delete the container. | Multi-device order and state survive, the survivor is named rather than counted, deletion occurs only after preflight/readback, the destructive tool seam is separate, and the audible effect is measured on the rebuilt track itself. |
| **3f-h — selective reduction** | Rebuild a container while removing one alternate and preserving several survivors. This is required for Phase 1. | Surviving names and device order are proved; name/mute/solo/volume/pan/colour are restored or explicitly reported; partial failure never masquerades as completion; cross-device modulation remains outside the claim until its indexed path is measured. |
| **3f-i — lifecycle closeout** | Exercise the complete production lifecycle and prepare the observation handoff. | Creation, fill, switch, collapse and selective reduction pass offline, live conformance and production MCP smoke with no residue; descriptions are mechanically accurate; 3g receives stable event identities and owns the cohort-wide wording review/version freeze. |

Dependencies are intentionally narrow: 3f-d and 3f-e share only the completed
address/observation layer; 3f-f consumes relocation; both destructive slices
consume relocation and switching but remain separately permissioned and tested.
The asset task is contained in 3f-f rather than hidden inside either destructive
workflow.

⚠ **The device-alternate tools cannot be described under the current ban list.**
`layer` and `chain` are both banned words on the surface, marked relaxation
candidates in `naming.ts`. `chain` additionally carries two meanings — the
mechanism and an ordinary device chain — so relaxing it needs a disambiguation
rather than just a decision. Settle that when the tools are written, entry by
entry, and record the reasoning where the entries live. ⚠ Note what these tools
will have to say: a device alternate carries devices and device state and **no
clips, no sends and no track-mixer state** (revised D18b).

### Step 6a — complete 2026-08-15: the address grammar and its refusal seam

Acceptance item 1's naming half is landed; its observation half is not, and the
gap between them is a refusal rather than a hazard.

What exists now:

- `ChainAddress` addresses a chain by CONTAINER POSITION plus NAME, because a
  chain's `channelId` is minted afresh by every project load while its name
  survives (E17ad, E18b). The declaration carries that reasoning and the two
  obligations it imposes on a resolver: name our own chains explicitly, and refuse
  an ambiguous name rather than resolve it to the first hit.
- `DeviceAddress.chain?` makes a device at any depth expressible; the track stays
  on the address at every level, so the durable anchor costs one lookup.
- `addressKey` composes nested steps with `/` and escapes chain names, so **every
  pre-nesting key is byte-identical** and no nested key can collide with or forge
  another. Asserted against written-out golden strings, plus a real collision pair
  that only escaping separates.
- `ADDRESS_IDENTITY.chain` is `positional` — the durable name does not rescue an
  address hanging off a container index that a chain edit re-indexes (E3).
- ⚠ `assertDevicesRoutable` REFUSES any op naming a device inside a chain, in the
  contract, called by the executor and by both adapters. Every measured device
  route sends `chainIndex` against the track's top-level chain, so an unguarded
  nested address would delete or retune a real device nobody addressed. The fake's
  device model is flat too, so it refuses for the same reason rather than
  certifying a capability neither adapter has.
- Neither adapter claims a chain, nested device or nested param RESOLVED merely
  because its durable track anchor exists, or answers its READ with top-level
  state; `C-nested-device` asserts the unsupported resolution, write refusals and
  read non-answers on both.

Verification, 2026-08-15: brain typecheck plus 369/369 offline tests (11 new
`A-*` address cases, 1 new conformance row), extension Gradle build green,
`git diff --check` green. No wire method was added, so the golden hash is
unchanged and no live run is owed by this slice.

Deliberately NOT claimed: nothing resolves, observes, creates, fills, switches or
reduces a chain yet. The grammar is the vocabulary those verbs will be written in.

### Step 6b-1 — observation: complete 2026-08-15, verified live

Observable resolution landed. `resolve` and `read` walk a `ChainAddress` and a
nested `DeviceAddress` against real structure through `chain.inventory`, the only
method promoted; four answers are kept apart (`found`, `ambiguous`,
`outside-bank-window`, `absent`); depth beyond one level and a nested
`ParamAddress` stay `unsupported`; and a CONTAINER device's read carries its
chains, which is the bootstrap — a chain is addressed by name, so something has
to be able to say what the names are, and a chain has no address of its own to be
enumerated by. Its container has one, so no ninth adapter method was needed.

⚠ Three assumptions in this brief were wrong and are corrected in NOW.md's
step 6b-1 record: `layer.list` was never banned (and is the worse route —
`chain.inventory` names its container by parameter and needs no device cursor);
zero name matches is `absent` only when the bank sizes prove the view complete;
and no golden regen was owed, because promoting an already-registered method
moves no hash. The extension gained reply FIELDS, which the hash cannot see, so
the jar was redeployed and Bitwig restarted before the live run.

⚠ Writes were not touched. `assertDevicesRoutable` refuses every nested route
exactly as before, and `chain.move` stays probe surface.

### Step 6b-2 — complete 2026-08-15, verified live

The first typed verb landed: `chain.create` copies a named chain in a container
and names the copy, and it is the first write in this system that reaches inside
one. `assertDevicesRoutable` still refuses every other nested route.

What the verb is, and why it has that shape:

- **It copies, because there is no create-from-nothing.** `e17ak` measured the
  whole space and exactly one typed route works: select the chain, then
  `Channel.duplicate()`. The op therefore takes a SOURCE `ChainAddress` and
  refuses a container with nothing to copy, instead of pretending placement is a
  choice.
- ⚠⚠ **Naming is part of the verb, not a second op.** A duplicate arrives
  carrying its source's name, so between the copy and the rename the container
  holds two chains `lookupChain` correctly refuses as `ambiguous` — a state in
  which the new chain has no address at all. A separate rename would have to be
  addressed with exactly the address that does not yet exist.
- ⚠⚠ **The copy is identified by IDENTITY, never position.** `mintedChain` (in
  the contract, shared by both adapters) diffs the container's per-chain
  `channelId`s across the write. That id is worthless as an ADDRESS — the loader
  mints it on every project load (E17ad, E18b), which is why `ChainAddress` uses
  the name — and it is exactly right as a within-turn witness. Getting this wrong
  renames the SOURCE and leaves the copy impersonating it.
- **Success is independent resolution**, per the acceptance bar: the receipt
  mints only after the new name resolves, uniquely, to the chain whose id the
  diff returned. Acknowledgement is not consulted, and neither is the writer's
  selected handle.
- ⚠ **A failure is reported, because nothing can roll it back.** If the copy
  cannot be identified or named, a real chain is left wearing the source's name;
  the op is marked failed in the receipt with that sentence, since there is no
  typed delete to clean up with.
- ⚠ **Preconditions refuse before the first frame** (`assertChainCreatable`,
  contract-side rule + adapter-side observation, exactly like `assertSlotsFree`):
  the container must be observable, the source must name exactly one chain, the
  new name must be provably free, and the chain bank must have room — standing
  rule 5 one population down, because a chain created past a four-wide bank could
  be resolved by nothing and removed by nothing.
- ⚠⚠ **Those preconditions are PROJECTED across the batch**, not checked
  independently. Nothing is applied when they run, so every create in a batch
  sees the same reading — the mistake `assertSceneRoom`'s header already names
  one population up. Measured before the fix: two creates against a 3-of-4
  container produced FIVE chains, stranding one past the bank, and two creates
  named `dup` produced two chains called `dup` — both with every stage receipt
  reporting `ok`. Each create is now checked against the container as the creates
  before it leave it, which also means a chain an earlier create made is a usable
  source. Counting needs the bank SIZE, so `ObservedContainer` carries one; a
  reading without it is refused rather than treated as room.
- ⚠ **A create that copies but cannot be named is reported on BOTH adapters, and
  never thrown.** The extension deliberately refuses a rename whose id no chain
  carries, but by then the copy exists — so an exception escaping `apply` would
  leave the caller no receipt at all for a container that now holds an
  unaddressable chain. Everything after the copy is caught and converted into a
  failed op carrying the extension's own words. The fake throws the same sentence
  (shared from the contract) rather than returning quietly, which it used to do.

⚠⚠ **Three new wire methods, and they are NOT the `layer.*` ones `e17ak` used.**
`chain.select`, `chain.duplicate` and `chain.setName` read through
`Rig.slotLayerBanks` — the same banks `chain.inventory` enumerates — where
`layer.select`/`layer.duplicateChannel`/`layer.setName` follow `cursorDevice0`.
That difference is disqualifying three times over: the container would become a
hidden argument (the e16o trap), reader and writer would address containers
through different handles, and moving `cursorDevice0` would silently re-aim every
`param.set` near it. The `layer.*` originals stay probe surface, asserted.

⚠⚠ **The deviation was a measurement, not a deduction — and it is now MEASURED.**
`e17ak` established `selectInEditor()` + `duplicate()` on a `DeviceLayer` from
`layerBank0`; this route makes the same two calls on a `DeviceLayer` from
`slotLayerBanks`, and this project's most repeated lesson is that sibling verbs
and handles disagree. `C-chain-create` passed live on 2026-08-15, so they do not
disagree here: **the product's chain reads and its chain writes now address
containers through the same cursor-free slot scopes, and neither needs the
device-cursor apparatus.**

⚠ `chain.select` is its own wire call rather than a line inside the duplicate:
E2 says a write is not visible to a read in the same request, and `e17ak` fired
the select a turn earlier. The extension re-selects inside the duplicate as belt
and braces. The settle between them is `trackStruct` (144ms) — **borrowed, not
measured**; no chain-selection settle has ever been measured, and the two
neighbouring measured budgets are 25ms (cursor point, E1) and ~144ms (structural,
E1/E3). ⚠ The live pass says 144ms is ENOUGH; it does not say where the floor is.
A future silent ○ on this row should suspect that number first.

Two acceptance items resolved differently than this brief expected:

1. ⚠ **Neither of item 2's assertions became constructible, and that is a
   finding rather than an omission.** An AMBIGUOUS name cannot be produced
   through the typed surface at all now, because the create refuses a colliding
   target name — refusing it is what stops the verb manufacturing the exact state
   the resolver exists to reject, so conformance asserts the REFUSAL on both
   adapters instead. `T-ambig` stays fake-only. A chain HOLDING A DEVICE is still
   unreachable too: the FX Layer's shipped chain is empty, a copy of an empty
   chain is empty, and no fill route is promoted. Both move when the fill verb
   does.
2. ⚠ **The seed asset is not needed for this step and is deferred, not
   cancelled.** A fresh FX Layer ships with one chain, so the FX/Master path is
   fully typed end to end from a `device.insert` — measured `e17ai`, and now
   exercised by `C-chain-create`. A fresh Instrument Layer ships with ZERO and
   still has no typed route to a first chain, so the bundled seed remains
   load-bearing for the instrument-track case only. Scope it when that case is
   built, against a measurement rather than against one asset for both.

Reduction is unchanged and still not built: every typed chain DELETE refuses
(`e17al`, `e17am` — a `DeviceLayer` honours only the verbs `Channel` declares
itself), so collapse is *move the devices out, then delete the CONTAINER*
(`Device.deleteObject()` ●), the shape acceptance item 5 names.

⚠ **The surface ban list was NOT reopened.** This step shipped a typed verb and
no tool that has to say `layer` or `chain` out loud, so both entries in
`naming.ts` stand as written. `report.ts` gained one sentence for an
unreverted chain, written in the surface's own vocabulary under the ban.

Verification, 2026-08-15: brain typecheck plus 419/419 offline tests (8 `N-mint`,
6 `T-create`, 6 `L-chain-create` driven against a stub that models `e17ak` arm A,
2 `E-chain`, and the new `C-chain-create` row), extension Gradle build green,
`git diff --check` green. The golden moved to 146 methods / `c1120b1c567369d3`,
the jar was redeployed and Bitwig restarted, and **live conformance passed 49,
failed 0, skipped 6** — `C-chain-create` green in 3.9s, `C-chain-observe` and
`C-nested-device` unchanged, and the 6 skips the standing bank/scene-overflow
ones no live harness can construct.

⚠ **Review pass, same day: three defects found and fixed, all in the batch and
failure paths the live row does not exercise** (it runs one create at a time
against a cooperative extension). Two were reproduced against the fake before
being fixed — five chains in a four-wide bank, and two chains under one name,
both with `ok: true` receipts — and the third against a stub that refuses the
rename, where `apply` threw and left the container ambiguous with no receipt.
Offline is now 423/423 with a regression case for each: `T-create` for the summed
bank and the paired name (plus the positive case, a create sourced from a chain
an earlier create in the same batch made), `L-chain-create` for the refused
rename, and `C-chain-create` gained the paired-name refusal so it is asserted on
both adapters. ⚠ **At that review boundary no live re-run had been made.** The
fixes were refusals and reports on paths the earlier passing live row never
entered, so the batch paths still had not met a real DAW; session 3f-c below
closes that gap.

### Session 3f-c — complete 2026-08-15, verified live

`C-chain-create` now also submits three distinct names after the disposable
container has two chains, projecting five chains into the fixed four-wide bank.
The real adapter refused the whole batch before its first copy and independent
container readback proved both population and names unchanged. The existing
paired-name batch refusal passed in the same row, and the row deleted the entire
FX Layer in `finally`, taking its successful test chain with it.

The rebuilt jar was atomically deployed, Bitwig was fully restarted, and
`hello()` proved the running extension fresh at 146 methods /
`c1120b1c567369d3`. Full live conformance passed **49, failed 0, skipped 6**;
`C-chain-create` was green in 4.18s and the six skips remain the standing
unconstructible bank/scene-overflow cases.

⚠ The refused-rename receipt remains an offline `L-chain-create` live-adapter
test boundary. A cooperative real extension necessarily accepts the valid
within-turn chain identity it just reported; safely constructing the rejection
would require a product fault hook, and 3f-c deliberately added none.

Closing checks: brain typecheck plus 423/423 offline tests, extension Gradle
build, context check and `git diff --check` all green. Session 3f-d may now begin
the relocation primitive; 3f-c added no capability.

### Session 3f-d — complete 2026-08-15, verified live

One contract verb, `chain.relocate`, now owns top→chain, chain→top and
chain→chain device transfer. It takes a source `DeviceAddress`, a destination
`ChainAddress` or `TrackAddress`, and `move` or `copy`; it is same-track,
one-level deep, refuses a same-chain no-op and refuses moving a container into
one of its own chains. No switching, tool surface or destructive lifecycle work
was added.

The evidence boundary is shared by both adapters. `verifyDeviceRelocation`
compares complete source and destination device sequences before and after the
write: move removes exactly the addressed source, copy retains it, the device is
appended at the destination, total population changes by zero or one as
appropriate, and all other ordering is byte-for-byte the same. The live adapter
takes fresh structural readings around each settling stage and polls within a
bounded window; a wire `ok` is overwritten with a failed receipt when the
structural proof does not arrive.

`chain.move`, already registered from measurement, was widened to accept top or
chain sources and is promoted only by this verb. The extension checks durable
track identity, source-device name, source/destination chain names, scope and
bank positions immediately before `moveDevices`/`copyDevices`. `rig.info` now
reports the top-level device-bank width and `chain.inventory` reports nested
device population, allowing full-bank views to be distinguished from blind
ones. `assertDevicesRoutable` exempts only `chain.relocate`; nested
`device.delete`, `param.set` and every unrelated verb still refuse.

⚠ Live proof corrected one address assumption: an untouched shipped FX Layer
chain auto-renamed itself to `Polysynth` when first filled. A pre-fill default
name is therefore not durable enough for lifecycle work. The passing row creates
and explicitly names its two working chains before moving devices; production
work must do the same. The adapter's failure now reports all observed sibling
names when a requested chain name disappears.

`C-chain-relocate` fills one explicitly named chain with Polysynth then Organ,
proves their order, copies the first device chain→chain, moves the second
chain→chain, extracts the first chain→top, and reasserts the general nested-write
refusal. Its disposable container is removed in `finally`; the final conformance
cleanup removes the reusable fixture tracks. The fake runs the same row and
deep-clones copied devices.

Verification, 2026-08-15: brain typecheck plus **426/426** offline tests,
extension Gradle build green, rebuilt jar deployed and proved fresh after a full
Bitwig restart, and live conformance passed **50, failed 0, skipped 6**. The wire
golden remains 146 methods / `c1120b1c567369d3` because no method was added.
Context check and `git diff --check` are the closing checks. Session 3f-e may now
begin container-local exclusive switching.

### Session 3f-e — complete 2026-08-15, verified live

Exact container-local solo state is now part of `ObservedChain`. Absence means
unknown, never false. The shared precondition refuses a partial sibling bank,
an absent or ambiguous name, or any sibling whose flag was not observed. Both
adapters run that same check before writing.

One typed verb, `chain.activate`, makes the named `ChainAddress` the sole soloed
sibling. The extension resolves it through the same cursor-free slot scope used
by inventory, checks the durable track id and expected name immediately before
the write, clears any other soloed sibling, and invokes the measured exclusive
toggle only when the target is not already active. The live adapter then polls a
fresh container inventory; wire acknowledgement is overwritten with failure
unless the complete independent readback shows exactly the requested name.

The first live run exposed a real subscription omission: `solo().get()` on the
slot-scoped layer bank was unavailable, so inventory omitted every flag and the
contract correctly refused. Marking those values interested in `Rig` fixed the
observer; the controller was rebuilt, deployed and reloaded before the passing
run.

`C-chain-switch` creates disposable containers on two tracks, switches the
source then its named alternate, proves exactly one exclusively soloed sibling
each time,
and proves the unrelated track's complete solo state is unchanged. Cleanup
deletes both containers. Fake and live run the same row.

The production `switch_device_alternate` tool emits only `chain.activate`,
returns the complete sibling states and an `exclusiveStateConfirmed` proof, and
states that automatic reversal does not restore the prior soloed entry. The 3f
production smoke seeds two alternates through the contract on its isolated
copied track, switches through the public MCP tool, independently re-reads the
container, and deletes the copied track.

Verification, 2026-08-15: brain typecheck plus **431/431** offline tests,
extension Gradle build green, `hello()` proved the fresh 147-method /
`7f212c48cd3dab75` deployment, live conformance passed **51, failed 0, skipped
6**, and production MCP smoke passed **7/7** with cleanup. Context check and
`git diff --check` are the closing checks. Session 3f-f may now begin bootstrap
and the production inspection/creation/fill surface.

### Session 3f-f — complete 2026-08-15, verified live

The Instrument case now ships with a one-entry empty seed at
`brain/assets/device-alternates/instrument-layer-seed.bwpreset`. It is a
build-time product asset, validates as a Bitwig preset, materialised live with
one empty entry, and needs no operator-authored runtime setup. The FX case
continues from the one empty entry a fresh FX Layer ships with.

`chain.rename` names either first entry before its `ChainAddress` is relied on.
It resolves the old name uniquely, targets the within-turn `channelId` already
reported by independent inventory, and accepts success only when the new name
resolves to that same identity. The already-promoted `chain.setName` wire route
is reused, so the golden remains 147 methods / `7f212c48cd3dab75`.

Three production tools now own the slice:

- `inspect_device_alternates` returns sibling names, raw `soloed` observations,
  an `exclusiveActive` name only when the complete all-known sibling read has
  exactly one solo, and ordered nested device names, labelling every incomplete
  view;
- `create_device_alternates` inserts the chosen Instrument or FX container,
  explicitly names its first entry, creates up to three more named entries and
  returns only independently resolved structure;
- `fill_device_alternate` moves or copies top-level devices in caller order,
  projects positional compaction across several moves and returns fresh
  destination structure.

All three descriptions state the object boundary: a device alternate carries
devices and device state, with no clips, sends, routing or track-mixer state.
The `layer` and `chain` surface bans were deliberately reviewed and kept: the
unambiguous `device alternate` / `container` vocabulary covers the public object
without exposing mechanism words.

Live proof corrected one relocation readback gap. Moving a top-level source that
sits before its destination compacts the container from position N to N-1. The
writer correctly used the pre-write position, but readback also used it and
would inspect the now-empty old slot. Readback now follows the container to N-1;
`C-chain-relocate` exercises that exact move live.

The first live run found old devices on the conformance-owned fixture tracks,
placing every new container past the two observable scopes. The harness now
restores those two scratch tracks to their documented empty-device baseline once
before the suite. The first production run then correctly refused a second
container at position 2; the smoke now switches and removes its disposable
Instrument container before exercising the FX case in the same observable slot.

Verification, 2026-08-15: brain typecheck plus **434/434** offline tests,
extension Gradle test green, live conformance **51 passed / 0 failed / 6
skipped**, production MCP smoke **10/10** with its copied track removed, context
check and `git diff --check` green. Session 3f-g may now begin directed winner
collapse.

Review hardening, 2026-08-15: multi-device fill now projects the complete batch
before its first settling stage, including source order/existence, top-level
compaction, destination identity and cumulative destination capacity. Fake and
live call the same guard. A failed later source or a destination with room for
only one of two requested devices therefore emits zero stages; focused surface
coverage also proves source, destination, recorded history and emitted writes
unchanged. Non-sorted caller order is covered separately.

Creation now rejects whitespace-only and exact-duplicate caller names before
container insertion. When the requested first name equals the seed entry's
observed name, creation explicitly renames through a unique temporary name and
back, with both writes recorded, rather than relying on an untouched name that
may change on fill. Inspection exposes the observed fact as `soloed`; it reports
`exclusiveActive` only from a complete all-known sibling read containing exactly
one solo and makes no effective-audibility claim.

Review verification, 2026-08-15: brain typecheck plus **439/439** offline tests
and extension Gradle test pass. The first live conformance attempt passed the
new relocation row but had one transient incomplete sibling read in the later
switch row (**50/1/6**); conformance-owned fixtures were removed and the clean
rerun passed **51/0/6**. Production MCP smoke passed every **P0-P10** check with
the new `soloed` / `exclusiveActive` structure and removed its copied track.
Final conformance cleanup deleted both fixture tracks, leaving the project at 10
visible tracks with Master visible and no test residue.

### Session 3f-g — complete 2026-08-15, verified live including its review pass

The destructive `keep_device_alternate` operation now names its survivor and
refuses before writing unless it can see the complete top-level device order,
the complete ordered winner contents, and exact name/mute/solo/volume/pan/colour
state. It extracts winner devices in order, independently proves both their
top-level tail placement and the now-empty source, then removes the container
through an expected-name guard. A new typed tail-relative top-level relocation
restores every kept device before the original following-device anchor; final
success requires an independent exact whole-track order match.

The answer reports the chain-level state that moving devices cannot carry,
states that device alternates have no sends, and keeps cross-device modulation
outside the claim. Shared fake/live conformance now runs the complete ordered
extraction, guarded deletion and position restoration sequence. Production smoke
adds the same lifecycle through the public destructive tool on its isolated copy.

Brain typecheck and **444/444** offline tests pass; extension Gradle test passes;
`git diff --check` is clean. The rebuilt jar was atomically deployed and the
running controller proved fresh. Full live conformance passes **51/0/6**. The
first full run exposed the already-known delayed sibling observation in the
later switch row; its harness now uses a bounded wait for eventual exact state,
recovers an insertion address only from a complete single-device reading when a
mint receipt is late, and enumerates both owned tracks during cleanup. The clean
full rerun passed. Production MCP smoke passes every **P0-P11** check and removed
its exact copied track after a live collapse restored `Organ` at the removed FX
container's former position and reported exact non-carried state.

`probe:3f-collapse-audio` closes E18h's scope gap by playing and metering the
copied track whose own container is collapsed. Two blind sets each heard
collapse **2/2** and placebo **0/2**, for **4/4 versus 0/4** combined. The
original controls were rejected rather than counted: track mute read back but
did not silence Master, while both VU `now` and `hold` remained latched after a
transport stop. A separate randomized two-arm gate then heard the proved 1200ms
stop/relaunch control and not its placebo; stopped transport and resumed Master
peak 62 were independently observed. An initial setup that accidentally muted
Master and a later distracted gate were voided.

Exact-ID cleanup removed `gn-conf-A`
(`1f167244-fba6-4fbc-ad78-5b47facea75c`) and `gn-conf-B`
(`717e1f2d-b228-4a87-8158-8abef723e9ce`). Every audio and production copy
removed its own minted id. A final read found the documented 10-track baseline
with Master visible and no test residue.

Review hardening, 2026-08-15 — three defects, each reproduced offline before it
was fixed, and all three in the same family: **evidence that could not have
distinguished success from failure was being reported as success.**

- ⚠⚠ **The signal-position proof could not see the move it was proving.** A
  top-level device is observed by position and NAME and has no durable id (a
  chain has one — `ObservedChain.id` — which is exactly why chain work can diff
  identities and this cannot). So when a kept device shared a name with a
  surviving top-level device, the order the restoration should leave spelled the
  order it started from, and the readback matched whatever happened, including
  nothing. `verifyDeviceReorder` and `assertDeviceRelocatable` now refuse such a
  move outright (`reorderIndistinguishable`, shared so the proof and the
  precondition cannot drift), and `keep_device_alternate` projects the entire
  restoration **before the destructive boundary** and refuses there, with every
  alternate still intact. Refusing afterwards would have been worthless: nothing
  can undo the removal, and acceptance item 2 is exactly the claim at stake.
- ⚠ **The container delete guarded the device and not the track.** It resolved
  its cursor by BANK ROW from the last scan and checked only `expectedName`, so
  a track bank that changed in between pointed it at a different track — where
  an identically named container satisfied the guard and was deleted with an
  `ok` reply. `device.delete` now carries `expectedTrackChannelId`, derived from
  the `DeviceAddress` it already holds, and the extension refuses a mismatch;
  this is the guard `device.relocate` has had since 3f-d, on the one verb that
  cannot be taken back.
- ⚠ **Partial destruction could report less than a refusal.** After a
  successful delete receipt, a removal the readback could not confirm returned
  without the captured name/mute/solo/volume/pan/colour/sends state, under a key
  no other path used. Every outcome after the first write now carries that
  state; removal is answered `true`/`false`/`null` from a fresh complete track
  order rather than from a receipt; and a throw after the first write is
  reported as a partial outcome instead of the surface's blanket "nothing was
  written", which it would otherwise have been.

⚠ **Two claims above are corrected by this pass rather than merely extended.**
`C-chain-relocate`'s collapse fixture held three identically named devices, so
the restoration it asserted was unprovable by its own oracle — the row now
builds the winner and its anchor from three distinct devices. And the production
smoke left the container LAST, where appending the winner and restoring it are
the same result, so the position half of that check could not fail; the probe
now inserts one ordinary device after the container and asserts the kept device
reads back at the container's former position, before that anchor.

⚠⚠ **A fourth defect appeared only when the fixes met a real DAW, and it is a
borrowed budget rather than a race** — the same shape as the `trackStruct` note
in step 6b-2, now measured. `LiveAdapter.containerScope` re-points cursor 0 and
reads `chain.inventory` after `settle('cursorPoint')` (25ms, E1). But that is
what a cursor POINT costs, and this reply comes through `Rig.slotLayerBanks`,
which have to FOLLOW the cursor to another track before the inventory means
anything. Measured 2026-08-15, re-pointing between two tracks and reading
immediately: the reply named the track just pointed at **0/6 at 0ms, 3/6 at
25ms, 5/6 at 50ms, 6/6 from 100ms**. So at the borrowed budget this read was a
coin flip. Nothing was ever mis-reported — the identity guard fails closed — but
a container write refused about half the time whenever the cursor had been
somewhere else, and `C-chain-switch` failed **two live runs in three** on it.
The guard is now POLLED within a bound: a mismatch is a staleness signal and
never an observation, so it re-points and re-reads (`cursorPoint` on the first
pass, `trackStruct` after), while every other miss answers immediately because
each of those IS an observation. ⚠ The bound counts ATTEMPTS rather than
wall-clock time — a clock spins hot wherever `settle` is not real time, which is
every offline test of this class, and a bound that means one thing in the suite
and another live is not a bound.

Verification at this boundary — every item below was actually run:

- brain typecheck plus **451/451** offline tests (7 new regression cases) and a
  green extension Gradle build; `git diff --check` clean;
- the jar was rebuilt, atomically deployed and the controller reloaded, and
  `probe:hello` proved the running build fresh. ⚠ The golden is unchanged at 147
  methods / `7f212c48cd3dab75`, because `methodsHash` is over method NAMES and
  this change adds a PARAMETER — the same blind spot step 6b-1 recorded for reply
  fields. The redeploy is the proof; a matching hash would not have been;
- live conformance **51/0/6** across five runs (three consecutive after the
  settle fix, two more after the bound became an attempt count). The same suite
  ran 50/1/6, 51/0/6, 50/1/6 before that fix;
- production MCP smoke **14/14, P0-P13, zero failures**. ⚠ P10-P12 are new and
  close a real hole: creation and fill both leave the container LAST, where
  restoring the winner and appending it are the same result, so the old P10's
  position half could not fail. With one device added after the container the
  live answer reads `finalDeviceOrder: ["Instrument Layer", "Organ",
  "Polysynth"]` — the kept Organ back at the removed container's position 1,
  before its anchor, with a recorded `reorderChange`. Acceptance item 2 is proved
  live for the first time here;
- every copied track removed its own minted id, `probe:conformance-cleanup`
  removed `gn-conf-A` and `gn-conf-B`, and the project is back to its documented
  10-track baseline with Master visible and no residue.

⚠ The audible evidence was NOT re-taken and stands as the earlier measurement.
Nothing in this pass changes what a successful collapse does to the signal, and
nothing here re-proves it.

### Session 3f-h — complete 2026-08-15, verified live

The destructive `remove_device_alternate` operation removes one explicitly
named alternate only while preserving at least two survivors. It refuses before
writing unless the complete top-level order, complete unique sibling set, every
survivor device order, every survivor name/mute/solo/volume/pan/colour value,
temporary top-level capacity and the replacement container scope are all
observable. The caller supplies the replacement instrument/effect role because
the current observer cannot infer it; the result reports that boundary directly.

The replacement is built at the track tail while the original remains. Names
are created in captured order, all devices move survivor-by-survivor, and fresh
reads prove the replacement population and emptied old survivor chains. Exact
zero-or-one survivor solo state is restored through `chain.activate`; all final
state fields are compared with their captured values and differences are
reported. Only after that proof is the guarded original container removed. A
final complete top-level order plus reduced-container readback proves the
replacement at the original signal position. Every post-write failure reports a
partial rebuild; an unreadable delete reports removal as unknown.

The three-entry fixture exposed a pre-existing creation-order defect:
`create_device_alternates` copied every new entry from the first, reversing the
tail under beside-source placement. Each requested entry now copies its immediate
predecessor, preserving caller order under both beside-source and tail placement,
with independent final readback still required.

Brain typecheck and **456/456** offline tests pass. Extension Gradle test passes;
`git diff --check` is clean. Live conformance passes **52/0/6**, including the
new `C-chain-reduce` row. Production MCP smoke passes **18/18, P0-P17**, including
public selective reduction, exact survivor state comparison, collapse and exact
two-track cleanup. Conformance cleanup removed both owned fixture tracks and the
project returned to its documented 10-track baseline with Master visible.

⚠ 3f-i inherits one live surface mismatch found while making production smoke
self-contained: `add_track` accepts requested names but `track.create` encodes no
name, and the fresh track read back as `Inst 11`. Closeout must fix the contract
or the description before the cohort is frozen.

Session 3f-i may now begin lifecycle closeout and the 3g handoff.

### Session 3f-i — complete 2026-08-15, verified live

The production cohort closes on these stable mechanical identities. This is the
handoff beneath 3g's wording/version work; changing a name, privilege grain,
input identity or emitted operation is a mechanics change rather than a wording
revision.

| public tool | class | input identities | emitted contract operations |
|---|---|---|---|
| `inspect_device_alternates` | read | `trackId`, `containerPosition` | none |
| `create_device_alternates` | write | `trackId`, `containerType`, `names` | `device.insert`, `chain.rename`, `chain.create` |
| `fill_device_alternate` | write | `trackId`, `containerPosition`, `alternateName`, `sourceDevicePositions`, `mode` | `chain.relocate` |
| `switch_device_alternate` | write | `trackId`, `containerPosition`, `alternateName` | `chain.activate` |
| `keep_device_alternate` | destructive | `trackId`, `containerPosition`, `alternateName` | `chain.relocate`, `device.delete`, `device.relocate` |
| `remove_device_alternate` | destructive | `trackId`, `containerPosition`, `alternateName`, `containerType` | `device.insert`, `chain.rename`, `chain.create`, `chain.relocate`, `chain.activate`, `device.delete`, `device.relocate` |

A successful `create_device_alternates` call is one device-alternate event for
3g. Inspect, fill, switch, winner collapse and selective reduction are lifecycle
actions on an existing event, not new managed-alternate events. `copy_track`
remains ordinary change reporting and never becomes one.

The descriptions were re-read together against their results. The only cohort
wording correction needed here is that filling by either move **or copy** carries
the device and device state; neither carries clips, sends, routing or track-mixer
state. Creation reports independently resolved structure, switching reports
exclusive readback, selective reduction compares every captured survivor field,
and winner collapse reports the state that device movement cannot carry. The two
reduction names remain separate destructive permissions.

The inherited live mismatch in `add_track` is closed in behavior rather than by
weakening its claim. `track.create` still encodes no name. The tool now creates
the full requested batch, uses the minted durable ids for a separate typed
`track.rename` batch, and independently reads every exact name. Its result
separates `creationConfirmed`, `namesConfirmed`, per-track `nameConfirmed`, and
the naming change receipt. Production P1 proved the fresh source under its
requested name instead of accepting the create acknowledgement.

Brain typecheck and **457/457** offline tests pass, including a single invariant
over the six lifecycle identities, classes, inputs and emitted operations.
Extension Gradle test, context check and `git diff --check` pass. Live
conformance passes **52/0/6** and production MCP smoke passes **18/18, P0-P17**.
Production cleanup removed both minted ids; conformance cleanup removed
`gn-conf-A` and `gn-conf-B`. The project returned to its documented 10-track
baseline with Master visible and no probe residue. No extension method was added,
so the wire golden remains 147 methods / `7f212c48cd3dab75`.

Session 3g may now begin the observation record and v1 description freeze.

## Capability boundary

| capability | `copy_track` | layer take | clip take |
|---|---:|---:|---:|
| general track CRUD | yes | no | no |
| managed take bookkeeping | no | yes | yes |
| carries devices | whole copied track | yes | no |
| carries launcher clips | whole copied track | no | yes |
| carries sends and track-mixer state | whole copied track | no | no |
| carries arrangement clips | whole copied track | no | no |
| container-local exclusive switch | no | yes | per-slot launch |
| beat-aligned switch | no | no | yes |
| Master/FX-return device alternate | no | yes | no |
| automatically linked to another alternate in the turn | no | no | no |

## Split and handoff rule

Sessions 3f-c through 3f-i are separate verified vertical slices and should land
independently. A later slice may depend on an earlier primitive, but it must not
absorb another slice's capability or permission boundary merely to make a green
demo. Session 3g starts only after 3f-i: both managed take representations must
have honest production mechanics to describe and observe, including the required
selective-reduction path.
