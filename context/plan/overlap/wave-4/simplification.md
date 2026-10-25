---
title: Runtime simplification and contract triage
kind: note
state: active
updated: 2026-10-24
---

# Runtime simplification and contract triage

## Recommendation

Keep the tested edit core in place. First reduce repeated host work and
optional bookkeeping on concrete workflow paths. Extract a small reusable
entry point only when a second consumer needs it. Package movement alone
will not make a Bitwig edit faster.

The user's goal is a useful, functionally correct result with practical
speed and maintenance cost. This can justify less reversal machinery. It
does not imply permission to change unrelated music or report success from
a cached writer value. These are separate choices.

This is a source and historical-evidence assessment. No new timing or live
result was measured. The timings below come from older E records in the
[performance ledger](../../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md).
They identify candidates; they are not 6.1.4 performance claims or estimates
of the savings from a proposed change.

## Selected disposition and D19 assessment

The user selected P01 for T1/T2 and useful T6 changes, expanded R01 for T3,
and C01 for T4 audit and removal. T5 is deferred unless evidence shows a
maintenance or performance cost. See [work-sessions.md](work-sessions.md).
[D54](../../../decisions/d54-recovery-is-not-a-prerequisite-for-requested-edits.md)
now replaces D19's blanket obligation; later sessions must not retain it as
an implicit gate.

**Maintenance burden is visible in current code.** An operation participates
in restore classification (`write-set.ts`), fidelity labels, inverse planning,
stash ownership/last-writer checks, public recovery results, and their tests.
These are real concepts a new capability must currently account for, even
when the caller does not need reversal. Their total development time has not
been measured. Removing the obligation can simplify expansion, but shared
targeting and correctness code must be retained.

**Performance impact is plausible but not isolated.** Full prior-state captures
serve reversal and other checks. T1/T2 contain measured costs; those totals
are not the D19-only share. P01 will attribute them before removing work.
Cheap scalar reversal can stay. Native Grid journal/transaction operations
can be essential host mechanics and are not automatically D19 overhead.

## Concrete candidates

| Candidate | Evidence of cost or burden | Proposed triage and what must remain |
|---|---|---|
| **T1 — Repeated parameter inventories** | The ledger identifies three complete settled inventories on a device control route: prior state, integrity after the final stage, and executor readback. E252 records 3,447 ms for one control on a 281-ID Diva. E247 records 116 wire calls for deleting one container, including parameter reads although deletion cannot restore its opaque state. | First choice for a narrow optimization. Attribute each read to target identity, preservation, verification, or reversal. Reuse a fresh complete read where valid; test one independent post-write inventory that serves both integrity and result checks. For deletion, keep the structure and ownership needed to identify what is removed; test whether unrecoverable parameter capture adds useful information. Do not assume all inventories are duplicates. |
| **T2 — Full clip data for small property changes** | The ledger records two full captures per `set_launcher_clip_properties` target; eight 16,384-note clips took 33.5 s in E252. D38 permits two reads for targeted note edits but keeps three for whole-clip/property edit paths. | Make preservation checks specific to the property and actual host side effects. A rename may need less than a range edit that can affect notes. Prove any narrower capture against content, automation, and human-edit cases. Preserve fresh identity and independent readback. Do not globally remove the second pre-write read. |
| **T3 — Dense semantic claims and basis sealing** | E253 records 6.3 s offline planning for 16,384 claims. E256's largest admitted add, with 13,498 claims, took 22.2 s; E248's no-claim maximum was 6.4 s in a different trial. Claims add no host calls, and calls without current claims do no seal work. | Evaluate claims as an optional authoring/analysis layer in R01. Keep plain notes and patches simple. Test fewer recomputations or a separate metadata layer before changing the format. These extreme workloads do not establish a typical 16 s penalty. Preserve note identity and stale-edit guards independently of musical interpretations. |
| **T4 — Frozen `stable-v1` compatibility** | D40 and E272 already place retirement after Phase 8i. The selectable profile, frozen instructions, older tool/result vocabulary, and legacy behavior witnesses remain. Normal tools also reuse some older implementations. | Strong maintenance candidate with an existing owner. Remove the obsolete public profile and its exclusive machinery, retain shared implementations still used by normal tools, and keep historical fixtures as evidence. This reduces branching and test obligations; no host-speed gain is claimed. |
| **T5 — Full change-record retention and cloning** | `Stash.record()` keeps the full take in an ordered array/map and returns `structuredClone(change)`. `Session.rebuild()` retains the stash across reconnect/project changes while guards invalidate old addresses. No per-record eviction appears in `record()`. Clip creation also has separate creation and content records. | Deferred by the user. Do not run a retention benchmark or redesign by default. Follow a specific measured cost or maintenance dependency only if it emerges. Preserve effects from partial/uncertain writes. Two creation records describe real stages; a combined public operation must not claim atomicity. No measured stash bottleneck is established here. |
| **T6 — Exact-reversal floor and mandatory history policy** | The executor computes fidelity before a write; `floorRefusal()` refuses non-exact prior-state restoration without clearance. D16 retains the historical floor reference. D19 supplied the earlier mandatory change-ID and reversal-evidence policy, now superseded by D54. | This is a policy and expansion-cost candidate, not a measured hotspot. D54 permits useful edits without a promised inverse. P01 may remove recovery-only gates where benefit is concrete; update the affected public behavior and tests. Do not confuse inability to undo with inability to identify or safely execute the requested edit. |

