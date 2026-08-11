---
title: Phase 1, session 3e — the clip block
kind: plan
state: active
status: PLANNED 2026-08-09. The first of the three branch mechanisms, and the one
        that arrived latest (operator, 2026-08-06) but is now the best measured —
        3b's E20a and E20b ran specifically so this session would not be designed
        on a javadoc.
        ⚠⚠ **DEPENDS ON 3c**: room is made with `scene.create`, which has no
        precondition until 3c ships.
        ⚠⚠ **A verified-empty destination row is a HARD PRECONDITION on minting**
        — `duplicateClip` OVERWRITES an occupied row and fires no event (E20b).
        ⚠ Was part of **session 3″**.
updated: 2026-08-09
parent: README.md
previous_outcome: ../../archive/outcomes/PHASE-1-SESSION-3D-SURFACE.md
next: 3f-fork-chain.md
scope: PHASE-1-ENGINE.md §Re-plan session 3e
evidence: E3, E5c, E16l, E16m, E16s, E16w, E19, E20a, E20b ·
          E18-VERDICT §4a/§4a′/§4a″/§4a″-bis/§4a‴/§4b/§4c/§4d ·
          D6, D16e, D18, D19 · standing rules 1, 2, 5, 10, 13
---

# Phase 1, session 3e — the clip block

> **Purpose.** Build the one branch mechanism that delivers what the operator asked
> for in E16m and nothing else in the design can: **a beat-aligned, position-continuous
> A/B**. Take B enters where take A was, on the bar, rendering the same bar
> differently instead of jumping to the top of the loop.

## Why this session exists, and what it is standing on

⚠ **Everything below is measured.** E18-VERDICT §4 was the part of the branching
comparison *"with the least measured evidence behind it"*; 3b closed that gap
deliberately, before this design was made.

| claim | status |
|---|---|
| `"continue_or_synced"` resumes at the **outgoing** take's position | ⚠⚠ ●● measured — T5 separates it from the incoming clip's own last position (17 steps away) and from the transport grid (31 away) |
| quantisation is a genuine **per-call** override | ● `"1"` landed 0.02 off the bar after 1567 ms; `"8"` at beat 32.01 after 14266 ms; `"none"` control 1.38 off the bar after 121 ms |
| the A/B **sounds** like the one E16m asked for | ● operator, by ear, verbatim: **"Yes."** |
| `duplicateClip` lands in the **next row down** | ● both routes agree, notes carried, selection-independent |
| a launch is **not an edit** | ● launching fires zero occupancy events, so an A/B session does not read as a stream of concurrent edits |
| ⚠⚠ `duplicateClip` into an **occupied** row | ⚠⚠ **OVERWRITES**, destroying the take that was there, and fires **no event** |
| a clip move is detectable as a **pair** | ● `t2s7=emptied, t2s3=filled`, human drag and API move alike (E16s/E19) |
| clips and scenes have **no identity at all** | ○ complete pass over 1968 members (E16l) — addressing is positional, permanently |
| ⚠ Next Actions | ⚠⚠ ○ **not in the controller API** — the string *"next action"* appears nowhere in the javadoc tree, in docs that name neighbouring inspector fields by their label |

## Scope

### In

1. ⚠ **Probe the PER-CLIP launch settings first** — `Clip.launchQuantization()`,
   `Clip.launchMode()`, `useLoopStartAsQuantizationReference()`. Unprobed, not on
   our wire. See §The per-clip settings below: they are the whole reason this
   session can satisfy exit criterion 4.
2. **Promote from probe surface to `WIRE`**: `slot.duplicateClip`,
   `slot.launchWithOptions`, `slot.playState`, `slot.moveTo`, plus whatever arm 1
   adds.
3. **Minting a take** — `duplicateClip` behind a verified-empty destination row.
4. **The block's geometry** — contiguity and bounding empty slots via
   `hasContent()`, `slot.moveTo` to restore it, `scene.create` (3c) for room,
   **append only**.
5. **The A/B** — `launchWithOptions(quantization, launchMode)` as a verb, and the
   per-clip settings so the human's own click behaves the same way.
6. **The unarmable-block affordance** — what the agent says when it builds a block
   whose behaviour it cannot set, read or verify.
7. The branch verbs joining 3d's surface, and the ops joining the contract with
   their preconditions, inverses and fidelity labels.

