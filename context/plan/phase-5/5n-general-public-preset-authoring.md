---
title: Phase 5n — general public preset authoring
kind: plan
state: complete
status: Complete. Fingerprinted semantic authoring covers all five editors and the 12 donor types retained by E96.
updated: 2026-09-01
parent: README.md
evidence: D1, D2, D3, E65-E71
---

# Phase 5n — general public preset authoring

## Purpose

Expose the proved general engine through one format-hidden public preset
authoring workflow. Remove the Polysynth and Sampler target restriction.

## Scope

1. Publish the semantic preset inspection from 5k.
2. Extend `author_modulators` with the inspected file fingerprint, semantic
   modulator location, manifest-backed modulator type, general DirectParameter
   target, and normalized amount.
3. Expose add, replace, retarget, amount, and delete with one result contract.
4. Support plain and container presets across native instruments, native FX,
   VST3, CLAP, sample-less Sampler, and sampled Sampler.
5. Keep the existing three target recipes as documented compatibility inputs.
   Map them to the general target path.
6. Return requested, decoded, edited, observed, and verified facts separately.
   Keep every recorded insertion visible after a verification failure.
7. Add a new frozen description cohort and fresh Codex exposure check.

## Acceptance criteria

- A caller can discover and use a target without a built-in target recipe.
- A caller can discover and edit an outer or nested modulator location without
  a raw list index.
- Every type returned by the donor catalog is accepted where its recorded tier
  permits it.
- No public schema or result contains a route string, donor id, list index,
  footprint, reference stub, GUID, or byte offset.
- The old named recipes keep their exact meaning and verification behavior.
- The live matrix includes native instrument, native FX, VST3, CLAP, sampled
  preset, and selected container-list cases.
- Each live case records one insertion, passes its witness, reverses, and
  restores the exact entry state.
- Surface conformance, fresh Codex exposure, the full brain check, and extension
  tests pass.

## Out of scope

- Mutating a device that is already in the project.
- Creating a new container around an existing device.
- General multi-device composition.

## Handoff

Session 5o proves the host behavior needed to preserve and modulate an existing
device through an owned container.

## Outcome

`inspect_preset_modulation` supplies the required fingerprint and semantic
location. `author_modulators` accepts all five editors, general
DirectParameter targets, and the manifest-backed donor catalog. It returns
requested, decoded, edited, observed, and verified facts separately.
An explicit inserted-host check supports operations where the controller API
provides no usable page or DirectParameter witness. Internal validation
warnings do not cross the public result boundary.

E96 supersedes the original 42-type breadth claim. The public catalog now
contains the 12 types with exact relocated live page witnesses.

The Bitwig 6.0.6 matrix passes for native instrument, native FX, VST3, CLAP,
sample-less Sampler, sampled Sampler, and one selected container entry. Each
case reverses and restores the exact entry state. [E89](../../evidence/experiments/e89-general-public-preset-authoring-is-live.md)
records the result and the host witness qualifications.
