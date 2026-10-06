---
title: Phase 8h3e — Cache machinery trim and promotion
kind: plan
state: complete
status: Complete. D32 pull snapshot references on the product revision mark; 23 live verdicts match raw reads; the resident-grid research code is removed. All acceptance cases pass.
updated: 2026-10-06
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h3c2-reader-row-binding.md
next: 8h4a-write-boundary-and-reader-hardening.md
evidence: E222, E224, E225, E226, E227, E230, E231, E232, E233; D26, D27, D28, D30, D31, D32
---

# Phase 8h3e — Cache machinery trim and promotion

## Result

Complete in [E233](../../evidence/experiments/e233-pull-snapshot-references.md)
and [D32](../../decisions/d32-pull-snapshot-references-use-the-revision-mark.md).
A reference holds the product revision mark, the address, and one
`ghostnote-launcher-source/1` digest. Every live verdict matches an independent
raw read. A stale reference refuses before any host mutation. The probe
profile has 98 methods (`659635435255b259`); the normal wire is unchanged. Each
check reads clip metadata through a cursor point, so a 16-clip survey takes
8.8 s against 3.5 s in E231. No live P→Q→P detour was quiet: each overflowed
the 24-event ring and refused.

## Status before implementation

[8h3c2](8h3c2-reader-row-binding.md) is complete
([E232](../../evidence/experiments/e232-reader-row-binding.md)): the product
reader binds every row. [8h3d](8h3d-change-awareness.md) selected pull only
([E231](../../evidence/experiments/e231-change-awareness.md)). This session
replaces the earlier 8h1 cache promotion plan. The evidence record is E233.

## Why

A cold read takes 46–698 ms (E227). The resident note grid therefore gives no
speed benefit. It costs about 300 bytes of host heap for each sounding cell
(E226, E231), and it needs admission, eviction, canary, and budget logic.

An agent works on snapshots and sends patches against them. Ghostnote must
name the clip that a snapshot came from, and tell at use time whether the
snapshot is still current (E231 snapshot lifetime and stale verdict).

## Findings from the planning review

The outline predates parts of the current code. The review found:

1. **Identity.** The 8g identity domain (ProjectGeneration, StructuralEpoch,
   BindingGeneration, RebuildGeneration, ContentGeneration, LogicalClipRef)
   exists only in probe-only `ShadowProjectCache`. The product already has
   `RevisionMark` (`brain/src/contract/snapshot.ts`): a per-initialization
   `generation`, a lossy `project` name, and the extension-observed
   `sceneEpoch` and `contentEpoch` with a per-slot delta ring
   (`contract/observers.ts`). Under pull, binding, rebuild, and content
   generations and the canary have no function.
2. **Consumers.** No stable tool takes a snapshot base across calls.
   `transform_clip_music` and the note tools read fresh state in each call.
   The guard `ifRevision` counts only Ghostnote writes. Only the experimental
   `phase-7b-agent-note-patch-v0` profile (sha256 base over
   `exact-note-source-v0`) and the offline 8f3 binding (`Authority`,
   `bindings/ghostnote-document.ts`) use a base.
3. **Fingerprint domains.** `pull-fp-v1` is in research code only
   (`probes/phase8h3d-change-lib.ts`). The host binding defines
   `ghostnote-launcher-source/1` and states that 8h must implement it before
   raw state can guard the new route.
4. **Research code.** Every resident-grid class is allocated only in the probe
   profile. The normal profile has none of it. The product already has a flat
   256-track, 128-scene inventory.
5. **Stale text.** `acquire_clip_note_source` still says "complete dual-grid
   reader". E230 removed that reader from the product path.
6. **Document integration** (FIELDS read and sparse patch through the codec)
   has no assigned session in the 8h plan.

## Decisions taken in planning

The operator selected these options in the planning session:

- **Identity:** a snapshot reference is the product `RevisionMark`, the
  durable address (track `channelId`, row), and one content fingerprint.
  Retire BindingGeneration, RebuildGeneration, ContentGeneration, the canary,
  and replay settlement from the contract. Amend the 8f3 `Authority` to match.
- **Exposure:** a snapshot and verdict module in the brain, an executor check
  at the stash read, and exposure only through the experimental tool profile.
  8h4 owns the compact-bar document read and patch tools and the stable
  surface.
- **Trim:** delete the resident-grid research code, as E230 did for the
  replay research. Keep the retained offline verifiers. Keep
  `ChangeWatchProbe`. Do not promote topology or slot inventory; record them
  as 8h4 and 8i inputs.

