---
title: Phase 9b — Document format packaging and publication
kind: plan
state: planned
status: Gated by Phase 8i acceptance. Package the selected format and benchmark evidence for public review.
updated: 2026-10-01
parent: README.md
evidence: E109, E114-E121, E129-E139, E209, E211-E213; D23, D25
---

# Phase 9b — Document format packaging and publication

## Purpose and entry

Package the accepted version 1.0 FIELDS/JSON specification, reference tooling,
model format reference, and benchmark evidence for external use. Follow
[D25](../../decisions/d25-fields-json-document-format-and-publication.md).

Start after [8i](../phase-8/8i-agent-native-hybrid-dogfood.md) accepts the format,
conformance package, and live use. The handoff must name the exact candidate
versions and known limits. Preparation does not make an external release.

## Earmarked artifacts

The following inventory is the publication starting point. Normative artifacts
will be supplied by the named Phase 8 session. Record their final paths,
versions, hashes, dependencies, and licensing in the 8i handoff.

| Artifact | Source and publication use |
|---|---|
| README and rationale | Start from [the product review](../../evidence/format/FORMAT_BENCHMARK_PRODUCT_REVIEW.md). Explain the format purpose, selection, results, and limits for a reader outside Ghostnote. |
| Version 1.0 specification | [8f1](../../../spec/ghostnote-document-v1/SPEC.md): semantic model, FIELDS grammar, JSON schema, timing, defaults, complete documents, patches, and overlays. |
| Reference tooling | [8f2](../phase-8/8f2-reference-codec-and-model-format-reference.md): pure parser, validator, serializers, converters, normalization utilities, and offline entry point. |
| Model format reference | 8f2: compact versioned format card, optional overlay sections, and tested prompt/skill examples. |
| Conformance corpus | 8f1 and 8f2: valid and invalid cases, rule-to-test index, canonical examples, semantic hashes, and cross-encoding round trips. |
| Host binding and migration | [8f3](../phase-8/8f3-ghostnote-bindings-and-cache-contracts.md): portable versus Ghostnote-specific rules, coverage, identity, acquisition loss, and compatibility. Publish only the relevant binding material. |
| Corrected eight-arm results | [v5 package](../../../brain/benchmarks/symbolic-format-v5/README.md), [corrected assessment](../../../brain/benchmarks/symbolic-format-v5/runs/2026-09-30-corrected-assessment.json), and [scorer](../../../brain/benchmarks/symbolic-format-v5/corrected_assessment.py). Include the dependency closure needed to reproduce retained aggregates. |
| Native/composite addendum | [Diagnostic package](../../../brain/benchmarks/native-composite-v1/README.md), [protocol](../../../brain/benchmarks/native-composite-v1/PROTOCOL.md), [adjudicated report](../../../brain/benchmarks/native-composite-v1/audits/adjudicated-report.md), [policy](../../../brain/benchmarks/native-composite-v1/audits/adjudication-policy.json), and [audit package](../../../brain/benchmarks/native-composite-v1/audits/README.md). |
| Decision and live-use evidence | D25, D23, selected lifecycle and field limits, and 8h/8i acceptance. Explain the selection without presenting a product decision as a frozen benchmark pass. |
| Historical context | Earlier iterations and the [existing reproduction guide](../../evidence/format/COMPACT_BAR_REPRODUCIBILITY.md). Use selected references; identify legacy instructions and superseded scores. |

The primary result package must include the relevant fixtures, full prompts,
format adapters, retained manifests, scoring code and policies, assessment
hashes, provider model/settings records, and audit provenance. Keep the
original and corrected or adjudicated scores distinguishable.

## Package scope

1. Review every normative rule, example, loss claim, identity rule, overlay
   lifecycle, extension rule, and compatibility promise against conformance.
2. Prepare the README from the product review. Rewrite it for public use;
   remove planning history and repository assumptions. Keep musical errors,
   score channels, field scope, providers, and judgment limits visible.
3. Package the reference library and offline entry point with a small API,
   installation instructions, examples, licenses, attribution, and support policy.
   The package must not need Bitwig, the Ghostnote cache, or provider credentials
   for conformance and conversion.
4. Define release versioning, extension, deprecation, and compatibility rules.
   Check that specification, schema, tooling, corpus, and format card versions
   agree. Freeze exact candidate hashes for release review.
5. Separate portable format rules from the Ghostnote host binding. Explain
   D23's normalized timing and cell-collision loss. Do not present the format
   as a complete replacement for established notation or interchange formats.
6. Inspect artifact origin and redistribution rights. Review fixtures, prompts,
   response excerpts, audit material, copied standard examples, and dependencies.
   Record generated-only provenance and exclude credentials or live project data.
7. Prepare a clean standalone consumer and run installation, examples,
   conformance, conversion, and offline reproduction there.
8. Prepare the selected release destination and a reviewable package. Actual
   registry publication, website updates, announcements, or external release
   require explicit user approval of that concrete result.

## Benchmark reproduction

Provide two distinct procedures:

- **Offline reproduction:** reconstruct fixtures and prompts; verify retained
  manifests and hashes; reproduce frozen, corrected, and adjudicated results;
  regenerate the reported views with their exact denominators.
- **Fresh provider experiment:** use new output paths and record models,
  settings, costs, schedules, prompts, and retry policy. Explain provider drift
  and nondeterminism. Fresh results need not match retained output hashes.

Make offline reproduction the default path. Document the minimal dependency
closure, pinned runtimes, and verifier commands. The v5 scripts import earlier
packages; do not extract only the top-level script and claim reproducibility.

The matrix and addendum use different fields and task contracts. Do not pool
or subtract their ratios as a controlled format effect. Keep notation, ledger,
profile compliance, agreement, and analysis channels distinct. Identify the
melody and role rubric limits and the lack of ABC/LilyPond compiler
validation. Adjudicated uncertainty does not quantify grammar judgment error.

Version 1.0 is developed after the benchmark. State which benchmark features
carry forward and which changed, including normalized timing and overlay
coverage. Historical scores do not automatically measure the final version
1.0 syntax or format card. Include later bounded validation only with its own
identity and scope. Do not imply model-training knowledge or future performance.

## Acceptance criteria

- Every normative rule has an executable conformance case.
- FIELDS and JSON convert without loss for all supported values, including
  empty documents, patches, and overlays. Conversion does not quantize.
- The README starts from the product review and preserves supported claims.
- The package includes the accepted specification, reference tooling, model
  reference, examples, corpus, and result/reproduction documentation.
- Public benchmark tables name their score input, denominator, tested models,
  settings, dates, and limits. Retained results reproduce offline.
- Every shipped artifact has reviewed origin, licensing, and attribution.
- Portable and host-specific requirements are identifiable. Cache and extension
  implementation are outside the standalone format package.
- Installation and standalone checks pass in a clean consumer.
- The release candidate has a version/hash inventory and explicit known limits.
- External publication occurs only after approval of the concrete release.

## Out of scope

Reopening format selection without new failure evidence, publishing the cache
or extension as part of this package, and promising performance on untested
models are outside this session.

## Retrospective target

Record which dependencies made extraction or reproduction difficult. Keep the
public package small enough to understand and complete enough to reproduce
its primary claims.
