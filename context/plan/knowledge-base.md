---
title: Capability knowledge base — mint the reference axis, then seed it
kind: plan
state: active
updated: 2026-08-15
parent: ROADMAP.md
next: phase-1/3f-fork-chain.md
scope: context tree only; no brain, extension or product change
note: isolated detour taken between Phase 1 sessions 3f-g and 3f-h; Phase 1
      resumes at 3f-h immediately afterwards
evidence: E4c, E4d, E16 §3.4e, E16n/o, E16w, E17, E18a; D2; reference/BitX
---

# Capability knowledge base

> **Purpose.** Add the one axis the context tree does not have — durable,
> topical, current capability reference — and seed it with the host-API
> knowledge already paid for, plus the facts mined from `reference/BitX`.
> This is a context-tree session. It changes no code and no product behaviour.

## Why this session exists

The tree has four axes and all four work: `decisions/` (D-numbered settled
design), `evidence/experiments/` (E-numbered chronological run records),
`plan/` (sequencing), `archive/` (frozen history). What it lacks is a place
where a capability lives as a *current fact organized by subject* rather than as
a *dated record of the run that measured it*.

⚠ `README.md`'s authority order already promises this — *"Individual files in
`evidence/` for measured facts"* — but `evidence/` is organized as experiment
records. The designation and the organization disagree, and the gap is load
bearing rather than cosmetic:

1. **Lookup cost.** Answering "Selector or Layer?" required e4c, e4d,
   E16 §3.4e, e16n/o, e16w, e17, e18a, `archive/spike/*`, and Java source.
2. ⚠⚠ **Supersession has nowhere to land, so it lands in code.** The freshest
   statement of the Selector verdict was `ContainerHandlers.java:186` —
   *"Selectors ship with zero chains and cannot be seeded"* — and it was stale
   against the build-time seed-asset rule now in `PROJECT.md`. Experiment files
   are frozen records by design and cannot carry supersession. Nothing else was.
3. **The index headline is lossy.** `⚠ glitch owed` reads as "it glitches"; the
   row measured ○ **no** glitch (0/4 real vs 0/4 placebo) with a *positive
   control* owed. One headline per experiment cannot serve capability lookup.
4. ⚠ **Observed facts with no probe have no home.** The 2026-08-15 Selector
   deactivation finding (below) is not a decision and not an experiment run, yet
   it materially qualifies E16 §3.4e. Today it must either take an E-number it
   does not merit or be lost.

**The shape already exists and is proven.** `evidence/format/` holds
`BWFORMAT_SPEC.md` and `BWMOD_DESIGN.md`: synthesized, topic-organized,
`[K]`/`[I]`/`[U]`-tagged, with `status` / `scope` / `depends-on` frontmatter.
That is exactly the right instrument, built once for the byte-format domain and
never generalized to the host-API domain — which is where most of the spike's
knowledge lives. **This session generalizes it. It does not invent a format.**

## Step 1 — mint the axis

Create `evidence/capability/` as a sibling of `evidence/format/`, carrying the
same contract: synthesized, current, provenance-tagged, superseding.

- `evidence/capability/INDEX.md` — capability-by-subject table: subject, verdict
  glyph, one-line current statement, page link. This is what a future session
  greps instead of the E-index.
- One page per subject, `evidence/capability/<subject>.md`. Suggested opening
  set, drawn from where knowledge is actually scattered today:

  | Page | Absorbs |
  |---|---|
  | `containers.md` | Layer vs Selector vs DrumPad: seeding, chain create/rename/delete, switching, cursor descent |
  | `identity.md` | `channelId` durability, the absent device id, what a name can and cannot prove |
  | `devices.md` | UUIDs, `SpecificBitwigDevice` param ids, DirectParameter, device observables |
  | `banks.md` | Bank windows, eviction order, D7 scaffold sizes |
  | `actions.md` | Named actions: E6 → E16j → E22, and why the seam is closed |

  ⚠ Do not create a page with nothing measured behind it. An empty page is a
  claim that the subject is understood.

- **Rules, stated in `INDEX.md` and enforced by review, not by tooling:**
  - Every claim carries `[K]`/`[I]`/`[U]` and cites its E-number or names its
    observer and date. A claim that cites nothing is not admissible.
  - A capability page is **rewritten in place** when superseded, and records
    what it superseded and why. This is the whole point of the axis; it is the
    one place in the tree where prose is *not* frozen.
  - ⚠ Experiment files stay frozen. A capability page never edits an E-file; it
    supersedes its *reading* and links to it.
  - An observed-but-unprobed fact is admissible at `[I]`, attributed and dated,
    and names the probe that would raise it to `[K]`.

