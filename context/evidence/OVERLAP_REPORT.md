---
title: Overlap report — Bitwig agent tooling, October 2026
kind: note
state: active
updated: 2026-10-17
---

# Overlap report — Bitwig agent tooling, October 2026

This report updates the stashed `NITRO_OVERLAP.md` (`stash@{1}`, 2026-09-20).
It compares ghostnote with the closest public projects, both MCP servers and
other tools.

## Summary

ghostnote still leads in device structure, preset modulation, and reversible
writes. Since September, other projects have reduced its lead in deep parameter
access and in `.bwpreset` grammar.

- **Still unique:** modulators and routings on stock devices in a live project
  (`bwmod`), layer chains and nested containers (`compose_devices`), and a
  guarded revert of agent edits.
- **Now matched:** Bitwig Control Deck sets any direct parameter by stable ID
  with readback. Most MCP servers read and write launcher MIDI clips.
- **Partly superseded:** jdormit/bwpreset (2026-10-08) has a full parser and
  serializer for the `0002` object stream. Thus our findings about the absence
  of length prefixes, `f6` re-pointing, and the list sentinel are no longer
  unique. Our load-gate rules, sample-stub relocation, and golden rebuild stay
  unique.
- **Not competitors:** the Nitro work is the DSP layer. Bitwig Superpowers is a
  closed jar patch that adds MIDI and audio tools. Neither touches presets,
  modulation, or agents.
- **Not shipped:** audio capture and analysis (Phase 7d and 7e) work, and a
  live run proved them. They are not tools in the default profile. No other
  project offers them to an agent.

## Compared options

Eight projects overlap with ghostnote. The table orders them by how close the
overlap is.

