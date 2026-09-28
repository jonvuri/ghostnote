# Compact-format v6 targeted analysis repair

This package implements the Phase 8c4b analysis-repair calibration r3. It is
a targeted supplement to the frozen v5 calibration r2 result. It does not
change the v5 package, its responses, the `normal-v1` runtime, the cache, or a
live Bitwig project.

The run is complete. Gemini scored 3/5 on the easy tier and entered the
eligibility band. Claude scored 5/5 on the same tier and remained at a ceiling.
The result is `repair-measurement`. Do not run the medium or hard tier. See the
[report](runs/2026-09-28-analysis-report.md).

## Scope

Calibration r2 already made motif informative on two providers and
progression informative on three. This package preserves those results. It
replaces only the analysis calibration evidence.

Provider jobs use only the `exact-object-json` control. Each run has five
unique analysis tasks and one repeated-prompt sentinel. Each available initial
failure can receive one repair call. One run therefore has at most 12 calls.

The analysis output contains eight comma-separated lists. Each position
describes one chord group and one motif pair. The scorer keeps chord identity,
root, bass, quality, inversion, function, motif relation, and rhythm as
independent checks.

## Sequential provider gate

Gemini runs first through a pre-registered difficulty ladder:

1. `calibration-easy`
2. `calibration-medium`, only after an easy-tier ceiling
3. `calibration-hard`, only after easy- and medium-tier ceilings

A complete Gemini rate from 0.20 through 0.80 ends the ladder. Claude can then
run once on that same tier. A Gemini floor, incomplete result, or hard-tier
ceiling returns `repair-measurement` without a Claude call.

Return `analysis-repair-pass` only when Gemini and Claude are both complete and
inside the band on the same tier. The result can restore the analysis entry
condition beside the retained r2 motif and progression results. It cannot
select a format.

## Deterministic checks

The offline suite retains every v5 format, document, patch, scorer, output
state, and size check. It adds batch-analysis parsing, focused list mutations,
three-tier aggregation, sequential gate checks, and individual analysis-case
overlap checks.

Run these commands from `brain`:

```sh
python3 -B benchmarks/compact-format-v6/benchmark.py --self-test
python3 -B benchmarks/compact-format-v6/benchmark.py \
  --check benchmarks/compact-format-v6/expected-deterministic.json
```

`cohort-manifest.json` records each tier, task, and individual case hash. The
tiers do not overlap each other or a retained provider-bearing task.

## Completed run

The named run is `phase8c4b-analysis-repair-calibration-r3`. Gemini can use at
most 36 calls. Conditional Claude can use at most 12 calls. The total maximum
is 48 calls and USD 1.137431.

The operator approved the exact protocol and run-plan hashes. The run used 15
calls and USD 0.166387. This is below the approved 48 calls and USD 1.137431.

Gemini ran first on the easy tier:

```sh
python3 -B benchmarks/compact-format-v6/benchmark.py --provider gemini \
  --tier calibration-easy \
  --approval-file benchmarks/compact-format-v6/runs/calibration-r3-approval.json \
  --output benchmarks/compact-format-v6/runs/YYYY-MM-DD-analysis-gemini-easy.json
```

Gemini entered the band, so the ladder stopped. Claude then ran once on the
same tier and returned a ceiling. The frozen stopping rule permits no later
tier or second Claude run.
