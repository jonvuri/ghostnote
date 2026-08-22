---
title: Phase 4, session 4g — managed FX-chain workflow
kind: plan
state: complete
status: Complete. E59 records the guarded mixed-format workflow, exact scalar
        replay, current-position owned reversal, recovery, and cleanup.
updated: 2026-08-22
parent: README.md
prev: 4f-deep-parameters-and-remotes.md
next: 4h-device-performance-gate.md
scope: Multi-device chain construction, position, bypass, and take semantics
evidence: E3, E4, E4d, E16, E18, E59 · D5, D8, D16, D20
---

# Phase 4, session 4g — managed FX-chain workflow

> **Purpose.** Build and tune a mixed device chain whose exact and irreversible
> parts are explicit before the public surface freezes.

## Checkpoint promise

- An agent-inserted device has an exact structural inverse under the last
  accepted complete name-and-enabled chain. Delete it at its current observed
  owned position, not at a stale minted position.
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

## Result

The managed workflow uses a small host seam above the executor. It appends one
device, accepts a complete chain observation, resolves that minted address, and
then applies dependent scalar writes. It relocates the appended device before a
confirmed anchor when the requested position differs. The static executor
cannot derive those later addresses from readback in one precomputed write set,
so the dependent sequence belongs in this orchestration layer. The layer reuses
the executor for each guarded apply and take.

One owned live fixture starts with `Tool` and `Delay+`. The workflow inserts a
native Polysynth, Zebra3 VST3, Zebra3 CLAP, and a Sampler preset. The intended
observed order is `Tool`, `Polysynth`, `Zebra3`, `Zebra3`, `Delay+`,
`Sampler`. Append readback mints positions `2, 3, 4, 5`; relocation produces
current positions `1, 2, 3, 5`. Each inserted device receives one verified
parameter setting. The workflow also changes and records the entry `Delay+`
enabled state.

Every structure, parameter, and enabled-state mutation carries the prior
accepted complete top-level name and enabled sequences. An incomplete or full
bank refuses before mutation. A concurrent `EQ+` insertion and relocation shifts
an owned Polysynth away from its stale parameter address. The complete-chain
boundary makes guarded acquisition refuse before that write. Recovery excludes
the unrelated device and returns the last proved continuation.

The checkpoint keeps mint provenance for ownership and current positions for
later work. Normal reversal restores the entry enabled state, then deletes
owned devices from the highest current position to the lowest. A failed
reversal also returns the last proved continuation. It never replays an
uncertain mutation. Existing-device deletion remains `none`.

This complete name-and-enabled boundary is still a fingerprint. It cannot
detect replacement by another device with the same name and enabled state.
There is no device identity to close that case.

Focused adapter and managed-workflow tests pass 108/108. Shared fake
conformance passes 60/60. The full brain check passes 750/750, including
typecheck. Extension tests pass. The fresh Bitwig 6.0.6/API 25 handshake passes
all 147 methods with hash `f58c5ded93d5f743`. The managed live proof passes all
ten rows. Full live conformance passes 54/54 with six expected skips.
Conformance cleanup removes its two generated fixture tracks, and the final
read-only 2k baseline passes with seven tracks and no launcher residue. Context
check passes for 199 active documents. Working-tree and staged diff checks pass.

The retrospective confirms that a small orchestration layer is necessary. Its
checkpoint is the last accepted complete observation. Minted positions remain
ownership provenance and do not become durable addresses. Live fixtures must
use distinguishable devices when cursor identity must be unique. No
context-process change is needed.
