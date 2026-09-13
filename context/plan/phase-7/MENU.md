---
title: Phase 7 — Workstation dogfood menu
kind: plan
state: planned
updated: 2026-09-13
parent: README.md
---

# Phase 7 — Workstation dogfood menu

## Priority menu

Use one fresh projectless session for each selected item. Supply the musical
content and exact acceptance criteria at run time.

1. **Reference-conditioned composition and revision.** Give the host agent an
   owned seed and permitted references. Render the selected musical context,
   compile a bounded patch, verify exact invariants, and audition the result.
2. **Theory-guided analysis and revision.** Read a clip block, provide exact and
   derived musical evidence, let the host agent select a change, and compare the
   before and after reports.
3. **Audio-guided sound design.** Make controlled parameter changes, capture
   matched level-controlled snippets, compare deterministic sensory packets,
   and wait for the operator's aesthetic verdict. No perceptual provider is
   currently selected.
4. **Documentation-guided construction.** Answer one Bitwig workflow or native
   device question from exact-version offline sources, then use the result in a
   real patch without web search.
5. **Hybrid preset orchestration.** Retry the three-voice Repro-5, Diva, and
   bass request. Computer use owns vendor preset browsing and loading. The
   Bitwig adapter owns supported structure, composition, and readback. This does
   not reopen [D22](../../decisions/d22-non-native-plugin-preset-loading-is-out-of-scope.md).
6. **Device-alternate audition.** Create several alternatives for one device,
   switch them, compare matched audio snippets, and keep one explicit choice.

## Existing Bitwig-adapter menu

These tasks remain available. Pull one forward only when it tests a current
module or integration question.

- Create and revise a clip, including metadata and launch behavior.
- Generate, inspect, revise, and cancel a long asynchronous clip operation.
- Build a multi-pad Drum Machine kit and beat.
- Inspect and change native, VST3, or CLAP parameters.
- Inspect and edit supported saved-preset modulation.
- Build a layered device source from supported sources.
- Add and rename an owned track, add scenes, and move or copy clips.

## Cross-run questions

- Did the workstation remove slow UI work or add ceremony?
- Did the agent-facing context improve the musical decision?
- Did a reference improve the result without unacceptable direct copying?
- Which sensory field changed the decision?
- Which verification step found a real defect?
- Which verification step repeated already sufficient evidence?
- Did each module work when another module was absent?
- Was the final claim supported by the stated evidence source?

## Required result

Record the root session, client, model, reasoning effort, workstation and tool
versions, Bitwig and host API versions, project baseline, enabled stable and
experimental modules, operating mode, source and reference provenance, writes,
external UI changes, captures, evidence labels, timing, operator verdict, and
exact exit state.
