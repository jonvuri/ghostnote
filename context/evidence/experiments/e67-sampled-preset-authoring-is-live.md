---
id: E67
kind: evidence
state: active
source: phase-5-session-5c-sampled-preset-integration
---

# E67 — Sampled-preset authoring is live [K] (2026-08-23)

**Verdict: checkpointed add and delete now run on multisample presets, report
every relocated reference stub, prove exact live behavior, and reverse without
residue.**

## Product path

The authoring result now reports Tier-2 relocation evidence. It includes all
stub values before and after the edit, the stub count, inserted footprint,
removed footprint, and net delta.

Validation receives the expected delta from curated or explicit footprint data.
It does not derive the expected value from the edited stubs. Unknown inserted or
removed footprints still refuse before `apply()`.

## Live proof

The focused probe created one owned instrument track and used the multisample
Sampler fixtures.

| Edit | Live result |
|---|---|
| Add | Added the curated Sampler LFO to `gn_sampler_multi_bare`. All four stubs moved from `[27,34,28,35]` to `[43,50,44,51]`, a measured `+0x10`. |
| Add behavior | Page 2 `Amp EG`, control 0 `Attack`, reached `0.11562013626098633` maximum divergence with zero base spread. |
| Delete | Deleted the LFO from `gn_sampler_multi_one_lfo`. All four stubs moved from `[43,50,44,51]` to `[27,34,28,35]`, a measured `-0x10`. |
| Delete behavior | The `LFO` page count was zero. `Amp EG/Attack` had zero divergence with zero base spread. |
| Reversal | Both takes deleted their observed insertion and reported no unrestored state. |
| Cleanup | The owned track was removed and the exact seven-track entry list was restored. |

Every behavior witness sampled 10 times at 80 ms intervals. Each sample
reported `hasAutomation: false`.

## Verification

- `npm run check`: 780/780 pass.
- Focused authoring and `bwmod` tests: 59/59 pass.
- `./gradlew test`: passes from `extension/`.
- `npm run probe:hello`: all handshake and deploy-freshness checks pass.
- `npm run probe:phase5c-authoring`: all add, delete, relocation, reversal, and
  cleanup checks pass.

## Qualification

This result proves the checkpointed path on a multisample preset. It does not
yet prove container list selection or cross-device routing through the executor.
It does not add a public tool.

## Retrospective

A Random page proved structural replacement, but its empty-track witness did
not produce free-running divergence. Use a free-running donor for behavior proof
unless the probe also supplies the source trigger.
