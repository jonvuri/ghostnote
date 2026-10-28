---
title: Backlog
kind: backlog
updated: 2026-10-27
---

# Backlog

Priority-ordered work for Ghostnote. Order within a band is the priority.
Use the requested item, or the top `next`/`queued` item that is not blocked.
Write or refine a brief in [`work/`](work/) when scope or a handoff needs it;
use the [optional template](work/TEMPLATE.md) if helpful.
Record useful results once and mark completed items `done`. Reorder, split,
or drop items as needed; keep IDs stable and give new items the next free ID
in their family (V, R, P, C, I, or B for other work).

Statuses: `next`, `queued`, `blocked`, `later`, `external`, `done`.
Source links point at the wave-4 [decision log](plan/overlap/wave-4/decisions.md),
the [workflow sequence](plan/overlap/wave-4/workflow-sequence.md), the
[work-session briefs](plan/overlap/wave-4/work-sessions.md), and the wave-3
[work records](plan/overlap/wave-3/report.html). Those documents are source
material for the selected items. The phase model (`plan/phase-*`) is history.

## P0 — now

| ID | Item | Tags | Status | Brief / source |
|---|---|---|---|---|
| B08 | Scrollable container scopes: the three product scopes are one-wide device banks scrolled to the requested position, so layer chains are observable and writable at every top-level position in the 16-device bank. Research (E352) and implementation (E353: compose, read, the five chain tools, and a cross-container move at positions 3 and 5, with the clamped-scope repair) complete; nested-window scrolling and a cheaper structure-read scope policy are follow-ups. | structure, implementation | done | [brief](work/b08-scrollable-container-scopes.md); [E352](evidence/experiments/e352-scrollable-container-scopes-retarget-live.md); [E353](evidence/experiments/e353-scrollable-container-scopes-product-live.md); DP-3; E63 |
| B17 | Extension-owned scrolling and retirement of window-derived caps are complete. Sessions 1–2 proved scopes and reads (E354, E356); session 7 integrated the write routes and cap retirement (E357): five-device/six-chain compositions at positions 17/18, sixth-chain controls, distant and mixed transfers, and overflow top-level mutations. Two brain integration fixes address discarded paged reads and structural deletion snapshots; uncertain insertion errors retain possible effects. Cleanup and original inventories/selection pass. Descriptions v57; named-slot/parameter bounds and D44 remain. Six-chain composition measured 44.4 s; P01 owns the repeated proof cost. | structure, implementation | done | [brief](work/b17-extension-owned-window-scrolling.md#session-7-result); [E354](evidence/experiments/e354-extension-owned-container-scopes-live.md); [E356](evidence/experiments/e356-paged-device-and-layer-reads-live.md); [E357](evidence/experiments/e357-integrated-paged-writes-live.md) |
| R01 | Formats, claims, and public naming: compare Producer Pal notations and transforms with FIELDS/JSON; assess dense claims and first-save annotation continuity; propose a public format name. Current notation is the default. | song, research | queued | [R01](plan/overlap/wave-4/work-sessions.md#r01--formats-claims-and-public-naming); [V01 finding](work/v01-engram-purifico.md#closeout-assessment); W4-007, W4-021 |
| R02 | Pressure reproduction: audit E15/E236 and external handlers, reproduce independently, prepare upstream evidence if confirmed. | song, research | queued | [R02](plan/overlap/wave-4/workflow-sequence.md#r02--pressure-reproduction-and-upstream-evidence); W4-006, D37 |
| P01 | Edit-path performance and recovery cost: attribute repeated inventories and full clip captures, simplify recovery-only machinery under D54; the B08 container-scope read policy (skip non-containers, rotate the far scope, scope count and width) and the staged `compose_devices` proof cost and device-unit weights after D46. Offline audit first; B17 is complete. E357 six-chain composition costs 44.4 s / 703 turns, close to the D44 ceiling; prioritize the repeated paged inventories and staged proofs in that audit. | perf, cleanup | queued | [P01](plan/overlap/wave-4/work-sessions.md#p01--edit-path-performance-and-recovery-cost); W4-016, D54 |
| V14 | Add devices and presets by name: `resolve_device_name` resolves stock, VST3, CLAP, and Bitwig-preset names from the running host configuration; all four insert and verify live, with refresh, ambiguity, and cleanup. | sound, implementation | done | [brief](work/v14-add-devices-by-name.md); [E351](evidence/experiments/e351-device-name-resolution-live.md); DP-5; R05, R06 |

## P1

| ID | Item | Tags | Status | Brief / source |
|---|---|---|---|---|
| V02 | Edit difficult MIDI without hidden loss: field-by-field verdicts for expression, channels, timing, pickups, overlaps, clip ranges. | song | queued | [V02](plan/overlap/wave-4/workflow-sequence.md#main-path); CA-1 |
| V03 | Arrange and revise song sections: exact Arranger reads, place and move MIDI sections, tempo/meter/position; cue markers optional. | song | queued | [V03](plan/overlap/wave-4/workflow-sequence.md#main-path); CA-3, CA-4, SM-4, SM-5 |
| V04 | Shape the arrangement with automation: read and edit points and curves, move a passage with its automation. | song | queued | [V04](plan/overlap/wave-4/workflow-sequence.md#main-path); CA-6 |
| C01 | Audit and retire `stable-v1`: inventory old-only machinery, migrate shared code, remove the profile. | cleanup | queued | [C01](plan/overlap/wave-4/work-sessions.md#c01--audit-and-retire-stable-v1); D40, E272, DL-4 |
| I01 | Internal-host dependency register: classify each tool and route, refuse whole tools before mutation on missing internals. | platform | queued | [I01](plan/overlap/wave-4/work-sessions.md#i01--internal-host-dependency-register-and-refusal-boundary); [register](plan/overlap/wave-4/host-access.md); W4-022 |

## P2

| ID | Item | Tags | Status | Brief / source |
|---|---|---|---|---|
| V05 | Edit existing audio as song material: read an audio clip's source and range, insert, trim, move, replace, delete. | song, audio | queued | [V05](plan/overlap/wave-4/workflow-sequence.md#main-path); CA-5, CA-8, MA-2 |
| V06 | Put externally sliced hits into a drum instrument: assign, read, replace, clear samples in Samplers on pads. | song, audio | queued | [V06](plan/overlap/wave-4/workflow-sequence.md#main-path); W4-019; MA-2, MP-9, DP-4 |
| R03 | Inaudible track readback feasibility: post-device, pre-fader, one existing clip, full span or a measure or two. | audio, research | queued | [R03](plan/overlap/wave-4/workflow-sequence.md#r03--inaudible-track-readback-feasibility); W4-008, W4-020 |
| V07 | Read back one track for external analysis using the R03 route. | song, audio | blocked by R03 | [V07](plan/overlap/wave-4/workflow-sequence.md#main-path); MA-3 |

## P3

| ID | Item | Tags | Status | Brief / source |
|---|---|---|---|---|
| V08 | Make the song sound playable: useful controls, ranges, remote mappings. | sound | queued | [V08](plan/overlap/wave-4/workflow-sequence.md#main-path); DP-2, DP-1 |
| R04 | Live mappings and modulation setters: per-setter route table from external references; first live brief. | sound, research | queued | [R04](plan/overlap/wave-4/workflow-sequence.md#r04--live-mappings-and-modulation-setters); W4-004 |
| V09 | Author and revise live modulation: amount, enable, mode, source, curve with independent verdicts. | sound | queued | [V09](plan/overlap/wave-4/workflow-sequence.md#main-path); MP-3, MP-4, MP-5, MP-7, MP-8, MP-10 |
| V10 | Construct a useful Grid instrument: read and catalog, values and cables, add and delete modules, mappings; operationalize doctor storage outside the repository. Sub-items are the former 11a to 11e. Grid writes record no inverse. | sound, grid | queued | [brief](work/v10-grid-instrument.md); W4-024; GI-1, D52 |
| V11 | Extend Grid where it changes the instrument: indexed values, relocation, FX/Note Grid, stateful attachment. | sound, grid | queued | [V11](plan/overlap/wave-4/workflow-sequence.md#main-path); GI-2 |

## P4

| ID | Item | Tags | Status | Brief / source |
|---|---|---|---|---|
| V12 | Balance the completed arrangement: levels, pan, create the Effect track a send needs, a send, track state, Master controls. Measure `createEffectTrack` and correct the `add_tracks` description. | mix | queued | [V12](plan/overlap/wave-4/workflow-sequence.md#main-path); W4-025; SM-1, SM-2, SM-3, SM-7, SM-10 |
| V13 | Polish and compare a mix revision through track readback or an operator export. | mix | queued | [V13](plan/overlap/wave-4/workflow-sequence.md#main-path); MA-3, SM-3 |
| REL | Lightweight release: one tested extension/brain pair, install and update steps, clean format spec, tested Bitwig versions only, GitHub release assets. Absorbs the former 10a, 10b, 10c, DL-1, DL-3, DL-5, DL-9. | release | queued | [outline](plan/overlap/wave-4/remaining-decisions.md#lightweight-release); W4-015, W4-023; [10a](plan/phase-10/10a-bwmod-publication-review.md), [10b](plan/phase-10/10b-compact-bar-publication-review.md), [10c](plan/phase-10/10c-release-and-upgrade-live-suite.md) |

## Later

Low priority by decision (W4-009, W4-010, W4-011, W4-013). Promote an item
when a workflow needs it.

| ID | Item | Tags | Status | Source |
|---|---|---|---|---|
| B01 | HTTP transport for the bridge extension; possible Python reference suite. | platform | later | W4-001 |
| B02 | Guarded agent-facing host undo tool, if workflows show the operator repeating undo for agent edits. | recovery | later | W4-024 |
| B03 | Group and Hybrid track creation, grouping, and routing (remainder of SM-7). | structure | later | SM-7 |
| B04 | Scene names, colours, duplication, launch controls; Launcher clip and track stop; groove. | live | later | SM-6, SM-9, SM-8 |
| B05 | Record Launcher playback into the Arranger. | live | later | CA-7 |
| B06 | Project save through the API. | reuse | later | SM-11 |
| B07 | Export a device's current state as a preset file. | reuse | later | DP-6 |
| B09 | Broader descriptor access for non-Grid objects. | platform | later | GI-4 |
| B10 | Offline `.bwclip` import. | interchange | later | CA-2 |
| B11 | Offline preset and Grid authoring: recursive codec, footprints, donor-free modulators, offline Grid presets. | offline | later | MP-1, MP-2, MP-6, GI-3; W4-013 |
| B12 | Grid resources, arrays, outer modulators, patches over 64 modules; DSP image work. | frontier | later | GI-5, GI-6 |
| B13 | Documentation and reference retrieval for the installed Bitwig version. | platform | later | MA-8 |
| B14 | Standalone bwmod package; `.bwpreset` spec and device-catalog publication. | release | later | DL-2, DL-7, DL-8 |
| B15 | Full change-record retention research (T5). | perf | later | W4-016 |
| B16 | Phase 5 generalized closeout, only where a selected route changes its need. | cleanup | later | [Phase 5](plan/phase-5/README.md) |

## External or won't do

| ID | Item | Status | Source |
|---|---|---|---|
| MA-1 | Cross-project sample and preset library search. Ghostworks owns it; Bitwig browser discovery is R05. | external | W4-010 |
| MA-4, MA-5, MA-6, MA-7 | Audio facts, features, musical navigation, separation, transcription. External consumers own them; existing modules stay until a caller inventory says otherwise. 8i17 is archived as a survey. | external | direction.md |
| GI-6 | DSP decompilation and modified-image deployment. | won't do | GI-6 |

## Done

| ID | Item | Closed | Record |
|---|---|---|---|
| R06 | Direct index feasibility: 407 VST3/CLAP entries, 28 identity checks and full prior instrument-name sets match; 7.69 ms median local read/parse/check. Preferences route detects live sound-content add/remove (E350); native/preset preamble and index freshness remain; no public resolver. | 2026-10-25 | [result](work/r06-native-index-discovery.md); [E349](evidence/experiments/e349-direct-plugin-index-discovery.md); [E350](evidence/experiments/e350-library-roots-from-preferences.md) |
| R05 | Filter-driven discovery and native identities verified; 60 sampled identities cross-checked. Minimal resolver contract proposed; normal controller restoration and handshake complete. | 2026-10-25 | [result](work/r05-browser-name-resolution.md); [E348](evidence/experiments/e348-browser-native-result-identities.md) |
| V01 | Built and saved two Engram / Via Purifico sections with existing tools and named presets; independently verified and accepted after audition. | 2026-10-25 | [result and follow-ups](work/v01-engram-purifico.md) |
| DIET | Reduced instruction load and inherited prescriptions; retained useful evidence and host procedures. Independently reviewed. | 2026-10-25 | [result](work/instruction-diet.md) |
| W4 | Wave 4 vision and scope planning; D54; 25 decisions. | 2026-10-24 | [decision log](plan/overlap/wave-4/decisions.md) |
| DL-6 | Correct contradicted working format references. | 2026-10-24 | wave 3 |
