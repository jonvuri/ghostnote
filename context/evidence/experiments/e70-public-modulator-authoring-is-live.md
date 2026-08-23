---
id: E70
kind: evidence
state: active
source: phase-5-session-5f-public-modulator-surface
---

# E70 — Public modulator authoring is live [K] (2026-08-23)

**Verdict: one public write tool now expresses add, replace, retarget, and
delete with named types, named targets, exact live witnesses, recorded changes,
and no binary format controls.**

## Public surface

`author_modulators` accepts one human-saved preset path and one named operation.
It appends the edited preset as a new device. It does not change the saved file
or an existing project device.

The public schema has no donor id, internal route string, list index, route
index, removed footprint, reference offset, or sample-stub delta. Named target
recipes contain the internal route and exact remote witness. The current set is
Polysynth filter frequency, Polysynth filter resonance, and Sampler amp attack.

Add supports LFO, Random, and Vibrato. Replace also supports Classic LFO and
Expressions. Expressions refuses on a sampled preset because it has no measured
footprint. A sampled delete also refuses when its resident asset has no measured
footprint. Both refusals occur before `apply()`.

The result reports public before and after inventories, exact witness results,
sampled-preset adjustment status, and the recorded change id. It does not return
internal route or footprint values.

## Live proof

The focused probe called the public tool for all four operations on one owned
track at a time.

| Operation | Exact live result |
|---|---|
| Add | Added LFO to bare Polysynth. `FILTER/Filt Freq` reached 0.003599824922418393 maximum divergence. |
| Replace | Replaced Vibrato with Classic LFO. `Classic LFO` count was 1 and `Vibrato` count was 0. |
| Retarget | Moved LFO from filter frequency to resonance. `Filt Freq` divergence was 0 and `Reso` reached 0.6052380952380951. |
| Delete | Removed LFO. `LFO` count was 0, `Vibrato` count was 1, and `Filt Freq` divergence was 0. |

Every behavior sample reported `hasAutomation: false` and zero base spread.
Every insertion returned a recorded change id. `revert_change` removed each
inserted device and reported no unrestored state.

An offline cancellation regression aborts immediately after a recorded insert.
The abort propagates, and the tool does not report that nothing was written.

The first combined probe invocation exceeded the command runner window after
add and replace. Its final cleanup completed later. A separate inventory then
confirmed the exact seven-track baseline. The final retarget and delete runs
used one case per invocation and each proved exact entry-to-exit cleanup.

## Verification

- `npm run check`: 795/795 pass.
- Focused description, public authoring, and surface tests: 81/81 pass.
- `./gradlew test`: passes from `extension/`.
- Live add, replace, retarget, and delete cases pass through
  `author_modulators` on Bitwig 6.0.6.
- Final read-only track inventory matches the accepted seven-track baseline.

## Qualification

The public target recipe set is intentionally small. Selected-list container
editing, new targets, new assets, composition, and redistribution policy remain
outside this session.

## Retrospective

Use the recorded change as the write boundary. Do not convert a later error
into a pre-write refusal.
