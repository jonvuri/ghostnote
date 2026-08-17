---
id: D17
kind: decision
state: active
source: DECISIONS.md
---

# D17 — The take store: persistence, branching, partial revert **[SETTLED 2026-07-26, PHASE-1 session 2 — ⚠ §b and §c PROVISIONAL, see below]**

**A take is a session-1 `Take` plus three facts it cannot know about itself —
project key, parent, label — kept one-file-per-take under `~/.ghostnote/`.
Navigation is a walk of the path between two nodes, materialised through
session 1's `revertOps`; the read half of the API is a separate object from the
mutate half.** Built offline as `brain/src/store/`, 26 tests.

> ⚠ **§b and §c are PROVISIONAL as of 2026-07-26, the day they were written.** A
> proposal to represent branches as **duplicated tracks** —
> [SPIKE-E16](../archive/spike/SPIKE-E16-BRANCHES-AS-TRACKS.md) — would replace the single
> project-wide head these two sections are built on with a head per branch lineage,
> and would make revert-by-deleting-a-track exact for the whole `none`-fidelity
> class that §D16d has to report on instead. **It is entirely unmeasured**: it rests
> on whether a top-level `Track` can be duplicated at all, which nobody has probed
> (standing rule 10). Recorded here rather than in the sections themselves because
> the rest of D17 is unaffected either way — **§a, §d, §e, §f and §g stand
> regardless**, and §e's argument gets *stronger* under the proposal, since a
> project that literally contains its branches is more authoritative about the world,
> not less.

