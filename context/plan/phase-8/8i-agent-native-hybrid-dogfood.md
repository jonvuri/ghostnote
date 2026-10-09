---
title: Phase 8i — Agent-native hybrid dogfood
kind: plan
state: planned
status: Final Phase 8 gate. 8i0–8i11 are complete (E249–E260, D42–D48); the groove and overlay trials passed (E256), and timing claims are used without a leading prompt (E259, E260). Next: the gate close-out.
updated: 2026-10-09
parent: README.md
prev: 8i5-device-control-identity.md
next: ../phase-9/README.md
evidence: E120, E121, E127-E134, E209, E213, E247, E252, E253; D25, D39, D40, D44, D45
---

# Phase 8i — Agent-native hybrid dogfood

[8i0](8i0-clip-metadata-and-colour-tolerance.md) is complete
([E249](../../evidence/experiments/e249-clip-metadata-and-colour-tolerance.md),
[D42](../../decisions/d42-clip-colour-tolerance-and-metadata-ownership.md)).
The first musical trial passed after an operator-led revision, but a colour
guard forced a UI palette change before the duplicate could be extended. A
property or length edit now writes no colour and needs no palette. Keep the
accepted musical result and original clip intact.

The second trial failed: every `clip.read` in "ice jungle" refused
`deadline`. The project was saved with the ghostnote cursor records, so the
unpinned cursors followed the selection. The 8i1 repair keeps every owned
cursor track pinned ([E250](../../evidence/experiments/e250-reader-follow-mode-repair.md),
[D43](../../decisions/d43-owned-cursor-tracks-stay-pinned.md)). The repair
enabled the later trial described below.

The Phase 8 review (2026-10-08) found two problems and one verification gap.
The following sessions completed them before the 2026-10-09 trial:

1. [8i2 — Collapsed-group live verification](8i2-collapsed-group-live-verification.md):
   run the collapsed-group read and point routes live on the D43 build.
   Complete ([E251](../../evidence/experiments/e251-collapsed-group-live-verification.md)):
   every route passed; no product path changed.
2. [8i3 — Long device write profile](8i3-long-device-write-profile.md):
   some admitted device writes (`compose_devices` staged at five chains,
   `set_device_controls` without a bound) can pass the 60 s client timeout.
   Measure, optimize, then bound or add a background flag.
   Complete ([E252](../../evidence/experiments/e252-long-device-write-profile.md),
   D44): optimized, then bounded; the longest admitted call is 33.5 s.
3. [8i4 — Overlay basis sealing](8i4-overlay-basis-sealing.md): an agent
   cannot put an overlay claim, because no tool supplies the R22 basis.
   Complete ([E253](../../evidence/experiments/e253-overlay-basis-sealing.md),
   [D45](../../decisions/d45-the-edit-limb-seals-explicit-overlay-claims.md)):
   `edit_launcher_clip` computes the basis of each claim that the call
   states.
6. [8i5 — Device control identity](8i5-device-control-identity.md).
   Complete ([E254](../../evidence/experiments/e254-device-control-identity-and-route-claims.md),
   [D46](../../decisions/d46-modulation-writers-claim-the-route-not-the-sound.md)):
   remote selectors resolve by host index; the modulation writers claim the
   authored route and run no behavior witness; `npm run
   probe:modulation-routes` keeps the live route proof. A fresh agent asked
   for Patch help on its first read and made no repeat read.
7. [8i6 — Document format discovery and repair](8i6-document-format-discovery.md).
   Complete ([E255](../../evidence/experiments/e255-document-format-discovery.md)):
   the document inputs carry a valid example and name
   `get_document_reference`, which needs no host; a refused document returns
   `detail.repair`. Five fresh agents created and patched clips with no
   format rejection in the normal trials.
8. [8i7 — Bounded track mixer controls](8i7-track-mixer.md). Complete
   ([E257](../../evidence/experiments/e257-track-mixer.md),
   [D48](../../decisions/d48-track-mixer-writes-host-raw-values.md)):
   `read_track_mixer` and `set_track_mixer` set exact dB, pan, mute, and
   solo with field-level reversal. Descriptions v43, 42 tools.
   [8i8 — Selection effects and unavailable readback](8i8-selection-and-readback-results.md).
   Complete ([E258](../../evidence/experiments/e258-selection-effects-and-unavailable-readback.md)):
   a failed verification read is `unavailable` on every write tool, and
   clip and track writes restore the selection or warn. Descriptions v44.
9. [8i9 — Overlay authoring and creation](8i9-overlay-authoring-and-creation.md).
   Complete ([E256](../../evidence/experiments/e256-overlay-authoring-and-creation.md),
   [D47](../../decisions/d47-clip-creation-binds-claims-to-the-live-clip.md)):
   Timing overlays help has a complete example and timing templates with the
   host basis rule; a refused claim returns `detail.repair`;
   `add_launcher_clip` takes claims with the document's clip ID in one call.
   Descriptions v42, model reference revision 3.