### Out — named so it does not drift in

- **Track fork and layer chain.** 3f.
- **The record, the classifier, the v1 freeze.** 3g. ⚠ This session's descriptions
  are written to v1's rules and amended there, not frozen here.
- ⚠⚠ **Unattended auto-advance.** It is real, it is what the block layout exists
  for, and it is **not ours to deliver** — see §The division of labour. Scoring it
  as a system capability is how this section over-claimed twice already.
- ⚠ **A scheduled-task cycler in the extension.** `scheduleTask` + `playPosition`
  would work, quantisation would make it musically exact despite sloppy timing, and
  the extension outlives a chat session. ⚠⚠ **The operator excluded it by name** —
  *"unattended (by the agent or extension)"* — because it puts us in the loop
  driving the musician's listening. Recorded so a later reopening inherits the
  reasoning rather than rediscovering it.
- ⚠ **Arrangement clips.** LAUNCHER ONLY. *"Launcher clips > arrangement clips in
  API reliability"* (INITIAL_PROMPT §285); arrangement is Phase 6, and **this
  mechanism has no analogue there** — a tripwire recorded now rather than
  rediscovered.
- **Mid-grid scene inserts.** `nextSceneInsertionPoint()` exists and shifts every
  row below it, with the same permanent `sceneIndex` staleness as deletion (E3).

## ⚠⚠ The hard precondition, and why it is not a nicety

E20b tested for the two possibilities the design had listed — **append** past the
block, or **insert**, shifting every row below. ⚠ **Neither happened.**

```
before:  row 10 = pitch 60 (source)   row 11 = pitch 72   row 12 = empty
after:   row 10 = pitch 60            row 11 = pitch 60   row 12 = empty
```

The clip in row 11 is **gone**. Not pushed down — row 12 is still empty. Not
refused. Overwritten. And `E20b-B3c`: **zero occupancy events fired**, because
occupancy did not change.

⇒ Two things follow, and the second is the sharper one:

1. **An empty destination row is a precondition in the same class as the bank-window
   budget** — checked before the call, refused loudly, never a licence to reap.
   D20's execution discipline (*enumerate the cascade by identity before any
   delete*) applies to an operation whose name contains no verb about deleting.
2. ⚠⚠ **The stash cannot learn about this after the fact.** A destructive
   structural op is invisible to the change window: this is the `moved` verdict's
   motivating case one step worse — there the contents compared equal, here they
   are *different* and the window is still empty. ⇒ **The protection is the
   precondition, plus stashing the destination row's contents before minting if the
   block ever mints into ground it did not verify.**

## ⚠⚠ The per-clip launch settings — arm 1, and why it is not optional

`launchWithOptions` is a **verb**: it governs *how* a launch behaves, never
*whether* one happens. Every switch it performs needs a caller — us.

⇒ With the verb alone, **the good A/B exists only while the agent is driving it.**
The moment the operator clicks a clip themselves, they get the project's default
quantisation and a launch that restarts the loop. That is not exit criterion 4,
which the re-plan re-states as *"two takes A/B'd from inside Bitwig… no ghostnote
UI involved"*.

E18-VERDICT §4b lists the members that would close it, **unprobed**:
`Clip.launchQuantization()` (*"Setting for the default launch quantization"*),
`Clip.launchMode()` (*"Setting 'Launch Mode' from the inspector"*), and
`Transport.defaultLaunchQuantization()`.

⇒ ⚠ **Arm 1 measures them before anything is designed on them**, the same
discipline that produced E20a and E20b — and for the same reason: a design built on
a javadoc is a design that gets defended.

⚠ **New wire NAMES, not new fields on an existing reply.** `methodsHash` is over
method names, so a field added to an existing method's reply passes a stale
handshake — the gap that cost session 3 a sitting and produced `deploy.ts`, and the
reason 3b added `cursor.playState` rather than extending `cursor.status`.

## ⚠ The division of labour, stated so it is not over-claimed a third time

| | |
|---|---|
| the block's **shape** — contiguity, bounding empties, room, relocation | ● **ours**, and verifiable: `hasContent()` reads every slot, `slot.moveTo` is 163 ms, `createScene()` appends |
| ⚠ quantised, position-continuous switching **on demand** | ● **ours** — but **one call per switch**, always |
| ⚠ the same switching from the **human's own click** | ◐ **arm 1 decides** — the per-clip settings, if they are writable |
| ⚠⚠ hands-off **auto-advance**, nobody triggering | ⚠⚠ ○ **not ours.** Engine-driven cycling exists only through the Next Action, which is not in the API. The human arms it or it does not happen |

