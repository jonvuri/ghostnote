---
title: E233 — Pull snapshot references and the cache machinery trim
kind: evidence
state: done
updated: 2026-10-06
owner: phase-8h3e
---

# E233 — Pull snapshot references and the cache machinery trim

## Status

[8h3e](../../plan/phase-8/8h3e-cache-machinery-trim.md) is complete.
[D32](../../decisions/d32-pull-snapshot-references-use-the-revision-mark.md)
records the design. A snapshot reference holds the product `RevisionMark`, the
durable address, and one `ghostnote-launcher-source/1` fingerprint. All 23 live
verdicts match an independent raw read. A stale reference refuses before any
host mutation. The resident-grid research code is removed. The normal wire is
unchanged: 87 methods, hash `ca139a3e62a55e68`.

## Implementation

- `brain/src/contract/clip-snapshot.ts`: the fingerprint, the reference and its
  opaque token (`gcs1.`), the verdict (`judgeClipSnapshot`), and
  `ClipSnapshotRefusedError`. No product module imports a probe.
- `BitwigAdapter.read(addresses, { sources })` fingerprints the named clips in
  the same read (`Snapshot.sources`). The live adapter uses the `clip.read`
  capture of the note entries and one `cursor.clipMetadata` reply for each
  clip. The fake adapter builds the same raw fields from its model.
- `brain/src/engine/clip-snapshots.ts`: acquisition, the verdict over one
  adapter read, and the survey. The content delta is taken after the read, so
  an event during the read gives `identity-changed`.
- `RunOptions.ifSnapshot`: the executor stash read covers each referenced clip.
  Any verdict other than `current` throws before labels, the floor, and the apply.
  The stash keeps only the write-set entries.
- Experimental profile: `acquire_clip_note_source` returns `snapshot`, and its
  text names the 8h3c cold reader. Agent-proposal `apply` takes `snapshot`,
  refuses a reference to a clip outside the proposal source, checks it before
  the existing guards, and passes `ifSnapshot` to the executor. `check_clip_snapshots` is the survey. The stable profile is unchanged.
- `bindings/ghostnote-document.ts`: `Authority` is one D32 reference.
  `guardAuthority` runs the verdict on a fresh read and delta. The binding
  corpus fixture and manifest are updated (B11).

The live metadata read is now memoized for each clip in one adapter read. Before
this, a 16-clip survey pointed each clip three times when the 8-cursor pool
evicted (13.4 s; 8.6 s after).

## Unit evidence

`engine/clip-snapshots.test.ts` covers every verdict on the fake adapter: the
E231 edit classes (add, delete, velocity, `1/512` nudge, executor
`note.insert`, editor move, loop length), a row on a multi-clip track,
scene compaction, delete and recreate, a moved clip, a truncated ring, an
unattributable event, an event on another slot, reload, project change, the
detour rule (quiet, slot event, scene epoch), `uncovered` at the mark, at use
time, and at both, both `absent` reasons, the survey, and the executor guard.
The fingerprint test covers note order, the excluded address fields, and a raw
velocity change below MIDI resolution. Surface and binding tests cover the
experimental tools and `Authority`.

The retained E231 artifacts hold only `pull-fp-v1` digests and timings. They do
not hold raw rows or metadata, so the new fingerprint cannot be recomputed from
them. The E231 edit classes are tested on fixtures instead.

## Live method

Normal archive SHA-256 `737464bb29b2520c5009e8d883e9d9c8914cb9a08c80776820e89e2c48cb5a77`.
The owned unsaved project P was `New 4`; Q was `New 5`. The driver is
`brain/src/probes/phase8h3e-snapshots.ts`. Each case acquires a reference
through the experimental tool, applies one step, and then reads the clip again
with a separate raw `clip.read`. The expected verdict comes from the marks, the
content delta, and raw row equality, not from the adapter fingerprint. A stale
verdict must return a snapshot equal to the raw read, and that snapshot must
check as `current`.

Fixtures use E231 typical density (256 notes in 64 beats, all 16 channels),
written by the fine writer cursor. The edit track has a clip at rows 0 and 1.
Each edit matrix starts from a rewritten clip with an exact palette colour.

## 1. Edits

The same seven cases ran at row 0 and at row 1 of the edit track. Each stale
reference is replaced by its new snapshot for the next step.

| Edit | Row 0 | Row 1 | New snapshot = raw read |
|---|---|---|---|
| None | current | current | — |
| Add | stale | stale | yes |
| Delete | stale | stale | yes |
| Velocity | stale | stale | yes |
| `1/512` nudge | stale | stale | yes |
| Executor `note.insert` | stale | stale | yes |
| Loop length 64 → 32 beats | stale | stale | yes |
| Operator move (row 0) | stale | — | yes |

