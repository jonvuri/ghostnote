---
title: E260 — Claim replacement repair
kind: evidence
state: done
updated: 2026-10-09
owner: phase-8i11
---

# E260 — Claim replacement repair

## Status

[8i11](../../plan/phase-8/8i11-claim-replacement-repair.md) is complete.
The two claim refusals of the
[E259 reruns](e259-unprompted-overlay-trials.md#decision-rule-after-the-reruns)
now return a repair. The method step 7 states how to keep the claims of a
note that an edit does not move. In one operator rerun of T1 steps 1 and 2,
the agent made and used claims with no refusal.

## Change

- Codec message (`semantic.ts`); the rules do not change:
  - A duplicate current claim (R13 nominal, R14 groove, R19 meter or
    tempo) names the type, both claim IDs, and the event (or the clip and
    position): `duplicate current claim: groove claims groove1 and
    groove1-v2 of event n2`.
  - R15: when sourceAt + atDelta is the event onset but the onset is not
    the floor of sourceAt to the 1/512-beat cell, the refusal is at
    `.data.atDelta` with "event onset is the floor of sourceAt to the
    1/512-beat cell, so atDelta is in (-1/512, 0]". An unbalanced sum keeps
    "timing equation does not match".
- Repair (`document-help.ts`): the new case `duplicate-claim` for R13 and
  R14 names the event and the two IDs, and the two fixes: put the claim
  under the existing ID (OVERLAY_PUT replaces it), or OVERLAY_REMOVE the
  existing claim in the same patch. New IDs are for notes that the same edit
  moves. The `groove-timing` correction adds the onset floor sentence.
- Model reference revision 5: step 7 adds "A note that the edit does not
  move keeps its current claims, or gets new values under the same IDs."
  Timing overlays selection 10,299 → 10,405 bytes; full 12,359 → 12,465.
- Descriptions `ghostnote-description-v46` (42 tools): only the reference
  revision and SHA-256 in the read description change. Fingerprint
  `4e83b4c03a9ec039d6b39fe21dfaa65396c93a5f6886280b28d513a27a90fdfe`;
  v45 is frozen.
- Cost: no host call and no live path. The repair is built from the codec
  refusal, as in 8i9 (E256). Call budgets and the ledger do not change.

## Tests

`agent-native-edit.test.ts` (fake host):

- The E259 duplicate shape: an edit moves another note and puts new claim
  IDs for an unmoved note. A nominal refuses R13 and a groove refuses R14,
  at stage `plan`, with repair `duplicate-claim`, both IDs in the message,
  and no write and no recorded change. Both fixes then apply:
  OVERLAY_REMOVE with the new ID (dry run), and the existing ID (written,
  read back, and sealed).
- The E259 floor shape: sourceAt `1023/1024`, atDelta `+1/1024`, onset `1`
  refuses R15 at `.data.atDelta` with the floor message and the
  `groove-timing` repair. sourceAt `1025/1024` with atDelta `-1/1024` seals
  and applies.
- The 8i10 method test checks the step 7 text.

Checks: brain `npm test` 2,317 pass; `tsc --noEmit` clean;
`document:conformance` passes and the artifacts match;
`check-publication-candidates.py` (101 entries).

## Operator rerun of T1 steps 1 and 2

Thread `codex://threads/01a12107-e4fe-7ec3-bd48-1572f49f723b`; extract:
[t1-rerun.jsonl](../data/phase8i11-trial/t1-rerun.jsonl). Setup as for the
E259 reruns: Codex Desktop, fresh thread, the 8i8 extension build, Night
Glass with the original shaker in Scene 1 and an empty Scene 2. The server
reported reference revision 5. The prompts were the E259 T1 steps 1 and 2.

| Measure | Step 1 (E259 rerun) | Step 2 (E259 rerun) |
|---|---|---|
| Time | 3 min 1 s (2 min 41 s) | 1 min 3 s (1 min 41 s) |
| Ghostnote calls | 12 (14) | 3 (6) |
| Reference sections | Timing overlays (first read) | Patch, Timing overlays |
| Claims | 36 declared nominal (`1/4`) and 36 declared, resolved, known-source grooves | 34 nominal and 34 groove, new IDs, for the 34 moved notes only |
| Refusals | 0 (0) | 0 (4) |
| Clip write | `add_launcher_clip`, 36 notes and 72 claims, 2,915 ms | `edit_launcher_clip`, 34 moved, 1,779 ms |

- Step 1: the agent read the Scene 1 drums with Timing overlays, took a
  two-bar step pattern from the kick and hi-hat onsets, and added
  `Rain Steps • Scene 2 Bass` (32 beats). Each groove has `template` (the
  step pattern) and `local` terms, atDelta `0`. It again copied the Scene 1
  drums, pad, chords, and shaker clips to Scene 2 without a request
  (`copy_launcher_clips`, 2,930 ms), and launched Scene 2 with a
  computer-use click.
- Step 2: the agent read the claims, halved each offset from its nominal
  in cells (rounded to the nearest cell), and skipped a note whose onset did
  not change: `n1` (offset 0) and `n25` (offset 1 cell). Their claims stayed
  current. For the 34 moved notes it put a nominal and a groove with new
  IDs (`_half`); the earlier claims became stale. Each new groove has
  sourceAt equal to the written onset and atDelta `0`, so the floor case did
  not occur. The rhythm, pitches, velocities, and durations did not change.
- The agent followed the step 7 text. It did not meet the new repairs, so
  this run does not show that an agent corrects a patch from them; the unit
  tests show that the corrected patches apply.
- Operator verdict: the result meets the musical brief about as well as the
  E259 rerun.

## Decision rule

Acceptance case 1: no duplicate-claim refusal. The step-2 cost fell from
6 calls, 4 refusals, and 1 min 41 s to 3 calls, no refusal, and 1 min 3 s.
This is one run; the agent's choice to skip unmoved notes can also come
from its own script logic.

## Limits

- One trial thread; the new repairs were not exercised live.
- The agent still copies Scene 1 clips to Scene 2 without a request
  (E259).
- In step 2, a one-cell offset stays one cell (the half rounds up), so
  `n25` keeps its full offset.

## Fixture state

Night Glass: Scene 2 holds the bass clip `Rain Steps • Scene 2 Bass` (step-2
state) and the agent's copies of the Scene 1 drums, pad, chords, and shaker
clips. The Scene 1 shaker clip has the original timing; the operator's
backup copy is in a lower scene. Scene 2 was launched and the transport was
left playing for the operator to stop. The claims exist only in the server
of the trial thread.
