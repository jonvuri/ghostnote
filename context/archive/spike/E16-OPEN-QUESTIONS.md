---
title: ghostnote — E16 session 4, job 1: the open questions in the handoff's §3
status: §3 SUBSTANTIALLY ANSWERED. §3.1 ● (E16n/E16o — E4d route 3 overturned).
        §3.2 DECIDED by the user (retire ghostnoted), premise probed (E16p).
        §3.3 derived from the code. §3.4 a,b,c,i,j,k ●; e,f,g,h owed.
        Next: §4, the re-plan. ⚠ Nothing here goes into DECISIONS.md
        (standing rule 10) — this proposes, the user decides.
updated: 2026-07-30
parent: HANDOFF-E16-TRACK-NATIVE.md
model doc: E16-TRACK-NATIVE-BRANCHING.md
evidence: engine/write-set.ts, engine/fidelity.ts, engine/revert.ts,
        contract/address.ts, contract/ops.ts, contract/snapshot.ts,
        contract/state.ts, adapters/live/adapter.ts · FINDINGS E16l, E16k, E16j,
        E16 rows A–C and D–G, E4c, E4d/E4e, E2, E8-E, E15-E · D16, D17
---

# E16 session 4 — the open questions

> ⚠ **The model is CHOSEN and is not re-litigated here.** This document answers
> what the handoff left open underneath it. Where an answer changes the shape of
> the model it says so explicitly rather than quietly.

---

## 3.3 — the op-class floor ⇒ **it is not a list of op classes**

**The handoff asked for the floor's membership to be derived rather than
assumed, working from `engine/fidelity.ts` and `ADDRESS_IDENTITY`. Doing that
does not produce a list. It produces a predicate that already exists in the
code, plus a small residue the predicate provably cannot cover.**

### 3.3.1 The two questions each candidate must pass

The handoff's framing — *"always fork for op classes that cannot otherwise be
reverted"* — contains a hidden second question, and half the candidate list
fails on it rather than on the first:

| | question | if NO |
|---|---|---|
| **Q1** | is it genuinely unrevertable under the engine as built? | no floor membership — a forced fork buys a bank slot and a C5 glitch for nothing |
| **Q2** | ⚠ **would a fork actually make it revertable?** | floor membership is *meaningless*, not merely unnecessary — the mechanism does not apply |

Q2 is the one the candidate list was not screened against. **A fork duplicates a
track.** An op that is not track-scoped cannot be rescued by duplicating tracks,
no matter how unrevertable it is, and putting it on the floor would produce a
fork that costs a slot and protects nothing.

### 3.3.2 The verdict per class

Derived from `writeSetOf` / `targetsOf` / `unrevertableOf` in `write-set.ts` and
`labelTarget` in `fidelity.ts`, not from the prose.

| op class | engine label | Q1 unrevertable? | Q2 fork helps? | floor? |
|---|---|---|---|---|
| `device.delete` | `none` | ● **yes** — opaque plugin state has no readback at all (B2 read 2193 DirectParameters and that is still not the whole device) | ● yes, track-scoped | ● **YES** |
| `clip.delete` | `none` | ◐ **not proven** — see 3.3.3 | ● yes, track-scoped | ● **yes, today** |
| `track.delete` | `none` | ● yes — a recreated track mints a new `channelId` (E2f) | ◐ substance yes, identity no | ◐ **subsumed** by `collapse` (§1c) |
| `note.*` into a clip carrying `gain`/`pressure` | `lossy` | ● **yes, and this is the flagship everyday op** — D16b withholds `gain`, D16c strips `pressure` | ● yes | ● **YES — and the candidate list omitted it** |
| any positional address in a batch that also moves rows | `lossy` via `isAtRisk` | ● yes, by construction | ● yes | ● **YES** |
| `device.insert` | `unrevertable` | ○ **NO — mislabelled**, see 3.3.4 | (n/a) | ○ no |
| `track.create` | `unrevertable` | ● yes | ○ **no — there is nothing to fork** | ○ **cannot be** |
| `scene.create` / `scene.delete` | `unrevertable` / `none` | ● yes | ○ **no — a scene spans every track** | ○ **cannot be** |
| `note.*` into a clip with no expression data | `exact` | ○ no | (n/a) | ○ no |
| `param.set`, `track.rename`, `clip.create` | `exact` | ○ no | (n/a) | ○ no |

⚠ **Three of the handoff's five candidates do not survive**, and each for a
different reason: `device.insert` is mislabelled, `track.create` has nothing to
fork, `scene.create` is not track-scoped. Meanwhile the single most common
operation in the system — writing notes into a clip a human has already put
expression into — belongs on the floor and was not on the list.

