---
id: E5
kind: evidence
state: active
source: FINDINGS.md
---

# E5 — Scale limits (§12 #5, the last open question) (2026-07-19)

**Verdict: ● no knee exists in any plausible range — pre-allocation is far
cheaper than §3a feared, and the binding constraint is not performance but
the bank WINDOW.** Probes `e05` (12-config sweep) + `e05b` (re-measured
against a populated 54-track / 387-clip project). All checks green.

### Method: config-driven sizes + hot-reload

`Rig`'s sizes moved from `static final` constants to `RigConfig`, loaded at
init from `~/.ghostnote/rig.json`. The sweep writes a config, forces a
re-init, and re-measures — no rebuild per data point. Each config carries a
`stamp` echoed by `rig.stats`, so the probe can prove it is talking to the
**new** init rather than a bridge that never went down.

- **⚠ `touch` does NOT trigger the hot-reload.** Bitwig watches for a
  *content* change, not an mtime bump. The reload primitive is rewriting the
  deployed file (`cp build/libs/…bwextension "$EXT/…"`). Reload → bridge
  answering again is **~3.0–3.3s**, flat across every size tested.
- Instrumentation added: `rig.stats` (construct/init nanos, sizes, stamp,
  heap) and `rig.scanTracks` (full bank scan cost + warm-up readiness).

### The numbers — empty project (e05, 6 tracks)

| config | slots | construct | init | warm-up | scan | ping p50/p95 |
|---|---|---|---|---|---|---|
| 16×16 (E0–E4 baseline) | 256 | 6.4ms | 11.4ms | ~265ms | 869µs | 24.1 / 25.8 |
| 64×64 | 4 096 | 9.0ms | 12.0ms | ~272ms | 631µs | 24.2 / 25.4 |
| 128×128 | 16 384 | 29.0ms | 32.4ms | ~270ms | 525µs | 23.9 / 25.0 |
| 256×128 | 32 768 | 42.9ms | 47.0ms | ~261ms | 611µs | 23.8 / 25.4 |
| **512×128** | **65 536** | **75.7ms** | **81.0ms** | ~267ms | 853µs | 23.9 / 25.3 |
| cursorPool=16 | 4 096 | 9.0ms | 16.1ms | ~258ms | 439µs | 23.9 / 25.2 |
| paramHandles=256 | 4 096 | 23.4ms | 26.7ms | ~260ms | 412µs | 23.9 / 25.3 |
| gridSteps=512 | 4 096 | 38.9ms | 42.7ms | ~277ms | 548µs | 23.8 / **34.5** |

Init cost is **linear and tiny**: ~1.2µs per slot object. Even 65 536 slots
costs 81ms of init, once, on a hot-reload nobody watches.

### The numbers that matter — populated project (e05b, 54 tracks / 387 clips)

Built in a scratch project (+48 instrument tracks × 8 clips), measured, then
torn down by channelId set-difference.

| config | construct | warm-up | **full scan** | ping p50/p95 | visible |
|---|---|---|---|---|---|
| 32×32 (undersized) | 5.7ms | 127ms | 748µs | 23.9 / 25.8 | **32 tracks / 227 clips** |
| 64×64 | 7.8ms | 116ms | 3 261µs | 23.8 / 25.3 | 54 / 387 |
| 128×128 | 17.2ms | 112ms | **6 235µs** | 24.1 / 25.3 | 54 / 387 |
| 256×128 | 33.1ms | 115ms | 5 019µs | 23.7 / 25.3 | 54 / 387 |

- **Init/warm-up/latency stayed flat under load.** Loading the bank with real
  tracks and clips did not change init cost or thread latency at all.
- **The one cost that DOES scale with content is a full bank scan** — it
  loops scenes × *existing* tracks: 3.3ms at 64 scenes, 6.2ms at 128. This is
  a per-*operation* tax, not an init tax, and it is our own handler's shape.
  Routine addressing (`resolveByChannelId`) only touches track rows, never
  slots, so it does not pay this.
