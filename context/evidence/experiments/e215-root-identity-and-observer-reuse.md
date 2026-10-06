---
title: E215 — Root identity and observer reuse research
kind: evidence
state: active
updated: 2026-10-01
parent: ../../plan/phase-8/8g-shadow-project-cache.md
---

# E215 — Root identity and observer reuse research

## Scope and result

This is research for the open gates in [E214](e214-shadow-cache-content-and-lifecycle-gates.md).
It does not prove loaded-project identity or permit cache publication.
The first root experiment retained 13 captures in one extension instance. A
later baseline capture records the marked controller reload. A final capture
follows fixture cleanup. An
independent project had a different root UUID. A saved project and its exact
file copy had the same UUID. With B as the audio-engine project, viewing A and
then Copy produced six equal signal values and no new observed callback.
Thus this observed signal tuple cannot distinguish those loaded copies.

The [manifest](../data/phase8g-lifecycle-reuse/manifest.json) identifies the
compressed raw records and their SHA256 checksums. The root record preserves
all captures and the first instance's final 84-event trace. No trace event was dropped.
The root probe
only read and observed values during that experiment. The later adapter
integration uses its delivered changes to invalidate experimental cache state.

## Root experiment

The runtime was Bitwig host API 25, profile `phase-8-probe-v1`, with 97 methods
and hash `f03f19414f40e3d3`. The extension nonce was
`47657d1d-668a-45e5-865e-9a28ef05a1d6`. The root-probe nonce was
`cc1febb3-444b-46a4-afbd-acf3b9c79b4f`.

The probe read project name, project existence, active engine, root existence,
root channel UUID, and master channel UUID. Every endpoint read succeeded.
Root and master UUIDs were equal in every capture. They are two access paths
to the observed root/master identity, not independent identity witnesses.

| Project | Root and master UUID |
|---|---|
| Baseline, `New 1` | `9d2a7ac4-0fef-4926-b9e8-ee635d4052e4` |
| A and Copy, saved name `identity` | `1b58eea3-3621-4d1c-91f8-bf51a5ebc521` |
| Independent B, saved name `identity` | `98dee650-a4b7-4f1b-9192-29c161ae03ec` |

A and Copy each contain 26,616 bytes and have SHA256
`5922dc15a47c31c3ea1b10bf96206460dfa6c05445f95738acd9accab697bce7`.
B also contains 26,616 bytes and has SHA256
`60e5195e7d516829cf37e0f29e0823e023b37dca0f9c520a74c2c12ac762f1ac`.
The manifest records their owned temporary paths. The copy result concerns
copied project content; it is not a collision between unrelated project UUIDs.

### Endpoint captures

Project and root existence were true at all endpoints. All times below are
UTC on 2026-10-01. The `engine` column reports the viewed project's engine
value. UI actions selected the audio-engine project separately.

| Capture | Time | Observed UUID | Engine | Sequence | Callbacks | Flush count |
|---|---|---|---|---:|---:|---:|
| Baseline after research reload | 08:24:03.715 | Baseline | true | 13 | 12 | 10 |
| A unsaved | 08:24:51.889 | A | false | 17 | 16 | 14 |
| A saved, engine active | 08:26:20.357 | A | true | 19 | 18 | 19 |
| B independently created and saved | 08:27:23.302 | B | false | 24 | 23 | 24 |
| Copy, with A engine active | 08:28:23.918 | A | false | 26 | 25 | 28 |
| Return to A | 08:28:41.385 | A | true | 27 | 26 | 32 |
| Rapid A to B to A | 08:29:23.484 | A | true | 33 | 32 | 37 |
| View A, with B engine active | 08:29:48.066 | A | false | 38 | 37 | 42 |
| View Copy, with B engine active | 08:30:02.862 | A | false | 38 | 37 | 46 |
| Capture labelled after owned tab closes | 08:30:56.465 | A | false | 60 | 59 | 54 |
| Return to baseline after closes | 08:31:14.370 | Baseline | false | 70 | 69 | 59 |
| Reopen A | 08:32:13.432 | A | false | 73 | 72 | 63 |
| Baseline before observer reuse | 08:33:00.997 | Baseline | true | 84 | 83 | 70 |

