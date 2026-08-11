---
title: ghostnote — Handoff for E16 session 4: clear the open questions, then
       re-plan the project onto the track-native model
status: The model is CHOSEN (user, 2026-07-29). Session 3 measured what it rests
        on. This session answers what is still open, then rewrites the plan.
updated: 2026-07-29
predecessor: HANDOFF-E16-SIBLINGS.md (session 3 — do not edit it, it is that
        session's record; its task 3 was superseded and never ran)
model doc: E16-TRACK-NATIVE-BRANCHING.md
---

# Handoff: E16 session 4

**The design question is settled.** After three sittings of measurement and a
use-case audit, the user has chosen the **track-native model**: branches are
duplicated tracks, groups are lineage containers, revert is deletion, A/B is mute,
and the project document is the source of truth. ⚠ **Do not re-litigate it.**

This session has two jobs, in order:

1. **Answer the open questions in §3.** Most are cheap; two could change the shape
   of the design and one could reopen a capability we wrote off.
2. **Re-plan.** Review every existing plan and design doc against the new model and
   say what changes. This is the larger job and it is the point of the session.

## Read first, in order

1. **`E16-TRACK-NATIVE-BRANCHING.md`** — the model, the use-case ledger, and what
   survives/degrades/falls out. ⚠ Needs revision this session (§4).
2. `FINDINGS.md` → **`E16l`**, **`E16k`**, **`E16j`**, then `E16 rows D–G` and
   `E16 rows A–C`. The four traps lists are not repeated here.
3. `DECISIONS.md` → **D4, D13, D14, D16, D17**. Several are now wrong or
   over-scoped; §2 says which.
4. `PROJECT_PLAN.md` §4 standing rules — **6 and 7 are both in question.**

---

## 1. The model, in one page

- **A change forks its target tracks first, then writes to the forks.** The
  original is never edited, so revert is deleting a track and is exact whatever
  the change contained — including device inserts and modulator surgery, which
  are `unrevertable`/`none` under a stash (D16d).
- **Groups are lineage containers.** `Group` the original first, *then* duplicate;
  copies land inside (E16k K2). This order is forced — `moveTracks` is a silent
  no-op, so nothing can be gathered into a group afterwards.
- **Collapse = delete all but one, then `Ungroup`.** Measured end to end: the
  survivor returns to top level with its `channelId` intact, ~243 ms (E16k K3).
- **A/B is mute**, in Bitwig's own mixer, with no ghostnote UI (E1/E2 ●).
- **Within-track combination is a live clip diff + merge** between two siblings,
  materialised as a whole-clip rewrite.
- ⚠ **Stateless.** No take graph, no head, no project key, no retention depth, no
  persisted log. Snapshot on demand; the agent holds references and its own
  changes in context and is told the project can move under it.
- **Clips are addressed positionally, guarded by content fingerprint**, with a
  tolerant fallback chain: happy path → try to re-locate a moved clip by its
  fingerprint → recreate it if gone. Fork-first is what makes that safe.

### 1a. Turns — the fork boundary

**A "turn" is the unit of operator intent, and it is what decides whether a write
forks or lands in place.** Named *turn* deliberately and ⚠ **never "epoch"** —
`sceneEpoch` already exists (E3, bumped on scene create/delete) and two epochs
would be confused in conversation and in code.

- The agent **declares** whether a request continues the current turn or starts a
  new one. Guidance: **new operator prompt ⇒ new turn**; a sprint of agent-internal
  operations stays in one turn; a lightweight iteration on the same request
  (*"back off a bit"*) may keep the turn.
- ⚠ **Forking is LAZY, so bumping is free.** The fork happens on the first write to
  a given track *within* a turn, not at bump time. Cost is therefore
  **per (track × turn)** — bump ten times and touch nothing, pay nothing. This is
  what resolves the cadence tension; a 20-operation sprint on one track is one
  fork, not twenty.
- ⚠ **Nothing is invalidated, ever.** With no observers we never see a change, so
  there is nothing to invalidate: **re-derive the turn map from the project on
  every snapshot.** A missing fork means that turn has no fork for that track; an
  edited name means the tag is gone, and we say so. Strictly simpler than
  maintaining invalidation, and more faithfully stateless.

### 1b. The naming scheme — where the tag lives

The tag lives in the **track name**, which costs no state, survives save and
restart, is readable from `track.list`, and is human-editable *by design*.
Renaming was already mandatory (A4 — a copy carries its source's name).

```
B· Bass different-line
│  │    └── human gist — mnemonic, and addressable in natural language
│  └── the original track name
└── lineage tag: uppercase letter + MIDDLE DOT (U+00B7)
```

- **Uppercase letters A, B, C…** because "A/B comparison" is the native idiom, and
  typing `B` is a faster gesture than reading a gist — sometimes the only legible
  part when the original name is long.
- **The middle dot `·`** so a human will essentially never type the prefix by
  accident.
- ⚠ **The ORIGINAL is tagged `A·` when the lineage is created**, not left
  untagged. This matters: the reaping guard below refuses to delete untagged
  tracks, so an untagged original could never be collapsed away and "commit to B"
  would be impossible. Tagging at fork time makes every lineage member reapable and
  keeps the guard meaningful for anything a human adds to the group.
- **On collapse the tag is stripped and the gist is KEPT** — `B· Bass
  different-line` → `Bass different-line` — so the operator still remembers which
  variation won. A round trip that A wins restores the original name exactly.
- **Both handles must resolve.** The agent must accept *"commit to B"* **and**
  *"commit to the different-line bass"*.

⚠ **Correction to an over-claim made when the turn idea was first assessed:** the
letter is **lineage-local, not turn-global**. If a turn forks Bass and Pad, they
may land on different letters depending on each lineage's own history — so
"delete every fork tagged with turn N" **cannot** be done from names alone.
Cross-track undo of one turn therefore lives in **the agent's context**, which is
consistent with the stateless model and with UC7/UC11 having been cut. Per-lineage
reaping is what the names support, and that is what the operator's gesture asks
for anyway.

### 1c. Reaping — rule 8, restated

⚠ **"The agent never reaps" was never a decision.** It was a session-2
*provisional recommendation* in a table explicitly headed *"one session's
opinions… NOT decisions"*. Three separate things had been conflated under
"rule 8", and only one still applies:

| what it said | status now |
|---|---|
| **Rule 8 proper** — the agent may read the take log and explain it, never mutate it; enforced by D17g's type split | ⚠ **retired with the log.** It was about rewriting *history*, and there is no history object |
| **E14-A1** — Bitwig *refuses* `Signal.fire()`, so only a human click fires a document-state button | ● still a true measured fact, but it governs **one UI affordance** we are no longer planning to build |
| **D16d** — un-creating a created track is not offered, because *"a human may already have put work in it"* | ● **the live concern**, and now handled mechanically rather than by refusal |

**The distinction that actually matters is not who calls the API — it is who
decided.** *"I like piano take D, commit to that"* is the operator deciding and
the agent executing. That is categorically different from the agent autonomously
pruning branches to reclaim CPU or bank slots, which is what the recommendation
was actually worried about. Restated:

- **8a — The agent never *decides* to destroy.** It may execute a destruction the
  operator has just requested.
- **8b — Destructive operations are packaged and shaped, never open-ended
  deletes.**

**8c is dropped as a rule** and kept only as a recorded fact. It constrains a
document-state button, and the model no longer requires one; if a human affordance
is ever added, Bitwig enforces the property for free whether we ask or not
(E14-A1). Carrying a standing rule for a thing we are not building is noise.

**The packaged op: `collapse(group, survivor)`.** An open delete is worse than a
shaped one for a measured reason — ⚠ **deleting the group itself CASCADES to its
children (E3)**, so the most natural "collapse this" gesture destroys the winner
too. The op makes that unrepresentable. Guards:

1. **Scoped to one group** — cannot touch anything outside the lineage.
2. **Survivor named explicitly**, so a mis-parse deletes nothing rather than the
   wrong thing.
3. **Deletes children, then ungroups** — the exact order K3 measured. Never
   deletes the group.
4. ⚠ **Refuses to delete an untagged track.** Falls out of §1b for free: inside a
   lineage group, untagged means a human put it there. Reap only tagged tracks.
5. **Reports before acting** — names, clip counts, note counts — because collapse
   is irreversible past the undo window and the diff dies with it.
6. Optionally, a **fingerprint check**: if a fork differs from what we last wrote,
   a human edited it — surface that rather than destroying it silently. ⚠ Under
   full statelessness this depends on the agent holding the last-written
   fingerprint in context, so operator confirmation is the more reliable guard.

Guard 4+6 are a **better answer to D16d than D16d's own**: instead of "never offer
un-create", it becomes "offer it, and detect the case we were afraid of". Backstop:
a track delete is **one undo entry** (F1/G1), so a mis-reap is ⌘Z-recoverable if
caught promptly — something the take store never offered for this operation.

⚠ **The one thing that stays firmly forbidden: autonomous reaping under
bank-window pressure.** That is the temptation this model creates, since the bank
window is now the history budget. **Standing rule 5 already answers it** — fail
loud, never operate on a partially-visible project. Bank pressure is a refusal
that tells the human to clean up, never a licence to free slots by judgement.

## 2. What this retires, and what survives

**Retired outright** — remove from the plan, do not build:

| gone | why |
|---|---|
| `graph.ts`'s head, the path walk, **D17b** | no project-wide state is wanted (UC8 cut) |
| **D17c** `lands: take \| new-state` | navigation is mute state and is never recorded, so the undo-an-undo trap it guards cannot arise |
| **D17a** project key, atomic writes, file format | nothing persists |
| **D17e** pointer arbitration | only one copy of anything now |
| **D17f** retention depth, childless-only | the human deletes tracks; the bank window is the budget |
| take labels | orphaned with UC11 (⚠ track *renaming* survives separately — copies share a name, A4) |
| cross-branch application + the branch↔track identity map | no use case survived scrutiny |
| fuzzy structural matching | `channelId` survives rename/move/group/ungroup, so it was never needed |

**Survives untouched:** the whole write path — resolve → stash → apply → verify →
report. Every E2/E3/E8/E15 guard. **D16 stands entirely**, including the `gain`
withholding and `pressure` stripping, which the merge path inherits. **D15**
verification discipline. **D6** addressing.

**Survives, reduced:** the stash — still needed for unforked writes, for
non-track-scoped changes (tempo, scenes, master, FX returns), and as the content
fingerprint that guards clip addressing.

**In question:** **D4** (process topology — see §3.2), **D13/rule 6** (E16j
disproved its foreground premise; the rule may stand on its other legs but its
stated reasoning is now wrong), **D14** (partially amended — coarse A/B needs no
UI, fine merge still does), **rule 7** (its only rationale was protecting the take
log from silent omission).

---

## 3. Open questions — this session's first job

### 3.1 ⚠ Can an existing device be MOVED into a layer? — REOPEN

**The highest-value question here, and the user does not trust the current
finding.** E4d route 3 recorded `InsertionPoint.copyDevices()` into a layer as a
silent no-op — ⚠ **a single-mechanism check, which is the exact shape that has
produced false negatives four times in this spike** (CLAP params, `channelId`,
chain creation, group creation). E4d itself exists because E4c's ○ was overturned.

**Why it matters:** FX returns cannot be forked — other tracks' sends still feed
the original, so duplicating one isolates nothing. If devices can be relocated into
layer chains, a **chain selector** becomes a device-scoped A/B mechanism that needs
no track duplication at all: no bank-window cost, no C5 glitch, and it reaches the
master and the returns, which the track model cannot.

**What is already known** (do not re-measure):
- `insertFile` with a `.bwpreset` materialises arbitrary multi-chain structure in
  **one call, 268 ms** — the general escape hatch (E4d route 4).
- `Device.duplicateObject()` on a container clones it **with contents** (route 6).
- Inserting a **new** device into an existing layer works, ~143 ms (E4c).
- Layer-type containers **cannot grow chains**: FX Layer ships with 1 and will not
  grow; Instrument/Note FX Layer and the Selectors ship with **0** and cannot be
  seeded (E4d residual gap).
- `chainselector.set`/`status` are already on the wire; params resolve 14/16 at
  depth 2 (E4c).
- ⚠ E4d route 7 found no named action creates chains. That was an **absence**
  finding across all 781, not a foreground-gating one, so **E16j does not reopen
  it** — though re-reading the enumeration with fresh search terms is cheap.

**Method:** walk `InsertionPoint` and `Device` completely for every relocation
verb (`moveDevices` is right there next to `copyDevices` and appears untested),
grep `member-search-index.js` for the concept rather than the suspected method,
then probe live and verify by `device.list` diff. If `moveDevices` works where
`copyDevices` did not, that is the same shape as `duplicate` vs `duplicateObject`
in row A.

### 3.2 ⚠ Should the daemon model be revised? — D4

D4 gave `ghostnoted` three jobs: hold the bridge connection, own the take store,
own the change log. **Two of the three no longer exist.** Standing rule 7 ("all
writes go through the daemon") exists solely so a bypassing write cannot leave a
silent gap in the take log — with no log, the rationale is gone. The ordering guard
is extension-side already (E8's revision counter), and the human surface is
extension-side (E14).

⇒ **What remains is "something holds a bridge connection", which the MCP server
can do directly.** Weigh against: Phase 3's web view would need its own connection
or to be hosted by the MCP server; and anything wanting to observe while no agent
is attached would have nowhere to live. **This is the user's call (rule 10).**

### 3.3 ⚠ PARTIALLY RESOLVED — define the op-class floor precisely

**The cadence tension is settled** by the turn model (§1a): the agent declares turn
boundaries, forking is lazy, and cost is per (track × turn). **What remains open is
the safety floor underneath it.**

**Why a floor is wanted.** An MCP server cannot detect an operator prompt boundary
— it sees only tool calls — so the turn bump is **agent-declared and
unverifiable**. Resting the *recoverability* of a change on the agent remembering
to bump is fragile. The floor makes safety independent of that discipline: **always
fork for op classes that cannot otherwise be reverted**, and let everything else
ride the turn, since it reverts exactly through the stash. Two jobs, two
mechanisms — agent judgement sets *comparison* granularity, the floor guarantees
*recoverability*.

⚠ **The floor's membership is NOT agreed and must be derived, not assumed.** The
candidate list — device insert, modulator surgery, track create, scene create,
clip delete — comes from D16d's `unrevertable`/`none` labels, and those labels
were assigned for the *stash* model. **Examine each one individually and prove it
is genuinely unrevertable under the current engine** before putting it on the
floor; a class that turns out to revert cleanly does not need a forced fork, and
every unnecessary member costs a bank slot and a glitch.

Work from `engine/fidelity.ts` and `ADDRESS_IDENTITY` rather than from the prose,
and record the verdict per class. ⚠ Note D16d already documents **one asymmetry
that shows the labels are not uniform**: a clip that did *not* exist has an exact
inverse (delete it), so `[clip.create, note.write]` reverts losslessly — where a
blanket "structural ops are unrevertable" would have made the flagship case do
nothing. Expect more of that shape.

### 3.4 Measurements still owed

| # | question | why it matters |
|---|---|---|
| a | ⚠ **E16 row D4 — bank-window headroom under `ALL_CHANNELS`** (⚠ not DECISIONS D4) | the bank window is now the history budget; nobody knows where the ceiling is |
| b | ⚠ **Does muting a GROUP silence its children?** | the lineage-level A/B claim rests entirely on it. Needs ears + a rolling transport — **ask before making noise** |
| c | **Fork burst cost** — an N-track batch is N duplications | C5 measured singles only; a burst may be worse than N × one |
| d | **B3 — modulator liveness across a fork** | owed since row B. UC6's whole revert story rests on it |
| e | **Chain-selector switching** — glitch? latency? does it cut sends? | decides whether 3.1's payoff is real |
| f | **Does a clip `moveTo` bump the scene epoch?** | if it does, moved clips are detectable for free |
| g | `createEqualsValue` — init-only? worth it as a target guard? | E16l's find; a stronger guard than name+position (D6) |
| h | C4 — per-branch project file-size delta | owed since row C; needs a human `⌘S` |
| i | **D3 — cursor-pool pressure** across an original plus its forks | owed since row D and now sharper: a lineage multiplies the tracks a pool must reach |
| j | ⚠ Does `track.setName` accept **non-ASCII**? | the whole naming scheme rests on the middle dot `·` (U+00B7) surviving a round trip. Cheap, and it would be an embarrassing thing to discover late |
| k | What happens past **`Z·`** in one lineage? | 26 forks will hit the bank window long first, so a **loud refusal** is probably right (rule 5's shape) rather than wrapping to `AA·` |

⚠ **One consequence of §1b worth confirming rather than assuming:** we can only
ever set the UI selection to **one** track, so a turn touching four tracks makes
**four separate lineage groups**, not one group of four. That is correct for the
model — lineages are per-track — but it means a four-track turn costs four group
rows on top of four forks, which feeds straight into (a).

---

## 4. The re-plan — this session's second job

Every one of these was written assuming an external stateful take store. Review
each and record what changes:

- **`plan/PHASE-1-ENGINE.md`** and its six session docs. ⚠ **Session 2 (the take
  store) is largely retired** — `brain/src/store/` exists, is tested, and is now
  mostly unneeded. Decide: delete, or keep the stash-shaped parts. Session 3
  (daemon) depends on §3.2. Sessions 4–6 need re-reading against the model.
- **`DECISIONS.md`** — D17 needs most of its sub-decisions marked superseded; D4,
  D13, D14 need revising. ⚠ Still the user's call (rule 10): propose, do not write.
- **`PROJECT_PLAN.md`** §4 rules 6 and 7, §5 phase index, §7 open questions.
- **`plan/PHASE-3-SESSION-VIEW.md`** — its diff/timeline/partial-revert surface is
  the part most changed by the model.
- **`SPIKE-E16-BRANCHES-AS-TRACKS.md`** and **`E16-TRACK-NATIVE-BRANCHING.md`** —
  fold the session-3 corrections in (fuzzy matching cut, the independence
  correction, UC8/UC11 cut, E16l).

## 5. Rig notes

Unchanged from session 3, and all of it still bites: a Java change needs a **full
Bitwig restart**; `./gradlew copyExtension` is an atomic rename; adding a wire
method means `npm run wire:golden -- --write` before the build. `probe:hello`
checks the contract and the `methodsHash`.

⚠ **No wire methods were added in session 3** — `e16j` and `e16k` run entirely on
the existing surface, so no restart is owed.

**New probes:** `e16j-actions.ts` (named actions by window state; takes
`bg`/`fg`/`min`/`space`), `e16k-grouptopo.ts` (group topology, silent, refuses to
run while the transport rolls).

## Posture

The sandbox project is throwaway — churn it, but leave **`gn-E16`** intact (it
sits inside a human-created **`Group 7`**). The user is at the keyboard for
anything audible: **ask before making noise**, ask **immediately** after the event,
ask **open** questions, and use **placebo trials** for anything decided by ear.
Stop after each task for review.

⚠ **Do not write `DECISIONS.md` unless explicitly directed to.** The design calls stay the user's (rule 10).