- **Ping p50 is pinned at ~24ms in every single configuration.** That is the
  control-surface tick floor (matching E1's ~25ms settle), not a load signal —
  it never moved, so we never found load. The only p95 excursion in the whole
  matrix was gridSteps=512 (34.5ms), the largest single allocation.

### The real constraint: the bank window is a HARD CAP

With a 54-track project and TRACKS=32, **22 tracks and 160 clips were simply
invisible** — not slow, absent. `channelId` (E2f) resolves only inside the
window, so:

- **Scaffold size bounds the maximum addressable project size**, exactly as
  the plan suspected. Tracks past the window cannot be addressed, and their
  clips cannot be snapshotted — a **checkpoint blind spot**, which is worse
  than a perf problem: a revert could silently miss state it never saw.
- ⇒ Phase 1 must **detect** window overflow (compare bank-visible count
  against the project's true track count) and refuse/flag rather than operate
  half-blind. Do not treat bank size as a tuning knob.

### Recommended shipped sizes (evidence-backed)

Since cost is linear-and-negligible and undersizing is a correctness failure,
**size generously**: `TRACKS=256`, `SCENES=128`, `CURSOR_POOL=8`,
`DEVICE_BANK=16`, `paramHandles=64`, `GRID_STEPS=128` (+ the fine cursor).
That is ~50ms of init — imperceptible — and covers projects far larger than
this one will realistically drive. Keep them **config-tunable**; `RigConfig`
already is exactly that mechanism and is worth carrying into Phase 1.

### Cold start + project-open — measured (E5c), caveat closed

The above was hot-reload init only. Probe `e05c` records a live timeline
(ping RTT for control-surface stalls + `rig.scanTracks` for bank population),
detecting project transitions and bridge outages on its own. The same
48-track project was saved to disk and opened at **256×128** and at **16×16**;
Bitwig's own load time cancels between the two rounds.

| event | rig | bank settle | max RTT | stalls |
|---|---|---|---|---|
| New Project (54→4 tracks) | 256×128 | 28ms | 24ms | 0 |
| Open saved project (0→54, 387 clips) | 256×128 | <1 sample | 23ms | 0 |
| **Cold start** (quit + relaunch) | 256×128 | 25ms | 28ms | 0 |
| Open saved project after relaunch | 256×128 | <1 sample | 23ms | 0 |
| New Project (16→4) | 16×16 | 15ms | 25ms | 0 |
| Open saved project (0→16, 99 clips) | 16×16 | <1 sample | 24ms | 0 |

- **Cold-start init = 108.3ms** at 256×128, vs 33–43ms for the same rig on a
  hot reload — a cold JVM with Bitwig launching around it costs ~3×. It is
  still 108ms inside a **13.4-second** application launch (~0.8% of it).
- **Project-open cost is not measurable.** Bank repopulation finished inside
  one sample period at both rig sizes, and **no ping exceeded 28ms in the
  entire session — zero stalls** (threshold 100ms). The scaffold never
  blocked the control-surface thread.
- ⚠ **Do not read the "0ms/1ms settle" figures as literal.** The recorder's
  sampling period is ~50–75ms (each iteration pays the ~24ms tick twice), so
  the honest claim is *below measurement resolution*, not *instant*.
- ⚠ The 16×16 round is a **floor, not a like-for-like control**: at that size
  the rig only sees 16 of the 54 tracks, so it has less to populate partly
  because it is blind to the rest. It confirms nothing pathological happens
  at small sizes; round 1 is the load-bearing evidence.

**Bonus — E2f re-confirmed at scale.** Teardown resolved and deleted **all 48
tracks by channelId** using UUIDs captured *before* the project was saved,
before a full Bitwig quit + relaunch, and before the project was reopened.
48/48 resolved, 0 absent, 0 pre-existing tracks harmed. channelId persistence
across save/restart now holds at 48 tracks, not just the 6 of E2f.

### Caveats — what these numbers do NOT cover

- **The populated project was synthetic**: empty instrument tracks with empty
  clips, no devices/plugins. A real 54-track project has a device chain per
  track, and `DEVICE_BANK` observers stream per chain. Device-side scale is
  unmeasured.
- **Heap figures in the probe output are noise** — whole-JVM, shared with
  Bitwig, GC-dependent (they swing 282M→1186M between adjacent rows). They
  are logged for trend only and should not be read as extension cost.
- The `paramHandles=256` config cycles the 16 curated Polysynth IDs, so it
  measures *handle allocation* cost, not 256 distinct params.

### Decision impact

- **§12 #5 answered ●.** No knee below 65k slots; pre-allocation is not the
  scaling risk §3a treated it as. Ship generous sizes (above), config-tunable.
- **New correctness rule → DECISIONS:** bank-window overflow is a checkpoint
  hazard. Detect it and fail loudly; never operate on a partially-visible
  project.
- **Batch executor:** a full bank scan is ~3–6ms, cheap enough to do freely
  but not per-op in a tight loop; prefer channelId resolution, which skips
  slot iteration entirely.
- **Carry forward:** `RigConfig` + the `rig.stats`/`rig.scanTracks` handlers
  are Phase-1-quality and worth lifting; the config+hot-reload loop is a
  reusable measurement rig. `e05c`'s recorder (transition + stall detection
  tolerant of bridge outages) is the tool for any future latency question.
- **Cold start costs ~108ms of a ~13s launch** — no reason to lazy-init or
  tier the scaffold. Allocate everything up front, as §3a intended.

---

## API surface sweep (2026-07-19)

Systematic pass after the two misses, using both tools. **member-search-index
(complete recall) is primary** — the DirectParameter core methods we missed
are API version **1**, invisible to any recent-versions scan; only the full
member index surfaces old-but-unnoticed capabilities. new-list.html is
secondary (recent additions only).

### Recent additions (API 19→25, from new-list.html) — design-relevant

- **`DuplicableObject.duplicateObject()` (v19)** + `ControllerHost
  .duplicateObjects` — clean structural duplication primitive for
  clips/tracks/scenes; better than copy/paste actions. Feeds the Create
  column and a cheap "duplicate this clip" op.
- **`RangedValue.discreteValueCount()` (v20) + `discreteValueNames()`
  (v23)** — stepped/enum **param introspection**: tells continuous from
  discrete params and gives enum option names (filter type "LP/HP/BP").
  Real refinement for the §6a param layer/catalog — a 3-position switch
  must not take an arbitrary 0..1. Adopt in the param model.
- **`RangedValue.getOrigin()` (v20)** — a param's default/center (e.g. pan
  center); useful for reset and relative edits.
