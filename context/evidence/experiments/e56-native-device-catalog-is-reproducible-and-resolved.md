---
id: E56
kind: evidence
state: active
source: phase-4-session-4d-native-device-catalog
---

# E56 — Native device catalog is reproducible and resolved [K] (2026-08-22)

**Verdict: structured extraction produced a byte-stable catalog for all 151
Bitwig 6.0.6 native device presets. Live resolution confirmed 55 Polysynth and
32 Sampler parameter candidates without one false live claim.**

## Offline generation

The generator used an explicit `/Applications/Bitwig Studio.app` root. It read
the structured META device name, UUID, and application version from each
`Default.bwpreset`. It also confirmed the stream UUID field. The result contains
151 devices, 2,047 scalar parameter candidates, and 636 separate object tokens.
It excludes VST, module, and modulator settings.

Structured names avoided the 12-character control-byte trap. Drum Machine,
Freq Shifter, HW Clock Out, Note Repeats, Oscilloscope, Peak Limiter, and Stereo
Split all have their complete names.

Four scalar class and value shapes were sufficient to separate candidates from
named object tokens. The generator did not need a live check for tokens outside
these shapes.

Two consecutive runs produced these same SHA-256 values:

- `catalog.json`: `4cca18f41e8673a3628a76df6bf3a2caee0e936eac857f01ea6e907ba6905b37`
- `NativeDeviceCatalog.java`: `99ac8c122bf0160c672bb7b42c921c69db3d334c9e5c9baf07cf9ba2b53c5dc6`

The source fingerprint is
`sha256:0cac85cee28d4b70c5d939873d71551b2c828e8d2c19e00a5272ff7db3668964`.
Generation did not copy or edit a Bitwig preset.

## Live resolution

The probe inserted Polysynth and Sampler on one owned scratch track. It used the
confirmed DirectParameter acquisition route from E55. DirectParameter exposed
scalar IDs as `CONTENTS/<candidate>`. The resolver removes only this exact
prefix before comparison.

Polysynth resolved 55 of 56 candidates through DirectParameter. All 55 also
resolved through the generated typed view. Sampler resolved 32 of 33 candidates
through DirectParameter. `GLIDE_TIME` was the only unresolved candidate for
both devices. Neither device returned a live-only ID.

Every generated Polysynth typed handle reported `exists=true`. Its reply had a
name, base value, display, modulated value, automation state, origin, discrete
count, and discrete names.

The probe deleted its owned track and restored the exact entry track, slot, and
mixer selection. The accepted project returned to seven tracks.

## Verification

Five focused catalog tests pass. The full brain check passes 686 tests,
including typecheck. Extension tests pass. Repeated generation is byte-
identical. The fresh extension handshake and final live catalog probe pass.
Context and staged diff checks pass.

## Retrospective

The scalar object shape rejects unrelated tokens offline. The live check only
needs to resolve candidates for the supported device cohort. DirectParameter
IDs must first lose their exact `CONTENTS/` path prefix.
