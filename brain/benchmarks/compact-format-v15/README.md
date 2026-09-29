# Compact format v15

This package freezes the Phase 8c4d validity ladder. It replaces the invalid
v14 decision design. It does not replace or modify the v14 evidence.

V15 fixes the affine pitch expression. It uses a 1-, 2-, and 4-case analysis
ladder. It scores each independent case by component. It does not use a
whole-response musical pass.

The report includes these musical measurements for each provider, family,
difficulty, and format:

- global component accuracy;
- average per-case component accuracy;
- the number and rate of cases with 100 percent component accuracy.

Response-level rates measure structural parsing and canonical form only. A
parse failure keeps all planned cases and components in the score with zero
credit for components that cannot be read.

Exact-object JSON is a valid third format. It is not a capability control and
has no minimum musical score. The summary returns `operator-review` when the
run has enough operational coverage. Only the operator decides whether to run
the full benchmark.

The run uses the same 108 messages per provider as v14. Analysis has three
light fixtures, three moderate fixtures, and two stress fixtures. Affine work
is moderate. Literal serialization is the positive control. Shuffling
interleaves the levels while each task keeps a balanced three-format block.

Run the pinned offline check:

```sh
cd brain
npm run benchmark:compact-format-v15
```

Print the frozen plan:

```sh
python3 -B benchmarks/compact-format-v15/benchmark.py --print-plan
```

Do not use `--provider` until the operator approves the exact protocol hash,
run-plan hash, candidate hashes, cohort hash, and USD hard limit.
