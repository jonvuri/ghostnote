---
title: E315 — Document Undo correction for the Grid doctor
kind: evidence
state: active
updated: 2026-10-20
owner: phase-9b
---

# E315 — Document Undo correction for the Grid doctor

## Result

V20 replaces V19's direct journal Undo with the traced document Undo call.
Offline checks pass and the probe archive is deployed. The operator has not
replaced the running controller for V20. No new live pass runs. The recovered
E314 baseline is the last verified project state. No accepted cache exists.

The [archive verification](../data/phase9b-doctor/v20-preparation/verification.json)
records matching built and deployed bytes. Marker: `9b-grid-doctor-v20`.
SHA-256: `9627bb8d23587de365aee75ae0703e81b32c71faeb5eb13c29e8dec791b0d481`.
The wire profile stays `phase-8-probe-v1`, with 118 methods and hash
`2e939035ea90b8b0`. Public tool descriptions stay v52.

## Complete command trace

The [local bytecode trace](../data/phase9b-doctor/v20-preparation/undo-caller-trace.json)
records method references, offsets, class hashes, and exception tables from
the pinned 6.0.6 jar. It does not initialize vendor classes or contact Bitwig.

1. Project method `Svr.plz()` obtains its edit document through `Cix()` and
   calls `cZl.OTd()`. After normal return, `rFJ()` updates Undo/Redo labels
   and availability. Other document callers also invoke `OTd()` directly.
2. `cZl.OTd()` checks its enable gate `eJS()`. It gets the current manager's
   journal through `Ode()` and checks `daR.kG()`. It sets document field
   `EbT` to true, invokes `daR.wi2()`, then clears `EbT` on normal return.
   The existing `Mkn()` role reads this replay field.
3. The `cZn` relationship insertion and removal hooks test document `EbT`.
   When it is true, they skip ordinary undo recording. Other relationship
   bookkeeping still runs. No new recording edit or begin/end wrapper is
   required for this document Undo path.
4. `daR.wi2()` retains the owned head in its replay-head field `kG`, replays
   that edit, clears the replay head, and moves the undo head to the preceding
   edit on normal return.
5. Neither `cZl.OTd()` nor `daR.wi2()` has an exception handler around replay.
   An exception can leave replay state set. Ghostnote must retain its latch.
   It must not clear vendor flags, retry Undo, or infer recovery from a graph.

This explains E313 more precisely. The insertion hook reached a null
recording edit because V19 did not set the document replay flag. The correct
path suppresses recording during replay. Creating a recording edit would be
an unproved workaround. E313 remains unchanged as the failure record.

The doctor calls the bound edit document's method, not a global app action.
Before entry it proves that `cZl.nrP()` selects the exact manager of the bound
Grid. It finds the existing journal in the document map without creating one.
The document's journal lookup therefore reaches the same proved journal.
The doctor does not call the project's UI label refresh; the separate live
pass must prove native restoration through paired descriptors. This session
makes no UI-label or live Undo claim.

## Resolved roles and implementation

The [V20 candidate](../data/phase9b-doctor/v20-preparation/candidate.json)
has 76 member roles and 55 type roles. The original 69 E311 roles stay
unchanged. The V19 table, supplement, and evidence remain intact. The
[V20 supplement](../../../brain/src/probes/grid_doctor/undo-selectors-v20.json)
changes `undo-command` to the edit-document receiver and adds four read roles:

| Role | Pinned 6.0.6 result | Required check |
| --- | --- | --- |
| `undo-command` | `cZl.OTd(): void` | One owned document replay; the expected prior head and idle state return. |
| `document-undo-enabled` | `cZl.eJS(): boolean` | True before entry. |
| `document-manager` | `cZl.nrP(): Ibf` | Same bound manager before and after entry. |
| `journal-replay-head` | `daR.kyi(): cZv` | Null before and after normal return. |
| `journal-recording-edit` | `daR.YLA(): cZv` | Null at idle admission and after normal return. |

Undo and Redo have equal local normalized method traces. The first candidate
scan correctly [refuses two matches](../data/phase9b-doctor/v20-preparation/ambiguous-caller-refusal.json).
A two-edge call trace distinguishes the journal Undo body from Redo. The
resolver test checks that removing this trace restores the refusal. The
complete renamed jar model resolves the same roles. No obfuscated name is
used as a selector, and no original selector is weakened.

