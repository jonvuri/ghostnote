---
title: Phase 8g2 project continuity protocol
kind: evidence
state: active
updated: 2026-10-02
owner: phase-8g2-project-continuity
---

# Project continuity protocol

## Decision and scope

[8g2](../../plan/phase-8/8g2-project-continuity.md) uses conservative refusal.
The live adapter has no independent input window. It refuses new residence,
warm reuse, forced canary acquisition, comparison, exact shadow acquisition,
and inventory publication. A canary cannot prove project continuity.
The stable E131 reader retains its authority. No live cache result is eligible.
8g remains active. Do not enter 8h.

This session has no new live trial. It makes no unseen A–B–A measurement.
Refusal closes that acceptance arm by construction. The live continuity gate
remains open. [8g3](../../plan/phase-8/8g3-snapshot-and-global-budgets.md)
can start offline. Its intended live acquisitions remain unsupported.
Do not enable a positive path with a config flag, a bridge command, or a
sampled equality result. A later live path needs an independent input fence.

Entry HEAD is `1a0f9c6`. The index and worktree were clean. The staged-work
statements in the earlier handoff describe the prior session. This session
stages only its own changes and makes no commit.

## Current host update window

The previous adapter used this sequence. The host API does not document one
atomic window for all these steps.

| Boundary | Implementation or retained measurement | Limit |
|---|---|---|
| Native project command | The separate E214 log places B at 01:31:08.238–01:31:09.158 UTC during acquisition. A runs at 01:31:19.734–01:31:20.218 UTC after retirement. | One B overlap. This is not an unseen A–B–A trial. |
| Root getter change | Fresh interested getters are compared with delivered observer values. E214 retains stable B and changed brackets. | Separate RPC samples do not prove atomic getter state. |
| Delivered epoch | Root and chain changes advance a local epoch. The synchronous listener retires state without host reads. | This epoch counts delivered changes. It cannot count an unseen transition. |
| Cursor target change | Unpin clip and track; select the track; confirm and pin the track; select the slot; confirm and pin the clip. | Commands request changes. They do not document a native input fence. |
| Target confirmation | Read track ID, clip existence, slot row, and both pins. Require the same expected address and guard. | Equal current values alone cannot exclude a completed detour. |
| Acquisition | Physical callbacks supply coordinates. Read all channels on the confirmed current target. Compare guards before and after work. | Subscribed change delivery is an API assumption. Universal source attribution is not required. |
| Final publication | Recheck metadata, callbacks, address, domain tokens, and the external guard. Retained output needs another current-window check. | Publication requires continuity across the full acquisition lifetime. |

