---
id: E10e
kind: evidence
state: active
source: FINDINGS.md
---

# E10e — TYPE substitution: the "category" reading was WRONG (see E10f) (2026-07-21)
> **⚠ CORRECTED BY E10f (2026-07-21).** This entry concluded type substitution is
> gated by modulator **category** (`0x009c`). That was a **spurious correlation**.
> E10f isolated the real invariant: a unique per-modulator instance id (`0x1a1b`).
> E10e-R1/R2 replaced a slot-0 modulator whose id (0) matched the donor's, keeping
> ids unique → load; E10e-R3 replaced a slot-1 modulator, so the donor's id (0)
> **collided** with the slot-0 modulator's id (0) → duplicate → reject. Category
> tracked the outcome only because the donor's native id happened to be 0. Type
> substitution works **across categories** (E10f-A1), at any slot, given a unique
> id. Read the mechanics below, but take the verdict from E10f. The length-vs-gate
> reasoning (R1/R2/R3) and the "length is not the gate" result remain correct.

### E10e original writeup (mechanics still valid; the "category" verdict is not)

**Verdict: ◐→● type substitution works by whole-object replacement WITHIN a
modulator category; the earlier ○ was a cross-category confound, not a real
wall.** E10c concluded "the container rejects object INSERTION outright" from a
`Expressions → Classic LFO` replace that failed. That was three confounds in a
trench coat — length, donor-foreignness, and content. Isolating them shows the
real gate is **category compatibility**, and same-category replacement loads
cleanly at any length. Probe `e10e-replace`, all green. This **reopens the type
axis of E7 Finding H** (partly). Credit: the user pushed for the length-isolated
replace test and the minimal-pair strategy that will finish the job.

### The isolation

`insertFile` of modtest (Polysynth + Vibrato[LFO] + Expressions[Note-driven] +
LFO), each variant a whole-object replace with meta `referenced_modulator_ids`
repaired. Donor length tuned by padding an empty string field (E10b's trick):

| variant | replace | Δlen | result |
|---|---|---|---|
| S1 | pad modtest's own LFO object in place (no replace) | +80 | ● loads (padding is neutral) |
| R1 | Vibrato[LFO,slot0] ← **Classic LFO[LFO]**, padded to EXACT 773B | **0** | ● loads, live Classic LFO |
| R2 | Vibrato[LFO,slot0] ← **Classic LFO[LFO]**, native 579B | **−194** | ● loads, live Classic LFO |
| R3 | Expressions[**Note-driven**,slot1] ← Classic LFO[LFO] (E10c repro) | **+120** | ○ whole preset rejected |

**Length is decisively OUT:** R2 loads *shorter*, R3 rejects *longer*. And in
R1/R2 the Classic LFO **instantiated live** — its own remote page appeared and
the untouched slot-2 LFO→F1FREQ route survived. This is the exact swap E7g got
"Missing" from (GUID-only), now working because the whole object (GUID + payload)
moves together.

### Why E10c was wrong — the category field

All five modulators (Vibrato, Expressions, LFO, Classic LFO, Random) share
**classId `0x06c9`**, so class does not gate it. The field that splits the result
is **category (`0x009c`)**:

| modulator | category | as donor into an LFO slot |
|---|---|---|
| Vibrato, LFO, Classic LFO, Random | `LFO` | ● works |
| Expressions | `Note-driven` | ○ rejected |

E10c's `Expressions → Classic LFO` and E7g's cross-family GUID swaps were all
**`Note-driven`/other ↔ `LFO`** — category mismatches. The container appears to
reject a modulator whose category is incompatible with its slot/context. A
Note-driven modulator taps the note stream; an LFO is free-running — plausibly a
different connection shape the graph won't accept in that position.

### ⚠ Open confound — category vs slot POSITION (hands off to minimal-pair presets)

R1/R2 replace **slot 0**; R3 replaces **slot 1**. Both donor presets carry ONLY
`LFO`-category modulators, so "same category" and "slot 0" cannot be separated
with current fixtures, and neither can "cross category" from "slot 1". The
competing hypothesis — *replace works only at slot 0* — is not yet excluded.
**This is the single open question.** It needs minimal-pair presets specifically:
a `Note-driven` modulator at **slot 0**, and an `LFO` at **slot 1**. Then:
`Note[slot0] ← LFO` failing would confirm category; `LFO[slot1] ← LFO` loading
would kill the position hypothesis.

### Decision impact (provisional, pending the confound)

- **The type axis of E7 Finding H shrinks from "impossible" to "within-category".**
  If category is the gate (likely), one template per **category** covers every
  type in it — LFO, Classic LFO, Beat LFO, Steps, Random, etc. are one template,
  not five. That is a large reduction, short of fully free but far from E10c's ○.
- **E10c's headline claim is corrected**, not deleted: object *insertion* (adding
  a modulator, growing the count) is still untested-as-blocked; only *replacement*
  is now shown to work. Deletion (E10c) and replacement (here) both work; adding
  remains the open ✗.
- **`patch`-level type swap** joins the templating helper: replace the whole
  modulator object from a same-category donor, repair `referenced_modulator_ids`,
  verify by remote-page readback. Length-free.

### Method note — the contradiction WAS the finding (again)

The first e10e run (R1/R2 only) concluded "replace works at ANY length" and would
have been recorded as flatly contradicting E10c. Adding R3 — the exact E10c
scenario — reproduced the rejection and revealed the category boundary hiding
under the length variable. **Reproducing the prior result inside the new harness
is what converted a contradiction into the actual mechanism.** Do not record a
"we overturned X" without re-running X's exact case in the new setup.

---
