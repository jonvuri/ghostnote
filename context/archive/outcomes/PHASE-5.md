---
title: Phase 5 outcome — structure and modulation authoring
kind: outcome
state: complete
status: Complete 2026-08-23. All exit evidence, local and live checks, exact
        cleanup, and final remote CI pass.
updated: 2026-08-23
phase: phase-5
evidence: E65-E73 · D1-D3, D7, D15, D16
---

# Phase 5 outcome

Phase 5 is complete. It delivers checkpointed modulator topology edits,
sampled-preset relocation, cross-device routes, a measured donor library, one
owned four-entry Instrument Layer template, and public authoring and composition
tools that hide binary format controls.

## Exit evidence

| Criterion | Result | Evidence and qualification |
|---|---|---|
| 1. Add, retarget, replace, and delete topology | Complete | E65 and E66 integrate all four editors. E70 proves all four public operations by exact live remote readback. |
| 2. Sampled Tier-2 preset | Complete | E67 proves sampled add and delete with every class-1 reference stub relocated. |
| 3. Cross-device container route | Complete | E68 proves an outer LFO routed to one exact nested Polysynth control. |
| 4. Checkpoint and reversal | Complete | E65 through E73 record every insertion and reverse it with exact owned cleanup. |
| 5. Donor footprints and refusal | Complete | E69 records five measured sampled donors. Two Tier-1-only donors refuse on sampled presets. |
| 6. Complete owned composition | Complete | E71 proves one through four retained entries, native substitution, nested edits, complete readback, and reversal. |
| 7. Useful public composition | Complete | E72 proves the format-hidden public boundary. E73 proves four entries, two active routes, nested parameter work, reversal, and exact cleanup. |

## Final public surface

Description version 6 adds `author_modulators`. It accepts named topology
operations and targets. Description version 7 adds `compose_device_structure`.
It accepts one through four ordered native entries and optional named modulator
edits. Both versions hide donor ids, binary routes, list selectors, footprints,
template paths, UUIDs, and byte offsets.

The composer returns separate requested, validated, observed, and verified
facts. It records one insertion. `revert_change` removes that inserted container
while its last proved top-level position remains valid.

## Product library policy

- The product ships one human-authored four-entry Instrument Layer template
  with recorded provenance.
- The product does not ship a copied Bitwig bundled preset.
- The template needs no first-run generation or runtime operator setup.
- The file composer retains one through four entries. A separate one-entry seed
  supports typed live duplication.
- Five donors have measured sampled-preset footprints. Two donors remain
  Tier-1-only and refuse on sampled presets.
- Standalone `bwmod` publication and external redistribution review remain
  Phase 6 work.

## Qualifications

- Modulator topology is authored in a preset before load. The host API still
  has no runtime modulator creation or route surface.
- `validate()` predicts a load. Only live remote readback proves active
  modulation.
- Public authoring targets are a small named recipe set. The underlying format
  path can address arbitrary targets within the container.
- The first public composer supports native devices only and refuses repeated
  device names.
- The shipped file template cannot grow past four entries. Typed duplication
  can grow a seeded live layer until the fixed bank refuses the next create.
- Device positions are not identities. Reversal keeps the recorded positional
  qualification.
- Format and live results are specific to Bitwig 6.0.6/API 25.

## Standing regression matrix

| Class | Owner | Checks | Trigger |
|---|---|---|---|
| Offline CI | GitHub Actions | `npm run check`, including the Python oracle; extension Gradle build | Every push and pull request |
| Final public live matrix | Repository operator | `probe:phase5f-surface`, `probe:phase5i-closeout`, `probe:4i-device-surface`, shared conformance, cleanup, handshake, and saved baselines | Before a candidate that changes authoring, composition, observer banks, public tools, adapters, bridge, or host version |
| Focused live | Repository operator | Relevant E65-E72 probe | After a related editor, donor, sampled-preset, route, or composer-core change |
| One-shot evidence | Repository operator | E73 four-entry dogfood | Only for a new natural task or to challenge the evidence |

Every live owner records entry state and removes owned fixtures. Shared
conformance cleanup removes its two known tracks. The final baseline verifies
the accepted launcher and saved Chorus+ and Reverb state.

## Final remote CI

[GitHub Actions run 32660690914](https://github.com/jonvuri/ghostnote/actions/runs/32660690914)
passed on its first attempt for exact candidate
`894bc608ca3c872c693bfdd9454038f819359458`. The `extension (compile)` and
`brain (offline suite)` jobs both passed.

## Phase 6 handoff

Phase 6 starts with the
[`bwmod` publication review and extraction](../../plan/phase-6/6a-bwmod-publication-review.md).
Review provenance, licensing, attribution, and package contents before binary
assets enter a standalone package. Do not publish externally without explicit
approval.
