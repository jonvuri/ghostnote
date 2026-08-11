---
title: Phase 1, session 4 — the in-Bitwig control layer
kind: plan
state: planned
status: not started
updated: 2026-07-25
parent: README.md
prev: 3g-record.md
next: 5-proving.md
scope: PHASE-1-ENGINE.md item 6
evidence: E8-C, E14 rows A–G, E14-A1 · D5, D7, D14, D15
needs: Bitwig foregrounded, a human at the keyboard
---

# Phase 1, session 4 — the in-Bitwig control layer

> **Purpose.** Optimistic apply is unsafe without a control layer, so this is the
> session that makes the safety machinery *reachable by a human*. Per D14: the
> per-controller pane hosts the **deliberate one-shots** — revert, status, "show me
> what changed" — and §8g's privilege separation is **API-enforced**, not policy.
> **Take A/B is deliberately not here.**

## Why this is fourth, and why it needs a sitting

Every part of this was probed in Phase 0, so nothing here is speculative: E14
rows A–G returned ● on buttons firing from a human click,
`show`/`hide`/`enable`/`disable` reflowing live, a String setting working as a
status readout, and document state surviving save plus a **full Bitwig restart**,
scoped per project. What is left is turning `UiPanel.java` from a probe apparatus
into a product surface wired to the daemon.

It comes after the daemon because the revert button must reach the take store, and
the store lives in the daemon.

**⚠ This session needs Bitwig foregrounded and a human at the keyboard**, as E6,
E7, E8b and E14 did. Sequence it so the wiring is written and unit-tested first and
the click-driven verification batches into one sitting.

## ⚠ Exit criterion 4 is RELAXED — take A/B leaves Phase 1

`PHASE-1-ENGINE.md` (2026-07-24) exit criterion 4 wants two takes A/B-compared and
switched **from inside Bitwig, with no terminal and no web UI**. D14 (2026-07-25)
then found the pane **cannot be pinned and closes on click-away**, and concluded
take navigation belongs in the Phase-3 web view.

**Resolved 2026-07-25: D14 wins, and Phase 1 builds no take switcher at all.**
The enum button group demonstrably works (● at every count probed, 2–12) and
shipping it would satisfy criterion 4 on paper — but A/B comparison happens *while
listening*, and a chooser that closes on click-away means re-opening a pop-over
between every comparison. That is not a wart on the core verb, it is the core verb
not working. Building it would be work spent on a surface that gets replaced in
Phase 3 anyway.

⇒ **Phase 1's in-Bitwig surface is revert, status and navigation.** Exit criterion
4 moves to Phase 3 with the rest of take navigation. The consequence to accept is
named in `PHASE-1-ENGINE.md` §Session index: the branchable take store ships
without a human ever exercising A/B, so **Phase 3's timing matters more than it
did** — session 2's exit criteria carry the whole weight of proving the store is
right.

## Scope

### In

1. **`UiPanel.java`, from apparatus to product.** Strip the E14 probe scaffolding —
   `shapeProbes` and the option-count sweep, `lateSettings`, **and `takeChooser`**,
   which no longer has a job. Keep the three surfaces that earned their place.
2. **⚠ Everything pre-allocated at `init()`.** Not tidiness — D7, amended: settings
   refuse creation afterwards with *"This can only be called during driver
   initialization"*, and `host.createBitmap` refuses with the **same sentence**
   from an unrelated subsystem. Four independent occurrences make it the default
   assumption. ⚠ This applies with less force now that there are no take slots to
   reserve, but it still governs the status and revert settings — and it governs
   **anything Phase 3 might later want in the pane**, which is now a real
   possibility rather than a hypothetical.
3. **The revert button.** A `Signal` in the pane, reverting the **last take**.
   Only a real human click fires it: Bitwig **refuses** `Signal.fire()` from the
   extension, which is what makes §8g structural rather than policy.
4. **The status readout.** A String setting as "last change." It is user-editable
   with no read-only mode, but E14 row D proved edits are both **detectable and
   repairable** — `statusTextLastPushed` is the existing idiom.
5. **Navigation to what changed.** `ClipLauncherSlot.showInEditor()` +
   `Application.zoomToFit()` (● E14 row E). This is the cheapest UI in the whole
   project: it puts the user in Bitwig's own piano roll, and it is a large part of
   why Phase 3 is scoped small.
6. **Progress notifications.** Interleave `notify` ops into a paced batch — free,
   no special machinery (E8-C). Under optimistic apply this is not politeness: the
   user needs to know their session changed while they were playing (§8d).
