---
title: E297 — Step-controlled operator audio probe
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E297 — Step-controlled operator audio probe

## Result

V13 implements the [E296 listening acceptance](e296-grid-operator-audio-acceptance.md)
and [eight-check procedure](../../plan/phase-9/9a-operator-audio-test.md).
Offline checks pass. The probe archive is deployed with marker
`9a-grid-audio-v13`. Operator replacement and a fresh hello are next.
No live probe call or audio observation was made in this session. Keep 9a active.

The [deployment record](../data/phase9a-operator-audio/deployment-v13.json)
confirms that the built and deployed archives are byte-identical: 728,716 bytes,
SHA-256 `ed8934be54f937bfe0cd805589435260c60c27dead4a06ea94c24eea052694d3`.
The expected profile is `phase-8-probe-v1`, 118 methods, hash
`2e939035ea90b8b0`. The wire inventory is unchanged. V12 is still the last
verified loaded runtime; its allowance stays used and locked. Do not infer
loaded Java classes from the deployed archive.

## Implementation

The driver keeps the eleven native graph stages and independent paired reads.
It pauses with no open graph epoch or native task at B+, B0, B-return, N+, N0,
N-half, N-return, and R+. Each pause reads one literal operator answer from
standard input. A session UUID binds the acknowledgement to the pending check.
There is no default answer. No, unsure, invalid input, or input closure stops
writes. The report names the paired graph files for each listening check.

The Java protocol refuses a wrong session, wrong check, duplicate answer,
answer before graph completion, invalid timestamp, and oversized answer. Each
accepted record contains its number, completed stage, prompt/answer/receipt
times, literal answer, and verdict. Status adds the build marker and
initialization time. One session and one factory attempt remain available per
initialization. No command can cross an unanswered check.

Preparation and final restoration require mute and an inactive engine. The
active sequence requires unmute, the fixed -10 dB level, stopped transport,
original target and connection, and no foreign note. The note subscription
serves only this last guard. Note injection, note lease, meter objects, packet
reads, numeric signal tests, and timed meter sampling are removed from this
runner. The previous automatic signal classes are deleted.

The driver retains its TCP connection during human pauses. The bridge exposes
connection lifetime to the async handler without a host read. Client loss
locks writes. One cache-only timer expires the 15-minute session. Each automatic
segment has 60 seconds; a human wait does not use that segment allowance.
The five-second response watchdog and four-second pre-operation deadline
remain. No timer claims to cancel native work.

The first failure freezes operator answers, pending check, last completed
stage, factory state, and graph progress. Later failure, status, recovery, and
session release do not change that copy. A negative answer is recorded before
the failure freezes. The reason is bounded to 512 ASCII bytes; failure context
is bounded to 3 KiB, leaving room inside the 4 KiB metadata allowance. Eight
128-byte answers plus the frozen record fit within 16 KiB of encoded evidence.
Status/ack responses have a 32 KiB cap. Tests include worst-case JSON escaping.

Failure does not run inverse edits. At most one four-call read-only recovery
is admitted after native completion. Exact restoration still requires operator
close without save, exact file hashes, reopen, an inactive engine, paired
baseline reads, and session release. The final workflow retains 16 calls.
The separate live session must verify those operator boundaries.

## Costs and verification

The [ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) records the
implementation cost model. Typical and largest admitted structure are the
same: one four-to-five-to-four-module cycle, at most three cables and 61 nodes.
The driver uses 240 calls: 16 prepare, 208 run, and 16 restore. This includes
59 fixture captures, two detached captures, eleven edits, one factory, eight
cached acknowledgements, and zero note writes. The fixed native task count is
73: 59 fixture captures, 13 binds, and session begin. The detached captures
share the factory command task.

This replaces the conditional 248-call meter plan with eight fewer calls.
All 80 window document tasks and 136 sampler timer/delivery entries are gone.
One expiry timer is added; client loss schedules one controller notification.
Human pauses make no polling calls. The approximate wire floor remains
5,760 ms at 24 ms per call. The planned warm request allowance is 9,690 ms,
plus 1,950 ms cursor settlement and human listening time. These are planning
figures, not measurements. Cold symbol/factory work and native heap remain
unmeasured. The 16 MiB temporary graph heap remains an allowance.

Component timers are inside existing reads and commands. They separate symbol
lookup, queue delay, guards, navigation/projection, traversal, property byte
accounting, final graph encoding, native witness work, validation/copies,
mutation/prediction, response size check, and completion delivery. Property
byte accounting is nested in traversal; do not sum nested and parent timers.
The 1 MiB graph response reserves 1 KiB for final timing metadata. There are no
extra captures. E292's 43.544 ms maximum is still unexplained. The next admitted
live run must measure these components and explain any regression over 20
percent. No timing retry is authorized by this preparation.

Verification:

- [TypeScript check log](../data/phase9a-operator-audio/brain-checks.txt):
  244 tests pass. This includes seven operator-driver tests, product call
  budgets, live adapter frames, and the actual method inventory. Typecheck
  passes. Every graph-stage command/read failure and every negative listening
  checkpoint stops without inverse edits or a retry. A pending answer sends
  no graph edit. Missing, closed, invalid, oversized, and expired input refuses.
- [Java check log](../data/phase9a-operator-audio/extension-checks.txt):
  `./gradlew check gridEngineSymbolsTest gridAttachmentSymbolsTest` passes.
  Tests cover exact order, unanswered gates, wrong sessions and duplicate answers,
  mute boundaries, negative answers, deadlines, immutable first failure,
  connection lifetime, one factory/recovery, maximum encoding, exact graph
  predictions, async failure handling, and archive profiles. Engine and
  attachment symbols resolve against the pinned installed JAR without vendor
  initialization.
- `./gradlew copyProbeExtension` passes. The deployed archive matches the build.
  Saved project and backup retain the exact baseline hash; the preset is
  unchanged. No fixture edit, save, reopen, or controller UI action was made.
- Context links and both staged/unstaged diff checks pass. Existing E295/E296
  staged work is preserved. This session's work is staged; no commit is made.

No public tool description changed. Descriptions remain v52 with 44 tools.
Product wire budgets are unchanged. The generic bridge lifetime support adds
no normal-profile host call; its callback is registered only by this probe.
Offline tests cannot establish live callback timing, audible output, or native
execution cost. Those results belong to the next listening run and restoration.

Retrospective: retain the exact graph driver when the evidence requirement
changes. Replacing only its signal boundary kept the call budget and restoration
checks reviewable. The plan now includes the persistent-input command sequence.
No repository-wide instruction change is needed.
