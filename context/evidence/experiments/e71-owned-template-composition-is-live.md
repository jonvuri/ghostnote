---
id: E71
kind: evidence
state: active
source: phase-5-session-5g-owned-template-composition-core
---

# E71 — Owned-template composition is live [K] (2026-08-23)

**Verdict: one internal request now trims an owned four-entry Instrument Layer,
substitutes every retained native device, authors each bound nested modulator
list, loads the result with one recorded insertion, proves the complete live
structure and behavior, and reverses it.**

## Owned asset

The human-authored E4g preset is promoted in place as the first product
composition asset. A checked-in manifest records these exact facts:

- SHA-256
  `b953135a8c744b0796c6fdef86485012790e0533a137c7b59c6c2d21bc77b1f5`;
- 25,011 bytes, authored in Bitwig 6.0.6 by `jrajav`, with source evidence E4g;
- four source chain spans and four measured device GUID occurrences;
- one outer and four entry-bound modulator lists;
- no packaged-file references and no sampled-preset reference stubs.

Runtime checks the complete manifest before editing. It reads the immutable
asset and writes only one preset in a fresh temporary directory. The temporary
directory is removed after `device.insert`, including on failure.

The preset stays at its original checked-in path. This avoids a second opaque
binary copy. The manifest and runtime loader make the original file a product
asset. No new human preset save was needed.

## Pure composition

The composer accepts one through four ordered native entries. It keeps the
final N source entries and removes only earlier chains with exact end bounds.
It never cuts the undelimited final chain.

Each device name resolves by one exact match in the generated native catalog.
The composer changes only the measured binary GUID occurrence inside the bound
retained chain. It does not use stale ASCII device metadata as identity.

Each logical entry binds to a measured post-trim modulator list. Named requests
express add, replace, retarget, amount, and delete. Callers do not pass a list
index. Container META uses the ordered unique set of modulator GUIDs across all
nested lists. The accepted live preset added the same LFO type to two different
entry lists. Both lists used instance ids `0`, `1`, and `2`, and the preset
loaded correctly. The `0x1a1b` uniqueness gate is list-local for containers.

Each requested witness must agree with the final composed state. A later edit
cannot silently supersede an earlier requested route or page claim. Such a
conflict refuses before `apply()`.

The complete preset and every individual modulator list validate before the
executor call. Offline refusals cover zero and over-capacity requests, unknown
and ambiguous devices, asset drift, a missing list binding, an incompatible
target, and failed final validation. None crosses `apply()`.

## Live proof

The focused probe created one owned empty track. One composition request kept
two entries and produced this exact live order:

1. Polysynth with one added LFO routed to `FILTER/Filt Freq`.
2. Sample-less Sampler with one added LFO routed to `Amp EG/Attack`.

The validated preset had two chains, three modulator lists, and zero sample
reference stubs. Live container readback reported complete chains named
`Polysynth` and `Sampler`, with exactly the requested nested device in each.
Each nested remote inventory contained one `LFO` page.

| Nested device | Exact control | Maximum divergence | Base spread | Automation |
|---|---|---:|---:|---|
| Polysynth | `FILTER/Filt Freq` | 0.0034728523917336718 | 0 | false in 8/8 samples |
| Sampler | `Amp EG/Attack` | 0.12252402305603027 | 0 | false in 8/8 samples |

The executor recorded one `device.insert` operation and returned the minted
container address. Reversal deleted that observed container and reported no
unrestored state. Final cleanup restored the exact seven-track entry list.

## Verification

- `npm run check`: 808/808 pass.
- Focused composer, executor, and `bwmod` tests: 58/58 pass.
- `./gradlew test`: passes from `extension/`.
- Deploy freshness passes against Bitwig 6.0.6, API 25, and the 148-method
  handshake hash `eb3391803ef4eea4`.
- `npm run probe:phase5g-composition`: all live checks pass.

## Qualification

This is an internal workflow. Session 5h owns the public tool and must hide the
asset path, UUIDs, spans, list indexes, donor ids, routes, and offsets.
Redistribution review remains in Phase 6.

## Retrospective

Choose the donor and target as one behavioral recipe. A Random modulator loaded
on the sample-less Sampler but did not move Attack from its zero base. The LFO
produced the required positive divergence with the same accepted target.
