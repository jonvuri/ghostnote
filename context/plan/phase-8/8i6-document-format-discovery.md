---
title: Phase 8i6 document format discovery and repair
kind: plan
state: done
status: Complete (E255). Document inputs state the format and carry a valid example; get_document_reference returns the reference and templates with no host call; a refused document returns detail.repair. Five fresh agents had no format rejection in the normal trials. Descriptions v41.
updated: 2026-10-09
parent: README.md
prev: 8i5-device-control-identity.md
next: 8i7-track-mixer.md
evidence: E255
---

# Phase 8i6 document format discovery and repair

Make Ghostnote Document 1.0 clear and usable from every tool that accepts
it. Test all three changes: local examples, format repair guidance, and
reference access without a live clip. Do not require a skill.

## Evidence and scope

Source: `codex://threads/01a11ec6-934b-7202-86c1-88336643bd8b`.
The local transcript is
`rollout-2026-10-09T11-48-12-01a11ec6-934b-7202-86c1-88336643bd8b.jsonl`.
Lines below refer to that file.

The agent printed every matching tool description (line 16). The result
omitted 10,535 of 20,535 reported token units (line 18).
It then printed first-paragraph
summaries (line 20) and selected full descriptions (line 38). It selected
the edit description, but not the read description with the Core reference.
Its 42 Ghostnote calls included 16 rejected clip writes. Two UI edits
supplied format examples. All four final clip writes passed readback.

The add and edit descriptions name the custom format but supply no syntax
example or direct reference instruction. A snapshot is not a desired
template: the observed field list does not satisfy desired coverage.
Fix that boundary without changing the grammar or accepting guessed input.

## Dump size check

The first dump retained 10,000 reported token units and omitted 51.3
percent. Truncation kept the start and end, with a gap in the middle.
It removed 19 complete tool records and parts of two more. The complete
edit and read clip records were inside the gap, including the Core reference.
The add record remained visible but held no syntax example.

