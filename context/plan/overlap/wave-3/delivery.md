---
title: Delivery, verification, and release inputs
kind: note
state: active
updated: 2026-10-24
---

# Delivery, verification, and release inputs

A host setter is only part of a feature. Target identity, bounded work,
readback, recovery, descriptions, and compatibility determine whether that
feature can enter the normal surface.

## Shared acceptance boundary

Use [repository instructions](../../../../AGENTS.md), the
[decision index](../../../decisions/INDEX.md), and the
[performance ledger](../../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md).

| Dimension | Requirement for candidate work |
|---|---|
| Target and permission | Check project, target, and selection before live writes. Keep destructive verbs directed and separate. Index/name equality alone does not establish identity. |
| Input and work limits | Validate the complete request before effects where possible. Bound host calls, traversal, allocation, queues, and admitted input. |
| Freshness and concurrency | Refuse stale bases and competing writers. A person's edit must not silently become an agent-owned effect. |
| Independent readback | A setter echo is not proof. Keep `verified`, `differs`, and `unavailable` distinct, with recorded effects even when readback fails. |
| Reversal | Restore only a named owned effect while guards hold. State identity/content loss and removed objects. Host undo is not the product inverse. |
| Selection | Restore only within the proved scope and report residual movement. Some operations and concurrent clicks have known limits. |
| Native internals | Use exact-build admission, owned write lock, uncertain-state latch, and independent capture. Never retry an uncertain write automatically. |
| Public wording | Update descriptions in the implementation session. Bump the description version and artifact, counts, and consumers when required. |
| Live validation | Match the check to the changed host boundary. Restore owned scratch and the agreed baseline. Exact saved-byte restoration applies when promised or tested. |

Relevant settled decisions are D15 (verification), D19 (undo ownership), D20
(directed destructive tools), D44 (long-write limits), D46 (route versus
sound claims), D49 (revert fidelity), D52 (Grid admission), and D53 (ordinary
operator consent). [E258](../../../evidence/experiments/e258-selection-effects-and-unavailable-readback.md)
and [E264](../../../evidence/experiments/e264-device-add-revert-report.md)
show why these are scoped contracts rather than universal guarantees.

## Cost inputs for later comparison

These are existing measurements, not estimates for unimplemented features.
The ledger and named E records retain the workloads and host versions.

| Existing operation | Retained result | Interpretation |
|---|---|---|
| DirectParameter setting, one Polysynth control on 6.1.4 | About 2.31 s, 66 calls; E330 | A scalar tool can still need identity acquisition and verification |
| One Diva control on 6.1.4 | About 3.45 s, 80 calls; E330 | Plug-in inventory and host work can dominate |
| Four-field mixer write after reopen on 6.1.4 | 261.630 ms, 15 calls; E330 | Existing bounded scalar path; not a send benchmark |
| Launcher copy on 6.1.4 | 869.414 ms, 37 calls; E330 | Content and fixture limit comparison |
| Native composition, offline backend, two/four chains | About 3.4/4.0 s; E247 ledger rows | Can be much cheaper than staged host construction for its admitted shape |
| Staged composition, two/four chains | About 17.5/30.4 s; E247 ledger rows | Structure changes can require many guarded stages |
| Largest admitted clip rewrite | About 7 s; E247/E248 | Sparse edit cost is a different workload |
| Modulation route conformance suite | 160 s for 18 checks; E254 | Occasional proof cost, not a per-tool-call cost |

[E330](../../../evidence/experiments/e330-update-audit-614-acceptance.md)
does not establish a matched old/new performance verdict for every path.
Grouped-note timing and Grid-research timing retain unresolved comparison
limits. Do not present those samples as a general regression or a stable SLA.

Before implementation, each new live path needs its own cost model. Remeasure
when calls, traversal, waits, allocation, or limits change. Explain budget
changes in the evidence record. Compare equivalent per-call workloads for
regressions over 20 percent. Do not repeat uncertain writes for timing.

## Delivery records

DL-1 through DL-6 come from the Phase 10 briefs and backlog. DL-7 through
DL-9 are the three items in the Phase 10 README's "publishable artifacts" list
that had no record: the format working spec, the device and parameter-ID
catalog, and the extension itself. [10a](../../phase-10/10a-bwmod-publication-review.md)
explicitly excludes the catalog and the extension from its scope, so DL-8 and
DL-9 are Unresolved until an owner and a redistribution review exist.

