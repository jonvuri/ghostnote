---
title: Phase 1, session 3f — track-copy CRUD and the layer-chain lifecycle
kind: plan
state: active
status: STEP 5 COMPLETE 2026-08-15. `copy_track` is implemented and
        verified offline, in the extension build, through the production MCP
        surface, and by the full live conformance suite. Next: continue nested
        layer addressing and autonomous lifecycle work in step 6.
updated: 2026-08-15
parent: README.md
prev: 3e-clip-block.md
next: 3g-record.md
scope: revised D18
evidence: E16 duplicate/readback rows; E17; E18a/c/e/g/h; E22; D13, D18–D20
---

# Phase 1, session 3f — track-copy CRUD and the layer-chain lifecycle

> **Purpose.** Land an ordinary typed track-copy operation, then complete the
> autonomous device-take representation. Do not restore grouped track forks or
> begin the session-3g observation record here.

## Boundary inherited from this session

E22 is closed and committed. `Group` follows Bitwig's unobservable primary focus;
with device focus it created an Instrument Layer while every track identity and
selection guard passed. A runtime operator prime is therefore not an acceptable
precondition.

The product path has been trimmed accordingly:

- no `track.group` contract operation;
- no `make_track_copy`/grouped-fork surface;
- no group topology or reversal semantics in the fake or engine;
- no production mapping to `branch.groupTrack`;
- the E22 extension hook and mixer observer remain registered only to keep the
  committed regression probe reproducible, and `branch.groupTrack` is explicitly
  product-banned.

The worktree deliberately preserves reusable track-copy groundwork: the typed
`track.duplicate` op, fake cloning, live encoding to the measured
`branch.duplicateTrack` route, expected-channel-id guard, one-row bank precondition,
bounded fresh-ID polling, and ordinary change/reversal reporting.

## Step 5 — complete: `copy_track`

Expose track duplication as direct CRUD, not as a take verb.

Acceptance:

1. `copy_track` takes one durable track address and an explicit copy name.
2. It refuses before writing if the observable track bank has no row available.
3. The extension verifies `expectedChannelId` immediately before calling the
   measured typed duplication route.
4. Structural readback polls within a bound and returns the fresh durable track
   identity; no successful receipt is inferred from acknowledgement alone.
5. The copy carries the source's ordinary track contents supported by Bitwig and
   is renamed through the typed surface.
6. It is recorded in the ordinary session change report. Automatic reversal says
   the copied track remains; directed `delete_track` is the separate cleanup.
7. It creates no take/branch record, grouping, lineage link, A/B semantics, or
   implicit cleanup promise.
8. Tool naming and description are versionable and factual. Observation can later
   detect when agents choose this coarse operation instead of scoped layer/clip
   operations.
9. ⚠ The description states the mechanical costs plainly (revised D18c): the copy
   is **immediately audible** if the source was, instantiating its device chain
   **can glitch the audio and adds engine load** (E16 row C5: 5/5 real vs 0/3
   placebo), it **consumes one bank row**, it **receives a fresh durable id**, and
   **automatic reversal will not remove it**.
10. ⚠ **Supported track types are only the ones measured.** Anything else refuses
    rather than assuming `Channel.duplicate()` behaves identically on every
    channel kind; widening the set is a measurement, not a default.
11. ⚠ The word `duplicate` is still banned on the surface (`naming.ts`). It is
    marked a relaxation candidate for exactly this tool: either write the
    description in the surface's own vocabulary, or reopen that one entry
    deliberately with its reason rewritten. Do not delete the entry silently.
12. Offline checks, extension tests, and a clean live smoke pass before its commit.

Completion record, 2026-08-15:

- the public tool accepts one durable instrument-track id and one non-empty copy
  name;
- the structural copy and its typed rename are two ordinary recorded changes,
  because the rename address does not exist until bounded readback returns it;
- a missing fresh id is reported as unconfirmed rather than promoted from the
  acknowledgement;
- unsupported track kinds and a full observable bank refuse before the first
  write;
- the description carries the audibility, glitch/load, bank-row, fresh-id and
  directed-cleanup facts in COPY vocabulary; the `duplicate` ban was reviewed and
  deliberately kept;
- brain checks passed 357/357, the extension build passed, production MCP smoke
  passed 6/6 with cleanup, and live conformance passed 46/0/6. Both the new
  `C-track-copy` row and the formerly load-dependent `C-minted` row passed live.

## Step 6 — continue the layer-chain lifecycle

The centre of gravity is the address grammar. Today's `DeviceAddress` is flat;
a device inside a layer chain is not expressible. Extend it without breaking
canonical `addressKey`, slice prefixes, stash keys, or existing top-level device
addresses.

Build toward these autonomous operations:

1. Address a layer container, a named/indexed chain within it, and a device within
   that chain through stable observable structure.
2. Create a chain from a bundled/provisioned seed asset. Runtime operator-authored
   presets are forbidden as a functionality dependency.
3. Fill a chain by moving/copying/inserting devices and verify placement through a
   handle other than the writer.
4. Switch alternates with `DeviceLayer.solo()`, retaining E17's container-local
   exclusivity and proving unrelated tracks do not flip.
5. Support directed reduction autonomously. The common winner-only collapse moves
   the winner's devices out and deletes the layer container; selective removal
   while several alternates survive may use the measured rebuild route.

Correctness gates for collapse/rebuild:

- preserve the order of multiple devices;
- restore the intended signal-chain position, not merely `chainEnd`;
- report or restore chain-level state that does not move with devices;
- measure the audible effect on the real track;
- keep cross-device modulation outside the claim until the indexed path is tested.

The seed asset is a build-time dependency and may require its own small asset task,
but it must ship as part of the feature rather than as operator setup.

⚠ **The device-alternate tools cannot be described under the current ban list.**
`layer` and `chain` are both banned words on the surface, marked relaxation
candidates in `naming.ts`. `chain` additionally carries two meanings — the
mechanism and an ordinary device chain — so relaxing it needs a disambiguation
rather than just a decision. Settle that when the tools are written, entry by
entry, and record the reasoning where the entries live. ⚠ Note what these tools
will have to say: a device alternate carries devices and device state and **no
clips, no sends and no track-mixer state** (revised D18b).

## Capability boundary

| capability | `copy_track` | layer take | clip take |
|---|---:|---:|---:|
| general track CRUD | yes | no | no |
| managed take bookkeeping | no | yes | yes |
| carries devices | whole copied track | yes | no |
| carries launcher clips | whole copied track | no | yes |
| carries sends and track-mixer state | whole copied track | no | no |
| carries arrangement clips | whole copied track | no | no |
| container-local exclusive switch | no | yes | per-slot launch |
| beat-aligned switch | no | no | yes |
| Master/FX-return device alternate | no | yes | no |
| automatically linked to another alternate in the turn | no | no | no |

## Split and handoff rule

Commit step 5 independently once green. Step 6 may span more than one session;
split at a verified vertical slice rather than weakening the address or lifecycle
acceptance. Session 3g starts only after both managed take representations have
honest production mechanics to describe and observe.
