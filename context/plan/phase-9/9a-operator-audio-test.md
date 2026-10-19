---
title: 9a — Operator audio test
kind: plan
state: active
status: E298 passes all eight listening checks, eleven graph stages, and exact restoration. Do not repeat V13.
updated: 2026-10-19
parent: 9a-live-grid-editing-spike.md
---

# 9a — Operator audio test

## Acceptance

The operator selected listening as the remaining audio proof for 9a.
[E296](../../evidence/experiments/e296-grid-operator-audio-acceptance.md)
records that decision. This contract replaces the automated signal gate in
E290–E295. Native meter producer research is deferred. Fresh meter packets,
numeric silence thresholds, and a measured half-gain ratio no longer gate 9a.

A pass requires all of these:

1. Ghostnote performs the planned native edits on the existing Poly Grid.
   Independent paired graph reads confirm each exact delta. The operator does
   not make the module, cable, or gain edits by hand.
2. The operator hears the expected result at all eight checks below. The new
   Amplify must be in the only output path. Its zero, reduced, and full gain
   must produce the expected audible changes while the same engine stays active.
3. Unrelated modules, values, rectangles, selection, outer Poly Grid, and
   MW/Expressions remain unchanged. Only the listed graph edits and temporary
   track unmute are permitted. Transport stays stopped. No test notes are sent.
4. Exact baseline restoration passes, including the final paired reads and file
   hashes. A listening pass with failed restoration is not an overall pass.

Report the result as **operator-verified audio response on the fixed Poly Grid
fixture**. This is a spike acceptance result, not a required meter check on
every future edit. It does not prove absolute digital zero, an exact amplitude
ratio, sample continuity, engine revision acknowledgement, or arbitrary patches.
“No audible tone” is the silence claim. “Quieter” is the reduced-gain claim.
Keep graph, operator-audio, and restoration verdicts separate.

## Completed result

[E298](../../evidence/experiments/e298-grid-operator-audio-live-test.md) passes
all eight operator checks, eleven native graph stages, and exact saved-baseline
restoration. The complete workflow uses 240 calls. V13 is used and released;
do not repeat preparation, run, or restoration on this initialization. The
procedure below records the completed test. A future run requires a separately
admitted session. The next session is the parent plan's bounded close-out and
profile disposition; 9a stays active until then.

[E297](../../evidence/experiments/e297-grid-operator-audio-probe.md) contains the
implementation and offline checks. V13 loading and fresh hello pass in E298.

The deployment command is `./gradlew copyProbeExtension` in
`extension/`. The operator must fully remove the old controller and select
the final matching `ghostnote probe` product in the complete list. Do not
operate that Settings list. A power toggle or an earlier duplicate can load
cached Java classes. After operator confirmation, run `npm run probe:hello`
in `brain/`. Check the actual profile, method count/hash, archive hash, fresh
initialization time, and new build marker. Record these with the test.

## Simple listening procedure

The agent performs the edits and reads. The operator listens and answers each
prompt with **yes**, **no**, or **unsure**. A no or unsure stops the sequence.
Do not treat silence from the operator as approval. Do not repeat edits to
obtain a better result. Keep the monitoring volume fixed across the checks.

Before the test, check current project, selection, engine state, and running
drivers. Use only `gn-grid-spike` / `grid-probe`. The operator deactivates the
engine for preparation. Verify the saved project, backup, and preset hashes
from NOW and E293. Reacquire identities and confirm the exact four-module,
two-cable baseline, rectangles, empty Grid selection, and idle edit. The track
is muted, -10 dB, armed, active, and not soloed. Transport is stopped at 1.1.1.00.

The operator confirms that no other track, clip, external input, send, cue,
or automation can confuse the listening test. Use the fixture's existing main
output. Set a low, comfortable monitor level, activate the engine, and unmute
only `grid-probe`. Temporary unmute is now intentional. Do not change the track
fader, output routing, or master settings during the sequence. Master output
is expected to sound; the old master-silence gate does not apply.

After each indicated graph readback, allow about one second for the sound to
settle. Listen for a few seconds, then answer. No timed meter sample is required.

| Check | Agent action before the pause | Operator prompt |
|---|---|---|
| 1 — Baseline | Start the admitted session on the unchanged X→A→O patch. | Can you hear a steady tone? |
| 2 — Original gain off | Stage 1: set existing Amplify A from 25% to zero. | Has the tone stopped? |
| 3 — Original gain back | Stage 2: restore A to 25%. | Is the original tone back at roughly the same level? |
| 4 — New module in use | Stages 3–5: create Amplify N at unity, attach it at (2, 0), connect A→N, then retarget O to N. Readback must prove X→A→N→O with no bypass. | Is the tone still present at roughly the same level? |
| 5 — New gain off | Stage 6: set N to zero. | Has the tone stopped? |
| 6 — New gain reduced | Stage 7: set N to half gain. | Is the tone back, but quieter than check 4? |
| 7 — New gain full | Stage 8: restore N to unity. | Is it louder again and roughly back to check 4? |
| 8 — Original patch restored | Stages 9–11: retarget O to A, disconnect N, then delete isolated N. Confirm the original graph. | Does the original tone still sound as it did at check 1? |