⚠⚠ **And we cannot tell an armed block from an unarmed one.** An unarmed block
looks identical from the wire — the same shape as E17's priming hazard, an
invisible precondition. ⇒ **An explicit affordance, not silence**, and it is one of
the decisions this phase owns.

⚠ **The block-delimiting rule is an operator premise, not measured** — that
contiguous clips bounded by empty slots are what a Next Action's round-robin scopes
itself to. §4a′'s auto-advance rests on it entirely. **Cheap to confirm by ear the
first time a block is built**, and worth doing then rather than as its own probe.

## Exit criteria

1. ⚠ **Arm 1 is answered before the design lands**: the per-clip launch members are
   measured — writable or not, readable or not, and whether a human click honours
   them — with a control arm named.
2. Minting a take **refuses** when the destination row is not verified empty, and a
   test proves the refusal runs **before** the call rather than after.
3. A block's geometry is **checkable and restorable**: contiguity and bounding
   empties read back, `slot.moveTo` relocates a block downward, `scene.create`
   (through 3c's precondition) makes room, and nothing ever inserts mid-grid.
4. ⚠⚠ **Two takes A/B live, on the bar, position-continuous** — take B entering
   where take A was, confirmed by number and by ear. ⚠ State as a mechanical fact
   that this holds **only when the outgoing take is itself on the grid** (E20a),
   which is the ordinary case.
5. The agent has something explicit to say when it builds a block it cannot arm,
   and it is in the tool description as a mechanical fact rather than discovered
   later as a bug.
6. ⚠ Every promoted wire method leaves the E20 probe bucket and enters `WIRE`, with
   the bucket frozen and a new one opened — `regen-wire-golden.ts` already has the
   pattern, and `wiremap.test.ts`'s bookkeeping equality must stay satisfied.
7. `npm run check` green; the live probe green; nothing left behind in the
   operator's project.

## ⚠ What a ○ means here, stated in advance

- ⚠⚠ **The per-clip settings being unwritable** would leave exit criterion 4's
  "no ghostnote UI" half open and move it to session 5 — it would **not** kill the
  clip block, whose musical quality is fully ours through the verb. ⇒ Record it,
  carry it, do not redesign around it.
- **A human click ignoring the per-clip settings** is a different and more useful
  negative than the settings being unwritable, and the two are separable only if the
  arm asks both questions. Ask both.
- ⚠ **The block-delimiting premise failing by ear** (a Next Action's round-robin not
  scoping to the contiguous run) costs the *auto-advance affordance*, which is
  already scored as not ours. The geometry is still what makes a block legible to a
  human. ⇒ Not a redesign trigger.
- **`playingStep` not moving** makes the position-continuity claim unmeasurable;
  the probe REFUSES rather than scoring the arm, because a PASS built on a value
  that never moves is worse than no result (3b's rule, kept).

## Risks

- ⚠⚠ **The transport rolls, and a launch starts it by itself** (E16w). Every exit
  path stops it; any listening arm is **arranged with the operator, never sprung**.
- ⚠ **The probe touches a shared column.** Claim only rows verified empty, delete
  only what was created, give rows back **from the end** (`Scene.deleteObject()`
  compacts upward), and abort without deleting if anything moved outside the
  claimed region — `probe:e20b`'s discipline, kept.
- ⚠ **Addressing is positional, permanently** (E16l). The guard is the content
  fingerprint the stash already provides — ⚠ but it only works *before* our own
  write changes the content, and **two identical clips are indistinguishable**.
- ⚠ **Fork-first's protection is lost for clips.** Under a fork, a mistargeted clip
  write damages a duplicate; here it goes to a real clip in the human's project.
  ⇒ **Write to the new alternate slot, never the live one** — this mechanism has to
  re-earn that protection explicitly.
- **Litter moves, it does not disappear.** The launcher grid fills with alternates
  instead of the mixer filling with tracks. Milder, and the same trade with the sign
  flipped — not a free win.
- ⚠ **Room is per track, a scene row is project-wide.** One track running out of
  space costs a global row that arrives empty for every other track. Harmless, and
  it is how the grid accumulates.
