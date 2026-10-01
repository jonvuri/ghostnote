# Full grammar audit synthesis

## Findings

Three auditors completed eight assignments: one format and one asymmetry per
assignment. They examined all 240 unique note outputs and made at least 12
detailed full-response contract reviews per assignment. They studied public
language rules and independently decoded musical values. The individual
[reports](README.md) retain full responses, task contracts, sources, and hashes.

Both scoring asymmetries have a material effect in this retained cohort.

- Fourteen of 17 rejected native responses have valid public syntax. Broader
  decoding recovers 136 components. None becomes a complete task success.
- Composite ledgers earn 2433/2664 components (91.33%). Their notation earns
  1901/2664 (71.36%) through public grammar. Twenty-five of 50 ledger-perfect
  responses fail the musical task when their notation is read.
- Native notation rises from 1903/2664 (71.43%) to 2039/2664 (76.54%). It has
  a higher component ratio than composite notation in seven of eight
  provider/format cells. LilyPond is near parity.

These are offline sensitivity results for five note-output families. Analysis
answers and sentinel repeats are excluded. Frozen primary results remain
unchanged. These totals do not establish a general format or provider ranking.

## Comparison on the same musical fields

Each provider/format cell contains 15 tasks and 333 components. Ratios in this
table weight components. Large exact-note tasks contribute more than small
generation contracts. A notation score counts voice, onset, duration, and pitch
or the corresponding task requirements. The common ledger parser only checks
agreement with independently decoded notation; it does not decode the notation.

| Format / provider | Frozen native | Full grammar native | Full grammar composite notation | Composite ledger |
|---|---:|---:|---:|---:|
| ABC / OpenAI | 67.87% | 71.47% | 65.47% | 90.99% |
| ABC / Gemini | 68.77% | 68.77% | 64.26% | 93.09% |
| Strudel / OpenAI | 65.77% | 80.78% | 76.58% | 92.19% |
| Strudel / Gemini | 59.46% | 67.27% | 66.97% | 93.39% |
| LilyPond / OpenAI | 73.87% | 82.58% | 82.28% | 87.69% |
| LilyPond / Gemini | 82.58% | 84.98% | 85.89% | 90.39% |
| MusicXML / OpenAI | 64.86% | 68.17% | 42.94% | 89.49% |
| MusicXML / Gemini | 88.29% | 88.29% | 86.49% | 93.39% |
| Pooled note outputs | 71.43% | 76.54% | 71.36% | 91.33% |

The original pooled ledger/native gap is 530 components. Native grammar
recovery removes 136 of that gap, or 25.66%. Scoring the composite notation
removes 532 ledger components. The resulting notation comparison favors native
by 138 components, or 5.18 percentage points. The two effects concern different
channels and should remain separately reported.

### Equal-prompt sensitivity

Each prompt has equal weight in this table. This is a descriptive comparison
of the 15 paired note tasks per cell. It is not the six-family primary estimate.

| Format / provider | Full grammar native mean | Full grammar composite notation mean | Native minus composite |
|---|---:|---:|---:|
| ABC / OpenAI | 52.52% | 52.30% | +0.22 points |
| ABC / Gemini | 59.21% | 55.54% | +3.67 points |
| Strudel / OpenAI | 76.49% | 70.78% | +5.70 points |
| Strudel / Gemini | 57.81% | 56.21% | +1.60 points |
| LilyPond / OpenAI | 79.71% | 79.84% | −0.13 points |
| LilyPond / Gemini | 80.36% | 79.81% | +0.54 points |
| MusicXML / OpenAI | 69.08% | 43.56% | +25.52 points |
| MusicXML / Gemini | 86.03% | 81.61% | +4.41 points |
| Pooled note outputs | 70.15% | 64.96% | +5.19 points |

Seven cells favor native under this weighting too. The LilyPond cell that
favors composite changes with the weighting. Its differences are small.
Do not treat the sign in a small cell as a stable performance finding.

## Whole-task outcomes and agreement

| Format | Native full successes | Composite ledger full successes | Composite notation full successes | Notation/ledger agreement |
|---|---:|---:|---:|---:|
| ABC | 6/30 | 15/30 | 5/30 | 5/30 |
| Strudel | 7/30 | 13/30 | 7/30 | 9/30 |
| LilyPond | 7/30 | 11/30 | 7/30 | 12/30 |
| MusicXML | 11/30 | 11/30 | 6/30 | 12/30 |
| All note outputs | 31/120 | 50/120 | 25/120 | 38/120 |

