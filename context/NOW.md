---
title: Current state
kind: status
state: active
updated: 2026-10-19
phase: phase-9-overlap-investigation
session: 9b.1-stock-grid-preset-survey
---

## Next session

**9b.1 — Stock Grid preset survey.** Read the
[9b working style and session brief](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md).
Survey about 12 stock presets and the 9a control on a scratch track. Grid
reads are read-only; fixture setup and cleanup use the public surface.
Produce E300, the catalog first pass, the symbol manifest, and the 9b.2 scope.
Ask the operator which project to use: suggest `gn-grid-spike` or a new
empty project. No extension rebuild or controller replacement is expected.

[9a is complete](evidence/experiments/e299-grid-spike-close-out.md).
After breadth, build discovery needs the operator's Bitwig 6.1.x update,
with 6.0.6 copied aside. That update waits for the general feature audit.

## Deployment and fixture

V13 remains deployed by operator choice: `phase-8-probe-v1`, 118 methods,
`2e939035ea90b8b0`, marker `gridReadProbe: 9a-grid-audio-v13`.
Run `npm run probe:hello` from `brain/` before live work and check this
identity. The normal profile is not restored. See the
[deployment record](evidence/data/phase9a-operator-audio/deployment-v13.json).
The V13 audio test session is used and released. **Do not repeat its
prepare, run, or restoration workflow on that initialization.**

Last verified in [E298](evidence/experiments/e298-grid-operator-audio-live-test.md):
`gn-grid-spike` was open at its saved baseline, unstarred; four modules,
two cables; `grid-probe` muted at -10 dB; engine inactive; transport stopped.
Check the current project and selection before live work. Keep `grid-probe`
unchanged; use a new scratch track and delete it at the end.

Use `gn-grid-spike-baseline.bwpreset` as the survey control. The
[9b.1 inputs](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b1--stock-grid-preset-survey-read-only)
give its path and the baseline records. The edited E289 project copy is not
a baseline. E299 and the later planning and cleanup made no live request.

## References

- [Phase 8 dogfood archive](archive/outcomes/PHASE-8-DOGFOOD.md): results,
  related sessions, issue dispositions, and retained evidence.
- [Roadmap](plan/ROADMAP.md): the independent 8i17 survey and Phase 10 work.
- [Repository instructions](../AGENTS.md) and [context guide](README.md):
  live safeguards, verification, and implementation references.
