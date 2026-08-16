---
id: E37
kind: evidence
state: active
source: phase-1-session-5g-live-conformance-second-attempt
---

# E37 — Full conformance reaches two-clip revert but pin confirmation times out [K] (2026-08-16)

**Verdict: the second 5g run passed `C-twoclips` and `C-minted`, but the later
two-clip revert case timed out while it confirmed cursor 0 on clip A. Session
5g remains open.**

## Live result

`probe:hello` passed before the run. The deployed extension reported 134 wire
methods, hash `c2aa57be11e1f47e`, host API 25, and a start time later than the
deployed file. The project held the documented 10 durable tracks and 10 scenes.

The complete `probe:conformance` suite ran once, without a filter or a second
live invocation. A sandboxed launch failed in the local `tsx` bootstrap before
the test process started or connected to Bitwig. The same command then ran
outside that restriction as the one complete live invocation.

The live suite reported **52 passed, 1 failed, and 6 skipped** across 59 cases.
`C-twoclips` passed with the E36 ownership repair. `C-minted` also passed under
full-suite load. The unexpected failure was:

```text
C-revert: a TWO-CLIP revert keeps the expression on both (E15-F)
AddressUnresolvedError: address did not resolve: cursor 0 did not confirm
track 8, row 0 after 8 attempts
```

The failing address was clip A on the generated `gn-conf-A` track. The case
had created both clips, written distinct pan values, cleared both through the
executor, and asked the executor to restore them. The failure occurred during
the first independent read after the revert. It did not produce a note-property
verdict for either restored clip.

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

The documented cleanup removed `gn-conf-A` and `gn-conf-B` by their generated
durable identities. Final readback matched all 10 durable track identities,
all 22 occupied cells, 10 scenes, selection, stopped transport, and the exact
observation value. All three cursor tracks and clips were unpinned on `gn-lay`
row 0. `Last change` was restored to `Change · 4a-live-check` through the
project-bound status path.

## Decision impact

D15 is unchanged. The failure happened before independent note readback, so it
does not change the E15-F property-stage result. A focused repair must trace
target and pin confirmation separately under the complete two-clip revert
ordering. Session 5g must run again after that repair.

## Retrospective

Report target confirmation and pin confirmation as separate states. A generic
point timeout hides which state did not settle. No repository instruction
change is needed.