Native whole-task counts do not change after grammar recovery. All recovered
outputs still have musical errors. Composite notation loses 25 ledger-perfect
successes. No notation-perfect response has a failing ledger in this cohort.

The 82 composite disagreements comprise 71 decodable differences and 11 actual
syntax errors. Only 24 composites have both exact channel agreement and a
complete task success. OpenAI LilyPond sequence 98 has two different valid
bass voicings. Both channels satisfy the contract. This shows why channel
agreement and task validity must be distinct fields.

## Complete-response examples

- **Native profile penalty:** OpenAI LilyPond 83 uses valid `bes` and `ees`.
  It recovers 9/10 components from zero. Its bass leap is 10 semitones against
  a maximum of nine, so the task still fails.
- **Ledger hides wrong rhythm:** OpenAI ABC 45 has a perfect 7/7 ledger.
  Its notation has no initial rest and uses `^D24` under `L:1/48`. The note
  starts at zero and lasts two beats. The contract requires onset 2/7 and
  duration 1/2. The notation earns 6/7 and fails the complete task.
- **Valid syntax has different semantics:** Strudel 1.2 accepts `~@0`, but
  its implementation substitutes weight one. It accepts `@21/2` as weight
  21 with an item slow operator of two. Neither has the timing the response
  appears to intend. The audit reads the emitted syntax without deleting or
  rewriting it.
- **Ledger hides invalid notation:** OpenAI MusicXML 79 earns 49/49 in the
  ledger. The score has an invalid MusicXML tree. Full grammar grants no
  valid-document notation credit. A guessed structural repair is excluded.
- **Disagreement with two valid answers:** OpenAI LilyPond 98 has first bass
  MIDI 58 in notation and 46 in the ledger. Both are in range, have the allowed
  pitch class, meet the leap limit, and share the required timing. Both earn
  10/10, despite the channel mismatch.

Provider sequence IDs identify retained complete responses. The individual
JSON records contain their task, prompt, and payload hashes.

## Limits and scoring interpretation

The prompts explicitly requested restricted profiles. A valid public-language
response can breach that request. This audit measures recoverable musical
content under wider grammar; it does not measure capability under unrestricted
prompts. The frozen subset score remains reproducible under its stated policy.

Strudel judgments use official pinned 1.2 packages. MusicXML uses the official
4.0 XSD and an independent rational event cursor. XSD validity does not enforce
all metric or engraving requirements. ABC and LilyPond judgments use language
documents and source rules. They have no compiler or importer certificate.
All actual emitted constructs were examined. Unused language features are not
tested by this cohort.

Invalid complete documents receive zero notation credit in both conditions.
There are three native and 11 composite invalid documents. Some have readable
fragments. No parser repair or engine error recovery was credited. Individual
reports give explicit ceilings where relevant. A maximally permissive policy
can change the aggregate direction: granting all 239 planned components in
the invalid composite documents would give 2140/2664 (80.33%). That is an
unearned ceiling, not evidence of a successful parse or correct music.

The role rubric can grant harmony credit on empty required-onset groups when
the response places all notes at other onsets. Timing requirements still fail.
Independent full-contract checks and direct note inspection prevent a claim
of complete success. Partial-credit ratios retain the original rubric and
therefore retain this caveat in both conditions.

## Handoff and verification

The later [adjudicated assessment](adjudicated-report.md) integrates these note
values into all 48 paired cells. It keeps 48 unique analysis scores unchanged
and excludes 96 sentinel repeats. Its six-family result differs from the
five-family totals in this synthesis. The original assessment remains available.

Use four separate product measurements: notation task accuracy, ledger task
accuracy, requested profile compliance, and cross-channel agreement. Define
any changed scoring policy before another provider run. The product format
choice and Phase 8f remain pending operator review.

The [signed verification](verification.json) reproduces all eight audit totals,
checks all 240 source case identities, and checks full payloads and task/prompt
hashes. It also recomputes channel agreement. These checks validate provenance
and arithmetic. They do not prove manual grammar judgments. Frozen package,
assessment hash, context links, and diff checks pass. No provider call, cache
change, or live-project action occurred.

## Retrospective

Before a future freeze, compare independent public-grammar decoding with subset
decoding on controls. Store notation values and ledger values separately.
This makes the observation boundary explicit before a score is interpreted.
