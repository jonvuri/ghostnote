# Phase 8c4c prompt-repair screen protocol

This screen adjudicates known prompt and framing defects. It is not a new
development estimate and cannot select a format.

## Cases

Use four existing audited cases:

- analysis variants 27 and 29 for input comprehension;
- progression variant 27 for output serialization; and
- role-continuation variant 27 for output serialization.

Run exact-object JSON, positional compact-bar v1, and compact-bar `FIELDS`.
Send two independent initial requests for each case and arm. Use OpenAI,
Gemini, and Haiku. Do not make repair calls.

The maximum is 24 message requests per provider and 72 in total. Haiku can
make at most 24 token-count requests.

## Separation

Analysis varies only the input representation. Every arm returns the same
`ANALYSIS` grammar.

Progression and role continuation have no input document. They test output
serialization and task reasoning.

## Reporting

Report the exact public grammar result. Also report a diagnostic result after
only these predeclared recoveries:

- remove an invented `line` field and its row value;
- remove one copied end marker;
- restore the literal `none` after a blank `BASE`; and
- restore a missing `ANALYSIS` prefix.

Keep both repeated results. Report whether strict pass, recoverable pass, and
payload identity repeat. Do not replace an initial result.

## Cost and approval

Use the same models, provider settings, token ceilings, and prices as paired
development r1. Apply these cumulative provider limits:

| Provider | Maximum calls | Hard limit |
|---|---:|---:|
| OpenAI | 24 | USD 0.300000 |
| Gemini | 24 | USD 0.200000 |
| Haiku | 24 | USD 0.750000 |
| Total | 72 | USD 1.250000 |

Reserve the full token-bound cost before each message. Record a Haiku
token-count attempt before the request starts. Do not retry a failed request.

No token-count or provider request is approved until the operator approves
the exact protocol and run-plan hashes.
