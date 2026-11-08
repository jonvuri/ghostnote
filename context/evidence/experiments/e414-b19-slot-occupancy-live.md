---
title: E414 — B19 slot occupancy lists the whole bank in one turn
kind: evidence
state: done
updated: 2026-11-08
owner: B19
---

# E414 — B19 slot occupancy lists the whole bank in one turn

## Result

On Bitwig 6.1.4 / API 25 with the B19 session 2 normal build, one
`slot.occupancy` call listed every occupied Launcher slot of a near-full bank
(251 tracks × 128 scenes, 30,745 clips) in a median of 32.5 ms (p90 49 ms).
The listing matched 32,128 single `slot.status` reads with no mismatch, and no
launcher or scene event occurred between them. `list_launcher_slots` took a
median of 30.5 ms. The same listing through sequential `slot.status` calls
would take about 12.7 minutes (23.7 ms per call), and E393's real use spent
54 s on 172 such reads. [D71](../../decisions/d71-launcher-slot-occupancy-in-one-call.md)
records the design.

| Grid | Occupied | Raw call (median / p90) | Reply | `scanMicros` (median / max) | Tool (median) | Tool result |
|---|---:|---|---:|---|---:|---:|
| Entry project: 11 tracks × 10 scenes | 25 | 24.9 / 26.1 ms | 1.7 KB | 1.1 / 4.6 ms | 24.6 ms | 1.5 KB |
| Full grid: 251 tracks × 128 scenes | 30,745 | 32.5 / 49.0 ms | 130 KB | 20.6 / 32.4 ms | 30.5 ms | 124 KB |

The scan reads every bank scene of each existing track, so its cost grows
with the track count, not with occupancy: about 0.1 ms per track at 11 tracks
and 0.08 ms per track at 251. At the full bank the call costs about one more
turn than a plain mark. The reply grows with the occupied slots, at about
4.2 B per clip. A full-grid tool result (124 KB) exceeds the 48 KB inline
warning of the clip reads; a real project of that size has not been seen, so
the result stays inline (D71).

Group tracks: `Group 5` reported content in rows 0–2, exactly the rows of its
collapsed child `gn-E16`. The child is listed as its own track, and the tool
lists the group as `mirror-children` with no rows.

## Build and method

- Bitwig 6.1.4, API 25. Normal archive SHA-256
  `58c804b4e7df1156ae7ddcb6caf290e5cc590a51cc94315b403c54f48c63c5da`;
  `normal-v1`, 95 methods, `0439995f8f3d9953`; `rig.info.slotOccupancy`
  marker present. `probe:hello` passed after the operator replaced the
  controller (fresh start 2026-11-08 15:52:07 UTC, after the deploy).
- Driver: `brain/src/probes/b19-slot-occupancy-live.ts`, read-only. It makes
  20 sequential raw calls and 20 tool calls, then sends one `slot.status` for
  every bank slot of every listed track below the scene count, in concurrent
  chunks of 64, between two `revision.get` marks that must be equal. It
  compares the occupied sets with a fresh listing at the same mark, compares
  the tool's rows with the raw listing and its tracks with `list_tracks`, and
  times 48 sequential `slot.status` calls as the brain-only reference.
- Grid: `brain/src/probes/b19-slot-grid.ts` added 240 instrument tracks
  `gn-b19-000`…`239` with `add_tracks` (108.6 s), 118 scenes with
  `add_scenes`, and 30,720 raw `clip.create` calls in concurrent chunks of 64
  (11.5 s to send). Bitwig created the clips at about 64 per second after the
  requests returned, so the driver's 120 s wait timed out at 8,448 clips; a
  separate poll waited until all 30,745 were present and stable. The operator
  allowed scratch tracks and clips in `gn-scale-test`.
- Data: [b19-slot-occupancy-live](../data/b19-slot-occupancy-live/).

## Cleanup

The teardown sent four `delete_track` calls of 64 tracks and one
`delete_scene` for the 118 added rows while Bitwig was still applying the
earlier work; the driver did not record the calls' readback status. The
deletions landed slowly, at about four tracks a minute, and the scenes went
last. When the host went idle at 16:23 UTC, 128 tracks and every added scene
were gone and 112 scratch tracks (`gn-b19-064`…`239`, not contiguous)
remained with no further change for 10 minutes: those deletions were dropped,
not delayed. After inspection, the remaining tracks were deleted in seven
calls of 16, each awaited before the next; each read back `verified` and
landed in 4.1–4.4 s. The final track list equals entry (11 tracks, same IDs
and names), with 10 scenes and the same 25 clips in the same rows.

Bulk deletion against a backlogged host is therefore not reliable without
checking each call's readback and waiting for it to land. The grid driver now
waits for creations and deletions to appear in the listing; product
`delete_track` behaviour under backlog is not otherwise examined here.
