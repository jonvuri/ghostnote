---
title: Phase 0 — Foundation, contract & the in-Bitwig UI probe
status: IN PROGRESS — session 1 (scope 1–4) done; session 2 (scope 5–6) done except
        E14 rows H/I. Exit criteria 1, 2, 4, 5 met; 3 met for rows A–G.
        Tracked in PHASE-0-SESSION-2.md.
updated: 2026-07-25
parent: ../PROJECT_PLAN.md
session2: PHASE-0-SESSION-2.md
next: PHASE-1-ENGINE.md
---

# Phase 0 — Foundation, contract & the in-Bitwig UI probe

> **Session 1 (2026-07-25) delivered scope items 1–4** — the handler split, the
> contract v0, the fake adapter, and the offline suite + CI — meeting exit
> criteria 1 and 2. **Items 5 (E14) and 6 (D6+) were deliberately deferred**, and
> with them exit criteria 3–5. They plus the engineering carry-over are tracked in
> [PHASE-0-SESSION-2.md](PHASE-0-SESSION-2.md); this doc is unchanged otherwise
> and remains the statement of what the phase owes.

> **Purpose.** Turn the spike rig into a project, and settle the two things that
> would be expensive to get wrong later: **the adapter contract** (because every
> subsequent phase writes against it) and **what the in-Bitwig UI surface can
> actually do** (because it decides whether Phase 1 ships a real control layer or a
> placeholder). Nothing musical happens in this phase.

## Why this is first

INITIAL_PROMPT §12 closes with a single build-early recommendation: *"the versioned
adapter contract + fake adapter + offline tests that run without launching Bitwig.
Biggest iteration-speed win available, and cheap before the tool surface calcifies."*
It could not be done during the spike because the contract was a spike *output*.
It is now the first thing buildable, and `bwmod`'s 42 offline tests (E13) already
demonstrate the payoff: the parts with a fake seam are the parts that got tested.

The UI probe is here rather than in Phase 1 because §8g's privilege separation and
the A/B take workflow both hang off it, and both are structural.

## Scope

### In

1. **Repo & build hygiene.** Promote the spike shell to a project: extension source
   split out of the monolithic `ProbeHandlers.java` (1585 lines) into real handler
   modules; probes archived rather than deleted (they are the regression suite for
   API behaviour); Gradle and npm builds reproducible from clean.
2. **The versioned adapter contract v0.** The typed seam between the brain and
   *some* Bitwig — real or fake. Versioned so future adapters reject incompatible
   data rather than guessing (§7). This is the interface the whole project is
   written against; the JSON-RPC frame underneath it is an implementation detail.
3. **The fake adapter.** An in-process implementation of the contract with enough
   fidelity to be worth testing against — which specifically means **modelling the
   traps, not the happy path**: two-turn write visibility, `set` being swallowed,
   pressure zeroed by gain/timbre, gain doubling on readback, empty-slot pointing
   silently landing on the wrong clip, scene compaction staling a pin.
4. **Offline test harness + CI.** `npm test` runs the entire brain against the fake
   with no Bitwig, no bridge, no controller. `bwmod`'s existing suite folds in.
5. **E14 — the in-Bitwig UI probe** (below).
6. **DECISIONS D6+ consolidation** — transcribe the spike-wide decisions owed per
   SPIKE_PLAN §5 (addressing, scaffold sizes, checkpoint fidelity, grid/units, batch
   mechanics, toolchain, transport, escape-hatch). Evidence is already in FINDINGS.

### Out

- The daemon (Phase 1) — Phase 0 establishes the *seam*, not the process.
- Any MCP tool surface. Phase 0's client is the test suite.
- Musical vocabulary, checkpoints, takes.

## E14 — the in-Bitwig UI probe

Everything surveyed is **◐ doc-only** except `showPopupNotification` (● E8). Standing
rule 10 applies: nothing here is banked until probed. Full inventory and relevance
notes are in the survey that produced this plan; the probe list:

