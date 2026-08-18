---
id: E42
kind: evidence
state: active
source: phase-2-session-2d-grid-precision-follow-up
---

# E42 — Host durations use measured 2^-20-beat quantization [K] (2026-08-18)

**Verdict: `NoteStep.duration()` settles on exact `2^-20`-beat values. Grid
classification can accept only the predicted normalized value. Start identity
keeps its strict rule.**

## Raw measurement

The probe wrote one owned clip in a slot that live readback proved empty. Java
recorded the request double and its raw bits. After settlement, writer cursor
`0` and independent cursor `1` each read every value twice. All four settled
readings were identical. Gson sent each settled Java double to the brain without
another numeric change.

| Family | Unit | Multiple | Requested Java double | Request bits | Settled and brain JSON | Settled bits | Error beats |
|---|---:|---:|---:|---|---:|---|---:|
| Binary | 1 | 1 | 1 | `3ff0000000000000` | 1 | `3ff0000000000000` | 0 |
| Binary | 1/2 | 1 | 0.5 | `3fe0000000000000` | 0.5 | `3fe0000000000000` | 0 |
| Binary | 1/4 | 1 | 0.25 | `3fd0000000000000` | 0.25 | `3fd0000000000000` | 0 |
| Binary | 1/8 | 1 | 0.125 | `3fc0000000000000` | 0.125 | `3fc0000000000000` | 0 |
| Binary | 1/16 | 1 | 0.0625 | `3fb0000000000000` | 0.0625 | `3fb0000000000000` | 0 |
| Binary | 1/32 | 1 | 0.03125 | `3fa0000000000000` | 0.03125 | `3fa0000000000000` | 0 |
| Binary | 1/64 | 1 | 0.015625 | `3f90000000000000` | 0.015625 | `3f90000000000000` | 0 |
| Triplet | 1/3 | 1 | 0.3333333333333333 | `3fd5555555555555` | 0.33333301544189453 | `3fd5555400000000` | -3.178914387835796e-7 |
| Triplet | 1/3 | 2 | 0.6666666666666666 | `3fe5555555555555` | 0.6666669845581055 | `3fe5555600000000` | 3.1789143883909077e-7 |
| Triplet | 1/3 | 5 | 1.6666666666666665 | `3ffaaaaaaaaaaaaa` | 1.6666669845581055 | `3ffaaaab00000000` | 3.1789143895011307e-7 |
| Triplet | 1/6 | 1 | 0.16666666666666666 | `3fc5555555555555` | 0.16666698455810547 | `3fc5555800000000` | 3.178914388113352e-7 |
| Triplet | 1/6 | 2 | 0.3333333333333333 | `3fd5555555555555` | 0.33333301544189453 | `3fd5555400000000` | -3.178914387835796e-7 |
| Triplet | 1/6 | 5 | 0.8333333333333333 | `3feaaaaaaaaaaaaa` | 0.8333330154418945 | `3feaaaaa00000000` | -3.1789143872806847e-7 |
| Triplet | 1/12 | 1 | 0.08333333333333333 | `3fb5555555555555` | 0.08333301544189453 | `3fb5555000000000` | -3.178914387974574e-7 |
| Triplet | 1/12 | 2 | 0.16666666666666666 | `3fc5555555555555` | 0.16666698455810547 | `3fc5555800000000` | 3.178914388113352e-7 |
| Triplet | 1/12 | 5 | 0.41666666666666663 | `3fdaaaaaaaaaaaaa` | 0.41666698455810547 | `3fdaaaac00000000` | 3.1789143883909077e-7 |
| Triplet | 1/24 | 1 | 0.041666666666666664 | `3fa5555555555555` | 0.04166698455810547 | `3fa5556000000000` | 3.178914388043963e-7 |
| Triplet | 1/24 | 2 | 0.08333333333333333 | `3fb5555555555555` | 0.08333301544189453 | `3fb5555000000000` | -3.178914387974574e-7 |
| Triplet | 1/24 | 5 | 0.20833333333333331 | `3fcaaaaaaaaaaaaa` | 0.20833301544189453 | `3fcaaaa800000000` | -3.178914387835796e-7 |
| Triplet | 1/48 | 1 | 0.020833333333333332 | `3f95555555555555` | 0.02083301544189453 | `3f95554000000000` | -3.1789143880092685e-7 |
| Triplet | 1/48 | 2 | 0.041666666666666664 | `3fa5555555555555` | 0.04166698455810547 | `3fa5556000000000` | 3.178914388043963e-7 |
| Triplet | 1/48 | 5 | 0.10416666666666666 | `3fbaaaaaaaaaaaaa` | 0.10416698455810547 | `3fbaaab000000000` | 3.178914388113352e-7 |

Every settled value multiplied by `2^20` is an integer. Binary controls need no
rounding. Each triplet result is the nearest such integer. The evidence supports
a fixed-point rule for the measured values, not a broad error epsilon. The
qualification is Bitwig 6.0.6, host API 25, and the supported durations and
multiples in the table.

## Product proof

The probe seeded the E41 raw third-beat duration and a straight quarter-beat
note. The production reader returned `0.33333301544189453`. `stepSizeFor`
selected the shared 1/12-beat grid. The pure quantize path accepted the notes,
the compiler emitted the replacement, and the production adapter completed both
write stages. Independent cursor `1` then read the raw third-beat and exact
quarter-beat durations again.

Focused tests use every raw triplet value above. They also cover mixed timing,
adjacent same-pitch truncation, encoded grid-cell collision refusal, arbitrary
nearby-value refusal, and the 1/64-beat floor. Start positions still use the
strict ratio check. An E41-shaped raw duration passes only through the exact
`2^-20` prediction.

## Baseline and verification

The probe passed 17 live checks after the handshake. Cleanup removed the owned
clip and restored all 22 occupied cells, entry selection, stopped transport,
empty observation value, cursor homes and pin state, and `Last change`.

The focused rhythm suite passes 15/15. The full offline check passes 594/594,
including typecheck. The extension build passes. The context check and
`git diff --check` pass.

## Decision impact

D9 now separates exact start identity from measured duration normalization. D10
stage order and D15 independent-read rules do not change. The wire remains 134
methods with hash `c2aa57be11e1f47e`; raw-bit fields exist only on the existing
probe-only `cursor.setAndReadNote` route.

## Retrospective

Separate start and duration rules make the grid contract clearer. Measuring
both boundary representations before selecting a rule prevented a broad epsilon.
No repository instruction change is needed.