This plan also selects one content fingerprint (step 1). Record all four
choices in a new decision, D32.

## Entry

Read D26–D31, E224, E230, E231, and E232, the
[cache contract](../../contracts/GHOSTNOTE_CACHE_CONTRACT.md), the
[host binding](../../../spec/ghostnote-document-v1/HOST-BINDING.md) "Base
resolution and conflicts" section, and the
[migration contract](../../contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md).
Read `RevisionMark` and the content delta in `contract/snapshot.ts` and
`contract/observers.ts`, and the executor stash in `engine/executor.ts`. Use
owned unsaved `New N` projects for live work, never `gn-scale-test` (D29).

## Work, in order

### 1. Snapshot reference and fingerprint

Add one product module in the brain contract layer, for example
`contract/clip-snapshot.ts`. Do not import it from a probe.

- **Fingerprint.** Implement `ghostnote-launcher-source/1` content: SHA-256
  over the domain name, LF, and R26 canonical JSON of the complete raw clip
  metadata that `clip.read` and `cursor.clipMetadata` return, and every raw
  note field, ordered by channel, cell, and pitch. Include disabled controls
  and raw binary64 values. Exclude read IDs, timings, and callback counts.
  Compute it from the product `clip.read` capture and metadata in both the
  live and the fake adapter.
- **Guards beside the digest.** Keep the mark and the address as typed fields
  next to the digest, not inside it. Amend the host binding sentence that puts
  project and structure guards inside the digest. Typed comparison gives each
  refusal its own reason.
- **Reference.** `ClipSnapshotRef` holds the complete `RevisionMark` of the
  read (`revision`, `generation`, `project`, `sceneEpoch`, `contentEpoch`, and
  `window`), `channelId`, `row`, the fingerprint, and its version. Keep every
  mark field: `contentDelta` needs the full mark at both ends, and
  `uncoveredBetween` reads `window` at both. It is opaque to agents and
  validated on input.
- **Research name.** `pull-fp-v1` stays the E231 research name. Add a test
  that the retained E231 artifacts give the same stale and current verdicts
  under the new fingerprint, if their rows carry the needed fields. If not,
  record why, and test the E231 edit classes on fixtures.

### 2. Verdict at use time

One function compares a reference with a fresh read of its address. The
fresh read uses the product reader on all 16 channels; the adapter acquires
each clip once for all channels (E230). Build the delta with the existing
`contentDelta(ref.mark, fresh.mark, ring)`, and use `deltaComplete` and
`contentTouching`. Do not write a second delta or relax their rules.

Evaluate the rows in order; the first match gives the verdict.

| Verdict | Condition | Result |
|---|---|---|
| `incomparable` | The delta is `discontinuous`: generation differs (extension reload), or a project is empty or differs | Refuse. Read again |
| `uncovered` | The delta is `uncovered`: the track or scene bank did not cover the project at either mark | Refuse. Name `uncoveredIn`. Return no snapshot. The project is outside the observer window, so no read can prove the identity |
| `identity-changed` | Scene count changed; the delta is `truncated` or has an unattributable event; or `contentTouching` names the slot | Refuse. The agent must resolve the address again. Return no rebase snapshot |
| `absent` | The slot has no clip, or the track does not resolve | Refuse with the existing absent-clip and unknown-track reasons |
| `stale` | All guards above pass; fingerprint differs | Return the new snapshot. Never apply |
| `current` | All guards above pass; equal fingerprint | Apply against the snapshot |

`truncated` also covers age: when the extension ring no longer holds the
interval since the mark, the reference refuses. The E231 rule "no time limit"
therefore holds only while the delta is complete. State this lifetime in the
contract.

A `current` verdict states content equality at the same address in one
identity domain. It does not prove the same host clip object (E224).

A project detour P→Q→P gets no special rule. It is `current` only when the
table row holds: the scene guard is unchanged, and the content delta since
the mark is complete and has no event for the target slot. A detour can
deliver slot events (E222: 7 of 100 same-callback detours delivered 8
callbacks each), and a scene-count difference between P and Q changes the
scene guard. Then the verdict is `identity-changed`. A detour with no guard
event is indistinguishable from no detour, so equal content at the address is
the valid base. State both results in D32 and the contract.

Add a survey function: one verdict for each reference, and a new snapshot
only for stale clips (E231 survey shape). Read clips in order through the
single reader.

### 3. Executor guard

