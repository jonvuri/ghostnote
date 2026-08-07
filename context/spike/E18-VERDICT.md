---
title: E18 — the branching model, compared: TRACK forks vs LAYER chains + LAUNCHER rows
status: ⚠ PROPOSAL AND ANALYSIS, not a decision. The call is the user's
        (standing rule 10) and nothing here goes into DECISIONS.md.
        Written 2026-08-04 at the user's request, against a complete E18 record:
        §3.1's bar and §3.2 are both closed, so every row that was owed has a
        number. Replaces E17-VERDICT.md, which HANDOFF-E18 §6 asked to be
        rewritten or retired once §3.1 reported. §3.1 has reported.
        ⚠⚠ REVISED 2026-08-04 after operator review. FOUR changes, and two of
        them corrected this document rather than extending it:
          §0b  CORRECTED — the mechanism count is EQUAL (3 vs 3), not 2 vs 3.
               The track model needs layers for the Master/FX anyway, so it
               carries a SEAM: two shapes for one concept (§0a).
          §3b  CORRECTED — the exclusive-solo claim is about the GESTURE, and a
               first draft answered a question nobody asked. Bitwig has NO
               one-click exclusive A/B for tracks: mute is not exclusive, solo
               flips 10 tracks. That is a measured CAPABILITY GAP.
          §4   REFRAMED — slot launching always; a scene is a ROOM primitive.
               ⚠⚠ And the clip BLOCK arrived: takes as contiguous clips bounded
               by empty slots, auto-advancing on a Next Action. Quantised, and
               hands-off. ⚠ BUT Next Actions are NOT IN THE API (§4a″) — five
               classes dumped in full WITH descriptions, and "next action" is
               absent from the whole javadoc tree, in docs that name these
               settings by their inspector label. ⚠ A SHARP negative: the
               NEIGHBOURING inspector fields ARE exposed (`launchMode()` is
               documented as *"Setting "Launch Mode" from the inspector"*).
          §4a″-bis `launchWithOptions(quantization, launchMode)` gives a PER-CALL
               quantisation override ("1" = bar, "8" = phrase) and — the find —
               ⚠⚠ **`"continue_or_synced"`, which makes take B resume at take
               A's position instead of restarting the loop.** No mute, solo or
               chain switch imitates that. ⚠ UNPROBED, not on our wire.
               ⚠⚠ BUT IT DOES NOT RECOVER THE UNATTENDED HALF (operator, and
               they were right): it is a VERB, one call per switch, governing
               how a launch behaves and never whether one happens. ⇒ the
               MUSICAL QUALITY of the clip A/B is ours; its UNATTENDEDNESS is
               not, and only the human's Next Action gets it. §4a′ is scored
               down accordingly — an affordance the layout unlocks for the
               operator, NOT a system capability. ⚠ §4a′ over-claimed twice
               and the operator caught both times.
          §7a  THREE owed measurements DISPOSITIONED by operator judgement
               (chain CPU, PDC/transparency, launch quantisation). Recorded as
               judgement with retirement conditions, NOT as measurements.
        ⚠ THE CALL IS OPEN — the operator has not made it. §6 is a proposal.
updated: 2026-08-04
supersedes: E17-VERDICT.md (retained as the record of how the argument moved)
parent: HANDOFF-E18-BRANCH-UNLOCK.md §5, §6
evidence: FINDINGS E18a–E18h · E17 rows 1–6 · E16k, E16l, E16m, E16r, E16s,
        E16u, E16w, E16 §3.4e · E5b/E5c · E3 · C3, C5, G1/D1 · D6, D16, D17
---

# The branching model, compared

> ⚠ **This document argues both sides and then recommends.** The recommendation is
> §6 and it is a proposal. Everything before it is the record.

---

## 0. ⚠ First, what is actually on the table — the framing is wrong twice

**Two corrections to the question before the comparison can be honest.**

### 0a. "Tracks only" is not an option — layers are already committed

`§4.8` established that **FX returns cannot be forked** (other tracks' sends still
feed the original), and `E16r` then measured that the Master and the FX returns are
the **first** objects to leave the addressable set as a lineage grows. That was a
hole in the track-native model with no proposed answer until `E16-REPLAN.md` §3
named layers as the answer *there*.

⚠ **`e18a` has since made that a measurement rather than an assumption** — all nine
cells ●●: a multi-chain container reaches the Master **and** an FX return
autonomously, by UUID insert → `layer.select` → `duplicateChannel`, and an
`insertFile` of a filled 4-chain preset lands filled at both. There is no
device-type gate at those destinations.

⇒ ⚠ **The layer mechanism gets built either way.** The real comparison is not
*tracks vs layers*; it is **"tracks + layers confined to the Master and FX returns"
vs "layers everywhere + a clip mechanism"**. The marginal build cost of the second
is much smaller than a fresh-mechanism argument implies, and that is a structural
point, not an ergonomic one.

⚠⚠ **And it is sharper than "the cost is smaller" — the track model has a SEAM.**
Under it, a device take on a regular track is a forked track and a device take on
the Master is a layer chain: **two shapes for one concept**, with the agent
branching on destination type and the human seeing two different things depending
on where they look. Under the layer model the device mechanism is **uniform across
every destination there is**. ⚠ Operator's point, 2026-08-04, and it is the second
reason they went looking at layers at all.

### 0b. ⚠ Neither option is "one mechanism" — and the count is EQUAL, not worse

⚠⚠ **CORRECTED 2026-08-04.** A first draft of this section scored the track model
at two mechanisms and the split at three, and called the third *"the split model's
true cost"*. **That was wrong, and §0a above is what refutes it** — layers are not
optional under the track model, they are how the Master and the FX returns get a
device A/B at all.

| | device takes | clip takes | everything else | count |
|---|---|---|---|---|
| **track model** | ⚠ **fork on a regular track · layer chain on the Master/FX — A SEAM** | the fork | the stash | **3** |
| **split model** | layer chain, **uniformly** | launcher slot block | the stash | **3** |

