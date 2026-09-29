# Compact-format v18 rehearsal

This package is the final development rehearsal before Phase 8c4e. It keeps
the three v15 formats and the component scorer. It runs OpenAI at low effort.

The suite separates two task strata. Elemental tasks isolate format handling.
Real-use stress tasks combine format handling with musical reasoning. Reports
keep these strata separate.

`suite.py` owns the reusable task definitions and checks. Phase 8c4e can import
this module without copying the rehearsal cohort. It must use new fixture
instances, a new cohort seed, a new schedule, and a new approval.

Run the pinned offline check from `brain/`:

```sh
npm run benchmark:compact-format-v18
```

Print the frozen run plan:

```sh
python3 -B benchmarks/compact-format-v18/benchmark.py --print-plan
```

Do not make a provider request without an approval file that matches every
identity and the USD 0.650000 hard limit.