Add `RunOptions.ifSnapshot` (a list of references). The executor reads each
referenced clip in the stash read and runs the verdict before labels and the
floor. Any verdict other than `current` refuses the whole batch before a
host mutation, with the verdicts and the stale snapshots. Use the stash read
itself; add no separate read when the write set already covers the clip.
`ifRevision` stays.

### 4. Experimental exposure

Change only `phase-7b-agent-note-patch-v0`. The stable profile does not
change.

- `acquire_clip_note_source` returns `snapshot` (the reference). Correct its
  description and result contract: the reader is the 8h3c `1/512` cold reader
  under D31. Keep its other guards for compatibility.
- Agent-proposal `apply` uses `ifSnapshot` when the request has a reference.
  A stale verdict refuses before a write and returns the new snapshot.
- Add an experimental `check_clip_snapshots` read tool on the survey
  function.

### 5. Contracts and specification

- Rewrite the cache contract as the pull snapshot contract: scope, the
  reference, the fingerprint, the verdict table, the survey, and the
  limits. The limits are the reader width (4,194,304 steps), the 2 s read
  deadline, and the 131,072-note page. Move the resident-grid sections
  (sparse storage, health states, eligibility, canary, admission, and
  eviction) to a short historical section that links E214–E226. Do not keep
  them as live rules.
- Amend the host binding: base resolution uses the D32 reference; "proved
  clip continuity" becomes D32 address and content equality; the digest
  domain is as step 1 states.
- Amend the [identity and overlay rules](../../../spec/ghostnote-document-v1/IDENTITY-AND-OVERLAYS.md):
  - **Clip identity.** A document clip ID binds to a D32 reference, not to a
    logical clip reference. D32 has no move proof, so a moved, duplicated, or
    replaced clip always gets a new ID. Remove the observer rebind and
    rebuild-continuity text.
  - **Generation.** A detected project change or reload (`incomparable`)
    retires refs, proposals, event maps, and overlay attachment rights. Replace
    "switch back starts a new generation" with the conditional detour rule:
    a detour that no guard records cannot be detected, and the D32 verdict is
    the only protection. Keep "a fingerprint does not prove continuity".
  - **Event identity.** "Continuity" in the event table means a `current` or
    `stale` verdict with a complete delta. Pull has no cell-level callback
    window. A human delete and reinsert of equal values at one cell between
    two reads is not visible. Extend the existing D23 identity boundary
    sentence to state this.
  - **Annotations.** Key attachments by the D32 reference. The fingerprint
    replaces the source and content generation.
- Amend the [migration contract](../../contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md):
  replace "Conditional cache authority" with the pull disposition (every
  preflight is a fresh read; a D32 reference guards an agent base). Mark
  migration-order steps 1 and 3 as complete or void, as in the 8h parent.
  In rollback, snapshot references and proposal handles replace cache
  bindings.
- Amend `Authority` and `guardAuthority` in `bindings/ghostnote-document.ts`
  and their fixtures. Replace `projectGeneration`, `structuralEpoch`,
  `logicalClip`, `address`, `contentGeneration`, and `exactSourceHash` with
  one D32 reference, and run the step 2 verdict. Do not map
  `structuralEpoch` to `contentEpoch`: that epoch moves on any slot change,
  and the per-slot delta already decides this. Keep the binding offline; 8h4
  connects it and implements the document clip and event ID registry.
- In the 8h parent plan, replace the five promotion stages with their
  disposition: stages 1 and 2 were met by 8h3c (paired E131 comparison),
  stages 3 and 4 are void because every preflight is a fresh read, and
  stage 5 is this trim. The new guard has its flag (the experimental profile),
  its comparison (the live matrix), and its rollback (the stable profile).
  Assign document integration to 8h4.

### 6. Trim the research code

Delete from source, then record each removal in E233:

- Extension: `ShadowCacheProbe`, `ShadowProjectCache`, `ShadowHandlePool`,
  `ShadowAuthorityFallback`, `ShadowInventoryRebuild`,
  `ShadowTopologyControl`, `ShadowGroupControl`, `ShadowSceneControl`,
  `SlotDeltaWindow`, `ShadowSoundingProbe`, `CacheScaleProbe`,
  `RootIdentityProbe`, `ObserverReuseProbe`, `DeliveryCoherenceProbe`, their
  handlers and tests, `GhostnoteShadowCacheExtensionDefinition`, and the
  `shadowProbeJar`, `copyShadowProbeExtension`, and shadow test Gradle
  tasks. Remove their `RigConfig` keys and `Rig` allocations.