A reconstruction from the current callable metadata is 82,137 bytes.
Its first and last 20,000 bytes exactly match the recorded retained ranges.
The reconstructed gap is 42,137 bytes. The original middle is not stored
in this result, so this byte count uses current metadata. The reported
token counts are the tool's counts, not an independent model tokenization.
The earlier bass trial also retained 10,000 units: it omitted 9,892 of
19,892, or 49.7 percent (line 19 in that trial's transcript).

Fitting the full dump into this limit needs about half the output removed.
Raising the output budget can prevent truncation but keeps the discovery
cost. Do not depend on either change for format access in this session.

## Entry reads

- [8i charter](8i-agent-native-hybrid-dogfood.md),
  [earlier interface review](8i-trial-2-interface-review.md), and
  [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md).
- `spec/ghostnote-document-v1/MODEL-REFERENCE.md` and its identity file;
  the codec parser, error types, fixtures, and artifact generator.
- `brain/src/surface/agent-native.ts`, `agent-native-edit.ts`,
  `agent-native-clips.ts`, `agent-native-result.ts`, `description-cohort.ts`,
  the profile registration, and their tests.

## Work

1. Add a short format statement near the start of each document input
   description and its parameter guidance. State that this is Ghostnote's
   custom format and name the reference tool. Add a minimal valid desired
   example to `add_launcher_clip` and a minimal valid patch example to
   `edit_launcher_clip`. State `EVENT`, integer velocity, exact fractions,
   and complete desired coverage with `fields:"all"`. Explain that FIELDS
   and JSON encode the same Ghostnote schema; JSON is not an arbitrary note
   object. Derive examples from the maintained reference and validate them
   with the codec. A patch example must show where the live BASE comes from.
2. Add `get_document_reference` as a pure read tool in `agent-native-v1`.
   Return Core by default and selected optional sections: Patch, Timing
   overlays, Groups, and Meter and tempo. Include the format, reference
   revision, hash, and validated templates. Supply FIELDS and canonical JSON
   examples by encoding selection. Make it work when Bitwig is disconnected
   and when no clip exists. It returns no live BASE, IDs, permission, or
   interpretation. Keep optional help with a fresh clip read for edits.
3. Add bounded repair guidance to document-input failures. Keep the original
   rule, path, line, column, and no-write status. Cover unknown `NOTE` or
   bare rows, missing FIELDS, decimal timing, noninteger velocity, invalid
   JSON envelope, missing coverage, and snapshot coverage used as desired
   coverage. Return the known correction and the reference tool/section.
   Give a complete minimal template when that is the useful correction.
   Do not echo a whole input, guess a correction, or silently coerce it.
4. Keep one source for the reference, templates, and version identity.
   Update descriptions and the public description artifact in this session;
   bump `TOOL_DESCRIPTION_VERSION`. Keep `stable-v1` frozen. Audit each
   public document input so no consumer lacks a route to its format help.
5. Test each intervention separately with offline fixtures. Then run fresh
   agent trials with all three enabled and no skill or tool-sequence coaching.
   Include creation in empty slots and a sparse edit of existing material.
   Start one creation trial with only the add declaration available. In a
   repair trial, supply a malformed document and check one corrected retry.
   Use owned fixtures and preserve accepted musical projects.

## Cost model

The reference tool and codec-input repair use zero host turns, zero cold
reads, and zero write stages. A typical reference returns Core and one
template; the largest admitted request returns all five sections and the
selected encoding's templates. Bound output by the maintained reference
size. Measure output bytes and tokens for both cases. Keep no per-call
reference copy in the clip registry; shared reference memory is bounded by
the artifact size.

Valid add and edit calls keep their existing host budgets and heap limits.
The ledger's one-read plus 16-note insert is 1.79 to 1.83 s; its largest
whole-clip edit is 6.59 s. These are live costs, unlike pure help. Check the
call budgets. If a successful live path changes, rerun its typical and
largest admitted measurement and explain a regression above 20 percent.

## Acceptance criteria

- Each document consumer identifies the custom format and provides a direct
  reference route. Add and edit each contain a valid local example.
- Reference access works without Bitwig, clips, or host calls. Every
  template parses in its declared encoding and matches the source revision.
- Each listed malformed-input case returns a specific, bounded repair and
  performs no host read or write. Rule codes and refusal behavior stay valid.
- Fresh agents create and patch clips without filesystem reference searches,
  UI edits to learn syntax, or format guessing. A format-related rejection
  in the normal trial requires another revision and trial, not a pass.
- Record discovery output, truncation, references requested, failed attempts,
  host calls, UI actions, and completion time. Use the 42-call, 16-rejection
  trial as context, not as a matched performance comparison.
- Codec, surface, description-artifact, profile, and call-budget tests pass;
  `npm run check`, `LANG=en_US.UTF-8 ruby context/check.rb`, and
  `git diff --check` pass. Valid live writes pass independent readback.
- Add the E record and index row. Update the charter, ledger where needed,
  and NOW. Stage session changes only; do not commit. Report the new
  description version and a suggested commit message.

## Retrospective

Check the agent's printed projection before attributing missing help to the
tool result. Record whether local examples, repair guidance, and reference
access were each used. Revise instructions only when a trial shows a gap.

## Out of scope

Skills, a generic tool-discovery API, broad description shortening, codec
grammar changes, mixer controls, and the remaining groove/overlay gates.

## Outcome

- Format statement and local examples: met. Each document consumer names
  Ghostnote Document 1.0 and `get_document_reference`; add and edit carry a
  valid desired or patch example that the codec checks (E255).
- Reference access: met. `get_document_reference` returns Core and the
  selected sections, the identity, and the templates in FIELDS or JSON, with
  no host call (tested with a host that refuses every call).
- Repair: met for every listed case, with no host call and the rule and
  location kept. A repair names the first codec error only.
- Fresh agents: five `codex exec` trials, no skill or tool-sequence coaching.
  No format rejection in the normal trials; T2 created a clip with only the
  add declaration; the repair trial needed one retry. No UI edit and no
  filesystem search.
- Live: the templates write and read back through the unchanged add and
  edit paths; valid budgets unchanged.
- Checks: 2,182 brain tests, `npm run check`, description artifact v41,
  `context/check.rb`, and `git diff --check`.
