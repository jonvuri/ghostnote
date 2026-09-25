# Compact-bar v0 benchmark

This package freezes the Phase 8c comparison. It is evidence, not a public
music-format specification.

`corpus.py` owns the generated semantic fixtures. `benchmark.py` owns the
renderers, parsers, prompts, compiler, scoring rules, provider clients, and run
manifests. `expected-deterministic.json` pins the offline result. The `runs`
directory contains dated provider results and their summary.

Run the offline checks from `brain`:

```sh
python3 benchmarks/compact-bar-v0/benchmark.py --self-test
python3 benchmarks/compact-bar-v0/benchmark.py \
  --check benchmarks/compact-bar-v0/expected-deterministic.json
```

Run one remote provider only when its key is available in `.env` or the process
environment:

```sh
python3 benchmarks/compact-bar-v0/benchmark.py --provider openai \
  --output benchmarks/compact-bar-v0/runs/2026-09-25-openai.json
python3 benchmarks/compact-bar-v0/benchmark.py --provider gemini \
  --output benchmarks/compact-bar-v0/runs/2026-09-25-gemini.json
python3 benchmarks/compact-bar-v0/benchmark.py --summarize \
  benchmarks/compact-bar-v0/runs/2026-09-25-openai.json \
  benchmarks/compact-bar-v0/runs/2026-09-25-gemini.json \
  --output benchmarks/compact-bar-v0/runs/2026-09-25-summary.json
```

The finite-edit cohort compares represented core fields. It does not claim that
ABC, Alda, MIDI-Like, REMI+, or OctupleMIDI natively owns Ghostnote identities
or host fields. Counted task extensions and side ledgers make those fields
explicit. Strudel runs only its native pattern task. It is not scored as a
finite note editor.

Provider runs can drift. Keep deterministic results as conformance checks. Keep
remote results as dated experiment records.
