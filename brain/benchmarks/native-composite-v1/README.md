# Native versus composite diagnostic v1

This package freezes a separate paired diagnostic. It does not authorize a
provider call. Read [PROTOCOL.md](PROTOCOL.md) before use.

Run these offline commands from `brain/`:

```sh
python3 -B benchmarks/native-composite-v1/test_diagnostic.py
python3 -B benchmarks/native-composite-v1/benchmark.py --check
```

The frozen package includes all tasks, eligibility cells, complete prompts,
reference outputs, provider schedules, cost estimates, and baseline cells.
The corrected v5 assessment is context for interpretation. Its five-field
ratios are not the denominator for this four-field diagnostic.

After explicit approval, create the approval record with the exact run, plan,
protocol, cohort, candidate, schedule, and cost hashes. Use `status: approved`
and retain the operator's statement. Then run each provider once:

```sh
python3 -B benchmarks/native-composite-v1/benchmark.py \
  --provider openai --output benchmarks/native-composite-v1/runs/openai.json
```

Use the same command for `gemini` and `claude-haiku`, with separate new output
files. The runner refuses to replace an existing output. Approval validation
precedes credential access and network access. Failed reservations stay in the
cost guard. No retry, repair, or continuation is authorized.
The permanent provider attempt record prevents a second execution under the
same run ID. A failed or interrupted run needs separate recovery approval.

Use `report.py <provider manifests> --output <new assessment path>` to verify
and summarize retained responses. Report incomplete pairs and exact sentinels
separately. Manually audit one case in each provider, family, and format pair.
Keep the cache, `normal-v1`, and live Bitwig projects unchanged.
