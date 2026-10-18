---
title: E287 — Grid attachment and managed identity
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E287 — Grid attachment and managed identity

## Result

V10 passes the replacement hello. One Amplify is constructed and inserted at
(2, 0). The owned edit closes successfully. The first independent read stops
the workflow because the new Nitro atom's managed-object ID is 4000, while
the detached-default prediction requires 0. The write lock stays set.

The single recovery workflow returns two equal 61-node graphs. Their only
unexpected delta is that ID. Both native witnesses equal the prediction:
five ordered modules, unchanged existing rectangles, two cables, Grid owner
and parent, idle edit state, and empty selection. Public selection is unchanged.
The UI shows the fifth Amplify at 100%. This establishes the observed insertion,
but does not pass the full attachment gate. Keep 9a active.

V11 adds a checked managed-ID receipt. Offline checks pass, and V11 is deployed.
Operator inspection, baseline reopening, controller replacement, and a fresh
hello are required before more live work. The live project still has five
modules. Do not save it. No undo, redo, repeat, or reload test ran after the stop.

## Entry and live records

The [hello summary](../data/phase9a-grid-attachment/hello-v10-summary.json) and
[full output](../data/phase9a-grid-attachment/hello-v10.txt) pass all checks:
`phase-8-probe-v1`, 117 methods, hash `b899e5d3d75a791d`, marker
`9a-grid-attachment-v10`, initialization `2026-10-18T18:02:08.345Z`.
No competing Phase 8 or Phase 9 driver was found.

The entry UI shows an inactive engine, position 1.1.1.00, the four-module
baseline, two cables, and no selected item. The handler admits stopped transport
and a muted track. Project, preset, and backup hashes match the documented
baseline. Both before graphs equal all 53 E283 nodes.

[Live data](../data/phase9a-grid-attachment/): `live-91-attach-first` retains
the command receipt, before pair, failed-read message, and cached status.
`live-92-recovery` retains the fresh bind and two recovery captures.
The new UUID is `b92d31fd-5ecd-4d07-a7ca-9426e03ae905`.

Construction proves 77 owned objects and equal detached defaults. Edit start,
ownership, insertion, and close all return successfully. Detached disposal is
never attempted. The command says that independent readback is required.
The following read fails with `attachment-independent-readback-disagrees`.
Its `writeAttempted=false` describes that read request; the preceding command
has `writeAttempted=true`. The command's complete lifecycle does not override
the later workflow failure.

Recovery runs only after cached status reports `nativeUnfinished=false`.
The [exit record](../data/phase9a-grid-attachment/exit-v10-live.json) confirms
one factory attempt, a latched write lock, zero accepted after reads, and both
recovery reads used. No more Grid document reads follow recovery. The second
factory allowance remains unused and is not available through this lock.

