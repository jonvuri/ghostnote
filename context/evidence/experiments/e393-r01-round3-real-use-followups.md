---
title: E393 — R01 round 3: ID re-mint cause, timing overlays and tool-design costs in real use
kind: evidence
state: done
updated: 2026-10-31
owner: R01
---

# E393 — R01 round 3: real-use follow-ups

Date: 2026-10-31. Stage: offline transcript and code analysis
([R01-D23](../../../spec/r01-research/decisions/r01-d23-pause-format-comparison-and-open-round-3.md)).
Sources: the product sessions of
[E392](e392-r01-real-usage-by-capability-cell.md), the brain and extension
source, and the model reference. Three subagents investigated one question
each; the orchestrator checked the decisive code and transcript points. The
analysis made no Bitwig calls; section 4 adds one operator-approved live probe. Per-question reports stay
local (`.tmp/r01-usage/r3-*.md`, ignored).

## 1. Mid-turn ID re-mint: Ghostnote's fail-closed event window

**Answer: Ghostnote, by design rather than a coding slip; not the agent or
Bitwig.** The transcript analysis below is confirmed live (section 4).

- **Mechanism.** The extension keeps only the last 24 Launcher slot
  fill/empty events (`Rig.java:620`, `CONTENT_LOG = 24`). When a read finds an
  earlier ref for a slot, the brain checks the events since that ref
  (`agent-native.ts:321–355`). If more than 24 occurred, it cannot prove the
  slot unchanged, so `clip-snapshot.ts:162` returns `identity-changed` with
  `why: 'delta-incomplete'`; every ref at the slot retires and all notes get
  new IDs (`identity-registry.ts:119,211`). E233 §3 trial 3 recorded the same
  outcome deliberately.
- **Sequence** (2026-10-30 00:32–00:36 UTC, spooky session turn 2). The agent
  read bass and melody rows 0–2, alternated chord adds and melody patches on
  rows 0–2, added 18 clips in rows 4–9, then re-read rows 0–9. A group track
  whose slots mirror its children likely added six more events (inference).
- **Cut-off fits exactly.** Refs followed by 25–27 events re-minted; refs
  followed by 24 or fewer kept their IDs. The retired refs were simply the
  oldest across three tracks.
- **Ruled out:** project, targets, scene count and warnings unchanged; note
  content identical apart from IDs; the agent's screenshot and save came after
  the reads; no user message intervened.
- **Visibility defect.** The read result reports only
  `reason: identity-changed` (`agent-native.ts:101`) and drops
  `delta-incomplete`, so the transcript looked like a slot or scene change.
- **Practical effect.** About 24 clip creates or deletes after a read (fewer in
  rows under a group) silently discard that read's IDs and overlays, even
  within one turn. This bounds B2/B3 in any generation-heavy session.
- **Alternative lead, ruled out live.** The re-mint occurred during a sweep of
  30 concurrent `read_launcher_clip` calls; section 4 shows concurrency does
  not change the outcome.
- **Possible fixes (not evaluated):** a larger or cursor-based event log; a
  brain-side event journal; reporting `delta-incomplete` and a warning; keeping
  IDs when content is unchanged despite a truncated log (weakens fail-closed
  identity; needs a design decision).

## 2. Timing overlays: nature and relation to the prompts

- **Content.** Every note got a `nominal` and a `groove` claim, about 3,120
  notes across six sessions. Each groove claim's `sourceAt` was the note as
  written, not the source note. No overlay used a template name, swing,
  `cross` or groups. Two kinds:
  - *Inferred* (extraction from transcriptions; 1,186 notes): the nominal is
    the nearest 1/16 or 1/8 grid point, and the whole offset sits in
    `unassigned` (onset minus grid), except one session's per-bar median
    hi-hat `phase` of about 0.09 beat.
  - *Declared* (composition; 1,931 notes): an authored pocket rule (for
    example +1/32 on odd sixteenths, +1/64 on off-eighths), pushes and
    offsets derived from a reference shard.
  - Two earlier clips carried only clip-level tempo and meter claims.
- **Relation to the operator's timing instructions.**
  - *Declared overlays did represent requested feel* ("funky", "off-grid",
    "natural timing feel"). Nothing ever read them.
  - *Inferred overlays followed the reference method by default.* Where the
    request was to keep source timing, they restated the written notes and
    could not reveal the real deviations (added reattacks and a 1.59-beat
    shift from the source bar phase), which the operator caught.
  - *The operator's three timing questions* concerned fidelity to the source
    or alignment with other parts. Each was answered by comparing the clip
    with source MIDI in a script; no answer consulted an overlay. In one later
    turn the agent filtered overlay lines out of its read and recovered the
    pocket from note positions.
  - Every overlay was lost after a save, rename, copy, move or new thread.
- **Trigger.** Tool descriptions, by design since 8i10 (v45, E259):
  `TIMING_FEEL_ROUTE` (`document-help.ts:190`) in the add and edit
  descriptions says to request the timing-overlay section to make, *keep*,
  clean or revise timing feel. That section's method says to put a nominal
  and a groove claim on each note (`MODEL-REFERENCE.md:154,166`). "Keep" made
  every extraction qualify: all nine Codex sessions fetched the section on
  their first reference call. Two sessions fetched it and wrote nothing; the
  two Claude Code sessions made no reference call and wrote no overlays.
