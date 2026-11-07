---
title: E375 — R01 three-repeat development pass of package v5
kind: evidence
state: done
updated: 2026-10-27
owner: R01
---

# E375 — R01 three-repeat development pass of package v5

Date: 2026-10-27. Stage: **development**. These results support design
iteration only; they are not a candidate comparison. Subscription CLI calls
were made within the operator's standing scope. No API billing or Bitwig
contact occurred.

## Run

The full pinned plan of `pilot-development-v5`
([D63](../../../spec/r01-research/decisions/d63-r01-package-v5-group-timing-tasks.md)) has three
repeats and 261 runs per cohort, with seeded order `r01-pilot-order-v1`, at
most two corrections and one resubmission after a stall. `start` matched the
v5 execution manifest. Binaries, Node and the 236 focused tests were as in
[E374](e374-r01-package-v5-group-timing-one-repeat.md).

`dev-v5-r3` ran from 21:15 to 22:56 UTC. It completed both cohorts in one run:
522 runs and 802 submissions, with no halt, quota pause, stall or control
failure.

A first start of the same plan was stopped about a minute in. It had been
launched under a two-hour tool limit that the run would exceed, and it was
relaunched as a detached process. Its only attempt, the plan's first Haiku
submission, had a prompt and manifest written but no recorded response; it
is unscored and is not part of the results. Its directory is retained in the
ignored `.tmp/` as `r01-pilot-dev-v5-r3-aborted`.

## Results

| | Haiku 5.5 | Luna |
|---|---|---|
| First-attempt passes | **252 / 261** (96.6%) | **119 / 261** (45.6%) |
| Passes within two corrections | **259 / 261** | **143 / 261** |
| First-attempt passes per repeat | 83, 85, 84 | 43, 38, 38 |
| Cells passing in all three repeats / none / mixed | 80 / 0 / 7 | 34 / 42 / 11 |
| Corrections used | 14 | 266 |
| Submissions | 275 | 527 |
| Input / output tokens (client-reported) | 906,711 / 662,517 | 2,758,187 / 362,060 |
| Median output on initial answers | 1,692 | 337 (5.0×) |

Haiku input is `totalInputTokens`, which is almost entirely 1-hour cache
writes (E364). Luna usage is client-reported.

### Source tasks: C3 versus C4

First attempt out of three runs per cell (within budget in parentheses).
Diagnostics are C3 JSON, C4 JSON and detached C4 FIELDS; p12 has no groups,
so its detached control is excluded.

| Task | Haiku C3 FIELDS | Haiku C4 FIELDS | Luna C3 FIELDS | Luna C4 FIELDS | Luna C3 JSON | Luna C4 JSON | Luna detached |
|---|---|---|---|---|---|---|---|
| p02 read group timing | 3 (3) | 3 (3) | **3 (3)** | 0 (0) | 3 (3) | 0 (0) | 0 (0) |
| p04 author a timed group | 3 (3) | 3 (3) | 0 (2) | **3 (3)** | 0 (0) | 0 (2) | 3 (3) |
| p07 halve spreads, move anchor | 3 (3) | 3 (3) | 0 (0) | **3 (3)** | 0 (0) | 3 (3) | 0 (0) |
| p12 preserve exact wider state | 3 (3) | 3 (3) | 3 (3) | 3 (3) | 3 (3) | 3 (3) | – |
| p13 read a derived-onset window | 2 (3) | 3 (3) | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |
| p14 group existing notes | 3 (3) | 3 (3) | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |
| p15 move a member between groups | 3 (3) | 3 (3) | 0 (0) | **3 (3)** | 0 (0) | 2 (2) | 2 (2) |
| p16 retime two groups | 3 (3) | 3 (3) | 0 (0) | **3 (3)** | 0 (0) | 3 (3) | 3 (3) |
| **All eight** | **23 (24)** | **24 (24)** | **6 (8)** | **15 (15)** | 6 (6) | 11 (13) | 8 (8) of 21 |

Haiku's diagnostics: C3 JSON 21/24 (24 within budget), C4 JSON 23/24 (24),
detached 20/21 (20).

