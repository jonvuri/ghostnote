---
id: D21
kind: decision
state: active
updated: 2026-08-20
source: phase-2-session-2a
---

# D21 — One musical patch grammar, with generation and transformation tools **[SETTLED 2026-08-16, AMENDED 2026-08-18]**

The internal musical contract is `ghostnote-musical-patch` version 1. It is pure,
beats-native, ordered, and deterministic. It has one or more clip-channel targets.
Each target gives a durable track id, launcher row, MIDI channel, write mode, and
operation pipeline.

## Public tool grain

Phase 2 exposes two musical write tools:

- `generate_clip_music` starts each target with a generation operation.
- `transform_clip_music` starts from existing clip content.

Both tools use the same patch grammar and planner result. The existing low-level
note and clip tools stay available for exact requests. A new tool is valid only
when it has a different permission class or object boundary. One tool per chord,
scale, or transform is not valid.

The two tools are ordinary write tools. They cannot remove clip containers. A
destructive operation stays on a separate D20 tool name.

## Agent and brain roles

The agent chooses the musical goal, constraints, target clips, channels, write
mode, operation order, and whether the request asks for variations. The brain
does these tasks:

- validate and normalize the patch;
- calculate theory and transformations;
- derive deterministic random values;
- detect collisions and MIDI-range failures;
- read existing content when the patch needs it;
- plan protection and compile explicit typed `Op` values;
- verify the result and report changes, loss, and refusal.

Musical code cannot read or write Bitwig. The Phase 2 planner uses
`Workspace.apply` as the only project-write seam.

## Write and protection rules

`merge` reads existing notes, keeps them, and adds output notes. It refuses the
same channel, pitch, and start identity. `replace` changes only the addressed
channel in the logical result. Bitwig can clear only the complete clip. The
compiler must first read all 16 channels, clear once, and reconstruct each
preserved non-empty channel. A missing channel read is a refusal, not an empty
channel. The compiled result carries the preflight revision. `Workspace.apply`
uses it to refuse a project change between preflight and application.

The typed `note.clear` operation is clip-wide and has no channel or range field.
Every note write and clear protects all 16 channel addresses in the write-set.
Stash replay clears once and reconstructs all channels. A partial channel replay
refuses when it cannot reconstruct the complete clip.

If two same-pitch notes overlap, normalization shortens the earlier note at the
later start. The report names this change. A duplicate identity is refused.
Pitches outside MIDI 0–127 are refused. The brain does not clamp, fold, or wrap
them.

Ordinary work is direct and stash-backed. Requested variations use a clip block.
The D18 fidelity floor also requires a matching clip block when direct replay
cannot protect the prior clip content. The planner never uses track copying as
protection.

The planner fixes the two `takes` meanings at their protection boundaries.
For `requested-variations`, `takes` is the total number of musical outputs and
the source clip is take zero. For `fidelity-required`, `takes` is the number of
adjacent existing protected takes. The planner writes one working result and
keeps the protected takes unchanged. At least one protected take must match the
working clip's complete 16-channel note state before the write.

## Randomness and reports

Every random patch has a caller seed. The brain derives a SHA-256 scope from the
seed, target index, variation index, and operation index. Each draw hashes that
scope and its draw index. It converts the first 53 bits to a value in `[0, 1)`.
There is no hidden generator state.

Each operation defines its input, output, changed fields, preserved fields,
order, and possible loss. A loss item names the target, variation, operation,
before value, after value, and message when those values apply. A timing move,
velocity change, shortened note, added note, or removed note is never silent.

E41 adds two result details without changing the patch grammar. A materialized
random result returns the effective caller seed and each derived operation
scope. A timing item returns requested and realized start beats. Quantize uses
nearest-grid ties-later behavior. Thin probability means removal chance and
requires replace mode. Densify fills empty grid lines between selected onset
groups from the preceding group; its probability means addition chance.

## Compatibility decisions

Every `note.write` from the musical path contains MIDI channel explicitly. The
Phase 1 low-level write operation and public write tool keep an absent channel as
a channel-0 compatibility behavior. `note.clear` is explicitly clip-wide by its
type. The public erase tool accepts clips, not channel or beat-range selectors. A
future removal of the write default needs a versioned schema change.

Gain is exact. The shared encoder writes requested gain divided by two. E24
verified this inverse. Public wording must not describe gain as lossy or
unmeasured. Pressure stays unwritable and is refused before mutation.

The representative corpus and golden report shapes are in
`brain/src/musical/corpus.ts`. Their v1 SHA-256 is
`a9d4fd5a5074788fba330d8230a7c6bd8b80909d74d40fa649ca581dc7c8e635`.
Session 2c changed only the report vocabulary. Re-voice now declares
`octave-displaced` as possible loss so that octave moves are not silent. The
patch grammar and representative requests did not change.

## Phase 2 closeout

E45 and E48 record two distinct accepted uses through the ordinary MCP surface.
The first used clip-block copies and exact note writes. The second used ordinary
track copy and one two-output generation operation. They did not repeat a tool-
grain, wording, refusal, or musical-usefulness problem. The two-tool grain and
patch version 1 therefore close unchanged.

`ghostnote-description-v4` is the final Phase 2 cohort identity. It contains 31
tools and has SHA-256
`0289ae1611a7c8c6c13b296a0749bd11dc8969df586859e10903b5e6d08d1ca4`.
Version 4 identifies the operation-status timing result. The public artifact is
otherwise byte-identical to the frozen version-3 cohort.
