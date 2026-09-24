---
title: Phase 7b follow-up — Hybrid observer acquisition
kind: plan
state: planned
status: Planned. Prove a requested dirty-and-quiet fast path with an authoritative silent fallback.
updated: 2026-09-24
parent: 7b-follow-up-consolidated-clip-acquisition.md
prev: 7b-follow-up-flush-boundary-settlement.md
next: 7b-follow-up-played-range-consolidation.md
evidence: E14, E51-E53, E119, E130-E132
---

# Phase 7b follow-up — Hybrid observer acquisition

## Purpose

Test a hybrid clip-acquisition path. Use requested flushes only to wake sparse
enrichment after a dirty `addStepDataObserver` replay. Use the complete
dual-grid reader when the view stays silent or any fast-path guard fails.

Empty-to-empty transitions are not a fast-path acceptance case. They are an
expected fallback case. The experiment must prove that they always reach the
complete reader without an early empty result.

Keep the stable reader unchanged. Keep all new behavior in the experimental
`phase-7b-agent-note-patch-v0` profile until the complete gate passes.

## Starting facts

- E131 proves that a settled `1/512` and `1/768` sparse union matches the
  complete reader on its controlled fixtures. Conservative 250 ms settlement
  per view makes that route slower.
- E132 rejects `flush()` as a universal completion fence. The first requested
  flush completed early 119 times in 330 trials.
- In E132, the first requested quiet flush after dirty had zero early results
  in 270 dirty trials. It missed all 60 requested empty-to-empty trials.
- Requested second-quiet flushes also had zero early results in the dirty arm.
  Passive second-quiet flushes completed early 12 times.
- A target has an exact observed track and scene canary. Grid and page changes
  have no equivalent exact host value.
- The complete reader uses a measured 144 ms view-settlement delay. The sparse
  probe uses a conservative 250 ms observer-settlement floor.
- `requestFlush()` remains an output request. This experiment can establish an
  empirical optimization only. It cannot change the API 25 contract.

## Proposed hybrid

Treat one grid and page as one view. Start the observer view and prepare the
separate complete-reader cursor for the same view at the same time.

The fast path is eligible only when all conditions are true:

1. The current generation started before the view action.
2. The exact target canary reports the requested track and scene.
3. At least one step-data callback makes the generation dirty.
4. A requested quiet candidate occurs after that dirty callback.
5. The callback count does not change during snapshot and all-channel
   enrichment.
6. Two targeted enrichments that bracket the selected confirmation window have
   the same coordinates, channels, fields, and normalized timing.
7. The result has valid coordinates, channels, fields, and timing.
8. Project, target, scene, content, and cursor guards remain unchanged.

If no eligible dirty candidate arrives by the fallback deadline, scan the
prepared complete-reader view. Also fall back after any drift, timeout,
ambiguous reconciliation, late callback, or failed guard. A timeout must never
return a sparse result as probably complete.

Run the rule independently for both `1/512` and `1/768` grids and for every
extent page. One silent page uses the complete reader for that page. It does not
invalidate safe fast pages from the same acquisition.

Do not wait 250 ms and then start the complete reader. Prepare its independent
cursor with the observer so its 144 ms settlement clock runs concurrently.
Measure the extra cursor and selection work. Refuse the design if concurrent
preparation weakens existing selection, pin, or target guarantees.

## Candidate timing rules

Test these requested rules in shadow mode:

1. First requested quiet flush after dirty.
2. First requested quiet flush plus one unchanged 48 ms confirmation task.
3. Second requested quiet flush after dirty.

Test three request patterns separately:

- one `requestFlush()` immediately after dirty;
- requests at 0, 24, and 48 ms after dirty; and
- the bounded repeated request pattern used by E132.

Select the least active rule that passes the complete adversarial gate. Do not
combine results from different request patterns. Passive flushes are a negative
control, not a promotion candidate.

## Adversarial matrix

### Content shapes

Cover sparse and dense short and long clips. Include:

- all 16 MIDI channels at one occupied coordinate;
- adjacent and overlapping same-pitch notes;
- all readable optional note fields;
- straight and triplet timing at page and grid boundaries;
- notes near the first and last cell of each page;
- long empty spans between populated pages;
- identical occupancy with different channels, fields, and durations; and
- identical complete content on different targets.

### View races

Exercise target, grid, page, and combined target-grid-page changes. Include:

- populated to different populated and identical populated views;
- dense to sparse, sparse to dense, and disjoint occupied coordinates;
- populated to empty as a dirty clearing transition;
- rapid A-to-B-to-C changes before B settles;
- grid changes in both directions while a target replay is pending;
- adjacent and non-adjacent page changes while prior callbacks are pending;
- a return to the prior view before its first replay completes; and
- cold first use after a controller reload and warm repeated use.

Submit competing actions at 0, 8, 16, 24, 32, 48, 72, 96, 120, 144, and
192 ms around the measured replay windows. Use bounded bridge-task load to vary
control-surface scheduling. Record callback ownership only as local evidence.
Never assume that a local generation proves host ownership.

### Concurrent edits