10. The [operator overlay trial](#operator-overlay-trial) passed
    ([E256](../../evidence/experiments/e256-overlay-authoring-and-creation.md#operator-trial)).
    It closes the groove task and the overlay dependency change of the trial
    set.
11. [8i10 — Unprompted overlay trials](8i10-unprompted-overlay-trials.md).
    Complete ([E259](../../evidence/experiments/e259-unprompted-overlay-trials.md)):
    the first runs made no claims; descriptions v45 and model reference
    revision 4 route timing-feel tasks to Timing overlays and add an
    analysis method; in the reruns, both timing tasks made and used claims
    without a request.
12. [8i11 — Claim replacement repair](8i11-claim-replacement-repair.md).
    Complete ([E260](../../evidence/experiments/e260-claim-replacement-repair.md)):
    the duplicate-claim and onset-floor refusals return a repair; reference
    revision 5, descriptions v46; the operator rerun of T1 steps 1 and 2 had
    no refusal.
13. Next: the gate close-out. Check the [acceptance criteria](#acceptance-criteria)
    against E249–E260, give each Phase 8 interface a verdict, and write the
    [Phase 9 handoff](#phase-9-handoff) with the 9b artifact inventory.

## Fresh agent trials

Run a fresh agent with Codex from an empty directory, so that it has no
repository files and no instructions (E255):

```sh
mkdir -p /tmp/gn-trial && cd /tmp/gn-trial
codex exec --json --skip-git-repo-check -s read-only \
  -c 'mcp_servers.ghostnote.tools.read_launcher_clip.approval_mode="approve"' \
  -o last.txt "<task>" > trial.jsonl
```

Pre-approve each read tool that the task needs in the same way.
`-c 'mcp_servers.ghostnote.enabled_tools=["add_launcher_clip"]'` limits the
tool list. The session file in `~/.codex/sessions` has the timestamps. Use
an owned track, and delete it after the trial. Give the task only; do not
name tools or a sequence.

## Operator overlay trial

The operator repeats the Rain Steps task of the
[8i9 source](8i9-overlay-authoring-and-creation.md#source-and-observed-failure)
in a fresh client with no repository access and no tool sequence.

1. Restart the client, or its ghostnote MCP server, so that it loads
   `ghostnote-description-v42` and model reference revision 3. A restart
   clears the claims that the server process stores; the "Night Glass"
   clip `Rain Pocket • 8 bars` then reads without its 56 claims.
2. Check: `get_document_reference` with Timing overlays returns
   `data.revision` 3 and `data.templates.timing`.
3. Give the original task. After the add, move one note of the new clip by
   hand in Bitwig, then ask the agent to read fresh state.
4. Record the transcript, help requests, format refusals, recovery, calls,
   the claim states after the hand move, and the musical verdict.

A claim whose note keeps its ID and its dependency values stays current. A
hand edit that keeps the onset cell (a length change) keeps the ID; the
claims of that note become stale. A moved onset is a new cell: the note gets
a new ID in the fresh read, and its claims are removed.

Result (2026-10-09, [E256](../../evidence/experiments/e256-overlay-authoring-and-creation.md#operator-trial)):
passed. The agent created 32 notes and 64 claims in one add with no refusal
and no repository read. After two hand edits, the moved note's claims were
removed, the lengthened note's claims were stale, and 60 claims stayed
current; the agent reported this correctly. Operator verdict: musical pass.

## Second musical trial

The second musical trial passed on 2026-10-09: the operator accepted the
bass rhythm revision and sound. Preserve that result. 8i5 repaired the two
device failures from the session ([E254](../../evidence/experiments/e254-device-control-identity-and-route-claims.md)).
The [interface review](8i-trial-2-interface-review.md) records extra calls
and their causes. This trial did not use overlays; the operator overlay
trial covered groove interpretation and overlay dependency changes.

## Accepted 8f3 inputs

Use the checked [Model format reference](../../../spec/ghostnote-document-v1/MODEL-REFERENCE.md)
with the [host binding](../../../spec/ghostnote-document-v1/HOST-BINDING.md),
[identity and overlay rules](../../../spec/ghostnote-document-v1/IDENTITY-AND-OVERLAYS.md),
and [risk policy](../../contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md).
Include bounded desired/sparse edits, stale claims, ambiguous identity, a cache
read, a structure change, and a fresh proposal after computer-use reacquisition.
Use 8h's proved capabilities; pure binding fixtures do not supply live permission.

## 8h inputs (E247)

The [8h closeout](8h-cache-promotion-and-interface-simplification.md#closeout-8h4g-e247)
names two facts for this charter:

- The simplification that removed the most agent work is the document edit
  limb (`read_launcher_clip` and `edit_launcher_clip`), with every edit a
  direct call. Measure whether a fresh agent uses the pair without coaching.
  The direct route depends on the D41 writer width (E248): record any clip
  write that takes more than about 10 s, with its channels and property
  stages.
- The retained safeguard that costs the most is the complete parameter
  inventory around each device control write (a 27-control write takes about
  14.4 s). Record whether that cost limits real device work, and whether a
  narrower readback is worth a later decision.

The [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) has
the cost of each tool for the comparison section.

## Purpose

Test whether the revised Ghostnote works as fast specialized senses and limbs
for a frontier agent. Use ordinary musical work, fresh agent sessions, real
projects, and computer use. Decide whether the cache, compact-bar contract, and
simplified surface are ready for Phase 9 publication review.

## Trial set

Run several bounded tasks that together cover:

- project and clip discovery;
- compact musical reading and explanation;
- a complete desired document and a sparse note edit;
- nominal rhythm interpretation under the normalized timing boundary;
- a groove task that preserves or transfers selected timing intent;
- an overlay dependency change that requires preservation or invalidation;
- a repeated read that should benefit from the cache;
- one structural change or rebuild condition;
- one visible UI-only action followed by structured reacquisition;
- one failure, ambiguity, or over-limit fallback; and
- one subjective musical choice with an operator verdict.

Use existing real material when permission and cleanup are clear. Use owned
duplicates for destructive or reversible test work. Give the fresh agent the
versioned [8f2 model format reference](8f2-reference-codec-and-model-format-reference.md)
through the normal prompt or skill route. Select optional overlay sections by
task. Do not coach the agent with repository-specific tool sequences.

## Comparison

Compare the new route with retained Phase 7 and pre-promotion measurements where
the task is equivalent. Record:

- time to first useful state and task completion;
- Ghostnote calls, computer-use actions, model round trips, and operator turns;
- input and result tokens or bytes;
- cache hits, misses, rebuilds, fallbacks, and authority comparisons;
- incorrect targets, refused work, recovery, and residue;
- verification and reversal work by risk tier; and
- agent confusion caused by naming, overlap, hidden state, or result shape.

Do not require every metric to improve. Explain any retained cost in terms of
the risk or capability it owns.

## Agent-behavior gates

The fresh agent must:

- select Ghostnote when structured state or precise action adds value;
- use computer control for visual and focus-dependent work;
- read and produce FIELDS with the model reference and no repository tutorial;
- distinguish realized timing from nominal rhythm and inferred groove;
- recognize stale overlay interpretations after relevant note or context changes;
- notice cache health, coverage, and fallback when relevant;
- avoid treating a UI observation as exact structured state;
- avoid bypassing a refusal through a lower-level tool without a stated reason;
  and
- recover from one stale or changed state without corrupting the project.

8i10 result
([E259](../../evidence/experiments/e259-unprompted-overlay-trials.md)):
without a mention of Ghostnote, a fresh Codex Desktop agent used only
computer use (a client tool-exposure limit, not a description fault). With
v44, no agent made timing claims without a leading prompt. With v45 and
reference revision 4, the timing gates pass for this cohort: both timing
tasks requested Timing overlays, separated nominal rhythm from groove in
claims, and changed only the timing part that the task named. Stale-claim
recognition is only partly shown: T1 step 3 named the hand-edited notes
correctly but did not name their stale or removed claims. Timing overlays
are a default path when the descriptions route to them, not an expert path.

## Acceptance criteria

- The cache remains correct through the selected real lifecycle events.
- The version 1.0 document supports useful complete and sparse reads/edits
  with the declared loss, defaults, and field preservation.
- Overlay identities and dependencies survive or invalidate correctly. Removing
  an overlay leaves notes unchanged. Musical judgments have their own verdict.
- FIELDS/JSON conversion preserves accepted live document values. The tested
  model reference matches the specification and codec version.
- The simplified tool surface needs less coaching, fewer calls, lower latency,
  or fewer tokens on representative work.
- Computer use and Ghostnote have a clear, practical division of labor.
- Strong verification appears only where the selected risk tier requires it.
- Failures and partial results still give the agent enough information to
  continue or stop safely.
- Every owned change or fixture is retained by operator choice or removed
  exactly. No unrelated state changes.
- The result gives each Phase 8 interface a graduate, revise, retain, or retire
  verdict.
- Publication candidates and known limits are handed to
  [9b](../phase-9/9b-compact-bar-publication-review.md), with an artifact inventory
  that names paths, versions, hashes, dependencies, and redistribution status.
- Complete repository checks and the relevant live gates pass.

## Phase 9 handoff

Phase 9b can package the format after this session accepts the specification,
reference codec, model reference, conformance package, overlays, and live use.
Include the product review as the README source, corrected matrix and
adjudicated result packages, and a list of any version 1.0 changes not measured
by the old benchmark. Hand off unresolved limits explicitly.

Phase 9 can review the extension only if the normal runtime and public surface
have stable owners.

## Retrospective target

Record whether Ghostnote behaved like a useful instrument for the agent or like
an additional workflow the agent had to manage. Treat that distinction as the
main Phase 8 verdict.
