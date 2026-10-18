---
title: E292 — Grid engine quiet gate refusal
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E292 — Grid engine quiet gate refusal

## Result

V12 loads and passes the fresh hello. The inactive baseline preparation passes.
The single active-engine run stops at Q0 with `signal-before-note`. The session
is locked and used. No note, graph command, or factory was attempted. No native
task is unfinished. DSP adoption remains unproved. 9a stays active.

Exact restoration and the final 16-call inactive baseline workflow pass. The
session is released, with no open epoch or unfinished native task. V12 remains
loaded with its session used and locked. Do not repeat prepare or run on this
initialization. The operator subsequently confirmed that this patch produces
continuous signal without notes. The quiet-baseline assumption was a test-design
error. The next design session must replace the note-pulse protocol before
another live run; see the [9a plan](../../plan/phase-9/9a-live-grid-editing-spike.md).

## Admission and client correction

The [deployment record](../data/phase9a-engine-adoption/deployment-v12.json)
records the archive hash and confirmed runtime: `phase-8-probe-v1`, 118 methods,
`2e939035ea90b8b0`, marker `9a-grid-engine-v12`. Initialization is
`2026-10-18T19:50:46.016Z`, after deployment. The operator fully replaced the
controller and confirmed isolation. The UI showed the inactive fixture,
muted -10 dB armed active track, stopped 1.1.1.00 transport, MW/Expressions,
and an unstarred fixture tab. The unsaved scale-test tab was preserved.

The first driver process could not connect through the sandbox. It sent no
host request. The next process stopped after eight read-only calls, before
probe bind. Its client check required `hidden: false`; `track.list` omits
`hidden` for visible tracks. The client now accepts an omitted or false field
and rejects true. The test fixture now uses the actual wire shape and tests
hidden-track refusal before bind. Six focused tests and typecheck pass. No
extension rebuild or call-budget change was needed.

The corrected [prepare workflow](../data/phase9a-engine-adoption/prepare-v12-fixed/prepared.json)
passes all 16 calls. Paired reads match the four-module, two-cable baseline,
original rectangles, empty Grid selection, idle edit, and parent identities.
Project, backup, and preset hashes pass before and after. Preparation performs
no graph edit or note. The [preparation record](../data/phase9a-engine-adoption/preparation-v12.json)
keeps the earlier client refusal separate.

## Active-engine result

After operator activation, the UI showed active track and device meters while
transport was stopped and the track was muted. This is a UI observation, not
proof of the signal source. The driver admitted the native engine connection
and began Q0. A track observer value above 1 in the first 250 ms latched
`signal-before-note`. `windowCollect` then refused with `engine-session-locked`.
The driver sent only cached abort and status calls after that refusal.

The [cached failure report](../data/phase9a-engine-adoption/run-v12/failure-status.json)
records 52 samples, no attempted or observed note-on/off, stage 0,
`factoryAttempted: false`, `commandAttempted: false`, `epochOpen: false`, and
`nativeUnfinished: false`. No recovery workflow ran. No inverse edit ran.

The report does not contain raw sample values or end packet timestamps. The
lock prevents the normal collect path, so this result does not establish
packet freshness, plateau, master silence for a complete window, note response,
or gain ratios. The first failure is preserved.

After restoration, the operator briefly activated the engine and confirmed
continuous output with stopped transport. The supplied screenshot shows
Sine → Amplify at 25% → Audio Out, with no envelope or gate. The spare Amplify
at 50% is disconnected. This explains the expected baseline signal. Q0's
requirement for silence before a note is incorrect for this fixture. The
refusal tests that guard, not DSP adoption or a fault in the patch.

Replace the note-pulse design with continuous-signal gain measurements. Expect
positive baseline output, controlled silence at zero gain, half-gain output,
and returned positive output. Define settlement, fresh meter evidence, and
quantization tolerances before implementation. Keep the track muted and the
master quiet. Preserve this failed run; do not reclassify it as a pass.

## Cost and verification

The corrected prepare uses 16 calls, 559.277 ms summed request time, 150 ms
cursor settlement, and 83,739 encoded response bytes. Its two document reads
take 29.060/19.389 ms with sampled heap rises of 4/2 MiB. The first exceeds
E289's 21.860 ms maximum by 33%. This is the first V12 read after initialization;
new engine guards and cold work are not isolated causes. The second read is
within that prior maximum. The session limit prevents a timing retry.

The stopped run uses five calls: begin, Q0 begin, failed collect, abort, status.
Summed request time is 126.663 ms, plus the 1,250 ms window wait. Successful
responses total 2,189 encoded bytes; error-envelope bytes are not measured.
Session-begin and window-begin document times are 13.264/5.864 ms. Their heap
samples show no increase. These samples do not measure peak or retained heap.
The earlier client refusal adds eight calls and 184.959 ms separately.

The final restoration uses 16 calls, 464.713 ms summed request time, 150 ms
cursor settlement, and 82,607 response bytes. Its document reads take
43.544/19.600 ms, each with a 2 MiB sampled heap rise. The first is 99% above
E289's 21.860 ms maximum; the second is within that maximum. Reopened-target
work, JVM activity, and the new guards are not isolated. No timing retry is
allowed by the single restoration-read contract. Retain 43.544 ms as the
observed maximum and investigate in the next design session.

Prepare, stopped run, and restoration total 37 calls and 1,150.653 ms summed
request time, plus 300 ms cursor settlement and 1,250 ms window dwell. The
earlier client refusal adds eight calls separately. Hello and operator time
are outside these driver totals.

The planned 252-call success path did not run. No attachment-cost or full-run
regression claim follows. Subscription allocation, native engine memory,
process-memory delta, and complete callback cost remain unmeasured. Public
descriptions remain v52 with 44 tools; no description changed.

## Restoration and retrospective

The operator confirmed engine deactivation and fixture-only close without save.
The UI confirmed the fixture tab was closed and the unsaved scale-test tab
remained. Project and backup hashes matched the exact baseline; the preset
hash was unchanged. No file replacement was needed. The agent reopened the
verified file through Bitwig. It stayed inactive after loading. The UI showed
stopped 1.1.1.00 transport, muted -10 dB armed track, original Poly Grid with
MW/Expressions, and an unstarred fixture tab.

The [restoration workflow](../data/phase9a-engine-adoption/restore-v12/released.json)
passes paired exact baseline reads and releases the session. It proves native
inactive state, baseline graph and rectangles, empty Grid selection, idle edit,
no playing note, no open epoch, and no unfinished native task. IDs were
reacquired. The [preservation record](../data/phase9a-engine-adoption/preservation-live.json)
checks the exact files again after restoration. V12 stays loaded; the normal
profile is not restored. No project save occurred. The operator's later brief
activation is separate from this restoration evidence. Current engine state
must be checked before the next live session.

The final cached window count is 2,048. Callbacks continued filling the bounded
buffer after the first failure until restoration discarded it. The first
failure remains `signal-before-note`. Freeze the failure buffer in the next
design so that operator delay cannot replace the useful initial trace.

Context validation and diff checks pass. The six focused driver tests and
typecheck pass for the client fix. All session changes are staged, not committed.

Retrospective: use actual wire response shapes in test fixtures. Derive signal
expectations from the saved patch topology before defining a note-pulse test. Retain bounded failure samples through cached status so that a locked
session can explain its first signal failure without a new document request.
