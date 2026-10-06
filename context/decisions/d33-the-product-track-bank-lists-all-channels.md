---
id: D33
kind: decision
state: active
updated: 2026-10-06
source: phase-8h4a
---

# D33 — The product track bank lists all channels **[SETTLED 2026-10-06]**

The product rig applies the `ALL_CHANNELS` track-bank content filter by
default (`RigConfig.contentFilter`). A track inside a collapsed group stays in
the flat bank, keeps its `channelId`, and counts toward the bank window
(standing rule 5). `rig.json` can still set another filter, or `""` for no
filter. `rig.info` reports the applied filter, and `probe:hello` checks it.

## Why

[E16](../evidence/experiments/e16-rows-d-g-a-b-by-mute-is-audibly-correct-but-duplication-glitches.md)
measured that the default filter (`ALL_VISIBLE_CHANNELS`) removes the children
of a collapsed group from the bank. Each child then reads as a deleted track,
also while it still plays. `ALL_CHANNELS` keeps them. The product rig set no
filter. E221–E223 measured groups, collapse, and 512 channels with
`ALL_CHANNELS` in a research rig config, so their results did not hold for the
product. [E234](../evidence/experiments/e234-write-boundary-and-reader-hardening.md)
found the gap and measured the new default.

## Consequences

- The children of a collapsed group are listed. In E234 both children listed,
  and row 0 of each read and checked `current`.
- The E221 collapsed-child binding limit stays. A clip read of a row other
  than 0 on a collapsed child refuses with `bound-target-mismatch`
  (`AddressUnresolvedError`) and returns no content. Expand the group to read
  those rows.
- `gn-scale-test` lists 11 tracks, not 10: `gn-E16` inside the collapsed
  `Group 5` is now visible. The ten earlier track IDs are unchanged. The anchor
  baseline is `phase8h4a-boundary/baseline-final.json`.
