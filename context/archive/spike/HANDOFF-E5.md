---
title: ghostnote spike — Handoff for E5–E9
status: E0–E4 complete; resume at E5
updated: 2026-07-19
---

# Handoff: continue the ghostnote spike (E5–E9)

You are picking up an in-progress hardware/API verification spike for
**ghostnote** — a personal Bitwig Studio MCP server (thin `.bwextension` +
TypeScript brain). This session ran E0–E4 and follow-ups; your job is to run
the **remaining experiments E5–E9** (plus two folded-in probes) and then
produce the spike's final deliverables. Everything below is what you need to
be productive immediately without re-deriving it.

## Read these first (in order)
1. `context/INITIAL_PROMPT.md` — the locked project vision, decisions, and
   §-numbered reference (§6a = the direct-param differentiator, §8 = the
   optimistic-application + checkpoint-revert execution model, §12 = the
   open-questions list this spike answers).
2. `context/spike/FINDINGS.md` — **the running evidence log; read all of
   it.** Every experiment's verdict + the gotchas that will bite you. The
   "Method" and "API surface sweep" sections at the top are load-bearing.
3. `context/SPIKE_PLAN.md` §4 — the experiment matrix. E0–E4 marked
   COMPLETE; **E5, E6, E4c (new), E7 (upgraded), E8, E9** are your queue,
   each with Q/Method/Settles. §5 lists the exit deliverables.
4. `context/DAW_MCP_ANALYSIS.md` — reuse posture (reference quarry in
   `reference/daw-mcp/`, gitignored; MIT, credited in `NOTICE`).

## Where things stand
- **E0–E4 all ● (verified against live Bitwig).** Answered: toolchain,
  addressing (pinned cursor pool), note fidelity + grid, structural ops +
  revert, the §6a direct-param differentiator. Plus: track identity via
  `channelId` (E2f), CLAP params via DirectParameter (E4b), full API sweep.
- **Only §12 question fully open: #5 (scale limits) → E5. Prioritize it.**
- Project is on git branch `initial-spike`. **Do not run git write commands**
  (user commits after reviewing each task). **Stop after each task/experiment
  for user review** before proceeding.

## The working rig (how to actually run things)
- **Bitwig 6.0.6** must be running with the **ghostnote controller added**
  (Settings → Controllers → Add Controller → vendor "ghostnote"). This is a
  one-time manual step per Bitwig launch that only the user can do; if the
  bridge port is closed, ask them to add/verify it. Popup on load:
  "ghostnote bridge listening on 127.0.0.1:8686".
- **Bridge:** newline-delimited JSON-RPC 2.0 over TCP `127.0.0.1:8686`.
  Check liveness: `nc -z -w1 127.0.0.1 8686`.
- **Build/deploy the extension:** `cd extension && gradle copyExtension`.
  Bitwig **hot-reloads** the `.bwextension` on file change — no restart
  needed; the bridge comes back up in-place within a few seconds.
- **Run a probe:** `cd brain && npm run probe:eNN` (tsx, ESM). Typecheck:
  `npx tsc --noEmit`. Node/tsx already installed.
  **Gotcha:** the Bash tool's cwd resets between calls — always `cd` into
  `brain/` (or `extension/`) in the same command; a bare `npx tsc` from the
  repo root grabs the wrong package.
- **Fixture:** a shared test fixture lives in the user's open project: tracks
  **gn-A** and **gn-B** (Instrument type), each with small note-fingerprint
  clips. `brain/src/probes/lib.ts` `ensureFixtureTracks()` creates/repairs
  them. The default project template is Inst 1 + Audio 2 + FX + Master; leave
  it that way. **Always restore fixtures + clean up inserted devices/scenes
  at the end of every probe** (existing probes do this; copy the pattern).

## Architecture facts already established (do NOT re-derive)
- **Addressing = pool of pinnable cursor tracks** created with
  `followSelection=false`, each owning a `PinnableCursorClip`. Point via
  **"trackThenSlot"**: `cursorTrack.selectChannel(track)` +
  `track.selectSlot(slot)`; settles ~25ms, verify by polling
  `trackPosition`+`sceneIndex`. Pinning survives user interaction. Pool size
  currently 3 (`Rig.CURSOR_POOL`).
- **Stable identity = `track.channelId()` (UUID, API 20).** Survives index
  shift, rename, and full app restart + reload (E2f). **Address tracks by
  channelId, resolve to current index on demand** (`track.resolveByChannelId`
  handler exists). Never store bank index or name as identity.
- **`createInstrumentTrack(position)` does NOT honor position** (lands
  inconsistently — index 0 or 1). Identify a newly-created track by
  **channelId set-difference** (the UUID not present before), never by
  position or "last Instrument". The flat track bank **includes FX + Master
  rows** at the tail — filter by `trackType()`.
- **Writes are two-tick:** `setStep`/param writes are NOT visible in the same
  request; read back on a *subsequent* request (~25ms). Readback verification
  (§8c) is a separate tick.
- **Silent-no-op write traps (all caught only by readback):**
  `param.value().set()` is swallowed by the controller take-over strategy —
  **use `setImmediately`**. `setGain`/`setTimbre` **zero out pressure** —
  write pressure last. `gain` reads back **2× written** (restore via
  `read/2`). DirectParameter writes need **`resolution=1`** (128 fails).
- **Pointing at an EMPTY slot silently no-ops** (cursor keeps its previous
  clip, status looks healthy). Create clip → then point → verify target
  before writing.
- **Scene deletion compacts rows upward**; a pinned cursor's `sceneIndex`
  goes stale after — re-point after scene structural ops.