### 3.3.3 ⚠ `clip.delete`'s `none` is an artifact of the adapter, not of the API

`write-set.ts` gives `clip.delete` this reason:

> *"neither its length nor its content has a readback that could reproduce it"*

**Both halves are false as the code stands.**

- **Content** is stashed. `targetsOf` puts `notes(clip, 0)` in the write-set
  alongside the clip itself, and D16e makes that the **whole clip channel**.
- **Length** is readable. `adapters/live/adapter.ts` reads `loopLength` off
  `cursor.status` in the `notes` branch to pick a scan grid — it simply is not
  written into the clip entry.

⚠ **And the fake and the live adapter DISAGREE about this.** `StateValue`
declares `{ of: 'clip'; exists; lengthBeats? }`; the fake populates
`lengthBeats`, and the live adapter returns `{ of: 'clip', exists }` with
`fidelity: 'none'`. That is PHASE-0 §Risks' named failure mode — the fake
certifying a capture the live path does not make — sitting unexercised because
nothing reads the field.

What is *genuinely* unrestorable about a deleted clip is everything the
`StateValue` has no room for: clip name and colour, loop start/end as distinct
from length, launch quantisation and mode, and — the one that actually bites —
**automation lanes inside the clip**, which have no readback in our surface at
all.

⇒ **Verdict: `clip.delete` earns floor membership TODAY**, because under the
engine as built it really cannot be put back. But it is on the floor for an
implementation reason, and the retirement condition is nameable: capture
`lengthBeats` live and the label becomes `lossy` (restorable modulo clip
metadata) rather than `none`. Recorded so that a later session does not mistake
a stash gap for an API wall — which is the E4c mistake in a different costume.

### 3.3.4 ⚠ `device.insert` is `clip.create` and does not get its treatment

D16d reasoned the asymmetry explicitly, for clips:

> *"A clip that did NOT exist has an exact inverse — delete it. […] a revert of
> `[clip.create, note.write]` is `[clip.delete]` and is genuinely lossless,
> where a blanket 'structural ops are unrevertable' would have made the flagship
> case do nothing."*

**Every word of that is true of a device that did not exist.** The inverse is
`device.delete` at the chain index the insert produced; it is structural rather
than content-based, so no readback is needed; and it returns the chain to a
state that provably existed. Yet `unrevertableOf` files `device.insert` under
`NO_DEVICE_READBACK` — a reason written about the *delete* direction — and
`revertOps` pushes it to `unrestored` rather than emitting the inverse.

The one substantive objection is D16d's other rule, the one it applied to
`track.create`: *a human may already have put work in it*. That objection is
equally true of a created clip, and clips get the inverse anyway. **So the
asymmetry is unprincipled as it stands and should be resolved deliberately in
one direction or the other** — but either way `device.insert` does not need a
forced fork on unrevertability grounds, because the fork would be protecting
against a loss that has an exact inverse.