The accepted B overlap has 193 samples, 66 B brackets, one changed bracket,
zero current outputs, and zero trace drops. It proves retirement in that trial.
See [E214](../experiments/e214-shadow-cache-content-and-lifecycle-gates.md#narrow-the-remaining-ordering-question).
Do not infer silent callback loss from an unsampled native transition.

## Guard and refusal rules

[RootIdentityProbe](../../../extension/src/main/java/com/ghostnote/extension/RootIdentityProbe.java)
keeps observation coherence separate from acquisition admission. A guard has
an initialization nonce, delivered epoch, source fingerprint, chain IDs, and
an independent continuity window. Fresh source values must agree with their
delivered values. Read the independent window before and after construction.
A change rejects the guard.

An independent window must identify one loaded generation and target update
window. Its value must change on every relevant transition, including both
legs of A–B–A. It must fence native input, target updates, note reads, and final
publication. It must not reuse a value after a detour. Reading this revision
must not call the host from an invalidation callback. These are model provider
requirements. No available live provider is asserted to meet them.

The public live constructor supplies no continuity window. Thus even a coherent
root and four unchanged chains cannot admit acquisition. The package constructor
accepts a provider for host-model tests only. No runtime config or handler
supplies a positive provider. The public adapter also refuses when no identity
probe is attached. Its separate package constructor permits a fixed host model;
that test mode is absent from live construction and grants no eligibility.

[ShadowCacheProbe](../../../extension/src/main/java/com/ghostnote/extension/ShadowCacheProbe.java)
uses the same decision for pool reservation, direct point, forced canary,
settlement, reconciliation, comparison, exact shadow reads, and inventory.
A changed fresh guard retires the old domain before it can admit new work.
Guard checks include the initialization nonce. Equal numeric epochs from a
new initialization reject all old guards and cache tokens.

Refusal reasons are `identity-probe-unavailable`, `identity-witness-unavailable`,
and `project-continuity-unproved`. Source read failures retain their specific
reason. Refusal retires residence, clears physical hints and retained snapshots,
cancels scans and exact output, and detaches inventory staging. Later polls
cannot revive cancelled work. Recovery needs an explicit new attempt, a usable
guard, a new reference, and fresh values. Forced canary replay cannot bypass
refusal. Save preserves identity only inside a proved loaded generation.

Retained snapshot status now checks the guard before and after output assembly.
[Inventory status](../../../extension/src/main/java/com/ghostnote/extension/ShadowInventoryRebuild.java)
also rechecks the external window. A changed window invalidates the registry.
Cancellation of a published registry is terminal and makes no provider reads.
Exact fallback already checks its guard after final metadata and on retained
output. Its live source now refuses the same unproved window as residence.

The new build markers are `8g2-root-continuity-refusal-v1` and
`8g2-shadow-continuity-refusal-v1`. This build was checked but not deployed.
The older marked drivers and reports retain their measured protocol. Their
positive results do not authorize acquisition in this build.

## Independent model controls

The host model can change native input revision without changing delivered
root observations. Its command record and revision are separate from the
controller trace. These controls are tests, not live command or engine evidence.

| Control | Result and scope |
|---|---|
| Unseen A–B–A with equal endpoints | The model records B then A without callbacks. Equal guards remain inadmissible in the public protocol. Every acquisition route refuses. Old references and tokens stay retired. |
| Independent revision across an unseen detour | A changed model revision retires old state despite equal roots and epochs. Explicit replay and fresh independent values recover under a new reference. |
| Change during guard construction | The before/after revision mismatch rejects coherence. |
| Change during target confirmation and pool acceptance | Pending residence stays private. The changed window cancels all reservations before acceptance. |
| Change during reconciliation | The membership read cannot publish across the revision change. Residence is retired. |
| Change during snapshot enrichment | Partial fields and the candidate snapshot are discarded. |
| Change during final metadata | A revision change after authority reads discards both authority and cache output. |
| Change before retained output | Status retires the binding and exposes no retained snapshot. |
| Change after inventory publication | Status refuses the registry. Later polls do not reacquire. Explicit recovery uses a new attempt. |
| Changed initialization with equal counters | The old guard fails the nonce check. Existing core tests also reject old callbacks, snapshots, and rebuild tokens. |
| No chain or no probe | Direct point, forced canary, pool, exact, and inventory paths refuse. They create no residence. |

Existing delivered-event tests still cover changes during membership,
enrichment, and authority reads. Core and coordinator tests cover cancellation,
late tokens, final metadata, final inventory publication, and explicit recovery.
The selected replay and fixed pool algorithms retain their accepted scope.

## Copy, reopen, reload, structure, and save

[E215](../experiments/e215-root-identity-and-observer-reuse.md#existing-chain-witnesses)
retains eleven endpoint captures. Exact copied packages have equal saved bytes
and roots but different loaded chain UUIDs. Close/reopen changes the four chain
UUIDs. Paired full controller reload preserves the four UUIDs while the
extension nonce changes. These measurements remain separate from continuity.
No-chain and changed source structure cannot supply a chain identity witness.

The conservative protocol refuses copied roots, reopen, reload, changed chain
structure, and equal original endpoints. It adds no content to obtain a witness.
A reload changes the initialization domain even if every saved root matches.
A model save inside the same fenced generation preserves the reference. Live
save continuity remains unsupported. No new live copy, reopen, reload, or save
count is added.

## Checks and live state

The focused extension checks pass: 52 adapter groups, 30 core groups,
16 inventory groups, ten fallback groups, and nine pool groups. Brain `check`
passes typecheck and all 1,692 tests, including retained report mutants.
Extension `check` passes all model checks and all four archive checks.
All five artifact verifiers pass their 3, 3, 9, 13, and 18 retained reports.
Active wire checks pass at 85 normal, 90 capture, and 97 probe methods.
Context links and staged/unstaged diff checks pass at handoff.
The existing reflective coverage test still warns about a future JDK restriction.

No deployment, live command, fixture creation, save, close, or engine action
occurred. Historical reports and manifests are unchanged. The retained baseline
remains the handoff source: four ordered tracks, eight scenes, 32 empty slots,
selection, cursors, pins, exact config bytes, and the normal runtime. Original
`New 1` must stay open and unsaved. Viewport scope remains 7–15 versus entry
14–22. No identical viewport claim is added.

E214's four vendor questions remain unsent. The smallest continuity question is
whether the API supplies a monotonic loaded-project and target revision that
fences native commands, interested getters, note reads, and observer delivery,
including a completed A–B–A detour. No answer is assumed.

## Later delivery measurement

[E216](../experiments/e216-delivery-coalescing-and-callback-coherence.md)
measures the window after this refusal. Two project commands in one controller
callback leave identity values unchanged in 21 of 35 detours. In 12 of them, one
tick reads P identity with Q notes. Detours across separate callbacks are seen
in 50 of 50 trials. One callback reads a confined delivered state. Step-data
deltas arrive in all 35 same-callback detours. These results support refusal
of identity-only admission. They do not enable acquisition.
[D26](../../decisions/d26-step-data-delivery-is-a-named-assumption.md) accepts
complete step-data delivery as a named assumption.
[8g2b](../../plan/phase-8/8g2b-step-delta-read-window.md) designs and tests a
step-delta read window under it.

## Retrospective

Keep observation coherence and acquisition admission separate. Check retained
inventory windows, and keep callback cancellation free of provider reads.
No repository instruction change is needed.
