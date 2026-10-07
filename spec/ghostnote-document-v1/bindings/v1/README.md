---
title: Ghostnote binding corpus version 1
kind: reference
state: active
updated: 2026-10-07
---

# Binding corpus version 1

This generated corpus checks the [host binding](../../HOST-BINDING.md) contract.
It contains no live project data. It does not prove a new host capability.
The [manifest](manifest.json) pins the [fixture](fixtures.json) and case IDs.
The [pure checker](../../../../brain/src/bindings/ghostnote-document.ts) has no
host transport, cache, or public tool integration. The existing codec and D9
writer remain the controls for 8g and 8h.

The checker returns a capability assessment. It does not prove host route
protection, live freshness, or successful write and independent readback.

Run from `brain/`:

```sh
npm run document:bindings
```

| Cases | Contract checked |
|---|---|
| B01–B03 | All 16 channels, onset and duration deltas, disabled stored values, and unavailable fields |
| B04–B05 | Portable scalar defaults, measured gain inverse, and host capability refusals |
| B06 | Sparse preservation, complete desired defaults, and explicit reset |
| B07–B08 | Same-key overlap refusal, exact adjacency, and normalized cell collision refusal |
| B09–B11 | Partial-base refusal, guarded explicit resolution, and D32 snapshot verdict refusal |
| B12 | Separate D21 exact-source replay refusal |
| B13 | Proven ownership, one-to-one ID recovery, and ambiguity |
| B14 | Pressure preservation, reconstruction refusal, and reversal refusal |
| B15 | Gain cube law, raw zero as unity, and the silent raw write value (E245) |
| B16 | Neutral enabled chance, occurrence, and recurrence project to the portable default |
| B17 | A drawn host-default note has no non-default field; other release velocities stay exact |
| B18 | With raw replay (D36), reconstruction and removal keep raw repeat controls; pressure still refuses |

`projectRawClip` consumes supplied raw groups. It retains disabled controls and
does not infer values from the old decoder's omissions. Articulation and repeat
are absent and uncovered. Its coverage describes the supplied complete scan;
the helper does not acquire that scan. Clip metadata is supplied in portable
units. `d9MappedFields` maps supported scalar fields and applies the measured
gain inverse. Its output is not a complete insertion plan. Host repeat count
uses signed division or rate controls. It cannot map to a total trigger count
without a separate semantic converter.
Raw timbre uses the host range `-1..1`. Portable timbre uses `(raw+1)/2`.
The D9 scalar input uses `2*portable-1`. Raw gain is `cbrt(portable)`, and
portable 0 is raw `1e-323`; the shared encoder then writes `raw/2` once.
Portable gain 0..8 covers the host range. Transpose values outside `-96..96`
refuse writes. An enabled control with a neutral value projects to the
portable default; a disabled nondefault value stays.
8h must verify these boundary transforms through independent live readback.

The strict assessor requires a complete represented base. A partial resolver
also checks the original digest, binding reference, fresh projection, complete
projection, explicit declarations for unknown fields, and the caller's host
preservation proof. It reports the original and resolved document hashes beside
the source digest of the private authority. The authority is one D32 snapshot
reference. `guardAuthority` runs the D32 verdict on a supplied fresh read and
content delta and refuses every verdict other than `current`. The product
adapters compute the `ghostnote-launcher-source/1` digest (8h3e); 8h4 connects
this binding to them. Internal rebinding does
not change the original proposal. The proof flag is supplied fixture evidence;
8h must obtain real evidence from the guarded host path. The test supplies
articulation and repeat declarations. The helper never invents them.
This fixture resolver supports field-only partial coverage. It refuses partial
time ranges and partial channel coverage. 8h must implement and test broader
coverage projection before it accepts these cases.

Identity fixtures consume proposed matches and a separate ownership proof.
They do not discover moves from equal note content. Ambiguous or unproved
matches require new IDs. Nonzero pressure survives supported scalar edits.
Reconstruction and removal need fidelity that these fixtures do not claim.
The assessor refuses reconstruction and removal while the repeat converter
is unavailable. This is a conservative contract gate, not a change to the
current low-level writer or its reversal behavior.

The manifest hash, all case IDs, and test inventory must agree. Keep frozen
benchmark artifacts unchanged. Extend this corpus when 8h adds a measured
conversion or a host integration rule.
