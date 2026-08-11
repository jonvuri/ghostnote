---
id: E16j
kind: evidence
state: active
source: FINDINGS.md
---

# E16j — ⚠ E6 IS WRONG: named actions fire BACKGROUNDED, and one of them creates a group track [K] (2026-07-26)

**Verdict: ⚠ ● the foreground gate does not exist.** Every named action tested
fires with Bitwig **behind another window** *and* **minimised to the Dock** —
including `Create Group Track`, which creates a real group track, and the
*Editing* action `Group`, which wraps the current selection into one. **Row E3's
"only a human can bring a group into existence" was true of the TYPED api only.**
E6's blocker 1 (foreground required) and blocker 2 (Editing actions additionally
need panel keyboard focus) do not reproduce. Blocker 3 (the selection hazard) and
blocker 4 (zero readback) both **stand, and blocker 3 was observed live**.
Probe: `e16j-actions.ts`. 5 runs — 4× `bg`, 1× `min` — identical every time.

⚠ **This is evidence, not a decision.** Standing rule 6 / D13 forbids named
actions and this does not repeal it; §8.5's group-topology call remains the
user's (standing rule 10). What changed is that the rule now costs something it
did not appear to cost before.

### What was run, and why it is not `e06*` re-run

A **new** probe on an independent path, per the handoff: different target action,
different oracle, and a control E6 never had. Verified **only** by `track.list`
diff and `scene.count` — never by `invoke()`'s return.

| action | category | `bg` (visible, behind) | `min` (minimised) |
|---|---|---|---|
| `Create Instrument Track` (control, **open**) | Project | ● track in ~235–243 ms | ● |
| **`Create Group Track`** | Project | ● **an empty Group track** | ● |
| `Group` | Editing | ● **wraps the selection** | ● |
| `Create Scene` — ⚠ **E6's own instrument** | Project | ● `scene.count` 99→100 | ● |
| `Create Instrument Track` (control, **close**) | Project | ● | ● |

Three design features carry the weight:

1. ⚠ **`Create Scene` is the exact action `e06-diag2` scored as a backgrounded
   silent no-op and `e06-diag3` scored as a foregrounded 9→10 bump.** Same
   action, same `scene.count` oracle, opposite result. This is not "E6 tested
   something else" — it is E6's own instrument contradicting E6's own write-up.
2. **Bracketed controls.** A Project action ran first *and* last in every run;
   both fired, so the window state held for the whole window and no trial sits in
   an unobserved gap.
3. **A same-category, same-observable positive control.** `Create Instrument
   Track` makes a *track*, read through the *same* `track.list` diff as the
   target, and has an exact typed twin (`track.create` →
   `application.createInstrumentTrack`). E6's control was a different object read
   through a different oracle, so it could not separate "the channel is dead" from
   "this action does nothing". This one can.

### ⚠ Why the discrepancy is UNEXPLAINED — and what it is not

**The version is not the explanation.** E0 (2026-07-18) recorded Bitwig **6.0.6,
`hostApiVersion` 25**; `probe:hello` reports 6.0.6 / 25 today. E6 ran 2026-07-19
on that same build. Nothing about the host moved.

**It is not per-action either.** The probe checks explicitly that E6's instrument
and the new control agree; they do, in every run. So whatever gates actions — if
anything does — is a property of *state*, not of the individual action, and E6
did not generalise from a sample of one.

Candidate explanations, **none of them established**: a Bitwig preference the
user has since changed; some session-scoped state in E6's sitting (a modal, an
un-clicked window, a wedged bridge — E16's rig notes record a jar-corruption mode
that leaves the port bound and requests unanswered); or a defect in E6's
foreground/background labelling. ⚠ **`e06-diag2` was deliberately NOT re-run
verbatim**: its first statement is a bare `invoke('Undo')` followed by two further
undos, which — now that actions fire — would push real undos into the project and
could resurrect deleted litter. Its one unique instrument is reproduced inside
`e16j` instead.

⚠ **`fg` was not run.** Foreground is the state E6 already measured as *working*,
so re-measuring it adds nothing; the open question was only ever whether the
background states differ, and two of them do not.

### What still stands from E6 — including the hazard, observed live

