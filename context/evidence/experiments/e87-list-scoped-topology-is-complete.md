---
id: E87
kind: evidence
state: active
source: phase-5-session-5l
---

# E87 — List-scoped topology is complete [K] (2026-08-27)

**Verdict: One exact 5k semantic location now selects one internal modulator
list for add, replace, retarget, amount, or delete. The edit requires the exact
inspected fingerprint. Its result reports the semantic location and public
before and after inventories without an internal list selector.**

## Safety boundary

The editor reads the file once, checks its SHA-256 and byte length, and resolves
one complete semantic mapping before it prepares a project write. Missing,
stale, ambiguous, and unsupported locations refuse before `apply()`.

Add, replace, and delete rebuild the ordered unique modulator GUID set across
the complete container. Each edit confirms that all sibling semantic
inventories are unchanged. Retarget and amount preserve object count and
metadata size. The list-local instance-id rule and the global `f4` and `f6`
rules remain valid.

Sampled-preset tests prove the four reference stubs move by the exact donor and
resident footprint deltas. An unknown footprint refuses before a project write.

## Live proof

The Bitwig 6.0.6 proof used the owned four-entry Instrument Layer fixture. A
semantic add on its outer container list loaded one exact `Random` page. A
semantic retarget on the nested Polysynth list kept one exact nested `Vibrato`
page and reported the changed public target. Both takes reversed to an empty
owned track. Cleanup restored the exact entry track list.

DirectParameter divergence was not used for this fixture. Its free-running
Vibrato stayed near zero during the bounded sample windows. Exact outer and
nested page inventories supplied the accepted live witnesses.

## Verification

- All five operations pass on plain and selected-list fixtures.
- Sampled add, replace, and delete prove all four stub deltas.
- The Python oracle and full brain check pass 912/912.
- The extension Gradle gate passes.
- `npm run probe:phase5l-topology` passes all live and cleanup rows.
- Diff whitespace checks pass.

## Retrospective

Let page witnesses select a nested device. A container-level page inventory
cannot prove a modulator page on one selected nested list.
