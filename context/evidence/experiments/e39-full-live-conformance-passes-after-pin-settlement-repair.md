---
id: E39
kind: evidence
state: active
source: phase-1-session-5g-live-conformance-third-attempt
---

# E39 — Full live conformance passes after the pin-settlement repair [K] (2026-08-16)

**Verdict: the complete live conformance suite passes in one invocation. All
53 runnable cases are green. The six deliberate skips keep their prior evidence
qualifications. Session 5g is complete.**

## Live result

`probe:hello` passed before the run. The deployed extension reported 134 wire
methods, hash `c2aa57be11e1f47e`, host API 25, and a start time later than the
deployed file. The project held the documented 10 durable tracks and 10 scenes.

The complete `probe:conformance` suite ran once without a filter. It reported
**53 passed, 0 failed, and 6 skipped** across 59 cases. `C-minted` passed under
full-suite load. `C-twoclips` passed with the E36 ownership repair. The later
two-clip revert also passed with both expression values intact after E38's
pin-settlement repair.

## Deliberate limits

The same six runner skips remain qualified by prior evidence:

- `C-turn` needs the fake adapter's deterministic clock. E2 and E8 supply the
  live same-turn evidence.
- Five `C-bank`, `C-scene-row`, and `C-cover` rows require a manufactured track
  or scene overflow. E5, E16r, E19, E21, and E33 supply those live boundaries.

One passing `C-scene-row` case also has an overflow-only arm that does not run
on the live harness. Thus, six overflow claims remain qualified even though
five overflow rows are skipped. None of these limits is a fresh pass.

## Baseline and cleanup

The pre-run snapshot matched the documented baseline: 10 durable tracks, 10
scenes, 22 occupied launcher cells, selection at track 0 row 1, stopped
transport, the exact empty schema-v1 observation value, and three unpinned
cursor pairs on `gn-lay` row 0.

The run created `gn-conf-A` as
`06cd7b87-70b1-4cdd-8634-feb267a25b28` and `gn-conf-B` as
`15a1a9fe-9964-414d-b9b4-ab1746342c3d`. Cleanup removed only those durable
identities. Final readback matched all 10 durable track identities, all 22
occupied cells, 10 scenes, selection, stopped transport, and the exact
observation value. All three cursor tracks and clips were unpinned on `gn-lay`
row 0. `Last change` was restored to `Change · 4a-live-check` through the
project-bound status path.

## Verification

- Live handshake: 134 methods / `c2aa57be11e1f47e`; deployed build fresh.
- Full live conformance: 53 passed, 0 failed, 6 qualified skips.
- Description cohort: `ghostnote-description-v1`, 15 tools, SHA-256
  `9fa9bc1cc390f7a274b64b41c6aea26235562822ed7f804d9f6aac7dea540ebd`.
- Context check and `git diff --check`: pass.

## Decision impact

D6 and D15 are unchanged. E39 confirms that E36's dual-handle ownership and
E38's separate pin-settlement state hold under full-suite load. Session 5h can
now prove the pushed candidate in remote CI.

## Retrospective

Resolve generated cleanup targets by durable identity before deletion. The
existing cleanup probe supports that workflow. No repository instruction
change is needed.
