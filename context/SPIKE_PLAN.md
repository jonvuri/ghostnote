---
title: ghostnote — Spike Phase Plan
status: ready to execute (pending §2 pre-spike decisions)
updated: 2026-07-18
---

# ghostnote — Spike Phase Plan

> **Purpose.** Build *just enough* project shell — a real `.bwextension`
> talking to a real TS process over the real transport — to answer every
> open question in `INITIAL_PROMPT.md` §12 against live Bitwig, plus the
> infrastructure unknowns that gate design. The spike's **deliverable is
> not code**: it is `PROJECT_PLAN.md` + `DECISIONS.md` with all initial
> design decisions settled by evidence. Code is disposable-but-mineable;
> Java idioms should be written clean enough to lift into Phase 1.
>
> Reuse posture per `DAW_MCP_ANALYSIS.md`: clean repo, copy daw-mcp
> idioms liberally with attribution, fork nothing.

---

## 1. Environment facts (already confirmed)

- Bitwig Studio **6.0.6** installed at `/Applications/Bitwig Studio.app`,
  with bundled Controller API javadoc at
  `…/Contents/Resources/Documentation/control-surface/api/`.
- Local JDK: OpenJDK **26** (likely *newer* than Bitwig's embedded JVM —
  see E0; the extension must target the bytecode level Bitwig's runtime
  accepts, expected ≈ Java 21).
- `./daw-mcp` clone present, MIT-licensed, analyzed.
- `ghostnote/` is **not yet a git repo**.

## 2. Pre-spike decisions (settle before writing code)

Small enough to decide now; each blocks or shapes the shell. Recommendations
inline — objections should be raised before E0.

1. **Repo layout & git.** `git init` at `ghostnote/`; monorepo with
   `extension/` (Java) and `brain/` (TS), `context/` for docs,
   `context/spike/` for findings. Add `daw-mcp/` to `.gitignore` (reference
   quarry, not a dependency). *Recommended: yes, do exactly this.*
2. **JVM language: Java, not Kotlin** (revisit post-spike). Every reference
   codebase (daw-mcp, DrivenByMoss, WigAI, bitwig-extensions) is Java;
   copy-paste parity is worth more during a verification spike than
   language ergonomics. Settles §12 "JVM toolchain" provisionally.
3. **Spike harness is a raw TS CLI, not an MCP server.** A `probe.ts` that
   speaks newline-delimited JSON-RPC directly to the socket, with one small
   script per experiment. The MCP layer adds zero verification value and
   real friction (client lifecycle, stdio). A minimal MCP smoke test is the
   *last* experiment (E9), purely to de-risk SDK wiring.
4. **Protocol frame for the spike:** keep daw-mcp's JSON-RPC 2.0
   `category.action` over TCP with strict newline framing both sides.
   This is *scaffolding*, not the contract — the real versioned contract
   is a spike **output** (§5), designed after we know how batches must be
   sequenced. Don't gold-plate it now.
5. **MIDI channel:** carry `channel` explicitly in all note ops from day
   one (daw-mcp hardcodes 0). Free now, painful to retrofit; MPE later.
6. **Attribution:** add `NOTICE` crediting daw-mcp (MIT) before the first
   copied file lands.

## 3. The shell (what we build)

Minimum standing infrastructure, all of it in service of experiments:

```
ghostnote/
├── extension/                  # Java .bwextension "ghostnote"
│   ├── build.gradle            # from daw-mcp, API/Java bumped (E0)
│   └── src/.../
│       ├── GhostnoteExtension(Definition).java
│       ├── Bridge.java         # TCP + scheduleTask marshaling (from MCPServer.java, fixed framing)
│       └── ProbeHandlers.java  # grows one handler per experiment; throwaway but idiomatic
├── brain/
│   ├── src/client.ts           # TCP client (from daw-client.ts, manager stripped)
│   └── src/probes/eNN-*.ts     # one runnable script per experiment
├── context/
│   ├── INITIAL_PROMPT.md, DAW_MCP_ANALYSIS.md, SPIKE_PLAN.md (this doc)
│   └── spike/FINDINGS.md       # running evidence log (see §6)
└── NOTICE
```

