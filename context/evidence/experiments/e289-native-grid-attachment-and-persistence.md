---
title: E289 — Native Grid attachment and persistence
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E289 — Native Grid attachment and persistence

## Result

The bounded V11 attachment gate passes. Two separate factory calls each attach
one native Amplify at (2, 0). Both calls preserve the four existing modules,
two cables, and empty selection. Native registration, ownership, edit close,
and both independent after reads pass. One undo restores the exact baseline;
one redo restores the exact attached state. The second insertion survives
save and reopen. The exact baseline file is restored, reopened, and verified.
The outer Poly Grid identity is unchanged.

[9a](../../plan/phase-9/9a-live-grid-editing-spike.md) remains active. This proves
document attachment for one fixed type and position with an inactive engine.
It does not prove DSP adoption, arbitrary types, connected insertion, collision
relocation, cold-cache bounds, or general failure atomicity. No V11 recovery
was needed. The earlier V9/V10 failure evidence remains applicable to those
builds; this success does not replace their failure records.

## Entry and live sequence

[E288](e288-v11-restored-baseline.md) supplies the passing V11 hello and restored
baseline. The operator then confirms engine deactivation and an open Grid
editor. Screenshots verify both before admission. V11 remains loaded:
`phase-8-probe-v1`, 117 methods, hash `b899e5d3d75a791d`, marker
`9a-grid-attachment-v11`, initialization `2026-10-18T18:13:18.006Z`.
No new archive or controller replacement occurs in this continuation.

Data: [phase9a-grid-attachment](../data/phase9a-grid-attachment/).
The [UI record](../data/phase9a-grid-attachment/ui-witness-v11-live.json) separates
visual checks from native reads. The
[measurements](../data/phase9a-grid-attachment/v11-live-measurements.json) can be
reproduced with `python3 -B tools/grid-spike/verify_attachment_lifecycle.py`.
The verifier checks saved evidence; it does not infer UI behavior from a graph.

| Capture | Result |
|---|---|
| `live-94-v11-first` | First insertion; exact 61-node after graph and native witnesses agree twice. |
| `live-95-v11-undo-first` | One undo restores exact baseline nodes, UUIDs, and witnesses. |
| `live-96-v11-redo-first` | One redo restores exact attached nodes, UUIDs, and witnesses. |
| `live-97-v11-repeat-baseline` | One undo restores and verifies the baseline before the second attempt. |
| `live-98-v11-repeat` | Second insertion, with fresh UI witness, epoch, operation ID, and module UUID. |
| `live-99-v11-saved` | Save; both native captures still equal the second attached state. |
| `live-100-v11-reloaded` | Reopen edited file; all projected semantics and rectangles persist. |
| `live-101-v11-restored` | Reopen exact restored baseline; two reads match the preset and rectangles. |
| `live-102-v11-outer` | Two outer identity captures equal E281's capture. |
| `live-103-v11-read-repeat` | Matched read repeat preserves the exact restored graph and witnesses. |

Each insertion adds eight projected nodes. Only membership and the new nodes
change. The native receipt proves a positive registered managed ID for the
new Nitro atom; readback uses that value and checks every other projected
field exactly. The first and second module UUIDs are `7c25564e…` and
`3ee6f0fc…`. Both have native defaults, a 1×1 rectangle, and no cable.
Existing rectangles remain Sine (-4,-2,3,2), Amplify (-1,-2,1,1), Audio Out
(0,-2,1,1), and spare Amplify (-1,0,1,1).

Module UUIDs change on reopen. Reload comparison removes only these module
identities from the semantic and rectangle witnesses. It still checks types,
values, ports, cables, membership order, positions, dimensions, ownership,
idle edit state, and empty Grid selection. Paired raw captures agree within
each reopened epoch. Public selection is equal before and after each driver.