| # | Question | Settles |
|---|---|---|
| A | Does a `getDocumentState()` Signal button fire a callback, and does it round-trip a project save? | whether the revert button is real |
| B | Does an Enum setting render as a **button group** at small option counts, and can the extension write it (push) as well as observe it (pull)? | the A/B take switcher |
| C | Do `Setting.show()/hide()/enable()/disable()` reflow the panel live? How many settings before it is unusable? | pre-allocated take slots (the §3a idiom, third occurrence) |
| D | Is a String setting usable as a status display, given it is user-editable with no read-only mode? | the "last change" readout |
| E | Does `ClipLauncherSlot.showInEditor()` + `Application.setPanelLayout`/`zoomToFit` reliably navigate the user to a changed clip? | "show me what changed" — and how much diff UI Phase 3 owes |
| F | Do `NotificationSettings.setShouldShow*Notifications(false)` suppress the spray our cursor pointing causes (E1's wart)? Can they be toggled around a batch and restored? | notification hygiene under optimistic apply |
| G | Do `deleteObjects(String undoName, …)` / `duplicateObjects(String undoName, …)` really collapse to **one named** undo entry? | a correction to E3, and user-facing undo hygiene |
| H | *(timeboxed)* `HardwareSurface` + `extension-dev: true` simulated GUI: does a `HardwareButton` with **no MIDI `HardwareActionMatcher`** fire when clicked? Do `setBounds` layout, lights, text displays and an embedded `createHardwarePixelDisplay` render usefully? | whether a clickable in-Bitwig panel exists at all |
| I | *(timeboxed)* `host.createBitmap` + `GraphicsOutput` + `showDisplayWindow()`: does the window persist, redraw on demand, and render text/paths acceptably? | whether an in-Bitwig graphics view is viable |

**H and I are explicitly speculative and must not become load-bearing.** Bitwig
labels `showDisplayWindow` a debug utility in its own javadoc, and the hardware
simulator is gated behind a config flag and two right-click menus. They are probed
because a clickable, laid-out panel with an embedded bitmap would meaningfully
change what Phase 3 needs to build — not because we intend to depend on them.

**Method note.** E14 needs Bitwig foregrounded and a user at the keyboard for the
click-driven parts (as E6, E7 and E8b did). Sequence it so the automated parts run
unattended and the interactive parts batch into one sitting.

## Decisions this phase must make

- **Contract shape and granularity.** "The patch is the interface, the tools are the
  implementation" is locked; what a patch *is*, structurally, is not. Beat Twin
  abandoned a 57-tool surface learning this lesson — the contract should be the place
  that lesson is applied.
- **Where the contract boundary sits** relative to the JSON-RPC frame: does the
  brain speak the contract and a thin layer translate to `category.action`, or is
  the contract the wire format? (Recommendation: the former — the wire frame is
  spike scaffolding, per SPIKE_PLAN §2.4.)
- **How faithful the fake must be.** Each trap modelled costs effort and buys
  regression safety; each one skipped is a class of bug that only appears live.
- **The Phase-1 control layer**, once E14 returns verdicts.

## Exit criteria

1. `cd brain && npm test` runs the full offline suite green **with Bitwig not
   running** — including `bwmod`'s existing 42 tests and new contract/fake tests.
   > ⚠ **The 42 was always wrong.** `bwmod`'s real count is **39** (35 in
   > `bwmod.test.ts` + 4 oracle), and `bwmod.test.ts` is unmodified since E13, so
   > nothing was lost — the number was miscounted when this doc was written. The
   > whole offline suite is **138** as of session 2. ● met.
2. Both builds reproduce from a clean checkout; the extension deploys via
   `gradle copyExtension` and the spike probe suite still passes against it.
3. Every E14 row has a ●/◐/○ verdict with evidence appended to `FINDINGS.md`, and
   the Phase-1 control-layer decision is recorded in `DECISIONS.md`.
   > ◐ **Rows A–G done** (FINDINGS §E14, 20+ verdicts); control-layer decision is
   > **D14**. Rows **H and I remain** — the two explicitly speculative ones.
4. `DECISIONS.md` carries the consolidated D6+ entries; `PROJECT_PLAN.md` §4 is
   demoted to a pointer.
   > ● **D6–D15**, and §4 is a pointer that names the D-entry per rule.
5. `INITIAL_PROMPT.md` confidence markers updated ◐→●/○, or a superseding note
   pointing at `DECISIONS.md` (SPIKE_PLAN §5.3).
   > ● Superseding banner with a correction table; markers deliberately frozen at
   > their pre-spike values, because what was GUESSED is the useful record.

## Risks

- **The contract calcifies too early.** Mitigation: it is *versioned* by design, and
  Phase 1 is its first real consumer — expect a v1 and plan for the revision rather
  than trying to get v0 perfect.
- **The fake diverges from live Bitwig** and starts certifying wrong behaviour. This
  is the classic failure of fake adapters. Mitigation: every trap the fake models
  must cite the FINDINGS experiment that established it, and the archived probes stay
  runnable as the live cross-check.
- **E14 returns mostly ○** and Phase 1 has no control layer. Mitigation: this is
  exactly why the probe is in Phase 0 — the fallback (pull the Phase-3 web UI
  forward, ship Phase 1 with a bare notification + a single revert path) is a
  reordering, not a redesign.

## Carry-forward from the spike

Spike code rated Phase-1-quality by its own findings — lift, do not rewrite:
`Bridge.java`, `RigConfig` + the `rig.stats`/`rig.scanTracks` handlers, `client.ts`,
the `NoteStep` idioms, the Gradle build, the GUID-substitution + `insertFile`
templating helper, the remote-controls + `modulatedValue` apparatus (E7),
`ProbeHandlers.batchRun` + the revision counter (E8), `mcp-server.ts` as a skeleton
(E9), and the whole of `brain/src/bwmod/` (E13, already production-shaped).
