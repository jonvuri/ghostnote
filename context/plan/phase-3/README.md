---
title: Phase 3 — The session view
kind: plan
state: optional
status: ⚠⚠ OPTIONAL as of 2026-08-07 (operator; D4 rev) — re-evaluated after the
        core is built. Default: forego what needs a web view, or build TEXTUAL
        versions agents naturally produce and render. The daemon-served premise
        is retired; see the banner below. Original text kept as the record.
updated: 2026-08-07
parent: ../ROADMAP.md
prev: ../phase-2/README.md
next: ../phase-4/README.md
---

# Phase 3 — The session view

> ⚠⚠ **RE-SCOPED 2026-08-07 (operator; D4 rev, D14 rev, D17 rev, D18). This
> phase is OPTIONAL and DEFERRED — evaluated again after the core is built.**
> The default is to forego what needs a web view, or to build **textual**
> versions agents can naturally produce and render. What moved out from under
> the original text:
>
> - **Take navigation and A/B (§Scope 4) are DISSOLVED, not deferred.** Coarse
>   A/B is Bitwig's own surface (chain solo, clip launch, group mute — D14 rev),
>   and takes are visible structures *in the project*, not store rows. The
>   original "Phase 1 gives you revert and A/B from inside Bitwig" premise is
>   true again, more literally than it knew.
> - **The data source changed**: no daemon, no store (D4/D17 rev). Changesets
>   live in the chat log; branch-event metadata lands in `getDocumentState()`
>   (D18d). A change summary is an agent rendering of those — no server needed.
> - **The daemon's local API (§Scope 1) is retired.** If a view is ever built it
>   is MCP-server-hosted and lives and dies with the chat session. ⚠ Tripwire
>   (E16-REPLAN §5): wanting it usable with no agent attached REOPENS the daemon
>   decision.
> - **Partial revert (§Scope 5) stays** — `slice.ts` over the stash (D17 rev) —
>   with a conversational/textual UX first.
> - **The live residue**: before/after diff and cross-object summaries (§Scope
>   2/3). Try them textual first; a renderer is justified only if text
>   demonstrably fails exit criterion 1's test — "what changed and what it
>   replaced", without reconstructing from memory.
>
> Exit criterion 4's "revert remains a human verb" is now D20's zero-initiative
> rule, enforced at the annotated tool seam rather than at daemon endpoints.

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

## ⚠ Carried in from Phase 1 session 3 (2026-08-08)

> ⚠ This whole document is on `E16-REPLAN.md` §5's **not-yet-re-planned** list —
> it is *"the doc most changed by the model, and now also by the daemon
> retirement."* These two items are recorded here so they are not lost in the
> re-plan, not because the surrounding text has been reconciled with them.

- **A3 — the local API.** Session 3's original scope owned it and described it as
  *"the API Phase 3's web view will consume."* No daemon was built, so it was
  never written. It lands here by default. ⚠ The daemon retirement carries a
  tripwire worth reading before designing it: Phase 3 becomes MCP-server-hosted
  and therefore **lives and dies with the chat session** — *"if Phase 3 ever wants
  to be usable with no agent attached, the daemon decision reopens."*
- ⚠⚠ **A2 — the "what the user did" change log, and it is BLOCKED.** Session 3's
  observers were meant to feed it (observer job 3, verbatim: *"the change log's
  'what the user did' side, which Phase 3 renders"*). What exists is
  `ApplyReport.concurrent`, which is **per-batch and dies with the take**.
  >
  > ⚠ **Do not build the log until session 3's B2 is fixed.** Its only feed is the
  > launcher-content observers, which cover `config.tracks × config.scenes` and
  > nothing beyond. A per-batch REPORT survives that hole because `assertVisible`
  > refuses a batch whose addresses are not visible, so its scope is bounded to
  > checked ground. A LOG claims to describe the whole project over time, so the
  > same hole becomes a **silent omission in a record this phase renders as
  > complete** — the failure class the project exists to prevent. Two more open
  > questions ride with it: retention has no policy since D17f died with the store,
  > and the log is **human-owned** under standing rule 8, so its privilege boundary
  > needs designing rather than improvising (D17g's type split was built around a
  > store object that no longer exists).

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
