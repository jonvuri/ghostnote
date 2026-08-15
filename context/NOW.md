---
title: Current state
kind: status
state: active
updated: 2026-08-14
phase: phase-1
session: phase-1-session-3f
---

# Now

Phase 1 session 3f is ready to resume in a new session. E22's evidence and probe
are committed at `03f6660`. The remainder of the old grouped track-fork slice has
been trimmed: only reusable typed track-duplication/readback groundwork,
probe-only E22 support, and the revised active documentation remain in the
worktree.

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
| 3f step 5 — `copy_track` CRUD | next | [brief](plan/phase-1/3f-fork-chain.md) |
| 3f step 6 — layer-chain lifecycle | follows step 5 | [brief](plan/phase-1/3f-fork-chain.md) |
| 3g — observation and v1 descriptions | planned | [brief](plan/phase-1/3g-record.md) |
| 4 — control layer | planned | [brief](plan/phase-1/4-control-layer.md) |
| 5 — live proving | planned | [brief](plan/phase-1/5-proving.md) |
| 6 — async completion | optional | [brief](plan/phase-1/6-async.md) |

## Start the next session here

1. Review the remaining diff. It should contain no product `track.group` path and
   no `make_track_copy` tool.
2. Finish the fresh-vocabulary `copy_track` surface around the preserved typed
   duplication core; verify offline, extension, and live behavior; commit it as an
   independent unit.
3. Continue nested layer addressing and the autonomous create/fill/switch/reduce/
   collapse lifecycle. The seed preset must be bundled/provisioned at build time.
4. Do not begin the 3g observation record until both managed take representations
   have mechanically honest production descriptions.

## Evidence boundary

E22 ran 10 scored arms plus 4 recovery controls. `Group` dispatched according to
Bitwig's unobservable primary focus: track-header focus wrapped, launcher/chain/
project focus missed, and device-header focus built an Instrument Layer instead.
Every available durable-id and selection guard passed in the misdispatch row.
`branch.groupTrack` therefore remains registered only for the committed regression
probe and is banned from the product wire vocabulary.

## Last verified state

- E22 evidence/probes committed: `03f6660`.
- Wire golden: 143 methods, hash `4c4d687667d4804b`; the extra method is in the
  `addedInE22Probe` bucket and product-banned.
- Trimmed handoff verification on 2026-08-14: brain typecheck plus 353/353 tests,
  extension Gradle build green, and `git diff --check` green. Rerun the standard
  checks before the next implementation commit.

Still standing from before this detour, and not re-run since:

- Live conformance: 45 pass, 0 fail, 6 skipped on 2026-08-10.
- MCP smoke probe: 4/4 on 2026-08-10.
- Session 3e production MCP smoke: 9/9 on 2026-08-11; both live launch-settings
  arms 5/5, transport stopped and every probe-created clip removed.
- ⚠ `C-minted` remains the conformance suite's one load-dependent red, carried to
  [session 5's B7](plan/phase-1/5-proving.md). ⚠ **Its prescribed fix has since
  landed offline** inside the preserved track-copy groundwork — `LiveAdapter` now
  polls the bank for the new `channelId` on every minting stage rather than
  trusting the `trackStruct` budget, `track.create` included. Unproven live: the
  next full conformance run is what retires it.