The A and Copy captures at sequence 38 had the same project name, both
existence values, engine value, and both UUIDs. Callback count stayed at 37.
Only the flush count advanced, from 42 to 46. This is a measured failure to
distinguish those two viewed projects with these six signals. It does not
establish the behavior of every other API signal.

### Callback order and close timing

Sequence 1 records probe creation. Sequences 2–7 contain the initial false or
empty values. Sequences 8–13 contain the initial baseline values. A's UUIDs
arrived at sequences 16–17. Saving A changed its name at sequence 19, without
a UUID change. Independent B's UUIDs arrived at sequences 22–23. Viewing Copy
produced A's UUIDs at sequences 25–26.

During rapid A to B to A, the root UUID changed to B at sequence 29 and to A
at sequence 32. The callback elapsed times were 324,759.987125 ms and
324,785.038708 ms, a 25.052 ms interval. Master callbacks followed at sequences
30 and 33. This establishes the observed callback order, not an input fence.

Close actions were asynchronous. The capture labelled
`after-owned-tab-closes` still reported A at sequence 60. Its label does not
prove that all owned tabs had closed. The trace first reports empty name and
UUIDs with false existence at sequences 39–43, then B at 44–49. It reports
another empty interval at 51–55, then A at 56–60. A third empty interval at
61–65 precedes the baseline values at 66–70. Only the next endpoint capture
confirms the baseline values. These transitions cannot be assigned to exact
UI click times from this record alone.

Reopening saved A produced its name and unchanged UUIDs at sequences 71–73.
The later close produced empty values at 74–78, then baseline values at
79–83. Sequence 84 reports the baseline engine active.

### Lifecycle limits

All 13 first-instance captures retain the same extension and probe nonces. Their counters
are `initCallCount:1` and `exitCallCount:0`, scoped to this probe instance.
The observed project switches, closes, and A reopen did not restart that
instance. A controller reload on A was not run. No exit log was retained. The initial baseline capture follows the research deployment; it
is not a paired before-and-after reload measurement on A.

The fourteenth capture, `baseline-marked-controller-reload`, was taken at
08:48:32.468 UTC after full controller removal and addition. Its extension
nonce is `4d4d78ae-3ec7-400b-8e44-0f80077a8c45`; its probe nonce is
`c8aaf1fc-5ea4-4bf0-94eb-3bed236237de`. Baseline root and master UUIDs remain
`9d2a7ac4-0fef-4926-b9e8-ee635d4052e4`. The new instance reports sequence 13,
12 callbacks, `initCallCount:1`, and `exitCallCount:0`. This paired baseline
result separates extension-instance change from persistent root identity.
It does not add a reload result on A or an exit trace from the old instance.

The fifteenth capture, `baseline-after-fixture-cleanup`, was taken at
08:52:55.117 UTC. Its six values, extension nonce, probe nonce, sequence 13,
and callback count 12 equal the fourteenth capture. Its flush count is 2,879.
The root signals do not change during the intervening reuse experiments and
fixture cleanup in this retained trace.

The saved UUID survives A's save and reopen. It also survives the exact file
copy. It is useful as an observed persistent root identity, but this result
does not supply a unique loaded-instance identity. Callback ordering against
clip data remains unproved. Keep the lifecycle gate closed.

## Observer reuse experiment

### Initial run

The initial run retained 56 cases from 08:33:40.663 to 08:37:45.316 UTC.
Forty-five cases matched both independently acquired content and the expected
fixture. Eleven refused before a completed comparison. No completed
comparison mismatched. These counts are separate from E214's shadow-cache
cases. Every result remained `complete:false` and `eligible:false`.

The reuse probe
uses one resident observer and one independent authority observer. Both have
2,048 cells at `1/512` beat, 128 pitches, and all 16 MIDI channels. The three
owned clips contain 16 notes on all channels at cell 0, two notes at disjoint
coordinates, and no notes. Callback payload is retained as trace evidence.
It supplies coordinate hints for current-target reads; it does not directly
set note content. Each completed comparison scans both views in full and
checks fields and clip metadata through the
[driver](../../../brain/src/probes/phase8g-lifecycle-reuse.ts).

