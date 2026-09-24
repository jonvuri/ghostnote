---
title: E129 — Played-range consolidation guidance
kind: evidence
state: active
updated: 2026-09-24
parent: ../../plan/phase-7/7b-follow-up-played-range-consolidation.md
---

# E129 — Played-range consolidation guidance

## Current verdict

The offline gate passes. E131 supplies the missing experimental acquisition
route. The independent live agent gate is now ready. No temporary live clip
was created, and the project has no test residue from this session.

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

## Live-gate boundary

E131 adds `acquire_clip_note_source` only to the experimental
`phase-7b-agent-note-patch-v0` profile. It returns the complete guarded exact
source that the proposal tool accepts. Start the fresh agent's server with
`GHOSTNOTE_TOOL_PROFILE=phase-7b-agent-note-patch-v0`.

The live inventory was read-only. It confirmed two existing affected clips in
`26.36-4 orangebeat`: row 0 on each `Deep House Kit` track has an offset loop.
No duplicate was made because the reachability decision must come first.

The current direction is recorded in
[the consolidated compact-bar design](../format/CONSOLIDATED_COMPACT_BAR.md).
The next session runs the independent hybrid consolidation trial. It uses the
new acquisition tool before and after the visible consolidation action.

## Retrospective

One semantic range check is sufficient offline. E131 now names the acquisition
tool and experimental profile. Verify that a fresh agent follows the refusal
without bypassing the visible consolidation seam.
