---
title: E348 — Native browser results expose device IDs and Bitwig preset paths
kind: evidence
state: active
updated: 2026-10-25
---

# E348 — Native browser results expose device IDs and Bitwig preset paths

## Verdict

The [E347](e347-filter-driven-native-browser-discovery.md) API discovery route
can be paired with read-only internal result metadata on the pinned Bitwig
6.1.4 build. The samples yield stock-device UUIDs, VST3 class IDs, CLAP IDs,
and exact user-library `.bwpreset` paths. Independent local sources agree
with all 60 sampled supported identities: 16 native, 16 VST3, 12 CLAP, and
16 Bitwig presets. No device or preset was inserted.

This is a positive research route verdict, not an implemented public resolver
or exhaustive library census. The [R05 brief](../../work/r05-browser-name-resolution.md#proposed-minimal-resolver-contract)
defines the proposed contract and remaining implementation boundaries.

| Kind | Observed native class / field | Example | Independent check |
|---|---|---|---|
| Native device | `zi`, `zj.MRY` UUID | Polysynth: `a9ffacb5-33e9-4fc7-8621-b1af31e410ef` | All 16 UUIDs equal the existing catalog's exact-name entries |
| VST3 device | `LT`, `LU.MRY` string | Addictive Drums 2: `ABCDEF019182FAEB786C6E4178414432` | All 16 IDs occur in Bitwig's VST3 metadata cache; installed bundle paths exist |
| CLAP device | `Am`, `Ao.MRY` string | Diva: `com.u-he.Diva` | All 12 IDs occur in Bitwig's CLAP metadata cache; installed bundle paths exist |
| Bitwig preset | `zz`, root + `CN.fJR` + `CN.iHb` | `Library/Presets/Polysynth/gn-preset-zoo.bwpreset` | All 16 files exist and parse; META device IDs equal their browser device-ID fields |

For presets, `zA.MRY` identifies the contained device type, **not the preset**.
The exact file path is the preset identity. For example, `gn-preset-zoo`
contains Polysynth's UUID. Treating that UUID as a preset ID would merge
unrelated presets.

The displayed name can include an architecture suffix such as `[X64]` while
`CN.iHb` retains the unsuffixed name. Plug-in samples include vendor,
architecture, version, bundle path, and source kind. Do not silently strip
suffixes or merge formats when resolving an exact request.

## Admission and method

- Operator reply: “Controller replaced”.
- `npm run probe:hello`: all pass; API 25, `phase-8-probe-v1`, 119 methods,
  `9e75b9a8b3938491`, browser `r05-browser-discovery-v4`, Grid `9b-grid-doctor-v21`.
- Archive `6f345a38d7d733ea0386922c8624386341409ecc5a753660bb7a570a59c13a97`,
  deployed `2026-10-25T16:41:43.469Z`; initialization
  `2026-10-25T16:42:43.034Z`.
- Project `gn-scale-test`, generation `bc80f651-5d72-4a9d-893b-b8ccdbd56125`.
  Transport stopped; entry mixer selection `gn-sel`.
- No competing probe driver observed. Existing connected MCP client PID 84650
  was left alone; one foreground driver ran each attempt.
- Host jar SHA-256 `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`.

The metadata reader checks the jar hash, queues through the proxy's `exec`,
verifies document-thread execution, and obtains native targets with `getTarget`.
It reads shallow scalar fields through the `CN` base and the library root
`CN.TtY -> EX.eLY` File field. It invokes no native search/path getter and
performs no native mutation. Target references remain identical within each
sample; independent public snapshots confirm unchanged result names, indices,
filters, counts, ownership, and context across completion. Reads are bounded
to 16 objects, 16 inheritance levels, and 96 examined fields per object.

Static bytecode supports the identity interpretations: `zi.uWE()` constructs a
native device descriptor from its UUID; `LT.dEI()` and `Am.dEI()` construct
VST3 and CLAP descriptors respectively from their ID/version fields. `CN`
holds the relative/name strings; `CH.Grk()` combines them through its library
root. These symbols are build-specific. No internal method was invoked merely
because its return type looked suitable.

## Live observations

Attempt 5 repeated the three proved location conditions with native samples:

- Devices: 46 names, complete; first 16 metadata rows are native devices.
- Plug-ins: 128 of 92,018 names; first 12 metadata rows are `LG` VST2 devices,
  followed by four `Ix` rows not classified for the product. The initial
  Addictive Drums 2 result is a `.vst` bundle with a numeric VST2 ID, not a
  VST3 result. This makes source-kind disambiguation necessary.
- My Library: 40 names, complete; first 16 metadata rows are `zz` Bitwig presets.

After inspecting successful cleanup, attempt 6 selected more specific locations
using a bounded 256-entry observed prefix of the 1,466-entry location bank:

| Location / observed index | Result names | Metadata sample | Exact requested match |
|---|---:|---:|---|
| System VST 3 Plug-ins / 121 | 49, complete | first 16 | Addictive Drums 2 at index 0, one exact name in this scope |
| System CLAP Plug-ins / 128 | 12, complete | all 12 | Diva at index 1, one exact name in this scope |

Location names were unique in the observed prefix, not proved unique across
the full hierarchy. The Instrument selection read back in every condition,
but did not further change these counts. Native metadata includes an AUDIO
Chain entry in Devices, so selection readback alone must not be treated as
proof of a strictly instrument-only result set. Both attempts used the same
admitted v4 extension; only the research driver's location conditions changed.

No new timing claim is made. Waits remain 1,000 ms for open/reset and 180 ms
plus 80 ms between independent reads for other operations.

## Independent identity checks

The reproducible [audit](../data/r05-browser/identity-audit.mjs) reads the frozen
samples and writes [identity-checks.json](../data/r05-browser/identity-checks.json).
It records source-cache/catalog hashes and per-result evidence. It verifies:

- exact native names and UUIDs against `brain/assets/native-devices/catalog.json`;
- VST3 IDs against `~/Library/Caches/Bitwig/vst3-metadata-arm64-11` and CLAP IDs
  against `~/Library/Caches/Bitwig/clap-metadata-13`, plus installed bundle paths;
- reconstructed `.bwpreset` files with `readMeta`, comparing contained device
  IDs and recording file hashes and sizes.

The discovery driver deliberately retains `identity=unproved` in its raw
verdict; the subsequent independent audit supplies the sampled identity claim
in this record.

Cache membership is an independent ID cross-check, not a complete cache-schema
parser or load test. Only sampled preset paths and plug-in IDs are accepted as
observed identities here. Separate arbitrary configured library roots, untested
result classes, complete metadata for the other 33 VST3 results, and exhaustive
cross-format duplicate resolution remain outside this sample.

## Preservation and reproduction

Scratch tracks `5818fddd-4036-49e8-8ea3-d8ee9a0eac3f` (attempt 5) and
`663911ca-daf7-49b0-b984-a0ab8ddb8b6e` (attempt 6) were removed. Both popups
read back closed/unowned. Both before/after inventories match: 11 original
tracks, 10 scenes, 110 slot occupancy reads (25 filled), 16 top-level devices,
and mixer fields. Mixer selection returned to `gn-sel`; transport stayed
stopped. No full note-content, device-state, or saved-file equality is claimed.

- Attempt 5: [handshake](../data/r05-browser/attempt-5/hello.log),
  [events](../data/r05-browser/attempt-5/events.jsonl),
  [result](../data/r05-browser/attempt-5/result.json),
  [before](../data/r05-browser/attempt-5/before.json),
  [after](../data/r05-browser/attempt-5/after.json), frozen
  [session](../data/r05-browser/attempt-5/session.mjs) and
  [sequence](../data/r05-browser/attempt-5/discovery-driver.ts).
- Attempt 6: [events](../data/r05-browser/attempt-6/events.jsonl),
  [result](../data/r05-browser/attempt-6/result.json),
  [before](../data/r05-browser/attempt-6/before.json),
  [after](../data/r05-browser/attempt-6/after.json), frozen
  [session](../data/r05-browser/attempt-6/session.mjs) and
  [sequence](../data/r05-browser/attempt-6/discovery-driver.ts).

Original commands from `brain/`, with new output directories:

```sh
node --import tsx ../context/evidence/data/r05-browser/session.mjs gn-scale-test bc80f651-5d72-4a9d-893b-b8ccdbd56125 ../context/evidence/data/r05-browser/attempt-5
node --import tsx ../context/evidence/data/r05-browser/session.mjs gn-scale-test bc80f651-5d72-4a9d-893b-b8ccdbd56125 ../context/evidence/data/r05-browser/attempt-6 plugins
node --import tsx ../context/evidence/data/r05-browser/identity-audit.mjs
```

Use frozen sequences for these exact conditions and fresh admission for any
future live attempt. R05 research now has a positive route verdict and a
proposed minimal resolver contract; no additional live write is required by
this record. D22 continues to exclude vendor-preset loading.