| Case group | Matches | Refusals | Cases |
|---|---:|---:|---:|
| Continuously subscribed, five A to B to A to empty to A cycles | 25 | 0 | 25 |
| Suspend, point, then immediately resume, five cycles | 15 | 10 | 25 |
| Field-only edit, with chance disabled | 1 | 0 | 1 |
| Field edit while subscription was requested off | 0 | 1 | 1 |
| Resume after that field edit | 1 | 0 | 1 |
| Repoint after that field edit | 1 | 0 | 1 |
| Rapid point, cancel, and recovery | 1 | 0 | 1 |
| Interrupted comparison and recovery | 1 | 0 | 1 |

The ten cycle refusals occur on B and the empty target, once each per cycle.
They report `resident-not-settled`; the resident binding is retired and
`bound:false`. The unsubscribed field-edit refusal also reports
`resident-not-settled`, with `clipPinned:false` and `bound:false`.
These are binding or unavailable-target refusals, not note-value mismatches.
Resuming acquires disabled chance `0.875` and matches authority and fixture.
The interruption transitions discard the active scan before later recovery.

### Sparse replay and instrumentation limits

The original E215 reuse probe registered `addNoteStepObserver`. It did not
register the selected cache observer, `addStepDataObserver`. E130 records that
these families differ: NoteStep has no initial occupancy replay and misses
some enable-only changes. The retained E215 full scans prove proxy content
and binding under the tested conditions. Their sparse-zero results do not
measure the selected StepData replay protocol.

Earlier replay evidence remains valid. [E130](e130-constant-time-launcher-clip-read-search.md)
measured complete occupancy replay after target transitions.
[E134](e134-project-observer-scale-sweep.md) repeatedly verified initial replay
after controller load. Its corrected method used a populated cross-track canary
before the target. [E139](e139-cache-scale-limits-and-degradation.md) tested
that protocol at the selected width and observer counts. E214 also retains
matching initialization and unused-handle reacquisition cases.

The present NoteStep same-target reset cases are different. `View.point` clears the
local hints and observations before each selection. Selecting the current
target need not cause a new host replay. Resuming before that local reset can
also deliver replay that the reset then discards. E134 already identified
resetting the recorder after initial replay without a later target transition
as an experiment error. These cases do not contradict the earlier cold-start
results or establish a new requirement to seed every startup with a full scan.
The adapter must preserve captured replay or force the measured canary-to-target
transition after a reset. Verify this sequence for reused bindings.

The next research build, marked `8g-reuse-sparse-replay-v3`, registers
`addStepDataObserver` on both physical handles. It preserves the recorder when the current target is confirmed and unchanged. A deliberate
reset must force a populated canary transition before the target. The new
driver checks sparse membership and disabled fields before its independent
full scan. The full scan no longer seeds or repairs the sparse recorder.
These changes correct the measurement protocol. They have no new live result
until a marked run verifies them.

After controller Add, verify the runtime markers before creating a fixture.
Run `setup`, `run-replay 2`, and `verify-replay` with the lifecycle reuse probe.
The planned sequence has 26 cases. Then run the shadow reuse probe with `run`
and `verify`. That sequence has 18 cases and keeps two resident handles plus
one authority handle. These are planned counts, not passed results. Both probes
use the same owned fixture. Their output files are separate from the retained
NoteStep results.

The chain-witness probe adds `capture`, `setup`, and `verify`. Use `setup` only
in the disposable A project with its owned named track. Capture the same saved
structure across loaded copy, close/reopen, and controller reload. Compare UUIDs
only when the source structure matches and the endpoint sequence is stable.
No-chain, unreadable, and changed-structure endpoints return `unknown`. Undo
state cannot decide identity. Eight focused validator tests pass; the live
chain experiments remain pending.

The NoteStep same-target resets expose a recorder reinitialization gap in
that instrumentation. For example,
`cycle-1-subscribed-0-row-0` has zero retained sparse observation notes and
zero pending hints, while the completed resident and authority scans each
find all 16 expected notes. Several later same-target cases repeat this
result. An empty hint queue after a reset does not establish complete replay.
The full scans supply these content matches; the sparse observations alone
would omit notes.