> ⚠ **REVISED 2026-08-07 (E16-TRACK-NATIVE, E16-REPLAN §2, D18). The take STORE is
> RETIRED — the system is stateless and the PROJECT is the take log.** Per
> sub-decision:
>
> - **§b, §c SUPERSEDED** (provisional the day they were written, and the warning
>   above resolved against them). There is no head, no path walk, no project-wide
>   "state at take N": takes are real structures in the project — track forks,
>   layer chains, clip blocks (D18a) — and navigation is *switching* between them
>   (mute / solo / launch), not materialised revert. ⚠ §c's trap keeps its force
>   in the new form: **a navigation is a SWITCH, never an edit** — nothing may
>   record it as a step the next navigation then reverses.
> - **§a, §f RETIRED with the store** — no project key, no on-disk log, no
>   retention. Reaping was already the human's decision regardless (D20).
> - **§d SURVIVES, repurposed**: `slice.ts` stays — partial revert by address over
>   the **stash** (D5's *"that take had a better hi-hat"* is within-track), with
>   time/pitch slicing still REFUSED for E8-E's merge reason, which no
>   authorization moves (D20).
> - **§e's principle outlives its object**: the project document is authoritative
>   about the world — now trivially, since the project *is* the log.
> - **§g REAFFIRMED and generalised** (D20): the privilege boundary is a
>   structural seam, not a remembered rule — now at the MCP tool surface (D12
>   amendment) rather than around a store object.
> - ⚠ **The STASH survives the store and is load-bearing THREE ways** — unbranched
>   writes (D16), the clip content fingerprint guarding positional addressing, and
>   agent-edit reversal (D19). **Do not delete it with the store.**

> ⚠ **REVISED AGAIN 2026-08-14 (E22, D18 rev).** Replace “track forks, layer
> chains, clip blocks” above with **layer chains and clip blocks**. They are the
> only managed take structures. A device alternate and a clip alternate created
> in one instruction are independent events, even on the same track; correlation
> does not create a project-wide head or compound take. Track duplication remains
> ordinary recorded CRUD and is not part of take navigation. The project-is-log,
> switch-not-edit, stash, and privilege conclusions otherwise stand.

⚠ This session's exit criteria carry unusual weight, and it is worth restating
why: D14 moved take navigation to Phase 3, so **Phase 1 ships a branchable take
store whose motivating verb no human exercises inside the phase**. The tests are
the only thing between a wrong store design and a phase-late discovery, so they
drive real ops through the executor against the fake rather than asserting on the
store's own bookkeeping.

### a. The project key — **a UUID minted into `getDocumentState()`**

E14-A3/A4 already proved the storage: document state survives save + a **full
Bitwig restart** and is scoped **per project**. The key is minted on first write
and reused thereafter.

⚠ **Rejected: a path hash.** Humans rename and move project files constantly, and
each such move would silently orphan the entire take log — the failure would look
exactly like "ghostnote forgot everything", with no signal saying why.

Two consequences stated rather than discovered:
- **The setting is pre-allocated at `init()`**, because settings cannot be created
  later (E14-C2, and D7's amended rule now makes that the default assumption for
  anything Bitwig hands out).
- **An unsaved project still gets a key**, because document state exists in memory
  from the moment it is set — only *persistence* waits for a save. If the human
  then discards the project the log is orphaned and reaped by ordinary retention.
  It is deliberately not specially detected: the only available signal is "this
  key never came back", which is indistinguishable from a project that is merely
  closed.

The key SOURCE is a port (`ProjectKeySource`), because this session is offline by
construction and the real implementation is a bridge call the daemon owns
(session 3). That is also what lets every minting and reconciliation rule be
tested in milliseconds.

⚠ **An unsafe key is REFUSED, never sanitized** — it names a directory, and a
munged key could collide with another project and merge two humans' take logs.
Same class of silent aliasing D6 outlaws for tracks.

### b. ⚠ Branching — **a path walk, not "restore the target take's write-set"** *(PROVISIONAL — E16)*

The cheap version is wrong the moment two takes touch different things, which is
the normal case: with the head at T2 (wrote bass), jumping to T1 (wrote hats)
would leave T2's bass in place and call it "the state at T1". The walk costs about
thirty lines and is actually true:

- takes between the head and the common ancestor are **unwound**, and the value
  that wins for an address is the **oldest stash** on that arm;
- takes from the common ancestor to the target are **replayed**, and the value
  that wins is the **newest verify**;
- the replay arm overrides the unwind arm, because the target's own history is
  authoritative about the target's state.

Those three sentences are the entire branching model. The output is a
`RevertInput`, so session 1's `revertOps` materialises the ops and a jump, a
revert and a partial revert are **one code path** that cannot disagree about what
restoring an address means. **There is no merge, no conflict resolution and no
three-way anything** — the §Risks tripwire ("if a merge operation appears in the
design, something has gone wrong") is intact.

The same walk run with its arms swapped produces the **diff** Phase 3 renders.
§8f's "one mechanism, two features", a second time.

⚠ **What E16 would change, and what it would not.** The walk itself is likely to
survive: `stateAlong` operates over addresses, so partitioning takes per track
makes the graph a *forest* and the same walk runs over each disconnected
component. What changes is that "the project state at take N" stops existing —
there would be a head per lineage rather than one head. That is a change to the
abstraction, not obviously to the algorithm, and confirming it is cheap.

### c. ⚠ Navigation moves the HEAD; it does not append a take *(PROVISIONAL — E16)*

The single sharpest correctness trap in the session, and it is not obvious.
Session 1 established that "a revert IS a take" — true at the executor level,
which has no store to consult. But recording a navigation as a take would put a
step in the log whose only content is the undoing of another step, and **the next
jump would undo the undo**, re-applying the very change the human just walked away
from. Compounding, and silent.

So the store labels every plan:

| `plan.lands` | when | what the caller does |
|---|---|---|
| `take` | the world ends up exactly on an existing take | **move the head** |
| `new-state` | every partial revert, and any undo of a take that is not the head | **append it** |

A partial revert genuinely is authored change — the human chose to keep the hats
and drop the snare — and the state it produces is not any node in the graph, so it
has to become one. Deciding which case it is happens in the store, where the graph
is; the executor stays ignorant of both.

⚠ **This is the sub-decision most at risk from E16**, and the trap it names is
the reason to say so out loud rather than let it lapse quietly. If branches are
materialised as tracks, "navigation moves the head" becomes "navigation re-mutes"
— a different act, with different failure modes, and one that does not obviously
inherit this section's protection against undoing an undo. **Whatever replaces it
must answer the same question**: what stops a navigation from being recorded as a
step that the next navigation then reverses?

### d. Partial-revert granularity — **`addressKey`, and time/pitch ranges REFUSED**

Cheapest useful answer, per PHASE-1 §Risks naming over-modelling here as the
phase's top design risk. A `Slice` is `{keys?, prefixes?}` — plain data, because
Phase 3's UI has to send one over the daemon's API and a predicate cannot cross a
wire — and `selectClip`/`selectTrack` build one from a take's own write-set using
the existing `addressTrack`/`addressScene` accessors rather than by parsing the
key grammar.

⚠ **Time and pitch slicing are not deferred, they are refused, and for a reason
stronger than scope.** A `note.write` truncates same-pitch neighbours OUTSIDE its
own extent (E8-E), so "restore beats 4-8 of this clip" cannot be done by replaying
a sub-range of the stash — it would need a **merge** of stashed and live notes,
which is exactly the tripwire in (b). Note slicing is clip-wide because the host
clear affects all MIDI channels. `selectClip` includes all 16 channel addresses,
and an incomplete channel selection refuses (D16e, D21).

### e. ⚠ The pointer disagreement — **the PROJECT wins**

Take contents live in the daemon's store; the active take pointer lives in the
project document. They can disagree, and the important half of the design is
knowing which is right.

**The project document is authoritative about the WORLD, because the pointer and
the music are written by the same save.** If the human works up to take 20 and
closes without saving, what comes back off disk is the project as of the last
save — clips *and* pointer, atomically. The store's head would claim 20 while the
music is at 5. So on open the store **adopts** the project's pointer, and takes
6-20 remain reachable as an abandoned branch — the branching model doing its job
rather than a special case.

The one thing never guessed: a pointer naming a take this store has never seen
(pruned, or another machine). Nothing moves and nothing is claimed. PHASE-1 is
explicit that *"detection matters more than resolution here"*, and this is what
that resolves to concretely.

### f. Retention — **depth 200, and only CHILDLESS takes may go**

Depth rather than age: a session that writes 40 takes in an hour and one that
writes 40 over a month want the same log. Pruning removes only a take with no
children, so a branch is trimmed **from its tip inward** and no survivor ever
finds its parent missing — which is what "what happens to old branches" resolves
to. Three protections, each a thing a human would be upset to lose: the head
(where they are), a **labelled** take (they named it, so it is theirs), and any
take with children.

⚠ **Overshooting the depth beats deleting something protected.** When everything
left is protected the store simply stays over depth rather than picking a victim.

**Takes are named** (D5's "that take had a better hi-hat" implies a human can
label one), and the label doubles as the retention exemption.

### g. ⚠ The privilege split is a TYPE split with a real object behind it

§8g / standing rule 8: the agent may read and explain the log; it may never mutate
it. D14 notes the daemon must keep the agent off those endpoints — and a rule the
daemon has to *remember* is a rule that dies in one refactor. So `store.log`
returns a **frozen plain object** whose own properties are the read methods and
nothing else, `STORE_MUTATORS` names the other half with the reason for each, and
a test asserts no mutator name is reachable — the `WIRE_METHODS_BANNED` idiom
aimed at a privilege boundary instead of a wire.

⚠ **Not `this` narrowed by a cast**, which another cast undoes in a line and which
would pass a `hasOwnProperty` check while failing the `in`-operator one that
actually matters.

### Three things the build found

1. ⚠ **"No slice given" and "a slice that selects nothing" are different, and
   conflating them is data loss.** The first version asked whether the key lists
   were empty, which made `selectClip(take, aClipTheTakeNeverTouched)` — an empty
   `keys` array — indistinguishable from "revert the whole take". A human asking
   to revert one clip would have had the **entire take** reverted, silently,
   *precisely because their request matched nothing*. Presence of the field is now
   the test and emptiness is a refusal. Found by a test.
2. ⚠ **An address a take could not VERIFY must not be replayed forward.** E3's
   case leaves no entry in `verify`, and an absent notes entry means "no clip
   here" everywhere else in the codebase — so a forward jump would emit a
   `note.clear` against music we simply never saw. The store blocks those
   addresses and reports them, which is the same distinction session 1 drew with
   `ApplyReport.unverified` and the same reason it exists.
3. **Gain replay follows the property table in both directions.** E24 promoted
   gain to exact after an independent-handle inverse measurement. Forward and
   reverse replay both gained exact restoration without a take-store special
   case.

### A take's fidelity describes what it can RESTORE, not what it wrote

The label answers what a take can restore, not what it wrote. E24 makes gain exact
in both places. Pressure and structural loss still degrade the prior state when
the take cannot put them back.

---
