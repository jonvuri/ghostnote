# B18 — Note identity survives Launcher activity in a session

## Goal

A read's note IDs should survive any realistic amount of Launcher activity
within one server session. Today they survive exactly 24 slot fill/empty
events after a read; the 25th re-mints every ID at that slot and drops its
overlays, and the result does not say why
([E393](../evidence/experiments/e393-r01-round3-real-use-followups.md)
sections 1 and 4). One real session hit this mid-turn after generating 18
clips (E392). Addressed editing (B2) and any later sustained editing (B3,
[R01-D22](../../spec/r01-research/decisions/r01-d22-capability-grid-focus.md))
depend on stable IDs, so B18 comes before
[B19](b19-real-use-tooling-and-annotations.md).

## Facts

- **Origin of 24.** `Rig.CONTENT_LOG = 24`
  (`extension/src/main/java/com/ghostnote/extension/Rig.java`) dates from the
  August diagnostic work (`d1fbefd2`, E16). Its comment explains why events are
  logged by name, not why the ring holds 24. No measurement or decision sized
  it. [E233](../evidence/experiments/e233-pull-snapshot-references.md) §3
  noted the truncation (36 events through a 24-entry ring) as a known limit.
- **The real constraint is the reply, not memory.** `revision.get` returns the
  whole ring on every call (`BatchHandlers.java`, the `contentEvents` loop):
  one JSON object per event with a 36-character channel ID. A tool call reads
  marks one or more times (ledger: `read_launcher_clip` takes mark 1 and
  delta 1, or delta 2 on a repeated read). Enlarging the ring alone would
  therefore grow every mark reply linearly.
- **Brain side.** `contentDelta` slices `(since, now]` from the returned ring
  (`brain/src/contract/observers.ts`); `deltaComplete` fails when the ring was
  truncated, and `judgeClipSnapshot` then returns `identity-changed` with
  `why: 'delta-incomplete'` (`brain/src/contract/clip-snapshot.ts`). The read
  result keeps only `reason: identity-changed`
  (`brain/src/surface/agent-native.ts`, `identityFacts`).
- **Measured live (E393 §4).** Each clip add or delete is one event; 24 events
  keep IDs, 25 re-mint, with or without concurrent reads; a retained read
  refreshes the window.

## Work and acceptance

Required outcomes:
1. IDs survive at least several thousand slot events after a read in normal
   use; the exact bound is chosen from measured reply cost.
2. When the bound is exceeded, the re-mint stays fail-closed, and the result
   names the reason (`delta-incomplete`) with a warning.
3. Mark replies do not grow with the ring size in the common case.

Proposed mechanism (refine in the session):
- `revision.get` (or a delta method) accepts the caller's `since` epoch and
  returns only events in `(since, now]`, with an explicit `truncated` flag when
  `since` is older than the ring. A mark read with no `since` returns no
  events.
- Enlarge the ring substantially (for example 4,096–65,536 entries of a few
  fields each); size it from the reply-cost and memory check.
- The brain passes the ref's epoch when it asks for a delta, and maps
  `delta-incomplete` into `retiredRefs` and a warning.
- Alternative to weigh: a brain-side journal built from the deltas it already
  reads. It needs no wire change but fails when other clients or the user
  cause events between calls, so the extension route is preferred.

Check first: every consumer of `contentEvents` (change awareness, stale-base
and write guards, `check_launcher_clips`, copy and move routes) and whether any
depends on receiving the whole ring.

Verification:
- Unit and fake-adapter tests for slicing, truncation and the visible reason;
  the existing identity tests stay green.
- Wire golden, method hash and description version updated together; ledger
  rows for the mark and delta reply sizes; call-budget tests unchanged or
  updated with reason ([tool maintenance](../README.md#tool-maintenance)).
- Live: deploy with `./gradlew copyExtension`; the operator replaces the
  controller; `npm run probe:hello`. Re-run
  [`r01-r3-event-window.ts`](../../brain/src/probes/r01-r3-event-window.ts)
  in `gn-scale-test` with targets of 24, 25 and well above (for example 1,000),
  and one target past the new bound to see the visible reason. Optionally
  confirm the group-mirroring question from E393 if the operator adds a group
  with two child tracks. The driver cleans up its scratch track.

**Merge note.** `main`'s B17 work changed `BatchHandlers` (`batch.run` is
asynchronous) and `Rig.java`. Implement B18 on the merged tree; re-pin the
driver's build hash after deployment.

The operator's 2026-11-07 queue split keeps B18, then B19, on main while
[P01](p01-edit-path-performance.md#reconciliation-and-parallel-queues--2026-11-07)
continues in the `mossy-larch` worktree. B18's revision/delta contract overlaps
P01's planned reduction of composition reads and later clip-metadata captures.
Coordinate those shared adapter/contract changes and live-test windows: both
worktrees deploy to the same archive and Bitwig instance. P01 evidence now uses
E400–E404; coordinate subsequent evidence IDs before assigning new ones.

## Result

Not started.