⚠ **The stash survives in both**, because §4.8 lists what neither model can branch
at all: tempo, time signature, scene create/delete, master and FX-return changes,
cross-track routing. And the coarse cadence (`E16-TRACK-NATIVE` answer 2) means
**most batches are never branched**, so the stash is on the common path in both
worlds.

⇒ ⚠ **The split model's real cost is not a mechanism count.** It is the **linkage
convention** (§4e) — nothing joins a device take to a clip take. That is one cost,
not two, and §5's option C exists to avoid paying it.

---

## 1. The scoreboard, every row measured

⚠ Bold = decided by an E18 measurement. Rows are ordered by how much they move the
argument, not by how they were collected.

| | track fork | layer chain | who wins |
|---|---|---|---|
| ⚠ **audible glitch on a branch change** | ⚠ **○ 5/5 audible (C5), no silent variant** | ⚠⚠ **● SILENT via MOVE** (`e18h` 0/2, control 2/2, placebo 0/2); COPY is 2/2 | ⚠ **layers, outright** |
| ⚠⚠ **ONE-CLICK exclusive A/B** | ⚠⚠ **○ DOES NOT EXIST — mute has no exclusive variant (≥2 writes), and solo is project-global (E17 row 6 control: 10 tracks flipped)** | ⚠⚠ **● one flag — `SoloValue.toggle(exclusive=true)`, 0 of 10 tracks flipped** | ⚠⚠ **layers — and §3b says this is THE row** |
| ⚠ **"which take is live", readable** | ○ N mute flags (E16m, §4.4's open problem) | ⚠ **● N solo flags carrying a single-live invariant** (E17 row 6) | layers |
| ⚠ **A/B does not disturb the rest of the project** | ● group mute is child-scoped (E16m) | ● 0 of 10 tracks flipped (E17 row 6) | **draw** |
| ⚠ **ONE mechanism across ALL destinations** | ⚠ **○ a SEAM — fork on a track, layer on the Master/FX** | ⚠ **● uniform** | ⚠ **layers — §0a** |
| ⚠ **the branch UNIT can be smaller than a track** | ○ a fork duplicates the whole chain | ⚠ **● a container can wrap a SUBSET** | layers |
| ⚠ **post-hoc restructuring** | ⚠ **○ none — `moveTracks`/`copyTracks` are silent no-ops (K2)** | ⚠⚠ **●● all four move directions, state preserved (`e18c`)** | ⚠ **layers, and it is not close** |
| the Master and the FX returns | ○ cannot be forked (§4.8) | ⚠ **●● reachable and growable (`e18a`)** | layers |
| disk | 20,391 B/fork (E16u) | ~0 | layers (immaterial) |
| engine CPU | ≈0.6 pp/branch (C3) — ⚠ **and delete returns it** (G1/D1) | ⚠ unmeasured for a dormant chain; ⚠ **operator: same or less** (§7a) | draw, on judgement |
| ⚠ **DESTROY a branch** | ● exact, one gesture, 243 ms with `Ungroup` (K3) | ⚠ **○ no typed route — REBUILD at 4276 ms (`e18f`)** | tracks |
| ⚠ **UNDO granularity** | ● 1 op per structural call; a fork+rename+group is **3** | ⚠⚠ **○ SEVEN steps per rebuild; 6 of 7 intermediates hold BOTH containers** | ⚠ **tracks — see §3f** |
| ⚠ **durable identity** | ● `channelId` persisted to disk (E2f) | ⚠⚠ **○ minted by the project LOADER (`e18b`)** | ⚠ tracks — **see §3d** |
| **carries CLIPS** | ● | ⚠ **○ never** | ⚠ **tracks — and this is the whole reason §4 exists** |
| visible in the project | ● mixer, arranger, everywhere | ○ device panel, container expanded | tracks |
| bank-window cost | ⚠ **1 slot — but see §3a** | none | ⚠ **nobody. Retire this row** |
| chain-level state carried across a migration | (n/a) | ⚠ colour ● re-appliable; ⚠⚠ **sends do not exist at all** (`e18g`) | ⚠ tracks carry sends (E16d) |
| modulator routings across a relocation | (n/a) | ⚠ **●● 3/3 survive (`e18e`)** — ⚠ cross-device form still owed | — |
| A/B quantised to the beat | ○ **measured not quantised (E16m), and the user wants it** | ○ unmeasured, nothing suggests otherwise | ⚠ **neither — only clip launch can, §4c** |

---

## 2. The case FOR tracks, argued at full strength

1. ⚠ **Under a STATELESS system, visibility is not cosmetic — it is the storage
   medium.** `E16-REPLAN` §1.3 cut the store: *"The system is now STATELESS"*, the
   project *is* the take log. A take log you cannot see without opening a device
   panel and expanding a container is a worse log. This is the user's first point
   and it is stronger than it sounds *because of a decision already made*.
2. ⚠ **Removal is exact, cheap and one gesture.** K3: delete-all-but-one +
   `Ungroup`, survivor at top level with `channelId` intact, **243 ms**. Against
   `e18f`'s **4276 ms and 7 undo steps**. And G1/D1 measured that a delete
   genuinely returns the CPU — so under tracks, *dead takes do not accumulate*.
3. ⚠ **A take that changes notes AND devices is free**, because it is one object.
   `E17-VERDICT` §8 put it correctly: *"'a take that changes both notes and devices
   needs both of them' never arises."* Under the split it arises and needs §4e.
4. **Undo behaves the way the user expects.** One Cmd-Z, one branch operation.
5. **Identity is a key, not a tag.** `channelId` survives rename, move, group,
   ungroup (E16k K1/K3) and a save + quit + reopen (E2f).
6. ⚠ **Fork-first is the strongest correctness argument in the whole spike, and it
   is not about branching at all.** E16l §"What follows for addressing clips": clips
   have **no identity** — a complete-recall pass over all 1968 API members. Under an
   external store a mistargeted clip write damages the human's real track; under
   fork-first it damages a duplicate that gets deleted. **The absence of clip
   identity stops being a correctness problem and becomes a "you may have to ask
   again" problem.** ⚠ A layer chain does not give this, because it carries no
   clips. §4 must supply it separately or it is lost.

## 3. The case FOR layers — including where the standard argument is WRONG

### 3a. ⚠ Drop the bank-window row. It has been overstated since E16.

It has appeared in every pitch table as the layer model's headline win. **It is not
a real constraint.** `E16r` measured the ceiling on a rig configured at
`bankSize = 16`; `E5b` measured a **256×128** rig at ~50 ms init, cost *linear and
negligible*, and `E5c` re-measured it cold at 25–28 ms bank settle with zero stalls
and recommended exactly that as the shipped size, config-tunable via `RigConfig`.

⇒ **The branch budget under the recommended config is `256 − project size`** —
200-odd slots for a normal project. ⚠ What survives from `E16r` is the *failure
mode*, not the ceiling: a create past the window mints an **orphan we can never
name or clean**, so rule 5 must stay a precondition. But that cliff is far away.

⚠ **This weakens the layer case, and it should be said out loud rather than left in
the table where it flatters the conclusion.** The cost of track litter is human
legibility, not capacity — which is exactly how the user phrased it, and the tables
have been claiming more.

### 3b. ⚠⚠ ONE-CLICK exclusive solo — the row that started the investigation

⚠⚠ **CORRECTED 2026-08-04 by the operator.** A first draft answered *"not because
track A/B disturbs the project — group mute is already local"*, and substituted a
state-representation argument. **That answered a question nobody asked.** The claim
was always about the **GESTURE**, and it is the reason layers were investigated at
all:

> **Operator:** *"I meant one-click exclusive solo. The lack of any mechanism for
> that on a group of tracks is what launched me into investigating layers in the
> first place."*

**And Bitwig gives no such mechanism for tracks. Both halves are measured:**

| | |
|---|---|
| track **solo** as the A/B gesture | ⚠ **○ project-global** — E17 row 6's control soloed the TRACK `gn-lay` and **10 tracks flipped to `mutedBySolo`**. It silences the rest of the project, which is precisely what a take A/B must not do |
| track **mute** as the A/B gesture | ⚠ **○ no exclusive variant exists.** Switching A → B is **at minimum two flag writes** (mute A, unmute B) and scales with the number of siblings. There is no single gesture — not for the human in Bitwig's own mixer, and not for us |
| ⚠ **chain solo** | ⚠⚠ **● ONE FLAG.** `SoloValue.toggle(exclusive=true)`, **0 of 10 tracks flipped**, and locally exclusive by ear: soloing chain 1 reads 23 against a mute-calibrated "chain 1 alone" of 25 and "both open" of 66; the mirror confirms |

⇒ ⚠⚠ **This is a capability gap in the track model, not an ergonomic preference.**
Bitwig offers exactly two channel gestures — mute, which is not exclusive, and solo,
which is not local. A take A/B needs one that is **both**, and only a device layer
has it.

**Two supporting points survive from the first draft**, now correctly demoted to
supporting:

- ⚠ **Mute is overloaded and solo is not.** §4.1: a track the human muted for
  ordinary mixing reasons is indistinguishable from a dormant branch, so **nothing
  may infer branch state from mute** — and `E16m` found this *worse* one level up,
  since a child's own mute flag is unchanged by its parent's. Neither a child's
  meter nor its flag can tell you whether its lineage is audible.
- ⚠ **Precision on the readback:** the live state is still N booleans with a
  single-live invariant, not one integer — a chain exposes no `isMutedBySolo`. The
  single integer (`activeChainIndex()`) belongs to a `ChainSelector`, which ships
  with **zero chains that no verb can seed** (E16o) and whose chains
  `selectFirstInLayer` times out on (§3.4e). So the take container is an
  Instrument/FX Layer + solo.

⚠ **The clip half beats both** — see §4c. A slot launch is one gesture, exclusive
*by construction*, quantised, and readable including the pending state.

### 3c. ⚠ "Scope to just the devices being changed" is the strongest technical point, and `e18h` names its mechanism

The user's third advantage is supported by the sharpest result in E18:

> **Instantiating a plugin is the audible event. Relocating an existing one is free.**

Two arms differing by one parameter — `verb: 'copy'` vs `verb: 'move'` — separated
**2/2 against 0/2**, with the control firing and the placebo clean in the same
sitting. A track fork *always* instantiates the whole chain: C5 5/5 audible, C3
≈0.6 pp CPU, E16u 20 KB. A layer container can wrap a **subset**, so the branch unit
is smaller *and* a MOVE-based rebuild is silent during playback.

⚠ **And the restructuring row is the one nobody has been quoting.** `moveTracks` and
`copyTracks` are **both silent no-ops** (K2), so under the track model construction
order is forced — group first, then duplicate — with no gathering, no re-parenting
and no reordering, ever. `e18c` measured **all four device move directions ●●
with state preserved**, chain→top, chain→chain, across containers, and copy. ⇒
**Layers are the only model in which a take structure can be reorganised after it
exists.**

⚠ **The cost this creates, which is unmeasured:** wrapping a subset means inserting
a container into the human's device chain. Whether that is audio-transparent —
level, and latency/PDC — is **not measured**. ⚠ The operator dispositioned it from
experience (*"PDC and audio in general are definitely transparent"*), so this
advantage rests on judgement rather than a probe — recorded with its retirement
condition in §7a.

### 3d. ⚠ The identity row nearly dissolves — under decisions already made

`e18b` closed it and the answer is bad: chain ids are minted by the **project
loader**, 4/4 regenerate on a project reload while 4/4 survive an extension reload
(replicated twice). Nothing on our side recovers it.

⚠ **But ask what still needs it.** `E16-REPLAN` §1.1 **CUT UC8** (project-wide time
travel) and **UC11** (durable cross-session labels), and §1.3 made the system
stateless. Nothing holds take ids across sessions; both models re-discover structure
from the project at the start of every session. And **chain ids are stable *within*
a session**, which is where addressing actually happens.

⇒ ⚠ **The residual risk is same-name collisions, and the track model has the
identical problem**: A4, a copy carries the same name, which is why §4.13 already
makes renaming *a correctness requirement* rather than a nicety. Same problem, same
fix, both models.

⇒ **Stop carrying durable identity as a headline argument.** It was decisive when
there was a store to hold ids in. There is no store.

### 3e. ⚠ Chain sends do not exist — which closes a worry and opens a difference

`e18g`: `Channel.sendBank()` on a chain refuses outright — *"No send bank exists:
Requested a send bank size of 0"*. That **closes** the migration worry (a rebuild
cannot lose what does not exist) and simultaneously records a real asymmetry: **a
track fork DOES carry sends (E16d)**. If per-take send levels matter, only tracks
can express them.

