---
id: E35
kind: evidence
state: active
source: phase-1-session-5g-live-conformance-first-attempt
---

# E35 — Full conformance exposes a two-clip property cross-read [K] (2026-08-16)

**Verdict: the first 5g run failed one existing live conformance row. `C-minted`
passed under full-suite load, but clip B read back clip A's pan value in
`C-twoclips`. Session 5g remains open.**

## Live result

`probe:hello` passed before the run. The deployed extension reported 134 wire
methods, hash `c2aa57be11e1f47e`, host API 25, and a start time later than the
deployed file. The project held the documented 10 durable tracks and 10 scenes.

The complete `probe:conformance` suite ran once, without a filter or a second
invocation. It reported **52 passed, 1 failed, and 6 skipped** across 59 cases.
`C-minted` passed in that run. The one unexpected failure was:

```text
C-twoclips: and so does clip B — neither may be silently dropped
actual pan: -0.25
expected pan: 0.5
```

Clip A was authored with pan `-0.25`. Clip B was authored with pan `0.5`.
Thus, this is not the silent property loss that the existing E15-F assertion
expects. The observed value crossed the two authored values. The current run
does not establish whether the wrong value persisted in clip B or came from a
stale read handle. D15 requires a separate handle or a re-point before that
distinction can be made.

## Deliberate limits

The runner reported six skips:

- `C-turn` needs the fake adapter's deterministic clock. E2 and E8 supply the
  live same-turn evidence.
- Five `C-bank`, `C-scene-row`, and `C-cover` rows require a manufactured track
  or scene overflow. E5, E16r, E19, E21, and E33 supply those live boundaries.

One passing `C-scene-row` case also contains an overflow-only arm that does not
run on the live harness. Therefore, six overflow claims remain qualified even
though only five overflow rows appear as skipped in the test-runner summary.
None of these limits is reported as a fresh pass.

## Baseline and cleanup

The pre-run snapshot recorded 10 tracks, 10 scenes, selection at track 0 row 1,
a stopped transport, the exact empty schema-v1 observation value, and three
unpinned cursors on `gn-lay` row 0. It recorded these occupied zero-based rows:

| Track | Occupied rows |
|---|---|
| Instrument Layer | 2, 4 |
| Hybrid 2 | 1, 2 |
| gn-A | 0–9 |
| gn-B | 0, 5 |
| Group 5 | 0–2 |
| gn-lay | 0 |
| gn-lay4 | 0 |
| gn-sel | 0 |
| FX 1, Master | none |

The documented conformance cleanup removed `gn-conf-A` and `gn-conf-B` by
their generated identities. It found no other generated track. Final readback
matched all 10 durable track identities, all 22 occupied cells, 10 scenes, the
selection, stopped transport, observation value, and all three cursor targets
and pin states. `Last change` was restored to `Change · 4a-live-check` through
the project-bound status path.

## Decision impact

D15 is unchanged and controls the repair diagnosis. A focused repair must first
distinguish persisted cross-clip mutation from stale readback. It must then add
the smallest regression that reproduces the full-run ordering state. Session 5g
must run again in one complete invocation after the repair.

## Retrospective

Record test-runner skips separately from conditional live limits. The two
counts are not interchangeable. No repository instruction change is needed.