The initial traces retain 3,238 callback events. Of these, 832 have
`subscribedAtArrival:false`; all 832 have state `Empty` on the resident view.
That arrival field records requested subscription state in this run. It does
not establish actual subscription state at callback delivery. The trace has
no source clip identity.

All initial callback events lack `actualSubscribedAtArrival`, and initial
info lacks an instrumentation revision. The deployed class bytes contain
the actual-subscription field, but the running traces do not. A cached-class
mismatch is suspected; its cause is not established. Snapshot
`actualSubscribed` values cannot recover the missing arrival measurement.
Thus `callbacksWhileUnsubscribed` in this run is not proof that actual
unsubscription permits or suppresses callbacks.

### Marked controls

After full controller removal and addition, live info confirmed revision
`8g-reuse-actual-subscription-v2`. Live hello passed with the same 97-method
inventory. Two controls ran in that marked instance. The artifact retains
them and the initial run separately, with the first two in `priorRuns`.

| Run | Mode | Cases | Matches | Refusals | Continuous cycle matches | Resumed cycle matches |
|---|---|---:|---:|---:|---|---|
| Initial, unmarked | Resume after point | 56 | 45 | 11 | 25/25 | 15/25 |
| Marked control, 08:48:32.596–08:50:20.914 UTC | Resume before point | 26 | 25 | 1 | 10/10 | 10/10 |
| Same marked instance, 08:51:04.688–08:52:11.392 UTC | Resume after point | 16 | 13 | 3 | 5/5 | 3/5 |

The marked before-point control checks actual subscription off, resumes,
checks actual subscription on, and waits 200 ms before pointing. All ten
resumed targets match. Its one refusal is the unsubscribed field edit.
The same-build after-point control resumes immediately after pointing. It
again refuses B and the empty target, plus the unsubscribed field edit.
All completed comparisons in both controls match content and fixture.

This same-build comparison reproduces the sequence-related binding failure
without depending on the initial suspected class mismatch. The before-point
control also adds status checks and a delay. These results identify a useful
protocol change for further tests; they do not isolate a single host cause
or establish a publication fence.

Every marked event includes `actualSubscribedAtArrival`. The before-point
run retains 1,702 events, with 232 actual-unsubscribed arrivals. The after-point
run retains 806 events, with 192 such arrivals. All are `Empty` on the resident
view. The resident counter rises from 232 to 424 in the latter run, exactly
its 192-event increment. These actual-state events show empty notifications
during subscription transitions in the tested setup. They do not identify
the source clip or establish occupied-note replay after resubscription.
Keep the unmarked requested-state counters separate.

Same-target resets still give zero sparse observation notes and zero pending
hints with 16 notes found by both full scans in the marked runs. Therefore
the successful before-point control does not resolve sparse replay
completeness.

Each driver run reports its fixture fields restored. The cleanup record now
reports the owned track removed and the four baseline track IDs restored.
The rig configuration was restored from its exact byte backup, and that
backup was removed. Normal-controller reload and final cleanup verification
pass. The normal runtime has 85 methods and hash `bba7383dce25c0f0`.
All three owned temporary project packages are removed. The retained cleanup
artifact confirms normal runtime, inventory, selection, and cursor pins. The results support physical observer reuse under the
continuously subscribed conditions tested here. They do not prove a reusable
cache binding protocol, callback-source rejection, project-wide identity,
or cache eligibility.

## Measurements and verification limits

Each full comparison makes 8,388,608 `getStep` calls across both handles.
Totals below include interrupted scans and sparse reconciliation.

| Run | Total `getStep` calls | Median comparison elapsed, ms | Median aggregate scan host work, ms |
|---|---:|---:|---:|
| Initial | 378,414,336 | 2,169.686 | 195.024 |
| Marked, resume before point | 210,571,424 | 2,164.564 | 194.726 |
| Same marked build, resume after point | 110,158,656 | 2,089.137 | 178.109 |

These are probe measurements. Pure binding latency was not measured
separately. They do not prove production budgets or memory admission.
Fixture assertions cover membership, clip names, disabled chance, and signed
timbre conversion. Gain and duration are acquired and compared between
handles, without independent fixture assertions. No retained trace, hint,
or bounds violation occurred. Cancellation discarded staged comparisons;
recovery matched in all three runs.

