---
title: Phase 8i5 device control identity
kind: plan
state: planned
status: Fix sparse remote selectors, the Sampler witness, and recovery results. Clarify first-read Patch guidance. Then resume the remaining 8i trials.
updated: 2026-10-09
parent: README.md
prev: 8i4-overlay-basis-sealing.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E85, E97, E244, E252; D15, D44
---

# Phase 8i5 device control identity

Fix two failures from the 2026-10-09 bass and sound trial. Preserve the
accepted result in "ice jungle". Use owned fixtures for implementation and
live verification. Source session:
`codex://threads/01a11e47-4319-7050-99b3-f90f47cac6ad`.

## Causes

1. `set_device_controls` refused Blur `Common`, position 7, `Mix`, although
   it came from a fresh read. The page has controls at positions 0, 1, 2,
   3, and 7. `device-controls.ts` indexes the compact array by host position.
   The live adapter correctly finds the stored `index`. The result reported
   `internal`; no write occurred.
2. The ADSR wrapper targeted Sampler `CONTENTS/FILT_FREQ`, named
   `Filter Frequency`. Its structural stages and scalar fingerprint passed.
   Its behavior witness failed after the move. DirectParameter observers
   supply no modulated value, and the typed parameter families omit Sampler.
   The fallback searches remote controls by equal name. Sampler returns
   `Filt Freq` at `Overview`, position 2, so it finds none.

Both failures reproduce offline. The review's 56 focused tests pass and
miss the sparse selector failure. The later six filter samples cannot prove
the new ADSR caused the movement: the preset already had filter modulation.
A visible assignment and active target are separate facts.

The [interface review](8i-trial-2-interface-review.md) traces the extra calls
to response limits, recovery work, and agent-side output choices. Include
its first two priorities in this session: clear witness failure results and
Patch help with the first edit read. Keep preset, discovery output, and
modulator type guidance as separate candidates.

## Entry reads

- [Performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md),
  [D15](../../decisions/d15-verification-discipline-settled-2026-07-25.md),
  [E85](../../evidence/experiments/e85-general-directparameter-modulation-targets-are-live.md),
  [E97](../../evidence/experiments/e97-bounded-settlement-and-nested-colourcopy-reliability.md),
  and [D44](../../decisions/d44-long-writes-are-optimized-then-bounded.md).
- `brain/src/surface/device-controls.ts`, `engine/modulator-authoring.ts`,
  `engine/existing-device-wrapper.ts`, `engine/modulation-target.ts`, and
  `adapters/live/adapter.ts` (typed supplements and `remoteState`);
  `brain/src/surface/agent-native.ts` (clip read description and reference).
- `extension/` `Rig.java`, `handlers/ParamHandlers.java`, and
  `generated/NativeDeviceCatalog.java`; the local API 25 definitions.
- Matching engine, surface, live adapter, and extension harness tests;
  `brain/src/surface/call-budget.test.ts` and `description-cohort.ts`.

## Work

1. Resolve a remote control by its stored host `index`, not its compact
   array position. Check page identity, control identity, and uniqueness.
   Audit other write, guard, and readback paths for this assumption. Return
   a known selector refusal for a missing or changed target. Keep complete
   inventory and independent readback guards.
2. Prove an ID-bound Sampler behavior handle before changing the product.
   Preferred small repair: add a typed Sampler family with
   `createSpecificBitwigDevice` and `createParameter`, following the current
   families. Confirm the catalog UUID and parameter IDs. Measure the smallest
   family that covers the admitted Sampler targets. Merge observed fields
   into DirectParameter rows by exact ID. Keep the full name check within
   the DirectParameter API.
3. Review the equal-name remote fallback. A remote label does not prove
   DirectParameter identity. Do not add abbreviation aliases or fuzzy matching.
   Use an API identity binding or an independently proved mapping. Otherwise
   report that the behavior witness is unavailable. Decide and record the
   compatibility rule for existing equal-name fallback users. Check witness
   availability before wrapper insertion; unsupported targets must refuse
   before mutation. Keep post-move checks for later observer failures.
4. Keep proof claims precise. State the authored route and amount separately
   from observed target activity. Test a clean target with an inactive control
   arm and a target that already has modulation. Do not report that divergence
   alone proves which modulator caused it. Keep unknown automation and unstable
   base refusals. Make witness failure results useful at the top level: state
   target identity, witness availability, the failure cause, proved stages,
   and the valid next action. Distinguish unavailable observation from an
   observed inactive target. Keep detailed evidence, the proved location,
   and the reversal checkpoint. Recommend a proof retry only if supported;
   do not direct the agent to manual remote samples as a replacement proof.
5. Add regressions: Blur `Common/Mix` at position 7; other sparse pages;
   stale names and duplicate indices; Sampler full and short names; missing
   typed handles; changed devices and nested routes; unknown automation;
   inactive targets; and recovery after a later witness failure. Preserve
   the distinction between no write and partial completion.
