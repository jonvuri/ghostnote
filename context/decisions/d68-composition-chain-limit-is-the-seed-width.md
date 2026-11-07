---
id: D68
kind: decision
state: active
updated: 2026-11-07
source: P01
---

# D68 — The composition chain limit is the seed width

## Source and scope

[D67](d67-composition-limits-follow-chains-and-existing-sources.md) limits
`compose_devices` to 8 layer chains because each chain beyond the
five-chain seed was a host duplication, and 16 chains took 38.1 s
([E407](../evidence/experiments/e407-p01-adapter-checks-and-d44-live.md)).
[E409](../evidence/experiments/e409-p01-named-sixteen-chain-seed-live.md)
replaces that seed with a human-saved 16-chain seed whose chains carry the
requested names, so no chain is grown or renamed live. This decision
replaces D67's layer-chain row. D67's device-unit and modulator rows, and
D44's rule, are unchanged.

## Rule

`compose_devices` admits at most **16 layer chains**, the width of the
seed. The worst measured case at the limit is 16 one-device native chains at
position 18: 10.9 s, revert 3.5 s (E409). A larger request refuses before
any read or write with `outside-limit`; the tool description and the
`layerChains` schema text state the limit.

The seed is also the product asset that
[D3](d3-library-shape-settled-and-built-2026-07-24.md)'s library policy
requires for a wider template: human-saved, with its provenance and exact
facts in the seed manifest. A composition writes every requested chain name
into its private copy, ASCII as single bytes and any other name as UTF-16
([E410](../evidence/experiments/e410-p01-unicode-chain-names-in-the-seed.md));
only a name with a lone surrogate is set by the live rename stage.

## Why

- Every chain is now present when the container is inserted, so the chain
  count adds only one direct insertion per chain (about 0.5 s at position
  18), not a duplication that slows as the container grows.
- Every chain holds at least one device, so the 16-unit limit already
  bounds a composition to 16 chains. A chain limit equal to the seed width
  states the host fact; a request above it would need live growth again.
- The worst admitted case remains 8 existing sources (E408: 17.0 s, revert
  12.0 s), under D44's 30 s budget.
