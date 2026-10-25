---
title: Settled boundaries and remaining implementation choices
kind: plan
state: active
updated: 2026-10-24
---

# Settled boundaries and remaining implementation choices

The broad scope is now sufficient for concrete session briefs. Do not ask the
user to select these boundaries again. The [decision log](decisions.md) holds
the accepted choices; [D54](../../../decisions/d54-recovery-is-not-a-prerequisite-for-requested-edits.md)
makes the recovery floor durable outside wave 4.

## Settled boundaries

| Area | Accepted direction |
|---|---|
| Recovery | Expected effects/loss of the stated tool are acceptable; Ghostnote reversal is generally unnecessary. Simplify D19 machinery when maintenance or performance warrants it. Normal undo, saves, and backups are general recovery, without a new per-path guarantee. Host undo is operator-only; no normal undo tool is exposed (W4-024). |
| Workflow inputs | V01–13 are templates. The user supplies current drum, bass, melodic, harmonic, and other Ghostworks material when each session runs. Ask task-specific acceptance questions at that time. |
| Audio CRUD | Begin with samples in and out of sample-capable devices. An external tool can splice a beat; Ghostnote puts the hits in Samplers in a Drum Machine/rack. Keep slicing/analysis external. |
| Audio readback | Sound-design use: post-device, pre-fader, one existing clip over its full span or a bounded measure/two. Prefer a quick inaudible route. |
| Format | Keep current FIELDS/JSON by default. R01 compares Producer Pal formats, dense claims/overlays, and possible names. No rename or format migration yet. |
| Internal failure | Whole requested tools refuse before mutation when required internal access is unavailable. Track each class and tool/variant. Primary and diagnostic tools remain independently usable. |
| Release | Lightweight release after a few useful cases; clean docs, simple versioning, tested Bitwig versions explicitly listed, no guarantees outside that list. GitHub release assets are the likely delivery route. |

## Examples for functional equivalence

The recovery floor is workable. The part that needs care is what counts as
an expected side effect. A warning about an implementation shortcut does not
by itself make that shortcut the meaning of a narrower tool. The examples
below are recommendations for discussion, not newly selected per-tool rules.
Current explicitly accepted loss contracts remain as implemented.

| Example | Recommended distinction | Choice, if needed |
|---|---|---|
| Delete four named tracks | Their clips, devices, and track-owned automation go with them. A custom inverse is unnecessary. Deleting another track after indices shift is a targeting defect. | No extra preservation contract for the deleted tracks. Keep identity checks for the selected four. |
| Delete five notes | The five notes disappear. Losing pressure on other notes because the implementation rewrites the clip is additional loss, not inherent in note deletion. | Prefer a targeted route. If only a lossy rewrite is available, choose that broader documented operation explicitly; do not silently expand the note-delete contract. Existing D37 whole-clip warnings are unchanged. |
| Move a clip to the chorus | A changed internal ID can be acceptable if content, timing, automation, and meaningful references still work. Dropped automation changes the song. | Is content-equivalent recreation acceptable when no references depend on the old identity? Decide for the route; do not require IDs to match universally. |
| Replace a sample in an existing Sampler | The source changes. Resetting envelope, tuning, modulation, or unrelated pad settings is a broader device reset. | Offer source replacement separately from reset-and-load, or choose which settings the case must preserve. |
| Extract or trim a sample region | Returning a file or changing the selected device's region need not alter the original file used by other pads. | Prefer non-destructive reference/range edits or a new output file. Destructive source overwrite needs its own explicit operation. |
| Agent edits while the user adjusts the same clip | A preflight can become stale during planning. A whole-clip rewrite can overwrite the user's new note. | Default: retain guards or refuse the conflicting edit. A simpler exclusive-edit window is possible if the user chooses it for that session. |
| Internal access fails during a mixed tool | If detected before the first mutation, refuse the entire requested tool. If some changes already landed, they cannot be described as never applied. | Stop and report partial/uncertain effects. Guaranteed rollback would add the machinery just deprioritized. Separate calls are not one transaction. |

These examples keep requested destruction cheap while distinguishing it from
unrequested changes. They do not impose universal exact file or ID recovery.
The relevant session can ask about a concrete boundary when it affects an
actual result; no large advance questionnaire is needed.

## What sample-device depth meant

The phrase referred to how much state inside an audio-bearing device the API
can inspect and change. The initial template is narrow:

1. Accept paths to hits produced by an external splicer.
2. Create or use the needed drum pads and Samplers; assign the hits.
3. Read which source each Sampler uses and return the source file/reference,
   or extract a usable sample when storage requires it and the route supports it.
4. Replace or clear that sample, and set only the region/playback fields the
   task needs. Keep unrelated pad/device state intact.

Advanced multisample key/velocity maps, round robins, wavetable banks, detailed
loop/crossfade editors, or arbitrary plugin-specific sample storage are not
initial requirements. A stored source sample and a rendered post-device sound
are different outputs; V06 handles the former, V07 the latter. Embedded or
inaccessible source data needs a route verdict, not an invented file path.

## Lightweight release

Prepare one tested extension/brain pair, short installation/controller
replacement and connection-check steps, a concise update recipe, known
limits, and the tested Bitwig list. Use simple versions. Make no compatibility
guarantee outside the listed versions. The clean format spec, examples, and
existing codec/CLI can ship with it; choose a public format name in R01.

Use Phase 10b's accepted artifacts and a scoped Phase 10c check set. Review
only the distributed files and their origin/attribution. Do not require HTTP,
a general SDK, broad cross-platform support, standalone bwmod publication,
or every earlier publication candidate. Reconcile the old bwmod-first order
in W4-D. Most likely deliver GitHub release assets; exact asset names and the
first release cutoff can wait until useful cases have passed. No publishing
occurs in this planning session.

## Remaining choices, at the point of use

- **Per-tool side-effect boundaries:** the examples above, when a selected
  route would change unrelated expression, automation, references, or state.
- **Case-specific bounds:** actual input files, target objects, useful result,
  scale, latency, and any manual step. The user supplies material at execution.
- **Readback details:** sends/returns, sidechain context, tails, exact range
  boundaries, and fallback if R03 cannot provide quick inaudible pre-fader
  output. The primary signal scope is already settled.
- **Research outcomes:** pressure reproduction, live setters, claim scope,
  Producer Pal comparison, and the format name. Keep current notation unless
  evidence justifies a new selection.
- **Release details:** which completed cases and tested builds ship first,
  artifact names, and the final version number. The support posture is settled.
- **Direct-client reuse:** the smallest useful entry point when a real script
  needs it; no package rewrite or permanent Ghostworks adapter is required.

The [selected work sessions](work-sessions.md) own performance, format,
legacy-profile cleanup, and internal-access classification. T5 history
retention stays deferred unless evidence shows a real cost. W4-D can now
map the working templates to explicit row/verb requirements and briefs;
it does not need to reopen the broad vision.
