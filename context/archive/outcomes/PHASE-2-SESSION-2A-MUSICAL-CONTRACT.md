---
title: Phase 2, session 2a — musical contract and surface decision
kind: outcome
state: complete
updated: 2026-08-16
parent: ../../plan/phase-2/README.md
prev: PHASE-1.md
next: ../../plan/phase-2/2b-theory-generation.md
scope: Phase 2 musical vocabulary and MCP surface decisions
evidence: E24 · D8, D9, D16, D18–D21
---

# Phase 2, session 2a — musical contract and surface decision

Session 2a is complete. The result is a versioned musical patch grammar, a
representative request corpus, fixed operation semantics, and the public tool
decision in [D21](../../decisions/d21-musical-patch-and-public-tool-grain.md).

## Delivered contract

`brain/src/musical/patch.ts` defines these items:

- `ghostnote-musical-patch` version 1 with strict parsing and stable encoding;
- generation and transformation boundaries over one grammar;
- beats-native targets with explicit MIDI channel and merge or replace mode;
- ordered generation, harmonic, rhythm, and performance operations;
- direct and clip-block protection intent;
- exact seed scopes and stateless SHA-256 random draws;
- per-operation input, output, changed fields, preserved fields, order, and loss;
- materialized compilation to clip-wide `note.clear` and explicit-channel
  `note.write` ops, with a required 16-channel preflight for replacement;
- preflight revision guards that refuse a project change before application;
- incompatible-version, pressure, missing-seed, duplicate-target, and boundary
  refusals.

Merge reads and keeps existing notes. Replace changes only the addressed channel
in the logical result. The host clear is clip-wide, so compilation reads all 16
channels and reconstructs every preserved non-empty channel. Every note change
protects all 16 channels because stash replay also uses the clip-wide clear.
Duplicate note identities refuse. Overlapping same-pitch notes shorten with a
loss item. Out-of-range MIDI pitches refuse without clamp, fold, or wrap.

The fake now filters note reads and adjacency work by MIDI channel. It no longer
copies notes from other channels into the channel being written. Focused tests
execute compiled operations through `Workspace.apply`.

## Representative corpus

The corpus has nine accepted patches and two explicit refusals.

| Case | Result |
|---|---|
| `generation-progression` | direct merge generation |
| `replace-mode-arpeggio` | channel-explicit replacement and arpeggiation |
| `transform-detected-harmony` | ordered transpose, detection, harmony, and voicing |
| `literal-expression-merge` | exact expression, including gain |
| `several-clips-theory-forms` | one patch over two clips |
| `several-midi-channels` | one clip with channels 1 and 9 |
| `triplet-quantize` | a one-third-beat grid request |
| `expression-preserving-humanize` | seeded performance change with field preservation |
| `requested-variations` | four seeded takes in a clip block |
| `pressure-refusal` | explicit refusal before mutation |
| `midi-range-refusal` | explicit refusal without pitch correction |

The corpus artifact includes the canonical patches and contract-report shapes.
Its golden SHA-256 is
`11413279d0acfb506d159e625b8b1af6f52b2ab7ba2c7b1371d29892164cf85f`.

## Carry-in corrections

The new musical compiler always emits MIDI channel on note writes. The old
low-level write surface keeps its channel-0 default for compatibility. A clear
is clip-wide and accepts no channel or beat range. Public note wording now states
these boundaries.

The public gain schema now states the E24 result: gain is exact, and the shared
encoder applies the measured divide-by-two inverse. The stale erase wording no
longer lists gain as a fidelity problem. Pressure remains the one unwritable
note property.

## Exit criteria

1. Every corpus request maps to a canonical patch or explicit refusal.
2. Every operation has declared ownership, order, and possible loss.
3. D21 records tool grain and the agent/brain boundary.
4. The serializer rejects incompatible versions.
5. Golden tests cover all corpus patches and report shapes.
6. Explicit musical channels and exact gain wording resolve both carry-ins.
7. Typecheck, all offline tests, the context check, and `git diff --check` pass.

## Retrospective

The first literal-note schema had redundant placement and velocity fields. A
pre-freeze review found the ambiguity. Literal notes now carry their complete
values once.

The repair review found that operation-shape tests did not exercise compilation
through the application path. Focused compiler tests now use `Workspace.apply`
and a real fake-backed executor. No repository instruction change is needed.
