---
title: Current state
kind: status
state: active
updated: 2026-10-05
phase: phase-8-agent-native-live-engine
session: 8h3b-complete
---

# Now

[8h3b — Replay fetch cost](plan/phase-8/8h3b-replay-fetch-cost.md) is
complete. [E229](evidence/experiments/e229-replay-fetch-cost.md) records
50 trials and 800 bit-exact fetches over five fixtures.

Selected fetch format for 8h3c: `packedDict`, one page up to 131,072 notes,
encoded on the controller thread from the close-task copy. At 131,072 notes
the fetch takes 40 ms instead of 202 ms. Read plus fetch takes 339 ms instead
of 505 ms. The longest controller block is 11.8 ms median.

Product rules for 8h3c from 8h3a (E228) stay unchanged:

- Bind from empty park. Select the target row before pointing the reader.
- Finish scheduled writes before the read opens. Queue writes behind an open
  read.
- Capture selection before park preparation. Restore slot track, slot row,
  and mixer track at close under the E99 lease; unsubscribe for release.
  A lost lease must refuse restoration.
- Flag every step callback after close and before release. Use no fixed
  watch delay.

Next: [8h3c — Cold-reader promotion](plan/phase-8/8h3c-cold-reader-promotion.md).
Then 8h3d change awareness and 8h3e cache trim.
Changes are staged for review. No commit was made.

## Live state

- The operator closed `New 4` without saving. No fixture tracks remain.
  `gn-scale-test` is the anchor; research did not change it.
- The original config is restored (SHA-256 `256bbf07…43b0`). The normal
  archive is rebuilt with the `Bridge` timing hook and deployed. The research
  archive is removed.
- Fresh normal hello passes at `2026-10-05T12:45:08.491Z`: `normal-v1`,
  85 methods, hash `bba7383dce25c0f0`. See
  [restoration.json](evidence/data/phase8h3b-fetch/restoration.json).

## Facts that are easy to lose

- Each bridge request waits about 20 ms in the host task queue, also when the
  controller is idle (E229). Count pages and round trips, not bytes.
- `Bridge.setTiming` is a research hook. Normal builds set no sink. 8h3c can
  remove it with the research reader.
- D23 settles one 1/512 view. Stable code keeps `1/768` until 8h3c removes it.
- E225 proved 4,194,304 steps. Normal limits stay unchanged until 8h3c.
- Host gain reads back twice the written value (E2). An equal setter can leave
  `getStep` stale; rebind for a fresh verification read.
- `context/check.rb` needs a UTF-8 locale: `LANG=en_US.UTF-8`.

## Retrospective

Measure the idle request floor before candidate fixes. Here it was the
largest fixed cost. Put research timing at the transport, where
serialization and write happen, not only in the handler.
