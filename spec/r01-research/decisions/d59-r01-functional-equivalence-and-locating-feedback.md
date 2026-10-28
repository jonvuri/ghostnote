# D59 — R01 scores functional equivalence; correction feedback locates errors

Date: 2026-10-26. Status: accepted by the operator.

After [E369](../../../context/evidence/experiments/e369-r01-first-development-run-one-repeat.md),
the operator decided:

1. **Functional equivalence passes.** In general, a parsed answer that is
   functionally equivalent to the oracle passes. Scoring version
   `r01-scoring-v2-functional-rationals` applies this to rational values in
   source-state and JSON-answer scoring: rational strings compare by value, so
   `1032/512` equals `129/64`. A string outside the contract's rational syntax,
   such as a decimal, is not reinterpreted. Opaque annotations stay exact.
   Note order and group structure are still compared as before. Performed
   scoring already normalizes timing to 1/512 and is unchanged. The answer must
   still parse.
2. **Correction feedback is more specific without prescribing a resolution.**
   Feedback version `r01-feedback-v2-locating` adds:
   - the paths at which an answer or decoded state differs (at most eight,
     with a total count);
   - for performed tasks, the answer's own unmatched notes (at most eight)
     and the count of missing notes.

   It never discloses expected values, missing notes or golden responses.
   The reason code and native validation message remain.

Runner sessions record both versions. The execution manifest pins them, and a
start whose versions differ from its manifest is refused. Some task requests
(for example p02's "reduced rational strings" and p12's "exact rational
spellings") still ask for a spelling that scoring no longer requires. Changing
that wording would change prompts and require a new package version.

Re-scoring E369's retained answers offline under v2 changes only Haiku p07:
all three C3 FIELDS submissions and the first two C3 JSON submissions now pass.
Haiku would be 60/67 first-attempt and 66/67 within budget; Luna is unchanged.
E369's recorded results remain as scored at the time.
