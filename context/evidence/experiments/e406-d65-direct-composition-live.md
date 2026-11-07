---
title: E406 — D65 direct composition and its reversal, live
kind: evidence
updated: 2026-11-07
owner: P01
---

# E406 — D65 direct composition and its reversal, live

**Positive.** The normal product build composes staged `compose_devices`
containers by direct `chain.insert` with one final container read, and
`revert_change` restores the exact prior structure. Six one-device chains at
position 18 took 13.7 s / 133 wire turns, against
[E398](e398-integrated-paged-writes-live.md)'s 44.4 s / 703 on the per-stage
route. Every admitted case here stays well under D44's 30 s plan budget;
this run measured no shape above the current six-unit limit, so the limit
is unchanged.

## Session and build

Bitwig 6.1.4 / API 25, project `gn-scale-test`. This worktree's normal build
was deployed after the operator's first replacement, whose handshake showed
the earlier 93-method build and failed on `chain.insert`; no write followed.
After the second reply, “Controller replaced”
([operator record](../data/p01-compose-live/operator.json)), the
[handshake](../data/p01-compose-live/hello.log) passed: `normal-v1`,
94 methods, `526cd7e3760580cc`, fresh initialization. The driver also
required `rig.info.chainInsertRoute = chain-insert-v1` and no write block.
Before every write it refused any other probe driver or bridge client; nine
idle MCP servers from the main checkout held no bridge connection.

The [driver](../../../brain/src/probes/p01-compose-live.ts) owned scratch
track `gn-p01-compose`. Each case read the track with `read_devices`,
composed an FX Layer, read the result back independently, reverted it by
change ID and required the exact prior public structure.

## Attempts

- [Attempt 1](../data/p01-compose-live/attempt-1.log) stopped before any
  write: the driver read the build marker from `contract.hello`; it is in
  `rig.info`.
- [Attempt 2](../data/p01-compose-live/attempt-2.log) composed and verified
  the 1×1 case, then stopped before reversal because the driver passed
  `trackId` to `revert_change`, whose input refused it without a write. The
  owned scratch track held exactly the composed container; it was deleted
  after that inspection, and the track list and selection matched the
  baseline ([cleanup](../data/p01-compose-live/attempt-2/025-cleanup.json)).
- [Attempt 3](../data/p01-compose-live/attempt-3/) passed every case below,
  cleanup and preservation.

## Results (attempt 3)

| Case | Compose ms / turns | Revert ms / turns | Observed chains |
|---|---:|---:|---|
| 1×1 native | 2,601 / 81 | 1,543 / 53 | One: Tool |
| 3×2 native | 4,294 / 93 | 1,682 / 53 | A, B, C: Tool, EQ-5 |
| Mixed: Tool, TX16Wx VST3, TX16Wx CLAP, FX Layer preset (6 units) | 2,753 / 81 | 1,605 / 53 | Mixed: four devices in order |
| Polysynth with one outer LFO route (identity check) | 3,915 / 110 | 1,607 / 53 | Mod: Polysynth |
| Existing move + copy at position 0 | 5,625 / 169 | 2,519 / 82 | Moved: Gate, Tool; Copied: EQ-5 |
| Six chains at position 18 | 13,742 / 133 | 2,840 / 53 | Chain 0–5: Tool |

The mixed case reads only names; TX16Wx's two formats share a display name,
and their identities came from `resolve_device_name`
([E351](e351-device-name-resolution-live.md)). Reversal of new sources is one
owned container removal at 53 turns regardless of size; the existing case
adds one extraction and one reorder.

Times are single samples on one fixture, not stable bounds. The remaining
cost is mostly adapter work outside the engine: in the six-chain case,
21 `chain.observe` calls took 5.6 s, mostly per-rename container reads, and
the six renames ran as six batches (1.1 s). The six chain insertions took
2.2 s, including a scope aim at position 18 for each. Those per-operation
adapter checks are the next D65 candidates.

## Preservation

The scratch track was deleted. All eleven original tracks and each track's
complete `read_devices` structure matched the baseline, and the selection
(`gn-sel`, mixer index 8, no Launcher slot) was restored. No playback ran
and no project was saved.

Reproduce the table and the method attribution offline:

```sh
python3 context/evidence/data/p01-compose-live/summarize.py
```
