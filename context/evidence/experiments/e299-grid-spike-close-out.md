---
title: E299 — Live Grid editing spike close-out
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E299 — Live Grid editing spike close-out

## Verdict and scope

**9a is complete.** Native module and cable operations, independent graph
readback, operator audio, and exact baseline restoration pass within the
scope below. The user requested close-out after committing the listening
session. The user also chose to keep the research probe deployed and to
select next steps in a separate planning session.

The research question was whether Ghostnote can edit modules and cables
inside an existing Grid device. The tested fixture is one Poly Grid in
`gn-grid-spike`: Sine X → Amplify A at 25% → Audio Out O, plus a disconnected
Amplify S at 50%. Creation tests add one native Amplify N at the free position
(2, 0). They do not replace the outer Poly Grid.

The pinned host is Bitwig Studio 6.0.6, API 25, macOS 15.8 arm64, Azul Java 25.
The installed JAR SHA-256 is
`382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93`
([E276](e276-grid-semantic-read-and-value-probe.md)). Internal symbols and
guarded operations apply to this build. The
[9a source map](../../plan/phase-9/9a-live-grid-editing-spike.md#evidence-and-implementation-map)
links the designs and implementation.

## Operation-by-operation result

| Operation or gate | Verdict within the tested scope | Evidence |
| --- | --- | --- |
| Read modules and cables | Pass: types, loaded module UUIDs, stored parameters, layout, ports, and directed cables. Preset comparison, manual value delta, selection change, and reload pass. Reacquire module UUIDs after reload. | [E276](e276-grid-semantic-read-and-value-probe.md) |
| Create a native module | Pass: two detached Amplify factory calls give fresh UUIDs and equal defaults. Ownership, initialization, and disposal of all 77 owned objects per call pass. Two later native attachments pass registered identity, ownership, exact paired reads, and preserved existing layout and selection. | [E283](e283-detached-grid-factory-lifecycle.md), [E289](e289-native-grid-attachment-and-persistence.md) |
| Update a module value | Pass: disconnected Amplify 50% ↔ 60%, paired reads, UI, one-step undo/redo, and edited-state save/reload. E298 also tests gains in the audible path. | [E277](e277-grid-value-write-readback-and-persistence.md), [E298](e298-grid-operator-audio-live-test.md) |
| Delete a module | Pass: spare Amplify deletion, isolated or with an incoming Sine cable. The connected case removes the incoming cable with the module. Paired reads, UI, undo/redo, and edited-state reload pass. | [E281](e281-grid-module-delete-and-persistence.md) |
| Create and delete a cable | Pass: connect and disconnect Sine OUT → spare Amplify IN, with exact paired reads, UI, undo/redo, persistence, and baseline restoration. | [E279](e279-grid-cable-connect-disconnect-and-persistence.md) |
| Update a cable source | Pass: retarget the spare input between Sine OUT and original Amplify OUT through one native setter. Paired reads, UI, undo/redo, persistence, and baseline restoration pass. | [E280](e280-grid-retarget-and-module-delete-probe.md) |
| Persist native attachment | Pass: one-step undo/redo and edited-state save/reopen for the attached Amplify. Existing graph, layout, and selection remain equal. Exact baseline is restored. | [E289](e289-native-grid-attachment-and-persistence.md) |
| Audio response with the same active engine | Pass under the revised acceptance: all eight operator checks and all eleven independently checked native graph stages pass. One new Amplify enters the only output path, responds to gain changes, then is disconnected and deleted. | [E296 acceptance](e296-grid-operator-audio-acceptance.md), [E298 result](e298-grid-operator-audio-live-test.md) |
| Final cleanup and baseline | Pass: close without saving, exact project/backup/preset hashes, reopen, reacquire identities, paired baseline reads, and session release. No open epoch or native task remains. | [E298](e298-grid-operator-audio-live-test.md) |

The document-operation tests and their undo/persistence tests used an inactive
engine. E298 supplies the separate audio result with the engine active.
Do not infer an active-engine undo or persistence test from those combined
results.

## Audio evidence and costs

The accepted claim is **operator-verified audio response on the fixed Poly
Grid fixture**. The [completed procedure](../../plan/phase-9/9a-operator-audio-test.md)
defines eight checks. The operator answered `yes` to every check:

| Checks | Heard result |
| --- | --- |
| B+, B0, B-return | Original tone, no audible tone at A = 0, original tone after A returns to 25%. |
| N+, N0, N-half, N-return | Tone through X → A → N → O, no audible tone at N = 0, quieter at N = 0.5, full-level return at N = 1. |
| R+ | Original tone after the output returns to A and N is disconnected and deleted. |

The [audio report](../data/phase9a-operator-audio/run-v13/audio-verdict.json)
links the graph evidence for each check. The
[combined verification](../data/phase9a-operator-audio/verification-live.json)
records separate passing graph, audio, and restoration verdicts. The
[released status](../data/phase9a-operator-audio/restore-v13/released.json)
preserves all eight answers.

E298 uses the planned 240 calls: 16 preparation, 208 active run, and 16 final
restoration. Six hello calls are outside that budget. Requests total
7,387.309 ms, below the 9,690 ms allowance, plus 1,950 ms cursor wait.
Operator time is separate: 315.119 seconds from the first prompt to the last
answer. There are 59 fixture captures, two detached captures, eleven edits,
one factory call, eight answers, zero notes, and zero recovery calls.
Each active stage stays within its 750 ms allowance.

The largest traversal is 8.855 ms; the largest document task is 34.120 ms.
E292's older 43.544 ms traversal maximum remains unexplained. E298 does not
isolate its cause or establish a general performance bound. No timing retry
or additional live measurement ran in this close-out. See the
[performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) for the
operation budgets and earlier measurements.

## Limits and earlier results

- The tested factory type is native Amplify at one free position. Arbitrary
  module creation, relocation, overlaps, feedback, FX Grid, and Note Grid
  remain unproved. Preserved layout is not a general layout-write result.
- Deletion with an incoming cable passes. Cleanup of outgoing consumers on
  module deletion remains unproved. E298 disconnects N before deleting it.
- Module identities are scoped to the loaded document. One unchanged outer
  device UUID across reload does not establish a persistent identity contract.
- General failure atomicity is unproved. [E286](e286-grid-attachment-witness-wire-fix.md)
  records a pre-factory refusal; [E287](e287-grid-attachment-managed-identity.md)
  records insertion followed by a readback stop. [E288](e288-v11-restored-baseline.md)
  records operator recovery. The successful E298 run used no recovery calls.
- Listening establishes audible response. It does not establish digital zero,
  an exact amplitude ratio, sample continuity, voice identity, or an engine
  revision acknowledgement. No general DSP or arbitrary-patch claim follows.
- [E292](e292-grid-engine-quiet-gate-refusal.md) stopped at the incorrect
  quiet-baseline gate before any note, edit, or factory call. E293–E295 did
  not admit an automated signal witness. [E296](e296-grid-operator-audio-acceptance.md)
  replaced that gate with operator listening. The
  [automated designs](../../plan/phase-9/9a-observable-design.md) remain history;
  native meter producer research is deferred. It is not an ongoing requirement
  or selected follow-up.
- No public Grid tool or product support promise is added. This is a bounded
  research result on the pinned host build.

## Retained deployment and last verified live state

The operator chose to retain `ghostnote probe`. No archive was built, copied,
or replaced during close-out. The normal profile was not restored.
These facts come from E298; this session made no fresh live observation.

The [deployment record](../data/phase9a-operator-audio/deployment-v13.json)
identifies `phase-8-probe-v1`, 118 methods, hash `2e939035ea90b8b0`, marker
`9a-grid-audio-v13`. The archive is
`/Users/jonvuri/Documents/Bitwig Studio/Extensions/ghostnote-0.0.1.bwextension`,
SHA-256 `ed8934be54f937bfe0cd805589435260c60c27dead4a06ea94c24eea052694d3`.
The last verified initialization is `2026-10-18T21:39:53.989Z`.

Session `56986b96-53f7-4df0-a6dd-a6da02d151f3` is used, inactive, released,
restored, and not locked. No epoch or native task is open. Recovery is unused.
**Do not repeat V13 preparation, run, or restoration on this initialization.**
Retaining the deployment does not reset its test allowance.

The exact baseline is reopened and unstarred: four modules, two cables,
original rectangles, empty Grid selection, idle edit, and unchanged parents.
Track `grid-probe` is muted at -10 dB, armed, active, and not soloed.
The engine is inactive; transport is stopped at 1.1.1.00. Poly Grid and
MW/Expressions are unchanged. The
[closed-file check](../data/phase9a-operator-audio/closed-file-check.json)
records matching project and backup SHA-256
`af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`
and unchanged preset SHA-256
`1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.
[NOW](../../NOW.md) retains the file paths and unrelated live material.

## Documentation and verification

This session changes documentation only. The main 9a plan is now a short
results and source index. Its prior session sequence is retained in the
[historical plan](../../plan/phase-9/9a-live-grid-editing-spike-history.md).
Related designs identify their historical or completed status. The capability
record, phase index, roadmap, evidence index, and NOW reflect the bounded
result. Earlier E records and saved evidence are unchanged.

Verification: context links and frontmatter pass the context checker. Links
to sections affected by the cleanup pass a separate anchor check. Saved E298
verification agrees with the reported counts and final disposition. Diff
checks pass. No runtime code, call budget, or tool description changed;
descriptions remain v52 with 44 tools. E297's offline checks and E298's live
checks remain the implementation verification. No runtime test was rerun.

The entry worktree was clean. Only this session's documentation is staged;
no commit is made. No new implementation session is planned here. The user
will select next steps separately.

Retrospective: accumulated next-session instructions obscured the final result.
Keep one current results index and mark earlier procedures as history when a
spike closes. No repository-wide instruction change is needed.
