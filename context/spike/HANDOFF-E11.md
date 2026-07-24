---
title: Handoff — E11, the (likely last) format spike task
status: Session 1 done (E11a/b/c/d/d-2/f [K]); Session 2 = E11e/g/h + VST + build bwmod
updated: 2026-07-23
read-first: BWFORMAT_SPEC.md, BWMOD_DESIGN.md, FINDINGS.md (E11 series, newest-first)
note: original brief below is §1–§3; the Session 2 handoff is §4 (start there)
---

# Handoff: E11 — close the modulator-format edges, then build `bwmod`

You are continuing the ghostnote spike. The E10 series established that **modulator
topology is agent-constructible by `.bwpreset` file surgery** — add / replace (any
type/category) / retarget / delete — gated by a **single** load-time invariant: the
`0x1a1b` instance id must be unique (E10f). Two things remain, and they are
independent so can be done in either order (or parallel sessions):

- **Workstream A — probe the untested edges** (this doc §1). Small, cheap probes;
  each removes a caveat or a risk from the spec before code depends on it.
- **Workstream B — build `bwmod`** per `BWMOD_DESIGN.md`. Can start now; the edges
  in §1 mostly tighten defaults, not the interface shape.

Standing rules still apply: **stop after each experiment for user review; don't run
git writes; restore gn-A/gn-B fixtures at every probe's end; a probe "FAIL" is
often a wrong expectation encoding the real finding; isolate one variable per test
(the E10 series produced FIVE confident-wrong readings, each killed only by a
clean control — the one-byte M1 test is the model).**

## 0. The working rig (unchanged)
- Bitwig 6.0.6 with the ghostnote controller added; bridge on `127.0.0.1:8686`
  (`nc -z -w1 127.0.0.1 8686`). Build/deploy: `cd extension && gradle copyExtension`.
- Probes: `cd brain && npx tsx src/probes/eNN-*.ts`. Reuse `lib.ts`.
- Byte surgery lives in `tools/bwformat/` (Python): `bwparse.py` (reader),
  `bwdiff.py` (structural diff), `build_e10f_cases.py` (the add/replace/delete
  primitives — the port source for `bwmod`).
- Fixtures/assets in `~/Documents/Bitwig Studio/Library/Presets/Polysynth/`:
  `modtest`, `modzoo`, `mp_bare`, `mp_bare_same`, `mp_one_lfo`, `mp_one_random`,
  `mp_random_same`, `mp_note_first`. The layer template `gn test - instrument
  layer 4` under `Instrument Layer/`.

## 1. Untested edges (ranked by decision-relevance)

Each is a small probe (build files with a Python script → load via a TS probe →
readback), modeled on `e10f-addcat.ts`. Tag each result [K] in FINDINGS.

### E11a — Is `0x1a1b` uniqueness enough, or must ids be CONTIGUOUS? *(highest value)*
- **Q:** Does the id set have to be `{0..n-1}`, or just unique? All evidence so far
  is contiguous-from-0, so `next-free = max+1` is *safe* but maybe over-strict.
- **Method:** one-byte edits on `modtest` (loads at `[0,1,2]`): try `[0,1,5]`
  (unique, sparse), `[2,0,1]` (permuted), `[9,4,7]` (unique, none zero). Load each.
- **Settles:** whether `bwmod` may reuse a freed id / must renumber on delete. If
  sparse-unique loads, the library is simpler and delete needn't renumber.

### E11b — Is the `0x02b9` name string independently validated?
- **Q:** Every passing case kept `0x02b9` name == `0x1a1b` id. Must they match?
- **Method:** on a loading preset, set name≠id (name "5", id 1) and vice-versa;
  load. Also mismatch on an added modulator.
- **Settles:** whether the library must keep name and id in lockstep (current
  conservative default) or can treat name as cosmetic.

### E11c — Does surgery hold at SCALE (8, 16, 32 modulators)?
- **Q:** All tests used ≤3 modulators. Does add/replace hold with many?
- **Method:** build a preset with N modulators (repeated `addModulator`), unique
  ids, load at N = 8/16/32. Watch for any count/limit surprise.
- **Settles:** whether there's a practical cap; confidence for real use.

### E11d — Non-Polysynth hosts (Sampler, Phase-4, an FX device, VST/CLAP)?
- **Q:** All modulator surgery was on **Polysynth**. Do the class ids / field ids /
  MODULATORS wrapper hold on other devices? (VST/CLAP especially — their param
  space differs, E4b.)
