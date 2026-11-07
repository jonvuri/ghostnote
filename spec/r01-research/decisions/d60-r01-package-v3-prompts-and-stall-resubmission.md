# D60 — R01 package v3 prompt revisions and one resubmission after a stall

Date: 2026-10-27. Status: accepted by the operator.

After the response analysis in
[E370](../../../context/evidence/experiments/e370-r01-second-development-run-and-response-analysis.md),
the operator approved fixing its four prompt defects and the proposed stall
policy.

## Package v3 (`pilot-development-v3`)

Package v3 keeps input v2. Inputs, oracles, cells and exclusions equal v2;
only wording and prompt assembly change.

- **Selectors (task revision 3).** p05, p06 and p09 select "the note with
  onset X and pitch Y". The old "the note at 8 with pitch 56" also matched the
  note at list position 8.
- **Spelling (task revision 3).** p02 asks for "rational strings", p04 for an
  onset "written as a rational" and p12 for "exact rational values".
  [D59](d59-r01-functional-equivalence-and-locating-feedback.md) scoring does
  not require reduced or exact spellings. Changed tasks carry version 2.
- **No `TASK SCOPE` block (prompt revision 2).** The performed contract
  already stated its meter, channel, clip length and timing unit. The source
  contract now states the quarter-note unit, the 4/4 display meter and
  per-note channel preservation, and asks for exact rational values instead of
  values and spellings. The prose remains byte-identical across arms, so
  information parity is unchanged.
- **bar|beat card (card revision 2).** The card documents the `d` (dotted,
  ×3/2) and `t` (triplet, ×2/3) suffixes from the pinned Producer Pal
  ADR-0011. The serializer emits them; the revision-1 grammar omitted them.

Package v2 still regenerates its retained tasks, pairs and cards under task
revision 2 and prompt revision 1. Packages v1 and v2 are marked retired: they
load for analysis, and a new `start` refuses them. E358's development package
is unchanged.

## Stall policy (`stallResubmissions: 1`)

A submission is a **stall** when it is killed at its timeout and returns no
answer. Other transport failures are not stalls.

The pilot selection now allows one resubmission per stall:

- The stalled submission is kept with outcome `stall` and consumes no
  correction.
- The identical prompt bytes are resubmitted once with role
  `resubmitted-after-stall`.
- A second consecutive stall on the same attempt halts the sequence as a
  transport failure, as before.

Results count `stalls` and `stallResubmissions`. A run whose initial attempt
stalled and whose resubmission then passed still counts as a first-attempt
pass. This follows D58: retries are reported, not hidden. The policy is part
of the selection, so it is pinned in the plan hash. Plans without the field
keep the earlier halt-on-any-transport-failure behavior.
