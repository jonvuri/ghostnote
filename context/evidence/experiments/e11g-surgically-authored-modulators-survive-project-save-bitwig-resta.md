---
id: E11g
kind: evidence
state: active
source: FINDINGS.md
---

# E11g — surgically-authored modulators SURVIVE project save + Bitwig restart [K] (2026-07-24)

**Verdict: ● a modulator added by pure file surgery persists through a full project
save → Bitwig quit → relaunch → reopen. It is not a load-time-only illusion: Bitwig
accepts the surgical device as first-class, RE-SERIALISES it into the project on save
(in its own canonical form), and re-parses it cleanly on a cold restart. This retires
E4h's standing "everything is verified in-session only" caveat for modulator
authoring.** Probes `e11g-load.ts` / `e11g-verify.ts`, driven interactively.

- **Method:** built `mp_one_lfo` + a surgically-added **Random** (sentinel-correct
  recipe) → `insertFile` onto gn-A → confirmed modulator pages `[…, LFO, Random]` →
  user saved the project, fully quit Bitwig, relaunched, reopened → reconnected the
  bridge and read gn-A back.
- **Result:** gn-A returned exactly one `Polysynth` whose remote pages still include
  **both `LFO` and `Random`**. A fresh Polysynth has zero modulator pages, so the
  surviving `[LFO, Random]` set can only be the persisted surgical topology — no
  ambiguity. The round-trip through Bitwig's *own* serializer (save re-writes the
  device) is a stronger guarantee than a mere in-session load.
- **Decision impact:** durability is settled — `bwmod`-authored presets are real,
  saveable, portable project content, not transient. Combined with E4h (templates
  ship as build-time assets, deletable after load), modulator authoring is fully
  first-class end-to-end. No caveat outstanding.

---
