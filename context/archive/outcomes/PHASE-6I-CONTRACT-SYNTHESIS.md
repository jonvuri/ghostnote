---
title: Phase 6i — Workstation contract synthesis
kind: plan
state: complete
status: Complete. Contracts selected; provider implementation remains in Phase 7.
updated: 2026-09-20
parent: ../../plan/phase-6/README.md
prev: ../../plan/phase-6/6h-agent-sensory-packet-utility.md
next: ../../plan/phase-6/6j-verification-cost-audit.md
---

# Phase 6i — Workstation contract synthesis

## Purpose

Combine the Phase 6 results into small independent workstation contracts. Define
the smallest experimental surface needed for Phase 7 dogfood. Do not implement
the provider modules in this session. Review all custom and non-standard
interfaces as one system before Phase 7 implements them.

## Starting facts

- E103 proves exact project-local master capture.
- E104 selects exact-version SQLite FTS5 document retrieval.
- E105 selects FFmpeg and a long-lived librosa worker for audio facts.
- E113 selects no perceptual provider.
- E109 and E110 select exact note facts and replaceable theory and voicing
  helpers.
- E118 selects task-routed paired evidence and minimal MIDI and audio packet
  fields. Its experimental packet schema needs the cross-interface audit.
- Sessions 6f through 6h, including 6f1 and 6f2, select the agent context,
  patch, groove, reference, and sensory-packet boundaries.
- The agent musical language has a version registry and a pure conformance
  corpus. It is one interface family in the larger workstation system.

## Work

1. Inventory every custom or non-standard interface that Phase 7 can use. This
   includes public tool schemas, extension wire frames, exact-state and change
   records, agent context and proposal languages, reference and sensory packets,
   documentation records, audio artifacts and facts, and preset or donor
   manifests.
2. For each interface, record its owner, purpose, authority, producers,
   consumers, transport or storage form, version, identity, provenance,
   coverage, units, defaults, loss rules, failure behavior, and stability.
3. Draw the producer-to-consumer seams. Confirm that each interface has one
   focused purpose and one authority boundary. Require an explicit projection
   or translation when two formats share data.
4. Check common field semantics across every seam. Include identities, hashes,
   beat and time units, provider versions, coverage, warnings, failures, and
   ownership.
5. Define small, versioned contracts for the Bitwig adapter, documentation,
   symbolic context, exact patch compilation, audio capture, and audio facts.
6. Define shared source identity, artifact identity, provenance, coverage,
   provider, capability, warning, and failure fields.
7. Separate exact observations, derived measurements, agent interpretations,
   edit proposals, verified outcomes, and operator verdicts.
8. Define module discovery and startup behavior. A missing executable, Python
   environment, model, cache, or Bitwig connection must disable only the module
   that needs it.
9. Record which Phase 6 probes are retained as regression tools, extracted into
   product code, archived as evidence only, or removed in Phase 8b.
10. Define an explicitly experimental Phase 7 dogfood surface. It is not the
   stable public contract and can change or disappear after a run.
11. Update the Phase 7 menu from the selected exploration results.

## Acceptance criteria

- Each module has explicit inputs, outputs, dependencies, startup behavior, and
  failure isolation.
- The interface inventory covers every custom format used at a planned Phase 7
  boundary. Each format is classified as retain, merge, revise, or retire.
- Each retained format has a distinct purpose and authority. Any overlap has a
  named projection, translation, or consolidation plan.
- Each connected producer and consumer has a compatible fixture or a precise
  blocker. Boundary adapters are explicit and testable.
- The interface map covers exact state to agent context to proposal to compiler
  to guarded write and readback. It also covers capture to audio facts to a
  sensory packet and documentation source to retrieval result.
- Each read result declares source identity, provider version, coverage, and
  fact or estimate authority.
- The symbolic contract keeps complete exact state outside agent-generated
  prose and patches.
- Each risk-bearing patch requires exact target guards and independent readback.
- No rule, model, or agent label is reported as an exact fact.
- The operator retains every aesthetic acceptance decision.
- Phase 7 has one focused implementation brief per module boundary.
- No provider implementation, dependency installation, or live mutation occurs.

## Out of scope

- Implementing all providers proved feasible in Phase 6.
- A stable public theory, generation, capture, or audio-analysis surface.
- A second DAW adapter.
- A public perceptual provider.
- Broad analysis capabilities without a selected Phase 7 task.

## Retrospective target

Record which interface overlap was hardest to resolve and which shared field
prevented the most adapter-specific special cases without hidden shared state.


## Session result

The [contract reference](../../evidence/format/WORKSTATION_CONTRACTS.md) selects
six module boundaries with explicit inputs, outputs, dependencies, startup and
failure isolation. The [inventory](../../evidence/format/WORKSTATION_INTERFACES.md)
classifies 24 interface families. The [seam ledger](../../evidence/format/WORKSTATION_SEAMS.md)
connects them through 17 named seams, each with an existing component fixture
or a precise implementation blocker. These are design results, not new live
provider evidence.

