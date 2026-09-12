---
title: E101 — plug-in preset files have two direct routes
kind: evidence
state: active
updated: 2026-09-12
parent: ../../plan/dogfooding/d03-generic-plugin-preset-loading-spike.md
---

# E101 — plug-in preset files have two direct routes

## Verdict

Bitwig 6.0.6 and controller API 25 loaded two plug-in preset file formats through
`InsertionPoint.insertFile` on this machine:

- VSTPRESET loaded from indexed and unindexed paths.
- H2P loaded only from its indexed preset-library path.

FXP did not load from the tested indexed or unindexed path. The only local FXB
was an internal Kilohearts resource bank, not a safe user fixture. FXB stays
`unproved`.

The popup route could not establish a safe transaction. The popup reported nine
content types, including `Plug-in Presets`, but all three index-write forms left
the selected index at `0` and its name empty. No popup preset was committed.
This is an API 25 result on this host. It is not a claim about manual browser use.

## Environment and baseline

- Host: Bitwig Studio 6.0.6.
- Controller API: 25.
- Project: a disposable `New 2` project for each cold route.
- Baseline: `Inst 1`, `Audio 2`, `FX 1`, and `Master`; eight launcher rows.
- Final fresh-project channel ids:
  `72354049-f3ef-4442-bbea-eb6d0c022201`,
  `92669dad-77b8-4a8e-8c41-4f784a09ab1b`,
  `3ebea5bc-62e5-4014-8f3d-2e6590903c26`, and
  `e1e5378c-8c1c-4e5a-bacc-19f88844bef0`.

Each route recorded its own entry ids. Each cleanup restored the exact entry
names, positions, types, and ids. The retained music projects were not used.

## Local preset-root inventory

The scan covered `~/Library/Audio/Presets`, `/Library/Audio/Presets`, and
`~/Documents/Bitwig Studio/Library/Presets`. Every observed suffix appears once
below. Counts are file counts, not unique presets.

| Class | Suffix and count |
|---|---|
| Documented Bitwig file | `bwpreset` 41; `fxp` 329; `h2p` 99,635; `vstpreset` 22 |
| Host-external content or metadata | `7z` 1; no suffix 13; `aif` 20; `aupreset` 8; `bak` 3; `bak0` 3; `chord` 2; `cpr` 8; `ds_store` 40; `flac` 4,747; `jpg` 70; `json` 1; `mid` 11; `mmp` 1; `mp3` 241; `mp4` 1; `nfo` 2; `nksf` 3,543; `ogg` 481; `pdf` 97; `png` 1,989; `psd` 1; `rtf` 9; `sfz` 140; `ttf` 3; `tun` 4,467; `txt` 120; `uhe-soundset` 2; `wav` 601; `xml` 683; `zip` 187 |
| Unknown or unproved vendor format | ` scaletype1` 1; `fxs` 3; `hympe` 12; `hystplfo2` 3; `hystplfo3` 4; `kelvin` 381; `midifxharm` 12; `midifxrack` 1; `midifxscale` 39; `midifxscale2` 41; `scaletype1` 40; `scaletype2` 1; `serumfx` 163; `serumfxrack` 57; `serummidimap` 1; `serumpreset` 626; `serumstyle` 18; `uhm` 27; `vpreset` 294; `vs` 3; `xferarp` 12; `xferarpbank` 4; `xferclip` 137; `xferclipbank` 14; `xferfilterpzmulti` 5; `xferfilterpzsingle` 26; `xferpath` 21; `xfershape` 169 |

FXB was absent from these roots. One machine-wide search found
`/Library/Application Support/Kilohearts/HeartCore.core/Contents/Resources/kfat/presets.fxb`.
It is an internal bundled bank and was not sent to Bitwig.

No suffix received a CLAP-discovered classification. The popup could not enter
its plug-in preset view, so it could not prove a suffix-to-CLAP mapping. Its
default device catalog did expose non-u-he entries for Quanta 2, Reflection Step
Rs, sforzando, and TX16Wx.

## Direct matrix