[GridDoctorUndo](../../../extension/src/main/java/com/ghostnote/extension/GridDoctorUndo.java)
checks the exact owned head, expected prior head, document, manager, journal,
availability, and idle recording/replay state. It checks the freshness guard
immediately before one document call. After normal return it requires the
same document/manager/journal identities, the exact prior head, and idle
state. It does not catch an exception to repair native state.

Both delete Undo and attachment Undo use this helper. Each stores the prior
head before its owned edit. The existing protocol requires equal prior reads
and a fresh capture before the command. Two later independent reads must
still prove restoration. A context receipt cannot substitute for them.
Core witnesses now also reject a non-null recording edit or replay head.
The final attachment counter trace remains the last counter validation.

## Revised-pass boundary

The driver requires a new explicit consent string for one revised V20 pass
on the same fingerprint, including boolean and mapping checks. It verifies
the original attempt file against E313's saved bytes and keeps that file.
It creates a separate `<fingerprint-hash>.v20.attempt.json` with exclusive
creation before scratch setup. A second V20 attempt, altered original record,
wrong fingerprint, old consent, or existing acceptance cache is refused.

The three fixed scratch fixtures and their order remain unchanged. The two
breadth cases are included because acceptance requires one complete pass of
the newly bundled 76-role table and its teardown. Their repetition requires
the operator's new consent. The attempt mechanism implements that specific
exception; it does not authorize it. No V20 attempt file exists now.

The cache rule stays unchanged: all role groups, paired reads, scratch
removal, final control reads, and full preserved-state comparison must pass.
The cache grants no product write authority. The original failed attempt
record remains byte-for-byte equal to E313's copy.

## Verification and cost

- [Python](../data/phase9b-doctor/v20-preparation/python-tests.txt): 22 tests
  pass, including complete renamed-jar resolution and Undo/Redo ambiguity.
- [TypeScript](../data/phase9b-doctor/v20-preparation/typescript-tests.txt):
  23 focused tests pass. Revised consent, original-record preservation,
  duplicate attempts, complete-role acceptance, and uncertain-write handling
  are covered. [Type checking](../data/phase9b-doctor/v20-preparation/typecheck.txt)
  passes.
- [Java](../data/phase9b-doctor/v20-preparation/java-tests.txt): 82 doctor
  checks pass, plus the Grid harness, three existing metadata checks, and
  archive verification. Inert models cover missing replay context, non-idle
  recording state, changed identities or heads, disabled Undo, stale guards,
  and replay exceptions at both Undo stages. Exceptions prohibit retry and
  release. No vendor class is initialized by these checks.
- [Deployment](../data/phase9b-doctor/v20-preparation/deployment.txt):
  `copyProbeExtension` passes. Built/deployed bytes and bundled table resources
  match. No controller replacement is attempted.

The successful [scan](../data/phase9b-doctor/v20-preparation/scan.txt) takes
4,420.617 ms and peaks at 186,974,208 bytes RSS (178.313 MiB). It retains
129 code classes and uses 72 call-trace work units. Candidate and selector
resources are 27,485 and 49,606 bytes. The scan is 4.0 percent faster than
E312's sample; this is not a stable latency claim.

The [performance model](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b5a-undo-correction--model-before-implementation)
keeps 16 native command requests, 38 independent reads, three binds, and
57 successful doctor tasks. Each Undo adds two bounded state captures and
uses one document call in place of one journal call. Each core witness adds
two getters. No extra wire call, task, wait, or projected object is added.
The existing memory, reply, traversal, and lifetime bounds stay in force.
E313's boolean and mapping timing increases remain unexplained. They must
be measured and assessed in the authorized live pass; this correction
does not claim to fix them.

No bridge, native, engine, transport, save, or restart command runs in this
preparation. V19 at E314's initialization remains the last verified runtime.
The normal profile is not restored. Continue with
[9b.5b](../../plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b5b--revised-v20-live-doctor).

## Retrospective

For replay operations, trace the caller's mode flags and the recording hooks
together. A null recording edit can be correct when replay suppresses those
hooks. Do not add an edit solely to satisfy a failed low-level journal call.
