---
title: Bitwig MCP — Project Context
status: scoping
updated: 2026-07-18
---

# Bitwig MCP — Project Context

> **Purpose.** Context primer to seed a fresh Claude Code session for scoping and building a personal, extensible **Bitwig Studio MCP server**. Encodes decisions and research findings established so far. It deliberately does **not** pre-design the tool surface or phases beyond Phase 1 — those are for the working session.
>
> **Confidence markers:** ● confirmed by research · ◐ likely, verify in-session · ○ not available.

---

## 1. Goal

A personal, extensible MCP server letting an AI agent (Claude) drive Bitwig Studio. **MIDI clip generation/manipulation first**, then expand to as much live DAW control as the Controller API permits, in rough order of feasibility and personal usefulness.

Scope is **live only** — everything runs through Bitwig's Controller API at runtime. Offline/file-generation routes are excluded as build targets (§9).

---

## 2. Decisions locked (do not relitigate)

- **Architecture: thin `.bwextension` + TypeScript brain.** Minimal Bitwig controller extension (JVM) exposes Controller-API operations over a local interface; a **TypeScript process is both the MCP server and the musical "brain."** No music logic in the JVM extension — it stays a thin adapter.
- **Language for the brain: TypeScript.** `tonal.js` for theory/generation; the TS MCP SDK is the most mature. Python/`music21` is **not** in scope — optional future _analysis_ side-car only (§7).
- **Phase 1 = MIDI clips.** Read/write/generate/manipulate clip note content.
- **Beyond Phase 1: live extension capability only.** No offline generation, no DAWproject.
- **Interaction posture: optimistic application — "Cursor for music."** The agent applies edits **without an approval gate**. Safety comes from cheap, reliable **revert after the fact**, not from pre-approval. See §8.
- **No second DAW.** Bitwig is the only sound-generating surface. No mirror model, no local audition, no preview-as-gate. Inline **visual representations** of session changes are desirable later but are not Phase 1 and do not require a full song model (§8f).

---

## 3. The capability ceiling (key mental model)

**Everything live bottoms out on Bitwig's Controller (Open Controller Extension) API.**

- Bitwig has **no native OSC**. Every OSC pathway is itself a controller extension (in practice **DrivenByMoss**). OSC is a _wrapper_ capped at whatever surface its authors exposed. It is **not** a separate or more powerful tier.
- The real axis: **"reuse someone's fixed surface (OSC)" vs. "write our own extension and get the full API."** We're doing the latter.
- **MCP / TypeScript is the portable layer.** Portability lives there, not in the in-DAW transport.

### 3a. The API is not operation-poor — it is _discovery_-poor and statically shaped

Nearly every CRUD operation exists. Three _structural_ constraints explain almost every limitation:

1. **Init-time allocation.** API objects (parameter handles, banks, cursors) must be created during `init()`. You cannot spawn a new parameter handle mid-session because the agent just loaded a plugin and wants param #47. **Pre-allocate a generous pool and repoint it.** Single biggest driver of extension design.
2. **Banked windows.** Tracks, devices, clip slots, scenes are accessed via fixed-size banks with scrolling. Pre-allocate banks large enough to cover realistic projects and present them as flat lists to the TS brain.
3. **ID-keyed access without enumeration.** Bitwig internal devices/params use opaque IDs known in advance. Plugin (VST/CLAP) params use _integer index_ — far friendlier, and effectively enumerable.

**Design implication:** the extension is a static, generously-sized scaffold; the TS brain does all mapping, naming, and abstraction.

---

## 4. Feature matrix — session structure

**Checkpoint fidelity** = how exactly the prior state can be captured and restored on revert (§8b).

