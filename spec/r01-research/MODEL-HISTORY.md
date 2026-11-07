# Historical format research: models and comparison boundaries

The earlier format program spans several experiments. Its first compact-context
probe, its first retained reusable benchmark, and the later FIELDS/JSON selection
matrix are different cohorts. The exact settings below come from historical
drivers and retained request manifests. They are not current availability,
pricing, or model recommendations.

## Decisive FIELDS/JSON matrix

The [product review](../../context/evidence/format/FORMAT_BENCHMARK_PRODUCT_REVIEW.md)
primarily uses `symbolic-format-v5`, run
`phase8c4f-eight-arm-full-matrix-r1`, dated September 29–30, 2026.
The [frozen plan](../../brain/benchmarks/symbolic-format-v5/runs/full-matrix-r1-plan.json)
records these initial requests:

| Provider | Exact model ID | Reasoning/thinking | Output ceiling | Temperature |
|---|---|---|---|---|
| OpenAI | `gpt-5.4-mini-2026-03-17` | `reasoning_effort: low` | `max_completion_tokens: 12000` | Omitted |
| Google | `gemini-3.8-flash` | `thinking_level: low` | `max_output_tokens: 12000` | Omitted |
| Anthropic | `claude-haiku-4-5-20251001` | `thinking: {type: enabled, budget_tokens: 1024}` | Initially `max_tokens: 12000`; continuations use `24000` | Omitted |

