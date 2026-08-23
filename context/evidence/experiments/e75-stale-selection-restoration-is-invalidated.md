---
id: E75
kind: evidence
state: active
source: dogfooding-d01-follow-up-2
---

# E75 — Stale selection restoration is invalidated [K] (2026-08-23)

**Verdict: a cached selection must still be the selected slot in the current
project before the live adapter can restore it. A stale pair no longer hides a
successful content read.**

## Offline boundary

`LiveAdapter.captureSelection()` now checks a nonnegative cached pair through
`slot.status`. It saves the pair only when the exact slot reports
`isSelected: true`. A row outside the scene window and the bridge's exact invalid
track errors produce no saved selection. Other bridge failures still propagate.

The offline regression models a four-track project with cached track index `5`.
The device read returns `Polysynth`. Capture sends `slot.status` for track `5`,
row `2`. It sends no `slot.select` restore. A separate regression rejects an
unrelated bridge failure. The existing selection-scope regression still proves
one final restore for a valid current human selection.

## Live project-switch result

The read-only `probe:d01-selection` check ran in project `New 2`. The project had
four tracks. `selection.status` returned cached track `5`, row `0`.
`slot.status` rejected that exact pair with `no track at index: 5`.

The fixed adapter returned an empty, complete device chain with bank size `16`.
The trace contained no `slot.select` restore frame. The final selection remained
track `5`, row `0`. Project revision `273`, content epoch `32864`, project name,
track count, and scene count were unchanged.

## Verification

- Focused live-adapter tests: 88/88 pass.
- `npm run check`: 829/829 pass.
- `./gradlew test`: passes from `extension/`.
- `npm run probe:hello`: all checks pass with 148 live methods.
- `npm run probe:d01-selection`: 6/6 pass.
- No extension wire behavior changed, so no extension deploy was required.
- The live check changed no Bitwig content or selection.

## Retrospective

Validate cached observer coordinates through current object state before replay.