| Object                                | Create                                                                           | Read                                     | Update                                                 | Deep update | Delete             | Reorder                      | Checkpoint fidelity                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------ | ----------- | ------------------ | ---------------------------- | ----------------------------------------------------------------------------- |
| Track (instrument/audio/effect/group) | ● `Application.createInstrumentTrack` / `createAudioTrack` / `createEffectTrack` | ● via `TrackBank`                        | ● name, color, volume, pan, mute, solo, arm, activated | ●           | ◐ `deleteObject()` | ◐ via named actions          | **Low** for create/delete (revert = delete, unverified); high for mixer state |
| Sends                                 | ○                                                                                | ● `SendBank`                             | ● level, enabled, pre/post                             | ●           | ○                  | n/a                          | High (scalar readback)                                                        |
| Scene                                 | ●                                                                                | ● name, color                            | ●                                                      | ●           | ◐                  | ◐                            | Low for create/delete                                                         |
| Clip launcher slot                    | ● `createEmptyClip(length)`                                                      | ● hasContent, isPlaying, isQueued, color | ● launch, stop, record, select                         | ●           | ● `deleteObject()` | ◐ duplicate/copy via actions | Medium–high                                                                   |
| Transport / application               | n/a                                                                              | ●                                        | ● tempo, time sig, play, loop, metronome, position     | ●           | n/a                | n/a                          | High                                                                          |
| **Named actions (escape hatch)**      | —                                                                                | ● `Application.getActions()` enumerable  | ● `Action.invoke()`                                    | —           | —                  | —                            | **Low** — fire-and-forget, no readback                                        |

**Named actions are the general workaround layer.** Anything with a menu command but no typed API method is usually reachable there. Caveats: fire-and-forget (no return value) and **operates on current selection** — the main source of UI-state coupling (§8d) and the worst case for checkpointing.

---

## 5. Feature matrix — clip note content (deepest, cleanest area)

| Object          | Create                                                | Read                                                 | Update                      | Deep update                                                                                         | Delete                          | Checkpoint fidelity |
| --------------- | ----------------------------------------------------- | ---------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------- |
| Clip container  | ●                                                     | ● name, color, length, loop start/length, play range | ●                           | ●                                                                                                   | ●                               | High                |
| Step / note     | ● `setStep(channel, step, pitch, velocity, duration)` | ● `getStep()` → `NoteStep`                           | ● pitch, velocity, duration | ●                                                                                                   | ● `clearStep()`, `clearSteps()` | **Exact**           |
| Note expression | —                                                     | ● per-step                                           | ●                           | ● release velocity, pressure, timbre, pan, gain, chance, occurrence, repeat count, recurrence, mute | ●                               | **Exact**           |

**Idiom (confirmed):** `setStep(...)` to create → `getStep(...)` for the `NoteStep` handle → set pressure/timbre/chance/etc. on it.

**Why Phase 1 is the right start under optimistic application:** clip note content is fully readable, so the write-set snapshot is _exact_ and revert is lossless. Checkpoint fidelity degrades for structural ops — another argument for this phase ordering.

**Soft spots:** visible pitch-bend/automation curves _inside_ clips; arrangement clips less reliable than launcher clips.

---

## 6. Feature matrix — device / sound design

| Layer                                  | Create                                                                                                                      | Read                                                | Update                        | Deep update              | Delete             | Checkpoint fidelity    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------- | ------------------------ | ------------------ | ---------------------- |
| Device in chain                        | ● `InsertionPoint.insertBitwigDevice(UUID)`, `insertVST2Device`, `insertVST3Device`, `insertCLAPDevice`, `insertFile(path)` | ● name, enabled, position, type                     | ● bypass, expand, window show | ●                        | ◐ `deleteObject()` | Low for insert/delete  |
| Insertion position                     | ● end-of-chain, before/after device, into layers/slots                                                                      | ●                                                   | ●                             | ●                        | —                  | Low                    |
| Remote control pages                   | ◐ (user-authored)                                                                                                           | ● names, values, page names                         | ●                             | 8/page × many pages      | —                  | High (scalar readback) |
| **Bitwig device direct params**        | —                                                                                                                           | ● `SpecificBitwigDevice.createParameter(String id)` | ●                             | ● **any** internal param | —                  | High                   |
| **VST/CLAP direct params**             | —                                                                                                                           | ● `SpecificPluginDevice.createParameter(int index)` | ●                             | ● **any** plugin param   | —                  | High                   |
| Device search/filter                   | —                                                                                                                           | ● `DeviceMatcher` + `DeviceBank.setDeviceMatcher`   | —                             | —                        | —                  | n/a                    |
| Modulators                             | ◐ unknown                                                                                                                   | ◐ unknown                                           | ◐ unknown                     | ◐ unknown                | ◐ unknown          | Unknown                |
| Grid internals (Poly/FX/Note)          | ○                                                                                                                           | ○                                                   | ○                             | ○                        | ○                  | n/a                    |
| Browser (load presets/devices/samples) | ●                                                                                                                           | ● filter by tag/category/creator                    | ● commit selection            | —                        | —                  | Low                    |