| Project | Kind | Latest activity found | Scope |
| --- | --- | --- | --- |
| [Bitwig Control Deck](https://github.com/remymazmanian/bitwig-control-deck) | MCP server + extension | listed as maintained, no date | Transport, cue markers, tracks, device insert and delete, direct parameters with readback |
| [jdormit/bwpreset](https://github.com/jdormit/bwpreset) | Python library, CLI, agent skill (MIT) | 2026-10-08 | Offline authoring of Poly, FX, and Note Grid presets, with modulators and remotes |
| [WigAI](https://www.kvraudio.com/forum/viewtopic.php?t=624892) (fabb, csabacsaba fork) | MCP server in extension | fork Nov 2025 | Transport, clips, remote pages, parameters by name, device insert by UUID |
| [daw-mcp](https://github.com/ptaczek/daw-mcp) (ptaczek) | MCP server + extension (MIT) | v1.0.0 | Launcher MIDI clip read and write; no audio, automation, or mixing |
| [bitwig_agent](https://github.com/gatovillano/bitwig_agent) | MCP server + extension | no date shown | Chord and bassline generation, notes, mixer, device insert, `.bwpreset` load by path |
| [acidcat](https://pypi.org/project/acidcat/) | CLI + sample-library MCP | 2.0.1, 2026-10-15 | Reads `.bwpreset` device trees and `.bwclip` notes; the MCP server is for samples only |
| [bitwig-nitro-tools](https://github.com/blakebratcher/bitwig-nitro-tools) | Offline reverse-engineering toolchain | mid-Aug 2026 | Decrypts and decompiles Nitro DSP; loader acceptance of edits is untested |
| [Bitwig Superpowers](https://github.com/kalifrn6-art/bitwig-superpowers) | Closed jar patch | Beta 4.3, 2026-09-27 | MIDI Tools, stems, Audio to MIDI, Capture MIDI, Track Freeze for Bitwig 6.1.1–6.1.3 |

ghostnote: MCP server (`agent-native-v1`, 44 tools, descriptions v52), Java
extension, and the `bwmod` preset library.

## Feature matrices

ghostnote is the only project that has every feature in the device,
modulation, and safety tables. Other projects equal it on clips and on direct
parameters.

Key: ✓ = yes, ◐ = partial or offline only, — = no, ? = not stated in the
project's README or listing. Columns: **gn** ghostnote, **CD** Control Deck,
**bwp** jdormit/bwpreset, **Wig** WigAI fork, **daw** daw-mcp, **agt**
bitwig_agent, **acid** acidcat. A table does not show a project that has no
feature in that table.

### Clips and notes

| Capability | gn | CD | Wig | daw | agt | acid |
| --- | --- | --- | --- | --- | --- | --- |
| Read launcher MIDI clips | ✓ | ? | ✓ | ✓ | ✓ | ◐ `.bwclip` file |
| Write launcher MIDI clips | ✓ | ? | ✓ | ✓ | ✓ | — |
| Arranger clips | — | ✓ from patterns | ? | — | ◐ record | — |
| Versioned clip document, sparse patch, repair on refusal | ✓ | — | — | — | — | — |
| Offline MIDI file read and write | ✓ | — | — | — | — | ✓ convert |
| Built-in chord and bassline generation | — by design | — | — | — | ✓ | — |

### Devices and parameters

| Capability | gn | CD | Wig | agt | bwp |
| --- | --- | --- | --- | --- | --- |
| Insert a device | ✓ | ✓ browser | ✓ UUID | ✓ | ◐ Grid slot, offline |
| Delete a device | ✓ directed | ✓ | — | ? | — |
| Move or copy devices across chains | ✓ | — | — | — | — |
| Layer chains and nested containers | ✓ | — | — | — | — |
| Any direct parameter, past the 8 remote controls | ✓ | ✓ | ◐ by name | ? | — |
| Write checked by readback | ✓ | ✓ | ? | ? | — |
| No dependence on the user's selection | ✓ | ? | ◐ index or selected | ? | — |
| Device enable and bypass | ✓ | ? | ? | ? | — |

### Presets and modulation

| Capability | gn | bwp | agt | acid |
| --- | --- | --- | --- | --- |
| Read preset modulator topology | ✓ | ✓ Grid | — | ◐ device tree |
| Add or edit modulators on stock devices | ✓ | — | — | — |
| Modulators on Grid devices | — | ✓ | — | — |
| Routing target and amount | ✓ | ✓ | — | — |
| Routing mode, scale source, enabled flag | — | ✓ | — | — |
| Grid patch authoring (modules, cables) | — excluded | ✓ | — | — |
| Modulator built from its definition, no donor | — | ✓ | — | — |
| Sampled presets (reference stubs kept valid) | ✓ | ◐ not live-checked | — | — |
| Apply to a device in the live project | ✓ | — file only | ◐ load by path | — |

### Audio and mixer

| Capability | gn | agt | Superpowers |
| --- | --- | --- | --- |
| Mixer volume, pan, mute, solo | ✓ exact dB | ✓ | — |
| Capture master output to a file | ◐ built, not a tool | — | — |
| Loudness, brightness, crest, silence facts | ◐ built, not a tool | — | — |
| Stem separation, Audio to MIDI | — | — | ✓ menu, for people |

### Safety and operations

| Capability | gn | CD |
| --- | --- | --- |
| Readback on every write | ✓ | ✓ parameters |
| Change log and guarded revert of agent edits | ✓ | — |
| Destructive tools separated (D20) | ✓ | ◐ safe delete |
| Selection restored after a write | ✓ | ? |
| Call budgets and a performance ledger | ✓ | — |
| Versioned tool descriptions | ✓ | — |

The other projects state none of these safety features.

### Format reverse engineering

| Capability | gn | bwp | acid | Nitro |
| --- | --- | --- | --- | --- |
| Full parse of the `0002` object stream | ◐ stalls in deep lists | ✓ 21 value types | ◐ read | — |
| Write `0002` | ◐ byte surgery | ✓ full serializer | ? | — |
| Load-gate rules (`0x1a1a`/`0x1a1b`, footprints) | ✓ | ◐ 3-row layout | — | — |
| Decode `0004` definitions | — | ✓ offline jar key | — | ◐ metadata, live JVM |
| Ramona field names | — | — | — | — |
| Nitro DSP decompile | — | — | — | ✓ |
| Live load proof | ✓ Bitwig 6.0.6 | ◐ Poly Grid, 6.1.3 | — | ◐ untested |

## What ghostnote can take

bwpreset (MIT) can close three open `bwmod` limits. We have not tested any of
this on our corpus. The list starts with the best value for the effort.

1. **The complete value-type grammar.** Our spec §3.1 lists 9 types and says
   that `0x02`, `0x06`, and `0x1a` are retired (E11h). bwpreset's `codec.py`
   reads 21 types and treats those three as real: i16, f32, and tagged object.
   It also reads blobs, arrays, maps, refs, and nulls. In a list, it reads
   class 1 as a ref and class 3 as the end. This very likely explains the
   deep-list stall ("type `0x00` desync") and gives a full recursive parse.
2. **Computed footprints.** A full parse can count the objects in a donor
   subtree. This count can replace the fixed per-donor footprint in
   `brain/src/bwmod/donors.ts` and `stubs.ts`. It can possibly also remove the
   donor-specific refusals.
3. **Offline modulator definitions.** `encoding.py` reads a 128-byte key from
   one obfuscated method in `bitwig.jar`, with no JVM. With this key it decodes
   the 43 `.bwmodulator` definitions, which give names, defaults, ranges, and
   enum values. Thus we can possibly make a modulator without a donor file.
   Risk: the obfuscated names (`sYG.HEY` on 6.1.3) change with each build.
4. **More routing fields.** We write target `0x0e3d` and amount `0x0e32`.
   bwpreset also writes mode `0x2C4C` (7 named modes), scale source `0x2D2C`,
   enabled `0x2D3B`, and descriptor `0x1334`. Our field IDs agree with its
   field IDs.
5. **Units and enum names.** It converts some display units, for example cubed
   envelope times and note-number cutoff. The coverage is incomplete, but it is
   a useful start.

Not useful: Grid authoring (Phase 9 still excludes it), and bwpreset's live
evidence, which is weaker than ours. Copied code needs a `NOTICE` entry, as for
daw-mcp.

## Corrections and next steps

Two statements in `context/evidence/format/BWFORMAT_SPEC.md` are now incorrect.
E4 also overstates our parameter lead.

- **§7, "Do not spend effort on `0004`":** bwpreset decodes `0004` definitions
  offline. Also, the rejection of `bitwig-device-hacks` applies to the period
  before `bitwig-nitro-tools`.
- **§3.1, "retired" `0x02`, `0x06`, `0x1a`:** these are probably real value
  types. Confirm this on our corpus before you change E11h.
- **E4, "the genuinely novel capability":** Control Deck also gives direct
  parameters by ID with readback.

Suggested sessions, in this order:

1. Offline grammar spike: run the 21-type grammar on our corpus and fixtures.
   The spike passes if every file parses fully. It fails at any desync.
2. If (1) passes: computed footprints, and a review of the donor refusals.
3. Bounded spike: decode `.bwmodulator` definitions with the jar key on our
   Bitwig version, and test a modulator made without a donor.
4. Add routing mode, scale source, and enabled to `bwmod` and the modulation
   tools. This changes tool descriptions, so bump `TOOL_DESCRIPTION_VERSION`.

The Ramona reflection spike from the September note is still open. One bounded
attempt is still worth it, because no project has the field names.

## Method and limits

- The data comes from web searches on 2026-10-16 and 2026-10-17.
- The report judges each project from its README, listing, and release notes.
  The exception is bwpreset: its docs and parts of its source were read
  (`codec.py`, `encoding.py`, `definitions.py`, `model.py`).
- We ran none of their features. "?" means "not stated", not "absent".
- reddit.com was not searchable. Coverage of r/Bitwig is through secondary
  reports only. Small or unlisted projects can be missing.
- Bitwig has made no public statement about the Nitro work or the jar patches.

## Sources

- [jdormit/bwpreset](https://github.com/jdormit/bwpreset): `docs/completion-status.md`,
  `docs/discovery.md`, `docs/bindings-slots.md`, `docs/verification.md`, `GRID-GAPS.md`
- [Bitwig Control Deck listing](https://glama.ai/mcp/servers/dsol2ohgsm) and
  [repo](https://github.com/remymazmanian/bitwig-control-deck)
- [WigAI KVR thread](https://www.kvraudio.com/forum/viewtopic.php?t=624892)
- [daw-mcp](https://github.com/ptaczek/daw-mcp)
- [bitwig_agent](https://github.com/gatovillano/bitwig_agent)
- [acidcat on PyPI](https://pypi.org/project/acidcat/) and
  [README](https://github.com/hed0rah/acidcat/blob/main/README.md)
- [bitwig-nitro-tools](https://github.com/blakebratcher/bitwig-nitro-tools),
  [polarity.me](https://polarity.me/posts/polarity-music/2026-09-15-bitwig-studio-native-devices-added-by-reverse-engineering/),
  [Sonicstate](https://sonicstate.com/news/2026/09/17/bitwigs-new-native-devices-/),
  [KVR thread](https://www.kvraudio.com/forum/viewtopic.php?p=9304076)
- [Bitwig Superpowers](https://github.com/kalifrn6-art/bitwig-superpowers) and
  [releases](https://github.com/kalifrn6-art/bitwig-superpowers/releases)
- [monody: Bitwig and AI](https://monody.ai/blog/bitwig-ai-workflows)
- Internal: `context/PROJECT.md`, `context/evidence/format/BWFORMAT_SPEC.md`,
  `context/plan/phase-7/7d-audio-facts-and-sensory-packets.md`,
  `context/plan/phase-7/7e-audio-capture-and-analysis-composition.md`, E4, E125,
  E127, `brain/src/bwmod/`
