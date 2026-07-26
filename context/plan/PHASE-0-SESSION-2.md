---
title: Phase 0, session 2 — the UI probe, the decision debt, and one staging fix
status: DONE except E14 rows H/I — see the outcome log at the foot of this doc
updated: 2026-07-25
parent: PHASE-0-FOUNDATION.md
next: PHASE-1-ENGINE.md
---

# Phase 0, session 2

> **Outcome: items 1–3 and 6 done; item 4 REJECTED with evidence; item 5 unchanged.
> Only E14 rows H and I remain.** Three of this doc's own premises turned out to be
> wrong, which is the most useful thing it produced. Read the **outcome log at the
> foot** before acting on anything below it, because the row-F table and item 4's
> recommendation are both superseded.

> **Purpose.** Session 1 built the machinery (scope items 1–4) and deliberately
> left the two items that need a human at the keyboard or a careful pass over the
> record (items 5–6). This doc is what remains before Phase 0 can be called done.
> It also carries the handful of things session 1 found and consciously did not
> fix.

## Where session 1 landed

Scope items 1–4 of `PHASE-0-FOUNDATION.md` are complete, and exit criteria 1 and
2 are met:

- **Handler split** — `ProbeHandlers.java` (1585 lines) became 10 handler groups
  plus a registry. All 82 pre-split wire methods preserved, zero dropped, with
  `contract.hello` and `rig.methods` added. `extension/methods.golden.json` plus
  `wiremap.test.ts` make drift a failing offline test in both directions.
- **Contract v0** — seven adapter methods, with breadth in the `Op` and `Address`
  unions rather than the method count. Traps that cannot be mitigated are
  *unrepresentable* (no `app.invokeAction`, no `app.undo`, no writable
  `pressure`) rather than documented-as-dangerous.
- **Fake adapter** — models the traps, not the happy path, each citing its
  experiment.
- **Offline suite + CI** — `npm run check` is 127 green in ~1.3s with no Bitwig.
  The conformance suite runs the same cases against fake and live.

**The suite already paid for itself.** E15-B and E15-C were surfaced by the
conformance cases disagreeing with the fake — the exact drift-detection mechanism
`PHASE-0-FOUNDATION.md` §Risks specifies, working on its first outing. E15-D and
E15-E followed, and E15-E retracted both E15-C and E2/e02e.

⚠ **Session 1 grew the decision debt it did not discharge.** E15 added five
findings including two retractions, none of which are in `DECISIONS.md` either.
Item 2 below has more to transcribe than `PHASE-0-FOUNDATION.md` anticipated.

---

## 1. E14 — the in-Bitwig UI probe

*Scope item 5; exit criterion 3. Unchanged from `PHASE-0-FOUNDATION.md` — the
table is reproduced here so this doc stands alone.*

Everything surveyed is **◐ doc-only** except `showPopupNotification` (● E8).
Standing rule 10 applies: nothing is banked until probed live.

> ⚠ **Rows A–G are DONE** (`FINDINGS.md` §E14, decision **D14**). Two corrections to
> the table below, both established the hard way: the settings do **not** live in the
> Studio I/O panel (Bitwig 5.0 moved them to the top-right controller pane), and row
> F's premise misreads E1. See the outcome log.

