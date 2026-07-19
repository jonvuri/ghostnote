# ghostnote spike — findings log

One section per experiment, appended as run. Verdicts: ● confirmed working /
◐ partial / ○ failed or unavailable.

---

## E5 — Scale limits (§12 #5, the last open question) (2026-07-19)

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

---

## E4b — CLAP params via the DirectParameter API (2026-07-19)

**Verdict: ● CLAP direct params ARE accessible — my E4 negative was wrong.**
Prompted by a challenge to the E4 CLAP claim. The typed specific-device
path has no CLAP variant, but `Device` carries a second, **format-agnostic
`DirectParameter` API** (the older one `createParameter` "replaced") that
works on CLAP, VST, and Bitwig devices alike. Probe `e04b`.

### What works (proven on a real CLAP: Stochas, `org.surge-synth-team.stochas`)

- **Self-enumeration**: `addDirectParameterIdObserver` emits an array of
  **all** param IDs — no IDs known upfront (unlike `createParameter`).
  Stochas: 55 params; Polysynth via the same API: 55 params.
- **Names**: `addDirectParameterNameObserver(maxChars, cb)` → per-id names
  ("L1 speed", "L1 steps/measure", "OSC1 Pulse Width", "AEG Attack"). All
  55 named on both devices.
- **Values**: `addDirectParameterNormalizedValueObserver(cb)` → per-id 0..1
  (Polysynth reported real defaults: Attack 0.07, Sustain 0.95).
- **Writes**: `setDirectParameterValueNormalized(id, value, resolution)`
  works on Bitwig F1FREQ (0.693→0.200). **⚠ resolution matters:**
  `resolution=1` took; `resolution=128` did NOT within 1.5s. Use
  `resolution=1` (or investigate the intended semantics). Stochas's own
  params didn't move on write — plugin-specific (some plugins reject host
  writes / gate on host-automation state), not an API limit.

### Mechanism comparison — two parameter APIs, pick per case

| | `createParameter` (E4) | `DirectParameter` (E4b) |
|---|---|---|
| Devices | VST2/VST3/Bitwig (typed) | **any incl. CLAP** |
| Discovery | IDs/indices known upfront | **self-enumerates all IDs** |
| Access | pull (`get()`) | **push (observers, init-time)** |
| Handles | pre-allocated at init | one observer set per cursor device |
| Displays | ✅ `displayedValue()` ("2.59 kHz") | ◐ observer didn't populate (below) |
| Writes | `setImmediately` | `setDirectParameterValueNormalized(…,1)` |

**Implication for the param layer:** DirectParameter is the better
*discovery/enumeration* primitive (self-listing, format-agnostic, one
observer set covers any pointed device) and reaches CLAP. `createParameter`
remains better where displayed values and stable pull-reads matter (Bitwig
internal, known VST indices). A pool cursor-device can carry BOTH: direct
observers for enumeration + typed handles for the devices we deeply support.

### Open detail (not blocking)

- **`addDirectParameterValueDisplayObserver` didn't populate** display
  strings for either device (names/values did). Hypothesis: the display
  channel is **page-scoped** (the DirectParameter API has
  `setParameterPage`/`nextParameterPage`/`isParameterPageSectionVisible`),
  so displays may only stream for the active parameter page, needing page
  navigation to cover all params. Deferred; displayed values are available
  anyway via `createParameter` for typed devices, and normalized values
  suffice for CLAP readback. Revisit in Phase 1 if CLAP display strings are
  wanted.

### Decision impact (updates E4)

- **CLAP is IN scope for direct params** (enumerate + name + value + write),
  via DirectParameter. §6a "VST/CLAP" claim restored for CLAP; the
  differentiator is broader than E4 concluded.
- Param layer carries two APIs by role: DirectParameter for enumeration/CLAP,
  createParameter for typed pull-reads + displays.