| Format | Exact source | Cold or first result | Warm samples | Copy result | Verdict |
|---|---|---|---|---|---|
| BWP preset control | `brain/fixtures/Sampler/gn_sampler_bare.bwpreset` | 581 ms; not a post-restart cold sample | 460, 457, 455 ms; median 457 ms; range 455–460 ms | Loaded in 456 ms | `direct` control |
| H2P | `~/Library/Audio/Presets/u-he/Repro-5/Zensound/Zensound - Netrunner Repro-5/Presets/ZenSound - Netrunner/KEY Peace Flute.h2p` | 973 ms after a Bitwig restart | 452, 462, 453 ms; median 453 ms; range 452–462 ms | Exact no-op after 12,092 ms | `indexed-direct` |
| FXP | `~/Library/Audio/Presets/u-he/Filterscape/Patchpool - Edgy Scapes/Heavenly Waves var (Straight).fxp` | Exact no-op after 60,050 ms after a Bitwig restart | 8,036, 8,031, 8,137 ms; median 8,036 ms; range 8,031–8,137 ms | Exact no-op after 12,129 ms | `unsupported` |
| VSTPRESET | `/Library/Audio/Presets/Softube/Weiss Compressor Limiter/BK Natural Setup Stereo Linked Ganged.vstpreset` | 1,289 ms after a Bitwig restart | 620, 624, 1,110 ms; median 624 ms; range 620–1,110 ms | Loaded in 613 ms | `direct` |
| FXB | Internal Kilohearts resource bank only | Not run | Not run | Not run | `unproved` |

The successful readback was stable and exact:

| Format | Complete chain | Preset name | Parameters | SHA-256 parameter fingerprint |
|---|---|---|---:|---|
| BWP preset | `Sampler` enabled at position 0 | `gn_sampler_bare` | 32 | `5399c72cad900050c36271bc68945ad9898a850bcd034ef6b7ad9c13c271b44d` |
| H2P | `Repro-5` enabled at position 0 | `KEY Peace Flute` | 131 | `9111eb95a1b38934b22daf836bf8e7cf0efa4322c82bde4abc6189494bfda9fe` |
| VSTPRESET | `Weiss Compressor Limiter` enabled at position 0 | `BK Natural Setup Stereo Linked Ganged` | 48 | `41334c00a1443f3d4af7351e0ddce7c1f7119959c5a3f731465ca0ecde122b05` |

The H2P fixture also loaded on an owned Effect track in 445 ms. It produced the
same device, preset name, 131 parameters, and fingerprint. Bitwig therefore does
not treat that top-level track type as incompatible with an instrument preset.

Missing paths and byte-identical files with a `.wrong` suffix were exact no-ops.
The probe did not report success from silence. It removed every loaded device
and every owned track.

## Popup matrix

The same blocker applies to H2P, FXP, VSTPRESET, and non-u-he CLAP preset
discovery. Each receives a popup verdict of `unsupported by the safe API 25
transaction`. No load timing exists because no route reached a valid preset
selection state.

The popup reported these content types:

`Devices`, `Plug-ins`, `Bitwig Presets`, `Plug-in Presets`, `Samples`,
`Multisamples`, `Music`, `Impulses`, and `Wavetables`.

The probe tried `selectedContentTypeIndex().set(3)` before open, the same write
after open, and a relative `inc(3)` after open. Each attempt left the reported
index at `0` and `selectedContentTypeName()` empty. The view stayed at 95,756
mixed results. The device filter did not exist, and no exact path or durable id
was available. An exact-name commit from that state would be unsafe.

Audition control and cancellation did work. One interference control captured a
stable guard, selected the `Bass` category, and tried to commit with the stale
guard. The extension refused `popup browser state changed before commit`. The
popup remained open for cancellation, and the owned chain stayed empty.

## Product direction

Add an append-only `plugin-preset-file` source with a versioned registry. Start
with two independent entries:

- `vstpreset`: direct path loading, including an unindexed path;
- `h2p`: indexed direct loading, with the index prerequisite explicit.

Keep `.bwpreset` separate because it can hold complete Bitwig structure. Do not
add FXP, FXB, proprietary vendor suffixes, or a popup operation. Do not replace an
existing device. A silent host no-op must remain a failed receipt.

## Retrospective

The initial probe treated an indexed-only result and an Effect-track load as
failures. A pure route-classification helper and host-normalized context readback
now prevent those assumptions. Future probes must encode every allowed verdict
before the first live run.
