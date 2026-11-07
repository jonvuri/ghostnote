---
title: E392 — R01 real Ghostnote usage classified by capability cell
kind: evidence
state: done
updated: 2026-10-31
owner: R01
---

# E392 — R01: real Ghostnote usage by capability cell

Date: 2026-10-31. Stage: offline transcript analysis for
[R01-D22](../../../spec/r01-research/decisions/r01-d22-capability-grid-focus.md)
step 1–2. No Ghostnote, Bitwig or model-trial calls were made.

## Method

- **Sources:** every local Codex rollout under `~/.codex/sessions/` and
  `~/.codex/archived_sessions/` (202 files, 2026-10-09 to 10-29). Older threads
  in `session_index.jsonl` (820 entries, from 2026-08) have no local rollout and
  could not be examined. Claude Code transcripts under `~/.claude/projects/`
  were triaged as a secondary source.
- **Selection:** a Codex session counts if it has a completed `McpToolCall` item
  with `server == "ghostnote"`. Ten sessions qualify (528 calls). One
  (`01a187bd`, 10-29) is P01 development with a single connection check and is
  excluded. Of 15 Claude Code sessions with Ghostnote calls, two are product
  use; one replays an earlier product session to test descriptions, and twelve
  are development or verification (V14, B08, dogfood fixtures).
- **Product set:** 9 Codex sessions (527 Ghostnote calls, about 41 user
  messages) and 2 Claude Code sessions (37 calls), 2026-10-14 to 10-29, one
  operator. Work: drum grooves, chord and bass clips and variations extracted
  or derived from Ghostworks transcriptions, the V01 sketch, and a 59-clip idea
  session.
- **Classification:** five subagents read the sessions against a shared brief
  and wrote per-session reports with JSON cell counts. The reports contain
  paraphrase only and stay local (`.tmp/r01-usage/`, ignored). The orchestrator
  checked the counts and one disputed claim (below).
- **Format in use:** all sessions used the live format, Ghostnote document 1.0
  with a `FIELDS` binding and one `EVENT` row per note (SPEC unchanged since
  2026-10-07). The Claude Code triage described the 10-15/16 documents as a
  pre-compact-bar format; that is incorrect, since positional compact-bar v1 was
  retired by D24 before these sessions.

## Results by cell

Write interactions (a user request and the calls serving it):

| Cell | Interactions | Sessions | Notes |
|---|---|---|---|
| A1/B1 generation (new clip or whole-clip replace) | 17 | 11 | About 90 clip writes; source MIDI or existing clips transformed by script |
| A2 carried in B1 | 2 | 2 | Channel 10 and release velocity on drum clips |
| A3 carried in B1 | 7 | 6 | Overlays, almost all inferred nominal/groove timing; requested by no user |
| A1/B2 addressed, single turn | 3 | 2 | 466 pitch UPDATEs to make copies minor; 6 REMOVE + clip-update patches to split clips |
| A2/B2, A3/B2 | 0 | — | — |
| B3 sustained (any A) | 0 | — | — |

Read-only interactions: analysis or source checks in every session. Reads
dominate call counts: in the largest session, 224 of 297 calls were reads
(128 empty-slot probes, 61 re-reads of already verified writes, 32 source
reads, 3 reference re-reads).