- **Blocker 4 ● zero readback confirmed.** `invoke()` returned
  `{"success":true,"resolved":true,"resolvedName":…}` for *every* action, whether
  or not anything happened. A resolved action that did nothing is
  indistinguishable from one that worked, from the return value alone. Only the
  `track.list` diff separates them. **For group creation this is soft** — the
  effect is observable even though the call is mute — but it is soft *only* where
  the effect happens to be visible in a diff.
- ⚠ **Blocker 3 ● the selection hazard is real and was watched happening.** The
  `Group` action wrapped **exactly `gn-J`** — the throwaway track
  `cursor.pointTrack` → `selectChannel` had selected moments earlier. That is E6's
  seven-orphan mechanism working precisely as documented; the only difference is
  that this probe aimed it at something disposable on purpose.
- **Blocker 2 ○ does not reproduce.** `Group` is an *Editing* action and it fired
  with **no** focus action invoked first. E6's diag4 needed
  `focus_or_toggle_clip_launcher` before `Duplicate` would touch a *clip* — but
  diag7 already showed `Duplicate` firing against the *track* selection without
  it. Read together, E6's own data says Editing actions dispatch against whatever
  panel holds focus rather than failing to fire, and `Group` acting on the track
  selection is consistent with that. The panel-focus retry path in `e16j` never
  triggered, because the target never missed.

### What `Create Group Track` actually gives you (and what it does not)

- It creates an **empty** group, and does **not** wrap the selection — measured
  by the collapse oracle: `wraps 0 track(s)`. `Group` is the one that wraps.
- ⚠ **An empty group may be worth very little.** `moveTracks` is a silent no-op
  (E16 row A / D–G), so there is no way to move an existing track *into* it. The
  only known route to "a track inside a group" remains duplicating a track that is
  already in one (row E3). **`Group`-the-Editing-action is therefore the
  interesting one**, because wrapping the selection is the only measured way to
  put a *chosen* track inside a *new* group — and it is also the one that fires
  against the selection our addressing sets.
- Not measured: whether a group made this way survives save/restart, what it does
  to the bank window under `ALL_CHANNELS` (**D4**, still unmeasured), or whether
  `Ungroup` reverses it cleanly.

### ⚠ Incidental: two coordinate systems for `position`, and one bad guard

Found while fixing a false alarm in the probe's own selection guard; both are
traps for anyone reading cursor state back.

1. ⚠ **`CursorTrack.position()` and the flat bank's `Track.position()` are
   different coordinate systems.** Measured: a freshly created track reported
   `position: 8` in `track.list` and `cursorTrackPosition: 7`, because the flat
   bank counts `gn-E16` — nested inside `Group 7` — as its own row and the
   cursor's ordinal does not. **They agree only for tracks that sit ahead of every
   group with children**, which is exactly how such a comparison passes testing
   and then breaks in the field. Standing rule 2 again: these are ordinals, do not
   compare them across handles.
2. **`cursor.status.trackName` is the CLIP cursor's track** (`clip.getTrack()`).
   On a track with no clips it reads `""` with `trackExists:false` **forever**, so
   it cannot confirm a selection on a freshly created track. `e16i` only worked
   because it pointed at `gn-A`, which has clips. `e16j` gives its subject a clip
   for this reason alone (never launched, so it never makes a sound).

### ⚠ Method note: an assertion that encodes the hypothesis

The first version of this probe **failed the run** when the control fired in
`bg` mode — it asserted "the control did NOT fire, therefore this really was
backgrounded", which is E6's model written as a self-validation. It fired, and
the probe reported a red X against a true result. The verdict block was rewritten
to assert only what is true whichever way the world is (bracket agreement, the two
instruments agreeing with each other, cleanup) and to **report** the direction.
Worth remembering: a self-validating control is only self-validating if the
hypothesis it encodes is the *rig's* correctness, not the *finding*.

### ⚠⚠⚠ METHOD, the costliest lesson in E17: our own READ destroyed the state under test

**`cursor.pointTrack` is not a read.** It is `CursorTrack.selectChannel()`, and
**E16j proved it sets the UI track selection** — a fact this project already knew
and had written down. Every helper that "just looked at the fixture" (`levels()`,
`chains()`, `devicesOn()`, `scope()`) called it, so nearly every named-action
measurement in E17 ran against a UI selection our own instrument had just reset to
the track. `e17ab`'s DESTROYER arm shows it directly: identical recipe, inject that
one call, ● becomes ○.

