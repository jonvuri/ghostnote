---
title: ghostnote spike — Handoff for E8–E9 + deliverables
status: E0–E7 complete (every §12 open question now has a verdict); resume at E8
updated: 2026-07-20
---

# Handoff: continue the ghostnote spike (E8, E9, then deliverables)

You are picking up an in-progress hardware/API verification spike for
**ghostnote** — a personal Bitwig Studio MCP server (thin `.bwextension` +
TypeScript brain). The previous sessions ran **E0–E7**. **Every §12 open
question now has a ●/○/◐ verdict.** Your job is the **last two experiments —
E8 (concurrency/batch pacing) and E9 (MCP smoke test)** — and then the spike's
**final written deliverables** (`DECISIONS.md`, `PROJECT_PLAN.md`, confidence-
marker updates, carry-forward list). Everything below makes you productive
immediately.

## Read these first (in order)
1. `context/INITIAL_PROMPT.md` — locked project vision, §-numbered reference
   (§6a = direct-param differentiator, §8 = optimistic-apply + checkpoint
   model, §12 = the open-questions list this spike answers).
2. `context/spike/FINDINGS.md` — **the running evidence log; read all of it.**
   Every verdict + the gotchas that will bite you. The **Method** section's
   *four-false-negatives rule* and the *fatal-deprecation* rule (E7) are
   load-bearing. Read E7 closely — it is the newest and touched the rig.
3. `context/SPIKE_PLAN.md` §4 — experiment matrix. **E0–E7 COMPLETE; E8, E9
   remain**, each with Q/Method/Settles. §5 lists the exit deliverables you
   write after E9.
4. `context/DAW_MCP_ANALYSIS.md` — reuse posture (reference quarry in
   `reference/daw-mcp/`, gitignored; MIT, credited in `NOTICE`).

## Where things stand
- **All of §12 is answered.** #1 addressing ● (E1/E2f), #2 differentiator ●
  (E4/E4b, extended E4c–E4h), #3/#4 structural+revert ● (E3), #5 scale ● (E5),
  #6 modulators ◐→ author-by-template/drive-at-runtime (E7). E8 and E9 are
  **infrastructure de-risking, not open architectural questions** — E8
  stress-tests the §8 batch/safety mechanics, E9 wires the MCP SDK once.
- Project on git branch `initial-spike`. **Do not run git write commands** —
  the user commits after reviewing each task. **Stop after each experiment for
  user review.**
- The Bitwig project is **completely throwaway** (user confirmed) — churn it
  freely, but restore fixtures at each probe's end so later probes run clean.

## The working rig (how to actually run things)
- **Bitwig 6.0.6** must be running with the **ghostnote controller added**
  (Settings → Controllers → Add Controller → vendor "ghostnote"). One-time
  manual step per Bitwig launch; only the user can do it. Popup on load:
  "ghostnote bridge listening on 127.0.0.1:8686". Check: `nc -z -w1 127.0.0.1 8686`.
- **Bridge:** newline-delimited JSON-RPC 2.0 over TCP `127.0.0.1:8686`.
- **Build/deploy:** `cd extension && gradle copyExtension`. Bitwig
  **hot-reloads** on the `.bwextension` file changing (a real content change,
  which `copyExtension` is — a bare `touch` is NOT). Bridge returns in ~3s.
  ⚠ **If init throws, the bridge never binds** and you get a "ghostnote did
  something wrong" popup — check `~/Library/Logs/Bitwig/BitwigStudio.log`
  (tail it) for the stack trace. E7 lost ~25s to a fatal-deprecation crash
  found exactly this way.
- **Run a probe:** `cd brain && npm run probe:eNN` (or `npx tsx src/probes/…`).
  Typecheck: `npx tsc --noEmit`. **Gotcha: the Bash tool's cwd resets between
  calls — always `cd` into `brain/` (or `extension/`) in the SAME command**, or
  tsx resolves against the wrong dir and fails `ERR_MODULE_NOT_FOUND`.
- **`tsx -e "…"` cannot use top-level await** (cjs). Write a throwaway
  `src/probes/*.ts` file instead and delete it after.
- **Fixture:** tracks **gn-A** and **gn-B** (Instrument), small note clips.
  `brain/src/probes/lib.ts` `ensureFixtureTracks()` creates/repairs them.
  Current project also has **track 0 "Instrument Layer"** (user's hand-built
  4-chain layer) — leave it; E4g/E4h use its saved preset. **Always restore
  fixtures + delete inserted devices/tracks/scenes at the end of every probe.**
- **User-built preset assets (E7):** `~/Documents/Bitwig Studio/Library/Presets/
  Polysynth/modtest.bwpreset` (Polysynth + LFO→Filter Freq) and `modzoo.bwpreset`
  (Polysynth + Classic LFO + Random). Not needed for E8/E9, but they exist and
  E7 probes find them by name.

## Architecture facts already established (do NOT re-derive)
Everything from the E7 handoff still holds. The load-bearing ones, plus **what
E7 added**:

