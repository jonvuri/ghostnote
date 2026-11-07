# B18 — Note identity survives Launcher activity in a session

## Goal

A read's note IDs should survive any realistic amount of Launcher activity
within one server session. Before B18 they survived exactly 24 slot fill/empty
events after a read; the 25th re-minted every ID at that slot and dropped its
overlays, and the result did not say why
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

## Result

Done and verified live on 2026-11-07
([E405](../evidence/experiments/e405-b18-content-event-window-live.md)).

- **Extension.** `Rig.CONTENT_LOG` is 8,192. `revision.get` accepts an optional
  `since` and returns every event in `(since, now]` or none when the ring lost
  any of them (`ContentWindow`, with a harness test). Without `since` it
  returns no events. `rig.info.contentLog` is the build marker. The method
  surface is unchanged (93, `d6decf985f6b1f36`). The legacy `slot.epoch` log
  keeps its 24-line view.
- **Brain.** `contentSince` sends `since`; a plain mark does not. The fake
  answers through the same `windowSince` rule over the same `CONTENT_LOG`.
  `read_launcher_clip` adds `why` to `retiredRefs` and a `delta-incomplete`
  warning; `check_launcher_clips` adds the warning. A `current` read or check
  moves the ref's mark forward, so the window counts from the latest read.
  Run 1 of the driver found the missing refresh. Descriptions are v59.
- **Bound.** 8,192 was chosen from the measured reply cost. A full-window
  delta is 889 KB at a median of 45–51 ms, about one extra turn, and only
  when that much activity follows a read. A plain mark stays at about 255 B.
  The window is shared by every slot event in the project.
- **Consumers checked.** Change awareness, stale-base and write guards, the
  stash boundary, the executor's concurrent report, `check_launcher_clips`
  and navigation all receive deltas through `contentSince`. No consumer
  needed the whole ring; the old diagnostic probes that read raw
  `revision.get` now need `since`.
- **Not run.** E393's optional group-mirroring question.
