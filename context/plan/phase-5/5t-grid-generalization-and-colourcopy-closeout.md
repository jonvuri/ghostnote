---
title: Phase 5t — modulator-grid generalization and ColourCopy closeout
kind: plan
state: planned
status: Queued next. Repair numbered-page verification, prove donor relocation, repair active witnesses, and close the ColourCopy loop.
updated: 2026-09-01
parent: README.md
evidence: D1, D2, D3, E11f, E65, E88, E94, E95, dogfood session 01a0607f-fc2a-7042-bfdd-0175a19986c1
---

# Phase 5t — modulator-grid generalization and ColourCopy closeout

## Purpose

Finish the grid repair without narrowing the public donor claim. Correct two
known offline defects, determine why Envelope Follower disappears in one
compact FX Layer composition, prove the complete public donor cohort at compact
positions, repair the active witness, and finish the ColourCopy dogfood loop.

## Starting facts

Commit `7d65edd` allocates compact three-row grid pairs. Dogfood session
`01a0607f-fc2a-7042-bfdd-0175a19986c1` proved the final four-type request on the
surface. The FX Layer stayed after Serato Sample. ColourCopy kept its exact
30-parameter fingerprint. Classic LFO, Beat LFO, Curves, and Random appeared in
compact page order.

The same transcript exposed three open defects:

1. Five Classic LFO instances loaded as `Classic LFO 1` through
   `Classic LFO 5`. The exact-name verifier expected five bare names and
   rejected the valid result. E11f already records Bitwig's numbering rule.
2. Envelope Follower did not produce its required page when it occupied compact
   pair `1:0` in an FX Layer. Its isolated donor proof used its zoo pair `4:0`
   on Polysynth. The transcript does not distinguish grid-linked state, host
   compatibility, or an observer defect.
3. Every final active-behavior sample failed because the supplementary remote
   inventory did not settle. Fresh structure, page, and DirectParameter reads
   settled afterwards, so the final result remained useful but incomplete.

The grid repair also changed `0x1a1a`. Curated-donor matching still normalizes
only `0x1a1b`, name, and routes. A planted donor can therefore lose its exact
footprint match after relocation. This is an offline correctness gap for later
sampled-preset replace and delete operations.

## Work order

### 1. Apply the bounded offline repairs

1. Add one shared page-family matcher. A singleton keeps its exact bare name.
   Duplicate pages must form the complete Bitwig ordinal family
   `<name> 1` through `<name> N`. Do not apply a general numeric-suffix strip.
2. Use the matcher in wrapper, general composition, and preset-authoring page
   verification. Keep zero-count and malformed-family checks fail-closed.
3. Add regressions for one page, five numbered duplicates, a missing ordinal,
   an extra ordinal, zero expected pages, and public names that contain digits.
4. Normalize `0x1a1a` as well as `0x1a1b` during curated-donor footprint
   matching. Update the matching comments and format documentation.
5. Add sampled-preset regressions that add a donor in a later grid column, then
   replace and delete it without an explicit footprint override. Confirm every
   reference stub moves by the exact donor footprint.

### 2. Discriminate the Envelope Follower failure

Use disposable owned presets and one exact-cleanup live matrix. Do not use the
musical ColourCopy project for this experiment.

| Host | Pair | Purpose |
|---|---:|---|
| Polysynth | `4:0` | Reproduce the isolated-donor control. |
| Polysynth | `0:0` and `1:0` | Test whether compact relocation changes load or page presence. |
| FX Layer outer list | `4:0` | Separate host shape from coordinate rewriting. |
| FX Layer outer list | `0:0` and `1:0` | Reproduce and isolate the dogfood failure. |

For every row, record binary validation, object inventory, exact page inventory,
and active or structural standing according to the manifest. Use an adjacent
positive donor in the same preset. Reverse each public write and restore the
documented baseline.

