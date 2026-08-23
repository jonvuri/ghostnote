---
title: Phase 6a — bwmod publication review and extraction
kind: plan
state: planned
status: Selected after Phase 5. Review redistribution, then prepare a standalone package.
updated: 2026-08-23
parent: README.md
evidence: D1-D3, E10-E13, E65-E73
---

# Phase 6a — `bwmod` publication review and extraction

## Purpose

Prepare `bwmod` as a small standalone TypeScript package without weakening its
format guards or shipping an asset that lacks redistribution approval.

## Scope

1. Inventory source, tests, fixtures, donor objects, templates, and copied code.
2. Classify each item by origin, license, attribution, and redistribution state.
3. Define the public buffer-in, buffer-out API. Keep Bitwig bridge, executor,
   project, and MCP dependencies outside the package.
4. Extract the smallest package that keeps all five editors, readers,
   `validate()`, typed errors, and the Python-oracle test boundary.
5. Exclude binary donors, templates, and fixtures unless the review records a
   clear redistribution basis for each item.
6. Add concise installation, compatibility, known-limit, and support-policy
   documentation.
7. Prove a clean package build, standalone tests, package-content inspection,
   and a local install into a temporary consumer.

## Acceptance criteria

- The review records provenance and redistribution status for every packaged
  file and generated artifact.
- The package has no runtime Python, Bitwig extension, bridge, MCP, or project
  dependency.
- Every editor and validation invariant keeps focused standalone coverage.
- Tier-2 footprint handling still refuses unmeasured donors.
- The published API does not expose ghostnote project paths or private assets.
- Package contents contain only reviewed files and required attribution.
- Documentation states the tested Bitwig version and the undocumented-format
  compatibility risk.
- No registry publication or external release occurs without explicit user
  approval.

## Out of scope

- Publishing the extension, template library, or device catalog.
- Adding a new editor, format recipe, donor, or template.
- Promising support for untested Bitwig versions.
- Changing the ghostnote product surface.

## Retrospective target

Separate reusable code from project evidence and binary assets before package
layout makes that boundary harder to review.
