---
title: Devices — type UUIDs, parameters and observables
kind: capability
state: active
updated: 2026-08-22
scope: device identification, parameter access and the observable surface
evidence: E4, E4b, E4c, E4d, E12, E16l, E55–E64; D2; reference/BitX
---

# Devices

> **Provenance.** Each claim carries `[K]` known, `[I]` inferred or `[U]`
> unknown, and cites its E-number or names its observer and date. Read the four
> rules in [INDEX.md](INDEX.md) before you edit this page.

A device has **no runtime identity**. It is identified by *type* through a UUID,
and located by position within a chain. See [identity](identity.md) for what
follows from that.

---

## 1. Native device type UUIDs

A type UUID is *which model of device*, never *which instance* [K, [E16l](../experiments/e16l-object-identity-settled-properly-is-the-only-one-and-there-is-no.md)]. It is
accepted by `InsertionPoint.insertBitwigDevice(UUID)`,
`Device.createSpecificBitwigDevice(UUID)` and
`ControllerHost.createBitwigDeviceMatcher(UUID)`.

### Confirmed by a live load in this project — `[K]`

The generated Bitwig 6.0.6 catalog contains all 151 native device UUIDs and
structured names. Its source fingerprint and live resolution state are in
`brain/assets/native-devices/catalog.json` [K,
[E56](../experiments/e56-native-device-catalog-is-reproducible-and-resolved.md)].

| Device | UUID | Where |
|---|---|---|
| Polysynth | `a9ffacb5-33e9-4fc7-8621-b1af31e410ef` | generated catalog and E56 |
| Instrument Layer | `5024be2e-65d6-4d40-bbfe-8b2ea993c445` | `Rig.java:126` |
| Instrument Selector | `9588fbcf-721a-438b-8555-97e4231f7d2c` | `Rig.java:127` |
| FX Layer | `a0913b7f-096b-4ac9-bddd-33c775314b42` | `brain/src/probes/e17ai-typedrebuild.ts:55` and the conformance suite |

⚠ The Instrument Selector UUID above is **also** the one `reference/BitX` carries,
independently transcribed. Two sources agree and ghostnote has loaded it live.

### Transcribed from `reference/BitX` — `[I]`, not yet live-loaded here

| Device | UUID | BitX source |
|---|---|---|
| Instrument Selector | `9588fbcf-721a-438b-8555-97e4231f7d2c` | `BitXExtension.java:152` — ⚠ **`[K]` here**, see above |
| FX Selector | `956e396b-07c5-4430-a58d-8dcfc316522a` | `BitXExtension.java:158` |
| Channel Filter | `c5a1bb2d-a589-4fda-b3cf-911cfd6297be` | `BitXExtension.java:164` |
| Note Filter | `ef7559c8-49ae-4657-95be-11abb896c969` | `BitXExtension.java:171` |
| Note Transpose | `0815cd9e-3a31-4429-a268-dabd952a3b68` | `BitXExtension.java:178` |
| MIDI Program Change | `429c7dcb-6863-48bc-becc-508463841e3b` | `BitXExtension.java:187` |
| Drum Machine | `8ea97e45-0255-40fd-bc7e-94419741e9d1` | `BitXExtension.java:631` |

⚠ **These stay `[I]` until each is confirmed by a live load.** They are
transcribed from a third party, and [D2](../../decisions/d2-host-capability-tiers-tier-1-settled-tier-2-tier-1-stub-relocati.md)'s standing rule is to confirm a new host or preset with
a live load test.

⚠⚠ **The FX Selector entry is weaker than the other six.** BitX's own source
comments it *"FX Selector (FX Rack) – replace with correct UUID yourself"*
(`BitXExtension.java:157`). Treat it as a lead, not as data.

**Probe that would raise all seven to `[K]`:** insert each UUID with
`insertBitwigDevice`, then read the resulting device name back. Drum Machine is
independently corroborated — E4c records the same UUID from the app bundle
harvest [K, [E4c](../experiments/e4c-device-nesting-layers-pads-slots-selectors-2026-07-19.md)].

