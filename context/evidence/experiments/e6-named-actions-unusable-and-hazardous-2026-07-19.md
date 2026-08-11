---
id: E6
kind: evidence
state: active
source: FINDINGS.md
---

# E6 — Named actions: unusable AND hazardous (2026-07-19)

**Verdict: ○ the named-action escape hatch is unavailable to a background
agent, and actively dangerous.** `Application.getActions()` exposes 781
actions, but invoking them from a controller extension is GUI-state
dependent, unverifiable, and — for the useful ones — operates on the exact
selection our own addressing manipulates. Probe `e06` + diagnostics
`e06-diag2/3/4/6/7`. Reduced-urgency experiment; the answer is a clean "don't."

### The surface

781 actions in 20 categories; ~264 are pure view/panel/zoom/focus ops
irrelevant to a headless agent. Typed APIs already cover the compositional
verbs (duplicateObject/deleteObject/insertFile/param writes). The genuine
**no-typed-API residual** is small: **`Group`/`Ungroup`** (track grouping —
confirmed no typed `createGroup`; only `isGroup()`/`navigateIntoTrackGroup`
exist) and **`wrap`/`unwrap`** (automation-clip conversion).

### Why they don't work for us — the behavioural model

`invoke()` resolves the action and returns cleanly (the bridge path is fine —
`resolvedName` confirms the right action), but EFFECT depends on GUI state:

- **Global actions need Bitwig to be the FOREGROUND OS app.** `Create Scene`
  bumped the scene count 9→10 when the user held Bitwig frontmost (diag3);
  backgrounded, it was a silent no-op while typed `scene.create` worked on
  identical state (diag2). Same for the `Undo` action vs typed `app.undo`.
- **Editing actions additionally dispatch against PANEL keyboard focus**,
  which the controller API cannot set. `ClipLauncherSlot.select()` sets object
  selection (Bitwig's own `isSelected` observer fires) but NOT panel focus, so
  `Duplicate` on a selected clip does nothing — even foregrounded (diag3). It
  duplicated the clip only after a `focus_or_toggle_clip_launcher` action was
  invoked first (diag4). A background agent can satisfy neither precondition.

### The hazard — actions clobber the selection our addressing sets

The decisive finding. With a **track** selected and no clip-panel focus,
foregrounded `Duplicate` duplicates the **whole track** (diag7: gn-A → a
second "gn-A" at the next index). And **our addressing selects the track it
points at** — `cursorTrack.selectChannel(track)` (E1) sets the UI selection
as a side effect. So invoking `Duplicate` while a pool cursor is active
**duplicated the gn-A fixture**, silently, and unpinned the cursor.

Over this experiment's foreground diagnostic runs it created **7 orphan gn-A
duplicates** before the mechanism was understood (cleaned up by channelId,
E2f). A pure view action (a zoom) is harmless to a pinned cursor (probe phase
D), so the danger is specifically **state-changing actions firing against a
selection we did not intend them to see** — and our infrastructure is
constantly setting that selection.

### Checkpoint implication

`invoke()` returns `void` and an inapplicable action is a silent no-op (no
throw). Actions therefore carry **zero readback** — an executor could never
confirm what one did, on top of not controlling whether it fires. That is
disqualifying for the optimistic-apply + verify model (§8c).

### Decision impact → DECISIONS

- **Policy: ghostnote does not use named actions.** They need foreground +
  panel focus a background agent cannot assume, return nothing to verify, and
  operate on the UI selection our own pointing mechanism sets — a corruption
  risk against our infrastructure tracks. Rely exclusively on typed APIs.
- **The no-typed-API residual (track Group/Ungroup, automation wrap/unwrap)
  is an accepted capability gap.** It is organisational/automation-plumbing,
  not compositional; forgoing it is cheap. Revisit only if a concrete need
  appears, and even then not via `getActions()`.
- **New rule reinforced:** because pointing a cursor selects its track,
  *nothing* in the executor should ever invoke a selection-consuming action.
  This also flags that our pointing borrows UI selection (the E1 wart) has a
  sharper consequence than cosmetic — it is why an action would hit the wrong
  target.
- Escape-hatch verdict for §12: **there is effectively no action-based escape
  hatch.** The typed API surface (E1–E4h) is the whole toolbox; where it has
  no primitive (multi-layer authoring, grouping), the answer is templates
  (E4f–E4h) or "out of scope", not actions.

---