### 3f. ⚠ The 7-undo-step cost is the layer model's worst row — and it is smaller than the table says, for one specific reason

`e18f` is the first genuinely negative E18 result and it deserves its weight: seven
undo steps for one rebuild, **6 of 7 intermediate states holding BOTH containers**
with takes duplicated across them, reachable by one keystroke, and **invisible until
the user hits Cmd-Z once**. Same shape as E17's priming hazard: a precondition
nobody can see.

⚠ **Two things make it smaller than a bare 7-vs-1 comparison:**

1. **The track model does not pay 1 either.** `e18f`'s own rule — *one structural
   API call = one undo step* — is general. A track branch is fork + rename +
   lineage group = **3**.
2. ⚠⚠ **The rebuild is only needed to REMOVE a chain, and removal is the human's
   job by decision.** §4.16 and D17g/§4.12: pruning deletes audible material and
   frees CPU, so it is a user-visible act and *"the agent may never reap"* is
   already our policy. **The chain-delete ○ binds the agent, not the human** — a
   human deletes a layer with one gesture and one undo step, and E17 confirmed the
   named `Delete` removes the correct chain by `channelId` once a lane is clicked.

⇒ ⚠ honest reading: **7 vs 3 when the agent prunes autonomously; 1 vs 1 when the
human does.** The 7 lands only where the design already says the agent should not
be acting.

