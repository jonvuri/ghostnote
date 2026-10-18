---
title: Overlap audit source and verification record
kind: note
state: active
updated: 2026-10-17
---

# Overlap audit source and verification record

This record supports the [capability audit](OVERLAP_CAPABILITY_AUDIT.md) and
[improvement candidates](OVERLAP_IMPROVEMENT_SOURCES.md). The primary evidence
is the local cloned source, pinned below. Public GitHub pages for Control Deck,
bwpreset, and Superpowers were also opened on 2026-10-17. They do not replace
source inspection or establish live behavior.

## Scope and acceptance

The task is a source review with new document output. Acceptance is coverage
of all 40 original feature rows, comparison with Ghostnote's experiment
history and current code, concrete limiting cases, and marked sources for
missing deterministic capabilities. No implementation session was selected.
Existing documents, NOW, the original report, and live fixtures stay unchanged.
The initial staged diff was empty. The original report was an untracked user
file. The daw-mcp clone already had a modified `mcp-server/package-lock.json`;
that file was not used as capability evidence and was not changed.

All 12 cloned projects received a source pass. Depth is unequal: Control Deck,
bwpreset, WigAI, daw-mcp, bitwig_agent, acidcat, and openwig received targeted
handler/codec inspection. Gig Maestro received handler and transaction review.
DrivenByMoss, BitX, historical device hacks, and Nitro received a bounded pass
on the relevant implementations and limits. Superpowers has no local clone and
is assessed only from the public download repository. No claim here proves
that an uninspected feature is absent from a project or from the wider market.

## Revisions

Commit dates are the local commit timestamps, not release dates or a guarantee
that each clone contains the latest remote commit. bwpreset's October 7 US
commit date is October 8 UTC; the earlier report's date is not necessarily wrong.

