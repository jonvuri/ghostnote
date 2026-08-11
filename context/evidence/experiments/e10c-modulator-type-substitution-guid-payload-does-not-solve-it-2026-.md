---
id: E10c
kind: evidence
state: active
source: FINDINGS.md
---

# E10c — Modulator TYPE substitution: GUID+payload does NOT solve it (2026-07-20)
> **⚠ SUPERSEDED IN PART by E10e (2026-07-21).** E10c's "the container rejects
> object INSERTION outright" over-generalised from a single **cross-category**
> replace (`Expressions[Note-driven] → Classic LFO[LFO]`). E10e shows
> **same-category REPLACE works** at any length; the rejection E10c saw is a
> category-compatibility gate, not a blanket insertion block. E10c's DELETE
> result and the still-open *add-a-modulator* (grow the count) question stand.
> Read E10c's mechanics below, but take its verdict from E10e.

**Verdict: ○ type substitution stays closed — but for a completely different
reason than E7g assumed, and modulator DELETION is ● as a side effect.** E10
explained E7g's GUID-only failure as "the payload is type-specific, so swap
both". That explanation was right about the mechanism and **wrong about the
remedy**: splicing the whole modulator object (GUID *and* payload together) does
not work either, because **the container rejects object INSERTION outright**.
Probe `e10c-typeswap`, all green (it asserts the negative). E7 Finding H keeps
one template per modulator type.

### The isolation (the part that matters)

Object bounds come from the MODULATORS list: every item begins
`<u32 classId> 0x02b9 str '<index>'`, so consecutive item starts delimit each
object exactly. Four variants on modtest, replacing/removing the `Expressions`
modulator:

| variant | edit | result |
|---|---|---|
| **DELETE** | drop the `Expressions` object | **● loads** — `Vibrato` + `LFO` pages intact |
| **DUP** | replace it with a same-file `Vibrato` **copy** | ○ whole preset fails to load |
| **FOREIGN** | replace it with modzoo's `Classic LFO` object | ○ whole preset fails to load |
| **FOREIGN + meta** | same, plus `referenced_modulator_ids` repaired | ○ whole preset fails to load |

**DUP is the decisive row.** A well-formed object copied from the *same file*
cannot be malformed, and it is still rejected — so the problem is **insertion
itself**, not the donor, not foreignness, not the GUID/payload pairing. The
`referenced_modulator_ids` repair (a length-preserving ASCII fix, motivated by
E7g's "Missing" GUID being the one absent from that list) changed nothing, so
that hypothesis is dead too.

Failure mode is **whole-preset rejection** (chain EMPTY), which is more severe
than E7g's unwired/page-less/"Missing" — but still **graceful, never a host
crash**, consistent with every substitution-class edit in this spike.

### DELETE is a real capability (●)

Removing exactly `[start, end)` yields a valid preset that loads with the
remaining modulators live. This is worth two things:
1. **It proves the object bounds are byte-exact** — otherwise the file would be
   corrupt. The delimiting rule above is sound.
2. **Modulators can be REMOVED from a template.** A fat donor template can be
   trimmed down, which is the opposite direction from the slot-bank's
   `Amount = 0` dormancy trick and costs nothing at runtime.

### Why the E10 optimism did not carry over

E10/E10b edits were **value-level**: rewrite a string inside an existing object,
including at changed length. Those are fine. E10c is **structure-level**: change
how many objects exist. The container tolerates the first and rejects the second
(except deletion). This is the line E4f drew from the outside — "value/GUID
substitution ≈ safe; new topology ≈ hazardous" — now measured from the inside,
and *sharper*: new topology does not crash, it simply will not load.

⚠ **The mechanism is NOT identified.** Something makes an added object invalid
and it is not size (E10b changed sizes freely), not GUID uniqueness (FOREIGN's
GUID is unique to the file and still failed), and not the meta reference list.
Candidates not yet tested: a per-file object/instance id that must be unique, or
a count//checksum the reader validates. **Do not build on insertion** until this
is understood; it is the one place a wrong assumption could silently produce
files that load but misbehave.

### Decision impact

- **The `type` axis of E7 Finding H stands as the residual explosion.** One
  human-authored template per modulator type; the `target` axis is collapsed by
  E10, the `settings` axis by E7d, and `count` can now only shrink (DELETE), not
  grow.
- **Answers the open question directly:** knowing a modulator's GUID *and* its
  default payload is **not** sufficient. The substitution issue was never an
  information problem, so no amount of harvesting default payloads fixes it.
- **Adds `patch`-level deletion** to the templating helper alongside the string
  editor and GUID substitution.

---
