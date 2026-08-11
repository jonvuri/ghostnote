---
title: Phase 1, session 3f — the track fork and the layer chain
kind: plan
state: planned
status: PLANNED 2026-08-09. The remaining two branch mechanisms. The fork is
        ● built and proven at the wire (E16k/C5/E16u/E16r) and small; the chain is
        ◐ mostly wired (`e18a`/`e18c`/`e18g`/`e18h`, solo per E17 row 6) and
        carries the session's real cost — the **nested chain address**, which
        `DeviceAddress` cannot express today.
        ⚠⚠ **THE SESSION MOST LIKELY NOT TO FIT ONE CHAT. The split point is named
        in advance: the FORK ships, and the CHAIN becomes 3f-bis.**
        ⚠ Was part of **session 3″**.
updated: 2026-08-09
parent: README.md
prev: 3e-clip-block.md
next: 3g-record.md
scope: PHASE-1-ENGINE.md §Re-plan session 3f
evidence: E16j, E16k, E16q, E16r, E16u, E16w, E17 rows 1–6, E17-VERDICT §4,
          E18a, E18b, E18c, E18e, E18f, E18g, E18h ·
          D6, D13 rev, D16, D18, D19, D20 · standing rules 2, 5, 6, 10, 13
---

# Phase 1, session 3f — the track fork and the layer chain

> **Purpose.** Complete the hybrid. After this session all three of D18's
> mechanisms exist, which is the precondition for 3g being able to describe them
> honestly and freeze v1.

## Why these two are together, and where they come apart

They share nothing mechanically. They are together because **3g needs all three
mechanisms to exist**, and because the fork is genuinely small — the wire is built,
the preconditions already exist for tracks, and the whole job is composition.

⚠⚠ **The chain is not small, and the reason is one line of the contract:**

```ts
DeviceAddress { kind: 'device', track: TrackAddress, chainIndex: number }
```

**Flat. One level.** A device inside a layer chain has nowhere to live in that
grammar. Adding a level touches `addressKey`'s canonical string form, every slice
prefix, and every stashed key — the same ground session 3's proposed decision 1
declined to disturb *"because it would change the key grammar, every slice prefix
and every stashed key."* That argument was about adding a *dimension to a
comparison that already worked*; this is about the address being **expressible at
all**, so it deserves deciding on its own terms rather than inheriting the earlier
answer.

⇒ ⚠⚠ **Named split point, decided now rather than at the end of a long chat: if
the address work runs past the halfway mark, the FORK ships as 3f and the CHAIN
becomes 3f-bis.** The fork is independently useful and unblocks nothing else; the
chain blocks only 3g's completeness.

## Scope

### In — the track fork

1. **The composite**, in its forced order. ⚠ **Group the original FIRST, then
   duplicate** (E16k K2) — `moveTracks` and `copyTracks` are both silent no-ops, so
   nothing can be gathered in afterwards.
2. ⚠ **Rule 6's ONE sanctioned named action.** No API creates a group, so
   lineage-group creation is the single place a named action is permitted — and
   only *"where the selection is established and verified in the same batch"*.
   E16j's cost when that discipline lapses: **seven orphan duplicates**.
3. **Rename-on-fork.** E16q measured the middle dot round-trips exactly.
4. **The bank-window precondition**, which already exists for tracks — a fork **is**
   a `track.create`, so rule 5 applies unchanged. ⚠ The budget is
   `bankSize − (project tracks + FX returns + master + lineage groups)`, and a
   four-track turn costs four lineage groups **plus** four forks, because the UI
   selection can only be set to one track.
5. **The inverse**, and its fidelity label.

### In — the layer chain

6. ⚠⚠ **The nested chain address** — the contract change, and the session's centre
   of gravity.
7. **Minting a chain** via `layer.duplicateChannel` (● creates a chain, where
   `duplicateObject` ○ does not).
8. ⚠ **The A/B: `DeviceLayer.solo()`, one exclusive flag.** E17 row 6 measured it
   container-scoped (0 of 10 tracks flipped, where a track solo flipped all 10)
   **and** locally exclusive. That beats both the layer-mute and chain-selector
   options the original table weighed — and ⚠ it is a **capability gap in the track
   model**, not a preference: Bitwig offers mute, which is not exclusive, and solo,
   which flips everything.
9. **Device insert/delete addressed INTO a chain** (planning decision 3) — otherwise
   a chain take is one we can create but not fill.

### Out — named so it does not drift in

- ⚠⚠ **Chain REMOVAL.** A rebuild is **7 undo steps** (`e18f`), with both containers
  live in 6 of 7 intermediate states, and axis C says the human reaps (D20). We do
  not prune.
- **The clip block.** 3e.
- **The record, the classifier, the v1 freeze.** 3g.
- ⚠ **A human-authored preset shell.** Selectors and Instrument Layers ship with
  **zero chains** and E16o proved no verb seeds one, so the preset library (rule 11,
  E4h) is a **dependency of the A/B story**, not just of Phase 5's authoring. ⚠ This
  session consumes such an asset; it does not build the pipeline.
- ⚠ **The cross-device modulator case** — E11e's form encodes a device **INDEX**,
  exactly what a rebuild renumbers, and `e18e`'s ●● 3/3 says nothing about it. A
  session of its own.