- **Recoverability.** Every inferred value is derivable from the written
  notes. What MIDI cannot recover is clip-level: declared intent and its rule,
  and provenance (source file and hash, bar range, tempo decision); about 15 of
  roughly 1,390 declared nominal assignments were ambiguous.
- **Implication.** Clip-level statements would have carried all
  non-recoverable information. The questions actually asked needed durable
  clip provenance and a source-comparison check, not per-note claims.

## 3. Tool-design costs: measured and ranked

Measured over the nine Codex sessions: 172 empty-slot reads (54 s); 77
same-turn re-reads of just-written clips whose content hash equals the write's
verified readback (2.08 MB, 166 s); all 92 writes returned `verified`. In the
spooky session, probes and re-reads take 47% of Ghostnote time. Results were
consumed by scripts, so these are wall-time and truncation costs rather than
model-context costs (E392, corrected).

Proposals, ranked by value for effort (none is covered by a backlog item):

| # | Cost | Proposal | Effort; checks |
|---|---|---|---|
| 1 | Verification re-reads | Add/edit descriptions state that `verified` is independent readback (D15, D38) and `readback.base` serves the next edit; add `readback.clipId` (D47) and `documentOutputPath` on writes | low; description version bump |
| 2 | Inline reads | Give `read_launcher_clip` the "prefer `documentOutputPath`" sentence `read_midi_file` has; warn on inline documents over about 48 KB; cap dry-run change lists | low; description version bump |
| 3 | Unrequested overlays | Route timing-overlay guidance only when the user asks about feel; prefer clip-level declared claims | low; description version bump |
| 4 | Slot probing | `list_launcher_slots`: first brain-only over the existing one-turn `slot.status` read (about 1.2 s for 48 slots), later one extension call for whole-project occupancy | medium; ledger row, call-budget test, live check |
| 5 | Slice, split, duplicate-and-patch | `add_launcher_clip` with a `source` clip, beat range, shift and optional patch, preserving ID lineage. Selector or range patch records and server-side transforms conflict with D21 and D51; script-generated patches were cheap (466 UPDATEs, 13 KB) | medium–high; live check |
| 6 | Copy and move drop identity | Bind source IDs and overlays to the destination on its next read, with no extra host call | medium |
| 7 | Provenance by clip name | An ID-independent note fingerprint so Ghostworks can match clips across re-mints | medium |
| 8 | Repeated uniform field | Let the encoder bind a mostly uniform field such as `releaseVelocity` as a column (canonical-binding rule amendment); a clip-level default conflicts with D35/R04 | low value |
| 9 | Silent re-mint (section 1) | Surface `delta-incomplete` with a warning; consider a larger or cursor-based log | low to medium; live probe |

## 4. Live confirmation of the event window

The operator approved the probe and loaded `gn-scale-test`. Driver
[`r01-r3-event-window.ts`](../../../brain/src/probes/r01-r3-event-window.ts),
run 2026-10-31 21:08 UTC; output
[`e393-event-window.json`](../data/r01-round3/e393-event-window.json).

- **Build.** The loaded `ghostnote` build is `main`'s B17 normal build
  (`normal-v1`, API 25, 93 methods, hash `d6decf985f6b1f36`, fresh
  initialization 21:04:25 UTC), not this checkout's golden (92,
  `8be1975eaa99d78f`); the extra method is `chain.observe`. The content-log
  code (`CONTENT_LOG = 24`) and all brain identity code are identical between
  the two; the driver pins the loaded hash.
- **Method.** One scratch instrument track `gn-r3-window` with a two-note seed
  clip at row 0. Add/delete churn at row 1 placed an exact number of content
  events after the last read of row 0, measured by `contentEpoch` after every
  operation. Only the driver wrote; no other probe driver ran.
- **Each clip add or delete is exactly one content event** (98 of 98
  operations).
- **Boundary:**

  | Phase | Events after the last read | Read | Identity |
  |---|---|---|---|
  | A | 24 | sequential | `current`, same IDs |
  | B | 25 | sequential | `retired-and-new`, 0 retained, 2 minted |
  | C | 24 | 5 concurrent | all `current`, same IDs |
  | D | 25 | 5 concurrent | first `retired-and-new`, the other four `current` with the new IDs |

  Concurrency does not cause or prevent the re-mint. A retained read refreshes
  the window, because the next read compares against the latest ref.
- **Hidden reason confirmed.** Every retired ref reports only
  `reason: identity-changed`, with no warning; `delta-incomplete` does not
  reach the result.
- **Cleanup.** The scratch track was deleted; the track list matches the entry
  state (11 tracks, same IDs and names). The mixer selection stayed on
  `gn-sel`. The Launcher slot cursor afterwards pointed at track index 9,
  row 0; the driver did not record the slot selection at entry, so whether it
  moved is unknown.
- **Not tested:** whether a group track adds an event for a child's clip (the
  tools cannot create a group track).

## Original probe design

In a scratch project with one group of two child tracks and one standalone
track:
1. Add one clip at a time and record the content-event count after each, to
   confirm whether a first child clip in an empty row adds two events.
2. Read the standalone track, add clips until exactly 24 events follow that
   read, and read again (IDs expected kept). Add one more clip and read again
   (IDs expected re-minted). Repeat the final read sequentially and
   concurrently to separate the event window from concurrency.
3. Remove the scratch clips and confirm preserved state.