---

## 2. Parameter access — two APIs, chosen by role

| | `createParameter` (typed) | `DirectParameter` |
|---|---|---|
| Devices | VST2 / VST3 / Bitwig | **any, including CLAP** |
| Discovery | IDs known upfront | **self-enumerates every ID** |
| Access | pull, `get()` | push, observers set at init |
| Displayed values | ● `displayedValue()`, e.g. "2.59 kHz" | ◐ the observer did not populate |
| Write | `setImmediately` | `setDirectParameterValueNormalized(id, v, 1)` |

[K, [E4](../experiments/e4-direct-parameter-layer-6a-differentiator-2026-07-19.md) and [E4b](../experiments/e4b-clap-params-via-the-directparameter-api-2026-07-19.md)]

⚠⚠ **`param.value().set(v)` is silently swallowed** by the controller take-over
strategy. Every agent parameter write must use `setImmediately` [K, E4].

⚠ With `DirectParameter`, pass `resolution=1`. `resolution=128` did not take
within 1.5 s [K, E4b].

⚠ A `SpecificBitwigDevice` view is **device-type-specific**. Point a Polysynth
view at a Polymer and every handle reports `exists=false`. A parameter pool
therefore carries one view per device type you support deeply [K, E4].

⚠ **Pin the track cursor, not the device cursor.** A device cursor's `isPinned`
is subordinate to its track cursor, so the robust hold is a pinned track cursor
plus `selectDevice(index)` [K, E4].

### Product DirectParameter route

The product serializes DirectParameter work through one device cursor. Each
generation detours through another confirmed track before it clears prior IDs
and values. The return confirms the target device-bank track, device position,
device name, track pin, and device pin. Two equal consecutive inventories must
agree in the current generation [K,
[E55](../experiments/e55-direct-parameter-core-is-live.md)].

The live Sampler returned 32 unique named parameters. `Pitch Transpose` moved
from `0.5` to `0.55`, independent readback agreed, and exact replay restored
`0.5` [K, E55]. Missing, unreachable, and unstable results stay separate. A
stable device or container remains readable without `params` when only the
parameter observer is unstable [K, E55].

### Explicit VST3 and CLAP sources

The product keeps VST3 class UIDs and CLAP IDs as separate source types. It
validates each identifier before the insertion frame. A missing plugin that
does not change the chain returns a failed receipt and no minted device [K,
[E57](../experiments/e57-vst3-and-clap-parameter-control-is-live.md)].

On this machine, Zebra3 VST3 exposed 2,185 named DirectParameters and Zebra3
CLAP exposed 2,193. `Attack Rate` moved from `0.5` to `0.55` and restored to
`0.5` on each format. Observer inventories settled in 1,238 ms for VST3 and
1,470 ms for CLAP. These installed-plugin counts and timings are machine-
specific [K, E57].

### Public MCP surface

Six registered tools expose complete top-level inspection, DirectParameter and
optional remote-control inventory, explicit insertion, scalar writes, bypass,
and directed deletion. Each result states positional, bank, normalized-value,
latency, warning, verification, and reversal limits [K,
[E62](../experiments/e62-public-device-surface-is-live.md)].

The live public route returned 55 Polysynth parameters without prior ids. A
returned id wrote and restored one scalar base exactly. Native, VST3, CLAP, and
preset insertion passed with exact cleanup. VST3 and CLAP insertion took 1,728
and 1,729 ms [K, E62].

E63 records one accepted natural sound-design task. The general inventory was
sufficient for Chorus+ and Reverb. No device-specific view was needed. The
operator kept a colder revision after A/B comparison [K,
[E63](../experiments/e63-device-dogfood-exposes-ab-selection-gap.md)].

### Managed top-level chains

The product composes native, VST3, CLAP, and preset insertion with parameter
and device enabled-state writes. It appends each device, accepts a complete
chain observation, and uses the observed minted address for dependent work. A
requested earlier position uses the proven relocation primitive before a
confirmed anchor [K,
[E59](../experiments/e59-managed-fx-chain-is-live.md)].

