---
title: Phase 10 — Breadth and release
kind: plan
state: planned
status: Deferred from Phase 9. Phase 8 accepted the engine and publication candidates (E272); 10b retains the handoff.
updated: 2026-10-18
parent: ../ROADMAP.md
prev: ../phase-9/README.md
---

# Phase 10 — Breadth and release

This is the former Phase 9 backlog, moved on 2026-10-18. Sessions 9a, 9b,
and 9c are now 10a, 10b, and 10c. Historical evidence keeps its original
phase names. [Phase 9](../phase-9/README.md) now holds the overlap investigation.

This phase contains independently schedulable breadth and release work.

## Why it is structured as a bag

INITIAL_PROMPT §1 sets the goal as *"expand to as much live DAW control as the
Controller API permits, in rough order of feasibility and personal usefulness."* Once
Phases 0–5 are in, feasibility is largely settled — the API sweep found typed
primitives for nearly all of this — so the ordering criterion collapses to **personal
usefulness**, which cannot be predicted in advance and should not be pre-committed.

## First publication item

[10a — `bwmod` publication review and extraction](10a-bwmod-publication-review.md)
remains the first publication item when this backlog resumes. The Phase 8
dogfood gate is closed
([E272](../../evidence/experiments/e272-8i-gate-close-out.md)). The
first Phase 5 closeout settled the internal asset policy and deferred external
redistribution review. Session 10a checks that boundary before it prepares the
standalone package. It does not publish externally without explicit approval.

Before a release candidate,
[10c — Release and Bitwig upgrade live suite](10c-release-and-upgrade-live-suite.md)
selects the occasional live checks that prove the host assumptions of the
live product path. It runs for release candidates and Bitwig upgrades.

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
- **The browser** — keep typed Bitwig browser work only where the adapter can
  address and verify it. Computer use owns open-ended visual discovery.

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
- **The version 1.0 FIELDS/JSON format package**, selected by
  [D25](../../decisions/d25-fields-json-document-format-and-publication.md).
  [10b](10b-compact-bar-publication-review.md) owns the specification, reference
  codec, model format reference, conformance corpus, examples, and benchmark
  results and reproduction. The
  [product review](../../evidence/format/FORMAT_BENCHMARK_PRODUCT_REVIEW.md)
  starts its README. Phase 8i must accept the live use and exact publication
  candidates. External release needs approval of the prepared package.

### Packaging & hygiene

- **Retire the `stable-v1` profile.** D40 names its removal after 8i, and
  the [8i close-out](../../evidence/experiments/e272-8i-gate-close-out.md#interface-verdicts)
  gives it the retire verdict. Remove the frozen cohort, its server
  instructions, the `stable-v1`-only operation handle and musical patch
  path, and the device-alternate assets (I07, I08, I21 in the
  [workstation interfaces](../../evidence/format/WORKSTATION_INTERFACES.md));
  keep the migration records. Run the wire goldens and `probe:hello`.
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

## Historical boundaries

Phase 6 supersedes the earlier permanent exclusions for local audition,
audio feedback, documentation search, and a broader workstation architecture.
The overlap investigation reopens earlier scope exclusions, except musical
generation, which remains the driving agent's responsibility. In particular,
[9a](../phase-9/9a-live-grid-editing-spike.md) investigates internal live Grid
editing. Earlier limits remain evidence about the paths tested at the time:

- A custom chat harness (D4).
- Grid patch authoring and DrivenByMoss or OSC were outside the earlier scope (§9).
- Named Bitwig actions failed the E6 tests.
- Runtime modulator creation and routing were not found through the E7 API paths.

## Exit criteria

There are none, by design. This document is a backlog. The honest completion test for
the project as a whole is the Phase 8 dogfood gate, applied continuously: **does it
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
