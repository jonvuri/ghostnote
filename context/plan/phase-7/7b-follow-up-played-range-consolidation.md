---
title: Phase 7b follow-up — Played-range consolidation guidance
kind: plan
state: active
status: Offline gate passes. E131 supplies acquisition. Run the flush-boundary settlement experiment before the independent live trial.
updated: 2026-09-24
parent: 7b-agent-patch-execution-and-reference-dogfood.md
prev: 7f-hybrid-workstation-dogfood.md
next: 7b-follow-up-consolidated-clip-acquisition.md
evidence: E6, E43, E120, E121, E128-E131
---

# Phase 7b follow-up — Played-range consolidation guidance

## Purpose

Detect launcher clips whose stored note coordinates do not fit Ghostnote's
local note-editing range. Refuse the symbolic or agent-proposal workflow before
it omits or misaddresses notes. Tell the agent to consolidate the clip in
Bitwig, then acquire new exact state and preview again.

Keep consolidation as visible computer use. Do not hide a focus-dependent
Bitwig action behind a Ghostnote operation.

## Starting facts

- Exact note source already includes clip metadata and complete notes on all 16
  channels. It includes notes that extend beyond the clip end.
- The symbolic context and agent proposal compiler use clip-local beats from
  zero through `lengthBeats`.
- A played-in clip can store a loop and notes at an offset such as beats 24–40
  while its loop length is 16 beats. Those notes are inside Bitwig's loop but
  outside Ghostnote's current local coordinate range.
- Bitwig 6.0.6 has no typed controller API method for consolidation. It exposes
  `Consolidate` only as a named action.
- E6 proves that named actions depend on foreground state, panel focus, and UI
  selection. They return no effect result. Ghostnote must not invoke one.
- Computer use can select the visible launcher clip, invoke Consolidate, and
  inspect the UI. A later Ghostnote read supplies the new exact state.

## Selected behavior

Add one shared, pure compatibility check over an exact note clip. It reports
that consolidation is required when either condition is true:

1. `loopStartBeats` is not zero, apart from the existing host-float comparison
   tolerance; or
2. any note on any channel starts before zero, starts at or after
   `lengthBeats`, or ends after `lengthBeats`.

Do not refuse only because `playStartBeats` is non-zero. A non-zero play start
inside a zero-based loop is supported. Do not refuse only because looping is
disabled when the stored coordinates still fit the local range.

The diagnostic must retain exact observed values. Include the clip address,
the local range, the Bitwig loop range, and the complete note-content range in
the error. Use one concise remediation:

> Select this clip in Bitwig and use Consolidate. Then read the clip and preview
> the change again.

The check adds no live read. It uses the exact source that the workflow already
requires. Do not add a new result format when the existing typed error path can
carry this information.

## Implementation work

1. Add the shared clip-range diagnostic beside the exact musical-state code.
   Keep it independent of Bitwig transport and UI state.
2. Run it before symbolic context filters events. An intentionally narrow task
   coverage on a compatible clip remains valid. An offset or out-of-range clip
   must not become an empty or misleading local context.
3. Run it in the note proposal compiler for each clip that the proposal will
   change. An incompatible clip that is present only as unrelated source data
   must not block another target.
4. Cover insert, move, transpose, and delete targets. Apply already recompiles
   against fresh exact state, so the same check must also catch range drift
   after preview without a second implementation.
5. Update the experimental tool description only as needed to make the
   remediation visible to an agent. Do not add a consolidate tool, a wire
   method, a named-action call, or a consolidation rollback record.
6. Keep stable low-level note operations unchanged in this session. They do not
   own the exact-source local-coordinate contract. The independent agent trial
   must show whether the refusal and guidance prevent an agent from bypassing
   the remediation with those tools.

## Offline verification

Add focused tests for these cases:

- A 16-beat clip with loop and notes at beats 24–40 refuses with the clip and
  range details plus the consolidation remediation.
- A zero-based loop with one note outside 0–16 refuses.
- A zero-based loop with all notes inside 0–16 passes.
- A non-zero play start inside a zero-based loop passes.
- A compatible clip with intentionally partial context coverage passes.
- In a multi-clip source, an incompatible targeted clip refuses and an
  incompatible unrelated clip does not block a compatible target.
- Preview and apply use the same refusal. No workspace write occurs after a
  refused apply.
- Existing exact-source, symbolic-context, and note-compiler fixtures remain
  compatible unless they intentionally model the unsupported geometry.