- **`Parameter.hasAutomation()` / `deleteAllAutomation()` (v19)** —
  **checkpoint-fidelity flag**: an automated param won't hold a static
  write (automation overrides it). Revert-correctness must check this.
- **`Track.createTrackBank/createMainTrackBank/createEffectTrackBank`
  (v25)** — per-track scoped banks for **group-track navigation** (children
  of a group). Our host-level flat bank covers top level; these reach
  nested tracks if projects use groups.
- **`TrackBank.setSupportsDeviceChainChannels` (v24)** — affects whether
  device-chain channels appear in a bank; awareness flag.
- Swept, NOT applicable: MasterRecorder (v20), createLastClickedParameter
  (v20, selection-following — against our model), ScrollbarModel/Timeline
  zoom (v21), MidiIn.hardwareAddress (v21), audio-hardware I/O matchers
  (v22), channelIndex (v22, the mutable index).

### Complete-recall concept grep (member-search-index, ALL versions)

- **Modulators — §12 #6 answered ◐ (was "entirely unknown," not ○):**
  `Device.getModulationSource(int)`, `Macro.getModulationSource()`,
  `ModulationSource.{isMapped,isMapping,toggleIsMapping,name}`,
  `Parameter.modulatedValue()` (read post-modulation value). So existing
  modulation sources are accessible and mapping is togglable (the
  enter-mapping-mode-then-touch-a-param idiom). **Creation** of a modulator
  is likely via device insertion (modulators are devices w/ UUIDs) — to
  verify. Promote §12 #6 from unknown to "partial, probe in E7".
- **Device layers (nested chains):** `Device.hasLayers()`,
  `createLayerBank(int)`, `createCursorLayer()`, `DeviceLayerBank
  .getChannel(int)`, `CursorDevice.selectFirst/LastInLayer(int)`. This is
  how to address INTO layered instruments / drum machines / FX layers —
  our device model is top-level-chain only so far. Needed for deep device
  work (drum pads, instrument layers).
- **Full browser session API (richer than §6 assumed):** typed sessions —
  `Browser.get{Preset,Device,Sample,Music,Clip,MultiSample}Session()`,
  `createSessionBank`, `startBrowsing/commitSelectedResult/cancelBrowsing`,
  `shouldAudition`; `BrowserColumn.createItemBank/entryCount`. Still modal/
  stateful, but a real typed content-search surface, not just a popup.
  Keeps `insertBitwigDevice(UUID)`/`insertFile(path)` as the simple path,
  browser as the search fallback (as §6 concluded) — but the fallback is
  more capable than recorded.
- **Rich duplication primitives:** `Clip.duplicate()`,
  `Clip.duplicateContent()` (double a pattern in place — nice compositional
  op), `ClipLauncherSlot.duplicateClip()`, `ClipLauncherSlotBank
  .duplicateClip(int)`, `Channel.duplicate()`. Multiple clean "copy"
  routes for structural ops.
- **Groove engine:** `ControllerHost.createGroove()`, `Groove
  .{getShuffleAmount,getShuffleRate,getAccentAmount,getAccentPhase,
  getAccentRate,getEnabled}` — global shuffle/accent; a lever for
  feel/humanization beyond per-note timing.
