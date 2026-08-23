---
title: Phase 6 — Breadth & release
kind: plan
state: planned
status: Not started. Session 6a is selected after the Phase 5 remote CI gate.
updated: 2026-08-23
parent: ../ROADMAP.md
prev: ../phase-5/README.md
---

# Phase 6 — Breadth & release

> **Purpose.** Everything that is genuinely useful but does not gate anything else.
> Unlike Phases 0–5 this is **not a sequenced phase** — it is a backlog of
> independently schedulable items, several of which will be pulled forward
> opportunistically when a real session makes one of them the obvious next thing.

## Why it is structured as a bag

INITIAL_PROMPT §1 sets the goal as *"expand to as much live DAW control as the
Controller API permits, in rough order of feasibility and personal usefulness."* Once
Phases 0–5 are in, feasibility is largely settled — the API sweep found typed
primitives for nearly all of this — so the ordering criterion collapses to **personal
usefulness**, which cannot be predicted in advance and should not be pre-committed.

## Next selected item

[6a — `bwmod` publication review and extraction](6a-bwmod-publication-review.md)
is next after Phase 5 closes. Phase 5 settled the internal asset policy and
deferred external redistribution review. Session 6a checks that boundary before
it prepares the standalone package. It does not publish externally without
explicit approval.

## Candidate items

### Session structure (§4's feature matrix)

- **Mixer state** — volume, pan, mute, solo, arm, activated, colour, name. High
  checkpoint fidelity (scalar readback), so cheap and safe.
- **Sends** — level, enabled, pre/post. Same fidelity story.
- **Transport** — tempo, time signature, play/stop, loop, metronome, position. Handles
  already exist from E7's rig work.
- **Scenes** — create, delete, name, colour. ⚠ Scene deletion **compacts rows
  upward** and a held pin's `sceneIndex` goes permanently stale (E3) — this is the
  one structural op with a known addressing trap.
- **Track creation and typing** — instrument/audio/effect/group. Note
  `createInstrumentTrack(position)` does **not** honour position; identify a new
  track by `channelId` set-difference, never positionally (E2f).
- **Group-track navigation** — `Track.createTrackBank`/`createMainTrackBank` for
  nested tracks. Our flat bank is the default; revisit only if groups matter.

### Musical breadth

- **The arrangement timeline.** Deliberately deferred throughout — launcher clips are
  materially more reliable than arrangement clips (§11, E2). Worth a real evaluation
  rather than a permanent exclusion, but with eyes open.
- **MPE / per-note expression at scale.** The channel is carried explicitly from
  Phase 2 precisely so this is not a retrofit (SPIKE_PLAN §2.5).
- **Groove engine** — capability noted in the API sweep, unexplored.
- **The browser** — full session API for preset/device/sample loading. Modal and
  stateful, so awkward for a stateless tool surface (§6b); the exploratory-search
  case is its real niche, not routine loading.

### Publishable artifacts

Per the "personal but releasable" decision — each is a cheap extraction, not a
product commitment:

- **`bwmod`** as a standalone library. Self-contained, tested, and it solves a
  problem the Bitwig community has documented as unsolved. The most obviously
  valuable thing this project could give away.
- **`BWFORMAT_SPEC.md`** — the `.bwpreset` format working spec, including the
  readings that turned out to be **wrong** and why. The negative results are worth as
  much as the positive ones to anyone else attempting this.
- **The device / param-ID catalog** — mechanically generated from the app bundle,
  and the exact gap WigAI issue #15 describes.
- **The extension itself**, if the daemon and MCP surface prove stable.

### Packaging & hygiene

- Install documentation, including the one-time manual step nobody can automate:
  Settings → Controllers → Add Controller → vendor "ghostnote".
- Cross-platform paths. The extension already reads `RigConfig` from
  `~/.ghostnote/rig.json`, and the API exposes `platformIsMac/Windows/Linux` — but
  nothing has been tested off macOS.
- Licensing and attribution. `NOTICE` already credits daw-mcp (MIT); any lifted code
  must keep its attribution, and template assets derived from Bitwig's bundled
  content need a decision before publication (see PHASE-5-AUTHORING).
- Bitwig version-compatibility policy. The API version tracks the Bitwig version
  (§11) and the bundled javadoc's version annotations **lag** the host — trust
  `getHostApiVersion()`, not doc archaeology (E0).

## What stays out permanently

Not deferred — decided against, and re-litigating them should require new evidence:

- A second DAW, a mirror model, local audition, or any sound surface but Bitwig
  (§2, §8h).
- A custom chat harness (D4).
- Offline generation / DAWproject; Grid patch synthesis; a library-cataloguing search
  engine; building on DrivenByMoss or OSC (§9).
- Named actions, in any form (E6 — unusable *and* hazardous).
- Runtime modulator creation or routing (E7 ○, exhaustive).

## Exit criteria

There are none, by design. This document is a backlog. The honest completion test for
the project as a whole is the Phase 2 dogfood gate, applied continuously: **does it
get used?**

## Risks

- **Breadth as procrastination.** Adding mixer controls is easier and more visibly
  productive than curating templates or measuring footprints. Watch for items being
  pulled forward because they are pleasant rather than because they are needed.
- **Publishing pulls the project's centre of gravity.** Extracting `bwmod` is cheap;
  supporting it is not. Extract, document honestly, and set expectations low.
- **The arrangement timeline is the largest hidden scope in the list** and the one
  with the weakest API guarantees. If it is attempted, it deserves its own spike in
  the style of the original — question, method, verdict, evidence.
