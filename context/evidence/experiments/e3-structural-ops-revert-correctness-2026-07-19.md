---
id: E3
kind: evidence
state: active
source: FINDINGS.md
---

# E3 — Structural ops & revert correctness (2026-07-19)

**Verdict: ● the optimistic-application posture is sound — native undo is
unusable for batch revert (as §8a predicted), and snapshot-based revert
works even for the hardest structural case.** Probes `e03` + `e03b`.

### The headline: undo granularity (§8a confirmed, decisively)

**Bitwig does NOT coalesce operations into undo transactions.** A 4-note
write took **exactly 4 undos** to unwind whether sent as one request
(4 `setStep` in a single handler call) or four separate requests. There is
no `beginUndoStep`/grouping hook in the API. Combined with the stack being
**project-global** (`canUndo` stayed true after we cleared our own notes —
our earlier structural ops were still on it), this kills native undo as a
revert mechanism outright: "undo the agent's last batch" maps to N global
history entries interleaved with the user's own edits. **Owning revert is
mandatory, exactly as INITIAL_PROMPT §8a assumed — now proven, not
assumed.**

### Revert-fidelity roundtrip (§8b confirmed)

Full cycle works: snapshot a clip's notes (verbose scan) → `deleteObject`
the whole clip → recreate via `createNewLauncherClip` → re-point cursor →
replay snapshot → readback matches exactly. **Structural delete is losslessly
reversible via snapshot replay**, no inverse-op algebra needed. This is the
§8b primitive demonstrated end-to-end on the launcher.

### Deletion surface — all four levels work

`deleteObject()` confirmed working with settle times:
Track ~140ms (E1) · ClipLauncherSlot ~24–145ms (E2/E3) · **Device ~140ms**
· **Scene ~instant**. Every structural create has a working delete ⇒ every
structural create is revertible.

### Devices (bonus E4 head start)

- **Insert Bitwig device by UUID works**: `cursorTrack
  .endOfDeviceChainInsertionPoint().insertBitwigDevice(UUID)`. Settle
  ~600–640ms (real plugin load, much slower than note/track ops — batches
  touching devices must budget for this).
- **Device chain re-indexes on delete** (like tracks): deleting device[0]
  shifted the survivor from index 1→0.
- **DeviceBank on a pool cursor track enumerates the chain** (name+exists);
  `itemCount()` gives true length.
- **Device UUID catalog harvested** from
  `…/Bitwig Studio.app/Contents/Resources/Library/device-settings/<uuid>/
  Default.bwpreset`: Polysynth `a9ffacb5-33e9-4fc7-8621-b1af31e410ef`,
  Polymer `8f58138b-…`, Sampler `468bc14b-…`, Test Tone, Organ, Sine, FM-4,
  Phase-4. The §6a "harvest a device catalog" idea is mechanically trivial
  for Bitwig internal devices — the whole map is sitting in the app bundle.

### Scenes — compaction + a real staleness trap

- `Project.createScene()` appends at the end (instant); `Scene.deleteObject()`
  via `sceneBank.getScene(i)` works.
- **Deleting a scene COMPACTS rows below it upward** (confirmed by pitch:
  markers at rows 9/10 moved to 8/9, row 10 emptied). So scene deletion
  shifts clip addresses — the launcher grid is not sparse/absolute.
- **⚠ A pinned cursor's `sceneIndex()` goes PERMANENTLY STALE after scene
  compaction** (still read 10 after 3.1s while the clip was really at row 9).
  Its content tracking and clip-object binding stayed perfect (pitch 64),
  and `trackPosition` tracks track-structural changes correctly (E1) — but
  `sceneIndex` does **not** track scene-structural changes on a held pin.
  ⇒ **after any scene create/delete, the executor must re-point/re-resolve
  cursors; never trust a pre-existing pin's sceneIndex across a scene
  structural op.** Note this interacts with our `point()` verification,
  which checks `sceneIndex === expected` — re-point fresh (re-run
  `selectSlot`) rather than trusting the stale pin.

### Two "FAILs" in the probe output — both are the findings, not defects

`e03` and `e03b` each show one FAIL: they are the *stale-sceneIndex*
behavior above, asserted as expectations that Bitwig violates. The
extension is behaving correctly; the assertions document real API
behavior. No open defect.

### Decision impact

- **Revert design (DECISIONS): own it via snapshot-replay; do not touch
  native undo.** Confirmed feasible and lossless for notes + structural
  delete.
- **Batch executor:** budget ~600ms per device insert; re-resolve cursors
  after scene ops; the existing "verify target before write" rule (E2)
  extends to "re-point after any structural change, don't trust held
  positional metadata."
- **Param catalog (§6a):** Bitwig-internal device UUID→name map is free
  from the app bundle; promotes the catalog idea from "semi-manual harvest"
  to "trivial for internal devices" (VST/CLAP still need the index-scan
  approach — E4).
- Full CRUD deletion surface confirmed ⇒ no structural op is a revert
  dead-end.

---