Source anchors:

- [Executor](../../../../brain/src/engine/executor.ts): `runInside`,
  `parameterPreflight`, `snapshotPreflight`, and `verifySources`.
- [Edit tool](../../../../brain/src/surface/agent-native-edit.ts): reuses
  `change.take.verify`; its later comparison is not another host read when
  that snapshot is available.
- [Stash](../../../../brain/src/stash/stash.ts): `record`, `forget`, and
  reversal boundary checks. [Session](../../../../brain/src/session.ts):
  `rebuild`. [Floor](../../../../brain/src/engine/floor.ts): `floorRefusal`.
- [Workspace](../../../../brain/src/surface/workspace.ts): write execution
  records effects; ephemeral launches already bypass durable history.
- [D38](../../../decisions/d38-a-shared-preflight-read-is-the-stash-only-on-the-targeted-route.md),
  [D40](../../../decisions/d40-agent-native-v1-is-the-default-profile.md),
  [E252](../../../evidence/experiments/e252-long-device-write-profile.md),
  [E253](../../../evidence/experiments/e253-overlay-basis-sealing.md),
  [E256](../../../evidence/experiments/e256-overlay-authoring-and-creation.md),
  and [E272](../../../evidence/experiments/e272-8i-gate-close-out.md).

## What is already simplified

The old persistent branching take store is gone. The current stash is
in-memory session evidence, not an on-disk history graph. The clip identity
registry has a 256-live-reference limit and retires stale domains. It is
not the removed resident host-state cache. Read-only and ephemeral actions
already have no reversal record.

[D46](../../../decisions/d46-modulation-writers-claim-the-route-not-the-sound.md)
already removed per-call sound-behavior witnesses from normal modulation
writers. The route suite owns that proof. E254 measured the preset edit at
about 2.1 s versus 7.1 s before; its structural and identity checks stayed.
This is a useful precedent: narrow the product claim and move broad proof
out of every invocation. Do not propose removing that witness again.

Scalar mixer work also shows that guards and reversal can be inexpensive:
E257 measured 32 fields on eight tracks at 272 ms, with a shared preflight
and independent verification. Removing its record is not an obvious priority.
[E257](../../../evidence/experiments/e257-track-mixer.md) and
[E254](../../../evidence/experiments/e254-device-control-identity-and-route-claims.md)
are historical measurements, not current-host benchmarks.

## D15, D49, and the actual policy questions