Every managed mutation carries the prior accepted complete device-name and
enabled-state sequences. The adapter refuses an incomplete or full bank before
insertion. It also refuses any structure or scalar write when either sequence
changed. A fresh read at the write cannot replace the caller-owned expected
boundary [K, E59].

A managed checkpoint stores mint provenance and the current address from each
accepted observation. Reversal restores entry enabled state and deletes owned
devices from the highest current position to the lowest. A device that existed
before the take is never deleted by automatic reversal. Such deletion remains
`none` because its opaque state cannot be recreated [K, E59].

⚠ The complete name-and-enabled sequence is a fingerprint, not identity. It
detects many positional changes. It cannot detect replacement by a different
device with the same name and enabled state [K, E59 and E16l].

### Final performance and closeout

The final matrix passed every E61 budget. Native inventory took 2,964 ms.
Native replay took 4,606 ms. Complete VST3 and CLAP workloads took 11,431 and
12,586 ms. Depth-2 replay took 7,177 ms. Remote inventory and replay took 1,357
and 8,219 ms. Managed construction stayed below 50 seconds, and reversal stayed
below 16.5 seconds [K,
[E64](../experiments/e64-phase-4-closes-with-saved-device-baseline.md)].

The saved accepted chain is `Key Filter+ → Repro-5 → Chorus+ → Reverb`. Fresh
stable inventories confirmed all nine retained Chorus+ and Reverb values after
the complete scratch matrix. Cleanup restored seven tracks, 14 clips, the exact
entry selection, and no launcher residue [K, E64].

### `SpecificBitwigDevice` is a two-method interface

Verified against the resolved `extension-api:25:sources` jar,
`SpecificBitwigDevice.java`:

```java
Parameter createParameter(String id);              // :16
IntegerValue createIntegerOutputValue(String id);  // :21
```

That is the entire surface. There is no `createBoolParameter` and no
`createEnumParameter`. ⚠ The interface itself is `@since API 12`
[K, source read, 2026-08-15].

⚠ `[U]` **`createIntegerOutputValue` has no known use.** Neither ghostnote nor
BitX calls it. Its javadoc says it reads "a certain output value of the device",
and which ids are valid is undocumented. **Probe:** call it on a Polysynth with
each harvested ID token and record which ones resolve.

---

## 3. Parameter IDs

### Generated route — offline, from the app bundle

```
cd brain
npm run catalog:native -- --bitwig-app-root "/Applications/Bitwig Studio.app"
```

The command requires an explicit application root. It reads structured META
names, UUIDs, and the Bitwig version. It verifies the stream UUID and writes a
sorted, schema-versioned asset. It excludes VST, module, and modulator settings.
The Bitwig 6.0.6 asset contains 151 devices, 2,047 scalar candidates, and 636
separate object tokens [K, E56].

Four scalar class and value shapes separate candidates from named object tokens.
This rejects section markers such as `CONTENTS`, `MODULATORS`, and `FAKE1`
without a live check. Structured META names also avoid the 12-character
control-byte trap [K, E56].

Live DirectParameter IDs use `CONTENTS/<candidate>`. The resolver removes only
this exact prefix. Polysynth resolved 55 of 56 candidates. Sampler resolved 32
of 33. `GLIDE_TIME` was the only unresolved candidate for each device. Neither
device returned a live-only ID [K, E56].

### Known ID maps

**Polysynth — `[K]`**, generated from the catalog and resolved live 55/56.
`NativeDeviceCatalog.java` contains the 55 resolved typed IDs. All 55 typed
handles exist and report the available display, base value, modulated value,
automation, origin, and discrete metadata. The unresolved `GLIDE_TIME`
candidate is not generated [K, E56].

**Mined from `reference/BitX` — `[I]`**, undocumented and otherwise only
discoverable by guessing. Directly relevant to Phase 4:

