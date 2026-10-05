---
title: Phase 8h3a — Cold-read dealbreaker check
kind: plan
state: done
status: Complete. Product rules are selected, visible selection changes are accepted for modal use, and normal restoration passes.
updated: 2026-10-05
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h2a-replay-cold-read.md
next: 8h3b-replay-fetch-cost.md
evidence: E1, E14, E99, E131, E225, E226, E227, E228; D6, D23, D26, D27, D29, D30
---

# Phase 8h3a — Cold-read dealbreaker check

## Why

[E227](../../evidence/experiments/e227-replay-cold-read.md) and
[D30](../../decisions/d30-replay-batch-and-start-signal-are-named-assumptions.md)
make a full-width 1/512 bind a complete, exact cold read in 46–698 ms. E131
takes 11 s at 64 beats and 711 s at 512 bars. The replay reader is therefore
the planned replacement for E131 on every read and write path
([8h3c](8h3c-cold-reader-promotion.md)). The resident note cache then has no
speed role. [8h3e](8h3e-cache-machinery-trim.md) keeps the identity, generation,
and snapshot-validity machinery and retires the resident note grid.

E227 measured only a narrow case. This session tests the conditions of
product use. It looks for a result that stops the replacement, or a product
rule that the replacement must follow. The bridge fetch cost is in
[8h3b](8h3b-replay-fetch-cost.md). Change awareness without a resident grid is
in [8h3d](8h3d-change-awareness.md). Neither can stop the replacement.

| Gap | E227 condition | Product condition |
|---|---|---|
| Bind source | Always from an empty park track | Possibly from another populated clip |
| Row | Always row 0; a point alone bound the clip | Any row. Binding calls the target track's `selectSlot(row)` |
| Visible selection | Not measured | D6, E1, and E14: `selectSlot` moves the user's slot selection when the row is not already selected |
| Earlier Ghostnote write | Not measured | A write in the request just before the bind |
| Host load | Idle transport, 160 binds | Playback, other observers, many binds |

D23 settles the grid: one 1/512 view, no 1/768 view, and no triplet onset
policy beyond nearest-cell rounding. E225 proved widths up to 4,194,304 steps
(8,192 beats) with no width heap cost. This session uses that width. 8h3c
makes it the product limit.

## Dealbreakers

A result stops the replacement only if no product rule avoids it:

- a replay that arrives in more than one batch, or a callback of the binding
  after the D30 close task, under a condition that the reader cannot avoid
  (for example, by parking before each bind);
- a selection change that the reader cannot avoid and cannot restore exactly
  without user-visible interference; or
- a Ghostnote write before the bind whose delta can arrive after the close,
  with no delivery barrier that prevents it.

Any other result becomes a product rule or a cost for 8h3c. If a result
revokes D30, stop and report it to the user before more work.

## Entry

Start from the 8h2a research build (`8h2a-replay-v1`, `ShadowReplayReader`,
`cache.shadow` operations `replayAct`, `replayStatus`, and `replayNotes`).
Read E227, D30, D26, D27, D6, E1, E14, E99, and the E226 release rule. Use
an owned project. Never use `gn-scale-test` (D29). Follow the reload procedure
in `AGENTS.md`.

Reuse the E227 fixtures and the decoration rule. Rebind the fixture writer
before a verification read, because a repeated equal setter leaves its
`getStep` cache stale (E227, E2).

## Experiments, in order

Each trial records the batch count, the D30 close time, the callbacks after
the close, the duplicate-cell count, and an exact decode against the declared
fixture. Keep the E227 late-callback oracle: observe for at least 2 s after
the action and after the last callback.

### 1. Bind source

Bind the reader directly from one clip to another, with no park between them.
Use at least 20 trials for each pair:

- populated to populated: `n4096-64` to `n16384-512`, and `sustain-2048` to
  `n131072-2048`;
- populated to empty, and empty to populated;
- two clips whose notes share cells, so that old Empty callbacks and new
  NoteOn callbacks address the same coordinate; and
- a rebind to the same clip.

Record whether the release callbacks of the old clip and the replay of the new
clip arrive in one batch, in two, or interleaved. Record whether the D30 close
rule and the duplicate-cell rule still give an exact read. Compare the time
with park, then bind.

If a direct bind fails or is slower, the product rule is to park after each
read and bind only from the park target. Record that rule with the park and
release cost.

### 2. Row and visible selection

Put targets at rows 0, 1, and 63 or higher. Make the target track's selected
slot different from the target row, and equal to it. Use the E14 slot
`isSelected` observers and the E99 selection-event counters to record every
selection change. Ask the operator for one visual confirmation of the
row-1 case.

1. Record whether the bind moves the user's visible slot selection or track
   selection, and how many events it makes.
2. Record whether `sceneIndex` and `clipExists` change the D30 start signal
   at a row that is not 0.
3. If the selection moves, restore it with the E99 lease. Restore it in the
   bind task, in the close task, and after the release. Record which restore
   keeps the pinned binding and an exact read, and whether the user sees a
   change.
4. Test one more bind route only if a cheap candidate exists in the current
   API. E1 rejected `slot.select()` alone and `CursorClip.selectClip`.

### 3. Ghostnote write before the bind

Send a bridge note write, then a read of the same clip in the next bridge
request. Use gaps of 0, 1, and 2 controller tasks, and a delayed `batch.run`
write. Use at least 10 trials for each case. Record where the write delta
arrives: before the bind, inside the replay batch (duplicate cell), or after
the close. Record whether the read shows the write.