⚠ **This produced roughly a dozen false negatives and three wrong hypotheses**
(the foreground gate, the focus toggle, "the panel's current device wins"), each of
which was a plausible single story for an outcome that had a different cause.

**The rules it earns:**

1. ⚠ **Classify every helper as READ or WRITE, and write it in the name.** A
   function called `levels()` that silently re-selects a track is a trap. If a
   "read" invokes any `select*`, it is a write.
2. ⚠ **Between establishing a precondition and firing the action, call NOTHING.**
   `e17aa` worked and `e17z` did not for exactly this reason, and no amount of
   argument about focus or foreground would ever have found it — only diffing the
   two call sequences did.
3. ⚠ **A cheap dedicated readback beats a rich general one.** `layer.selectionState`
   exists because `layer.list` walks device banks and moves cursors. The narrow
   read is the safe one.
4. ⚠ **When a negative persists across many mechanisms, suspect the HARNESS before
   concluding about the API.** Twelve ○s across six probes said "chains are
   unreachable". One ● from a run that happened to skip a helper said otherwise.
   ⚠ The tell was there the whole time: `e17l` — the single positive — was also the
   single probe with no cursor call between selection and action.
5. ⚠ **A control that reproduces the FAILURE is worth as much as one that
   reproduces the success.** The DESTROYER arm is what turned "we think our reads
   were the problem" into a measurement.
6. ⚠⚠ **A probe's SETUP is part of its experiment.** `e17ac` held its variable
   fixed correctly and was still void, because the scaffolding that built its
   fixture called `device.selectInEditor` — a call already PROVEN to override the
   thing being measured. Audit the constants, not just the variable.
7. ⚠ **Measure every level, every time, forever.** Three separate probes in this
   spike read "nothing happened" while a container was being duplicated one level
   above where they were looking. The cost of an all-levels reading is a few
   hundred milliseconds; the cost of omitting it has now been three void runs.
8. ⚠⚠ **A probe can poison the NEXT probe.** `focus_or_toggle_device_panel` is a
   toggle; `e17ac` fired it repeatedly and left the device panel **CLOSED**, so
   `e17ae` — which fires no focus actions at all — inherited a shut panel and its
   control read Δ0. State leaks across runs, and "I did not call it" is no defence
   when a previous run did. ⚠ The operator caught this, not the instrument:
   *"after this and the last test, the device panel closed."*

### ⚠⚠ THREE of our own calls silently disable chain actions

Every one of them was in our tooling, not in Bitwig, and each produced ○s that were
written up as properties of the API:

| our call | what it really does | how it was caught |
|---|---|---|
| ⚠ `cursor.pointTrack` | `CursorTrack.selectChannel()` — sets the UI track selection (E16j) | `e17ab` DESTROYER arm |
| ⚠ `device.selectInEditor` | sets the device panel's current DEVICE, which beats the chain selection (`e17x`) | `e17ac`'s confound |
| ⚠ `focus_or_toggle_device_panel` | a **TOGGLE** — an odd number of fires CLOSES the panel, after which chain actions do nothing at all | ⚠ the operator's eyes |

⚠ **A FOURTH, and it is the worst because it is invisible to every probe: the
project acquired TWO tracks named `gn-lay4`.**

    [9]  gn-lay4   Instrument   9a88b37d    ← the real fixture
    [10] gn-lay4   Instrument   4fbe7653    ← an orphan fork

A named `Duplicate` fired against the **UI TRACK selection** and forked the whole
track — E6 blocker 3 / E16j's documented hazard, the same mechanism that once
created seven orphan duplicates. ⚠ **Every E17 probe resolves its subject with
`tracks.find(t => t.name === SUBJECT)`, which silently returns the FIRST match.** So
we were selecting a chain on track 9 while the UI selection sat on track 10, and
firing the action at neither usefully. That is what killed both `e17ae` runs, and
the closed-panel theory offered for the first one was wrong.

