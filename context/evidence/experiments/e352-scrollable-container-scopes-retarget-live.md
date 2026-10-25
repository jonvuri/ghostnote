---
title: E352 — A layer bank hung off a scrolled one-wide device bank retargets within one wire round trip
kind: evidence
state: active
updated: 2026-10-25
owner: B08
---

# E352 — A layer bank hung off a scrolled one-wide device bank retargets within one wire round trip

## Verdict

**Go for the B08 scrollable-scope implementation.** On Bitwig 6.1.4 (API 25),
a `DeviceLayerBank` and its per-layer `DeviceBank`s hung off the single slot of
a one-wide `DeviceBank` on cursor track 0 retargeted to the container at the
requested top-level position every time that bank was scrolled, including to
position 3, which the product reports as `layerChains: outside-limit`. The
complete identity (slot name, chain count, chain names, nested device counts
and names) was correct on the first read after every scroll, at 0 ms wait, in
6 of 6 trials at each of the five fixed waits and in all 8 polled trials.
The nested chain and device windows scroll as the API text says, with
`itemCount` reporting the total. A solo written through a scrolled scope read
back through an independent scope at the same position and through the cursor
route, and was cleared again. Two scopes aimed at two containers read correctly
in one reply.

| Question (brief) | Outcome |
|---|---|
| 1. Retarget of a hung layer bank after a device-bank scroll | Observed: zero mismatches against the baseline structure read while the same container sat at position 0 |
| 2. Settle cost | Within one status round trip: polled first-correct 22.2 to 24.7 ms (median 23.0 ms); a status call alone takes 23 to 25 ms; 6/6 correct at 0, 25, 50, 100, and 200 ms |
| 3. Out-of-range scroll | Clamped to `itemCount - 1`; `canScrollForwards` false there and `canScrollBackwards` false at 0 |
| 4. Nested windows | Layer window moved over 5 chains and device window over 4 devices; `itemCount` total; over-range requests clamp |
| 5. Write through a scrolled scope with independent readback | Observed through a second scrolled scope and through `devcursor.selectAt` plus `layer.list`; restored and re-read |
| Guard fails closed | Not demonstrable here: the scope had settled by the next request, so the 0 ms write was accepted and landed on the requested chain. The refusal path is covered offline only |

## Setup

- Bitwig 6.1.4, `/Applications/Bitwig Studio.app`, jar SHA-256
  `5c2b1895…2469f` as in NOW. Probe profile `phase-8-probe-v1`, 120 methods,
  hash `eee07e622b789114`, fresh initialization at `2026-10-25T19:57:56.040Z`,
  `npm run probe:hello` all pass including the new marker
  `b08-scope-scroll-v1` with both scopes `held`.
- Project `gn-scale-test`, generation `34d8410e-3738-4d98-84b6-288e23572333`.
  Scratch track `gn-b08` (`a80fa3af-aa8d-4824-bdc3-30a9802dc72d`) built with
  the product tools under the normal build before the controller replacement:

| Position | Device | Chains |
|---|---|---|
| 0 | FX Layer | A1 [Distortion], A2 [Tremolo] |
| 1 | Dual Pan | |
| 2 | Ring-Mod | |
| 3 | Instrument Layer | B1 [Tool, Blur, Delay-1, Bit-8], B2 [Gate], B3 [EQ-5], B4 [EQ-2], B5 [Peak Limiter] |

  The five-chain container was composed at position 0 and read there through
  the fixed scope ([baseline](../data/b08-scope-scroll/baseline-b-at-position-0.json)),
  then two devices were moved ahead of it. `read_devices` afterwards reported
  position 3 as `layerChains: "outside-limit"`, the product condition B08
  addresses. A first attempt to compose the resting container as a second
  Instrument Layer failed at the position-container stage because two
  top-level devices named `Instrument Layer` cannot be told apart by a
  readback; it was reverted and the resting container was composed as an FX
  Layer.
- Probe: `probe.scopeScroll` in `ScopeScrollProbe.java`, allocated only in
  the probe profile. Two scopes, each `cursorTracks[0].createDeviceBank(1)`
  with a layer bank of width 3 and per-layer device banks of width 2, all
  marked at init. The windows are deliberately narrower than the product's
  5 and 4 so that compose-built content (at most 5 chains and 6 device
  units per call) already needs nested scrolling; the brief's six-chain and
  five-device shapes were not built. Operations: `status`, `scroll`,
  `scrollLayers`, `scrollDevices`, and `setSolo`; scrolls and the write
  require a `gn-b08` track and the identified track ID.
- Driver: `npm run probe:b08-scope` ([lib](../../../brain/src/probes/b08-scope-scroll-lib.ts)),
  offline-tested against a lagging, an immediate, and a non-retargeting host
  model. Records: [attempt 1](../data/b08-scope-scroll/attempt-1/), 32 files,
  driver total 9.9 s. Expectation: [expect.json](../data/b08-scope-scroll/expect.json).

## Observations

### Retarget (question 1)

The first scroll of scope 0 from 0 to 3 read the complete identity of the
Instrument Layer 43.3 ms after the scroll request (the first poll). The
status read ([004](../data/b08-scope-scroll/attempt-1/004-q1-status.json))
shows scope 0 at `scrollPosition` 3, `itemCount` 4, `canScrollForwards`
false, slot `Instrument Layer` with `position` 3 and `hasLayers` true, layer
bank `itemCount` 5 with window rows B1 (4 devices: Tool, Blur visible), B2
(Gate), B3 (EQ-5). Scope 1, resting at 0, read FX Layer with A1 [Distortion]
and A2 [Tremolo] in the same reply. These match the baseline read of the
same container at position 0 field for field.

### Settle (question 2)

