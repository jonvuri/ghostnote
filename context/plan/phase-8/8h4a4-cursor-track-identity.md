---
title: Phase 8h4a4 — Cursor track identity
kind: plan
state: done
status: Complete (E242). Cursor targets confirm by the track channelId. Rows other than 0 of a collapsed child still refuse.
updated: 2026-10-07
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4a3-expand-parent-acceptance.md
next: 8h4a5-collapsed-cursor-and-parameter-settle.md
evidence: E240, E241, E242; D33, D34
---

# Phase 8h4a4 — Cursor track identity

**Result (E242).** The adapter confirms each cursor target by the track
`channelId`. Clip, launch, play, and metadata reads, the write stage
confirmation, the note observer arm, and device targets work on tracks inside
and after a group. Rows other than 0 of a child of a collapsed group still
refuse (fail-closed). A same-type device on two tracks does not settle its
DirectParameter inventory (not group related).

## Why

E240 found that `pointAtClip` compared `cursor.status.trackPosition` with the
flat bank index. The position counts sibling tracks only, so every
cursor-pointed address failed on a track inside or after a group. 8h4c writes
through `batch.run`, whose stage confirmation uses `pointAtClip`.

## Work

1. Add `trackChannelId` to `cursor.status` and `cursor.playState`, and the
   build marker `cursorIdentity: cursor-channel-id-v1`.
2. Confirm by `channelId` at each `trackPosition` comparison in `adapter.ts`
   and in the note observer arm. Check the `batch.run` guard.
3. Unit tests for a group child with a bank index that differs from its
   position.
4. Live: an owned project with a track before, inside, and after a group,
   expanded and collapsed; the anchor, read only.

## Acceptance criteria

- Cursor-pointed reads and writes resolve on tracks inside and after an
  expanded group, and after a collapsed group.
- A target that the cursor cannot reach refuses; no write goes to a wrong
  clip.
- The method count and hash do not change; hello checks the marker.
- Brain check, extension check, wire goldens, the retained offline verifier,
  context check, and `git diff --check` pass. The anchor matches its
  baseline; the owned project closes without saving.
