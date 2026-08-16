---
id: D6
kind: decision
state: active
source: DECISIONS.md
---

# D6 — Addressing: pinned non-following cursors, identity never index **[SETTLED 2026-07-25]**

**Address by durable identity through a pool of pre-allocated, non-following cursor
tracks, each owning a `PinnableCursorClip`. Never store or send a bank index that
outlives the request that resolved it.**

- **`channelId` (UUID) is the durable track key** (E2f). It is minted fresh on
  create, so a delete-and-recreate is a DIFFERENT track — which is correct, and is
  why a stash cannot be replayed onto a recreated track by name.
- **Pointing mechanism is `trackThenSlot`** — `cursorTrack.selectChannel(track)`
  then `track.selectSlot(s)` — the only one of three candidates that works (E1).
  Settle is ~25ms and **verifiable by polling** `position()` + `sceneIndex()`,
  which replaces daw-mcp's blind 400ms sleep. **Amended by E29:** each point
  attempt unpins the cursor track and clip, sends the complete track and slot
  point, and checks the exact track and row. **Amended by E36:** it then pins
  both handles and confirms the track, row, track pin, and clip pin in one
  status reading before it records the hold. The fast path waits 25 ms. Retries
  wait the 144 ms structural budget. Eight failed attempts refuse with
  `AddressUnresolvedError`. **Amended by E38:** target acquisition and pin
  settlement are separate states. A target miss repeats the complete point. A
  pin miss polls in place without canceling the pending pins. It repeats the
  point only if the exact target moves. The refusal states which confirmation
  state failed.
- **Cursor pools are non-following BY CONSTRUCTION** (`shouldFollowSelection=false`
  at creation); pinning is belt-and-suspenders on top (E1). 3 cursors held 3
  different clips concurrently, and 20/20 write+readback cycles stayed correct
  through continuous user clicking (27 selection changes observed).
- **Re-point after ANY structural op.** A held pin's `sceneIndex` goes permanently
  stale after scene compaction (E3), and bank indices drift under create/delete.
- ⚠ **Pointing STEALS the user's clip selection** (E1, measured E14-F1). It can be
  saved and restored around a batch, restoring does not disturb the pool cursor,
  and a whole batch costs exactly ONE observable selection change — so one restore
  at the end suffices (E14-F2/F3/F4). **Delivered in Phase 1 session 5 B4:** the
  executor owns one scope across its complete pipeline, and the live adapter
  confirms the final restore through selection readback (E23). **Amended by
  E27:** the scope captures selection at pipeline entry. A cursor hold is reused
  across nonstructural stages only after `cursor.status` confirms the target
  track position, scene row, cursor-track pin, and cursor-clip pin. Cursor
  eviction, device pointing, and every structural operation invalidate the
  applicable hold. **Amended by E36:** only an active executor selection scope
  can reuse a hold across calls. A direct adapter call clears its holds when it
  returns.
- ⚠ **Pointing at an EMPTY slot silently lands on the WRONG clip** and
  `cursor.status` looks healthy (E2). Create the clip first, always.
- **Bank-window overflow is a refusal, not a knob** (E5, standing rule 5).
  `TrackBank.itemCount()` reports the PROJECT total, not the window (E15-A) —
  which is what makes the rule implementable at all; before it, "16 tracks exist"
  and "16 of 54 are visible" were indistinguishable from the extension side.
  > ⚠ **RESTATED 2026-08-07 (E16r): a PRECONDITION on every structural create,
  > checked BEFORE the call — never a post-hoc detection.** A create past the
  > window mints a track `track.list` never shows: unaddressable, un-cleanable,
  > audible — and a track copy consumes one row by the same rule. Budget:
  > `bankSize − (project tracks + FX returns + master)`. The Master and the FX returns leave
  > the window FIRST (E16r) and are E16's audibility oracles; the failure reads
  > `found:false`, byte-identical to a deleted track. ⚠ Never a licence to reap
  > (D20); ⚠ never justified on disk grounds — E16u measured copied-track disk
  > cost as immaterial (~20 KB/copy, no save-time change). → PROJECT_PLAN §4 rule 5.
