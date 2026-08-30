---
id: E90
kind: evidence
state: active
source: phase-5-session-5o-late-bound-container-modulation
---

# E90 — FX Layer late binding is live [K] (2026-08-29)

**Verdict: an outer FX Layer modulator can target an initially empty device
position and becomes active when an existing native or VST3 device moves into
that position. Chain and Instrument Layer do not support the same lifecycle.**

## Passing recipe

Layer containers use this internal route topology:

`CONTENTS/CHAIN_LIST/CHAIN0/DEVICE_CHAIN/0:<device parameter route>`

The host keeps this route while `CHAIN0` is empty. The probe loads the container,
confirms its outer `LFO` page, and moves an existing device into `Layer 1` without
reloading the container.

The human-authored seed is
`brain/fixtures/FXLayer/gn_latebound_fx_layer.bwpreset`. Its manifest records:

| Fact | Value |
|---|---|
| SHA-256 | `fdc1f2d64132d8aabe277c090e052b9a6dfb76ba3c80e1c9e0a1748c60e71f50` |
| Bytes | 6,687 |
| Source | Bitwig Studio 6.0.6, creator `jrajav` |
| Target | `CHAIN0`, device position 0; live name `Layer 1` |
| Initial state | Empty entry and empty outer modulator list |
| External files | None |
| Sample reference stubs | 0 |

The integrity test checks the exact hash, size, host metadata, container GUID,
outer-list offset, empty entry, and external-reference facts. No Bitwig bundled
preset is shipped.

## Live matrix

The final Bitwig Studio 6.0.6 run used the promoted seed and passed:

- Polysynth kept its name, enabled state, all 55 DirectParameter rows, and base
  fingerprint. Filter Frequency diverged by `0.0036184870685435078`.
- Zebra3 VST3 kept its name, enabled state, all 2,185 DirectParameter rows, and
  base fingerprint. Cutoff diverged by `0.492003858089447`.
- A Polysynth route to device position 1 stayed inactive after the device moved
  to position 0.
- Base values did not move. Every automation witness was false.
- Cleanup removed the owned track and restored the exact five-track entry list.

The generated live files had no packaged files or reference stubs. They were
temporary and were deleted after the run.

## Unsupported shapes

- Chain exposes `CHAIN` only as a selected device slot. An empty slot cannot be
  selected. The guarded move refuses before mutation and leaves the two
  top-level devices unchanged.
- An empty Instrument Layer has no addressable entry. The bounded placeholder
  fallback makes the route active on the placeholder, but the host binds it to
  that instance. The moved replacement keeps its complete observed state, but
  the route becomes inactive. The fallback leaves no residue.

Session 5p must use FX Layer. It must not generalize this lifecycle to Chain or
Instrument Layer.

## Verification

- `npm run check`: 927/927 pass.
- `./gradlew test`: passes from `extension/`.
- `npm run probe:hello`: the 149-method contract, Bitwig 6.0.6 API 25, exact
  five-track baseline, and deployment freshness pass.
- `npm run probe:phase5o-late-bound`: all supported, negative, unsupported, and
  exact-cleanup rows pass against the promoted asset.

## Retrospective

Inspect the container object topology before writing a route. Display names do
not describe layer-container route segments. Bind both mutation endpoints to
the same cursor track.