## Checks for the retained NoteStep runs

Brain checks pass 1,519 tests. Extension checks pass 28 cache groups.
Normal live hello, wire inventory, context links, both evidence artifact
checks, and diff checks pass. Changes are staged for review; no commit is made.
8g remains active. No stable read or write authority changes.

## Retrospective

Verify an instrumentation marker before each live run. Test subscription
order in the same build. Capture settled endpoints after asynchronous UI
actions. Keep persistent UUIDs separate from loaded-instance identity. No
repository instruction change is needed.

## Selected StepData and chain-witness follow-up

The [follow-up manifest](../data/phase8g-selected-replay-and-witnesses/manifest.json)
retains separate raw records and checksums. This follow-up is active. Keep its
counts separate from the three NoteStep runs and from E214's cache corpus.
Run `npm run probe:phase8g-path-artifacts` from `brain/` to verify hashes,
typed results, fixture ownership, and the active handoff. Its output must retain
`wholeSessionComplete:false` and `eligibilityProved:false` while work is pending.
The runtime remains API 25, `phase-8-probe-v1`, 97 methods, and hash
`f03f19414f40e3d3`. Live hello and the root, replay, and adapter markers passed
before fixture work.

### Sparse replay

`8g-reuse-sparse-replay-v3` passes 26/26 sparse and independent comparisons.
The driver checks sparse membership before scanning either proxy. Neither scan
seeds or repairs the recorder. The cases cover two reset/warm cycles through
A, B, A, empty, and A; disabled chance; chance enable on and off; old B
coordinates read as empty on current A; cancelled binding; and cancelled scan.
Every same-target request preserves the recorder. Every reset uses a populated
canary transition before the target. The driver restores disabled fixture fields.

The 26 cases take 116.655 seconds in total, including binding, settlement, and
both scans. These are small-fixture research costs, not production budgets.
The earlier cold-start replay result remains valid. This run closes the measured
recorder-reset and callback-family errors for the tested protocol.

### Bounded adapter reuse

`8g-shadow-physical-hints-v2` passes 18/18 content comparisons with two resident
handles and one authority handle. Nine forced bindings and nine warm reads
cover repeated retirement and reacquisition of populated and empty clips.
The verifier checks target rows, clip names, exact coverage, all channels,
canary confirmation, physical binding revisions, typed fields, and closed
eligibility gates. Current-target hint reconciliation does not use callback
payload as note content. Callback source identity remains unknown.

Total comparison time is 81.278 seconds. Warm median is 2.099 seconds; forced
binding median is 7.419 seconds. At most four physical hints are retained in
the recorded binding polls. The final estimates are 312 bytes for the domain
recorder, 512 bytes for physical hint recorders, and 35,112 bytes for the
retained snapshot. These exclude host memory and total JVM memory.

Review found that cancellation between comparison polls cleared the scan but
left `comparison:pending`. The v2 content sequence does not exercise that path.
`8g-shadow-physical-hints-v3` terminalizes cancellation, discards scan output,
and preserves a terminal refusal on later polls. Twelve adapter groups and
28 domain groups pass. The v3 driver adds separate retire and rebind controls
during active scans, with independent recovery comparisons. Live v3 passes
18/18 reuse cases on a recreated owned track. Both active-scan controls return
`window-changed` on two polls, expose no candidate or authority, and recover
with independent A matches. Keep the two controls separate from the 18 cases.
The reuse cases take 82.306 seconds. Warm median is 2.104 seconds; forced
binding median is 7.406 seconds. The fixed pool still has three observers.

### Existing chain witnesses

The fixed witness window reads four tracks, four devices per track, and four
layers per device. It creates no content in a user project. The disposable A
fixture loads the existing four-chain preset. Its saved project is 49,657 bytes;
the exact copied package has matching bytes and SHA256
`4fd7a08a1f50ec3ffd54b5a07564d8f75845af76e03bd6043d09b11e7b530c16`.

