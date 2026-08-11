---
title: ghostnote spike — Handoff for E7–E9
status: E0–E6 + E4c–E4h complete; resume at E7
updated: 2026-07-19
---

# Handoff: continue the ghostnote spike (E7–E9 + deliverables)

You are picking up an in-progress hardware/API verification spike for
**ghostnote** — a personal Bitwig Studio MCP server (thin `.bwextension` +
TypeScript brain). The previous session ran **E5 (scale), E4c–E4h (device
nesting + chain creation + preset templating), and E6 (named actions)**. Your
job is the **remaining experiments E7, E8, E9** and then the spike's **final
deliverables**. Everything below makes you productive immediately.

## Read these first (in order)
1. `context/INITIAL_PROMPT.md` — locked project vision, §-numbered reference
   (§6a = direct-param differentiator, §8 = optimistic-apply + checkpoint
   model, §12 = the open-questions list this spike answers).
2. `context/spike/FINDINGS.md` — **the running evidence log; read all of it.**
   Every verdict + the gotchas that will bite you. Read newest sections (E5,
   E4c, E4d, E4f, E4g, E4h, E6) closely — the "Method" section's
   *four-false-negatives* rule is load-bearing.
3. `context/SPIKE_PLAN.md` §4 — experiment matrix. E0–E6 + E4c–E4h COMPLETE;
   **E7, E8, E9** remain, each with Q/Method/Settles. §5 lists exit
   deliverables.
4. `context/DAW_MCP_ANALYSIS.md` — reuse posture (reference quarry in
   `reference/daw-mcp/`, gitignored; MIT, credited in `NOTICE`).

## Where things stand
- **Every §12 open question now has a verdict.** #5 (scale) ● E5; #2
  differentiator ● E4/E4b + extended by E4c–E4h; #6 modulators is the LAST
  one still at ◐ ("partial surface exists") → **that is E7, your first task.**
- Project on git branch `initial-spike`. **Do not run git write commands** —
  the user commits after reviewing each task. **Stop after each experiment for
  user review.**
- The Bitwig project is **completely throwaway** (user confirmed) — churn it
  freely, but still restore fixtures at each probe's end so later probes run
  clean.

## The working rig (how to actually run things)
- **Bitwig 6.0.6** must be running with the **ghostnote controller added**
  (Settings → Controllers → Add Controller → vendor "ghostnote"). One-time
  manual step per Bitwig launch; only the user can do it. Popup on load:
  "ghostnote bridge listening on 127.0.0.1:8686". Check: `nc -z -w1 127.0.0.1 8686`.
- **Bridge:** newline-delimited JSON-RPC 2.0 over TCP `127.0.0.1:8686`.
- **Build/deploy:** `cd extension && gradle copyExtension`. Bitwig
  **hot-reloads** on the `.bwextension` file changing (a real content change —
  see the E5 gotcha below). Bridge returns in ~3s.
- **Run a probe:** `cd brain && npm run probe:eNN`. Typecheck: `npx tsc
  --noEmit`. **Gotcha: the Bash tool's cwd resets between calls — always `cd`
  into `brain/` (or `extension/`) in the same command.**
- **Fixture:** tracks **gn-A** and **gn-B** (Instrument), small note clips.
  `brain/src/probes/lib.ts` `ensureFixtureTracks()` creates/repairs them.
  Current project (throwaway) also has a **track 0 "Instrument Layer"** holding
  the user's hand-built 4-chain layer (Phase-4/Polysynth/Organ/Sampler) — leave
  it; E4g/E4h use its saved preset. **Always restore fixtures + delete inserted
  devices/tracks/scenes at the end of every probe.**

## Architecture facts already established (do NOT re-derive)
Everything from the E5 handoff still holds (pinned cursor pool via
"trackThenSlot", channelId = stable track identity, two-tick writes, silent
no-op write traps, snapshot-replay revert). **New since then:**

- **Scale (E5): no knee below 65k slots; latency flat at the ~24ms
  control-surface tick floor.** Cost is init-only (~1.2µs/slot). The binding
  constraint is the **bank WINDOW**: tracks outside it are unaddressable and
  their clips unsnapshottable (a checkpoint blind spot). **Recommended shipped
  sizes: TRACKS=256, SCENES=128, CURSOR_POOL=8, DEVICE_BANK=16,
  paramHandles=64.** All config-tunable via `RigConfig`.
