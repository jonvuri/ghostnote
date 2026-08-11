---
id: D4
kind: decision
state: active
source: DECISIONS.md
---

# D4 — Process topology and the human surface **[SETTLED 2026-07-24]**

**`ghostnoted` (a long-lived daemon) owns session state; the MCP server is one of its
clients; the human's controls live in Bitwig first and a local web view later. There
is no custom chat harness.**

> ⚠ **REVISED 2026-08-07 (E16p, E16s, E16-REPLAN §2, D18). The daemon is RETIRED.**
> Two of its three jobs no longer exist and the third was never a constraint. Where
> each landed:
>
> - **Observers move into the EXTENSION** — a strictly better home: alive whenever
>   Bitwig is, so it cannot miss an edit made while no client is attached, which a
>   daemon started later provably can. It carries **both** a scene-count epoch and a
>   launcher-content epoch, and the content epoch is the one clip addressing
>   consults (E16s: the count observer sat still, 3 → 3, through a human clip drag
>   the content observer reported as a pair, `t2s7=emptied`/`t2s3=filled`). Initial
>   values arrive through the same callbacks, so an epoch is meaningless in absolute
>   terms — only a difference across a known event means anything.
> - **The MCP server holds a bridge connection directly.** Ordering needs no
>   daemon: the extension-side revision guard is atomic **across connections**
>   (E16p — 6/6 rounds, exactly one winner). Omission-detection died with the take
>   log — there is no log to leave a gap in (D17 rev). Standing rule 7 is STRUCK
>   with this (PROJECT_PLAN §4), and D10's *"hence standing rule 7"* bullet with it.
> - **The change log's job is superseded: the PROJECT is the take log**
>   (E16-TRACK-NATIVE). Branch-event metadata lands in `getDocumentState()`
>   [⚠ capacity for a JSON payload unmeasured — owed, P1]; changesets live in the
>   chat log and are the input to agent-edit reversal (D19).
> - ⚠ **The web view is OPTIONAL, evaluated again after the core is built**
>   (operator, 2026-08-07). Default: forego what needs it, or build a TEXTUAL
>   version agents can naturally produce and render. If it is ever built, it is
>   MCP-server-hosted and lives and dies with the chat session. ⚠ Tripwire: if it
>   ever wants to be usable with no agent attached, the daemon decision REOPENS.
>
> *"No custom chat harness"* survives untouched.

INITIAL_PROMPT §2 assumed "the TypeScript process is both the MCP server and the
brain." That does not survive contact with §8g: an MCP stdio server is a subprocess of
the chat client, so in-memory checkpoints die with the session, and *every channel into
that process is a channel the agent can also use* — leaving revert-as-a-human-verb
nowhere to live.

- **The daemon owns** the single bridge connection, the take store, the change log,
  and (uniquely) any Bitwig **observers** — which is what lets the change log
  distinguish agent edits from the user's own concurrent edits (§8d assumes the user
  is editing while the agent writes).
- **All writes go through the daemon.** The extension-side revision counter (E8)
  arbitrates *ordering* across processes, but cannot detect *omission* — a bypassing
  write leaves a silent gap in the take log.
- **The human surface is Bitwig's Studio I/O panel** (`host.getDocumentState()`,
  API v1): Signal buttons, an Enum that renders as a button group at small option
  counts, String/Number/Boolean widgets, `show()/hide()/enable()/disable()` at
  runtime, and values that are both writable (push state) and observable (pull
  intent) — **persisted inside the project document**. Nothing there is reachable over
  the bridge, so §8g's privilege separation becomes structural rather than policy.
  > ⚠ **PROBED 2026-07-25 — D14 SUPERSEDES THIS BULLET.** E14 confirmed every
  > capability listed, and found the button group works at **12** options rather
  > than only "small counts". It corrected three things this text gets wrong:
  > **(1) the panel MOVED.** Bitwig 5.0 relocated the per-controller surface to a
  > pane opened from controller icons in the **top right of the window**, and
  > renamed the old panel ("Studio Monitoring Panel" in 6.0.6) — which no longer
  > lists controllers at all. The API is untouched; only the drawing moved.
  > **(2) "nothing there is reachable over the bridge" understates it.** Bitwig
  > REFUSES `Signal.fire()` outright, so the separation is API-enforced rather
  > than a consequence of which wire methods we choose to register.
  > **(3) the pane cannot be pinned** and closes on click-away, making it a poor
  > home for A/B take switching during listening; that moves to the Phase-3 web
  > view. Revert and other deliberate one-shots stay here and work well.
- **A local web view (Phase 3) adds only what Bitwig cannot do:** before/after
  comparison, cross-object change summaries, take navigation, partial revert.
  `ClipLauncherSlot.showInEditor()` + `Application.zoomToFit()` already handle "show
  me what changed" using Bitwig's own piano roll, which is better than anything we
  would render.
- **A custom chat harness is ruled out**, not deferred. Embedding the agent loop in a
  bespoke app means building streaming, tool-call rendering, session persistence and
  model configuration — none of it musical, all of it ongoing maintenance.

*Adjacent correction to E3:* `deleteObjects(String undoName, …)` (API 10) and
`duplicateObjects(String undoName, …)` (API 19) are documented as acting "within one
undo step" with a caller-supplied name — so E3's "no grouping hook in the API" is too
strong. It does **not** rescue native undo (note and param writes remain ungrouped and
the stack is still project-global, so snapshot-replay revert stands unchanged), but it
means our bulk deletes can appear as one named entry in the user's history.
> ● **CONFIRMED (E14-G).** Three clips deleted by one call; **one** undo restored
> all three; the history entry read `"ghostnote E14 batch delete"`. Same for
> `duplicateObjects`. Both are on `ControllerHost`, not `Application`, and take
> `DeleteableObject…` / `DuplicableObject…` rather than `ObjectProxy`.
