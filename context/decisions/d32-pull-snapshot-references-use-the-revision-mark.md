---
id: D32
kind: decision
state: active
updated: 2026-10-06
source: phase-8h3e
---

# D32 — Pull snapshot references use the revision mark

8h3e replaces the resident-grid identity model with pull snapshot references.
Every use reads the clip again through the 8h3c cold reader
([D31](d31-mutation-and-reversal-use-the-d23-cell-boundary.md)). There is no
resident grid. [E233](../evidence/experiments/e233-pull-snapshot-references.md)
has the results.

## Identity

A snapshot reference (`ghostnote-clip-snapshot/1`) holds three typed fields:

1. the complete product `RevisionMark` of the read: `revision`, `generation`,
   `project`, `sceneEpoch`, `contentEpoch`, and `window`;
2. the durable address: track `channelId` and launcher row; and
3. one `ghostnote-launcher-source/1` content fingerprint.

The 8g binding, rebuild, and content generations, the canary, and replay
settlement are retired from the contract. The logical clip reference of 8g is
also retired. The extension-owned epochs and the per-slot content delta
already cover the pull case. The reference is opaque to agents. Ghostnote
validates its complete shape on input.

## Fingerprint

`ghostnote-launcher-source/1` is SHA-256 over the domain name, LF, and R26
canonical JSON of the complete raw `cursor.clipMetadata` reply, the
`clip.read` bound extent without its address fields, and every raw note field.
Notes are in channel, cell, and pitch order. Disabled controls and raw binary64
values are included. Read IDs, timings, and callback counts are excluded. The
live and the fake adapter compute it from the same product read with one shared
function. The mark and the address are not digest input: a typed comparison
gives each refusal its own reason. `pull-fp-v1` stays the E231 research name.

## Verdict

One function compares a reference with a fresh read of its address. It uses
the existing `contentDelta`, `deltaComplete`, and `contentTouching`. The first
row that matches gives the verdict:

| Verdict | Condition | Result |
|---|---|---|
| `incomparable` | Generation differs, or a project is empty or differs | Refuse. Read again |
| `uncovered` | The track or scene bank does not cover the project at either mark | Refuse. Name the dimension. No snapshot |
| `identity-changed` | Scene epoch or scene count changed; the delta is truncated or has an unattributable event; or an event names the slot | Refuse. Resolve the address again. No snapshot |
| `absent` | The track does not resolve, or the slot has no clip | Refuse |
| `stale` | Guards pass; fingerprint differs | Return the new snapshot. Never apply |
| `current` | Guards pass; fingerprint is equal | Apply against the snapshot |

The scene guard compares the scene epoch and the scene count, at the read mark
and at a mark taken after the read. The content delta has no scene fields, so
only the post-read mark sees a scene change during the read. The epoch counts
scene-count callbacks across projects, so it also records a change that a later
change reverses.

A reference has no time limit while its delta is complete. When the extension
ring no longer holds the interval since the mark, the delta is truncated and
the reference refuses.

`current` states content equality at the same address in one identity domain.
It does not prove the same host clip object (E224). A delete and recreate of
equal content between two reads is visible only through its slot events.

## Project detours

A P→Q→P detour has no special rule. It is `current` only when the scene guard
is unchanged and the content delta since the mark is complete and has no event
for the target slot. A detour that changes the scene count, delivers a target
slot event, or overflows the ring gives `identity-changed`. A detour that no
guard records cannot be distinguished from no detour. Then equal content at
the address is the valid base. In E233 every live detour delivered more launcher
events than the ring holds and refused.

## Exposure

The stable tool profile and the normal wire do not change. The experimental
profile `phase-7b-agent-note-patch-v0` returns a reference from
`acquire_clip_note_source`, checks it in agent-proposal `apply`, and adds the
`check_clip_snapshots` survey. The executor option `ifSnapshot` reads each
referenced clip in its stash read and refuses before labels, the fidelity
floor, and any host mutation. 8h4 owns the compact-bar document tools and the
stable surface.

## Trim

The resident-grid research code is removed from source: the shadow cache,
handle pool, authority fallback, inventory rebuild, topology, group, and scene
controls, the slot and step delta windows, the sounding probe and budget, the
scale, root identity, observer reuse, and delivery coherence probes, the shadow
archive, and their tests, Gradle tasks, wire methods, and rig keys. The 8h3d
`ChangeWatchProbe` and the 8h1a fixture writer remain research. Topology,
group inventory, and slot inventory are not promoted; the product inventory
stays flat. Group-slot handling (E222) is an 8h4 and 8i input.

## 8h4a guards

[E234](../evidence/experiments/e234-write-boundary-and-reader-hardening.md)
adds three guards. They do not change a verdict row or the reference shape.

- **Scene guard at the apply.** The scene guard is now checked at the read
  mark, at the post-read mark, and at the apply. `batch.run` takes optional
  `expectedGeneration`, `expectedProject`, and `expectedSceneEpoch`. The
  executor sends the stash mark with every batch that names a launcher row. A
  mismatch runs no operation and maps to `StaleAddressError`. This is not a
  host fence: the guard reads the last scene count that the host delivered.
- **Metadata block.** The `clip.read` reply holds the metadata block, made by
  the same extension function as `cursor.clipMetadata`. The two are
  byte-equal in canonical JSON on every measured shape, so the fingerprint
  domain stays `ghostnote-launcher-source/1`, and old references stay valid.
- **Group slots.** A read, write, snapshot, or check on a group track's own
  slot refuses with `group-slot` (`GroupSlotError`), before any host call.
  The product bank lists the children of a collapsed group
  ([D33](d33-the-product-track-bank-lists-all-channels.md)); a read of a row
  other than 0 on a collapsed child refuses (E221).
