---
title: E129 — Played-range consolidation guidance
kind: evidence
state: active
updated: 2026-09-24
parent: ../../plan/phase-7/7b-follow-up-played-range-consolidation.md
---

# E129 — Played-range consolidation guidance

## Verdict

The offline and independent live gates pass. A fresh agent followed the
played-range refusal, used visible computer control for Consolidate, acquired
new exact state, and completed one guarded write and reversal. It did not use a
low-level note write to bypass the refusal.

The trial removed its owned duplicate. The original clip and project occupancy
match the recorded baseline.

## Implementation

`exact-note-source.ts` now owns one pure clip-range diagnostic. It refuses a
non-zero loop start outside the existing `1e-9` host comparison tolerance. It
also refuses a note that starts before zero, starts at or after the local clip
length, or ends after that length.

The diagnostic keeps the exact clip address, local onset range, loop range, and
complete note-content range. Its remediation is:

> Select this clip in Bitwig and use Consolidate. Then read the clip and preview
> the change again.

Symbolic context checks every addressed clip before it filters events. The note
proposal compiler checks only clips targeted by insert, move, transpose, or
delete operations. Apply uses the same target check on fresh exact state before
the generic changed-source refusal. A refused apply does not write to the
workspace.

The exact source now retains finite negative note starts. This lets the shared
diagnostic give the required actionable refusal instead of losing that observed
state during source validation.

The experimental proposal tool description names the consolidation boundary.
No extension, wire method, named-action wrapper, consolidation transaction, or
low-level note-operation change was added.

## Offline verification

Focused tests cover:

- an offset 16-beat clip with loop and note content at beats 24 through 40;
- negative, at-end, and over-end note coordinates;
- compatible zero-based geometry;
- a non-zero play start and disabled looping;
- intentionally narrow symbolic coverage;
- all four targeted proposal operations;
- an incompatible unrelated clip;
- matching preview and fresh-apply refusal with no workspace write.

The complete brain check passes 1,169 tests. `ruby context/check.rb` and
`git diff --check` pass. The live deployment handshake is also current:
Bitwig 6.0.6, Controller API 25, extension 0.0.1, contract `ghostnote/0`, and
method hash `78368fe47ea0e814`.

## Live gate

E131 adds `acquire_clip_note_source` only to the experimental
`phase-7b-agent-note-patch-v0` profile. It returns the complete guarded exact
source that the proposal tool accepts. The live trial started its server with
that profile and used the complete dual-grid route. The entry handshake passed
with Controller API 25, 157 methods, and method hash `905bc2531512025b`.

The project was `26.36-4 orangebeat`. Before fixture setup, the selected source
was row 0 on durable track
`9cc70327-32f3-442c-9c46-48a55c7d564a`. Its exact source digest was
`f2eef99e7029f3eda432c8b38c5f542c67c387d82b361d2eae2318f83a567a12`.
It had a 16-beat length, a loop from beats 72 through 88, 44 notes, and complete
note content from beat 7.96875 through 87.39086818695068. The entry selection
was launcher track 2, row 0, with mixer track 2.

Ghostnote copied that source to the owned row 1 fixture. Setup change
`bfc73cb8-b79f-4f09-828c-536a37fe252e` records ownership. The first E131
acquisition refused before a note write. It reported local range `[0, 16)`,
Bitwig loop range `[72, 88]`, complete note-content range
`[7.96875, 87.39086818695068]`, and the exact consolidation remediation.

The agent announced the hybrid seam. Computer control selected the visible row
1 clip, confirmed `S2`, 44 notes, and a loop start at bar 19, then invoked
Consolidate with the visible Bitwig shortcut. Ghostnote did not invoke a named
action and did not record consolidation as its own reversible change.

A new complete acquisition returned zero-based geometry, 10 notes, and source
digest `f1a730adcc9475d83230e06706c187a76d5813017877bded5dea149074a87ada`.
The loop was `[0, 16]`. Note content was
`[0.9986979166666666, 15.390868186950684]`. This Ghostnote state is the semantic
authority for the post-consolidation result.

The first bounded proposal tried to transpose one note. Preview refused without
a write because the recorded host durations did not fit either writable grid.
The agent did not weaken that timing guard. It changed to one insert-only edit:
MIDI 60 at beat 0, duration `1/4`, velocity 64. Preview digest
`f6abc47950429473e3e58a82e113b806163a647023f0e1e7594c8091b99c5aae`
compiled with no loss. Apply change
`c6335f58-cadc-40ac-b723-57da307b00a3` had exact fidelity and an empty complete
readback discrepancy list. Independent acquisition found 11 notes and the
inserted note. Reversal change `f19381bc-054a-4ef9-9a34-9dca11f057df` restored
the 10-note consolidated fixture with no unrestored place.

The setup reversal could not delete row 1 because visible consolidation was a
newer change outside Ghostnote's ownership record. The scoped cleanup therefore
deleted only the verified owned row 1 clip as change
`414da13a-70c2-43e1-b063-9408df7e13e6`. Final readback found row 1 empty. The
project again had only the three original row-0 clips. The original target still
had 44 notes with the same length, range, and launch settings. Selection was
restored to track 2, row 0, mixer track 2. Transport was stopped. The final live
mark was revision 8, scene epoch 2, content epoch 32773, and generation
`55a20186-5a05-4b50-bf16-95c73737b3d5`.

The current direction is recorded in
[the consolidated compact-bar design](../format/CONSOLIDATED_COMPACT_BAR.md).
The next session starts the Phase 8 product and interface audit.

## Retrospective

One semantic guard plus visible computer use was sufficient. The main friction
was not the hybrid seam. It was that setup reversal could not own the later UI
consolidation, so cleanup needed one verified scoped delete. Keep that ownership
boundary explicit; do not add a consolidation transaction.