- Amend `README.md`'s authority order and reading routes so "Investigate a
  Bitwig capability" routes to `evidence/capability/INDEX.md` first and the
  E-index second. Amend `archive/README.md` only if pages absorb spike material.

⚠ **`check.rb` needs no change** — it validates frontmatter, relative links, and
exactly one `state: active` Phase-1 brief. This plan sits at `plan/` root with
`state: planned` precisely so it does not trip that count. **Register it in
`ROADMAP.md` as the session's first act**; it is currently unlinked and
therefore invisible to the reading routes.

## Step 2 — seed `containers.md` as the worked example

Do this page first and completely. It is the one whose scatter motivated the
session, and it proves the format carries a genuinely contested subject.

Facts to consolidate, with their current readings:

- **Selector chains are exclusive; Layer chains are parallel.** `activeChainIndex()`
  is one readable, settable integer; layer exclusivity is N solo flags [K, E16w, E17 row 6].
- **Switching is 25 ms and clean** — 0/4 real vs 0/4 placebo, forced balance,
  where track duplication glitched 5/5 (C5) [K, E16 §3.4e]. ⚠ The **positive
  control is still owed**: the null ear result cannot separate "no glitch" from
  "this rig could not have heard one". Record as owed evidence, not as a defect.
- **A chain switch does not cut sends** — the switch is upstream of the send tap
  [K, E16 §3.4e]. This is what makes a selector usable on an FX return and Master.
- ⚠⚠ **NEW [I], user, live, 2026-08-15 — and it is the disqualifying fact.**
  A deactivated Selector chain is *fully disabled*: its tail continues to sound
  after deactivation, and a newly activated chain picks up no input until it is
  active. Switching is therefore **not instantaneous at the audio boundary**,
  which rules the Selector out for live A/B — the exact use the exclusivity was
  attractive for. ⚠ This is the same mechanism as the CPU saving, not a separate
  defect: only the active chain runs. **Layer chains remain the product path.**
  Probe that would raise this to [K]: switch between two chains holding a long
  release-tail patch, measure the decay across the switch point against a
  layer-mute control.
- ⚠ **Correct the stale conflation.** *"Selectors cannot be seeded"* is two
  claims. E16o's *no verb creates a chain* stands [K]. *No shell can be obtained*
  is superseded — a bundled build-time preset supplies it, which is exactly what
  `assets/device-alternates/instrument-layer-seed.bwpreset` does for the Layer.
  ⚠ Untested link: whether `Channel.duplicate()` fires on a Selector chain as it
  does on a Layer chain. Record as [U] with the probe named.
- ⚠ **`devcursor.selectFirstInLayer` descends a Layer chain in 141 ms and times
  out on a Selector's (6 s, cursor stays on the container)** [K, E16 §3.4e].
  Note the mitigation: product container reads/writes use the cursor-free
  `Rig.slotLayerBanks` and do not move `cursorDevice0`.
- Chain `channelId` is re-minted by the project loader; it is a within-turn
  creation witness only [K, E18b]. Every typed chain delete refuses [K, E17].

## Step 3 — integrate the BitX-mined facts

Source: `reference/BitX` (`wimvandenborre/BitX`, API 25 — same artifact ghostnote
compiles against). ⚠ **Frame it accurately in the pages: BitX is a ~2,900-line
command runner that creates no structure and drives only human-built racks. It
contributed data and one existence proof, no technique.**

Into `devices.md`:

- **Seven native device UUIDs** — Instrument Selector `9588fbcf-721a-438b-8555-97e4231f7d2c`,
  FX Selector `956e396b-07c5-4430-a58d-8dcfc316522a`, Channel Filter
  `c5a1bb2d-a589-4fda-b3cf-911cfd6297be`, Note Filter `ef7559c8-49ae-4657-95be-11abb896c969`,
  Note Transpose `0815cd9e-3a31-4429-a268-dabd952a3b68`, MIDI Program Change
  `429c7dcb-6863-48bc-becc-508463841e3b`, Drum Machine `8ea97e45-0255-40fd-bc7e-94419741e9d1`.
  ⚠ [I] until each is confirmed by a live load — they are transcribed from a
  third party, and D2's standing rule is to confirm with a live test.
  Ghostnote's own two are [K]: Polysynth `a9ffacb5-33e9-4fc7-8621-b1af31e410ef`,
  FX Layer `a0913b7f-096b-4ac9-bddd-33c775314b42`.
