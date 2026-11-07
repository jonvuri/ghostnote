---
title: E373 — Ordered direct layer insertion waits for device arrival
kind: evidence
updated: 2026-10-29
owner: P01
---

# E373 — Ordered direct layer insertion waits for device arrival

**Positive for ordered insertion into one layer per request.** The P01 v2
probe preserved requested order for native triples in two empty layers,
appends to populated layers, and a mixed native/VST3/CLAP/preset request in
the sixth layer of a container at position 17. It waits for the preceding
source's device-count observer before issuing the next end insertion; it
does not read the inserted contents between setters. The independent final
device-bank readback confirmed order, names and enabled state.

This supersedes [E372](e372-direct-chain-insertion-ordering.md)'s negative
immediate-loop result only for the count-dependent route tested here. It is
not yet a product composition implementation, multi-target batch proof,
reversal measurement or D44 budget change.

## Session and route

Bitwig 6.1.4 / API 25, project `gn-scale-test`. The operator replied
“Controller replaced”; the [reply](../data/p01-chain-insert-live/v2/operator.json)
and [handshake](../data/p01-chain-insert-live/v2/hello.log) establish fresh
initialization `2026-10-29T19:14:50.094Z`, profile `phase-8-probe-v1`,
122 methods / `d7fb35cd5e6566ba`, marker `p01-chain-insert-v2`.
The [archive](../data/p01-chain-insert-live/v2/deployment.json) SHA-256 is
`444593bc252aa79528a356d3cf8ffda8f1babc7279bf5135f0fad2e87d322003`.

The driver checked project, selected identities, scratch ownership and
competing clients before writes. Only this session's idle MCP server,
PID 58395, remained connected beside the single foreground driver.
Owned scratch `gn-p01-insert`, ID `861ef956-3d59-4a4a-8fea-c65a1d6c591d`,
held seventeen Tools and an FX Layer seed, expanded to six explicitly named
layers. No playback launch or project save ran.

V2 validates the entire source list and expected track/container/layer
identity before writing. Inside the held layer window it waits for the
caller-supplied initial count plus prior attempts. It submits each source
once and schedules the next dependency check. No content inventory is read
between sources. The last setter needs no next-object dependency wait;
the caller performs the independent readback. Pending receipts still require
inspection, and partial exceptions or missing intermediate landings prevent
further insertions without replaying an earlier setter.

## Results

| Case | Layer index | Starting devices | Requested additions, in order | Final devices | Receipt ms | Count polls |
|---|---:|---:|---|---:|---:|---:|
| Native, empty | 0 | 0 | Tool, EQ-5, Gate | 3 | 283 | 6 |
| Native append | 0 | 3 | EQ-5, Tool | 5 | 235 | 4 |
| Native, second empty layer | 4 | 0 | Tool, EQ-5, Gate | 3 | 283 | 6 |
| Mixed sources, sixth layer | 5 | 0 | Tool, TX16Wx VST3, TX16Wx CLAP, FX Layer preset | 4 | 404 | 8 |
| Sixth-layer append | 5 | 4 | EQ-5, Gate | 6 | 308 | 4 |

Every final order matched. Existing prefixes and all other public device
structure stayed unchanged, including explicitly assigned layer names.
Layer/device banks restored to zero. The fixture crosses the top-level
sixteen-device window, the five-layer window and the four-device child window.

These are single diagnostic samples, not stable latency bounds. Receipt
times exclude the independent readback, target preflight, fixture creation
and cleanup. The [summary](../data/p01-chain-insert-live/v2/summary.json)
reports the separate public readback time and wire turns. They are not
end-to-end `compose_devices` measurements.

The resolver refreshed the native IDs and TX16Wx identities from installed
host sources. Name-only readback cannot distinguish the two TX16Wx formats;
format inputs and dispatch are distinct, with separate source evidence in
[E351](e351-device-name-resolution-live.md) and E372. The preset check proves
insertion and name, not complete nested state fidelity.

## Preservation and verification

The scratch track was deleted. All eleven original track records and each
track's complete public device structure matched the baseline. Mixer
selection remained `gn-sel`, index 8, ID
`6fb96670-abde-4958-9147-f573a4b43918`; no Launcher slot was selected.
The [final result](../data/p01-chain-insert-live/v2/attempt-1/093-result.json)
records closed scopes, 99 aims, zero refusals, no write block and no pending
insertion receipt before cleanup. No exact saved-file or unobserved-parameter
preservation claim is made.

Offline host-model tests cover delayed count delivery, same-chain append,
wrong initial count, missing landing, complete-request validation, stale
identities, page restoration, no-op receipts, partial exceptions and queued
write refusal after failed restoration. Extension checks, typecheck and all
56 wire tests passed before deployment. The
[driver](../../../brain/src/probes/p01-chain-insert-live.ts) and
[raw run](../data/p01-chain-insert-live/v2/attempt-1/) retain source order,
receipts, independent reads and preservation comparisons.

Reproduce the measurement summary offline:

```sh
python3 context/evidence/data/p01-chain-insert-live/v2/summarize.py
```

For product integration, preserve whole-input validation, target identity,
selection protection, arrival dependencies, no replay after uncertainty and
one final independent result read. Remove the research-only scratch gate and
receipt acknowledgement only as part of that tested integration; do not call
this probe from a normal tool. The composition checkpoint/reversal contract
and D44 remeasurement remain P01 work.
