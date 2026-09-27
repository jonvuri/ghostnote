# Symbolic-format v1 benchmark

This package freezes the Phase 8c1 expanded comparison. It is evidence, not a
public music-format specification.

The package compares exact JSON, a compact event profile, one-cycle
mini-notation, and native and composite pairs for ABC 2.1, Alda, MIDI-Like,
REMI+, and OctupleMIDI. It uses focused comprehension, generation,
continuation, and transformation calls. The retained run uses three initial
fixtures per eligible arm and task. It adds two trials twice when results stay
mixed.

The compact v1 arm uses the development shorthand
`N id voice start duration pitch velocity`. It keeps the compact semantic
fields and identity behavior, but it does not retain the labeled events and
structural headers from compact-bar v0. Phase 8c2 therefore uses v1 only as a
development baseline in a focused format loop. Phase 8c3 owns the later fresh
full matrix. Do not use the v1 provider result to freeze public syntax.

## Offline checks

Run from `brain`:

```sh
python3 benchmarks/symbolic-format-v1/benchmark.py --self-test
python3 benchmarks/symbolic-format-v1/benchmark.py \
  --check benchmarks/symbolic-format-v1/expected-deterministic.json
node benchmarks/symbolic-format-v1/tonal-verifier.mjs
```

Music21 and Musicpy stay outside the product dependency graph. Use a temporary
environment for their controls:

```sh
python3 -m venv /tmp/ghostnote-symbolic-v1-venv
/tmp/ghostnote-symbolic-v1-venv/bin/pip install \
  -r benchmarks/symbolic-format-v1/requirements-verifiers.txt
/tmp/ghostnote-symbolic-v1-venv/bin/python \
  benchmarks/symbolic-format-v1/benchmark.py --verifier-self-test
```

Remove the temporary environment after verification.

## Provider runs

The `runs` directory contains the frozen pilot decision, the dated OpenAI,
Gemini, and Claude manifests, and the scored summary. The harness reads API
keys from `.env` or the process environment. It does not print, hash, or
retain a key.

Provider reruns can change. Do not combine a rerun with the retained summary.
Use a new date and keep requested and returned model identities, settings,
usage, cost, prompt hashes, and raw-response hashes together.

## Result

The dated summary returns `revise`. Compact-bar did not breach the frozen
paired rate margin, but provider-specific repeated failures prevent a proceed
decision. Side ledgers added tokens, explicit score-ledger disagreements, and
other composite parse failures. Native musical success did not add stable
identity or exact preservation.

The
[complete retained Markdown report](runs/2026-09-27-report.md) renders every
provider, task family, arm, paired comparison, sentinel, stopping result, and
secondary case. Rebuild it from the retained JSON files:

```sh
python3 benchmarks/symbolic-format-v1/report.py \
  --summary benchmarks/symbolic-format-v1/runs/2026-09-27-summary.json \
  --runs benchmarks/symbolic-format-v1/runs/2026-09-27-openai.json \
    benchmarks/symbolic-format-v1/runs/2026-09-27-gemini.json \
    benchmarks/symbolic-format-v1/runs/2026-09-27-claude.json \
  --output benchmarks/symbolic-format-v1/runs/2026-09-27-report.md
```

[E140](../../../context/evidence/experiments/e140-expanded-symbolic-format-comparison-requires-revision.md)
records the result, limits, cost, and the Phase 8c2 development loop.