| Rule | Plain meaning | Relation to the new direction |
|---|---|---|
| [D15](../../../decisions/d15-verification-discipline-settled-2026-07-25.md) | Validate before calling the host. Check the result through an independent handle or a re-pointed one, because a writer can echo a value that never landed. Known host traps have model, conformance, and live evidence. | Functional success is compatible with this. It does not require byte-identical project files, deep undo, or three full inventories. Removing all independent verification would conflict. Reducing its scope is valid when the claimed result and required preservation still have evidence. Changing the three-part trap test obligation would need a specific amendment, not an inference from speed preference. |
| [D49](../../../decisions/d49-revert-fidelity-states-what-the-revert-restored.md) | When a revert runs, report what it restored, what it removed, and what remains missing. Its redo ability is a separate value. | Compatible. It does not require exact reversibility. The decision explicitly adds no host calls. A simpler result schema could replace its vocabulary later, but must not call a merely functional restoration `exact` under today's definition. |
| [D19](../../../decisions/d19-undo-bitwig-s-stack-is-the-human-s-agent-edit-reversal-is-ours-s.md) | Ghostnote owns best-effort agent-edit reversal; durable edits keep their IDs, observed effects, and reversal evidence. Bitwig undo is not assumed to replace it. | D54 now supersedes the blanket reversal/evidence obligation. Existing runtime behavior stays until a selected implementation changes it. No new inverse is required merely to satisfy D19. |
| [D16](../../../decisions/d16-the-executor-write-set-stash-revert-settled-2026-07-26-phase-1-s.md) and current fidelity floor | Some ordinary writes are refused when prior state cannot be restored exactly, unless a named clearance applies. | D54 replaces a universal exact-recovery prerequisite. P01 audits reachable cases and removes recovery-only gates when useful. Freshness and target guards remain separate. |
| D38 | A fresh tool read is reused only where the route cannot silently overwrite unrelated note changes made during planning. | A real limit on reducing reads. Fewer reads need a narrower write, a better host guard, or an explicit concurrency contract. Musical equivalence alone does not protect a person's intervening edit. |

The D54 floor separates three statements:

1. **Result:** the requested musical/structural effect occurred within named
   bounds; required neighboring state was preserved.
2. **Evidence:** identify what was independently checked and what is unknown.
3. **Recovery:** state whether reversal is available, for how long, and with
   what loss. Do not make exact recovery a universal prerequisite.

D54 is the accepted policy successor. Earlier D records are preserved. Runtime
behavior does not change in this planning turn; each implementation updates
its specific promises and descriptions together.

## File authoring and intermediate files

Choose by capability and task-equivalent end-to-end cost. Historical E247
results for two/four native layer chains were about 3.4/4.0 s offline versus
17.5/30.4 s staged. These are evidence for retaining the existing fast path;
they do not predict the cost of a new internal live implementation.

Complete removal of host-format authoring is a conditional architecture
benefit. It becomes a planning input only after every retained use has a
proved replacement with acceptable capability, performance, and preservation.
Current evidence does not establish that. In particular, live remote and
outer-modulator construction still have route gaps. Partial replacement may
leave both implementations to maintain, so it does not earn the full claimed
simplification benefit.

Keep three kinds of files separate:

- Host-format synthesis and staging files used to construct Bitwig state.
- User assets: samples, MIDI interchange, saved projects and presets.
- Agent document files and audio handoff artifacts. These can avoid large
  tool payloads or carry data to Ghostworks.

Removing the first category would not remove the others. E270/E271 found
practical value in file-based document exchange. Do not delete those paths
under a broad "no files" goal. The user's caveat concerns authoring machinery
and intermediate juggling, not a ban on media or portable documents.

## Smallest useful client boundary

`BridgeClient`, session lifecycle, the document codec, and host bindings
already have useful seams. Keep them in the current repository. First expose
an internal reusable entry point around tested operations and use a small
script to detect MCP coupling. Extract only the glue that blocks that use.
A standalone SDK, daemon, or new package hierarchy is not required.

Do not lock every current recovery feature into the public client contract
before T1–T6 triage. Preserve target identity, input checks, completion,
partial-result reporting, and independent verification. Decide optional
history and annotation support independently. The later Python suite can
consume the protocol directly; it does not justify a TypeScript rewrite.

## Selected sessions

[P01](work-sessions.md#p01--edit-path-performance-and-recovery-cost) attributes
T1/T2 costs and simplifies useful recovery-only machinery under D54.
[R01](work-sessions.md#r01--formats-claims-and-public-naming) owns claims,
notation, and naming. [C01](work-sessions.md#c01--audit-and-retire-stable-v1)
confirms and removes the obsolete profile. T5 remains deferred unless a
specific cost emerges. These sessions have concrete acceptance criteria;
no wholesale core extraction or speculative history redesign is scheduled.
