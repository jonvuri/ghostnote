---
title: Phase 4, session 4i — device and parameter MCP surface
kind: plan
state: planned
status: Ready next. Replace the thin probe-era device tools against E61.
updated: 2026-08-22
parent: README.md
prev: 4h1-device-observer-efficiency.md
next: 4j-dogfood-and-closeout.md
scope: Public device inspection, insertion, parameter, bypass, and deletion tools
evidence: E4, E4b, E48, E61 · D18, D20, D21
---

# Phase 4, session 4i — device and parameter MCP surface

> **Purpose.** Expose the completed device capability through a small, factual,
> versioned tool cohort.

## Carry-in

`add_device`, `set_parameter`, and `delete_device` already exist. Their current
shape predates general parameter readback. `plugin` means CLAP only, parameter
index is primary, and there is no complete public parameter inventory. Revise
these tools from the measured contract instead of adding parallel replacements
without need.

## Scope

1. Define the minimum cohort for device-chain inspection, parameter inventory,
   insertion, parameter change, bypass, and directed deletion.
2. Use explicit `bitwig`, `vst3`, `clap`, and `preset` sources. Name ids by their
   real format.
3. Make DirectParameter id the general parameter selector. Expose typed display,
   discrete values, origin, automation, and `modulatedValue` only when observed.
4. Report device position as positional and require a fresh complete inventory
   after a chain edit.
5. Return verification disagreements, unreachable windows, observer instability,
   modulation or automation warnings, elapsed time, and exact reversal limits.
6. Keep deletion in the destructive permission partition. State that an existing
   device cannot be reconstructed.
7. Freeze one new description cohort and fingerprint after the full wording and
   schema review. Preserve prior description versions.
8. Prove the ordinary registered MCP path against the fake and live Bitwig.

## Required boundaries

- Keep the patch and contract as the implementation interface. Do not create one
  tool per device type or parameter family.
- Do not expose probe names such as `directparam.list`.
- Do not imply that normalized values have one common physical unit.
- Do not say a write succeeded when readback did not agree.
- Do not add browser search to the routine insertion path.

## Exit criteria

1. The cohort is minimal and covers inspection, insertion, parameter change,
   bypass, and directed deletion without overlapping tools.
2. Every tool emits declared contract operations and uses the common executor or
   the documented dependent-workflow seam.
3. The agent can discover more than eight named parameters without knowing ids
   in advance, then set one by returned id.
4. Source format, positional addressing, bank coverage, normalization,
   modulation, automation, latency, and reversal limits are explicit.
5. The description fingerprint fails on an undeclared public change.
6. Ordinary MCP calls pass for one native, one VST3, one CLAP, and one preset
   insertion path with exact cleanup.
7. Focused surface tests, full conformance, the brain check, extension tests,
   context check, and `git diff --check` pass.

## Retrospective target

Record whether the old generic `plugin` wording caused any migration cost. Keep
aliases only when an actual caller needs them.
