---
title: ghostnote context guide
kind: index
state: active
updated: 2026-08-10
---

# ghostnote context

Start here. The context tree separates current truth from plans, evidence, and
history so an agent does not have to reconstruct authority from chronology.

## Reading routes

| Goal | Read, in order |
|---|---|
| Continue implementation | [NOW](NOW.md) → active session brief → cited decisions |
| Understand the product or architecture | [PROJECT](PROJECT.md) → [decision index](decisions/INDEX.md) |
| Investigate a Bitwig capability | [capability index](evidence/capability/INDEX.md) → subject page → cited experiment |
| Find what one experiment measured | [evidence index](evidence/INDEX.md) → named experiment |
| Work on the `.bwpreset` byte format | [format spec](evidence/format/BWFORMAT_SPEC.md) → [bwmod design](evidence/format/BWMOD_DESIGN.md) |
| Review the roadmap | [roadmap](plan/ROADMAP.md) → relevant phase README |
| Audit how the design evolved | Current decision → cited evidence → [archive](archive/README.md) |

## Authority order

When documents disagree, use this order:

1. `NOW.md` for current execution state only.
2. Individual files in `decisions/` for settled design.
3. Active briefs in `plan/` for work scope and ordering.
4. Pages in `evidence/capability/` and `evidence/format/` for the **current
   reading** of a measured fact.
5. Files in `evidence/experiments/` for **what one run measured on one day**.
6. `archive/` for historical rationale, never current instructions.

⚠ Rows 4 and 5 are one axis split by purpose, and the order between them is
deliberate. An experiment file is a frozen record and cannot carry supersession.
A capability page is rewritten in place when a newer measurement changes the
reading, and it records what it superseded. When the two disagree, the capability
page is the current reading — and it must cite the experiment it re-reads.

⚠ A capability page never overrides a `decisions/` file. If the two disagree,
that is a decision review and it belongs to its own session.

Compatibility files at `DECISIONS.md` and `spike/FINDINGS.md` exist for older
references. They route to the canonical indexes and are not ledgers anymore.

## Maintenance rules

- Keep `NOW.md` short and update it when a session starts or closes.
- A plan describes unfinished work. On completion, move it to `archive/outcomes/`
  and promote durable facts into a decision or evidence file.
- Do not append corrections to obsolete plans. Archive them and update the
  authoritative document.
- Preserve D- and E-identifiers. New entries get new identifiers.
- Use relative Markdown links for navigable references.
- Never edit an experiment file to record a newer reading. Rewrite the
  [capability page](evidence/capability/INDEX.md) instead, and follow the four
  rules stated there. In short: cite every claim and tag it `[K]`/`[I]`/`[U]`;
  rewrite a page in place when it is superseded and record what it superseded;
  admit an unprobed observation at `[I]` only with an observer, a date and the
  probe that would settle it.
- Add a capability page only when something measured stands behind it. An empty
  page is a claim that the subject is understood. This axis needs no plan of its
  own — extend it whenever a session measures something.

