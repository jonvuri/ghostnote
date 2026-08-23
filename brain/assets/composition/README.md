# Owned composition assets

`instrument-layer-4.json` promotes the human-authored E4g preset as the first
product composition asset. The manifest binds each logical entry to measured
chain, device GUID, and modulator-list facts. Runtime composition refuses asset
drift before it edits a preset.

The preset stays at its original checked-in path to avoid a second opaque binary
copy. Runtime code treats it as an immutable build-time asset. It writes composed
presets only to fresh temporary directories.

The asset has no packaged-file references or sampled-preset reference stubs.
External redistribution review remains in Phase 6.