On the four new tasks Haiku passed 55/60 (92%) on the first attempt and Luna
16/60 (27%), close to E374's 19/20 and 5/20.

### Performed tasks and bar|beat

| Arm, 8 performed tasks | Haiku | Luna |
|---|---|---|
| Ghostnote FIELDS | 24/24 (24) | 15/24 (17) |
| Ghostnote JSON | 24/24 (24) | 14/24 (16) |
| C3 FIELDS | 24/24 (24) | 15/24 (19) |
| C4 FIELDS | 24/24 (24) | 14/24 (18) |
| Producer Pal MIDI JSON | 24/24 (24) | 13/24 (19) |
| Producer Pal bar\|beat | **21/24 (23)** | **2/24 (4)** |

p01–p12 repeat E373's pattern: Haiku 197/201 and Luna 103/201 on the first
attempt, against 192 and 103 there. Luna again failed p01 (0/18) and p08
(0/18) on the first attempt.

## Findings

### C4 is ahead on source edits; neither format helps Luna read derived windows

These are development results on one synthetic instance per task, three
repeats each.

- **Luna, C4 FIELDS 15/24 versus C3 FIELDS 6/24.** The gap comes from the
  edits that change onsets: p04, p07, p15 and p16 pass 12/12 on C4 FIELDS and
  0/12 on C3 FIELDS. In every C3 failure on p14–p16, the group context is
  updated but the explicit onsets disagree with it, so the parser rejects the
  timing equation. C4 derives those onsets, so the error cannot occur. C4 JSON
  shows the same direction (11 versus 6).
- **The opposite holds for a single derived read.** On p02, which asks for
  one member's derived onset, Luna passed C3 3/3 and C4 0/3. C3 states the
  onset; C4 requires adding anchor, delay and spread.
- **p13 and p14 are at Luna's floor in every format.** On p13 Luna omits
  untimed group members, includes the excluded bound or ignores the range. On
  p14 it miscomputes the spreads that would keep each onset (C4) or writes
  spreads that contradict the unchanged onsets (C3). These tasks do not
  separate the formats for Luna.
- **Haiku is near the ceiling on both formats** (23 versus 24 of 24). Three
  of its four p13 misses (C3 FIELDS once, C3 JSON twice) omit the untimed
  group member `fa`; the fourth (C4 JSON) orders an onset tie wrongly. It
  passed p13 on C4 FIELDS and detached FIELDS every time.

### bar|beat remains the hardest performed arm

Producer Pal bar|beat is again the weakest arm for both cohorts: Haiku 21/24
and Luna 2/24 on performed tasks. Haiku's misses are p08 once (six notes
wrong) and p09 twice. On p09 it either refused the near miss (two attempts)
or altered one or two other notes; one p09 run failed all three attempts.

### Token gap

Haiku generated a median 1,692 tokens per initial answer and Luna 337
(5.0×; E373: 6.1×). Haiku's total output was 1.8× Luna's, although Luna made
1.9× as many submissions because it used 266 corrections.

### Defects

No prompt, card or scorer defect was found. Every Haiku failure was read, as
were Luna's failures on p13–p16. Luna's parse rejections on those tasks are
timing-equation mismatches (C3), duplicate note definitions or mismatched
`FIELDS` rows (detached), arithmetic written as a value (`4+1/64+3/64`), and
malformed JSON cells. Haiku's one unrecovered source run is p14 detached
FIELDS, which misplaced rows between group and row blocks and changed note
order.

## Artifacts

Under [`r01-pilot-runs`](../data/r01-pilot-runs/): `dev-v5-r3/` (plan,
results SHA-256 `43055836…`, session and progress log),
`analysis-v5-r3.json` (`06c37a38…`) and `summary-v5-r3.json` (`f327af22…`,
per-task, per-arm and per-cell counts). Raw attempt directories remain in the
ignored `.tmp/`.

## Limits

Development evidence on reused works A–C and one synthetic seed; prompts and
tasks were tuned on these inputs. Each source task is one instance, so the
C3/C4 counts are three runs per task and arm, and Luna repeats agree on most
cells (76 of 87). The p02 and p13 results show that the C4 advantage is
specific to edits. Usage is client-reported.