### 6a. Granular parameter access — beyond remote control pages ✅

**Confirmed: remote-page-only access is NOT the ceiling.** API 12 (Bitwig 3.2.5) added `createParameter` on specific device types, explicitly replacing the older DirectParameter API (described by its own docs as broken and hard to use).

**ID discovery:** add `can-copy-device-and-param-ids : true` to `config.json`. Adds context-menu commands to copy device and parameter IDs.

**The asymmetry that matters:**

- **VST/CLAP = the easy case.** Params by integer index. Pre-allocate e.g. 128 param handles per device slot at `init()`, point at indices 0–127, read back each name and display value. **This is effective enumeration** — self-describing parameter list with zero prior knowledge of the plugin.
- **Bitwig internal devices = the harder case.** Opaque string IDs, no enumeration. Requires a pre-built catalog (device UUID → param IDs), harvested semi-manually via the copy-IDs context menu. One-time and highly reusable — plausibly a worthwhile standalone community artifact.

**Prior art context:** this exact gap is an open feature request against WigAI (issue #15) — remote pages cap agents at 8 params while most devices have 50–300+. **No known prior art has implemented this.** It is the genuinely differentiating capability.

### 6b. Answers to the two scoping questions

**"Interactively build an FX chain of different VSTs with granular per-parameter control?"** → **Yes.** Insert plugin at end of chain, insert a second after it, set arbitrary params by index on each. The ceiling isn't granularity — it's **structure**: no programmatic modulator routing, no Grid topology. _Dial in every parameter: yes. Design the signal graph inside a Grid patch: no._

**"Build a full clip-only session interactively without touching the DAW?"** → **Plausibly yes.** Create tracks → insert instruments → create clips → write notes with full expression → set mixer state → launch. Every step has a confirmed mechanism.

Friction:

- **The browser is modal and stateful.** Awkward as a stateless agent tool. **Prefer `insertBitwigDevice(UUID)` and `insertFile(path)`;** treat the popup browser as exploratory-search fallback.
- **Banking is the main design tax.**
- **Deletes and reorders are the least-verified column** — and now also a _revert-correctness_ concern (§8b).

---

## 7. Language / brain detail

- **TypeScript brain uses `tonal.js`** — functional, immutable, typed: notes, intervals, chords, scales, modes, keys, chord/scale detection, progressions, key signatures, pitch-class sets. Strong for _generation and manipulation_.
- **Python/`music21` is an optional future side-car, not initial scope.** Gold standard for _analysis_ (Roman-numeral, key-finding, corpus work) but offline-oriented and weak on real-time/performance MIDI. Default to staying all-TS.

**Musical units convention — adopt verbatim on day one** (free, prevents a bug class):

- tempo in BPM;
- timeline positions in absolute beats;
- clip starts in absolute beats;
- note starts **relative to the clip pattern**;
- note and clip lengths in beats.

**Version the serializer** so future adapters/imports reject incompatible data instead of guessing.

---

## 8. Execution model: optimistic application with checkpoint revert

**Posture (locked, §2): the agent edits without approval. Safety lives in revert, not in a gate.**

### 8a. The one real architectural consequence

Removing the approval gate removes the mutation-free preview that would have been the safety net. The net must move somewhere, and the only place left is undo. **Undo therefore becomes load-bearing infrastructure, not an ergonomic nicety.** This is not merely an "eagerness" setting — it is a different mechanism doing the safety work.

**Bitwig's native undo cannot do this job:**

- No undo-grouping/transaction mechanism found ◐ (verify) — a 30-op batch likely lands as 30 entries.
- Worse, the undo stack is **project-global**. If the agent writes 12 ops and the user then nudges a clip by hand, "undo the agent's last batch" maps onto Bitwig's history at _no_ depth.

⇒ **Owning revert is required for the posture to be safe at all.**

### 8b. The primitive: write-set snapshot → checkpoint restore

Model on Cursor: it does not invert edits one at a time; it **checkpoints before an agent turn and restores**.

Because writes are _addressed_ (clip X step Y; device N param 12), the write-set is known **before** execution. Therefore:

```
1. materialize patch  -> explicit IDs -> known write-set
2. read prior state of exactly those addresses -> stash
3. apply optimistically
4. read back and verify
5. revert = replay the stash
```

**Why this beats an inverse-operation log:** ops like quantize, humanize, or randomize have no clean inverse but a perfectly clean _prior state_. No per-op inverse algebra required.

**Fidelity varies by object type** — see the new column on the §4/§5/§6 matrices. Exact for clip notes and scalar params; low for structural create/delete and for named-action ops (fire-and-forget, no readback).

### 8c. Verification replaces human review

With no approval step, nothing catches nonsense — so **write-then-read-back is the substitute**. Every batch returns a report: which ops applied, which didn't take. (Beat Twin listed readback as a release blocker for their adapter _even with_ an approval gate.)

### 8d. What gets MORE important under this posture

- **Address-don't-select + cursor pinning.** With no approval pause, the user is far more likely to be actively working while the agent writes. Interference probability rises. Already verification item #1.
- **`host.showPopupNotification()`** goes from polite to **necessary** — if the agent silently modifies a session the user is playing in, they need to know it happened.
- **Stale-revision rejection** (§8e) — cheap insurance, higher risk here.

### 8e. Retained batch semantics

- Patch remains an **internal artifact**: validated, materialized to explicit IDs. This is where the write-set is computed — now for checkpointing rather than approval.
- **Batch execution advances a monotonic session revision exactly once**; it is the unit of "a thing the agent did" and the unit of revert.
- **Execution rejects stale revisions before mutating** (optimistic concurrency).
- **Idempotent request IDs** so a retry cannot double-apply.

### 8f. The snapshot doubles as the diff source

The "before" captured for revert is precisely the "before" side of the inline visual representation wanted later. **One mechanism, two features.** Crucially this means the internal modeling required is a **scoped diff buffer over the write-set, not a song model** — you are not building a DAW, you are building a before/after of what changed.

### 8g. Make revert a human verb, not an agent tool

The one piece of privilege separation worth keeping. Otherwise an agent can paper over its own mistakes by rolling back and retrying silently, destroying the audit trail that makes optimistic application tolerable. Cursor works the same way: the model edits, but does not control your checkpoints.

### 8h. Explicitly dropped (from the approval-gated model)

- Human confirmation step, single-use confirmation tokens, immutable pending plans.
- Mutation-free preview **as a gate** (materialization stays internal).
- Second DAW: editable mirror, Tone.js audition, command palette, local song document.
- Write-policy classes — optional; a simple read-only toggle remains handy for exploration.

### 8i. Execution model note

The extension has **no run loop** — event-driven, executing only on MIDI input, observer callbacks, or scheduled tasks. Use `host.scheduleTask` to pace/sequence multi-step patches rather than blocking.

### 8j. Security note (inherited lesson)

Beat Twin documents that its write policy is enforced **only** in the Node layer, while the local TCP bridge is unauthenticated and executes any JSON-RPC it receives. The same will be true here: **the gate is at the TS layer; the local socket is the soft underbelly.** Firewall it; do not mistake the policy for a boundary.

---

## 9. Explicitly out of scope (for now)

- **Offline generation / DAWproject** — excluded by decision. Live API only.
- **Grid patch synthesis** — not possible via any documented API.
- **Library cataloguing/search engine** — separate filesystem-indexing concern; extension only _loads_.
- **Building on DrivenByMoss / OSC as a foundation** — reference reading only.
- **Preview/mirror DAW and local audition** — Bitwig is the only sound surface (§2).

---

## 10. Prior art

- **Fork base → `ptaczek/daw-mcp`** — https://github.com/ptaczek/daw-mcp
  Node/TS MCP server ↔ local TCP socket ↔ thin Java `.bwextension`. Launcher clip note read/write, MIDI-only. Closest match to Phase 1 and our architecture.
- **Study → `fabb/WigAI`** — https://github.com/fabb/WigAI
  Java extension embedding MCP in-process (different architecture). Good Controller-API reference; ships `bitwig-api-doc-scraper`. Issue #15 = the direct-parameter gap.
- **Reference (read, don't fork) → `git-moss/DrivenByMoss`** — https://github.com/git-moss/DrivenByMoss
  Most complete Bitwig extension in existence; canonical for browser/device/clip/remote idioms.
- **Interaction-design source → `LaurentHuzard/beat-twin`** — https://github.com/LaurentHuzard/beat-twin
  Half-finished; heavily agent-generated; goes well beyond core capabilities. **Mined for concepts only, not implementation.** Contributes: batch semantics, monotonic revisions, idempotent request IDs, stale-state rejection, readback-as-blocker, the "patch is the interface, tools are the implementation" lesson (they abandoned a 57-tool surface), and the security-gate caveat. Its approval/preview apparatus and browser NanoDAW are **explicitly not adopted** (§8h). Notably: its Bitwig surface stayed on the shallow selection-following / remote-controls path, so it sheds **no** light on §6a direct parameters — and it hit the addressing problem independently (its adapter writes are blocked partly on reliably identifying the intended track and clip).
- **Anti-pattern → `WeModulate/bitwig-mcp-server`** — https://github.com/WeModulate/bitwig-mcp-server
  Python MCP → OSC → DrivenByMoss. The capability-capped path we're not taking.
- **Utility refs** — `kirkwoodwest/Bitwig-API-Utils`, `kirkwoodwest/Bitwig-Extension-Hub` (API gotchas); `todm/BitwigRandomizer` (remote-page tagging, up to 1024 params/device).

**Primary sources**

- Bitwig API reference + scripting guide: **bundled locally** — Help > Documentation > Developer Resources. Also `github.com/bitwig/bitwig-extensions`.
- TypeScript MCP SDK — https://github.com/modelcontextprotocol/typescript-sdk
- `tonal.js` — https://github.com/tonaljs/tonal

---

## 11. Known gotchas

- **API version tracks the Bitwig version.** Bitwig 6 is current. Confirm API + Java version against the installed build (WigAI targeted Java 21 / Bitwig 5.2.7+).
- **Bitwig's own bundled scripts are often API level 1** — don't take them as idiomatic-modern.
- **Observer gotcha:** for some values you must add a value observer before `get()` works.
- **The API is inconsistent across areas** — methods existing for tracks often have no device equivalent, and vice versa.
- **Launcher clips > arrangement clips** in API reliability.
- Beat Twin used a JavaScript `.control.js` controller rather than a Java extension — faster iteration, no compile step, but likely the wrong home for large init-time param pre-allocation.

---

## 12. Open questions (decide/verify in session)

**Highest leverage — verify first:**

1. Does cursor **pinning** reliably survive user UI interaction? (§8d — community reports are mixed; independently confirmed as a blocker by Beat Twin. **Most critical under optimistic application.**)
2. Whether `createParameter` handles bind to a _cursor_ device or can be pinned per-slot. **Determines the entire pre-allocation strategy.**
3. **`deleteObject()` availability across Track / Device / ClipLauncherSlot.** _Promoted:_ this is now a **revert-correctness** question, not merely a feature question — reverting a structural create requires a working delete.
4. Any **undo grouping / transaction** mechanism (§8a). Expected absent; confirm.
5. Practical max on pre-allocated bank/param-handle size before init cost or memory bites.
6. **Modulators** — creation and routing; entirely unknown.

**Design decisions:**

- Fork `daw-mcp` directly vs. clean-start using it and WigAI as reference.
- Confirm extension↔TS transport. Default assumption: local socket per `daw-mcp`.
- Checkpoint storage: in-memory session-scoped vs. persisted; retention depth.
- Phase 2+ ordering among live mappings/triggering, direct-param sound design, browser loading, and the inline diff visualization.
- Tool surface / schema design — intentionally undefined here. Guiding lesson: **the patch is the interface, the tools are the implementation.**
- Whether to build the **Bitwig device param-ID catalog** as a Phase 2 deliverable (§6a).
- JVM toolchain: Java vs. Kotlin, build setup.

**Build-early recommendation:** the versioned adapter contract + fake adapter + offline tests that run without launching Bitwig. Biggest iteration-speed win available, and cheap before the tool surface calcifies.
