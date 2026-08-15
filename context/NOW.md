---
title: Current state
kind: status
state: active
updated: 2026-08-15
phase: phase-1
session: phase-1-session-3f
---

# Now

Phase 1 session 3f step 6b-2 is complete and **verified live**. The first typed
verb that writes inside a container exists: `chain.create` copies a named chain
and names the copy, in one op, because a duplicate arrives wearing its source's
name and a chain nobody can name is a chain nothing can address.

How it knows what it made, which is the whole of the design:

- the copy is identified by the container's per-chain `channelId` diffed across
  the write (`mintedChain`, in the contract, shared by both adapters) — an id
  that is worthless as an ADDRESS, because the loader mints it on every project
  load (E17ad, E18b), and exactly right as a within-turn witness;
- the receipt mints only after the new NAME resolves, uniquely, to that same
  chain. Acknowledgement is not evidence and neither is the writer's handle;
- if it cannot be identified or named, a real chain is left wearing the source's
  name and the op is REPORTED FAILED with that sentence — there is no typed
  delete to roll it back with.

⚠⚠ Three new wire methods — `chain.select`, `chain.duplicate`, `chain.setName` —
so the golden hash MOVED to `c1120b1c567369d3` (146 methods). The jar was rebuilt,
redeployed and Bitwig restarted before the live run; `hello()` refuses on a hash
mismatch, so a stale deployment could not have produced a green run.

⚠⚠ They read through `Rig.slotLayerBanks`, the banks `chain.inventory` already
enumerates — deliberately NOT the `layer.*` methods `e17ak` measured, which follow
`cursorDevice0`. Same interface, same two calls, a different bank handle, which
this project's own rules say is a measurement rather than a deduction. **It is
now measured: `C-chain-create` passed live.** A `DeviceLayer` reached through a
slot scope honours `selectInEditor()` + `Channel.duplicate()` exactly as one
reached through `layerBank0` does, so the product route needs no device cursor.

⚠ `assertDevicesRoutable` did NOT move. Every other nested route still refuses on
both adapters, and `chain.move` stays probe surface.

Step 6b-1 stands underneath it and is unchanged: a chain and a device inside one
resolve and read against real structure through `chain.inventory`, keeping
`found`, `ambiguous`, `outside-bank-window` and `absent` apart because each
asserts a different fact. Depth beyond one level and a nested `ParamAddress` stay
`unsupported`.

Step 6a stands under that: a chain is addressed by container position plus
NAME, because its `channelId` is minted afresh by every project load while the
name survives (E17ad, E18b). Every pre-nesting `addressKey` is byte-identical and
nested keys escape chain names so none can forge another.

Step 5 remains as shipped: `copy_track` is a direct, measured-type-only CRUD tool
over the preserved typed copy core: it preflights one bank row, requires an
explicit name, returns only an observed fresh durable id, records the structural
copy and typed rename as ordinary session changes, and promises no managed
relationship or automatic cleanup.

The product direction is now settled in revised D18:

- managed device takes use layer chains;
- managed clip takes use launcher clip blocks;
- those alternates may be created concurrently but independently in one turn;
- track duplication remains ordinary typed CRUD, recorded as a normal session
  change but not as a managed take;
- mechanical functionality may never require runtime operator assistance.

## Current ladder

| Session | State | Record |
|---|---|---|
| 1 — executor | done | [outcome](archive/outcomes/PHASE-1-SESSION-1-EXECUTOR.md) |
| 2 — store | done, later retired by D17 revision | [outcome](archive/outcomes/PHASE-1-SESSION-2-TAKES.md) |
| 3 — live adapter | done | [outcome](archive/outcomes/PHASE-1-SESSION-3-BRIDGE.md) |
| 3b — capacity | done | [outcome](archive/outcomes/PHASE-1-SESSION-3B-PROBES.md) |
| 3c — window | done | [outcome](archive/outcomes/PHASE-1-SESSION-3C-WINDOW.md) |
| 3d — write surface | done | [outcome](archive/outcomes/PHASE-1-SESSION-3D-SURFACE.md) |
| 3e — clip block | done | [outcome](archive/outcomes/PHASE-1-SESSION-3E-CLIPBLOCK.md) |
| 3f step 5 — `copy_track` CRUD | done | [brief](plan/phase-1/3f-fork-chain.md) |
| 3f step 6a — nested address grammar | done | [brief](plan/phase-1/3f-fork-chain.md) |
| 3f step 6b-1 — chain observation | done, verified live | [brief](plan/phase-1/3f-fork-chain.md) |
| 3f step 6b-2 — `chain.create` | done, verified live | [brief](plan/phase-1/3f-fork-chain.md) |
| 3g — observation and v1 descriptions | planned | [brief](plan/phase-1/3g-record.md) |
| 4 — control layer | planned | [brief](plan/phase-1/4-control-layer.md) |
| 5 — live proving | planned | [brief](plan/phase-1/5-proving.md) |
| 6 — async completion | optional | [brief](plan/phase-1/6-async.md) |

