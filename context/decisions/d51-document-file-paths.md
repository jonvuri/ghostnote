---
id: D51
kind: decision
state: active
updated: 2026-10-15
source: phase-8i19
---

# D51 — Document files keep large documents out of the conversation

[E268](../evidence/experiments/e268-two-client-midi-chord-trial.md) compared
the same MIDI chord task in Codex and Claude Code. Both agents processed a
3,243-note document in scripts. Codex passed documents from script to tool.
Claude Code had no such route: it read each generated document into its context
and wrote it again as a tool argument. That used 161,362 output tokens, compared
with 10,872 for Codex, and took about 15 minutes longer. The operator approved
file paths for the clip and MIDI document tools. See
[E269](../evidence/experiments/e269-document-file-paths.md) and the
[file contract](../contracts/MIDI_FILE_CONVERSION.md#document-files).

1. Name parameters by their content. `path` stays the MIDI file of the MIDI
   tools. `documentPath` is the input alternative to `document` in
   `add_launcher_clip`, `edit_launcher_clip`, and `write_midi_file`; exactly
   one is required. `documentOutputPath` is the output of `read_launcher_clip`
   and `read_midi_file`; its name states the direction. `inputPath` and a bare
   `outputPath` were rejected: in `write_midi_file` they could name either
   file.
2. The content sets the input encoding. A first record `DOC` with a space or
   tab is FIELDS; a JSON object is JSON. A FIELDS header is reliable at the
   start of a file (R11 and the grammar permit no text before it). JSON key
   order has no meaning, so a JSON file is detected by its first character and
   then validated. `format` sets only returned documents in the clip writers,
   and refuses with `documentPath` in `write_midi_file`.
3. Recommend `.gndoc` for FIELDS and `.gndoc.json` for JSON. Do not enforce
   names. Avoid `.gn`: GN build files use it, and editors and file tools treat
   it as GN.
4. Document files follow the D50 file rules: absolute server paths, regular
   input files without symbolic links, the 8 MiB R28 bound, new outputs only,
   staged atomic publication, and an independent byte readback. A document file
   has no project change ID and no revert. The output destination is checked
   before any host call or MIDI read.
5. A file adds no host call. The call budgets stay unchanged.

This decision supersedes the D50 statement that the first version adds no
temporary document output. The files are explicit outputs that the agent names,
not temporary files. Transforms of document content stay in agent scripts.
E268 found no transform that a script did incorrectly.