The edited file has 34,490 bytes and SHA-256
`a35542378cb80e67fcc22345b4457439b5732e7fcc1e0875b8d31662532f9807`.
Its copy remains at `/tmp/gn-grid-spike-e289-attached.bwproject`.
The [restore record](../data/phase9a-grid-attachment/baseline-restore-v11.json)
checks that the fixture is closed before file replacement. Final project and
backup bytes match SHA-256
`af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`.
The preset is unchanged. The
[preservation record](../data/phase9a-grid-attachment/preservation-v11-live.json)
retains sizes and hashes. The final UI shows the four-module baseline, 25% and
50% Amplify values, MW and Expressions, empty selection, and an inactive engine.
The fixture tab is unstarred. `gn-scale-test` retains its prior unsaved marker;
it was not edited, saved, or closed.

## Cost

| Measurement | First | Repeat |
|---|---:|---:|
| Full workflow, 18 calls | 567.499 ms | 558.234 ms |
| Attachment wire | 89.021 ms | 94.790 ms |
| Attachment document task | 45.332 ms | 48.108 ms |
| Native factory | 2.106 ms | 4.359 ms |
| Native edit start | 0.239 ms | 0.379 ms |
| Native insertion | 7.485 ms | 15.475 ms |
| Native edit close | 3.781 ms | 3.426 ms |
| Command heap sample increase | 6 MiB | 4 MiB |

Add 150 ms explicit cursor settlement to each workflow. Both stay below the
650 ms warm-wire and 16 MiB heap plan. The typical and maximum admitted cases
are identical: one fixed four-to-five-module edit. There is no added call or
write stage. Product budgets remain unchanged.

Compared with E283's first/repeat detached factory, command wire time rises
36%/109%, and document time rises 77%/272%. Full workflow time changes by
-4%/+10%. Attachment replaces detached disposal with edit ownership, insertion,
layout, native registration, and selection witnesses. These are different
primitives. The repeat confirms the higher command cost; it does not remove
it. Native insertion alone rises from 7.485 to 15.475 ms between attempts.
Queue time is only 0.126/0.109 ms. The two samples do not isolate the remaining
JVM, notification, and witness cost. Both allowed factory attempts are used;
no third timing request is made. Do not call either sample cache-cold.

Seven paired read workflows use 15 calls each, plus 150 ms settlement. Their
22 captures, including insertion before/after reads, take 4.127–21.860 ms on
the document thread. The maximum is 69% above E283's 12.922 ms read maximum.
The matched final pair takes 18.432/5.813 ms: the first read remains higher.
Native edit, selection, ownership, and rectangle witnesses add local work;
the attached graph also has eight more nodes. The final four-module pair
shows that graph growth alone does not explain the increase. Keep this cost
as a measured limit; no isolated cause is claimed.

Graphs encode 35,828 or 41,407 bytes, with 278/321 graph steps and 1,606/1,833
query steps. Read heap samples rise 0–2 MiB. These samples are neither peak
nor retained heap. Native file I/O and monitor waits still have no finite
cancellation bound. No live runtime code changed in this continuation.

## Verification and handoff

The [verification record](../data/phase9a-grid-attachment/verification-v11-live.json)
records saved-evidence checks, 17 parser/verifier tests, context links, and
diff checks. E287 retains the passing Java check, native symbol check,
TypeScript typecheck, and 63 focused tests for the unchanged V11 runtime.
A new offline verifier checks the complete successful sequence. Its regression
test accepts fresh reload UUIDs but rejects changed values and rectangles.
No public tool description changed: v52, 44 tools.

Final cached status has two factory attempts, two accepted after reads, no
write lock, no unfinished native task, and no recovery use. All epochs are
released. V11 remains loaded; the normal profile is not restored. Do not run
another factory on this initialization. Continue with the planned 9a engine
adoption design before another live stage.

Retrospective: the separate expanded-device button opens the Grid editor;
double-clicking its miniature does not. The action witness now records this
distinction. Keep UI observations separate from native persistence proof.
