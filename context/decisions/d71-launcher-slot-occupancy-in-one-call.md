---
id: D71
kind: decision
state: active
updated: 2026-11-08
source: B19 session 2
---

# D71 — Launcher slot occupancy is one call with its own mark

Real use made 172 empty-slot reads (54 s) to find free slots
([E393](../evidence/experiments/e393-r01-round3-real-use-followups.md)
section 3). `slot.status` answers for one slot in one turn, and `batch.run`
drops the results of read ops, so a listing built from it grows with the slots
scanned. [E414](../evidence/experiments/e414-b19-slot-occupancy-live.md)
measures the route below.

## Rule

1. The normal profile has one read method, `slot.occupancy`. In one handler
   run it returns every existing track of the bank (index, channelId, name,
   position, type) with the ascending scene indices whose slot has content,
   and the `revision.get` fields of the same run: revision, generation,
   project, scene and content epochs, scene count, and unpinned cursor
   tracks. It also returns the `track.list` overflow pair (`itemCount`,
   `bankSize`), `sceneBankSize`, and `scanMicros`. `rig.scanTracks` is
   unchanged; the E5 probes read its count reply.
2. The adapter enumerator `launcherSlots()` returns the tracks with their
   occupied rows and a complete `RevisionMark` built from the same reply. No
   launcher event can fall between the listing and its mark.
3. `list_launcher_slots` reports occupancy only: `trackId`, `name`, `kind`,
   and `occupiedRows` for each track, and `rowCount` for the project. Clip
   names and play state stay with the clip tools. A track with no clip is
   listed with no rows, so the listing also shows the wholly free tracks.
4. A group track is listed with `group: true` and
   `launcherSlots: mirror-children`, and without rows. Its bank row reports
   the rows of its children as content (E414), and the clip tools refuse it
   with `group-slot`. Children of a group, also a collapsed one, are listed
   as their own tracks, because the bank is flat (D33).
5. There is no paging. Tracks or scenes outside the bank window make the
   result `partial`, with a warning, as `list_tracks` reports tracks. Every
   writer already refuses an overflowing project; paging, as B17 added for
   containers, waits for a real project that exceeds 256 × 128.
6. The public result has no freshness token. It is a fresh read
   (`authority: fresh-read`). Each clip writer checks its own target again
   and refuses a slot that holds a clip with code `occupied`, so a stale
   listing cannot overwrite a clip. The exact mark stays internal for any
   later brain caller that needs `contentSince`.

The tool costs one adapter call, `launcherSlots: 1`, in the call-budget test.
