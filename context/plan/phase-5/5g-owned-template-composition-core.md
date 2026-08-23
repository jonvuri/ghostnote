---
title: Phase 5g — owned-template composition core
kind: plan
state: complete
status: Complete. E71 proves the owned-template composition path offline and live.
updated: 2026-08-23
parent: README.md
evidence: D1, D2, D3, E4f, E4g, E4h, E10d, E13, E65-E71
---

# Phase 5g — owned-template composition core

## Purpose

Build one internal composition path from an owned wide template. Trim it to the
requested size, substitute one native device in each retained entry, author its
modulators and routes, load it through the executor, verify the complete live
result, and reverse it.

## Starting asset

Use `brain/fixtures/InstrumentLayer/gn_layer_4chain.bwpreset` as the candidate
product asset. It is the human-authored E4g template. It is 25,011 bytes, has
four chain entries, has one outer and four nested modulator lists, validates,
and has no sampled-preset reference stubs. E4g proved independent device
substitution. E10d proved trims from four entries down to any size from one
through four.

Promote the candidate only after an asset manifest proves its exact layout. A
new human save is not required for this session. Capture a replacement only if
the candidate fails a required manifest check.

## Asset policy

1. Ship one user-authored Instrument Layer template as a build-time product
   asset. Do not copy a preset from Bitwig's bundled content.
2. Record the asset SHA-256, authoring Bitwig version, source evidence, maximum
   entry count, source device GUID for each entry, chain span, modulator-list
   binding, and external-reference status.
3. Do not generate the required asset on first run. Runtime work reads the
   immutable asset and writes only a temporary composed preset.
4. Keep external redistribution review in Phase 6. Do not expand the template
   library before that review.

## Scope

1. Add a pure template composer. It accepts an ordered native-device request
   with one through four entries and zero or more named modulator requests per
   entry.
2. Keep the final N template entries. Remove only earlier, exactly delimited
   chain spans. Never attempt to delete the undelimited final chain.
3. Resolve each requested device by one exact name in the generated native
   catalog. Replace only the measured binary GUID occurrence for its retained
   entry. Do not use the preset's ASCII metadata as device identity.
4. Bind each logical retained entry to its exact post-trim modulator list. Apply
   the proved `bwmod` add, replace, delete, retarget, and amount operations as
   the requested composition needs. Do not expose list indexes to callers.
5. Check the asset manifest before editing. Validate the complete result and
   each edited modulator list before any project write.
6. Write the result to a fresh temporary directory. Load it with one guarded
   `device.insert` executor operation and remove the temporary file afterward.
7. Read back the complete retained entry order and each nested device name.
   Verify every requested modulator page and every requested active route by an
   exact page and control selector.
8. Return the executor take, minted container address, requested and observed
   structure, validation warnings, and live witnesses. State that exact
   reversal restores the prior absence; it does not claim byte-exact preset
   readback.
9. Reverse the take in the focused live proof and restore the exact entry track
   list.

## Acceptance criteria

- Offline tests cover exact sizes one, two, three, and four. The composer keeps
  request order and never mutates the source asset.
- Each retained entry gets only its requested device GUID. Dropped entries and
  their nested modulator lists are absent.
- A modulator edit changes only its bound retained list. The outer list and all
  sibling lists keep the same semantic content unless the request names them.
- A zero-entry request, a request above capacity, an unknown or ambiguous
  native device, asset drift, a missing list binding, an unsupported route, or
  a witness that conflicts with final composed state, or failed validation
  refuses before `apply()`.
- The focused live proof composes two distinct retained devices, including
  Polysynth and a sample-less Sampler, and gives each one an exact active
  modulation witness.
- Live readback proves two entries in the requested order, both requested
  device names, the requested modulator pages, stable bases, false automation,
  and positive base-to-modulated divergence.
- The executor records one structural insertion. Reversal removes the observed
  container and reports no unrestored state.
- Cleanup removes every temporary file and owned project object.
- `npm run check`, the extension Gradle tests, deploy freshness, and the focused
  live probe pass.

## Out of scope

- A public composition tool.
- More than four layer entries or a different container shape.
- File-format chain growth. A seeded live layer can grow through typed
  duplication, but that is a separate product path.
- VST3 or CLAP substitution, embedded samples, new donors, and new target
  recipes.
- Device parameter state. Existing Phase 4 tools set parameters after the
  structure exists.
- General selected-list support in `author_modulators`.

## Retrospective target

Bind logical entries to measured template facts. Do not let a raw list index or
an assumed chain position become a product identity.
