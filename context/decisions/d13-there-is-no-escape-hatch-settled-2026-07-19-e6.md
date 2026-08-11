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
>
> ⚠ Probe-level addendum (E17/E18 method guards): a named action fired at a
> *chain* additionally needs a human-clicked chain lane since project load —
> invisible priming, destroyed by a cross-track re-point or a project reload — so
> a typed route is preferred always. `WIRE_METHODS_BANNED` and
> `WIRE_METHODS_FORBIDDEN` stand unchanged.

The typed API plus D1's file surgery is the entire toolbox. The residual gap
(track Group/Ungroup, wrap/unwrap) is an accepted minor omission.

**`app.invokeAction`, `app.actions`, `app.undo`, `app.redo` and `app.undoState`
stay REGISTERED but banned** — `WIRE_METHODS_BANNED`, asserted unreachable from
the contract — because the probes that established the bans are the live
regression suite.

⚠ **A second, harsher class exists: `WIRE_METHODS_FORBIDDEN`, which must not be
registered at all.** `ui.signalFire` is its only member: it crashes Bitwig
(E14-A1), so a registration is a loaded gun regardless of reachability.