- Keep `ChangeWatchProbe` and the knee fixture writer that its driver uses.
  Narrow `cache.shadow` to the `watch*` and `fixture*` operations, or move
  them to one research method. Remove `cache.configure` and `cache.scale`
  unless a kept driver needs them. Keep `legacy-open` (E232) and the
  `stepdata.observer.*` regressions.
- Brain: remove `contract/cache-policy.ts` and its exports if no kept code
  uses them. Keep every retained offline verifier and the library code that
  it imports. A live driver for removed wire stays only if its file states
  that it needs its earlier research build (the E230 rule). Update
  `gn-hello.ts`, the wire map, and the wire goldens.
- Update `AGENTS.md`: `copyProbeExtension` replaces
  `copyShadowProbeExtension` for research, if the shadow archive is removed.
  Name the research product in the operator text.
- Record the new probe method count and hash. The normal profile must keep
  87 methods and hash `ca139a3e62a55e68`.

Keep the probe profile's research cursor for `legacy-open`. Do not change
`ClipReader`, the write gate, or the D30 order.

## Live acceptance

Use the normal archive and the experimental tool profile in an owned
project. Each case compares the verdict with an independent raw read.

1. **Edits.** On a typical-density clip (E231) at row 0 and at row 1 of a
   multi-clip track: no edit (`current`), add, delete, velocity, `1/512`
   nudge, executor `note.insert`, one operator move in the Bitwig editor, and
   a loop-length change. Each edit gives `stale` with a new snapshot that
   matches the raw read.
2. **Identity.** A scene insert above the clip, a clip delete and recreate at
   the same slot, a switch to project Q (`incomparable` or `absent`), and a
   controller reload (`incomparable`). Add unit cases for `uncovered` at the
   mark, at use time, and at both, and for a `truncated` ring. A live
   `uncovered` case is not required; the rig bank (256 tracks, 128 scenes)
   covers the owned project.
3. **Detour.** P→Q→P detours with unchanged target content. Record the scene
   guard and the content delta of each trial. A trial with a scene change, a
   target-slot event, or an incomplete delta must give `identity-changed`. A
   trial with none of these must give `current`. Include at least one Q with
   a different scene count or target-slot occupancy, so that the refusal arm
   is exercised. E222 measured the research slot window, not the product
   content delta, so do not assume its event rate.
4. **Write guard.** An agent-proposal apply against a stale reference refuses
   before any host mutation. A raw read before and after shows no change. The
   same apply against a current reference applies and verifies.
5. **Survey.** 16 typical clips, two of them edited: exactly those two are
   stale. Record wall time and result bytes against E231.
6. **Probe build.** Deploy the trimmed probe archive. After operator
   replacement, a fresh probe hello passes with the new count, hash, and
   markers. Then restore the normal archive and pass a fresh normal hello.

## Acceptance criteria

- One product fingerprint and reference module serves the live and fake
  adapters. No product module imports a probe.
- Every verdict in the step 2 table has unit tests and, where the live list
  names it, a live case that matches an independent raw read.
- A stale or non-current reference refuses before any host mutation, and
  returns the new snapshot only for `stale`.
- The stable tool profile and the normal wire are unchanged: 87 methods,
  hash `ca139a3e62a55e68`.
- The experimental profile exposes the reference, the guard, and the survey,
  and its acquisition text names the current reader.
- The cache contract, host binding, identity and overlay rules, migration
  contract, `Authority`, and the 8h parent plan state the D32 design. No
  active rule requires logical clip continuity, content generations, or a
  new generation on an undetected switch back. No live rule refers to resident grids, canaries, or binding
  generations. D32 records the identity, exposure, trim, and fingerprint
  choices, and the conditional P→Q→P rule. Every detour trial gives the
  verdict that its recorded guards require.
- The removed classes, methods, Gradle tasks, config keys, and drivers are
  listed in E233 with any compatibility break. Every retained offline
  verifier still passes.
- Owned projects are closed without saving. The normal archive is deployed
  with a fresh normal hello. `gn-scale-test` matches the E231 track baseline.
- Brain check, extension check, wire goldens, retained artifact verifiers,
  context check, and `git diff --check` pass.

## Out of scope

- Reader and writer changes (8h3c, 8h3c2), including the open E232 selection
  observation (one read in 2,200). Record it again only if it recurs.
- Watched clips. `ChangeWatchProbe` stays research (E231).
- Stable tool changes, compact-bar document read and patch, interface
  simplification, and public naming (8h4).
- Promotion of counted topology, group inventory, or `SlotDeltaWindow`.
  The product inventory stays flat; record group-slot handling (E222) as an
  8h4 and 8i input.
