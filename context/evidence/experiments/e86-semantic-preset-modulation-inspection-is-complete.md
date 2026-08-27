---
id: E86
kind: evidence
state: active
source: phase-5-session-5k
---

# E86 — Semantic preset modulation inspection is complete [K] (2026-08-27)

**Verdict: `inspect_preset_modulation` reads one explicit human-saved preset and
binds every modulator inventory to one public semantic location. It returns no
binary selector. Ambiguous or incomplete structures return `supported: false`.
The operation changes neither Bitwig nor the preset file.**

## Public result

The result reports these values:

- one SHA-256 and byte-length fingerprint;
- the Tier 1 or Tier 2 host class and native, VST3, or CLAP format;
- the container kind, ordered entries, and ordered device names;
- one `self`, `container`, or entry-and-device-path location for each modulator
  inventory;
- public modulator positions, names, categories, amounts, ranges, and targets.

Repeated entry and device names stay distinct through their ordered positions.
A known route becomes the exact 5j DirectParameter id and name. An unknown route
returns an explicit unresolved target. The public result contains no raw route,
internal list selector, object identity, footprint, reference stub, or byte
location.

## Safety boundary

The reader maps a device owner only inside its measured stream or entry bounds.
It requires one exact owner field in that scope. It does not select the nearest
global name. Every discovered modulator list must have one unique semantic
binding, or the complete inspection is unsupported.

The fingerprint guard compares both SHA-256 and byte length. Session 5l can use
that guard before a semantic write. Changed file bytes require a new inspection.

## Fixture matrix

The typed matrix passes for these human-saved fixtures:

| Case | Fixture | Result |
|---|---|---|
| Plain native | Polysynth | Tier 1, native, `self` |
| Native container | Four-entry Instrument Layer | Tier 1, native, one container and four entry locations |
| VST3 | Zebra3 | Tier 1, VST3, `self` |
| CLAP | Zebra3 | Tier 1, CLAP, `self` |
| Sample-less Sampler | Sampler | Tier 1, native, `self` |
| Sampled Sampler | Sampler | Tier 2, native, `self` |

The VST3 fixtures are the existing human-saved Bitwig 6.0.6 presets used by the
5j live proof. They are now vendored beside the existing CLAP fixtures.

## Verification

- Focused engine, schema, public-description, and surface tests: 27/27 pass.
- Complete brain check: 906/906 pass.
- TypeScript type check: pass.
- Diff whitespace check: pass.
- No live Bitwig check was needed. The operation is file-only and read-only.

## Retrospective

Bind each device only within explicit structural bounds. A nearest-name rule can
silently attach a list to a modulator or sibling device.
