---
title: E306 — Bounded Grid writer preparation
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E306 — Bounded Grid writer preparation

## Result

The V16 writer and foreground driver for
[9b.3](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b3--bounded-write-probes)
are implemented, checked offline, and deployed. Controller replacement and
live acceptance remain. No live bridge call, scratch edit, native Grid
command, engine command, transport command, or save ran in this preparation.

The marker is `gridReadProbe: 9b-grid-writes-v16`. The research profile stays
`phase-8-probe-v1`, with 118 methods and hash `2e939035ea90b8b0`. Public tool
descriptions remain v52. No public tool behavior or call budget changed.

`./gradlew copyProbeExtension` copied the probe archive to
`~/Documents/Bitwig Studio/Extensions/ghostnote-0.0.1.bwextension`
at `2026-10-20T19:11:48.264601Z`. Its SHA-256 is
`35668462515c77edae8a85e673b062572ba044738b5714b59bb43a9f9f0f9c5c`.
The built and deployed archives match. Their service registration, runtime
profile, V16 marker, and writer classes were checked.
The [deployment record](../data/phase9b-writes/v16-preparation/deployment.json)
does not prove which classes Bitwig has loaded.

## Implementation

The [protocol](../../../extension/src/main/java/com/ghostnote/extension/GridBreadthProtocol.java)
permits two commands per case. It requires two equal reads before the first
command and after each command. Each command takes another fresh snapshot
and checks it against the preceding pair before native entry.

The [host implementation](../../../extension/src/main/java/com/ghostnote/extension/GridBreadthHost.java)
uses the E305 command resolver. Its
[descriptor reader](../../../extension/src/main/java/com/ghostnote/extension/GridBreadthRead.java)
reads stored fields independently of the commands. It captures all module
identities, types, names, and positions. It captures atom membership, stored
values, and selected connections for Gates, or for Modulator Out and Lowpass.
It does not capture all values in unrelated modules.

The [handler](../../../extension/src/main/java/com/ghostnote/extension/handlers/GridBreadthHandlers.java)
requires a fresh UUID-named scratch track, the expected project and device,
mute, stopped transport, an unchanged selection revision, a live client,
and a stable native target epoch. Native witnesses check idle edit state,
document identity, module and atom ownership, Grid selection, and stable
engine state/connection identity. The engine may be active or inactive.
No engine transition is requested.

Read operations use `probe.gridRead`: `breadthStatus`, `breadthBind`,
`breadthRead`, `breadthInspect`, and `breadthRelease`. `breadthCommand` uses
only the existing WRITE-classified methods: `probe.gridValue` for boolean,
`probe.gridCable` for mapping, and `probe.gridModuleFactory` for factory.
The old fixed-fixture write routes remain retired. Survey, engine, legacy,
and breadth sessions exclude one another.

| Case | Implemented sequence | Live verdict |
|---|---|---|
| Gates boolean | Read false; set true; read field 210; restore false; read. Compare the remaining captured state exactly. | Unknown. No command ran. |
| Selected SEMtex mapping | Prove one source/target match and native domain; remove; read both endpoint lists; restore amount 129 and the observed flags; read. Only the selected mapping/reference identities and selected list position may change. | Unknown. No command ran. |
| Gates factory | Create one detached module; read its UUID, type, array, values, and ownership twice; dispose; read every retained object's disposal flag twice. These are separate document tasks. | Unknown. No command ran. |
| Gates attachment | The fixed Amplify lifecycle guards do not admit Gates. No new attachment path is added. | Refused by scope, as established in E305. |

Mapping comparison retains every unrelated identity and the relative order
of other mappings. Replacement identities must be absent from the initial
capture. The source input route and auxiliary fields remain in the comparison.

A failed read, command, final guard, client lifetime, or deadline locks the
session. A late native return does not clear the lock. At most two bounded
inspections can follow uncertainty. They can report descriptor state,
witness failure, ownership failure, and disposal counts. A failed getter
can still prevent a complete inspection. No command is automatically
repeated. A case can cancel before native entry if status proves zero
commands and no unfinished task or timeout. Once a native command starts,
failed verification prevents release and automatic scratch deletion.

The [driver](../../../brain/src/probes/phase9b-grid-writes.ts) reuses the survey
fixture workflow with the fixed [plan](../data/phase9b-writes/write-plan.json).
It creates a new muted track per case and uses independent TypeScript
predictions for each readback. It checks the preserved E276 control before
and after the batch. Cleanup requires a released writer and parks both
cursors before deletion. Preserved tracks, device banks, mixer, and
selection must match the entry snapshot.

## Verification and cost

The [verification summary](../data/phase9b-writes/v16-preparation/verification.json)
and logs record:

- 207 TypeScript tests pass, including survey/focused readers, the new
  driver, product call budgets, and live-adapter frame budgets.
  [Test log](../data/phase9b-writes/v16-preparation/brain-checks.txt).
- `npx tsc --noEmit` passes.
- Java protocol, descriptor bounds, identity, ownership, failure, and
  late-return controls pass. Pinned command, attachment-witness, and
  engine-witness metadata resolve.
  [Extension log](../data/phase9b-writes/v16-preparation/extension-checks.txt).
- The final Grid harness and all three archive profile/registration checks
  pass. [Final archive log](../data/phase9b-writes/v16-preparation/final-archive-checks.txt).
- All 13 E305 bytecode hashes match the pinned jar.
  [Trace check](../data/phase9b-writes/v16-preparation/trace-check.json).
- Context links and staged diff checks pass.

Offline fixtures use E304 atom observations, with synthetic module IDs,
positions, and witness state. The
[fixture generator](../../../brain/src/probes/phase9b-grid-write-fixtures.py)
keeps this distinction explicit. These are test inputs, not live identities.

The [cost model](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#v16-cost-model-and-live-continuation)
counts 39 protocol/guard calls, 27 document tasks, six commands, and
24 descriptor snapshots for all three cases. It includes pre-command reads.
Fixture operations and two control reads are additional. Snapshot traversal
is limited to 4,096 work units and one second, with 64 modules, 256 children,
and a result below 1 MiB. The detached tree is limited to 256 objects at
depth 12. The 48 MiB host allowance remains a planning figure, not a measured
peak. No live performance claim follows from these offline checks.

## Next

The operator must fully remove the controller and select the final matching
`ghostnote probe` product in the complete list. A power toggle or an earlier
duplicate can retain cached Java classes. The orange circular-arrow button
adds detected controllers; it does not reload the extension.

After confirmation, run `npm run probe:hello`, verify fresh initialization
and V16, and check competing drivers. Recheck the project, preserved state,
and stopped transport before the foreground run. Record live results,
timings, and cleanup in the next free E record. The conditional 9b.3a
listening session remains separate.
