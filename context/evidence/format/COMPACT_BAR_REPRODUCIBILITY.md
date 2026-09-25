---
title: Compact-bar benchmark reproducibility
kind: reference
state: active
updated: 2026-09-25
parent: COMPACT_BAR_BENCHMARK_PROTOCOL.md
---

# Compact-bar benchmark reproducibility

## Deterministic checks

Use Python 3. Run from `brain`:

```sh
python3 benchmarks/compact-bar-v0/benchmark.py --self-test
python3 benchmarks/compact-bar-v0/benchmark.py \
  --check benchmarks/compact-bar-v0/expected-deterministic.json
```

The same check is available as:

```sh
npm run benchmark:compact-bar
```

The pinned deterministic SHA-256 is
`837b4f4a50891e9abee665c06d2e0fd559313320f79c9f9f3672bfd64bab9fbd`.
A mismatch is a conformance failure for this benchmark package.

## Provider runs

Provider calls require `OPENAI_API_KEY` or `GEMINI_API_KEY` in `.env` or the
process environment. Run one provider at a time:

```sh
python3 benchmarks/compact-bar-v0/benchmark.py --provider openai \
  --output benchmarks/compact-bar-v0/runs/YYYY-MM-DD-openai.json
python3 benchmarks/compact-bar-v0/benchmark.py --provider gemini \
  --output benchmarks/compact-bar-v0/runs/YYYY-MM-DD-gemini.json
```

Then make one summary:

```sh
python3 benchmarks/compact-bar-v0/benchmark.py --summarize \
  benchmarks/compact-bar-v0/runs/YYYY-MM-DD-openai.json \
  benchmarks/compact-bar-v0/runs/YYYY-MM-DD-gemini.json \
  --output benchmarks/compact-bar-v0/runs/YYYY-MM-DD-summary.json
```

The client sends generated symbolic text only. It sends no live project data,
audio, MIDI file, or repository source.

## Result classes

The deterministic package is stable. It is suitable for local regression and
later syntax migration checks.

A provider run is a dated experiment. Provider service changes, model changes,
tokenizer changes, and nondeterministic generation can change its result. A
different raw-run hash is expected. It is not a deterministic test failure.

Keep these identities with every reported provider result:

- benchmark schema and deterministic hash;
- corpus and task hashes;
- requested and returned model names;
- settings and retry policy;
- prompt and raw-response hashes;
- latency and token usage; and
- the complete scored manifest.

Do not replace a missing provider result with zero. Record it as unavailable.
Do not combine scores from different prompt hashes in one comparison table.

## Legacy reruns

The E114 and E115 probes remain in `brain/src/probes`. Their original fixture,
representation, and raw-run hashes are pinned in
[legacy-baselines.json](../../../brain/benchmarks/compact-bar-v0/legacy-baselines.json).
Run their self-tests from `brain`:

```sh
python3 src/probes/phase6f-symbolic-representation.py --self-test
python3 src/probes/phase6f1-symbolic-familiarity.py --self-test
```

These legacy checks trace the historical claims. The Phase 8c package is the
reusable successor. Do not compare raw scores across the old and new prompt
hashes as if they were one run.

## Clean-run rules

The benchmark writes only the explicit output path and Python bytecode. Remove
bytecode before staging. A run does not open Bitwig or change a live project.
Do not publish a provider manifest until its generated-only privacy statement,
model identity, prompt hashes, and scoring details are present.
