---
title: Phase 8i19 — Document file paths
kind: plan
state: done
status: Complete. E268 records the two-client trial; E269 verifies the file paths (D51).
updated: 2026-10-15
parent: README.md
prev: 8i18-midi-snapshot-export.md
---

# Phase 8i19 — Document file paths

## Source and scope

The operator compared a Codex and a Claude Code session on one MIDI chord task
([E268](../../evidence/experiments/e268-two-client-midi-chord-trial.md)). The
Claude session wrote each generated document again as a tool argument. The
operator approved file paths for the clip and MIDI document tools and settled
the names and the extension convention ([D51](../../decisions/d51-document-file-paths.md)).

Add `documentPath` to `add_launcher_clip`, `edit_launcher_clip`, and
`write_midi_file`. Add `documentOutputPath` to `read_launcher_clip` and
`read_midi_file`. Detect the input encoding from the content. Do not add
document transforms or analysis; they stay in agent scripts and in 8i17. Do
not change the Document 1.0 codec, the controller, or a host call.

## Acceptance

- Exactly one of `document` and `documentPath`. File results name path,
  format, bytes, and SHA-256. Read outputs verify the published bytes.
- Refuse invalid files before any parse or host call: missing, not regular,
  symbolic link, over 8 MiB, invalid UTF-8, no recognizable first record.
  Codec refusals keep rule, line, and repair.
- Refuse an existing output or missing parent before any host call or MIDI read.
- A file-only chain works: add from a file, read to a file, edit from a file,
  export from a file.
- The call budgets do not change. Measure the result size and the file stages
  offline, and rerun a live read with and without a file.
- Update descriptions to v51 with the artifact, the contract, the ledger, D51,
  E268, E269, the issue log, the indices, and NOW. Stage only session changes.

## Cost

Zero added host turns, cold reads, or write stages. One local file read of at
most 8 MiB, or one staged publication with a byte readback, for each file.
Typical: a 653-note clip of 27 KB. Largest admitted: a 16,384-note document of
675 KB, with the R28 bound of 8 MiB. Compare with the E265 and E267 file costs
(6.3–59.1 ms for a MIDI write and verify).

## Result

[E269](../../evidence/experiments/e269-document-file-paths.md) records the
implementation, the equal call budgets, and the measurements. A file reduces
the 3,243-note read result from 251,600 to 1,723 bytes. The live read cost
did not change.
