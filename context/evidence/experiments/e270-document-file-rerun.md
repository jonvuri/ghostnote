---
title: E270 — Document file rerun
kind: evidence
state: done
updated: 2026-10-16
owner: phase-8i19
---

# E270 — Document file rerun

## Result

The operator repeated the [E268](e268-two-client-midi-chord-trial.md) task with
descriptions v51 in a fresh Claude Code session and a fresh Codex session.
Before each session, the operator renamed and cleared the `chords` track of
`lie sword`. The Claude prompts were the first two E268 prompts. The second
Codex prompt asked for four 4- to 8-bar samples. Ghostworks had updated the
source file: it now has 512 tempo events (95.5–127.9 BPM, median 100.2) and a
2/4 meter at zero. The [rerun data](../data/phase8i19-document-files/rerun.json)
has the metrics and line references. It has no note or analysis content.

Both agents used the [E269](e269-document-file-paths.md) file parameters
without a prompt. Each read the MIDI file with `documentOutputPath`, processed
the `.gndoc` file in scripts, wrote clips with `documentPath`, and checked the
result with `read_launcher_clip` and `documentOutputPath`. No document passed
through the conversation. All readbacks were `verified`.

| Measure | Claude, E268 → E270 | Codex, E268 → E270 |
|---|---:|---:|
| Output tokens, task turns | 161,362 → 19,378 | 10,872 → 10,976 |
| Peak context | 381,739 (compacted) → 97,666 | 139,477 → 128,043 |
| Turn 1 / turn 2 | 142 / 531 s → 119 / 115 s | 165 / 150 s → 140 / 285 s |
| Clips written | five inline → two from files (1,353 and 1,343 notes) | four from memory → four from files (768–835 notes) |

The second Codex turn includes about 131 s of operator approval for computer
use. Issue D14 is closed: the Claude write turn went from 531 to 115 s.

## Findings

1. **The MIDI read report grows with the tempo map (issue D15).** In file
   mode the result was 21,633 characters, not about 1.7 KB.
   `data.report.sourceTempoMap` lists all 512 events (19,862 characters). The
   context grew by 10,255 tokens for Claude and 7,297 for Codex. The map is
   also in the document as tempo overlays when `targetBpm` is absent. Other
   updated files have long maps at one constant tempo: `good lies` medium
   drums, 247 events at 126 BPM; `losing you` large drums, 489 events at
   140 BPM. One checked file, `namisora` medium piano, still has one 60 BPM
   event.
2. **The `targetBpm` text assumes a 60 BPM placeholder.** The parameter text
   and the contract say what to do with a 60 BPM transcription of a 120 BPM
   song. Ghostworks files now carry tempo maps, so this example can lead an
   agent to replace a real map with a constant tempo. Neither agent sent
   `targetBpm` in this rerun.
3. **An overlap refusal comes after the empty clip exists (issue D16).**
   Codex line 158: `add_launcher_clip` created the clip, then refused the
   content with `unsupported`, reason `overlap`. The detail named no notes.
   The overlap came from the agent's own excerpt cuts. The agent found it in
   its script, then filled the empty clip with `edit_launcher_clip`. The
   check uses only the document, so it can run before any host call.
4. **Tool discovery.** Claude loaded tools by name with ToolSearch. Codex
   printed matching descriptions: 41,057 characters, which the client cut,
   then 13,540 and 27,362 characters with two reference sections. The
   operator's AGENTS.md rule to filter by names first was present (line 267).
   Codex adds the server instructions to each tool description in Code Mode
   (E126). The agent cited a public analysis and Codex issue 29097 for this
   behavior (lines 293–356); this record does not verify those sources.
5. **Small waste.** Codex set `playStartBeats` to its current value (line
   194, readback `unchanged`). Claude ran a placeholder `echo` command and
   repeated one build step after a zsh glob error. Neither agent called a
   Ghostworks tool.

## Changes in 8i19

The `agent-native-v1` server instructions now have only the capability map,
the read-before-write rule, and the result convention. The change-ID sentence
is removed with the MIDI and delete sentences that E269 removed: 23 of 26
write descriptions state their own change ID and revert route, and
`duplicate_track`, `rename_layer_chain`, and `set_layer_chain_solo` have no
revert. The tool descriptions do not change.

[8i20](../../plan/phase-8/8i20-midi-tempo-report-and-overlap-precheck.md)
plans findings 1–3.

## Limits

One run for each client. The second prompts differ. Token numbers come from
the client session files, not billed usage. Findings 4 and 5 are client or
agent behavior.
