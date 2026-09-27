---
title: Compact-bar benchmark reproducibility
kind: reference
state: active
updated: 2026-09-27
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

## Expanded v1 checks

Run the Phase 8c1 deterministic checks from `brain`:

```sh
python3 benchmarks/symbolic-format-v1/benchmark.py --self-test
python3 benchmarks/symbolic-format-v1/benchmark.py \
  --check benchmarks/symbolic-format-v1/expected-deterministic.json
node benchmarks/symbolic-format-v1/tonal-verifier.mjs
```

Use the pinned temporary verifier dependencies for Music21 and Musicpy:

```sh
python3 -m venv /tmp/ghostnote-symbolic-v1-venv
/tmp/ghostnote-symbolic-v1-venv/bin/pip install \
  -r benchmarks/symbolic-format-v1/requirements-verifiers.txt
/tmp/ghostnote-symbolic-v1-venv/bin/python \
  benchmarks/symbolic-format-v1/benchmark.py --verifier-self-test
```

Remove the temporary environment after the check. The v1 deterministic
SHA-256 is
`1018c31c5cc2f2777794d6ab9db5d89f475f421b8b34de9ddbec888337a662a0`.

The v1 provider harness also reads `CLAUDE_API_KEY`. It records OpenAI, Gemini,
and Claude model identities, usage, cost, retries, hashes, and scored results.
The fixed retained package is in
[symbolic-format v1](../../../brain/benchmarks/symbolic-format-v1/README.md).
Do not rerun it into the retained filenames. Use a new protocol and cohort for
each Phase 8c2 development iteration and its targeted holdout. Use another new
protocol and cohort for the Phase 8c3 full matrix.

Run the frozen Phase 8c3 offline checks from `brain`:

```sh
python3 -B benchmarks/symbolic-format-v2/benchmark.py --self-test
python3 -B benchmarks/symbolic-format-v2/benchmark.py \
  --check benchmarks/symbolic-format-v2/expected-deterministic.json
node benchmarks/symbolic-format-v2/tonal-verifier.mjs
```

The Phase 8c3 package has a separate retained cohort and protocol. [E155](../experiments/e155-full-symbolic-matrix-blocks-phase-8f.md)
records the retained result. It is `block`, and it selects no full-capability
candidate.

Before each provider-bearing Phase 8c2 or 8c3 run, record its exact scope,
expected calls, model settings, and estimated cost by provider and in total.
Get explicit operator approval for that named run. The former USD 5 soft
ceiling does not apply.

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
