---
title: E259 — Unprompted overlay trials
kind: evidence
state: done
updated: 2026-10-09
owner: phase-8i10
---

# E259 — Unprompted overlay trials

## Status

[8i10](../../plan/phase-8/8i10-unprompted-overlay-trials.md) is complete.
In the first runs (descriptions v44, reference revision 3), no agent made
timing claims, and the decision rule selected its third case. With the
operator's scope change, descriptions v45 route timing-feel tasks to Timing
overlays, and reference revision 4 adds an analysis method. In the reruns,
both first steps made claims without a request and the later steps used
them: T1 step 3 kept the step-2 feel, and T2 kept the shaker's step pattern
and pushes. Five refusals for duplicate claims and timing equations remain;
[8i11](../../plan/phase-8/8i11-claim-replacement-repair.md) adds the repair.

First-run T1 result: the agent created no timing claims. Step 1 and step 2 met the
brief mechanically. Step 3 found and kept the hand edits, but set the other
notes back to the step-1 timing, and that undid step 2. The operator's
musical verdict is neutral.

First-run T2 result: no claims. Step 1 kept the swing as one median for on-beats and
one for off-beats, and lost the shaker's step pattern and its pushes. Step 2
restored 57 percent of the original deviations, not a third. Nine notes
that were early are no longer early. The operator heard this.

T3 (control) result: a 20-note pad on the grid in one add, with no claims
and no reference request. The operator accepted it.

## Setup

- Client: Codex Desktop, fresh thread, no repository access, global
  instruction "Stay concise and to the point" only.
- Descriptions `ghostnote-description-v44`, model reference revision 3, the
  8i8 extension build (for T1, T2, and T3).
- Project: the server reported "Night Glass". At the start of the T1
  thread, the drums, pad, chords, and bass slots of Scene 2 read empty.
