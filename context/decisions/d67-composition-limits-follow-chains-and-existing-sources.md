---
id: D67
kind: decision
state: active
updated: 2026-11-07
source: P01
---

# D67 — Composition limits follow layer chains and existing sources

## Source and scope

[D44](d44-long-writes-are-optimized-then-bounded.md) bounds each long write
so that its measured worst case and its revert take at most 30 s. Its
`compose_devices` row (6 device units, 4 modulators) was measured on the
per-stage route of E252. P01 replaced that route with direct chain
insertion and one final readback ([D65](d65-proved-routes-run-with-one-readback.md),
[E406](../evidence/experiments/e406-d65-direct-composition-live.md)) and then
reduced the adapter's per-operation checks
([E407](../evidence/experiments/e407-p01-adapter-checks-and-d44-live.md)).
This decision replaces D44's `compose_devices` row; D44's rule and its other
limits are unchanged.

## Rule

`compose_devices` admits:

| Limit | Value | Worst measured case at the limit (E407) |
|---|---|---|
| Layer chains | 8 | 8 chains of two native devices at position 18: 13.7 s, revert 2.8 s |
| Device units | 16: a new native or preset source is 1; a VST3, CLAP or existing source is 2; a device with modulators or modulator edits is 2 more | 8 existing sources into 8 chains at position 18: 25.6 s, revert 13.7 s |
| Modulators and modulator edits | 4 (unchanged) | 4 Polysynths with one outer LFO each: 6.6 s, revert 1.7 s |

A larger request refuses before any read or write with `outside-limit`, as
D44 requires; the tool description and the `layerChains` schema text state
both limits.

## Why

After D65, device units are cheap: one direct insertion places all new
devices of a chain, so 4×4 native took 3.8 s and 16 plug-in units 3.5 s.
Two things still grow with the request:

- **Layer chains beyond the five-chain seed.** Each is a host duplication,
  named and read back before the next. It slows as the container grows:
  16 one-device chains at position 18 took 38.1 s, above the budget. Eight
  chains (three duplications) took 13.3–13.7 s at 16 units.
- **Existing sources.** Each move or copy is its own relocation stage with
  its own readings. At one unit each, 16 existing sources would be admitted
  unmeasured; at two units the limit admits 8, measured at 25.6 s.

A separate chain limit keeps the unit weights simple and states the cost
the agent can see. Offline authoring of a larger seed would remove the
duplications; that is not done, so the chain limit stays until it is.
