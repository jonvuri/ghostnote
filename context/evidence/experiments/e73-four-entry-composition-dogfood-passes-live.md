---
id: E73
kind: evidence
state: active
source: phase-5-session-5i-composition-dogfood
---

# E73 — Four-entry composition dogfood passes live [K] (2026-08-23)

**Verdict: one public request creates and verifies a useful four-entry
Instrument Layer, existing parameter tools tune its nested devices, ordinary
reversal removes it, and the exact saved project remains.**

## Maximum-width correction

The first four-entry run exposed an observer blind spot. A four-slot layer bank
cannot prove that a four-entry result is complete. The result could contain a
fifth hidden entry. The composer correctly refused to mark the structure as
verified.

The fixed slot-scoped layer bank is now five slots wide in the extension and
fake adapter. The conformance capacity case now proves that a batch which would
create six chains in that bank refuses before write. The file composer remains
limited to the shipped four-entry template.

## Public dogfood

One `compose_device_structure` call created this order:

1. `Phase-4`.
2. `Polysynth`, with an added LFO routed to `FILTER/Filt Freq` at amount `0.55`.
3. `Organ`.
4. `Sampler`, with an added LFO routed to `Amp EG/Attack` at amount `0.45`.

Complete live readback returned the same four entry names and one exact nested
device per entry. Both edited devices returned `Vibrato`, `Expressions`, and
`LFO`. Each added LFO returned one exact remote page.

| Nested device | Exact control | Maximum divergence | Base spread |
|---|---|---:|---:|
| Polysynth | `FILTER/Filt Freq` | 0.0019876105847382863 | 0 |
| Sampler | `Amp EG/Attack` | 0.05202442407608032 | 0 |

All 16 behavior samples reported no automation. The existing
`inspect_device_parameters` tool reached both nested remote controls. Two
separate `set_parameter` calls set their normalized bases to `0.34` and `0.22`.
Fresh inspection returned `0.34` and `0.21999999999999997`.

`revert_change` removed the composed container and reported no unrestored
state. Cleanup removed the owned track. The final track list matched the exact
seven-track entry list. No `ghostnote-compose-*` temporary directory remained.

## Phase 5 exit audit

| Criterion | Result | Evidence |
|---|---|---|
| 1. Add, retarget, replace, and delete topology | Complete | E65, E66, and E70 prove all four public operations by live remote readback. |
| 2. Sampled Tier-2 preset | Complete | E67 proves add and delete with exact sample-reference relocation. E69 settles donor scope. |
| 3. Cross-device container route | Complete | E68 proves an outer LFO routed to one exact nested Polysynth control. |
| 4. Checkpoint and reversal | Complete | E65 through E73 record each insertion and reverse it with exact cleanup. |
| 5. Donor footprints and refusal | Complete | E69 records five measured sampled donors and two strict Tier-1-only refusals. |
| 6. Complete owned composition | Complete | E71 proves the core, E72 proves the public boundary, and this run proves the maximum width. |
| 7. Useful public dogfood | Complete | This run combines four devices, two active routes, nested parameter work, reversal, and exact cleanup. |

No exit criterion needs a new product decision. D1 and D2 still own the file
authoring model and two host tiers. D3 owns library and asset policy. D7 owns
the fixed observer bank. D15 and D16 still own live verification, recorded
writes, and reversal.

## Verification

- `npm run probe:hello`: freshness, Bitwig 6.0.6/API 25, and all 148 methods
  pass with hash `eb3391803ef4eea4`.
- `npm run probe:phase5i-closeout`: all four-entry, behavior, parameter,
  reversal, track, and temporary-file checks pass.
- `npm run probe:phase5f-surface`: add, replace, retarget, delete, reversal, and
  exact cleanup pass.
- `npm run probe:4i-device-surface`: the complete public device matrix passes.
  One first run exceeded the 6,000 ms scalar budget by 43 ms. The unchanged
  repeat passed at 5,762 ms.
- `npm run probe:conformance`: 54/54 pass with six expected skips in 345,394 ms.
- `npm run probe:conformance-cleanup`: both owned tracks are removed and seven
  tracks remain.
- `npm run probe:2k-baseline`: the exact seven-track, 14-clip musical baseline
  passes.
- `npm run probe:4j-dogfood -- inspect-candidate`: the accepted Chorus+ and
  Reverb inventories and retained values remain stable.
- `npm run check`: 823/823 pass.
- `./gradlew test`: passes from `extension/`.
- `ruby check.rb`: all 224 active context documents and links pass.

The exact-candidate remote CI run remains pending. Phase 5 stays active until
that run passes.

## Retrospective

Test the maximum advertised cardinality before closeout. This run exposed the
observer-window equality blind spot.