---

## 4. ⚠⚠ The clip half — slot blocks, and the mechanism that advances itself

⚠ **This section changed the most under operator review**, and it changed direction:
a first draft treated the clip half as the *weakest* part of the split model. It is
now the part carrying the capability nothing else in either model can supply.
⚠ It is also still the part with the least *measured* evidence behind it.

### 4a. ⚠ Slot launching always — a scene is a ROOM primitive, not a take primitive

⚠ **CLARIFIED 2026-08-04.** A first draft read the proposal as *scene*-based A/B and
spent a section refuting it. That was not the proposal:

> **Operator:** *"yes, slot launching always. What I meant by the potential need to
> add scenes was when there isn't any room left in a track to add a new clip
> without removing another, given the limited slots provided by the current
> scenes."*

⇒ **A/B is `slot.launch`, per track, always.** Scene rows are never the take unit;
`Project.createScene()` is called only to make **room** when a track's column has no
free slot for another alternate. This removes the hazard the first draft raised —
nothing ever launches a whole row, so the empty-slot-stops-the-track question never
comes up.

### 4a′. ⚠⚠ The clip BLOCK, and why it is the strongest single argument in the whole comparison

The operator's second clarification is a capability neither device mechanism has:

> **Operator:** *"We might even want to guarantee an empty slot space around a
> contiguous group of clips that each represent a 'take', because that establishes
> a 'clip block' that Next Actions can act on automatically with round-robin or
> similar. […] Next Actions can automatically advance between them for quantized
> comparison without a human or agent manually triggering clips."*

**The geometry:** a take block is *n* contiguous clips in one track's column, bounded
above and below by an empty slot. Bitwig's Next Action targets (round-robin, next,
random) then operate within that block, because the empty slots delimit it.
⚠ **The delimiting rule is the operator's premise, from experience — not measured
here.** The consequence, if it holds, is large:

⇒ ⚠⚠ **The A/B becomes automatic and quantised: the takes cycle themselves while
the musician listens, with no gesture from the human OR the agent.** Nothing in the
device models can do this. A chain solo is a discrete write someone has to make;
comparing three takes means three writes at three moments the listener has to choose.
A clip block compares them **hands-off, on the bar, in a loop.**

⚠ **And it is a within-ONE-TRACK argument specifically.** Alternates spread across
sibling tracks cannot auto-advance — there is no follow action across tracks. So
this favours the split model over the track model *for clips*, on an axis the pitch
tables never had.

⚠⚠ **CORRECTED AGAIN, 2026-08-04 — this section has now over-claimed twice and the
operator caught both.** First it quoted the auto-advance and the quantised switch as
one capability; then §4a″-bis's `launchWithOptions` find was allowed to read as if it
recovered the lost half. It does not:

> **Operator:** *"But that still requires active triggering for each launch,
> regardless of the quantization setting, right? I was just wondering if we could
> unlock automatic, unattended (by the agent or extension) A/B clip auditioning for
> the operator. Seems like that is not available to us."*

⚠⚠ **Right on both points.** `launchWithOptions` is a **verb, not a setting** — it
governs *how* a launch behaves, never *whether* one happens. Every switch it
performs still needs a caller. **Engine-driven unattended cycling exists in Bitwig
and is reachable only through the Next Action we cannot touch.**

⇒ ⚠⚠ **Score §4a′ honestly: the auto-advance is NOT a capability we deliver.** The
block *layout* is ours to build and maintain; the behaviour on top of it is a
one-time human gesture in the inspector. It belongs in the comparison as **"a thing
the operator can set up once, which the layout enables"** — not as something the
system does.

**One route was considered and set aside.** `ControllerHost.scheduleTask(Runnable,
long)` plus `Transport.playPosition()` would let the **extension** fire
`launchWithOptions` on a timer — and ⚠ the quantisation makes that *musically*
exact despite sloppy scheduling, since we can fire anywhere in the bar and the
engine snaps the switch to the boundary. ⚠ It would also be unattended by the
*operator*, and the extension is alive whenever Bitwig is (`E16-REPLAN` §2 session
3), so it would not die with a chat session. ⚠⚠ **The operator excluded it by name**
— *"unattended (by the agent or extension)"* — and the exclusion is defensible: it
puts us in the loop driving the musician's listening experience, which is the
opposite of the model's posture that the project state is the truth. **Recorded so a
later reopening inherits it rather than rediscovering it.**

