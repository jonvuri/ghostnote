# Compact-format v3 calibration benchmark

This package implements the Phase 8c2.2 measurement repair and the
`grouped-label-compact` candidate. It is not a public format specification. It
does not change the frozen compact-bar v0, symbolic-format v1, or compact-format
v2 packages.

## Representation hypothesis

The candidate uses one block for each onset that has two or more notes. A
block has one shared onset. It also has one shared duration when all notes use
the same duration. Named `SLOT` rows keep voice or role, ID, pitch, and
velocity explicit. A single note uses one labeled `N` row.

The canonical order is onset, voice rank, pitch, and ID. The voice rank is
`bass`, `tenor`, `alto`, `soprano`, then other voice names in lexical order.
The parser rejects a noncanonical payload. The same representation supports
stable IDs and sparse `PATCH` and `SET` operations. It has no side ledger.

## Measurement repair

The revoice scorer tests properties. It does not compare the output with one
hidden pitch answer. The task defines `nearest`, `drop-2`, and
`first-inversion`. The scorer accepts all tied minimum-movement `nearest`
answers. It tests note count, chord starts, identity, duration, voice, velocity,
pitch classes, operation, range, and voice order.

The progression scorer reports five components:

1. chord starts and named voices;
2. harmony and bass inversion;
3. voice ranges and crossing;
4. total voice leading; and
5. cadence.

[CONTRACTS.md](CONTRACTS.md) maps each task requirement to a scorer check and
its mutation test.

## Fresh cohorts

The package generates three fixed and disjoint cohorts. Their full fixture and
semantic hashes have no overlap with each other, symbolic-format v1, or either
compact-format v2 cohort.

| Cohort | Decision fixtures per family | Melody fixtures | Fixtures per guard | Calls per arm |
|---|---:|---:|---:|---:|
| Calibration | 3 | 1 | 1 | 14 |
| Development | 8 | 4 | 4 | 44 |
| Holdout | 8 | 4 | 4 | 44 |

The decision families are progression generation, role continuation, and
revoicing. Eight fixtures per decision family give a smallest hard-macro step
of `1 / (8 * 3) = 4.17` points. Melody is a regression family. Structure,
local transformation, rhythm transformation, and fixed-ID motif continuation
are guards.

## Offline checks

Run these commands from `brain`:

```sh
python3 benchmarks/compact-format-v3/benchmark.py --self-test
python3 benchmarks/compact-format-v3/benchmark.py \
  --check benchmarks/compact-format-v3/expected-deterministic.json
```

`cohort-manifest.json` records every full fixture hash and semantic fixture
hash. Regenerate it with `benchmark.py --cohorts` before a protocol freeze.

The checks cover contract agreement, positive and negative cases, one-property
mutations for every scorer check, tied revoice answers, progression components,
grouped parsing, round trips, stable identity, exact preservation, sparse patches, size,
estimated tokens, cohort separation, the frozen v2 package, and both final
calibration aggregation branches.

The labeled v2 diagnostic is reproducible:

```sh
python3 benchmarks/compact-format-v3/diagnose_v2.py \
  --output benchmarks/compact-format-v3/runs/2026-09-27-v2-diagnostic.json
```

This diagnostic does not replace the frozen Phase 8c2 decision or hashes.

## Calibration approval gate

The calibration run is diagnostic. It cannot select a format. It uses these
five arms:

1. compact-bar v1;
2. label-only compact;
3. grouped-label compact;
4. exact JSON; and
5. native MIDI-Like.

Each provider gets 70 calls. The total scope is 210 calls. The models are
OpenAI `gpt-5.4-mini-2026-03-17`, Gemini `gemini-3.8-flash`, and Claude
`claude-sonnet-5`. Each model uses its low-effort setting and the provider
default temperature.

Generate the exact plan before calls:

```sh
python3 benchmarks/compact-format-v3/benchmark.py --run-plan \
  --output benchmarks/compact-format-v3/runs/calibration-r1-plan.json
```

The provider action needs an approval JSON file. It must contain the exact run
ID, protocol hash, and run-plan hash. It must also contain `status: approved`
and the operator's explicit statement. The harness rejects a missing, pending,
or mismatched approval.

After approval, run one provider at a time with a new dated output path:

```sh
python3 benchmarks/compact-format-v3/benchmark.py --provider openai \
  --approval-file benchmarks/compact-format-v3/runs/calibration-r1-approval.json \
  --output benchmarks/compact-format-v3/runs/YYYY-MM-DD-calibration-openai.json
```

Use `gemini` and `claude` for the other provider runs. Then summarize the three
complete runs:

```sh
python3 benchmarks/compact-format-v3/benchmark.py --summarize \
  benchmarks/compact-format-v3/runs/YYYY-MM-DD-calibration-openai.json \
  benchmarks/compact-format-v3/runs/YYYY-MM-DD-calibration-gemini.json \
  benchmarks/compact-format-v3/runs/YYYY-MM-DD-calibration-claude.json \
  --output benchmarks/compact-format-v3/runs/YYYY-MM-DD-calibration-summary.json
```

Exact JSON and native MIDI-Like form the control pool for each provider and
family. A decision family is eligible when its control pass rate is from 0.20
through 0.90 on at least two providers. If any decision family is not eligible,
the summary returns `repair-measurement`. Stop provider work in that case. If
all three are eligible, the summary returns `proceed-development`. Freeze a
new development plan and get separate approval before development calls.