| Fixed wait after scroll | Correct complete identity |
|---|---|
| 0 ms | 6/6 |
| 25 ms | 6/6 |
| 50 ms | 6/6 |
| 100 ms | 6/6 |
| 200 ms | 6/6 |

Polled trials (alternating positions 0 and 3, 5 ms poll interval): first
complete read at 23.0, 24.3, 22.2, 22.8, 22.9, 22.5, 23.9, 24.7 ms; the
slot-name-only latency was identical in every trial. Ten standalone `status`
calls took 3.8 ms then 22.9 to 25.1 ms each, so the polled latency is one
round trip of the status read itself. Within this method the retarget has no
measurable settle window; compare the 100 ms cursor re-point across tracks in
[containers §6](../capability/containers.md#6-addressing-and-cursor-descent).
The status reply is large (two scopes, three layers, six nested devices, the
16-wide reference bank), so a narrower product read would bound it lower.

### Clamping (question 3)

A scroll to 40 on a four-device track reported `scrollPosition` 3,
`canScrollForwards` false, slot `Instrument Layer` at position 3. The explicit
scroll to 3 read the same; the scroll to 0 reported `canScrollBackwards` false.
The probe's guard compares the requested position with the reported one, so a
clamped request refuses a write by design.

### Nested windows (question 4)

- Layer bank (width 3, 5 chains): `scrollLayers` to 2 reported
  `scrollPosition` 2, `itemCount` 5, window B3, B4, B5, `canScrollForwards`
  false. A request of 10 clamped to 2.
- Device bank of B1 (width 2, 4 devices): `scrollDevices` to 2 reported
  `scrollPosition` 2, `itemCount` 4, window Delay-1 (position 2), Bit-8
  (position 3).

### Guarded write and independent readback (question 5)

`setSolo` through scope 0 at position 3, window index 1, expected container
`Instrument Layer` and chain `B2`: receipt `chainChannelId`
`819b9360-d089-413b-ac07-ab739376bd37`, `previousSolo` false. 300 ms later
scope 1, scrolled independently to 3, read B1 false, B2 true, B3 false; the
cursor route (`devcursor.selectAt` 3, `layer.list`) read B2 true and B1, B3,
B4, B5 false. The restore read false on both routes. The device cursor was
returned to position 0.

### Guard timing

Immediately after a scroll from 3 to 0, a `setSolo` on A1 (value false, the
current value) was accepted in 29.4 ms and its receipt named FX Layer and A1:
the hung bank had already settled before the next request was processed. No
stale state was observable at wire granularity, so this session could not
show the refusal path live. The guard still compares the requested position,
the reported position, the reference bank's name at that position, and the
chain name; the refusal branches are covered by the offline host models.

### Simultaneity and cleanup

One status read with scope 0 at 3 (Instrument Layer, five chains) and scope 1
at 0 (FX Layer, two chains) matched both expectations. At exit both scopes
rested at 0 with probe sequence 89, every visible chain read solo false, and
the wire read 12 tracks, the four-device order unchanged, A1 and A2 solo
false through the fixed scope, the device cursor on FX Layer at 0, and the
mixer selection on `gn-sel`.

## Operational observation

After the replacement to the probe build, the three running Ghostnote MCP
server processes kept established sockets to port 8686 that no longer
answered (`revision.get` timed out at 10 s on four product tool calls over
several minutes), while a fresh `BridgeClient` answered `ping`,
`revision.get`, and `contract.hello` in about 25 ms. After the replacement
back to the normal build, the same MCP server answered again without a
reconnect (`/mcp reconnect` was unavailable in the session). The failure is
therefore tied to a replacement and clears on the next one; its cause is not
established. Run product tools after a replacement only once a probe or a
connection check answers, and expect a reconnect or a second replacement to
be needed.

## Implications for the implementation

- The mechanism is sound: a scope can be a one-wide bank scrolled to the
  requested position, with the nested windows scrolled the same way. The
  permanently observed handle count stays at the scope count times the window
  sizes.
- Identity must not rest on the slot name: two containers of one kind share a
  name (`Instrument Layer`), as the failed composition stage also showed. The
  guard needs the requested position, the reported position, the reference
  bank's name at that position, and the chain name, and a clamped request
  must refuse.
- The retarget costs about one wire round trip, so a container read at
  position 3 or later should cost the fixed-scope read plus one scroll
  request; resting positions 0 to 2 need no scroll. Re-measure the
  `containerScope` ledger row during implementation.
- `coverage` should report window size, `scrollPosition`, and `itemCount` so
  partial windows stay explicit.

## Preservation and reproduction

The normal `ghostnote` archive was deployed with `copyExtension` (SHA-256
`ae998a5d238b34665243523c48c4dd073d7cc82dd3e5d872525e7ea0051f7524`; it now
carries the probe class, with the normal profile unchanged at 92 methods, hash
`8be1975eaa99d78f`). The operator replaced the controller; `probe:hello`
passed with fresh initialization at `2026-10-25T20:05:43.639Z`.
`delete_track` removed `gn-b08` (change `695feb39-c340-4181-8bd3-7cce01edba34`,
no mixer-selection warning). `list_tracks` then listed the original 11 tracks
with unchanged IDs, `read_devices` on `gn-lay4` read the four-chain structure
(Phase-4, Polysynth, Organ, Sampler) unchanged, and the mixer selection
remained on `gn-sel`. No scratch object, solo flag, or popup remains. No
full note-content, device-state, or saved-file equality is claimed.

Reproduce with the probe build loaded, a `gn-b08` scratch track of the shape
above, and:

```
npm run probe:hello
npm run probe:b08-scope -- --project gn-scale-test --generation <generation> \
  --track-id <trackId> --expect context/evidence/data/b08-scope-scroll/expect.json \
  --out <new directory>
```
