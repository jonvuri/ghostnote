# Native versus composite diagnostic protocol

## Purpose

Measure the paired effect of the Ghostnote side ledger on eligible musical
tasks. Compare ABC 2.1, Strudel 1.2.0, LilyPond 2.24.4, and MusicXML 4.0. Each
format has a native arm and a composite arm.

## Tasks and fields

Use three fresh tasks in each of six families: structure comprehension,
analysis comprehension, progression generation, melody generation, motif
continuation, and role continuation. Repeat the first prompt in each family
once as an exact sentinel. This gives 24 messages per arm, 192 per provider,
and 576 messages in total. Claude can also make at most 192 token-count
requests. A token-count request requires the same prior approval.

Score voice, start, duration, and pitch. Native voice names use each notation's
own voice, label, or part mechanism. Lane suffixes are a local convention.
Exclude stable note IDs, velocity, document metadata, sparse edits, and exact
preservation. Both conditions use the same musical tasks and instructions.
Composite rows use arbitrary event IDs and fixed velocity 84. These fields do
not earn musical credit.

Analysis groups use native voice and inclusive start intervals. The shared
numeric motif pairs remain in the task contract. The notation condition thus
changes chord input, but does not change motif-pair encoding. Case labels in
the answer are not note IDs. Exclude these labels from primary accuracy.

Fresh tasks use the v5 generator with seed 401009 and variant offset 6000.
Shift native start positions by 1/7, 2/7, or 3/7 beat. Shift affine output
origins by the same amount. Record the transform and compare actual musical
content with v19 and symbolic v3, v4, and v5. Exclude IDs, velocity, and fixture
metadata from this audit. Do not claim new task shapes or a general holdout.

## Notation subsets

Use repository parsers for fixed subsets. This is not a full public-standard
conformance test. Eligible tasks must round-trip in all four subsets before
calls. Use rational durations and nonnegative starts. Split overlaps into
native voice lanes. Do not add Ghostnote labels, IDs, or a ledger to native
notation.

- ABC uses a fixed header, L:1/48, explicit accidentals on every pitch, rational
  length multipliers, and rests. [ABC 2.1](https://abcnotation.com/wiki/abc%3Astandard%3Av2.1)
  defines the voice and duration mechanisms.
- Strudel uses unique native labels, positive integer `@` weights, and
  `.slow()`. Interpret a base cycle as four beats. Compute event duration as
  `4 * slow * weight / sum(weights)`. Use trailing rests to align lane spans.
  [Mini-notation](https://strudel.cc/learn/mini-notation/) defines weights and
  rests. The [Strudel release notes](https://strudel.cc/blog/) define labels.
  The retained matrix parser ignored `.slow()`; this package uses a new parser.
- LilyPond uses absolute pitch, named Voice contexts, and quarter-note duration
  multipliers. [Writing rhythms](https://lilypond.org/doc/v2.24/Documentation/notation/writing-rhythms)
  describes duration scaling.
- MusicXML uses named parts, exact divisions, sequential notes, and rests in
  one implicit measure. [MusicXML 4.0](https://www.w3.org/2021/06/musicxml40/)
  defines these elements.

## Scoring and analysis

Match exact-task notes once by common musical fields. Use the E209 matching
policy on the four common fields. Use bounded assignment for remaining notes.
Score exact note count separately
within the primary components. Score generation and role contracts as named
checks. Empty outputs receive no constraint credit. Melody requires the lead
voice. Omit the ambiguous legacy strong-beat check. Require exact progression
density, listed pitch classes, strict voice order, and duration. Require exact
role timing and duration.

Parse composite notation and ledger independently. Primary composite music
comes from the ledger. A notation error does not erase recoverable ledger
music. Report subset parse, canonical form, and notation/ledger agreement as
diagnostics. Native music comes from the native subset parser.

Use each unique prompt as the experimental unit. Exclude sentinel repeats
from primary estimates. Report each provider, family, and format pair with
planned pairs, complete pairs, component ratios, mean prompt accuracy, strict
musical discordance, native minus composite effect, and a paired prompt
bootstrap interval. Three prompts per cell give coarse uncertainty. A zero
interval does not establish equivalence. Report exact repeats separately.

Exclude failed and unavailable outputs from musical denominators. Exclude
incomplete pairs from paired effects. Retain completion and cost records.
Do not pool this run with v5. The corrected v5 provider and family cells are
baseline context only. Its primary fields and task contracts differ.

Manually audit one case in each provider, family, and format pair after the
run. Treat this as a diagnostic. It cannot select a product format, authorize
Phase 8f, or establish provider training familiarity.

## Providers and cost

Keep the v5 models and settings: OpenAI `gpt-5.4-mini-2026-03-17` with low
reasoning; Gemini `gemini-3.8-flash` with low thinking; Claude
`claude-haiku-4-5-20251001` with 1,024 thinking tokens. Keep the 12,000-token
output limit. Omit temperature. Use isolated requests and provider-specific
deterministic schedules.

Estimate each cell from retained v5 token usage. Apply the current API rates.
Assume native calls cost as much as composite calls. Do not assume a native
token saving. Freeze the exact numeric estimates in `runs/diagnostic-r1-plan.json`.
The hard limits are USD 2.75 for OpenAI, USD 1.00 for Gemini, and USD 7.00 for
Claude. The total hard limit is USD 10.75.

Prices were checked on 2026-09-30. Rates per million tokens are input, cached
input, and output: OpenAI 0.75/0.075/4.50; Gemini 0.75/0.075/3.75; Claude
1.00/0.10/5.00. Sources are the [OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini),
[Google pricing](https://ai.google.dev/gemini-api/docs/pricing), and
[Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing).
The Google rates apply through 2026-12-31. A later run needs a new price freeze
and approval. Provider dashboards remain the external spend authority.

## Approval and stops

No provider request is approved. Explicit approval must match the frozen
protocol, plan, cohort, candidates, schedules, models, settings, and hard cost
limits. Check the approval before credential or network access. Verify returned
model identity. Reserve the maximum bounded call cost before each message.
Keep failed reservations. Stop on the first transport, budget, approval,
identity, freshness, or deterministic-screen failure. Stop after three
unavailable outputs. Make no retry, repair, or continuation call.

Create one permanent attempt record per provider before execution. Refuse a
second attempt under this run ID, including after interruption or failure.
Any recovery needs a separate frozen plan and explicit approval.

Keep all frozen observations unchanged. Keep the cache, `normal-v1`, and live
Bitwig projects unchanged.
