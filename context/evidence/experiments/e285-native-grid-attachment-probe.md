---
title: E285 — Native Grid attachment probe implementation
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E285 — Native Grid attachment probe implementation

## Result

V9 implements the bounded attachment contract from
[E284](e284-native-grid-attachment-design.md). Offline checks pass. The research
archive is deployed. Operator replacement and a fresh hello are the next gate.
Keep [9a](../../plan/phase-9/9a-live-grid-editing-spike.md) active.
No attachment, factory, or other live request ran in this session. V8 is the
last confirmed loaded build, with both factory attempts used.

V9 is `phase-8-probe-v1`, 117 methods, hash `b899e5d3d75a791d`, and marker
`9a-grid-attachment-v9`. The new `probe.gridModuleAttach` method is a write
in the probe profile only. Normal remains 92 methods; capture remains 97.
The public descriptions remain v52 with 44 tools. No description changed.

## Implementation

- `GridModuleAttachment` records each native stage separately. It admits one
  factory result and one insertion body. It proves edit ownership before
  insertion and again before the sole close. It never disposes a module after
  insertion entry, including a throw before list insertion.
- `GridAttachmentSymbols` resolves the exact pinned native overloads before
  construction. It checks existing edit, selection, member, parent, and layout
  state without creating missing state. Its native handles remain task-local.
  `GridAttachmentLayout` models the full bounded row layout and refuses motion.
- `GridProbeSafety` shares the two-attempt limit across factory and attachment
  calls. It retains prior UUID strings, scalar receipts, and a write lock.
  Two independent after reads must agree before a successful release. A failed
  client check sends `uncertain: true` on release and locks writes.
- `GridReadJob` separates reply completion from actual task completion. A
  timeout before task entry skips the task. A timeout during native work cannot
  interrupt it. Late cleanup continues, but no second reply or unlock occurs.
- Recovery uses one fresh bind, two fixed reads, and release. It requires the
  same weak document, track, and device identity after native completion.
  It cannot clear the lock. The graph reader rejects more than five members
  or two cables before traversal of the excess relationship. It retains edit
  and membership diagnostics when the graph is incomplete.
- The live driver checks the saved project, preset, and backup hashes. It needs
  a fresh UI record of an inactive engine. The handler also requires stopped
  transport and a muted fixture track. One probe-only mute subscription was
  added to cursor 0. No normal-profile observer or product call budget changed.
- The driver checks all 61 after nodes and both native witnesses. A separate
  Python verifier compares detached defaults with E283 and validates the saved
  first/repeat evidence. Read-only `attachment` mode supplies native witnesses
  for undo, redo, reload, and baseline checks.

The implementation clarifies two native details. Selection fields `JD1` and
`GC` are declared in `YJr`, which `Gn` inherits. The metadata check found and
corrected an initial declaring-class error before deployment. Also,
`cZl.ffA(Ibf)` can create a missing journal. The probe reads the existing
`cZl.W2P` map and refuses a missing entry. Live availability of that entry
remains an admission condition. The design contract now states both details.

## Verification

[Verification record](../data/phase9a-grid-attachment/verification-v9.json).

- `./gradlew check gridAttachmentSymbolsTest`: pass. This includes the Java
  lifecycle, graph, edit-state, selection, layout, attempt-limit, timeout,
  recovery, and archive-profile checks. The signature check resolves the pinned
  installed jar without initializing vendor classes or invoking native methods.
- TypeScript typecheck: pass.
- Attachment driver, wire inventory, product call-budget, and live adapter
  tests: 242 pass. The success driver uses exactly 18 calls. Recovery uses four.
- Python Grid evidence and semantic tests: 15 pass. Synthetic test data is
  temporary; it is not live attachment evidence.
- Context links and whitespace: pass.

The fake host covers refused or thrown start, true start without proved edit,
wrong frame/edit identity, association failure, throws before and after member
insertion, lost edit ownership, close false/throw, changed selection, and
late completion. Tests assert no unowned close and no post-insertion disposal.
Bounds include overlapping rectangles, edge contact, negative origins, inserted
x ties, invalid dimensions, excessive row span, overflow, and graph limits.

## Cost and limits

The fixed typical and maximum scopes remain four-to-five modules and two
cables. Success has 18 sequential wire calls, five live captures, two local
detached captures, one construction, and one insertion edit. At about 24 ms
per turn, the transport floor is about 432 ms. The plan remains 650 ms summed
warm wire plus 150 ms settlement and 16 MiB temporary heap. Native witness
checks add local work, and one Boolean subscription is added at probe init.
After graphs have 61 nodes instead of 53. The response cap remains 1 MiB.

Failure-only recovery adds four calls, two bounded captures, and no writes.
A cached failure-status call can add one wire call before recovery; it queues
no document task. E283 measured 508.250–590.554 ms summed wire for detached
construction/disposal. V9 adds edit, layout, ownership-transfer, and notification
work in place of disposal. These costs remain unmeasured. The planned live gate
must record first/repeat wire, queue, native-stage, payload, and heap samples,
and explain a regression above 20 percent. No live performance claim is made.

A missing existing journal or selection state refuses admission. Actual native
rectangles must pass the layout guard. A changed route or inaccessible Grid
root can prevent recovery evidence. Controller replacement alone does not
repair a damaged document. There is no native cancellation, rollback guarantee,
or finite bound on a native call that does not return. Engine adoption, UI,
undo/redo, repeat, and edited reload remain live acceptance gates.

## Deployment and handoff

[Deployment record](../data/phase9a-grid-attachment/deployment-v9.json) records
the archive and pinned host jar. [Preservation record](../data/phase9a-grid-attachment/preservation-v9.json)
checks the saved project, preset, and backup. No fixture file or UI state was
changed. The last live observations remain those in E283.

Follow the [run sequence](../../plan/phase-9/9a-native-attachment-design.md#attachment-run-sequence).
The operator must fully remove the old controller and select the final matching
`ghostnote probe` product in the complete list. Wait for confirmation, then run
`npm run probe:hello`. Check profile, 117 methods, method hash, marker, and fresh
initialization before live work. A power toggle, an earlier duplicate, and the
orange detected-controller button are not valid replacements.

## Retrospective

Resolve native metadata against the pinned jar before wiring a new handler.
This caught the inherited-field mismatch without a live attempt. Keep raw-map
lookups explicit where a native getter can create state. The signature harness
and updated design now provide these checks for the next stage.
