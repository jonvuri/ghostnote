---
title: E224 — Final shadow acceptance
kind: evidence
state: active
updated: 2026-10-04
owner: phase-8g5
---

# E224 — Final shadow acceptance

## Status

[8g5](../../plan/phase-8/8g5-final-shadow-acceptance.md) is complete. The 8g
gate passes inside the supported-state matrix below. It relies on three named
assumptions: [D26](../../decisions/d26-step-data-delivery-is-a-named-assumption.md),
[D27](../../decisions/d27-later-callback-ordering-is-a-named-assumption.md),
and [D28](../../decisions/d28-slot-occupancy-delivery-is-a-named-assumption.md).
No host input fence is proved. A later session can select 8h; this session did
not enter it. All live cache results keep `complete:false` and `eligible:false`.
E131 keeps stable read and write authority.

Entry HEAD is `249fa93`. The entry index and worktree were clean. No Java code
changed. The final research build is the 8g5c build, marker
`8g5c-combined-storage-v4`.

## Supported-state matrix

The supported path is one Launcher clip on a flat or bounded-group
instrument track. Coverage is `0..2048` cells at `1/512` beat, all 16 channels,
and the acquired field set. Each read admits values only through a confirmed
step-delta window. Occupancy is admitted only through a confirmed slot-delta
window. A clip reference names a slot address inside one identity domain:
initialization, project generation, structure epoch, and rebuild generation.
The reference stays while its registry entry lives, across content edits,
retirement, and rebinding. A rebuild, a structure or project change, or a step
change during a read window deletes it, and the next binding mints a new one.
The reference is not proof of the same host clip object: a silent delete and
recreate at that address keeps it. Content is checked again on every read, and
occupancy never supplies identity.

| State or path | Result | Evidence |
|---|---|---|
| Cold and warm read, all channels, disabled raw controls | Supported; shadow equals independent authority | E214, E219, E223, E224 |
| Field-only, add, move, remove, clear, refill, final cell | Supported | E214 mutations, E224 |
| Stable public sparse patch, then warm reacquisition | Supported for the shadow; see the stable writer finding | E214, E224 |
| Native note edit, then reacquisition | Supported; retained output is discarded | E214, E224 |
| Project detour P→Q→P during any read stage | Refuse, or publish P content only (D26, D27) | E218; final-build rerun in E224 |
| Slot occupancy, 512 channels, 128 scenes | Supported (D28); no identity claim | E222, E223 |
| Bounded groups: 256 base tracks, FX, Master, two wrappers | Supported topology | E221, E223 |
| Collapsed child as primary binding | Refuse `binding-budget` | E221, E223 |
| Group track own slots | Excluded from clip inventory | E222 |
| 513 channels or more | Whole-project refusal; recovery passes | E223 |
| 16 MiB snapshot and 24 MiB combined estimate | Equality passes; excess sheds and refuses | E219, E223 |
| Changed window, structure, or binding during a read | Retire with no payload; explicit recovery only | E214, E218, E220, E224 |
| Requested span wider than coverage, partial channels, unknown field | Exact route refuses `authority-coverage-unavailable` | E214, E224 |
| Partial, warming, rebuilding, invalid, ambiguous, dirty, overflow | Not complete; exact fallback or refusal | Core tests, E214, E219 |
| Stale base or stale proposal | Refuse; a new observation is necessary | E224 |
| Host clip object identity, A–B–A continuity | Unproved; references are address tokens only | E215, E216, E222, E224 |
| Cache-owned heap and host memory | Unmeasured; estimates only | E219, E223 |
| Native input ordering, host input fence | Unproved; named assumptions | E217, E218 |

## Parent criteria

| Criterion | Result |
|---|---|
| Every in-contract shadow result matches normalized authority | Pass. 0 mismatches in the final research counters. No unexplained mismatch, silent overflow, or unbounded rebuild |
| Every state declares its health | Pass |
| No unhealthy or partial snapshot is complete | Pass. All live outputs have `complete:false` and `eligible:false` |
| Old callbacks and generations cannot change current output | Pass under D26 and D27. The final-build rerun has 0 foreign outputs |
| Structural repair and rebuild follow 8d | Pass in the bounded scope; collapsed-child binding refuses |
| Limits and fallback follow 8e | Pass (E219, E223) |
| Memory follows the sparse and handle model | Pass for domain estimates and allocation counts. Heap is unmeasured |
| Stable authority is unchanged | Pass. 85 normal methods, hash `bba7383dce25c0f0` |
| Fixtures removed and baseline restored | Pass |
| Required checks | Pass |

## Consumer workflows

The [driver](../../../brain/src/probes/phase8g5-consumers.ts) used owned
project P (`New 9`), Inst 1, rows 2 and 3. Row 2 holds the 11-note target
`gn-8g5-A`. It has notes on channels 0, 3, 7, 9, 12, and 15, a channel
collision at cell 0, the final cell 2047, and disabled chance, occurrence,
recurrence, and repeat values. Row 3 is the populated canary. The fixture
oracle is the declared writes plus defaults from the first raw read. Each case
compares the snapshot, the authority scan, and a separate raw bridge read with
this oracle. The [library](../../../brain/src/probes/phase8g5-consumers-lib.ts)
holds the oracle and checks.

