---
id: E4g
kind: evidence
state: active
source: FINDINGS.md
---

# E4g — Per-layer substitution VERIFIED on a 4-chain template (2026-07-19)

**Verdict: ● parameterised multi-layer construction works.** E4f's one
outstanding inference is now a measured result. Probe `e04g`, all green,
against a template the user built by hand (an Instrument Layer with
Phase-4 / Polysynth / Organ / Sampler) — the only way to obtain one, since
there is no save API.

### Template anatomy

Each device's identity appears **exactly once** as a raw 16-byte GUID, at a
distinct offset, with the container first:

| offset | device | role |
|---|---|---|
| 6 346 | Instrument Layer | container |
| 8 023 | Phase-4 | chain 1 |
| 14 312 | Polysynth | chain 2 |
| 19 014 | Organ | chain 3 |
| 22 174 | Sampler | chain 4 |

25 011 bytes for a 4-chain instrument stack — templates are small.

### Results

- **The untouched template instantiates all four chains in one
  `insertFile` call**, each holding the device the user placed there.
- **Single swap (Organ → Polymer): only that chain changed.**
  `[Phase-4, Polysynth, Organ, Sampler]` → `[Phase-4, Polysynth, Polymer,
  Sampler]`. The other three chains were untouched. **This is the result the
  whole templating story rested on.**
- **Double swap (Phase-4 → Polymer, Sampler → Polysynth) in one file:** both
  changed independently, the untouched Organ chain survived →
  `[Polymer, Polysynth, Organ, Polysynth]`.
- **The substituted device is live at depth:** descended into the patched
  chain, `isNested=true`, 7 direct params enumerated, and a write landed
  (`CONTENTS/OUTPUT` → 0.25).
- **Stale ASCII metadata is ignored.** Only the binary GUID was patched;
  `referenced_device_ids` still named Organ and instantiation was unaffected.
  ⇒ that metadata is not consulted when loading — patching the binary GUID
  alone is sufficient and correct. (E4f gate 3's trap stands: patching *only*
  the ASCII does nothing.)

### The construction pipeline, now fully evidenced

1. **Shape** — instantiate a template preset via `insertFile` (any path, no
   Library registration needed; E4f gates 1–2).
2. **Devices** — patch per-chain binary GUIDs, one occurrence each,
   length-preserving so no offsets shift (E4g).
3. **State** — set every parameter through the param API (E4/E4b), at depth
   via `selectFirstInLayer` (E4c). The preset's stored state is irrelevant.

A template is needed **per shape** (a 4-chain stack, a 3-chain stack…), not
per sound. Shapes are few and small; devices and parameters are the varying
part and both are now parameterisable.

### Decision impact

- **"Boring setup" is a solved problem** for layer containers, via templates
  rather than the absent create-layer API. Promote it to a Phase-2
  deliverable with a known implementation path.
- **Ship a template library** — a handful of hand-built shapes, plus a GUID
  substitution helper and a device-UUID catalog (already harvestable, E4/E4d).
- **Always verify the loaded structure by readback** (chain contents by
  name), as everywhere else in this spike — substitution failures are silent.
- Bootstrapping templates requires a human once per shape; that is a
  one-time setup cost, not a per-use one.

---
