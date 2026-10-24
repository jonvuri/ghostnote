---
title: Feature breadth planning inputs
kind: index
state: active
updated: 2026-10-24
---

# Feature breadth planning inputs

This is the standalone input collection for the [static report](report.html). It
states the current normal tool surface, relevant findings, possible work,
and the proof needed for that work. It does not rank features or select an
implementation order. No earlier overlap report is required.

The baseline is 2026-10-24: normal profile `agent-native-v1`, 45 tools,
descriptions v53, and installed Bitwig 6.1.4. Historical measurements retain
their original builds. External sources are pinned local clones. Their latest
online versions were not surveyed in this pass.

## Reading routes

| Question | Input document |
|---|---|
| What can an agent call today? | [Current surface](current-surface.md), all 45 tools |
| How can it control a session and mix? | [Session and mixing](session-and-mixing.md) |
| How can it work with notes, clips, and a song timeline? | [Clips and arrangement](clips-and-arrangement.md) |
| How can it build device chains and set sound controls? | [Devices and parameters](devices-and-parameters.md) |
| How can it create modulation and author preset state? | [Modulation and presets](modulation-and-presets.md) |
| What does the Grid research enable? | [Grid and internal access](grid-and-internal-access.md) |
| How can it find, capture, inspect, and understand media? | [Media and analysis](media-and-analysis.md) |
| Which findings and source projects can be trusted for what? | [Source register](sources.md) |
| What cost, recovery, compatibility, and release work accompanies a feature? | [Delivery constraints](delivery.md) |
| Which pieces depend on others, and which choices are unresolved? | [Dependencies and decisions](dependencies.md) |
| How can I compare the inputs? | [Static synthesis report](report.html), with matrices, filters, and evidence |
| What happens after the report? | [Vision selection](vision-selection.md) |
| What did synthesis require? | [Completed session](next-session.md) |
| What do the other projects implement on the same rows? | [External register](external-register.md): per-project cells with pinned path, predicate, and counterexample |
| Where is the machine-readable source of truth? | [Record data](data/README.md): `records.json`, check and render scripts |
| What changed after the preparation pass? | [Changelog](CHANGELOG.md) |

## Record conventions

The records live in [`data/records.json`](data/records.json). The documents
here are the readable view. [`data/check_records.py`](data/check_records.py)
checks that both agree. The [data README](data/README.md) gives the schema.

**Capability rows.** A row is one object and one aspect of it, for example
"Track: mixer: volume, pan, mute, and solo" or "Launcher clip: notes". Each
row has a stable key such as `track.mixer`.

**Verb columns.** Every row has the same seven columns.

| Verb | Meaning |
|---|---|
| read | Return the current state of the object without a change. |
| write | Change an existing object's state or properties in place. |
| create | Make a new object where none existed. |
| delete | Remove an existing object. |
| move-or-copy | Relocate or duplicate an existing object with its state, including state that cannot be read. |
| revert | Reverse a recorded Ghostnote change of this row through its change record. |
| persist | The change survives a project save and reload. |

There is no preservation column. Known loss of untouched neighbouring state,
such as a whole-clip rewrite that drops pressure, is a limit note on the
write or move cell.

**Status is a cell value.** One row can hold a Product create cell and an
Unresolved write cell. The six values are:

| Status | Meaning |
|---|---|
| Product | A named tool in the normal profile supplies the cell; its limits still apply |
| Component | Code exists below the public surface; exposure and current-host proof can remain |
| Research | A scoped experiment passed; general product behavior is not established |
| Planned | An implementation or survey plan exists; completion is not implied |
| Candidate | A source or user task supports investigation; no session is selected |
| Unresolved | Evidence is insufficient to claim a route or choose an implementation |

A separate free-text qualifier narrows the status, for example "offline
corpus proof" or "blocked extractor route". The qualifier never replaces
one of the six values.

**Proof level is separate from status.** Each cell and each work record
carries one of the five levels from the wave-1 audit: Live, Checked offline,
Source, Claim, Not found. A Live level names its Bitwig build (6.0.6, 6.1.4).
Status says how committed the capability is; proof says how it is known.
"Candidate, Source" and "Product, Live 6.1.4" are both valid cells.

**Work records.** IDs such as `SM-2` are navigation keys, not priorities.
A work record points at one or more cells (row key plus verb) instead of
being a row. It carries status, qualifier, proof, source route, required
proof, owner or phase placement, prerequisite IDs, enabling IDs, and one
effort-driver category from the six work shapes in
[dependencies](dependencies.md). Delivery records (`DL-n`) have no cells.
An existing plan owner is stated where one exists. All other records are
planning inputs, not authorized implementation sessions.

**Matrix rule.** Every claim cell (Product, Component, or Research) records
the Ghostnote tool or code path, the actual success predicate, and one
limiting counterexample. An external cell in the [external register](external-register.md)
records its pinned dispatch path the same way and carries a proof level but
no Ghostnote status. A cell marked Not found means that no
path was found in the inspected scope; it is not a finding that the
capability is absent. An empty cell records no standing at all.

Use the source register's evidence rules with these statuses. For example,
an external handler can be implemented in source while its Ghostnote status
is only Candidate. Do not turn that into a product check mark.

## Scope of this pass

The collection includes normal control, offline file tools, media providers,
and the related Grid plan. It includes earlier breadth ideas that are easy to
lose in a tool-to-tool comparison: transport, Master, scene properties,
group operations, global groove, and musical navigation.

It keeps musical generation with the driving agent. Deterministic analysis,
transcription, and separation are different questions. It includes release
work because that can affect order, but release is not a prerequisite for
every personal-use feature.

The [report](report.html) compares outcomes, coverage, proof, dependencies,
effort drivers, and maintenance burden. This input set and the
[external register](external-register.md) supply its matrices. The report
contains proposed sequences, not an accepted priority order.
