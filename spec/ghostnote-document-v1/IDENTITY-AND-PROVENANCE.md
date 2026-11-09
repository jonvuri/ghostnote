---
title: Ghostnote clip and event identity and stored provenance
kind: reference
state: active
updated: 2026-11-08
owner: phase-8f3
---

# Identity and provenance

This is the identity and stored-envelope contract for the
[host binding](HOST-BINDING.md). It uses the same event IDs as the portable
core. It does not add host UUIDs to [Document 1.0](SPEC.md). The
[pull snapshot contract](../../context/contracts/GHOSTNOTE_CACHE_CONTRACT.md)
and [D32](../../context/decisions/d32-pull-snapshot-references-use-the-revision-mark.md)
define the clip reference and its verdict. The
[cache lifecycle evidence](../../context/evidence/format/CACHE_IDENTITY_AND_LIFECYCLE.md)
is historical measurement.

## Clip identity

Mint an opaque document clip ID for one read. Bind it privately to one D32
snapshot reference: the revision mark, the address (track `channelId` and
launcher row), and the source digest. A durable track ID is not a durable clip
ID. Display names, slot indices, and content equality cannot resolve a clip.
Two equal clips have different IDs. A duplicate always gets a new ID.

Retain an ID while its reference checks as `current`, and across a `stale`
verdict at the same address: note and metadata edits keep the clip. Retire it
when the verdict is `identity-changed`, `absent`, `incomparable`, or
`uncovered`. D32 has no move proof. A clip that a person moves, duplicates, or
replaces always gets a new ID, also when its content is equal. A verified
move by the binding's own move tool is the proof D32 lacks: the first read at
the destination keeps the clip ID and every event ID when the document there
equals the document last read at the source, in the same project and scene
layout ([D74](../../context/decisions/d74-ghostnote-moves-keep-clip-identity.md)).
A copy is a new clip with new IDs. A scene insertion or deletion
changes the scene guard and retires every reference in the project. Track index
changes resolve through `channelId`. A stale base is never repaired by editing
its address alone.

Save keeps the identity domain. A detected project change or controller reload
(`incomparable`) retires refs, proposals, event maps, and stored envelopes. A P→Q→P detour is detected only when a guard records it: a scene-count
change, a target-slot event, or an incomplete content delta. Then the verdict is
`identity-changed`. A detour that no guard records cannot be detected; the D32
verdict is the only protection, and equal content at the address is the valid
base. A matching project title, file path, byte hash, or fingerprint does not
prove continuity. A document file can re-attach its provenance to a new ref
with an explicit `clipUpdate`; it cannot restore write authority.

## Registry lifetime and bound

The identity registry is private and in process memory only. It is not
persisted: a restart of the Ghostnote server retires every base ref, clip ID,
and event map. It holds at most 256 live base refs. When it is full, the least
recently used ref retires. A ref that the registry does not hold, because it
retired by this bound or came from an earlier process, refuses with
`expired-ref`. A malformed ref refuses with `invalid-ref`. A project or
generation change retires every ref of the earlier domain; a scene layout
change retires every ref of the project. The registry keeps a bounded record
of retired refs, so a check can report the verdict that retired a ref.
The implementation is `brain/src/bindings/identity-registry.ts` (8h4b, E235).
Each entry also stores the META, EXTENSIONS, and clip provenance of its
document (8h4c, D73). A kept clip ID carries them unchanged (see below); a
restart loses them with the refs.

## Event identity and recovery

One acquired event is one `(document clip, host channel, pitch, 1/512 cell)`.
Mint an opaque ID that is unique in the document. Maintain a private ID-to-cell
map in the binding registry. Do not mint the ID from pitch/time alone across
clips or identity domains. Do not use the old positional `e-N` alias as a persistent
live ID. D23 does not expose multiple source IDs in a collided cell.