- **`SpecificBitwigDevice` parameter-id strings**, which are undocumented and
  otherwise only discoverable by guessing: `MIN_KEY`/`MAX_KEY` (Note Filter);
  `OCTAVES`/`COARSE`/`FINE` (Note Transpose); `PROGRAM`/`BANK_MSB`/`BANK_LSB`/
  `CHANNEL` (MPC); `SELECT_CHANNEL_1`…`_16` (Channel Filter). Ghostnote holds
  one such map today (`Rig.POLYSYNTH_PARAM_IDS`). Directly relevant to Phase 4.
- **Device observables ghostnote does not mark on bank devices.** Only `exists()`
  and `name()` are marked (`Rig.java:728`); the API also offers `presetName()`,
  `deviceType()`, `isPlugin()`, `position()`, `sampleName()`, `slotNames()`.
  ⚠ State the limit honestly: these are **fingerprint fields, not identity**.
  They would narrow, not close, 3f-g's duplicate-name restoration gap.
- **`SpecificBitwigDevice.createIntegerOutputValue(String id)`** — an output
  value readable from a native device. Used by neither project. [U], no known use.

Into a new `host-api.md` (or `devices.md` if it stays small):

- **`createBitwigDeviceMatcher(UUID)` + `DeviceBank.setDeviceMatcher`** — a
  cursor-free device bank filtered *by type*. Zero uses in ghostnote; the one
  mechanism in BitX that ghostnote does not already use.
- **Process spawn from inside an extension works** — `ProcessBuilder(...).start()`
  on a background thread (`BitXGraphics.java:65`), plus `platformIsMac()` /
  `platformIsWindows()`. Relevant only to the autonomy constraint in `PROJECT.md`.
- **The OSC module is reachable** — `host.getOscModule()`, `createAddressSpace()`,
  `createUdpServer()`, `connectToUdpServer()`. Unused by ghostnote; noted as an
  available second channel, not a recommendation. The bridge already serves two
  clients atomically (E16p).

**API 25 source + javadoc.** `reference/BitX/BitwigAPI/BitwigAPI25.txt` is the
full extension-api 25 source for 276 types. Only the `.jar` is in the Gradle
cache — no `-sources` — so member enumeration has been done by live probe
(E16o: *"`InsertionPoint` has exactly 14 members"*). ⚠ **Do not vendor the BitX
copy into this repo**: it is Bitwig's source redistributed by a third party, and
its licence for that has not been established. Instead resolve
`com.bitwig:extension-api:25:sources` from `maven.bitwig.com` into the Gradle
cache and record the lookup route in `host-api.md`. Falling back to reading the
BitX copy in place, under `reference/`, is acceptable and changes nothing.

## Acceptance

1. `plan/knowledge-base.md` is registered in `ROADMAP.md` and reachable from the
   reading routes.
2. `evidence/capability/INDEX.md` exists, states the four rules, and lists every
   page it links.
3. `containers.md` is complete: every fact above present, each tagged and cited,
   the Selector deactivation fact recorded as `[I]` with its probe named, and the
   "cannot be seeded" conflation corrected in place with its supersession noted.
4. The BitX facts are integrated with provenance and with BitX framed accurately
   as data-plus-existence-proof, not as technique.
5. `README.md`'s authority order and capability reading route are amended.
6. No experiment file is edited. No `decisions/` file is edited — ⚠ if a
   capability page and a D-file disagree, that is a decision review and belongs
   to its own session, not this one.
7. `ruby context/check.rb` passes and `git diff --check` is clean.
8. No change under `brain/`, `extension/` or `tools/`.

## Out of scope

- Any product, brain or extension change, including the `DeviceMatcher` and
  device-observable leads. This session records them; adopting them is Phase 4
  or a 3f successor.
- Running any new probe. Every `[U]`/`[I]` here names the probe that would settle
  it and leaves it unrun.
- Re-opening the Selector route. The 2026-08-15 deactivation finding closes it
  for live A/B; the page records the capability, and the product stays on layers.
- Migrating the 70 experiment files or collapsing the E-index. The capability
  axis sits alongside them and links back.
