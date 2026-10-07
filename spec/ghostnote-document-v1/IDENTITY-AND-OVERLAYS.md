---
title: Ghostnote clip, event, and overlay identity
kind: reference
state: active
updated: 2026-10-07
owner: phase-8f3
---

# Identity and overlays

This is the identity and annotation contract for the
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
`uncovered`. D32 has no move proof. A moved, duplicated, or replaced clip always
gets a new ID, also when its content is equal. A scene insertion or deletion
changes the scene guard and retires every reference in the project. Track index
changes resolve through `channelId`. A stale base is never repaired by editing
its address alone.

Save keeps the identity domain. A detected project change or controller reload
(`incomparable`) retires refs, proposals, event maps, and overlay attachment
rights. A P→Q→P detour is detected only when a guard records it: a scene-count
change, a target-slot event, or an incomplete content delta. Then the verdict is
`identity-changed`. A detour that no guard records cannot be detected; the D32
verdict is the only protection, and equal content at the address is the valid
base. A matching project title, file path, byte hash, or fingerprint does not
prove continuity. Persisted musical declarations can be imported as new
declared data with new refs; they cannot restore write authority or current
inferred claims.

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
Each entry also stores the overlays, META, and EXTENSIONS of its document
(8h4c). A kept clip ID carries them with the lifecycle rules below
(`overlay-carry.ts`); a restart loses them with the refs.

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
| Clip move | Mint all events | D32 has no move proof; the new address needs a new read |
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
human edit. Compare retained IDs against the verified candidate before attaching
annotations. An independent readback must acquire its own values; the candidate
supplies only the expected identity mapping and comparison target.

## Annotation storage and authority

Host notes do not store portable overlays. Keep their full envelopes in a
separate binding annotation store. Key attachments by the D32 reference of the
read. Store the source digest, dependency projection, provider or rule
name/version/settings, and provenance with each observation. The digest
replaces the earlier source and content generations. Only musical dependencies
and provenance cross into portable overlays. Internal digests do not go into
`data` or an inert executable extension.

`provenance.source` identifies the author, measurement source, or provider and
its version. `method` identifies the rule and settings or a settings digest.
A measured claim uses observations or deterministic arithmetic. A declared
claim states intent. An inferred claim names its provider/rule and uncertainty.
Agent prose and a late onset do not prove measured intent. Missing provider
results leave core observations available and report the missing claim.

All current claims carry the R22 `basis`. Declare each field actually used,
including tempo overlay dependencies when the method uses milliseconds or BPM.
The reference is an attachment guard; the content dependency projection is
the currency test. A new raw revision with unchanged declared dependencies
can preserve an overlay. A stable ID with changed dependencies cannot.

## Mapping accepted interpretations

| Existing meaning | Document 1.0 rule |
|---|---|
| Nominal position/duration/subdivision | One nominal overlay per event; exact rational values and R13 dependencies |
| Groove reference phase/template/cross/local | Groove components and explicit declared/inferred provenance; R14-R16 equations |
| Source normalization | Separate `atDelta` and `durationDelta`; never a phase/template/local cause |
| Exact permitted source timing | Known-source pair only if R07 reproduces the normalized core and both deltas |
| Cell-only or unrecoverable source timing | Null deltas, unresolved intent, zero intentional components, residuals core minus nominal |
| Harmony/key analysis | Harmony overlay with explicit members, clip length/membership, member fields, provider/rule identity and uncertainty |
| Musical role or motif | Role/motif overlay with explicit members and dependencies; interpreted articulation stays in overlay data |
| Bar/meter context | Explicit meter overlay; no inferred 4/4 default |
| Project tempo context | Tempo overlay only for observed or declared local context. A transport tempo scalar does not prove an entire automation map |
| Named section | Region overlay with onset-based membership and span dependencies |

The frozen `groove-v0` equation did not separate acquisition displacement.
Retain it only when permitted source timing and declared components can satisfy
R15. Otherwise migrate to R16 residuals and keep intent unknown, or refuse an
incompatible declared claim. A known normalization delta is not recovered
source timing. Millisecond text is derived display, qualified by tempo at
nominal onset; it is not a serialized timing field.

## Lifecycle and patch behavior

Compare semantic dependency values with covered defaults expanded. Changes
outside the dependency projection preserve data, basis, provenance, and state.
Changed pitch/timing/membership/tempo or other declared dependencies make the
claim stale. Propagate staleness in dependency order. Keep the prior data and
basis. Do not reseal old data or make it current after undo.

A provider can recompute a claim through an explicit full `overlayPut` with
new data, matching basis, and method/provenance. A declared claim can be
explicitly reaffirmed. Retain its overlay ID when revising the same claim;
mint a new ID for a different claim. A put replaces the envelope, not selected
members. A remove removes only the claim and must never emit note operations.

For a model patch that deletes referenced events or overlays, require explicit
removal or replacement of every dependent reference. Reject dangling references
even in stale claims. Desired replacement removes omitted events/overlays and
runs the same lifecycle rules for retained envelopes. Its supplied current
claims must already have valid bases. See R21-R24 and the codec materializer.

For an unsolicited host deletion or identity loss, remove every overlay with
an unresolved reference and its transitive dependents from the returned document.
Keep their prior envelopes in private diagnostics and report removed IDs/reasons.
A stale flag cannot retain a dangling ID. Do not remap a claim to a similar
newly minted note. If references survive but dependencies changed, return the
claim as `stale` with its old basis. If the annotation store is unavailable,
return no claimed overlays and a wrapper warning; do not claim their prior
absence was observed in Bitwig. Core acquisition can remain complete.

Stale claims are prior context. They cannot supply current analysis, a write
instruction, or a tempo display. A read does not silently recompute them.
Return missing-provider and identity-recovery limits explicitly. The wrapper
can explain stale/removal reasons without adding unsupported overlay keys.

## Realizing a groove proposal

An overlay alone does not authorize note writes. The agent or operator must
explicitly request a realized-note edit, resolve intended components and source
rights, and identify the current base. A deliberate realization step computes
source timing, runs R07 once, reports both displacements and changed overlap,
then produces an ordinary core patch with explicit overlay revisions.

That patch must pass the host capability, freshness, collision, permission,
verification, and reversal rules. Off-grid core values refuse rather than
rounding during parse. Stale or unresolved intent cannot be treated as a groove
command. The fixed historical groove probe is not a general realization compiler;
8h must not expose it as one. Removing or revising a groove annotation without
an explicit core patch leaves all notes unchanged.

## Verification and handoff

The binding corpus tests cell mapping, normalized loss, property coverage,
default and preservation differences, conflicts, and capability refusals. The
existing R13-R24 conformance cases test nominal/groove equations, membership,
basis, stale propagation, deleted references, explicit replacement, and removal
without note changes. These are pure evidence, not proof of live recovery.

8h3e tested the D32 clip verdicts against independent raw reads (E233). 8h4
must test controlled event remapping, human-edit reminting, partial effects,
and annotation attachment against independent reads. 8i must include a stale interpretation,
a fresh proposal after computer use, and ambiguity refusal. The
[migration policy](../../context/contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md)
sets owners and rollback gates. No new host behavior was inferred from an ID.
