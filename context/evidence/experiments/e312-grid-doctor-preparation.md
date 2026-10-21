---
title: E312 — Grid doctor preparation
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E312 — Grid doctor preparation

## Result

Session 9b.5 has an implemented and deployed V19 doctor. Offline checks pass.
The live pass has not started. Operator replacement and explicit consent
remain prerequisites. No accepted-build cache exists. This record does not
accept Bitwig 6.0.6 for resolved Grid writes.

The [preparation record](../data/phase9b-doctor/preparation.json) identifies
the deployed archive. The [candidate table](../data/phase9b-doctor/candidate.json)
has 72 member roles and 55 type roles. The original 69 roles retain E311's
selectors. Three separately traced undo roles extend the doctor only.
The original E311 report and selectors remain unchanged.

## Undo guard trace

The existing current-edit role cannot identify an undo entry after close.
`daR.NaF()` returns the current edit. The close path clears that field.
Using its idle null value to admit Undo would not prove ownership.

The local 6.0.6 bytecode trace establishes these additional candidates:

- `daR.MkF(): cZv` returns the undo head. The undo command reads the same
  field. This is the `undo-head` role.
- `daR.kG(): boolean` checks that the head exists, the journal is not
  replaying, and the head can be undone. This is `undo-available`.
- `daR.wi2(): void` checks the head's manager, records the replay state,
  invokes undo on that head, and updates the journal. This is `undo-command`.

The [supplemental selectors](../../../brain/src/probes/grid_doctor/undo-selectors.json)
use the existing name-free shapes and normalized use traces. They were
added after this trace. No original selector was regenerated or weakened.
The doctor resolves the combined table offline with the
[doctor resolver](../../../brain/src/probes/phase9b-grid-doctor-resolve.py).
Runtime metadata checks load classes without initialization. Vendor methods
are first invoked in the consent-gated scratch binding.

Before delete, the doctor retains the prior undo-head identity. The command
must produce a different, non-null head. Attachment must produce a head
that equals the associated owned edit. Before each undo, that exact head
must remain available. The guard and undo run in one document task. Two
later descriptor tasks must restore the expected graph. A head mismatch
locks the pass; it does not run a global application undo.

These are offline traces and implemented checks. Their live behavior remains
untested. The doctor does not claim general undo support.

## Protocol and limits

The [driver](../../../brain/src/probes/phase9b-grid-doctor.ts) uses three new,
muted scratch tracks in sequence. The first two test the resolved boolean
and mapping roles. The third uses the saved four-module control preset.
No existing control track is a write target. The operator has been asked to
resolve the conflict between NOW's instruction not to repeat breadth writes
and the brief's requirement to test every manifest invariant. No repeat
has been authorized or run in this preparation.

Each binding checks descriptor names, class IDs, property IDs, relationship
shapes, and serializer-filter results against saved schema controls. Each
command requires two equal snapshots and a fresh pre-command snapshot.
Each result requires two separate descriptor reads. The core order is:

1. Value change and restoration on the disconnected spare Amplify.
2. Cable connection and removal.
3. Detached Amplify creation, paired defaults, disposal, and paired lifecycle
   readback. Detached references must remain in the proved owned tree.
4. Spare connection, delete, owned-head undo, and cable removal.
5. Attachment and owned-head undo. The attachment trace validates the edit
   counters last: frames and instant edits change 0 → 1 → 0; long edits and
   locks remain zero. The lock set remains null.

The doctor keeps the project-root/edit-document distinction. It checks the
engine-state value and connection identity without requiring an active
engine or changing engine state. An existing Grid display, selection object,
and journal are required for the core fixture. The doctor refuses absence;
it does not create state through a guard. Selection, focus, unrelated graph
values, and original module layout must remain unchanged.

