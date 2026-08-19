---
title: Phase 2, session 2x — async batch completion
kind: plan
state: planned
status: Activated 2026-08-19 by E45. A request exceeded the client timeout and
        continued to mutate while the caller began recovery.
updated: 2026-08-19
parent: ../phase-2/README.md
prev: ../phase-2/2i-long-clip-follow-up.md
next: ../phase-2/2j-dogfood-2.md
scope: PHASE-1-ENGINE.md item 7
evidence: E8, E15-D, E15-F, E45 · D10
---

# Phase 2, session 2x — async batch completion

> **Purpose.** Build the deferred-response protocol E8 flagged as an open Phase-1
> item, so a paced batch can report **completion** rather than only acceptance.
> Two things fall out of the same mechanism, which is the argument for building
> it at all.

## Disposition

Phase 1 closed without this work. E45 now activates it before the second
dogfood use. One musical request exceeded the client's 60-second timeout and
continued to mutate while the caller began recovery. The synchronous fallback
must remain available until the replacement path passes the affected proof.

## Phase 1 background

**No Phase-1 exit criterion depended on it.** Session 1's staging already sidesteps
the problem entirely: instead of passing `delayMs` and hoping, the brain partitions
ops by settle class and issues one `batch.run` per stage, awaiting a settle
between them — so `apply()` **already resolves on completion**, because nothing is
ever fire-and-forget. `stages.ts` says as much in its header, and says the `Stage`
shape and `stages[]` receipt are designed to survive this session's change.

So: build it if Phase 1 has room, defer it without guilt if not. It is listed last
deliberately. What it should *not* do is block session 5's sweep.

## What the same mechanism buys

1. **Completion, not acceptance.** The Bridge writes a handler's response when the
   handler **returns** ([Bridge.java](../../../extension/src/main/java/com/ghostnote/extension/Bridge.java)),
   so a paced batch can only acknowledge that it was accepted. E8's probe polled
   readback instead. A handler returning a "deferred" sentinel, with the executor
   writing the final frame later, is the shape E8 named.
2. **⚠ The 2N-stage expression cost — the real prize.** D10: N clips with
   expression pay **2N stages and N × `gridChange`** (144ms each), because a
   `note.props` op resolves its note against the clip the cursor held at **turn
   start**, so it can never be hoisted or coalesced across clips (E15-F). That
   cost "is the price of correctness," and `PHASE-0-SESSION-2.md` records the
   conclusion precisely: *a deferred-response protocol is also what would make a
   re-point inside a batch settleable, and so is the only route to reclaiming it.*
   Phase 2 is the phase that will feel this, since it writes expression constantly.

Session 4 has no pane action button or polling loop. It does not need an
extension-to-brain event path, so this protocol has no control-layer obligation.

## Scope

### In

1. **The wire protocol change.** A deferred sentinel from a handler, correlated
   later by JSON-RPC id. The Bridge already marshals requests onto the
   control-surface thread via `host.scheduleTask` and correlates responses by id,
   with the header noting responses "may therefore complete out of order" — so the
   correlation half exists and the deferral half does not.
2. **⚠ Thread confinement, preserved.** The revision counter's atomicity is not
   defended by a lock — it is defended by the fact that **every request is
   dispatched on the one control-surface thread**, which is what makes
   check → apply → bump atomic for free (E8, `ExecState`). A deferred completion
   frame written from a different thread is the obvious way to break that. This is
   the session's central correctness constraint.
3. **The executor side**: one paced call plus a completion frame, replacing
   `planStages`' per-stage round-trips — while keeping the `Stage` shape and the
   `stages[]` receipt, which were designed for this substitution.
4. **The re-point-inside-a-batch settle**, and with it the coalescing of
   `note.props` across clips that E15-F currently forbids.
5. **Fake-adapter parity**, so the offline suite still models what live does.
6. **Cancellation semantics.** A client timeout alone does not prove server
   cancellation. The protocol must expose terminal completion or confirmed
   cancellation. Recovery must not start while the timed-out request can still
   mutate.

### Out

- Removing the staged path. It is the fallback and it works; the deferred path
  should be provably better before anything is deleted.
- Streaming progress beyond what `notify` already does for free (E8-C).

## Decisions this session must make

- **Whether the deferred path replaces the staged one or sits beside it.**
  *Recommendation: beside it first*, selected per batch, so a regression is a
  config flip rather than a revert.
- **⚠ Whether coalescing `note.props` across clips is actually re-enabled.**
  E15-F is emphatic and `planStages` carries a long comment specifically to stop
  someone optimizing it away, with the fake modelling the trap
  (`propsReadsTurnStartClip`) so a hoist fails offline. If this session re-enables
  it, that comment and that trap must be **updated with the new evidence**, not
  deleted — otherwise the next reader re-derives a bug the project already paid
  for twice.
- **What a deferred response does when Bitwig never completes it.** Timeouts,
  explicit cancellation, terminal state, and what the receipt says.

## Exit criteria

1. A paced batch reports **completion**, with the receipt naming what landed in
   each stage, verified by readback.
2. Thread confinement is preserved: the revision counter is still touched from one
   thread only, and this is asserted rather than assumed.
3. The N-clip expression case costs measurably less than 2N stages, with the
   before/after numbers recorded — or the attempt is recorded as a ○ with its
   evidence, which is an equally good outcome.
4. `probe:e15f` still passes, or is superseded by a probe carrying stronger
   evidence.
5. Offline suite green; `methods.golden.json` regenerated if the wire changed.
6. A timed-out client can reach a confirmed terminal or cancelled state before
   recovery starts. No mutation occurs after cancellation is confirmed.

## Risks

- **⚠ This is the session most likely to break something already proven.** It
  touches the Bridge, the revision counter and the staging plan — three pieces
  that currently work and that everything else depends on. That is the strongest
  argument for its position last, and for it being optional.
- **The 2N-stage prize may not materialise.** The re-point settle is a hypothesis
  ("would also be what makes a re-point inside a batch settleable"), not a
  measurement. Treat it as a probe with a build attached, not a build with a probe
  attached — and be willing to record ○.
- **Asynchronous frames are how a `try/catch` stops protecting you.** E14-A1 is
  the precedent: an exception Bitwig deferred to its own thread escaped every
  extension frame and **took the DAW down**. Standing rule 3c / D15 applies with
  full force to anything that completes later on another thread.
