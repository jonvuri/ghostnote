---
title: ghostnote — E16 session 5, job 2: the re-plan onto the track-native model
status: ⚠ DONE 2026-08-07 — the second re-plan session discharged §5's untouched
        list under the HYBRID (D18–D20): PROJECT_PLAN §4/§5/§7 revised, PHASE-1
        re-planned (clip block in P1), PHASE-2 premises updated, PHASE-3 made
        OPTIONAL (operator), both E16 spike docs bannered, and DECISIONS.md
        authored with rule 10 lifted — §1's rules 5/6/7 accepted as restated
        (rule 7 struck with a tombstone; single-writer mitigation recorded
        unadopted), §4's two D16 amendments approved (plus the insertFileAt
        'replace' exception). Historical record below.
        ⚠⚠ §3 IS SUPERSEDED, 2026-08-06 — and its PREMISE changed, not just its
        answer. §3 scopes device-layer A/B to the MASTER and FX RETURNS ONLY, on
        the ground that a layer chain could be neither grown nor deleted. E18
        overturned both (`e18c` ●● ×4, `e18a` ●● nine cells), and the operator
        then chose a HYBRID: track fork, layer chain AND clip block all get
        built, with the agent choosing between them at "L3-open".
        ⇒ READ `HYBRID-AUTONOMY-LEVELS.md` §7 FIRST; this document's §1 rule-5
        restatement and §2 session dispositions still stand, §3 does not.
        ⚠ §5's list of untouched documents is what the next re-plan inherits.
        ⚠ ~~§3 IS NO LONGER CONTINGENT — E17 answered it (2026-08-01).~~
        DEVICE takes are TRACKS: a layer chain cannot be created beside a
        sibling and cannot be deleted (FINDINGS E17 rows 1-4). So §3 keeps its
        original scope as the answer for the MASTER and the FX RETURNS only, and
        §1's rule 5 does NOT change shape. ⚠ One amendment is owed to §3's
        mechanism choice: row 6 makes DeviceLayer.solo() container-scoped AND
        locally exclusive, which beats both the layer-mute and the chain-selector
        options the table weighs. See E17-VERDICT.md §4.
        ⚠ Nothing here goes into DECISIONS.md (standing rule 10) — this
        proposes, the user decides.
updated: 2026-07-31
parent: HANDOFF-E16-TRACK-NATIVE.md §4
predecessor: E16-OPEN-QUESTIONS.md (session 4 — §3.1/§3.2/§3.3/§3.4 a,b,c,i,j,k)
evidence: FINDINGS E16s, E16t, E16u, E16w, §3.4e · E16m, E16n/E16o, E16p/E16q,
        E16r · D4, D6, D7, D13, D14, D16, D17 · PROJECT_PLAN §4
---

# The re-plan

> ⚠ **The model is CHOSEN and is not re-litigated.** This says what changes
> underneath it now that the measurements are in.

**Four inputs the previous plan could only guess at are now settled**, and one
more arrived this session that nothing had asked for:

| input | settled by |
|---|---|
| the daemon decision — retire `ghostnoted` | user, §3.2; premise probed E16p |
| the floor's shape — a predicate over labelled fidelity, not a list | §3.3.5 |
| the branch budget — bank window, not disk | E16r + **E16u** |
| the naming scheme — the middle dot round-trips | E16q |
| ⚠ **a device-scoped A/B exists** | **E16w** — new, and it reaches what forks cannot |

---

## 1. Standing rules — 5, 6 and 7

### ⚠ Rule 5 — restated as a PRECONDITION, not a check

**Today:** *"Bank-window overflow is a checkpoint blind spot… Detect and **fail
loud**; never operate on a partially-visible project."*

**The problem is the word "detect".** E16r measured that a `track.create` past
the window mints a track that never appears in `track.list`, so `receipt.minted`
has nothing to report and the track is **unaddressable and un-cleanable**. Under
this model **a fork IS a `track.create`**, so a fork at the ceiling produces an
orphan: audible, ~0.6 pp of engine CPU, and invisible to us. A rule phrased as
*detect and fail* runs **after** the damage.