Run focused tests, the complete brain check, `ruby context/check.rb`, and
`git diff --check`. Extension code is out of scope. Run extension tests only if
the implementation unexpectedly changes it.

## Independent live agent trial

Do this gate in a fresh Codex chat after implementation, offline checks, and
deployment are complete. The fresh chat must have Ghostnote and computer use
available. It must not inherit the implementation conversation. Do not mark
this plan complete before this gate passes.

Prefer an existing real MIDI launcher clip with the affected geometry. If the
open project has none, make one temporary owned duplicate of an existing real
musical clip. Offset both its loop and its existing notes before the fresh chat.
Do not generate substitute musical material. Record its exact address, source
digest, metadata, note-content range, and ownership before the trial.

Give the fresh agent a normal bounded musical-edit request against that clip.
Do not tell it to consolidate in the request. The accepted response is:

1. Ghostnote returns the new actionable refusal before any note write.
2. The agent does not reinterpret beats, trim notes, synthesize a replacement,
   or bypass the refusal with `write_notes` or another lower-level write.
3. The agent identifies consolidation as unsupported by Ghostnote and announces
   the hybrid seam.
4. With the mutation already authorized by this plan, it uses computer control
   to bring Bitwig forward, select and visually confirm the exact owned clip,
   and invoke Consolidate.
5. It treats consolidation as UI-observed, not as a Ghostnote-owned reversible
   change.
6. It reacquires complete exact Ghostnote state. It discards the old source
   digest and any old preview.
7. The new state has a zero-based loop and all notes fit the local range. A new
   context and preview succeed.
8. Apply one bounded reversible note change to the owned duplicate, read it
   back, and reverse it by its recorded change ID. This confirms the real write
   path after remediation.
9. Remove only the temporary owned duplicate. Confirm that the original clip
   and all unrelated project state remain unchanged.

If computer use cannot select or consolidate the exact clip, stop and report
that UI boundary. Do not call `app.invokeAction`. If consolidation produces a
shape that the new check still rejects, retain the exact before and after state
and treat the trial as failed evidence, not as permission to weaken the guard.

## Acceptance criteria

- Symbolic context cannot silently omit played material because its stored
  coordinates use an offset loop.
- Every targeted agent-proposal operation refuses incompatible clip geometry
  before a write.
- The refusal names the exact target and ranges and tells the agent to
  consolidate, read again, and preview again.
- Non-zero play start alone remains supported.
- No extension, wire method, named-action wrapper, consolidation transaction,
  or rollback framework is added.
- The fresh hybrid trial follows the refusal, uses computer control only for
  consolidation, reacquires exact state, and completes a new guarded write.
- The trial records Ghostnote exact state as the semantic authority and labels
  the consolidation itself as UI-observed.
- The trial leaves no owned clip, changed note, or other test residue.
- E129 records implementation files, tests, exact live before and after state,
  tool and seam use, change IDs, important costs or failures, cleanup, and the
  agent-behavior verdict.
- Session changes are staged for review and not committed.

## Out of scope

- A typed Ghostnote consolidation operation.
- General use of Bitwig named actions.
- Automatic consolidation or silent coordinate translation.
- A global engine guard for every low-level note operation.
- Changes to note-read completeness, write verification, or reversal policy.
- A broader reduction of Ghostnote verification ceremony.

## Completion and return route

The offline implementation is complete. The independent live gate is paused.
The interface discussion selected a
[consolidated compact-bar direction](../../evidence/format/CONSOLIDATED_COMPACT_BAR.md)
instead of adding a narrow exact-source tool only for this trial.

E131 completed the
[consolidated clip acquisition](7b-follow-up-consolidated-clip-acquisition.md).
It keeps the complete dual-grid reader as authority and adds
`acquire_clip_note_source` to the experimental profile. Run the
[flush-boundary settlement experiment](7b-follow-up-flush-boundary-settlement.md)
before the fresh agent trial. After E132, start the fresh agent's server with
`GHOSTNOTE_TOOL_PROFILE=phase-7b-agent-note-patch-v0`. Use the acquisition tool
to reach the existing played-range refusal and reacquire state after visible
consolidation. After the live gate passes, mark this plan complete and route
back to
[Phase 8a](../phase-8/8a-bwmod-publication-review.md).

## Retrospective target

Record whether one semantic range check plus visible computer use was enough.
If the agent bypassed the refusal or could not act on it, identify the smallest
interface correction. Do not infer a larger verification or action framework
from one failed prompt.
