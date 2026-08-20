---
id: E46
kind: evidence
state: active
source: phase-2-session-2i-long-clip-follow-up
---

# E46 — Long-clip metadata, paged writes, and reversal pass live [K] (2026-08-19)

**Verdict: one public request extended an existing 32-beat clip to 128 beats
with exact metadata readback. A second request wrote an exact channel-7 note
with `pan: -0.25` at beat 96 through a later writer page. Reversal restored the
prior metadata and notes.**

## Public metadata operation

`set_clip_metadata` accepts the complete measured state of an existing launcher
clip. The request includes its name, colour, loop length, play start, loop
state, loop start, and loop end. The operation records the prior state for
reversal and returns an independent readback with `metadataVerified`.

Metadata writes now use the same occupied-slot check and exact pinned cursor
preflight as note writes. The live proof first exposed an omitted occupancy
reading for `clip.update`. This caused every production metadata update to
refuse before mutation. The shared preflight now reads the target slot, confirms
the track and row, confirms both pins, and omits a second point in the write
turn.

## Paged writer

The note encoder selects the coarsest exact grid, groups notes by the fixed
writer width, and converts each absolute note position to a page-local step.
Before mutation, the adapter visits every required page across all planned
stages and confirms that the cursor still names the intended track and row with
both pins active. This prevents a later staged refusal from leaving an earlier
write unrecorded. Identity writes use page-local steps in one write turn.
Read-based note properties use separate page turns after each page settles. All
paths restore page zero.

## Reversal qualification

Captured note durations are now tested against the writable grids before a
write can replace them. A duration that no grid can replay makes the captured
state lossy. The fidelity floor refuses the mutation before it starts instead
of returning `canBeUndone: true` for a reversal that would later refuse.

## Live proof

The probe used project `26.05-2 moon` and an empty Lead row after the accepted
rows 1 through 4. It performed these steps through public tools:

1. Create one disposable 32-beat clip.
2. Set its complete metadata to a named 128-beat loop and confirm exact public
   and independent raw readback.
3. Write channel-7 notes at beats 1 and 96 with 1/64-beat durations. Give the
   beat-96 note `pan: -0.25`.
4. Read the clip and confirm its 128-beat length, exact note at beat 96, and
   exact later-page pan.
5. Reverse the note write and metadata update. Confirm a 32-beat empty clip.
6. Reverse the clip creation and confirm that the row is empty.

All checks passed. Final cleanup reported no clip residue and no active
reversal. The probe did not target or change the six accepted clips.

## Verification

- Focused adapter, executor, encoder, and surface tests: pass.
- Full offline check: 637/637 pass.
- Live long-clip proof: pass, including exact metadata, beat-96 expression,
  reversal, and cleanup.
- Extension build, context check, and diff checks pass.

## Retrospective

Keep one writer-page calculation in the encoder and use it for preflight,
identity encoding, and settled property turns. Preflight all planned stages
before mutation. The reader has different page-scan rules because it reconciles
binary and triplet grids, so a shared reader-writer window abstraction would
hide important differences.