If the failure follows the pair, create one human-saved Envelope Follower at a
failing compact position and compare the complete object with the zoo donor.
Patch every proved identity-linked field, or curate a bounded position-safe
asset rule. Do not guess from one byte. If the failure follows FX Layer, record
an explicit host capability and refuse that combination before a project
write. If only the observer fails, repair its selection or settlement path.
Do not weaken or remove the exact-page witness.

### 3. Prove compact placement across the donor catalog

1. Compose all 42 supported donors offline in manifest order. Confirm compact
   pairs across every row and column transition and validate the complete
   preset.
2. Exercise the public cohort live in requests of at most 16 modulators, which
   is the wrapper contract limit. Permute cohorts so every donor moves away
   from its zoo coordinate at least once.
3. Require every expected page family and inspect the tile grid at the row-2 to
   next-column boundary. Apply each manifest witness mode honestly. A
   note-driven or audio-driven type is not called inactive without its trigger.
4. Include repeated same-type controls and replace controls. Confirm replacement
   keeps the resident tile.
5. If any type cannot relocate, narrow the catalog with a precise live-proved
   rule before continuing. Do not preserve the 42-type claim by omission.

### 4. Repair the post-move active witness

1. Reproduce the nested supplementary-inventory timeout with one free-running
   target and an adjacent fresh-read control.
2. Check generation re-arming, target selection, and cursor reuse after device
   relocation. A fresh stable inventory must not be hidden behind a stale held
   generation.
3. Add delayed-settlement and never-settles tests. Retry the complete inventory;
   do not combine pages from different generations.
4. Prove active divergence on at least two free-running ColourCopy routes. Use
   the manifest trigger for condition-driven catalog cases.

### 5. Run the final ColourCopy dogfood

Start a new projectless Codex task. Keep the original restrictions: use only
public Ghostnote tools, and do not inspect the repository or run shells, tests,
or probes.

1. Discover ColourCopy and its stable DirectParameter inventory.
2. Wrap the same instance at its existing signal position after Serato Sample.
3. Add at least four useful modulators, including a later-column tile.
4. Prove the exact scalar fingerprint, complete compact tiles and pages, exact
   routes, and active behavior.
5. Make the result auditionable and wait. Record only an explicit operator
   accept or veto.

### 6. Close Phase 5

Run the complete 5s closeout matrix after the repaired dogfood result. Include
the full brain check, extension tests, deployed contract freshness, method-table
handshake, shared conformance, resource accounting, and remote CI. Reverse every
owned test case and restore its documented baseline. An accepted musical
ColourCopy result can remain only when the operator asks to keep it.

Update E88 and E95, the format specification, decisions D1 and D3, Phase 5
overview, capability evidence, outcome archive, roadmap, dogfood ledger, and
`context/NOW.md` from the measured result. Then hand off to Phase 6a.

## Acceptance criteria

- Numbered duplicate page families pass exact verification. Missing, extra, or
  malformed families fail.
- Curated-donor matching survives both grid-coordinate rewrites. Sampled
  replace and delete retain exact reference-stub relocation.
- Envelope Follower works at compact positions on every claimed host, or the
  public contract refuses one precise live-proved boundary before mutation.
- Every remaining supported donor passes compact-placement verification through
  the public surface according to its witness mode.
- Replacement keeps its resident tile. Add reuses the first free compact tile.
- The nested active witness settles and proves real parameter divergence.
- The final FX Layer preserves ColourCopy's instance, scalar fingerprint, and
  original signal position. Every requested tile is visible and interactive.
- The final transcript uses no repository, shell, test, or probe fallback and
  records an explicit operator audition verdict.
- All owned verification content reverses exactly. No temporary preset, track,
  device, clip, or launcher residue remains.
- Phase 5 documents only the capability breadth that the live matrix proves.

## Out of scope

- Runtime modulator creation or routing through the Controller API.
- Wavetable LFO companion-state support.
- New container kinds or larger public capacity limits.
- Publishing `bwmod` or product assets externally.

## Handoff

Phase 6a starts only after this plan passes and the open dogfood loop closes.