The [UI witness](../data/phase9a-grid-attachment/ui-witness-v10-live.json) records
unchanged selection, the existing layout and cables, the new Amplify, and the
outer MW and Expressions modulators. Raising the window is the only UI action.
Both prior unsaved markers remain. The
[preservation record](../data/phase9a-grid-attachment/preservation-v10-live.json)
proves unchanged saved files, not a restored live baseline. Project and backup
SHA-256 remain `af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`;
preset SHA-256 remains `1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.

## Native trace and V11 correction

The [trace record](../data/phase9a-grid-attachment/environment-managed-id-trace.json)
pins the same host jar and records bytecode hashes. Vendor bytecode remains in
temporary files. Property 14 reads `HEV.WKy()`. `uX1.NaF(HEV)` assigns the next
ID through `nhl(int)` when the old ID is zero and registers the object.
`uX1.Uhv(HEV)` traverses the owned subtree. `uX1.ffA(int)` reads the registry
through `UL` / `qOs`. The getter and lookup do not assign an ID.

The [design](../../plan/phase-9/9a-native-attachment-design.md#managed-identity-after-attachment)
was extended before implementation. After close, V11 follows two fixed descriptor
steps to the new Nitro atom. It requires exact class, contents ownership, the
same document context, a positive ID, and a registry result identical to that
atom. It emits the ID and proof in the scalar receipt. No native setter or
registration method is invoked by the probe.

The expected graph uses that receipt only for the new Nitro atom's property 14.
Existing projected IDs must differ. Detached captures still require zero.
Both independent reads must exactly equal the complete expected graph and
witness. V11 does not hard-code 4000, omit the field, reset the lock, or retry.
The command-time registry proof remains untested live.

Tests reject invalid or duplicate IDs, a wrong registry object or context, and
a changed ID in independent readback. The TypeScript saved-data regression
matches both V10 recovery graphs under the new rule. It explicitly models the
new receipt; it does not claim that V10 checked registration.

## Cost and verification

[Measurements](../data/phase9a-grid-attachment/v10-registration-measurements.json)
can be reproduced with `python3 -B tools/grid-spike/verify_attachment_registration.py`.
The stopped workflow has 16 calls and 528.919 ms summed wire, plus 150 ms
settlement. Recovery has four calls and 153.445 ms summed wire. The command
takes 71.902 ms wire, 27.789 ms document time, and 0.111 ms queue wait.
Native construction/start/insertion/close take 2.824/0.511/5.592/2.421 ms.

Against E283's first detached request, command wire and document time rise
9.6% and 8.6%. Insertion, edit checks, layout, and close replace disposal.
The command heap sample rises 8 MiB, versus E283's 4 MiB first sample. The
attachment path adds witness, edit, and notification work; the allocation share
is not isolated. The sample is below the 16 MiB plan and is not peak or retained
heap. A successful repeat is still needed; the lock forbids a timing retry now.

Entry reads take 46.264/47.705 ms wire and 6.450/8.795 ms document time. They
do not repeat E286's large first-use cost and fit E283's maxima. Recovery
document reads take 8.452/11.159 ms; each heap sample rises 2 MiB. The new
61-node graphs encode 41,407 bytes, below the estimated 42 KiB. This stopped
workflow does not establish the complete 18-call success budget.

V11 adds two descriptor steps and local identity/registry reads in the same
task. It adds no wire call, graph capture, observer, or write stage. The fixed
scope retains the 18-call, 650 ms warm-wire plus 150 ms settlement, and 16 MiB
plan. Product call budgets do not change. Public descriptions remain v52,
44 tools; no description changes.

[Verification](../data/phase9a-grid-attachment/verification-v11.json): Java
checks and pinned native symbols pass; TypeScript typecheck and 63 focused
tests pass; 16 Python tests and both saved failure verifiers pass. Archive
identity, context links, and whitespace checks pass. The
[V11 deployment](../data/phase9a-grid-attachment/deployment-v11.json) records
the archive hash. No V11 live call has run.

## Recovery boundary and next step

The failure contract requires operator inspection before more writes. Inspect
the fifth Amplify and keep the engine inactive. Close only `gn-grid-spike`
without saving. Reopen its unchanged saved baseline project. Preserve the
other project's unsaved changes. The saved project already equals the verified
backup, so no file replacement is needed unless its hash changes.

Then fully remove the old controller and select the final matching `ghostnote
probe` in the complete product list. After confirmation, require a fresh V11
hello and paired native baseline reads before the first V11 insertion. Follow
the remaining [attachment sequence](../../plan/phase-9/9a-native-attachment-design.md#attachment-run-sequence).
Do not treat controller replacement alone as fixture recovery. Undo/redo,
independent repeat, edited-state reload, and exact final baseline restoration
remain part of that sequence.

Retrospective: detached scalar equality omitted the host's registration step.
For each ownership transfer, trace projected runtime identities separately
from content defaults before predicting exact readback. The new receipt and
saved-data regression make this boundary explicit.
