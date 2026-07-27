---
title: ghostnote mini-spike — Handoff for E16 session 3: named actions, and the
       sibling-track simplification
status: rows A–G measured (see HANDOFF-E16.md). §8 UNTOUCHED. This session has
        three tasks, and task 3 is GATED on task 2's outcome.
updated: 2026-07-26
predecessor: HANDOFF-E16.md (rows D–G — do not edit it, it is that session's record)
---

# Handoff: E16 session 3

You are picking up a **mini-spike inside Phase 1** of **ghostnote** (a personal
Bitwig Studio MCP server: thin `.bwextension` + TypeScript brain). E16 asked
whether a "branch" of an agent edit can be **a duplicated track**. Rows A–G are
measured and the gate never closed.

**This session is not more rows.** It is three specific jobs, in order, and the
third only happens if the second says so.

## Read these first (in order)

1. **`context/spike/HANDOFF-E16.md`** — the previous session's handoff. ⚠ It is
   the record of that sitting; **do not edit it**. Read its trap list (14 items)
   and its rig notes in full — this document does not repeat them and you will
   re-learn them the expensive way if you skip it.
2. `context/spike/SPIKE-E16-BRANCHES-AS-TRACKS.md` — the plan. STATUS block,
   then **§2 (what it does and does not fix)**, **§3a/§3b**, **§6**, **§7**, and
   **§8 — nine decisions that are the USER'S, not yours.**
3. `context/spike/FINDINGS.md` → **`E16 rows D–G`** then **`E16 rows A–C`** at
   the top, and **`E6`** further down (named actions — task 1 depends on it).
4. `context/PROJECT_PLAN.md` §4 — the standing rules. Rules **1, 3a, 3c, 5, 6,
   10, 13** are the ones that bite in this session.

---

## Task 1 — re-attempt named actions from the ground up

**The assumption under test: we cannot use named actions, therefore we cannot
create group tracks, therefore track-based takes can only ever be plain sibling
tracks.** This is a deliberate re-test of a standing assumption, in the spirit of
the several this spike has overturned by re-testing. The expected answer is still
"no". Prove it properly anyway.

⚠ **Build a NEW probe. Do not re-use or extend `e06*`.** Those probes are the
record of the sitting that established D13, and the point of a re-test is an
independent path to the same question. Name it something like
`brain/src/probes/e16j-actions.ts`.

### The target

Group creation, because it is the one capability whose absence actually
constrains E16 (row E3: `createParentTrack` is an init-only accessor and throws
at runtime, so **only a human can currently make a group**).

Two live action ids, confirmed present by enumerating `app.actions` (781 total):

| id | name | category | shape |
|---|---|---|---|
| `Create Group Track` | "Add Group Track" | Project | like `Create Scene`, which is the one E6 saw WORK when foregrounded |
| `Group` | "Group" | Editing | wraps the current selection — ⚠ the dangerous one |

Also present and relevant: `Ungroup`, `Enter Group`, `Exit Group`,
`toggle_all_track_groups_expanded`.

### What E6 established, and what is genuinely NEW since

E6's four blockers (`FINDINGS.md` → E6):

1. **Foreground required.** `Create Scene` worked with Bitwig frontmost; a silent
   no-op backgrounded, while typed `scene.create` worked on identical state.
2. **Panel keyboard focus** additionally required for *Editing* actions, and the
   controller API cannot set it — `Duplicate` did nothing even foregrounded until
   `focus_or_toggle_clip_launcher` was invoked first.
3. ⚠ **Selection collision.** Actions fire against the UI selection, and our own
   addressing sets it (`cursorTrack.selectChannel`). This silently produced
   **7 orphan `gn-A` duplicates** during E6 before the mechanism was understood.
4. **Zero readback.** `invoke()` returns void; an inapplicable action is a silent
   no-op with no throw.

⚠ **Three things are different now, and they are why this is worth one more go:**

- **Blocker 4 is soft for this specific case.** `invoke()` tells us nothing, but
  a `track.list` diff tells us everything. Group creation is *observable* even
  though the call is mute. E6 generalised "zero readback" from actions whose
  effects were hard to see; that generalisation does not hold here.
- **Foreground is DETECTABLE from the brain**, which E6 never tried. The daemon
  runs on the same machine:
  `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`.
  A precondition we can *check* is categorically different from one we can only
  hope for — it converts a silent no-op into a refusal (standing rule 5's shape).
- **`Create Group Track` was never probed.** E6 named `Group`/`Ungroup` as the
  no-typed-API residual and tested neither; `Create Group Track` is a *Project*
  action, the category that worked.

### How to run it

- Enumerate `app.actions` live and resolve the exact ids first — do not hardcode
  from this document without checking (rule 1).
- ⚠ **Test BACKGROUNDED first**, with the brain confirming Bitwig is not
  frontmost. Expect a no-op. That is the control, and without it a foreground
  success proves nothing about the mechanism.
- Then foregrounded, with the user asked to bring Bitwig up and confirm.
- **Verify ONLY by `track.list` diff** (group count, new `channelId`s, and the
  collapse oracle from `e16f` to prove nesting). Never by `invoke`'s return.
- Try `Create Group Track` **and** `Group`, separately. They are different
  categories and may behave differently; `Group` additionally needs a selection.
- ⚠ **The selection hazard is live.** Before invoking anything, snapshot
  `track.list`, use only disposable fixtures (`gn-A`/`gn-B`), and be ready for
  the wrong object to be grouped or duplicated. Check for orphans after every
  trial, and clean up by `channelId`.
- Probe whether panel focus matters here (the `focus_or_toggle_clip_launcher`
  precedent) — it should not for a Project action, which is itself a testable
  prediction.

### The decision this settles

- **If it works reliably foregrounded, and foreground is detectable, and the
  result is verifiable by readback** → groups become *conditionally* available,
  and it needs an explicit, documented exception to **standing rule 6 / D13**,
  scoped to this one action and gated on all three preconditions. That exception
  is the USER'S call, not yours — present it, do not take it.
- **Otherwise** → record it, and **track-based takes are plain sibling tracks**
  for the rest of the design. Task 2 then proceeds on that basis.

---

## Task 2 — examine the sibling-track simplification (the user's proposal)

⚠ **This is the pivotal task of the session and it is an ANALYSIS, not a build
and not a decision.**

### The proposal, in the user's words

> Ditch most of the branch system and drastically simplify down to just relying
> on **sibling tracks** to manage all (or most) aspects of branching: A/B
> auditioning, reverts (just delete all but the original), cross-combination
> (take some new B tracks but not others).

### Your job

**Enumerate every use case the branch system was planned for, and report which
ones survive, which degrade, and which fall out entirely under the sibling-only
model.** With evidence references for each. Present it; do not decide it, and do
not start implementing anything.

⚠ **This handoff deliberately does not argue the proposal either way.** The
previous session formed opinions and they are recorded in §8 below as
*provisional* — treat them as one input among several, and be willing to
contradict them. What follows is references and context, not a position.

### Where the use cases are written down

- **`SPIKE-E16-BRANCHES-AS-TRACKS.md` §2** — "what it fixes" and "what it does
  not fix", including ⚠ the revert-fidelity ceiling, which §2 calls the strongest
  argument for the whole idea and which is *stronger than the A/B argument*.
- **§3a** — why the stash must exist regardless, and why partial revert cannot be
  expressed as deleting a track.
- **§3b** — per-track heads do not compose into a project-wide state.
- **§6** — the eight ranked new challenges.
- **§7** — what would change in the plan (`graph.ts`, D17b/D17c, materialization,
  the identity map, retention, D14).
- **`context/DECISIONS.md`** — **D5** (A/B is the core verb; you evaluate by
  listening), **D10**, **D14**, **D16a–d** (fidelity labelling, why positional
  addressing was rejected for clips), **D17a–g** (the take store: project key,
  branching-as-path-walk, `lands`, slicing, the pointer argument, retention, the
  read/write split).
- **`context/plan/PHASE-1-ENGINE.md`** — what is actually built (sessions 1–2).
- **`context/INITIAL_PROMPT.md` §8a** — the approval gate, the lost
  mutation-free preview, and "undo becomes load-bearing infrastructure".

### Context from session 2 that bears directly on this proposal

Everything below is measured this sitting and is not in the older documents.

**Helps the proposal:**

- **E2 ●** — muting a track cuts its **sends** too, pre- and post-fader alike, at
  every send level. A/B by mute is audibly *correct*, not just convenient. This
  is entirely track-level and owes nothing to groups.
- **E1 ●** — mute toggling is click-free and the user reported it *"instant"* and
  *"Yes, usable"* as the A/B gesture, in Bitwig's own mixer, with no ghostnote UI.
- **G1/D1 ●** — delete is one undo entry, frees the CPU, and tombstones the
  `channelId` cleanly. Revert-by-delete works on a plain sibling.
- **E5 route B ●** — a copy **inherits `mute=true`**, so "born muted" is available
  and removes the doubled-mix window (at the cost of a ~321 ms gap).

**Complicates it:**

- ⚠ **C5 ●** — **every duplication audibly glitches the transport** (5/5 real vs
  0/3 placebo, one described as a slight dropout). This is a cost of *any*
  track-duplication scheme and it bounds how often branching can happen at all.
- ⚠ **Placement is NOT ours** — `copyTracks` **and** `moveTracks` are both silent
  no-ops (two independent `InsertionPoint` routes). A copy lands adjacent to its
  source and **cannot be moved afterwards**. In a sibling-only world there is no
  gathering, no ordering, no tidying — the mixer layout is whatever creation
  order produced.
- ⚠ **A4 — a copy carries the SAME NAME.** With no group to disambiguate, N
  siblings are N identically-named tracks. Renaming stops being a nicety (§8.7)
  and becomes a correctness requirement: the human cannot otherwise tell which
  one to delete.
- ⚠ **§3a's stash argument still stands.** Deleting a sibling destroys its
  content unless the store independently holds it — so "just delete all but the
  original" does not remove the need for the stash.
- ⚠ **Partial revert is the sharp edge.** D17d is *built* and slices by
  `addressKey` — "revert just the snare from that batch" is a **within-track**
  operation. Sibling-level cross-combination is **per-track**. These are
  different granularities and the proposal must say what happens to the finer
  one.
- **F4** — scenes are global rows, so every sibling's clip sits in the same
  scene and a scene launch fires all of them.
- **D4 is unmeasured** — every sibling consumes a bank slot, and
  `setContentFilter(ALL_CHANNELS)` (needed so folded tracks stay addressable)
  adds more. Standing rule 5 refuses on bank-window overflow.

### The shape of the deliverable

A document (new file under `context/spike/`) that, for each planned use case,
records **survives / degrades / falls out**, with the evidence reference and —
where it degrades — what specifically is lost. ⚠ Nothing goes into
`DECISIONS.md` (standing rule 10).

---

## Task 3 — ⚠ GATED: only if task 2 concludes the branch system stays

**If task 2 concludes the sibling-only model is sufficient, STOP after it and
hand back.** The measurements below only earn their cost if the richer branch
system survives.

If it does survive:

1. **D4 — bank-window headroom**, measured **under `ALL_CHANNELS`**. This is the
   highest-value unmeasured row: it is what turns §8.4's branch budget from a
   policy guess into a number. Every branch consumes a slot; folded tracks now
   consume slots too; standing rule 5 already refuses on overflow.
2. **G3 — can a branch be promoted to trunk without a rebuild?** If resolving a
   session means rebuilding, branches are an audition tool only. If promotion is
   cheap, they can carry real work forward. This changes what the layer *is*
   (§8.1) and whether "project state at take N" can survive in any form (§8.3).
3. **Then the §8 calls** — which remain **the user's** (standing rule 10). Record
   inputs and recommendations; do not write `DECISIONS.md`.

Lower priority, only if the above land early: C4's per-branch file-size delta
(needs a human `⌘S` with branches live), D3, F2, F3, nested groups, and row B3's
owed modulator-liveness fixture.

---

## §8 — provisional recommendations carried forward from session 2

⚠ **These are one session's opinions, recorded so they can be argued with. They
are NOT decisions and they are NOT `DECISIONS.md`.** Task 2 may invalidate
several outright — in particular 8.2, 8.3, 8.5 and 8.9 all assume the branch
system survives.

| # | decision | provisional recommendation | key input |
|---|---|---|---|
| 1 | layer or replacement | **layer** | the stash is mandatory anyway (§3a); partial revert (D17d) can't be a track delete; ⚠ C5 means you cannot branch on every write |
| 2 | per-track heads vs materialize all | **per-track heads** | ratifies the user's stated preference; ⚠ C5 makes materialize-all a *burst* of glitches per branch point |
| 3 | does "project state at take N" survive | **no — say so and amend D17b/D17c** | the alternative is what 8.2 rejects; two silent models is the failure class the project exists to prevent. ⚠ VERIFY §7's "forest not rewrite" claim about `graph.ts` first — it is unverified and the whole recommendation rests on it |
| 4 | the branch ceiling | **loud refusal at a small budget (~3 live per lineage)** | ⚠ policy, not measurement, until **D4** runs. Binding constraint is likely bank window + human comprehensibility, not CPU (0.6 pp/branch is cheap and is a lower bound) |
| 5 | group topology | **be group-SAFE, do not build ON groups** | ⚠ contradicts the spike's own framing. We cannot create a group (task 1 re-tests this); a topology gated on a human action at an arbitrary moment is a dead end |
| 6 | branch lifetime | **human deletes; agent proposes, never reaps** | rule 8 (revert is a human verb); retention is now audible; ⚠ absence must be checked against an `ALL_CHANNELS` bank or a folded track reads as deleted |
| 7 | naming and visibility | **rename + recolour at creation** | A4: copies share a name; `setName` and `color()` both work. Correctness, not aesthetics |
| 8 | does D14 get amended | **yes** | E1+E2: A/B works in Bitwig's own mixer with no ghostnote UI. ⚠ the biggest planning consequence of session 2. Keep Phase 3 for the take-log reader and the human revert surface (E14-A1) |
| 9 | where it lands in the plan | **not now — finish Phase 1's daemon, revisit ~Phase 2** | E16's value needs a human at the keyboard, and the daemon is what puts writes under observation. Tradeoff accepted: the revert-fidelity ceiling (§2's strongest argument) stays open longer, but it bites in Phases 4–5, which is when branching should arrive |

---

## What session 2 added to the rig

New wire methods (all E16-only; `wiremap.test.ts` still asserts none is reachable
from the adapter contract — keep it that way):

- `branch.moveTrack` — `InsertionPoint.moveTracks`, proved a **silent no-op**
- `branch.contentFilter` — `TrackBank.setContentFilter`, ⚠ a genuine **runtime**
  setter and a real exception to standing rule 13
- `branch.createParentTrack` — proved **init-only**, creates nothing
- `Send.sendMode()` on `branch.mixer`/`branch.setMixer` (drives PRE/POST)
- `isGroupExpanded` read + write
- `RigConfig.contentFilter` — applied at init, guarded

Fixes: **`branch.vu` rows now carry `identityChanged`** and self-invalidate a
slot's hold when its `channelId` changes (the bank-indexed staleness trap);
**`ask()` refuses on a non-TTY** instead of fabricating a human answer.

New probes: `e16d` (E2 sends), `e16e` (E1/E5, needs a TTY + ears), `e16f`
(E3/E4 groups + moveTracks), `e16g` (C5, **placebo-controlled**, needs ears),
`e16h` (content filter + vu staleness), `e16i` (createParentTrack).

## Posture

Bitwig's sandbox project is throwaway — churn it freely, but delete the tracks
you create and leave **`gn-E16`** intact (it currently sits inside a
human-created **`Group 7`**). The user is at the keyboard for anything audible:
**ask before making noise**, ask **immediately** after the event rather than at
the end of a row, ask **open** questions, and use **placebo trials** for anything
decided by ear. Stop after each task for review.

⚠ **Do not write `DECISIONS.md`.** §8 stays the user's (standing rule 10).