The operator moved one note: MIDI channel 12, pitch 79, from beat 46.75 to
beat 48.125. The raw diff contained only that note. No edit delivered a launcher
event. A check of one typical clip took 782–840 ms. A stale result was about
59 KB; a current result was about 830 bytes.

## 2. Identity

| Case | Verdict | Guard record |
|---|---|---|
| Scene append | identity-changed (scene-layout) | scene epoch 3 → 4, count 8 → 9 |
| Clip delete and recreate, equal raw content | identity-changed (slot-event) | two target-slot events (empty, filled) |
| Operator scene insert above row 0 | identity-changed (scene-layout) | epoch 2 → 3, count 9 → 10, 20 events |
| Switch to Q, checked in Q | incomparable (project-changed) | project `New 4` → `New 5` |
| Controller reload | incomparable (extension-restarted) | new generation; scene epoch 8 → 2 |

The operator could not insert a scene above an existing scene directly. Add
Scene places the new scene below the current scene. The operator added one and
moved it to the top. `uncovered` has unit cases only; the rig bank (256 tracks,
128 scenes) covers the owned project.

## 3. Detours

| Trial | Q | Scene epoch | Delta | Target-slot event | Verdict |
|---:|---|---|---|---|---|
| 1 | new `New 5`, 8 scenes | 4 → 6 | 36 events, 24 kept (truncated) | yes | identity-changed (scene-layout) |
| 2 | `New 5`; the operator added a scene in Q | 6 → 8 | 36, truncated | yes | identity-changed (scene-layout) |
| 3 | `New 5` with 9 scenes, same as P | 8 → 8 | 36, truncated | yes | identity-changed (delta-incomplete) |

Every trial gave the verdict that its recorded guards require. Trial 3 kept the
scene guard. P had 18 occupied slots. Each switch delivered one launcher event
for each occupied slot that differs, so a round trip gave 36 events for a
24-entry ring. No trial was quiet, so no live trial could give `current`. The
quiet arm is a unit case. A project with more than 12 occupied slots that Q does
not match truncates the ring on every round trip.

## 4. Write guard

On survey clip 16, the agent acquired a reference and previewed a one-note
transpose. Another writer then inserted a note. The `apply` with the old
reference returned `applied: false` and a `stale` verdict. Its new snapshot
equalled the raw read. The raw clip and the revision (36) did not change. An
executor `note.insert` with the same reference threw
`ClipSnapshotRefusedError` (stale) with no change. A new acquisition, preview,
and `apply` with the current reference applied. The independent readback had
no discrepancy, and the clip had 257 notes.

## 5. Survey

16 typical clips on four tracks, rows 0–3. One `check_clip_snapshots` call per pass.

| Pass | Wall | Result bytes | Stale |
|---|---:|---:|---|
| All current | 8.75 s | 11,203 | none |
| After a velocity edit on clip 1 and a nudge on clip 16 | 8.77 s | 128,184 | exactly clips 1 and 16 |

E231 measured 3.47 s for 16 clips, with a 2,055-byte and 11,922-byte size proxy.
The difference is the metadata read: each clip needs a cursor point (about
300 ms) for `cursor.clipMetadata`, and E231 read notes only. A reference token
is about 700 bytes. A stale result carries the complete clip as contract notes;
the compact format is 8h4's.

## 6. Trim

Removed from source:

- Extension classes: `ShadowCacheProbe`, `ShadowProjectCache`,
  `ShadowHandlePool`, `ShadowAuthorityFallback`, `ShadowInventoryRebuild`,
  `ShadowTopologyControl`, `ShadowGroupControl`, `ShadowSceneControl`,
  `SlotDeltaWindow`, `ShadowSoundingProbe`, `CacheScaleProbe`,
  `RootIdentityProbe`, `ObserverReuseProbe`, `DeliveryCoherenceProbe`,
  `GhostnoteShadowCacheExtensionDefinition`, and `CacheScaleHandlers`. Their
  removal left `SoundingCellBudget` and `StepDeltaWindow` unused; both are
  removed.
- Nine harness tests of those classes. `ClipReaderTest` moved to the
  `harnessTest` source set.
- Gradle tasks: `shadowProbeJar`, `copyShadowProbeExtension`,
  `shadowCacheTest`, `shadowCacheProbeTest`, `shadowInventoryRebuildTest`,
  `shadowObserverBudgetTest`, `shadowHandlePoolTest`,
  `shadowAuthorityFallbackTest`, `shadowTopologyControlTest`,
  `shadowSceneControlTest`, and `soundingCellBudgetTest`.
