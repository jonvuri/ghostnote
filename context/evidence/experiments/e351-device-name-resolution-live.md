---
title: E351 — Device and preset names resolve from the host configuration and insert live
kind: evidence
state: active
updated: 2026-10-25
owner: V14
---

# E351 — Device and preset names resolve from the host configuration and insert live

## Verdict

**Positive for all four source kinds on Bitwig 6.1.4.** The public tool
`resolve_device_name` resolved a stock device, a VST3 plug-in, a CLAP plug-in,
and a Bitwig preset in a newly added sound-content location from the running
host's configuration, with no Bitwig call and no browser popup. Each identity
fed the existing `add_devices` route unchanged, and each insertion was read
back independently. Configuration refresh, ambiguity, explicit disambiguation,
and cleanup all passed in one Ghostnote session without a Bitwig or Ghostnote
restart. The operator approved the live plan with "I approve the live plan,
proceed."

| Case | Resolved identity | Live outcome | Independent evidence |
|---|---|---|---|
| Stock device `Polymer` | UUID `8f58138b-03aa-4e9d-83bd-a038c99a4ed5` from `device-settings` | Inserted at position 0, name `Polymer` | `read_devices` after the write |
| VST3 `TX16Wx` (`sourceKind: vst3`) | `C4D8BD1A074B1188285DC2AA09B619A4`, `/Library/Audio/Plug-Ins/VST3/TX16Wx.vst3`, CWITEC 3.7.0n | Inserted at position 1, name `TX16Wx`, 128 DirectParameters | The plug-in host (PID 362) mapped `TX16Wx.vst3/Contents/MacOS/TX16Wx` only after this insertion; no TX16Wx bundle was loaded before |
| CLAP `TX16Wx` (`sourceKind: clap`) | `com.cwitec.TX16Wx`, `/Library/Audio/Plug-Ins/CLAP/TX16Wx.clap` | Inserted at position 2, name `TX16Wx`, 128 DirectParameters | The plug-in host mapped `TX16Wx.clap/Contents/MacOS/TX16Wx` only after this insertion, beside the VST3 binary |
| Preset `gn-v14-custom-layer` under a new sound-content location | `/Users/jonvuri/Development/ghostnote/.tmp/v14-sound-content/gn-v14-custom-layer.bwpreset`, contained device Instrument Layer, SHA-256 `b953135a…bb1f5` equal to the staged copy of `brain/fixtures/InstrumentLayer/gn_layer_4chain.bwpreset` | Inserted at position 3; moved to position 0 with `move_devices` so its chains were observable | `read_devices`: layer chains Phase-4, Polysynth, Organ, Sampler, each holding the device of its name, the structure established for that fixture beforehand |

The VST3 and CLAP cases used the same product so that format disambiguation
was exercised. `resolve_device_name` for `TX16Wx` without `sourceKind`
returned `ambiguous` with both candidates and `data.next` naming the
`sourceKind` and `root` values that separate them; no insertion ran from that
result. Each explicit `sourceKind` call returned `resolved` with one candidate.

## Configuration refresh

1. Before the location existed, `gn-v14-custom-layer` was `not-found` with
   complete coverage; the prefs file hashed `aadcfdce…b829b`.
2. The operator added `.tmp/v14-sound-content` in Settings > Locations >
   Sound Content Locations ("Added that directory"). The next call read a
   changed prefs file (`0e5e1795…1be56`), listed the sound-content root as
   configured with automatic updates, scanned one entry, and resolved the
   preset. No directory was passed to the tool.