> **Proposed rule 5.** Bank-window overflow is a **precondition on every
> structural create**, checked before the call and refused loudly. The budget is
> `bankSize − (project tracks + FX returns + master + lineage groups)`, and
> `itemCount()` reporting the project total past the window is what makes it
> implementable (E15-A, re-confirmed E16r). ⚠ **Never a licence to reap.**

Three consequences worth carrying:

- ⚠ **The Master and the FX returns cross the ceiling FIRST** (E16r: Master at
  17, FX 1 at 18; position 0 never moved), because a flat bank orders regular
  tracks → FX returns → Master and every new track is inserted before that tail.
  **Every audibility oracle in E16 reads the master or an FX return**, so
  approaching the ceiling costs the measuring instrument before it costs any
  ordinary track. The failure is `found:false` — byte-identical to a deleted
  track (trap 12).
- **A four-track turn costs four lineage groups plus four forks**, because the UI
  selection can only be set to one track, so lineages are per-track by
  construction.
- ⚠ **The budget is the bank window and NOT disk.** E16u: 20,391 bytes per fork
  of the heavy fixture and **no perceptible change in save time** across 10 → 14
  tracks. A full `A·`–`Z·` lineage would add ~530 KB to a 404 KB project. So
  refusing at `Z·` (§3.4k) is right for bank-window and ergonomic reasons, and
  **must not be justified on disk grounds** — that argument is now measured false.

### Rule 6 — "No named actions. Ever." ⇒ keep the rule, **replace its reasoning**

E16j disproved the stated premise: named actions **do** fire backgrounded,
including minimised to the Dock, and `Create Group Track` / `Group` are how a
lineage container gets created at all. So the rule as written is factually
wrong — and the model **depends** on the thing the rule forbids.

> **Proposed rule 6.** Named actions are **not addressable surface**: they act on
> the **UI selection**, which our own addressing sets and which a human can move
> under us (E6 blocker 3, observed live again in E16j — seven orphan duplicates).
> They may be used only where the selection is established and verified in the
> same batch, and never where an addressed API call exists.
>
> ⚠ The **one** sanctioned use is lineage-group creation, because no API creates
> a group — and its construction order is forced: **group the original first,
> then duplicate** (E16k K2), since `moveTracks` and `copyTracks` are both silent
> no-ops and nothing can be gathered in afterwards.

**D13 needs the same treatment**: its verdict stands, its reasoning does not.

### Rule 7 — "All writes go through the daemon" ⇒ ⚠ **STRUCK, not reworded**

Its sole rationale was that a bypassing write leaves a silent gap in the take
log. **There is no take log.** E16p then removed the fallback argument: the
revision guard is atomic **across connections** (6/6 rounds, exactly one winner),
so retiring the daemon gives up no ordering guarantee.

> **Proposed:** rule 7 is struck. Its replacement is not a rule about topology
> but about coherence: ⚠ **ordered is not coherent.** A rejected batch must be
> re-planned against the new world by whoever sent it, and two chat sessions mean
> two MCP servers mean two writers. **Mitigation, if wanted: the extension
> refuses a second *writing* client** — a small change in `Bridge.java`, keeping
> the guarantee where the revision counter already is, and buying what option B's
> thin daemon would have bought for far less.

---

## 2. PHASE-1 — session by session

### ⚠ Session 2, the take store — **delete `graph.ts`, keep the stash, keep the split**

`brain/src/store/` is **~1,660 lines of non-test code plus ~690 of tests**. It is
tested and green, so the temptation is to keep it. Most of it is answering
questions the model no longer asks.

