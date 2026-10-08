---
title: E249 — Clip metadata ownership and colour tolerance
kind: evidence
state: done
updated: 2026-10-08
owner: phase-8i0
---

# E249 — Clip metadata ownership and colour tolerance

## Status

[8i0](../../plan/phase-8/8i0-clip-metadata-and-colour-tolerance.md) is
complete. A clip property write now sets only the changed fields and their
marker dependencies. Any RGB byte triple is accepted. A written colour is
verified within one byte for each component
([D42](../../decisions/d42-clip-colour-tolerance-and-metadata-ownership.md)).
A rename or a length edit of a clip with an off-palette colour needs no
palette change. Tool descriptions are `ghostnote-description-v34`.

## Cause

In the first 8i dogfood trial, the copy of IcyShellStab01 kept a colour
outside the E83 table. The first extension preview refused with
`unsupported`, reason `clip-colour`. The cause was the E83 rule: a property
write sent the complete metadata, colour included. The prior colour had to
be in the palette so that reversal could restore it exactly. The colour was
not part of the musical change.

## Implementation

- `clip.update` keeps the complete candidate and has an optional `fields`
  list. `changedClipMetadataFields` adds the marker dependencies: a length or
  loop-start change also owns loop end and play start, and a loop-start
  change also writes the length (E43). A name-only, colour-only, or
  loop-state-only change owns no marker. Contract validation refuses a list
  without its dependencies. A missing list writes every field. The clip
  restore after deletion and `stable-v1` use that form.
- The encoder sends one `cursor.setClipMetadata` frame. It has `fields` and
  only the values of those fields. Loop end has no setter. The extension
  validates all values, then calls the setters in the E43 order. Build
  marker: `rig.info.clipMetadataWrite: owned-fields-v1`. The method table
  does not change: 89 methods, `0ef817f4bac8a8a7`.
- Colour encoding: a table colour sends its measured wire bytes. Any other
  colour sends its own bytes. There is no retry.
- Executor: the palette guard is removed. The readback compares only the
  owned fields; a written colour passes within one byte. Repeated updates of
  one clip in one batch merge into one request: each owned field has the
  value of its last writer.
- Write set and reversal: the metadata target carries the owned fields (the
  union over the batch; a complete write owns all fields). The boundary
  compares only the owned fields, with observed values and exactly. The
  reversal writes only those fields from the recorded prior state. A later
  change to an unowned field stays. A later change to an owned field still
  blocks the reversal.
- Reversal in order: when our later change restored exactly the colour that
  this change left, and the host stored it within one byte, the boundary
  accepts the difference. The current value must equal that later readback
  exactly, so a person's one-byte change still blocks.
- The fake adapter writes only the owned fields, and stores an off-table
  colour with blue one lower (E83). `stable-v1` keeps its tool-level palette
  refusals and its complete writes.

## Live colour sample

`phase8i0-metadata.ts colour` in the owned project "New 2". It requested 38
triples through `set_launcher_clip_properties`: the default colour of a new
clip, endpoints, single-channel extremes, the E83 cases, and a stride across
the byte range
([colour.json](../data/phase8i0-metadata/colour.json)).

- 32 of 38 read back within one byte (9 exactly). `[145,105,78]` read back
  `[145,105,77]`, as in E83. `[255,255,255]` read back `[255,254,254]`.
- **Finding: Bitwig raises a dark colour to a minimum lightness.** The six
  other samples all had CIE L* below 33, and each read back lighter:
  `[0,0,0]` → `[81,81,81]` (L* 34.5), `[11,11,174]` → `[19,19,235]`,
  `[5,17,200]` → `[7,22,236]`, `[122,28,77]` → `[138,33,88]`,
  `[116,34,103]` → `[128,39,114]`, `[88,62,139]` → `[89,63,141]`. Their
  readback L* was 30.9–34.5. Every sample at L* 35 or more was within one
  byte. The tool reports these with `readback.status: differs` and
  `readback.clips[].differences`, and the description states it. The
  tolerance does not hide them.
- No dark colour can be the prior colour of a clip, because the host never
  stores one. Reversal therefore restores only colours that the host made.

