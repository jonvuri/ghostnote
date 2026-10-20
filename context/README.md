---
title: ghostnote context guide
kind: index
state: active
updated: 2026-10-19
---

# ghostnote context

Start here. The context tree separates current truth from plans, evidence, and
history so an agent does not have to reconstruct authority from chronology.

## Reading routes

| Goal | Read, in order |
|---|---|
| Continue implementation | [NOW](NOW.md) → active session brief → cited decisions |
| Find Phase 8 dogfood results and fixes | [dogfood archive](archive/outcomes/PHASE-8-DOGFOOD.md) → result and related session |
| Run a new dogfood trial | Selected session brief → [reusable runbook](plan/phase-8/8i-automated-dogfood-runbook.md) |
| Find earlier dogfood runs | [first loop history](plan/dogfooding/README.md) → run ledger |
| Understand the product or architecture | [PROJECT](PROJECT.md) → [decision index](decisions/INDEX.md) |
| Apply the Phase 8 product posture | [agent-native interface audit](evidence/format/AGENT_NATIVE_INTERFACE_AUDIT.md) → relevant Phase 8 brief |
| Investigate a Bitwig capability | [capability index](evidence/capability/INDEX.md) → subject page → cited experiment |
| Find what one experiment measured | [evidence index](evidence/INDEX.md) → named experiment |
| Work on Document 1.0 or cache integration | [specification](../spec/ghostnote-document-v1/SPEC.md) → [host binding](../spec/ghostnote-document-v1/HOST-BINDING.md) → [identity and overlays](../spec/ghostnote-document-v1/IDENTITY-AND-OVERLAYS.md) → [cache contract](contracts/GHOSTNOTE_CACHE_CONTRACT.md) → [migration and risk policy](contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md) |
| Plan, change, or review the cost of a live path | [performance ledger](contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) → cited experiment → call-budget tests |
| Work on the agent musical language | [language reference](evidence/format/AGENT_MUSICAL_LANGUAGE.md) → cited evidence → Phase 7 plan |
| Implement or audit a workstation module | [contracts](evidence/format/WORKSTATION_CONTRACTS.md) → [inventory](evidence/format/WORKSTATION_INTERFACES.md) → [seam blockers](evidence/format/WORKSTATION_SEAMS.md) → [verification costs](evidence/format/WORKSTATION_VERIFICATION.md) → named Phase 7 brief |
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
6. Archived documents for historical rationale, never current instructions.
   This includes records marked historical at their original paths.

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

- Keep primary specifications, schemas, and examples in the top-level `spec/`
  directory. Use `context/` for working memory, plans, decisions, and evidence.
- Keep `NOW.md` short: the next session, current deployment, relevant fixture
  state, and essential cautions. Link to procedures and history. Update it when
  a session starts or closes.
- A plan describes unfinished work. On completion, archive it and promote
  durable facts into a decision or evidence file. Use `archive/outcomes/`, or
  mark it as historical at its existing path and link it from an archive index
  when stable links matter. Historical procedures are not current instructions.
- Do not append corrections to obsolete plans. Archive them and update the
  authoritative document.
- Preserve D- and E-identifiers. New entries get new identifiers. Use E records
  for measured results and D records for durable design decisions. Routine
  planning and documentation cleanup need no new record.
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

## Documentation checks

Run `LANG=en_US.UTF-8 ruby context/check.rb` and `git diff --check` for context
edits. Check changed section links and new archive links separately: the context
checker omits files under `archive/` and does not validate heading anchors.
A reviewed spec, codec, or migration contract change also runs
`python3 context/contracts/check-publication-candidates.py --write`, followed
by the same command without `--write`.

## Tool maintenance

For a tool addition or description change, update the affected consumers in the
same session: server tool list, profile inventory, document-help consumers,
description version and public artifact. Update tool counts in
[PROJECT](PROJECT.md), the [workstation interfaces](evidence/format/WORKSTATION_INTERFACES.md),
and the [migration contract](contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md)
when the count changes. Follow [AGENTS.md](../AGENTS.md) for version reporting.

Implementation references for the relevant change:

- New write tools use `readbackStatusOf` and `readbackOrUnavailable`, with a
  case in `brain/src/surface/readback-unavailable.test.ts`. `unavailable`
  means a failed read only; a successful unequal read is `differs` ([E258](evidence/experiments/e258-selection-effects-and-unavailable-readback.md)).
- Add selection-moving operations to `movesMixerSelection` and the fake. A
  two-change tool uses one `withSelection` scope (E258). Keep owned cursor
  tracks pinned ([D43](decisions/d43-owned-cursor-tracks-stay-pinned.md)).
- Use the [D44 limits](decisions/d44-long-writes-are-optimized-then-bounded.md)
  before a write. Mixer volume is raw: dB = 60·log10(raw); writes use `setRaw`
  ([D48](decisions/d48-track-mixer-writes-host-raw-values.md)).
- Revert device adds newest first with `next.revert.changeIds`. The other order
  refuses `target-changed` ([E264](evidence/experiments/e264-device-add-revert-report.md)).
  The [D49 decision](decisions/d49-revert-fidelity-states-what-the-revert-restored.md)
  defines fidelity and removed-object reports.
- Before retiring a wire method, search the advertised drivers in
  `brain/src/probes`. `slot.duplicateClip` is probe-only. Historical normal
  drivers use `NORMAL_8I15` and `assertCurrentNormal`; [E272](evidence/experiments/e272-8i-gate-close-out.md)
  records that build. Read the selected driver's profile requirements before
  use; NOW identifies the current deployment.
- For MIDI and document files, use the
  [conversion contract](contracts/MIDI_FILE_CONVERSION.md). Its rules cover
  FIFO pairing, tempo maps, snapshot coverage, file formats, and verification.