| file | lines | disposition |
|---|---|---|
| `graph.ts` | 396 | ⚠ **DELETE** — head, path walk, branch topology. D17b/D17c. The project is the graph now |
| `project.ts` | 250 | **DELETE** — project key, on-disk location. Nothing persists (D17a) |
| `store.ts` | 580 | ⚠ **REDUCE** — retention, pruning, childless-only, take append (D17f) all go. What survives is the **stash**: capture prior state of a write-set, hand it back for revert |
| `format.ts` | 187 | **REDUCE** — atomic writes and the on-disk envelope go; the `StoredTake` shape survives as an in-memory stash record |
| `slice.ts` | 115 | ⚠ **KEEP** — partial revert by address is **not** retired. §4.3 says track-level branching yields one winner per track, and D5's motivating case (*"that take had a better hi-hat"*) is within-track |
| `errors.ts` | 101 | REDUCE to the surviving cases |
| `surface.test.ts` | 103 | ⚠ **KEEP** — the read/write type split is the one part of D17 that survives outright (D17g) |

⚠ **Two things must not be deleted along with the store, and both are easy to
lose by accident:**

1. **The stash is load-bearing and grows a new job.** It still serves every
   unforked write, everything not track-scoped (tempo, scenes, master, FX
   returns, cross-track routing — none of which a fork can isolate), **and** it
   is the content fingerprint that guards positional clip addressing.
2. ⚠ **`clip.delete`'s `none` is an adapter artifact, and D16's own fake and live
   adapters disagree about it** (§3.3.3). `StateValue` declares `lengthBeats?`,
   the fake populates it, the live adapter does not — PHASE-0 §Risks' named
   failure mode, sitting unexercised because nothing reads the field. That is a
   **bug to fix while the store is open**, not a decision.

### ⚠ Session 3, the daemon — **DELETED, and its one real job is re-homed**

Not "reduced". Two of the daemon's three jobs no longer exist and the third was
never a constraint (E16p). What survives is a **scene/content observer**, and the
extension is a strictly better home: it is alive whenever Bitwig is, so it cannot
miss an edit made while no client is attached, which a daemon started later
provably can.

⚠ **E16s changes the shape of that observer, and this is the session's most
directly actionable result.** §3.2.3 proposed a scene-**count** epoch and named
its own blind spot: a count catches create/delete but not a move. Measured — the
count observer sat still (3 → 3) through a human clip drag. But a
**launcher-content** observer saw it as a **pair**: `t2s7=emptied`,
`t2s3=filled`, agreeing exactly with the human's independent report.

> **Proposed:** the extension carries **both** — a scene-count epoch and a
> launcher-content epoch — and the content epoch is the one clip addressing
> consults. One indexed observer per bank row covers every slot, so the whole
> grid costs `tracks` observers, not `tracks × scenes`. ⚠ Bitwig delivers initial
> values through the same callbacks, so the epoch is meaningless in absolute
> terms: **only a difference across a known event means anything.**

⇒ **Session 3 becomes "the MCP server holds a bridge connection"**, which is a
fraction of a session. The phase goes from six sessions to five, and the
remaining work moves earlier.

### Sessions 4, 5, 6

- **Session 4, the control layer** — mostly survives. D14's cut of the take
  switcher is *reinforced*: A/B is now Bitwig's own mixer, needing no ghostnote
  UI at all at the coarse level. ⚠ But E16m found the mute is **not quantised**
  and the user wants it to be — *"It would be better if it were aligned to beat
  or measure boundaries"* — which is an open question this phase should own, not
  inherit silently.
- **Session 5, proving it live** — exit criterion 4 (two takes A/B'd from inside
  Bitwig) is **satisfiable in Phase 1 after all**, by muting two sibling tracks,
  which is what D14 relaxed it away from. Worth re-reading before accepting the
  relaxation.
- **Session 6, async batch completion** — unchanged.

---

## 3. What §3.4e and E16w change that nothing had planned for

