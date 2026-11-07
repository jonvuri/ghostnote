---
title: E369 — R01 first development run: one repeat of pilot-development-v2, both cohorts
kind: evidence
state: done
updated: 2026-10-26
owner: R01
---

# E369 — R01 first development run: one repeat of pilot-development-v2, both cohorts

Date: 2026-10-26 (session start `2026-10-27T03:31:20Z`). Stage:
**development**. These results support design iteration only; they are not a
candidate comparison. Subscription CLI calls were made within the operator's
standing scope. No API billing, Bitwig contact or library write occurred.

## Run

The pilot runner ran a recorded subset (`--repeats 1`) of package
`pilot-development-v2` against the pinned
[execution manifest](../data/r01-pilot-inputs/v2/execution/manifest.json)
([E368](e368-r01-pilot-execution-manifest-and-rehearsal.md)). It checked each
run's prompt hash at start. Binaries: Claude Code 2.1.302 (SHA-256
`5262ce9d…6662d37`) and Codex 0.163.0 (`88133672…cfdee31`). Cohorts:
Haiku 5.5 at `low` effort and Luna at `low` effort.

The plan contained 134 initial runs, 67 per cohort, and allowed up to 402
submissions. All 134 runs finished, using 199 submissions. No quota pause,
interruption, halt or control failure occurred. Every submission passed its
control audit.

| | Haiku 5.5 | Luna |
|---|---|---|
| First-attempt passes | **58 / 67** | **39 / 67** |
| Passes within two corrections | 65 / 67 | 42 / 67 |
| Submissions (corrections) | 79 (12) | 120 (53) |
| Reported input tokens | 284,384 | 643,413 |
| Final output tokens | 184,069 | 99,533 |
| Median / max output per submission | 1,717 / 16,914 | 249.5 / 3,722 |
| Median / max elapsed per submission | 7.0 / 58.6 s | 3.9 / 29.1 s |

Haiku input comes from `totalInputTokens`, which is nearly all 1-hour cache
writes (E364). Luna input is client-reported. Correction turns resend the
original prompt plus earlier answers, which explains most of Luna's larger input. Haiku generates
more output because of adaptive thinking (E365).

### By format (first attempt / within budget / runs)

| Arm | Haiku | Luna |
|---|---|---|
| baseline-fields | 8 / 8 / 8 | 6 / 6 / 8 |
| baseline-json | 8 / 8 / 8 | 5 / 6 / 8 |
| c3-fields | 9 / 11 / 12 | 7 / 8 / 12 |
| c4-fields | 10 / 12 / 12 | 9 / 9 / 12 |
| pp-barbeat | 6 / 8 / 8 | 1 / 1 / 8 |
| pp-midi-json | 7 / 7 / 8 | 4 / 4 / 8 |
| c3-json (diagnostic) | 3 / 4 / 4 | 3 / 3 / 4 |
| c4-json (diagnostic) | 4 / 4 / 4 | 2 / 3 / 4 |
| c4-detached-fields (diagnostic) | 3 / 3 / 3 | 2 / 2 / 3 |

Each cell ran once. Differences of one or two runs between formats are not
interpretable at this sample size.

## Failure patterns

Final failures:

- **Haiku (2).**
  - **p07 C3 FIELDS:** all three submissions are semantically correct but
    spell new onsets unreduced (`1032/512` instead of `129/64`). Exact source
    scoring rejects the spelling, and the feedback does not identify it, so
    the same answer was repeated three times. This is a scoring or feedback
    issue rather than a model error.
  - **p06 Producer Pal MIDI JSON:** transposed the 56 at onset 47/64 instead
    of the target 56 at onset 8.
- **Luna (25).**
  - **p01 (6 of 6):** `total` was correct on all four non-Producer Pal formats. `before` was
    27–30 instead of 21 (55–56 on C4 FIELDS), and Producer Pal formats
    miscounted the total (104; 55 on bar|beat). Haiku answered correctly on
    every format.
  - **p08 (6 of 6):** on four formats, Luna left the same four in-range notes
    unshifted. Baseline FIELDS moved 20 notes incorrectly, and bar|beat
    output did not parse.
  - **p02 C4 (3 of 3):** the derived onset was wrong (`57/8` or `225/32`
    instead of `451/64`). Both C3 arms passed.
  - **Producer Pal (p05, p09 on both PP arms):** returned the target
    unchanged, matching the rehearsal's "untouched target" variant. On
    bar|beat, p03 and p08 did not parse, p06 shifted almost every note, and
    p10 returned a full surface and then `REFUSE no-match`.
  - **Group equations (p04 C3 FIELDS; p07 C3 FIELDS and C3 JSON):** answers
    were refused with "timing equation mismatch" because spreads and onsets
    disagreed.

## Development implications

These are candidates for versioned tuning, not conclusions:

- Decide whether exact source scoring should accept unreduced but equal
  rational spellings in computed values, or whether the card or feedback
  should require reduced spellings.
- Correction feedback gives only the failure reason. Luna repeated wrong
  answers across corrections (for example, p02 C4 and p01).
- Luna's counting and range-selection failures appear on every format.
  They measure model capacity as well as format.

## Artifacts

Under [`r01-pilot-runs/dev-v2-r1`](../data/r01-pilot-runs/dev-v2-r1/):

- [plan](../data/r01-pilot-runs/dev-v2-r1/plan.json) (SHA-256 `912bf2bc…`)
- [results](../data/r01-pilot-runs/dev-v2-r1/results.json) (SHA-256 `0f446fd8…`,
  including answers, usage, control audits and scores)
- the session record
- the progress log

Raw attempt directories (19 MB, including captured API bodies) remain in the
ignored `.tmp/r01-pilot-dev-v2-r1/attempts/` and may disappear.

## Limits

This record covers one repeat per cell for each cohort. It is development
material and does not compare candidates. Works A–C and the synthetic seed are
reused development inputs. Usage is client-reported.