| ID | Capability | Status | Qualifier | Cells | Source route | Required proof or decision |
|---|---|---|---|---|---|---|
| DL-1 | Release and upgrade live suite | Planned | — | none (delivery) | Phase 10c | E330 supplies a current upgrade run, not the complete reusable release policy. Reconcile its drivers and the route suite with 10c. |
| DL-2 | Standalone bwmod package | Planned | — | none (delivery) | Phase 10a | Review every file's origin. No new editor in that session's scope. No runtime Python or host dependency in the selected package. |
| DL-3 | Document 1.0 and benchmark publication package | Planned | — | none (delivery) | Phase 10b | Keep portable format, host binding, benchmark denominators, and reproduction separate. Review redistribution and exact candidate hashes. |
| DL-4 | Retire stable-v1 | Planned | backlog item | none (delivery) | Phase 10 and E272 | Remove frozen-only paths after preserving migration records and checking current consumers. Do not delete conformance witnesses without replacements. |
| DL-5 | Installation, cross-platform paths, extension packaging, and compatibility policy | Planned | backlog item; live evidence is macOS only | none (delivery) | Phase 10 | Current live evidence is macOS. A portable API is not proof of Windows or Linux behavior. |
| DL-6 | Correct contradicted working references | Candidate | proposed bounded documentation session | none (delivery) | Current format spec, parser comment, and later primary checks | Narrow documentation correction only. Preserve historical E and D records and measured byte-surgery invariants. |
| DL-7 | Publish the .bwpreset format working spec | Candidate | Phase 10 publishable artifact without a brief | none (delivery) | Phase 10 README, publishable artifacts; BWFORMAT_SPEC.md | Apply DL-6 first so the published reading is current. Decide whether negative results and historical errors publish with it. Review redistribution of any embedded vendor facts. |
| DL-8 | Publish the device and parameter-ID catalog | Unresolved | 10a excludes it; no origin or redistribution review exists | none (delivery) | Phase 10 README, publishable artifacts; the catalog is generated from the application bundle | The catalog derives from the installed application. Decide whether that derivation may be redistributed at all before any packaging work. |
| DL-9 | Publish the extension itself | Unresolved | 10a excludes it; depends on daemon and surface stability | none (delivery) | Phase 10 README, publishable artifacts | Release and upgrade suite (DL-1) and installation and packaging policy (DL-5) come first. A stable description cohort and support terms are needed. |

Status, qualifier, and cell values come from [`data/records.json`](data/records.json); `data/check_records.py` verifies that this table agrees with it. IDs are navigation keys, not priorities.

Plan links: [10a](../../phase-10/10a-bwmod-publication-review.md),
[10b](../../phase-10/10b-compact-bar-publication-review.md),
[10c](../../phase-10/10c-release-and-upgrade-live-suite.md), and
[Phase 10 backlog](../../phase-10/README.md).

## Documentation correction scope

DL-6 is complete in the [synthesis session](next-session.md#completion). The
input table retains its Candidate baseline; the report records completion.
The correction covers these current claims, with source links:

- [Format spec](../../../evidence/format/BWFORMAT_SPEC.md): `0x02` is a real
  field type in the corpus. `0x06` and `0x1a` remain unobserved there, not
  universally disproved types. `0004` has an implemented decoder route in
  bwpreset, with an incompatible extractor on this host.
- [Parser comment](../../../../brain/src/bwmod/stream.ts): a recursive parse
  does not require a complete field-name schema. The current editor's tested
  sentinel and preservation rules still apply.
- The spec's blanket field-name impossibility needs the scoped descriptor
  evidence in [E276](../../../evidence/experiments/e276-grid-semantic-read-and-value-probe.md).
  Do not replace it with a claim of a complete schema or arbitrary modulator API.

The [completed session](next-session.md) changed only the named reference
claims and parser comment. Runtime logic and historical E/D records remain
unchanged. DL-7 publication is still a candidate.

E4 is not an open correction. The wave-2 status summary listed its "genuinely
novel capability" sentence as a correction not applied. The independent review
and this collection decide otherwise: E4 is a historical record and stays
unchanged. Current comparisons cite current evidence (Control Deck's direct-ID
setter and its limits are in the wave-1 audit, D5). Do not carry E4 as a
pending item in the later report.

## Reuse and publication

[Sources](sources.md) records licenses and missing declarations. openwig
declares GPL-3.0-or-later; DrivenByMoss supplies LGPLv3 terms. Reading a design
lead and copying implementation are different adoption choices. Record which
choice a session makes. Vendor keys, definitions, jars, personal project
data, and binary donor assets require their own handling and distribution
decisions. A `NOTICE` line is not a general approval to redistribute.

Prepare a concrete release package before requesting publication approval.
Personal feature work does not itself authorize an external release.