- **Addressing (E1/E2f):** pinned cursor pool via "trackThenSlot"; `channelId`
  = stable track identity (survives save + restart, verified to 48 tracks);
  writes need `setImmediately` (plain `set` is swallowed by take-over); pointing
  a cursor **selects its track** (the E1 wart — why named actions are hazardous).
- **Fidelity (E2):** `setStep→getStep` exact; **two-tick write→verify rule**;
  many silent no-op write traps — **always verify by readback.**
- **Structural budgets (E3/E4d):** device insert **~600ms**; track create
  **~144ms**; `insertFile` of a multi-chain preset **~268ms** (record-order
  fast). Undo is per-op (no grouping API) — the brain must own revert via
  snapshot-replay.
- **Scale (E5):** no knee below 65k slots; latency flat at the ~24ms
  control-surface tick floor. Ship `TRACKS=256, SCENES=128, CURSOR_POOL=8,
  DEVICE_BANK=16, paramHandles=64`, config-tunable via `RigConfig`
  (`~/.ghostnote/rig.json`; **should be ABSENT right now** → compiled defaults
  16×16; if a probe leaves one, `rm` it). A full bank scan is ~3–6ms — cheap but
  not per-op; prefer `resolveByChannelId`.
- **Templates (E4d–E4h):** structure/modulation is **user/template-authored,
  agent-driven.** `insertFile` takes **absolute paths only** + requires the
  **`.bwpreset` extension** (both fail SILENTLY otherwise); device identity is a
  raw 16-byte GUID, length-preservingly substitutable (E4g) — **but NOT for
  modulators (E7, below).**
- **Named actions (E6): DO NOT USE** — foreground+focus gated, zero readback,
  and they fire against the UI selection our addressing sets. No escape hatch.
- **Modulators (E7):** classic `getModulationSource`/`Macro`/`ModulationSource`
  API is **hard-deprecated → throws at init → crashes the extension** (a new
  gotcha class: *fatal* deprecations; check `@Deprecated` before wiring a handle
  at init). The live surface is **remote controls** (`createCursorRemoteControlsPage`);
  `Parameter.modulatedValue()` reads post-modulation value (a **required
  checkpoint field**). A loaded modulator's own controls are read/write via its
  auto-created remote page; routing-target creation is closed even foregrounded;
  modulator GUID substitution FAILS. Design = **slot-bank templates** (Finding H).

### What the rig now carries (extension/src/main/java/com/ghostnote/extension/)
`Rig.java` and `ProbeHandlers.java` grew during E7. Relevant to E8:
- The **bridge already marshals every request onto the control-surface thread**
  via `host.scheduleTask(() -> writeLine(processRequest(req)), 0)`
  (`Bridge.java` ~line 111). Responses are `synchronized(out)` and **may complete
  out of order** (documented at the top of `Bridge.java`). So a brain-side
  "batch" is N independent requests, each its own `scheduleTask` — E8 must decide
  whether batches need a *single* server-side batch method with internal pacing,
  or whether per-request scheduling already suffices.
- `GhostnoteExtension.flush()` is currently **empty** — no batched flush logic
  yet. `init()` builds `Rig`, starts `Bridge`, sets init stats.
- E7 added a `Transport` handle (`transport.stop`, `transport.status`,
  `slot.launch`) and remote-control handlers (`remote.list/set/setMapping/
  selectPage`, `param.modulated`, `param.touch`, `device.insertFileAt`). Reuse
  `notify` (`host.showPopupNotification`) for the E8 mid-batch notification test.

## Your first task: E8 — Concurrency & safety mechanics (SPIKE_PLAN §4)
- **Q:** Do the §8 mechanisms behave under load and interference?
- **Method:**
  1. **200+-op batch paced via `scheduleTask`.** Run a large batch (e.g. note
     writes across many steps/clips, mixed with a few device inserts) and
     measure throughput + UI responsiveness. Decide the pacing primitive: today
     each RPC is its own `scheduleTask(…, 0)` — test whether a dedicated
     **server-side batch handler** (one request carrying N ops, paced internally
     with `scheduleTask(…, delayMs)` between structural ops) beats N round-trips,
     and what delay the two-tick write rule (E2) + ~600ms device-insert budget
     (E3) actually require.
  2. **Interleave user edits mid-batch** (extends E1's interference test to
     *writes*): while a batch runs, have the user click/drag/edit other clips
     and confirm pinned-cursor writes still land on target (this needs the user
     at the keyboard — ask explicitly, like E6's foreground step, and tell them
     when to stop).
  3. **`showPopupNotification` mid-batch** — confirm it fires and is a usable
     progress-UX signal without stalling the batch.
  4. **Stale-revision sketch** — a **monotonic counter in the extension**;
     a write tagged with a stale revision is **rejected**. Confirm the mechanism
     has a clean home on the extension side (where revision state lives, how a
     rejected write reports back). This is a *sketch to de-risk*, not a full
     implementation.
