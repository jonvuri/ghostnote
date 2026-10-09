---
title: E255 — Document format discovery and repair
kind: evidence
state: done
updated: 2026-10-09
owner: phase-8i6
---

# E255 — Document format discovery and repair

## Status

[8i6](../../plan/phase-8/8i6-document-format-discovery.md) is complete.
Each document input of `agent-native-v1` states the custom format, carries a
minimal valid example, and names `get_document_reference`. That new pure
read tool returns the reference and validated templates with no host call. A
refused document input returns `detail.repair`. Five fresh Codex agents
created and patched clips with no format guess, no UI edit, and no
filesystem reference search. Tool descriptions are
`ghostnote-description-v41`. No extension change; no codec or grammar change;
the model reference stays at revision 2.

## Changes

- `brain/src/surface/document-help.ts` is the one source. It loads
  `MODEL-REFERENCE.md` and its identity file, derives the templates from the
  two reference examples, and parses each template in FIELDS and JSON when
  it loads. The desired template is the Core example. The patch template is
  the Patch example with the example ref `gnb1.from-read`; a copied template
  refuses with `expired-ref` and writes nothing.
- `add_launcher_clip` and `edit_launcher_clip` start with the format
  statement, carry the desired or the patch example, and state `EVENT`,
  integer velocity, exact fractions, `fields:"all"`, and where BASE and the
  IDs come from. Their `document` parameter text says the same in short form.
  `read_launcher_clip` and `check_launcher_clips` name the reference tool.
- `get_document_reference` (read, first of the document tools): Core always,
  optional Patch, Timing overlays, Groups, and Meter and tempo; format,
  revision, sha256, `templates.desired`, and `templates.patch` with Patch. It
  returns no base, no IDs, and no permission (`authority.kind:
  reference-only`). `read_launcher_clip` keeps its `reference` option.
- `parseProposal` adds `detail.repair` to a codec refusal. It keeps `rule`,
  `path`, `message`, `line`, and `column`, code `invalid-input`, stage
  `input`, and no effects. A repair has `case`, `correction`, and
  `reference` (tool and sections). It can add `found` (the first word of the
  refused line, at most 32 characters) and a complete template of the kind
  that the tool takes. A rule with no known correction keeps the plain
  refusal. A snapshot to edit and a patch to add get case `document-kind`.

| Case | Codec refusal | Template |
|---|---|---|
| `record-keyword` | R01 at a `NOTE` or bare row | no |
| `record-order` | R01 at a known keyword in the wrong place | no |
| `missing-fields` | R10, missing or late FIELDS | yes |
| `row-width` | R10, too few or too many row slots | no |
| `header`, `encoding-mismatch` | R10 or R11: no DOC line, a code fence, or the other encoding | header only |
| `exact-timing` | R05 on at, duration, length, from, or to | no |
| `integer-value` | R04, noninteger pitch, velocity, or channel | no |
| `json-syntax`, `json-envelope` | R11; R01 format or version; a missing top-level field | yes |
| `missing-coverage`, `desired-coverage` | R03; snapshot coverage in a desired document | yes |

## Offline verification

- `document-help.test.ts` (32 tests): templates parse in both encodings and
  the patch applies to the desired template; the desired template is the
  Core example byte for byte. The reference tool works with a host that
  refuses every call (0 calls). Every listed malformed input on both tools
  returns its case, the rule and location, no effects, a repair under
  2,048 bytes, and no copy of an input line. The add and edit examples parse
  as the kind each tool takes.
- `call-budget.test.ts`: `get_document_reference` and a refused document
  input make no adapter call. Valid add and edit budgets are unchanged.
- `npm run check`: 2,182 tests pass.

## Cost

Zero host turns, zero cold reads, and zero write stages for the reference
and for a refused input. Valid add and edit paths are unchanged.

| Request | Result bytes | Brain time |
|---|---|---|
| Core, desired template (fields; json) | 4,469; 4,481 | 0.3 ms |
| All five sections, both templates (fields; json) | 9,192; 9,255 | 0.1 ms |
| One repair (largest, with template) | under 2,048 | — |

The maintained reference is 7,980 bytes; the largest result adds JSON
escaping and the templates. The registry holds no reference copy. No
provider tokenizer is bundled; the bytes are not tokens.