The Claude ceiling qualification matters: its retained results combine the
[initial manifest](../../brain/benchmarks/symbolic-format-v5/runs/2026-09-29-claude-haiku.json)
and continuation manifests, starting with
[r3](../../brain/benchmarks/symbolic-format-v5/runs/2026-09-29-claude-haiku-continuation-r3.json).
Reasoning settings remain unchanged, but the final matrix is not a uniformly
12,000-token experiment. Each manifest's `effective_request_settings` records
what was sent. The [assessment's `CHAIN_NAMES`](../../brain/benchmarks/symbolic-format-v5/corrected_assessment.py)
identifies the complete retained continuation chain.

There are eight arms and ten task families. Each provider's schedule has
74 initial messages per arm: 65 distinct tasks and nine sentinel repeats,
592 messages total. The corrected scored population is 1,773 outputs:
592 OpenAI, 592 Gemini, and 589 Claude. Three Claude output-limit outcomes stay
outside musical denominators. FIELDS and exact-object JSON each have all
222 scored outputs, 74 per provider. The matrix aggregates include sentinel
repeats; these are not 222 independent compositions per format. No repair call
is included in these initial-output comparisons.

The authoritative result is the
[corrected assessment](../../brain/benchmarks/symbolic-format-v5/runs/2026-09-30-corrected-assessment.json),
backed by the retained [OpenAI](../../brain/benchmarks/symbolic-format-v5/runs/2026-09-29-openai.json)
and [Gemini](../../brain/benchmarks/symbolic-format-v5/runs/2026-09-29-gemini.json)
manifests and the continuation chain above. FIELDS and JSON are direct note
representations in this comparison; they do not have a second notation sidecar.
The ABC, Strudel, LilyPond, MusicXML, and MIDI-like composite arms carry side
ledgers. Their matrix musical scores principally measure those ledgers, not
independently decoded notation bodies.

The scored FIELDS/JSON grammar predates Ghostnote Document 1.0. Both arms omit
channel, mute, release velocity, articulation, and expression. The review's
94.56% FIELDS versus 94.69% JSON prompt means and 18.24% pooled token saving
are descriptive results for that workload, not current full-state accuracy or
universal efficiency. Provider tokens, including reported reasoning usage,
are not interchangeable tokenizer units.

## Separate notation/side-ledger diagnostic

The subsequent `native-composite-v1` experiment tests native versus composite
ABC, Strudel, LilyPond, and MusicXML. It does not rerun FIELDS against JSON.
Its [protocol](../../brain/benchmarks/native-composite-v1/PROTOCOL.md) and retained
[OpenAI](../../brain/benchmarks/native-composite-v1/runs/openai.json) and
[Gemini](../../brain/benchmarks/native-composite-v1/runs/gemini.json) manifests use
the same OpenAI/Gemini model IDs above, low reasoning/thinking, 12,000-token
ceilings, and omitted temperature.

Each retained provider has 192 initial calls: eight arms × six families ×
(three unique tasks plus one repeat). The adjudicated primary population
excludes 96 second sentinel outputs, leaving 288 unique outputs across both
providers: 240 note outputs and 48 analysis answers. Each provider/family/arm
cell therefore has only three unique tasks. Claude was attempted but excluded
at the operator's request; it is not a retained third provider in these results.
[E211](../../context/evidence/experiments/e211-native-composite-diagnostic-closes-with-two-providers.md)
retains that exclusion and cost history.

Use the [adjudicated assessment](../../brain/benchmarks/native-composite-v1/audits/adjudicated-assessment.json)
for notation-body conclusions. It separates decoded notation, ledger accuracy,
and exact agreement. The 31.67% pooled notation/ledger agreement is from this
diagnostic, not the FIELDS/JSON matrix. Different tasks, scoring contracts,
provider coverage, and repeat policies prevent pooling the two experiments or
attributing their score differences solely to format.

## Earlier rounds

| Experiment | Models/settings | Actual or planned scope and source |
|---|---|---|
| E114, September 13: first compact-context comparison | OpenAI `gpt-5.4-mini-2026-03-17`, low reasoning, temperature omitted; Google `gemini-3.8-flash`, low thinking, temperature 0. Initial ceiling 12,000; repair ceiling 2,000. | Four arms × two providers: eight initial calls and eight repair calls. Exact JSON, compact bar events, ABC, and a pattern DSL. [Evidence](../../context/evidence/experiments/e114-bar-context-and-guarded-note-patches-pass-two-models.md); [driver](../../brain/src/probes/phase6f-symbolic-representation.py). |
| E115, September 13: established syntax/familiarity | Same two models and sampling settings; initial ceiling 10,000, repair ceiling 2,000. | Five arms × four instruction/label conditions × two providers: 40 initial calls plus ten repairs. ABC has a side plane; other token formats have explicit task extensions. [Evidence](../../context/evidence/experiments/e115-established-syntax-does-not-beat-compact-bar-context.md); [driver](../../brain/src/probes/phase6f1-symbolic-familiarity.py). |
| E137, September 25: first retained reusable `compact-bar-v0` benchmark | Same two models and sampling settings; initial ceiling 12,000, repair ceiling 2,000. | Eight initial arms per provider, including one native Strudel task; seven finite arms receive one repair each. Thirty calls across two providers. ABC/Alda use side ledgers. [OpenAI manifest](../../brain/benchmarks/compact-bar-v0/runs/2026-09-25-openai.json); [Gemini manifest](../../brain/benchmarks/compact-bar-v0/runs/2026-09-25-gemini.json); [E137](../../context/evidence/experiments/e137-compact-bar-prior-art-and-benchmark.md). |
| E140, September 27: expanded `symbolic-format-v1` | Same OpenAI/Gemini IDs; Anthropic `claude-sonnet-5` with `output_config.effort: low`. All ceilings 3,000; temperatures omitted. | Thirteen arms with adaptive, unequal task counts: retained manifests contain 547 OpenAI, 503 Gemini, and 535 Claude rows. Use paired comparisons rather than raw pooled arm rates. [Driver](../../brain/benchmarks/symbolic-format-v1/benchmark.py); [report](../../brain/benchmarks/symbolic-format-v1/runs/2026-09-27-report.md); [E140](../../context/evidence/experiments/e140-expanded-symbolic-format-comparison-requires-revision.md). |
| E156, September 27: explicit fixed-`FIELDS` calibration plan | Same OpenAI/Gemini IDs and Claude Sonnet 5, low settings; 5,000-token ceilings, provider-default temperature. | Planned 69 initial calls per provider: 60 unique plus nine sentinels, with at most one repair per available failure. This is an intermediate calibration, not the decisive eight-arm matrix. [Frozen plan](../../brain/benchmarks/compact-format-v4/runs/calibration-r1-plan.json); [E156](../../context/evidence/experiments/e156-compact-bar-contract-repair-freezes-calibration.md). |

E114/E115 retained evidence and driver hashes, but their temporary raw response
artifacts were removed. The
[legacy manifest](../../brain/benchmarks/compact-bar-v0/legacy-baselines.json)
records their identities; it cannot supply missing per-call responses. E137
and the later matrix retain dated provider manifests. Earlier Sonnet runs,
intermediate calibrations, model smoke checks, and subsequent capability tests
must not be substituted for the actual Haiku/OpenAI/Gemini matrix population.

All of these are direct provider-API experiments. Their recorded settings do
not establish equivalence to a CLI's available aliases, default effort,
tool-enabled agent behavior, or current model release. A future trial must
record its own resolved models and effective request settings.