- Write via DirectParameter: pass `resolution=1`.
- **Lesson:** a negative capability claim from a single missing-method grep
  is unsafe in this API — verify against the whole `Device` surface + a live
  test before recording an ○. (Good catch by the user.)

---

## E4 — Direct parameter layer (§6a differentiator) (2026-07-19)

**Verdict: ● the differentiating capability WORKS and exceeds the plan.**
`createParameter` gives named, valued, settable, repointable handles far
past the 8-per-remote-page ceiling, and the Bitwig-internal param IDs —
INITIAL_PROMPT's "harder case" needing semi-manual harvesting — turn out
to be **sitting in the app bundle as plain text**. Probe `e04`, all green.

### Enumeration proof (§6a "effective enumeration")

Pre-allocated 16 `SpecificBitwigDevice.createParameter(String id)` handles
on a repointable cursor device. Pointed at a freshly-inserted Polysynth,
14/16 resolved (2 harvested IDs were section markers, not params), each
**self-describing**: name + normalized value + human displayed value, e.g.
`F1FREQ="Filter Frequency"=2.59 kHz`, `F1RESO="Filter Resonance"=39.5 %`,
`OSCMIX="OSC 1/2 Mix"=0.00 %`. This is the WigAI issue-#15 gap closed:
arbitrary count of named params, not capped at 8. Params became live
**~194ms after device insert** (device insert itself ~144ms).

### Param ID harvesting — much easier than assumed (§6a upgrade)

Bitwig-internal device param IDs are readable straight from
`…/Bitwig Studio.app/Contents/Resources/Library/device-settings/<uuid>/
Default.bwpreset` (`strings | grep -E '^[A-Z][A-Z0-9_]{2,}$'`). Polysynth
yielded 63 tokens, ~14/16 sampled were valid createParameter IDs (rest are
section markers: CONTENTS, MODULATORS, FAKE1…). **No `can-copy-device-and-
param-ids` context-menu workflow needed** — the whole internal-device
catalog is harvestable offline from the bundle. Promotes §6a's "one-time
semi-manual harvest, plausibly a community artifact" to "a script over the
app bundle." (Validity still needs a resolve-check per ID against a live
device, since presets include non-param tokens.)

### Read/write + the take-over trap

- **`param.value().setImmediately(v)` works** (0..1 normalized); round-trips
  exactly and the displayed string tracks it (`0.25`→"75.4 Hz",
  `0.8`→"6.08 kHz").
- **⚠ `param.value().set(v)` is SILENTLY SWALLOWED** by the controller's
  take-over strategy (a plain `set` "may not be set immediately if the user
  configured a take over strategy" — value stayed exactly at the preset
  default). ⇒ **all agent param writes must use `setImmediately`, never
  `set`.** This is the param-layer analogue of E2's gain/pressure traps:
  another silent-no-op write path that only readback verification would
  catch. → DECISIONS.

### Repointing — the pre-allocation architecture question, ANSWERED

`createParameter` handles bind to the **cursor device**, not a fixed slot,
and follow it as it repoints:
- **Within a chain:** `selectDevice(bank.getDevice(i))` moved the cursor
  across two Polysynths; the same 16 handles read/wrote each independently
  (device[1] F1FREQ=0.1 vs device[0]=0.8, no cross-talk).
- **Across tracks:** pointing the parent cursor-track at gn-B moved the
  device cursor (FIRST_INSTRUMENT follow) to gn-B's device; handles read it.
- ⇒ **the §3a "pre-allocate a pool, repoint" strategy applies to params
  exactly as it did to clips (E1).** A modest pool of cursor-devices ×
  N param handles covers the session; no per-slot allocation explosion.

### Type specificity + pinning subtleties