- **`RigConfig` (E5):** sizes load at init from `~/.ghostnote/rig.json`
  (absent → compiled defaults). `rig.stats` / `rig.scanTracks` handlers report
  init cost + bank population. **Hot-reload needs a real content change — a
  bare `touch` does NOT trigger it; rewrite the file (`cp build/libs/…
  "$EXT/…"`).** `e05c`'s recorder is the reusable latency-measurement tool.
  ⚠ `~/.ghostnote/rig.json` should be **absent** right now (defaults, 16×16);
  if a probe leaves one, `rm` it so E7+ run at defaults.
- **Device nesting (E4c):** `selectFirstInLayer(i)` / `selectFirstInChannel(pad)`
  move the SAME device cursor INTO a nested chain, and the **E4 param
  apparatus follows recursively** (verified depth 2). The layer bank
  **re-scopes to whatever the cursor points at** — one pool covers any depth.
  ⚠ `hasLayers()==true` does NOT mean a layer exists (check the bank count).
- **Chain CREATION (E4d, overturned E4c's ○):** three routes make structure —
  **drum pads** (`DrumPad.insertionPoint().insertBitwigDevice`, and address in
  via `selectFirstInChannel(pad)` — NOT `selectFirstInKeyPad`, which takes a
  MIDI key), **`insertFile`** (materialises a whole multi-chain preset), and
  **`Device.duplicateObject()`** (clones a container with contents). The one
  real gap: **layer-type containers can't grow new layers** (no create-layer
  API; documented architectural reason in E4d/E4e — drum chains are a fixed
  note-indexed grid, layer chains aren't). Drum Machine UUID
  **`8ea97e45-0255-40fd-bc7e-94419741e9d1`**.
- **Preset templating (E4f/g/h):** `.bwpreset` is `BtWg` TLV; **device
  identity is a raw 16-byte big-endian GUID** (the ASCII UUID copies are
  metadata, ignored on load). **Length-preserving GUID substitution swaps a
  device**, verified per-layer-independent on the 4-chain template (E4g).
  Pipeline: **shape from a template preset → substitute GUIDs → set state via
  the param API.** `insertFile` takes **absolute paths only**, requires the
  **`.bwpreset` extension** (both fail SILENTLY otherwise), and the file is a
  **build-time asset** — not referenced after load, so templates ship in-repo.
- **Named actions (E6): DO NOT USE — ○ unusable AND hazardous.** 781 actions
  enumerate, but `invoke()` needs Bitwig **foregrounded** (global actions) +
  **panel keyboard focus** (editing actions) that a background agent can't set;
  returns `void` (no readback); and **operates on the UI selection our
  addressing sets** — foreground `Duplicate` duplicated the gn-A fixture 7×
  because pointing a cursor selects its track. `invoke()` itself is pin-safe
  (a view action is harmless); the danger is state-changing actions firing.
  **There is effectively no action-based escape hatch.**
- **Bundle-harvest gotcha (E4d):** device names in `.bwpreset`/bundle files are
  `<length-byte><name>`; macOS `strings` keeps the byte only when it's `0x0C`
  (form feed = 12), so **12-char names (e.g. "Drum Machine") defeat an anchored
  `grep`**. Extract the structured field instead:
  `strings f | grep -A1 '^device_name$' | sed -n 2p | tr -d '\f'`.

## Your first task: E7 — Modulators (§12 #6; last ◐ → resolve)
- **Q:** How far does programmatic modulator access/routing/creation go?
- **Confirmed API surface** (member-search-index): `Device.getModulationSource(int)`,
  `Device.addActiveModulationSourceObserver(int,…)`, `Macro.getModulationSource()`,
  `ModulationSource.{isMapped,isMapping,toggleIsMapping,name,addIsMapped/IsMappingObserver}`,
  `Parameter.modulatedValue()`, `ContinuousHardwareControl.modulatedTargetValue()`.
- **Modulator bundle:** `…/Bitwig Studio.app/Contents/Resources/Library/
  modulators/*.bwmodulator` — **43 of them**, `BtWg` format (same family as
  presets). **There is NO `insertModulator` API** — so creating a modulator is
  most likely via **`InsertionPoint.insertFile(<abs path>.bwmodulator)`** (the
  E4h path) or the browser; **test this first**. Harvest modulator UUIDs the
  structured way (mind the 12-char `\f` gotcha).
- **Method (SPIKE_PLAN E7):** (a) read existing modulation sources on a device
  that has them + `modulatedValue()`; (b) the **map idiom** —
  `toggleIsMapping()` then set a target param, see if a route is created;
  (c) whether a modulator can be **created** (insertFile a `.bwmodulator`).
- **⚠ Strong hypothesis to test EARLY (E6 just taught this):**
  `toggleIsMapping()` is an "enter mapping mode, then touch a param" idiom —
  i.e. it depends on **UI focus/mode state**, exactly what made named actions
  inert headless. **Expect READING modulation to work and the map-creation
  idiom to be unreliable/inert from the controller.** If the map idiom proves
  focus-dependent, that IS the finding — record it, don't fight it. Timebox
  medium; stop if the idiom is unreliable.
- **Settles:** modulator scope for §6 device matrix (was ◐/unknown). Feeds the
  Phase-2 ranking (live-mappings vs. direct-param sound design).
- **Rig work:** add a modulation apparatus to `Rig` on `cursorDevice0`
  (getModulationSource handles + observers) and handlers in `ProbeHandlers`;
  follow the E4/E4c pattern. Add `param.modulatedValue` readback.

## Then E8, E9 (SPIKE_PLAN §4)
- **E8 — concurrency/batch pacing:** 200+-op batch via `scheduleTask`;
  interference; `showPopupNotification` mid-batch; stale-revision sketch.
  **Budget ~600ms/device-insert (E3), ~144ms/track, the two-tick write rule
  (E2), and note insertFile is ~record-order fast (E4d ~268ms for 12 chains).**
- **E9 — MCP smoke test:** minimal MCP server over `client.ts`, 2 tools, drive
  from Claude Code. Pure Phase-1 wiring de-risk; nothing architectural.

## Then: the spike deliverables (SPIKE_PLAN §5)
Once E7–E9 are done, write:
- `context/DECISIONS.md` — every settled decision + evidence pointer
  (addressing, scaffold sizes + bank-window rule, checkpoint-fidelity table,
  grid/units, batch mechanics, toolchain, **escape-hatch = none (E6)**,
  **chain-construction = templates (E4d–E4h)**, modulator verdict from E7).
- `context/PROJECT_PLAN.md` — full Phase-1 plan (contract v0 + fake adapter
  FIRST per §12; patch schema; checkpoint store; **Phase-2 ordering now
  rankable** with E4/E4b/E4c/E4d/E7 evidence — note device sound-design got
  much stronger via templating; param-catalog go/no-go).
- Update `INITIAL_PROMPT.md` confidence markers ◐→●/○ where settled.
- Carry-forward list: spike files clean enough to lift into Phase 1
  (`Bridge.java`, `RigConfig`, `client.ts`, NoteStep idioms, the Gradle build,
  the GUID-substitution + insertFile templating helper).

## Working conventions
- Stop after each experiment for user review; don't batch-run E7–E9.
- Don't run git write commands; the user commits.
- Restore fixtures + delete inserted devices/tracks/scenes at every probe's end.
  **Make structural probes self-healing** (snapshot channelIds, delete strays)
  — E6 learned this the hard way after a foreground `Duplicate` spawned 7
  orphan tracks.
- A probe "FAIL" is often a wrong test expectation encoding a real finding —
  read it, don't chase green (E6's "phase D" was the Duplicate-hazard finding;
  E4c's failures were the empty-layer finding).
- **Before recording any capability ○: walk supertypes for the method,
  enumerate every verb (insert*/duplicate*/copy*/insertFile/actions), and use
  a live probe.** Four false negatives this spike (CLAP params, channelId,
  chain creation, Drum-Machine-in-bundle) all came from single-mechanism
  checks; three were caught only when the user pushed back on a confident
  negative.
- Some probes need Bitwig **foregrounded** to observe GUI-focus behaviour
  (E6 did) — that's a user action, like adding the controller; ask for it
  explicitly and tell them when they can release it.
- Model: keep the high-effort bar; E7's map idiom and E8's timing need
  judgement.

## Current probe inventory (brain/package.json)
e00, e01a/b, e02–e02f, e03/b, e04, e04b, **e04c(+diag,diag2), e04d(+diag),
e04e, e04f, e04g, e04h, e05, e05b, e05c, e06** (+ e06-diag2/3/4/6/7 run via
`npx tsx`). Reuse `lib.ts` helpers everywhere.