3. After insertion, the operator removed the row ("Sound content row
   removed"). The next call read the baseline prefs hash again, listed no
   sound-content root, and returned `not-found` with complete coverage.

The `resolved` result also carried `liveHostVersion: 6.1.4`: the running
application version from `Info.plist` agreed with the cached extension
handshake. The first calls of the session ran before any handshake was cached
and warned `host-version-unverified`; the tool now takes one revision mark in
that case.

## Admission and coverage

Every call reported admission `pinned`: the jar SHA-256
`5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f` is the
traced 6.1.4 build, the prefs decoded, all eight configured plug-in locations
had an index state file, every present index decoded (358 and 17 VST3 entries,
31 and 1 CLAP entries), and all 152 stock devices decoded. Coverage was
complete on every call: 45 presets under My Library, 5,240 under the package
directory, and a bounded bundle check at the root and one directory below it
for each plug-in location. The six VST3 bundles without an index entry
(`Console 1`, `Darkglass Ultra`, `Seventh Heaven Professional`,
`Soundtoys/SpaceBlender`, `soothe2`, `spiff`) carry a recorded load failure in
Bitwig's VST3 metadata cache and are reported as exclusions, not as gaps.

## Cost

| Path | Measured |
|---|---|
| Resolution, all kinds, warm cache | 36–41 ms (presets 29–34 ms, indexes 6–7 ms); 13 cache hits, 0 misses |
| Resolution, first call or changed prefs | 166–205 ms (native 22–28 ms, indexes 21–46 ms, presets 115–162 ms) |
| Resolution, one kind (`vst3`) | 4 ms |
| Host context (`ps` and `plutil`) | 59–375 ms per call, outside the resolution time |
| `add_devices`: stock, VST3, CLAP, preset | 1,547; 1,019; 999; 1,123 ms |
| `move_devices`, one device to position 0 | 1,096 ms |
| `read_devices` on the scratch track | 451–714 ms |

Bitwig calls by `resolve_device_name`: zero. No popup appeared. These are
single live measurements on one machine, not a stable bound.

## Preservation and cleanup

- Project `gn-scale-test`, 11 tracks and 10 scenes before and after. The
  scratch track `gn-v14` (`98a5c07a-aacf-4561-b0b0-cc3986f4e7c9`) was deleted
  with everything on it; `list_tracks` then listed the original 11 tracks with
  unchanged IDs, names, kinds, and positions. The neighbouring four-chain
  track `gn-lay4` read back unchanged.
- No competing Ghostnote driver or probe client ran. Bitwig's four
  `plugin-states` files were unchanged in count throughout.
- The temporary directory and preset copy were removed after the location was
  removed and the device deleted. No Bitwig location, index, prefs, or cache
  file was written by Ghostnote.
- The accepted V01 project was not opened.

## Offline verification

32 focused tests cover the prefs decoder (Unicode and spaced paths, disabled
updates, every truncation, unknown wire types, duplicate fields, trailing
bytes, package defaults), the index decoder (both formats and architectures,
every interior truncation, unknown headers and records, bad references,
unbalanced trees, unsafe paths, deleted records, the captured 6.1.4 fixtures
under `brain/fixtures/discovery/6.1.4/`), host discovery (process list,
environment values with spaces, the settings-directory override, every
refusal), and the resolver and tool on a synthetic host tree (stock devices,
format ambiguity and disambiguation by kind and root, stale and foreign-
architecture entries, recorded load failures, unindexed bundles, preset
resolution under My Library, packages, and an added then removed sound-content
root, duplicate preset names, unavailable roots, unreadable presets, a missing
prefs file, an undecodable index, a validated unknown jar, a changed
bundle, an unindexed bundle beside an indexed one in a vendor directory,
missing index state files, and one file under two overlapping content roots).
The full brain check passes with 2,533 tests, and the description artifact is
v54 (46 tools).

## Limits

- macOS only: host discovery reads `ps` and `plutil`. Other platforms refuse
  with `unsupported-platform`.
- VST2 indexes and vendor preset formats (D22) are not decoded. The stock
  device and Bitwig preset index preambles stay undecoded; those sources are
  read from their files, which costs the preset scan on every call.
- A plug-in claim is about Bitwig's index, the inventory `add_devices` can
  insert from. The bundle freshness check covers the root and one directory
  below it: an unindexed bundle there makes the scope incomplete; deeper
  directories are counted in the scope's `bundleCheck.unscannedDirectories`
  and not searched, and a plug-in installed there is found once Bitwig
  indexes it. Without any index state file for the configured plug-in
  locations, no plug-in scope claims uniqueness or absence.
- Preset state fidelity was verified by chain structure (four named layer
  chains and their devices), not by parameter values or byte equality.
- Identity and format of the plug-in insertions rest on the host-loaded bundle
  paths and the read-back names; Bitwig's public API exposes no plug-in id on
  a device.
- The resolver reads the host's own files; it cannot see a location added but
  not yet saved to the prefs file, or an index Bitwig has not finished writing.
