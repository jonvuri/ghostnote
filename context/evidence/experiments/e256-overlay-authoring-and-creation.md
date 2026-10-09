---
title: E256 — Overlay authoring and creation
kind: evidence
state: done
updated: 2026-10-09
owner: phase-8i9
---

# E256 — Overlay authoring and creation

## Status

[8i9](../../plan/phase-8/8i9-overlay-authoring-and-creation.md) is complete.
The Timing overlays help has a complete, codec-checked example and two
timing templates with the host basis rule. A refused claim returns
`detail.repair` for the known structure and timing faults.
`add_launcher_clip` takes claims in one call, with the document's clip ID and
no preceding read
([D47](../../decisions/d47-clip-creation-binds-claims-to-the-live-clip.md)),
and has a new D44 limit on claim dependency expansion. Model reference
revision 3. Tool descriptions are `ghostnote-description-v42`. No extension
change; no codec or grammar change. The operator's fresh-client trial passed:
one add call with claims, no refusal, the expected claim states after hand
edits, and a musical pass.

## Before

In the source transcript (8i9 plan), the Timing overlays help gave field
names and equations but no envelope, and no dependency array shapes. The add
created the empty clip, then refused the content: "A replacement with
overlays must use the clip ID of a read". The agent read the new clip and put
the claims with a second edit.

## Changes

- `MODEL-REFERENCE.md` revision 3: the Timing overlays section states the four
  dependency arrays and their entry shapes, and has one example: a desired
  document with a known-source pair on `n1` (declared, resolved: template
  `1/32`, durationIntent `-1/16`) and an unknown-source pair on `n2`
  (measured, unresolved: residuals `1/128` and `-1/32`), with the equations
  worked. The Core and Patch text did not change; the identity, the prompts,
  and the measurements are regenerated.
- The help module and the artifact generator select each example by its
  section, not by position (Core, Patch, Timing overlays: one each).
- `get_document_reference` with Timing overlays adds `templates.timing`:
  `known` and `unknown`, patches that put one nominal and its groove on the
  fixture (the timing example without OVERLAY rows) with no basis, BASE with
  the example ref, and `note`, the host basis rule (`TIMING_TEMPLATE_NOTE`).
  Each template is sealed and applied at load and must equal the example
  claims. Core and Patch requests are unchanged.
- `add_launcher_clip`: after the parse and before any read, the D44 limit
  `claimDependencyExpansion` (4,194,304 units), then the creation check
  (`checkCreation`): the seal in the document's clip ID space and the codec
  validation of every claim. The planner mode `create` binds the clip, the
  coverage, the events, and each claim reference to the live clip ID
  (`bindCreatedClaims`) and computes each current basis under that ID. The
  general `replace` refusal stays.
- Claim repair (`claimRepair`): `overlay-depends`, `dependency-entry`,
  `dependency-minimum`, `overlay-envelope`, `overlay-data`, and
  `groove-timing`. Reference sections Core and Timing overlays; no template
  and no input copy. A parse refusal, an add creation-check refusal, and an
  edit plan refusal (R15, R16) carry it. R22, R28, and an unknown rule keep
  the plain refusal.
- Descriptions: `add_launcher_clip` states the claim rule and the limit;
  `edit_launcher_clip` names the claim templates and replaces the stale-claim
  sentence; `get_document_reference` names the timing templates.

## Offline verification

- `document-help.test.ts`: the timing example in both encodings, each
  envelope with four arrays and the groove's nominal dependency; each timing
  template in both encodings has no basis, seals, applies to its fixture as
  the example claims, and the result parses in both encodings. Twelve
  malformed claims on add and edit, and two timing faults on add: the rule,
  path, and line, the repair case, under 2,048 bytes (largest 809), no input
  copy, 0 host calls.
- `agent-native-clips.test.ts` (8i9): an add with an agent clip ID and no read
  binds the notes and the claims to the live ID and returns current R22
  bases; a role claim with clip and membership dependencies moves to the live
  ID; a valid supplied basis passes and a wrong one refuses with the expected
  basis of the document as sent, before any write; a dangling reference, a
  cycle, and a timing equation refuse before creation (the dangling reference
  has no repair); a content refusal after creation keeps the creation effect
  and its revert; on the created clip, an unrelated edit retains every claim,
  a dependency edit makes only that note's pair stale, a claim removal changes
  no note, a host note move removes the claims of the lost identity, and a
  general replacement with claims still refuses.