## Start the next session here

1. The FILL verb is the next one, and it is what unlocks everything still
   one-sided: move/copy/insert a device into a chain, verified through a handle
   other than the writer. `chain.move` is on the wire as probe surface with its
   directions measured, and is deliberately still unreachable. ⚠ Follow
   `chain.create`'s shape rather than the `layer.*` precedent — the slot scopes
   are now proven for writes as well as reads, so nothing needs `cursorDevice0`.
2. Two assertions are still not constructible and should move into conformance
   the moment they are: an AMBIGUOUS name in one container (the create refuses a
   colliding name, so `T-ambig` stays fake-only and conformance asserts the
   refusal instead), and a chain HOLDING A DEVICE (the shipped FX Layer chain is
   empty and a copy of an empty chain is empty). Both unlock with the FILL verb.
3. Every typed chain DELETE still refuses (`e17al`, `e17am`), so reduction is
   *move devices out, delete the container*.
4. ⚠ The seed asset is deferred, not cancelled: the FX/Master path is fully typed
   without one — now end-to-end live — and only the Instrument Layer case (ships
   with ZERO chains, `e17ai`) still needs it. Scope it when that case is built.
5. Do not begin the 3g observation record until both managed take
   representations have mechanically honest production descriptions.

## Evidence boundary

E22 ran 10 scored arms plus 4 recovery controls. `Group` dispatched according to
Bitwig's unobservable primary focus: track-header focus wrapped, launcher/chain/
project focus missed, and device-header focus built an Instrument Layer instead.
Every available durable-id and selection guard passed in the misdispatch row.
`branch.groupTrack` therefore remains registered only for the committed regression
probe and is banned from the product wire vocabulary.

## Step 6b-2 verification

- Brain typecheck plus **419/419 offline tests** passed on 2026-08-15 — 8 new
  `N-mint` cases for the identity diff, 6 `T-create` fake-model and fake-adapter
  cases, 6 `L-chain-create` live-adapter cases driven offline against a stub that
  models `e17ak` arm A (a duplicate with nothing selected does nothing at all),
  2 `E-chain` encoder cases, the rewritten session-3f wiremap bucket assertion,
  and the new `C-chain-create` conformance row.
- Extension Gradle build passed and `git diff --check` passed on 2026-08-15.
- ⚠⚠ **THREE wire methods were added, so the golden hash MOVED**: 146 methods,
  `c1120b1c567369d3` (was 143 / `4c4d687667d4804b`). Unlike step 6b-1 this is the
  loud kind of change — `contract.hello` compares the hash, so the jar was
  rebuilt and redeployed and Bitwig restarted, and an un-redeployed jar would
  have refused the session rather than passing green.
- ⚠⚠ **Live conformance passed 49, failed 0, skipped 6 on 2026-08-15**, against
  the redeployed jar. `C-chain-create` passed live in 3.9s: a real FX Layer
  inserted, its shipped chain read back off the container, a copy made through
  `chain.select` + `chain.duplicate`, identified by the `channelId` diff, renamed
  by that id, and then RESOLVED by its new name — with the source still
  resolving under its own. Both same-name refusals fired before any copy, and
  both nested write refusals still held.
- ⚠⚠ **The handle deviation is CLOSED.** `e17ak` measured
  `selectInEditor()` + `Channel.duplicate()` on a `DeviceLayer` from
  `rig.layerBank0`; this route calls them on one from `Rig.slotLayerBanks`, and
  it behaves identically. So the product write and the product read now address
  containers through the same cursor-free scopes, and neither needs the
  device-cursor apparatus Phase 4 owns.
- ⚠ **The borrowed settle held.** The 144ms `trackStruct` wait between
  `chain.select` and `chain.duplicate` is not a measured chain-selection budget
  and is still not one — the live pass says 144ms is ENOUGH, not that it is the
  floor. If a future run produces a silent ○ here, that number is the first
  suspect.
- The 6 skips are the standing ones a live harness cannot construct (bank and
  scene-window overflow, same as every prior run).
- `C-chain-observe` and `C-nested-device` both passed unchanged, so observation
  and the write refusals are exactly where step 6b-1 left them.
- ⚠⚠ **A review pass after the live run found three defects, all on paths the
  live row does not exercise — it runs ONE create against a cooperative
  extension.** Two were reproduced against the fake before being fixed:
  `assertChainCreatable` checked every create in a batch against the same
  pre-batch reading, so two creates against a 3-of-4 container produced FIVE
  chains (one stranded past the bank, unresolvable, undeletable) and two creates
  named `dup` produced two chains called `dup` — both with every op receipt
  reporting `ok: true`. The guard now PROJECTS the container across the batch,
  the way `assertSlotsFree` projects occupancy and `assertSceneRoom` sums rows,
  which needed the bank SIZE on `ObservedContainer`. Third: a `chain.setName`
  the extension refuses threw out of `apply` instead of producing the documented
  failed-op receipt, leaving an ambiguous container and no report at all; and the
  fake returned quietly where the live adapter reported failure. Offline is now
  423/423 with a regression case for each.