Checks 1–3 must pass before the one factory attempt. Check 6 is provisional
until check 7 confirms the return to full level. The physical listening setup
must stay the same. No exact loudness judgment is required. A result that the
operator cannot distinguish is unsure, not a pass.

For each check, save its number, session/build identity, completed graph stage,
prompt time, answer time, literal operator answer, and yes/no/unsure verdict.
Retain links to the paired graph evidence in the client report. Use a maximum
128 UTF-8 bytes per answer and eight records in the probe. Do not invent
answers or mark future checks complete.

## Stop and restore

The operator can mute the track immediately to stop listening. Stop automated
writes on a no/unsure answer, mute during the active sequence, foreign note,
transport start, changed target/connection, failed graph check, timeout, or
native error. Freeze the first failure, last completed graph stage, completed
operator answers, and pending check. Status and abort remain cache-only after
failure. Later completion or restoration must not change that evidence.

Do not run inverse edits after failure. In particular, stages 9–11 are success
stages, not automatic cleanup. After native completion, at most one four-call
read-only recovery remains available. Do not read while native work is
unfinished. Inspect or restart the host if completion is uncertain.

On success or failure, the operator mutes the fixture and deactivates the engine.
Close only `gn-grid-spike` without saving. Confirm closure. Check the saved
project and verified backup against SHA-256
`af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`.
Reopen the exact saved baseline, or restore it from the verified backup while
closed if needed. Keep the preset hash
`1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9`.
Do not save a reconstructed graph over the baseline.

Reopening can activate the engine; the operator deactivates it again. Run the
new cohort's final 16-call restoration workflow once. Require the original
graph and rectangles, empty Grid selection, idle edit, intended outer device
and modulators, muted -10 dB armed active track, stopped transport, no playing
notes, inactive engine, unstarred tab, and exact file hashes. Reacquire module
UUIDs after reopen. Release the session without clearing its used allowance
or frozen failure. Preserve the other live material in NOW. `gn-scale-test`
still has no preservation requirement. This does not repeat V12 restoration.

## Step-controlled probe preparation (E297)

The completed preparation adapts the existing graph workflow, commands, and
exact delta checks in `phase9a-grid-engine.ts` and `GridEngineHandlers`. Keep all attachment
ownership/disposal, edit admission, one-task, and one-factory protections.
Use a new deliberate marker and derive the real method inventory.

- Replace Q0/Q1 and meter windows with the eight explicit operator gates.
  A session-bound acknowledgement records a yes/no/unsure answer for the exact
  pending check. It is a cache-only record, not a measurement. Refuse missing,
  duplicate, out-of-order, wrong-session, or pre-readback acknowledgements.
  No command may cross an unanswered gate. Do not auto-answer in a driver.
- Require mute during inactive preparation and final restoration. Admit the
  expected operator unmute before session start; require unmuted state during
  active edits and listening. A later mute stops writes. Keep the track level,
  identity, selection, stopped transport, connection, and external-note guards.
  Do not use the old between-stage master-leak or quiet-entry gates.
- Remove note injection, note lease, meter packet reads, peak/RMS sampling,
  numeric gain tests, and timed meter tasks from this runner. Retain one note
  subscription only to reject foreign notes. Retain engine/target guards without
  depending on meter objects or `EbT`. No new host subscription is needed.
- Pause with no open graph epoch or native task. Keep a five-second response
  watchdog and four-second pre-operation deadline. Replace the 60-second whole
  run limit with a 60-second limit per automated segment and a 15-minute total
  session allowance. On client loss or expiry, lock writes; never run cleanup
  edits. Check expiry before acknowledgements and every new operation. There
  is no background write while waiting and no native cancellation claim.
- Store eight bounded answer records and the first failure in at most 16 KiB
  of encoded evidence; allow 32 KiB for the status/ack response including
  completion metadata. Bound the failure reason to 512 UTF-8 bytes and the
  remaining encoded metadata to 4 KiB. Reject an oversized answer before
  advancing its gate. No audio sample buffer is needed. Stream graph evidence
  to disk. Late completion and recovery remain separate from the frozen record.

Offline acceptance: exact stage order and graph predictions; eight operator
gates; no automatic pass; no/unsure locks; wrong/duplicate/stale-session answers;
mute-phase transitions; no notes or meter calls; client loss/expiry; one factory;
failure freeze through later status/recovery/restoration; maximum encoding;
the planned call budget and final restoration. Run focused Java/TypeScript
tests, typecheck, profile inventory, product call budgets, live adapter frame
checks, context and diff checks. Add the previously planned read-component
timings inside existing calls, without extra captures. No public description
change is expected; verify that in the implementation.

