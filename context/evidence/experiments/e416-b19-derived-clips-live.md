---
title: E416 — B19 clips derived from a source clip, checked live
kind: evidence
state: done
updated: 2026-11-09
owner: B19
---

# E416 — B19 clips derived from a source clip, checked live

## Result

On Bitwig 6.1.4 / API 25 with main's normal build (95 methods,
`0439995f8f3d9953`; `probe:hello` all pass) and descriptions v70 served
after the operator restarted the MCP client (Zed), `add_launcher_clip` with
`source` ([D75](../../decisions/d75-clips-derived-from-a-source-clip.md))
derived a slice on another track and a patched variation. Both read back
`verified` with the source event IDs (`mintedIds` 0). A derived add took
3.0–3.1 s, against 2.65 s for the document add of the source; the
difference is the source read (358 ms).

| Call (project `gn-scale-test`, 2026-11-09) | Result | Total | Source read |
|---|---|---:|---:|
| Source: document add on gn-B row 8 (8 beats, loops, 4 notes, provenance range 64–72; n3 at 3 lasts 2 beats) | verified, `c1`, 4 IDs retained | 2,651 ms | — |
| Slice to gn-sel row 1: `from` 1, `to` 4, `shift` 1/2 | verified, `c2`; n2 at 1/2, n3 at 5/2 shortened to 1 beat (`derived.shortened` [n3]); 2 omitted; length 7/2, loop 0–7/2; provenance range 65–68 | 3,080 ms | 358 ms |
| Variation to gn-B row 7: whole clip, patch on the source base (REMOVE n4, UPDATE n1 pitch 61, ADD v1, CLIP_UPDATE name) | verified, `c3`; n1 61, n2, n3, v1; name changed; `derived.patch` 1 / 1 / 1 | 2,997 ms | 358 ms |
| Source read after both | identity `current`, same ref and document | 523 ms | — |
| Patch naming n4 with `to` 4 | `invalid-input` at stage plan, "A note outside the range is not in the derived clip", no effect | — | — |

The slice's content stage also wrote the clip length and loop
(`clipFields` length, loop): the empty 3.5-beat clip that Bitwig created
differed from the requested length or loop, and the content stage set them.
The 8-beat adds needed no such stage. The cause was not investigated; the
readback verified the result.

The variation reported `narrowedSources: [0]` for a range that did not
change. The fix (reported only when the range narrows) is offline-tested and
needs no description change.

## Cleanup

One `delete_launcher_clip` call removed the three scratch clips (verified
empty). `list_launcher_slots` then matched the entry listing on every track
(gn-B rows 0 and 5, gn-sel row 0). No call warned `slot-selection-moved`, so
the prior Launcher slot selection was restored each time.
