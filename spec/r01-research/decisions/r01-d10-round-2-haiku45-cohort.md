# R01-D10 — Round 2: Haiku 4.5 as a development cohort

Date: 2026-10-28. Status: accepted by the operator (round 2 brief, open
decision 3).

## Decision

Round 2's development stage includes `claude-haiku-4-5-20251001` with a
1,024-token thinking budget and **no output cap** (D57). It runs on Claude
Code 2.1.302 under context policy v1 (E361). One probe confirms that the
subscription still serves it. Rigorous inclusion is decided after the
development results, as for Terra (R01-D9).

## Consequences

- The existing `claude-historical` profile carries E360's 12,000-token cap.
  Round 2 needs a separate uncapped profile, and the probe must confirm that
  context policy v1 admits its captured request.
