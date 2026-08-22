# Native device catalog

`catalog.json` is generated from native `Default.bwpreset` files in one Bitwig
application bundle. It does not include VST3, CLAP, module, or modulator settings.

Regenerate it from an explicit application root:

```sh
cd brain
npm run catalog:native -- --bitwig-app-root "/Applications/Bitwig Studio.app"
```

The command also generates
`extension/src/main/java/com/ghostnote/extension/generated/NativeDeviceCatalog.java`.
Do not edit either generated file.

`source.fingerprint` hashes each sorted native preset path and file. Generation
from the same bundle and `live-resolution.json` is byte-identical. The live
resolution file records only the supported cohort. Candidate IDs remain distinct
from IDs that DirectParameter and the typed view resolved in Bitwig.
