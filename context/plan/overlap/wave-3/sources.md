---
title: Source register and evidence rules
kind: note
state: active
updated: 2026-10-24
---

# Source register and evidence rules

## Scope and freshness

These are local source snapshots, not a survey of the latest internet releases.
All 12 clone HEADs were checked on 2026-10-24, and again in the register pass, against the retained
[pin manifest](../../../evidence/data/overlap-audit/offline-results.json).
All match. Only daw-mcp has a local change: `mcp-server/package-lock.json`.
That change was not used as capability evidence. No clone was updated.
The `reference/` directory is ignored by Git. The pinned web links identify
sources for another checkout; the local links require these clones.

License entries record declarations, not a compatibility or redistribution
verdict. Check the exact files to be copied before adoption.

## External source register

| Source and exact pin | Useful input | Reuse declaration | Evidence limit |
|---|---|---|---|
| [BitX](https://github.com/wimvandenborre/BitX/tree/23768a4e9dbcf161e4a4b53a732ff704d10039cb) (`23768a4e9dbcf161e4a4b53a732ff704d10039cb`); [local](../../../../reference/BitX) | Command patterns for sends, selectors, MIDI programs, and tempo. | No license file identified. | Bounded source lead; no checked port. Register rows: [BitX](external-register.md#bitx). |
| [DrivenByMoss](https://github.com/git-moss/DrivenByMoss/tree/836117be7c17318a0f93cb414e333516a91a5436) (`836117be7c17318a0f93cb414e333516a91a5436`); [local](../../../../reference/DrivenByMoss) | Mature controller navigation, sends, note expression, and automation controls. | LGPLv3. | Patterns need Ghostnote identity and result contracts. Register rows: [DrivenByMoss](external-register.md#drivenbymoss). |
| [WigAI](https://github.com/csabacsaba/WigAI/tree/6b567eb90ad3702a88f80398cf6ecbd74d1b5306) (`6b567eb90ad3702a88f80398cf6ecbd74d1b5306`); [local](../../../../reference/WigAI) | Launcher operations and remote-page controls. | README says MIT; no license file identified. | Remote controls are not a full DirectParameter inventory. Register rows: [WigAI](external-register.md#wigai). |
| [acidcat](https://github.com/hed0rah/acidcat/tree/2d0a0479bd4527b1ffcb8610b3568788198c749c) (`2d0a0479bd4527b1ffcb8610b3568788198c749c`); [local](../../../../reference/acidcat) | Sample indexing, search, analysis, and heuristic bwclip extraction. | MIT. | Do not adopt the metadata splicer; byte-offset failure is reproduced. Register rows: [acidcat](external-register.md#acidcat). |
| [bitwig-control-deck](https://github.com/remymazmanian/bitwig-control-deck/tree/45933855dcbfd1bd130beea18dd3f02bf794a838) (`45933855dcbfd1bd130beea18dd3f02bf794a838`); [local](../../../../reference/bitwig-control-deck) | Cue markers, file insertion, direct parameters, device nesting, and clip writes. | MIT. | Inspect dispatch and completion; no-op delete can return success. Register rows: [bitwig-control-deck](external-register.md#bitwig-control-deck). |
| [bitwig-device-hacks](https://github.com/zezic/bitwig-device-hacks/tree/59aa058e3fc725d202b6309c5251960a588e37a2) (`59aa058e3fc725d202b6309c5251960a588e37a2`); [local](../../../../reference/bitwig-device-hacks) | Historical Bitwig modulator repacking. | MIT. | Old-format context, not a current integration basis. Register rows: [bitwig-device-hacks](external-register.md#bitwig-device-hacks). |
| [bitwig-extensions](https://github.com/gregrossdev/bitwig-extensions/tree/de79a747a62b50e1488cc9ef49617d129804e3ff) (`de79a747a62b50e1488cc9ef49617d129804e3ff`); [local](../../../../reference/bitwig-extensions) | Gig Maestro sends, cues, groove, transport, scene, and track handlers. | README says MIT; no license file identified. | Setter acknowledgments do not prove independent readback. Register rows: [bitwig-extensions](external-register.md#bitwig-extensions). |
| [bitwig-nitro-tools](https://github.com/blakebratcher/bitwig-nitro-tools/tree/a34c1d61c7e48b1531fb3fba5e4c06d9e1e0cf16) (`a34c1d61c7e48b1531fb3fba5e4c06d9e1e0cf16`); [local](../../../../reference/bitwig-nitro-tools) | DSP parsing, decompilation, and symbol/key discovery patterns. | MIT. | Modified-image loading is unproved in the pinned source. Register rows: [bitwig-nitro-tools](external-register.md#bitwig-nitro-tools). |
| [bitwig_agent](https://github.com/gatovillano/bitwig_agent/tree/e17ac4033a7c5619e2371d0d733b0a4bb4b686d4) (`e17ac4033a7c5619e2371d0d733b0a4bb4b686d4`); [local](../../../../reference/bitwig_agent) | Basic controller and clip operations; generation helpers. | MIT. | Generation remains agent work; remote controls are not deep parameters. Register rows: [bitwig_agent](external-register.md#bitwig_agent). |
| [bwpreset](https://github.com/jdormit/bwpreset/tree/202bf50c31ac551f1e5d345bab5a39c1bed32a12) (`202bf50c31ac551f1e5d345bab5a39c1bed32a12`); [local](../../../../reference/bwpreset) | Recursive codec, definitions, Grid builder, units, assets, and bindings. | MIT. | Strong offline codec result; many live payload gates remain. Register rows: [bwpreset](external-register.md#bwpreset). |
| [daw-mcp](https://github.com/ptaczek/daw-mcp/tree/a30cbf62f8741265550fc2d638b0cd56559255e6) (`a30cbf62f8741265550fc2d638b0cd56559255e6`); [local](../../../../reference/daw-mcp) | Basic Launcher controller paths and MCP structure. | MIT. | Selected cursors and clip representation differ from the product contract. Register rows: [daw-mcp](external-register.md#daw-mcp). |
| [openwig](https://github.com/Axyom/openwig/tree/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d) (`d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d`); [local](../../../../reference/openwig) | Descriptor reflection, direct Arranger content, and automation. | GPL-3.0-or-later. | Research source; upstream Windows scope and current-build proof differ. Register rows: [openwig](external-register.md#openwig). |

The [external register](external-register.md) holds every inspected path,
predicate, and counterexample for these projects on the shared capability
rows, so the later report does not need the wave-1 audit.

Superpowers has no inspected implementation clone. Its installer and release
claims do not establish a reusable transcription or stem-separation source.
No live comparison against another server ran in this preparation.

## Reproducible local facts

The [offline script](../../../evidence/data/overlap-audit/offline_checks.py)
and [saved result](../../../evidence/data/overlap-audit/offline-results.json)
cover 24 presets, 46 detached donors, and reference versions. The current
review repeated the codec and donor checks: 24 exact round trips, 46 complete
parses, six matching known footprints, and four body fields with type `0x02`.
The Expressions donor contains eight objects. These are corpus results, not
proof of arbitrary edits or safe parsing of hostile input.

The [no-op deletion reproduction](../../../evidence/data/overlap-audit/controller_noop_delete.mjs)
also repeats: the controller returns success with the count still one.
The original saved result remains unchanged. Moving reports changes their
link bytes; the script now hashes the report at its new location. Do not
compare that report hash with the old result as a codec regression.

On the installed 6.1.4 jar, a read of the archive member list confirms that
`com/bitwig/base/serial/file/sYG.class` is absent. That is the literal input
of bwpreset `installed_key`. No key was extracted. This establishes failure
of that exact path, not the absence of another definition reader.

## Primary local references by purpose

| Purpose | Read first | Why it matters |
|---|---|---|
| Public promises | [v53 artifact](../../../evidence/data/phase9b-doctor/9b7-tool/descriptions-v53.json) and [PROJECT](../../../PROJECT.md) | Separates available tools from library and probe code |
| Correctness and reversal | [decision index](../../../decisions/INDEX.md), D15, D19, D20, D44, D46, D49 | Defines the contract that a new primitive must preserve |
| Latest normal-host proof | [E330](../../../evidence/experiments/e330-update-audit-614-acceptance.md) | Selected product scope on 6.1.4 |
| Grid research and product plan | [E310](../../../evidence/experiments/e310-grid-factory-acceptance-and-breadth-close.md), [E342](../../../evidence/experiments/e342-grid-doctor-614-acceptance.md), [Phase 11](../../phase-11/README.md) | Separates proved research from planned tools |
| Cost and limits | [performance ledger](../../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) | Measurements have build, workload, and boundary limits |
| Publication | [10a](../../phase-10/10a-bwmod-publication-review.md), [10b](../../phase-10/10b-compact-bar-publication-review.md), [10c](../../phase-10/10c-release-and-upgrade-live-suite.md) | Release gates are separate from personal feature utility |
| Musical navigation | [8i17](../../phase-8/8i17-midi-musical-navigation-survey.md) | An existing independent survey, not a new unowned candidate |

## Reading rule

Every cell and work record in [`data/records.json`](data/records.json)
carries one of five proof levels. They are the wave-1 audit's evidence rules.

| Level | Meaning |
|---|---|
| Live | An experiment record names the operation, host build, result, and limits. The cell names the build. |
| Checked offline | A check ran locally without a Bitwig connection during an audit or review. |
| Source | An implemented path was inspected in pinned source; it was not run here. |
| Claim | A README, listing, or release statement only. |
| Not found | No corresponding path was found in the inspected scope. This does not prove absence. |

A source implementation is evidence of a route to investigate. A local offline
check proves only its checked input and predicate. A live result applies to
its named operation, build, and fixture. A plan is not a result. Keep these
kinds separate when building the later comparison report.

**Matrix rule.** A check mark in a comparison needs three things together:
the pinned dispatch path (or Ghostnote tool and code path), the actual success
predicate, and one limiting counterexample. The wave-1 audit found that the
largest error in the first report came from checking the most promising
function instead of the dispatched one. Record all three for every claim cell.

## Repository stashes

Two Git stashes exist and no plan references them: `stash@{0}` (`8a-first`)
and `stash@{1}` (`nitro_overlap`, the September `NITRO_OVERLAP.md` that the
wave-1 report superseded). They are not inputs to wave 3. Drop or archive
them in a housekeeping pass; do not treat them as evidence.
