---
title: ghostnote mini-spike — E16 task 2: the track-native branching model,
       examined use case by use case
status: ⚠ SUPERSEDED IN PART — the MODEL IS NOW CHOSEN (user, 2026-07-29), so
        this document's comparative framing is history. §4's ledger still holds
        except where the 2026-07-29 revisions below change it. Live handoff:
        HANDOFF-E16-TRACK-NATIVE.md. Still nothing in DECISIONS.md (rule 10).
updated: 2026-07-29
parent: SPIKE-E16-BRANCHES-AS-TRACKS.md
evidence: spike/FINDINGS.md — "E16 rows A–C", "E16 rows D–G", "E16j", "E16k"
        · DECISIONS D5, D8, D13, D14, D16, D17 · INITIAL_PROMPT §8a–§8g
supersedes framing of: HANDOFF-E16-SIBLINGS.md task 2 ("the sibling-track
        simplification") — the user has restated the proposal more broadly, and
        groups are no longer unavailable
---

# The track-native branching model

> ⚠ **This is an analysis, not a proposal and not a decision.** It enumerates
> what the planned branch/take system was for, and what happens to each part
> under the model. Where it degrades, it says what specifically is lost. §8's
> nine decisions and everything here remain the user's (standing rule 10).

## ⚠ Revisions after review (2026-07-29)

**The model was chosen.** Five things below are now out of date; the rest stands.

1. **UC8 (project-wide time travel) and UC11 (durable cross-session labels) are
   CUT.** No comprehensive project-wide or durable history. UC7 and UC9 are
   useful but non-essential. This orphans §4.5, §4.10, §4.13 and most of §4.14.
2. ⚠ **§3b is MOOT, not solved.** "Per-track heads do not compose" was called the
   deepest design problem; only UC8 asked for it. Cut, and it is gone.
3. **The system is now STATELESS.** §4.8's stash survives only for unforked
   writes, non-track-scoped changes, and as the clip fingerprint. Everything in
   D17 except the read/write split is retired — see the handoff §2.
4. **Fuzzy structural matching is CUT.** `channelId` survives rename, move, group
   and ungroup (E16k K1/K3), so it was never needed. Clips are positional, guarded
   by content fingerprint, with a tolerant fallback: happy path → re-locate a moved
   clip by fingerprint → recreate if gone. **E16l settles that no other identifier
   exists** — 1968 members, three passes.
5. ⚠ **§4.2's and §4.18's "conditional on someone having branched first" is
   sharper than written**, and the cadence that resolves it is now an OPEN
   QUESTION — see handoff §3.3. Fork-per-change and "deliberate and coarse" were
   both agreed at different moments and cannot both hold.

**Also corrected:** UC5 and UC6 were labelled "unrevertable" in the first artifact.
They are unrevertable under the *store*, not in principle — fork-then-delete makes
both exact. ⚠ UC6 still rests on **B3 ◐**: a fork carries modulator *pages* and
their *liveness* has never been proven.

---

## 1. The model, as stated

In the user's words:

> Use tracks as the primary basis for branching, building only the minimal state
> tracking machinery ourselves. […] Consider a theoretical model where we use
> tracks for every part of change tracking we possibly can, working in a mostly
> stateless way and trying to depend on the project state as the source of truth,
> and intentionally allowing the user to manipulate the tracks themselves too.
> Collapsing to a certain take would often be as simple as delete all but one in
> a group and ungroup. Taking 'some of this', 'some of that' could be a realtime
> decision made on the current snapshot state.

⚠ **This is a stronger claim than the predecessor handoff's "sibling tracks".**
That framing asked whether plain siblings could replace the branch system. This
one asks whether **the project document itself is the take log** — with groups as
lineage containers, `channelId` as the take id, mute as the A/B gesture, and
deletion as revert.

### Four scoping answers given by the user (2026-07-27)

These bound the analysis and several of them decide questions this document
would otherwise have had to fork on.

| # | question | answer |
|---|---|---|
| 1 | within-track granularity | **investigate live clip diff + merge** at the point of call, combining onto the survivor — see §5 |
| 2 | branch cadence | **deliberate and coarse.** Ordinary batches direct-write; branching is an occasional act |
| 3 | where metadata lives | **in the project, via `getDocumentState()`** |
| 4 | dormancy signal | **mute means both, by default** — deactivation unloads plugin state and would carry a switching cost. ⚠ Eventually: *"internal exclusive solo among a group"*, probably a selector device plus routing, and that selector would be the state signal |

⚠ **Answer 2 settles §3a by itself.** "Deliberate and coarse" means most batches
are *not* branched, so the stash has to revert them. The system gets a track layer
**above** the engine, not instead of it. That is the same conclusion §3a reached,
now reached by the user's own choice of cadence rather than by argument.

---

## 2. What is now measured (and what changed since the handoff was written)

The handoff was written believing group creation was impossible. It is not.

| fact | evidence |
|---|---|
| named actions fire **backgrounded**, incl. minimised to the Dock | E16j, 5 runs |
| `Create Group Track` makes an **empty** group | E16j |
| `Group` **wraps the current selection** | E16j |
| ⚠ a wrapped child **keeps its `channelId`** | **E16k K1** |
| a duplicate of a group child lands **inside** the group | **E16k K2**, and E3 |
| ⚠ **delete-all-but-one → `Ungroup`** works; survivor returns to top level, `channelId` **intact**, in ~243 ms | **E16k K3** |
| groups **nest** — real tree depth | **E16k K4** |
| mute cuts **sends**, pre- and post-fader | E2 |
| mute A/B is click-free and reads as "instant" | E1 |
| a copy inherits `mute=true` — "born muted" exists | E5 route B |
| delete is one undo entry and frees the CPU | G1/D1 |

⚠ **K2 is more constraining than it looks.** `copyTracks` **and** `moveTracks` are
both silent no-ops, so a track cannot be moved into a group after the fact. The
**only** known route to a populated lineage is **group the original first, then
duplicate** — construction order is forced, and there is no gathering, tidying or
re-parenting afterwards.

### Still unmeasured, and load-bearing

- ⚠ **D4 — bank-window headroom under `ALL_CHANNELS`.** The single highest-value
  gap. Under this model the bank window *is* the history budget.
- ⚠ **Does muting a GROUP silence its children?** The ergonomic claim the model
  leans on hardest. Not answerable without ears: trap 7 says the VU tap is
  pre-mute, so the oracle is the master bus with the transport rolling.
- The switching cost of `isActivated(false)` (user's report, not our measurement).
- `getDocumentState()` capacity for a JSON payload.
- Whether anything can drive a child track's mute from a parameter (§4.4's
  selector idea).

---

## 3. How to read the ledger

**survives** — the use case works, with no more machinery than today.
**degrades** — it still exists but something specific is lost; the loss is named.
**transforms** — it survives by becoming a materially different mechanism, with
its own new failure modes.
**falls out** — it stops existing. Some of these are *good*.

---

## 4. The ledger

### 4.1 A/B comparison — **survives, and improves** ●

D5 calls this the core verb. Mute toggle in Bitwig's own mixer: click-free, and
the user reported *"Yes, usable"* and *"instant"* (E1). Mute cuts sends in both
fader modes, so the wet path is correct too (E2) — the objection most likely to
kill the ergonomics does not hold.

**What it costs:** mute is now overloaded (answer 4 accepts this). A track the
human muted for ordinary mixing reasons is indistinguishable from a dormant
branch, so **nothing may infer branch state from mute**. §4.4 is the eventual fix.

### 4.2 Full revert of a batch — **survives, at two granularities** ●

- **Branched work:** delete the sibling. ⚠ **Exact regardless of what happened
  inside it** — §2 calls this the strongest argument for the whole idea and it is
  stronger than the A/B argument. One undo entry, CPU freed (G1/D1).
- **Unbranched work:** unchanged — the stash reverts it (D16).

⚠ Because the cadence is coarse (answer 2), **most batches take the second path.**
The revert-fidelity ceiling closes exactly where someone thought to branch
beforehand, and stays exactly where it is everywhere else. That is a real
qualification on §2's headline argument and it should not be quietly dropped.

### 4.3 Partial revert sliced by musical address — **transforms** ◐

The sharpest edge in the whole model, and §5 is devoted to it. Track-level
branching yields **one winner per track**. D5's own motivating example — *"that
take had a better hi-hat"* — is a choice *within* the drum track, which D17d
already implements by slicing the stash on `addressKey`.

Answer 1 replaces stash-slicing with **live clip diff + merge**: read both
siblings' clips at the point of call, diff, let the human choose, write the
combination onto the survivor. Analysed in §5. It is not a smaller mechanism than
D17d — it is a different one, with one genuine capability *gain* and two
inherited losses.

### 4.4 Branch navigation and abandoned branches — **survives natively** ●

D5: "reverting to an earlier take and proceeding does not destroy the branch left
behind." Under this model the abandoned branch is *a track that is still there*.
Better than the store version in one specific way: it is **audible**, not a JSON
file you have to ask about.

⚠ **Navigation is not recorded**, which is the point of §4.9.

**Future (answer 4):** exclusive-mute among a group's children — *"switching to B
silences A and C"*. Note this is **not** Bitwig's solo, which is project-global.
The user's sketch is a selector device on the group whose parameter value is the
state signal, with mutes derived from it. That would give a **single readable
"which branch is live"** instead of inferring from N mute flags, and it would be a
knob the human can turn. ⚠ Entirely unmeasured: `chainselector.*` exists on the
wire (E4c) but selectors live *inside a device chain*, not across tracks, and
whether any parameter can drive a sibling track's mute is unknown.

### 4.5 "The project state at take N" — **falls out, by design** ○

§3b called this the deepest design problem and predicted it would eat a week. The
model resolves it by **refusing the abstraction**: per-track lineages do not
compose into a project-wide state and are not asked to.

**What is lost:** you cannot ask "put the whole project back to how it was at
14:32". You can only ask per lineage. ⚠ **D17b and D17c must be amended**, and
D17 already flags both as PROVISIONAL for exactly this reason.

### 4.6 Before/after diff — **transforms, and loses its shelf life** ◐

- **Coarse:** free. Two tracks side by side, drawn by Bitwig (§2).
- **Fine:** becomes a *live* computation over two clips (§5) rather than a walk
  over stored takes with the arms swapped (D17b).

⚠ **What is specifically lost: the diff is only available while both siblings
exist.** The store's diff is available for the whole retention depth. A track diff
dies the moment someone tidies up — and tidying is the model's own collapse
operation. **You cannot ask "what did that change?" about a decision you already
committed.**

### 4.7 Fidelity labelling — **survives, relocated** ●

D5's "a revert never silently under-delivers" and D8/D16's labels still apply to
unbranched writes, unchanged. For the branch layer, revert-by-delete is trivially
exact. ⚠ But **the merge path needs its own labels** (§5.3) — so the machinery
does not shrink, it moves.

### 4.8 The stash — **survives** ●

§3a's argument stands and answer 2 confirms it. Needed for: every unbranched
batch, within-track work, and ⚠ **everything that is not track-scoped at all** —
tempo, time signature, scene create/delete, master and FX-return changes,
cross-track routing. None of those has a track-native branch representation.

⚠ A consequence worth stating plainly: **an FX-return change affects every sibling
identically**, so A/B-by-mute cannot audition it. Branching a track does not
isolate a reverb edit.

### 4.9 Navigation-does-not-append (D17c) — **falls out, and that is good** ●

D17c names "the single sharpest correctness trap in the session": recording a
navigation as a take means the next jump undoes the undo, compounding and silent.
It ends by demanding that *"whatever replaces it must answer the same question."*

**This model answers it by making navigation unrecorded.** Switching branches is
mute state — present-tense project state, not a step in a log. There is no step to
reverse. ⚠ D17c's `lands: take | new-state` distinction becomes unnecessary *for
the branch layer*; it is still needed for partial reverts, which do author change.

### 4.10 Persistence and the project key — **survives, simplified** ●

Branch structure persists because it *is* the project (saved atomically with the
music). D17a's key survives for whatever store remains.

### 4.11 The pointer disagreement (D17e) — **dissolves** ●

D17e exists because take contents live in the daemon's store while the active
pointer lives in the project, and they can disagree. Answer 3 puts the branch
metadata **in the project**, so for the branch layer **there is only one copy** and
the failure mode is gone. D17e's rule ("the project wins") was already the right
one; the model makes it vacuous rather than wrong.

⚠ Unmeasured: `getDocumentState()` capacity for a JSON payload. E14 proved String
settings work and survive save + restart, scoped per project — not how big they
may be.

### 4.12 The privilege split (D17g / §8g / rule 8) — **survives, strengthened** ●

Revert becomes *"the human deletes a track in their own mixer"* — needing no
ghostnote API at all. That is more structural than a type split, not less.

⚠ **One asymmetry to keep honest:** the agent *can* delete tracks through the
typed API. So "the agent may never reap" remains **policy on our side**, exactly as
§8.6 says, and is not enforced by Bitwig the way `Signal.fire()` enforces the
revert button (E14-A1).

### 4.13 Take labels — **transforms into track names** ◐

`setName` works. ⚠ **A4: a copy carries the SAME NAME**, so with no disambiguation
N siblings are N identically-named tracks. Renaming stops being a nicety (§8.7)
and becomes a **correctness requirement** — the human cannot otherwise tell which
one to delete.

**What is lost:** labels are now human-editable by design, so they can never be
keys. `channelId` remains the only durable identity (E2f/D6), now confirmed to
survive both grouping and ungrouping (E16k K1/K3).

### 4.14 The change log and explainability — ⚠ **degrades, hardest** ◐

Rule 8: *the agent may read the take log and explain it.* **The project holds
state, not history.** Tracks carry no timestamps, no provenance, and no order we
control — `moveTracks` is a silent no-op, so sibling order is whatever creation
order produced.

From project state alone, **"what did you change, when, and in what order?" is
unanswerable.** This is precisely why answer 3's metadata cannot be zero: a purely
convention-based model (group structure + names) is self-describing about
*shape* and silent about *history*.

### 4.15 Verify and disagreement reporting — **survives untouched** ●

§2 is explicit: writing into a duplicated track uses **exactly the same write
path**. Every E2/E3/E8/E15 guard is still load-bearing. **The fidelity of undo
improves; the fidelity of writing does not improve at all.**

### 4.16 Retention — **transforms, and mostly becomes the human's job** ◐

Pruning a take is currently deleting a JSON file. Pruning a *branch* deletes
audible material and frees CPU (§6.6), so it is a user-visible act and rule 8
says the human does it.

⚠ **One protection inverts, and it is a new hazard.** D17f protects parents by
refusing to prune a take with children. Bitwig does the opposite: **deleting a
group CASCADES to its children** (E3). So the single most natural tidying
gesture — select the lineage container, delete — destroys the entire lineage in
one act, including the winner. Under the store, that shape of mistake was
impossible.

⚠ **Depth-200 is replaced by the bank window**, which is unmeasured (D4).
Standing rule 5's loud refusal is the right shape for hitting it.

### 4.17 Cross-branch application / the identity map — **falls out** ●

§2 listed this under "it makes one thing worse": branch-scoped addresses would
need a track-identity map across branches, *"a side table of the kind D16a
explicitly rejected."*

**The reframe retires it.** The model never applies take X's change to branch Y —
it *picks winners*. There is nothing to map. This is a genuine simplification and
§2's only "makes it worse" entry does not survive the restatement.

### 4.18 The revert-fidelity ceiling — **closes, conditionally** ◐

§2's strongest argument. `device.insert`, `track.create`, `scene.create` are
`unrevertable` and `clip.delete` is `none` (D16d) — the object classes of Phases 4
and 5. Revert-by-delete is exact for all of them.

⚠ **Conditional on someone having branched first** (§4.2). With a coarse cadence,
the ceiling closes for deliberate exploration and remains exactly where it is for
everything else.

### 4.19 Undo as load-bearing infrastructure (§8a) — **improves** ●

Branch-on-duplicate is not mutation-free but it is **original-preserving**: a
batch that goes wrong damages a copy. Undo stops being the only safety net — for
branched work.

---

## 5. ⚠ The live clip diff + merge (answer 1), examined

The one genuinely new mechanism in the restatement, and it deserves scrutiny
rather than optimism.

**The proposal:** A and B are siblings with similar clips in the same scene,
sharing most notes but differing on (say) hats and snare. At the point of call,
read both, diff them, let the human take some from each, write the combination
onto the survivor.

### 5.1 It is a merge, and there is a tripwire — but it fires for the wrong reason

PHASE-1 §Risks: *"if a merge operation appears in the design, something has gone
wrong"*, and D17b confirms the store has "no merge, no conflict resolution and no
three-way anything."

⚠ **This is a merge and the tripwire should be acknowledged, not argued away.**
But the reason the tripwire exists does not apply here. D17d refused time/pitch
slicing because restoring a sub-range *"would need a merge of stashed and live
notes"* — the hazard is a **stale side**. Here **both sides are live and read at
the same instant.** There is no stash to be stale. That is a material difference,
and it is the only thing that makes this idea admissible at all.

### 5.2 ⚠ It is only safe as a whole-clip rewrite

E8-E: a `note.write` truncates same-pitch neighbours **outside its own extent**.
So writing a merged subset *into* an existing clip would silently damage notes
nobody selected.

**The merge must therefore be materialised as: read whole clip channel → compute
union → clear → write all.** D16e already established the whole clip channel as
the right granularity, for exactly this reason, and `cursor.getNotes` /
`clearNotes` / `setNotes` are the primitives. ⚠ **Any implementation that writes
only the changed notes is wrong**, and wrong silently.

### 5.3 It inherits the property-level fidelity ceiling — it does not escape it

⚠ The merge is a *write*, so D16b and D16c apply unchanged:

- **`gain`** reads back 2× written (E2) and is withheld, never corrected (D16b).
- **`pressure`** cannot be written at all (E15-E) and is stripped (D16c).

So **merging two clips loses human-authored pressure and gain on the merged
result**, exactly as a revert does. Reported rather than silent, per D5 — but this
is a lossy operation on expression the *human* may have authored, which is a
sharper case than losing the agent's own. The merge path needs the same labels the
revert path has (§4.7).

### 5.4 ⚠ It GAINS a capability the store refused

D17d refuses time and pitch slicing outright, *"not deferred, refused"*, because
sub-range restoration would need a merge of stashed and live notes.

Under live merge, **"take the hats from A"** is a pitch-keyed selection over a
live read, materialised as a whole-clip rewrite — so the reason for the refusal
does not apply. **Pitch-keyed and time-keyed selection become available here
precisely where they were refused there.** This is the model's most interesting
single consequence and it is easy to miss: the mechanism the user proposed to
*replace* partial revert is strictly more expressive than partial revert, in the
dimension D17d had to give up.

### 5.5 What it needs that mute does not: a UI

You can pick a whole branch from the mixer. You cannot pick *"hats from A, snare
from B"* from the mixer.

⚠ So the model's headline ergonomic win — **A/B needs no ghostnote UI at all**,
which is what would amend D14 — **holds only at the coarse level.** Within-track
merge re-introduces a real visual surface, i.e. the Phase-3 web view. The honest
summary is: **coarse A/B retires the UI dependency; fine merge does not.**

### 5.6 Where it stops

Opaque plugin state is a blob. It duplicates faithfully (B2 ●) but cannot be
diffed or merged. **Device and modulator differences are all-or-nothing per
track** — you take A's Zebra patch or B's, never a combination. Notes and scalar
params are the merge's domain; everything else is whole-track.

---

## 6. What the model introduces that the store never had

Ranked by how likely each is to bite.

1. ⚠ **The bank window becomes the history budget** (D4, unmeasured). Every
   sibling costs a slot; `ALL_CHANNELS` is mandatory (below), which costs more.
2. ⚠ **`ALL_CHANNELS` is no longer optional.** A collapsed group's children leave
   the bank and `resolveByChannelId` returns `found:false` — byte-identical to a
   deleted track (trap 12). The model uses groups heavily and folding is the
   natural tidying gesture, so the runtime `setContentFilter(ALL_CHANNELS)` fix
   becomes load-bearing rather than a nicety.
3. ⚠ **Deleting a group cascades** (§4.16). The most natural tidying gesture
   destroys the whole lineage, including the winner.
4. **Every branch point glitches the audio** (C5, 5/5 vs 0/3 placebo). Bounded by
   answer 2's coarse cadence, but it means a branch point is never free and can
   never be automatic.
5. **Construction order is forced** (K2). Group first, then duplicate. No
   gathering, no re-parenting, no ordering — `moveTracks` is a no-op.
6. **Mute is overloaded** (§4.1), until the selector idea (§4.4) exists.
7. **The project becomes shared mutable state** (§6.3). This is *intended* here —
   the user wants the human manipulating tracks — but it means our bookkeeping is
   destroyable by accident and F3's detection problem is real.
8. **Identically-named siblings** (A4) make renaming a correctness requirement.

---

## 7. What is owed before this could be designed

Measurement, in value order:

1. ⚠ **D4 — bank-window headroom under `ALL_CHANNELS`.** Turns the branch budget
   from a policy guess into a number. It is now the history budget, so it bounds
   the whole model.
2. ⚠ **Does muting a group silence its children?** Needs ears and a rolling
   transport. The lineage-level A/B claim rests entirely on it.
3. **A live clip diff + merge round trip** on a realistic two-sibling fixture —
   read/clear/rewrite cost, and confirmation that §5.2's whole-clip rewrite is
   clean.
4. **`getDocumentState()` capacity** for a JSON payload (answer 3 depends on it).
5. **`isActivated(false)` switching cost** — the user's stated reason for
   preferring mute; currently their report, not a measurement.
6. **Whether any parameter can drive a sibling track's mute** (§4.4's selector).
7. **G3 — promoting a branch to trunk without a rebuild.** Partly answered by
   K3: delete-all-but-one plus `Ungroup` leaves the survivor at top level with its
   identity intact, which *is* promotion, provided the lineage was grouped.

---

## 8. Summary

| | count | |
|---|---|---|
| **survives** | 9 | A/B ●, full revert ●, abandoned branches ●, fidelity labels ●, the stash ●, persistence ●, privilege split ●, verify/report ●, §8a undo ● |
| **transforms** | 5 | partial revert ◐, diff ◐, labels ◐, retention ◐, revert-fidelity ceiling ◐ |
| **falls out** | 4 | "project state at take N" ○, D17c's navigation trap ○ *(good)*, cross-branch identity map ○ *(good)*, change-log history ◐→ needs answer 3's metadata |

**The two things the model genuinely retires** are both problems the existing
design was carrying: §3b's "per-track heads do not compose" (refused rather than
solved) and §2's cross-branch identity map (never needed). Both were listed as
costs of the *sibling* proposal; the restatement removes them.

**The two things it genuinely costs** are the shelf life of the diff (§4.6 — you
cannot ask what changed about a decision already committed) and history/provenance
(§4.14 — which is why the metadata cannot be zero).

⚠ **And the one thing to keep visible above all:** answer 2's coarse cadence means
**the engine and the store both stay**. This is a layer, and the system gets
bigger, not smaller. §3a said so before any of it was measured; the user's own
cadence choice now says so independently.
