---
title: E245 — Document read compactness and gain meaning
kind: evidence
state: done
updated: 2026-10-07
owner: phase-8h4b2
---

# E245 — Document read compactness and gain meaning

## Status

[8h4b2](../../plan/phase-8/8h4b2-document-read-compactness-and-gain.md) is
complete. A new Bitwig note now reads with no `WITH`
object. A live typical read is 10,951 bytes (E235: 90,778). FIELDS is 10.7
percent of the equivalent exact JSON on the live typical clip and 27–35
percent on the 8c corpus. Gain has a measured meaning. The independent
raw-read agreement check passes live with the new rules.

Tokens: FIELDS is 31–40 percent of the equivalent exact JSON on the 8c corpus
and 14.7 percent on the live clip for Claude Opus 5.5 and Sonnet 5.5, and
36–45 percent and 18.1 percent for Claude Haiku 4.5. See [Tokens](#tokens).
Other providers were not measured.

The extension and the wire did not change (88 methods, `68d457c4c4d1d7b3`).
Tool descriptions are at v27. [D35](../../decisions/d35-document-gain-range-and-release-velocity-default.md)
records the two field-rule changes.

## Gain meaning (live)

Driver `brain/src/probes/phase8h4b2-defaults.ts probe`. Owned unsaved project;
normal profile; track `gn-8h4b2-gain`. The operator drew five C3 notes and set
the inspector gain. The driver then wrote five notes with the raw setter.
Artifact: [probe.json.gz](../data/phase8h4b2-defaults/probe.json.gz);
`verify-offline` recomputes each claim. The ad-hoc reads after the run are in
[addendum.json](../data/phase8h4b2-defaults/addendum.json).

| Source | Inspector | Raw `gain` | Portable |
|---|---|---:|---:|
| Drawn note, unchanged | 0.0 dB | 0 | 1 |
| Inspector -inf | -inf | 0 | 1 (see below) |
| Inspector, one tick above -inf | -120 dB | 0.01 | 1e-6 |
| Inspector -6 dB | -6 dB | 0.7943282347242815 | 0.5011872336272722 |
| Inspector 0 dB, typed | 0 dB | 1 | 1 |
| Inspector +6 dB | +6 dB | 1.2589254117941673 | 1.99526231496888 |
| Inspector maximum | +18.1 dB | 2 (setter 1) | 8 |
| Setter 0 | 0.0 dB | 0 | 1 |
| Setter 0.25 / 0.75 | -18.1 / +10.6 dB | 0.5 / 1.5 | 0.125 / 3.375 |
| Setter 1e-12, 5e-324, 1e-4 | -inf | 2e-12, 1e-323, 2e-4 | cube |
| Setter -1 | not changed | 1 (prior value) | — |

Raw gain `r` shows `60*log10(r)` dB, so the amplitude ratio is `r^3`. The read
is twice the setter (E24). The inspector shows -inf below raw 0.01.

**Raw 0 is ambiguous.** A new note and setter 0 read raw 0 and sound at 0 dB.
An inspector -inf note also reads raw 0. NoteStep has no other gain accessor
(installed API documentation). The binding projects raw 0 as unity, so an
inspector -inf note reads as unity. The description and HOST-BINDING state
this. The operator accepted this rule after the search for a second accessor
found none.

**Portable 0 has a write.** Setter `5e-324` reads raw `1e-323`, shows -inf, and
projects to portable 0. The D9 inverse uses it.

**Exact spelling.** About three binary64 portable values share one raw value.
The projection returns the shortest spelling whose `cbrt` is the raw value.
Raw → portable → raw is exact for every sampled raw value (cube in the normal
range). Every portable value with one to six decimals reads back unchanged
after a write; a random 17-digit value reads back as a neighbour 63 percent of
the time. Plain `r^3` would show 0.9 as `0.9000000000000002` after a write.

## Host insertion defaults (live)

All five drawn notes read: velocity 100, release velocity exactly `100/127`,
gain 0, timbre 0, chance 1 enabled, occurrence `ALWAYS` enabled, recurrence
1/1 enabled, and repeat enabled with count 0. E235 saw the same on notes
written through the API. Release velocity therefore uses the portable default
`100/127` (D35). The binding-level default that the plan preferred conflicts
with R04 omission semantics.

## Implementation

- `bindings/ghostnote-document.ts`: `portableGain` and `hostGain` (the cube law,
  raw 0 as unity, the silent raw value). `projectRawClip` maps an enabled
  control with a neutral value (chance 1, `ALWAYS`, recurrence 1/1) to the
  portable default. `d9MappedFields` writes `hostGain`; the gain refusal above
  2 is gone because portable 0..8 is the host range.
- Spec: FIELDS, schema (gain maximum 8), R04 text, Model format reference
  revision 2, and HOST-BINDING (gain row, "Gain zero", "Neutral enable flags",
  release velocity row, readback rule). Binding corpus B15–B17 added; B04–B06
  updated.
- `surface/agent-native.ts`: the read and check wrappers drop the constant
  coverage lists and the all-zero loss block. The description states the
  uncovered fields, the D23 facts, and the gain ambiguity.
- Probe lib: `agreement` checks gain by its defining property
  (`cbrt(portable) = raw`, raw 0 unity) and applies the neutral-flag rule
  independently; `withIssues` requires `WITH` exactly for a raw row that is
  not a host default. E235's `verify-offline` used the old rules; it
  reproduces only at commit `32655d0`.

## Removed distractions

Measured on the fake typical E231 clip (256 notes) unless stated.

| Item | Bytes | Result |
|---|---:|---|
| `WITH` per host-default note (gain, flags, release velocity) | ~260 per note; ~66,000 per typical read | Removed by gain, flag, and default rules |
| Wrapper `coverage` lists and reasons | ~280 per result | Removed; COVERAGE record and description state them |
| Wrapper `loss` block when nothing moved | 174 per result | Removed; present when timing moved |
| Wrapper `source` block | 206 | Kept: shared envelope; names the reference revision |
| COVERAGE record field list | ~200 per document | Kept: required semantic coverage (R04) |
| Event IDs (`e1`…, base-36 counter) | 2–4 per row | Kept: already minimal |
| `clip` and `mute` columns | ~9 per row (~2,300) | Kept: R26 fixes the canonical binding; a change is a spec change |

## Measurements

| Measure | 8h4b2 | E235 |
|---|---:|---:|
| Live typical result bytes (FIELDS) | 10,951 | 90,778 |
| Live FIELDS document bytes | 9,903 (38.7 per note) | 79,535 (~310 per note) |
| Live JSON document bytes | 23,799 | 91,639 |
| Live `WITH` rows | 0 | 256 |
| Live equivalent exact JSON | 92,469 (FIELDS 10.7%) | — |
| Live wall time, first read | 574 ms | 599 ms |
| Live wall time, six reads | median 592, 574–607 ms | median 658, 599–678 ms |
| Live stale check result | 11,029 bytes | 90,856 bytes |

8c corpus (`launcher-clip-document.test.ts` pins):

| Fixture | Notes | FIELDS | Equivalent exact JSON | Ratio | 8c control fields | Ratio |
|---|---:|---:|---:|---:|---:|---:|
| short | 12 | 1,528 | 4,330 | 35.3% | 2,200 | 69.5% |
| medium | 47 | 4,673 | 16,818 | 27.8% | 8,495 | 55.0% |
| long | 94 | 9,006 | 33,674 | 26.7% | 17,133 | 52.6% |

The equivalent exact JSON states every represented field of each note (the
document coverage, defaults expanded). The 8c control fields column uses only
the 8c note fields without `track` and `articulation`. It has no chance,
occurrence, recurrence, spread, or transpose, and it holds release velocity
as MIDI 64, which the document must state as `0.5039370078740157` on each row
(about 45 bytes). The acceptance criterion uses the first comparison, as the
plan decided.

## Tokens

`POST /v1/messages/count_tokens` with one user message that holds the document
text. The key came from the repository `.env`. Counts below subtract the
request overhead (the count of a one-character message: 9 tokens, or 8 for
Haiku). Data: [tokens.json](../data/phase8h4b2-document/tokens.json). Claude
Opus 5.5 and Sonnet 5.5 gave identical counts.

| Document | Opus/Sonnet 5.5 FIELDS | Exact JSON | Ratio | Haiku 4.5 FIELDS | Exact JSON | Ratio |
|---|---:|---:|---:|---:|---:|---:|
| 8c short | 846 | 2,125 | 39.8% | 671 | 1,493 | 44.9% |
| 8c medium | 2,648 | 8,252 | 32.1% | 2,136 | 5,788 | 36.9% |
| 8c long | 5,130 | 16,531 | 31.0% | 4,177 | 11,623 | 35.9% |
| Live typical | 6,695 | 45,605 | 14.7% | 5,856 | 32,273 | 18.1% |

The token ratio is higher than the byte ratio. A likely reason: JSON punctuation and repeated
keys cost few tokens per byte, and FIELDS rational timing (`1365/512`) costs
more. The 40 percent target is a byte target; in tokens the short fixture is
at 39.8 percent for the 5.5 models and above it for Haiku 4.5.

## Live acceptance

Driver `brain/src/probes/phase8h4b-document-read.ts accept`, with the new
rules. Owned unsaved project. Artifact:
[accept.json.gz](../data/phase8h4b2-document/accept.json.gz); `verify-offline`
passes with no issue.

| Step | Result | Agreement / WITH |
|---|---|---|
| Read twice | `new`, then `current`; same ref and document | 0 issues; 0 WITH rows |
| Operator velocity edit (ch 1, pitch 36, 100 → 56) | `stale`, 256 IDs kept, 0 minted | 0 issues |
| Operator pitch edit (ch 9, pitch 44 → 45) | `stale`, 255 kept, 1 minted | 0 issues |
| Scene append | both refs `identity-changed`; next read `new` | 0 issues |

The inspector shows velocity as a percentage (100 is 78.7 percent). The
operator set 44.2 percent (56). One raw read refused during the edit and the
retry passed (E235 rule).

## Verification

Brain check (1,986 tests), binding corpus (18), document conformance, and the
three offline verifiers pass. `stable-v1` registration is unchanged
(`c16f2a9b…`). The v25 and v26 description artifacts stay frozen.

## Retrospective

The plan's first release-velocity candidate conflicted with R04 snapshot
omission; only reading R04 beside the candidate showed it. A plan that offers
a binding-level default should check it against the format's omission rule.
The gain probe needed one extra operator step because the first protocol had
no finite low value: a value probe should include the lowest finite setting
next to the -inf setting.