⚠ **One genuine exception, and it is Phase 5's.** `device.insertFileAt` with
`where: 'replace'` is on the *wire* but is **not expressible in the contract** —
the `device.insert` op carries `{track, source}` and no placement. A replace
destroys the outgoing device's live state, which has no readback and no
template to rebuild it from (`bwmod/index.ts`: *"There is no runtime create/route
API; runtime only DRIVES what a template already contains"*). **If Phase 5 ever
adds replace to the contract, it is an unconditional floor member** — and see
3.3.6, because its damage precedes the stash.

### 3.3.5 ⇒ The floor, stated

**The floor is: fork when the batch's own labelled fidelity is worse than
`exact`.**

```
  resolve → stash → LABEL → (fork if worstOf(labels) !== 'exact') → apply → verify → report
                     ▲
                     └── `labelTarget` / `worstOf`, engine/fidelity.ts — already built
```

Five properties, and they are why this beats a hand-kept list:

1. **It is evaluable at exactly the right moment.** D16's pipeline already
   stashes *before* it applies, so the labels exist before the first write —
   which is the one instant a fork decision can still be made.
2. **It is already implemented.** `labelTarget` combines `ADDRESS_IDENTITY`,
   `NOTE_PROP_FIDELITY` and the adapter's own per-entry `Fidelity` by taking the
   worst. That is the floor's membership test, written a phase early for another
   purpose.
3. ⚠ **It cannot rot, because rot is a compile error.** The handoff's worry was
   a hand-maintained list going stale as Phase 4/5 add ops. `targetsOf`'s
   `assertNever` already turns an unmapped variant into a **compile** failure, so
   a new op cannot silently miss the floor the way it cannot silently miss the
   write-set.
4. **It retires its own members.** If the Phase-1 session-5 probe measures
   `gain`'s inverse and flips it to `'exact'` in `state.ts`, note writes stop
   forcing forks **everywhere at once** — the same one-edit property D16b was
   designed for, inherited for free.
5. **It is content-conditional, which a list cannot be.** The same `note.write`
   is `exact` on a clip with no expression data and `lossy` on one a human has
   played into. Only the second needs a fork, and only a predicate over the
   stash can tell them apart.

⚠ **The predicate runs over `WriteSet.targets` only.** `WriteSet.unrevertable`
is a separate array whose members have no prior address at all, so `worstOf`
never sees them — which turns out to be exactly right, because:

> **`WriteSet.unrevertable` is almost precisely the set a fork cannot rescue.**
> `track.create` (nothing to fork) and `scene.create` (not track-scoped) both
> belong there. The one member that does not fit — `device.insert`, which *is*
> track-scoped — is also the one 3.3.4 shows is mislabelled. The bucket is
> right; one thing is in the wrong bucket.

### 3.3.6 The residue the predicate cannot cover

Three cases, each needing a different mechanism, and none of them a floor member:

| case | why the predicate misses it | what handles it instead |
|---|---|---|
| **not track-scoped** — scenes, and later tempo, time signature, master, FX returns, cross-track routing | a fork duplicates tracks; there is nothing to duplicate | the stash, unchanged (§4.8). ⚠ This is why the stash survives, and the list is longer than "scenes" |
| **mints identity** — `track.create` | no prior address, so no label | the reaping guard (§1c guard 4: refuse to delete an untagged track — a created track is untagged) |
| ⚠ **damage precedes the stash** — a device replace, and modulator surgery onto an existing device | the label describes what the stash CAPTURED; here the stash is already insufficient at capture time, so the predicate's own input is unreliable | **the one genuinely hard-coded member.** Fork unconditionally, before reading anything |

⚠ **The third row is the only place a hard-coded rule survives, and it is worth
being precise about why.** Everywhere else the stash is a faithful record and
the question is only whether it can be *replayed*. For a device replace the
stash cannot even be *taken*: opaque plugin state is a blob with no readback
(B2/§5.6), so there is no snapshot whose fidelity could be labelled. A predicate
over labels is structurally unable to see this, which is exactly the shape of
thing that deserves to be written down rather than derived.

### 3.3.7 What this costs, stated rather than hidden

- ⚠ **A fork re-points every address in flight.** Forking mints a fresh
  `channelId` (row A4), so addresses minted against the original must be
  re-resolved onto the fork between the stash and the apply. That is a real
  mechanical step the pipeline does not have today, and it is the main
  implementation cost of the floor.
- **The stash is taken from the original and describes the fork too**, because
  the fork is a copy of it. So the ordering `stash → fork → apply` is sound and
  needs no second read.
- **Every floor fork costs a bank slot and a C5 glitch** (5/5 vs 0/3 placebo).
  The predicate is what keeps that bill proportionate: an ordinary note write
  into a clean clip is `exact` and pays nothing.

---

## 3.1 — can an existing device be MOVED into a layer? ⇒ ● **YES, AND IT KEEPS ITS STATE**

> ⚠ **ANSWERED 2026-07-30. E4d route 3's ○ is overturned** — it was a
> single-mechanism check and the sibling verb works. Full record:
> `FINDINGS.md` → **E16n / E16o**.

| | |
|---|---|
| `moveDevices` into a layer chain | ● top level `[FX Layer, Polysynth]` → `[FX Layer]`; layer 0 `[]` → `[Polysynth]` |
| VERB control (flat reorder) | ● |
| DEST control (`layer.insertDevice`) | ● |
| **the moved device keeps its state** | ● `F1FREQ`=0.17, `F1RESO`=0.83 survived, read through the nested cursor |
| can `moveDevices` CREATE a chain? | ○ no — 0→0 on three containers, 1→1 on an FX Layer |

**The payoff, restated precisely — it is narrower than the handoff hoped and
sharper than it feared.** E4d's residual gap stands, so multi-chain structure
still comes from a `.bwpreset` (route 4, 268 ms) and the preset-library posture
is unchanged. **What is new is the half a preset could never supply:** a chain
can now hold the human's *own* device with its *own* state, where before it could
only hold a freshly-inserted one. **That was the actual blocker** — building a
two-chain selector from an asset was always possible; getting the user's patch
into it was not.

⇒ **The chain-selector route to a device-scoped A/B is mechanically open**, and
it reaches the master and the FX returns, which the track model cannot. ⚠ **It is
not proven usable**: §3.4e (switching glitch, latency, whether it cuts sends) is
still owed and is now worth taking.

⚠ **One trap worth carrying out of this row**, because it nearly published a
false negative: **`layer.moveDeviceInto`'s destination is implicit in
`cursorDevice0`**, so a handler reaching a cursor-following bank has the cursor
as a hidden argument. Aimed at a device with no layers it is a silent no-op that
is byte-identical to an API refusal. Caught only because the probe asserted the
*precondition* ("did it relocate?") separately from its *question* ("did state
survive?"). A probe testing only its headline question would have shipped the
wrong answer.

### The doc pass that justified spending the restart

**The javadoc argued AGAINST it.** `moveDevices` and `copyDevices` carry
identical wording, and the class doc specifies the silent no-op as intended — so
a doc pass would have closed this ○ a second time. What justified the probe was
empirical: E4c had measured a *new* device landing in that same layer chain in
~143 ms, so `copyDevices`' no-op was **verb-specific, not destination-specific**;
and row A had already seen `copyTracks` ○ beside three working duplication verbs.
The complete-recall sweep (all 1968 members, every relocation-shaped token)
established that `InsertionPoint` has exactly 14 members and that
`moveDevices` and `paste()` were the only untried relocation routes.

⚠ `layer.pasteInto` is on the wire and **was not called** — it takes its content
from the clipboard, and filling that means `Application.cut()`/`copy()` acting on
the UI selection our own addressing sets (E6 blocker 3). It is a human-assisted
follow-up, and the target's ● makes it unnecessary.

### 3.1.1 The complete-recall pass

Method per standing rule 10 — grep the concept, not the suspected method, then
enumerate the classes completely. Ran over all **1968** members of
`member-search-index.js` for every relocation-shaped token (`move`, `relocate`,
`reparent`, `transfer`, `reorder`, `copy`, `cut`, `paste`, `drag`, `drop`,
`insert`), then enumerated `InsertionPoint`, `Device`, `DeviceChain`,
`DeviceLayer`, `ChainSelector` and the base interfaces in full.

**`InsertionPoint` has exactly 14 members**, and three of them relocate devices:

| member | status |
|---|---|
| `copyDevices(Device…)` | ○ E4d route 3 — silent no-op into a layer |
| ⚠ **`moveDevices(Device…)`** | **never probed** |
| ⚠ **`paste()`** | **never probed** — a second, independent mechanism |

Nothing else in the API relocates a device. `relocate`, `reparent`, `reorder` and
`drag`/`drop` return **zero** hits across all 1968 members, so there is no third
route hiding under a different name. `Device` (84 members) has
`replaceDeviceInsertionPoint()`, which is a destination rather than a relocation
verb, and `DeviceLayer` still has no members of its own at all.

### 3.1.2 ⚠ The javadoc does NOT support the reopen — the empirical pattern does

Worth stating plainly, because it is the opposite of what one hopes for:

> `moveDevices` — *"Moves the supplied devices to this insertion point. If it's
> not possible to do so then this does nothing."*
> `copyDevices` — *"Copies the supplied devices to this insertion point. If it's
> not possible to do so then this does nothing."*

**Identical wording, and the class-level javadoc documents the silent no-op as
intended behaviour** (*"Some things may not make sense to insert in which case
nothing happens"*). A doc pass alone would close this row ○ — and would be
committing E4c's exact error, which is why it does not get to.

The real argument is empirical, and it has two legs:

1. ⚠ **The destination is PROVEN to accept inserts.** E4c measured a *new*
   device landing inside an existing layer chain in ~143 ms, through
   `DeviceLayer.endOfDeviceChainInsertionPoint()` — the very insertion point
   `layer.copyDeviceInto` calls. **So `copyDevices`' no-op is verb-specific, not
   destination-specific.** That is a much sharper prior than "moveDevices is
   right there next to it", and it is the fact the handoff's framing was missing.
2. **Verbs on this interface demonstrably diverge.** Row A: `copyTracks` ○ while
   `duplicate` / `duplicateObject` / `duplicateObjects` are all ●, on the same
   object through the same supertype chain. E4d: `DrumPad.insertionPoint()` ●
   where `DeviceLayer` has none. This API rewards trying the sibling.

⇒ **Two untested verbs, on a destination known to work, on an interface whose
verbs are known to disagree.** That justifies the restart. It does not predict
the outcome, and 3.1.4's control is what makes a negative mean anything.

### 3.1.3 What goes on the wire (one restart, three methods)

| method | call | why |
|---|---|---|
| `layer.moveDeviceInto` | `layer.endOfDeviceChainInsertionPoint().moveDevices(dev)` | the main event — the exact sibling of `layer.copyDeviceInto`, so the comparison is clean |
| ⚠ `device.moveTo` | `moveDevices` to a *same-track* destination (before/after another device) | **the control, and it is not optional** — see below |
| `layer.pasteInto` | `layer.endOfDeviceChainInsertionPoint().paste()` | route 2, only interesting if route 1 fails |

⚠ **`device.moveTo` is the control that E6's write-up lacked and it decides
whether a negative means anything.** If `moveDevices` cannot even reorder two
devices on the same track, then a no-op into a layer says nothing about layers —
it says the verb is dead everywhere, and the row would have measured the wrong
thing. Bracketing a target with a same-verb positive control on a destination we
expect to work is the `e16j` discipline, and it is why that probe could
contradict E6 credibly.

Verified by `device.list` / `layer.list` **diff**, never by the return value
(E6 blocker 4: `invoke()` and these handlers alike acknowledge and tell you
nothing).

### 3.1.4 ⚠ What a ● would and would not buy

The handoff's payoff claim — a chain selector as a device-scoped A/B that
reaches the master and the FX returns, with no bank cost and no C5 glitch —
is **conditional on more than this row**, and the conditions should not be
quietly inherited:

- ⚠ **The Selectors ship with ZERO chains and cannot be seeded** (E4d residual
  gap, re-confirmed above: `ChainSelector` has 5 members, none of them creates a
  chain). So even with `moveDevices` working, a *multi-chain* selector still has
  to arrive via `insertFile` from a `.bwpreset` (route 4, 268 ms). The relocation
  verb populates a structure it cannot create.
- **§3.4e is still owed regardless** — whether switching chains glitches, how
  fast it is, and whether it cuts sends. A ● here makes that measurement worth
  taking; it does not pre-answer it.

⇒ Stated so the row is not oversold: **`moveDevices` working would remove one of
two blockers, not both.**

---

## 3.2 — should the daemon model be revised? ⇒ ● **DECIDED: retire `ghostnoted`**

> ⚠ **DECIDED BY THE USER, 2026-07-30 — option A.** `ghostnoted` is retired; the
> MCP server holds a bridge connection directly; the scene epoch moves into the
> extension; **standing rule 7 is struck, not reworded**. Recorded here; it still
> needs writing into `DECISIONS.md` as an amendment to D4, which is the §4
> re-plan's job and remains the user's to author (rule 10).
>
> ⚠ **The premise was PROBED before adoption, not assumed** — see 3.2.7.

### 3.2.1 D4's jobs, scored under the chosen model

| D4 gave the daemon | status now |
|---|---|
| the **single bridge connection** | ⚠ **the premise is wrong — see 3.2.2** |
| the **take store** | ○ retired (stateless) |
| the **change log** | ○ retired (the project holds state, not history — §4.14) |
| **Bitwig observers**, "which is what lets the change log distinguish agent edits from the user's" | ◐ the stated purpose is retired with the log, but **one real job survives** — see 3.2.3 |
| **rule 7**, all writes through the daemon, so nothing leaves a silent gap in the take log | ○ **rationale gone with the log.** The *ordering* guard was never the daemon's: E8's revision counter is extension-side |
| **privilege separation** — keep the agent off the human's endpoints | ○ **buys nothing here — see 3.2.4** |

⚠ **D4's founding argument is fully retired, and it is worth quoting to see how
completely.** D4 exists because *"an MCP stdio server is a subprocess of the chat
client, so in-memory checkpoints die with the session."* **There are no
checkpoints.** The thing that could not be allowed to die with the session no
longer exists, so the process that existed to outlive the session has no cargo.

### 3.2.2 ⚠ "The single bridge connection" was a policy, not a constraint

`Bridge.java` binds `new ServerSocket(port, 8, loopback)` and runs an accept loop
that hands **each client to its own thread** from a cached pool. Every request is
then marshalled onto the single control-surface thread, which is what makes E8's
revision counter atomic without a lock — *across clients*, not merely across
requests.

⇒ **The extension already looks built for several concurrent clients, and the
ordering guard already covers them.** "Something must hold *the* connection" is
not a thing the wire requires.

⚠ **This is a CODE READING, not a measurement, and standing rule 10 applies to it
exactly as it applies to a doc pass.** Two clients writing concurrently has never
been probed; `e08b-interference.ts` measured a human interfering with one client,
which is a different question. **Before anything is built on it, this wants one
cheap probe:** two `BridgeClient`s, interleaved writes, and a check that the
revision guard rejects the stale one rather than both landing. Until then the
right phrasing is *"reads as supported"*, and this proposal should not be
adopted on the strength of it alone.

### 3.2.3 The one surviving observer job — and the extension is a better home

`adapters/live/adapter.ts` carries a known correctness hole, and it is not
retired by statelessness:

> *"this counter only sees OUR OWN scene ops. A scene the USER creates or deletes
> in Bitwig does not move it, so a scene-relative address minted before that edit
> still resolves as `found` … while E3's compaction has already shifted every row
> beneath it."*

That guard is **more** load-bearing under the chosen model, not less: E16l settled
that clips have no identity, so positional addressing plus the epoch is the whole
mechanism. The adapter's own comment defers the fix to the daemon — *"detecting a
foreign scene edit needs a Bitwig OBSERVER, and D4 puts observers in the
daemon"*.

⚠ **But the daemon is the wrong home for it, and the right one is already
running.** The extension:

- is alive whenever Bitwig is, so it **cannot miss an edit made while no client
  is attached** — which a daemon started later provably can;
- already holds the exact analogue. `ExecState.revision` is an extension-side
  counter, thread-confined to the control-surface thread, guarding ordering. The
  scene epoch is the same shape of object guarding the same shape of hazard, and
  it belongs beside it;
- already has the scene bank (`scene.count`, `rig.info.sceneCount`).

⇒ **Proposal: move the scene epoch into `ExecState` and drive it from a scene
observer.** That closes a hole D4 could only defer, and it closes it *better* than
D4's own answer would have. ⚠ Caveat: a count observer catches create/delete but
not a scene **move** — which is §3.4f, still owed.

### 3.2.4 ⚠ The daemon buys no privilege separation under this model

D14 says a daemon-served web view can own take switching *"provided the daemon
keeps the agent off those endpoints"*. Two things dissolve that:

1. **The strong half was never the daemon's.** `Signal.fire()` is REFUSED by
   Bitwig (E14-A1), so the in-Bitwig pane is API-enforced with or without a
   daemon.
2. ⚠ **The weak half cannot be fixed by a process boundary.** Under this model
   revert is *deleting a track*, and the agent must be able to execute
   `collapse(group, survivor)` — the operator asks for it (rule 8a). So the
   destructive capability is on the agent's own path by design. A daemon in the
   middle relays it; it does not withhold it. §4.12 already recorded this
   asymmetry honestly, and §1c resolved it the only way it can be resolved:
   **"the distinction that actually matters is not who calls the API — it is who
   decided."** That is policy plus op shape (8a/8b, the packaged `collapse`), and
   no topology substitutes for it.

### 3.2.5 The two counter-arguments the handoff raises

| the worry | examined |
|---|---|
| *"Phase 3's web view would need its own connection or to be hosted by the MCP server"* | It can hold its own (3.2.2, unprobed). And the thing a shared daemon would let it share — **history** — no longer exists: §4.14 says provenance is unanswerable from project state and lives in the agent's context, so a web view cannot show it under **any** topology. ⚠ The view's remaining jobs are the §5 merge surface and a lineage picker, both **re-derived from the project on every snapshot** (§1a), both invoked *during* a session |
| *"anything wanting to observe while no agent is attached would have nowhere to live"* | The only concrete candidate is the scene-epoch observer, and 3.2.3 puts it somewhere strictly better. The other candidate — detecting a human's edit to a fork (§1c guard 6) — the handoff **has already decided against relying on**: *"operator confirmation is the more reliable guard"* |

### 3.2.6 ⇒ The proposal, and what it costs

**Retire `ghostnoted`. The MCP server holds a bridge connection directly. The
scene epoch moves into the extension. Standing rule 7 is struck, not reworded.**

Costs, stated rather than discovered later:

- ⚠ **Multiple chat sessions mean multiple MCP servers mean multiple writers.**
  The revision counter serialises them, but two agents could still interleave
  coherently-ordered nonsense. A daemon would have made one writer structural.
  **This is the strongest single argument for keeping one**, and it is a real
  scenario (two editors, two projects, one Bitwig — or simply a second session
  opened by accident). Mitigation short of a daemon: the extension refuses a
  second *writing* client, which is a small change in `Bridge.java` and keeps the
  guarantee where the revision counter already is.
- **Phase 3 becomes an MCP-server-hosted surface**, so it lives and dies with the
  chat session. Acceptable only because its remaining jobs are session-scoped.
  ⚠ **If Phase 3 ever wants to be usable with no agent attached, this decision
  reopens** — and that is the tripwire to write down rather than rediscover.
- The `brain/src/store/` retirement (§4) and this land together; deciding this
  one first makes PHASE-1 session 3 either shrink drastically or disappear.

**Three options, if the recommendation is not taken as stated:**

| | |
|---|---|
| **A — retire it** *(recommended)* | above |
| **B — keep a thin daemon** as connection broker and single writer, with no store and no log | buys exactly the multi-writer guarantee and nothing else. ⚠ Compare against "the extension refuses a second writer", which buys the same thing for far less |
| **C — defer to Phase 3** | keeps D4 nominally true and decides when the web view is real. ⚠ Costs: PHASE-1 session 3 cannot be re-planned this session, and the §4 re-plan is the point of the session |

### 3.2.7 ⚠ The premise was PROBED before the decision was adopted

3.2.2 rested on a **code reading** of `Bridge.java`, and standing rule 10 applies
to reading source exactly as it applies to reading javadoc — this spike has been
wrong five times from that move. So it was measured. Probe `e16p-multiclient.ts`,
recorded in `FINDINGS.md` → **E16p**:

| | |
|---|---|
| two clients connected and served concurrently | ● same `methodsHash` from both |
| 12 interleaved round trips each, no cross-talk | ● 0 misdelivered replies |
| both clients read the **same** revision | ● one counter, not one per connection |
| a stale batch from client B after A landed one | ● rejected whole, `reason: stale-revision` |
| ⚠ **both submitted concurrently against one revision** | ● **exactly one winner, 6/6 rounds** |
| one client disconnecting | ● the other is unaffected |

⇒ **E8's revision guard is atomic ACROSS CONNECTIONS**, not merely across
requests — `ExecState`'s thread-confinement claim holds under load. Retiring the
daemon therefore gives up **no** ordering guarantee, and the strongest argument
for option B (a thin daemon as single writer) is answered by machinery that
already exists.

⚠ **What this does NOT show**, and it should not be read as showing it: that two
agents writing concurrently is a good *idea*. The guard makes their writes
**ordered, not coherent** — a rejected batch still has to be re-planned against
the new world by whoever sent it. That is a design question for the MCP server,
not a bridge property, and it is the residual cost of option A.

## 3.4 — measurements

| # | question | state |
|---|---|---|
| **a** | bank-window headroom under `ALL_CHANNELS` | ● **ANSWERED — and it is worse than a ceiling** (E16r) |
| **b** | does muting a GROUP silence its children (+ their sends)? | ● **ANSWERED** (E16m) |
| **c** | fork burst cost | ● **0.61× a spaced fork** — bursting is cheaper (E16r) |
| **i** | cursor-pool pressure | ● pool bounds concurrency, and overflow **throws** (E16r) |
| **j** | does `track.setName` accept non-ASCII? | ● **the middle dot round-trips exactly** (E16q) |
| **k** | past `Z·` | ● nothing to probe — policy, not API. Proposal below |
| e, f, g, h | — | owed |

### 3.4a ⚠ — the budget is measurable, but the Master goes first

Full record: `FINDINGS.md` → **E16r**.

`itemCount` still reports the project total past the window under `ALL_CHANNELS`
(21 while visible saturates at 16), **so standing rule 5 remains
implementable** — the one thing that had to hold, holds. Two things fall out that
are worse than a ceiling:

1. ⚠ **The Master and the FX returns leave the addressable set FIRST** (Master at
   17, FX 1 at 18; position 0 never moved). The window is anchored, but a flat
   bank orders regular tracks → FX returns → Master, and every new track is
   inserted *before* that tail, so the tail is what crosses the ceiling.
   ⇒ **Every audibility oracle in E16 reads the master or an FX return**, so
   approaching the ceiling costs the measuring instrument before it costs any
   ordinary track — and §4.8's un-forkable returns are the first to vanish.
   The failure is `found:false`, byte-identical to a deleted track.
2. ⚠ **A `track.create` past the window mints a track we cannot name.** It never
   appears in `track.list`, so `receipt.minted` has nothing to report and the
   track is unaddressable and un-cleanable. **Under this model a fork IS a
   `track.create`, so a fork at the ceiling is an ORPHAN** — audible, ~0.6 pp CPU,
   invisible to us. ⇒ **Standing rule 5 must refuse BEFORE the create**; as
   framed ("detect and fail loud") it is post-hoc, and post-hoc is too late here.

⇒ **Proposed amendment to standing rule 5 / D6-D7** (rule 10, yours): the
overflow check becomes a **precondition on every fork**, and the budget is
`bankSize − (project tracks + FX returns + master + lineage groups)`. The bank
size is config (`~/.ghostnote/rig.json`; D7 ships 256), so the ceiling is tunable
— what is not tunable is that every fork and every lineage group consumes a slot.

### 3.4c ● — bursting is cheaper, not worse

Three spaced duplications 143/96/119 ms; three back-to-back 99/73/71 ms ⇒
**0.61×**. An N-track turn need not pace its forks for cost reasons.
⚠ **Wall-clock only.** The transport is stopped by refusal, so this says nothing
about whether an N-fork burst glitches once or N times — that is the question a
musician would ask, and it is still owed.

### 3.4i ● — the pool, not the window, bounds concurrent addressing

3/3 concurrent pins; cursor `3` on a pool of 3 **throws** rather than aliasing.
A lineage wider than the pool addresses its forks in sequence, re-pointing
between them — which D6 already requires after any structural op.

### 3.4j ● — the naming scheme is viable

`B· Bass different-line` round-trips **exactly, compared by codepoint** (U+00B7
in, U+00B7 out). All 10 non-ASCII cases exact, including CJK and an astral-plane
emoji; a 96-character name is not truncated; leading/trailing spaces survive.

⚠ **One incidental worth carrying:** an **empty** name reads back as `"Inst 8"` —
Bitwig substitutes a display default, so **a track is never nameless**. Two
consequences: "untagged" cannot be detected as "empty", and since the default
appears to be derived from creation order, an untagged track's name may be
positional data rather than stored data. The scheme tags every lineage member
(§1b), so this does not bite it — but the reaping guard's "refuse to delete an
untagged track" must test for the **absence of a tag**, never for an empty name.

### 3.4k ● — nothing to probe; a proposal instead

The letter is assigned by ghostnote, so this is policy and the API has no
opinion. **Proposal (rule 10, yours): refuse loudly at `Z·`** rather than
wrapping to `AA·`. Two reasons beyond taste: a two-character tag breaks the
"typing `B` is a faster gesture than reading a gist" property §1b chose the
scheme for; and 3.4a now shows a lineage that large is a bank-window problem
that a naming scheme should not quietly accommodate — it would have pushed the
Master out long before.

### 3.4b ● — lineage-level A/B is real, in the wet path too

Full record: `FINDINGS.md` → **E16m**. Probe `e16m-groupmute.ts`.

| | |
|---|---|
| M1 group mute silences children | ● master **56 → 2**, floor 1 |
| M2 cuts the child's POST send | ● FX **39 → 1** |
| M2 cuts the child's PRE send | ● FX **51 → 1** |
| ear, vs placebo | ● 5/5 vs 0/1, no clicks |

**M2 is the result that did not have to go this way** and it is the one that
matters for the model: a child's send is tapped on the child and routed straight
to the return, so a parent's mute could have sat downstream of it — leaving a
lineage silent in the mix, shown as muted, and still feeding the reverb bus.
It does not. ⇒ **§4.1's A/B ● now extends from a leaf track to a whole lineage**,
and the model's coarse gesture is available at the granularity the model
actually uses.

⚠ **Three consequences for the design, none of them cosmetic:**

1. ⚠ **Nothing may infer lineage state from its children.** A child's own mute
   flag is unchanged by its parent's mute (0/3), and the VU tap is pre-mute and
   upstream of the parent entirely. So **neither the flag nor the meter of a
   child reports whether its lineage is audible.** §4.1 already said mute is
   overloaded for a leaf; at the lineage level the children do not even carry the
   state. Anything wanting a readable "which branch is live" must read the
   GROUP's mute, and §4.4's selector idea gains a reason it did not have.
2. ⚠ **The mute is not quantised, and the user wants it to be** — *"It would be
   better if it were aligned to beat or measure boundaries."* This **answers a
   question E1 left open in the unwanted direction** (E1: *"unsure about
   quantized to the beat as I didn't think to listen to that"*). The gesture is
   usable but not musical. Nothing in the model proposes to fix it and it is not
   obviously fixable — `branch.setMixer` drives the mixer's own mute, which lands
   immediately. ⚠ **New open question:** does Bitwig offer a quantised mute at
   all, and if not, is a ghostnote-side "apply on the next bar" worth it? That is
   a UI-timing behaviour, and D14 said the deliberate verbs live in the pane —
   this one is a *performance* verb and would want somewhere else.
3. **The placebo arm was one trial** (coin flip: 5 real / 1 placebo). The row
   rests on the meter, not the ear; but future audible rows should force the arm
   balance rather than trusting a coin.
