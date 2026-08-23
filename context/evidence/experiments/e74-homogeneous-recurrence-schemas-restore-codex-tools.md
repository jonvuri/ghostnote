---
id: E74
kind: evidence
state: active
source: dogfooding-d01-follow-up-1
---

# E74 — Homogeneous recurrence schemas restore Codex tools [K] (2026-08-23)

**Verdict: exact-length homogeneous recurrence arrays remove the common schema
feature that hid five Ghostnote tools, and a fresh Codex session exposes all 45
public tools.**

## A/B boundary

Before the fix, MCP `tools/list` returned 45 names. Five schemas used tuple-style
arrays on the wire:

- `generate_clip_music`.
- `transform_clip_music`.
- `start_clip_music_operation`.
- `write_notes`.
- `add_clip`.

Codex exposed 40 tools and omitted those same five names. The draft-7 wire used
array-valued `items`. Draft 2020-12 conversion used `prefixItems`.

After the fix, MCP `tools/list` still returned the same 45 names. No public
schema used array-valued `items` or `prefixItems`. Fresh Codex session
`01a03069-d710-7150-885e-74845fb88f50` exposed all 45 names. It reported all
five affected tools as callable. The prompt named `write_notes` and prohibited
tool calls, shell calls, file access, and Bitwig changes.

## Contract result

Both recurrence schemas now use a homogeneous number array with `minItems: 2`
and `maxItems: 2`. Validation narrows the output to the contract recurrence
tuple. The five affected tools accept `[4, 5]` and reject `[4]` and `[4, 5, 6]`.
Tool names, descriptions, and the public `[length, mask]` value did not change.
The public description and schema cohort is now v8.

## Verification

- Focused surface and musical-patch tests: 80/80 pass.
- Public description and schema cohort tests: 9/9 pass.
- `npm run check`: 826/826 pass.
- MCP wire inventory: 45 names, zero tuple-style arrays, and zero
  `prefixItems`.
- Fresh Codex inventory: 45/45 names and all five affected tools callable.
- No Ghostnote tool ran during the Codex exposure check. Bitwig content did not
  change.

## Retrospective

Check both draft-7 array-valued `items` and draft 2020-12 `prefixItems`. The two
schema dialects describe the same incompatible tuple boundary.
