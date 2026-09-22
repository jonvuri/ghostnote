---
title: E121 — Guarded agent note patches pass live reference dogfood
kind: evidence
state: active
updated: 2026-09-22
parent: ../../plan/phase-7/7b-agent-patch-execution-and-reference-dogfood.md
---

# E121 — Guarded agent note patches pass live reference dogfood

## Verdict

The experimental agent note path compiled and applied one reference-conditioned
revision in Bitwig. Complete independent readback found no discrepancy. The
operator auditioned the identified result and replied `Accepted.`

S06, S07 and S09 are implemented. The stable deterministic musical v1 tool and
its registration are unchanged. The new proposal input exists only in the
`phase-7b-agent-note-patch-v0` profile.

## Implemented boundary

`note-compiler-v0` accepts the frozen `ghostnote-note-patch-v0` body, one
complete exact source, and explicit `ghostnote-note-invariants-v0` constraints.
It validates the complete operation sequence. It supports only `transpose`,
`delete`, `move` and `insert`. It rejects stale identities, reused or unknown
event IDs, repeated targets, invalid rational beats, unsupported fields,
unwritable pressure, ambiguous insertion channels, collisions, same-pitch
overlap, range failure, invariant failure and candidates above the 4,096-note
exact-source capacity.

The compiler produces a complete `ghostnote-note-candidate-v0` state. It keeps
all unnamed host fields. A non-insert edit reconstructs every channel of its
clip. An insert-only edit writes only the added notes. Both paths use typed
operations and the existing `Workspace.apply` path.

Preview is read-only. It returns the exact before and candidate states, typed
operations, guards, defaults, invariants, loss list and a SHA-256 preview digest.
Apply requires that digest. It checks the current revision mark, gets a fresh
complete exact source, compares its source hash, recompiles the same preview,
records the write, and gets a separate complete readback. A partial write keeps
its change record, observed effects and discrepancies. The path does not retry a
write.

`track-neutral-v0` uses the one unique source MIDI channel. It sets release
velocity 64/127 and gain 1. The candidate shows mute, expression, chance,
occurrence, recurrence and repeat defaults explicitly. Typed operations omit
only neutral pressure because the host cannot write it. Complete readback
compares the host-normalized result.

`reference-context-v0` keeps seed and reference identities separate. It checks
reference permission and the complete reference hash. Extracted structure is
the default. A mixed profile can add one justified raw excerpt inside the used
coverage. The independent comparator always uses the complete permitted
reference and complete candidate. It reports exact event, exact sequence,
rhythm, unchanged span, pitch-class, onset, contour, density and role measures.
These measures are not a permission decision or an aesthetic verdict.

## Conformance fixtures

The S06 fixtures exercise all four operations across two clips and several MIDI
channels. They preserve pan, timbre and gain. Literal refusal cases cover a
stale hash, unknown and reused IDs, delete-then-move, an extra host field,
unsupported timing, MIDI range, collision, ambiguous channel, pressure and a
split insertion above complete readback capacity.

The S07 fixtures prove a fresh guard, complete all-channel reconstruction,
recorded apply, independent readback, exact reversal data, stale-preview
refusal and retained partial effects. A regression fixture checks the enabled
host defaults for inserted notes.

The S09 fixtures prove extracted-only and bounded mixed profiles. They cover
permission omission, seed/reference identity collision, excerpt expansion,
changed reference identity, forged or mismatched projected permission, exact
copy and structural-only transfer. Module fixtures check request and source
correlation without Bitwig startup.

## Live task

The root was this Codex IDE session. The client was Codex on the host's GPT-5
family. The exact model build and reasoning setting were not exposed to the
repository run. The enabled stable boundary was Bitwig adapter `ghostnote/0`.
The enabled experimental profile was `phase-7b-agent-note-patch-v0`. Permission
covered two generated temporary clips and one recorded proposal write.

The run used Bitwig Studio 6.0.6, Controller API 25 and extension 0.0.1 in
`gn-scale-test`. The deployed method hash was `78368fe47ea0e814`. The reader
advertised 2,048 steps.

The temporary target and reference were 16-beat clips on `gn-B`, rows 4 and 6.
Each source note used an exact 3/4-beat duration. The target contained MIDI 60
through 75, with one onset at each beat. The reference contained MIDI 72 through
87. The target source hash was
`1019883ac366f87966dfd7398c3e56fef72e1474352179ef8a560045d8a44a8b`.
The reference hash was
`b3968c0659b62c75a5638c62ce4ceeff049b78db776168b2f69611919479b8ed`.