| # | Question | Settles |
|---|---|---|
| A | Does a `getDocumentState()` Signal button fire a callback, and does it round-trip a project save? | whether the revert button is real |
| B | Does an Enum setting render as a **button group** at small option counts, and can the extension write it (push) as well as observe it (pull)? | the A/B take switcher |
| C | Do `Setting.show()/hide()/enable()/disable()` reflow the panel live? How many settings before it is unusable? | pre-allocated take slots |
| D | Is a String setting usable as a status display, given it is user-editable with no read-only mode? | the "last change" readout |
| E | Does `ClipLauncherSlot.showInEditor()` + `Application.setPanelLayout`/`zoomToFit` reliably navigate the user to a changed clip? | "show me what changed" — and how much diff UI Phase 3 owes |
| F | ⚠ **MIS-SPECIFIED — see the outcome log.** Do `NotificationSettings.setShouldShow*Notifications(false)` suppress the spray our cursor pointing causes (E1's wart)? Can they be toggled around a batch and restored? | notification hygiene under optimistic apply |
| G | Do `deleteObjects(String undoName, …)` / `duplicateObjects(String undoName, …)` really collapse to **one named** undo entry? | a correction to E3, and user-facing undo hygiene |
| H | *(timeboxed)* `HardwareSurface` + `extension-dev: true` simulated GUI: does a `HardwareButton` with **no MIDI `HardwareActionMatcher`** fire when clicked? Do `setBounds` layout, lights, text displays and an embedded `createHardwarePixelDisplay` render usefully? | whether a clickable in-Bitwig panel exists at all |
| I | *(timeboxed)* `host.createBitmap` + `GraphicsOutput` + `showDisplayWindow()`: does the window persist, redraw on demand, and render text/paths acceptably? | whether an in-Bitwig graphics view is viable |

**H and I are explicitly speculative and must not become load-bearing.** Bitwig
labels `showDisplayWindow` a debug utility in its own javadoc, and the hardware
simulator is gated behind a config flag and two right-click menus.

**Method note.** E14 needs Bitwig foregrounded and a user at the keyboard for the
click-driven rows (as E6, E7 and E8b did). Sequence it so the automated parts run
unattended and the interactive parts batch into one sitting.

**Why it blocks.** `PHASE-1-ENGINE.md` §6 makes the control layer depend on these
verdicts, and D4's claim that the human surface lives in the Studio I/O panel is
still marked `◐ doc-only` — which means §8g's privilege separation is currently
policy, not structure. Adding a wire method for the probe means regenerating
`methods.golden.json` and re-verifying with `npm run probe:hello`.

**Done when** every row has a ●/◐/○ verdict with evidence in `FINDINGS.md`, and
the Phase-1 control-layer decision is recorded in `DECISIONS.md`.

---

## 2. DECISIONS D6+ consolidation

> ● **DONE — landed as D6–D15**, which also carries the Phase-1 control-layer
> decision (D14) and the verification discipline the E15 arc produced (D15).

*Scope item 6; exit criterion 4.*

`DECISIONS.md` currently stops at D5 and its own closing section names Phase 0 as
the owner. Per SPIKE_PLAN §5, transcribe: addressing model & cursor-pool sizes
(E1/E2f/E5), pre-allocation scaffold sizes (E5/HANDOFF-E5), checkpoint fidelity
table (E2/E3), grid/units mapping (E2), batch execution mechanics (E8), toolchain
versions (E0), transport + protocol frame (E0/E9), escape-hatch policy (E6 ○).

Plus the session-1 additions, which are the load-bearing ones for Phase 1:

- **E15-A** — `TrackBank.itemCount()` reports the PROJECT total, not the window.
  This is what makes standing rule 5 implementable at all.
- **E15-B** — note properties cannot be set in the request that creates the note.
- **E15-C** — ✗ RETRACTED by E15-E. Record the retraction, not just the verdict.
- **E15-D** — only the READING write op (`cursor.setNoteProps`) is same-request
  unsafe; pointing is sound. Hence `OP_SETTLE_BEFORE`.
- **E15-E** — `pressure` cannot be written at all; refused at the contract
  boundary.
- **The methodological rule the three of them produced**, which is arguably worth
  more than any individual verdict: *a write verified through the same handle
  that performed it is not verified.* It is already `PROJECT_PLAN.md` §4 rule 3a.

**Done when** `DECISIONS.md` carries the D6+ entries and `PROJECT_PLAN.md` §4 is
demoted to a pointer at them (exit criterion 4).

---

## 3. `INITIAL_PROMPT.md` confidence markers

> ● **DONE** as a superseding banner with a correction table. The markers are
> deliberately FROZEN at their pre-spike values: they record what was *guessed*
> before evidence existed, and several guesses were wrong in ways that reshaped the
> project. Rewriting them in place would erase that.

*Exit criterion 5.* Update ◐→●/○ per SPIKE_PLAN §5.3, or add a superseding note
pointing at `DECISIONS.md`. Cheap, and it should follow item 2 so it can point at
finished entries.

---

## 4. `planStages` fragments multi-clip property writes

> ⚠ **REJECTED. The fix proposed below is UNSOUND — see E15-F and the outcome log.**
> Its premise ("E15-D measured that ops addressing different clips may share a
> stage") does not transfer to `note.props`, the one op that reads before it writes.
> A separate latent defect WAS found and fixed here. Do not implement the hoist.

*Engineering carry-over from the session-1 review. Not a defect in v0; a
measurable cost that Phase 2 will feel.*

`note.props` carries a settle class, so it always breaks a stage. That is correct
and deliberate (it is what forces the E15-B split). But `splitNoteWrite` expands
each property-bearing `note.write` in place, so the ops interleave:

    [wA(props), wB(props)]  ->  [wA', pA, wB', pB]
                            ->  stage(wA') stage(pA) stage(wB') stage(pB)

N clips with expression therefore cost **2N stages and N × `gridChange`** (144ms
each), when the plain-note path coalesces all N writes into one stage.
`stages.ts`'s own header promises "the fast path keeps its 232x win (every
`instant` op shares stage 0)", and with properties in play it does not.

**The fix is available and already proven safe.** E15-D measured that ops
addressing different clips may share a stage (`C-twoclips` asserts it on both
adapters), so hoisting the generated `note.props` ops into a single trailing
stage is sound: N clips become 2 stages and one `gridChange`.

⚠ **Two things to get right.** Hoisting must not reorder ops the caller wrote
positionally — rule 3 of `planStages` — so it can only move the props ops that
`splitNoteWrite` itself generated, never a `note.props` the caller passed. And
the props stage must still land after every write it depends on, which the
trailing position gives for free.

**Done when** the fake models it, `stages.test.ts` asserts the stage count and
budget for the N-clip case, and `npm run probe:conformance` is green live.

---

## 5. Smaller items, in descending order of consequence

- **`LiveAdapter.sceneEpoch` cannot see the user's scene ops.** A scene the human
  creates or deletes in Bitwig does not bump it, so a stale scene-relative
  address still resolves as `found` while E3's compaction has already shifted
  every row beneath it. **Documented in session 1** at the field and in
  `address.ts`; the fix needs a Bitwig observer, which D4 puts in the daemon.
  → **P1, not here.** Listed so it is not rediscovered as a surprise.
- **CI has never executed.** `.github/workflows/ci.yml` says so in its own header.
  It becomes real the day there is a remote; until then `.githooks/pre-commit` is
  the only gate that has ever run.
- **`sceneBankSize: 0`** is hardcoded in `LiveAdapter.hello()`. Harmless while
  nothing reads it, and wrong the moment something does.
- **`LiveAdapter.read` declares `unreachable` and can never populate it** —
  `refreshIndex()` throws `BankWindowOverflowError` first, so the field is
  fake-only in practice. Correct behaviour, undocumented asymmetry.
- **No lint or format tooling**, and Node's version is documented in the README
  but not pinned (`engines` / `.nvmrc`). Deliberate so far; revisit if a second
  machine ever touches this.

## 6. Corrections to `PHASE-0-FOUNDATION.md`

> ● **DONE** — the correction is now inline at that doc's exit criterion 1.

- Exit criterion 1 cites "`bwmod`'s existing 42 tests". The real count is 39 (35
  in `bwmod.test.ts` + 4 oracle). `bwmod.test.ts` is unmodified since E13, so
  nothing was lost — the 42 was always wrong. Total offline suite is 127 (**138**
  after session 2 added 11).

## Exit criteria (Phase 0 overall)

Carried from `PHASE-0-FOUNDATION.md`, with session-2 status:

| # | Criterion | Status |
|---|---|---|
| 1 | `npm test` green offline with Bitwig not running | ● 138/138 |
| 2 | Both builds reproduce clean; extension deploys via `copyExtension` | ● |
| 3 | Every E14 row has a verdict; control-layer decision recorded | ◐ A–G done (D14); **H/I remain** |
| 4 | `DECISIONS.md` carries D6+; `PROJECT_PLAN.md` §4 demoted to a pointer | ● D6–D15 |
| 5 | `INITIAL_PROMPT.md` markers updated | ● superseding banner |

---

# Outcome log (2026-07-25)

## Three of this doc's premises were wrong

Recorded first because they are the session's most transferable output, and because
each was caught by probing a stated justification rather than trusting it.

1. **Item 4's hoist is UNSOUND — rejected, not deferred.** It argued from E15-D that
   "ops addressing different clips may share a stage". E15-D measured `setNotes`, a
   pure WRITE; `note.props` is the one op that READS first, and E15-D's own lesson is
   that reads do not see same-turn state. **E15-F** measured it: a props op resolves
   its note against the clip the cursor held at TURN START, so a hoisted stage loses
   expression on a clip, silently. Interleaving is what makes the shipped plan
   correct — now stated in `planStages`' header, since nothing would have stopped
   someone optimizing it away. Guarded three ways (fake trap, `stages.test.ts`,
   `probe:e15f`).
   ⚠ **A latent v0 DEFECT was found alongside and fixed**: `splitNoteWrite` filtered
   the generated props op to the property-bearing notes, which could make its grid
   coarser than the create's and lose everything. It now carries the write's whole
   note set.
2. **Row F's premise misreads E1.** It asks whether `NotificationSettings` suppresses
   "the spray our cursor pointing causes (E1's wart)". E1's wart is that the
   **selection moves**; it says nothing about notifications, and no notification
   setting can suppress selection state. Run the long way first — six prompts, three
   conditions — it produced no spray in any, correctly. Re-specified and answered ●
   in `probe:e14-selection`, closing PROJECT_PLAN §7's open question: the selection
   can be restored, restoring it does not disturb the pool cursor, and a whole batch
   costs **one** observable change, so a single trailing restore suffices.
3. **The E14 row table names a panel that has not existed since Bitwig 5.0.** D4's
   "Studio I/O panel" was renamed and the per-controller surface moved to a pane on
   the **top-right controller icons**. Cost one sitting. The bundled user guide on
   disk is for 4.3.9 and still documents the old layout — hence standing rule 10's
   new clause: a doc pass can be wrong about where a feature APPEARS, not only
   whether it exists.

## What E14 settled (rows A–G, ● overall)

Full verdicts in `FINDINGS.md` §E14; the decision is **D14**. The surface is real:
buttons fire on human click, the enum is a button group at every count probed (2–12,
not merely "small"), push and pull both work, `show`/`hide`/`enable`/`disable` reflow
live, and document state survives save + **full Bitwig restart**, per project.

Three consequences worth carrying into Phase 1:

- ⚠ **Settings are init-only** (`"This can only be called during driver
  initialization"`), so pre-allocating take slots and revealing them with `show()`
  is **mandatory**, not tidy — the §3a idiom on its third occurrence.
- ⚠ **The pane cannot be pinned** and closes on click-away. Fine for revert; poor
  for A/B comparison during listening, which is D5's core verb. **⇒ take navigation
  moves to the Phase-3 web view, pulled forward** (the P2↔P3 seam, exercised for a
  measured reason).
- **Row G corrects E3**: one `deleteObjects(undoName, …)` call is one undo step and
  the entry carries our name. It does *not* rescue native undo as revert.

## ⚠ E14-A1 killed Bitwig, and the reason generalises

`Signal.fire()` on a document-state setting is refused — but the refusal is thrown
**asynchronously on Bitwig's own thread**, inside a runnable deferred from our call.
Our handler returned normally and its `try/catch` saw nothing. Bitwig exited with an
unsaved project open.

- **The row verdict is ○ and it STRENGTHENS D4**: only a real human click can fire
  the button, so §8g is API-enforced rather than policy.
- **The general rule is worth more**: validate inputs BEFORE calling, because a
  handler's `try/catch` protects only against a synchronous throw. Now standing rule
  3c and **D15**. Compare E7-Finding-0, which crashed the extension at init; this is
  the same class at runtime, one level worse.
- The method was **deleted, not banned** — `WIRE_METHODS_FORBIDDEN`, a harsher class
  than the ban list, because the measurement must never be repeated.

## Carried into Phase 1

- **The trailing selection restore** around every batch (D6).
- **A caller-written `note.props` for two clips loses BOTH** — every props op gets
  its own stage, so each re-points. Not reachable through `note.write`, not refused
  either.
- **`LiveAdapter.sceneEpoch` cannot see the user's scene ops** — unchanged from item
  5 below, still P1.
- **Expression writes cost 2N stages and N × `gridChange`.** A deferred-response
  protocol is the only route to reclaiming it, since it is also what would make a
  re-point inside a batch settleable.

## Still open

- **E14 rows H and I** — the two explicitly speculative ones. H now has real
  motivation rather than curiosity: the pane cannot be pinned, so a clickable
  laid-out `HardwareSurface` panel would be the only *persistent* in-Bitwig surface.
  H needs `extension-dev: true` in
  `~/Library/Application Support/Bitwig/Bitwig Studio/config.json` plus a restart,
  then "Simulate device connected" and "Show simulated hardware GUI" from the
  right-click menu in Settings → Controllers.
- Everything in **item 5** below, unchanged.
