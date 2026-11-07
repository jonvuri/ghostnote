---
title: E405 — B18 content-event window holds 8,192 events after the latest read
kind: evidence
state: done
updated: 2026-11-07
owner: B18
---

# E405 — B18 content-event window holds 8,192 events after the latest read

## Result

On Bitwig 6.1.4 / API 25 with the B18 normal build, a Launcher clip's ref and
note IDs stayed `current` after 24, 25, 1,000 and 8,192 slot fill/empty events
following the latest read. After 8,193 events, the next read re-minted every
ID fail-closed (`identity: retired-and-new`). Each retired ref carried
`reason: identity-changed, why: delta-incomplete`, and the result carried a
`delta-incomplete` warning. E393 measured a re-mint at 25 events on the old
24-event ring.

A plain mark's `revision.get` reply now carries no events (253–255 B, one
turn). A delta reply carries only the window after the caller's `since`, at
about 109 B per event. A full 8,192-event window is 889 KB, with a median of
45–51 ms against 22–25 ms for a plain mark. A window past the bound returns no
events (255 B), and the brain reads the short count as truncated.

Run 1 found a defect, which was fixed before run 2. A `current` verdict kept
the ref's first-read mark, so the window counted from the first read rather
than the latest. In run 1, the 8,192-event read re-minted with
`delta-incomplete` after 24 + 25 + 1,000 + 8,192 = 9,241 events since the
first read. E393's sequence could not distinguish the two behaviours. A
`current` read or check now moves the ref's mark to the fresh read. Run 2
passed every case.

## Build and method

- Bitwig 6.1.4, API 25; jar SHA-256
  `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`.
- Normal archive SHA-256
  `87cb84d1f94317b092e10e15d31129922976f0e51abc979897dcf0fbe94e7c2c`;
  `normal-v1`, 93 methods, hash `d6decf985f6b1f36`. B18 added no method, so
  the hash is unchanged. The deliberate build marker is `rig.info.contentLog = 8192`.
  The fresh initialization was `2026-11-07T15:39:12.761Z`. All handshake checks
  passed before both runs ([hello 1](../data/b18/hello-01.txt),
  [hello 2](../data/b18/hello-02.txt)).
- [Driver](../../../brain/src/probes/b18-event-window.ts), derived from the
  E393 driver. It creates one scratch instrument track, `gn-b18-window`, in
  `gn-scale-test` (10 scenes) and writes a two-note seed clip at row 0 through
  the product tools. It then churns rows 1–9 of that track only with the raw
  normal-profile `slot.copyTo` (row 0 to an empty row) and `slot.delete`. The
  driver confirms the track index by channelId every 64 rounds. Each phase waits
  until the content epoch reaches exactly its target; an extra event aborts the
  run. Row 0 is read with `read_launcher_clip`. Product-tool churn would cost
  about 0.9 s per event; raw churn cost about 8 ms (17,434 events in 134–140 s
  per run).
- Reply costs are five plain marks and five `since` requests at each window,
  measured as JSON-RPC bytes and round-trip time on the driver's socket.
- No other client was connected to the bridge before either run. Idle MCP
  servers from other sessions were left alone. The operator approved the full
  run, and run 2 repeated the same scope after the brain-only fix.
- Data: [run 1](../data/b18/event-window-01.json) ([log](../data/b18/event-window-01.log)),
  [run 2](../data/b18/event-window-02.json) ([log](../data/b18/event-window-02.log)).

## Observations (run 2)

| Events after the latest read | Identity | Same ref and IDs | Warnings | `since` reply |
|---:|---|---|---|---|
| 24 | current | yes | none | 2,853 B, 25 ms |
| 25 | current | yes | none | 2,967 B, 24 ms |
| 1,000 | current | yes | none | 108,749 B, 26 ms |
| 8,192 | current | yes | none | 889,087 B, 45 ms |
| 8,193 | retired-and-new | no (`e3`, `e4`) | `delta-incomplete` | 255 B, 0 events, 24 ms |

At 8,193 events, `retiredRefs` listed both live refs at the address: the
`add_launcher_clip` write's ref and the read ref.

## Cleanup and preserved state

Both runs deleted their churn clips and the scratch track; the final track list
(11 tracks) matched entry by ID and name. Scene epoch stayed 2 throughout. Mixer
selection stayed on the entry track (index 8, the same channelId). The Launcher
selection observer reported none at entry and track 9 / slot 0 afterwards. This
is the stale index of the deleted scratch track, which R02 also recorded. It is
not treated as a verified selection. Both runs added many undo entries. No
playback launch or save ran.

## Limits

- Probes that read `contentEvents` from a raw `revision.get` without `since`
  (E19–E21, phase 3e/8d/8h3e/8i14) now receive no events. Pass `since` before
  re-running them.
- The window counts every observed slot event in the project, not only events
  at the read's slot. A busy session elsewhere in the project consumes the same
  8,192-event bound.
- E393's optional group-mirroring question was not run.