The agent used the extracted reference structure and selected one insertion.
It added MIDI 84, 85, 86 and 87 at beats 12, 13, 14 and 15. Each new note used
duration 3/4 and velocity 92. The original 16-note line at velocity 100 remained
fixed backing. The candidate had 20 notes.

The complete-reference comparison reported zero exact copied events. Its
longest exact note sequence was 1, longest exact rhythm sequence was 13,
pitch-class similarity was 1, onset similarity was 1, contour sequence was 13,
and density similarity was 0.8. These values describe the transfer. They did
not decide acceptance.

The accepted change ID was
`d2b91d03-8f2d-4695-b701-b1b51f332ca4`. Its recorded fidelity was exact.
Independent complete readback had an empty discrepancy list. Its reversal data
had no unrestored field. The operator auditioned this exact result with the
fixed backing and replied `Accepted.`

## Refusals and integration finding

The first attempted source used existing `gn-A` material with host durations of
about 0.8999996 beat. The writable grid could not represent those durations.
The safety check refused before any proposal write.

The first disposable fixture run then exposed a default mismatch after a write.
The compiler expected the chance, occurrence, recurrence and repeat enable flags
to be false. Bitwig returned them as true. Independent readback rejected the
result. The fixture had an exact owned fingerprint, so cleanup removed only its
two temporary clips. The compiler now uses the measured true defaults, and a
regression test covers them. The retained live run passed after this correction.

## Timing and bridge work

The table reports the retained 16-note reference and 16-note seed run. Child
adapter spans are inside the acquisition and apply totals. Do not add them to
those totals.

| Boundary | Elapsed time |
|---|---:|
| Target complete acquisition | 3,920.729 ms |
| Target canonicalization and hash | 2.432 ms |
| Reference complete acquisition | 3,875.596 ms |
| Reference canonicalization and hash | 1.238 ms |
| Reference projection | 0.849 ms |
| Compiler source validation | 0.160 ms |
| Compiler proposal validation | 0.825 ms |
| Candidate compilation | 1.097 ms |
| Typed-operation translation | 0.084 ms |
| Complete-reference comparison | 1.220 ms |
| Experimental preview, inclusive | 4.322 ms |
| Guard mark | 25.115 ms |
| Complete fresh preflight | 3,801.443 ms |
| Recorded apply | 8,173.118 ms |
| Independent complete readback | 3,744.445 ms |
| Experimental apply, inclusive | 16,044.461 ms |

Across the complete retained run, adapter child spans were 610.161 ms for
selection restoration, 1,606.720 ms for target acquisition, 184.422 ms for
metadata, 803.656 ms for page turns, 11,652.529 ms for grid settlement,
7,329.813 ms for bulk reads, 2,438.479 ms for page resets, 3.877 ms for
reconciliation, 445.830 ms for observer arms and 22.197 ms for first callbacks.

The run made five batch calls, 80 bulk note-page reads, 100 step-scroll calls,
46 clip pins, 46 track pins, 23 slot selections, 184 slot-status reads, 22
revision reads and 21 selection-status reads. These values describe this one
workstation run. They are not a product SLA.

## Cleanup and final baseline

After the verdict, the probe reversed the dogfood change through its recorded
change ID. It then removed the declared disposable fixture through the original
setup change boundary. Both temporary slots read back exactly empty. This kept
the operator verdict as evidence without leaving test material in the project.

The final live mark was revision 16, scene epoch 3, content epoch 32798 and
generation `a54370bb-fa96-42b7-b45d-488e71528e59`. Revision and content counters
advanced because setup, apply, reversal and cleanup were recorded writes. The
launcher selection was restored to track index 4, row 0. The mixer selection
remained at track index 3.

## Verification

After review hardening, the focused 7b suite passed 17 tests and the full brain
check passed 1,070 tests. The live handshake, extension tests and extension copy
passed for the retained run. That run passed preview, accepted apply, exact
readback, reversal and fixture cleanup. Review hardening did not repeat the
project write. The stable public tool list and v1 input stayed unchanged.

## Retrospective

The patch language reduced the task to four inserted notes. It did not require
full-score generation or repair. The live default mismatch was the useful
integration finding. Bind repeated authority fields at the consumer boundary,
and derive candidate limits from complete readback capacity.
