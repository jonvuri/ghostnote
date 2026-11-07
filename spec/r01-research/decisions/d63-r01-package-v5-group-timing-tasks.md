# D63 — R01 package v5: targeted group-timing tasks

Date: 2026-10-27. Status: accepted by the operator (the brief's
[package v5 draft](../../../context/work/r01-format-comparison.md#resume-development-runs),
approved after E373).

R01's core open question is C3 (explicit onsets with shared group context)
versus C4 (group-local rows with derived onsets). After
[E373](../../../context/evidence/experiments/e373-r01-package-v4-three-repeat-development-pass.md)
it rested on 12 runs per arm per cohort. The performed-task arms were at
Haiku's ceiling, and further across-the-board hardening would push Luna to the
floor. Package `pilot-development-v5` therefore adds four source-cohort tasks
whose difficulty comes from operations whose cost depends on the format:
reading derived onsets, converting explicit onsets into a decomposition,
moving timing ownership and recomputing onsets in two groups.

## Package v5 (`pilot-development-v5`)

Package v5 is v4 unchanged plus `p13`–`p16`, under task revision 5 (rules
schema `r01-pilot-task-rules-v4`). Inputs (v2), prompt revision 2, the cards,
scoring (D59), feedback and every v4 cell and prompt are byte-identical. Each
new task is synthetic, seeded from `r01-pilot-synthetic-v1` under new draw
domains (`p13-v5` to `p16-v5`), and eligible on C3 FIELDS and C4 FIELDS
(primary) and C3 JSON, C4 JSON and detached C4 FIELDS (diagnostics).

| Task | Operation | Fixture |
|---|---|---|
| `p13-read-derived-window` | Return `{"ids": [...]}`: every note whose performed onset is in [X, Y), in ascending onset order, ties by ID. | Three timed groups (5, 4 and 5 members), a timing-free group with two untimed notes and one timed member, three loose notes. X and Y are derived onsets of the third member of the first and third groups, so omitting the common delay moves a note across each bound. A loose note shares a timed member's onset. 12 notes are in range. |
| `p14-group-existing-notes` | Five loose notes become one new timed group appended after an existing one, with stated id, label, provenance, anchor, delay and performanceOrder; the model chooses spreads so that every onset is unchanged. | The delay is an odd multiple of 1/128 and the onsets are on 1/512, so spreads need subtraction at mixed denominators. |
| `p15-move-member-between-groups` | Move one note from timed group `dStrum` to `uStrum` at a stated spread, appended to its members and performanceOrder, and removed from `dStrum`. | The note also belongs to a timing-free group and must stay there. Its onset follows the target equation. |
| `p16-retime-two-groups` | Move one group's anchor later by an odd multiple of 1/16 and double the other group's spreads. | A timing-free group holds one member of each and an untimed note; a loose note lies between the groups. Neither may move. |

**Note-array order equals C4 block traversal** (timed groups, then notes
homed in timing-free groups, then loose notes) in every input and expected
state. Source scoring compares note-array order exactly, so a fixture whose
order differed would force C4 to add `order` cells or C3 to reorder rows.
Neither is the trade-off under test. p15's group order (target before source,
moved note first in the source) satisfies this rule without reordering.

**Wrong answers.** The rehearsal adds 30 task-specific variants (7–8 per task),
covering every misreading in the draft table plus a few more: exclusive lower
bound and ties in note order (p13), the new group inserted first (p14), the
onset taken from the source group's equation (p15) and an untimed group member
moved (p16). Every variant is a valid fixture or answer, so each rejection is
a semantic mismatch. "Onset unchanged" in p15 is expressed with a consistent
derived spread, since an inconsistent one does not parse.

## Counts

Per repeat: 16 tasks, 120 scheduled cells, **87 eligible** (67 + 20) and **33
exclusions**. The brief's draft said 17 exclusions; that figure omitted the
four excluded arms (two current-document, two Producer Pal) of each new source
task. Three repeats give 261 initial runs and 783 maximum submissions per
cohort. The [execution manifest](../../../context/evidence/data/r01-pilot-inputs/v5/execution/manifest.json)
pins the package and both cohorts' order. Its rehearsal accepts all 87 goldens
and 81 unreduced respellings, rejects all 568 wrong answers and 81 gratuitous
refusals, and lists no non-distinguishing variant. 236 focused tests pass.

Packages v1–v4 are retired for new starts and still load for analysis; the
retained v4 execution manifest regenerates except for its source-file hashes.

## Calibration and tuning

The calibration target on the new tasks is Haiku about 80–90% and Luna about
40–60% on the first attempt. At most one revision (package v6) is allowed if
the one-repeat check falls far outside that band or a wording or scorer defect
appears. The optional fifth task (larger authoring with a six-member group
sharing members with a timing-free group) is not included.
