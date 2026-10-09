---
title: Phase 8i4 overlay basis sealing
kind: plan
state: done
status: Complete (E253, D45). edit_launcher_clip computes the R22 basis of each claim that the call states. Next: 8i5 device control identity before the remaining 8i trials.
updated: 2026-10-09
parent: README.md
prev: 8i3-long-device-write-profile.md
next: 8i5-device-control-identity.md
evidence: E235, E236, E245, E253; D21, D35, D36, D45
---

# Phase 8i4 overlay basis sealing

## Result

Complete ([E253](../../evidence/experiments/e253-overlay-basis-sealing.md),
[D45](../../decisions/d45-the-edit-limb-seals-explicit-overlay-claims.md)).
The policy below was accepted with the refusal for a supplied basis that
does not match (`detail.expectedBasis`). A desired claim is stated when it
omits `basis` or differs from the stored claim. No grammar or codec API
change. The live check ran in "New 3", the open owned project, on the
driver's own track.

## Cause

A current overlay must carry its R22 `basis`: a SHA-256 over the R26
canonical JSON of its dependency projection. `validateSemantics` checks it
(`brain/src/document/semantic.ts`). The model reference says "Use the
supplied dependency-basis utility for a new claim"
([MODEL-REFERENCE.md](../../../spec/ghostnote-document-v1/MODEL-REFERENCE.md),
Timing overlays). The benchmark prompts supplied that utility. No
`agent-native-v1` tool supplies it, and the R22 refusal does not return the
expected value.

An offline check in the 8i review (2026-10-08) put one nominal claim through
`edit_launcher_clip` with `OVERLAY_PUT`:

| Basis | Result |
|---|---|
| Omitted | `invalid-input`, R12 (required field) |
| 64 zeros | `invalid-input`, R22 (basis does not match) |
| Computed with `dependencyBasis` | Applied |

The tests compute the basis with the repository helper, so they did not
find this. The [8i](8i-agent-native-hybrid-dogfood.md) trial set needs a
groove task and an overlay dependency change, and the agent gate forbids a
repository tutorial. A fresh agent cannot author a claim without
reimplementing R22, R25, and R26.

## Policy to decide

The codec has the utility: `sealOverlays(state)` sets the basis of each
explicit current claim in dependency order and then validates
([CODEC.md](../../../spec/ghostnote-document-v1/CODEC.md)). It is for an
explicit new or revised claim. It is not a repair of stale claims and must
not make a stale claim current
([IDENTITY-AND-OVERLAYS.md](../../../spec/ghostnote-document-v1/IDENTITY-AND-OVERLAYS.md),
lifecycle).

Recommended direction: `edit_launcher_clip` (and `add_launcher_clip`) act
as the supplied utility.

- Seal only the claims that the call states explicitly: each `OVERLAY_PUT`
  in a patch, and each current claim in a desired document that is new or
  differs from the stored claim. Seal against the proposed state after the
  note changes of the same call.
- Never reseal a retained claim, a stale claim, or a claim that the call
  does not name. Normal stale propagation stays.
- Input: accept an omitted `basis` on an explicit current claim. Decide
  whether a supplied basis that does not match is replaced (with a warning)
  or refused (with the expected basis in `detail`). Prefer the refusal for a
  supplied value: a wrong value can mean a wrong dependency list.
- Output: the stored and returned document is a valid Document 1.0 with the
  sealed basis. The portable grammar and the model reference revision stay
  unchanged, unless the session proves that the input rule must be a
  grammar change; then treat it as a reviewed spec change.

Record the accepted rule as a host binding rule and a decision record (D45,
or the next free number after 8i3).

## Entry reads

- `spec/ghostnote-document-v1/` `SPEC.md` (R12, R21–R26), `CODEC.md`
  (`sealOverlays`, `dependencyBasis`), `IDENTITY-AND-OVERLAYS.md`,
  `HOST-BINDING.md`, and `MODEL-REFERENCE.md`.
- `brain/src/document/index.ts` and `semantic.ts`;
  `brain/src/bindings/overlay-carry.ts`; `brain/src/surface/agent-native-edit.ts`
  (`parseProposal`, the plan, and the overlay store) and
  `agent-native-clips.ts` (`add_launcher_clip`).
- `brain/src/surface/agent-native-edit.test.ts` (the overlay tests and the
  `nominal` helper) and the codec conformance package.
- E236 (overlay lifecycle under live edits), D21, D36.

## Work

1. Write the input rule and the sealing step in the edit limb. Parse the
   proposal with the basis optional only for the explicit claims; keep every
   other R12 and R22 check.
2. Seal in dependency order, so that a groove claim that depends on a new
   nominal claim in the same call gets a basis over the sealed nominal
   envelope.
3. Add tests with agent-shaped input (no repository helper): a nominal put;
   a groove put that depends on a nominal put in the same patch; a desired
   document with a new claim; a supplied wrong basis; a put of a claim on a
   deleted event (refuses); an unrelated note edit (claim stays current); a
   dependency change (claim goes stale and is not resealed); a later read
   returns the sealed claim. Keep the existing helper-based tests.
4. Update the `edit_launcher_clip` (and, if it changes, `add_launcher_clip`)
   description: the tool computes the basis of each explicit current claim.
   Do not change the portable model reference for a host behavior; if the
   wording "the supplied dependency-basis utility" needs a pointer, put it in
   the tool description. Bump `TOOL_DESCRIPTION_VERSION` and its public
   artifact; report the new version.
5. Run `check-publication-candidates.py --write` if a spec, codec, or
   migration contract changes.
6. Live check: one owned clip in "New 2". Put a nominal and a groove claim
   with agent-shaped input, read back, make an unrelated edit (current), a
   dependency edit (stale), and remove the claim (notes unchanged). Revert
   and remove the fixture.

## Cost model

No new host turn. Sealing is hashing in the brain. The overlay store is in
the server process.

| Case | Host work | Expected cost |
|---|---|---|
| Patch with one or two `OVERLAY_PUT` and no note change | The E248 targeted edit route with no note stage: mark, reads, no apply of notes | Edit refusal or no-op route is about 400 ms (E246); a put without note writes should be in that range plus the readback |
| Desired document, typical clip, a few claims | The whole-clip route (E247 1.7 s) | Sealing is expected to add little (hashing only); measure it in the planner test |
| Many claims at the reader limit | Sealing is linear in claims and their dependency fields | Add a planner-time case to `phase8h4g-inventory.test.ts` if the claim count is unbounded; keep the 4,000 ms planner budget |

Heap: the overlay store holds the sealed claims as before. Call budgets do
not change; the call-budget test must pass unchanged.

## Acceptance

- A fresh agent can put a nominal and a groove claim with no basis and no
  repository helper, and the result is a valid document with the correct
  basis.
- Retained and stale claims are never resealed; R22 still refuses a
  supplied wrong basis or names the expected one, as decided.
- Overlay lifecycle tests (E236 matrix) still pass; notes never change on a
  claim remove.
- Call budgets are unchanged; the planner budget passes.
- Tool descriptions are updated, the version is bumped, and the model
  reference revision is unchanged (or a reviewed spec change is recorded).
- `npm run check`, codec conformance, `document:artifacts`,
  `context/check.rb`, and `git diff --check` pass. "New 2" ends at its
  baseline.

## Records and handoff

Record the evidence as E253 (check the number is free) and the rule in the
host binding and a decision record. Update the 8i charter and
`context/NOW.md`: resume the second 8i dogfood trial in "ice jungle".