- **Method:** user saves one modtest-analog per host device (or reuse the Instrument
  Layer template's chains); parse with `bwparse.py`, diff structure, then
  add/replace and load. **Needs user-authored templates** — request them like E7.
- **Settles:** whether `bwmod` is Polysynth-specific or general. High value; likely
  needs a fixture-building ask to the user.

### E11e — Cross-device routing targets?
- **Q:** E10/E10b retargeted within one device (`CONTENTS/F1FREQ`). Can a modulator
  target a param in a **different device** in the same chain? What's the path form?
- **Method:** in a 2-device chain, inspect a hand-authored cross-device modulation's
  `0x0e3d` path; try to synthesize one. (May be out of reach — record either way.)
- **Settles:** the ceiling on routing generality; informs the "target set is
  arbitrary vs curated" question that E10 reopened.

### E11f — The per-instance `0x2ab8` "Chain" GUID on repeated adds
- **Q:** `0x2ab8` regenerates per save and was NOT required unique for a single add
  (E10f). Does adding TWO modulators from the SAME donor collide their `0x2ab8`
  (or any other embedded id) and get rejected?
- **Method:** `addModulator(base, donorX); addModulator(result, donorX)` — same
  donor twice — and load. If it rejects, the library must freshen `0x2ab8` (and
  find whatever else must be unique) on transplant.
- **Settles:** whether `addModulator` needs a "freshen embedded ids" step. **Do this
  early — it directly affects the library's add primitive.**

### E11g — Does surgery survive a project SAVE + RELOAD?
- **Q:** E4h's standing caveat: everything is verified in-session. Does a
  surgically-built modulator persist through save + Bitwig restart?
- **Method:** build, load, save project, restart Bitwig, reopen, read the modulator
  back. (Needs a user save/restart — sequence like E5c/E6.)
- **Settles:** the last "is it real" caveat for the whole templating approach.

### E11h — Unmapped stream types 0x02, 0x06, 0x1a
- **Q:** `bwparse.py`'s full dump stalls on these. Not needed for targeted editing,
  but resolving them completes the reader and de-risks any future full-parse need.
- **Method:** locate instances, infer widths from context, extend the parser.
- **Settles:** parser completeness (nice-to-have; low urgency).

## 2. Suggested sequencing
1. **E11f** first (affects the add primitive), then **E11a** (affects id policy) —
   both cheap, both change library defaults.
2. **E11d** + **E11g** need user-authored fixtures / a save-restart — request early,
   run when ready (they gate "general + durable").
3. **E11b, E11c, E11e, E11h** as time allows.
4. Build **`bwmod`** (Workstream B) once E11f/E11a land; fold E11d's generality in.

## 3. Exit / deliverables for E11
- Each edge probed → a [K] verdict in FINDINGS; caveats in BWFORMAT_SPEC §4/§6
  upgraded or removed.
- `bwmod` implemented per BWMOD_DESIGN.md with its unit + integration tests green.
- DECISIONS updated: **modulator authoring = template-time file surgery, one load
  invariant (unique `0x1a1b`), verified by readback** — and the slot-bank design
  (E7 Finding H) formally retired in favor of it.
- If E11d/E11g surface a limit (host-specific, or doesn't survive reload), record it
  loudly — it bounds the whole capability.

> This is planned as the **last** format spike task. After E11, the format work is
> either done (general + durable) or has a clearly-bounded residual, and ghostnote
> can depend on `bwmod` for modulator authoring.

---

# §4. SESSION 2 HANDOFF (start here) — updated 2026-07-23

Session 1 ran the cheap edges and resolved the big generality question. What remains
is small (three edges + one new probe) and then the build. **All standing rules from
the top of this doc still apply** (stop per experiment for review; no git writes;
restore gn-A/gn-B; a FAIL is often a wrong expectation; isolate one variable).

## 4.1 What Session 1 settled (all [K]; see FINDINGS, newest-first)

- **E11f** — same-TYPE / same-donor repeated add loads. A modulator object has no
  `0x2ab8`; `addModulator` needs **no id-freshening** beyond a unique `0x1a1b`.
  Duplicate `0x18c6` type-guids and duplicate `referenced_modulator_ids` entries are fine.
- **E11a** — `0x1a1b` **uniqueness is the whole rule**; ids may be sparse/permuted.
  `delete` need not renumber; `max+1` is a convenience, not a requirement.
- **E11b** — the `0x02b9` name is **cosmetic**, not validated against the id.
- **E11c** — surgery **scales to 32** on Polysynth (5 mixed types) and Sampler. The
  sampled-Sampler count field is a real **u32** (carries past one byte).
- **E11d → E11d-2** — the recipe is **general across native instrument, native FX
  (Delay+), and CLAP (Repro-5)**. The apparent Sampler exception was the **embedded
  sample**, not the device: a **sample-less Sampler is fully general** (adds new types,
  multi-type, all ops). A *sampled* preset mirrors modulator count in two u32s
  (signatures `00 00 12 9c 12 00 00 00 01 …` and `00 00 14 22 12 …`, value = base +
  `0x10`·count) that add/delete must delta by `±0x10`, and blocks new-type
  introduction. **Gate on "embeds a sample/bulk content", not device name.**

Net: **modulator authoring by file surgery is general and slot-bank-capable** (a
full multi-type slot-bank is buildable by surgery on any tested host, incl. sample-less
Sampler). One clearly-bounded residual remains (below).

## 4.2 The one class-shaped residual — embedded opaque bulk content (NEW, do first)

The sample lesson generalizes: **a device that embeds an opaque bulk blob can carry
mirrored modulator state that breaks the plain recipe.** We characterized exactly one
instance (Sampler's sample). Untested and highest-suspicion:

### E11i — VST2/VST3 hosts *(new; highest-value remaining generality probe)*
- **Q:** CLAP (Repro-5) is general, but a **VST/VST3 embeds an opaque state chunk**
  just like the sample did. Does the plain recipe hold, or does VST mirror modulator
  state (like the sample) and reject add/new-type?
- **Method:** exactly E11d's shape — user authors `gn_<vst>_bare` + `gn_<vst>_one_lfo`
  (Repro-5 is also available as VST3 → a clean CLAP-vs-VST comparison on the *same*
  plugin). Then add / add-new-type / replace / delete via `build_e11d_cases.py`-style
  surgery + `e11-load.ts`. If it rejects, diff bare↔one_lfo for a sample-like mirrored
  field (the E11d-2 method).
- **Settles:** whether "embedded bulk content" is a general hazard or sample-specific.
  Also worth a quick look: convolution IR, wavetable/Grid, nested containers — same
  risk pattern, lower priority.

## 4.3 Remaining original edges (unchanged, all cheap)

- **E11e — cross-device routing targets.** Can a modulator target a param in a
  *different* device in the same chain, and what is the `0x0e3d` path form? Needs a
  user-authored 2-device chain with a hand-made cross-device modulation to inspect,
  then try to synthesize. (Original §1 E11e.)
- **E11g — save + reload durability.** Does a surgically-built modulator survive a
  project save + Bitwig restart? Needs a live save/restart mid-probe (drive it
  interactively). The last "is it real" caveat.
- **E11h — finish the parser (types `0x02`, `0x06`, `0x1a`).** Low urgency, but Session
  1 hit `0x1a` inside the modulator object (it blocks a clean forward object-walk),
  which is why `bwmod` must keep using **diff-based object bounds**, not a full parse.
  Resolving these completes `bwparse.py`.

## 4.4 Deferred (flagged, non-critical) — Sampler sample-loading recombination [U]

Per user: defer to implementation as a **Sampler-focused investigation, not spike-
critical.** Open question: if modulators are authored on a **sample-less** Sampler and a
sample is loaded afterward, does the sample-load regenerate its mirrored count so the
result is consistent? (Likely a runtime/UI path, not file surgery.) Only matters for a
preset that must carry BOTH a sample and surgically-authored modulators at once.

## 4.5 New tooling built in Session 1 (reuse it)

- **`brain/src/probes/e11-load.ts`** — generic loader: reads a manifest
  `{cases:[{key,path,desc,expect_load,expect_page}]}`, loads each via `insertFile`,
  reports load/reject + full `pageNames`; with `GN_DIVERGE=1` it scans every remote
  page for a knob whose `modulatedValue` diverges from `value` (host-agnostic
  route-liveness — `param.modulated` is Polysynth-only; `remote.list` re-scopes to any
  device). Set `GN_MANIFEST=/path.json`. This is the probe to reuse for E11e/g/i.
- **`tools/bwformat/build_e11{a,d,f,bc}_cases.py`** — Python case builders. `build_e11d_cases.py`
  is the closest template for a new host probe. They share the primitives (`bare_diff`
  object extraction, `rename_slot`, `append_ref`, `set_f4`) that are the **port source
  for `bwmod`** alongside `build_e10f_cases.py`.
- **Fixtures added by the user this session** (under `~/Documents/Bitwig Studio/Library/
  Presets/`): `Sampler/gn_sampler_{bare,one_lfo,no_sample}`, `Delay+/gn_delayplus_{bare,
  one_lfo}`, `Repro-5/gn_repro5_{bare,one_lfo}`. For E11i, ask the user for a VST3 pair.

## 4.6 Then: build `bwmod` (Workstream B) — unchanged, with Session 1 folded in

Per `BWMOD_DESIGN.md`. Key Session-1 deltas already written into that doc: no
id-freshening (E11f); ids unique-not-contiguous, name cosmetic (E11a/b); **gate on
embedded-sample/bulk-content, not device name** (E11d-2) — plain recipe everywhere else,
count-u32 `±0x10` step + refuse new-type only when a sample is embedded; keep
diff-based object bounds (E11h); load+readback always mandatory.

## 4.7 Suggested Session 2 sequence
1. **E11i (VST)** — closes the last generality question; request the VST3 fixture pair early.
2. **E11e, E11g, E11h** — cheap; E11g needs a live restart, E11e needs a 2-device fixture.
3. **Build `bwmod`** and get its 6.1 unit + 6.2 integration tests green.
4. Update DECISIONS: modulator authoring = template-time file surgery (unique `0x1a1b`,
   verified by readback), general across tested hosts, with the embedded-bulk-content
   residual noted; retire the E7 Finding H slot-bank as the *default* (but note it is the
   right shape for the sampled-Sampler / bulk-content case).