| Clone | Commit | Commit timestamp | Reuse declaration found |
| --- | --- | --- | --- |
| BitX | [`23768a4e9dbc`](https://github.com/wimvandenborre/BitX/tree/23768a4e9dbcf161e4a4b53a732ff704d10039cb) | 2026-07-26T18:56:14+02:00 | No license file found |
| DrivenByMoss | [`836117be7c17`](https://github.com/git-moss/DrivenByMoss/tree/836117be7c17318a0f93cb414e333516a91a5436) | 2026-07-26T19:06:54+02:00 | LGPLv3 license text |
| WigAI | [`6b567eb90ad3`](https://github.com/csabacsaba/WigAI/tree/6b567eb90ad3702a88f80398cf6ecbd74d1b5306) | 2025-12-18T18:33:59+01:00 | README says MIT; license file absent |
| acidcat | [`2d0a0479bd45`](https://github.com/hed0rah/acidcat/tree/2d0a0479bd4527b1ffcb8610b3568788198c749c) | 2026-10-15T16:18:44-04:00 | MIT |
| bitwig-control-deck | [`45933855dcbf`](https://github.com/remymazmanian/bitwig-control-deck/tree/45933855dcbfd1bd130beea18dd3f02bf794a838) | 2026-10-13T08:08:39-07:00 | MIT |
| bitwig-device-hacks | [`59aa058e3fc7`](https://github.com/zezic/bitwig-device-hacks/tree/59aa058e3fc725d202b6309c5251960a588e37a2) | 2017-05-22T11:03:01+03:00 | MIT |
| bitwig-extensions | [`de79a747a62b`](https://github.com/gregrossdev/bitwig-extensions/tree/de79a747a62b50e1488cc9ef49617d129804e3ff) | 2026-03-15T19:10:35-04:00 | README says MIT; license file absent |
| bitwig-nitro-tools | [`a34c1d61c7e4`](https://github.com/blakebratcher/bitwig-nitro-tools/tree/a34c1d61c7e48b1531fb3fba5e4c06d9e1e0cf16) | 2026-08-12T22:58:57-05:00 | MIT |
| bitwig_agent | [`e17ac4033a7c`](https://github.com/gatovillano/bitwig_agent/tree/e17ac4033a7c5619e2371d0d733b0a4bb4b686d4) | 2026-10-05T23:40:28-03:00 | MIT |
| bwpreset | [`202bf50c31ac`](https://github.com/jdormit/bwpreset/tree/202bf50c31ac551f1e5d345bab5a39c1bed32a12) | 2026-10-07T22:15:00-04:00 | MIT |
| daw-mcp | [`a30cbf62f874`](https://github.com/ptaczek/daw-mcp/tree/a30cbf62f8741265550fc2d638b0cd56559255e6) | 2026-01-01T16:29:58+01:00 | MIT |
| openwig | [`d9ffed4cd3ea`](https://github.com/Axyom/openwig/tree/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d) | 2026-06-11T00:33:55+02:00 | GPL-3.0-or-later |

Ghostnote base commit: `8646bc4cead401673cb5e657612c1f8c276f7ba8`.
The default profile is `agent-native-v1`, 44 tools, descriptions v52. These are
current repository facts from NOW, not a new live handshake. No tool
descriptions changed in this audit.

## Checks run

| Check | Result | What it proves |
| --- | --- | --- |
| bwpreset parse/serialize/reparse on Ghostnote preset files | 24/24 byte-exact and stable | Current codec handles these 23 fixtures and one seed, including their references and attachments. |
| Detached donor parse | 46/46 consumed fully | Each donor has a complete recursive object boundary. Detached references were not resolved as standalone complete presets. |
| Parsed donor counts versus measured manifest counts | 6/6 agree | All non-null footprints agree with serialized object counts. Unknown footprints are still unproved live. |
| Old Expressions donor | 8 objects | Its object count lies below E69's tested range of 10–57. This is not proof of a valid sampled edit. |
| Real `0x02` preset fields | 4 occurrences across the checked files | The tag is present as a parsed field, not only a byte-pattern hypothesis. No occurrence of `0x06` or `0x1a` was established in this set. |
| Installed jar key reader | Expected compatibility failure | `sYG.class` is absent. No key was printed or persisted. |
| acidcat length-changing metadata edit, in memory | Independent parse fails | The file grew by 35 bytes while its body offset stayed unchanged. No source file was written. |
| Control Deck controller tests | 8/8 pass | Fake-host timeout, tempo, and mixer readback tests pass. They do not test live direct parameters, nesting, or Arranger timing. |
| Control Deck ignored-delete reproduction | Returns success with both counts equal to 1 | The completion predicate accepts a delete that had no effect. Target selection/guards are stubbed as successful; this check isolates completion. |
| Ghostnote focused tests | 123/123 pass; no skips | Existing bwmod/oracle, control identity, readback-failure, and call-budget tests pass. This is not the full product test suite. |

The machine-readable [result](data/overlap-audit/offline-results.json) contains
all preset and donor hashes, counts, clone revisions, and exact diagnostic
errors. The [check script](data/overlap-audit/offline_checks.py) uses only local
source and the Python standard library for these checks. It saves no preset,
key, or decoded vendor definition.

Reproduce from the repository root:

```sh
python3 context/evidence/data/overlap-audit/offline_checks.py > /tmp/overlap-results.json
node --test reference/bitwig-control-deck/test/controller.test.mjs
node context/evidence/data/overlap-audit/controller_noop_delete.mjs
```

From `brain/`:

```sh
node --import tsx --test src/bwmod/bwmod.test.ts src/bwmod/oracle.test.ts src/surface/device-control-identity.test.ts src/surface/readback-unavailable.test.ts src/surface/call-budget.test.ts
```

The [ignored-delete check](data/overlap-audit/controller_noop_delete.mjs) runs
the cloned handler in a VM with a host that ignores deletion.

The full upstream Python suites were not run. The system Python has no pytest,
and this audit did not install dependencies. Upstream test files support
claims about implemented checks, not a claim that those complete suites passed
here. No live probe, controller install, application mutation, or audio capture
ran. Historical live records remain version- and fixture-specific.

## Source locations

Reference labels used in the two reports resolve directly to these pinned
source files or local Ghostnote records. For long files, the report names the
specific handler. Line numbers identify the inspected entry point; a row can
also refer to later functions in that file.

| Reference | Purpose | Source |
| --- | --- | --- |
| AC-analysis | Audio feature extraction | [reference/acidcat/src/acidcat/core/analysis/features.py:104](https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/core/analysis/features.py#L104) |
| AC-convert | File conversion including bwclip to MIDI | [reference/acidcat/src/acidcat/commands/convert.py:1](https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/commands/convert.py#L1) |
| AC-format | Heuristic tree, note, and structure extraction | [reference/acidcat/src/acidcat/core/formats/bitwig.py:208](https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/core/formats/bitwig.py#L208) |
| AC-mcp | Sample and preset search plus analysis tool registration | [reference/acidcat/src/acidcat/mcp_server/schema.py:48](https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/mcp_server/schema.py#L48) |
| AC-write | Experimental Bitwig metadata splicing | [reference/acidcat/src/acidcat/core/write/edits.py:167](https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/core/write/edits.py#L167) |
| AGT | Scheduled clip, device, parameter, and mixer handlers | [reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java:350](https://github.com/gatovillano/bitwig_agent/blob/e17ac4033a7c5619e2371d0d733b0a4bb4b686d4/java-extension/src/main/java/com/bitwig/agent/BridgeHttpServer.java#L350) |
| AGT-init | Remote pages and clip cursor initialization | [reference/bitwig_agent/java-extension/src/main/java/com/bitwig/agent/BitwigAgentExtension.java:130](https://github.com/gatovillano/bitwig_agent/blob/e17ac4033a7c5619e2371d0d733b0a4bb4b686d4/java-extension/src/main/java/com/bitwig/agent/BitwigAgentExtension.java#L130) |
| AGT-theory | Musical generation example | [reference/bitwig_agent/python/bitwig_agent/theory/chords.py:1](https://github.com/gatovillano/bitwig_agent/blob/e17ac4033a7c5619e2371d0d733b0a4bb4b686d4/python/bitwig_agent/theory/chords.py#L1) |
| BITX | Tempo, preset, selector, and send commands | [reference/BitX/src/main/java/com/personal/BitXFunctions.java:554](https://github.com/wimvandenborre/BitX/blob/23768a4e9dbcf161e4a4b53a732ff704d10039cb/src/main/java/com/personal/BitXFunctions.java#L554) |
| BP-assets | Asset preservation and editing tests | [reference/bwpreset/tests/test_assets.py:42](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/tests/test_assets.py#L42) |
| BP-build | Modulator layout and Patch builder | [reference/bwpreset/bwpreset/build.py:425](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/build.py#L425) |
| BP-codec | Recursive reader and graph serializer | [reference/bwpreset/bwpreset/codec.py:66](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/codec.py#L66) |
| BP-defs | App definition to instance template | [reference/bwpreset/bwpreset/definitions.py:12](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/definitions.py#L12) |
| BP-import | Root Grid requirement on imported presets | [reference/bwpreset/bwpreset/build.py:465](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/build.py#L465) |
| BP-key | Version-specific jar key extraction and decode | [reference/bwpreset/bwpreset/encoding.py:10](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/encoding.py#L10) |
| BP-live | Upstream live and pending verification ledger | [reference/bwpreset/docs/verification.md:1](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/docs/verification.md#L1) |
| BP-model | Routing field IDs | [reference/bwpreset/bwpreset/model.py:79](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/model.py#L79) |
| BP-route | Routing modes, descriptors, scale, and amount | [reference/bwpreset/bwpreset/build.py:342](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/build.py#L342) |
| BP-schema | Schema and template discovery | [reference/bwpreset/bwpreset/schema.py:250](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/schema.py#L250) |
| BP-slots | Nested preset slot handling | [reference/bwpreset/bwpreset/slots.py:1](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/slots.py#L1) |
| BP-status | Implementation completion and qualifications | [reference/bwpreset/docs/completion-status.md:1](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/docs/completion-status.md#L1) |
| BP-tests | Ownership, atomic validation, reindexing, and unknown-state tests | [reference/bwpreset/tests/test_core_completion.py:111](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/tests/test_core_completion.py#L111) |
| BP-units | Descriptor-based units | [reference/bwpreset/bwpreset/units.py:1](https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/units.py#L1) |
| CD-arranger | Active accelerated Arranger recording | [reference/bitwig-control-deck/controller/ControlDeck.control.js:1755](https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L1755) |
| CD-clips | Clip validation, writing, and private template reader | [reference/bitwig-control-deck/controller/ControlDeck.control.js:1360](https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L1360) |
| CD-cues | Cue marker editing and verification | [reference/bitwig-control-deck/controller/ControlDeck.control.js:1088](https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L1088) |
| CD-delete | Device deletion and returned counts | [reference/bitwig-control-deck/controller/ControlDeck.control.js:2143](https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L2143) |
| CD-dispatch | Controller dispatch | [reference/bitwig-control-deck/controller/ControlDeck.control.js:1989](https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L1989) |
| CD-insert | Device and sample insertion | [reference/bitwig-control-deck/controller/ControlDeck.control.js:638](https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L638) |
| CD-mixer | Mixer write and readback | [reference/bitwig-control-deck/controller/ControlDeck.control.js:1297](https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L1297) |
| CD-nest | Native slot device move | [reference/bitwig-control-deck/controller/ControlDeck.control.js:937](https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L937) |
| CD-params | Direct parameter write and verification | [reference/bitwig-control-deck/controller/ControlDeck.control.js:2370](https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L2370) |
| CD-select | Track and device selection guards | [reference/bitwig-control-deck/controller/ControlDeck.control.js:277](https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L277) |
| CD-tests | Controller fake-host tests | [reference/bitwig-control-deck/test/controller.test.mjs:1](https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/test/controller.test.mjs#L1) |
| CD-tools | Registered MCP tools and input limits | [reference/bitwig-control-deck/src/index.mjs:55](https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/src/index.mjs#L55) |
| Checks | Checks | [context/evidence/OVERLAP_AUDIT_SOURCES.md](../../context/evidence/OVERLAP_AUDIT_SOURCES.md) |
| D44 | D44 | [context/decisions/d44-long-writes-are-optimized-then-bounded.md](../decisions/d44-long-writes-are-optimized-then-bounded.md) |
| DAW | Selected clip reads and note setters | [reference/daw-mcp/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java:258](https://github.com/ptaczek/daw-mcp/blob/a30cbf62f8741265550fc2d638b0cd56559255e6/bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java#L258) |
| E124 | E124 | [context/evidence/experiments/e124-audio-facts-and-sensory-packets-connect-verified-files.md](experiments/e124-audio-facts-and-sensory-packets-connect-verified-files.md) |
| E125 | E125 | [context/evidence/experiments/e125-audio-capture-composes-with-verified-file-analysis.md](experiments/e125-audio-capture-composes-with-verified-file-analysis.md) |
| E232 | E232 | [context/evidence/experiments/e232-reader-row-binding.md](experiments/e232-reader-row-binding.md) |
| E233 | E233 | [context/evidence/experiments/e233-pull-snapshot-references.md](experiments/e233-pull-snapshot-references.md) |
| E234 | E234 | [context/evidence/experiments/e234-write-boundary-and-reader-hardening.md](experiments/e234-write-boundary-and-reader-hardening.md) |
| E235 | E235 | [context/evidence/experiments/e235-document-read-and-identity-registry.md](experiments/e235-document-read-and-identity-registry.md) |
| E236 | E236 | [context/evidence/experiments/e236-document-edit-limb.md](experiments/e236-document-edit-limb.md) |
| E243 | E243 | [context/evidence/experiments/e243-collapsed-cursor-and-parameter-settle.md](experiments/e243-collapsed-cursor-and-parameter-settle.md) |
| E244 | E244 | [context/evidence/experiments/e244-direct-parameter-display-observer.md](experiments/e244-direct-parameter-display-observer.md) |
| E248 | E248 | [context/evidence/experiments/e248-writer-cursor-width.md](experiments/e248-writer-cursor-width.md) |
| E250 | E250 | [context/evidence/experiments/e250-reader-follow-mode-repair.md](experiments/e250-reader-follow-mode-repair.md) |
| E253 | E253 | [context/evidence/experiments/e253-overlay-basis-sealing.md](experiments/e253-overlay-basis-sealing.md) |
| E254 | E254 | [context/evidence/experiments/e254-device-control-identity-and-route-claims.md](experiments/e254-device-control-identity-and-route-claims.md) |
| E255 | E255 | [context/evidence/experiments/e255-document-format-discovery.md](experiments/e255-document-format-discovery.md) |
| E257 | E257 | [context/evidence/experiments/e257-track-mixer.md](experiments/e257-track-mixer.md) |
| E258 | E258 | [context/evidence/experiments/e258-selection-effects-and-unavailable-readback.md](experiments/e258-selection-effects-and-unavailable-readback.md) |
| E260 | E260 | [context/evidence/experiments/e260-claim-replacement-repair.md](experiments/e260-claim-replacement-repair.md) |
| E264 | E264 | [context/evidence/experiments/e264-device-add-revert-report.md](experiments/e264-device-add-revert-report.md) |
| E265 | E265 | [context/evidence/experiments/e265-inline-midi-file-conversion.md](experiments/e265-inline-midi-file-conversion.md) |
| E267 | E267 | [context/evidence/experiments/e267-midi-snapshot-export.md](experiments/e267-midi-snapshot-export.md) |
| E269 | E269 | [context/evidence/experiments/e269-document-file-paths.md](experiments/e269-document-file-paths.md) |
| E55 | E55 | [context/evidence/experiments/e55-direct-parameter-core-is-live.md](experiments/e55-direct-parameter-core-is-live.md) |
| E56 | E56 | [context/evidence/experiments/e56-native-device-catalog-is-reproducible-and-resolved.md](experiments/e56-native-device-catalog-is-reproducible-and-resolved.md) |
| E57 | E57 | [context/evidence/experiments/e57-vst3-and-clap-parameter-control-is-live.md](experiments/e57-vst3-and-clap-parameter-control-is-live.md) |
| E67 | E67 | [context/evidence/experiments/e67-sampled-preset-authoring-is-live.md](experiments/e67-sampled-preset-authoring-is-live.md) |
| E68 | E68 | [context/evidence/experiments/e68-container-cross-device-routing-is-live.md](experiments/e68-container-cross-device-routing-is-live.md) |
| E69 | E69 | [context/evidence/experiments/e69-donor-scope-and-footprints-are-complete.md](experiments/e69-donor-scope-and-footprints-are-complete.md) |
| E77 | E77 | [context/evidence/experiments/e77-nested-direct-parameter-guards-are-live.md](experiments/e77-nested-direct-parameter-guards-are-live.md) |
| E82 | E82 | [context/evidence/experiments/e82-direct-parameter-domains-and-integrity-are-live.md](experiments/e82-direct-parameter-domains-and-integrity-are-live.md) |
| E85 | E85 | [context/evidence/experiments/e85-general-directparameter-modulation-targets-are-live.md](experiments/e85-general-directparameter-modulation-targets-are-live.md) |
| E86 | E86 | [context/evidence/experiments/e86-semantic-preset-modulation-inspection-is-complete.md](experiments/e86-semantic-preset-modulation-inspection-is-complete.md) |
| E87 | E87 | [context/evidence/experiments/e87-list-scoped-topology-is-complete.md](experiments/e87-list-scoped-topology-is-complete.md) |
| E90 | E90 | [context/evidence/experiments/e90-fx-layer-late-binding-is-live.md](experiments/e90-fx-layer-late-binding-is-live.md) |
| E91 | E91 | [context/evidence/experiments/e91-existing-device-modulation-wrapper-is-live.md](experiments/e91-existing-device-modulation-wrapper-is-live.md) |
| E92 | E92 | [context/evidence/experiments/e92-general-device-source-composition-is-live.md](experiments/e92-general-device-source-composition-is-live.md) |
| E93 | E93 | [context/evidence/experiments/e93-container-shape-and-capacity.md](experiments/e93-container-shape-and-capacity.md) |
| E95 | E95 | [context/evidence/experiments/e95-modulator-identity-pair-controls-grid-placement.md](experiments/e95-modulator-identity-pair-controls-grid-placement.md) |
| E96 | E96 | [context/evidence/experiments/e96-grid-generalization-and-catalog-boundary.md](experiments/e96-grid-generalization-and-catalog-boundary.md) |
| E98 | E98 | [context/evidence/experiments/e98-parameter-units-and-semantic-writes-fail-closed.md](experiments/e98-parameter-units-and-semantic-writes-fail-closed.md) |
| E99 | E99 | [context/evidence/experiments/e99-selection-borrowing-and-background-stability.md](experiments/e99-selection-borrowing-and-background-stability.md) |
| GM-arranger | Cue marker handlers | [reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/ArrangerHandler.java:136](https://github.com/gregrossdev/bitwig-extensions/blob/de79a747a62b50e1488cc9ef49617d129804e3ff/gig-maestro/src/main/java/dev/gregross/gig/handlers/ArrangerHandler.java#L136) |
| GM-device | Eight remote parameters and selected device operations | [reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/DeviceHandler.java:25](https://github.com/gregrossdev/bitwig-extensions/blob/de79a747a62b50e1488cc9ef49617d129804e3ff/gig-maestro/src/main/java/dev/gregross/gig/handlers/DeviceHandler.java#L25) |
| GM-sends | Send level, mode, and enabled setters | [reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/SendHandler.java:20](https://github.com/gregrossdev/bitwig-extensions/blob/de79a747a62b50e1488cc9ef49617d129804e3ff/gig-maestro/src/main/java/dev/gregross/gig/handlers/SendHandler.java#L20) |
| GM-transaction | Sequential operations and undo rollback | [reference/bitwig-extensions/gig-maestro/src/main/java/dev/gregross/gig/handlers/TransactionHandler.java:24](https://github.com/gregrossdev/bitwig-extensions/blob/de79a747a62b50e1488cc9ef49617d129804e3ff/gig-maestro/src/main/java/dev/gregross/gig/handlers/TransactionHandler.java#L24) |
| GN-adapter | GN-adapter | [brain/src/adapters/live/adapter.ts](../../brain/src/adapters/live/adapter.ts) |
| GN-audio | GN-audio | [brain/src/audio/index.ts](../../brain/src/audio/index.ts) |
| GN-bwtests | GN-bwtests | [brain/src/bwmod/bwmod.test.ts](../../brain/src/bwmod/bwmod.test.ts) |
| GN-descriptions | GN-descriptions | [brain/src/surface/description-cohort.ts](../../brain/src/surface/description-cohort.ts) |
| GN-device | GN-device | [brain/src/surface/agent-native-devices.ts](../../brain/src/surface/agent-native-devices.ts) |
| GN-donors | GN-donors | [brain/src/bwmod/donors.ts](../../brain/src/bwmod/donors.ts) |
| GN-encoder | GN-encoder | [brain/src/adapters/live/encoder.ts](../../brain/src/adapters/live/encoder.ts) |
| GN-inspect | GN-inspect | [brain/src/surface/preset-modulation-inspection.ts](../../brain/src/surface/preset-modulation-inspection.ts) |
| GN-oracle | GN-oracle | [brain/src/bwmod/oracle.test.ts](../../brain/src/bwmod/oracle.test.ts) |
| GN-readback | GN-readback | [brain/src/surface/readback-unavailable.test.ts](../../brain/src/surface/readback-unavailable.test.ts) |
| GN-stream | GN-stream | [brain/src/bwmod/stream.ts](../../brain/src/bwmod/stream.ts) |
| GN-stubs | GN-stubs | [brain/src/bwmod/stubs.ts](../../brain/src/bwmod/stubs.ts) |
| HACKS | Historical Bitwig 2.0 modulator work | [reference/bitwig-device-hacks/README.md:1](https://github.com/zezic/bitwig-device-hacks/blob/59aa058e3fc725d202b6309c5251960a588e37a2/README.md#L1) |
| Ledger | Ledger | [context/contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md](../../context/contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) |
| MOSS-clip | Controller clip implementation | [reference/DrivenByMoss/src/main/java/de/mossgrabers/bitwig/framework/daw/CursorClipImpl.java:1](https://github.com/git-moss/DrivenByMoss/blob/836117be7c17318a0f93cb414e333516a91a5436/src/main/java/de/mossgrabers/bitwig/framework/daw/CursorClipImpl.java#L1) |
| MOSS-layer | Layer and send control implementation | [reference/DrivenByMoss/src/main/java/de/mossgrabers/bitwig/framework/daw/data/LayerImpl.java:1](https://github.com/git-moss/DrivenByMoss/blob/836117be7c17318a0f93cb414e333516a91a5436/src/main/java/de/mossgrabers/bitwig/framework/daw/data/LayerImpl.java#L1) |
| Manifest | Manifest | [brain/assets/modulators/manifest.json](../../brain/assets/modulators/manifest.json) |
| NITRO | Nitro formats and unproved modified-image loading | [reference/bitwig-nitro-tools/README.md:140](https://github.com/blakebratcher/bitwig-nitro-tools/blob/a34c1d61c7e48b1531fb3fba5e4c06d9e1e0cf16/README.md#L140) |
| NOW | NOW | [context/NOW.md](../../context/NOW.md) |
| OW-bridge | Reflection, descriptor walker, and document operations | [reference/openwig/src/openwig/controller/openwig_bridge.control.js:490](https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/controller/openwig_bridge.control.js#L490) |
| OW-mod | Audio/preset insertion and modulator browser handler | [reference/openwig/src/openwig/controller/openwig_bridge.control.js:2214](https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/controller/openwig_bridge.control.js#L2214) |
| OW-notes | Arranger clip and automation graph extraction | [reference/openwig/src/openwig/read/notes.py:1](https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/read/notes.py#L1) |
| OW-project | Temporary baseline device comparison | [reference/openwig/src/openwig/read/project.py:66](https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/read/project.py#L66) |
| OW-render | Windows loopback recording | [reference/openwig/src/openwig/wire/render.py:1](https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/wire/render.py#L1) |
| OW-song | Deterministic song and track API | [reference/openwig/src/openwig/song.py:82](https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/song.py#L82) |
| OW-tests | Opt-in resolver and audio-insert live tests | [reference/openwig/tests/test_autoadapt_live.py:1](https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/tests/test_autoadapt_live.py#L1) |
| SP | Public installer repository; web claim only | [not cloned](https://github.com/kalifrn6-art/bitwig-superpowers) |
| WIG | Remote page, clip cache, and device setters | [reference/WigAI/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java:115](https://github.com/csabacsaba/WigAI/blob/6b567eb90ad3702a88f80398cf6ecbd74d1b5306/src/main/java/io/github/fabb/wigai/bitwig/BitwigApiFacade.java#L115) |

## Interpretation limits

A complete parse is not a proof that arbitrary edits load. A passing synthetic
test is not a live run. A current value returned immediately after a setter is
not necessarily fresh readback. A stable parameter ID is not the identity of
its owning device. An undo call is not a guarded inverse of an agent effect.
These distinctions explain most changes from the first report.

Retrospective: record the public registration, dispatch target, write primitive,
and success predicate together. Control Deck contains two Arranger workflows,
but only one is dispatched. Checking the most promising function alone would
have produced the wrong capability conclusion.
