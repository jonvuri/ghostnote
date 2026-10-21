---
title: Edit-document receiver trace
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
evidence: E307
---

# Edit-document receiver trace

Pinned host: Bitwig 6.0.6, with the E305 jar hash. This is local bytecode
inspection. No native object is created and no command runs in the check.
The full `javap -p -c cZl` output hash is in `verification.json`.

- `cZl` extends `Object`. `Svr` extends `Ymq` through the managed root
  hierarchy. Neither type is assignable from the other.
- `cZl.ffA(ikl): cZl` obtains the managed object, reads a static map, and
  walks `HEV.I_()` owner references until it finds an existing wrapper.
  It returns null if it reaches the end. This lookup does not create state.
- The `cZl` constructor retains the managed root in `QiZ` and registers
  `map.put(root, this)`. Thus the map value is the wrapper, not the root.
- Journal map `cZl.W2P` and replay getters `cZl.EbT()`/`cZl.Mkn()` belong
  to the wrapper. The replay getters read boolean fields.
- Engine connection `Svr.jnZ()` and engine state `Ymq.AAO()` accept the
  project root. A `cZl` wrapper is not a valid receiver for them.

V17 compares `cZl.ffA(grid)` with `cZl.ffA(projectRoot)` and requires the
same non-null wrapper. Engine reads keep the project-root receiver. Both
identities remain in the witness. All members were already pinned; the
additional lookup uses the existing method on a second admitted receiver.
