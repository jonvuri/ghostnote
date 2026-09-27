# Compact-format v4 benchmark

This package implements the Phase 8c4 compact-bar recovery benchmark. It is
not a public format specification. It does not change an earlier package, the
`normal-v1` runtime, the cache, or a live Bitwig project.

## Arms

The package has three arms:

1. `compact-bar-v1` uses positional note rows.
2. `compact-bar-fields` adds one fixed document line:

   ```text
   FIELDS id voice start duration pitch velocity
   ```

3. `exact-object-json` is the structured task control.

Both compact arms use the same `BASE`, `SOURCE`, and `OMITS` headers. They use
the same optional overlays and patch grammar. The `FIELDS` line is their only
difference. All arms use MIDI pitch integers.

The optional bar, track, region, meter, tempo, harmony, and groove overlays
refer to note IDs. They do not contain a second note plane. A minimal document
can omit all overlays.

## Contract repair

[CONTRACTS.md](CONTRACTS.md) maps each instruction requirement to a scorer
check and a focused mutation. The package makes these repairs:

- Analysis defines each input column, pitch class, chord quality, inversion,
  chord function, motif relation, and rhythm class. It reports each fact as a
  separate check.
- Motif tasks use only fields that apply to the named operation. They use the
  term `rhythmic-scale`. They state formulas and preserved properties.
- Progression tasks state voice order, pitch-class coverage, ranges, cadence,
  and the exact same-voice movement formula. The scorer keeps each component
  beside the primary result.
- Each multiline document and patch grammar has an actual two-row example.
- Initial, repaired, unavailable, and failed results are separate states.
  Unavailable and failed results do not enter scored denominators.

The repair policy permits one feedback turn after an available initial parse
or musical-contract failure. The feedback contains only a structured
diagnostic. A repair never replaces the initial result.

## Deterministic capabilities

The offline suite tests parsers, renderers, canonical order, round trips,
stable IDs, preservation, sparse patches, base conflicts, omissions, invalid
values, size, and token estimates. It tests minimal documents separately from
documents with all overlays.

Run these commands from `brain`:

```sh
python3 -B benchmarks/compact-format-v4/benchmark.py --self-test
python3 -B benchmarks/compact-format-v4/benchmark.py \
  --check benchmarks/compact-format-v4/expected-deterministic.json
```

`cohort-manifest.json` contains the full and semantic hashes for calibration,
development, and holdout. The cohorts do not overlap each other or an earlier
provider-bearing Phase 8c1 through 8c3 cohort.

## Calibration approval boundary

The named run is `phase8c4b-focused-compact-calibration-r1`. Each provider has
69 initial jobs: 60 unique jobs and 9 named nondeterminism sentinels. Each
available initial failure can receive one repair call. The maximum is 138 calls
per provider and 414 calls in total.

The models are OpenAI `gpt-5.4-mini-2026-03-17`, Gemini
`gemini-3.8-flash`, and Claude `claude-sonnet-5`. Each provider uses its low
effort setting, its default temperature, and a 5,000-token output limit.

The maximum estimated cost is in `runs/calibration-r1-plan.json`. No provider
call is approved. The harness rejects the pending approval record. The
operator must approve the exact protocol and run-plan hashes before Phase
8c4b can start.

After approval, update only the approval record. Then run one provider at a
time with a new output path:

```sh
python3 -B benchmarks/compact-format-v4/benchmark.py --provider openai \
  --approval-file benchmarks/compact-format-v4/runs/calibration-r1-approval.json \
  --output benchmarks/compact-format-v4/runs/YYYY-MM-DD-calibration-openai.json
```

Use `gemini` and `claude` for the other providers. Then summarize the three
complete manifests. Calibration can return `proceed-development` or
`repair-measurement`. It cannot select a format.
