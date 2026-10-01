---
title: Ghostnote Document 1.0 conformance case inventory
kind: reference
state: active
updated: 2026-10-01
---

# Conformance case inventory

8f2 owns implementation of this inventory. Each `Cnn` family maps to `Rnn`
in [SPEC.md](SPEC.md). Add separate tests for each semicolon-separated case.
Valid fixtures must enter through both encodings, compare native values, cross
convert without loss, stabilize canonical output, and have equal content hashes.
Invalid cases must fail with their rule and location. Schema validation alone
does not complete a case. No executed reference-codec result is claimed here.

| Family | Rule | Required independent expected cases |
|---|---|---|
| C01 | R01 | Accept exact format/version and case-sensitive IDs; reject renamed format, `1`, `1.0.0`, future minor/major versions, unknown keys/records, invalid or long IDs; retain a namespaced inert extension through both encodings and hash it; reject an extension request with required unknown behavior. |
| C02 | R02 | All three kinds; multiple clips share one event set; wrong/missing arrays fail; snapshot base fails; desired base optional, patch base required; metadata omission differs from an empty supplied title; host address keys fail; kind changes hash. |
| C03 | R03 | Full all-channel desired; zero-length empty clip; no-clip empty document; partial and unavailable snapshots with reasons; empty membership distinct from unavailable; onset outside span or uncovered channel fails; uncovered explicit field fails; covered default omission normalizes; missing/duplicate coverage fails; reversed/out-of-clip ranges fail; duration beyond length stays unchanged. |
| C04 | R04 | Test every event field, each boundary and default in FIELDS.md, each portable operation, and every nondefault disabled control; expression is atomic; pressure survives conversion; duplicate IDs and duplicate normalized addresses fail; different channels and pitches at one cell remain distinct; same-pitch overlap and adjacency remain unchanged; recurrence mask bound and integer overflow fail. |
| C05 | R05 | Reduce `2/6`, `2/2`, `0/7`, and `-0` in overlays; normalize `170/512` onset to `85/256`; retain signed components; reject decimal/exponent/numeric timing, leading zeros, plus signs, signed or zero denominators, and fraction whitespace; compare large exact fractions independently. |
| C06 | R06 | On-grid note at `85/256` accepted; realized `1/3` fails in full document, add, and update; nominal `1/3`, `1/5`, and `1/7` accepted; duration zero/negative/subcell fails; parse/render/convert/hash never calls acquisition normalization. |
| C07 | R07 | Exact onset `1/3` -> `85/256`, delta `-1/768`; duration `1/6` -> `85/512`, delta `-1/1536`; exact half-cell duration `1/1024` -> `1/512`; positive `1/2048` promoted to `1/512`; `3/1024` -> `1/256`; exact grid values unchanged; rational values just below/at/above cell and duration tie; binary64 `0.1` exact fraction `3602879701896397/36028797018963968`, onset `51/512`; binary64 adjacent neighbors of a cell; signed zero and finite/sign failures; normalization twice is identical; explicit import collision rejects all source IDs; a pre-collapsed D23 observation never claims recovered IDs; independent endpoint rounding would differ, but is not used; report introduced/removed overlap and promotion. |
| C08 | R08 | Empty patch arrays; full add defaults; required add field missing fails; all settable fields and full overlay replacement; immutable event ID/clip and patch clip-container changes fail; patch metadata stays on proposal; patch full-state arrays fail. |
| C09 | R09 | Guard match and mismatch; unknown/partial base refuses pure apply; preserve every unnamed field, including nonzero pressure; null resets each optional field and each clip name/range; required-field null fails; equal update and empty patch are no-ops; missing removes/updates fail; duplicate and conflicting operation IDs fail; reordered arrays give the same result; final-state clip-length validation; desired omission removes notes/overlays and defaults properties; desired retained overlays run lifecycle; result strips base and preserves base annotations. |
| C10 | R10 | Canonical binding; permuted binding; all optional fields bound as scalars/objects; `_` optional omission; WITH fields; binding/WITH conflict even with `_`; missing binding/core field or row-width error; empty document still needs binding; balanced objects with spaces and escaped strings; wrong-kind records, multiple envelope records, forward references; event ID `WITH` is a slot value. |
| C11 | R11 | LF/CRLF, blank lines, outer spaces/tabs, absent final LF, reordered JSON keys accepted; escaped Unicode agrees with literal scalars; no Unicode normalization; reject BOM, comments, code fences, trailing commas, duplicate JSON keys, invalid UTF-8, unpaired surrogates, repeated header, and extra prose. |
| C12 | R12 | Each provenance kind; confidence absent/0/1/out of bounds; current/stale; stable ID full revision versus distinct new claim; missing provenance/state/basis/dependency arrays fails; measured/declared/inferred distinction remains in hash. |
| C13 | R13 | Triplet/quintuplet/septuplet nominal values; nominal duration independent of division; position not on nominal division fails; missing minimum dependency fails; duplicate current nominal per event fails; note state unchanged when nominal removed. |
| C14 | R14 | Groove source/unknown-source variants; named template, swing pair, point/span shape, and anchor; bad pair/width/anchor clip fails; minimum subject/nominal/anchor dependencies; duplicate current groove fails; transfer copied phase/template to a target's nominal overlay and explicitly write normalized target timing. |
| C15 | R15 | Known-source equations with positive/negative phase/template/cross/local; durationIntent; triplet deltas from C07; inconsistent source, normalization, delta, and duration fails; resolved residuals must be zero; measured data cannot claim assigned intent; declared/inferred source authority preserved; acquired displacement never becomes swing. |
| C16 | R16 | Unknown source requires null deltas and unresolved residuals; partial source pair fails; unknown acquisition cannot become local intent; tempo-qualified derived display uses tempo at nominal onset; missing/conflicting tempo gives no display; tempo-derived interpretation lists tempo dependency. |
| C17 | R17 | Chord/key/both; empty declared harmony span; explicit members must be in clip/span; minimum pitch/timing/length/membership dependencies; opaque labels survive; inferred label can change without changing notes. |
| C18 | R18 | Melody/bass roles and motif groups; empty future group; interpreted articulation distinct from event articulation; all member dependencies; extra unlisted event marks membership stale without changing explicit group; no pattern expansion. |
| C19 | R19 | Meter 4/4 and 7/8, every allowed denominator, bad numerator/denominator; tempo changes and BPM boundaries; missing initial context unknown; at zero for empty clip; duplicate current point fails; later points take effect without redefining beat coordinates. |
| C20 | R20 | Named span/member group; same event in several regions allowed; bad member/span fails; add does not autojoin; minimum membership/length/onset dependencies; no region for a zero-length clip. |
| C21 | R21 | Dangling event/clip/overlay/anchor in current or stale fails; dependency duplicate/unknown path/self/cycle fails; forward references work; current dependency on stale fails; event removal requires explicit dependent overlay removal/replacement; removal of a nonmember still changes membership dependency. |
| C22 | R22 | Independent projection digest with expanded defaults; dependency ordering does not change basis; an unrelated field does not change basis; dependency field/data/state/provenance changes do; recursively dependent basis values excluded; current wrong basis fails; stale old basis retained and can match again after undo without becoming current. |
| C23 | R23 | Pitch/timing/context/member edits stale the declared dependencies; velocity-only edit preserves a timing overlay; stale propagation through nominal -> groove; explicit put with fresh basis reaffirms; same data/basis after undo stays stale; overlay removal leaves byte-equivalent event state; desired retained/replaced envelope distinction. |
| C24 | R24 | Stale old equations/span allowed but structural invalidity/dangling references fail; stale uniqueness can coexist with current claim; no interpretation or proposal use of stale data; revalidation needs explicit put. |
| C25 | R25 | Optional explicit defaults equal omission; unknown different from default; empty root meta/extensions normalize to omission; coverage listing all fields equals `"all"`; all declared sets and arrays normalize as specified; swing weights and extension arrays retain order; locale does not affect ID order. |
| C26 | R26 | Golden canonical JSON and FIELDS bytes for every paired example; numeric exponent/decimal spellings converge; negative zero -> zero; Unicode/control escaping; nondefault WITH fields; final-LF policy; canonical parse/render idempotence. |
| C27 | R27 | Golden content digest with prefix; both encodings and permuted bindings/layouts agree; rename ID, change coverage/provenance/base/extension/kind changes digest; no-op materialized result equals unguarded desired base; exact-source/content/dependency hashes remain distinct; reject self-hash core key. |
| C28 | R28 | Verify each threshold and rejection at limit+1 for bytes, counts, IDs, strings, depth, rational digits, arithmetic bits, overlay dependencies, total field refs, and patch total; test accepted boundaries where other limits permit; huge fractions fail before costly arithmetic; no partial success; source binary64 subnormal conversion follows the declared output digit limit. |
| C29 | R29 | Rule/path or line/column for each invalid family; unsupported event/pattern/curve/extension behavior fails; no recovery pass; wrong header, extra/missing note, and empty-output regressions adapted from retained benchmarks. |
| C30 | R30 | Pure proposal never invokes a host; unwritable host pressure is retained or binding refuses, not dropped; portable defaults remain independent of host defaults; snapshot authority restricted to coverage. Binding execution belongs to 8f3. |
| C31 | R31 | Rule index covers R01-R32; every fixture has source, adaptation, expected values, and owner; codec failures, acquisition reports, and musical verdicts are reported separately; frozen benchmark artifacts unchanged. |
| C32 | R32 | Schema compiles with the 2020-12 meta-schema; all valid structural fixtures pass; structurally valid semantic failures still fail the full validator; local refs resolve without fetching a host or service. |

## Historical regressions

Use retained benchmark code and responses as read-only sources. In 8f2, record
the exact source path and the adaptation for each selected case. At minimum:

- Missing benchmark metadata/header: replace the old header with a required
  1.0 envelope, then remove one required component and assert R10/R29 failure.
- Renamed IDs: use the paired example base; a renamed update target must fail
  R09. A renamed ID in a new complete document changes R27 identity.
- Extra notes: an additional valid new ID changes inventory and hash. Syntax
  validity does not establish compliance with an exact-note task.
- Empty output: blank response fails the header rule. A valid zero-event clip
  passes and differs from unavailable acquisition.

## Ownership and verification boundary

The [paired examples](EXAMPLES.md) are specification inputs owned by 8f1.
They are not generated reference-codec outputs. 8f2 must regenerate canonical
examples and hashes with the codec, compare them with independent expectations,
and record any specification correction. Extend these case families when a
later binding exposes a concrete defect; do not silently weaken a rule.