- Probe wire: `cache.configure` and `cache.scale`. `cache.shadow` keeps only
  the `watch*` and `fixture*` operations. Probe profile: 100 → 98 methods, hash
  `4232fd6c9f325749` → `659635435255b259`. Declaration inventory: 162 → 160
  methods, hash `2de27e60c3512a21`. The session buckets keep the names.
  Normal (87, `ca139a3e62a55e68`) and capture (92, `e073a6dde3444ff6`) are
  unchanged.
- Rig keys: `cacheScaleObservers`, `cacheScaleSteps`, `cacheScaleWidthSteps`,
  `cacheShadowObservers`, `cacheTopologyTracks`, `cacheTopologyCounted`,
  `cacheLifecycleResearch`, `cacheShadowCursorScenes`, `cacheSoundingResearch`,
  and `deliveryResearch`, with the research topology defaults. `Rig` no
  longer allocates the research objects or the active-bank control.
  `cacheKneeResearch` alone now allocates the fixture writer at
  `cacheShadowSteps`. `rig.stats` no longer reports the removed keys or the
  `cacheScale*` resources.
- Brain: `contract/cache-policy.ts` moved to `probes/phase8e-cache-policy.ts`
  and left the contract exports; only research code uses it. `gn-hello`
  replaces its shadow markers with `--watch-marker`.

Compatibility breaks: the research product `ghostnote 8g controls` and its
archive no longer exist; research uses `ghostnote probe`
(`copyProbeExtension`). 38 live drivers for removed wire state at the top of
the file that they need the earlier research build of their session. Their
artifacts and offline verifiers still run. The 8h3c, 8h3c2, and 8h3d drivers
now expect the trimmed probe build. A rig config with a removed key loads; the
key has no effect. `BitwigAdapter.read` gains an optional argument and
`Snapshot` an optional field. `Authority` changed shape.

The trimmed probe archive (SHA-256 `e2b5245b…6311`) loaded after operator
replacement. Fresh probe hello passed: `phase-8-probe-v1`, 98 methods,
`659635435255b259`, `clip-reader-v1`, `confirm-before-release-v1`, and
`subscribe-before-unpin-v1`. `cache.configure` and `cache.scale` returned
`Method not found`; `cache.shadow` refused `info` as an unknown research
operation.

## Findings

- **Scene change during the read (review fix).** The first build checked the
  scene guard only against the read mark, which precedes the read; the content
  delta has no scene fields. On the fake, an empty-scene deletion during the
  read returned `current`. A deletion of the target row slid the next clip into
  it with no slot event; the check returned `current`, and an executor
  `note.insert` under `ifSnapshot` wrote into the other clip. The verdict now
  also checks a mark taken after the read and the delta. Three regression tests
  cover the cases. The live cases above ran before this fix; none had a scene
  change during a read. A scene change after the post-read mark and before the
  apply is still not checked, because no adapter checks the scene epoch at
  apply. That window exists for every executor write and is an 8h4 input.
- **Stale selection after a project switch.** In Q, `selection.status`
  reported track index 4 from P. `preserveSelection` then sent `slot.status`
  for that index and the host refused. `check_clip_snapshots` no longer wraps
  its read in an outer selection scope; the adapter read restores the selection
  itself. Other tools with an outer scope can refuse until the selection
  changes. This is an 8h4 input.
- The `clip.read` reply has no name, colour, play start, or loop flag, so each
  checked clip needs a cursor point. A metadata field in the reply would remove
  about 300 ms per clip. That is a reader change and an 8h4 input.
- Acquisition refuses a clip whose notes end after its loop (the existing
  consolidation guard). After the loop-length edit, the driver rewrote the
  clip before the next case.
- The default clip colour of a new launcher clip is outside the exact palette,
  so `clip.update` refuses it. The fixtures set a palette colour first.

## Artifacts and restoration

Data is in [phase8h3e-snapshots](../data/phase8h3e-snapshots/).
`brain/src/probes/phase8h3e-snapshots.ts verify-offline <dir>` recomputes every
verdict from its raw reads, and `phase8h3e-snapshots.test.ts` runs it. The
state file keeps the tokens; each case artifact keeps its raw reads.

Brain check passes 1,918 tests, extension check passes, the wire goldens are
current, the binding corpus passes 15 tests, and every retained offline verifier
passes. Both logs are retained. The publication candidate inventory is
regenerated; it was already stale at HEAD for the cache contract and
`brain/package.json`.

The driver deleted the five owned tracks; P's track IDs matched its entry. The
reader was closed, and the write gate had no open read, waiting request, or
lease. The operator closed `New 4` and `New 5` without saving and restored
`gn-scale-test`; all ten track IDs match the E231 baseline. The rig config is
unchanged (SHA-256 `256bbf07…43b0`). Fresh normal hello passes `normal-v1`,
87 methods, `ca139a3e62a55e68`, and the reader markers.
