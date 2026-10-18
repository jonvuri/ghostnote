---
title: E284 — Native Grid attachment design
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E284 — Native Grid attachment design

## Result

The pre-implementation design is complete for one native Amplify attachment.
The [design contract](../../plan/phase-9/9a-native-attachment-design.md) defines
edit admission, owned-edit close, partial-failure handling, bounded recovery
reads, selection preservation, layout admission, cost, and acceptance checks.
Keep [9a](../../plan/phase-9/9a-live-grid-editing-spike.md) active. Its next
step is probe implementation and offline checks under this contract.

This session made no live request, factory call, attachment call, UI change,
extension build, or deployment. V8 remains the last confirmed loaded build;
both factory attempts remain used. No controller replacement is pending.
No runtime implementation or public description changed (v52, 44 tools).
The only executable addition is an offline scalar layout model.

## Trace findings and design choices

The [inspection manifest](../data/phase9a-grid-attachment/environment-design.json)
records the unchanged Bitwig 6.0.6 jar hash and fresh `javap -p -c` hashes for
29 classes. Vendor bytecode remains in `/tmp/gn9a-attachment-design` and is
not staged. Repeat the manifest command for each named class to reproduce
its hash. No reference clone was used or changed in this session.

| Trace | Finding | Design choice |
|---|---|---|
| `gOr.eOi(Collection,int,int,boolean,ITE)` | Calls start, insertion body, optional callback, and close. There is no failure handler. | Do not use the wrapper. Invoke its native body under a checked start and close. |
| `gOr.eOi(String)` / `hhJ()` | Discard the start and close booleans. Start also associates the Grid with the current edit through `aJp()`. | Use inherited `ikl.ffA(String,wfl[])` and `hoE()`; retain `aJp()` after proved admission. |
| `ikl` → `Ibf` → `daR` / `cZv` | Start can bypass normal recording. A normal start pushes a frame and increments a counter. Close pops before later work that can throw. | Require a recording context, no outer edit, one owned frame and edit, and one checked close. Never retry close or close after an unproved start. |
| Native collection body | False copy mode uses the supplied module. Null `RHk` keeps native membership and the complete layout pass. | Use the exact package-private overload; no direct append, duplicate hook, or copy. |
| `NHx.ffA(had,int)` / `HEV` relationship hooks | Relationship bookkeeping runs before list insertion and parent assignment. `daR` forwards undo records into `cZv`. | After insertion entry, null parent or absent membership cannot authorize disposal. No detached disposal follows an insertion attempt. |
| `gOr.ffA(had,int)` | Retains base ownership, Grid relationship hooks, `UZp`, bounds, and notifications. | Keep virtual dispatch through the native body. Selection callback removal does not remove these steps. |
| `oaA` → `Gn` / `YJr` | Replaces module selection and changes focus. | Omit the callback. Check internal Grid selection as well as public mixer selection. |
| `NHx.cG3(String)` | Creates and attaches missing display state. | Read only the existing map entry and selection fields. Refuse missing state instead of creating it. |
| `DtR` / `QHo` / `llL` | x/y are integer getters; width/height are signed byte getters. Layout sorts a copy, puts inserted modules first on x ties, and moves rectangles right by row occupancy. | Read all five rectangles. Bound dimensions and vertical span. Simulate the full pass and require no movement. |

The start path with an empty lock set is the same as the public insert wrapper.
It avoids `Ibf`'s nonempty-lock wait path. It does not bound native construction,
callbacks, monitors, close, or file I/O. A checked close is not a rollback proof.
A partial insertion can remain after a throw even if the close succeeds.

The design distinguishes the watchdog response from actual native completion.
V8's current handler blocks all Grid reads after uncertainty and clears `busy`
at timeout. Its proposed successor must keep a separate write lock and task
completion signal. Only a completed native task permits one fresh bind, two
bounded diagnostic reads, and release. Late completion cannot clear the lock
or produce a second response. Recovery never performs an automatic undo, delete,
save, retry, or native-state reset.

## Layout design check

The [offline checker](../../../tools/grid-spike/check_attachment_layout_design.py)
models the traced sort and row pass at the four known baseline positions and
the candidate (2, 0). It enumerates width/height hypotheses 1–8 for Sine,
Amplify, and Audio Out. This model gives all three Amplify modules equal
dimensions; the future live guard must read them independently.

```sh
python3 -B tools/grid-spike/check_attachment_layout_design.py
```

The [result](../data/phase9a-grid-attachment/layout-design-check.json) covers
262,144 combinations. The rectangle guard refuses 260,800 overlaps. All 1,344
admitted combinations preserve every position in the simulated native pass.
Checks also cover inserted-first ties, half-open edge contact, negative origins,
a 16-row span, and refusal of a 17-row span before allocation.

These are scalar hypotheses, not measured native dimensions or execution of
vendor layout code. E283's semantic projection omits width/height. The design
therefore requires fresh native dimension reads before the first insertion.
Unequal Amplify dimensions, integer overflow, failure injection, and native
signature checks are explicit tests for the next implementation stage.

## Cost and preservation

The [ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) keeps the proposed
18-call success budget: five fixture captures, two detached captures, one
construction stage, and one insertion edit. Typical and maximum scope are
four-to-five modules and two cables. Allow 650 ms summed warm wire, 150 ms
settlement, and 16 MiB temporary heap. The 18 turns give a rough 432 ms floor
at 24 ms each. Local edit, selection, membership, and rectangle checks add no
wire call or write stage. The after graph grows from 53 to 61 nodes.

E283 measured 508.250–590.554 ms wire and 2–4 MiB sampled heap. The extra
allowance covers edit bookkeeping, ownership transfer, notifications, and
layout in place of detached disposal. Native cold I/O and first-use work remain
unmeasured. The failure-only diagnostic path adds at most four calls and two
captures after task completion, with no writes. Its rough transport floor is
96 ms. A native task that does not finish has no finite recovery-time bound.
No live path changed, so there is no new performance measurement or regression
claim. Product call budgets remain unchanged.

The [file check](../data/phase9a-grid-attachment/preservation-design.json)
confirms the saved project and backup SHA-256 remain
`af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`.
The preset remains
`1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.
No project save, restore, or reload ran. Live state was not re-read; E283
remains its latest witness. Its unsaved marker and inactive engine are prior
observations, not new assertions about current host state.

## Verification and retrospective

The [verification record](../data/phase9a-grid-attachment/verification-design.json)
records the jar and bytecode hashes, reproducible layout-model result, saved
fixture hashes, context links, and diff checks. No runtime test or live gate
is claimed. The design lists the required offline and live acceptance checks
before the next deployment and attachment verdict.

Retrospective: a native getter name does not establish read-only behavior.
Trace selection accessors before placing them in preservation checks. Keep
edit bookkeeping and object cleanup in separate failure-state rows; a null
parent is insufficient once undo recording can have started.