- **Quantize:** `Clip.quantize(double)` (a §8b "clean prior-state, no
  inverse" op), `Application.recordQuantizationGrid/recordQuantizeNoteLength`.
- **Remote controls (the 8/page path we superseded):** confirmed present
  (`Device.createCursorRemoteControlsPage`, `RemoteControlsPage
  .getParameter(int)`, `pageCount/pageNames`) — deprioritized given
  createParameter + DirectParameter give unrestricted access.

### Decision impact

- Param model adopts discrete/enum introspection (`discreteValueCount` +
  `discreteValueNames`) and an `hasAutomation` fidelity check.
- Structural ops gain `duplicateObject`/`duplicateContent` as first-class
  primitives (create-with-content, pattern doubling).
- New scoped experiments to slot into the plan: **device layers** (deep
  device addressing) and a real **modulators** probe (E7 upgraded from
  "expect ○" to "partial surface exists").
- Group-track navigation (`Track.createTrackBank`) noted for projects with
  groups; our flat host bank remains the default.

---

## Method: how we verify the API surface

Two misses (CLAP DirectParameter API, `channelId`) traced to the SAME
recall failure: grepping individual javadoc class pages for methods already
suspected to exist. High precision, low recall. Corrected method:

- **Authoritative sources are bundled and prose-complete** at
  `/Applications/Bitwig Studio.app/Contents/Resources/Documentation/control-surface/api/`
  — full Javadoc with method-level prose ("Reports the channel UUID"; the
  take-over-strategy caveat on `set()`; observer semantics), "Since" version
  tags, superinterface/inherited-method links. There is **no separate
  conceptual scripting guide bundled** (only this javadoc + hardware PDFs).
- **For complete recall, grep the search index, not class pages:**
  `member-search-index.js` lists **all 1968 members** across every class;
  one grep for a concept ("channelId", "DirectParameter") surfaces every
  match regardless of which class it's on. This catches things a
  Track-scoped grep misses (e.g. identity lives on supertype `Channel`).
- **Mine `new-list.html` by API version — but know its limit:** it catches
  capabilities *recently added* (channelId=20, createParameter=12) that
  prior art predates. It does NOT catch old-but-missed capabilities — the
  DirectParameter core is API **1** and invisible here. So new-list is a
  supplement; member-search-index is the recall backstop.
- **Read whole class pages incl. "All Superinterfaces" + inherited
  methods** before concluding a capability is absent.
- **Empirical testing remains essential — the prose does NOT document
  behavior.** Every behavioral gotcha we hit was undocumented: gain reads
  2×, `setGain`/`setTimbre` clobber pressure, scene deletion compacts rows,
  empty-slot pointing silently no-ops, `set()` swallowed by take-over,
  direct-write needs `resolution=1`. Docs describe the surface; only
  driving the live API reveals the behavior.
- **Rule: never record a capability ○ from a partial pass.** Confirm
  against member-search-index + new-list + a live probe first.
- **⚠ Some deprecations are FATAL, not soft (E7).** Before wiring any handle at
  init, check the javadoc interface/method for `@Deprecated`: methods like
  `Device.getModulationSource`, `Device.getMacro`, and the whole `Macro`/
  `ModulationSource` family call Bitwig's `deprecatedFail`, which **throws** —
  calling one in the `Rig` constructor aborts `init()` and crashes the
  extension with a user popup (bridge never binds). A deprecated method here is
  a load-time crash, not a runtime no-op. Grep the app-bundle javadoc for
  `Deprecated` on the interface line and every method you intend to call.
- **THE RECURRING FAILURE MODE — four instances now.** Every false negative
  in this spike came from testing *one* mechanism and generalising to "the
  API cannot do this":
  1. CLAP params ○ — checked only the typed path, missed DirectParameter.
  2. Track identity ○ — checked `Track`, missed `channelId` on `Channel`.
  3. Chain creation ○ (E4c) — checked only layer-index insertion, missed
     drum pads, `insertFile`, and container duplication (E4d).
  4. Drum Machine "absent from the bundle" (E4c) — a brittle anchored grep
     against a binary format, defeated by an invisible length byte.
  **Countermeasure, now mandatory before any ○:** enumerate *every* type that
  could carry the capability (walk supertypes: `DrumPad` has an
  `insertionPoint()` that `DeviceLayer` does not); enumerate *every* verb
  (`insert*`, `duplicate*`, `copy*`, `move*`, `paste`, `insertFile`, named
  actions); and prefer structured extraction over text matching when reading
  Bitwig's binary formats. Three of the four misses were found only because
  someone pushed back on a confident negative.

---
