---
title: Ghostnote Document 1.0 executed conformance corpus
kind: reference
state: active
updated: 2026-10-01
---

# Executed corpus

Version: `1.0`. Owner: 8f2 reference codec. Baseline: generated MIT fixture
music with no live state. The [manifest](manifest.json) maps R01-R32 to named
C01-C32 tests in [codec.test.ts](../../../../brain/src/document/codec.test.ts).
The [case inventory](../../CONFORMANCE.md) defines each family. Dynamic tests
check separate field bounds, invalid spellings, operation types, and references.
[CLI tests](../../../../brain/src/document/cli.test.ts) check stdin and errors.

[Canonical files](canonical/) are generated from the eight paired authored
inputs. Each valid case passes through FIELDS and JSON, compares native values,
checks both cross conversions, checks serializer stability, and compares
content identities. All golden hashes match the independent 8f1 values.
The patch produces the authored result. Schema compilation is an independent
structural check; semantic negatives still require the full validator.

R07 tests use exact independent onset and duration deltas, half-cell ties,
minimum promotion, binary64 neighbors, collisions, and changed overlap intervals.
R22 has an independent projection digest with expanded defaults. R28 tests
bounds and one-above-limit failures. Where the common byte limit makes a count
threshold unreachable, the test records the earlier resource failure. The
exact aggregate field-reference threshold is accepted and its next value fails.

The four historical regressions in the manifest name frozen source files and
the adaptation to 1.0. They cover missing headers, renamed IDs, extra notes,
and empty output. Frozen response and benchmark files remain unchanged.
An extra valid note can pass conformance and still fail an exact-note task.

The [measurement JSON](measurements.json) and [selected prompts](prompts/)
are checked derivatives of the [Model format reference](../../MODEL-REFERENCE.md).
The retained reference plus example is 729 bytes. The new Core is 3575 bytes;
Core plus Patch is 4650; Core plus Timing overlays is 5856; all sections are
7916. These correspond to 4.904, 6.3786, 8.0329, and 10.8587 times the retained
reference size. The new reference covers complete fields, coverage, normalized
timing, patches, and overlay lifecycle. The retained baseline uses six note
fields and its historical omissions.

Provider token counts for the new prompts are unavailable. No compatible local
tokenizer is bundled and no count request was made. The report preserves
available historical full-prompt usage with its model, hash, bytes, and source.
Those counts have a different scope and are not a token ratio for this comparison.
The matrix and addendum denominators remain separate.

Run `npm run document:conformance` and `npm run document:standalone` from `brain/`.
Use `npm run document:artifacts` only to regenerate owned outputs. All checks
are offline. Report acquisition displacement, codec loss, and musical verdicts
separately. The [usage guide](../../CODEC.md) describes the I/O boundary.