| Case | Route | Result |
|---|---|---|
| Cold read-only | New binding; public `acquire_clip_note_source` | Match; stable source agrees |
| Warm read-only | Same resident | Match |
| Public sparse patch | Stable `transform_clip_music` transpose, then warm reacquisition | Match; stale reapply refused |
| Field-only | Bridge velocity and pan edit; warm reconcile | Match |
| Native delete | Operator deleted G3 at 1.3.1 | Retained output discarded |
| Native reacquisition | Retire, then bind again; same address reference | Match |
| Unhealthy window | Write lands during the authority scan | `step-window-changed`, no payload |
| Exact fallback | Requested scope, all channels, no cache membership | Match, including the written note |
| Restoration | Note removed; new reference after the window retirement | Match |
| Unavailable authority | Width 2049, partial channels, unknown field | Three refusals, no payload |

Every live consumer decision is `exact-fallback` with reason `unhealthy`,
because the adapter keeps eligibility closed. The combined admission check
evaluates health, coverage, identity, zero dirty work, replay, window, and
budget together. Budgets pass; admission still refuses `lifecycle-unverified`.
Nine pure decision controls use live snapshots labelled complete. They reach
observation, preparation only, partial fields, partial coverage, unavailable
authority, stale generation, stale interpretation, and stale base. They are not
live eligibility.

### Stable writer finding

The public transpose rewrote the clip through the legacy E131 reconstruct path.
It enabled four disabled controls on notes that the patch did not mention, and
reset disabled recurrence 8/85 to 1/1. Pan, timbre, gain, and the disabled chance
value were kept. The shadow snapshot, the independent authority, and the raw
read all show the same result, so the cache is correct. The
[migration contract](../../contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md)
already records the legacy loss of disabled recurrence values and assigns
"refuse reconstruction that would lose it" to 8h. This measurement extends the
known loss to the enable flags. 8h owns the fix; 8g does not change the
stable writer. The verifier accepts only this legacy field class. After the
write, the independent raw read becomes the base for later declared changes.

## Final-build detour regression

8g3 split enrichment across polls after E218. Thus three E218 arms were run
again on the final build with fresh P (`New 9`) and Q (`New 10`) witnesses.

| Arm | Trials | Published | Foreign | Differs | Refusals |
|---|---:|---:|---:|---:|---|
| Same-callback at an open read window | 20 | 0 | 0 | 0 | `step-window-changed` 11, `window-changed` 9 |
| Same-callback, random operation | 30 | 10 matches | 0 | 0 | `window-changed` 12, `identity-window-changed` 8 |
| Exact at an open read window, run 2 | 12 | 6 | 0 | 0 | `automatic-identity-invalidated` 5, `authority-window-changed` 1 |

Exact run 1 stopped by rule at trial 6 of 12. Its independent oracle read
refused `authority-host-work-budget` with no output. The published set equals
all five earlier independent P reads. It is a retained diagnostic, not an
acceptance trial.

## Measurements

Wall times include the driver's ping sample and raw read. Host reads are
`getStep` calls. Avoided reads are what a promoted cache read would skip
relative to the exact scan.

| Case | Wall | Bridge bytes | Membership | Authority | Enrichment | Avoided |
|---|---:|---:|---:|---:|---:|---:|
| Cold read | 8.93 s | 1.58 MB | 35,984 | 4,194,304 | 160 | 4,158,160 |
| Warm read | 3.67 s | 0.53 MB | 0 | 4,194,304 | 160 | 4,194,144 |
| Patch reacquisition | 3.74 s | 0.54 MB | 18,496 | 4,194,304 | 176 | 4,175,632 |
| Exact fallback | 2.52 s | — | 0 | 4,194,304 | 0 | — |

The authority scan takes about 2.5 s of each comparison and 125–144 ms of
host work. The public read-only source took 2.11 s in one tool call. The
public patch took 12.99 s in three tool calls; the stale reapply was a fourth
call. The whole consumer run used 463 bridge calls and 3.45 MB of responses.

**Largest shadow cost:** the independent authority scan. It makes 4,194,304 reads
per comparison over one 2,048-cell clip. **Most common fallback cause:** the
closed live eligibility gate. It applies to 6 of 6 consumer decisions. In the
detour arms, the most common refusal is `window-changed`: 21 of 62 trials.

## Restoration and verification

The research archive (`e51ea249…28d73`) and config (`6e195ab8…34ae`) were
deployed. The operator confirmed replacement. Research hello passed with 97
methods, hash `f03f19414f40e3d3`, the marker, and fresh initialization
`2026-10-04T05:13:23.353Z`. After the run, the exact original config was
restored (`256bbf07…43b0`). The normal archive was deployed, byte-identical at
`fd1e32ea…3e03f4`. The research archive was removed after its hash matched.
The operator loaded normal ghostnote and closed New 9 and New 10 without
saving. Normal hello passed with 85 methods, hash `bba7383dce25c0f0`, and fresh
initialization `2026-10-04T05:30:31.485Z`. The
[protected check](../data/phase8g5-final/new3-final-baseline.json) matches the
[adopted New 3 baseline](../data/phase8g5a-group/new3-baseline.json) twice,
including its reader and empty clip. Viewport restoration is not asserted.

Brain typecheck and all 1,812 tests pass. Extension `check` passes, including
all four archive registrations. All earlier artifact verifiers pass. Active wire
goldens are current at 85, 90, and 97 methods. The context check passes.

## Artifacts

Run `node --import tsx src/probes/phase8g5-final-artifacts.ts` from `brain/`.
It checks 11 pinned files in [phase8g5-final](../data/phase8g5-final/) and
recomputes each role. Brain tests refuse rehashed and meaning mutants. The
two consumer diagnostics are retained separately. The first stopped on a
verifier defect: it compared serialized key order, and the values are equal. The
second stopped on the stable writer finding.
