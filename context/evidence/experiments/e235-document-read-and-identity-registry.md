---
title: E235 — Document read and identity registry
kind: evidence
state: done
updated: 2026-10-07
owner: phase-8h4b
---

# E235 — Document read and identity registry

## Status

[8h4b](../../plan/phase-8/8h4b-document-read-and-identity-registry.md) is
complete, except for one acceptance criterion. The `agent-native-v1` profile
reads a Launcher clip as a Document 1.0 snapshot and checks base refs with
the D32 verdict. A private registry keeps clip and event IDs by the identity
table. Every live identity claim agrees with an independent raw read.

**Not met:** FIELDS output is 41–57 percent of the equivalent exact JSON on
the fixed 8c corpus, not at most 40 percent. Token counts were not measured:
this workstation had no tokenizer or provider key. See [Format findings](#format-findings).

The extension and the wire did not change (88 methods, `68d457c4c4d1d7b3`).
Tool descriptions are at v26.

## Implementation

- `brain/src/surface/agent-native-result.ts`: the one result module of the
  profile. It has the read, write, and failure envelopes, the stable machine
  codes, `VERDICT_CODES` (one code for each D32 verdict), and
  `REFUSAL_CODES` (`group-slot`, `collapsed-group-row`). `empty` is an
  occupancy, not a failure. `absent`, `unavailable`, `partial`, `unhealthy`,
  and `outside-limit` are separate codes. Exception text goes only into
  `diagnostic`.
- `brain/src/bindings/identity-registry.ts`: the registry. It binds an opaque
  base ref (`gnb1.`) to one D32 reference, the clip ID, the R27 hash, the
  coverage, the acquisition boundary, and the map `(host channel, pitch,
  cell)` to event ID. It holds at most 256 live refs; the least recently used
  ref retires as `evicted`. A sweep retires refs of another project or
  generation (`incomparable`) and of another scene layout
  (`identity-changed`). It is in process memory only. The workspace owns it.
- `brain/src/bindings/launcher-clip-document.ts`: the projection from a D32
  `ClipSnapshot` through `projectRawClip`. It restores the host defaults that
  the reader omits, refuses a range that needs Consolidate (`range`), a
  partial note (`partial`), a cell collision (`collision`), and a clip over
  the reader limits (`outside-limit`). It reports D23 loss facts. `playRange`
  is not covered: the typed metadata has no play-stop marker.
- `brain/src/surface/agent-native.ts`: `read_launcher_clip` and
  `check_launcher_clips`. The read description carries the Core section of
  the model reference (revision 1, SHA-256 `e86f08a0…`); the module refuses to
  load if the file does not match its identity file. Optional sections come
  in the result on request. `tools.ts` composes the profile as the stable
  list plus these two tools. `GHOSTNOTE_TOOL_PROFILE=agent-native-v1` selects it.

## Offline evidence

- `stable-v1` registration (53 tools) has the same SHA-256 as before the
  session (`c16f2a9b…`), and the v25 cohort still reproduces its artifact.
- `identity-registry.test.ts` covers each identity table row (`new`,
  `current`, `stale` with retained and moved cells, the D23 delete-and-insert
  boundary) and each retirement verdict, the sweep, and the bound.
- `agent-native.test.ts` runs every fake fixture class through the FIELDS and
  JSON codec and compares each event with an independent fake read: empty,
  typical density, all 16 channels, disabled controls, finer-than-cell
  onsets, a cell collision, pressure, notes past the loop, and a group slot.
  The fake reader keeps one note per cell, as the host does, so a collision
  reads as one event with `collisionCount: unknown`. The projection guard
  refuses a snapshot with two notes in one cell.
- Brain check: 1,980 tests pass; the binding corpus and the document
  conformance pass.

## Live method

Driver `brain/src/probes/phase8h4b-document-read.ts accept`. Owned unsaved
project; normal profile. The driver writes an E231 typical clip (256 notes in
64 beats, all 16 channels) with the fine writer cursor in row 0 of
`gn-8h4b-doc`. One process runs all steps because the registry is in memory.
It waits for each operator edit by polling an independent raw `clip.read`
until the raw rows change and then hold. Each projection is compared field by
field with the raw rows (`agreement`). Artifact:
[accept.json.gz](../data/phase8h4b-document/accept.json.gz);
`verify-offline` recomputes every claim.

## Live results

| Step | Result | Agreement with raw read |
|---|---|---|
| Read twice | `new`, then `current`; same ref and document | 0 issues |
| Operator velocity edit (ch 1, pitch 36, 100 → 50) | Raw diff: one note, `velocity` only. Check: `stale`, new ref, 256 IDs kept, 0 minted | 0 issues |
| Operator pitch edit (ch 9, pitch 44 → 45, beat 2) | Raw diff: one key removed, one added. Read: `stale`, 255 kept, 1 minted; the moved note has a new ID | 0 issues |
| Scene append | Both earlier refs: `identity-changed`, retired. Next read: `new`; no old ID | 0 issues |

The first driver run stopped at the velocity step. A polling raw read
overlapped the operator edit and refused with `step-delta`; the driver
treated the refusal as fatal. The reader behaved correctly. The rerun retries
a refused raw read (three retries were needed during the edit).

## Measurements

One typical read (256 notes, 64 beats):

| Measure | 8h4b | Comparison |
|---|---:|---|
| Driver wall time, first read | 599 ms | E230 cold read, 64 sparse bars: 244 ms (reader only) |
| Wall time, six reads | median 658, 599–678 ms | E233 typical check: 782–840 ms |
| Adapter read inside the tool | 369 ms | — |
| Result bytes (FIELDS) | 90,778 | E233 stale check result: about 59 KB |
| FIELDS document bytes | 79,535 | JSON document: 91,639 |
| Wire: calls, bytes | 15, 19,129 | — |
| Current check result | 780 bytes (two refs) | E233 current: about 830 bytes |

About 230 ms of each read is outside the adapter read: marks, two content
deltas, projection, validation, and serialization.

## Format findings

These need a solution before 8h4c; the next session investigates them.

1. **8c corpus ratio.** FIELDS is 46/42/41 percent of the 8c exact JSON for
   short, medium, and long, and 57/45/43 percent of a notes-only exact JSON.
   Each 8c note has MIDI release velocity 64. The document holds it exactly as
   `releaseVelocity` 0.5039370078740157 on every row (about 45 bytes).
   Without it, `long` would be about 22 percent. The test pins the bytes.
2. **Host defaults are not portable defaults.** A Bitwig-default note differs
   from the portable defaults in eight fields: chance, occurrence, and
   recurrence enabled; release velocity 100/127; gain 0 (E15). Each live note
   therefore has a `WITH` object of about 260 bytes. The live FIELDS document
   is about 310 bytes per note and only 13 percent smaller than its JSON.
3. **Gain meaning.** HOST-BINDING maps raw host gain to portable gain
   directly. A new host note reads gain 0, so the document states portable
   gain 0 (silence) for an ordinary note. The binding needs a check of what
   host gain 0 means.

## Retrospective

The plan's byte criterion came from the 8c measurement, which omitted most
host fields. Nobody had measured Document 1.0 against it before this session.
A plan that adopts a numeric target from an earlier format should cite the
measurement that showed the new format can meet it, or schedule that
measurement first. A probe that polls during an operator edit must treat a
reader refusal as "not settled", not as a failure.
