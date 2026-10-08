---
id: D43
kind: decision
state: active
updated: 2026-10-08
source: phase-8i1
---

# D43 — Every owned cursor track stays pinned **[SETTLED 2026-10-08]**

D6 made the pool cursors non-following by construction
(`shouldFollowSelection=false`) and used pins only as extra protection. In a
project that was saved with the ghostnote cursor records, Bitwig does not
keep that setting. An unpinned owned cursor then follows the selection, and
a point of an unpinned cursor changes the selection in the application. In
the second 8i dogfood trial, every `clip.read` refused `deadline` because of
this. [E250](../evidence/experiments/e250-reader-follow-mode-repair.md) has
the evidence.

## Rule

- The extension pins every owned cursor track in its first task: the eight
  pool cursors, the fine cursor, the note observer, the clip reader, and the
  three parent finders. No route unpins a cursor track. A point changes only
  the clip pin. A pinned cursor track still moves when it is pointed, and the
  selection does not change.
- `cursor.pinTrack` accepts only `pinned: true`. `cursor.pointTrack` pins the
  track before it points it.
- The host keeps no pin on a cursor without a track. A track delete removes
  the pin of a cursor on that track. A project switch brings the pins of
  that project. The extension pins a cursor again when its pin goes and when
  an unpinned cursor gets a track, in a later task. A cursor without a track
  neither follows nor drives the selection.
- `revision.get` lists each owned cursor on a track that the host reports
  unpinned. The brain refuses with code `unhealthy` while one is listed, in
  `check_bitwig_connection` and in every tool that checks health. The list
  rides beside the revision mark, not in it: a mark is part of the published
  snapshot reference.
- A selection lease holds while the mixer selection shows the target or the
  mixer track of the claim. A pinned point leaves the mixer selection where
  the person put it.

## Consequences

- Do not trust `shouldFollowSelection=false`. A new cursor is owned only
  through `Rig.ownCursorTrack`.
- A point no longer moves the person's mixer selection. The restore puts
  back the slot selection; the mixer selection was not changed.
- The track pin and unpin frames left the adapter: two sequential calls for
  each clip point attempt, and up to two for each device route. The release
  after a structural stage sends 8 frames, not 16, in one turn.
- The research probes that unpin a track (`ChangeWatchProbe`,
  `ShadowKneeFixture`, and the historical drivers that send
  `cursor.pinTrack` with `pinned: false`) are not product routes. The
  historical drivers now refuse at that frame.
