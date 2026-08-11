---
id: E14
kind: evidence
state: active
source: FINDINGS.md
---

# E14 — the in-Bitwig UI probe: the human surface is REAL, and D4 named the wrong panel [K] (2026-07-25)

**Verdict: ● rows A–G all settled. D4's Studio I/O panel bet holds on substance —
real buttons, a working button-group chooser, a live-reflowing panel, per-project
persistence across a full restart — and is wrong on three specifics, one of which
cost a Bitwig crash to find.**
> **Rows H and I are ○ and are written up in their own section below.** Both die
> on the same question this section's "one real negative" raises: no
> extension-owned surface in Bitwig stays on screen.

Probes: `probe:e14` (rows A–G, interactive),
`probe:e14-verify` (persistence across restart), `probe:e14-selection` (row F
re-specified, automated), `probe:e14-status` (read-only). Apparatus:
`extension/…/UiPanel.java` + `handlers/UiHandlers.java`, 9 wire methods, golden
`5343039c7fe670cc` at 93 methods.

### The three corrections to D4, before the verdicts

1. **⚠ THE PANEL MOVED. D4 says "Bitwig's Studio I/O panel"; that has been wrong
   since Bitwig 5.0.** `getDocumentState()` settings appeared there up to 4.x,
   under the controller with a disclosure triangle. The 5.0 release notes: *"Each
   controller connected is now shown with icons in the top right of the
   application window; clicking any icon opens a pane with access to: the
   controller's help and system-level settings … the Track / Device navigation and
   pinning options (previously in the Studio I/O Panel, which is now called the
   Output Monitoring Panel)"*. 6.0.6 labels the renamed panel **"Studio Monitoring
   Panel"**, and it no longer lists controllers at all — confirmed by looking: it
   is empty of anything ghostnote. The API is unchanged and still v1; only where
   Bitwig DRAWS it moved. This cost one sitting, because the bundled user guide on
   disk is for 4.3.9 and still documents the old layout.
2. **`Setting` is an ORPHAN interface in the published API.** It declares
   `show()`/`hide()`/`enable()`/`disable()` — row C's entire question — and nothing
   returns it, extends it, or links to it. `getEnumSetting` returns
   `SettableEnumValue`, whose supertypes do not include it. Reaching it needs an
   undocumented downcast. **It works** (row C1), verified genuine by reading
   `getLabel()`/`getCategory()` back through the cast, but it is undocumented and
   guarded with `instanceof` throughout.
3. **Row F's premise is a misreading of E1** — see row F below.

### Row A — the revert button ●

| | verdict |
|---|---|
| A1 | ○ **and FATAL** — see the crash finding below |
| A2 | ● a Signal setting renders as a button and fires its observer on a human click (2 clicks → 2 fires) |
| A3 | ● String AND Enum document settings survive save + **full Bitwig restart** |
| A4 | ● document state is scoped **per project**, as D5 needs for takes |

A3 was taken in the strong form — a full application restart, not a project
reopen — so what came back came off disk rather than out of a still-running
extension. The `revertFires` counter RESET across it, which is the control: what
persists is the document, not our own state.

**⇒ the revert button is real, it is per-project, and it survives a restart.**

### ⚠ A1 — `Signal.fire()` CRASHED BITWIG, and the way it crashed is the finding

A `ui.signalFire` wire method existed for exactly one run, to test whether the
extension could press the human's own revert button. It killed the application,
with an unsaved project open:

```
java.lang.IllegalStateException: This signal cannot be invoked
  at com.bitwig.flt.control_surface.values.SignalProxy.doFire
  at com.bitwig.flt.control_surface.proxy.ControlSurfaceObject$1.run
  at com.bitwig.flt.app.BitwigStudioMain.main
```

**Two findings, and the second has far more reach than the row it came from.**

1. **`Signal.fire()` on a `getDocumentState()` setting is REFUSED.** Bitwig will
   not let anything but a real click fire it. **This STRENGTHENS D4**: §8g's
   "revert is a human verb" is enforced by the API, not merely by our choosing not
   to expose a method. The agent cannot press the button even in principle.
2. **⚠ THE REFUSAL IS ASYNCHRONOUS AND UNCATCHABLE.** Read the trace: the throw
   happens on `BitwigStudioMain`'s thread, inside a runnable Bitwig DEFERRED from
   our call. `fire()` returned normally and the handler's `try/catch` saw nothing.
   No extension-side construct can contain it.

