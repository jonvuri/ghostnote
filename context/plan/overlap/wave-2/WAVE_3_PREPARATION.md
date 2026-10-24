---
title: What the wave-3 preparation did
kind: note
state: active
updated: 2026-10-24
---

# What the wave-3 preparation did

The [wave-3 input collection](../wave-3/README.md) is ready for review. It
collects the material for a later report that will help the user choose
feature areas and priorities. It does not make those choices.

## Organization

The four original reports moved to `wave-1/`. The new status summary moved
here, to `wave-2/`, with an [independent review](INDEPENDENT_REVIEW.md) beside
it. Findings in the moved reports were preserved. Relative links were repaired.
Raw evidence and executable checks remain under `context/evidence/data/`.

Wave 3 starts from current tools, code, decisions, plans, and saved evidence.
It does not require the reader to open either earlier wave. It has six
feature-area documents:

- session and mixing;
- clips and arrangement;
- devices and parameters;
- modulation and presets;
- Grid and internal host access;
- media and analysis.

Supporting documents give all 45 normal tools, the source register,
delivery and release constraints, dependencies, and the next planning brief.
Each candidate has an ID, a current status, a source route, and a proof gate.
The IDs are navigation aids, not priority scores.

## What was checked

The preparation checked the v53 tool artifact, current product descriptions,
existing phase plans, and the relevant experiment records. It checked all
12 local source pins; each matches the retained revision. daw-mcp still has
its pre-existing lockfile change. No reference clone was updated.

The independent review reproduced the 24 preset round trips, 46 complete
donor parses, six known footprint matches, four real `0x02` fields, and the
Control Deck no-op deletion result. A jar member-list check confirmed that
the hardcoded bwpreset key class is absent on installed 6.1.4. No key was
extracted and no Bitwig request was sent.

The inputs distinguish available tools from internal components, research
results, planned work, and candidates. They retain historical build and
fixture limits. They also include broader session-control ideas and the
existing 8i17 musical-navigation survey, so the later report can compare
user outcomes rather than only match other servers' tool names.

## What remains for a later pass

The [next-session brief](../wave-3/next-session.md) defines the final report:
feature matrices, alternate views, useful visualizations, and possible
sequences with tradeoffs. It also defines a narrow correction of current
format references. This pass creates neither the final report nor those
specification edits. It does not change Phase 11's implementation scope or
choose where new normal-tool work belongs.

## Verification and handoff

The relocated reports retain their original prose apart from path changes.
The audit script now reads the report at its new path. Reading routes from
the context guide, roadmap, Phase 10, and NOW point to the new workspace.

Local links and heading anchors pass across the new and changed documents.
The inventory accounts for all 45 normal tools exactly once. The feature and
delivery documents contain 50 distinct work records. Wave 3 has no dependency
on a prior-wave report. All five moved reports pass a prose-preservation
comparison after link targets are excluded. The relocated audit script also
runs and reproduces the codec, donor, and metadata-writer results.

The repository context checker still reports missing frontmatter in 18
unrelated files. Each file matches HEAD byte for byte. It reports no other
error after this reorganization. Diff whitespace checks pass. No historical
evidence was rewritten to hide the baseline errors.

All session changes are staged for review. No commit, controller deployment,
live edit, or external publication is part of this work.
