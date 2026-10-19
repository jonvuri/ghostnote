---
title: E296 — Operator audio acceptance for the Grid spike
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E296 — Operator audio acceptance for the Grid spike

## Result

The operator requested a change from automated signal proof to manual audio
verification: “Redefine the A/C to be an operator-verified audio result and
prepare a simple test we can run through.” The
[new acceptance and checklist](../../plan/phase-9/9a-operator-audio-test.md)
implement that decision. Keep 9a active. No audio pass is claimed yet.

The remaining audio gate is now eight operator observations of the continuous
fixture: baseline tone, original gain off/back, new series module at unity,
new gain off/reduced/full, and original patch restored. The agent performs
the native edits and independent paired graph reads. The operator listens and
answers yes, no, or unsure at each pause. No or unsure stops the sequence.
Graph agreement and exact baseline restoration remain mandatory.

The claim is **operator-verified audio response on the fixed Poly Grid
fixture**. It does not claim absolute digital zero, an exact half-gain ratio,
sample continuity, or arbitrary Grid behavior. No ongoing packet check is
required by this spike acceptance. The E294/E295 findings remain valid for
automated measurement, but their missing witness no longer blocks 9a.
Native producer reconstruction and the automated meter runner are deferred;
resume them only for a selected need for automated signal evidence.

## Procedure and implementation boundary

The unchanged oscillator fixture can sound with stopped transport. The operator
will temporarily unmute `grid-probe` through its existing main output, at a
fixed comfortable monitor level. Keep the -10 dB track setting. Expected master
output replaces the old master-silence gate. Use no test notes, clip writes,
new analyzer, extra audio route, or manual graph edits.

Inspection of `GridEngineHandlers.guard`, `GridEngineProtocol.ORDER`,
`GridEngineSymbols`, and `phase9a-grid-engine.ts` confirms that V12 cannot run
this test: it requires mute, note pulses, meter evidence, and a 60-second
automatic sequence. It is also already used and locked. The checklist therefore
states its readiness limit explicitly. This session prepares the acceptance
and procedure; it does not implement, build, or deploy the replacement probe.

The next named session prepares a step-controlled probe. It retains the fixed
eleven graph stages, paired readback, ownership/disposal rules, one factory,
first-failure lock, and final 16-call restoration. Eight cache-only operator
acknowledgements replace meter windows. The driver must wait for actual operator
input. Remove note injection, meter reads, and sampler tasks. Permit the planned
mute transitions and allow human pauses. Offline checks must prove those
boundaries before deployment and operator controller replacement.

Failure stops writes; it does not trigger inverse edits. The operator mutes and
deactivates the fixture. Exact restoration still closes without save, verifies
or restores baseline bytes, reopens, requires inactive state, reacquires
identities, and performs one final paired read workflow. The operator answers
and first failure remain frozen through recovery and restoration.

## Costs, verification, and handoff

This session has zero live calls, host tasks, cold reads, writes, subscriptions,
and probe heap allocation for both typical and maximum cases. No live project
or fixture was touched. The new planned fixed-scope budget is 240 calls:
16 prepare, 208 run, and 16 restoration. It retains 59 fixture/two detached
captures, 11 edits, one factory, and zero note writes. Eight cache-only answers
replace 16 signal boundary calls; the 80 meter tasks and 136 sampler scheduled
entries are removed. The new plan budgets 16 MiB graph heap, 1 MiB graph
response, 16 KiB answer/failure evidence, and 32 KiB status/ack response.

At 24 ms per call, the wire floor is 5,760 ms. Warm request allowance is
9.690 seconds plus 1.950 seconds cursor settlement and operator time. The
15-minute session allowance replaces the old 60-second full-run limit; each
automatic segment still has a 60-second limit. Native work cannot be cancelled
by a timer. These are design costs, not measurements. E292's 43.544 ms read
maximum remains unexplained. Component timings stay planned inside existing
calls. No extra timing read or restoration retry is allowed.

Verification: checked the checklist against the existing eleven stage deltas;
checked the cost arithmetic and all context links; `git diff --check` and
`git diff --cached --check` pass. No runtime tests apply to this documentation
change. Product budgets and tool descriptions are unchanged; descriptions
remain v52 with 44 tools. V12 remains deployed, used, and locked. Existing
staged E295 work is preserved. This session's changes are staged, not committed.

Retrospective: choose the required strength of evidence before tracing a
measurement protocol. For a bounded spike, an explicit operator observation
can meet the goal without an automated meter witness. Keep the stronger result
as a separate research option. The new acceptance makes that distinction;
no repository-wide instruction change is needed.