6. Clarify `read_launcher_clip` guidance. For a planned patch edit, request
   `reference:["Patch"]` on the first fresh read. Explain that `reference`,
   `data.document`, and `authority.base` come in the same result. Tell the
   agent to retain them together. Keep the complete document and fresh-base
   contract. Do not add a reference tool, change the read payload, or require
   Patch help for reads that do not need it.
7. Update affected descriptions and result contracts in this session. State
   the supported witness, preflight refusal, and partial recovery. Bump
   `TOOL_DESCRIPTION_VERSION` and its public artifact when descriptions change.
   Keep `stable-v1` frozen where its contract requires it. The remaining call
   efficiency candidates need their own scope before implementation.

## Cost model

One sequential wire turn costs about 24 ms. The control repair adds no read,
write stage, or host turn. It adds an index lookup in the brain. The typed
Sampler direction reuses the current `param.list` reply. Confirm the turn
count with traces; do not assume the new family adds no settle cost.

| Case | Reads and write stages | Expected cost and reference |
|---|---|---|
| One Blur remote write | Current complete order, preflight, scalar stage, integrity check, independent readback | No added turn; E250 one control 2.4 s; E252 native one control about 2.6 s |
| 64 settings on 4 routes, D44 limit | Current cohorts and stages; no extra inventory for index lookup | No added turn; E252 4 Diva routes 22.5 s is the largest measured route mix |
| One Sampler ADSR wrap | Current 5 structural stages and behavior reads; add a preflight witness read only if current reads cannot supply it | E252 one wrap 13.6 s; the typed supplement can remove the remote fallback inventory; measure the net change |
| 15 modulators, wrap limit | Same structural stages, shared sample rounds, bounded complete inventories | E252 15 LFOs 13.6 s; measure the largest affected Sampler witness set and reversal |
| Unsupported witness | Preflight reads only; no write stage | At most one added complete witness inventory if needed; record turns against the current post-move failure |
| First read with Patch help | One current clip read; append the existing reference locally | No added host turn; record reply bytes. The reviewed revision used three reads; one can supply document, base, and help |

Clearer failure results add no host turn. Measure their reply size. Call
savings depend on agent behavior; verify them in a fresh agent trial.

Heap: remote arrays stay compact. A typed family adds a bounded number of
host handles and observers at initialization, plus rows in the current reply.
Record handles, observers, reply bytes, and measured heap. Do not create
unbounded handles per request. Keep D44 bounds and the 45 s direct-call
ceiling. Update call budgets and the ledger if a host call changes. Explain
a measured regression above 20 percent.

## Live procedure

Use an owned scratch track in "New 2", "New 3", or a new owned project.
Preserve the accepted bass, both chord clips, and other "ice jungle" material.
Check `pgrep -f phase8` and run one foreground driver chain.

If the extension changes, run `./gradlew copyExtension` from `extension/`.
Ask the operator to remove the controller fully and select the final matching
`ghostnote` product in the complete list. Wait for confirmation. Then run
`npm run probe:hello`; check profile, method count/hash, initialization time,
and a deliberate build marker. A toggle or redeploy is not a reload.

Measure the Blur remote write and revert; compare the direct-ID write.
Prove the Sampler wrapper on a clean note-driven fixture with active and
inactive controls, then reverse it. Test existing modulation separately.
Run the largest affected admitted case and reversal. Print wire calls and
gaps. Restore each fixture to baseline in `finally`.

Use a fresh agent on an owned clip for a small patch edit. Supply the revised
tool descriptions and the task, with no additional repository tutorial. Record calls,
reply bytes, and model round trips. Check whether the first read requests
Patch help and retains the document and base through the edit. Identify any
repeat read made only for help or a base already returned. Keep reads required
by operator changes or stale state. Report the result without assuming savings.

## Acceptance and handoff

- A returned sparse selector writes and verifies the exact remote control.
  Invalid, ambiguous, or changed selectors refuse before mutation.
- Sampler filter behavior uses proved parameter identity. The short remote
  label does not affect routing or verification.
- An unavailable witness refuses before wrapper mutation. A later failure
  returns the proved location and a usable reversal checkpoint. Preflight and
  later witness failures expose the cause, available proof, and valid next
  action at the top level. Test unavailable and inactive outcomes separately.
- Activity claims do not attribute existing modulation to the new route.
- Read guidance states how one result supplies Patch help, the complete
  document, and the fresh base. Existing response and preservation contracts
  stay unchanged. Record the fresh agent trial and any remaining repeat reads.
- Focused tests, `npm run check`, extension checks, relevant wire goldens,
  call budgets, `LANG=en_US.UTF-8 ruby context/check.rb`, and
  `git diff --check` pass. Live gates and exact cleanup pass.
- Record measurements as E254 and the witness policy as D46, if still free.
  Add index rows. Update the ledger, capability reference, descriptions, and
  8i charter. State the new description version or that no description changed.
  Stage only session changes; do not commit.
- Route NOW to the remaining 8i groove and overlay dependency trials.

## Retrospective

Use host indices and ID-bound observations in fixtures. Dense fake pages and
matching labels can hide live identity failures. Keep compact reply shapes
when testing selectors.
