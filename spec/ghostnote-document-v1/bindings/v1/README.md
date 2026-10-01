---
title: Ghostnote binding corpus version 1
kind: reference
state: active
updated: 2026-10-01
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
| B04–B05 | Portable scalar defaults, existing gain inverse, and host capability refusals |
| B06 | Sparse preservation, complete desired defaults, and explicit reset |
| B07–B08 | Same-key overlap refusal, exact adjacency, and normalized cell collision refusal |
| B09–B11 | Partial-base refusal, guarded explicit resolution, and private authority invalidation |
| B12 | Separate D21 exact-source replay refusal |
| B13 | Proven ownership, one-to-one ID recovery, and ambiguity |
| B14 | Pressure preservation, reconstruction refusal, and reversal refusal |

`projectRawClip` consumes supplied raw groups. It retains disabled controls and
does not infer values from the old decoder's omissions. Articulation and repeat
are absent and uncovered. Its coverage describes the supplied complete scan;
the helper does not acquire that scan. Clip metadata is supplied in portable
units. `d9MappedFields` maps supported scalar fields and confirms the existing
gain inverse. Its output is not a complete insertion plan. Host repeat count
uses signed division or rate controls. It cannot map to a total trigger count
without a separate semantic converter.
Raw timbre uses the host range `-1..1`. Portable timbre uses `(raw+1)/2`.
The D9 scalar input uses `2*portable-1`. The existing gain inverse runs once.
Gain values above 2 and transpose values outside `-96..96` refuse writes.
8h must verify these boundary transforms through independent live readback.

The strict assessor requires a complete represented base. A partial resolver
also checks the original digest, binding reference, fresh projection, complete
projection, explicit declarations for unknown fields, and the caller's host
preservation proof. It reports the original and resolved document hashes beside the supplied
private source witness. The fixture does not calculate a complete raw source
hash; 8h owns that acquisition seam. Internal rebinding does
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