If a delta can arrive after the close, find the cheapest delivery barrier
that prevents it, for example a confirmed step callback or one later host
cycle. 8h3c uses this result in the write queue.

### 4. Soak and tripwire

Run at least 500 binds over all fixtures, rows, and bind sources that pass
experiments 1 and 2. Run half of them with the transport playing, and with the
normal observers and the shadow cache bank loaded. Record any callback of a
binding after its close.

Then select a product tripwire that detects a D30 violation in normal use at
low cost. One candidate: flag any NoteOn or NoteOff callback of a closed
binding before its release. Measure what a watch of 0, 50, and 100 ms after
the close adds to the read time.

## Acceptance criteria

- Each dealbreaker has a pass, a product rule that avoids it, or a refusal
  that the user decides.
- Experiment 1 selects the bind-source rule with measured times.
- Experiment 2 records the selection effect at each row, with one operator
  confirmation, and selects a restore rule if the selection moves.
- Experiment 3 records where an earlier write arrives and selects a delivery
  barrier if one is needed.
- Experiment 4 gives at least 500 binds with no callback after close, or
  reports the violation. It selects a tripwire with its cost.
- The evidence record updates D30 coverage, or proposes an amendment for the
  user to decide. Research results keep `complete:false` and `eligible:false`.
- An artifact verifier recomputes each verdict from the raw trials.
- Owned projects are closed without saving. The original rig config and the
  normal archive are restored, with a fresh normal hello.
- Brain check, extension check, wire goldens, artifact verifiers, context
  check, and `git diff --check` pass.

## Out of scope

- Bridge fetch cost (8h3b).
- Change awareness without a resident grid (8h3d).
- Product migration, the write queue, `1/768` removal, the disabled-control
  fix, and E131 retirement (8h3c).
- Changes to the cache machinery and its promotion (8h3e).
- Interface simplification and public naming (8h4).

## Session preparation

The current research build is `8h3a-dealbreakers-v2`. V1 data is retained in
[E228](../../evidence/experiments/e228-cold-read-dealbreaker-check.md). It keeps the 98-method probe
profile and hash `d89cee6bf21c1f96`. The rig has 16 tracks, 64 rows, two shadow
cache views, and a reader width of 4,194,304 steps. The reader records the
D30 close count and preserves the notes at that time. Later callbacks cannot
change this capture. It also records the order of Empty and non-Empty callbacks.
A fixture-writer observer tested a delivery receipt. It did not confirm its
own field setter; the passing barrier uses the execution counter.
All trial artifacts keep `complete:false` and `eligible:false`.

The research archive and config were deployed. The original config is in
[evidence data](../../evidence/data/phase8h3a-dealbreakers/config-entry.json).
V1 hello passed at `2026-10-05T09:07:50.150Z`. The owned project was `New 3`.
D29 permits reuse of this retired name. Experiment 1 and the first selection
matrix are complete. After the operator reported v2 replacement, hello still
returned v1 and the old initialization time. The next full replacement passed
v2 hello at `2026-10-05T10:08:31.484Z`. The ordered matrix passed all 48
cases. The write matrix selects actual execution completion for
pending staged writes. The corrected soak has 500 qualifying binds, including
250 verified during playback. Five selection-preserving unsubscribe releases
also pass. Three labelled visual trials passed the automated checks. The
operator confirms a visible selection change during every read. The user
accepts this behavior for modal use. Normal restoration passes.

Preparation checks pass: brain type checking and 1,869 tests, extension checks,
wire goldens, context links, and diff whitespace. The artifact verifier
recomputed 1,042 verdicts. See
[preparation.json](../../evidence/data/phase8h3a-dealbreakers/preparation.json).

The labelled repeat is complete. The operator saw a selection change
between `WATCH READ` and `READ DONE` in every trial. No changes were noticed
at other times. The task used was:

```sh
npm run probe:phase8h3a-visual
```

Do not run live commands in `gn-scale-test`. The ordered route passes.
Close-task restore followed by unsubscribe preserves selection in the
automated checks. The visual command checked the same route in three trials.
It printed phase labels and a countdown, then saved `visual-labelled.json.gz`.
The operator's report and acceptance are in `operator-visual.json`. Modal use
permits temporary selection changes. Restore all three entry selection values
at close under the E99 lease, then unsubscribe. A lost lease refuses restore.

The write command sends the read in the next bridge request for the zero-gap
case. Its confirmed case waits for the execution counter in a later task.
The corrected soak checks actual transport state. Its route starts from park
and selects the row before pointing. The watch cost includes the bridge status
request; it is not an extension-only timer cost. The complete artifact check
passes all 1,042 retained verdicts and the operator and restoration gates.

### Completion

The original config is restored with hash `256bbf07…43b0`. The normal archive
is deployed, and the research archive is removed. The operator confirmed
closure of `New 3` without saving and full replacement with normal `ghostnote`.
Normal hello passes at `2026-10-05T12:05:58.299Z`: `normal-v1`, 85 methods,
hash `bba7383dce25c0f0`. Its initialization is after deployment. The active
project contains none of the owned fixture track IDs.
See [restoration.json](../../evidence/data/phase8h3a-dealbreakers/restoration.json).

No dealbreaker remains open. Continue with [8h3b](8h3b-replay-fetch-cost.md).

### Preparation retrospective

The advertised-probe test caught a transport method outside the active profile.
Use the existing research operation for transport control. Check the probe
method table before adding a driver call.
