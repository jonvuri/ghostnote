---
title: Second 8i trial interface review
kind: reference
state: active
updated: 2026-10-09
parent: 8i-agent-native-hybrid-dogfood.md
---

# Second 8i trial interface review

The 2026-10-09 bass and sound trial passed the operator's musical verdict.
The agent made 52 Ghostnote call attempts: 19 for the first draft, 7 for
the rhythm revision, and 26 for sound design. Prompt-to-result times were
about 122 s, 41 s, and 96 s. These exclude waits for feedback. The count
includes one MCP argument-validation failure and the six calls in a loop.

Source: `codex://threads/01a11e47-4319-7050-99b3-f90f47cac6ad`. The local
transcript is `rollout-2026-10-09T09-29-09-01a11e47-4319-7050-99b3-f90f47cac6ad.jsonl`.
Line numbers below refer to that transcript. Inputs and outputs establish
the sequence. Causes attributed to agent intent are inferences: the
transcript has no readable reasoning summaries.

The two reproduced product failures are scoped in
[8i5](8i5-device-control-identity.md). The operator also included clear witness
failure results and first-read Patch guidance in that session. The other
candidates below remain review results, not approved product changes.

## Repeated clip reads

Initial discovery read the drums and both chord clips in one batch (line
37). The printed MCP envelopes were truncated at 11,577 original tokens
(line 42). The next call reread the eight-bar chord clip and printed only
EVENT rows (line 46). This sequence supports truncation as the cause of
that repeat. The chord document alone was 17,539 UTF-8 bytes. Printing the
whole MCP wrapper added escaping around its FIELDS text. The complete
document is correct; the agent's presentation made it costly to use.

During the revision, the first fresh bass read (line 125) was necessary:
the clip had changed by an octave since the earlier turn. It returned a
new base and 28 new event IDs. The agent then requested `reference:["Patch"]`
with another read (line 133). It stored the whole result but printed only
its `reference` string. It then read again to print and store `authority`
(line 140). All three reads returned the same clip content for this turn.

The reference request necessarily reads the clip today. The third read
was unnecessary: the stored second result already held the document and
authority. The edit description also states that the edit rereads the clip
and refuses a changed base. It did not require those repeats.

Included in 8i5: make the read description say that optional reference sections
come with the same document and base. Recommend requesting Patch on the
first read for an edit. Keep all three values in one agent-side projection.
Do not add another reference tool or omit document fields on this evidence
alone. The existing full read and preservation contract must stay clear.

## Preset inspection and modulator discovery

The agent read both remote and direct controls (line 172). The remote
result already exposed resident AHDSR controls and filter modulation.
It then inspected the saved Juno preset with `path` (line 181). That
argument belongs to preset insertion; this read requires `presetPath`.
The validation error named both the missing key and the extra key, and
the next call corrected it. The schema was correct. The agent had read a
short tool summary but had not printed this tool's full declaration.

The valid preset inspection returned only an unsupported semantic mapping
and a fingerprint (line 191). This read was a reasonable attempt to learn
the existing modulation, but it reads a saved file, not the live device.
The descriptions distinguish those objects. The unsupported result gives
no location-specific cause or useful next action.

The agent requested the modulator catalog and tried `ahdsr` in the same
exec script (line 195). The catalog states that AHDSR is excluded and
explains its two-page ambiguity. The attempted wrap nevertheless ran
before the agent could inspect that result. The refusal named the
unsupported type. On the next model round trip the agent selected `adsr`.
A resident modulator name does not imply a supported authoring type.
The catalog already lists supported types before excluded types. The wrapper
schema already says to use a type from `list_modulator_types`. This was not
a missing catalog warning; the script did not branch on its result.

Candidates: state the `presetPath` argument and saved-file scope near the
start of the preset read description. Distinguish resident names from public
authoring type IDs in wrapper guidance. Keep the supported catalog list first.
Give unsupported preset results the known cause and a scoped next action when
the implementation can establish one. Do not infer a mapping from the
resident page names. Do not hide excluded-type reasons; they explain limits.

## Manual behavior samples after the partial wrap

The ADSR wrap returned `complete:false` after its structural writes (line
206). Its nested behavior result says that the DirectParameter has no
modulated value and matches no supplementary remote name. It contains
zero samples. The top-level explanation says only that a post-move witness
failed. The result includes reversal guidance, but no supported proof
retry or clear boundary between unavailable observation and inactive
modulation. The description promises active-modulation proof without
stating this witness limit.

The agent correctly reacquired structure and both device control views.
It later sampled `Overview/Filt Freq` through six full remote inventories
(line 245). These calls used about 4.8 s, derived from the 7.3 s exec
duration minus the 2.514 s Blur write. That is an approximate wall-time
cost. The samples were printed, but neither base values nor automation
states were retained in that projection. Existing filter modulation was
already visible before the wrap. These samples do not replace its proof.

This is mainly recovery work caused by issue #2. 8i5 should report witness
availability and its identity at the top level, then distinguish structure,
scalar preservation, assignment, and target activity. Keep the detailed
evidence and reversal checkpoint. State the valid next action. Do not add
a general sampling tool to compensate for this failure. Measure remaining
sampling demand after the identity repair.

## Large discovery output

The first exec printed every matching tool's complete description and
declaration (line 16). Its result was truncated at 19,892 original tokens
(line 19). The next exec printed a compact tool index and full declarations
for only the chosen tools (line 21). Narrow discovery was already possible.

Candidate: keep purpose and selector guidance at the start of descriptions.
Use a compact index and inspect only the needed declarations. Preserve
the Core format reference; it enabled valid FIELDS with no repository
tutorial. A shorter optional catalog view may help, but this run does not
justify a new discovery tool or a broad description rewrite.

## Calls that were justified

- A fresh read after operator feedback detected changed pitches and supplied
  the new base. Reusing the earlier document would have been wrong.
- Direct controls supplied the exact target ID for wrapping. Remote controls
  supplied the preset macros. Neither view alone supplied both jobs.
- Reads after the partial structural change supplied the new nested route.
- The post-write control read supplied physical display values. Successful
  control writes return compact receipts, not the complete control inventory.
- Checking the original clips supported the claim that existing material
  stayed unchanged. Checking the bass after sound design supported the claim
  that MIDI stayed unchanged.

## Follow-up priority

Priority order and expected benefit:

1. Fix the witness and clarify failure results in 8i5. High likelihood of
   benefit: the failed witness prompted six manual sample calls.
2. Add first-read Patch guidance in 8i5. Medium to high likelihood of benefit:
   one result can supply the document, base, and help used by three reads.
3. Reduce large discovery dumps. Medium likelihood of benefit: narrow
   discovery already exists, so the change depends mainly on agent guidance.
4. Improve unsupported preset results and argument guidance. Medium to low
   likelihood of benefit: the schema already gave a clear validation error.
5. Clarify resident names and authoring type IDs. Low likelihood of benefit:
   the catalog warning was already clear, but the agent did not inspect it
   before the attempted write.

These are estimates, not measured improvements. Include a fresh agent trial
for Patch guidance in 8i5. Measure repeated reads, refusals, output bytes, and
model round trips. Trial the remaining candidates only with a separate scope.
Keep the groove and overlay dependency trial gates open.

## Retrospective

Inspect both tool output and the agent's printed projection before calling
a repeat waste. A response can contain the needed state while the projection
hides it. Record which calls repair a product failure before proposing a
new tool for them.
