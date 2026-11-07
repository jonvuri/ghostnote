---
title: E372 — Direct layer insertion works, immediate call order is not reliable
kind: evidence
updated: 2026-10-29
owner: P01
---

# E372 — Direct layer insertion works, immediate call order is not reliable

**Positive for source insertion, negative for promoting immediate multi-source
calls as an ordered composition route.** On Bitwig 6.1.4 / API 25,
`DeviceLayer.endOfDeviceChainInsertionPoint()` inserted native, VST3, CLAP and
preset sources at container position 17 and layer index 5. Independent
device-bank observations confirmed the resulting device names and enabled
state. Several calls in one controller task did not consistently preserve
submission order. Reversing calls is not a general correction.

## Admission and implementation

The operator replied “Controller replaced.” for the deployed `ghostnote probe`
archive; the [reply](../data/p01-chain-insert-live/operator.json),
[deployment](../data/p01-chain-insert-live/deployment.json) and
[successful handshake](../data/p01-chain-insert-live/hello.log) are retained.
Initialization was `2026-10-29T18:59:12.411Z`, profile `phase-8-probe-v1`,
122 methods / `d7fb35cd5e6566ba`, marker `p01-chain-insert-v1`, archive SHA-256
`043a8387c5064da30f78dbf56ba92f173284c5b781ae1c50d046ea3013540f1b`.

The route validates source syntax, scratch track ID/name, container name and
layer ID/name; it leases existing scopes through page acquisition and
restoration. Each call obtains the layer's end insertion point and invokes
the requested public API. Sources in the same request are invoked immediately
in list order. The receipt reports attempts, never verification. A pending
receipt prevents another insertion until independent inspection is
acknowledged; thrown effects and failed restoration have separate latches.

One driver ran at a time. Before writes, it checked `gn-scale-test`, the owned
target, selection and clients. The only other bridge client was this session's
idle MCP server, PID 58395. The scratch track was `gn-p01-insert`,
ID `2ae3fd55-73cd-43a0-8aa6-b042a5558014`, containing seventeen Tools and an
empty FX Layer seed, expanded to six layers by the existing duplicate route.
No playback launch or project save ran.

## Observed ordering

Each row below is a new, deliberately issued insertion, not a retry of a
prior write. Existing prefixes were retained. The first two mismatches stopped
their drivers; both actual effects were inspected independently before their
receipts were acknowledged and the next research case began.

| Case | Starting target | Submitted calls | Observed appended sequence |
|---|---|---|---|
| Attempt 1 | Empty unnamed layer 0 | Tool, EQ-5 | EQ-5, Tool |
| Attempt 2 | Layer 0, now explicitly named, with two devices | EQ-5, Tool (reverse of desired Tool, EQ-5) | EQ-5, Tool |
| Attempt 3, populated forward | Layer 0 with four devices | EQ-5, Tool, Gate | Gate, EQ-5, Tool |
| Attempt 3, empty forward | Explicitly named layer 4 | EQ-5, Tool, Gate | Gate, Tool, EQ-5 |
| Attempt 3, empty reverse | Explicitly named layer 3 | Gate, Tool, EQ-5 | EQ-5, Tool, Gate |
| Attempt 3, sixth forward | Explicitly named layer 5 | EQ-5, Tool, Gate | Gate, Tool, EQ-5 |

The original unnamed layer also adopted its first device's name, `EQ-5`.
The next attempt explicitly named it `P01-0`; subsequent insertions preserved
that name. Product composition should explicitly name chains before inserting
their contents.

Attempt 3 intentionally measured ordering rather than assuming either call
direction would work. It verified the exact inserted population, unchanged
existing prefix, unchanged other observed structure, enabled state, identity,
selection and restored windows before acknowledging each receipt. A matching
population is not an ordered-composition success. The single empty reverse
case is insufficient evidence for a general reversal strategy.

## Source kinds and boundaries

After the three native devices in layer 5, separate single-source requests
appended:

- VST3 TX16Wx, ID `C4D8BD1A074B1188285DC2AA09B619A4`.
- CLAP TX16Wx, ID `com.cwitec.TX16Wx`.
- The repository's empty FX Layer preset, observed as `FX Layer`.

Each landed in the expected append position. The final sixth chain held six
devices, crossing both the five-layer and four-device windows, in a container
beyond the sixteen-device top-level window. All windows restored to zero.
The resolver refreshed identities from the installed host sources. Device
names do not independently distinguish TX16Wx formats; those format claims
rest on resolved inputs and distinct API dispatch, with prior format evidence
in [E351](e351-device-name-resolution-live.md). The preset check establishes
insertion/name, not complete nested preset-state fidelity.

## Cleanup and retained evidence

Attempt 3 completed the bounded research and removed scratch. Its
[final result](../data/p01-chain-insert-live/attempt-3/086-result.json) records
all eleven original track records and complete public device structures
matching the baseline. Mixer selection remained `gn-sel`, index 8,
ID `6fb96670-abde-4958-9147-f573a4b43918`; no Launcher slot was selected.
Exit scopes were closed with 148 aims, zero refusals and no write block.
The probe had no pending receipt before cleanup. Unobserved parameter state
and exact saved-file bytes were not compared.

All three attempts, stopped results and readbacks are retained under
[the data directory](../data/p01-chain-insert-live/). The
[initial driver snapshot](../data/p01-chain-insert-live/driver-v1-initial.ts)
and [inspection/ordering driver snapshot](../data/p01-chain-insert-live/driver-v1-order-inspection.ts)
preserve the v1 research logic; their relative imports assume execution from
`brain/src/probes/`. The second snapshot contains a deliberately bounded
continuation of this scratch ID and receipt, not a reusable resume capability.
Raw exchanges retain the exact calls for each attempt. Reproduce the
[summary](../data/p01-chain-insert-live/summary-v1.json) from the repository root:

```sh
python3 context/evidence/data/p01-chain-insert-live/summarize-v1.py
```

Receipt timings in that summary exclude independent readback and must not be
reported as end-to-end ordered composition latency.

## Consequence

Do not promote v1's immediate multi-source loop or change D44 weights.
The next research build, `p01-chain-insert-v2`, waits for the preceding
insertion's device-count observer before issuing the next end insertion.
This tests an object-arrival dependency, not an intermediate content proof;
one independent content readback remains at the end of the request. The
count-dependent route is only an offline-tested candidate until checked live.
The D55 composition rewrite and its reversal receipt remain unfinished.
