---
id: E43
kind: evidence
state: active
source: phase-2-session-2e
---

# E43 — Clip metadata round-trips, and `duplicateClip` remains the product route [K] (2026-08-18)

**Verdict: launcher-clip name, 8-bit colour, loop length and end, play start, loop
enabled state, and loop range have exact typed read and write paths.
`duplicateClip` remains the one product copy route.**

## Metadata measurement

The probe wrote with cursor `0` and read each result with cursor `1`. A new
8-beat launcher clip reported an empty name, play range 0–8, enabled loop, and
loop range 0–8.

- Name read back exactly.
- Colour values normalize to 8-bit host values. Bytes 31, 159, and 223 read back
  as the same bytes after conversion from the host floats.
- Loop length 10 read back exactly.
- Loop start 1 read back exactly, but the raw write moved play start and stop
  from 0/8 to 10/11.
- Play start 2 read back exactly.
- Play-stop writes 9 and 12, below and above the current loop end at 11, were
  both silently ignored.

The product writer accepts the complete exact metadata state. It writes the
loop first and restores play start after the loop-start side effect. Contract
validation requires a non-negative play start, a positive loop length, and loop
end equal to loop start plus length. Colour channels must be integer bytes. The
inert play-stop setter is not in the typed metadata state.

## Duplication routes

`duplicateObject` and `duplicateClip` both created a next-row clip. Each copied
the measured metadata, notes, and launch settings. Each overwrote an occupied
next row and emitted no occupancy event. Cursor equality reported true between
the source and copy, so it cannot prove clip identity.

`Clip.duplicateContent` did not create a destination object. It edited the
source in place, changed its measured extent, and did not preserve the seeded
note content. It is not an object-copy route.

The product keeps `duplicateClip` because its purpose is already fixed: mint the
next take in a clip block. The typed destination must name the same track and
the next row. Readback must prove that row empty before the host call. The other
two routes remain probe-only.

## Product proof

The fake reproduces both raw marker traps. Shared conformance verifies that the
complete typed metadata writer hides those effects, invalid state refuses with
no change, and duplication copies metadata, notes, and launch settings.

The live typed arm creates a clip, applies complete metadata, duplicates it,
and deletes both owned clips. Cursor `1` independently verifies the create,
edit, and copy results. The product wire uses `cursor.clipMetadata` and
`cursor.setClipMetadata`. The two rejected copy routes are not reachable from
the typed encoder.

The review follow-up compares final surviving metadata requests with executor
readback. An acknowledged but ignored update reports each changed field. Missing
metadata readback reports a mismatch. A later clip delete supersedes an earlier
metadata request and does not create a false mismatch.

## Fidelity impact

`clip.delete` now stashes clip existence, complete exact metadata, launch
settings, and all 16 note channels. Reversal recreates the clip first, then
restores notes, metadata, and launch settings. The play-stop marker remains a
named loss because its setter is inert. Automation lanes remain a named loss
because the host API has no complete lane readback.

## Baseline and qualification

The measurement applies to Bitwig 6.0.6 and host API 25. Cleanup restored the
10-track, 10-scene, 22-cell project baseline, entry selection, stopped
transport, empty observation record, and unpinned cursor homes. The wire now
has 138 methods with hash `87619942d7eac74d`.

Focused lifecycle tests pass 206/206. The full offline suite passes 602/602,
including typecheck. Extension tests and deployment, the 26-check live probe,
the context check, and `git diff --check` pass.
