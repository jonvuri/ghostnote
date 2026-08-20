---
title: Current state
kind: status
state: active
updated: 2026-08-19
phase: phase-2
session: 2x
---

# Now

Session 2i and its long-clip follow-up are complete. E45 records the accepted
first musical dogfood result. E46 records the public existing-clip metadata
operation, paged long-note writes, and truthful reversal qualification. Session
2x is next. Session 2j starts the second dogfood use after it.

## Accepted live result

Project `26.05-2 moon` has the original 32-beat Lead and Harmony clips in row 1.
Rows 2 through 4 hold three accepted full-phrase variations on each track. Lead
row 2 is open in the Edit layout. The long-clip proof used a disposable empty
Lead row after the accepted clips. It left that row empty.

## Long-clip result

- `set_clip_metadata` updates the complete measured metadata of an existing
  clip, records the prior state, and returns exact readback.
- Note writes page the fixed writer window, use page-local steps, confirm the
  exact pinned target before every required page, and restore page zero.
- Every planned stage is preflighted before the first write. A later page or
  target failure cannot leave an earlier expressive write unrecorded.
- Note properties use separate settled page turns. The live proof preserved an
  exact `pan: -0.25` value on the channel-7 note at beat 96.
- Captured durations outside all writable grids fail the fidelity floor before
  mutation. They no longer report an undo that cannot run.
- Live proof extended a disposable clip from 32 to 128 beats, wrote an exact
  channel-7 note at beat 96, reversed to 32 beats with no notes, and removed the
  clip.

## Next session

Session 2x owns asynchronous completion and explicit cancellation. E45 proved
that a request can continue to mutate after the MCP client's 60-second timeout.
Keep this work separate from the completed long-clip repair.

## Verification

- Focused adapter, executor, and surface tests: pass.
- Full offline check: 637/637 pass.
- Live long-clip proof: pass with exact later-page expression, reversal, and
  clean teardown.
- Extension build, context check, and diff checks pass.

## Retrospective

Preflight every planned stage before mutation. Run read-based note properties
only after the required writer page settles. Keep the reader's binary and
triplet scan rules separate.
