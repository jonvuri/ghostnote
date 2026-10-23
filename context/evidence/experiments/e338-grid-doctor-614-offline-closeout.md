---
title: E338 — Grid doctor 6.1.4 offline close-out
kind: evidence
state: active
updated: 2026-10-22
owner: phase-9b
---

# E338 — Grid doctor 6.1.4 offline close-out

## Result

Session 9b.6g ends under its second stop rule: a concrete dependency that
offline checks cannot supply. All 55 type roles, 76 member roles, and 16
fields resolve on both jars and on both renamed fixtures with unrelated
additions. Six structural mutants and one read-dependency mutant are
refused. Many local bounds hold under explicit conditions. **No complete
command has offline bounded admission, and that criterion does not
converge.** [D52](../../decisions/d52-grid-upgrade-admission-policy.md)
replaces it with guarded runtime admission. Session 9b.6h prepares the
guarded doctor on 6.1.4.

No live request, vendor class initialization, native write, controller
replacement, deployment, doctor attempt, or acceptance-cache change
occurred in 9b.6g. E330 remains the last verified live state. V20 remains
pinned to 6.0.6. Step 2 stays open.

## What 9b.6g established

The evidence root is
[`614-resolution/`](../data/phase9b-doctor/614-resolution/). Checkpoints
1–16 and the [handoff supplement](../data/phase9b-doctor/614-resolution/handoff-2026-10-22/README.md)
record the symbolic resolution, bootstrap contracts, descriptor catalog,
constructor bounds, invariant costs, disposal wrappers, listener forms,
and inert JDK models. [Checkpoint 17](../data/phase9b-doctor/614-resolution/checkpoint-17/README.md)
records five parallel investigations on 2026-10-22. All results carry
`boundedAdmission: false` and explicit conditions.

| Area | Conditional result | Open after the check |
| --- | --- | --- |
| HashMap removal | 160 + 29N linked, 719 + 110N + 308H tree instructions, one native hash; 51,725 inert cases | Exact receiver, key kind, assertion state, stability, runtime class identity |
| Owned collector | Fresh exact `ArrayList`; worst receiver 550 vendor and 2,291 + 39K JDK instructions; same on four jars | Runtime tree guard; native time |
| Serialized tree | One managed node; M = 1, R = N - 1 for serialized data | Runtime truth |
| Tracking mode | Two writers, only through `agent_debug` behind `testing-features` | Retained |
| Factory route | 36 branches: 6 bounded, 3 excluded, 27 open; first call in a fresh process is cold and compiles | Cold path, clone queue wait, refused `b_:Hgx` group |
| Command cores | 13 roots on both jars; no ping, manager switch, or lock wait in any core | Frontier edges, pending runnables, listener counts |
| History growth | 8 + 64H + 59S + 13N + 12SD per hook; constant under an empty-helper gate | Two new roles; global monitor wait |

The widening is the material finding. Factory and command closures each
opened more branches than they closed; `oDc.ng_` alone has 2,818 dispatch
targets. Cache warmness, pending-list size, listener counts, the actual
document and context classes, the debug flag, and table capacity are
runtime facts. The replay-worker hang exists on both builds and was
present when E316 accepted 6.0.6. These facts, with the retained waits
and monitors, are the concrete dependency behind D52.

## Verification, cost, and preservation

The complete offline suite runs 417 tests: 387 pass and 30 integration
tests skip (`gn-9b6g-unit-regression-26.log`, archived in checkpoint 17).
Regression 25 confirmed the 346-test suite before the five investigations.
The session added 319 unit tests across 98 diagnostic Python files; the
checkpoint 17 source inventory records their hashes. Each new check's
limits and measured run are in the
[ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#9b6g-descriptor-and-dependency-resolution--model-before-implementation).
No live path, product budget, or tool description changed.

The [preservation check](../data/phase9b-doctor/614-resolution/preservation.json)
compares all 224 entry files against the immutable entry inventory: none
missing, none changed. Original selectors, prior diagnostic code and
evidence, attempts, the accepted 6.0.6 cache, the deployed normal archive,
the saved audit copy, and the clean working project keep their bytes.
Checkpoints 1–17 and the supplement preserve 1,434 archived development
files in their manifests and every diagnostic source snapshot.

## Retrospective

Set an acceptance criterion that is decidable before starting a sustained
session. "Bounded admission of every command path" had no decidable end,
and each checkpoint reported honest progress toward a receding goal. The
plan's stop rules were right; apply the dependency rule as soon as a
condition is shown to be a runtime fact. Five parallel investigations with
one shared brief, distinct artifact prefixes, and no shared-file edits
worked well; each report was verified by rerunning its tests before use.
A field-scan prefilter that matches only the declaring owner is unsound,
because a reference can name a subclass.