Then deploy, obtain operator replacement, and run this checklist once. Record
the literal answers and actual costs. A test pass can satisfy 9a's remaining
audio gate. The final bounded 9a verdict and profile disposition still need
their own recorded close-out. Wider Phase 9 scope remains unselected.

## Cost model before implementation

E296 changed documentation only. E297 implements the following cost model.
The runner has one fixed four→five→four-module cycle, at most three
cables, 61 projected nodes, depth 12, and 4,096 graph/query work. No batch or
second attempt is admitted. Typical and maximum structural scope are equal.

| Component | Calls | Work |
|---|---:|---|
| Inactive prepare | 16 | Two fixture captures |
| Eleven graph stages | 198 | 55 fixture captures, two detached captures, 11 edits, one factory |
| Eight operator acknowledgements | 8 | Cache-only; no document task |
| Session begin and final status | 2 | Existing control boundary |
| Exact restoration | 16 | Two fixture captures and release |
| Total | 240 | Prepare/run/restore: 16/208/16; 59 fixture captures; zero note writes |

This is eight calls below E293's conditional 248-call plan. Eight cached
acknowledgements replace 16 meter begin/collect calls. Remove all 80 window
document tasks and 136 sampler timer/delivery entries. Human pauses create no
polling calls. V13 adds one cache-only expiry timer per session and one
controller notification on client loss. There are 73 document tasks: 59
fixture captures, 13 binds, and session begin. The two detached captures
share the stage 3 command task. Every graph stage retains 18 calls and its independent readback.
Operator engine toggles and mute changes are outside bridge counts and are
recorded separately. Monitoring adds no automated mixer write.

At the ledger's approximate 24 ms per turn, 240 calls have a 5,760 ms wire
floor. Keep 750 ms warm wire per graph stage, 1.20 seconds for prepare/restore,
and 0.240 seconds for acknowledgements/controls: 9.690 seconds planned requests.
Add 1.950 seconds cursor settlement. Listening and answers take additional
operator time; allow roughly a few minutes within the 15-minute session limit.
This is an allowance, not a native execution bound. No fixed signal dwell or
packet-age estimate remains.

Keep 16 MiB temporary Java heap per graph stage and 1 MiB per graph response.
The answer/status caps above replace the 64/128 KiB signal caps. Cold work
remains symbol resolution, initial paired reads, activation, factory lookup
or file parsing, and reacquisition after reopen. Native/retained heap and cold
I/O have no measured bound. Failure adds at most two cached calls and four
recovery calls with two captures and zero graph writes. Final restoration is
already counted. Keep the unexplained 43.544 ms read maximum; measure the next
admitted reads without a timing retry and explain increases over 20 percent.
Product call budgets and descriptions v52 remain unchanged in this design.

## V13 listening run (completed in E298)

First complete operator replacement and `npm run probe:hello`. The expected
profile is `phase-8-probe-v1`, with 118 methods and hash `2e939035ea90b8b0`.
Check marker `9a-grid-audio-v13`, fresh initialization, and the archive hash in
[the deployment record](../../evidence/data/phase9a-operator-audio/deployment-v13.json).
Then follow the simple listening procedure above once. Record the actual
component timings and compare them with the ledger. Do not add timing reads.

Run the driver from `brain/`:

```sh
node --import tsx src/probes/phase9a-grid-engine.ts prepare /absolute/input.json /absolute/new-prepare-output
node --import tsx src/probes/phase9a-grid-engine.ts run /absolute/input.json /absolute/new-run-output
node --import tsx src/probes/phase9a-grid-engine.ts restore /absolute/input.json /absolute/new-restore-output
```

Each input contains the absolute `projectPath`, `backupPath`, and `presetPath`
from NOW. Record a new `observedAt` timestamp from a real UI/operator observation
within 60 seconds of each command. For prepare, set `engineInactive` and
`isolationConfirmed` to true only after those conditions are confirmed. For run,
set `engineActive` and `isolationConfirmed` to true after activation and unmute.
For restore, set `engineInactive` and `restorationConfirmed` to true after the
close-without-save, file checks, and reopen procedure. These fields are evidence;
do not fill them from assumptions.

Keep the run process and its TCP connection open during all eight pauses.
The process prints a named prompt and reads one line: `yes`, `no`, or `unsure`.
Supply each line only after the operator answers that prompt. Do not pipe an
answer list or infer an answer from silence. The driver saves literal answers,
acknowledgements, graph reads, a call log, and the final audio verdict. Its
report names the paired graph files for each check. Keep prepare, run, and
restoration output together. No/unsure, invalid input, or closed input stops
writes. Status and abort have no document task.

After the listening run, complete exact restoration before an overall pass.
Then record a separate 9a close-out session for the bounded verdict and profile
disposition, as required by the parent plan. Keep 9a active until that record.
