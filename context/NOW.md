---
title: Current state
kind: status
state: active
updated: 2026-10-03
phase: phase-8-agent-native-live-engine
session: 8g2b-step-delta-read-window-complete
---

# Now

Next session: [8g3 — Snapshot acquisition and global budgets](plan/phase-8/8g3-snapshot-and-global-budgets.md).

[8g2b](plan/phase-8/8g2b-step-delta-read-window.md) is complete. It used
these results:

- [E217](evidence/experiments/e217-later-callback-ordering-rule.md) passes the
  ordering rule. A zero-delay task that a mid-batch callback schedules runs after
  the batch: 94 of 94 confirmations, from ticks and from bridge RPCs.
- The [step-delta window](evidence/format/PHASE8G_PROJECT_CONTINUITY.md#8g2b-step-delta-read-window)
  admits covered reads only after a confirmation in a later callback. The window
  value is the init nonce, the identity epoch, the binding revision, and the
  step count. A changed value retires the binding and deletes the reference.
- [E218](evidence/experiments/e218-step-delta-read-window-live-acceptance.md)
  passes 147 live trials with zero foreign or differing outputs. At open read
  windows, the step window refused 13 of 13 unseen detours. Native overlap
  coverage is thin: one overlapped acquisition, which refused.
- Live slot inventory still refuses (`inventory-outside-step-coverage`). Chain
  IDs and identity equality only invalidate. All results stay `complete:false`
  and `eligible:false`. D26 and E217 are named assumptions. Do not enter 8h.

8g3 live work can now use the window. Each read stage adds a confirmation poll.
Any step or rebind in any shadow observer refuses open windows and discards
retained output, so measure that effect under load.

The staged diff contains only 8g2b. Entry HEAD is `0bd8704`. No commit is made.
Build markers: shadow `8g2b-shadow-step-delta-v1`, root `8g2b-root-step-delta-v1`,
and delivery `e217-callback-ordering-v2`. To deploy the 8g controls product, run
`./gradlew copyShadowProbeExtension`. `copyExtension` deploys only the normal
product.

The live state is at baseline. Hello passes on the normal profile with 85
methods, hash `bba7383dce25c0f0`, and init `2026-10-03T01:30:55.283Z`. Config
SHA-256 is `256bbf07…43b0`. Tracks, scenes, scan, selection, and cursors match
the retained final baseline. Fixtures `New 8` and `New 9` were closed without
saving. Original `New 1` remains open and unsaved. Never save or close it. The
8g controls archive is removed. The deployed normal archive was built early in
this session. The normal profile allocates no shadow or delivery probe, so its
behavior and wire table are unchanged.

## Retrospective

The first deploy used `copyExtension`. That command does not deploy the 8g
controls product. `AGENTS.md` now names `copyShadowProbeExtension`. Random detour
injection mostly missed read windows. Targeting the injection at a reported
stage gave the decisive evidence, so attribute the stage from the start.