**Authoring conveniences requested or improvised:** bar-window crop and slice,
split into sections, retime to a new tempo, drum remap to a kit, pitch-class or
scale transforms, voice separation (melody and chords), selector edits (lower
selected E's to E♭), duplicate-and-vary, groove templates, chord revoicing and
loop-boundary checks. Agents implemented all of them in ad hoc Python or JS.

## Live-format performance

- **Correctness:** all applied writes read back verified and exact. Two refusals
  occurred in 564 product calls, both fixed in the same turn: a same-pitch
  overlap created by retiming (`unsupported`, host rule) and a replacement that
  did not reuse the read's clip ID (`invalid-input`). MIDI export took two
  refusals (R03 read-to-desired, clip-loop `acceptLoss`). No stale-base refusal,
  preservation loss or identity error was caused by the notation.
- **The format was a script target.** All nine Codex sessions called Ghostnote
  from code-mode scripts, so tool results went to script variables and the
  model saw only what scripts printed (90–196 KB per session, at most 39 KB per
  call). Byte totals below therefore measure server output, not model context;
  redundant reads cost wall time and truncation exposure. From 10-16,
  `documentPath` made write arguments 167–220 bytes; scripts parsed `EVENT`
  rows and generated documents.
  The model rarely read or wrote FIELDS text itself. The exception is
  Claude Code 10-15, before file paths existed: one 106 KB document emitted
  inline (about 72k output tokens, 7.5 min), then about 104 KB more to split it.
- **A3 overlays were a net cost.** Following the reference's timing-feel method,
  agents attached two overlays to almost every note: about 1–1.2 KB per note
  against 35–72 B per row, 94–96% of written bytes. Readbacks reached 231–546 KB,
  and Codex truncated 24 results: 17 clip reads (overlays only), 2 dry runs and
  5 inline `read_midi_file` results that lost EVENT rows. No later turn used an
  overlay.
- **A3 and identity never survived a turn boundary.** Save-as, project rename,
  clip moves, copies and hand edits each re-minted IDs and dropped overlays.
  When the operator later asked about a timing offset an overlay had recorded,
  the agent re-derived it from source MIDI. One spooky-session read showed seven
  clips with new IDs minutes after a read or patch, with no scene change; the
  cause is undetermined here (see E393).
- **Patch shape.** Every B2 use was structural or a transform written as ID
  lists: 466 UPDATE lines for a two-pitch-class change; long REMOVE lists for a
  range split. Restating 114–126 notes for light variations happened because no
  duplicate-and-patch path existed.

## Cause attribution

| Cost or problem | Cause | Scale |
|---|---|---|
| Empty-slot probing by full clip reads (no occupancy in `list_tracks`) | tool design | all sessions; 128 reads in one |
| Re-reading writes already verified | model (and description) | 61 reads, 1.6 MB in one session; every session |
| Clip reads returned inline instead of through `documentOutputPath` | model / description | 0 of 224 reads in one session used it |
| Unrequested per-note overlays | reference guidance | 6 sessions; ~95% of write bytes |
| Identity and A3 loss across save, move, copy, hand edit | host and persistence (deferred) | every multi-turn session |
| No slice, duplicate-and-patch, range or selector operations | tool design | most write requests |
| Repeated uniform field (`releaseVelocity` per row) | format | about 29 B per note, drum clips |
| No durable clip provenance (matched by name) | tool design / A3 persistence | 1 |
| Wrong snare pitch; timing changed while claimed preserved; unrequested saves | model | 3 |
| Inline 106 KB document before file paths | tool design (since fixed) | 1 session |

## Interpretation

- Real use sits in **A1/B1, with scripted generation**: 17 of 20 write
  interactions. B2 appeared three times, in one turn each, and its natural form
  was a range, selector or transform rather than an ID list. **B3 was never
  needed**: the operator curated in Bitwig between turns, and each turn started
  from fresh reads.
- A2 was written only as constants on drum clips. A3 was written often but only
  as agent-authored overlays that nobody used and that could not persist.
- The largest costs are **outside the notation**: slot inventory, verification
  re-reads, read-to-file use, overlay guidance and missing structural
  operations. The only format-attributable cost seen is a repeated uniform field.
- R01's measured C3/C4 differences (E375–E391) concern models reading and
  writing A3 group structure inline. That condition did not occur in this use.
- **Limits:** one operator, one fortnight, mostly extraction from transcriptions;
  no local rollouts before 2026-10-09. A revision-heavy session (V01's "audition
  and revisions next") could change the B2/B3 picture.
