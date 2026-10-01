# Full grammar and scoring asymmetry audit

The operator requested independent manual audits of retained full responses.
No provider call is part of this work. Frozen prompts, responses, parsers,
and scores remain unchanged.

## Questions

1. Native parser limits: Which rejected responses are valid in the public
   language? What musical credit can their actual values recover?
2. Composite ledger credit: Which credited ledgers have wrong or invalid
   notation? How much credit survives when the notation is read directly?

Each assignment covers one format and one question. Auditors study official
language documents and relevant engine source. They read complete responses
and task contracts. They do not use the benchmark subset parser as the
authority for public syntax or musical meaning.

## Population and selection

[The inventory](asymmetry-inventory.json) contains all 240 unique note outputs:
two providers, four formats, two conditions, and 15 tasks in each cell.
Exclude analysis answers and exact sentinel repeats. Analysis returns common
answer fields, so it is a different observation surface.

Native samples cover every subset rejection, accepted outputs with musical
errors, and correct controls from both providers. Composite samples emphasize
high ledger credit with a notation disagreement or parse error. They also
cover aligned controls. Include all five note-output task families where
possible. An auditor can inspect the full 30-case format population when the
responses and decoding are simple.

These are defect samples. Their frequency is not a population-rate estimate.
Report exact reviewed cases, provider and sequence IDs, hashes, and coverage.
State whether any aggregate covers a sample or the full format population.

## Required distinctions

- Public-language syntax validity.
- Compliance with the requested restricted profile.
- Actual voice, onset, duration, and pitch values.
- Task correctness under those values.
- Agreement between notation and ledger.
- Benchmark interpretation errors, response errors, and unresolved cases.

A valid public-language spelling can still violate the prompt profile or
produce wrong music. A corrected parse does not imply full task success.
Keep unresolved semantics as bounds. Do not silently repair response text.
An illustrative repair must be labeled and cannot count as the response.

Use complete payloads or direct retained-payload references. Cite the official
rules used in each judgment. A compiler or runtime check is supporting
evidence; record its version and limitations. Manual calculations remain
necessary for the musical contract.

## Outputs

Each audit has a Markdown report and a JSON case record. The synthesis will
link all completed assignments, separate the two effects, and state the limits
of possible revised credit. No manual estimate replaces the frozen assessment.

| Format | Native parser limits | Composite ledger credit |
|---|---|---|
| ABC 2.1 | [audit](abc-native-full-grammar.md) | [audit](abc-composite-ledger-credit.md) |
| Strudel 1.2 | [audit](strudel-native-full-grammar.md) | [audit](strudel-composite-ledger-credit.md) |
| LilyPond 2.24.4 | [audit](lilypond-native-full-grammar.md) | [audit](lilypond-composite-ledger-credit.md) |
| MusicXML 4.0 | [audit](musicxml-native-full-grammar.md) | [audit](musicxml-composite-ledger-credit.md) |

The [synthesis](synthesis.md) compares both channels under the same musical
rubric. The signed [verification record](verification.json) records artifact
hashes and reproduced component totals.

Run `python3 -B brain/benchmarks/native-composite-v1/audits/verify.py` from the
repository root. This checks source identity, full payloads, task and prompt
hashes, decoded-value arithmetic, and ledger agreement. It cannot prove a
manual grammar judgment. The individual reports state the language authority
and engine limits.

## Integrated assessment

The operator requested integration of the retained adjudications into scoring.
The [adjudicated report](adjudicated-report.md) and signed
[assessment](adjudicated-assessment.json) now use audited notation values in
both conditions. Composite ledger credit and original profile compliance
remain separate. The [policy](adjudication-policy.json) states the changed
score input and its limits. Original observations and scores remain available.

This view scores 240 unique note outputs from the audit and retains the original
deterministic scores for 48 unique analysis answers. It excludes 96 sentinel
repeats. Detailed manual review was targeted; full-cohort decoding also used
runtime and schema tools. This is not a claim that every API response received
an equally deep manual review.

Run `python3 -B brain/benchmarks/native-composite-v1/audits/adjudicated_assessment.py --check`
from the repository root to reproduce all 48 paired cells and the report.
The generator verifies exact audit coverage, original score reproduction,
all eight audit totals, and provenance. It does not parse new notation with
the full grammar. It uses the retained audit judgments as score inputs.
