---
title: Phase 8i13 automated dogfood stretch set
kind: plan
state: proposed
status: Proposed. The operator selects the tasks; then this plan is the next session.
updated: 2026-10-11
parent: README.md
prev: 8i12-automated-dogfood-process-proof.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E261
---

# Phase 8i13 automated dogfood stretch set

[8i12](8i12-automated-dogfood-process-proof.md) proved the automated loop
([E261](../../evidence/experiments/e261-automated-dogfood-process-proof.md)).
This session runs the tasks that stretch the parts of Ghostnote that the 8i
trials stretched least. The driving agent follows the
[runbook](8i-automated-dogfood-runbook.md) and writes each issue to the
[issue log](8i-dogfood-issues.md). The operator reviews the log in a later
live session.

**Operator decision: select the tasks.** The recommendation is all five
tasks with both clients (10 runs). The 8i11 claim repairs are not in the
set: they need two prompts in one session, and claims do not survive a
session resume. They stay with the operator in Codex Desktop.

## Proposed tasks

Each task runs in `gn-scale-test` on tracks that the driver adds and
deletes. No task needs a UI action. A new driver
`brain/src/probes/phase8i13-stretch.ts <task> setup|state|cleanup` makes
each fixture with the product tools, prints the independent state with raw
wire reads, and deletes the fixture tracks and scenes.

### S1. Mixer and clips on several tracks

- **Goal**: one request changes clips and mixer values on four tracks.
- **Fixture**: tracks Drums, Bass, Pad, Lead at -10 dB, each with one
  4-beat clip in Scene 1 (8 notes).
- **Prompt**: "In the open Bitwig project, copy the Scene 1 clips of
  Drums, Bass, Pad and Lead to Scene 2 and name each copy 'B'. Then mute
  Lead, set Bass to -6 dB and set Pad to -14 dB."
- **Check**: Scene 2 holds four clips named `B` with the notes of
  Scene 1; Scene 1 is unchanged; Lead mute is on; Bass raw 0.79433 and
  Pad raw 0.58434 (±0.0001); no other track changed.
- **Cleanup**: delete the four tracks.

### S2. Device structure and a request to undo

- **Goal**: `compose_devices`, `move_devices`, and one modulation route,
  then an honest reversal (`revert_change` does not reverse
  `move_devices`).
- **Fixture**: track Keys with one native instrument (Polymer).
- **Prompt**: "On the Keys track, add an EQ and a delay after the
  instrument, then put the delay before the EQ, and add an LFO that moves
  the delay mix. When that works, put the track back exactly as it was and
  tell me anything you could not undo."
- **Check**: the final device list and the instrument's control values
  equal the state before; the report names each step it could not revert
  and how it restored it. Route: count the reverts, the refusals, and the
  manual restores.
- **Cleanup**: delete the track.

### S3. A request above a D44 limit, with one missing target

- **Goal**: the agent splits a request above `trackMixerTracks` (8) and
  reports the part that it could not do.
- **Fixture**: tracks T01 to T12 at -10 dB.
- **Prompt**: "Set the tracks T01 to T13 to these levels: T01 -1 dB,
  T02 -2 dB, and so on down to T13 -13 dB."
- **Check**: T01 to T12 hold raw 10^(-n/60) (±0.0001); the report says
  that T13 does not exist; no track was added. Route: one `outside-limit`
  refusal at most, then a split.
- **Cleanup**: delete the twelve tracks.

### S4. Clip and scene structure

- **Goal**: clip move, delete, and copy, and a scene request that the host
  cannot do (no insert above row 0).
- **Fixture**: track Seq with clips A, B, C, D in Scenes 1 to 4.
- **Prompt**: "On the Seq track, move the Scene 2 clip to Scene 6, delete
  the Scene 3 clip, and copy the Scene 1 clip to Scene 3. Then add a new
  empty scene above Scene 1."
- **Check**: Seq holds A in rows 0 and 2, B in row 5, D in row 3, and
  nothing in row 1; the clips of the other tracks are in their rows; the
  report states the scene limit, or the scene count grew by one and the
  report says where the scene is.
- **Cleanup**: delete the track and each added scene.

### S5. Tool discovery without the Ghostnote line

- **Goal**: each client finds Ghostnote from the task alone (E259: a Codex
  Desktop agent did not).
- **Fixture and check**: P1 (`phase8i7-mixer.ts trial-setup`, E261
  baseline: 3 Ghostnote calls).
- **Runner**: add an option that does not add "Use Ghostnote.".
- **Check**: the P1 state, and the route: the first tool the agent calls,
  each computer-use or shell attempt, and whether it reached Ghostnote.
  A run that does not reach Ghostnote is a result, not a failure of the
  loop.
- **Cleanup**: `trial-cleanup`.

## Work

1. Entry checks of the runbook.
2. Add the driver and the task files for the selected tasks; add the
   runner option that S5 needs. Check each fixture and its cleanup
   once before the first agent run.
3. Run each selected task with each client, with a restore between runs.
4. Write the verdicts (E262) and the issue rows.

## Cost model

No live path changes and no host call is added. The driver uses the
product tools for setup and raw reads for the state. A task that shows a
product or description fault goes to the issue log, not into this session.

## Acceptance

- Each selected task has, for each client, an extract, an independent
  state read, and a verdict.
- The issue log has every issue that the verdicts name.
- `gn-scale-test` equals its entry state; `/tmp` holds no needed artifact.
- A new E record (E262) with its index row; `context/check.rb` passes.
- NOW names the operator review of the issue log as the next step, then
  the 8i gate close-out.

## Out of scope

Computer use, product or description changes, aesthetic verdicts, work in
"Night Glass" or "ice jungle", and parallel sessions.
