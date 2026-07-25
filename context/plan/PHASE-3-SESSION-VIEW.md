---
title: Phase 3 — The session view
status: not started
updated: 2026-07-24
parent: ../PROJECT_PLAN.md
prev: PHASE-2-CLIPS.md
next: PHASE-4-SOUND-DESIGN.md
---

# Phase 3 — The session view

> **Purpose.** The visual half of "Cursor for music" — but only the half Bitwig
> cannot do itself. Phase 1 gives you revert and A/B from inside Bitwig; Phase 3 adds
> **before/after comparison, cross-object change summaries, and take navigation**,
> served by the daemon to a local web UI.

## Why this is scoped so much smaller than it sounds

Two findings shrink this phase considerably, and both are worth restating because the
instinct is to build much more:

1. **`ClipLauncherSlot.showInEditor()` + `Application.zoomToFit()` already solve
   "show me what changed."** They put the user in front of Bitwig's own piano roll —
   better than anything we would render, already open, already familiar, and already
   where they would go to fix it by hand. We do not need to re-render the present
   state of the session.
2. **§8f: the checkpoint's "before" *is* the diff source.** The stash Phase 1
   captures for revert is precisely the before-side of the visual representation.
   One mechanism, two features. Phase 3 is largely a *renderer over data that already
   exists*, not new instrumentation.

What is left is exactly what Bitwig has no concept of: **the previous version.** A
DAW shows you the current state. It cannot show you what the agent changed, or what
the other take sounded like.

## Scope

### In

1. **The daemon's local API.** HTTP + WebSocket on loopback, serving take log, take
   contents, diffs, and live change events. This is the interface a second client
   would use, so it is designed as an API rather than a UI backend.
2. **The change log.** What the agent did, per batch, in musical terms: *"12 notes →
   gn-A slot 0; velocity curve on 4 of them; Filter Frequency 0.49 → 0.72."* Plus —
   uniquely available because the daemon holds observers — **what the user did in the
   same window**, which is what makes the log trustworthy under §8d's assumption that
   the user is editing concurrently.
3. **Before/after rendering, per object class.** Notes → piano-roll overlay. Params →
   value pairs with device context. Structure → chain diagram. Each class needs its
   own renderer; the diff is inherently multi-modal.
4. **Take navigation and A/B.** The visual counterpart to Phase 1's in-Bitwig
   switcher: a take timeline you can branch from, compare across, and jump between.
5. **Partial revert by musical address.** "Keep the hats, revert the snare" — the
   verb Phase 1 built the addressing for and Phase 3 makes usable.
6. **Security posture.** Loopback only, and per §8j the local socket is the soft
   underbelly: the policy gate is in TypeScript, the socket is not a boundary.
   Firewall it; do not mistake the policy for a boundary.

### Out

- **Any chat UI.** Explicitly ruled out (D4). The agent conversation stays in
  whatever MCP client you prefer; this window sits beside it.
- Re-rendering current session state — that is Bitwig's job and Bitwig is better
  at it.
- Audio rendering, waveform display, or anything requiring a second sound surface
  (§2, §8h).
- Editing. The session view is a *view* plus revert controls. Musical edits go
  through the agent or through Bitwig.

## Decisions this phase must make

- **How the window is hosted.** A browser tab is the cheapest and needs no packaging;
  a minimal desktop shell is nicer to live with. Decide against the "personal but
  releasable" bar — a browser tab is entirely acceptable for a personal tool.
- **Live vs. on-demand.** Does the view stream changes as they land, or render on
  request? Streaming is better UX and is what the daemon's observers make possible,
  but it is also where complexity accumulates.
- **How much history is worth showing**, and how take branches are visualised without
  turning into a git graph nobody reads.
- **Whether the Phase-0 E14 findings change the target.** If H (the hardware-surface
  simulator) or I (the bitmap window) came back surprisingly strong, some of this
  phase may belong inside Bitwig instead. Do not force it either way — decide with
  the verdicts in hand.

## Exit criteria

1. After a batch, you can see **what changed and what it replaced**, without
   reconstructing it from memory or from the transcript.
2. You can A/B two takes and revert a **subset** of one, by musical address.
3. The change log distinguishes agent edits from your own edits in the same window.
4. Revert remains a human verb: the agent can read the log and explain it through the
   MCP surface, and has no path to mutate it (§8g).

## Risks

- **This phase is the one most likely to sprawl.** It has no hard capability ceiling
  to bound it — unlike every other phase, where the Bitwig API says no eventually.
  Mitigation: the scope boundary above is deliberately drawn at "what Bitwig cannot
  show", and the two shrinking findings should be re-read whenever a feature is
  proposed.
- **It could become a front-end project.** Same failure mode that ruled out the
  custom harness (D4), one level down. Mitigation: it is a renderer over existing
  data; if it starts needing new instrumentation, that is the warning sign.
- **Streaming complexity.** Live updates against a moving session, with the user
  editing concurrently, is genuinely harder than it looks. On-demand rendering is a
  legitimate first version.