- ⚠ **Linking a device take to a clip take.** E18-VERDICT §4e: nothing links them,
  and §6 proposes **not solving it**. Coordination problems fail silently; this one
  is left visible rather than half-built.

## ⚠ What each mechanism reaches that the others cannot

Kept because it is the substance tool descriptions must convey in 3g — ⚠ **as
trade-offs, never as rules** (D18c).

| | track fork | layer chain | clip block |
|---|---|---|---|
| carries clips | ● | ○ **never** — a chain has no clips, which is why clip→layer conversion is impossible outright | ● |
| reaches the **Master and FX returns** | ○ — other tracks' sends still feed the original | ● **the only mechanism that does** (`e18a`) | ○ |
| one-click exclusive A/B | ○ mute is not exclusive; solo is not local | ● one flag (E17 row 6) | ● per-slot launch |
| beat-aligned switching | ○ mute is unquantised (E16m) | ○ | ●● **only this one** (E20a) |
| visible without expanding a container | ● | ⚠ ○ — in a stateless system the project IS the take log, so a take you cannot see is a degraded log |  ● |
| reorganisable after it exists | ○ tracks cannot be re-parented (E16k K2) | ● `e18c` chain→top, then fork | ● `slot.moveTo` |
| silent during playback | ○ | ● a MOVE-based rebuild is silent (`e18h`) | ● |
| Cmd-Z cost | 3 steps | ⚠ **7** | ≈1 |

⚠ **One argument carried alongside these is wrong and must be dropped**: the bank
window as an argument against forks (E18-VERDICT §3a overstates it, and E16u
measured disk immaterial — 20,391 bytes per fork, no perceptible save-time change).

## Exit criteria

1. A fork produces a **named, addressable, audible** sibling under a lineage group,
   in the forced order, with the selection verified in the same batch — and ⚠ a
   test proves the named action is unreachable except through that one path.
2. A fork past the bank-window budget is **refused before the call**, and the
   refusal names what is impossible, never what to do instead (D18c).
3. ⚠⚠ The nested chain address round-trips: minted, keyed, sliced, stashed and
   reverted — with `addressKey`'s grammar change covered by tests that would fail
   if a prefix stopped matching.
4. A chain take can be **created and filled**: `layer.duplicateChannel` mints it,
   a device is inserted addressed into it, and the readback confirms placement
   through a different handle than the one that wrote it (rule 3a).
5. ⚠ **The A/B is one exclusive flag**, measured live: soloing chain B is audible,
   chain A goes silent, and **no track outside the container flips**.
6. Both mechanisms carry inverses and fidelity labels, and ⚠ **what a reversal
   cannot restore is reported** through the existing machinery (D19) rather than
   reinvented.
7. `npm run check` green; the live probe green; nothing left behind.

## ⚠ What a ○ means here, stated in advance

- ⚠⚠ **The nested address proving invasive** is the expected shape of trouble, not
  a surprise — and it is what the named split point exists for. ⇒ **Ship the fork,
  move the chain to 3f-bis.** Do not compress the address work to fit.
- **`DeviceLayer.solo()` turning out to be non-exclusive in some container we have
  not tried** would cost the chain its best row and send the A/B back to N mute
  flags — E16m's problem again. ⚠ Measure it in the container this session
  actually uses, not only in E17's.
- ⚠ **A fork glitching the transport** was measured in E16 and re-measured in
  `e18h`. It is a **cost to record, not a blocker** — and its counterpart (does a
  MOVE leave an audible hole in the migrated take's own output?) is still
  unmeasured. **Record both, decide neither.**
- **Dormant-chain CPU** was dispositioned by operator judgement, not measurement
  (*"the same or less cost CPU wise"*), with a stated retirement condition: if a
  session of exploration ever degrades the engine, this is the first assumption to
  re-test. ⚠ There is **no CPU anywhere in the controller API**, so it can only ever
  be a human reading the engine meter.

## Risks

- ⚠⚠ **The named action fires against the UI SELECTION, which a human can move
  under us** (E6 blocker 3, observed again in E16j). This is the one place rule 6
  is relaxed and the one place it can cost the operator real damage. The selection
  must be set, **verified**, and used in the same batch — never assumed.
- ⚠ **The Master and the FX returns cross the bank ceiling FIRST** (E16r: Master at
  17, FX 1 at 18), because a flat bank orders regular tracks → FX returns → Master
  and every new track is inserted before that tail. ⇒ **Approaching the ceiling
  costs the measuring instrument before it costs any ordinary track**, and the
  failure is `found:false` — byte-identical to a deleted track.
- ⚠ **A chain's `channelId` is minted by the PROJECT LOADER** (`e18b`), so a
  directed delete on a name-addressed chain can still hit the wrong take. Only
  execution discipline prevents that: enumerate the cascade by identity, **name the
  survivor rather than counting it**, bound the delta, verify by readback (D20).
- **A group delete takes the winner with it**, whether or not that was ordered.
  Enumerate before, not after.
- ⚠ **Scope creep into 3g.** Every mechanism built here wants a description written
  the moment it works. Write it — and do not version it.
