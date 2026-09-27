# Symbolic-format v2 benchmark

This package freezes the Phase 8c3 full retained matrix. It is evidence. It is
not a public music-format specification.

The matrix keeps all 13 Phase 8c1 arms. It adds the unchanged
`exact-object-json-midi` fallback and `tuple-json-midi` candidate from Phase
8c2.3. Both added arms use the frozen compact-JSON document and patch code.
The tuple arm uses one MIDI integer for each pitch.

## Fresh cohort

The retained cohort has seven fixtures for each of nine task families. It has
63 fixtures in total. The generator changes musical values and contracts. It
does not only change IDs.

`cohort-manifest.json` records each fixture and semantic hash. The audit has no
overlap with a prior provider-bearing cohort. It also has no internal fixture
or semantic duplicate.

## Frozen sample and gates

Each eligible arm and task family starts with variants 1 through 3. A mixed
cell adds variants 4 and 5. A cell that stays mixed adds variants 6 and 7.
Five arms repeat variant 1 as a nondeterminism sentinel.

The paired musical margin is 12.5 percentage points. The paired syntax margin
is 5 percentage points. Two candidate-only losses in one provider and task
family fail that comparison. A full-capability arm must pass every eligible
paired comparator on every provider. The decision prefers tuple JSON, then the
exact-object fallback. The result does not claim population equivalence.

Composite failures use four separate classes:

- explicit score-ledger disagreement;
- missing or invalid side ledger;
- native score parse failure; and
- other output or patch parse failure.

## Offline checks

Run from `brain`:

```sh
python3 -B benchmarks/symbolic-format-v2/benchmark.py --self-test
python3 -B benchmarks/symbolic-format-v2/benchmark.py \
  --check benchmarks/symbolic-format-v2/expected-deterministic.json
node benchmarks/symbolic-format-v2/tonal-verifier.mjs
```

Use a temporary environment for the optional Music21 and Musicpy controls:

```sh
python3 -m venv /tmp/ghostnote-symbolic-v2-venv
/tmp/ghostnote-symbolic-v2-venv/bin/pip install \
  -r benchmarks/symbolic-format-v2/requirements-verifiers.txt
/tmp/ghostnote-symbolic-v2-venv/bin/python \
  benchmarks/symbolic-format-v2/theory_verifiers.py
```

Remove the temporary environment after the check.

## Approval boundary

The named run is `phase8c3-full-symbolic-format-matrix-r1`. The adaptive scope
expects 657 OpenAI calls, 605 Gemini calls, and 641 Claude calls. The maximum
is 961 calls for each provider.

The expected cost is USD 3.815104 for OpenAI, USD 2.452507 for Gemini, and USD
15.960244 for Claude. The expected total is USD 22.227855. The estimated
maximum is USD 33.005736. The estimate uses prior retained usage, current
provider prices, and a 25 percent contingency.

The exact plan is in `runs/full-matrix-r1-plan.json`. No provider call is
approved. The harness rejects the pending approval record. After explicit
approval, update only `runs/full-matrix-r1-approval.json`. Then run one provider
at a time:

The first approved OpenAI attempt stopped after 435 calls because the inherited
usage parser recursed after helper binding. It did not write a run artifact.
The corrected package adds an offline helper-binding regression check. The
corrected run-plan hash needs fresh approval.

```sh
python3 -B benchmarks/symbolic-format-v2/benchmark.py --provider openai \
  --output benchmarks/symbolic-format-v2/runs/YYYY-MM-DD-openai.json
```

Use `gemini` and `claude` for the other providers. Approval does not carry to a
changed scope, estimate, model, setting, protocol, cohort, or run-plan hash.

After all three runs, make the paired summary and Markdown report:

```sh
python3 -B benchmarks/symbolic-format-v2/benchmark.py --summarize \
  benchmarks/symbolic-format-v2/runs/YYYY-MM-DD-openai.json \
  benchmarks/symbolic-format-v2/runs/YYYY-MM-DD-gemini.json \
  benchmarks/symbolic-format-v2/runs/YYYY-MM-DD-claude.json \
  --output benchmarks/symbolic-format-v2/runs/YYYY-MM-DD-summary.json
python3 -B benchmarks/symbolic-format-v2/report.py \
  --summary benchmarks/symbolic-format-v2/runs/YYYY-MM-DD-summary.json \
  --runs benchmarks/symbolic-format-v2/runs/YYYY-MM-DD-openai.json \
    benchmarks/symbolic-format-v2/runs/YYYY-MM-DD-gemini.json \
    benchmarks/symbolic-format-v2/runs/YYYY-MM-DD-claude.json \
  --output benchmarks/symbolic-format-v2/runs/YYYY-MM-DD-report.md
```

The provider dashboards remain the external spend authority.

## Retained result

The 2026-09-27 retained summary returns `block`. It selects no full-capability
arm. Exact-object JSON fails 16 paired gates. Tuple JSON fails 30. Gemini has
two output-limit results and is incomplete. OpenAI and Claude also fail both
candidates under the frozen rule.

The corrected retained run made 1,907 calls and reports USD 15.061248. This
cost excludes the 435 OpenAI calls from the stopped pre-fix attempt. Confirm
that attempt in the OpenAI dashboard.

The summary's affected Gemini descriptive rates count the two output-limit
rows as failures. Treat those rows as unavailable. This limit does not change
the `block` decision because the complete OpenAI and Claude runs independently
fail both candidates.

Use `runs/2026-09-27-compact-summary.md` for the short cross-format result and
plain-language explanation of `block`.
