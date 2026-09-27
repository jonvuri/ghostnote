# Compact JSON v1 benchmark

This package implements the Phase 8c2.3 compact JSON factorial. It is not a
public format specification. It does not change a frozen benchmark, the
runtime profile, the cache, or a live Bitwig project.

## Arms

The first four arms form a 2×2 factorial:

| Arm | Shape | Pitch value |
|---|---|---|
| `exact-object-json-midi` | Named objects | MIDI integer |
| `exact-object-json-pc-register` | Named objects | `[pitch_class, octave]` |
| `tuple-json-midi` | Named collections of fixed tuples | MIDI integer |
| `tuple-json-pc-register` | Named collections of fixed tuples | `[pitch_class, octave]` |

The fifth arm is `midi-like-native`. It is a concurrent anchor. It is not a
factorial cell. Compare it with a selected JSON cell only on common musical,
size, token, and latency metrics.

[SCHEMAS.md](SCHEMAS.md) defines the documents and patches. The executable
parser enforces that contract. [CONTRACTS.md](CONTRACTS.md) maps task
instructions to scorer checks.

## Capabilities

All JSON arms carry score, bar, track, region, and note metadata. They keep
stable IDs and support guarded sparse patches. A patch rejects a stale base,
an unknown ID, and a repeated target ID. Object and tuple patches compile to
the same normalized operation.

Native MIDI-like carries the common musical fields only. It does not supply
stable identity, exact omitted-field preservation, sparse patches, or base
conflict checks. Its capability result stays separate from the factorial.

## Base deterministic cohorts

The base package has three fixed cohorts. All fixture and semantic hashes are
disjoint from each other and from the Phase 8c1, 8c2, and 8c2.2 cohorts.

| Cohort | Decision fixtures per family | Melody fixtures | Fixtures per guard | Calls per arm |
|---|---:|---:|---:|---:|
| Calibration | 3 | 1 | 1 | 14 |
| Development | 8 | 4 | 4 | 44 |
| Holdout | 8 | 4 | 4 | 44 |

The decision families are progression generation, role continuation, and
revoicing. Eight development fixtures per family give a smallest hard-macro
step of `1 / (8 * 3) = 4.17` percentage points. Melody is a regression family.
Structure, local transformation, rhythm transformation, and fixed-ID motif
continuation are guards.

Calibration is diagnostic. It cannot select a format. It rechecks progression
and revoicing for floor and ceiling effects before development.

The repaired paid protocol uses separate development and holdout cohorts.
Each cohort has 20 progression fixtures. Their fixture and semantic hashes
are disjoint from each other and all earlier provider-bearing cohorts.

## Offline checks

Run these commands from `brain`:

```sh
python3 benchmarks/compact-json-v1/benchmark.py --self-test
python3 benchmarks/compact-json-v1/benchmark.py \
  --check benchmarks/compact-json-v1/expected-deterministic.json
```

The checks cover all MIDI values, pitch conversion, schema rejection,
round trips, canonical order, identity, metadata, exact preservation, sparse
patches, patch conflicts, size, token estimates, scorer mutations, cohort
separation, paired contrasts, and all nine prompt grammar forms.

`cohort-manifest.json` records every fixture hash and semantic hash.
`schema-manifest.json` records the executable field and tuple contract.

## Initial calibration approval gate

The frozen run ID is `phase8c2-3-compact-json-calibration-r1`. Each provider
gets 70 calls. The total scope is 210 calls. The models are OpenAI
`gpt-5.4-mini-2026-03-17`, Gemini `gemini-3.8-flash`, and Claude
`claude-sonnet-5`. Each model uses its low-effort setting and provider default
temperature.

The cost estimate is USD 0.404167 for OpenAI, USD 0.256802 for Gemini, and USD
1.429609 for Claude. The total estimate is USD 2.090578. The estimate uses the
larger recent mean call cost and adds 25 percent.

The operator must approve the exact plan in
`runs/calibration-r1-plan.json`. No provider call is approved by this package.
The harness rejects the pending approval record.

After explicit approval, update only the approval record. Then run one
provider at a time with a new dated output path:

```sh
python3 benchmarks/compact-json-v1/benchmark.py --provider openai \
  --approval-file benchmarks/compact-json-v1/runs/calibration-r1-approval.json \
  --output benchmarks/compact-json-v1/runs/YYYY-MM-DD-calibration-openai.json
```

Use `gemini` and `claude` for the other providers. Then summarize the three
complete runs. Do not start development from a calibration approval.

## Development result

Development r1 completed 100 calls on each provider. OpenAI and Gemini
disagreed on frozen decision signals, so the approved conditional Claude
stage ran. The result is `freeze-holdout`.

Development froze these holdout cells:

- `exact-object-json-midi`, as the control and fallback;
- `exact-object-json-pc-register`; and
- `tuple-json-midi`.

Native MIDI-like did not qualify. The recorded total cost is USD 5.952846.
Six Claude responses stopped at the 5,000-token limit. Run the independent
integrity check with:

```sh
npm run benchmark:compact-json-development-report
```

## Holdout result

The frozen holdout uses the 20 reserved progression fixtures and the three
development cells. Each provider has 60 calls. The total scope is 180 calls,
and the estimate is USD 4.464634. Claude uses a 7,000-token limit. OpenAI and
Gemini keep the 5,000-token limit.

The approved holdout completed all 180 calls. It returned
`select-for-phase8c3`. Tuple JSON with MIDI integers passed on OpenAI and
Claude. Exact-object pitch-class/register passed only on Gemini and is
rejected. The exact-object MIDI control remains the fallback. No response
stopped at its output-token limit.

The recorded cost is USD 4.173729. Run the offline protocol and independent
integrity checks with:

```sh
npm run benchmark:compact-json-holdout
npm run benchmark:compact-json-holdout-report
```
