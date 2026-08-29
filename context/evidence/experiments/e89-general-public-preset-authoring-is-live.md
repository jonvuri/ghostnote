---
id: E89
kind: evidence
state: active
source: phase-5-session-5n-general-public-preset-authoring
---

# E89 — General public preset authoring is live [K] (2026-08-29)

**Verdict: one fingerprinted public workflow now edits any exact semantic
modulator location with a general DirectParameter target and any supported
manifest donor.**

## Public contract

`inspect_preset_modulation` returns the SHA-256 fingerprint, host facts,
semantic locations, and public inventories. `author_modulators` requires that
fingerprint and one returned location. It supports add, replace, retarget,
amount, and delete. Add and replace accept all 42 supported manifest types at
their recorded host tier.

The write result separates requested, decoded, edited, observed, and verified
facts. A failed witness cannot hide an applied insertion or its reversal. The
schema and result expose no route string, donor id, list index, footprint,
reference stub, GUID, or byte offset. The three named target recipes map to the
same general DirectParameter path.

The explicit `inserted-host` structural check is available to all five editors.
Internal validation warnings stay behind the public result boundary.

## Live matrix

The Bitwig Studio 6.0.6 matrix passed these cases:

- Polysynth and Delay+ passed exact inserted-host and LFO-page witnesses.
- Zebra3 VST3 passed active Cutoff modulation with a maximum measured
  divergence of `0.4902847111225128`.
- Zebra3 CLAP passed exact inserted-host structural readback.
- Sample-less and sampled Sampler passed exact inserted-host and LFO-page
  witnesses. The sampled edit adjusted all four reference stubs.
- The selected Polysynth entry in an Instrument Layer passed exact page
  readback and active Filter Frequency modulation. Its maximum measured
  divergence was `0.003570580198364981`.

Each case recorded one insertion, reversed it, and returned the owned track to
an exact empty device state. Final cleanup restored the exact five-track entry
state of the disposable live project.

## Witness boundary

Bare native devices and Sampler expose the inserted LFO page, but these tested
DirectParameters expose no usable modulated value through the controller API.
CLAP exposes neither the remote page nor a usable modulated value in this case.
These cases use exact semantic edit, device-name, and available page readback.
VST3 and the selected container entry use active DirectParameter divergence.

Cold plug-in insertion needs up to four seconds for the first complete device
chain readback. Live inspection also corrected two saved target names to
`Blur Amount` and `AEG Attack Time`.

## Verification

- `npm run probe:phase5n-authoring`: all seven cases, reversal rows, and exact
  cleanup pass.
- `npm run check`: 925/925 pass.
- `./gradlew test`: passes from `extension/`.
- `npm run probe:hello`: Bitwig 6.0.6, API 25, deploy freshness, and the
  148-method contract pass.
- Description cohort `ghostnote-description-v17` is frozen at
  `7bd3bc42aa7bbf6793e0b40dcef40967aa7381eeb99b867ea748ffd4283117fe`.
- Fresh Codex session `01a04e3c-a9bc-7001-b8ed-0d2af323875e` found all three
  public modulation tools. It identified the fingerprint, semantic location,
  general target, and all five operations without a Ghostnote write.

## Retrospective

Measure cold plug-in settlement through the first complete chain readback.
Use the current DirectParameter name from live inspection in every witness.