| Transition | Event ID rule | Evidence needed |
|---|---|---|
| Fresh repeated read | Retain an unchanged acquired cell ID | `current` or `stale` D32 verdict with a complete delta; complete acquisition |
| Human velocity, mute, duration, or expression edit | Retain the cell ID | Address membership remains the same; fresh field read |
| Human pitch, channel, or onset edit | Retire old ID and mint at new cell | No host note UUID or proved note-move event; equal musical values do not recover identity |
| Human deletion and later insertion | Retire and mint | An empty cell or an incomplete delta breaks the association |
| Authorized portable update that changes address | Retain proposal event ID after verified application | Original ID map, exact before guard, collision-free plan, and independent after readback |
| Authorized add/remove | Mint supplied new ID / retire removed ID | IDs valid and unique; fresh occupancy and expected-state checks |
| Reconstruct unchanged retained events | Retain only from the authorized plan | Complete protected before state and independent final mapping; partial effects do not prove missing IDs survived |
| Clip move by the binding | Retain every event ID and the clip ID at the first read of the destination | The binding's verified move; the destination document equals the source document last read, with the same cells, project, and scene layout (D74) |
| Clip derived by the binding from a source clip | Keep the source event ID of each kept note; the new clip gets a new clip ID | The binding's read of the source (current against a patch BASE) and the verified add (D75) |
| Clip move by a person | Mint all events | D32 has no move proof; the new address needs a new read |
| Clip duplication/replacement | Mint all events | A separate document clip ID even when notes match |
| Reload, project change, or ambiguity | Retire; mint after fresh acquisition | `incomparable` or `identity-changed` verdict, or no unique proof; no similarity matching |

Continuity in this table means a `current` or `stale` D32 verdict with a
complete delta. Within it, an ID names the acquired cell identity. It cannot
prove that a human did not replace one hidden source note with another at the
same cell. Pull has no cell-level callback window: a human delete and reinsert
of equal values at one cell between two reads is not visible. Report this D23
identity boundary. An incomplete delta invalidates the continuity claim.
Do not pick the nearest pitch/time or first equal note.
Conflicted proposals require a new read and new proposal.

A controlled update may preserve its event ID while its host address changes.
That is document intent backed by the guarded operation, not recovery from a
human edit. Compare retained IDs against the verified candidate before binding
the stored envelope. An independent readback must acquire its own values; the candidate
supplies only the expected identity mapping and comparison target.

## Stored envelope and provenance

Host clips store no META, EXTENSIONS, or clip provenance
([R33](SPEC.md#r33--clip-provenance)). The registry entry of each ref keeps
them as one stored envelope. They are inert: they grant no host authority, and
provenance is a pointer to source files, not a claim about the notes. Document
1.0 has no overlays
([D73](../../context/decisions/d73-overlays-removed-for-clip-provenance-and-column-defaults.md));
analysis of the notes is recomputed, not stored.

| Transition | Stored envelope |
|---|---|
| `current` verdict | Kept with the ref |
| `stale` verdict (a human note or metadata edit) | Carried to the new ref unchanged. Provenance does not go stale: the notes still derive from the named source |
| Verified write | The expected document's envelope, bound to the new ref; `readback.held` names provenance |
| `identity-changed`, `absent`, `incomparable`, `uncovered`, eviction, restart | Dropped with the ref; a new acquisition has none |
| Copy or move by the binding | Carried to the first read of the destination when its document equals the source document last read (D74); a move keeps the clip ID |
| Clip derived by the binding from a source clip | The source envelope, written with the new clip; a provenance source range that spans the source clip narrows to the slice (D75) |
| A person's move, duplication, or replacement; a project save-as | None on the new ID; the agent re-attaches provenance with `clipUpdate` |

A patch keeps the stored provenance unless its `clipUpdate` sets or clears it.
A desired replacement supplies the complete provenance. A provenance change
writes nothing to the host. The binding never matches provenance to another
clip by similarity.

## Verification and handoff

The binding corpus tests cell mapping, normalized loss, property coverage,
default and preservation differences, conflicts, and capability refusals. The
R33 conformance cases test provenance identity and updates. These are pure
evidence, not proof of live recovery.

8h3e tested the D32 clip verdicts against independent raw reads (E233). 8h4
must test controlled event remapping, human-edit reminting, partial effects,
and stored-envelope carry against independent reads. 8i must include a fresh
proposal after computer use and ambiguity refusal. The
[migration policy](../../context/contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md)
sets owners and rollback gates. No new host behavior was inferred from an ID.
