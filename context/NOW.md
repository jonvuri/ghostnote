---
title: Current state
kind: status
state: active
updated: 2026-08-15
phase: phase-1
session: phase-1-session-3f
---

# Now

Phase 1 session 3f step 5 is complete. `copy_track` is a
direct, measured-type-only CRUD tool over the preserved typed copy core: it
preflights one bank row, requires an explicit name, returns only an observed
fresh durable id, records the structural copy and typed rename as ordinary
session changes, and promises no managed relationship or automatic cleanup.

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
| 3f step 6 — layer-chain lifecycle | next | [brief](plan/phase-1/3f-fork-chain.md) |
| 3g — observation and v1 descriptions | planned | [brief](plan/phase-1/3g-record.md) |
| 4 — control layer | planned | [brief](plan/phase-1/4-control-layer.md) |
| 5 — live proving | planned | [brief](plan/phase-1/5-proving.md) |
| 6 — async completion | optional | [brief](plan/phase-1/6-async.md) |

## Start the next session here

1. Continue nested layer addressing and the autonomous create/fill/switch/reduce/
   collapse lifecycle. The seed preset must be bundled/provisioned at build time.
2. Do not begin the 3g observation record until both managed take representations
   have mechanically honest production descriptions.

## Evidence boundary

E22 ran 10 scored arms plus 4 recovery controls. `Group` dispatched according to
Bitwig's unobservable primary focus: track-header focus wrapped, launcher/chain/
project focus missed, and device-header focus built an Instrument Layer instead.
Every available durable-id and selection guard passed in the misdispatch row.
`branch.groupTrack` therefore remains registered only for the committed regression
probe and is banned from the product wire vocabulary.

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
