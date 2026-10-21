# Offline Grid symbol resolver

Run from the repository root with Python 3.11 or later:

```sh
python3 brain/src/probes/phase9b-grid-resolvers.py \
  --jar '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  --verify-pinned \
  --report /tmp/ghostnote-grid-symbols.json

GRID_SYMBOL_JAR='/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  PYTHONPATH=brain/src/probes python3 -m unittest grid_symbols.test_resolve -v
```

Without `GRID_SYMBOL_JAR`, the tests use only fake metadata. The integration
test also renames the full inert jar model and reverses enumeration order.
No test loads a vendor class, connects to Bitwig, or runs a native command.

`scan.py` reads class files and computes structural keys. Jar class and
member names are opaque. External library ABI names remain in the keys.
The type key uses access flags, sorted field/method signatures, inheritance,
and two rounds of referenced-type refinement. It excludes source names,
member order, debug data, and string contents. Default-package classes are
ordinary jar entries; their packages are not inferred.

`resolve.py` first finds candidates from `selectors.json`. It uses normalized
instruction, numeric-literal, field-use, and bounded call traces to separate
same-shape members. It follows abstract calls on the declared fixture type.
Two explicit operation edges link membership to the insertion body and the
current document edit to edit association. No candidate is selected by its
position. Missing or ambiguous candidates cause refusal.

Validation then checks signatures, declaration ownership, inheritance,
operation edges, and receiver roles. The project root and edit document are
different roles. All live invariants remain untested. The output always has
`writeAuthority: false`. No live adapter or fingerprint cache consumes it.

`oracle.py` contains the pinned names. Only derivation and acceptance tests
use it. The CLI imports it after discovery when `--verify-pinned` is set.
The committed selectors were derived from the manifest and local 6.0.6
metadata with `derive(jar, manifest_rows(path))`. Derivation is not a recovery
path. Do not regenerate selectors automatically after a refusal. A changed
shape needs a new trace and evidence before the live doctor can use it.

These are structural selectors for the observed implementation. They survive
the tested renaming; they do not prove semantic equivalence or general
cross-build support. The live doctor must test every manifest invariant and
must preserve ownership, freshness, selection, and independent readback.
See [E311](../../../../context/evidence/experiments/e311-grid-offline-resolvers.md)
for measured costs and limits.
