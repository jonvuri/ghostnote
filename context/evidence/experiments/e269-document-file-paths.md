---
title: E269 — Document file paths
kind: evidence
state: done
updated: 2026-10-15
owner: phase-8i19
---

# E269 — Document file paths

## Result

[8i19](../../plan/phase-8/8i19-document-file-paths.md) fixes issue D14 from
[E268](e268-two-client-midi-chord-trial.md), as
[D51](../../decisions/d51-document-file-paths.md) states.
`add_launcher_clip`, `edit_launcher_clip`, and `write_midi_file` take
`documentPath` as the alternative to `document`. `read_launcher_clip` and
`read_midi_file` take `documentOutputPath`. The
[file contract](../../contracts/MIDI_FILE_CONVERSION.md#document-files) has
the rules.

The file content sets the input encoding. Results name the file in
`documentFile`: path, format, bytes, and SHA-256. A read output also has
`readback.status`. The shared file core (`brain/src/files/local-file.ts`) now
serves MIDI and document files. MIDI messages and codes are unchanged.

Descriptions are `ghostnote-description-v51`, 44 tools, fingerprint
`877303235b4df1d9db5e6540a31964a3d86395dd573838075dca58be5495775b`. The five
tools above have new descriptions and inputs. The other 39 tools are
unchanged. The [artifact](../data/phase8i19-document-files/descriptions-v51.json)
records the complete cohort; v50 is frozen. The controller remains 8i15.

## Cost

Cost model before the work: zero added host turns, cold reads, or write
stages. Each path adds one local file read of at most 8 MiB, or one staged
publication and one byte readback. Typical case: a 653-note clip (27 KB).
Largest admitted: a 16,384-note document (675 KB); R28 allows 8 MiB. Heap: the
document text exists in both routes, so the file adds only its read buffer.

The call-budget test asserts the same counts with and without a file for a
read, an add, and a patch edit. A refused destination or a missing input file
makes no host call. The [offline data](../data/phase8i19-document-files/offline.json)
uses the E268 source file and a generated 16,384-note case:

| Case | Inline result | File result | File read | Publish and verify |
|---|---:|---:|---:|---:|
| 3,243 notes, 240,353 document bytes | 251,600 bytes | 1,723 bytes | 0.26 ms | 5.7 ms |
| 16,384 notes, 674,732 document bytes | 692,370 bytes | 1,459 bytes | 0.50 ms | 6.5 ms |

The file times are medians of five runs. The full read tool times (122.6 and
476.1 ms with a file; 132.5 and 470.7 ms inline) are conversion times. Writes
from a file took 83.7 and 334.9 ms and verified. All notes round-tripped.

The [live data](../data/phase8i19-document-files/live-read.json) reads
`chords - codex` row 0 of `lie sword` (653 notes) on the 8i15 build. Inline
and file reads alternated, three times each. Each repeated read made 14 wire
calls; the first inline read made 12, because no earlier ref existed. Times:
inline 386–452 ms, file 401–406 ms; read stage 330–356 ms in both. The
results were 28,712–28,733 and 1,045–1,052 bytes. Each file equalled the
inline document, with the same base. The change is within the noise; there is
no regression.

## Verification

The new tests (`document-files.test.ts`, nine tests) cover: encoding
detection; MIDI read to a file; occupied, missing-parent, and relative
destinations; MIDI write from FIELDS and JSON files; exactly one input; the
`format` refusal; prose, invalid UTF-8, BOM, symbolic link, missing,
directory, and oversized input files; a file-only round trip of add, read,
patch edit, and MIDI export; codec refusals with line and repair in the clip
writers and in `write_midi_file` (file and inline); an empty
slot; and the `differs` and `unavailable` output readbacks. One call-budget
test is new.

`npm run check` passes: TypeScript and all 2,368 tests. The offline driver
removes its files. The live driver made no project write and removed its files.

Reproduce from `brain/`:

```sh
node --import tsx src/probes/phase8i19-document-files.ts /absolute/file.mid
node --import tsx src/probes/phase8i19-live-read.ts "<track name>" <row> 3
```

The review found that `write_midi_file` codec refusals kept only rule and path.
They now also keep line, column, and `detail.repair` for file and inline
documents, as the clip writers do. The repair uses the desired-document
templates. Descriptions do not change.

The `agent-native-v1` server instructions no longer have the MIDI file
sentence or the delete sentence. Codex puts the instructions at the start of
each tool description (E126), so each sentence repeated 44 times there. The two
MIDI descriptions already state that file writes have no project change ID or
revert. The delete sentence was wrong for `delete_launcher_clip`, which
`revert_change` can restore; each other delete tool states that it cannot be
undone. The tool descriptions and the v51 fingerprint do not change.

## State and limits

No live project changed. The live check used only reads. No live add or edit
ran with a file: the open project is the operator's, and the call budgets
prove equal host calls. The other returned documents (a stale refusal, a dry
run, or a `document` readback) stay inline. No client trial has used the new
parameters yet. A file is not atomic with the host write that reads it; the
result states its hash.

## Retrospective

The trial comparison found the issue: one client had a script-to-tool route and
the other had none. Test an agent workflow in each supported client before a
document interface is final.
