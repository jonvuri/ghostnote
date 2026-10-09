---
title: Phase 8i10 unprompted overlay trials
kind: plan
state: planned
status: After 8i7 and 8i8. Fresh-client trials with minimal, natural prompts that benefit from timing overlays but do not ask for them. Measures whether an agent reaches for overlays unprompted.
updated: 2026-10-09
parent: README.md
prev: 8i8-selection-and-readback-results.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E256; D45, D47
---

# Phase 8i10 unprompted overlay trials

The 8i9 operator trial passed
([E256](../../evidence/experiments/e256-overlay-authoring-and-creation.md#operator-trial)),
but its prompt asked the agent to "keep track of the bass's underlying rhythm
and how each note sits ahead of or behind it, alongside the clip". That is
close to a description of nominal and groove claims. This session tests
whether an agent chooses timing overlays when a task only benefits from them.

This is a trial and analysis session. It changes no code unless the decision
rule below allows one bounded description change.

## Question

1. Does a fresh agent create nominal and groove claims when a feel-sensitive
   task does not name them?
2. Does a later step that needs the feel (revise it, transfer it, or survive a
   hand edit) read and use existing claims, and recognize stale or removed
   ones?
3. Does the agent leave overlays out where they add nothing (control)?

A trial passes musically on the operator's verdict alone. Overlay use is the
interface measure, not a requirement for a musical pass.

## Entry checks

- Read E256 (operator trial), the [charter trial procedure](8i-agent-native-hybrid-dogfood.md#operator-overlay-trial),
  and the current `add_launcher_clip`, `edit_launcher_clip`,
  `read_launcher_clip`, and `get_document_reference` descriptions. Record the
  description version (v42, or later after 8i7 and 8i8).
- Claim persistence. Claims live in the server process (E256). Find out
  whether the client starts one ghostnote server for each thread: put one
  claim on an owned clip in thread A, then read the clip in a new thread B.
  If B has no claim, run each multi-step trial in one thread, and record the
  per-thread loss as a limit. Do not plan persistence here.
- No leaked claims: the trial project must hold no claims and no clip or
  workspace note from earlier trials. Restart the client before the first
  trial. Use an owned copy of "Night Glass" (the operator saves it as a new
  project) with the Scene 2 bass slot empty, or another project that the
  operator chooses.

## Trials

The operator runs each trial in a fresh client (Codex Desktop, no repository
access, no instructions other than the global "Stay concise and to the point").
Send each step exactly as written; do not add hints after a step. A hand
edit between steps is the operator's.

**T1, write then revise (one thread, three steps).**

1. "In the open Bitwig project, write a bass part for Scene 2 that sits in
   the same pocket as the Rain Steps drums. Use the existing bass sound, then
   start Scene 2."
2. After listening: "Nice. Make it a touch less laid back, about half as
   much, without changing the rhythm."
3. The operator moves two bass notes by hand (one onset, one length). Then:
   "I nudged a couple of notes by hand. Bring the rest of the bass in line
   with the feel you set before."

Benefit: step 2 scales a timing offset without changing the nominal rhythm;
step 3 needs to know which notes still carry the earlier interpretation.
Without claims, the agent must infer the grid and the offsets again from the
shifted notes.

**T2, clean up existing timing (one thread, two steps).**

1. "The shaker in Scene 1 is a bit sloppy. Clean it up but keep its swing."
2. "Bring back a little of the looseness, maybe a third of what it had."

Benefit: step 1 must separate the intended swing from the residual timing of
the existing part (measured, unresolved claims); step 2 needs the removed
residuals. Use an owned duplicate of the shaker clip, so that the original
stays.

**T3, control (one thread, one step).**

"Add a simple pad line in Scene 2 that follows the chords, then start the
scene."

A plain line on the grid has no feel to keep. Claims here are not an error,
but record them.

## Record

For each step: the transcript (an extract as in
`evidence/data/phase8i9-operator-trial/`), the reference sections requested,
whether the agent created or used claims and of which type and mode
(known or unknown source), refusals and repairs, calls, time to completion,
claim states after the hand edit, how the agent described stale or removed
claims, other ways it kept the feel (a workspace note, a comment in the clip
name, no record), and the operator's musical verdict. Leave owned fixtures
removed or kept by operator choice.

## Decision rule

- T1 step 1 or T2 step 1 creates claims unprompted, and the later steps use
  them correctly: record the pass in a new E record; no change.
- Neither first step creates claims, but the later steps succeed in another
  way: record it. Overlays are then an expert path, not a default one; state
  that in the charter verdict for overlays.
- Neither first step creates claims, and a later step fails or guesses (a
  changed rhythm, a lost feel, or a wrong statement about which notes keep
  the interpretation): this session may make one bounded description change
  to `add_launcher_clip` and `edit_launcher_clip` (at most about 200 bytes in
  total: when a task depends on feel, timing claims keep the rhythm and the
  offsets apart for later revision). Bump the description version, then
  repeat T1 once in a fresh client. Report the before and after.
- T3 with claims that cost a refusal or a slower call: record it as overuse
  and include it in the same change, or name it as a limit.

## Cost model

No new live path. Each trial uses the existing read, add, edit, and launch
paths (E256 ledger rows). A claim-only edit costs about 800 ms (E253); a
whole-clip timing edit about 1.7 s. Compare per-step time with and without
claims where both routes occur.

## Acceptance

- T1, T2, and T3 run as written, with transcripts and the operator verdicts
  recorded in a new E record and its index row.
- The entry checks are recorded, including whether claims persist across
  threads.
- The decision rule is applied and its outcome stated in the charter
  ("Agent-behavior gates": groove and stale-overlay recognition).
- If a description changes: tests, the cohort version and artifact, the byte
  change, and the T1 rerun.
- NOW routes to the next step; fixtures are at the operator's chosen state.

## Out of scope

Overlay persistence across server restarts, new tools, a scene-launch tool,
changes to the format or the reference, and a coached tool sequence.
