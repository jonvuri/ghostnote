---
id: E72
kind: evidence
state: active
source: phase-5-session-5h-public-structure-composition
---

# E72 — Public device-structure composition is live [K] (2026-08-23)

**Verdict: one public tool now composes the owned native-device structure,
reports separate requested, validated, observed, and verified facts, records one
insertion, and reverses it through the ordinary public reversal tool.**

## Public boundary

`compose_device_structure` accepts one durable track id and one through four
ordered entries. Each entry has one exact native-device catalog name and
optional named add, replace, retarget, amount, or delete edits.

The schema refuses repeated device names, invalid entry counts, unsupported
modulator types, incomplete replace requests, and incompatible named targets.
Exact unknown and ambiguous catalog matches refuse before `apply()`. The
executor guard uses the complete current top-level device order and aligned
enabled state.

The schema and result contain no preset path, asset name, device UUID, chain
span, list selector, donor id, route string, footprint, reference stub, or byte
offset. Internal format warnings are mapped at the public boundary. They do not
leak internal selectors.

## Result and write boundary

The result has four explicit fact groups:

- `requested` contains the ordered names and edits from the caller.
- `validated` contains the final public modulator inventory.
- `observed` contains the complete live entry order and nested device names.
- `verification` contains exact remote page counts and behavior samples.

The result also contains one recorded insertion receipt and states that
`revert_change` removes the inserted container while its last proved position
remains valid. A failed live witness returns a post-write verification failure
with the recorded change still visible. Cancellation after the recorded insert
propagates. An explicit workspace guard preserves every abort reason, including
an `Error` object. Cancellation before the insert writes nothing.

## Live proof

The focused public call created one owned empty track and requested this order:

1. Polysynth with an added LFO on `FILTER/Filt Freq`.
2. Sampler with an added LFO on `Amp EG/Attack`.

Live readback returned the same two-entry order and one exact nested device per
entry. The public inventory returned `Vibrato`, `Expressions`, and `LFO` for
each entry. Each LFO page count was one.

| Nested device | Exact control | Maximum divergence | Base spread | Automation |
|---|---|---:|---:|---|
| Polysynth | `FILTER/Filt Freq` | 0.0035578074869119236 | 0 | false in 8/8 samples |
| Sampler | `Amp EG/Attack` | 0.12106698751449585 | 0 | false in 8/8 samples |

`revert_change` removed the inserted container and reported no unrestored
state. Final cleanup restored the exact seven-track entry list.

## Verification

- `npm run check`: 823/823 pass.
- `./gradlew test`: passes from `extension/`.
- `npm run probe:hello`: deploy freshness passes against Bitwig 6.0.6, API 25,
  and the 148-method hash `eb3391803ef4eea4`.
- `npm run probe:phase5h-composition`: all public live checks pass.

## Retrospective

The internal validation result contains useful format diagnostics, but those
diagnostics are not public product facts. Map them before they cross the tool
boundary.