**The general rule, which is the real prize: a handler's `try/catch` protects only
against a SYNCHRONOUS throw. Anything Bitwig defers to its own thread escapes it
and takes the application down.** So the discipline is to VALIDATE INPUTS BEFORE
CALLING, never to wrap-and-hope. `UiHandlers` was reworked on that basis — enum
values checked against their own option lists, slot indices against the
pre-allocated bank, panel layouts against the three real constants.

Compare **E7-Finding-0**, where `getModulationSource(int)` threw at `init()` and
took down the extension. This is the same hazard class one level worse: at
runtime, and it takes down the DAW.

The method was **deleted, not banned**. The existing ban list keeps
`app.invokeAction` and friends registered because the probes that banned them are
the live regression suite and re-running one is merely unwise; this one cannot be
re-run at all, so a registration is a loaded gun. A second, harsher class exists
now — `WIRE_METHODS_FORBIDDEN` — with two tests asserting the name appears
neither in the golden nor in any handler source.

### Row B — the A/B take switcher ●

| | verdict |
|---|---|
| B1 | ● the extension can SET an enum setting (push) and observes its own write |
| B2 | ● it renders as a **button group at every count probed — 2, 3, 4, 6, 8 and 12 options** |
| B3 | ● the extension OBSERVES a human changing it (pull) |

B2 is better than the javadoc implies. "Shown either as a chooser or as a button
group … depending on the number of provided options" suggests a cutoff; there is
none at any count the take switcher would use. Probed with one setting per option
count precisely because no javadoc states the threshold.

⚠ B1 initially read as a failure for a probe-side reason worth recording: the
setting still held `C` from a previous session, so pushing `C` was a no-op and no
observer fired. The probe now computes a target different from the current value.
The false failure was itself evidence for A3.

### Row C — pre-allocated take slots ● (with one ○ that makes them mandatory)

| | verdict |
|---|---|
| C1 | ● the undocumented `Setting` downcast works on Signal, Enum AND String |
| C2 | ○ **settings CANNOT be created after init** — `"This can only be called during driver initialization"` |
| C3 | ● `hide()`, `disable()`, `show()` and `enable()` all reflow the panel LIVE — no reopen, no project reload |
| C4 | ● 16 slot rows plus the rest reads as "fine" |

**C2 is the consequential one, and it is a ○ that settles a design question rather
than closing a door.** Pre-allocation is now **mandatory**, not tidy: take slots
must exist at `init()` and be revealed with `show()`. That is the §3a
pre-allocation idiom on its third occurrence, and C3 confirms the reveal works.
The refusal is clean, synchronous and catchable — the good failure mode, and the
opposite of A1.

C4 is config-tunable (`RigConfig.uiSlots`) so the ceiling can be swept with the E5
loop — edit `rig.json`, `touch` the deployed extension, look — without a rebuild.

### Row D — the status readout ●

| | verdict |
|---|---|
| D1 | ● the extension can push text into a String setting |
| D2 | ● a user edit is DETECTABLE (compare against the last value we pushed) and REPAIRABLE (we can overwrite it) |

There is no read-only String setting, so the risk was never that we cannot write
it — it is that the user can, and we would not know. Both halves work, so a status
display is viable.

### Row E — "show me what changed" ●

| | verdict |
|---|---|
| E1 | ● **all three** routes navigate: `ClipLauncherSlot.showInEditor()` (API 10), `ClipLauncherSlotBank.showInEditor(int)` (API 1), `Clip.showInEditor()` (API 18) |
| E2 | ● `setPanelLayout("EDIT")` moves the UI and `panelLayout()` reports it back |
| E3 | ● `zoomToFit()` visibly changes the focused editor's zoom |

⚠ Only three panel layouts exist (`ARRANGE`, `MIX`, `EDIT`) and the javadoc
DESCRIPTIONS of MIX and EDIT are transposed (the literal constant values are
right). The available set also depends on the active display profile, so the
layout is read back rather than assumed. **PROJECT_PLAN §3's corollary holds: we
can put the user in front of Bitwig's own piano roll, so the visual surface owes
only before/after comparison.**

### Row F — RE-SPECIFIED: the wart is the SELECTION, not notifications ●

