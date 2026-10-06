---
title: Ghostnote Document 1.0 host handoff
kind: reference
state: active
updated: 2026-10-01
---

# Host handoff

8f1 settles the portable language in [SPEC.md](SPEC.md) and [FIELDS.md](FIELDS.md).
[8f2](../../context/plan/phase-8/8f2-reference-codec-and-model-format-reference.md) owns
the pure codec and the case inventory. [8f3](../../context/plan/phase-8/8f3-ghostnote-bindings-and-cache-contracts.md)
owns the following rules. None blocks the pure codec. None is a new live
capability claim.

| Host question | Fixed portable input | Required 8f3 result |
|---|---|---|
| Field coverage and insertion defaults | Every optional property has a portable default; snapshots can declare unknown fields | Map each property to observable/writable/preserved/unavailable. Measure or cite defaults. Refuse unsupported reconstruction. Do not equate unknown with zero. |
| Channel numbering | Portable MIDI channels are 1..16 | Map to the host's channel convention and all-channel acquisition. |
| Expression and release velocity | Scalar values, pressure retained, full expression updates | Map units, ranges, tolerance, and gain inverse. Resolve pressure preservation for targeted edits and refusal for replay. Do not discard represented values. |
| Articulation and playback controls | Opaque articulation/occurrence labels, chance, recurrence mask, and repeat controls | Define supported host labels and ranges. Map repeat count/control meaning. Refuse unmappable values. The codec does not simulate playback. |
| Duration and overlap | Nearest duration, ties up, one-cell minimum; onset floor; no shortening | Bind D9 host writes and readback to R07. Account for source `2^-20` duration quantization. Declare adjacency/overlap changes and refusals. Amend a decision before changing existing D21 behavior. |
| Cell identity | Unique clip/channel/pitch/onset cell; explicit import collisions refuse | Map D23 scans, unknown host survivor, event ID minting, moves, edits, restarts, and ambiguity. Exact-source loss and codec loss remain separate. |
| Clip metadata and coordinates | Length/name/loop/play range in stored quarter-note beats | Map launcher scope, coordinate access, loop declarations, and played-range limits. A portable clip inventory is not permission to create/remove host containers. |
| Guards and partial bases | Portable content digest; pure apply requires full represented base | Define exact-source/content hash projection and guarded application from partial observations. Preserve unnamed host fields with fresh authority; refuse when reconstruction cannot preserve them. |
| Overlay live lifecycle | Field/membership dependencies, digest basis, explicit stale/removal/revision | Map generation and identity loss to portable invalidation. Do not retain a current claim only because IDs were retained. Acquired-only timing uses unknown-source residuals. |
| Freshness and verification | Desired state is a proposal; no host code in syntax | Name public Launcher read scope, conflict rules, risk tier, independent normalized readback, reversal protection, and cleanup fixtures. |
| Cache and migration | Cache limits are outside R28 parser bounds | Hand 8g cache contracts; hand 8h migration/rollback and public I/O binding; retain frozen benchmark forms and retire/migrate experimental forms explicitly. |

R07's rounding is a language choice under D23 and D25. It is not a change to
the current low-level writer. Complete desired state names all portable values.
A host that cannot apply them must preserve them through supported edits or
refuse. A partial snapshot remains useful model context; a host binding must
not treat its omissions as a complete replacement.

## 8f3 resolution

[Host field bindings](HOST-BINDING.md), [identity and overlays](IDENTITY-AND-OVERLAYS.md),
and the [binding corpus](bindings/v1/README.md) now settle these target rules.
`read_launcher_clip` addresses one Launcher clip. Raw acquisition must retain
disabled properties. Timbre maps host -1..1 to portable 0..1; gain keeps its
measured inverse. Recurrence writes stop at eight cycles. Articulation and
portable repeat remain uncovered on host-only reads. Repeat has no proved
semantic converter. Pressure remains unwritable.

A sparse edit preserves unnamed state; a desired document supplies defaults.
Partial bases need a retained guard, fresh equivalent projection, full resolved
state, explicit declarations for unknown fields, and proved host preservation.
The pure fixtures check this boundary. They do not implement a live resolver.

The [cache contract](../../context/contracts/GHOSTNOTE_CACHE_CONTRACT.md) gave
8g its state machine, limits, and shadow cases. 8h3e replaced it with the pull
snapshot contract (D32). The
[migration and risk policy](../../context/contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md)
gives 8h its decision gates and rollback. 8i tests fresh agent use; 9b reviews
publication candidates. Host integration remains unbuilt. Existing runtime,
checkpoint fidelity, and frozen benchmark forms are unchanged.

## Benchmark conventions retained and changed

Retain declared positional fields, one event identity set, exact rational
spelling, sparse model proposals, and an equivalent JSON form. Replace the
six-field benchmark omission policy with explicit channel, mute, release,
articulation, expression, and playback-control decisions. Replace implicit
track context with clip references and coverage. Add empty documents,
version/extension refusal, and dependency-aware overlays.

The old groove equation lacked acquisition displacement. R15 now separates
onset and duration displacement from intentional components. R16 gives
cell-only observations an explicit unresolved mode. This prevents a triplet's
floor error from becoming a claimed local or template deviation.

## Retrospective

Use one field/default table and one rule-to-case index before writing the
codec. Check onset and duration deltas separately; their denominators can
differ even for the same triplet event. No additional instruction change is
needed for 8f2.
