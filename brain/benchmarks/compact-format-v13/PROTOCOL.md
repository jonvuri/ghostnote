# Phase 8c4c Gemini local-label diagnostic protocol

This diagnostic tests whether labels repeated on every note row explain part
of exact JSON's Gemini advantage. It compares current `FIELDS` with one local-
label compact variant. It does not rerun exact JSON or positional v1.

## Cases and repeats

Use four audited v12 stress cases:

- comprehension-analysis variants 95 and 97; and
- generation-progression variants 92 and 96.

Exact JSON passed and `FIELDS` failed on the unique v12 Gemini result for each
case. This post-hoc selection makes the run a focused diagnostic. It is not a
fresh family estimate.

Run current `FIELDS` and the local-label variant four times on each case. Use
adjacent arm pairs. Counterbalance which arm runs first. This gives 32 Gemini
message requests. Make no repair call and no automatic retry.

## Local-label variant

Keep the current compact headers. Remove the global `FIELDS` row. Use this
exact order and repeat each short label on every note row:

```text
N id=n1 voice=bass start=24 duration=3/2 pitch=47 velocity=78
```

Analysis varies only the input representation. Both arms return the same
neutral eight-field analysis payload. Progression varies only the output
representation.

## Decision rule

Select the local-label variant only when all these gates pass:

1. All 32 requests complete and both arms pass strict syntax on all 16
   responses.
2. On each analysis case, local labels pass at least three of four repeats and
   at least two more repeats than `FIELDS`.
3. Across the eight analysis responses, local labels have at least four more
   strict full passes and at least eight more correct field checks than
   `FIELDS`.
4. Local-label analysis prompts are no more than 50 percent larger on average
   than their paired `FIELDS` prompts. Perfect local-label progression payloads
   are no more than 100 percent larger on average.
5. Local labels have no progression syntax loss against `FIELDS`.

Progression musical full pass is diagnostic only. The current progression
task is at a reasoning floor and cannot promote the new variant.

If any gate fails, select current `FIELDS`. A local-label result cannot select
a public format or start holdout.

## Settings, cost, and approval

Use Gemini `gemini-3.8-flash` with `thinking_level=low`,
`max_output_tokens=12000`, and provider-default temperature. Keep the 12,000-
token input ceiling and 10,000-byte request ceiling.

The recent-cost estimate is USD 0.065000. The cumulative hard limit is USD
0.150000. Reserve the USD 0.054000 token-bound maximum before each message.
A failed request keeps its reservation.

No provider request is approved until the operator approves the exact
protocol and run-plan hashes.
