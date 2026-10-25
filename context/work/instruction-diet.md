---
title: Instruction diet — evidence of ceremony drift and remediation
kind: brief
state: next
updated: 2026-10-24
---

# Instruction diet

**Item:** [DIET](../BACKLOG.md). **Goal:** cut the instruction and artifact
load so a session spends its effort on the work item, not on the apparatus
around it. Keep the rules that protect the Bitwig host. Another agent reviews
the result.

## Why this item exists

The user noticed that sessions drift back into excessive rigor and ceremony.
The review of 2026-10-24 measured the context tree, the recent commits, and
the instruction files to test that feeling. The numbers confirm it and point
at two causes: explicit instructions that demand the ceremony, and the mass
of artifacts written in that register, which new documents copy.

## Evidence

Measured on 2026-10-24 at commit `cbe99349` plus the staged wave-4 set.
The commands are in the last section so a reviewer can rerun them.

| Measure | Value |
|---|---|
| Words under `context/` | about 1.1 million: archive 211k, evidence 498k, plan 326k, decisions 33k, contracts 31k |
| Plan files | 262, of which 61 are still marked `active` or `planned` (36 under `plan/overlap/`, 11 under `phase-8/`, 4 under `phase-10/`, 3 under `phase-5/`, 2 each under `phase-9/` and `dogfooding/`, 1 each under `phase-7/`, `phase-11/`, and `ROADMAP.md`) |
| Required reading linked from NOW | about 35,000 words; the performance ledger is 22,926 of them |
| Ledger "model before implementation" sections | 15, one per 9b sub-session, each an essay added to a contract document |
| Last 40 commits | 32,139 lines of context Markdown added against 37,775 lines of code; 9 commits contained no code |
| Evidence records | 393; the last 60 have a median of 1,090 words; E343 has nine sections including "Review fixes" and "Retrospective" |
| AGENTS.md | 1,085 words, 26 hard imperatives ("do not", "never", "must", "always", "only", "required"), 24 per 1,000 words |
| context/README.md | 1,106 words, 12 hard imperatives |
| Hedge density in wave-4 planning documents | decisions.md 8.3, verification.md 9.8, simplification.md 7.2 hedges per 1,000 words ("does not authorize", "is not proof", "no runtime change", and similar) |
| Wave 4 output | 14 artifacts, about 17,000 words, an HTML report with a build script and browser checks at three viewport widths, to record 25 decisions |
| Frontmatter `state` field | present in every active file; read only by `check.rb`, and only to enforce a Phase 1 rule that is years stale |
| Session briefs themselves | small: 8i19 is 412 words, 8i20 is 632 words, with six acceptance bullets |

The briefs are not the problem. The weight is in the apparatus around a
brief. An implementation session today must honor at least seven rule
sources: AGENTS.md, context/README.md, the ledger rules, the migration risk
policy, the capability-page rules, the tool-maintenance checklist, and
D15/D53/D54. It must then produce an E record, a ledger model section, a NOW
handoff, index rows, tool counts in three documents, and a retrospective.

## Symptoms of over-instruction

- **Protocol where a loop would do.** AGENTS.md "Implementation sessions"
  prescribes six numbered steps with sub-bullets. Each step names documents
  to read, update, or create. The steps apply equally to a one-line fix and
  to a live host change.
- **Rules attached to data.** The performance ledger is a table of measured
  costs with a rules section and 15 pre-implementation essays. The essays
  were written because the ledger rules asked for a model before each live
  change; they are rarely read again.
- **Records for everything.** "Use E records for measured results" is read as
  "every session writes an E record". Nine-section records with retrospectives
  are the norm. Capability pages, the designed "current reading", number eight.
- **Register copying.** Planning documents hedge one sentence in ten because
  every document the agent reads hedges that way. The proof-level vocabulary
  that protects host claims is applied to planning prose where no claim is
  being made.
- **Unconsumed structure.** Frontmatter `kind` and `state`, phase numbering,
  session numbering (9b.6j), and index rows are maintained by hand and consumed
  by no tool except one stale check.
- **Planning that produces planning.** Wave 4 was asked for decisions and
  produced a decision-session plan (W4-A to W4-D) whose last step was to plan
  the implementation sessions.

## What to keep

The rigor that protects the host is a small part of the total and earns its
cost. Keep:

- Live-work rules: deployment and controller replacement by the operator,
  `probe:hello` before live work, one live writer, selection protection,
  input validation, independent post-write readback (D15), the uncertain-write
  latch and no-retry rule, scratch cleanup, and ordinary consent (D53).
- The call-budget tests and the ledger's cost table as a regression check.
- Tool-description versioning and its public artifact.
- D records for durable design decisions; E records for a measured host fact
  worth citing later.
- The wave-3 capability matrix and evidence as reference data.

## Remediation

1. **Rewrite AGENTS.md** to the host-protecting rules above plus a four-line
   work loop: take the top item in [BACKLOG](../BACKLOG.md), write or refine
   its brief in `work/`, do the work, record the result in the same brief and
   close the item. Target under 500 words. Drop the six-step protocol, the
   review-session protocol, and the retrospective instruction.
2. **Shrink context/README.md** to reading routes, authority order, and the
   documentation check. Move the tool-maintenance checklist into the one
   place the code needs it (a comment at `TOOL_DESCRIPTION_VERSION`) or into
   the brief template.
3. **Retire the E-record default.** A closed brief is the record of its item.
   Write an E record only for a measured host fact that later work will cite.
   Replace ledger model essays with one budget row per changed path; move the
   15 existing essays to the archive.
4. **Drop frontmatter `state`** and the Phase 1 rule in `check.rb`. Keep the
   broken-link check. The backlog table is the status.
5. **Archive the 61 unfinished plan files in one move.** Mark each
   `historical` with a one-line pointer to the backlog item that absorbed it,
   or move it under `archive/plans/` where no active document links to it.
   Wave-3 data and reports stay as evidence.
6. **Write briefs in plain register.** A brief states the goal, the steps,
   the acceptance, and the result. It does not list what it does not do.
7. **Add a 200-word brief template** under `work/` so new briefs copy a
   small example instead of a large one.

## Acceptance

- AGENTS.md under 500 words; context/README.md under 600 words.
- A new session can start from NOW, BACKLOG, and one brief, with no other
  required reading unless the brief names it.
- `check.rb` passes without the `state` rule; no active document links to a
  file marked historical as if it were current.
- No live-work rule listed under "What to keep" is weakened. The reviewer
  checks this explicitly.

## Reproducing the measurements

```sh
for d in context/*/; do printf '%s %s\n' "$d" "$(find "$d" -name '*.md' -exec cat {} + | wc -w)"; done
grep -rl -E "^state: (active|planned)$" context/plan --include='*.md' | wc -l
git log -40 --format='%h' | while read h; do git show --numstat --format= $h; done \
  | awk '$3 ~ /^context\/.*\.md$/ {c+=$1} $3 ~ /^(brain|extension)\// && $3 !~ /\.(json|md)$/ {k+=$1} END{print c, k}'
ls context/evidence/experiments/*.md | sort -V | tail -60 | xargs wc -w | sort -n
grep -o -i -E "do not|never|must|always|only|required" AGENTS.md | wc -l
grep -c -E "^## .*model before implementation" context/contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md
```
