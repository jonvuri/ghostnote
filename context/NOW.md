---
title: Current state
kind: status
state: active
updated: 2026-08-15
phase: phase-1
session: phase-1-session-3f
---

# Now

Phase 1 session 3f step 6b's OBSERVATION half is complete and verified live. A
chain and a device inside one now resolve and read against real structure,
through `chain.inventory` — promoted out of E18 §3.1 probe surface, and the only
promotion in the slice. Resolution walks the whole path and keeps
four answers apart, because each asserts a different fact: `found` (the path was
walked), `ambiguous` (the name matched more than one chain), `outside-bank-window`
(we saw a bank that may not hold everything) and `absent` (we saw all of it and
it is not there). A chain inside a chain and a parameter inside a chain both stay
`unsupported`.

⚠ Observation did NOT relax any write. `assertDevicesRoutable` still refuses
every op naming a device inside a chain, on both adapters, and `chain.move`
stays probe surface.

Step 6a stands underneath it: a chain is addressed by container position plus
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
| 3f step 6b-2 — the first typed chain verb | next | [brief](plan/phase-1/3f-fork-chain.md) |
| 3g — observation and v1 descriptions | planned | [brief](plan/phase-1/3g-record.md) |
| 4 — control layer | planned | [brief](plan/phase-1/4-control-layer.md) |
| 5 — live proving | planned | [brief](plan/phase-1/5-proving.md) |
| 6 — async completion | optional | [brief](plan/phase-1/6-async.md) |

## Start the next session here

1. The first typed verb — chain creation, measured autonomous:
   `layer.select` + `Channel.duplicate()` (`e17ak`). Success requires independent
   resolver/readback proof, not acknowledgement or the writer's selected handle,
   and the resolver to prove it with now exists. Naming the chain it mints is
   part of the verb: a chain is addressed by NAME, so a chain nobody named is a
   chain nothing can address twice.
2. That verb also unlocks two things this slice could only prove one-sidedly: an
   AMBIGUOUS name in one container (fake-only today, `T-ambig`), and a chain
   holding a device. Move both into conformance when they become constructible.
3. Every typed chain DELETE still refuses (`e17al`, `e17am`), so reduction is
   *move devices out, delete the container* — and the mover (`chain.move`)
   is deliberately still probe surface.
4. ⚠ Settle the seed asset's scope before building it: a fresh FX Layer ships with
   one chain and can be grown entirely typed; a fresh Instrument Layer ships with
   zero and cannot (`e17ai`, `e17ak`). The fake models exactly this asymmetry
   (`T-ship`), so the offline suite will follow whichever way it is settled.
5. Do not begin the 3g observation record until both managed take
   representations have mechanically honest production descriptions.

## Evidence boundary

E22 ran 10 scored arms plus 4 recovery controls. `Group` dispatched according to
Bitwig's unobservable primary focus: track-header focus wrapped, launcher/chain/
project focus missed, and device-header focus built an Instrument Layer instead.
Every available durable-id and selection guard passed in the misdispatch row.
`branch.groupTrack` therefore remains registered only for the committed regression
probe and is banned from the product wire vocabulary.

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
- Wire golden: 143 methods, hash `4c4d687667d4804b`; the extra method is in the
  `addedInE22Probe` bucket and product-banned.
- Trimmed handoff verification on 2026-08-14: brain typecheck plus 353/353 tests,
  extension Gradle build green, and `git diff --check` green. Rerun the standard
  checks before the next implementation commit.

- MCP smoke probe: 4/4 on 2026-08-10.
- Session 3e production MCP smoke: 9/9 on 2026-08-11; both live launch-settings
  arms 5/5, transport stopped and every probe-created clip removed.
- `C-minted`'s former load-dependent red is retired by the 2026-08-15 live run.
  `LiveAdapter`'s bounded bank polling observed the created `channelId` cleanly.