⚠ **Row F as written cannot be answered, because its premise misreads E1.** It
asks whether `setShouldShow*Notifications(false)` suppresses "the spray our cursor
pointing causes (E1's wart)". E1's wart, verbatim:

> **Pointing borrows the UI selection.** `selectSlot` visibly moves the user's
> selection (2 changes during 3-cursor setup; user confirmed visually). Not a
> correctness problem, but a UX wart under optimistic application.

**The selection MOVES. E1 says nothing about notifications**, and no notification
setting can suppress a change to real selection state. `NotificationSettings`
governs notifications the CONTROLLER requests; they are off by default ("By
default all notifications are disabled", its own javadoc) and ghostnote enables
none. Run the long way first — six prompts, three conditions, watching for popups
— it produced **no spray in any condition**, which is the correct answer to a
question about something that does not happen. ⚠ `PROJECT_PLAN` §7 carries the
same conflation and needs the same correction.

The real question — §7's "whether the selection movement itself can be restored
after a batch is unresolved" — needs no human at all, because E1 wired an
`addIsSelectedObserver` across the slot bank. `probe:e14-selection`, automated:

| | verdict |
|---|---|
| F1 | ● pointing DOES steal the user's clip selection — E1's visual note, now a number |
| F2 | ● the prior selection CAN be saved and restored around a batch |
| F3 | ● restoring it does NOT re-point the pool cursor (non-following by construction, E1) |
| F4 | ● **three points in ONE batch produce exactly ONE observable selection change** |
| F5 | ● the notification master switch (`getUserNotificationsEnabled()`) is writable and restorable |

**F4 is what makes the fix cheap.** The batch collapses to a single visible
change, so one save-and-restore at the end of a batch fully addresses E1's wart —
there is no mid-batch strobing to engineer around. **§7's open question is
CLOSED**, with a concrete Phase-1 mechanism.

### Row G — named undo, correcting E3 ●

| | verdict |
|---|---|
| G1 | ● **ONE `deleteObjects(undoName, …)` call = ONE undo step** — three clips deleted, one undo restored all three |
| G2 | ● the undo entry carries our name: the history read `"ghostnote E14 batch delete"` |
| G3 | ● `duplicateObjects(undoName, …)` names its step too |

**E3's "there is no grouping hook in the API" was too strong, exactly as D4
suspected.** `ControllerHost.deleteObjects(String, DeleteableObject…)` (API 10)
and `duplicateObjects(String, DuplicableObject…)` (API 19) do what their
one-sentence javadoc claims. ⚠ **This does NOT rescue native undo as a revert
mechanism** — note and param writes remain ungrouped and the stack is still
project-global (E3), so snapshot-replay revert stands unchanged. What it buys is
that our bulk deletes need not shred the user's own undo history.

### ⚠ The one real negative: the pane CLOSES on click-away

The controller pane is not a dockable panel. It opens from a top-right icon and
closes as soon as the user clicks into the project. D4 wants it to host an A/B
take switcher reached for constantly, and a surface that vanishes on every click
is a materially weaker home for that than the docked panel D4 assumed.

It remains fine for **revert** — a rare, deliberate act, where opening a pane and
clicking a button is entirely reasonable. It is poor for **A/B comparison during
listening**, which is D5's core verb.

○ **CONFIRMED, not open: the pane cannot be pinned or docked.** It always closes
on click-away; there is no pin affordance. (The 📌 beside `Mode` in the pane is
Bitwig's own track/device follow pin, not a window pin.)

**⇒ the human surface SPLITS along the grain of how often each verb is used.**
Revert, and any other deliberate one-shot, belong in the pane and work well there.
Take switching during listening does not, because it would mean re-opening a
pop-over between every A/B — which is precisely the comparison D5 calls the core
verb. That is the strongest argument yet for pulling the Phase-3 web view forward
for take navigation specifically, and PHASE-0 §Risks already names that fallback
and calls it a reordering rather than a redesign.

⚠ Note what does NOT follow: §8g's privilege separation is unaffected. A1 makes it
API-enforced, so it does not depend on the pane being the take UI. A web view
served by the daemon can own take switching without weakening it, provided the
daemon keeps the agent off those endpoints — which is D4's rule anyway.

### Decision impact
- **D4 holds on substance and needs three corrections**: the panel location
  (Studio I/O → top-right controller pane since 5.0), the A1 strengthening
  (privilege separation is API-enforced, not policy), and the row F
  re-specification (selection, not notifications).
- **D4's UI story needs one addition**: the surface is a pop-over, not a dock.
- Exit criterion 3 is met for rows A–G. **H and I remain.**
  > ● **Now met in full** — rows H and I below, 2026-07-25.
- New standing-rule material: *an exception Bitwig defers to its own thread cannot
  be caught by the extension, so validate before calling.*
- Row C2 makes pre-allocation of take slots a requirement for Phase 1's control
  layer, not an option.

---
