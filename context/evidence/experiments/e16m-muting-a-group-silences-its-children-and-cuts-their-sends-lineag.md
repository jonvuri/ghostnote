---
id: E16m
kind: evidence
state: active
source: FINDINGS.md
---

# E16m — muting a GROUP silences its children AND cuts their sends: lineage-level A/B is real [K] (2026-07-30)

**Verdict: ● both halves, and the second one did not have to go this way.**
Muting a group takes its children's dry path *and* their sends with it, pre- and
post-fader alike — so auditioning a whole lineage against the arrangement is
correct in the wet path, not just the dry one. The ergonomic claim the
track-native model leans on hardest (E16k left it explicitly unmeasured) now
rests on a measurement. ⚠ **One new negative falls out and it is a design
input: the mute is NOT quantised to the beat, and the user wants it to be.**
Probe: `e16m-groupmute.ts`. Fixture `gn-E16` inside the human-made `Group 7`.

| row | question | result |
|---|---|---|
| M1 | does muting a GROUP silence its children? | ● **yes** — master **56 open → 2 muted**, floor 1 |
| M2 POST | does it cut the child's post-fader send? | ● **yes** — FX return **39 → 1** |
| M2 PRE | does it cut the child's pre-fader send? | ● **yes** — FX return **51 → 1** |
| ear | discriminated from placebo? | ● 5/5 real vs 0/1 placebo, **no clicks on any transition** |

### Why M2 is the half that mattered

M1 was widely expected. **M2 does not inherit E2's answer and could easily have
gone the other way.** E2 measured that a track's own mute cuts its own sends;
this is a different topology question, because a child's main output flows *into*
the group while its send is tapped on the child and routed straight to the
return. A parent's mute could sit entirely downstream of that tap.

Had it, the failure would have been the worst available shape: **the lineage
silent in the mix, the mixer showing it muted, and its reverb still feeding the
bus** — with the obvious oracle agreeing with you. It does not. Both fader modes
cut, and the pre-fader case is the load-bearing one since a pre-fader send
bypasses the fader by definition.

### The controls, and why each reading means something

Every muted reading is paired with two controls, per rows D–G trap 6 (two
silences must never make a green):

1. **The floor is a floor.** Master read 1 with the child muted by its *own*
   mute while the child's PRE-MUTE meter read **58** — so the silence is a mute,
   not a gap between notes.
2. **The clip kept playing.** Through every group-muted window the child's own
   meter read **56–58**, and through both send windows **57–58**.
3. **The send was live before it was cut.** FX read 39 (POST) and 51 (PRE) with
   the group open, so a muted reading of 1 means something was cut rather than
   that nothing was ever routed.
4. **Parentage was proved, not assumed**, by the collapse oracle — `gn-E16` left
   the bank 258 ms after `Group 7` folded and came back on expand. A flat bank
   makes a child and a sibling look identical, so adjacency would not have done.

### ⚠ Three things worth carrying beyond this row

1. ⚠ **A child's own mute flag is NOT changed by muting its parent** (measured,
   0/3 windows). Combined with trap 1 — the VU tap is pre-mute, and here the mute
   under test is on a *different track* entirely — this means **neither a child's
   meter nor its mute flag can tell you whether its lineage is audible**. Nothing
   may infer lineage state from the children. That is §4.1's mute-overloading
   problem one level up, and it is worse there, because at least a leaf's own
   flag is honest about the leaf.
2. ⚠ **The mute is not quantised.** The user, asked openly after 8 toggles:
   *"Yes, mostly. It muted and unmuted at regular intervals without any clicks or
   glitches, which is fine. It would be better if it were aligned to beat or
   measure boundaries."* This closes a question E1 left open — it recorded
   *"instant - unsure about quantized to the beat as I didn't think to listen to
   that"* — and answers it in the unwanted direction. **The gesture is usable but
   not musical**, and nothing in the current design proposes to fix it.
   ⚠ Unmeasured whether Bitwig offers quantised mute at all; the mixer's mute is
   what `branch.setMixer` drives and it lands immediately.
3. **Group-muted master read 2, against a child-muted floor of 1** — consistently,
   3/3. That is one step, at exactly the `CUT_EPSILON` boundary E2 earned by
   sweep, and it is 2 against 56 open, so it carries no musical weight. Recorded
   rather than rounded away: if a later row wants to claim group mute is
   *identical* to child mute, this is the datum that says it was one step off.

### ⚠ The weak point in this row, stated rather than buried

**The placebo arm is one trial.** The coin flip came up 5 real / 1 placebo, so
the ear half is 5/5 vs **0/1** — consistent, and far thinner than C5's 5/5 vs
0/3. On its own that is under-powered evidence. The row does not rest on it: the
master-bus separation (56 → 2, three alternated repetitions, non-overlapping
spreads) is an independent instrument and it is what carries M1. The ear's job
here was only to confirm the meter was not lying, and it did. **A future
audible row should force the arm balance rather than trusting a coin.**

### Method note — the check that would have failed on a true result

The verdict block reports M1 three ways (silences / does not reach / partially
attenuates) and asserts only that the reading is not stranded in the noise
between floor and open. An earlier draft asserted `silences || separated`, which
would have printed a red X against a perfectly clean ○ — `e16j`'s
self-validating-control mistake in a new costume, caught before the run rather
than after. Same for the ear half: it checks that **the ear agrees with the
meter**, not that the listener heard a mute, because if M1 had come back ○ the
correct thing to hear was nothing.

---
