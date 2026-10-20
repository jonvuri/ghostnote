---
title: 9b — Grid symbol manifest
kind: note
state: active
status: Empty until 9b.1 records the existing 9a symbols. Each later Grid session adds its rows.
updated: 2026-10-19
parent: 9b-grid-breadth-discovery-and-build-out.md
---

# 9b — Grid symbol manifest

Every obfuscated Bitwig symbol the Grid path uses, with the information a
runtime resolver needs. This is the input to
[step 2](9b-grid-breadth-discovery-and-build-out.md#step-2--build-symbol-discovery).
Add a row when a session adds a symbol. Mark a row when a session retires one.

Pinned build: Bitwig 6.0.6, jar SHA-256
`382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93`.

| Role | Class | Member and signature | Shape for resolution | Validating invariant | Source file | First E |
|---|---|---|---|---|---|---|
| (9b.1 fills this table from `GridReadSymbols`, `GridWriteSymbols`, `GridFactorySymbols`, `GridAttachmentSymbols`, and `GridEngineSymbols`) | | | | | | |

Columns: *Shape* is what a resolver can match without the name (parameter
types, return type, static or instance, declaring class relationship).
*Validating invariant* is the check that proves a candidate is right (a
descriptor name that must appear, an edit label, a UUID round trip, a
counter transition). A row with no invariant is a risk for step 2.
