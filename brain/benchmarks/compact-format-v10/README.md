# Compact-format v10 paired development

This package prepares the Phase 8c4c paired development run. It compares
positional compact-bar v1, compact-bar with one fixed `FIELDS` line, and
exact-object JSON. It does not select a public format.

The package reuses the repaired v6 contracts and scorers. It does not change
v4 through v9, `normal-v1`, the cache, or a live Bitwig project.

## Fresh cohorts

Development and reserved holdout each contain 44 unique fixtures:

- eight fixtures for each of three decision families; and
- four fixtures for each of five guard families.

The 24-row decision macro has a 4.17 percentage-point step. Development adds
nine named repeated-prompt sentinels. Sentinels do not replace unique
fixtures or enter the effect estimate.

The cohort audit rejects task or analysis-case overlap with calibration,
earlier packages, or the other new cohort.

## Provider scope

The run uses these cost-efficient tiers:

| Provider | Model | Setting | Output limit |
|---|---|---|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | low reasoning | 12,000 |
| Gemini | `gemini-3.8-flash` | low thinking | 12,000 |
| Anthropic | `claude-haiku-4-5-20251001` | 1,024-token thinking target | 12,000 |

Each provider has 141 initial requests and at most 48 repair requests. The
maximum is 189 requests per provider and 567 requests in total. The hard
cumulative cost ceiling is USD 5.000000.

The guard reserves the full token-bound cost of the next request against its
provider budget. It refuses a request when the reservation does not fit. It
sums exact cost line items and rounds only final aggregate totals.

## Offline checks

Run these commands from `brain`:

```sh
python3 -B benchmarks/compact-format-v10/benchmark.py --self-test
python3 -B benchmarks/compact-format-v10/benchmark.py \
  --check benchmarks/compact-format-v10/expected-deterministic.json
```

## Approval boundary

The run ID is `phase8c4c-compact-bar-paired-development-r1`. No token-count
or provider request is approved. The operator must approve the exact protocol
hash, run-plan hash, 567-request limit, 189 Haiku token-count request limit,
and USD 5.000000 cost limit.

After approval, change only the approval record. Run one provider at a time
with a new output path:

```sh
python3 -B benchmarks/compact-format-v10/benchmark.py --provider openai \
  --approval-file benchmarks/compact-format-v10/runs/development-r1-approval.json \
  --output benchmarks/compact-format-v10/runs/YYYY-MM-DD-development-openai.json
```

Use `gemini` and `claude-haiku` for the other providers. The harness requires
all three credentials before the first provider request.

The result can freeze one candidate for holdout, return `revise`, or return
`stop`. A later holdout plan must freeze the selected candidate hash, calls,
cost, and stopping rule before holdout approval.