## Live cost

`phase8i0-metadata.ts measure`, 3 runs on the E231 typical clip (256 notes),
from the off-palette colour `[145,105,78]`
([measure.json](../data/phase8i0-metadata/measure.json)). Medians, with each
wire sequence in the file:

| Call | Wall | Turns | Cold reads | Stages | Setters in the frame |
|---|---|---|---|---|---|
| Name only | 1,434 ms | 36 | 3 | 1 | `name` |
| Length only | 1,423 ms | 36 | 3 | 1 | `lengthBeats`, `playStartBeats` |
| Colour only | 1,436 ms | 36 | 3 | 1 | `color` |
| Revert the colour | 1,414 ms | 35 | 3 | 1 | `color` |
| Copy to an empty slot | 888 ms | 22 | 1 | 1 | — |
| Read the copy | 422 ms | 10 | 1 | 0 | — |
| Extend 64 → 128 beats and insert 153 notes | 1,760 ms | 43 | 3 | 1 | `lengthBeats`, `playStartBeats` |
| Revert that edit | 2,082 ms | 45 | 3 | 1 | `lengthBeats`, `playStartBeats` |

- The cost model held. `set_launcher_clip_properties` was 1,447 ms in E247
  and is 1,414–1,436 ms now; no turn, read, or stage was added. The
  extension with 153 inserts took 1,760 ms; the dogfood edit took 2,190 ms
  for the same insert count on another clip. The intended benefit is that no
  palette recovery is needed (about 34 s in the trial).
- The extension and its reversal wrote no colour. The copy colour
  (`[145,105,76]`) was the same after the edit and after the reversal.
- The colour reversal wrote the recorded prior `[145,105,77]`, and the host
  stored `[145,105,76]`. This one-byte loss of a restore write is the
  accepted D42 difference. It does not accumulate in one chain, because each
  reversal writes the recorded prior value and not a later readback.
- The driver added one track and deleted it. After the trial, "New 2" held
  Inst 1, Audio 2, and FX 1, and 8 scenes, as before.

## Verification

- Brain check 2,100/2,100 before the live run, and the focused suites after
  the description change. New tests: contract field dependencies and colour
  tolerance; encoder frames; write-set union; executor merge and colour
  disagreement; any RGB through the tool; invalid RGB refused before any
  write; an off-palette clip renamed, extended, and reversed; a later
  unowned edit preserved; an owned edit still blocks; reversal in order; a
  person's one-byte change stays visible; clip deletion restores all fields;
  the dogfood path through `edit_launcher_clip`.
- Extension tests and the wire goldens: unchanged (normal 89,
  `0ef817f4bac8a8a7`). `probe:hello` passed on a fresh build, with the 8i0
  marker. Archive SHA-256
  `598428673b4a0c12f4e4a05a29ceb081594a0f510608905486a3b27092cee9c6`.
- The call-budget tests do not change: no host call was added.

## Review fixes

An independent review found two P2 defects; tests reproduced both first.

- Repeated entries for one clip in one `set_launcher_clip_properties` call
  were each planned from the fresh read. `name: "temporary"` then the
  original name dropped the second entry as unchanged and left
  "temporary". Separate name and colour entries applied, but each was
  verified alone and reported `differs`. Now the entries for one clip apply
  in order through the same writer. The final state is diffed with the fresh
  read, and the write is one `clip.update` verified as one result
  (`readback.clips` has one entry for each clip).
- The in-order colour exception used the last metadata writer and compared
  the complete metadata. A rename by a person or by the agent after the
  second colour reversal blocked the first reversal. Now the exception finds
  the latest later changeset of ours that wrote the colour. It compares the
  colour with that changeset's request and readback, and the other owned
  fields with this changeset's readback. Unowned fields are not compared.
- These fixes are in the brain only. The single-entry wire path and the live
  measurements do not change; no live rerun. Brain check 2,102/2,102.

## Retrospective

A colour sample must include dark colours. Test a batch with two entries for
one target, and an exception rule with an unrelated later change in between. The plan assumed only the E83
byte conversion; the live sample found the lightness floor. The ownership
model kept that finding out of every musical edit.
