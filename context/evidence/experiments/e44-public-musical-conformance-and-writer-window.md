---
id: E44
kind: evidence
state: active
source: phase-2-session-2h
---

# E44 — Public musical conformance passes, and writer cursors need the 512-step window [K] (2026-08-19)

**Verdict: one shared public-path conformance harness passes against the fake and
Bitwig. Fine-grid musical writes need 512-step writer cursors. The measured
expression workload does not activate asynchronous completion.**

## Complete public proof

One invocation creates three clips and writes several clips and MIDI channels.
It covers straight and triplet positions, generation, all eight transformation
verbs, four requested variations, editor navigation, independent readback, and
directed reversal. All 20 writable note properties round-trip exactly. Gain uses
the E24 inverse. Pressure refuses before mutation.

The requested-variation case creates one adjacent four-row block. Every row
keeps all eight source notes after seeded humanization. Scoped reversal restores
the source first, removes rows from high to low, and leaves no clip residue. A
stale revision applies zero stages and zero notes.

Live-only bank overflow and concurrent human editing remain deliberate skips.
E33 and E39 already cover overflow without damaging the fixed baseline. E32 and
E39 cover human interference. The shared fake harness runs the corresponding
public-path refusal cases.

## Writer-window finding

The first live variation attempts repeatedly kept 8, 2, 8, and 3 notes across
the four rows. The first missing note in each failed row matched that writer
cursor's 64-step boundary at the selected grid. A 1/64-beat grid gives a
64-step cursor only one beat of writable range. Coarser variation grids reached
farther, which explained the alternating counts.

The production pool cursors now use the existing `fineSteps` width of 512. The
dedicated fine read cursor still reconciles binary 1/64 and triplet 1/48 scans.
All four live rows then retained eight notes. The final generation path used 6
stages, including 3 property stages.

Conformance also made two cursor rules explicit. Structural stages physically
release all writer cursors before reuse. A clip-wide reconstruction verifies its
cursor before the clear-and-write turn. Note-property encoding now preserves
the requested MIDI channel.

## Workload measurement

The named workload was: write full expression to three launcher clips in one
MCP request.

| Workload | Stages | Property stages | Total | Property waits | Share |
|---|---:|---:|---:|---:|---:|
| One clip | 2 | 1 | 6.575 s | 169 ms | 2.6% |
| Three clips | 6 | 3 | 17.409 s | 507 ms | 2.9% |

The `2N` property path is correct, but its declared waits are less than 3% of
the measured total. The request completes and returns final readback. Async
batch completion stays deferred.

## Baseline and verification

The final live check restored 10 tracks, 10 scenes, 22 occupied cells, selection
at track 0 row 1, stopped transport, the empty schema-v1 observation value,
cursor homes and pin state, and `Last change`. The wire remains 138 methods with
hash `87619942d7eac74d`.

`npm run check` passes 623/623. The Java 21 extension build and deployment pass.
The handshake and full live probe pass. The required remote CI candidate is
pending until the reviewed changes have a commit.
