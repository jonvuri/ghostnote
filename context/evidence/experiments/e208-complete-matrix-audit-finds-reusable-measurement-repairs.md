---
title: Complete matrix audit finds reusable measurement repairs
kind: evidence
state: pending
updated: 2026-09-30
phase: phase-8-agent-native-live-engine
session: phase8c4f-complete-matrix-audit
---

# E208: Complete matrix audit finds reusable measurement repairs

## Verdict

Three independent read-only audits inspected 67 complete prompt-response cases
and all three unavailable Claude outcomes. The sample covers all three
providers, all eight formats, and all ten task families. It includes original
and continuation rows, selected failures, and the final recovered Claude rows.

The matrix ran as scheduled. The audit found no provider-identity, task,
prompt, reference, freshness, schedule, continuation-merge, retained-response,
or measured-cost defect. All 1,773 scored rows reproduce. Each provider has the
same 592 task-format combinations. Matching tasks have the same planned score
denominators.

The stored primary metric has measurement defects. Do not use close format
rankings from the frozen aggregate until a read-only corrected assessment is
complete. Keep all frozen run artifacts unchanged. The retained responses are
valid and reusable. No paid provider rerun is necessary.

## Synthetic ID coupling

The exact scorer joins expected and actual notes by expected synthetic ID. It
also scores the ID as one of six case fields. A response that preserves the
five musical fields but changes an ID can therefore lose all six components.

A conservative cross-provider scan paired notes only when voice, start,
duration, pitch, and velocity matched exactly. It found 27 affected rows and
182 exact musical tuples with different IDs:

- OpenAI: 12 rows and 48 tuples.
- Gemini: no affected row.
- Claude: 15 rows and 134 tuples.

The effect is material for some format cells. An ID-neutral diagnostic changes
OpenAI MIDI-like from 94.79 to 97.19 percent. It changes Claude LilyPond from
85.77 to 96.10 percent, MIDI-like from 90.71 to 97.88 percent, and MusicXML
from 88.97 to 93.86 percent. These are diagnostic values, not final corrected
aggregates. The correction policy is not frozen yet.

Keep expected-ID preservation as a separate response component. Do not use a
synthetic ID as the join key for the five musical fields.

## Compact-row recovery

Eleven compact responses contain visible `N` rows but produce no parsed notes.
Nine contain exactly the required six note fields. Blank or invalid `BASE` or
`SOURCE` metadata caused the parser to erase their musical rows.

A safe row-only diagnostic adds 56 correct OpenAI components and 65 correct
Claude components. It changes:

- OpenAI `FIELDS`: 97.0850 to 97.3594 percent.
- OpenAI local labels: 94.7874 to 96.4335 percent.
- Claude local labels: 95.5418 to 97.7709 percent.

Keep structural and canonical failure false for these responses. Recover only
the exact six-field musical rows. Two Gemini responses use undeclared
bar-relative fields and need a separate interpretation policy. Do not infer
their coordinates in the safe correction.

## Empty-set constraint credit

Ten zero-note responses received 24 positive constraint components. Empty
collections made some `all(...)` checks pass. A safe strict correction requires
at least one parsed note before a note-dependent condition can pass.

This defect has a small aggregate effect. With no row recovery, it changes
OpenAI from 94.6931 to 94.6588 percent, Gemini from 97.7838 to 97.7709 percent,
and Claude from 92.9678 to 92.9120 percent.

Apply compact-row recovery before the strict empty-set rule where the exact
musical rows are safely recoverable.

## Other measurement limits

The melody scorer does not check the required `lead` voice. Eighteen public
format rows use values such as `lead.1`, `lead.2`, `1`, or `2`. Each row already
failed another musical component and notation-ledger alignment, but the
primary metric did not measure the voice error.

The melody prompt does not define `strong beat`. The scorer treats every
whole-number onset as strong. In zero-based 4/4 coordinates, onset `1` is the
second beat and is usually weak. Future prompts must say `whole-number onset`
or list the tested starts.

Public-format parsers implement pinned interchange subsets. They reject some
valid native spellings and constructs. Examples include standard Strudel
sharp and flat spellings and valid LilyPond skips, rests, and accidentals.
Treat the structural diagnostic as pinned-subset conformance, not full public
syntax validity.

The MIDI-like parser expects one event per line, but the prompt shows this only
by example. State the rule explicitly in a future cohort.

## Continuation and unavailable rows

Claude's recovered rows 195, 340, 341, 557, and 559 have the correct prompt,
task, model, settings, provenance, and score identities. The three retained
unavailable rows, 140, 152, and 409, are genuine 24,000-token output-limit
outcomes. They remain outside musical denominators.

The Claude base rows used the original 12,000-token limit. Approved
continuations used 24,000 tokens with the same 1,024-token thinking target.
This qualification is documented. No scored source row was replaced.

The complete measured cost remains USD 15.72944325. The incomplete r9 read can
still have an unknown provider-side charge because no usage record reached the
client.

## Next assessment

Create one read-only assessment over the frozen responses. It must:

1. align the five musical fields without using synthetic ID as the join key;
2. score expected-ID preservation separately;
3. recover exact six-field compact rows independently from metadata validity;
4. prevent empty-note constraint credit;
5. add the required `lead` voice component; and
6. preserve current structural, canonical, and subset-conformance diagnostics.

Publish the corrected aggregate beside the frozen aggregate. Then interpret
the format ranking. Do not make another provider call for this repair.

## Retrospective

Score reproduction proves implementation consistency, not measurement
validity. Future audits must include ID-mutated and metadata-malformed responses
before a primary aggregate is used for a product decision.
