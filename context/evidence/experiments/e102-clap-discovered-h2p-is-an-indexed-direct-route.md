---
title: E102 — CLAP-discovered H2P is an indexed direct route
kind: evidence
state: active
updated: 2026-09-12
parent: ../../plan/dogfooding/d03b-clap-discovered-preset-boundary-spike.md
---

# E102 — CLAP-discovered H2P is an indexed direct route

## Verdict

Filesystem-backed CLAP preset discovery is feasible through the existing direct
file insertion route. It is not a separate preset-file format.

Bitwig loaded indexed H2P files into Repro-5 and Diva. These devices are
installed only as CLAP plug-ins on this machine. Each unindexed copy was an
exact no-op. Bitwig must know the source through its preset discovery index.

This does not prove a complete route for all CLAP presets. Controller API 25
does not expose the CLAP discovery provider, its load keys, or plug-in-contained
presets. Its supported popup API also cannot select the plug-in preset view on
this host.

## Static evidence

The installed Repro and Diva devices exist only under
`/Library/Audio/Plug-Ins/CLAP`. No matching VST or Audio Unit bundle is
installed.

The Repro and Diva CLAP binaries advertise both standard extensions:

- `clap.preset-discovery-factory/2`
- `clap.preset-load/2`

Bitwig's CLAP device-id index contains `com.u-he.Repro-5` and `com.u-he.Diva`.
Its preset discovery indexes contain the exact `KEY Peace Flute.h2p` and
`Red Planet.h2p` names.

The official CLAP [preset discovery](https://github.com/free-audio/clap/blob/main/include/clap/factory/preset-discovery.h)
and [preset load](https://github.com/free-audio/clap/blob/main/include/clap/ext/preset-load.h)
headers assign these roles to the host and plug-in. Discovery lets the host
index native preset files and metadata. Preset load lets the host send the
discovered location and load key to a plug-in instance. The standard does not
require one common file suffix.

This machine has 18 installed CLAP executables. Thirteen advertise preset
discovery, and all thirteen are u-he devices. There is no installed non-u-he
provider for a portability control.

## Live direct results

| Device | Indexed source | Cold | Warm samples | Unindexed copy | Stable readback |
|---|---|---:|---:|---|---|
| Repro-5 | `KEY Peace Flute.h2p` | 973 ms | 452, 462, 453 ms | No-op | 131 parameters; `9111eb95a1b38934b22daf836bf8e7cf0efa4322c82bde4abc6189494bfda9fe` |
| Diva | `Red Planet.h2p` | 687 ms | 454, 451, 452 ms | No-op | 281 parameters; `89aed6138629d16dac60fc3259e789ef467476bbbaf787e9a8531c4a6c28887c` |

The Diva controls for a missing file and wrong suffix were exact no-ops. The
live run restored the exact four-track entry baseline.

## Controller boundary

The old device preset observer and indexed-load methods are not a fallback.
They compile, but Bitwig rejects the controller at startup because the methods
have been deprecated since API version 2.

The supported replacement insertion point opened `Select replacement content`.
It exposed 598 plug-in devices, including the system CLAP locations. It did not
expose a device preset filter. The selected content type remained unnamed at
index `0`. The content-type setter and the `select_next_tab` action had no
effect. The `show_presets_for_device` action resolved by name but opened no
observable popup browser.

Therefore, Ghostnote can load a known indexed filesystem preset by absolute
path. It cannot safely discover or select an arbitrary CLAP preset by name.
Plug-in-contained discovery locations also have no controller route.

## Product implication

Do not add an unrestricted `CLAP preset` source. First run the boundary spike.
It must determine the measured registry, the supported native suffixes, and the
proof required to identify the created CLAP device. It must keep three cases
separate:

- indexed filesystem presets with a proved direct route;
- unindexed native files that Bitwig ignores;
- plug-in-contained presets that the controller cannot address.

## Retrospective

Check installed plug-in formats before classifying a preset route. That one
check proved that both successful H2P loads created CLAP instances.
