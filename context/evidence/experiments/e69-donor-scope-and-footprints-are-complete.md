---
id: E69
kind: evidence
state: active
source: phase-5-session-5e-donor-footprints
---

# E69 — Donor scope and footprints are complete [K] (2026-08-23)

**Verdict: five current donors now form the sampled-preset cohort with exact
footprints and provenance. Two Tier-1-only donors still refuse loudly.**

## Cohort

The sampled-preset cohort is `lfo-sampler`, `random-sampler`, `random-poly`,
`classiclfo-poly`, and `vibrato-poly`. The first three keep their E12
measurements. Phase 5e measured the last two live.

| Donor | Lower delta | Exact delta | Upper delta |
|---|---:|---:|---:|
| `classiclfo-poly` | `0x0b` rejects | `0x0c` loads | `0x0d` rejects |
| `vibrato-poly` | `0x0e` rejects | `0x0f` loads | `0x10` rejects |

Each case used `addModulator()` on the sampled `gn_sampler_bare` fixture. The
offline gate validated both count stubs at the candidate delta before Bitwig
loaded the file. A rejected insert returned no minted device.

`lfo-poly` stays Tier 1 only because the measured Sampler LFO donor already
covers that type. `expressions-poly` also stays Tier 1 only. Its initial bracket
and the bounded continuation rejected every candidate from `0x0a` through
`0x39`. The 459-byte donor cannot contain more than 57 minimum-sized objects.
The field walker reached 14 objects before the known deep-list limit, so the
sweep covered the complete possible range.

Both Tier-1-only assets keep `footprint: null`. Library and executor tests prove
that sampled add or replace refuses before `apply()`.

## Verification

- `npm run check`: 788/788 pass.
- Focused authoring and `bwmod` tests: 63/63 pass.
- `npm run probe:phase5e-footprints`: both exact deltas load, all four neighbors
  reject, and cleanup restores the exact seven-track entry list.
- `./gradlew test`: passes from `extension/`.

## Qualification

This result completes footprint scope for the current seven donors. It does not
add new donors, a public authoring tool, or a redistribution policy.

## Retrospective

A failed footprint bracket does not prove that the footprint is farther away.
Bound the full candidate range by donor size before expanding a sweep.
