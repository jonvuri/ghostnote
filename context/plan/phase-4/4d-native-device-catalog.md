---
title: Phase 4, session 4d — native device catalog
kind: plan
state: complete
status: Complete. E56 records deterministic generation and live resolution for
        Polysynth and Sampler.
updated: 2026-08-22
parent: README.md
prev: 4c-direct-parameter-core.md
next: 4e-plugin-parameter-proof.md
scope: Generated native device and parameter catalog
evidence: E3, E4, E4c, E10d, E56 · D2, D7
---

# Phase 4, session 4d — native device catalog

> **Purpose.** Turn Bitwig's installed device settings into a reproducible,
> versioned native-device catalog without making every device a typed view.

## Decisions

- The repository ships a generated native catalog.
- Installed VST3 and CLAP devices are not part of this artifact. Their ids and
  availability are machine-specific, and DirectParameter enumerates their
  parameters at runtime.
- Candidate tokens from a preset are not parameters until a live device or a
  structural parser resolves them.
- Polysynth is the first typed deep-support device. DirectParameter remains the
  fallback for every other native device.

## Scope

1. Add a deterministic generator with an explicit Bitwig application root. Do
   not hard-code one user's installation path.
2. Read the structured device name and UUID from each native device-settings
   directory. Handle the 12-character name trap without a `strings` grep.
3. Extract candidate parameter ids and keep non-parameter object tokens separate
   when the format can distinguish them.
4. Emit a stable, sorted, schema-versioned asset with Bitwig version, source
   fingerprint, device UUID, device name, candidate ids, and resolution status.
5. Add a documented regeneration command and deterministic fixture tests.
6. Resolve-check Polysynth and each native device selected for Phase 4 dogfood.
   Insert the device, enumerate DirectParameter ids, compare the catalog, and
   prove the supported typed handles report `exists=true`.
7. Generate the Polysynth typed-id input from the catalog. Remove the separate
   hand-maintained product list when the generated route is proven.

## Required boundaries

- Do not allocate typed views for the complete native catalog.
- Do not publish an unresolved token as a verified parameter id.
- Do not scan Bitwig plugin caches into the checked-in asset.
- Do not edit or redistribute Bitwig preset files.
- Keep generation offline. Live resolution is a separate verification step.

## Exit criteria

1. Repeated generation from the same Bitwig bundle is byte-identical.
2. Every native device-settings directory appears once with a UUID and correct
   structured name, including all known 12-character names.
3. Candidate and live-resolved ids are distinguishable in the schema.
4. Polysynth and every native device used by the Phase 4 live workflow pass the
   resolve-check with no catalog id falsely reported as live.
5. The typed Polysynth view uses generated data and still reports its display,
   base value, `modulatedValue`, automation, origin, and discrete metadata where
   the API provides them.
6. Catalog provenance and regeneration instructions are concise and complete.
7. Focused generator tests, the brain check, extension tests when generated
   input changes, context check, and `git diff --check` pass.

## Retrospective target

Record which preset structure was sufficient to reject non-parameter tokens.
Do not add a live check where a stable structural rule is enough.

## Result

The generator reads structured META names, UUIDs, and Bitwig versions from an
explicit application root. It includes all 151 native preset directories and
excludes VST, module, and modulator settings. Four scalar object shapes produce
2,047 parameter candidates. Other named objects remain separate tokens.

The checked-in asset has a source fingerprint and per-device resolution status.
Repeated generation from Bitwig 6.0.6 produced identical catalog and Java
hashes. The generated Polysynth input replaces the hand-maintained list. Typed
replies now include origin, discrete count, and discrete names.

DirectParameter exposes each scalar ID as `CONTENTS/<candidate>`. The resolver
removes only this exact prefix. Polysynth resolved 55 of 56 candidates through
DirectParameter and the generated typed view. Sampler resolved 32 of 33 through
DirectParameter. `GLIDE_TIME` was the only unresolved candidate on each device.
Neither device returned a live-only ID.

All 55 generated Polysynth handles exist. Their replies include name, base
value, display, modulated value, automation, origin, discrete count, and
discrete names. The probe removed its owned scratch track and restored the
entry selection.

Five focused catalog tests pass. The full brain check passes 686 tests,
including typecheck. Extension tests, the context check, and diff checks pass.
E56 records the complete proof.