> ⚠ **RESOLVED 2026-08-01 — this section keeps its original scope.** It was
> written assuming device-scoped A/B fills a *hole* in the track-native model
> (the master and the FX returns, which no fork reaches), and E17 confirms that
> is exactly what it does. The six capability rows came back: a layer chain can
> be created by a named action but only ever ONE (row 1 ◐), cannot be duplicated
> (row 2 ○), cannot be grown (row 3 ○) and **cannot be deleted** (row 4 ○, four
> routes, both verb controls ●). A container whose branches can be neither added
> nor removed is not a take container. **DEVICE takes are TRACKS.**
>
> ⚠ **One amendment is owed below**, and it improves §3 rather than shrinking it:
> the table's "readable which-is-live" column is settled by **row 6**, not by the
> chain selector. `DeviceLayer.solo()` is container-scoped (0 of 10 tracks
> flipped, where a track solo flipped all 10) and **locally exclusive** (soloing
> chain 1 reads 23 against a mute-calibrated "chain 1 alone" of 25, and 66 for
> both open). That is one exclusive flag per chain, with no Selector preset and
> no routing. See `E17-VERDICT.md` §4.

⚠ **A device-scoped A/B now exists, and it reaches what the whole track-native
model cannot.** §4.8 states that FX returns cannot be forked — other tracks'
sends still feed the original — and E16r then showed the returns and the master
are the **first** things to leave the addressable set as a lineage grows. Those
two facts together were a hole in the model with no proposed answer.

| | layer mute (E16w) | chain selector (§3.4e) |
|---|---|---|
| works | ● as complete as a track mute | ● 25 ms switch |
| cuts sends | (n/a — it is the source) | ○ **no**, and that is correct |
| asset needed | ⚠ human-built shell | ⚠ human-built shell |
| chains fillable by us | ● `layer.insertDevice`, ~143 ms | ● 135/146 ms |
| ⚠ readable "which is live" | ○ **N mute flags** — E16m's problem again | ● **`activeChainIndex()`, one integer** |
| glitch on switch | not applicable | ⚠ **owed** |

> **Proposed:** §4.4's selector idea stops being speculative and becomes the
> named mechanism for **the master and the FX returns**, where forking is
> impossible. The **track** layer is unchanged — forks and group mute, as chosen.
> ⚠ Both mechanisms need a `.bwpreset` **a human made**, because Selectors and
> Instrument Layers ship with zero chains and E16o proved no verb seeds one. That
> makes the preset library (rule 11, E4h) a **dependency of the A/B story**, not
> just of Phase 5's authoring — a coupling nothing in the plan currently records.

---

## 4. Two D16 amendments still waiting on the user (rule 10)

Carried unchanged from `E16-OPEN-QUESTIONS.md` §3.3.3 and §3.3.4 — proposed in
session 4, not yet decided:

1. **`clip.delete`'s `none` is an adapter artifact**, not an API limit. Capture
   `lengthBeats` live and the label becomes `lossy`. It earns floor membership
   *today*, for an implementation reason with a nameable retirement condition.
2. **`device.insert` is `clip.create` and does not get its exact-inverse
   treatment.** The asymmetry is unprincipled and should be resolved deliberately
   in one direction. ⚠ `device.insertFileAt` with `where: 'replace'` is the
   genuine exception and is an unconditional floor member if Phase 5 ever adds it
   to the contract.

---

## 5. ⚠ Not yet done — the next session's first job

This document covers standing rules 5/6/7 and PHASE-1. **Untouched:**

- `PROJECT_PLAN.md` §5 phase index and §7 open questions
- `plan/PHASE-3-SESSION-VIEW.md` — the doc most changed by the model, and now
  also by the daemon retirement: it becomes MCP-server-hosted and **lives and
  dies with the chat session**. ⚠ If Phase 3 ever wants to be usable with no
  agent attached, the daemon decision reopens — the tripwire to write down rather
  than rediscover.
- `SPIKE-E16-BRANCHES-AS-TRACKS.md` and `E16-TRACK-NATIVE-BRANCHING.md` — the
  latter still carries a staleness banner listing five things now settled, plus
  §4.4, which E16w and §3.4e have now answered.
- `DECISIONS.md` — D4, D13, D14 revisions and D17's sub-decisions marked
  superseded. **The user's to author (rule 10).**