| Device | Parameter IDs | BitX source |
|---|---|---|
| Note Filter | `MIN_KEY`, `MAX_KEY` | `BitXExtension.java:564-565` |
| Note Transpose | `OCTAVES`, `COARSE`, `FINE` | `BitXExtension.java:583-585` |
| MIDI Program Change | `PROGRAM`, `BANK_MSB`, `BANK_LSB`, `CHANNEL` | `BitXExtension.java:607-610` |
| Channel Filter | `SELECT_CHANNEL_1` … `SELECT_CHANNEL_16` | `BitXExtension.java:550` |

**Probe that would raise these to `[K]`:** insert each device, create the
`SpecificBitwigDevice` view, call `createParameter(id)`, and assert `exists()`.

---

## 4. The observable surface

`Device` declares roughly 80 members. Ghostnote marks a small subset, and that
subset is a **deliberate budget**, not an oversight — every `markInterested()`
costs a subscription for the life of the session.

### What ghostnote marks today — `[K]`, source read 2026-08-22

| Bank | Per-`Device` marks |
|---|---|
| `cursorDeviceBanks[i]` (`Rig.java:738`) | `exists()`, `name()`, **`isEnabled()`** |
| `cursorDeviceBanks[0]` slots 0-1 (`Rig.java:832`) | the above, plus **`hasLayers()`** |
| `layerDeviceBanks[l]` (`Rig.java:812`) | `exists()`, `name()` |
| `slotLayerDeviceBanks[s][l]` (`Rig.java:858`) | `exists()`, `name()` |

⚠ **A shorter reading of this was in circulation and is wrong:** *"only
`exists()` and `name()` are marked, at `Rig.java:728`"*. `hasLayers()` is marked
too, on `cursorDeviceBanks[0]` slots 0-1. And the **chain**-level surface is much
wider than the device-level one: `slotLayerBanks[s]` marks `exists`, `name`,
`solo`, `mute`, `volume`, `pan`, `color` and `channelId` on each `DeviceLayer`
(`Rig.java:799-815`). Read the loop you care about, not the first one.

### What the API also offers and ghostnote does not mark — `[K]`

Read from the resolved `extension-api:25:sources` jar, 2026-08-15. `Device.java`
holds **81 declarations, of which 38 are `@Deprecated`** — so 43 live members,
and every one of these is among them. See [host-api](host-api.md) §1 for how to
resolve and read that source.

| Member | `Device.java` line |
|---|---|
| `presetName()` | 393 |
| `presetCategory()`, `presetCreator()` | 416, 439 |
| `deviceType()` | 915 |
| `isPlugin()` | 239 |
| `position()` | 48 |
| `sampleName()` | 830 |
| `slotNames()`, `hasSlots()` | 614, 607 |
| `isNested()`, `hasDrumPads()` | 643, 659 |

⚠⚠ **State the limit honestly: these are fingerprint fields, not identity.** They
would **narrow** the duplicate-name restoration gap that session 3f-g had to fail
closed on. They would not **close** it. Two devices of the same type, the same
preset and the same name remain indistinguishable, and `position()` is the very
thing a move changes. Adopting them is Phase 4 or a 3f successor, not a
correctness fix for 3f-g.

---

## 5. Device structure verbs

| Verb | Result |
|---|---|
| `InsertionPoint.insertBitwigDevice(UUID)` | ● ~144 ms |
| `InsertionPoint.insertFile(preset)` | ● a 12-pad Drum Machine in 268 ms |
| `InsertionPoint.moveDevices` | ● relocates, and the device keeps its state |
| `InsertionPoint.copyDevices` | ● works into a layer chain, from top level and from a nested source |
| `Device.duplicateObject()` on a container | ● clones **with** contents |
| `Device.deleteObject()` | ● |
| `Device.isEnabled().set(...)` | ● exact scalar write after independent readback |
| `DrumPad.insertionPoint()` | ● filling an empty pad **creates** the chain |

