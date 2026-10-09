---
title: Phase 8i9 overlay authoring and creation
kind: plan
state: done
status: Complete (E256, D47). Timing example and templates, claim repair, and claims on clip creation; descriptions v42. The operator's fresh-client trial passed.
updated: 2026-10-09
parent: README.md
prev: 8i6-document-format-discovery.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E253, E255, E256; D44, D45, D47
---

# Phase 8i9 overlay authoring and creation

**Complete** ([E256](../../evidence/experiments/e256-overlay-authoring-and-creation.md),
[D47](../../decisions/d47-clip-creation-binds-claims-to-the-live-clip.md)).
The largest admitted case was not one pair per note: the 8 MiB input bound
admits 6,641 pairs on 16,384 notes, and membership dependencies needed a new
D44 expansion limit. The largest admitted add takes 22.2 s live. The
operator trial in the
[charter](8i-agent-native-hybrid-dogfood.md#operator-overlay-trial) passed:
one add with 64 claims, and the expected claim states after hand edits.

Make timing overlays usable from the MCP tools alone. Keep detailed examples
in requested reference results. Add only short, necessary changes to tool
descriptions. The operator will run the fresh-client trial after this session.

## Source and observed failure

Source: `codex://threads/01a11f6b-8145-7aa1-83a6-e1ee60dd273e`.
The local transcript is
`~/.codex/sessions/2026/10/09/rollout-2026-10-09T14-48-21-01a11f6b-8145-7aa1-83a6-e1ee60dd273e.jsonl`.
Line numbers below refer to that file.

The task asked for a new Scene 1 bass clip that takes its timing feel from
the Rain Steps drums. It also asked to retain nominal rhythm and timing
offsets, and to identify interpretations affected by later manual edits.
It did not name overlays or a tool sequence.

- The agent requested Timing overlays help (lines 24–28). The reference
  arrived without truncation. It gave field names and equations, but no
  complete nested envelope or timing template. All four dependency arrays
  and their entry shapes were missing from the explanation.
- The edit description supplied the basis-sealing rule (line 43). The agent
  overlooked it and searched the repository before its first overlay write
  (lines 40–85). No malformed nested overlay was submitted first.
- The add call created an empty 32-beat clip, then refused the content
  because overlays needed the live clip ID (lines 133–136). The agent read
  the new clip and completed a guarded edit.
- Readback verified 28 notes and 56 current claims. A dry run changed only
  one note's nominal and groove claims to stale (lines 159–164). This is
  implementation evidence from the transcript. Repository access prevents
  a pure-client pass; a dry run does not prove manual-edit behaviour.

The operator accepted the proposed fixes in the planning thread. The operator
also asked to limit added description prose and reserved the manual rerun.

## Entry reads

- [8i charter](8i-agent-native-hybrid-dogfood.md),
  [8i6](8i6-document-format-discovery.md),
  [E255](../../evidence/experiments/e255-document-format-discovery.md),
  [E253](../../evidence/experiments/e253-overlay-basis-sealing.md), and
  [D45](../../decisions/d45-the-edit-limb-seals-explicit-overlay-claims.md).
- [Performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md),
  D44, the permission and verification contracts, and the current limits.
- `spec/ghostnote-document-v1/`: model reference and identity, R12–R16 and
  R21–R24, host binding, identity rules, examples, and conformance artifacts.
- `brain/src/surface/`: document help and tests, add and edit tools, result
  contracts, description cohort, profile registration, and call budgets.
- `brain/src/bindings/`: overlay sealing, overlay carry, clip edit planner,
  replacement rebinding, and their tests. Also read the document artifact
  generator, live adapter frame test, and existing format-help/live drivers.

## Work

1. Add complete, codec-checked nominal and groove examples to the maintained
   reference. Show `provenance`, `depends`, and type-specific `data` in their
   envelopes. State that `depends.events` and `depends.clips` hold
   `{id, fields}` objects; `depends.overlays` and `depends.membership` hold
   IDs. All four arrays are required, also when empty. Show the groove's
   dependency on its nominal claim and the minimum event fields.
2. Return timing templates only when Timing overlays is requested. Supply
   FIELDS and JSON forms for authored timing with known source values and
   for unknown-source observations with unresolved residuals. Show complete
   patch structure, a fresh BASE substitution, and consistent equations.
   Keep the existing desired and patch templates. Replace the assumption
   that the source has exactly two examples with explicit example selection
   in both the help module and artifact generator. Validate every example
   and template; use generated fixture music.
3. Put a short host-specific basis instruction beside the returned examples:
   `edit_launcher_clip` seals stated current claims whose basis is omitted.
   Retained and stale claims keep their prior bases. Distinguish the host
   input rule from the portable grammar, which requires a basis. Do not
   silently reaffirm a retained claim or accept a supplied wrong basis.
4. Support `add_launcher_clip` with overlays in one public call. Bind the
   proposal's clip ID and all clip references to the newly created clip
   before sealing. Preserve event and overlay IDs and use the existing
   content writer and independent readback. Define how a supplied basis is
   checked across this mapping; never silently replace a wrong digest.
   Keep guarded edit and general replacement protections. Validate known
   input errors before creation. A later host/content failure must retain
   each actual effect and the correct reversal route.
5. Add bounded repair guidance for known overlay structure failures: missing
   dependency arrays, incorrect dependency entry shapes, missing provenance
   or type-specific data, and known-source versus unknown-source timing
   requirements. Keep the first codec rule, path, line/column, and no-write
   status. Point to Timing overlays help. Do not echo the full proposal,
   infer musical intent, coerce input, or change codec error precedence.
6. Update only descriptions and result contracts affected by these changes.
   Prefer replacing vague text to appending text. Keep complete examples and
   lifecycle explanations in requested reference results and repairs; do not
   copy them into every tool description. Record the before/after bytes for
   affected descriptions, the full cohort, Core help, Timing overlays help,
   and all-section help. Report tokenizer counts only if available; bytes
   are not tokens. Explain each description increase. Bump the description
   version and public artifact; keep `stable-v1` frozen.

## Cost model

Reference and input repair: zero host turns, zero cold reads, and zero write
stages. Core requests should keep their current content size apart from
required identity changes. Timing help adds a fixed number of examples; shared
reference storage grows by their size, with no per-clip reference copy.
Compare with E255: Core 4,469 bytes and all sections 9,192 bytes in FIELDS.

Creation should keep the existing add host budget: two write stages (empty
clip, then content), three clip cold reads, and the ledger's adapter calls
`mark 3, tracks 2, read 3, resolve 2, apply 2, delta 4, clipRead 3`.
Each sequential host turn costs about 24 ms; calls in flight together share
a turn. Count actual turns from the wire sequence, not from the adapter total.
ID mapping and sealing should add no host turn or capture. Reversal still
has two change records and two calls.

Use 28 notes and 56 claims as the typical overlay fixture. Compare its host
work with the current 256-note add (E250: 2,158 ms, 77 wire calls). Those
inputs differ; separate fixed host cost from claim planning cost.

The current note reader limit is 16,384; the portable overlay limit is
32,768. Measure creation and reversal with 16,384 notes and one nominal/groove
pair per note, subject to the current document byte and dependency limits.
Check dependency count and graph depth when selecting the largest admitted
case; a pair per note is not proof of the worst dependency graph. Compare
with E248 add-worst (6,418 ms without claims) and E253 planning (6.3 s for
16,384 claims). Do not extrapolate these as measured overlay-add latency.
If the admitted case exceeds the D44 time budget, optimize or add a measured
host input limit with a test in this session.

For N notes, K claims, and D dependency entries, budget additional brain
storage proportional to N + K + D for mapping, sealing, and retained claims.
Avoid repeated full-document copies or per-claim full-state scans. Measure
brain heap at typical and largest inputs. No JVM subscriptions or note writer
width change is planned. Verify host heap and restore owned fixtures; undo
history can retain deleted material. State actual costs in the E record and
ledger. Rerun affected live measurements and explain regressions above 20
percent after a repeat run and per-call comparison.

## Verification and acceptance

- Timing help works with no host connection. Each example parses in both
  encodings, and each template applies to its stated fixture. Host-input
  examples with omitted basis pass the sealing path; their returned documents
  pass the portable codec. Reference revision, hash, and generated prompts
  match. Core does not receive optional examples.
- Creation with nominal/groove pairs succeeds with an agent-chosen clip ID
  and no preceding live clip read. Readback uses the live clip ID throughout,
  retains the proposed note/claim IDs, and returns correct current bases.
  Test nonempty clip and membership dependencies, supplied valid/wrong bases,
  cycles, dangling references, and failures before and after creation.
- Every known malformed-input repair preserves refusal details and makes
  no host call. Repairs stay within the existing 2,048-byte bound. An
  unknown failure keeps the plain refusal; no whole input is returned.
- A structured dependency edit makes only affected claims stale. An unrelated
  edit retains them; removal of claims changes no notes. Test host identity
  loss/removal separately from a structured edit that preserves IDs. Preserve
  D45's existing negative cases.
- Live checks use owned fixtures: both timing modes, add, overlay-only edit,
  dependency edit, claim removal, and reversal. Verify notes and claims
  independently. Restore the baseline and report effects after failures.
  Check current project and selection first; preserve accepted musical work.
- Run `npm run check`, document conformance and artifact checks, description
  artifact/cohort checks, call budgets, the live adapter frame test,
  `LANG=en_US.UTF-8 ruby context/check.rb`, and `git diff --check`. Update
  budgets and ledger only for a deliberate measured change.
- Update host binding for changed creation behaviour. Bump the model reference
  revision when its content changes, regenerate its identity and dependent
  artifacts, and refresh publication candidates after reviewed contract
  changes. Add an E record and index row; add a D record if creation changes
  a settled policy. Update the charter and NOW. Stage only session changes;
  do not commit. Report verification, description version and size change,
  measured costs, and a short suggested commit message.

## Operator trial handoff

Do not run a substitute fresh-agent trial in this session. The operator will
manually repeat the original task after implementation. Give the operator the
active description/reference versions and the required MCP server restart
steps. If the extension changes, follow the repository controller replacement
procedure and wait for confirmation before live checks.

The operator trial uses a fresh client with no repository access and no tool
sequence coaching. Preserve the transcript and record help requests, format
refusals, recovery, calls, and musical verdict. It must also move a note by
hand, then read fresh state: unchanged claims retain their interpretation;
changed or lost identities become stale or lose their claims under the
documented rules. A structured dry run does not replace that observation.
Route NOW to this operator trial at closeout. Keep the charter's groove and
overlay gates pending until that evidence and the operator verdict are recorded.

## Retrospective

Planning finding: the earlier Core/patch trials did not test nested optional
sections. Validate optional examples and input repair directly before the
manual client trial. Record one brief, actionable finding at closeout, or
state that no further instruction change is needed.

## Out of scope

New tools, a generic schema browser, broad description rewriting, portable
grammar changes, automatic groove generation, persistent overlays across
server restarts, mixer controls (8i7), and selection/readback fixes (8i8).