### 4a″. ⚠⚠ BUT: Next Actions are NOT in the controller API — and the negative is a SHARP one

⚠ **The operator asked the right question**, and it deserved a second pass:

> *"Next actions are just a dropdown in the clip details view in the inspector
> panel. Could they be similar in the API? Just a property of launcher clips
> somewhere?"*

⚠⚠ **The premise is correct — the API DOES expose that inspector panel, and
documents it in exactly those terms.** Which is what makes the absence mean
something rather than being an artifact of our search:

| member | its javadoc, verbatim |
|---|---|
| `Clip.launchMode()` | *"Setting **"Launch Mode"** from the inspector."* |
| `Clip.useLoopStartAsQuantizationReference()` | *"Setting **"Q to loop"** in the inspector."* |
| `Clip.launchQuantization()` | *"Setting for the default launch quantization."* |

⇒ ⚠⚠ **Three of the neighbouring fields in the very same inspector section are
exposed and labelled as inspector settings. Next Action is not.** This is not a
panel Bitwig forgot to surface; it is one field left out of a panel they surfaced.

**Method — stronger than the first pass, which was name-matching.** Every relevant
class dumped **in full with its descriptions** from the javadoc's own summary
tables, per the E16l complete-recall standard:

| class | members, all read | follow/next action? |
|---|---|---|
| `Clip` | **61** | ⚠ **none** |
| `ClipLauncherSlot` | **16** | ⚠ **none** |
| `ClipLauncherSlotOrScene` | **21** | ⚠ **none** |
| `ClipLauncherSlotBank` | **18** | ⚠ **none** |
| `Scene` | **8** | ⚠ **none** |

⚠ **And the decisive check: the string "next action" appears NOWHERE in the entire
javadoc tree** — zero hits, case-insensitive, across every file. Since the docs
describe these settings *by their inspector label* (the table above), a field whose
label never appears is not present under some other name.

⚠ Every keyword hit was a false positive and each was resolved to its class:
`selectNextAction()` is `Cursor`/`Application` **navigation**; `recurrence*` and
`setRecurrence(int,int)` are **`NoteStep`** (per-step note recurrence);
`repeatCount`/`repeatVelocityCurve` are note-repeat on note input.

### 4a″-bis. ⚠⚠ The consolation is much bigger than the loss

⚠ **Chasing this turned up the two things that matter most for the clip A/B**, and
they are ours today. `launchWithOptions(String quantization, String launchMode)`
(API v16), on `ClipLauncherSlotOrScene` **and** on `Clip`:

| parameter | legal values, verbatim from the javadoc |
|---|---|
| `quantization` | `"default"`, `"none"`, `"8"`, `"4"`, `"2"`, `"1"`, `"1/2"`, `"1/4"`, `"1/8"`, `"1/16"` |
| ⚠⚠ `launchMode` | `"default"`, `"from_start"`, `"continue_or_from_start"`, ⚠⚠ **`"continue_or_synced"`**, `"synced"` |

1. ⚠ **Quantisation is a PER-CALL override, at bar and phrase granularity.** We do
   not merely inherit the project's launch quantisation — we can force a take switch
   to land on the bar (`"1"`) or on an 8-bar phrase (`"8"`), per launch. E16m's
   complaint is not just answered, it is answered with a knob.
2. ⚠⚠ **`"continue_or_synced"` is the take-comparison launch mode.** Take B picks up
   at A's playback position instead of restarting — so switching mid-phrase renders
   **the same bar, differently**, rather than jumping back to the top of the loop.
   ⚠ **That is precisely the A/B a musician wants and no mute, solo or chain switch
   can imitate it.**

⇒ ⚠⚠ **Separate the two capabilities — and do NOT read the first as recovering the
second.** `launchWithOptions` is a **verb**: it decides how a switch behaves, never
that one occurs. Each launch still needs a caller.

| | who triggers each switch? |
|---|---|
| ⚠ **quantised, position-continuous take switching, on demand** | ⚠ **● OURS** — but **one call per switch**, always |
| ⚠⚠ **hands-off auto-advance — nobody triggering at all** | ⚠⚠ **○ UNAVAILABLE TO US.** Engine-driven cycling exists only through the Next Action, so the human arms it or it does not happen |

⚠ **So the clip half's MUSICAL QUALITY does not rest on the unexposed feature** —
beat-aligned, position-continuous switching is fully ours. ⚠⚠ **But its
UNATTENDEDNESS does**, entirely. A first draft conflated the two; a second let the
`launchWithOptions` find read as if it closed the gap. It does not close it.

⇒ ⚠⚠ **We can neither set, read, nor verify a clip's Next Action.** Consequences,
and they are not fatal:

1. ⚠ **The human arms the block once**, in the inspector. This joins the preset
   library (rule 11 / E4h) as the second human-authored dependency in the design —
   and it is a *better* one, because it is a single per-block setting rather than an
   asset pipeline.
2. ⚠ **The engine runs it without us.** Once armed, round-robin needs no wire call,
   so the auto-advance is not degraded by the API gap at all — only its *setup* is.
3. ⚠⚠ **We CAN maintain and verify the geometry**, which is the part that must not
   drift: `ClipLauncherSlot.hasContent()` reads every slot, so contiguity and the
   bounding empty slots are a checkable invariant, and `slot.moveTo` (● 163 ms,
   E16s) plus `createScene()` are the tools to restore it.
   ⇒ **the division of labour is clean: the agent owns the block's shape, the human
   owns its behaviour.**
4. ⚠ **We cannot warn when the human's Next Action and our block disagree** — an
   unarmed block looks identical to an armed one from the wire. Same shape as E17's
   priming hazard: an invisible precondition. ⚠ Worth an explicit affordance rather
   than silence.

### 4a‴. ⚠ The room problem has one sharp edge: appending is safe, inserting is not

