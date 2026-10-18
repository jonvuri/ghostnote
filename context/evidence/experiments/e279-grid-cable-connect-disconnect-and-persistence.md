---
title: E279 — Grid cable connect, disconnect, and persistence
kind: evidence
state: active
updated: 2026-10-18
owner: phase-9a
---

# E279 — Grid cable connect, disconnect, and persistence

## Result

V5 connects and disconnects Sine OUT at the spare Amplify IN on the four-module
Poly Grid fixture. Four writes pass two fresh after reads each. Only the
target input's source refs and count change in the 53-node projection. The UI
shows the new cable and its removal. Undo and redo pass for both operations.
The connected state survives save/reload. The final saved and reloaded fixture
matches the unchanged baseline preset. The outer device UUID is unchanged.

This advances [9a](../../plan/phase-9/9a-live-grid-editing-spike.md). It does not
close the spike. The engine remains inactive, so this proves document and UI
behavior, not DSP adoption. General port compatibility, feedback, larger
patches, and module creation/deletion remain unproved. V6 prepares the next
bounded source-replacement test and awaits operator replacement.

## Entry and preservation

The operator confirmed V5 replacement. `npm run probe:hello` passed:
`phase-8-probe-v1`, 114 methods, hash `9dc11c1f9958f4d8`, marker
`9a-grid-cable-v5`, initialization `2026-10-18T15:20:56.867Z`. This is later
than the [V5 deployment](../data/phase9a-grid-cables/deployment-v5.json).
The installed Bitwig 6.0.6 jar is still pinned by
[E278](e278-grid-cable-probe-preparation.md). No competing phase8 or phase9
driver was found. All live drivers ran in one foreground sequence.

The active project is `gn-grid-spike`, track `grid-probe`, with one Poly Grid.
The track is muted at -10 dB and armed at entry and exit. Transport is stopped
at 1.1.1.00. The engine is inactive; no audio setting changed. The fixture tab
already had an unsaved marker before the first cable call. Its saved file
hashes and graph semantics matched E277. The other `gn-scale-test` tab remains
open with its prior unsaved marker. It was neither saved nor edited.

Every driver checks project, selection, current route, fresh epoch, complete
before reads, exact expected graph, and saved-file hashes. Successful writers
also require unchanged mixer selection. Each epoch was released. E278's fixed
guard tests cover invalid inputs offline; no live incompatible-port or stale-
identity mutation was attempted in this sequence.

## Live sequence and evidence

Data root: [phase9a-grid-cables](../data/phase9a-grid-cables/).
The [UI witness](../data/phase9a-grid-cables/ui-witness-v5.json) records direct
observations and keyboard actions. Screenshots remain in the conversation.
The [measurement report](../data/phase9a-grid-cables/v5-measurements.json) is
reproduced by `python3 -B tools/grid-spike/verify_cable_evidence.py`.

| Capture directory | Operation and independent result |
|---|---|
| `live-41-baseline` | Two equal reads; four modules and the original two edges match the preset. |
| `live-42-connect` | Connect Sine OUT to spare Amplify IN. Two reads show only the source relationship delta. UI shows the third cable. |
| `live-43-disconnect` | Disconnect the exact edge. Two reads equal the original raw nodes; UI shows two cables. |
| `live-44-undo-disconnect` | One host undo restores the exact connected raw graph. |
| `live-45-redo-disconnect` | One host redo restores the exact baseline raw graph. |
| `live-46-connect-repeat` | Repeated connect passes; no unrelated graph change. |
| `live-47-undo-connect` | One host undo removes the edge and restores the exact baseline. |
| `live-48-redo-connect` | One host redo restores the exact connected graph. |
| `live-49-saved-connected` | Save and capture the three-edge state. |
| `live-50-reloaded-connected` | Close and reopen the saved project. Topology and values agree; module UUIDs change. |
| `live-51-restore` | Disconnect with reacquired identities. Two reads restore baseline semantics. |
| `live-52-saved-baseline` | Save the restored two-edge state. |
| `live-53-final-reload` | Close and reopen. Two reads match the baseline preset; UI shows four modules, two cables, and 25%/50% values. |
| `live-54-outer-identity` | Outer device UUID and name match E277's `live-40-v4-host-identity`. |
| `live-55-read-timing-repeat` | Two extra baseline reads investigate the cold timing outlier; semantics remain at baseline. |

The verifier checks all pairs, command guard captures, exact requested deltas,
unchanged device inventory and preset hashes, selection, method/build markers,
undo/redo comparisons, edited and restored reloads, changed module UUIDs, and
the outer device identity. Its scope is the semantic projection, not a complete
serialized device or arbitrary external route graph.

