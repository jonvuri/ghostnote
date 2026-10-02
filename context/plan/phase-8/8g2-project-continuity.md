---
title: Phase 8g2 — Project continuity and guarded target updates
kind: plan
state: active
status: Ready. 8g1 is complete. Resolve project and target guards before live budget work.
updated: 2026-10-02
parent: 8g-shadow-project-cache.md
prev: 8g1-review-fixes.md
next: 8g3-snapshot-and-global-budgets.md
---

# Phase 8g2 — Project continuity and guarded target updates

## Entry and scope

Complete [8g1](8g1-review-fixes.md). Read the [review ledger](../../evidence/format/PHASE8G_INTERMEDIATE_REVIEW.md),
E215, the later E214 results, cache contract, and document identity rules.
Reuse accepted cold replay, 26 selected replay cases, both 18-case reuse runs,
paired reload, no-chain, and delivered-event controls. Repeat them only for a
named regression risk. Keep 8g active; do not enter 8h.

## Owned files and interfaces

- `RootIdentityProbe.java`: loaded-instance witness, delivered epochs, fresh
  getters, and coherent guard construction.
- `ShadowCacheProbe.java`: target settlement, pool acceptance, guarded
  reconciliation, comparison, exact output, and retained read windows.
- `ShadowProjectCache.java`: only the identity/token seams needed by the adapter.
- `ShadowInventoryRebuild.java` and `ShadowAuthorityFallback.java`: only guard
  interfaces affected by the chosen protocol.
- `ShadowCacheHandlers.java`: experimental controls required by that protocol.
- Identity, no-chain, ordering, chain, and reload drivers, focused tests, and
  corresponding artifact verifiers. Preserve prior artifacts as separate runs.

The fixed pool algorithm and selected callback API are accepted inputs.
Physical callbacks supply coordinates; settled current-target reads supply
values. Do not require universal callback source attribution.

## Work and independent oracles

1. Describe the current host update window precisely: native project command,
   root getter change, delivered epoch, cursor target change, target confirmation,
   acquisition, and final publication. Separate API assumptions from measurements.
2. Exercise transitions at each guard boundary in the host model. Include a
   change during final metadata, guard construction, reconciliation, snapshot
   enrichment, retained output, and inventory publication.
3. Define a protocol that cannot reuse a logical reference on unproved loaded
   continuity. Copied roots, names, hashes, and equal endpoints are insufficient.
   A changed initialization domain must reject every old reference.
4. Test an unseen A–B–A transition explicitly. The external native command log
   proves the detour independently of controller trace and bridge samples.
   Capture command times, both instances, engines, callbacks, and acquisition
   lifetime. Equal before/after roots must not supply continuity by themselves.
5. Cover no-chain, copied loaded roots, close/reopen, reload, and changed chain
   structure through the selected protocol. Use existing paired evidence where
   it directly answers a criterion. Do not add content to obtain a witness.

## Acceptance criteria

- Every admitted binding and published value has one explicit guarded target
  window. Changes or uncertainty retire the binding and discard pending/output
  state before it can be used.
- A detour with equal endpoints cannot retain old refs unless continuity has
  independent proof. No-chain or unavailable witnesses use explicit refusal or
  the existing authority boundary; they cannot infer cache eligibility.
- Unseen A–B–A has a measured result or a stated conservative protocol that
  refuses reuse by construction. A delivered-event A–B–A is not its substitute.
- Copy, reopen, and reload conclusions retain their measured scope. Save within
  the same loaded generation preserves identity only under the stated protocol.
- Old callbacks and tokens cannot mutate a new domain. Cancellation is terminal
  across later polls. Recovery requires an explicit new attempt and fresh values.
- API assumptions that cannot be measured remain named assumptions. Do not call
  silent callback loss a proved defect.

## Checks, live cleanup, and stopping rule

Run focused guard/adapter/core/coordinator tests and all affected artifact
mutants. Run the full required checks from the intermediate plan at handoff.
For a live build, use the repository's full remove/add reload sequence and check
the deliberate marker as well as fresh hello. Record the exact entry baseline.

Use owned disposable projects and exact ownership records. Never save or close
original `New 1`. Restore tracks, scenes, slots, selection, cursors, pins, config
bytes, normal runtime, and engines. Close owned tabs and remove exact owned files
only after ownership and hashes are checked. Keep viewport scope explicit.

If a command misses the acquisition window, a witness is ambiguous, or an
authority read fails, retain a diagnostic and stop that acceptance arm. Do not
count it or retry automatically. If the host cannot provide the required window,
record the smallest vendor question and a conservative refusal. E214's four
vendor questions remain unsent unless the user authorizes sending them.

## Exit

Publish the protocol, results, assumptions, and any explicit unsupported states.
8g3 live work can start only after its acquisitions have a usable guard decision.
If continuity remains unresolved for an intended cache path, leave that gate
open. Stage this session's changes without a commit and update NOW.
Suggested commit message: `feat: fence shadow acquisitions by project and target window`.