- `agent-native-edit.test.ts`: an unknown-source groove with a wrong residual
  refuses at the plan with the timing repair. D45 cases unchanged.
- `call-budget.test.ts`: an add with 16 claims has the add budget
  (`mark 3, tracks 2, read 3, resolve 2, apply 2, delta 4, clipRead 3`); a
  refused claim makes no adapter call. `write-limits.test.ts`: one membership
  claim above the limit refuses `outside-limit` with no call.
- `npm run check` 2,223 tests; `document:conformance` 252;
  `document:bindings` 34; `document:artifacts --check`;
  `document:standalone`; `check-publication-candidates.py --write`.

## Cost

Help and repair: no host turn, no cold read, no write stage (as E255).

| Request | E255 bytes | 8i9 bytes |
|---|---:|---:|
| Core (fields; json) | 4,469; 4,481 | 4,469; 4,481 |
| Timing overlays (fields; json) | 6,806; 6,818 | 13,347; 13,063 |
| All sections (fields; json) | 9,192; 9,255 | 15,733; 15,500 |
| Reference source | 7,980 | 10,736 |

The example adds 2,756 bytes to the source; JSON escaping, two templates, and
the 920-byte note make the rest. No provider tokenizer is bundled; bytes are
not tokens.

Descriptions 44,027 → 44,402 bytes (+375, +0.9 percent); public artifact
123,839 → 124,503 (+0.5 percent). `get_document_reference` 860 → 1,019 (it
names the timing templates); `add_launcher_clip` 2,223 → 2,437 (the claim
rule and the limit) and its schema +216 (the limit text, D44 rule);
`edit_launcher_clip` 4,116 → 4,118 (a replaced sentence).

Creation keeps the add budget: two write stages, three clip captures, no
added call. The check, the ID mapping, and the seal are brain work.

| Case | Offline (fake host) | Live ("New 2") |
|---|---:|---:|
| 28 notes, no claims (control) | 16 ms (plan 5) | 2,157 ms; 77 calls, 53 turns |
| 28 notes, 56 claims | 68 ms (plan 29) | 2,279 ms (plan 47, readback 40); 79 calls, 54 turns |
| 16,384 notes, no claims | 2,479 ms (plan 757) | E248: 6,418 ms |
| 16,384 notes, 13,282 pair claims (the 8 MiB bound) | 17,243 ms (plan 7,071) | — |
| 16,384 notes, 13,498 claims, 4,188,652 units (the limit) | 20,307 ms (plan 8,537); revert 1.4 s | 22,156 ms (plan 8,383, write 3,518, readback 4,969); 77 calls, 53 turns; reverts 3,816 and 1,143 ms |

- Typical: the claims add 122 ms, of which 37 ms is plan and 35 ms is
  readback projection; the host work is the same (one more poll call). The
  E250 256-note add (2,158 ms, 77 calls) has the same fixed host cost.
- Largest admitted case. One pair per note does not fit: the codec's 8 MiB
  native input bound admits 6,641 pairs on 16,384 notes. Dependency
  expansion is the worst graph: a membership dependency projects all clip
  event IDs (11.7 ms for each claim on 16,384 notes) and an overlay dependency
  projects the depended-on envelope (15.5 ms for each claim on a 63 KB
  envelope), at each basis computation. Without a limit, the input bound
  admits about 28,000 membership claims (about 330 s). The limit costs about
  4 s offline; the measured case is the most pairs plus 216 membership claims.
  It is under the 30 s D44 budget. E253 measured 6.3 s of planning for 16,384
  claims on a patch; this add plans 13,498 claims in 8.4 s and validates them
  again at the readback.
- Brain heap: retained 0.4 MiB (typical) and 15–57 MiB (largest cases) after
  GC; 0.9 GiB unswept after the largest call. Linear in notes, claims, and
  dependency entries; no copy for each claim.
- Bitwig heap: 1,096 of 3,072 MiB after the run (undo history keeps the
  deleted material).

## Live check (owned "New 2")

`node --import tsx src/probes/phase8i9-overlay-add.ts live <dir>`
([data](../data/phase8i9-overlay-add/overlay-add.json)), on track
`gn-8i9-overlay`, with known-source and unknown-source pairs on alternate
notes:

