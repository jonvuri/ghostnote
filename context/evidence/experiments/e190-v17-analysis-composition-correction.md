---
title: E190 — V17 analysis composition correction
kind: evidence
state: active
updated: 2026-09-29
parent: ../../plan/phase-8/8c4d-follow-up-v17-harder-medium-difficulty.md
---

# E190 — V17 analysis composition correction

## Correction

The v17 protocol described every analysis case as a hard seventh or diminished
case. The frozen generator did not produce that composition.

The expression used `13000` as its seed base. This value has remainder 4
modulo 12. The expression therefore shifted each intended template index by
four. The 30 generated cases have this actual distribution:

| Chord quality | Cases |
|---|---:|
| Major | 18 |
| Minor | 4 |
| Half-diminished-seventh | 5 |
| Major-seventh | 3 |
| Dominant-seventh | 0 |
| Diminished | 0 |

## Effect on evidence

The task data, reference answers, retained responses, and component scores are
internally consistent. E189 remains valid for the tasks that the provider saw.
It does not validate the intended hard-chord composition.

Do not change the frozen v17 package files. Their hashes bind the completed
run. Apply this correction when interpreting E188 and E189.

## Regression requirement

Future packages must assert the exact generated chord distribution. They must
not infer it from a seed formula or a design note. V18 adds this gate.