Explicitly **not** built in the spike: MCP tool surface, tonal.js, patch
schema, checkpoint store, fake adapter, any persistence. (The fake-adapter
"build-early" item from §12 depends on the contract, which is a spike
output — it's the *first* Phase-1 task, not a spike task.)

## 4. Experiment matrix

Ordered by gating power: E0–E2 gate everything; E4 is the go/no-go on the
differentiator; the rest refine the plan. Each experiment states the
**question**, the **method**, and the **decision it settles**. Timebox the
whole matrix to roughly two weeks of evenings; individual timeboxes noted
where a rabbit hole is likely.

> **Status (2026-07-19): E0–E4 COMPLETE** (all ●, see `spike/FINDINGS.md`),
> plus follow-ups E2c/E2d/E2e/E2f (track identity + channelId), E4b (CLAP
> params via DirectParameter), and a full API surface sweep. Remaining:
> **E5–E9 + two new probes folded in below (E4c device layers, E7 upgraded).**
> Every §12 open question except #5 (scale) now has a verdict. The addressing,
> checkpoint, differentiator, and revert questions are all answered ●.

### E0 — Toolchain bring-up *(gates all)*
- **Q:** What extension-api version and Java target does Bitwig 6.0.6
  accept? Does the daw-mcp-derived Gradle build produce a loadable
  extension?
- **Method:** Query `maven.bitwig.com` for the latest `extension-api`;
  check Bitwig's bundled JVM version; build an empty extension that shows
  `host.showPopupNotification` on init and echoes `ping` over TCP from
  `probe.ts`.
- **Settles:** API + Java versions, build/deploy loop (`copyExtension`),
  transport confirmation (§12 "confirm extension↔TS transport").

### E1 — Addressing: pinning vs. selection *(the critical one — §12 #1)*
- **Q:** Can clip/track/device cursors be **programmatically pointed and
  pinned** such that user UI interaction never retargets them?
- **Method:** Create cursor track + `PinnableCursorClip` at init. Point at
  slot (x,y) programmatically, pin, then *deliberately interfere*: click
  other clips/tracks in the UI mid-write-loop, drag clips, delete an
  unrelated track (index-shift test). Verify writes still land on the
  pinned clip. Then test **cursor pools**: can N cursor clips be created
  at init and pinned to N different slots concurrently?
- **Settles:** the entire addressing model; cursor-pool size; whether
  "address-don't-select" (§8d) is achievable or needs a fallback design
  (e.g. select-verify-write with settlement detection). **A negative
  result here forces a redesign of the optimistic-application posture —
  surface it immediately, don't push on.**

### E2 — Note round-trip fidelity & grid *(gates checkpoint design)*
- **Q:** Is `setStep → getStep` readback synchronous and exact? What grid
  resolution is practical?
- **Method:** Write notes incl. all expression props (velocity, duration,
  gain, pan, pressure, timbre, transpose, chance, mute, release velocity),
  read back immediately and after `scheduleTask(0)`; diff. Test the
  observer-before-get gotcha (does `getStep` work without
  `addNoteStepObserver`?). Probe fine grids: `setStepSize` at 1/32, 1/64,
  1/128 with long clips — measure `clipSteps × keys` cost of the scan and
  any position quantization. Test fractional/triplet positions. Confirm
  §11 "launcher > arrangement" by one arrangement-clip attempt (timebox:
  short).
- **Settles:** §5 "Exact" fidelity claim → checkpoint/readback loop design
  (§8b/§8c); grid & units mapping (beats ↔ steps) for the contract;
  whether grid is global, per-clip, or per-operation.

### E3 — Structural ops & revert correctness *(§12 #3, #4)*
- **Q:** Does `deleteObject()` exist and work on Track / ClipLauncherSlot /
  Device? Is there any undo grouping?
- **Method:** Create track → delete it; create clip → delete; insert device
  → delete. Observe index shifts after each (what happens to bank indices
  and to pinned cursors from E1 when a preceding track is deleted — the
  interaction matters). Probe undo granularity: run a 10-op batch, count
  undo steps needed to unwind it in the UI; search API for any
  transaction/grouping hook (expected absent).
- **Settles:** revert strategy for structural create/delete (checkpoint
  fidelity column of §4/§6); confirms §8a "own the undo" premise; how the
  brain must re-resolve addresses after structural changes.

### E4 — Device & direct-parameter layer *(§12 #2 — the differentiator)*
- **Q:** Do `SpecificPluginDevice.createParameter(int)` handles bind to a
  *cursor* device (repointable) or must they be per-device-slot? Does the
  whole §6a story hold?
- **Method:** Insert a Bitwig device by UUID and a VST3/CLAP by ID at end
  of chain. Pre-allocate 128 param handles on a cursor device; read back
  names + display values (effective enumeration test). Repoint the cursor
  to another device; verify handles repoint. Test pinning (same concern as
  E1). Try one Bitwig-internal param via string ID using the
  `can-copy-device-and-param-ids` config flag workflow. Measure: is param
  name/value readback immediate after insert, or does it need settling?
- **Settles:** the pre-allocation strategy (pool-of-cursors vs. per-slot
  handles); feasibility + shape of the param catalog idea; insert-device
  → readback sequencing for batches.

### E5 — Scale limits ✅ COMPLETE *(§12 #5 — answered ●, see FINDINGS)*
> **Result:** no knee below 65 536 slots (512×128 = 81ms init); latency flat
> at the ~24ms control-surface tick floor in every config, loaded or empty.
> The binding constraint is not perf but the **bank window**: tracks outside
> it are unaddressable and their clips unsnapshottable (checkpoint blind
> spot). Recommended sizes: TRACKS=256, SCENES=128, CURSOR_POOL=8,
> DEVICE_BANK=16, paramHandles=64 — config-tunable via the new `RigConfig`.
> Cold-start + project-open lag measured (E5c): cold init 108ms inside a 13.4s
> Bitwig launch, project-open cost below measurement resolution, zero
> control-surface stalls at any size. No caveats outstanding.

- **Q:** Where does init-time pre-allocation start to hurt?
- **Method:** Parameterize the `Rig` sizes (currently TRACKS=16, SCENES=16,
  GRID_STEPS=64, CURSOR_POOL=3, DEVICE_BANK=8, plus the E4 param apparatus
  and E4b DirectParameter observers). Measure extension init time and
  Bitwig project-open lag at e.g. 32/64/128 tracks × 32/64/128 scenes ×
  full `markInterested`, and the cursor-device pool × param-handle counts.
  Expose sizes via handler params or rebuild-and-measure. Find the knee.
- **Settles:** shipped scaffold sizes (banks, scenes, cursor pool,
  param-handle pool) and whether they're config-tunable. **This is the
  one §12 question still fully open** — prioritize.
- **Note:** channelId (E2f) means the brain resolves tracks by UUID, so the
  track bank must be large enough to *contain* the whole project (unresolved
  tracks outside the bank window are invisible). Scale directly bounds max
  project size — a real constraint, not just a perf knob.

### E6 — Named actions escape hatch
- **Q:** What does `Application.getActions()` actually expose, and how bad
  is the selection coupling?
- **Method:** Dump the action list to FINDINGS. Invoke 2–3 (e.g. duplicate
  clip, a reorder) with a pinned cursor from E1 active; observe whether
  invocation disturbs pinning or depends on UI selection/focus.
- **Settles:** policy for the escape hatch (allowed ops, checkpoint
  treatment given no readback). **Reduced urgency:** the sweep found typed
  primitives for much of what actions were the fallback for —
  `duplicateObject()`/`duplicateClip()`/`Clip.duplicateContent()` (v19),
  `deleteObject` (all levels, E1–E3). Named actions now cover a smaller
  residual; scope the probe to what has NO typed API.

### E4c — Device layers *(NEW, from the API sweep — device depth)*
- **Q:** Can we address INTO layered devices (Instrument/FX layers, drum
  machines, nested chains), and does the E4 pool/repoint/pin model extend
  to them?
- **Method:** `Device.hasLayers()`, `createLayerBank(int)`,
  `createCursorLayer()`, `DeviceLayerBank.getChannel(int)`,
  `CursorDevice.selectFirstInLayer(int)`. Insert a layered device (e.g. an
  Instrument Layer or drum machine), enumerate layers, point a cursor into
  a layer, read/set a param on a device inside it. Reuse the E4 param
  apparatus one level down.
- **Settles:** whether deep device addressing (drum pads, layered synths)
  is in reach for Phase 2, and if the addressing model is uniform across
  nesting. Timebox: medium.

### E7 — Modulators probe *(§12 #6 — UPGRADED: partial surface exists, not ○)*
- **Q:** How far does programmatic modulator access/routing go? (The sweep
  found real surface — no longer "expect ○".)
- **Method:** Probe `Device.getModulationSource(int)`,
  `Macro.getModulationSource()`,
  `ModulationSource.{isMapped,isMapping,toggleIsMapping,name}`,
  `Parameter.modulatedValue()`. Test: (a) read existing modulation sources
  on a device that has them; (b) the map idiom — `toggleIsMapping()` then
  set a target param, see if a modulation route is created; (c) whether a
  modulator can be *created* by inserting it as a device (modulators are
  devices w/ UUIDs — harvest a modulator UUID from the bundle like E3/E4).
  Read post-modulation values via `modulatedValue()`.
- **Settles:** modulator scope — how much of creation/routing/read is
  reachable; feeds §6 device matrix (was all ◐/unknown). Timebox: medium;
  stop if the map idiom proves unreliable.

### E8 — Concurrency & safety mechanics
- **Q:** Do the §8 mechanisms behave under load and interference?
- **Method:** Run a 200+-op batch paced via `scheduleTask`; measure
  throughput and UI responsiveness. Interleave user edits mid-batch
  (extends E1's interference test to writes). Verify
  `showPopupNotification` works mid-batch. Sketch stale-revision check
  (monotonic counter in extension, rejected write) to confirm the
  mechanism has a home on the extension side.
- **Settles:** batch pacing parameters; where revision state lives;
  notification UX baseline. **Budget device inserts at ~600ms each (E3) and
  note the two-tick write→verify rule (E2): batches mixing note-writes and
  structural/device ops need staged pacing.**

### E9 — MCP smoke test *(last; optional but cheap)*
- **Q:** Any surprises wiring the TS MCP SDK over the bridge?
- **Method:** Minimal MCP server exposing two tools (`ping`,
  `read_notes`) backed by `client.ts`; drive it from Claude Code.
- **Settles:** nothing architectural — pure de-risking of Phase-1 wiring.

### Deferred to Phase 1 (found in the sweep; not spike-gating)
- **Param introspection:** `RangedValue.discreteValueCount()` /
  `discreteValueNames()` (stepped/enum params), `getOrigin()` (defaults),
  `Parameter.hasAutomation()` (checkpoint-fidelity flag). Adopt in the
  param model; no live probe needed to decide the architecture.
- **Duplication primitives:** `duplicateObject`, `Clip.duplicateContent`,
  `duplicateClip` — fold into the structural-op vocabulary.
- **Group-track navigation:** `Track.createTrackBank/createMainTrackBank`
  for nested tracks; our flat host bank is the default, revisit if groups
  matter.
- **Groove engine, full browser session API** — capability noted, out of
  spike scope.

## 5. Exit criteria & deliverables

The spike is **done** when every §12 open question has a ●/○ verdict with
evidence in FINDINGS, and the following are written:

1. **`context/DECISIONS.md`** — each decision with its evidence pointer:
   - addressing model (pinning strategy, cursor-pool sizes, re-resolution
     rules after structural ops);
   - pre-allocation scaffold sizes (banks, param handles, cursor pools);
   - checkpoint fidelity table finalized (updates §4/§5/§6 columns from
     ◐/guess to measured);
   - grid/units mapping and quantization stance;
   - batch execution mechanics (pacing, readback timing, revision home);
   - toolchain versions (API, Java, Gradle, Node/TS);
   - transport + protocol frame confirmation;
   - escape-hatch policy; modulator scope verdict.
2. **`context/PROJECT_PLAN.md`** — the complete plan the spike exists to
   enable: Phase 1 scope & milestones (contract v0 + fake adapter first,
   per §12 build-early), patch schema direction ("the patch is the
   interface"), checkpoint store design, phase 2+ ordering
   (per §12: live mappings vs. direct-param sound design vs. browser
   loading vs. diff visualization — now rankable with E4/E6 evidence),
   and the param-catalog go/no-go.
3. **Updated `INITIAL_PROMPT.md` confidence markers** (◐ → ●/○ where
   settled) or a superseding note pointing at DECISIONS.
4. A short **carry-forward list**: which spike files are clean enough to
   lift into Phase 1 as-is (target: `Bridge.java`, the NoteStep idioms,
   `client.ts`, the Gradle build).

## 6. Findings protocol

`context/spike/FINDINGS.md`, one section per experiment, appended as run:

```markdown
## E1 — Addressing (2026-07-xx)
Verdict: ● pinning survives user clicks / ◐ partial / ○ failed
Evidence: <what was done, exact API calls, observed behavior>
Decision impact: <which DECISIONS entry this feeds>
Gotchas: <anything for the §11 list>
```

Negative results are first-class results — E1 or E4 failing *changes the
project*, and the sooner that's on paper the better.