[K, [E4d](../experiments/e4d-chain-creation-e4c-s-was-wrong-2026-07-19.md), [E16n/o](../experiments/e16n-e16o-e4d-route-3-is-wrong-relocates-a-device-into-a-layer-and-it.md), [E18c](../experiments/e18c-the-rebuild-strategy-is-mechanically-available-a-device-can-leav.md), [E18d](../experiments/e18d-e4d-route-3-is-a-false-negative-into-a-layer-chain-works-k-2026-.md), and [E59](../experiments/e59-managed-fx-chain-is-live.md)]

⚠ `DeviceLayer` has **no** `insertionPoint()`; `DrumPad` does. That asymmetry is
the architectural reason a drum pad is addressable while empty and a layer chain
is not: an `InsertionPoint` must bind to a referent, and "layer 3" has no
referent until it exists [K, E4d/E4e].

⚠ **`selectFirstInKeyPad(n)` takes a MIDI key, not a pad index.** Key 36 (C1) is
pad 0. Passing `0` silently leaves the cursor where it was. Use
`selectFirstInChannel(drumPadBank.getItemAt(i))` [K, E4d].

⚠ **Inserting into a non-existent layer index is a silent no-op.** So is
`selectFirstInSlot` on an empty slot, and the cursor still looks healthy
afterwards. Verify the cursor target before every write [K, E4c].

---

## 6. Modulation

Modulator topology is not authored through this API. It is authored by tested
`.bwpreset` byte surgery through `bwmod` [K, [E13](../experiments/e13-is-built-the-byte-recipes-are-a-tested-ts-library-green-offline-.md)]. See
[`evidence/format/BWMOD_DESIGN.md`](../format/BWMOD_DESIGN.md) and
[`BWFORMAT_SPEC.md`](../format/BWFORMAT_SPEC.md) for that domain, and
[D2](../../decisions/d2-host-capability-tiers-tier-1-settled-tier-2-tier-1-stub-relocati.md) for the tier gate.

Phase 4 does not author modulator topology. E11e already proves that `bwmod` can
author one indexed cross-device route from a container and that live modulation
results [K,
[E11e](../experiments/e11e-cross-device-routing-works-from-container-modulators-and-is-synt.md)].
Phase 5 owns product integration. It must verify an edit through the exact
remote-control selector and compare base value with `modulatedValue`. Offline
`validate()` predicts a load and does not prove modulation [K, E11e and E64].

---

## Supersession record

| Date | Change |
|---|---|
| 2026-08-22 | E64 adds the final performance matrix, saved accepted chain, exact cleanup, and Phase 5 remote-readback handoff. It also removes the obsolete statement that indexed cross-device modulation is unmeasured; E11e already proved it. |
| 2026-08-22 | E63 records that the general inventory was sufficient for natural Chorus+ and Reverb work. |
| 2026-08-22 | E62 adds the frozen registered MCP device cohort, live budget proof, and exact cleanup. |
| 2026-08-22 | E59 adds readable and writable enabled state, complete name-and-enabled mutation guards, mixed managed construction, current-position reversal, and retryable recovery. |
| 2026-08-22 | E57 adds explicit VST3 and CLAP insertion, parameter write and replay, failed missing-plugin receipts, and exact cleanup. |
| 2026-08-22 | E56 replaces the `strings` harvest and hand-maintained Polysynth list with the generated catalog and live resolution result. |
| 2026-08-22 | E55 adds the confirmed serialized DirectParameter acquisition, write, readback, and replay boundary. |
| 2026-08-15 | Page created. It supersedes the *reading* of E4's "CLAP direct params are not accessible", which E4b already overturned in place. |
| 2026-08-15 | Corrected the marked-observable set: `hasLayers()` is marked too, and the `DeviceLayer` surface is far wider than the `Device` one. §4. |
| 2026-08-15 | Every API declaration re-anchored from the third-party `BitwigAPI25.txt` dump to the `extension-api:25:sources` jar resolved from `maven.bitwig.com`. `Device` is 81 declarations / 43 live, not "~84". §2, §4. |