The selected overlap resolutions are:

- Exact host state stays in the adapter. A private exact-source wrapper supplies
  complete note coverage, digest domain and a source-scoped event map.
- Compact/groove context stays a view. Provider and annotation authority belong
  in the module result outside the frozen strict v0 grammar.
- Note proposal v0 and deterministic musical patch v1 keep separate syntax.
  They meet at complete candidate state and the recorded typed write path.
- The standalone groove proposal prototype merges into a future compiler
  revision. It is excluded from initial 7b because its probe checks fixed objects.
- Reference context reuses compact context and typed measurements. Source
  permission, used coverage, copy metrics and operator verdict remain distinct.
- Sensory packet v0 becomes a planned v1 projection of task-selected facts. It
  owns pairing and limits, not measurement or exact note state.
- Capture emits a verified artifact. File analysis consumes it in a separate
  call. Documentation extraction consumes fully validated source bytes.

The initial Phase 7 surface needs no new broad provider. It starts with exact
source and compact context, then four guarded proposal operations. The first
file comparison uses FFmpeg fields from E118; it needs no librosa metric.
Music21 remains optional for a selected theory task. Musicpy and model providers
are not part of the initial implementation. All six Phase 7 briefs and the task
menu now name the selected boundaries and conformance gates.

## Compatibility findings

1. Probe hashes do not share a canonical domain. The planned wrapper fixes a
   serializer and requires golden cases in 7a. It does not relabel old hashes.
2. Context track identifiers cannot accept every host UUID. The source wrapper
   must supply a reversible alias map. Note IDs are scoped to one exact source.
3. Probe note defaults include pressure, but the host cannot write it. The
   product compiler must prove neutral omission or refuse; it must preserve
   fidelity limits for other state.
4. The public overlap policy and the probe collision refusal differ. Candidate
   translation cannot silently shorten a note under an agent invariant.
5. MasterRecorder is still probe-only. Phase 7e must add typed adapter coverage
   and bounded lifecycle handling before exposing capture.
6. The retrieval probe's cache reader validates less metadata than the retained
   TypeScript cache library. Phase 7c must use the complete validation gate.
7. Audio probe coverage uses prose, inclusive sample ends, stereo assumptions
   and executable defaults. Phase 7d must pin sample/time-base conversion,
   frame/tail and channel rules before claiming compatible measurements.

These gaps are explicit Phase 7 blockers. The 6i acceptance criteria permit
precise blockers instead of fixtures for unbuilt connections. No end-to-end
compatibility claim is made for those connections.

## Acceptance check

| Criterion group | Result |
|---|---|
| Module contracts and independent startup/failure | Six modules and shared discovery/lifecycle rules in the contract reference |
| Complete format inventory and overlap classification | I01–I24; each row includes producer/consumer, version, authority and field/failure semantics |
| Connected fixtures or precise blockers | S01–S17 and field translation table; all new live paths have named successor gates |
| Exact state → context → proposal → compile → write/readback | S01–S08; complete state stays outside agent output and D9/D15/D21 remain |
| Capture → facts → sensory and docs → retrieval | S11–S14; artifact identity, coverage and provider authority remain explicit |
| Operator authority and evidence separation | Shared authority table and S16; explicit audition verdict only |
| Probe disposition and focused successor briefs | Inventory disposition table, 7a–7f briefs/menu and 8b handoff |
| No provider implementation, install or live mutation | Documentation-only changes; no external calls or live project access |

## Verification

- Focused existing component checks: 92 tests passed; zero failures or skips.
  The command used `node --import tsx --test` from `brain` with
  `musical/agent-context.test.ts`, `musical/patch.test.ts`,
  `musical/planner.test.ts`, `adapters/live/wiremap.test.ts`,
  `probes/phase6b-document-cache-lib.test.ts`, `observation/record.test.ts`,
  `surface/musical-surface.test.ts`, and `surface/operations.test.ts` under `src`.
- `ruby context/check.rb`: passed for 321 active documents.
- `git diff --check`: passed. The session link check also covers the archived
  outcome, which the standard context checker excludes.
- No full provider, extension build, model call or live test was required for
  this contract-only session. Existing tests do not close new seam blockers.
- No live project, fixture, provider dependency or generated media was changed.

## Retrospective

The hardest overlap was exact source identity across probe notes, compact
context and paired sensory fields. A hash without its domain concealed different
payloads and serializers. The shared source reference, with digest domain and
coverage, removed the most adapter-specific assumptions.

Keep one indexed seam ledger with explicit mappings and blockers. It avoids
repeated searches across probe scripts and prevents a passing producer test from
being mistaken for consumer compatibility. The context guide now links this
route. No repository-wide instruction change is needed.

## Handoff

Run [6j](../../plan/phase-6/6j-verification-cost-audit.md). Classify existing
verification and translation costs. Keep unbuilt costs unknown unless existing
evidence can bound them. Do not implement providers or reduce safety checks.
