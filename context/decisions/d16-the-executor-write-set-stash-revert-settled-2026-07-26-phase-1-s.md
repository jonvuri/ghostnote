---
id: D16
kind: decision
state: active
source: DECISIONS.md
---

# D16 — The executor: write-set, stash, revert **[SETTLED 2026-07-26, PHASE-1 session 1]**

**The write-set is derived from the ops before execution; the stash is a readback
of exactly those addresses; a revert materialises ops from the stash and reports
everything it could not put back.** Built offline against the Phase-0 fake as
`brain/src/engine/`. Five sub-decisions the session doc owed, each recorded with
what it *rejected*, because in every case the rejected option was the tempting one.

### a. Stable identity for clips, scenes and devices — **track + slot re-resolution**

`PROJECT_PLAN.md` §7's oldest open question, and the answer is that there is no
second durable key and we are not going to invent one. `channelId` solves tracks
(E2f); everything else is `positional` in `ADDRESS_IDENTITY` and stays that way.
A take therefore addresses a clip as *(durable track, scene index, scene epoch)*
and re-resolves at replay time; a scene op forces a re-point and refuses every
address minted before it (E3).

⚠ **Rejected: a synthetic clip id kept in a side table.** It would mean
maintaining a mapping across a DAW we do not control, through user deletes we
cannot observe without the daemon's observers — i.e. a second source of truth
that goes wrong silently, which is the failure class this project exists to
prevent. The cost of the cheap answer is stated rather than hidden: a positional
address in a batch that also moves rows is labelled `lossy`, derived from
`ADDRESS_IDENTITY`, not remembered (`engine/fidelity.ts`).

### b. ⚠ What revert does about `gain` — **WITHHELD and reported, not replayed**

The sharpest trap in the phase. `gain` reads back **2× written** (E2), so a stash
of a note written at 0.7 holds 1.4, and D8 is explicit that *"the inverse is
unverified, so it is labelled, never corrected."*

That settles what the SNAPSHOT stores. It does not settle what a revert *emits*,
and the two obvious readings are both wrong:

| option | failure |
|---|---|
| replay the stashed 1.4 | writes 1.4, reads back 2.8 — and **doubles again on every subsequent revert**. Unbounded, compounding, silent. |
| divide by `GAIN_READ_SCALE` | the guess D8 forbids. A wrong correction makes **every** take restore wrong gain. |
| **withhold and report** ✅ | the property is not restored, and the take says so by name. Bounded, visible, and the user is already in Bitwig's own piano roll where fixing it is one drag. |

**Chosen: withhold.** A bounded visible failure beats an unbounded silent one,
and it is the same treatment `pressure` already gets — which is not a coincidence,
since both mean "we cannot write a value that reads back as the one we captured".

⚠ **This is one edit away from being retired.** `revertOps` withholds every
property whose `NOTE_PROP_FIDELITY` is not `exact`, derived, never named — so a
Phase-1 session-5 probe that measures the inverse flips `gain` to `'exact'` in
`state.ts` and the withholding stops everywhere at once. **Do not hand-code a
correction anywhere else.**

### c. ⚠ What revert does about `pressure` — **stripped, and the take says so**

A human may have authored pressure in a clip we are about to overwrite. Readback
captures it (correctly — it is the record), and `assertOpsWritable` then REFUSES
to replay it (E15-E). So a naive "apply the stash" **throws**, and a revert that
fails because of a property the *user* authored is a worse failure than one that
reports "restored all but pressure". The stash→ops path strips it and names it.

### d. `fidelity: 'none'` entries — **apply what can be applied, report the rest loudly**

D5's "a revert never silently under-delivers" is a constraint on REPORTING, not a
reason to refuse the whole operation. So a batch mixing note writes with a track
delete reverts the notes and reports the track.

Two asymmetries fell out of this and are worth carrying:

- **A clip that did NOT exist has an exact inverse — delete it.** `readOne`
  labels clip existence `none` because a clip's *content* has no readback that
  could recreate it; absence has no content to fail to recreate. So a revert of
  `[clip.create, note.write]` is `[clip.delete]` and is genuinely lossless, where
  a blanket "structural ops are unrevertable" would have made the flagship case
  do nothing.