⇒ ⚠⚠ **A NAME IS NOT AN IDENTITY.** D6 says this for addressing and it was never
applied to the probes' own fixture lookup. Rules now enforced in `e17ae`:
**refuse when a name matches more than one track**, and **assert no orphan track
appeared after every action, by channelId** — because an action that forks a track
reads as "○ nothing at all" to any probe measuring only devices and chains.

⇒ ⚠ **The precondition for acting on a chain, stated positively:** exactly one track
carries the subject name; the device panel is OPEN and showing the container; the UI
track selection has not been moved since; the panel's current device has not been
set; the chain's `selectedInEditor` flag is verified at the instant of firing. Every
earlier ○ in E17 violated at least one.

⚠ **`e17ab`'s "COLD" arm was not cold, and this needs saying plainly.** It meant *no
click inside this probe* — but that session had had the operator clicking chains
repeatedly through `e17y` and `e17aa`. The project has since been saved, quit and
reopened. So **"no human is needed" is NOT established**; it was measured in a warm
session and named cold. It may still be true — the orphan track is a sufficient
explanation for the later failures on its own — but it must be re-run in a
genuinely unprimed session before it can be recorded.

⚠ **`e17z` arm A is now also suspect**: its dispatch control fired the focus toggle
before arm A ran, so arm A's *"○ nothing at all"* may have been a closed panel
rather than a result. It does not change `e17ab`'s ●, which stands on its own COLD
arm, but arm A should not be cited.

### ⚠ The constraint this sitting worked under, and what it rules out

The user's standing instruction for this session: **Bitwig being the focused app
must not be load-bearing, and no OS-level focus work — no `osascript`, no focus
detection, no bringing Bitwig up programmatically.** If foreground had turned out
to be required, the answer was to **abandon named actions, not to build a
precondition check around them.**

So the predecessor handoff's central new idea — "foreground is DETECTABLE from
the brain via `osascript`, which converts a silent no-op into a refusal" — **was
declined and never built.** Focus state was established from inside the
experiment instead, by the bracketing positive control, and the window-state
label is the human's report, recorded verbatim and ⚠ **unverifiable by the probe
on purpose**.

⚠ **Added 2026-08-01 — a second standing instruction, and `e17v` is why:**

> **User:** *"I need you to stop and confirm with me before automatically running
> anything that needs the foreground gate. Do not assume I'll see your message."*

**Never start a foreground-gated probe on your own initiative.** Arrange it with
the operator first. `e17v` is the cost of not doing so: it passed its dispatch
control at 47 s once the operator brought Bitwig forward, then lost the gate the
moment they alt-tabbed to their terminal to type a message, and **every arm after
that was void** — including the reference arm that exposed it. ⚠ **A
foreground-gated probe and a live conversation cannot share one screen**, so the
in-probe "CLICK INTO BITWIG, retrying for 90s" prompt is not a substitute for
agreeing the run in advance: the operator has to be *watching the probe*, not the
chat, for the whole run and not just its first minute.

That constraint is what makes the `min` run the decisive one. "Backgrounded" is
not one state, and `behind` is not evidence for `minimised`. Actions firing with
the window **not rendered at all** is what removes window state from the
question — had it only worked while Bitwig was on screen, the capability would
have been unusable regardless, because we had already refused to build the
detector that would make it safe.

### What this does and does not settle

- ● **Group creation is mechanically available to a background agent.** E3's ○ is
  now specifically "no *typed* api"; `createParentTrack` remains init-only
  (`e16i`), unchanged.
- ○ **It does not repeal standing rule 6 / D13.** The rule's other three legs —
  zero readback, the selection hazard, and "an inapplicable action is a silent
  no-op" — are all intact, and blocker 3 was demonstrated live in this very probe.
- ⚠ **It does raise the price of the rule**, which is the whole point of
  re-testing it: §8.5's provisional "be group-SAFE, do not build ON groups" rested
  on *"a topology gated on a human action at an arbitrary moment is a dead end"*,
  and that premise is now false.
- ⚠ **Unexplained contradictions of a prior finding are themselves a finding.**
  E6 is 4 blockers; 2 reproduce, 2 do not, on an unchanged host. Until the cause
  is known, **neither E6 nor E16j should be treated as the settled account of why
  actions fire** — only of *whether* they did, on the days they were run.

---
