---
title: E153 — Full symbolic matrix freezes at the approval boundary
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c3-full-symbolic-format-matrix.md
---

# E153 — Full symbolic matrix freezes at the approval boundary

## Verdict

The Phase 8c3 offline package and retained run plan are frozen. No provider
call is approved. Stop at the approval boundary.

The matrix keeps all 13 Phase 8c1 controls. It adds unchanged
`exact-object-json-midi` and `tuple-json-midi` arms from Phase 8c2.3. Tuple
JSON remains the preferred complete candidate. Exact-object JSON remains the
full-capability fallback and paired control.

## Fresh cohort

The retained cohort has seven variants for each of nine task families. It has
63 fixtures in total. The generator changes pitches, pitch collections,
ranges, movement limits, timing, tempo, and local-edit values. It does not
only change fixture IDs.

The audit checked 182 prior semantic hashes. It found no prior semantic
overlap, internal semantic duplicate, or internal fixture duplicate.

| Identity | SHA-256 |
|---|---|
| Corpus | `bd9b5f62ff1a88069d7f88a3ad8f68ef0fcc4406e9837fb54fa0b4c06703232a` |
| Cohort audit | `22f18f6e3384479c5ba1a15df191feebf5dbef80409ddfa8075b4a8eb924ac09` |
| Deterministic screen | `2cac714d5cf488c0bbb581a2bc06280fcd3e5afac73e97cfc60d80f02f88c823` |

## Frozen matrix

The package has 15 arms and 130 eligible arm-family cells. Each cell starts
with three paired variants. A mixed cell adds variants 4 and 5. A cell that
stays mixed adds variants 6 and 7. Five arms repeat variant 1 for each eligible
family as nondeterminism sentinels.

The musical non-inferiority margin is 12.5 percentage points. The syntax
margin is 5 percentage points. Two candidate-only losses in one provider and
task family fail that paired comparison. A full-capability arm must pass every
eligible comparator on every provider. The rule prefers tuple JSON, then the
exact-object fallback. It does not claim population equivalence.

The reporter keeps explicit score-ledger disagreement, invalid or missing
ledger, native score parse failure, and other output or patch failure separate.
Initial and repaired secondary responses also remain separate.

| Identity | SHA-256 |
|---|---|
| Protocol | `e1c94fe9e36c32048c29e1b574058d5e3ddb2ac800db4d522c5147a29583d3ac` |
| Run plan | `50f205651c0847aef3e1f80435f86a465e8527d0187c8305bd43e0eb8c345b61` |
| Deterministic package | `ec27ee596457936cc024baa31c4d9ab2e784804dda1e211a4c1715f67c60103a` |

## Provider scope and cost

The named run is `phase8c3-full-symbolic-format-matrix-r1`. All providers use
low effort, default temperature, and a 7,000-token output limit.

| Provider | Model | Expected calls | Maximum calls | Expected cost | Estimated maximum |
|---|---|---:|---:|---:|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | 657 | 961 | USD 3.815104 | USD 5.524091 |
| Gemini | `gemini-3.8-flash` | 605 | 961 | USD 2.452507 | USD 3.872716 |
| Claude | `claude-sonnet-5` | 641 | 961 | USD 15.960244 | USD 23.608929 |
| Total | — | 1,903 | 2,883 | USD 22.227855 | USD 33.005736 |

The estimate uses Phase 8c1 retained usage and the larger observed frozen-JSON
arm mean call cost from the Phase 8c2.3 targeted holdout. It reprices Claude at
the current rate and adds 25 percent contingency. Provider dashboards remain
the external spend authority.

## Deterministic result

All 15 format round trips pass. Every eligible perfect response passes. Each
one-property mutation fails. Both full-capability arms pass document,
metadata, identity, exact preservation, sparse patch, stale-base, unknown-ID,
and single-pitch-encoding checks. The transport builder matches every declared
setting.

The package self-test, pinned deterministic check, Tonal controls, complete
brain check, context check, and `git diff --check` pass. The optional Music21
and Musicpy controls were not reinstalled. Their frozen Phase 8c1 controls and
versions remain unchanged.

## Approval boundary

The pending approval record has `approved: false` and no operator statement.
The harness rejects it. Approval must name this exact run-plan hash. It does
not carry to a changed scope, estimate, model, setting, protocol, cohort, or
run-plan hash.

## Retrospective

One package can reuse frozen format code while giving the fresh full matrix a
new cohort and protocol. A source-hash manifest makes that boundary easier to
audit.