- **`SpecificBitwigDevice(uuid)` view is device-type-specific:** pointed at
  a Polymer, all Polysynth param handles report `exists=false`. So a param
  pool must carry a view **per device type** we want deep access to (the
  cursor device itself still enumerates any device's name/position). Per-type
  ID catalogs are the unit of the eventual catalog.
- **Device-cursor `isPinned` is subordinate to its track cursor:** pinning
  the device cursor does NOT hold the device when its parent cursor-track is
  repointed (params jumped to gn-A's device after a track move). **The
  robust hold is: pin the TRACK cursor (E1) + address the device by
  `selectDevice(index)`.** With the track pinned, params stayed on gn-B's
  device (GAIN=0.33) under a selection change. → DECISIONS: device pool
  addressing = pinned track cursor + explicit device index, not device-pin.

### Scope note (superseded by E4b)

- The **typed** specific-device path is VST2/VST3/Bitwig only — no
  `createSpecificClapDevice`. My first reading ("CLAP direct params NOT
  accessible") was **WRONG**: it ruled out one path and missed the
  format-agnostic `DirectParameter` API. See E4b — CLAP params ARE
  accessible. VST index-path (`SpecificPluginDevice.createParameter(int)`)
  still unexercised (needs a known VST id-at-init); deferred.

### Decision impact

- **§6a differentiator confirmed buildable** — named/valued param access at
  arbitrary count, repointable via the pool model, with an offline-harvestable
  internal-device catalog. This is the genuinely novel capability and it holds.
- **Writes: `setImmediately` only** (take-over swallows `set`).
- **Device addressing model:** pinned track cursor + `selectDevice(index)`;
  per-device-type `SpecificBitwigDevice` views; pool of cursor-devices ×
  param handles sized in E5.
- **Param catalog:** promote to a straightforward Phase-1/2 deliverable
  (harvest bundle → resolve-check per device). CLAP excluded; VST via index.

---

## E3 — Structural ops & revert correctness (2026-07-19)

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

## E2 — Note round-trip fidelity, grid, observer gotcha (2026-07-18)

**Verdict: ● §5's "Exact" checkpoint-fidelity claim holds for the note
surface, with one asterisk (gain).** Probes: `e02` (full sweep, partially
contaminated by external project-state changes mid-run) + `e02b`
(clean re-characterization on known clips).

### Write/read mechanics

- **`setStep` is NOT visible in the same request** — immediate `getStep`
  after `setStep` in one handler returns `Empty`. It IS visible on the
  next request (~25ms incl. round-trip). ⇒ readback verification (§8c)
  must be a separate tick after the write batch, never inline.
- **`getStep` scan cost is trivial:** 512×128 grid = 65k steps scans in
  2–10ms; 64×128 in ~0.4–1ms. Full-clip snapshots are effectively free.
- **Observer gotcha, precisely characterized:** `getStep`/`NoteStep` needs
  NO subscription at all (works on a cursor with zero `markInterested`).
  Every `Value.get()` (exists, name, position…) throws
  `"Either call markInterested() or add at least one observer in init"`
  without a mark. ⇒ mark everything scalar; note data is implicit.
- **Muted notes remain visible** to the NoteOn scan with `isMuted=true` —
  snapshots see them.

### Expression property fidelity (21-property sweep; re-verified on clean fixture)

All setters accepted; round-trip exact (±2e-3) for: velocity,
releaseVelocity, velocitySpread, duration, pan, timbre (float noise only),
transpose (fractional ok), chance+enable, occurrence (enum)+enable,
recurrence (length+mask)+enable, repeat count/curve/velocityCurve/
velocityEnd+enable, isMuted. Two API quirks, both now precisely modeled:

- **`gain` reads back 2× the written value** (reproducible on clean
  state: set 0.7 → immediate read 0.7 [cached] → settled read 1.4; javadoc
  claims 0..1 both ways). Checkpoint restore mapping: write `read/2`.
  Verify the inverse mapping holds in Phase 1; likely a Bitwig doc/API bug.
- **`setGain` and `setTimbre` each RESET `pressure` to 0** (isolated in
  e02e; every other property is innocent; pressure re-set afterwards
  sticks). ⇒ property-write ordering rule: **pressure last** (or at least
  after gain/timbre) in any note-property batch — and §8c readback
  verification catches violations structurally.

### Grid

- **`setStepSize` works at runtime** (note at beat 1.0 re-indexed 4→8
  after 0.25→0.125 switch; needs a settle wait — not instant).
- **Triplet grids work** (stepSize 1/6 round-trips).
- **Off-grid notes are visible on coarser grids, snapped DOWN** (a note
  at beat 0.09375 scans as x=0 on the 0.25 grid) — coarse scans don't
  lose notes but misreport positions; snapshots should scan at the
  finest grid.
- ⇒ grid is a *view*; resolution is per-cursor and changeable. The
  contract can stay beats-native and quantize per operation to a chosen
  grid; no global init-time grid needed (daw-mcp's design was
  unnecessarily rigid).

### Addressing corollaries (feed the batch executor design)

- **Pointing at an EMPTY slot silently lands the cursor on the WRONG
  clip** — observed staying on the previous clip in one trial and
  attaching to a different clip on the target track (slot 0) in another;
  in both cases status looks healthy. ⇒ create-clip must precede
  pointing; the executor MUST verify the cursor's target (track position
  + scene index) before every write — a mis-point is undetectable
  afterwards from the cursor's own state.
- **No stale reads after clip deletion:** `ClipLauncherSlot.deleteObject()`
  (works, ~24ms) leaves the cursor with `exists=false`, scan returns 0
  notes. Cursor reads are trustworthy when `exists=true` + target
  verified.
- **The e02 cross-session anomalies are fully resolved by E2c** (track
  identity bug — see that section): the "fixture" was actually the FX and
  Master rows. Bonus discovery: `createNewLauncherClip` + full note
  editing WORKS on FX/Master launcher slots. After cleanup (E2d) the
  whole E1a + E2 suite re-ran green on a genuine instrument-track
  fixture.
- **Arranger cursor clip:** created fine; `exists=false` with no
  arrangement clip selected. Deeper arrangement probing stays out of
  scope (§9 lean).

### Decision impact

- Checkpoint design (§8b): full-fidelity note snapshots are cheap and
  exact (gain excepted) — snapshot = verbose scan of the write-set clips.
- Readback loop: write → next-tick verify → report; ~25ms per turn.
- Units (§7): contract in beats; extension quantizes via per-op stepSize.
- E3 signals banked: both Track and ClipLauncherSlot `deleteObject()`
  confirmed working.

---

## E2f — Stable track identity DOES exist: channelId (UUID) (2026-07-19)

**Verdict: ● E2c's "no stable track addressing" was too strong — I missed
`Channel.channelId()`, a per-track UUID (API 20+).** Prompted by the same
"did we miss part of the API?" challenge that surfaced CLAP. Probe `e02f`,
all green. bank index and name remain brittle (E2c stands on those), but
they are **not the only identifiers** — there is a stable one.

### What channelId is

`track.channelId()` → `StringValue`, javadoc "Reports the channel UUID."
Every track (incl. FX and Master) reports a distinct, UUID-shaped id, e.g.
gn-A = `b07f6b06-8f4f-4f4f-802d-ddf1a5190515`. (`channelIndex()`, API 22,
also exists but is just the mutable index as a value.)

### Proven stable (in-session)

- **Survives index shifts:** inserting a track ahead of gn-A/gn-B shifted
  their positions but their channelIds (and the tracks they name) were
  unchanged.
- **Survives rename:** renaming gn-A→"renamed-A" left channelId identical.
- **Clean tombstone:** a deleted track's UUID resolves to found=false — no
  aliasing onto whatever slid into its index.
- **Re-resolvable:** scanning the bank for a matching channelId returns the
  track's *current* index/name/type — the addressing primitive
  (`track.resolveByChannelId`). gn-A's UUID was byte-identical across
  separate probe runs and all structural churn this session; a
  delete+recreate of gn-B correctly minted a NEW UUID (recreated = new
  object).

### The addressing model this unlocks

**Address tracks by channelId, resolve to a live index/object on demand.**
This is the serializable identity E2c said was missing:
- Store channelId in patches/checkpoints, not bank index or name.
- On each operation, `resolveByChannelId` → current index → point a pool
  cursor (E1). Combines with E1's pinned-cursor *in-session* handle: UUID
  is the durable key, the pinned cursor is the fast live handle.
- The E2c fixture bug (identifying a created track by "last Instrument"
  positional heuristic → renamed/deleted the wrong track) is exactly what
  UUID-diff prevents. **The corrected probe identifies a newly-created
  track as "the channelId not present before"** — robust regardless of
  where `createInstrumentTrack` actually drops it (which E2f re-confirmed
  is inconsistent: the newcomer landed at index 0 here vs index 1 in E2c).

### Cross-SESSION persistence — ● CONFIRMED

User saved the project, fully quit Bitwig, and reopened. All six tracks'
channelIds matched the captured UUIDs **byte-for-byte** (gn-A
`b07f6b06-…`, gn-B `9096b9f6-…`, plus Inst 1/Audio 2/FX 1/Master).
channelId is a **persistent, serializable** identity that survives a full
application restart + project reload — exactly the durable key checkpoints
need. (Recreated tracks get a fresh UUID; a given track keeps its UUID for
the life of the project.)

### Decision impact (amends E2c)

- **Track addressing = channelId (UUID) as the stable key + resolve-to-index
  + pool cursor.** Supersedes "no stable addressing"; E2c's brittleness
  finding now applies specifically to *index and name*, not identity.
- Checkpoints/patches serialize channelIds, never indices/names.
- Same question worth checking for clips/scenes/devices: is there an
  equivalent stable id? (Slots are addressed within a track; scenes have
  `sceneIndex` which E3 showed shifts. Worth a pass in Phase 1.)
- **Lesson reinforced (twice now): don't record a capability ○ from a
  partial API pass.** channelId (API 20) and the DirectParameter API were
  both present and both initially missed.

---

## E2c — Track identity: the fixture-contamination root cause (2026-07-18)

> **Amended by E2f:** the "no stable track addressing" conclusion is too
> strong — `channelId()` (UUID) IS stable. This section's brittleness
> findings apply to **bank index and name specifically**, which remain the
> wrong things to address by. Read with E2f.

**Verdict: ● the cross-session anomalies were OUR bug — addressing tracks
by (bank index | name) is unsound. Three API facts, all confirmed by
controlled trials (`e02c`):**

1. **The flat TrackBank includes the FX section and the MASTER track**
   after the regular tracks. `trackType()` distinguishes them
   (Instrument/Audio/Effect/Master/Hybrid/Group). daw-mcp-derived code
   treated bank size as "number of regular tracks" — wrong.
2. **`Application.createInstrumentTrack(position)` does not honor bank
   positions:** requesting the end (9) landed at index 7 (end of the
   *regular* section, before FX/Master); requesting 0 landed at index 1.
   The position argument cannot be trusted; the only safe procedure is
   create → diff the bank → locate the new row empirically.
3. **Default track names auto-renumber** ("Inst 2", "Audio 3" are
   positional auto-names, not stable identities). Name-based identity is
   meaningless for unnamed tracks, and `setName(bankIndex)` renames
   whatever currently sits at that index.

**Combined effect on E1/E2 sessions:** every `ensureFixtureTracks` run
created a track that landed *not* at the assumed index, then renamed the
wrong row — accumulating orphaned "Inst N" tracks and, at least once,
sticking the fixture name onto the tail of the bank (the row typed
Master now carries the name "gn-A"). Cross-session name lookups then
found the wrong tracks, explaining the E2 phase D/E anomalies and the
user's "gn-A wasn't there" observation. In-session fingerprint-verified
results (all of E1's core verdicts, E2's mechanics) are self-consistent
and stand.

**Resolution (same day):** user visually confirmed (screenshots): the
Master row was named "gn-A", fixture clips lived on the FX/Master rows,
and the default template was Inst+Audio+FX+Master — every extra
Instrument row was a ghostnote orphan. Cleanup probe (`e02d`) removed
our clips from FX/Master, restored the Master name, and deleted the five
verified-empty orphans; fixture code (`lib.ensureFixtureTracks`) now
matches by name+type, locates created tracks as last-Instrument-row, and
poll-verifies renames. E1a and E2 both re-ran green on the clean fixture.

**Decision impact (batch executor / contract):**
- Track creation in the contract must return the *located* new track
  (create → diff → verify), never assume the requested position.
- All track addressing must be type-aware; Effect/Master rows are never
  fixture/rename/delete targets by index.
- Rename operations must poll-verify the rename landed where intended.
- This is the strongest argument yet for §8e verification semantics:
  every structural op needs its own readback, not just note writes.

---

## E1 — Addressing: pointing, pinning, cursor pool (2026-07-18)

**Verdict: ● address-don't-select is achievable.** The pool-of-cursors
architecture works: writes land on programmatically chosen clips and are
immune to concurrent user interaction. E1a: 26/28 (the 2 "failures" were
mechanism discovery, see below). E1b (interactive): all real checks passed;
the one FAIL was a mis-designed control test (see 4).

### The working architecture

Per pool slot: a dedicated `CursorTrack` created with
`shouldFollowSelection=false` + its `PinnableCursorClip`
(`cursorTrack.createLauncherCursorClip(w, h)`). Pointing mechanism —
the only one of three candidates that works (**"trackThenSlot"**):

```java
cursorTrack.selectChannel(trackBank.getItemAt(t));  // point the track
track.selectSlot(s);                                 // point the slot
// then pin: cursorClip.isPinned().set(true)
```

Settle is **~25ms, verifiable by polling** `clip.getTrack().position()` +
`clip.clipLauncherSlot().sceneIndex()` — vs. daw-mcp's blind 400ms sleep.

Rejected mechanisms: `slot.select()` alone (pool clips do not follow
global clip selection — their cursor tracks don't follow, and the clip
cursor is scoped to its track) and `CursorClip.selectClip(followerClip)`
(does not repoint cross-track; timed out).

### Evidence highlights

1. **Pool independence ●** — 3 cursors pinned to 3 different clips
   concurrently, each reads back its own fingerprint.
2. **User-interference immunity ●** — 20/20 write+readback cycles correct
   while the user clicked continuously around the session view
   (27 selection changes observed during the test window).
3. **Structural shift: pins follow the object ●** — creating a track at
   position 0 shifted the pinned cursor's reported position +1 with
   content intact; deleting restored it. Bank *indices* drift (fixture
   moved between sessions in testing) ⇒ the brain must resolve addresses
   to objects (via pointed cursors), never store raw bank indices.
4. **Selection-following is opt-in by construction ●** — pool cursors
   never follow user selection even unpinned (`followSelection=false` at
   creation). The E1b "control test" FAIL was this architecture working:
   the test wrongly expected an unpinned pool cursor to follow a click
   (compounded by clicking an already-selected clip = no change event).
   Pinning is belt-and-suspenders on top of a non-following cursor.
5. **`Track.deleteObject()` works ●** (~144ms settle) — early E3 positive:
   structural revert has a delete primitive at least for tracks.

### Wrinkles / carried questions

- **Pointing borrows the UI selection.** `selectSlot` visibly moves the
  user's selection (2 changes during 3-cursor setup; user confirmed
  visually). Not a correctness problem, but a UX wart under optimistic
  application. Phase-1 candidates: restore prior selection after a batch,
  and/or investigate selection-free pointing further. → DECISIONS.
- **Pin behavior when the user drags/moves the pinned clip is ambiguous ◐.**
  After drag-away, the cursor still reported sceneIndex=0 *and* 2 notes —
  consistent with either stale cached reads on a dead cursor or the drag
  not doing what we assumed. Needs a controlled retest in E2 including
  `clip.exists()` in every read (readback verification catches this class
  of problem regardless, per §8c).
- Reads on a non-existent/stale cursor may serve cached step data —
  E2 must characterize `getStep` behavior when `exists()` is false.

### Decision impact

- Addressing model (DECISIONS-to-be): **pool of pinned, non-following
  cursor tracks + clips; point via trackThenSlot; verify settle by poll;
  address objects, not indices.** Pool size TBD in E5.
- daw-mcp's `selectionDelayMs` approach is confirmed obsolete.
- §12 open question #1: answered **yes** (pinning survives user
  interaction), with the drag-a-pinned-clip caveat above.

