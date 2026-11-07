---
title: E410 — P01 Unicode chain names written into the composition seed
kind: evidence
updated: 2026-11-07
owner: P01
---

# E410 — P01 Unicode chain names written into the composition seed

**Positive.** Bitwig saves a non-ASCII string as UTF-16BE, with the high bit
of its `u32` length prefix set and the low 31 bits counting UTF-16 code
units. ASCII strings remain one byte per character. `bwmod` now reads and
writes both forms, so `compose_devices` writes any well-formed Unicode chain
name into its seed, extending
[E409](e409-p01-named-sixteen-chain-seed-live.md)'s ASCII-only rule. Live,
four chains named `Später`, `Später € 音`, `𝄞 Keys` and `ASCII` were
composed without a rename stage in 2.1 s and read back exactly.

## Control preset

The operator saved an empty three-chain Instrument Layer,
`gn_instr_named_utf8_control`, in Bitwig 6.1.4. It is retained as
[`gn_instr_named_utf16_control.bwpreset`](../../../brain/fixtures/InstrumentLayer/gn_instr_named_utf16_control.bwpreset).
The displayed-name field (`0x08df`) of each chain holds:

| Name | Prefix | Bytes |
|---|---|---|
| `Später` | `80000006` | `0053 0070 00e4 0074 0065 0072` |
| `Später € 音` | `8000000a` | … `0020 20ac 0020 97f3` |
| `𝄞 Keys` | `80000007` | `d834 dd1e 0020 004b 0065 0079 0073` |

- `Später` fits in Latin-1 but is still stored as UTF-16, so the narrow form
  is ASCII only.
- The clef is stored as a surrogate pair, two code units.
- The repository's plugin-index reader (`discovery/binary.ts`) already
  decodes Bitwig's strings this way.
- Bitwig's chain-name editor accepted a pasted clef or piano emoji but drew
  it as a missing glyph, and its text cursor was one position early after
  it. The operator noted that such characters seem not fully supported in
  the editor. This record does not measure display.

## Change

Brain only; the extension and wire are unchanged.

- **Codec.** `format.ts` adds `strSize` and `encodeStr`. `readStr`,
  `patchString`, `valueSize`, META parsing and the META modulator-reference
  writer use them, so every `bwmod` string read or write handles both forms.
  Before this change a UTF-16 string anywhere in a preset was mis-sized.
- **Composition.** `isPresetEntryName` admits any non-empty name without a
  lone surrogate, and the engine writes such names into the seed. Only a name
  with a lone UTF-16 surrogate, which is not well-formed Unicode, still takes
  the live rename stages. The description v62 (uncommitted, same change) no
  longer mentions a naming stage.

Offline: all 2,654 brain tests pass. New tests encode each control name to
the control's exact bytes and round-trip strings through `patchString`.
Writing the three names into a three-chain seed trim reproduces the
control's chain records, apart from the same masked fields as E409. B17
compositions with UTF-16 names run no rename stage. The live-rename tests
now use a lone surrogate.

## Live

Bitwig 6.1.4 / API 25, project `gn-scale-test`, normal build (`normal-v1`,
94 methods, `526cd7e3760580cc`, fresh); no controller replacement
([operator record](../data/p01-unicode-names-live/operator.json)).
[Run 1](../data/p01-unicode-names-live/run-1/) ran the
[D44 driver](../../../brain/src/probes/p01-d44-live.ts) with
`--set unicode-names` on one scratch track.

- `compose_devices` built an FX Layer of four one-`Tool` chains at the end of
  the track in 2,127 ms / 62 turns, with no rename stage.
- The independent `read_devices` readback returned the names exactly, the
  surrogate pair included: `Später`, `Später € 音`, `𝄞 Keys`, `ASCII`.
- `revert_change` restored the exact prior structure in 1,714 ms / 53 turns.
- The scratch track was deleted, and every original track, the track list
  and the selection matched the baseline.

## Limits

- The case is a single run of one shape.
- A lone surrogate was tested offline only.
