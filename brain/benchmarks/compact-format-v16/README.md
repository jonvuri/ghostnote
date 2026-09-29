# Compact format v16

This package freezes the first medium-effort task-difficulty calibration. It
keeps the v15 formats, component scoring, provider settings, schedule blocks,
failure policy, and cost accounting. It changes only generated task content
and scope.

The directional stage runs Gemini because Gemini was at the v15 ceiling. It
uses ten fresh analysis prompts, ten fresh affine prompts, and two literal
serialization guards. Every prompt runs on all three v15 formats. There is one
sample and no retry or repair. The maximum is 66 messages.

Ten unique prompts per format and decision family give a 10-point prompt-level
step. This is a resolution statement, not a population MDE or power claim.
Musical reporting remains at case and component granularity.

The target is approximately 90 percent global component accuracy. A family is
directionally promising when its median format accuracy is from 60 through 95
percent and all formats retain at least 90 percent structural validity. The
stage cannot select a format or start confirmation automatically.

Run the offline check from `brain`:

```sh
python3 -B benchmarks/compact-format-v16/benchmark.py --self-test
python3 -B benchmarks/compact-format-v16/benchmark.py \
  --check benchmarks/compact-format-v16/expected-deterministic.json
```

No provider request is approved. The operator must approve the exact protocol,
run plan, cohort, candidates, 66-message limit, and USD 0.650000 hard limit.
