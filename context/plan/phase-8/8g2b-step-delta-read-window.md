---
title: Phase 8g2b — Step-delta read window
kind: plan
state: complete
status: Complete. E217 passes the ordering rule; E218 passes live acceptance.
updated: 2026-10-03
parent: 8g-shadow-project-cache.md
prev: 8g2-project-continuity.md
next: 8g3-snapshot-and-global-budgets.md
---

# Phase 8g2b — Step-delta read window

## Outcome

Complete. [E217](../../evidence/experiments/e217-later-callback-ordering-rule.md)
passes the later-callback ordering rule: 94 mid-batch confirmations, from ticks
and RPCs, all ran after their batch. The
[step-delta window](../../evidence/format/PHASE8G_PROJECT_CONTINUITY.md#8g2b-step-delta-read-window)
is implemented. [E218](../../evidence/experiments/e218-step-delta-read-window-live-acceptance.md)
passes 147 live trials with zero foreign or differing outputs. Live slot
inventory still refuses because it is outside step coverage. The public root
probe now uses the step-delta provider in shadow research builds. All results
stay `complete:false` and `eligible:false`.

## Entry and scope

Read [D26](../../decisions/d26-step-data-delivery-is-a-named-assumption.md),
[E216](../../evidence/experiments/e216-delivery-coalescing-and-callback-coherence.md),
the [8g2 protocol](../../evidence/format/PHASE8G_PROJECT_CONTINUITY.md), and the
[cache contract](../../contracts/GHOSTNOTE_CACHE_CONTRACT.md). 8g2 refuses all
live shadow acquisitions because no independent input window exists. This
session replaces that missing window with a step-delta read window under D26.
It does not make any result eligible. Keep 8g active. Do not enter 8h.

E216 gives the design constraints:

- Identity values coalesce. Equal identity is never a continuity witness.
- One callback reads a confined state. A start/end check in one callback sees
  no change.
- A callback can run in the middle of a delivery batch. In 12 of 12 foreign
  reads, eight step callbacks came before the tick and eight came 19–76 µs
  after it. The next tick came about 24 ms later.

A read is therefore safe only if a later callback confirms an unchanged step
count. That confirmation needs an ordering rule that E216 did not measure.

## Owned files and interfaces

- `RootIdentityProbe.java`: a live provider for the existing continuity-window
  seam. The public constructor still supplies none until the measured gate passes.
- `ShadowCacheProbe.java`: one step-callback counter for all shadow observers,
  pending/confirmed read windows, a later-callback confirmation before
  settlement, comparison, retained output, and inventory publication.
- `ShadowAuthorityFallback.java` and `ShadowInventoryRebuild.java`: only the
  window interfaces that change.
- `DeliveryCoherenceProbe.java` and the E216 driver: the ordering measurement.
- Focused model tests, adapter tests, and new artifact verifiers. Keep E216
  reports unchanged. Add new reports as separate runs.

## Work

1. **Measure the ordering rule first.** Extend the E216 recorder. On each tick,
   schedule a zero-delay confirmation task and record the step sequence it sees.
   Repeat same-callback detours at least 100 times. For each mid-batch tick,
   record whether every trailing step callback ran before its confirmation.
   Also check whether bridge RPC callbacks can run inside a batch. One
   confirmation before the end of its batch fails the rule.
2. **Stop if the rule fails.** Record the counterexample, keep the 8g2 refusal,
   and prepare the smallest vendor question. Do not substitute a quiet time.
3. **Define the window.** The window value is the init nonce, the delivered
   identity epoch, and the step-callback count across all shadow observers.
   Capture it before target confirmation. A read is pending until a later
   callback, scheduled from the read callback, sees the same value and no
   pending hints. Only a confirmed read can feed settlement, comparison,
   retained output, or inventory. A changed value retires the binding and
   discards pending and output state, as 8g2 already requires.
4. **Coverage.** Every read coordinate must be inside the coverage of an
   observer that is subscribed for the whole acquisition lifetime. A read
   outside coverage keeps the 8g2 refusal. Observer scrolling and rebinding
   start a new window. Their own callbacks must not confirm it.
5. **Model tests.** Add a host model with batch interleaving. Cover a mid-batch
   read with the batch remainder before confirmation, an unseen detour with
   step deltas, an equal-content detour without deltas, and a late-hint race.
   Also cover cancellation, explicit recovery, and changed init. Add one test
   that a covered change without a callback is accepted. It documents the D26
   boundary; it is not a defect.
6. **Live acceptance.** Use the full reload sequence and a deliberate build
   marker. Use two owned unsaved projects with disjoint witness content and the
   E216 project actions. Run guarded acquisitions during same-callback detours,
   separate-callback detours, and the E214-style native B overlap. Each run has
   an independent settled authority comparison after return to P.

## Acceptance criteria

- The ordering measurement has a retained report and a stated pass or failure.
  No guard depends on the rule unless it passes.
- No published, retained, compared, or inventory output contains foreign
  content in any live detour. Count refusals and recoveries separately.
- Every admitted read has one confirmed step-delta window. A same-callback
  start/end check alone never admits a read.
- Identity equality, chain IDs, and endpoints never admit or preserve a
  reference. Uncovered reads and no-probe routes still refuse.
- Cancellation stays terminal across polls. Recovery needs an explicit new
  attempt, a new reference, and fresh values.
- All results stay `complete:false` and `eligible:false`. D26 and the ordering
  rule remain named assumptions in the evidence.

## Checks, live cleanup, and stopping rule

Run the focused adapter, core, inventory, fallback, and pool tests, plus all
affected artifact verifiers. At handoff, run brain `check`, extension `check`,
`ruby context/check.rb`, active wire checks, and `git diff --check`.

Back up `~/.ghostnote/rig.json` and restore its exact bytes. Never save, close,
or modify `New 1`. The user closes owned projects without saving and restores
the normal controller. Then run `npm run probe:hello` and compare the API state
with the retained final baseline. Remove the research archive by exact path.

Stop an acceptance arm on an ambiguous witness, a failed authority read, or an
endpoint that is not P. Retain the diagnostic and do not retry it automatically.

## Exit

If the ordering rule and live acceptance pass, the public constructor can use
the step-delta provider for shadow research builds. 8g3 live budget work can
then start under that guard. If they fail, 8g2 refusal remains and 8g3 stays
offline. Stage the session without a commit and update NOW.
Suggested commit message: `feat: admit shadow reads through confirmed step-delta windows`.
