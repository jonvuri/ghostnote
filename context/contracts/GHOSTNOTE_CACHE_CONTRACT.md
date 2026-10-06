---
title: Ghostnote pull snapshot contract
kind: reference
state: active
updated: 2026-10-06
parent: ../plan/phase-8/8h3e-cache-machinery-trim.md
evidence: E214-E233; D23, D30-D32
---

# Ghostnote pull snapshot contract

## Scope

This contract replaces the 8f3 internal cache contract. Ghostnote keeps no
resident note grid. Every read, preflight, and verification reads the clip
again through the 8h3c cold reader
([D30](../decisions/d30-replay-batch-and-start-signal-are-named-assumptions.md),
[D31](../decisions/d31-mutation-and-reversal-use-the-d23-cell-boundary.md)).
An agent works on a snapshot of one launcher clip and sends a patch against
it. A snapshot reference names the clip that the snapshot came from. Ghostnote
tells at use time if the snapshot is still current
([D32](../decisions/d32-pull-snapshot-references-use-the-revision-mark.md)).

The implementation is `brain/src/contract/clip-snapshot.ts` and
`brain/src/engine/clip-snapshots.ts`. Only the experimental tool profile
exposes it. [E233](../evidence/experiments/e233-pull-snapshot-references.md)
has the live results.

## The reference

A reference (`ghostnote-clip-snapshot/1`) holds:

- the complete `RevisionMark` of the read: `revision`, `generation`, `project`,
  `sceneEpoch`, `contentEpoch`, and `window`. The content delta needs the full
  mark at both ends, and the coverage test reads `window` at both;
- the durable address: track `channelId` and launcher row; and
- one `ghostnote-launcher-source/1` digest.

Agents receive it as an opaque token. Ghostnote validates every field on input
and refuses another shape. A reference is not a host clip ID. A durable track
ID is not a durable clip ID.

## The fingerprint

`ghostnote-launcher-source/1` is SHA-256 over the domain name, LF, and R26
canonical JSON of one object:

- `clipMetadata`: the complete raw `cursor.clipMetadata` reply;
- `clipRead`: the `clip.read` bound extent (`loopStartBeats`, `loopEndBeats`,
  `playStopBeats`) without `channelId` and `row`; and
- `notes`: every raw field of every note, in channel, cell, and pitch order,
  with disabled controls and raw binary64 values.

Read IDs, timings, and callback counts are not input. The adapter computes the
digest in the same read as the note entries (`read(addresses, { sources })`).
The live and the fake adapter use one shared function. The mark and the address
are typed fields beside the digest, so each refusal has its own reason. This
digest is not the R27 document hash, the `exact-note-source-v0` digest, or the
E231 research `pull-fp-v1`. Do not compare digests across domains.

## The verdict

One function compares a reference with a fresh read of its address on all 16
channels. The adapter reads each clip once for all channels. The delta comes
from the existing `contentDelta`, `deltaComplete`, and `contentTouching`. It
is taken after the read, so an event during the read refuses. The delta has no
scene fields, so the scene guard is checked against the read mark and again
against a mark taken after the read and the delta. A compaction during the read
can slide another clip into the row with no event for the slot; only the
post-read mark sees it. The first row that matches gives the verdict:

| Verdict | Condition | Result |
|---|---|---|
| `incomparable` | Generation differs (reload), or a project is empty or differs | Refuse. Read again |
| `uncovered` | The track or scene bank does not cover the project at either mark, or the address is outside the bank | Refuse. Name `tracks`, `scenes`, or `both`. No snapshot |
| `identity-changed` | Scene epoch or scene count changed; the delta is truncated or has an unattributable event; or an event names the slot | Refuse. Resolve the address again. No snapshot |
| `absent` | The track does not resolve (`unknown-track`), or the slot has no clip (`absent-clip`) | Refuse |
| `stale` | All guards pass; the fingerprint differs | Return the new snapshot. Never apply |
| `current` | All guards pass; the fingerprint is equal | Apply against the snapshot |

`current` states content equality at the same address in one identity domain.
It does not prove the same host clip object (E224).

## Lifetime

A reference has no time limit while its content delta is complete. The
extension ring holds 24 launcher events. When the interval since the mark has
more events than the ring holds, the delta is truncated and the reference
refuses. A project with many occupied slots therefore loses its references on
any project switch.

## Project detours

A P→Q→P detour has no special rule. It is `current` only when the scene guard
is unchanged and the delta since the mark is complete and has no event for the
target slot. A scene-count change in either direction moves the scene epoch. A
detour that no guard records cannot be distinguished from no detour; then equal
content at the address is the valid base. E233 measured three live detours;
each overflowed the ring and refused.

## Use at a write

`RunOptions.ifSnapshot` takes a list of references. The executor stash read
covers each referenced clip in the same adapter read as the write set. Any
verdict other than `current` throws `ClipSnapshotRefusedError` with every
verdict, before the fidelity labels, the floor, and any host mutation. Only a
`stale` verdict carries a new snapshot. A scene change after the post-read
mark and before the apply is not checked: the adapters check the scene epoch
at resolve and read, not at apply. This window exists for every executor
write. `ifRevision` stays; it counts only
Ghostnote writes.

The experimental agent-proposal `apply` checks a supplied reference before its
other guards and returns the verdicts on refusal. It then passes the reference
to the executor, which checks it again at the stash read.

## The survey

`check_clip_snapshots` gives one verdict for each reference, in input order,
and a new snapshot only for a stale clip. It reads all clips in one adapter
read. E233: 16 typical clips take about 8.8 s; each clip needs one cursor point
for its metadata.

## Limits

| Limit | Value | Over the limit |
|---|---:|---|
| Reader width | 4,194,304 steps (8,192 beats at `1/512`) | `clip-beyond-reader-width` refusal |
| Read deadline | 2 s | The read refuses; no partial notes |
| Note page | 131,072 notes | Further pages through `clip.readPage` |
| Event ring | 24 launcher events | The delta is truncated; references refuse |

The D23 collision boundary applies: one note identity is `(channel, pitch,
occupied 1/512 cell)`. A delete and reinsert of equal values at one cell
between two reads is not visible.

## Historical: the resident grid

8g and 8h1 measured a resident note cache: sparse storage and reconciliation,
health states and eligibility predicates, populated canaries, binding and
rebuild generations, admission, eviction, and combined storage limits. That
work is in [E214](../evidence/experiments/e214-shadow-cache-content-and-lifecycle-gates.md)–[E226](../evidence/experiments/e226-sounding-cell-cost-reduction.md).
E227 showed that a cold read takes 46–698 ms, so a resident grid gives no speed
benefit. 8h3e removed its code (E233). None of those rules is a live rule. The
historical text is in this file's history before 8h3e.

## Retrospective

Before a plan promotes a mechanism, check the product code for an equal
mechanism. The product `RevisionMark` already covered the pull identity case.
