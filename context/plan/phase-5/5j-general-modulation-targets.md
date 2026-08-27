---
title: Phase 5j — general modulation targets
kind: plan
state: done
status: Complete. One exact DirectParameter target serves native, VST3, and CLAP routing; native and VST3 behavior pass live.
updated: 2026-08-26
parent: README.md
evidence: D1, D2, E10b, E61, E64, E70, E85
---

# Phase 5j — general modulation targets

## Purpose

Define one general modulation target from the stable DirectParameter inventory
that Ghostnote already returns for native, VST3, and CLAP devices. Remove the
need to add code for each parameter target.

## Scope

1. Add one shared target value with the exact `parameterId` and parameter name
   returned by `inspect_device_parameters`.
2. Convert the returned DirectParameter id to the internal modulation route.
   Do not accept a separate route string.
3. Verify the exact id and name after the edited preset loads. Sample its base
   value and `modulatedValue`. Require stable base values, no automation, and
   the requested active or inactive behavior.
4. Support a target on a plain device and a target below a logical container
   location. Keep location resolution outside this session.
5. Preserve the three current recipe names as compatibility mappings to the new
   target value. Do not keep two verification implementations.
6. Prove one native device and one plug-in target live. Use an owned fixture or
   scratch device and restore the exact entry state.

## Acceptance criteria

- One target contract serves native, VST3, and CLAP DirectParameters.
- The contract rejects an id and name mismatch.
- The caller cannot supply a Ramona route, list index, byte offset, or remote
  page position.
- A missing target or a silent route is a post-write verification failure. The
  recorded insertion remains visible and does not become a false pre-write
  refusal.
- DirectParameter tests cover automation, unstable inventories, base spread,
  active divergence, inactive behavior, and duplicate names with distinct ids.
- Focused live checks prove native and plug-in targets, reversal, and cleanup.
- The full brain check and extension tests pass.

## Out of scope

- Preset and container-list discovery.
- New donor types.
- Public write-tool migration.
- Moving or wrapping an existing project device.

## Handoff

Session 5k uses this target value in a semantic, read-only preset inventory.

## Result

The public input now accepts one exact DirectParameter id and name. Internal
conversion keeps native ids unchanged and adds the measured generic plug-in
route segment for plug-in ids. The three original recipe names resolve to the
same target value and use the same verifier.

Focused tests cover exact identity, hidden internal selectors, plain and
resolved container routes, active and inactive behavior, automation, unstable
inventories, base spread, duplicate names, missing targets, and silent routes.
The full brain check passes 895/895. Extension tests, deploy freshness, and the
148-method live handshake pass. Native Polysynth and Zebra3 VST3 targets pass
exact behavior verification, reversal, and cleanup. The combined probe restores
the exact four-track entry list. [E85](../../evidence/experiments/e85-general-directparameter-modulation-targets-are-live.md)
records the contract, live values, host observation qualification, and result.

## Retrospective

Measure DirectParameter ids and internal routes on each host type before the
first combined live proof. Native and plug-in ids need different route forms.
