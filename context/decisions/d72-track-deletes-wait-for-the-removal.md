---
id: D72
kind: decision
state: active
updated: 2026-11-08
source: B19
---

# D72 — Track deletes wait for Bitwig's removal

Bitwig removes a deleted track after the request returns, and resolves the bank
index only when it removes the track. Until then every index above the track is
stale, and an index-addressed delete sent meanwhile removes another track
([E415](../evidence/experiments/e415-b19-track-delete-lands-late-and-misdirects.md):
11 canaries and `FX 1` lost to three back-to-back `delete_track` calls).

## Rule

1. A stage of track deletes ends only when each deleted track has left the
   bank, polled with `track.list`, for at most 8 s plus 1 s for each track.
   The delete is never sent again. A track still there at the bound reads back
   as `differs` through the executor's one readback (D65), so no later stage
   or tool call starts while a removal is known to be pending.
2. `delete_track` names each track that is gone in `readback.removed`; a track
   still there is left out. Its description states the wait and tells the
   caller to read `list_tracks` before deleting a remaining track again.
3. `track.delete` carries `expectedChannelId`, and the extension refuses the
   delete when another track is at the index. This catches a stale brain
   index; it cannot catch a pending removal, because the extension's view lags
   it too (E415 run F2).
4. Scene deletes keep their path: on 2,880 clips, back-to-back `delete_scene`
   calls removed only their rows (E415 run S1). The same wait applies if a
   heavier project shows a pending scene removal.
5. An operator edit made while a removal is pending is outside this rule, as
   other concurrent operator edits are (D65).
