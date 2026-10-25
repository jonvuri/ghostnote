---
title: Capability index
kind: index
updated: 2026-10-25
scope: current Bitwig host-API capability, organized by subject
---

# Capability index

These subject pages summarize current host capability findings. Use the
relevant page to find evidence without reading each experiment in sequence.
Dated [experiments](../INDEX.md) retain what each run measured;
[format references](../format/BWFORMAT_SPEC.md) summarize byte-format findings.

## Updating a finding

Update a page when evidence changes its useful interpretation. Cite the source
and state what changed. Keep the dated experiment intact. A separate page or
update is useful when later work needs the finding; each measurement does not
need its own capability update.

Distinguish measured facts, inferences, and unknowns. Existing `[K]`, `[I]`, and
`[U]` tags express that distinction; clear prose can do the same. Give unprobed
observations an observer and date, and state the unresolved question. Name a
new probe when it is needed for selected work. Keep applicable host versions
and limits visible.

A finding that conflicts with a design decision needs an explicit resolution
under the current policy. This can be part of the implementation task. A
capability summary does not silently change the decision or the public contract.

## Pages

| Subject | Verdict | Current statement | Page |
|---|---|---|---|
| Containers | ⚠ ● | Layer chains are the product path. Typed duplication grows a seeded layer. The file composer builds one through four exact entries, and a five-slot observer proves completeness. Typed chain delete still refuses. | [containers](containers.md) |
| Identity | ⚠ ◐ | `Channel.channelId()` is the only runtime object identity in the API. It is durable for a track and re-minted at project load for a chain. A device has none at all. | [identity](identity.md) |
| Devices | ● | Devices use explicit native, VST3, CLAP, or preset sources. Arbitrary named parameters, deep routes, modulator topology, owned composition, bypass, guarded chains, and exact scalar replay are live. The public API has no instance ID. 9a closes in E299: internal Grid reads and bounded native module/cable CRUD, undo, and persistence pass. E298 adds operator-verified audio response and exact restoration. This research result applies to the fixed Poly Grid fixture and pinned build; general Grid authoring and automated DSP proof remain unproved. | [devices](devices.md) |
| Banks | ⚠ ● | A bank window is a hard budget. The Master and the FX returns leave it first, and a create past the ceiling mints a track you can never address. | [banks](banks.md) |
| Named actions | ⚠⚠ ○ | A named action dispatches on primary UI focus, which no observer reports. It is product-banned. Chain create and delete no longer need one. | [actions](actions.md) |
| Launcher clips | ⚠ ● | Notes and measured metadata have typed paths. Binary timing reaches 1/512 beat. Triplet timing reaches 1/768 beat. Long reads and writes page fixed cursor windows. | [clips](clips.md) |
| Host API | ◐ | The API 25 source resolves from Maven with one command, so enumeration is a source read. Plus three mechanisms ghostnote does not use: a type-filtered device bank, process spawn, and OSC. | [host-api](host-api.md) |

## Related

- [Decision index](../../decisions/INDEX.md) — settled design.
- [Evidence index](../INDEX.md) — the dated experiment records these pages read.
- [Project context](../../PROJECT.md) — architecture and stable constraints.
