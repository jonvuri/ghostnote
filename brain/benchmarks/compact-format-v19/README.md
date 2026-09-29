# Compact-format v19 full benchmark

This package freezes the Phase 8c4e two-candidate full benchmark. It runs only
`FIELDS` and local labels. It covers all nine Phase 8c3 task families and two
literal serialization controls.

The package imports the v18 task and component-scoring contracts. It replaces
the v18 stress-affine generator. Affine musical values and voice rules now
depend on the cohort seed. Every task also has an ID-free content hash.

Run the pinned offline check from `brain/`:

```sh
npm run benchmark:compact-format-v19
```

Print the frozen run plan:

```sh
python3 -B benchmarks/compact-format-v19/benchmark.py --print-plan
```

The plan has 148 messages per provider and 444 messages in total. It uses low
effort on OpenAI, Gemini, and Claude Haiku. It makes no retry or repair call.

Do not use `--provider` until the operator approves the exact protocol, plan,
cohort, candidates, schedules, runner, and USD 5.550000 hard limit.
