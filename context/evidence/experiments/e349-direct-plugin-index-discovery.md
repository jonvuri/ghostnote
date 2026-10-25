# E349 — Direct plug-in index discovery

Date: 2026-10-25. Scope: read-only offline research on the installed Bitwig
6.1.4 indexes, following [R05](../../work/r05-browser-name-resolution.md).
Jar SHA-256: `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`.

## Verdict

**Positive for VST3 and CLAP discovery without a popup or host call.** A bounded
Python research decoder reads complete records, resolves shared dictionaries,
and reconstructs installed bundle paths. It does not load Bitwig classes or
invoke native methods. No controller replacement, browser action, insertion,
or project write occurred. This is not a public resolver implementation.

| Explicit scope | Decoded entries | Instrument entries |
|---|---:|---:|
| System VST3, ARM64 | 358 | 45 |
| System VST3, x64 | 17 | 4 |
| System CLAP, ARM64 | 31 | 12 |
| User CLAP, ARM64 | 1 | 1 |

All 407 entries point to existing bundles whose millisecond mtime equals the
indexed timestamp. Multiple plug-ins can share a bundle; 407 is an entry count,
not a count of distinct installed files. All 28 VST3/CLAP identity samples in
[E348](e348-browser-native-result-identities.md) match by name, architecture,
bundle path, ID, and vendor. The complete frozen browser name multisets also
match: 49 system VST3 instruments and 12 system CLAP instruments. These checks
compare with the earlier accepted browser reads, not a new live enumeration.
The indexed device-type byte distinguishes these plug-in instrument scopes;
this finding does not generalize the R05 browser filter to native devices.

Examples: Addictive Drums 2 resolves to VST3
`ABCDEF019182FAEB786C6E4178414432`; Diva resolves to CLAP `com.u-he.Diva`.
Architecture is retained separately from the source name. The comparison adds
Bitwig's observed ` [X64]` display suffix explicitly; it does not strip arbitrary
suffixes or merge formats. Duplicate candidates remain separate.

## Measured cost

Four indexes plus four shared dictionaries total **70,608 bytes**. The measured
operation reads a stable source set, decodes every record, joins IDs/categories/
vendors, constructs paths, and stats all 407 bundle references. Hashing the jar,
independent evidence comparisons, JSON output, and process startup are outside
this timing.

- First observed operation in the recorded process: **15.60 ms**.
- Subsequent 50 operations: **7.69 ms median**, **8.35 ms p95** (nearest rank).
- An already-built Python name dictionary: **0.029 µs mean** per exact lookup,
  measured over 100,000 lookups. This is only a dictionary-access microbenchmark,
  not an end-to-end resolver cost.

The OS cache was warm or unspecified; source inspection preceded measurement.
No cold-disk or stable latency claim is made. This is much less local work than
R05's 9–11-second browser sequences, but those sequences include host settling
and different scope/guard work. Do not treat their ratio as a product speedup.

## Format and refresh findings

The installed jar was inspected with `javap -p -c`; its classes were never
initialized. `WZM` validates magic/version/file-type count. `pAe` dispatches a
native-endian tree stream whose record header combines an 8-bit tag and 24-bit
payload length. Tags represent directory entry/exit, ordinary records, deleted
or padding records, and plug-in container entry/exit. `voN` reads a search hash,
16-bit UTF-8 byte length, and name; `NX` reads bounded arrays of dictionary IDs.
`Ph`, `PF`, and `QT`/`NQ` establish category, plug-in ID, version, device type,
type mask, vendor, and architecture-dependent fields. The decoder consumes each
supported payload exactly and refuses unsupported versions, references, types,
unsafe path components, unbalanced trees, truncation, or oversized input.

`Fq` identifies the shared `.ids` files. `MVg.iCS` establishes their 32-bit
big-endian character count and high-bit UTF-16 flag. Dictionary positions are
IDs. `EX.cfM(Pi)` hashes its path identifier concatenated with the location-kind
ordinal to name the index. For the three explicit plug-in roots, MD5 of exact
root path plus `7` reproduces every selected filename. This does not discover
arbitrary configured roots or make that ordinal a portable public contract.

The metadata caches are a different format. `OKo`, `vna`, and the metadata
reader wrappers establish versioned, appendable path/two-stamp records followed
by either an error string or an opaque serialized payload. Later records for a
path replace earlier records in the host map. The decoder reads this envelope,
not the plug-in payload schema. The local VST3 cache has 369 path records,
including **6 failures**; CLAP has 19, including **2 failures**. Neither has
repeated path records in this snapshot. Raw ID-string matches alone would not
establish usable cached devices. Index and cache hashes are retained.

`EX` routes file notifications into indexing/reindexing; `Sm2` can append index
records and `OKo` can append cache records. The reader checks inode, size, mtime,
and ctime before/after reads and again across the complete index/dictionary set.
That detects ordinary concurrent replacement or rewrite; it is not an atomic
host snapshot or a proof that all pending indexing has completed. Matching
bundle mtimes cannot detect every internal bundle change, disabled/blocked
plug-in, newly installed file absent from the index, or unconfigured root.
No install/remove/rescan lifecycle was induced in this experiment.

## Coverage boundary and next step

Native-device and Bitwig-preset indexes were inventoried and fingerprinted but
**not decoded**. Their observed bytes after the common header include an
additional preamble that the traced plug-in tree reader does not explain.
No identity or path is inferred by skipping to a plausible record. This is an
unresolved format question, not evidence that those indexes are unusable.
The audit lists each such file and its header/hash. Existing native catalog and
explicit preset paths remain available independently of this experiment.

The recommended resolver direction is direct indexes for supported plug-in
scopes, with explicit freshness/coverage and ambiguity, retaining R05's popup
route as a fallback. Before public implementation: decode the remaining
preamble and native/preset records, establish configured-root discovery, and
run a focused refresh test covering an added, changed, removed, and failed
source. Decide when a candidate requires cache/payload revalidation and when
incomplete enumeration must prevent a unique/absence claim. No native internal
search session has been tested. No implementation date or backlog slot is
assigned by this research result.

## Reproduction and verification

Research sources and output:
[index reader](../data/r06-index/index_reader.py),
[audit](../data/r06-index/audit.py),
[tests](../data/r06-index/test_index_reader.py),
[result](../data/r06-index/result.json).
The audit accepts only the recorded jar fingerprint and explicit local scopes;
it prints JSON and never writes source indexes. Do not overwrite this frozen
result when reproducing.

```sh
python3 -m unittest discover -s context/evidence/data/r06-index -p 'test_*.py' -v
python3 context/evidence/data/r06-index/audit.py > /tmp/gn-r06-new-result.json
LANG=en_US.UTF-8 ruby context/check.rb
git diff --check
```

Eleven tests pass, including every interior truncation of a synthetic complete
index, invalid headers/types/references, unsafe paths, tree balance, deleted
records, retained duplicates, Unicode dictionaries, cache failure/append
semantics, and a source changed during reading. The independent audit passes
all identity/name comparisons. Link and diff checks pass. Normal controller
state and the public 45-tool/descriptions-v53 surface were not changed.
