---
id: D14
kind: decision
state: active
source: DECISIONS.md
---

# D14 — The human control layer **[SETTLED 2026-07-25, E14 rows A–I]**

**Bitwig's per-controller pane hosts the deliberate verbs (revert, status, slot
reveal). Take switching moves to the Phase-3 web view. §8g's privilege separation
is API-ENFORCED, not policy.**

> ⚠ **REVISED 2026-08-07 (E16m/E16w/E17 row 6, D18, D4 rev).** Two changes and a
> dissolution:
>
> - **Coarse A/B needs no ghostnote UI at all.** The take mechanisms are Bitwig's
>   own surfaces — exclusive chain solo (one flag, E17 row 6), clip launch
>   (quantised by construction, the only beat-aligned A/B — E16m's recorded
>   complaint, answered in D18a), group mute. The "take switcher" this entry moved
>   to Phase 3 is mostly **dissolved rather than relocated**; what Phase 3 still
>   owed — comparison and summary views — defaults to TEXTUAL, agent-rendered
>   forms, since the web view itself is now optional (D4 rev, operator 2026-08-07).
> - **The privilege concern MOVES.** "The daemon keeps the agent off those
>   endpoints" is moot: under D18, A/B switching is an ordinary non-destructive
>   write the agent may make anyway. What stays privileged is unchanged in
>   substance — the revert *decision* is human (and the document-state button is
>   API-enforced: `Signal.fire()` refused, E14-A1), and destruction is never the
>   agent's decision (D20).

> ⚠ **REVISED 2026-08-14 (E22, D18 rev).** Remove `group mute` from the take
> surfaces above. Track forks are no longer managed takes. Coarse managed A/B is
> layer-chain solo plus clip launch; an ordinary copied track can still be
> compared with Bitwig's normal project-wide track controls, without ghostnote
> take semantics. This does not restore a need for a ghostnote take switcher.

This is the Phase-1 control-layer decision PHASE-0 exit criterion 3 requires.
D4's substance survived; three of its specifics did not.

- ⚠ **The panel MOVED.** D4 says "Studio I/O panel"; that has been wrong since
  Bitwig **5.0**, which relocated the per-controller surface to a pane opened from
  **controller icons in the top right of the window** and renamed the old panel
  (now "Studio Monitoring Panel" in 6.0.6), which no longer lists controllers at
  all. The API is untouched and still v1 — only where Bitwig draws it moved.
- **What works** (E14): Signal buttons fire on human click; Enum renders as a
  **button group at every count probed, 2–12**; the extension can both push and
  observe; String settings work as a status readout with user edits both detectable
  and repairable; `show`/`hide`/`enable`/`disable` reflow **live**; and document
  state survives save + **full Bitwig restart**, scoped **per project**.
- ⚠ **The pane CANNOT be pinned or docked** — it closes on click-away. Fine for
  revert, a rare deliberate act. Poor for A/B comparison during listening, which
  D5 calls the core verb, since it would mean re-opening a pop-over between every
  comparison. **⇒ take navigation belongs in the Phase-3 web view**, pulled
  forward. PHASE-0 §Risks already names this fallback and calls it a reordering
  rather than a redesign.
- ⚠ **§8g is stronger than D4 claimed.** `Signal.fire()` on a document-state
  setting is REFUSED by Bitwig — only a real human click fires it (E14-A1). So
  "revert is a human verb" is enforced by the API rather than by our restraint,
  and it does not depend on the pane being the take UI. A daemon-served web view
  can own take switching without weakening it, provided the daemon keeps the agent
  off those endpoints.
- **Notification hygiene is a non-issue.** `NotificationSettings`' switches govern
  notifications the CONTROLLER requests, they default off, and ghostnote enables
  none — so pointing produces no spray to suppress. The real E1 wart is selection
  movement, handled in D6.

### ⚠ Confirmed by rows H and I: **Bitwig has no persistent extension-owned window**

D14 was decided on one measurement — the controller pane closes on click-away.
E14's two speculative rows were probed precisely because a persistent surface
would have reopened it. **Both returned ○ on exactly that question**, so the
decision now rests on three independent surfaces agreeing:

| surface | verdict |
|---|---|
| the per-controller pane (rows A–G) | closes on click-away, cannot be pinned or docked |
| `HardwareSurface` simulated GUI (row H) | **closes on click-away** — everything else about it works |
| `Bitmap.showDisplayWindow()` (row I) | **never opens at all** on macOS / Bitwig 6.0.6 |

⚠ **Row H's ○ is narrow and the rest of it is ●**, which is why it is recorded
rather than dismissed: the surface builds, `setBounds` lays it out, lights and
text reach it, an embedded pixel display renders, and **a `HardwareButton` with
no `HardwareActionMatcher` fires on a click** (press and release) even though
`isSupported()` correctly reports `false` — the simulator synthesises actions
directly rather than routing them through a matcher. It is a complete, working,
clickable panel that will not stay on screen. It would also have needed
`extension-dev : true`, a restart and two right-click menus to reach a user, so
it was never shippable regardless.

⚠ **Row I's renderer is ●, and worth keeping in mind for Phase 3.**
`GraphicsOutput` is a competent 2D surface: the default font face needs no
`loadFontFace`, text is cleanly antialiased and readable down to ~10px, béziers
and dashes are smooth, and **alpha compositing works** — which is the before/after
overlay a diff view wants. A warm 640×320 re-render costs ~300µs; `showText` is
the expensive primitive at roughly 1ms a string. **If an in-Bitwig raster panel is
ever wanted, the drawing is solved and only the window is missing.**

⇒ **take navigation stays in the Phase-3 web view**, and the reasoning is no
longer contingent on one pane's behaviour.
