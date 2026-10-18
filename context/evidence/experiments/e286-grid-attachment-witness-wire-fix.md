---
title: E286 — Grid attachment witness wire fix
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E286 — Grid attachment witness wire fix

## Result

V9 passes the replacement hello. Its first attachment request refuses before
construction because the empty selection witness changes during JSON encoding.
No factory, insertion, edit start, or disposal runs. The single recovery workflow
passes with the exact E283 baseline. V9 remains locked with zero factory attempts
and its recovery allowance used.

The cause is corrected and tested in V10. V10 is deployed for operator
replacement. Its marker is `9a-grid-attachment-v10`; the profile remains
`phase-8-probe-v1`, 117 methods, hash `b899e5d3d75a791d`. The
[deployment record](../data/phase9a-grid-attachment/deployment-v10.json) identifies
the archive. Keep [9a](../../plan/phase-9/9a-live-grid-editing-spike.md) active.
Successful attachment and its later acceptance gates remain unproved.

## Live entry and refusal

The operator confirmed replacement. `npm run probe:hello` passes all checks;
[hello summary](../data/phase9a-grid-attachment/hello-v9-summary.json) and
[full output](../data/phase9a-grid-attachment/hello-v9.txt) retain the evidence.
V9 initialized at `2026-10-18T17:47:40.874Z`, after deployment. No competing
Phase 8 driver was found. The live workflows ran sequentially.

The UI showed `gn-grid-spike`, an inactive engine, position 1.1.1.00,
the four baseline modules and two cables, and no module selected. The outer
MW and Expressions modules remained visible. Both existing unsaved markers
remained. The handler also admitted the stopped-transport and muted-track
checks. Saved project, preset, and backup hashes passed before the request.

`live-89-attach-first` contains the two equal before reads. The native witness
measures Sine as 3 by 2 cells, and each Amplify and Audio Out as 1 by 1 cell.
Positions match the baseline. Existing journal and selection state are present;
edit counters are idle, the selected list is empty, and owner/parent checks pass.

The command then refuses with `attachment-before-witness-changed` and
`writeAttempted=false`. Cached status reports `factoryAttempts=0`,
`nativeUnfinished=false`, and `writeLocked=true`. This was a probe encoding
defect, not a changed live selection. No retry or lock reset was attempted.

V9 constructed `selection: {selected: [], focus: null}` internally. The bridge
uses `new Gson()`, which omits null object members. The client therefore received
`selection: {selected: []}` and sent that object back. Exact equality failed
before `GridModuleAttachment.run`. The regression test reproduces this loss
through the same Gson response envelope and JSON parsing.

## Recovery and preservation

`live-90-recovery` uses the one permitted fresh bind, two fixed reads, and
release. Both captures match all 53 entry nodes and the full native witness.
They also match the E283 baseline byte-for-byte at the projected-node level.
Public selection at exit equals selection at entry. Edit state remains idle,
and all four native owner/parent checks pass. Final cached status confirms the
lock remains set, native work is finished, and both recovery reads are used.

The [UI witness](../data/phase9a-grid-attachment/ui-witness-v9-live.json) records
the unchanged patch after recovery. Two background screenshots lacked the
foreground controls. Raising the Bitwig window produced a complete image;
no document UI action was used. No save, undo, redo, reload, or fixture-file
replacement was needed.

The [preservation record](../data/phase9a-grid-attachment/preservation-v9-live.json)
confirms the same project and backup hash
`af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`
and preset hash
`1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.
Reproduce the saved-data checks and measurements with:

```sh
python3 -B tools/grid-spike/verify_attachment_refusal.py
```

## Fix and verification

`GridAttachmentSymbols.selectionJson` now omits an absent focus field before
comparison. A present focus still contains the selected module UUID. Native
identity checks and the exact witness comparison remain in place. No bridge
serializer, write lock, attempt limit, or recovery allowance is weakened.

The Java regression test covers empty and focused selections through response
encoding and request parsing. The hello, both live drivers, and saved attachment
verifier require V10. The wire inventory and public descriptions do not change:
v52, 44 tools. The [verification record](../data/phase9a-grid-attachment/verification-v10.json)
records these passing checks:

- `./gradlew check gridAttachmentSymbolsTest`.
- TypeScript typecheck and 61 focused driver/inventory tests.
- 15 Python semantic/evidence tests and the saved live-refusal verifier.
- Context links, whitespace, and archive identity.

E285's product call-budget and live adapter checks still apply. This fix adds
no host call, observer, read stage, or write stage. The planned successful
workflow remains 18 calls; recovery remains four. V10 needs a new live
measurement after operator replacement and a fresh passing hello.

## Measurements and limits

[Measurements](../data/phase9a-grid-attachment/v9-refusal-measurements.json).
The refused workflow has 15 calls, including cached status, and sums to
626.410 ms wire plus 150 ms settlement. This is not an attachment timing.
The command refusal takes 100.060 ms. No native factory or insertion duration
exists. Recovery has four calls and sums to 140.707 ms wire.

The first two native-witness reads take 96.183/66.165 ms wire and
52.368/33.517 ms document time. E283 fixture reads took 44.271–48.277 ms wire
and at most 12.922 ms document time. Both new entry reads exceed that wire
maximum by more than 20 percent. The recovery pair takes 46.912/45.806 ms wire
and 15.002/12.189 ms document time. The large first-use wire cost does not
repeat in that pair. V9 adds reflection resolution and native edit, selection,
rectangle, and ownership checks. First-use class work is plausible but not
isolated. The initial bind also takes 137.360 ms. Do not infer a cold-cache
bound or a successful 650 ms attachment budget from this refused workflow.

Heap samples rise 4/2 MiB for the entry reads and 2/2 MiB for recovery. Graphs
remain 53 nodes and 35,828 bytes; complete responses add native witnesses.
No more Grid reads ran after the recovery allowance was used. The V10 live
sequence must measure successful first/repeat attachment and explain any
remaining regression before it extends scope.

## Next step and retrospective

The operator must fully remove V9 and select the final matching `ghostnote probe`
product in the complete list. Wait for confirmation and run `npm run probe:hello`.
Require V10's marker and fresh initialization. Then follow the
[attachment run sequence](../../plan/phase-9/9a-native-attachment-design.md#attachment-run-sequence).
The exact fixture baseline is already verified; controller replacement is for
the corrected build, not a substitute for recovery of uncertain native edits.

Retrospective: the earlier fake tests compared in-memory JSON only. Cross-process
witness tests must pass through the actual response serializer and request parser.
The new regression test makes the null-omission behavior explicit.
