---
id: D70
kind: decision
state: active
updated: 2026-11-08
source: B19 session 1
---

# D70 — Clip writers return the read-back document as a file

Main committed this decision as D67 (18d5a9d); the P01 merge renumbered it because P01 had already used D67.

[E392](../evidence/experiments/e392-r01-real-usage-by-capability-cell.md) and
[E393](../evidence/experiments/e393-r01-round3-real-use-followups.md) found
77 same-turn re-reads of verified writes (2.08 MB, 166 s). A write result had
the new base but neither the live clip ID nor the document, except inline.
Codex also truncated two dry-run results.

## Rule

This extends rule 1 of [D51](d51-document-file-paths.md), which named
`documentOutputPath` as the output of the two read tools only.

1. `add_launcher_clip` and `edit_launcher_clip` take `documentOutputPath`.
   After an applied write with a readback, the file receives the read-back
   document in the `format` encoding, and `readback.documentFile` replaces an
   inline `readback.document`. An edit dry run writes the expected document
   (`expected.documentFile`). A result with status `unchanged` or
   `unavailable` writes no file.
2. The destination is checked before any host call, as D51 rule 4 requires;
   `add_launcher_clip` checks it before the creation.
3. A failed publication after an applied write does not fail the write. The
   result keeps `applied` and its effects and adds warning
   `document-file-unwritten`. The write result is the authority; the file is
   a convenience.
4. Write readbacks return `readback.clipId`, the live clip ID that the next
   edit names. The descriptions state that `verified` is an independent read
   after the write (D15, D38) and needs no second read.

The file adds no host call; the call budgets stay unchanged (D51 rule 5).