The descriptions grow from 40,881 to 44,027 bytes (+7.7 percent); the
public artifact from 118,907 to 123,839 bytes (+4.1 percent). The
`edit_launcher_clip` description is 4,116 bytes.

## Live check (owned "New 1")

`node --import tsx src/probes/phase8i6-format-help.ts templates <dir>`
([data](../data/phase8i6-format-help/format-help.json)): the desired
template through `add_launcher_clip` verified (2,460 ms, 87 wire calls;
E250 ledger 2,158 ms for 256 notes); a read with Patch help (389 ms), then a
patch in the template form with one ADD and one UPDATE verified (1,546 ms,
45 wire calls; ledger targeted insert 1,367–1,428 ms). A `NOTE` row refused
with `record-keyword` in 1 ms and 0 wire calls. Both live numbers are within
14 percent of the ledger, and the code on these paths did not change. The
track was deleted.

## Fresh agent trials

Codex CLI 0.159.2, `codex exec` from an empty temporary directory, default
model, read-only shell sandbox, ghostnote MCP server from this tree, v41.
No skill, no repository instructions, and no tool sequence in the prompt.
Owned track `gn-8i6-trial` with an 8-beat seed clip in row 0; deleted after
the trials. Transcripts: [data/phase8i6-trials](../data/phase8i6-trials/).

| Trial | Task | Ghostnote calls | Rejections | Reference requests | Other | Time |
|---|---|---|---|---|---|---|
| T1 | Create a 16-beat bass in the first empty slot | list, 2 reads, add, check, show | 0 | none | 1 web search (pitch names) | 48.6 s |
| T2 | Create an 8-beat arpeggio; only `add_launcher_clip` enabled | add | 0 | none (not available) | 1 read-only Bitwig UI inspection (`js`) | 39.4 s |
| T3 | Sparse edit of the seed: two pitches, one pickup | list, read with Patch, edit | 0 | Patch on the first read | — | 32.0 s |
| T4 | Add a supplied malformed document (NOTE, decimals, 0..1 velocity, no coverage) | list, read, add | 0 | none | — | 29.3 s |
| T5 | As T4, but send it as written first | read, add (refused), add | 1 (`record-keyword`) | none | — | 34.0 s |

- Every write verified on its readback; the final documents match each
  request. T3 changed only the two named notes and added the pickup (patch:
  two `UPDATE`, one `ADD`, BASE from the read).
- T1, T2, and T4 used the local example only. T2 shows that the add
  declaration alone is sufficient. T4 corrected all four faults before the
  first send. T5 corrected all four faults after one repair that named only
  the first; one retry. No shell command and no filesystem search in any
  trial. No UI edit; T1 opened the clip in the detail editor (a focus tool),
  and T2 read the Bitwig UI tree once.
- Format-related rejections in the normal trials (T1–T4): 0. The 2026-10-09
  trial had 16 rejected writes in 42 Ghostnote calls. That trial printed the
  tool list through a shell dump that dropped 51 percent of it; `codex exec`
  gives the MCP tools to the model directly, so these runs did not
  reproduce the truncation. The comparison is context only.
- Pitch names (not an error): the prompts named notes but did not state a
  convention. T1 searched the web and used Bitwig's names (60 is C3, so C2
  is 48). T2 used the common names (60 is C4, so C3 is 48). Each agent was
  consistent, and each readback verified the sent pitches. In the Bitwig
  piano roll, T2's notes show as C2 to C3. No description states the
  pitch-name convention.

## Limits and follow-up

- A repair names the first codec error only. T5 fixed the rest from the
  local example. Not planned: the reference codec stops at the first error
  in about 90 places over three stages, and its conformance corpus pins the
  error locations.
- The pitch-name convention goes into the document inputs in
  [8i7](../../plan/phase-8/8i7-track-mixer.md) ("pitch is a MIDI number;
  Bitwig shows 60 as C3").
- The shell-dump truncation that caused the original failure is a client
  limit. 8i6 makes each document tool self-sufficient, but a client that
  truncates the tool list can still hide a tool.
- Not planned: a tool that reports the description version. No agent
  decision depends on it; the cohort fingerprint test pins the wording.

## Retrospective

The first repair trial (T4) did not exercise repair: the local example
removed every fault before the first send. A trial that must exercise a
refusal states "send it as written first" in the task.