Eleven endpoint captures are retained. A and Copy share root UUID
`401a3a0d-7707-42ec-8c64-89563944598d` and the same source structure. All four
chain UUIDs differ between their loaded instances. With B keeping its engine,
A and Copy have six equal original root values. Switching A to Copy advances
the combined trace sequence from 520 to 526. No trace row is dropped.
Closing and reopening A changes all four chain UUIDs and preserves the root
UUID. Stable source fingerprints permit these comparisons. No-chain controls
return `unknown`; they do not prove project identity.

The paired full controller reload preserves all four chain UUIDs on reopened A.
The source fingerprint remains equal and the extension instance nonce changes.
Both endpoints are stable, and their traces have no drops. The artifact checker
requires both endpoints and a changed nonce. This is evidence for an optional
loaded-instance witness, not a complete live identity resolver.

The three saved identity project tabs are closed. The original `New 1` remains
open with its engine active. A new replay fixture supports the v3 controls.
The original fixture record is retained separately. Research configuration and
that new fixture remain while automatic witness integration and the rest of the
8g live corpus proceed. Final normal runtime and cleanup remain pending.

Fixture insertion first failed to settle. Activating its engine and confirming
an empty device list permitted the insertion to complete. Exactly one container
with four expected chains was then confirmed. Setup now requires an active
engine before any fixture mutation. This setup failure is not identity evidence.

### Preparation before v5

The next adapter build attaches the optional chain witness to current-target
reads, enrichment, and authority scan boundaries. Delivered root changes retire
resident bindings, active scans, and exact fallback output. Per-initialization
nonces prevent equal numeric counters after controller reload from accepting
old references. No-chain projects refuse warm identity reuse. Independent exact
fallback does not admit residence or use cache membership to select coordinates.
This code does not prove missing-event detection or host input ordering.

The atomic inventory coordinator stages a private registry. It has bounded
batches, a deadline, and explicit retry. Registry publication does not prove
note membership or project identity. The fixed LRU pool reserves and retires
physical slots before binding. It commits a new address only after guarded
settlement. These integration paths still need live tests.

Owned track `339df4ed-f996-490e-9267-2db0a921dc93` now has one copy of the fixed
four-chain preset. The retained setup artifact records ownership before
insertion. Before and after inventories prove unchanged fixture notes, Launcher
slots, and other tracks. The preset SHA256 stays
`b953135a8c744b0796c6fdef86485012790e0533a137c7b59c6c2d21bc77b1f5`.
The first setup attempt stopped before insertion because its empty-track guard
used clip identity. The corrected guard uses the cursor track identity.
This artifact is part of the checked follow-up manifest. It is not another
project-identity trial.

### V5 delivered-event controls

Marker-checked hello confirms `8g-shadow-physical-hints-v5`. Seven LRU
comparisons and three independent exact reads pass. The mutation corpus passes
38 cases: 37 full comparisons and one physical hint overflow control. Three
full comparisons confirm raw fixture restoration. Keep these denominators
separate from the v2 and v3 reuse runs.

Two project detours return to equal original root and four-chain inputs.
Each retains 56 callback deliveries, including 48 identity deliveries. The
automatic identity epoch advances by 48. Each starts with positive private scan
progress. Two later polls refuse retired output, the old read has no output,
and a fresh comparison matches after recovery. One control has no bridge read
between project switches. These results prove invalidation for delivered
events. Missing-event continuity and host input ordering remain unproved.

A fast UI attempt left the original engine inactive. Its endpoint check and
recovery fail. It is retained separately, outside the passing denominator.
The corrected UI sequence confirms state between clicks. The
[v5 manifest](../data/phase8g-v5-acceptance/manifest.json) retains raw bytes,
hashes, semantic checks, and separate failure records.

### Follow-up retrospective

Require active fixture engines before insertion. Test cancellation between
bridge calls as well as inside a scan. Require canary, target-address, and
coverage evidence in artifact verification. No repository instruction change
is needed.

## 8g2 continuity decision

[8g2's protocol](../format/PHASE8G_PROJECT_CONTINUITY.md) uses conservative
refusal. The current live build has no independent input window. It refuses
shadow residence, reuse, comparison, exact acquisition, and inventory.
Equal roots and chain endpoints cannot preserve a reference. No unseen A–B–A
live result is added. The retained measurements above keep their scope.
The live continuity gate remains open. 8g3 starts offline. No live state changed.
