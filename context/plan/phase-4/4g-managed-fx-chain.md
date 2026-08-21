---
title: Phase 4, session 4g — managed FX-chain workflow
kind: plan
state: planned
status: Planned after 4c through 4f. Compose existing structure operations and
        parameter control into one checkpointed workflow.
updated: 2026-08-21
parent: README.md
prev: 4f-deep-parameters-and-remotes.md
next: 4h-device-performance-gate.md
scope: Multi-device chain construction, position, bypass, and take semantics
evidence: E3, E4, E4d, E16, E18 · D5, D8, D16, D20
---

# Phase 4, session 4g — managed FX-chain workflow

> **Purpose.** Build and tune a mixed device chain whose exact and irreversible
> parts are explicit before the public surface freezes.

## Checkpoint promise

- An agent-inserted device has an exact structural inverse: delete the device at
  the position that execution minted.
- A scalar base-parameter or bypass change is exact after independent readback.
- Deleting a device that existed before the take remains `none`. Its opaque
  state cannot be recreated. It stays a directed destructive operation.
- Reverting an inserted device removes any later parameter changes with it.
- Modulation or automation can make the heard value differ from the stored base
  value. The take reports that condition.

## Scope

1. Add readable and writable device enabled or bypass state with exact scalar
   checkpoint semantics.
2. Support insertion at an intended top-level position. Insert at the end, read
   the minted device, then use the proven relocation primitive before a confirmed
   anchor when needed.
3. Compose multiple native, VST3, CLAP, and preset insertions into an ordered
   workflow. Each dependent parameter write uses the address minted by the prior
   insertion, never a predicted position.
4. Enumerate the complete chain before and after. Refuse when the device bank is
   incomplete.
5. Apply several parameter settings per device through grouped, target-confirmed
   stages. Verify every setting and report non-taking writes.
6. Materialize a reversal that restores pre-existing scalar state and deletes
   inserted devices in safe reverse order.
7. Prove that unrelated pre-existing devices and their order remain unchanged.

## Required boundaries

- Top-level FX-chain construction only. Nested routing remains available as
  separate addressed operations from session 4f.
- Do not replace an existing device with `insertFileAt(where:'replace')`. D16
  records that as damage before a trustworthy stash.
- Do not delete an existing device as an automatic cleanup step.
- Do not infer a minted address from the requested insertion order.
- Do not claim exact reversal when any required chain observation is incomplete.
- Do not expose the final MCP schema in this session.

## Exit criteria

1. One scratch workflow builds an ordered chain with at least three devices and
   includes native, VST3, and CLAP formats.
2. Each inserted device is identified by independent chain readback and receives
   at least one verified parameter setting.
3. One bypass change reads, writes, verifies, and restores exactly.
4. The take states the exact insert and scalar promises and the unrecoverable
   existing-device delete boundary.
5. Reversal removes the inserted chain in safe order and restores the exact
   entry chain and scalar state.
6. A concurrent chain edit or incomplete bank refuses before a wrong write.
7. Focused tests, full conformance, the brain check, extension tests, context
   check, and `git diff --check` pass.

## Retrospective target

Record whether dependent minted-address workflows fit the current executor or
need a small orchestration layer. Do not hide a second executor in a tool.
