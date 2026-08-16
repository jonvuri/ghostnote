---
id: E34
kind: evidence
state: active
source: phase-1-session-5f-managed-ab
---

# E34 — Managed native A/B and ordinary track copy stay independent [K] (2026-08-16)

**Verdict: Phase 1 exit criterion 4 is met. A human switched device and clip
alternates through separate Bitwig-native controls. One mixed instruction kept
both managed results correlated but independent. Track copy stayed ordinary.**

## Live result

`probe:5f-ab` confirmed all 10 durable track identities and the documented
project, row, observation, transport, and selection baseline. It copied
`gn-lay` to one disposable instrument track through the production surface.
The copy produced one ordinary-use event and no managed event. Its lifecycle
fields stayed non-automatic.

One mixed instruction then created one device-alternate event and one clip-block
event. Both events used correlation id
`e76e48e2-d8d2-49da-bab4-e95598bf29ea`. They kept distinct result and execution
ids. The persisted record and public report agreed on two instructions, two
managed events, and one ordinary use. The managed counts were one device
alternate and one clip block. The ordinary count was one track copy.

The layer container held the copied device chain in alternate A and an empty
alternate B. Bitwig uses Shift-click for exclusive layer solo. Machine readback
confirmed A-only, B-only, then A-only selection. The operator heard silence
when B was active and heard the high clip pattern again when A was active.

The production clip-block operation copied row 1 to row 2. Independent readback
confirmed two four-beat clips, different note pitches, half-bar launch
quantization, and `continue_or_synced`. The human launched both slots in Bitwig.
The probe observed the queued state, a grid distance of 0.038 beats, and a
three-step distance across the switch. The destination did not restart near its
first step.

The probe changed only the copied clip's pitches through probe-only setup. This
made the two patterns audible without adding another production result.

The device alternate stayed on A during the clip switch. The selected clip kept
playing during both later device switches. Thus, neither native control changed
the other managed representation.

## Cleanup

Cleanup removed disposable track
`b7b34090-f080-4e36-85ff-59c7f03ea6b7`. It restored the exact 72-character
empty observation value, both cursor pin states and targets, `Last change`, and
track 0 row 1 selection. Final checks found the same 10 durable track identities,
10 scenes, and a stopped transport.

## Verification

- Human-assisted live proof: all assertions passed.
- Focused observation and surface tests: 83/83.
- Full offline check: 541/541, with typecheck green.
- Context check: 152 active documents and all links pass.
- `git diff --check`: pass.

## Decision impact

D14, D17, and D18 are unchanged. The result closes Session 5f and Phase 1 exit
criterion 4. Session 5g is next.

## Retrospective

The operator prompt must name Shift-click when it requires exclusive layer
solo. A normal click is additive. No repository instruction change is needed.