Final project: 34,128 bytes, SHA-256
`8d2c2e863989cd692a8aa66f71ed9bb9e46cc966263573dba409299b9783677e`.
The restored project bytes differ from the earlier save; semantics agree.
The preset remains 10,451 bytes, SHA-256
`1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.
Outer Poly Grid UUID: `e3aebd87-3e23-4de1-8d96-da410b00d77d`.

## Measurements

Four setter calls take 45.601–46.406 ms wire time and 4.388–11.801 ms document
time. Repeated connect takes 45.601 ms wire and 9.240 ms document time. Each
write workflow has 18 wire calls, with 521.060–558.560 ms summed wire time,
plus 150 ms explicit driver settlement. This is within the E277 workflow
range. No product call budget changes.

Thirty-six semantic reads include one cold first read at 71.931 ms wire,
26.122 ms document, 2.991 ms queue, and 45.015 ms completion. Its wire time is
38% above E277's maximum read. All later reads are 42.904–50.187 ms. The explicit
repeat takes 45.274 and 46.325 ms, with 2.518 and 3.787 ms document tasks. The
extra cold document work is consistent with completion on a later host turn;
its exact JVM cause was not profiled. The cold outlier is retained as a limit.
It does not recur in the warm samples.

Graphs have 53 nodes and 35,827–35,829 encoded bytes. Disconnected/connected
captures use 278/279 graph steps and 1,606/1,607 query steps. Heap samples rise
by 0 or 2 MiB; all four command samples rise by 2 MiB. These are not peak or
retained-heap bounds. The inactive engine and fixed four-module scope limit
the comparison. No larger fixture or sounding performance claim is made.

## Next probe: bounded retarget

V6 keeps `probe.gridCable` and adds one admitted source: first Amplify OUT.
The destination remains the spare Amplify IN. Only different states from
`none`, `sine`, and `amplify` are admitted. The current source must agree with
the before graph and by exact object identity. Both non-null sources must have
the observed `WAr` runtime class. All baseline values, positions, original
edges, and the disconnected spare output remain required. Tests cover all six
transitions, no-ops, an incorrect before source, and the forbidden spare source.

The inspected setter replaces the source in one edit wrapper. V6 invokes it
once; it does not issue a disconnect followed by a connect. This is a native
source-replacement candidate. Live retarget behavior and failure atomicity
are not yet proved. The same uncertain-write stop rule applies.

Trace clarification to E278: the second `HEV` argument in
`HEV.ffA(cYz, HEV, HEV, false)` is the relationship owner, not an old-source
argument. The new source is the third argument. `UL.cG3(yWH)` captures the old
source afterward for the change hook and notification. V5 called the public
setter and did not construct these lower-level arguments; its implementation
and results are unaffected by this correction.

The cost plan was extended before V6 implementation. It keeps 18 wire calls,
five captures, and one mutation stage. It adds one bounded local path to resolve
the second source. The typical and largest admitted writer remain four
modules. Plan about 550 ms summed wire time plus 150 ms driver settlement and
8 MiB temporary heap. V6 live timing is pending.

The [V6 deployment](../data/phase9a-grid-cables/deployment-v6.json) is
`phase-8-probe-v1`, 114 methods, hash `9dc11c1f9958f4d8`, with the new marker
`9a-grid-retarget-v6`. Archive SHA-256:
`76f00e00141189e67b9f34b406553dfa542fb35394940ca6a28b27f6eac2cecb`.
The last confirmed loaded build is V5. No V6 live call has run.

Operator replacement is next. Fully remove the old controller, then add the
final matching `ghostnote probe` in the complete list. After confirmation,
run hello and verify the new marker and fresh initialization. Read the baseline,
connect Sine, retarget to first Amplify, and verify two fresh reads plus UI.
Test undo/redo and the reverse retarget, then edited reload and final baseline
restoration. Keep DSP adoption separate. Continue module insertion/deletion
discovery after this bounded topology result.

## Verification and retrospective

The [verification record](../data/phase9a-grid-cables/verification-v6.json)
records V5 hello and evidence verification, V6 Gradle checks, TypeScript
typecheck, 55 wire tests, nine semantic tests, context validation, and diff
checks. All pass. Product budgets and public descriptions remain unchanged
(v52, 44 tools). Changes are staged; no commit was made.

Keep the cable evidence verifier separate from the historical V4 verifier.
This preserves the old build assertions while making the new live sequence
reproducible. No new repository instruction is needed.
