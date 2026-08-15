---
id: D13
kind: decision
state: active
source: DECISIONS.md
---

# D13 — There is no escape hatch **[SETTLED 2026-07-19, E6]**

**ghostnote uses NO named actions. Ever.** (Standing rule 6.) 781 actions
enumerate and `invoke()` is unusable *and* hazardous: global actions fire only
with Bitwig foregrounded (backgrounded = silent no-op while the typed API keeps
working), editing actions need panel keyboard focus the API cannot set, the return
is `void` with zero readback, and they operate on the UI selection **our own
addressing sets** — foreground `Duplicate` duplicated the gn-A fixture **7×**
before the mechanism was understood.

> ⚠ **REVISED 2026-08-07 (E16j, E16k). The verdict NARROWS; the reasoning is
> REPLACED.** E16j disproved the stated premise — named actions **do** fire
> backgrounded, including minimised to the Dock — and the track-native lineage
> group can only be created by one (`Group` / `Create Group Track`), so the model
> now *depends* on the thing this rule forbade. What is actually wrong with named
> actions: they are **not addressable surface** — they act on the UI selection,
> which our own addressing sets and a human can move under us (E6 blocker 3;
> observed live again in E16j — seven orphan duplicates). New form:
>
> **Named actions may be used only where the selection is established and
> verified in the same batch, and never where an addressed API call exists. The
> ONE sanctioned use is lineage-group creation**, whose construction order is
> forced — group the original FIRST, then duplicate (E16k K2: `moveTracks` and
> `copyTracks` are silent no-ops; nothing can be gathered in afterwards).

> ⚠ **REGRESSION RESOLVED 2026-08-11 (E22).** `Group` needs invisible Editing
> context latched by a human track-header click since project/process load. Fresh
> untouched and fresh `focus_track_header_area` rows both miss despite exact
> durable cursor/mixer selection; human-click rows wrap the exact child 3/3, and
> a later no-click row on a different API-selected target stays positive. The
> controller can neither establish nor observe the latch. The sanctioned route
> therefore remains a measured capability but is not autonomously production-
> suitable; Phase 3f's fork acceptance is open pending the operator's decision.
>
> ⚠⚠ **NARROWED AND HARDENED 2026-08-12 (E22 destruction matrix). It is not a
> latch — it is live PRIMARY FOCUS, and its failure mode is MISDISPATCH.** On one
> clean lifecycle: cold missed (5103 ms); a header click wrapped (145 ms); the
> wrap survived cleanup, a new target and a 14-row cursor sweep. Then **one click
> on the target's own empty launcher slot missed (5025 ms)**, a chain lane missed
> (5036 ms), a project-tab round trip missed (5114 ms), and **a click on the
> target's own device header built an Instrument Layer around that device inside
> the track's device chain and no track group at all**. Recovery clicks re-wrapped
> at 142/137 ms, so the channel was alive throughout. Bitwig draws a primary and a
> secondary highlight; every guard we have reads the secondary one, which stayed
> correct in every failing row. **`branch.groupTrack`'s bank-id, cursor-id and
> selected-mixer-row checks all passed while the action edited a device chain.**
>
> ⇒ Rule 6's one sanctioned exception is therefore **not autonomously shippable
> behind an operator prompt**. A precondition that ordinary work re-breaks, that
> no observer reports, and whose failure silently performs a *different* edit is a
> misdispatch hazard, not a checklist item. The exception stands as a measured
> capability; what it may be composed into is the operator's call (rule 10).
>
> **FINAL DISPOSITION 2026-08-14 (operator; D18 rev). The exception is retired
> from the product.** Managed takes use typed layer-chain and clip-block routes;
> ordinary track copying uses typed `Channel.duplicate()`. `branch.groupTrack`
> remains registered solely to reproduce E22 and is explicitly product-banned.
> There are now no named-action product exceptions and no runtime focus/priming
> instructions for operators.
>
> ⚠ Probe-level addendum (E17/E18 method guards): a named action fired at a
> *chain* additionally needs a human-clicked chain lane since project load —
> invisible priming, destroyed by a cross-track re-point or a project reload.
> This remains evidence for requiring typed routes, not a product recipe.

The typed API plus D1's file surgery is the entire toolbox. The residual gap
(track Group/Ungroup, wrap/unwrap) is an accepted minor omission.

**`app.invokeAction`, `app.actions`, `app.undo`, `app.redo`, `app.undoState`, and
`branch.groupTrack`
stay REGISTERED but banned** — `WIRE_METHODS_BANNED`, asserted unreachable from
the contract — because the probes that established the bans are the live
regression suite.

⚠ **A second, harsher class exists: `WIRE_METHODS_FORBIDDEN`, which must not be
registered at all.** `ui.signalFire` is its only member: it crashes Bitwig
(E14-A1), so a registration is a loaded gun regardless of reachability.
