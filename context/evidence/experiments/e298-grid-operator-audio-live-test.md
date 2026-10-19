---
title: E298 — V13 operator audio test
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E298 — V13 operator audio test

## Preparation result

The [V13 hello](../data/phase9a-operator-audio/hello-v13.txt) passes after
operator controller replacement. The loaded profile is `phase-8-probe-v1`,
118 methods, hash `2e939035ea90b8b0`, marker `9a-grid-audio-v13`, initialization
`2026-10-18T21:39:53.989Z`. The hello used six read-only calls.

The operator confirmed: “It is. Everything is at baseline right now.” A fresh
UI observation shows `gn-grid-spike` selected and unstarred, engine inactive,
track muted and armed at -10 dB, and stopped transport. Isolation is confirmed.
The [preparation input](../data/phase9a-operator-audio/prepare-input.json) records
these facts. The first command did not start because automatic permission
review timed out. The permitted retry started after a fresh UI observation;
there was only one live preparation attempt.

The [16-call preparation](../data/phase9a-operator-audio/prepare-v13/calls.json)
passes. The paired reads agree on the four-module, two-cable graph, original
rectangles, empty Grid selection, idle edit, and parent identities. File hash
checks pass for the saved project, backup, and preset. Preparation made no graph edit, factory call, or note write. The active
session and operator checks started only after this baseline pass.

The [cost summary](../data/phase9a-operator-audio/prepare-v13/summary.json)
records 464.600 ms of requests for 16 calls, plus the 150 ms cursor wait.
This is below the 1.20-second preparation allowance. Cold controller symbol
lookup costs 38.452 ms. The two read traversals cost 3.059 and 2.943 ms; their
document tasks cost 16.865 and 8.224 ms. The first read also includes 3.032 ms
navigation/projection, 3.015 ms witness symbols, and 4.368 ms witness reads.
No current read exceeds E292's 43.544 ms traversal maximum. That older maximum
is still unexplained; no timing retry was made.

## Active run result

The operator confirmed readiness after activation and unmute. The run used
session `56986b96-53f7-4df0-a6dd-a6da02d151f3`. All eight literal answers are
`yes`, recorded in the [final status](../data/phase9a-operator-audio/run-v13/status.json).
The [audio report](../data/phase9a-operator-audio/run-v13/audio-verdict.json)
names the graph evidence for each check. The result is operator-verified audio
response on the fixed Poly Grid fixture: tone, no audible tone, return,
new module in the only output path, no audible tone at zero, quieter at half
gain, full-level return, and original tone after removal.

All eleven native edit stages passed independent paired graph checks. One new
Amplify was created, attached, used in series, disconnected, and deleted.
The final graph equals the original baseline. No note was sent. The run ends
with no failure, open epoch, or unfinished native task. Recovery is unused.
The client connection is closed after completion; do not restart the runner.

The [run summary](../data/phase9a-operator-audio/run-v13/summary.json) records
208 calls, 55 fixture captures, two detached captures, eleven edits, and one
factory. Requests total 6,488.068 ms. The largest graph traversal is 8.855 ms,
below E292's unexplained 43.544 ms maximum. The largest document task is
34.120 ms at factory/attachment stage 3; mutation and prediction account for
28.086 ms of that task. This new active-stage measurement has no corresponding
E292 active-stage result. No timing retry was made. The eight answers span
315.119 seconds from the first prompt to final receipt.

## Restoration and final result

The operator confirmed closure without saving: “Closed.” UI inspection showed
that `gn-grid-spike` was closed. The [closed-file check](../data/phase9a-operator-audio/closed-file-check.json)
confirms the exact saved project and backup hash
`af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`, and
preset hash `1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.
No file replacement was needed. The agent reopened the exact saved project.
The engine remained inactive, so no further operator toggle was needed.

The [final 16-call restoration](../data/phase9a-operator-audio/restore-v13/calls.json)
passes with reacquired identities and paired reads. The original graph,
rectangles, empty Grid selection, idle edit, and parents pass. The final UI
shows the fixture unstarred, engine inactive, muted and armed track at -10 dB,
stopped transport at 1.1.1.00, and the original Poly Grid with MW/Expressions.
No project save was made. No unrelated project was edited.

The [released status](../data/phase9a-operator-audio/restore-v13/released.json)
keeps all eight answers unchanged. It reports used=true, active=false,
locked=false, restored=true, epochOpen=false, nativeUnfinished=false, and
recoveryUsed=false. Do not repeat prepare, run, or restoration on this
initialization. V13 remains deployed and loaded; the normal profile is not
restored by this session.

**Graph: pass. Operator audio: pass. Exact restoration: pass.** The
[combined verification](../data/phase9a-operator-audio/verification-live.json)
records the result as **operator-verified audio response on the fixed Poly Grid
fixture**. This satisfies the E296 audio acceptance. It does not prove absolute
digital zero, an exact amplitude ratio, sample continuity, engine revision
acknowledgement, or arbitrary patches. No ongoing automated meter gate follows
from this result. Native meter research remains deferred.

The complete workflow uses the planned 240 calls (16/208/16), plus six hello
calls outside that budget. Requests total 7,387.309 ms, below the 9,690 ms
allowance, with 1,950 ms planned cursor wait and separate operator time.
Restoration requests take 434.641 ms. Its read traversals take 4.225/1.589 ms;
document tasks take 12.539/8.200 ms. There are 59 fixture captures, two detached
captures, eleven graph edits, one factory, eight operator answers, zero notes,
and zero recovery calls. Each active stage stays below its 750 ms allowance.
No measured traversal exceeds E292's older maximum. No timing retry was made.

Verification: the live driver checks exact independent stage predictions,
paired graph/witness agreement, session/build identity, answer order, file
hashes, and final release. An offline audit of the saved outputs confirms all
240 calls have no error, all 59 graph captures are complete, the eight answers
survive release unchanged, and all file hashes still match. Context and staged
diff checks pass. No runtime implementation changed in this live session;
E297's 244 TypeScript tests and Java checks remain its offline verification.
Public descriptions remain v52 with 44 tools; none changed.

Keep 9a active. The next explicit session is the
[bounded close-out and profile disposition](../../plan/phase-9/9a-live-grid-editing-spike.md#next-session--bounded-close-out-and-profile-disposition).
It must consolidate the earlier operation/persistence results with this audio
result, state remaining limits, and record the profile disposition. It must
not repeat this successful live sequence.

Existing staged work is preserved. This session's evidence is staged; no commit
is made. Retrospective: explicit listening gates settled the selected audio
question in one admitted run. Keep the evidence claim at the strength the task
needs. Use a fresh UI timestamp after permission-review delays. No repository-wide
instruction change is needed.
