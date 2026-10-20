---
title: Phase 9a — Live Grid editing spike
kind: plan
state: complete
status: E299 closes the spike. Native Grid operations and operator audio pass on the fixed fixture. The research probe stays deployed.
updated: 2026-10-19
parent: README.md
next: 9b-grid-breadth-discovery-and-build-out.md
---

# Phase 9a — Live Grid editing spike

## Final result

9a is complete. Ghostnote can create, read, update, and delete the tested
modules and cables inside the existing Poly Grid fixture. Independent graph
reads confirm the edits. The operator heard the expected audio changes while
the same engine stayed active. Exact baseline restoration passed.

This result applies to the fixed fixture and pinned Bitwig 6.0.6 build.
It is a research result. It does not add a public Grid authoring tool or prove
arbitrary module types, patches, or host builds. The
[E299 close-out](../../evidence/experiments/e299-grid-spike-close-out.md)
is the final operation-by-operation verdict, with costs and limits.

## Read the results

| Need | Start here |
| --- | --- |
| Final verdict, limits, and retained probe | [E299 close-out](../../evidence/experiments/e299-grid-spike-close-out.md) |
| Listening checks, graph checks, and exact restoration | [E298 live result](../../evidence/experiments/e298-grid-operator-audio-live-test.md) and [saved verification](../../evidence/data/phase9a-operator-audio/verification-live.json) |
| Accepted audio criteria and the completed test procedure | [Operator audio test](9a-operator-audio-test.md) |
| Current capability claims | [Devices](../../evidence/capability/devices.md#live-grid-research-9a) |
| Current deployment and material to preserve | [NOW](../../NOW.md) |
| Original scope, sources, and session sequence | [Historical plan](9a-live-grid-editing-spike-history.md) |

## Evidence and implementation map

| Part | Evidence | Design or implementation |
| --- | --- | --- |
| Semantic graph read | [E276](../../evidence/experiments/e276-grid-semantic-read-and-value-probe.md) | [Graph reader](../../../extension/src/main/java/com/ghostnote/extension/GridGraphRead.java) |
| Parameter update | [E277](../../evidence/experiments/e277-grid-value-write-readback-and-persistence.md) | [Value probe](../../../extension/src/main/java/com/ghostnote/extension/GridFixtureValue.java) |
| Cable connect, disconnect, and retarget | [E279](../../evidence/experiments/e279-grid-cable-connect-disconnect-and-persistence.md), [E280](../../evidence/experiments/e280-grid-retarget-and-module-delete-probe.md) | [Cable probe](../../../extension/src/main/java/com/ghostnote/extension/GridFixtureCable.java) |
| Module deletion | [E281](../../evidence/experiments/e281-grid-module-delete-and-persistence.md) | [Delete probe](../../../extension/src/main/java/com/ghostnote/extension/GridFixtureModuleDelete.java) |
| Native factory and attachment | [E283](../../evidence/experiments/e283-detached-grid-factory-lifecycle.md), [E289](../../evidence/experiments/e289-native-grid-attachment-and-persistence.md) | [Attachment design and native symbols](9a-native-attachment-design.md), [factory](../../../extension/src/main/java/com/ghostnote/extension/GridDetachedFactory.java), [attachment](../../../extension/src/main/java/com/ghostnote/extension/GridModuleAttachment.java) |
| Audio acceptance and V13 | [E296](../../evidence/experiments/e296-grid-operator-audio-acceptance.md), [E297](../../evidence/experiments/e297-grid-operator-audio-probe.md), [E298](../../evidence/experiments/e298-grid-operator-audio-live-test.md) | [Audio protocol](../../../extension/src/main/java/com/ghostnote/extension/GridEngineProtocol.java), [driver](../../../brain/src/probes/phase9a-grid-engine.ts) |
| Earlier automated signal investigation | E290–E295, linked from the designs | [V12 protocol and native update trace](9a-engine-adoption-design.md), [continuous-signal design](9a-continuous-signal-design.md), [observable comparison](9a-observable-design.md) |

Each evidence record links its saved outputs and verification. Earlier
refusals and recovery results remain in E286–E288 and E292. They are part of
the research history. The automated meter work is deferred and does not gate
the accepted result. No further meter investigation is selected.

<a id="next-session--bounded-close-out-and-profile-disposition"></a>

## Close-out and deployment

[E299](../../evidence/experiments/e299-grid-spike-close-out.md) completes the
close-out requested after E298. The operator chose to keep the research
`ghostnote probe` deployed. V13 remains the last verified profile; no reload
or live request ran during close-out. Its completed session is used and
released. Do not repeat its preparation, run, or restoration workflow.

Next steps are planned in
[9b](9b-grid-breadth-discovery-and-build-out.md): breadth, build symbol
discovery, then build-out planning.
