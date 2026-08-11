---
id: E10f
kind: evidence
state: active
source: FINDINGS.md
---

# E10f — Modulator construction is UNLOCKED; the gate is a unique instance ID (2026-07-21)

**Verdict: ● modulators can be ADDED, REPLACED (any type/category), retargeted,
and deleted by `.bwpreset` surgery. The only load-time invariant is that field
`0x1a1b` — a unique per-modulator instance ID — stay unique. E10e's "category"
gate and E10c's "insertion blocked" are BOTH overturned; they were this one field
all along.** Probe `e10f-addcat` + `tools/bwformat/build_e10f_cases.py`, on
user-authored minimal-pair presets. This collapses E7 Finding H's slot-bank
almost entirely — modulator topology is now agent-constructible from templates.
Credit: the user's minimal-pair presets (and the `_same` methodology control)
are what made the differential analysis possible.

### The controlled matrix (each pair isolates ONE variable)

| test | edit | `0x1a1b` set | result |
|---|---|---|---|
| **M1** | modtest, flip slot-1's `0x1a1b` 1→0 — **one byte, nothing else** | `[0,0,2]` | ○ REJECT |
| C0 | modtest unmodified | `[0,1,2]` | ● load |
| **C1** vs **C1n** | replace modtest slot-1 with Classic LFO | `[0,1,2]` / `[0,0,2]` | ● load / ○ REJECT |
| **B1** vs **B1n** | ADD Random as a 2nd modulator to one_lfo | `[0,1]` / `[0,0]` | ● load / ○ REJECT |
| A1 | replace Expressions(Note-driven) at slot 0 with Classic LFO(LFO) | unique | ● load |

**M1 is the clincher:** a single byte that duplicates an ID turns a loading preset
into a rejected one, with nothing else changed. **C1/C1n and B1/B1n** each differ
*only* in whether `0x1a1b` stays unique. **A1** loads a cross-category swap
(Note-driven → LFO) — category is not a gate.

### What `0x1a1b` is

A **unique per-modulator instance id**, u8, one occurrence per modulator object.
Across every preset examined it is distinct within a file (modtest `[0,1,2]`,
modzoo `[0,1]`, singles `[0]`). It is NOT the display slot (the `0x02b9` name
string is the visible index; they coincide only because none of these presets had
a modulator deleted/reordered). Bitwig validates its uniqueness on load and
**rejects the whole preset on a collision** — the same graceful whole-file refusal
as every other invalid edit, never a crash.

### The full modulator-construction capability (all ● now)

| operation | how | evidence |
|---|---|---|
| retarget a route | rewrite the `0x0e3d` target-path string (any length) | E10/E10b |
| change TYPE / replace | swap the whole object (GUID+payload), **assign a unique `0x1a1b`**, fix meta ref | E10f C1 |
| ADD a modulator | insert object into MODULATORS list, unique `0x1a1b`, append meta ref, patch `f4` | E10f B1 |
| DELETE a modulator | remove the object (+ its meta ref) | E10c/E10d |
| vary settings live | remote-control page writes at runtime | E7d |

The add/replace recipe in full (from `build_e10f_cases.py`, now the reference):
1. object goes into the `MODULATORS` list (field `0x1a46`), objects adjacent, no
   separators, no count field (E10d);
2. its `0x1a1b` **and** `0x02b9` name set to an id unused by any sibling
   (max-existing + 1 is safe);
3. its GUID appended to (or replaced in) meta `referenced_modulator_ids` (a `0x19`
   str[] with a u32 count — bump the count);
4. if meta size changed, patch header `f4` (the only offset pointer; `f5`/`f6` are
   always 0) by the byte delta.

Verified end to end: a `mp_bare → mp_one_lfo` reconstruction was **byte-identical**
to the real Bitwig-saved file except the name and a volatile per-instance "Chain"
GUID (field `0x2ab8`) — so the machinery reproduces exactly what Bitwig writes.

### Method — three wrong turns, each caught by isolation (the spike's whole thesis, again)

This experiment reached the right answer only after **three** confident-but-wrong
readings, every one killed by a cleaner control:
1. **"Category is the gate" (E10e).** Spurious: slot-0 replaces happened to
   preserve id-uniqueness; the slot-1 one didn't. A1 (cross-category, unique ids →
   load) killed it.
2. **"Slot position is the gate."** A1 loads at slot 0, C1 loads at slot 1 — both
   fine once ids are unique. Position never mattered.
3. **"`0x1a1b` = slot position, must equal the index."** Wrong: it is an
   *instance id*, only required unique. A broken B1n control (a stale
   pre-rename gave it a unique id by accident, so it loaded and muddied the
   picture) hid this for one run; fixing the control gave the clean
   unique-vs-duplicate split. **The one-byte M1 test is what made it
   incontrovertible** — change exactly one thing, observe exactly one flip.

⚠ Untested edges (do not overclaim): whether ids must also be *contiguous* or may
be sparse (all evidence is contiguous-from-0); whether the `0x02b9` name string is
independently validated (it was kept equal to `0x1a1b` in every passing case);
scale beyond 3 modulators; and non-Polysynth hosts. The per-instance "Chain" GUID
(`0x2ab8`) regenerates per save but was NOT required unique for a load here.

### Decision impact → DECISIONS / PROJECT_PLAN (significant)

- **E7 Finding H's slot-bank is largely retired.** The agent does not need a fat
  template of dormant pre-wired modulators. It can **add, remove, type-swap, and
  retarget modulators directly** on a `.bwpreset` from a plain template, then
  `insertFile`. One small template per device (or even a bare device) suffices;
  the modulation graph is constructed by file surgery + verified by remote-page
  readback (E7d), all length-free.
- **Modulator authoring joins device/param authoring as a template-time
  capability.** The remaining hard ○ is unchanged: no *runtime* API for any of
  this (E7 Finding 0/F), and no save/export API (E4f) — templates still originate
  from a human, but now a *minimal* one, not a curated matrix.
- **Carry-forward:** promote `build_e10f_cases.py`'s primitives into a
  `tools/bwformat` modulator library (`list_modulators`, `next_free_id`,
  `add/replace/delete/retarget`, meta+`f4` maintenance). It is Phase-1/2 quality;
  the byte offsets and the `0x1a1b`/meta/`f4` invariants are the spec.
- **The invariant to enforce in code:** every modulator's `0x1a1b` unique; meta
  `referenced_modulator_ids` in sync with the object set; `f4` = meta end. Always
  verify by load + remote-page readback (a duplicate id fails the whole file
  silently — the standing readback rule).

---
