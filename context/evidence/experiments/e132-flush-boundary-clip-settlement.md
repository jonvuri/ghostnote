---
title: E132 — Flush boundaries do not prove clip settlement
kind: evidence
state: active
updated: 2026-09-24
parent: ../../plan/phase-7/7b-follow-up-flush-boundary-settlement.md
---

# E132 — Flush boundaries do not prove clip settlement [K]

## Verdict

Reject `ControllerExtension.flush()` as a note-grid replay completion fence.
The first flush can precede target and grid replay. Rules that require a dirty
flush cannot classify empty-to-empty target or page changes. Two passive quiet
flushes can still precede later replay work.

The callback-aware rules were useful only as wake hints. They add no authority
beyond the existing observer callback and cannot replace the settled complete
reader. The E131 reader, its 144 ms page settlement, and its conservative sparse
probe remain unchanged. All E132 extension hooks were removed after the trial.
The next
[hybrid acquisition experiment](../../plan/phase-7/7b-follow-up-hybrid-observer-acquisition.md)
tests the requested dirty-and-quiet wake with an explicit complete-reader
fallback for silent views.

## Controlled matrix

The live probe used one owned track with two empty clips, a sparse clip, an
identical duplicate, and a dense 16-beat clip. The fixtures covered all 16 MIDI
channels, adjacent same-pitch notes, optional note fields, binary and triplet
grids, dense page-zero content, and late interior-page content.

The matrix covered 11 transitions:

- populated target to different and identical populated targets;
- populated target to empty and empty target to empty;
- page zero to an interior page and one interior page to another;
- populated page to empty and empty page to empty;
- binary grid to triplet grid and back; and
- one note edit after initial replay.

Each transition ran 30 times with passive flushes and 30 times with explicit
`requestFlush()` calls. The 660 trials compared every candidate snapshot and
its immediate all-channel enrichment with a late observer snapshot and the
settled complete all-channel reader. All 660 late observer results matched the
complete reader.

## Candidate results

| Candidate | Passive result | Requested result | Mean passive time | Mean requested time |
|---|---:|---:|---:|---:|
| First flush | 122 early / 330 | 119 early / 330 | 0.270 ms | 0.250 ms |
| First flush after a callback | 0 early / 270 dirty; 60 misses | 0 early / 270 dirty; 60 misses | 27.409 ms | 27.238 ms |
| First quiet flush after dirty | 0 early / 270 dirty; 60 misses | 0 early / 270 dirty; 60 misses | 51.071 ms | 51.262 ms |
| Second quiet flush after dirty | 12 early / 270 dirty; 60 misses | 0 early / 270 dirty; 60 misses | 75.476 ms | 75.629 ms |

The misses are the two empty-to-empty transitions. No dirty callback exists in
those arms, so a dirty-dependent rule cannot decide completion. Some first
flushes on empty transitions appeared correct only because an empty snapshot
equals empty late truth. Grid and page changes have no exact host canary, so
silence cannot prove that the requested view arrived.

The 0, 24, and 48 ms tasks after each dirty flush saw no later callback in
their windows. This did not make the rule authoritative. Later replay still
made 12 passive second-quiet candidates early. The first quiet rule was faster
than the 250 ms sparse fallback on dirty arms, but it was only a delayed wake
hint and did not cover empty views.

## Lifecycle boundary

Controller API 25 documents `flush()` as an output opportunity. It does not
document an input fence. `requestFlush()` made the first output opportunity
prompt, but it did not wait for clip input. The measured result agrees with the
documented boundary.

The probe copied the fixed step-data buffer in `flush()` and scheduled bounded
candidate enrichment on the next control-surface task. It did no network I/O
inside `flush()`. A target canary checked observed track and scene. Grid and
page identity remained local requests because API 25 exposes no exact host
value for them.

## Cleanup and product state

The probe removed its owned track and five owned clips. It restored the exact
four-track list, launcher selection, mixer selection, cursor targets, pin
states, and stopped transport. No test residue remains.

The temporary three-method flush probe and the `flush()` recorder were removed.
The deployed source returns to 157 methods and method hash
`905bc2531512025b`. The complete reader and the experimental
`phase-7b-agent-note-patch-v0` acquisition route did not change.

## Verification

The complete brain check passes 1,176 tests. The extension build, context link
check, wire-golden check, whitespace check, and final live hello pass. The live
extension reports Controller API 25, 157 methods, method hash
`905bc2531512025b`, and a fresh deployed build.

## Retrospective

An output lifecycle callback did not supply an input completion boundary. Keep
the empty-view controls. A local generation and matching empty result do not
prove that a grid or page transition reached the host.