| Step | Result |
|---|---|
| Add 28 notes and 56 claims, no read before | verified; notes as sent with the live clip ID; 56 current claims with R22 bases |
| Independent read | the same notes and claims (404 ms) |
| Overlay-only edit: a revised `nom-b0` without basis | route none (836 ms); `groove-b0` stale, because its basis covers the nominal envelope (R22, R23) |
| Dependency edit: `b1` duration | whole-clip, verified (1,756 ms); only `nom-b1` and `groove-b1` become stale |
| Claim removal of the `b1` pair | route none (848 ms); notes unchanged; 54 claims |
| Reversal (dependency edit, content, creation) | each verified; the slot is empty |
| Largest admitted add, then its two reverts | verified; 13,498 current claims with R22 bases on a fresh read |

The track was deleted; the track list equals the list before the run. Two
earlier runs stopped on driver expectations (the overlay-only stale groove;
an empty-slot result shape). A third stopped because the generated largest
clip had half-beat notes (4,194,304 sounding cells): the add wrote, and its
readback refused with `outside-limit` (the reader limit). The track delete
removed it. The generator now uses quarter-beat notes, as E248.

## Operator trial

The operator repeated the original Rain Steps task in a fresh Codex Desktop
session (`codex://threads/01a11fc7-dc4f-7713-bec5-830fa553a715`), on v42 and
reference revision 3, in "Night Glass". Extract:
[trial.jsonl](../data/phase8i9-operator-trial/trial.jsonl). The prompt named
no format, overlay, or tool.

| Measure | 2026-10-09 source trial | 8i9 trial |
|---|---|---|
| Repository reads | yes (lines 40–85) | none |
| Reference requests | Timing overlays, Groups, Meter and tempo | the same, once, with `list_tracks` |
| Format or claim refusals | 0 malformed sends; 1 add refusal after creation | 0 |
| Clip writes | add (empty clip, content refused), then a guarded edit | one `add_launcher_clip`: 32 notes, 64 claims, 2.9 s, verified, no discrepancy |
| Prompt to playing | — | 2 min 39 s; 12 Ghostnote calls before the launches |

- The add used the clip ID `bass` and no basis, with no read before it. The
  readback bound the live ID `c8b` and kept all 32 event IDs; a later read
  returned the 64 claims, and `check_launcher_clips` found the drum ref
  `current`.
- Each note has a declared nominal claim (division `1/4`) and a declared,
  resolved, known-source groove that depends on it. The drum-derived offset is
  in `template`; provenance names the drum event and the drum snapshot sha256.
  This is the shape of `templates.timing.known`.
- The agent launched the five Scene 1 clips one by one (no scene-launch tool)
  and wrote a timing note to its own workspace.

Hand edits, then "read the clip again and report which parts of the timing
interpretation still apply":

| Note | Hand edit | Fresh read |
|---|---|---|
| Bar 1, note 2 | Onset `55/32` → `451/256` | New event `e8c`; `nom_b1_2` and `groove_b1_2` removed |
| Bar 3, note 1 | Length `5/4` → about `17/16`, onset kept | ID `b3_1` kept; `nom_b3_1` and `groove_b3_1` stale with their old data |
| The other 30 notes | none | 60 claims current |

The read reported the hand length as one rounded duration in `data.loss`
(`-217/262144`). The agent called the comparison of the moved note with its
old nominal "historical, not a newly confirmed interpretation", described the
stale pair as context that no longer applies, and wrote nothing. It read the
clip twice: its own script printed the read tool description with the first
result, and the client cut the output.

Operator verdict: the musical result is "perfect"; the brief was met in one
pass.

## Limits

- `edit_launcher_clip` has no expansion limit. A patch can state claims with
  membership or overlay dependencies, and stored claims accumulate over calls.
  An agent that puts hundreds of membership claims on a large clip can make
  one edit take minutes. Not planned: no trial or task needs such claims.
- An add above the reader cell limit (2,097,152 sounding cells) writes, and
  its readback is `unavailable`; the claims are not stored. This is the
  existing add path (E246, E248), not changed here.
- A `read_launcher_clip` of the largest case returns 8.6 MB.

## Retrospective

The offline readback check first called `dependencyBasis` once for each
claim, which validates the whole document each time; at 13,000 claims it ran
for minutes. Check claim bases with one `sealOverlays` of the document.