Apply controlled edits before dirty, between dirty and quiet, during
enrichment, and after the candidate snapshot. Include:

- note add and remove;
- channel-only changes that preserve occupancy;
- field-only changes that preserve occupancy; and
- edits on the requested target and on an unrelated clip.

Content or target drift must reject the fast candidate or make the complete
reader win. A same-occupancy edit must not pass because the sparse coordinate
set stayed equal.

### Accepted fallback cases

Run empty target to empty target, empty page to empty page, and a completely
empty clip across both grids. These cases need no dirty callback. They pass only
when:

- no fast result is returned;
- the complete reader returns exact empty truth;
- the timeout is bounded; and
- fallback overhead stays within the accepted latency limit.

Also force missing callbacks, late callbacks, target-canary lag, enrichment
drift, and normalization ambiguity. Each fault must select the complete reader
or return an explicit refusal.

## Shadow proof and stopping rule

Run the hybrid candidate in shadow mode. Always run the settled complete reader
and compare before returning a result.

Collect at least 3,000 dirty candidate comparisons with zero early completion.
Use at least three fresh controller loads. Collect at least 750 comparisons for
each family: target, grid, page, and combined race or edit. Each named delay and
content shape must have at least 30 comparisons.

Zero failures in 3,000 trials gives an approximate one-sided 95 percent
rule-of-three upper bound of 0.1 percent per measured trial. Record that this is
statistical evidence, not an API guarantee. Do not treat correlated trials as
independent proof.

If any candidate completes early, reject that exact rule. A revised rule must
restart the full count at zero. Do not tune around one failed transition and
retain results from the old rule.

Run at least 300 silent fallback trials. Include 100 empty-target, 100
empty-page, and 100 completely empty clip views. Require zero fast returns and
zero truth mismatches.

## Truth and latency

At every candidate, copy observer state and enrich all 16 channels on the next
safe control-surface task. Repeat targeted enrichment at the commit boundary.
Reject any digest change. Compare coordinates, channels, every note field, and
normalized timing with:

1. a late stable observer snapshot;
2. the settled complete reader for that grid and page; and
3. the reconciled complete dual-grid clip result.

Record action, target canary, first and last callback, dirty flush, quiet
candidate, enrichment, any later callback, fallback decision, host scan time,
bridge time, normalization time, and total acquisition time.

Benchmark short and long sparse and dense clips. Report median and p95 values
for fast pages, silent fallback pages, mixed clips, and complete-reader control.
The hybrid passes performance only if:

- populated fast-path median improves by at least 25 percent;
- complete acquisition median improves by at least 15 percent on the selected
  representative workload; and
- silent fallback p95 adds no more than 15 percent over the complete-reader
  control.

Do not hide extra target or selection work outside the reported total.

## Implementation boundary

Add the smallest bounded recorder needed for the shadow proof. Do no network
I/O or unbounded scan inside `flush()`. Schedule enrichment outside `flush()`.

If the gate passes, add the hybrid only to the experimental acquisition route.
Return per-view route and timing evidence. Keep a distinct experimental
authority label until a later promotion decision. Do not change the stable
reader, stable tool profile, mutation path, or 144 ms reader budget.

If the gate fails, remove the recorder and keep E131 unchanged. If the gate is
inconclusive, keep shadow instrumentation only when it has a specific next
test. Do not leave an unused product hook.

## Acceptance criteria

- Empty-to-empty is an explicit complete-reader fallback, not a fast-path
  failure.
- Every fast candidate is dirty, requested, guarded, and immediately enriched.
- The selected rule has zero early completions across at least 3,000 dirty
  adversarial comparisons and three controller loads.
- At least 300 silent views return only complete-reader truth.
- Late prior-view callbacks and same-occupancy edits cannot pass unnoticed.
- Target, grid, page, and combined transitions remain distinct in the report.
- Passive and requested results remain separate.
- The complete reader starts early enough to bound silent fallback overhead.
- The latency gates pass for median and p95 measurements.
- The stable reader and stable tool profile do not change.
- Owned fixtures are removed. Tracks, selection, cursors, pins, and transport
  return to their exact entry baseline.
- Focused tests, the complete brain check, extension tests, `context/check.rb`,
  the wire-golden check, live hello, and `git diff --check` pass.

## Out of scope

- Claiming that `flush()` is a documented input fence.
- Returning a sparse result after silence or timeout.
- A persistent observer cache.
- A stable public hybrid acquisition contract.
- Changes to note mutation, proposal, or reversal behavior.
- The independent played-range consolidation trial.

## Completion and return route

Record the result as E133. If the gate passes, keep the hybrid behind
`phase-7b-agent-note-patch-v0` and remeasure the complete acquisition tool. If
it fails, remove the probe hooks and keep E131. Then resume the
[played-range consolidation trial](7b-follow-up-played-range-consolidation.md)
in a fresh Codex chat.

## Retrospective target

Record whether concurrent fallback preparation preserved its latency and
selection guarantees. Record whether adversarial timing found a real boundary
or only increased confidence in an undocumented heuristic.