- **Undo is per-op and project-global** (no grouping) → native undo is
  useless for batch revert; snapshot-replay revert works (E3, confirmed).
- **Params, two APIs:** typed `createParameter` (VST/Bitwig, pull-reads +
  displayed values) and format-agnostic **DirectParameter observers**
  (any device incl. CLAP, self-enumerating). Handles bind to a repointable
  cursor **device**; hold a device by pinning the **track** cursor +
  `selectDevice(index)` (device-level pin is subordinate to its track).
- **Device UUIDs + Bitwig-internal param IDs are harvestable offline** from
  `Bitwig Studio.app/.../Library/device-settings/<uuid>/Default.bwpreset`
  (`strings | grep`). Polysynth = `a9ffacb5-33e9-4fc7-8621-b1af31e410ef`.

## How to verify the API (learned the hard way — two missed capabilities)
- **Primary tool = the complete member index:** grep
  `Bitwig Studio.app/.../Documentation/control-surface/api/member-search-index.js`
  (1968 members). One grep for a concept surfaces every match across ALL
  classes and ALL versions. This is the recall backstop — the DirectParameter
  API (API v1) and `channelId` (v20, on supertype `Channel`) were both missed
  by class-scoped greps.
- Supplement with `new-list.html` (additions by API version — recent only)
  and whole class pages incl. "All Superinterfaces" + inherited methods.
- **The javadoc has real prose** (read it), but **behavior is undocumented** —
  every gotcha above came only from live probing. Verify capabilities with a
  probe; never record a ○ from a doc pass alone.

## Codebase map
- `extension/src/main/java/com/ghostnote/extension/`
  - `GhostnoteExtension(Definition).java` — entry; API 25, Java 21 target.
    Discovery needs `src/main/resources/META-INF/services/
    com.bitwig.extension.ExtensionDefinition` (the manifest attr is ignored).
  - `Bridge.java` — TCP + `host.scheduleTask` marshaling, strict newline
    framing. Loopback only.
  - `Rig.java` — **all pre-allocated API objects** (banks, cursor pool,
    device banks, E4 Polysynth param apparatus, E4b DirectParameter
    observers). Sizes here are the E5 knobs (TRACKS/SCENES/GRID_STEPS/
    CURSOR_POOL/DEVICE_BANK/FINE_STEPS).
  - `ProbeHandlers.java` — one handler per probe op; add E5+ handlers here.
- `brain/src/`
  - `client.ts` — TCP JSON-RPC client (pending-map, timeouts, `sendRaw`).
  - `probes/lib.ts` — shared helpers: `client`, `check/note/failureCount`,
    `pollUntil`, `point`, `cursorStatus`, `getNotes`, `sameNotes`,
    `ensureFixtureTracks`, `stampFingerprint`, `FIXTURE_FPS`. **Reuse these.**
  - `probes/eNN-*.ts` — one runnable per experiment; `npm run probe:eNN`.
- `context/spike/FINDINGS.md` — append a section per experiment as you go
  (verdict ●/◐/○, evidence, decision impact, gotchas). Keep the format.

## Your queue (details in SPIKE_PLAN §4)
1. **E5 — scale limits** *(highest priority; last open §12 question)*. Note
   channelId means the track bank must *contain the whole project* (tracks
   outside the bank window are unresolvable), so scale bounds max project
   size, not just perf. Vary `Rig` sizes, measure init + project-open lag,
   find the knee, pick shipped sizes.
2. **E4c — device layers** *(new)*: `hasLayers`/`createLayerBank`/
   `selectFirstInLayer` — address into layered instruments/drum machines.
3. **E6 — named actions**: `Application.getActions()`; reduced urgency
   (typed `duplicateObject`/`deleteObject` now cover most of it) — scope to
   what has no typed API.
4. **E7 — modulators** *(upgraded from "expect ○")*: real surface exists —
   `getModulationSource`, `toggleIsMapping`, `Parameter.modulatedValue()`,
   and modulator-as-device creation. Probe read + map-idiom + create.
5. **E8 — concurrency/batch pacing**: 200+-op batch via `scheduleTask`,
   interference, `showPopupNotification`, stale-revision sketch. Budget
   ~600ms/device-insert and the two-tick write rule.
6. **E9 — MCP smoke test**: minimal MCP server over `client.ts`, 2 tools,
   drive from Claude Code. Pure Phase-1 wiring de-risk.

## Then: the spike deliverables (SPIKE_PLAN §5)
Once E5–E9 are done and every §12 question has a verdict, write:
- `context/DECISIONS.md` — every settled decision + evidence pointer
  (addressing model, scaffold sizes, checkpoint-fidelity table, grid/units,
  batch mechanics, toolchain, escape-hatch policy, modulator verdict).
- `context/PROJECT_PLAN.md` — the full Phase-1 plan (contract v0 + fake
  adapter FIRST per §12 build-early; patch schema direction; checkpoint
  store; phase 2+ ordering now rankable with E4/E4b/E4c/E7 evidence; param
  catalog go/no-go).
- Update `INITIAL_PROMPT.md` confidence markers ◐→●/○ where settled.
- A carry-forward list of spike files clean enough to lift into Phase 1
  (`Bridge.java`, NoteStep idioms, `client.ts`, the Gradle build).

## Working conventions
- Stop after each experiment for user review; don't batch-run E5–E9.
- Don't run git write commands; the user commits.
- Restore fixtures + clean inserted devices/scenes at the end of every probe.
- A probe "FAIL" is often a wrong test expectation encoding a real finding —
  read it, don't just chase green (see E1b/E2f history in FINDINGS).
- Model: this spike ran mostly on high-effort models; E5/E8 involve timing
  measurement and judgement — keep that bar.
