---
title: E409 — P01 named 16-chain composition seed, live
kind: evidence
updated: 2026-11-07
owner: P01
---

# E409 — P01 named 16-chain composition seed, live

**Positive.** Staged `compose_devices` now inserts its layer container from
a human-saved 16-chain empty seed, trimmed offline to the request's width
with the requested chain names already written into the preset. No chain is
grown or renamed live. Sixteen one-device chains at position 18 took
10.9 s / 74 wire turns, against
[E407](e407-p01-adapter-checks-and-d44-live.md)'s 38.1 s / 165 with eleven
host duplications. Eight two-device chains at 18 took 5.8 s (E407: 13.2–13.7 s).
Every composition read back independently with its exact names and devices.
`revert_change` restored the exact prior structure in 1.6–3.5 s, and the
scratch track was removed with every original track, the track list and the
selection preserved.

## Seed assets

The operator saved three presets in Bitwig 6.1.4 on 2026-11-07:
`gn_instr_sixteen_empty` and `gn_fx_sixteen_empty` (16 empty, unnamed
chains, no devices or modulators) and `gn_instr_named_control` (three empty
chains named `A`, `Bass Pad` and `Chain With A Longer Name`).

- **Seeds.** The two 16-chain presets replace the human-saved five-chain
  seeds of E93 as compressed constants in
  [`layer-seeds.ts`](../../../brain/src/composition/layer-seeds.ts). Their
  [manifest](../../../brain/assets/composition/general-container-seeds.json)
  records hash, length, container GUID offset, outer modulator list, all 16
  chain spans, zero sample-reference stubs and the authoring version.
  Compared with the five-chain seeds, each chain record differs only in its
  chain GUID and its `TRACK_SEND(<id>)` reference to the authoring project's
  send; the five-chain seeds also carry one.
- **Name field.** A chain record opens with its route name (`CHAIN<n>`,
  field `0x02b9`), its GUID (`0x2ab8`) and then its displayed name (`0x08df`),
  a length-prefixed string that is empty in an unnamed chain. Each name added
  exactly its length to its record (`A` +1, `Bass Pad` +8). Nothing in the
  object stream records a byte span, so a name is a string splice.
- **Byte check.** Writing the control's three names into a three-chain trim
  of the 16-chain seed reproduces the control's chain records, apart from
  GUIDs, the project send reference and the normalized route names. The
  control is retained as
  [`gn_instr_named_control.bwpreset`](../../../brain/fixtures/InstrumentLayer/gn_instr_named_control.bwpreset)
  and the comparison is a regression test.

## Change under test

Brain only; the extension and wire are unchanged.

- **bwmod.** `chainDisplayNameOffset`, `chainDisplayName` and
  `setChainDisplayName` locate, read and write the displayed name of one
  top-level chain, refusing a record that does not open with the three
  expected fields.
- **Composition preset.** `composeGeneralDeviceContainerPreset` trims the
  seed to 1–16 entries and writes `entryNames` when given: one unique
  printable-ASCII name for each retained entry. Only printable ASCII is
  written because only ASCII names were compared byte for byte.
- **Engine.** The request's width is the seed's width (at most 16 entries),
  so the growth stage is removed. When every requested name is printable
  ASCII, the names go into the preset; the existing comparison of observed
  and requested names then finds nothing to rename. Otherwise no name is
  written and the existing rename stages, including temporary names for a
  clash, set the names live.
- **Limit.** [D68](../../decisions/d68-composition-chain-limit-is-the-seed-width.md)
  raises the layer-chain limit from 8 to 16. Descriptions v62.

Offline: typecheck and all 2,652 brain tests pass. New or changed tests
cover the manifest facts and unnamed seed chains, every width 1–16 for both
kinds, the byte comparison with the control, refusal of non-ASCII, duplicate,
empty and miscounted names and of 17 entries, 16 entries composed with no
`chain.create` or `chain.rename`, and the live-rename path with one
non-ASCII name. Eight chains now cost the same adapter calls as one (devices
1, read 4, apply 2, delta 2, structure read 2); the one-chain composition
also lost its naming apply (was read 6, apply 3, delta 3).

## Session and build

Bitwig 6.1.4 / API 25, project `gn-scale-test`. `probe:hello` passed with the
normal build (`normal-v1`, 94 methods, `526cd7e3760580cc`, fresh
initialization, B18 marker); only brain code changed, so no controller
replacement was needed ([operator record](../data/p01-larger-seed-live/operator.json)).
The driver refused any other probe driver or bridge client before every
write, owned one scratch track and deleted it, and compared every original
track's complete `read_devices` structure, the track list and the selection
with the baseline.

## Results

[Run 1](../data/p01-larger-seed-live/chains-attempt-1/) ran the
[D44 driver](../../../brain/src/probes/p01-d44-live.ts) with `--set chains`.
Every case checked that no chain was grown live and whether a naming stage
ran:

| Case | Naming stage | Compose ms / turns | E407 | Revert ms / turns |
|---|---|---:|---:|---:|
| 3 chains at the end, names `Bass (sub) #1`, `Pad's "wide" - L/R`, `x` | none | 1,930 / 61 | — | 1,673 / 53 |
| 2 chains at the end, names `Später`, `Chain 1` | live rename | 2,455 / 76 | — | 1,609 / 53 |
| 8×2 native at position 18 | none | 5,841 / 66 | 13,203 / 111 (runs 6–7) | 2,893 / 53 |
| 12×1 native at position 18 | none | 7,937 / 70 | — | 3,197 / 53 |
| 16×1 native at position 18 | none | 10,878 / 74 | 38,068 / 165 | 3,474 / 53 |

In the 16-chain composition, the 17 `batch.run` turns took 8.0 s: the
container insertion (0.14 s) and one `chain.insert` for each chain
(0.42–0.53 s each, rising with the container). Two container structure
reads took 1.3 s. Per-chain insertion is now the composition's growing cost.

## Interpretation and limits

- Bitwig displays a preset-written chain name exactly, including ASCII
  punctuation and quotes. A non-ASCII name was not written into a preset,
  so its encoding there is unmeasured; it still takes the live rename path,
  which passed. [E410](e410-p01-unicode-chain-names-in-the-seed.md) later
  measures that encoding and writes such names into the seed.
- At 16 chains every chain holds at least one device, so the 16-unit limit
  already bounds chains; 16 one-device native chains is the largest
  admitted chain shape. The worst admitted case overall is still E408's 8
  existing sources (17.0 s, revert 12.0 s), measured with three growth
  copies that no longer run.
- Modulation still requires the first five chains (`parameterEntriesPerLayer`);
  this change does not alter that window.
- Single-run timings on one fixture; no repeat distribution was measured.