- The entry checks ran after T1; see [Entry checks](#entry-checks).

## Entry checks

The operator skipped the entry checks before T1 and ran them before T2.

- Description version: `ghostnote-description-v44`, model reference
  revision 3. The read, add, and edit descriptions are the 8i8 set.
- Client restart: the Codex Desktop app server started at 19:44:50, before
  the first T1 thread (19:45:20). The T1 thread therefore started after a
  restart.
- Claims across threads (one server for each thread). Codex Desktop starts
  one Ghostnote server process for each thread. Each process start time
  equals its thread start time: T1 19:47:20, thread A 20:16:09, thread B
  20:16:52. When the operator opened older threads, three more servers
  started (20:03–20:04). Thread A
  (`codex://threads/01a12097-9aac-77c1-a0f1-24222fea59f0`; extract
  [entry-thread-a.jsonl](../data/phase8i10-trials/entry-thread-a.jsonl))
  put one nominal claim on the first note of the Scene 2 bass clip with
  `edit_launcher_clip`; its read showed `nominal_first_note`, state
  `current`, with a sealed basis. Thread B
  (`codex://threads/01a12098-433e-78e1-a94d-8267a32abebe`; extract
  [entry-thread-b.jsonl](../data/phase8i10-trials/entry-thread-b.jsonl)),
  started 40 s later in the same app, read the same clip: `overlays: []`,
  identity `new` (32 IDs minted), and the same content SHA-256 as the read
  before the claim in thread A. Thus claims do not cross threads, and a
  thread that the operator opens again later also gets a new server. Each
  multi-step trial runs in one thread (as the plan states). Limit: in Codex
  Desktop, a claim lasts only for its thread's server process.
- Claims from earlier trials: none can reach a new thread. The 8i9 claims on
  the Scene 1 bass clip (`Rain Steps • Pocket Bass`) were in a server
  process that the 19:44:50 client restart stopped.
- Workspace notes: each Codex thread can read and write
  `~/Documents/Codex`. Earlier trials left eight timing notes and clip
  exports in `~/Documents/Codex/2026-10-09/*/outputs/`, including
  `undertow-shaker-feel.json` (its source is the Scene 1 bass clip). The T1
  agent did not use the file system. Before T2, the notes moved to
  `~/ghostnote-trial-archive/`, with the same folder structure.
- Trial project: the operator uses "Night Glass" directly, not a copy. It is
  a testbed project for these trials only
  (`~/Documents/Codex/2026-10-09/in-x20/outputs/Night Glass/`). For T2, a
  copy of the Scene 1 shaker clip in an empty slot keeps the original.
- The thread A claim stays in that thread's server until the client
  restarts.

## Tool discovery (first attempt)

The first T1 thread used the step-1 prompt exactly as written
(`codex://threads/01a1207b-657b-76c3-8857-9bf327032d3c`; extract:
[t1-no-tool-mention.jsonl](../data/phase8i10-trials/t1-no-tool-mention.jsonl)).
The agent used only computer use: it opened Bitwig Studio, took
screenshots, and copied clips with UI clicks and keyboard shortcuts. It did
not use Ghostnote. After 70 s the operator asked "Are you using ghostnote at
all?". The agent then searched `ALL_TOOLS` for Ghostnote, and the operator
stopped the turn. This thread also tried a UI copy and paste into
Scene 2; the next thread read those slots as empty.

The logged context before the first call has no "ghostnote" text. "Bitwig"
occurs only in the working directory path that the client made from the
prompt. Ghostnote's server instructions name Bitwig
(`brain/src/mcp-server.ts`), but the client did not put them in the
context. The Ghostnote tools are deferred behind `exec` (`ALL_TOOLS`); computer
use is a direct function. The computer-use help says "Prefer purpose-built
connectors, APIs, or CLIs when available", but it arrives in the result of
the first computer-use call, after the agent chose that tool. The rollout
does not record the tool declarations, so it does not show whether the
`exec` description names the MCP servers.

Consequence: every 8i10 prompt ends with "Use Ghostnote and computer use as
you see fit." The 8i9 trial prompt had a similar sentence. The sentence names
the tool, not overlays or claims.

Limit: in Codex Desktop, a fresh agent does not find Ghostnote for a Bitwig
task without a mention. The cause is the client's tool exposure, not the
Ghostnote descriptions, which the agent did not see. A description change
cannot correct it.

## T1, write then revise

Thread `codex://threads/01a1207d-36a2-7e83-b223-51d2db0c9c17`; extract:
[t1.jsonl](../data/phase8i10-trials/t1.jsonl).

Prompts as sent:

1. "In the open Bitwig project, write a bass part for Scene 2 that sits in
   the same pocket as the Rain Steps drums. Use the existing bass sound, then
   start Scene 2. Use Ghostnote and computer use as you see fit."
2. "Nice. Make it a touch less laid back, about half as much, without
   changing the rhythm." (as written)
3. "I nudged three notes by hand. Bring the rest of the bass back in line
   with the feel you set before." (the plan had "a couple of notes" and "in
   line"; the operator made three edits)

| Measure | Step 1 | Step 2 | Step 3 |
|---|---|---|---|
| Time | 1 min 56 s | 30 s | 41 s |
| Ghostnote calls | 14 | 2 | 3 |
| Reference sections | none | Patch | Patch |
| Claims created or read | none | none | none |
| Refusals | 0 | 0 | 0 |
| Clip write | `add_launcher_clip`, 32 notes, 2,720 ms | `edit_launcher_clip`, 30 moved, 1,502 ms | `edit_launcher_clip`, 27 moved, 1,587 ms |
| Record of the feel | the agent's script store (`bassdoc`) | none new | the step-1 `bassdoc` |

### Step 1

The agent read Scene 1 and Scene 2 of each track and the bass devices, then
copied the Scene 1 drums, pad, and chords clips to Scene 2
(`copy_launcher_clips`, 2,218 ms). The prompt did not ask for the copies.
It added `Rain Steps • Undertow II` (32 beats, 32 notes, D–B♭–F–C) and
launched Scene 2 with a computer-use click.

Each of the 32 bass onsets is an exact onset of the Scene 1 drums: kick
(pitch 36) or hi-hat (pitch 42). The hi-hats are swung eighths: their off-beats
are 0.07–0.11 beat late, and their on-beats are within 0.03 beat. The
agent kept no nominal grid and no offsets. The only record was the step-1
document in its script store.

### Step 2

The agent took the nearest quarter beat (a sixteenth note) as the nominal
position of each note, and halved the distance to it in one patch: 30 notes
moved, by −0.033 to +0.023 beat. Pitch, duration, and velocity did not
change. The sixteenth grid includes the drum swing in the offset. Thus the edit
also halved the swing that the bass shared with the hi-hats. After the
edit, 2 of the 29 notes that the operator did not edit later are on a drum
onset (before: 29 of 29). This is the nominal-and-groove separation that
timing claims record. The operator replied "Nice"; the result is a musical
pass, not an interface pass.

### Step 3

Hand edits by the operator, as read in step 3:

| Note | Step-1 value | After the hand edit |
|---|---|---|
| `n13` | length `5/4` | length `243/256`; onset kept (step-2 value) |
| `n14` | onset `3517/256` | onset `14`; new event `e99` |
| `n32` | onset `8053/256` | onset `125/4`; new event `e9a` |

The read reported identity `stale` (30 IDs kept, 2 new) and the hand length
as one rounded duration in `data.loss`. The agent then called `check_revert`
on its step-2 change. The result `wouldNotRestore` stated that a person had
edited the notes. The agent kept all three edits.

The agent then set the other 27 notes to their step-1 onsets from its
script store, not to the step-2 timing. It said so: "restore the other notes
to the original, more laid-back timing", and "Restored the rest of the bass
to the original laid-back feel". That undid the step-2 request. The prompt
gave no reason to discard step 2. The statement is accurate, but the feel
is the wrong one ("a lost feel" in the decision rule).

In one thread, the script store does the work of the claims: the agent
compared against its own record. T1 in one thread therefore tests claims
mainly in step 2 (to separate the grid from the offsets) and in which record
step 3 selects.

### Operator verdict

Neutral on the music. Mechanically, the brief was met in steps 1 and 2.

## T2, clean up existing timing

Thread `codex://threads/01a1209d-2525-7a11-8593-88ed336d7242`; extract:
[t2.jsonl](../data/phase8i10-trials/t2.jsonl). The prompts were sent as
written in the plan. Before the trial, the operator copied the Scene 1
shaker clip to an empty slot as a backup.

| Measure | Step 1 | Step 2 |
|---|---|---|
| Time | 1 min 21 s | 18 s |
| Ghostnote calls | 6 (with a dry run and `show_launcher_clip_in_detail_editor`) | 2 |
| Reference sections | Patch | Patch |
| Claims created or read | none | none |
| Refusals | 0 | 0 |
| Clip write | `edit_launcher_clip`, 58 moved, 1,573 ms | `edit_launcher_clip`, 51 moved, 1,619 ms |
| Record of the feel | the agent's script store (original onsets and step-1 edits) | the same |

The clip `Rain Shaker • 8 bars` has 64 hits, one on each eighth of 32
beats. Its onsets are the onsets of the Rain Steps hi-hats. In this section,
an offset is in cells (1/512 beat) from the straight eighth grid.

### Structure of the original timing

The original offsets have a clear structure:

- A two-bar pattern for each step. Example on-beats: step 1 about 0, step 3
  about +10, step 5 about +13, step 7 about −6. Off-beats: +32 to +60.
- A shift for each bar from −7 to +10 cells, the same on steps 1–6 of that
  bar. This is the only part that looks like slop.
- The last eighth of each two-bar phrase is a push: −15 to −22 cells (early,
  near the beat). In the other bars, that step is +40 to +47.

### Step 1

The agent found one median offset for all on-beats (+5) and one for all
off-beats (+41.5; 57 percent swing). It called the difference of each note
from its median "slop", kept 35 percent of it, and limited it to ±6 cells.
It moved 58 notes, by a maximum of 51 ms at 132 BPM. The spread about the
medians went from 9.1 to 3.3 cells (on-beats) and from 21.6 to 3.3 cells
(off-beats).

The two-median model removed most of the step pattern (for example step 3
at +10 and step 7 at −6 both moved toward +5). It also took the four pushes
as slop: each moved from −15 to −22 to +36.

### Step 2

"Bring back a little of the looseness, maybe a third of what it had." The
agent moved each note one third of the distance back to its original onset,
from the original onsets in its script store. Each note then keeps
0.35 + 0.65/3 ≈ 0.57 of its original deviation from its median (median of
the measured ratios: 0.57), not one third.

### Result against the original

- Relative to the two medians, 60 of 62 deviations keep their direction.
  The final timing is the original deviations, scaled and limited, about new
  centers. The agent did not add new random offsets.
- Relative to the grid, 9 notes that were early are no longer early. The
  four pushes (hits 16, 32, 48, 64) went from −15 to −22 to +17 to +19
  (late). Five on-beats (hits 7, 15, 17, 31, 33) went from −1 to −5 to 0 to
  +2.
- The operator heard that notes that were early are now late, and judged
  that the original offsets were not restored. The data supports the first
  part. The operator's idea that the agent made new offsets is not correct:
  the step pattern and the pushes were lost in step 1, and step 2 can only
  move a part of the way back.

Under the decision rule, step 2 succeeded "in another way": it used the
agent's own record. But the cleanup lost the step pattern and the pushes,
and step 2 restored 57 percent of the deviation, not 33 percent.

### Observation on the overlay model

An unknown-source groove claim (measured, unresolved) holds the full offset
from the nominal grid as residual. It assigns no part to swing (R16). Thus
the "measured, unresolved claims" that the plan names for T2 step 1 would
keep the same data as the agent's script store: they do not separate the
step pattern from the slop. To separate them, a claim must state the step
pattern as `template` and the rest as an unassigned term. The format can
hold this, but it does not find the pattern; the agent must. In T2, the
error was in the agent's analysis (two medians and a ±6-cell limit), not in
a lost record.

## T3, control

Thread `codex://threads/01a120b8-c8d7-73e1-9f6b-420e4ea14977`; extract:
[t3.jsonl](../data/phase8i10-trials/t3.jsonl). The prompt was sent as
written in the plan. Scene 2 held only the shaker backup copy.

| Measure | Result |
|---|---|
| Time | 1 min 11 s |
| Ghostnote calls | 6: `list_tracks`, 3 clip reads, `read_devices`, `add_launcher_clip` |
| Reference sections | none |
| Claims | none |
| Refusals | 0 |
| Clip write | `add_launcher_clip`, 20 notes, 2,829 ms |

The agent read the Scene 2 chords and pad slots (empty), the pad devices,
and the Scene 1 chords clip `Dusty Ninths • Rhodes`. It did not read the
Scene 1 pad clip. It added `Night Glass • Simple Pad` (32 beats): the four
chord voicings of the chords clip, each held 8 beats from beats 0, 8, 16,
and 24, on the grid. The pitches of each chord are the same as in the chords
clip. It launched Scene 2 with a computer-use click. It did not change the
shaker backup and copied no other clips.

The operator heard a simple variation of the existing pad clip; the agent
did not read that clip, so the similarity comes from the same chords.
Operator verdict: the brief was met.

No claims, so no overuse: the T3 part of the decision rule has no effect.

## Decision rule (first runs)

Neither T1 step 1 nor T2 step 1 created claims, and T1 step 3 lost the
step-2 feel. The third case of the rule applies: one bounded description
change to `add_launcher_clip` and `edit_launcher_clip`, then a T1 rerun in a
fresh client. T3 made no claims, so there is no overuse to include.

Expected limit of the change: the T2 error was in the agent's timing
analysis (see the observation on the overlay model). A description that
recommends timing claims does not by itself find a step pattern. A later variant of T1 can also run
steps in separate threads, where the script store is not available.

## Change (third case, with the scope change)

The plan's [scope change](../../plan/phase-8/8i10-unprompted-overlay-trials.md#scope-change-after-t3-operator-decision)
puts the analysis method in scope and lifts the 200-byte limit.

### Routing in the descriptions (v45)

`TIMING_FEEL_ROUTE` (`brain/src/surface/document-help.ts`) is in the
`add_launcher_clip` and `edit_launcher_clip` descriptions:

> Timing feel (swing, groove, pocket, or notes ahead of or behind the beat):
> to make, keep, clean, or revise it, first request the Timing overlays
> section (read_launcher_clip reference, or get_document_reference
> sections). It has the analysis method; nominal and groove claims keep the
> rhythm and its offsets apart for a later change.

The `reference` input of `read_launcher_clip` adds: "When the task makes,
keeps, cleans, or revises swing, groove, pocket, or notes ahead of or behind
the beat, also request Timing overlays." The `sections` input of
`get_document_reference` names the timing-feel method. The text names timing
feel by its musical terms: "feel" alone can also mean dynamics or mood. The
Patch request in T1 and T2 came from the same kind of sentence in the edit
description ("read_launcher_clip with reference ["Patch"] returns the Patch
rules").

Descriptions `ghostnote-description-v45`, 42 tools. The public artifact
grows by 833 bytes (131,012 to 131,845; +0.6 percent).

### Method note in the reference (revision 4)

The Timing overlays section of `MODEL-REFERENCE.md` has a method note
(guidance, not a rule): nominal claims on the grid; a step pattern over the
shortest of 1-, 2-, and 4-bar cycles that explains the offsets, with
repeated pushes as part of the pattern; a shared shift of a bar or phrase;
no structure below about `1/128` beat (4 cells; a threshold in beats, so
that the agent does no tempo arithmetic); a pattern from a dense part for a
sparse part; a groove claim with provenance `inferred`, intent
`unresolved`, sourceAt and sourceDuration equal to the note, both deltas
`0`, the pattern in `template`, and the remainder in `unassigned`; a timing
change made through the claim terms, with the nominal claims kept unless the
task changes the rhythm; and new claim IDs in a note-moving edit, so that
the earlier claims stay as stale context. On operator review, the note does
not map request words to terms (for example "less laid back"): that mapping
fitted these trials, and the agent interprets the request. The note uses only terms that R14–R16
define; it gives phase, cross, and local no musical meaning.

Codec checks before the text: an inferred, unresolved groove with `template`
and `unassigned` seals and applies; the same values with measured
provenance refuse (R15, "measured timing cannot assign intent"); a patch
that moves the note and puts new claims with new IDs leaves the earlier pair
`stale` with its values beside the new `current` pair. Two tests keep these
facts (`document-help.test.ts`, 8i10).

| Size (bytes) | Before (revision 3, v44) | After (revision 4, v45) |
|---|---|---|
| Reference source | 10,736 | 12,359 |
| Core + Timing overlays selection | 8,676 | 10,299 |
| `get_document_reference`: Core | 4,469 | 4,469 |
| `get_document_reference`: Timing overlays | 13,347 | 14,997 |
| `get_document_reference`: all sections | 15,733 | 17,383 |

No host call and no call budget change. Checks: `tsc` clean; 2,314 brain
tests pass; `npm run document:artifacts` regenerated the identity,
measurements, and prompts; `check-publication-candidates.py --write` (101
entries).

Deploy: no extension change. Codex Desktop starts one server for each
thread from the brain source, so a new thread loads v45 and revision 4.

## Reruns with v45 and reference revision 4

The operator reset Night Glass (the original shaker timing in Scene 1, the
backup in a lower scene, Scene 2 empty) and sent the prompts of the first
runs in fresh threads. The client log cuts tool results over about 24,000
characters, so the large reads in the extracts are incomplete; the agents'
scripts had the full results.

### T1 rerun

Thread `codex://threads/01a120e0-8abe-7663-a01c-4607c8e989c4`; extract:
[t1-rerun.jsonl](../data/phase8i10-trials/t1-rerun.jsonl).

| Measure | Step 1 | Step 2 | Step 3 |
|---|---|---|---|
| Time (first run) | 2 min 41 s (1 min 56 s) | 1 min 41 s (30 s) | 29 s (41 s) |
| Ghostnote calls | 14 | 6 | 1 |
| Reference sections | Timing overlays (first read) | Patch, Timing overlays | Patch, Timing overlays |
| Claims | 36 declared nominal (`1/4`) and 36 declared, resolved, known-source grooves | all 72 put again with the same IDs | read only |
| Refusals | 0 | 4 | 0 |
| Clip write | `add_launcher_clip`, 36 notes and 72 claims, 2,881 ms | `edit_launcher_clip`, 33 moved, 1,738 ms | none |

- Step 1: the agent requested Timing overlays on its first read. Each
  groove's `template` is the onset of the matching kick or hi-hat minus the
  nominal, and the provenance names the drum onsets. This is the method's
  "take the pattern from a dense part". The agent again copied the Scene 1
  drums, pad, chords, and shaker clips to Scene 2 without a request.
- Step 2: the agent read the claims and halved each offset from its nominal
  claim; the nominals did not change. As in the first run, the 1/4-beat
  nominal includes the hi-hat swing in the template, so the swing is also
  halved; the operator accepted the result. Four refusals before the write:
  - R14 "duplicate current claim": the agent put new groove claims with new
    IDs for all 36 notes. Three notes did not move (their half offset
    rounds to the same cell), so their earlier grooves stayed current
    beside the new ones. The refusal had no `detail.repair`.
  - R15 "timing equation does not match", three times, each with the
    `groove-timing` repair. A 1/1024 value is valid in a claim: only the
    realized onset and duration must be on the 1/512 cell (R06). The faults
    were: (a) 34 claims whose `sourceAt` plus `atDelta` was not the written
    onset; (b) a balanced patch that rounded half offsets up to the cell
    (`atDelta` `+1/1024`), but R15 maps the source through the R07 import,
    which floors onsets, so `atDelta` must be in (−1/512, 0]; (c) one note
    that the patch did not move, with an `atDelta` for a move. The applied
    patch has the exact half offset in `template` and `sourceAt`, the floor
    in the onset, and `-1/1024` or `0` in `atDelta`: the R15 use of
    `atDelta` for quantization displacement. A codec check confirms (b):
    the same claim with `sourceAt` 1/1024 below the cell and `atDelta`
    `+1/1024` refuses, and 1/1024 above with `-1/1024` is accepted.
- Hand edits: `n9` and `n18` moved about 24 cells later (new IDs `e8d` and
  `e8e`; their claims were removed), and `n23` became shorter (7/8 to
  255/512; its claims are stale).
- Step 3: the agent kept the three edits and wrote nothing: "The other 33
  notes already match the half-strength timing feel I set, so they needed no
  changes." That is correct: the step-2 feel is the current one. It compared
  the notes with its script store, not with the claim states, and did not
  name the stale or removed claims.
- Operator verdict: steps 1 and 2 met the brief; step 3 was a no-op, and
  the prompt is ambiguous.

### T2 rerun

Thread `codex://threads/01a120e9-9daa-7191-9db1-6c1ccaca38f1`; extract:
[t2-rerun.jsonl](../data/phase8i10-trials/t2-rerun.jsonl).

| Measure | Step 1 | Step 2 |
|---|---|---|
| Time (first run) | 1 min 49 s (1 min 21 s) | 35 s (18 s) |
| Ghostnote calls | 7 (two dry runs) | 2 |
| Reference sections | Patch, Timing overlays | Patch, Timing overlays |
| Claims | 128 "before" claims (inferred nominal `1/2`; inferred, unresolved groove with `template` and `unassigned`), then 80 "clean" claims for the moved notes | 80 "relaxed" claims for the moved notes |
| Refusals | 1 (dry run) | 0 |
| Clip writes | claim-only edit 1,133 ms; `edit_launcher_clip`, 40 moved, 1,756 ms | `edit_launcher_clip`, 40 moved, 1,864 ms |

- Step 1: the agent printed the offsets for each bar and stated the
  structure: "a consistent two-bar swing, including an early hit at the end
  of every second bar. The looseness comes from several whole bars drifting
  together." The template is the two-bar step pattern, with the pushes. The
  bar shifts are `0, 7, -5, 10, -3, 5, -7, 3` cells; the agent removed the
  five of 4 cells or more (the `1/128` threshold) and kept bars 1, 5, and 8.
  It put the claims for the original timing first (a claim-only edit), then
  moved 40 notes with new claims under new IDs. The dry run refused R13
  "duplicate current claim" for the unmoved notes (no `detail.repair`); the
  agent then put new claims for the moved notes only.
- Step 2: "a third of what it had". The agent added back one third of each
  removed bar shift, from its script store of the original onsets: bars 2,
  3, 4, 6, and 7 are now `2, -2, 3, 2, -2` cells from the pattern (were
  `7, -5, 10, 5, -7`).
- Result against the original: all 16 steps of the two-bar pattern are kept,
  and the four pushes stay early (`-18, -15, -20, -22` to `-23, -22, -23,
  -22`). No note changed side of the beat (first run: 9). Limit: the
  agent's model moves step 7 with its bar, but in the original, step 7 does
  not follow the bar shift; those notes moved by up to 7 cells (about 6 ms),
  and stayed early.
- Operator verdict: the change is too subtle to judge by ear; judged on the
  mechanical result, which matches the request.

### Decision rule after the reruns

With v45 and revision 4, both first steps made timing claims without a
request: T1 a known-source transfer from the drums, T2 an inferred step
pattern with residuals. The later steps used them: T1 step 2 read the
nominal claims and changed only the template, and T2 step 2 changed the
residual part only. The rule's first case now holds for this cohort. In one
thread, the agents also kept their own script record and used it for the
comparison in T1 step 3 and T2 step 2.

Cost of the claims: 5 refusals (T1 step 2: 4; T2 step 1: 1 dry run), and
the timing steps took longer (T1 step 2: 1 min 41 s against 30 s). Both
duplicate-claim refusals came from the same case: new claim IDs for notes
that the edit does not move. The method note's step 7 says "the moved
notes", but neither refusal had a repair. Session
[8i11](../../plan/phase-8/8i11-claim-replacement-repair.md) adds the repair
and makes the method step explicit.

## Fixture state

Scene 2 holds the bass clip `Rain Steps • Undertow II` (step-3 state) and
the agent's copies of the drums, pad, and chords clips. The operator chooses
whether to keep them for T2 and T3 (T3 uses Scene 2).

After T2, the Scene 1 shaker clip is in the step-2 state. The operator's
backup copy has the original timing. Before T3, the operator removed the T1 clips from
Scene 2. Scene 2 then held only the shaker backup copy. After T3, Scene 2 also
holds the pad clip `Night Glass • Simple Pad`.

After the reruns (operator reset before them): Scene 2 holds the T1 rerun
bass clip `Undertow • Rain Steps II` and the agent's copies of the Scene 1
drums, pad, chords, and shaker clips. The Scene 1 shaker clip is in the T2
rerun step-2 state; the operator's backup copy of the original is in a lower
scene. The claims exist only in the servers of the rerun threads.