- **Settles:** batch pacing parameters; **where revision state lives**;
  notification UX baseline. Feeds `DECISIONS.md` "batch execution mechanics".
- **Budgets to design against:** ~600ms/device-insert (E3), ~144ms/track,
  ~268ms/insertFile, the two-tick write→verify rule (E2), full bank scan ~3–6ms
  (E5). Batches mixing note-writes and structural/device ops need **staged
  pacing** (fast note phase, then slow structural phase).
- **Rig/handler work:** add a batch handler + a revision counter to
  `ProbeHandlers`/`Rig` following the established idiom; add an `e08` probe.
  Keep it idiomatic — this code is a carry-forward candidate (the batch executor
  is real Phase-1 infrastructure).
- **Timebox:** medium. The interference sub-test needs the user; sequence it so
  you're not blocked waiting.

## Then E9 — MCP smoke test (SPIKE_PLAN §4; last, cheap)
- **Q:** Any surprises wiring the TS MCP SDK over the bridge?
- **Method:** a **minimal MCP server** exposing **two tools** (`ping`,
  `read_notes`) backed by `brain/src/client.ts`; drive it from Claude Code.
  Pure Phase-1 wiring de-risk — **nothing architectural.** Check the
  `claude-api`/MCP skill if you need current SDK shape; keep it minimal.
- **Settles:** nothing architectural; confirms the MCP layer sits cleanly on
  `client.ts`. If it "just works," say so briefly and move on.

## Then: the spike deliverables (SPIKE_PLAN §5) — the real output
The spike's deliverable is **not code**; it is these documents. Write them once
E8/E9 are done:
- **`context/DECISIONS.md`** — every settled decision + evidence pointer:
  addressing model (pinning, cursor-pool sizes, re-resolution rules); scaffold
  sizes + **bank-window overflow = checkpoint hazard, fail loud** (E5); checkpoint-
  fidelity table (incl. `modulatedValue` + `hasAutomation` as required fields,
  E7/E4); grid/units; **batch mechanics + revision home (E8)**; toolchain
  versions; transport/protocol frame; **escape-hatch = none (E6)**;
  **chain-construction = templates (E4d–E4h)**; **modulator verdict + slot-bank
  design (E7 Finding H)**.
- **`context/PROJECT_PLAN.md`** — full Phase-1 plan: **contract v0 + fake adapter
  FIRST** (per §12 build-early — it's the first Phase-1 task, a spike *output*);
  patch schema ("the patch is the interface"); checkpoint store; **Phase-2
  ordering now fully rankable** (direct-param sound design got much stronger via
  templating E4/E4c; modulation is template+drive via slot-bank E7; live-mapping
  authoring is out); param-catalog go/no-go (harvest bundle → resolve-check).
- **Update `INITIAL_PROMPT.md` confidence markers** ◐→●/○ where settled (esp.
  §12 #6), or a superseding note pointing at `DECISIONS.md`.
- **Carry-forward list:** spike files clean enough to lift into Phase 1 —
  `Bridge.java`, `RigConfig`, `client.ts`, NoteStep idioms, the Gradle build,
  the GUID-substitution + `insertFile` templating helper, the remote-controls +
  `modulatedValue` apparatus (E7), and the E8 batch executor + revision counter.

## Working conventions
- **Stop after each experiment for user review**; don't batch-run E8→E9.
- **Don't run git write commands**; the user commits.
- **Restore fixtures + delete inserted devices/tracks/scenes/notes at every
  probe's end.** Make structural probes self-healing (snapshot channelIds,
  delete strays). Restore gn-A slot0 `[[0,60,100,1]]` / gn-B slot0 `[[2,62,100,1]]`.
- A probe "FAIL" is often a **wrong test expectation encoding a real finding** —
  read it, don't chase green (E7's swap "FAILs" were the real substitution
  verdict; E6's phase-D was the Duplicate hazard).
- **Before recording any capability ○:** walk supertypes, enumerate every verb,
  grep `member-search-index` (all versions) + `new-list`, and use a live probe.
  **Five-plus false negatives** this spike came from single-mechanism checks;
  several were caught only when the user pushed back on a confident negative.
- **Check `@Deprecated` before wiring any handle at init** (E7) — some
  deprecations throw and crash the extension on load.
- Some probes need Bitwig **foregrounded** or a **user at the keyboard** (E6, E7,
  and E8's interference test do) — that's a user action; ask explicitly and tell
  them when they can release it.
- Keep the high-effort bar: E8's pacing + revision design needs judgement, and
  the deliverables are the whole point of the spike.

## Current probe inventory (brain/package.json)
e00, e01a/b, e02–e02f, e03/b, e04, e04b, **e04c(+diag,diag2), e04d(+diag),
e04e, e04f, e04g, e04h, e05, e05b, e05c, e06,
e07, e07b, e07c, e07d, e07e, e07f, e07g**. Reuse `lib.ts` helpers everywhere.
