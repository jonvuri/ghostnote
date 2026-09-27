# Compact-format v2 development benchmark

This package implements the first Phase 8c2 development iteration. It is not a
public format specification. It does not replace the fixed compact-bar v0 or
symbolic-format v1 packages.

The bounded hypothesis is that explicit labels or the complete compact-bar v0
hierarchy improve hard musical tasks over the compact-bar v1 positional row.
The six arms are:

1. compact-bar v1;
2. label-only compact;
3. full v0-style compact;
4. exact JSON;
5. native MIDI-Like; and
6. composite MIDI-Like with a GN side ledger.

The full v0-style renderer must match the fixed v0 renderer. It keeps `SCORE`,
`FIELDS`, `OMITS`, `BAR`, `TRACK`, `ROLE`, `VOICE`, `REGION`, and labeled
`NOTE` rows. The parity test rejects compact-bar v1 positional shorthand.

## Fixed development scope

The generated corpus is new for Phase 8c2. It does not use a Phase 8c1 retained
fixture. Each provider gets the same 108 calls:

- three fixtures for each of four hard families: progression generation,
  melody generation, role continuation, and chord revoicing;
- one fixture for each guard: structure, local transformation, and rhythm
  transformation; and
- one motif-continuation prompt repeated three times for each arm.

The total scope is 324 calls across OpenAI, Gemini, and Claude. The run is
fixed. Do not adapt it after calls start. A later representation change must
use a new versioned protocol and fresh fixtures.

## Offline checks

Run from `brain`:

```sh
python3 benchmarks/compact-format-v2/benchmark.py --self-test
python3 benchmarks/compact-format-v2/benchmark.py \
  --check benchmarks/compact-format-v2/expected-deterministic.json
```

The checks cover all format round trips, perfect responses, fixed v0 renderer
parity, failure classification, corpus separation, call counts, and the fixed
v0 and v1 package identities.

## Approval gate

Generate the exact run plan before provider calls:

```sh
python3 benchmarks/compact-format-v2/benchmark.py --run-plan \
  --output benchmarks/compact-format-v2/runs/initial-six-arm-r1-plan.json
```

The provider action requires an approval JSON file. The file must contain the
exact `run_id`, `protocol_sha256`, and `run_plan_sha256` from the run plan. It
must also contain `status: approved` and the operator's explicit statement.
The harness refuses a missing, pending, or mismatched approval.

After approval, run each provider with a new dated output path:

```sh
python3 benchmarks/compact-format-v2/benchmark.py --provider openai \
  --approval-file benchmarks/compact-format-v2/runs/initial-six-arm-r1-approval.json \
  --output benchmarks/compact-format-v2/runs/YYYY-MM-DD-openai.json
```

Use `gemini` and `claude` for the other provider runs. The harness reads keys
from `.env` or the process environment. It does not print, hash, or retain a
key.

Summarize only three complete runs that have the same protocol hash:

```sh
python3 benchmarks/compact-format-v2/benchmark.py --summarize \
  benchmarks/compact-format-v2/runs/YYYY-MM-DD-openai.json \
  benchmarks/compact-format-v2/runs/YYYY-MM-DD-gemini.json \
  benchmarks/compact-format-v2/runs/YYYY-MM-DD-claude.json \
  --output benchmarks/compact-format-v2/runs/YYYY-MM-DD-summary.json
```

## Measurement rules

The scorer reports these composite failure classes separately:

- explicit score-ledger disagreement;
- missing or invalid side ledger;
- native-score parse failure; and
- another output or patch parse failure.

Each summary gives the numerator and eligible denominator. Initial results and
repairs stay separate. This iteration makes no repair calls.

The frozen development margins are a 5-point hard-family macro improvement, a
maximum 5-point guard regression, at most one candidate-only loss in one
provider and family, an input-token ratio of at most 0.90 to exact JSON, and an
output-byte ratio of at most 0.80 to exact JSON. These are development gates.
They do not establish population equivalence.

Classify the initial failures before a later iteration. Each later iteration
must test one bounded representation change. Freeze a fresh targeted holdout
only after the development candidates are final.