The native protocol permits 16 command requests across all three cases,
38 post-stage or initial read requests, and three bind tasks: 57 document
tasks on success. Each command also captures a fresh before state in its
own task. The driver adds setup, control reads, teardown, and preserved-state
checks. The ledger caps remain 96 doctor tasks, 1,500 wire calls, 15 minutes,
and 64 MiB of returned evidence. Each read has bounded schema, graph, and
ownership walks. The schema sentinel checks five schemas at most, each with
512 properties at most; its relationship walk is bounded by 64 modules.
Detached ownership is bounded by 256 objects and depth 12. Each projected
read keeps the existing 4,096-work and one-second bounds. The five-second
native timeout cannot interrupt an entered native command.

A failure or timeout latches the writer. An uncertain command is never
repeated. A failed pass can inspect at most twice. A pass with no attempted
native command can cancel its claim, remove the scratch track, and verify
the baseline. A durable local attempt file is created before the first
scratch write. It prevents automatic retries across controller reloads.
The accepted cache is created only after all role groups, scratch removal,
control comparisons, and complete preserved-state comparison pass. It is
research evidence; product write paths do not consume it.

Public descriptions remain v52. The wire method count remains 118, with
hash `2e939035ea90b8b0`. Doctor commands use the existing WRITE-classified
`probe.gridModuleAttach` method. Read and preparation operations use
`probe.gridRead`. The V18 research implementations retain their pinned
symbols. The doctor uses separate candidate-table constructors.

## Offline verification and cost

- [Python log](../data/phase9b-doctor/python-tests.txt): 22 tests pass. Both
  the original table and the 72-role doctor table survive complete class
  and member renaming in an inert jar model.
- [Java log](../data/phase9b-doctor/java-tests.txt): 37 doctor checks pass,
  along with the Grid harness, existing metadata tests, and archive checks.
  Cases include missing and duplicate roles, wrong receivers, changed jar
  metadata, stale before reads, unequal pairs, guard failure, uncertain
  commands, forbidden release, and bounded inspection.
- [TypeScript log](../data/phase9b-doctor/typescript-tests.txt): 22 focused
  doctor, breadth, and survey tests pass. Cache admission rejects incomplete
  role coverage and failed teardown. An uncertain command is not repeated.
- [Type checking](../data/phase9b-doctor/typecheck.txt) passes.

The offline doctor scan takes 4,607.087 ms and peaks at 189,759,488 bytes
RSS (180.969 MiB). It reads the same jar as E311. The scan is 2.2 percent
slower than E311's one-process sample. This is not a stable latency or
cold-disk claim. Candidate and selector resources are 26,143 and 47,585
bytes. The combined scan retains 126 code classes and 48 call-trace work
units. Host-call counts remain zero in this preparation. Live queue, wire,
document, traversal, and heap measurements belong to the continuation.

## Deployment and handoff

`./gradlew copyProbeExtension` deploys the archive by atomic rename. Its
SHA-256 is `1a3dd60a8a71cbb4c6c3cfe3f4a5653336d6c03e5032a81acc68c6496acb39dd`.
The [deployment log](../data/phase9b-doctor/deployment.txt) records success.
The build and deployed archive bytes match. Marker: `9b-grid-doctor-v19`.
A process check finds Bitwig bridge PID 24537, no matching probe driver,
and no established client on port 8686. No process is stopped.

The operator must fully remove the controller and add the final matching
`ghostnote probe` product in the complete list. A power toggle or an earlier
duplicate can retain cached classes. The orange circular-arrow button adds
detected controllers; it does not reload the extension. After confirmation,
run `npm run probe:hello` and check the profile, method count/hash, fresh
initialization, and all direct markers. Then obtain the brief's explicit
consent: save first; a failed check can require a Bitwig restart.

The last verified project state remains E310. This preparation sends no
bridge request, native command, transport command, engine command, or save.
No controller replacement is attempted. Continue with the planned
[9b.5 live pass](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#9b5-continuation--operator-gated-live-pass).

## Retrospective

An active-edit getter is not an undo-head getter. Future manifests for
undo tests must include the completed edit identity and its admission
predicate. An idle null current edit must not authorize Undo.