`Project.createScene()` **appends at the end** and is instant (E3) — safe, because
nothing below shifts. ⚠ But `ClipLauncherSlotOrScene` also exposes
`nextSceneInsertionPoint()` / `previousSceneInsertionPoint()`, which insert a row
**in the middle** — and a mid-grid insert shifts every row below it, exactly as
`Scene.deleteObject()`'s upward compaction does (E3), with the same permanent
`sceneIndex` staleness on any pinned cursor.

⚠ **This is the geometry's one real hazard, and it is invited by the design**: a
block that needs to grow *in place* wants an inserted row, and an inserted row moves
everybody else's addresses.

> **Proposed discipline: APPEND ONLY.** Grow the grid at the end and relocate the
> block downward with `slot.moveTo` if it must stay contiguous — a move is measured
> (163 ms) and is detectable as a pair by the launcher-content observer (E16s), so
> it is both cheap and self-reporting. ⚠ Never insert a row mid-grid without
> re-resolving every clip address afterwards.

⚠ **One coupling to state plainly:** room is **per track** (a column), but a scene
row is **project-wide**. One track running out of space costs a global row, which
arrives empty for every other track. Harmless, but it is how the launcher grid
accumulates.

### 4b. What is already measured for it

| | |
|---|---|
| `Project.createScene()` appends at the end | ● instant (E3) |
| ⚠ **`Scene.deleteObject()` COMPACTS rows upward** | ⚠ addresses shift ⇒ **discipline: append only, never delete a row** |
| ⚠ a pinned cursor's `sceneIndex()` goes **permanently stale** after compaction | ⚠ re-point after any scene structural op (E3) |
| clips and scenes have **no identity at all** | ○ complete pass over 1968 members (E16l) |
| a clip move is **PUSHED** as a pair, human drag and API move alike | ● `t2s7=emptied, t2s3=filled`, agreeing with the human's independent report (E16s) |
| `slot.moveTo` is ours to perform | ● **163 ms** via `replaceInsertionPoint().moveSlotsOrScenes()` (E16s) |
| `slot.launch` is on the wire | ● shipped (`methods.golden.json`); E16w/E16m launched clips through it, and ⚠ **a launch starts the transport itself** |
| `ClipLauncherSlot.duplicateClip()` exists | ⚠ **UNPROBED** — the API sweep found it; nothing has run it. This is the primitive that mints the next take |
| ⚠ **"which take is live" per track** | ⚠ **● better than either device mechanism** — `isPlaying()`, and ⚠ **`isPlaybackQueued()` / `isStopQueued()`**, so a *pending* switch is readable too. Solo flags have no equivalent |
| ⚠⚠ **per-launch quantisation AND launch mode are ours** | ⚠⚠ **● `launchWithOptions(quantization, launchMode)`** — quantisation `"1"`/`"8"`/… per call, and ⚠⚠ **`"continue_or_synced"` makes take B resume at A's position instead of restarting** (§4a″-bis). Plus `Clip.launchQuantization()`/`launchMode()` per clip, `Transport.defaultLaunchQuantization()`. ⚠ **UNPROBED, none on our wire yet** |
| ⚠ **Next Actions** | ⚠⚠ **○ NOT IN THE API** — and it is a sharp negative: the *neighbouring* inspector fields ARE exposed and documented as such (§4a″) |
| scene budget | ● `SCENES=128` measured at 25–28 ms cold (E5c) |

### 4c. ⚠ The one thing only this half can deliver

`E16m` recorded a negative the design has no answer for:

> *"It muted and unmuted at regular intervals without any clicks or glitches, which
> is fine. **It would be better if it were aligned to beat or measure boundaries.**"*

