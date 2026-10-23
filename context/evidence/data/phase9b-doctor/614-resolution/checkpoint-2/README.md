# 9b.6g checkpoint 2

This is an intermediate checkpoint. Session 9b.6g remains active. No complete
table, runtime admission, candidate, attempt, cache, or deployment is produced.
No vendor class is initialized. No host request is sent.

`symbols.json` resolves all 55 type identities and 76 member identities on
both jars. Local role contracts pass. `old-renamed.json` and `new-renamed.json`
repeat those checks on fully renamed inert models with unrelated additions.
These models are class-file data. They are not loaded by a JVM.

`catalog.json` binds the 30 captured descriptor pairs. `properties.json`
checks 49 captured property tuples and seven descriptor classes. The
`fixed-read` directory adds ten domain descriptor pairs, 111 concrete slot
checks, and 172 matched callees on each build. Assertion fields and exact
receiver types remain runtime conditions. Call-site receiver and argument
data flow is not proved by the fixed type set. The indexed-domain bound
also requires a null field or an exact `ArrayList` receiver. Its external
`size` body is outside the reported instruction count.

The fixed read checkpoint takes 12,868.957 ms and peaks at 342,228,992 bytes
RSS. The guarded property traces contain 422 call edges on 6.0.6 and 424 on
6.1.4. The two added calls are the explicit empty-list getter variants.
These counts describe static traces. They are not live call measurements.

Reproduce from the repository root. Set `OLD_JAR` to the preserved 6.0.6
`Contents/Java/bitwig.jar`. Set `NEW_JAR` to the installed 6.1.4 jar. The
input reports contain both expected hashes. Use a new output directory.

```sh
PYTHONPATH=brain/src/probes python3 -B -m grid_doctor.fixed_read_checkpoint \
  --old-jar "$OLD_JAR" --new-jar "$NEW_JAR" \
  --symbols context/evidence/data/phase9b-doctor/614-resolution/checkpoint-2/symbols.json \
  --catalog context/evidence/data/phase9b-doctor/614-resolution/checkpoint-2/catalog.json \
  --properties context/evidence/data/phase9b-doctor/614-resolution/checkpoint-2/properties.json \
  --output /tmp/gn-9b6g-fixed-read-reproduction
```

`development.zip` preserves intermediate reports, method dumps, scripts,
tests, and failed attempts. `development-manifest.json` gives each hash.
Earlier reports can contain superseded hypotheses. Use the explicit limits
in each report. In particular, a truncated backward search proves no path
exclusion. Large inert jars are not included. Their generation records and
hashes are retained.

The next work remains in the session plan: fixed receiver data flow; command,
replay, close, disposal, and failure paths; enforceable history and storage
growth; complete resilience tests; then driver and probe preparation. The
project journal overrides base callbacks. Its close path reaches project
validation and can queue two events. Those paths require further checks.