- **`track.delete` is `none`, `track.create` is `unrevertable`, and they are
  different things.** The first has an address whose stash is meaningless (a
  recreated track mints a new `channelId`, E2f); the second has no prior address
  at all. Both reach the take, by different routes, so neither is silent.
  ⚠ **Un-creating a created track is deliberately NOT offered**, even though
  `receipt.minted` makes it expressible — a human may already have put work in
  it, and D5's rule cuts both ways.

### e. Stash granularity for an unranged `note.write` — **the whole clip channel**

Never a bounding range, even when the op carries one. A write truncates
same-pitch neighbours OUTSIDE its own extent (E8-E), so a bounding-box stash
misses exactly the state the write is about to damage. It is also what session
2's partial revert will SLICE, and slicing a superset is possible where widening
a subset is not.

### Two things the build discovered

- ⚠ **A batch that bumps the scene epoch invalidates its OWN verify read.** Both
  adapters refuse a stale scene epoch, so the post-apply readback of a
  scene-relative address throws — and re-minting the address at the new epoch
  would be precisely the guess E3's epoch exists to prevent. The executor now
  skips those addresses and reports them in `ApplyReport.unverified`, because
  *"no disagreement reported"* must never be mistaken for *"it landed"*. Found by
  a test, not by a live session.
- ⚠ **The fake reported an empty clip where Bitwig reports no clip.** A `notes`
  read on a slot with no content returned `{notes: []}` on the fake and
  `undefined` on live. The executor's E2 guard reads exactly that distinction to
  refuse a write into a never-created slot, so the fake would have passed the
  guard offline and mispointed live — PHASE-0 §Risks' named failure mode, caught
  because the executor was built against the fake first. Fixed, and `C-slot` now
  asserts it on both.

> ⚠ **AMENDED 2026-08-07 (E16-OPEN-QUESTIONS §3.3.3/§3.3.4, operator-approved).**
> Three corrections to the write-set/fidelity machinery:
>
> 1. **`clip.delete`'s `none` was an ADAPTER ARTIFACT, not an API limit.**
>    `write-set.ts` claimed *"neither its length nor its content has a readback"* —
>    both halves false as the code stands: content is stashed (§e — the whole clip
>    channel) and length is readable (the live adapter already reads `loopLength`
>    to pick a scan grid; it simply never wrote it into the clip entry). Meanwhile
>    `StateValue` declares `lengthBeats?`, the fake populates it and the live
>    adapter did not — PHASE-0 §Risks' named failure mode, unexercised because
>    nothing read the field. **The live adapter captures `lengthBeats`; the label
>    becomes `lossy`** — a revert recreates the clip at its true length carrying
>    the stashed notes, and reports what it cannot restore (name, colour, loop
>    start/end as distinct from length, launch settings, and — the one that bites —
>    automation lanes, which have no readback in our surface at all). Recorded so a
>    later session does not mistake a stash gap for an API wall — the E4c mistake
>    in a different costume.
> 2. **`device.insert` gets `clip.create`'s treatment: revert emits
>    `device.delete`** at the chain index the insert produced — structural, no
>    readback needed, returns the chain to a state that provably existed.
>    `unrevertableOf` had filed it under `NO_DEVICE_READBACK`, a reason written
>    about the *delete* direction. §d's human-work objection is resolved the same
>    way it already is for clips: the revert *says* what it deletes, and D5's
>    reporting rule is the protection, not a refusal to invert. With the mislabel
>    fixed, `WriteSet.unrevertable` becomes exactly *"the set a branch cannot
>    rescue"* (`track.create` — nothing to fork; `scene.create` — not
>    track-scoped): the bucket doing its job.
> 3. ⚠ **The genuine exception is `device.insertFileAt` with `where:'replace'`**:
>    its damage PRECEDES the stash — the outgoing device's opaque state has no
>    readback and no template to rebuild from — so the label predicate's own input
>    is unreliable. If Phase 5 ever adds replace to the contract it is
>    **unconditionally gated** (refused unless branch-protected, before reading
>    anything) — the one hard-coded member §3.3.6 already reserves.
>
> ⚠ Related, decided in D18c: the floor over these labels (*"fidelity worse than
> `exact`"*, §3.3.5) keeps its predicate but changes its RESPONSE — a loud
> refusal-unless-branch-protected, never an automatic fork. And §d's *"un-creating
> a created track is deliberately NOT offered"* softens under D20: not offered
> **automatically**; expressible as a directed destructive op.

---