⚠ **Neither device mechanism can fix that.** Mute is measured unquantised; nothing
suggests layer solo differs. **Clip launch is the only gesture in Bitwig that is
quantised by construction** — ⚠ operator-confirmed 2026-08-04 (*"Clip launch is
quantized, and per-slot leaves other tracks alone"*), and the API backs it with more
control than the claim needs: `launchWithOptions(quantization, launchMode)` lets us
**override the quantisation per launch**, and `Clip.launchQuantization()` sets it per
clip.

⇒ ⚠⚠ **The clip half is the only part of either model that delivers the A/B the
user asked for in E16m** — and §4a′ goes further: with a block armed, the comparison
runs itself. **Nothing in the device models competes with this**, and it is an
argument for the split that has nothing to do with layers being good.

### 4d. What it costs

- ⚠ **Litter moves, it does not disappear.** The launcher grid fills with
  alternates instead of the mixer filling with tracks. Milder — you scroll past
  rows, and they are absent from the mixer and the arranger — but it is the same
  trade with the sign flipped, and it should not be scored as a free win.
- ⚠ **Addressing is positional, permanently.** No clip identity exists and none is
  coming (E16l is a complete pass). The guard is the content fingerprint, which
  D16e's stash already provides free — ⚠ but it only works *before* our own write
  changes the content, and two identical clips are indistinguishable.
- ⚠ **Fork-first's protection is lost for clips.** §2.6: under fork-first a
  mistargeted clip write damages a duplicate. Under slot-branching the write goes
  to a real clip in the human's project. **The clip half must re-earn that
  protection** — write to the new alternate slot, never the live one.
- ⚠ **LAUNCHER ONLY.** `INITIAL_PROMPT` §285: *"Launcher clips > arrangement clips
  in API reliability."* Arrangement is Phase 6. **If the project ever moves to the
  arranger this mechanism has no analogue** — a tripwire to write down now rather
  than rediscover.

### 4e. ⚠ The linkage problem, which is the honest cost of splitting

Under the split, **nothing links a device take to a clip take.** There is no object
that says *"take B = chain B + row 3"*. That correspondence must live in either:

- a **naming convention** — E16q measured the middle dot round-trips exactly, so
  `B·take` on both is available and consistent with what the model already does;
  ⚠ fragile, because names are human-editable by design (§4.13); or
- **`getDocumentState()` metadata** (answer 3), which the model already needs for
  provenance (§4.14) — ⚠ but whose capacity for a JSON payload is *still* unmeasured.

⇒ ⚠ The user's own doubt — *"I'm honestly not sure how often this would happen"* —
is the right question, and the record cannot answer frequency. What it can say is
that **the split does not make combined takes impossible; it makes them a
coordination problem**, and coordination problems fail silently. §6 proposes not
solving it.

---

## 5. The hybrid options, and which one is coherent

| | shape | verdict |
|---|---|---|
| **A. Free union** — the agent picks per situation | two identity models, two collapse procedures, and a **classification heuristic** deciding which | ⚠⚠ **SUPERSEDED 2026-08-05 — see `HYBRID-AUTONOMY-LEVELS.md`.** The objection below is right but aimed at the wrong target: it describes that document's **L4** specifically, not free choice as such. A union is a LADDER of five rungs, and L2/L3 are also "the agent chooses" without L4's failure shape. ⚠ Original verdict, kept: *argue against for v1 — the heuristic is the kind of thing that is wrong silently, and the human has to understand both models to read their own project* |
| **B. Split by object type** (the user's proposal) | device change → chain; clip change → row; everything else → stash | ● one rule, no heuristic — but leaves §4e unanswered |
| ⚠ **C. Split by object type, with the track fork as the ESCAPE HATCH** | B, plus: **a change that spans both, or one the user explicitly wants visible, forks the track** | ⚠ **the one I would build** |

⚠⚠ **2026-08-05 — B and C are not rival categories either.** Under the ladder they
are **L0/L1 with different dispatch tables**: C's *"if it touches both, fork the
track"* is literally L0's third clause. ⇒ **§5's three options were points on one
ladder, and A was mislabelled as a category.** ⚠ And §7 of that document names the
distribution that decides between them — the mixed-change rate — as **measurable in
shadow mode, wired to nothing, before any branching is built.**

**Why C rather than B.** It keeps a single decision rule — *one branch object per
change, chosen by what the change touches* — and answers §4e by **refusing to
coordinate two mechanisms**: when a take is both, use the one object that already
holds both. That also restores §2.1's visibility and §2.6's fork-first protection
for precisely the cases that most deserve them, which are the deliberate, coarse,
"I am about to try something big" branches. And it costs nothing to build: the track
fork already exists and is proven (E16k, C5, E16u, E16r).

⚠ **What C gives up honestly:** three branch shapes in the codebase and in the
human's head. The mitigation is that the rule is mechanical rather than
judgemental, so the agent never *chooses* — it reads what the change touches.

---

## 6. ⚠⚠ The recommendation — ⚠ REPURPOSED 2026-08-06, not discarded

> ⚠⚠ **The operator has since DECIDED, and the decision dissolves this section's
> question rather than answering it: a HYBRID is the model — all three mechanisms
> are built and the agent chooses between them.** See `HYBRID-AUTONOMY-LEVELS.md`.
>
> ⇒ ⚠ **What follows below is now the DETERMINISTIC CONTROL RULE**, computed
> silently per branch event and **used for nothing**, against which the agent's live
> choice is compared. **The analysis stands; only its job changed** — it went from
> a policy proposal to an instrument.
>
> ⚠⚠ **And it must never reach the agent's tool surface.** The whole value of the
> comparison is that the agent has not seen it (`HYBRID-AUTONOMY-LEVELS.md` §4). A
> leak contaminates every event logged afterwards, irrecoverably.
>
> ⚠ §1's scoreboard remains the substance of what tool descriptions must convey —
> **as trade-offs, never as rules.**

**Go with the split, in form C** — layer chains for device takes, appended launcher
rows with per-slot launch for clip takes, the track fork retained for takes that
span both or that the user asks to be visible, and the stash unchanged underneath
all three.

⚠ **The CALL IS OPEN.** The operator has not made it (*"not ready to make a call
yet"*, 2026-08-04) and rule 10 says it is theirs. This is where the argument stands,
not what was decided.

**Why, in one paragraph.** The three rows that used to decide this for tracks have
all moved. *Destroy* stopped being a wall and became a 4276 ms cost that lands on
the actor least likely to pay it (§3f). *Durable identity* nearly dissolved once
UC8 and UC11 were cut and the system went stateless (§3d). *Clips* is the only one
that held, and it is what §4 is for. Meanwhile layers won three rows outright that
nothing anticipated: a rebuild can be **silent during playback** where a fork cannot
(`e18h`); a take structure can be **reorganised after it exists** where tracks cannot
be re-parented at all (`e18c` vs K2); and there is **no one-click exclusive A/B for
tracks at all** — mute is not exclusive, solo is not local (§3b). Against that, the
layer model's own worst result — 7 undo steps — is 7-vs-3 rather than 7-vs-1 and
lands where policy already says the agent should not act.

⚠ **The clip half is not a consolation prize, and that changed during review.** It
carries the one thing the user asked for and nothing else in the design supplies —
a **beat-aligned** A/B (§4c) — and it goes further than "beat-aligned":
`launchWithOptions("1", "continue_or_synced")` makes the outgoing and incoming takes
**share a playback position**, so a switch renders the same bar differently instead
of restarting the loop (§4a″-bis). ⚠ **No mute, solo or chain switch can imitate
that**, and it does not depend on any layer result being right.

⚠⚠ **What the recommendation must NOT lean on: hands-off auto-advance.** It is real,
it is what the block layout exists for, and it is **not ours to deliver** — the human
arms a Next Action we cannot set, read or verify (§4a′, §4a″). ⚠ Score it as an
affordance the layout unlocks *for the operator*, never as a system capability. The
part §6 rests on is the switch itself, which is ours.

⚠ **All three of the user's layer advantages survive contact with the record**, and
the sharpest one nearly got lost: **one-click exclusive A/B is a capability gap in
the track model, not a preference** (§3b — Bitwig offers mute, which is not
exclusive, and solo, which flips 10 tracks; a take A/B needs one that is both).
⚠ Meanwhile one argument that has been carried *alongside* them is wrong and should
be dropped: the bank window (§3a).

⚠ **And one of the user's track advantages is worth more than they gave it credit
for:** in a stateless system the project is the take log, so a take you cannot see
without expanding a device container is a degraded log (§2.1). ⚠ **That is the real
price of C** — and note §4 does *not* pay it, since launcher clips are as visible as
tracks are. **The visibility cost is confined to the device half.**

---

## 7. ⚠ Owed before the plan commits

### 7a. ⚠⚠ THREE ITEMS RESOLVED BY OPERATOR JUDGEMENT, 2026-08-04 — recorded as such, not as measurements

A first draft listed three cheap measurements and called the first *"the one that
could flip it"*. The operator dispositioned all three from experience. ⚠ **Recorded
here in the house convention** — the same one `E16-TRACK-NATIVE` §2 uses for
*"the switching cost of `isActivated(false)` (user's report, not our measurement)"*
— so that a later surprise has something to re-open rather than a silence.

| item | disposition | ⚠ retirement condition |
|---|---|---|
| **dormant layer-chain CPU** — do dead chains accumulate load? | ⚠ operator: *"the same or less cost CPU wise"* | if a session of exploration ever degrades the engine, this is the first assumption to re-test. ⚠ There is **no CPU anywhere in the controller API**, so it can only ever be a human reading the engine meter |
| **container transparency / PDC** — does wrapping a subset colour the patch? | ⚠ operator: *"PDC and audio in general are definitely transparent"* | if a take structure ever sounds different from its top-level equivalent |
| **clip launch quantisation + per-slot independence** | ⚠ operator: *"Clip launch is quantized, and per-slot leaves other tracks alone"* | ⚠ **partly measured already**: `slot.launch` is shipped and exercised (E16w/E16m), and the API exposes `launchWithOptions(quantization, launchMode)` — so if the default ever disagrees, we can force it |

⇒ ⚠ **§3c's subset-scoping advantage and §3f's "pruning is the human's job" both
now rest on operator judgement rather than measurement.** That is a legitimate
input and it is how the two most expensive open items got closed — but the
dependency should be visible, not buried.

### 7b. ⚠ NEW, and it arrived with the clip-block design

- ⚠⚠ **Next Actions are not in the controller API** (§4a″ — five classes dumped in
  full with descriptions, and the string *"next action"* absent from the entire
  javadoc tree, in docs that name these settings by their inspector label). Not a
  measurement to take — a **design consequence to absorb**: the human arms a block,
  we own its geometry, and **we cannot tell an armed block from an unarmed one.**
  ⚠ Decide deliberately what the agent says when it builds a block it cannot arm.
  ⚠ Scope it correctly, though: only the *hands-off* half is lost (§4a″-bis).
- ⚠ **The block-delimiting rule is an operator premise, not measured** — that
  contiguous clips bounded by empty slots are what a Next Action's round-robin
  scopes itself to. §4a′'s *auto-advance* rests on it entirely. ⚠ Cheap to confirm
  by ear the first time a block is built, and worth doing then rather than as its
  own probe.
- ⚠⚠ **`launchWithOptions(quantization, launchMode)` is the clip half's most
  valuable unclaimed primitive and is UNPROBED** — it is what makes the A/B land on
  the bar and, with `"continue_or_synced"`, resume at the outgoing take's position
  rather than restarting the loop (§4a″-bis). ⚠ **Wire it and probe it before the
  clip half is designed**, because the whole ergonomic claim runs through it.
  ⚠ `ClipLauncherSlot.duplicateClip()` is likewise unprobed and mints the next take.

### 7c. Already on the books, carried forward

- ⚠ **the MOVE trade-off's other half** — `e18h` measured the *engine*, with audio
  deliberately on a different track. Whether a MOVE leaves an audible **hole in the
  migrated take's own output** is unmeasured, and it is the choice between a click
  and a gap. **Record both, decide neither.**
- ⚠ **the cross-device modulator case** — E11e's form, whose path encodes a device
  **INDEX**, which is exactly what a rebuild renumbers. `e18e`'s ●● 3/3 says nothing
  about it. A session of its own.
- **`getDocumentState()` capacity for a JSON payload** — §4e's fallback depends on
  it and it has never been measured.

---

## 8. ⚠ The honest counter-argument to §6

Stated at full strength, because §6 is a recommendation and not a measurement.

**The track model is one object, one undo, one identity, visible everywhere, with an
exact delete that returns the CPU — and it is already built and already proven.**
Everything §6 recommends trades that simplicity for capability.

⚠ **What the counter-argument LOST during review, stated honestly.** A first draft
rested it on four unmeasured tails; three were dispositioned by the operator (§7a)
and the fourth — one-click A/B — turned out to be a *measured gap in the track
model*, not a layer risk. ⚠ **So "one gesture" has been struck from the list above**:
the track model does not have one, and that was never a tie-break in its favour.

**What survives, and it is not nothing:**

- ⚠ **§7a's three closures are judgement, not measurement.** The two most expensive
  objections to the layer model were retired by experience rather than by a probe,
  and both have named retirement conditions precisely because they could return.
- ⚠⚠ **The clip half now carries more weight than the layer half, and its most
  eye-catching part is not ours.** Hands-off auto-advance (§4a′) needs the human to
  arm a Next Action the API cannot set, read or verify (§4a″), and the rule that
  scopes it — contiguous clips bounded by empty slots — is an **operator premise
  this spike has never tested**. ⚠ `launchWithOptions` does *not* rescue it: it is a
  verb, one call per switch (§4a″-bis). ⚠ **What is ours is the switch's musical
  quality, and even that is a javadoc reading rather than a measurement** — unprobed
  and not on our wire. ⇒ **the clip half is the least-evidenced part of §6**, and it
  is the part §6 leans on hardest.
- ⚠ **The linkage problem (§4e) is unsolved, not solved** — §5's option C *avoids*
  it by forking a track when a take is both. That is a fallback, and how often it
  fires is exactly the frequency question the record cannot answer.

⚠ **And the deepest objection is not measurable at all:** whether a take system
whose device takes live inside a container is one the human can actually read.
`E16-TRACK-NATIVE` chose the project as the log specifically so the human could see
and manipulate it directly. §6 puts half the log somewhere they must go looking —
⚠ though only half, since launcher clips are as visible as tracks (§6). **That is a
product judgement, and it is the user's** (rule 10).
