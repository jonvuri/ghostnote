---
title: D03b — CLAP-discovered preset boundary spike
kind: plan
state: planned
updated: 2026-09-12
parent: README.md
prev: d03-generic-plugin-preset-loading-spike.md
next: d04-plugin-preset-file-source.md
evidence: E101, E102
---

# D03b — CLAP-discovered preset boundary spike

## Objective

Define the complete safe boundary for filesystem-backed CLAP-discovered preset
files before D04 adds a public source. Determine what is generic CLAP behavior
and what is specific to u-he H2P files.

Do not implement a public source in this session.

## Questions

1. Which installed CLAP providers expose preset discovery and preset load?
2. Which native suffixes and filesystem locations reach Bitwig's discovery
   index?
3. Do two instruments and one effect load through the same guarded direct file
   route?
4. Can exact readback prove the created device, preset name, enabled state, and
   stable parameter inventory?
5. Which cases stay unreachable: unindexed files, unsupported providers, or
   plug-in-contained presets?
6. Can the public contract describe the route without promising discovery by
   name or arbitrary CLAP preset support?

## Live matrix

Use only installed devices whose alternate plug-in formats are absent. Include:

- Repro-5 with one indexed H2P control;
- Diva with one indexed H2P control;
- one u-he effect with an indexed native preset, if available;
- one installed non-u-he CLAP negative control that does not expose discovery.

For each positive source, run one first load and three warm loads. Copy the file
outside every indexed root and prove the copy is an exact no-op. Also prove a
missing path and a wrong suffix are exact no-ops.

## Static inventory

Record the installed CLAP ids, discovery-capable providers, native suffixes,
and indexed locations. Treat Bitwig index files as evidence, not a product API.
Use the official CLAP discovery and load headers to define the standard
boundary.

## Safety and readback

- Use one owned track for each case.
- Guard the complete entry chain before each insertion.
- Accept a load only after the expected device and preset name appear.
- Require a stable, complete DirectParameter inventory.
- Treat host silence as failure.
- Delete only owned state and restore the exact entry track list.

## Decision

Choose one outcome:

1. `clap-discovered-file`: the measured registry supports more than one native
   suffix or vendor with one contract.
2. `u-he-h2p`: the mechanics are generic, but local evidence supports only
   indexed u-he H2P files.
3. `unavailable`: the route cannot provide complete identity and readback.

Then revise D04. Keep VSTPRESET independent from the selected CLAP result.

## Out of scope

- Popup or side-browser automation.
- Preset lookup by display name.
- Parsing vendor preset files.
- Calling a CLAP plug-in ABI outside Bitwig.
- Loading plug-in-contained presets without a supported controller route.

## Acceptance criteria

- The provider and suffix inventory is reproducible.
- The live matrix has deterministic positive and negative verdicts.
- The result states what is and is not generic.
- E101, E102, D04, and `context/NOW.md` agree.
- Brain checks, extension tests, and the live handshake pass.
- The disposable project has no test residue.

## Retrospective prompt

Check whether one early environment inventory could replace any live control.
Record one concise improvement or state that none is needed.