7. **Keep `ui.signalFire` deleted.** It is `WIRE_METHODS_FORBIDDEN`, a harsher
   class than the ban list — **it must not be registered at all**, because a
   registration is a loaded gun regardless of reachability (E14-A1).

### Out

- **Take switching and A/B of any kind** — Phase 3, per D14 and the ruling above.
  This is the single largest thing this session does *not* build, and the enum
  apparatus already sitting in `UiPanel.java` should be deleted rather than left
  half-wired, so nobody later mistakes it for an unfinished feature.
- Pre-allocated take slots (`RigConfig.uiSlots`). They existed to make takes
  reachable from the pane. Leave the config knob, drop the settings.
- Any raster/graphics panel. Row I's renderer is genuinely good (antialiased text,
  working alpha compositing, ~300µs per warm re-render) but
  `showDisplayWindow()` **never opens a window** on macOS / Bitwig 6.0.6. Only the
  window is missing, and it is missing completely. Do not revisit in Phase 1.
- `HardwareSurface` panels. Row H closes on click-away too, and would need
  `extension-dev: true`, a restart and two right-click menus to reach a user.
- Push signalling from extension to daemon — session 6. Poll.

## ⚠ Inherited from session 3 (2026-08-08)

**How the extension tells the brain a human pressed a button.** Session 3's
original doc owed this decision and recommended *"the daemon polls a `ui.state`
method at a modest interval"*. ⚠ There is no daemon (D4 rev) and the recommendation
survives it unchanged — the poller is now the **MCP server** (`brain/src/session.ts`
holds the connection). The reasoning still stands: nothing new is needed, and a
revert button is a rare deliberate act where 100 ms of latency is invisible.
Session 6 generalises it into a push, which is the same machinery as deferred
batch responses.

⚠ Bitwig still REFUSES `Signal.fire()` on a document-state button (E14-A1,
`WIRE_METHODS_FORBIDDEN`), so only a real human click can press one. That is
Bitwig enforcing rule 8, not us.

## Decisions this session must make

- **What the status line says** in its 64 characters, and what happens when the
  user types into it. *Recommendation: detect and repair on the next push*, which
  E14 row D proved works. With the chooser gone this is the pane's only *state*
  readout, so it carries more weight — "which take am I on" now has nowhere else
  to be shown in Bitwig.
- **The poll interval** for button presses (session 3's decision, exercised here).
- **Whether revert is one button or two.** With no chooser, "revert the last take"
  is the only reachable verb. *Recommendation: ship exactly that* — a second
  "revert to…" control implies a selector, which is the thing being deferred.

## Exit criteria

1. A human clicks **Revert** in the pane and the last batch is reverted, with no
   terminal involved.
2. The agent has **no path** to fire it: `ui.signalFire` is unregistered and
   asserted unreachable, alongside the existing `WIRE_METHODS_BANNED` checks.
3. After a batch, `showInEditor()` puts the user in front of the changed clip.
4. The status readout names the current take, survives project save + a **full
   Bitwig restart** per project, and repairs itself if the user types over it.
5. The take chooser and slot settings are **gone** from `UiPanel.java`, not
   disabled — with a comment citing D14 so the deletion reads as a decision.
6. `extension/methods.golden.json` regenerated, `wiremap.test.ts` green, and
   `npm run probe:hello` clean after deploy.

## Risks

- **⚠ E14-A1 is the hazard class to respect here.** `Signal.fire()` returned
  normally and threw **asynchronously on Bitwig's own thread**, escaping every
  extension frame and killing Bitwig with an unsaved project open. Standing rule
  3c / D15: **validate inputs before calling** — a handler's `try/catch` is not a
  safety net. `UiPanel.optionsFor` exists for exactly this reason and any new
  writable setting needs the same treatment.
- **Init-only allocation is easy to forget** and fails only at runtime, on a
  machine with a real project open. Mitigation: one place that builds the panel,
  at init, with nothing constructing settings elsewhere.
- **⚠ The chooser gets rebuilt mid-session** because it is *right there* and looks
  like an hour's work. It is an hour's work; that is not the objection. The
  objection is that it is an hour spent on a surface D14 measured as unusable for
  the verb it serves, which Phase 3 then replaces. Mitigation: delete the
  apparatus rather than leaving it (scope item 1 and exit criterion 5), so
  rebuilding it is a visible decision rather than a five-line uncomment.
- **This session is now small enough to fold into session 5**, since both need a
  human at the keyboard and this one lost its largest item. Kept separate on the
  original reasoning — a control layer still being written is a bad thing to debug
  during a live sitting — but if session 3 lands clean, merging the two sittings is
  a reasonable call rather than a corner cut.
