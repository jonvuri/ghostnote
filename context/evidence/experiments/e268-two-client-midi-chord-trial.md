---
title: E268 — Two-client MIDI chord trial
kind: evidence
state: done
updated: 2026-10-15
owner: phase-8i19
---

# E268 — Two-client MIDI chord trial

## Result

The operator gave Codex and Claude Code the same first prompt. Each agent read
a 3,243-note guitar transcription with `read_midi_file` and analyzed it. In
later prompts, each agent wrote the chord progressions to the `chords` track of
`lie sword` at 110 BPM. The operator reworded the second and third Claude
prompts, so only the first turn is a direct comparison. The operator reported
that the two sets of clips are almost equal; some strums have small voicing
differences.

Each agent processed the full document in scripts and printed only summaries.
The difference was the route from a script to a write tool. Codex passed each
generated document from script memory to the tool. Claude Code had no such
route, so it read each document into its context and wrote it again as the
tool argument. This is issue D14. The
[trial data](../data/phase8i19-document-files/trial.json) has the metrics and
source line references; it holds no note or analysis content.

| Measure | Codex | Claude Code |
|---|---:|---:|
| Turn 1: read and analysis | 165 s | 142 s |
| Turn 2: chord clips | 150 s | 531 s |
| Turn 3 | 68 s (copy, then minor) | 515 s (split into four clips) |
| Output tokens, session | 10,872 | 161,362 |
| Notes in the four final clips | 619–705 | 640–717 |

## Reads

The inline `read_midi_file` result is 251,600 characters. Codex printed it with
`text(r)`. The client cut the output from 67,046 tokens; the context grew by
16,740 tokens (rollout line 33). The script kept the complete result with
`store()`. Claude Code did not admit the result inline. It saved it to a file
and returned a 1,436-character notice (session line 45). The agent parsed that
file with Python. The context grew by about 750 tokens.

The two clients also found tools differently. Codex filtered `ALL_TOOLS` and
printed the matching descriptions. The client cut that output from 32,224
tokens (rollout line 18). The scan found the Ghostworks asset tool, which gave
source context. Claude Code loaded `read_midi_file` by name (session line 25)
and did not use Ghostworks in this session.

## Writes

Codex made four clip writes from script memory with `load()`. Claude Code made
five clip writes with inline documents of 23,434 to 103,174 characters. The
first write was 2,733 notes in one 128-beat clip. Its tool call used 71,900
output tokens, about 7.5 minutes. Each of the four 32-beat clips needed a
`cat` of about 18,000 tokens and 16,577 to 18,579 output tokens. The final
Claude context was 381,739 tokens; the Codex context was 139,477.

Both agents rebuilt the same analysis steps: FIELDS parsing, pitch names,
density windows, onset groups, a 100 BPM grid, chord names, and segments. They
also sliced, re-gridded, and split documents. The parse used about five lines
in each agent. No document from either agent failed validation. A transform
tool would copy what the agent scripts already do. The cost came from moving
documents through the model.

## Decision input

[D51](../../decisions/d51-document-file-paths.md) adds `documentPath` and
`documentOutputPath`. [E269](e269-document-file-paths.md) verifies them. The
analysis quality of the first turn and the source-context discovery remain
inputs for the [8i17 survey](../../plan/phase-8/8i17-midi-musical-navigation-survey.md).

## Limits

The trial is one task with one run for each client. The prompts after turn 1
differ. The token numbers come from the client session files. They are not
billed usage. No tokenizer measurement was made.