- ⚠ **No live re-run since those fixes.** They are refusals and reports on paths
  the passing row never entered, so the 49/0/6 result stands — but the batch
  paths themselves have still never met a real DAW.
- ⚠ What is deliberately not claimed: nothing fills, switches or reduces a chain,
  no other nested write route was promoted, and the surface ban list was not
  reopened (no tool ships this verb yet).

## Step 6b-1 verification

- Brain typecheck plus 395/395 offline tests passed on 2026-08-15 — 12 `N-*`
  lookup cases, 8 `L-chain` live-adapter cases driven offline against a
  cursor-modelling inventory stub, 5 new `T-*` fake-model cases, and the rewritten
  `C-nested-device` plus the new `C-chain-observe` conformance row.
- Extension Gradle build passed and `git diff --check` passed on 2026-08-15.
- ⚠ No wire METHOD was added, so the golden is unchanged at 143 / `4c4d687667d4804b`
  (`npm run wire:golden` reports "already current"). Reply FIELDS were added,
  which `methodsHash` cannot see, so the extension was rebuilt and deployed by
  atomic rename and Bitwig was restarted before the live run.
- ⚠⚠ **Live conformance passed 48, failed 0, skipped 6 on 2026-08-15**, against
  the redeployed jar. `C-chain-observe` passed live in 2.5s — a real FX Layer
  inserted, its shipped chain read back off the container, resolved by the name
  the container reported, and a name it does not hold answered `absent` rather
  than `unsupported`. `C-nested-device` passed with its rewritten expectations,
  so the write refusals still hold where the reads now succeed.
- The 6 skips are the standing ones a live harness cannot construct (bank and
  scene-window overflow, same as every prior run).

What the slice deliberately does not claim: nothing creates, fills, switches or
reduces a chain, and no nested write route was promoted.

⚠ Three corrections to the plan text this slice was written from, all found by
reading the code rather than live:

- `layer.list` was never banned by `wiremap.test.ts` — it is a pre-split method
  absent from `WIRE_METHODS_BANNED`. The enumeration that WAS pinned, and the one
  promoted, is `chain.inventory`: it names its container by parameter instead of
  by cursor state (the e16o trap), reads slot/chains/devices in one reply, and
  needs no device cursor. `layer.list` follows `cursorDevice0` and would have
  dragged the Phase-4 device-cursor apparatus in with it.
- "Zero name matches is `absent`" was too strong. The chain banks are four wide
  and the enumeration omits empty slots, so a full bank and an overflowing one
  are byte-identical; zero matches is `absent` only when the bank sizes prove the
  view complete, and `outside-bank-window` otherwise.
- No golden regen was owed. Promoting an already-registered method moves nothing.

## Step 6a verification

- Brain typecheck plus 369/369 offline tests passed on 2026-08-15 — 11 new `A-*`
  address cases and the `C-nested-device` conformance row, which runs on both
  adapters.
- Extension Gradle build passed and `git diff --check` passed on 2026-08-15.
- ⚠ No wire method was added or renamed, so the golden hash was unchanged and that
  slice owed no live run.

## Step 5 verification

- Brain typecheck plus 357/357 offline tests passed on 2026-08-15.
- Extension Gradle build passed on 2026-08-15.
- Production MCP smoke passed 6/6 on 2026-08-15; transport was stopped and the
  copied track was removed by its observed fresh id.
- Live conformance passed 46, failed 0, skipped 6 on 2026-08-15. The new
  `C-track-copy` row passed, and the formerly load-dependent `C-minted` row passed.
- `git diff --check` passed on 2026-08-15.

## Prior verified state

- E22 evidence/probes committed: `03f6660`.
- Wire golden was 143 methods / `4c4d687667d4804b` through step 6b-1; step 6b-2
  moved it to 146 / `c1120b1c567369d3`. `branch.groupTrack` remains in the
  `addedInE22Probe` bucket and product-banned.
- Trimmed handoff verification on 2026-08-14: brain typecheck plus 353/353 tests,
  extension Gradle build green, and `git diff --check` green. Rerun the standard
  checks before the next implementation commit.

- MCP smoke probe: 4/4 on 2026-08-10.
- Session 3e production MCP smoke: 9/9 on 2026-08-11; both live launch-settings
  arms 5/5, transport stopped and every probe-created clip removed.
- `C-minted`'s former load-dependent red is retired by the 2026-08-15 live run.
  `LiveAdapter`'s bounded bank polling observed the created `channelId` cleanly.
