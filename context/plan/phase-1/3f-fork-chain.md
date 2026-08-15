---
title: Phase 1, session 3f — track-copy CRUD and the layer-chain lifecycle
kind: plan
state: active
status: STEP 6b-2 COMPLETE 2026-08-15, VERIFIED LIVE. Steps 5, 6a and 6b-1
        shipped and were verified live. Step 6b-2 lands `chain.create`, the first
        typed write inside a container: it copies a named chain, names the copy,
        identifies it by within-session id, and mints only once the new name
        resolves. Three new wire methods moved the golden hash, the jar was
        redeployed, and live conformance passed 49/0/6 with `C-chain-create`
        green. Next: the FILL verb.
updated: 2026-08-15
parent: README.md
prev: 3e-clip-block.md
next: 3g-record.md
scope: revised D18
evidence: E16 duplicate/readback rows; E17; E18a/c/e/g/h; E22; D13, D18–D20
---

# Phase 1, session 3f — track-copy CRUD and the layer-chain lifecycle

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
11. ⚠ The word `duplicate` is still banned on the surface (`naming.ts`). It is
    marked a relaxation candidate for exactly this tool: either write the
    description in the surface's own vocabulary, or reopen that one entry
    deliberately with its reason rewritten. Do not delete the entry silently.
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
2. Create a chain from a bundled/provisioned seed asset. Runtime operator-authored
   presets are forbidden as a functionality dependency.
3. Fill a chain by moving/copying/inserting devices and verify placement through a
   handle other than the writer.
4. Switch alternates with `DeviceLayer.solo()`, retaining E17's container-local
   exclusivity and proving unrelated tracks do not flip.
5. Support directed reduction autonomously. The common winner-only collapse moves
   the winner's devices out and deletes the layer container; selective removal
   while several alternates survive may use the measured rebuild route.

Correctness gates for collapse/rebuild:

- preserve the order of multiple devices;
- restore the intended signal-chain position, not merely `chainEnd`;
- report or restore chain-level state that does not move with devices;
- measure the audible effect on the real track;
- keep cross-device modulation outside the claim until the indexed path is tested.

The seed asset is a build-time dependency and may require its own small asset task,
but it must ship as part of the feature rather than as operator setup.

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
both adapters. ⚠ **No live re-run has been made since.** The fixes are refusals
and reports on paths the passing live row never entered, so its result stands —
but the batch paths themselves have still never met a real DAW.

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

Commit step 5 independently once green. Step 6 may span more than one session;
split at a verified vertical slice rather than weakening the address or lifecycle
acceptance. Session 3g starts only after both managed take representations have
honest production mechanics to describe and observe.