---

## E0 — Toolchain bring-up (2026-07-18)

**Verdict: ● complete.** Extension builds, loads in Bitwig 6.0.6, and the
full TCP round-trip works. All 8 probe checks pass (`brain: npm run probe:e00`).

### Settled facts

| Item | Value |
|---|---|
| Bitwig | 6.0.6, reports `hostApiVersion` **25** at runtime |
| extension-api artifact | **25** (only version served on maven.bitwig.com; older versions are unpublished) |
| Extension runtime JVM | **Java 25** (Azul), bundled with Bitwig |
| Bytecode target | `--release 21` works; Bitwig's own bundled extensions are also major-65 (Java 21) |
| Build | Gradle 9.6 + local JDK 26 cross-compiling to 21; `gradle copyExtension` deploys |
| Transport | TCP loopback :8686, newline-delimited JSON-RPC 2.0 — confirmed incl. 20KB payloads, unicode, out-of-band error frames |
| Threading | requests marshaled via `host.scheduleTask` run on thread `"Control Surface Session"` |

### Gotchas discovered (the E0 blocker)

1. **Extension discovery is via ServiceLoader, not the manifest.** Bitwig 6
   requires `META-INF/services/com.bitwig.extension.ExtensionDefinition`
   listing the definition class. The `Extension-Class` manifest attribute
   (which daw-mcp's build.gradle sets) is ignored — daw-mcp's *released*
   jar contains the services file even though its Gradle build doesn't
   create it. Without it: `extension-registry error … No extensions found
   in <jar>`, and the extension silently never appears in the vendor list.
2. **The bundled javadoc's API-version annotations lag.** Newest "API
   version N" mentions in 6.0.6's bundled docs stop at 22, but the host
   actually serves 25. Trust `host.getHostApiVersion()` (or the maven
   artifact), not doc-annotation archaeology.
3. **Bitwig watches the Extensions folder and hot-reloads on file change.**
   Redeploying a running extension restarts it in place (bridge socket
   comes back up) — no Bitwig restart needed after the initial add. Errors
   from a failed scan appear in `~/Library/Logs/Bitwig/BitwigStudio.log`
   under `extension-registry`.
4. First-time activation is manual: Settings → Controllers → Add
   Controller → vendor "ghostnote" (no auto-detect with 0 MIDI ports).

### Decision impact

- Toolchain decision (DECISIONS-to-be): Java 21 target, extension-api 25,
  Gradle 9, Gson bundled. No obstacles found.
- Transport decision: TCP + newline JSON-RPC confirmed viable; strict
  per-line framing with -32700-and-continue verified (a malformed line
  does not poison the connection).
- Hot-reload (gotcha 3) makes the spike iteration loop fast:
  `gradle copyExtension` + rerun probe, no UI interaction.

---
