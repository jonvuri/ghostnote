# E350 — Library roots from preferences, independent of index preambles

2026-10-25. R06 follow-up requested to support future location configurations,
including added sound-content roots. Positive on the installed macOS Bitwig
6.1.4 build: a bounded offline reader extracts location configuration from the
active `.prefs` file. A live add/remove test independently confirms sound-content
persistence while Settings remains open. This is research, not a public resolver.

## Sources and schema

Jar SHA-256: `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`.
Source: `~/Library/Application Support/Bitwig/Bitwig Studio/prefs/6.1.4.prefs`.
The reader requires an explicit prefs path and checks the installed jar pin.
It exports only location fields and source fingerprints, not the entire prefs.

Static `javap -p -c` inspection of the installed jar establishes these identities:

| Source | Meaning |
|---|---|
| `com.bitwig.flt.prefs.iiq`, root class 722, field 3457 | Library preferences object |
| `com.bitwig.flt.prefs.IVc`, class 718, field 5134 | Configured My Library path; empty means default |
| Same, fields 5066 / 5067 / 5068 | Sound-content / music / plug-in location lists |
| `com.bitwig.flt.prefs.A2V`, class 720, fields 3443 / 3444 | Each location's path / automatic-update flag |
| Root field 4917 | Configured package installation directory |
| `com.bitwig.flt.app.TL.BBT()` and `tJi()` | Default macOS My Library: `~/Documents/Bitwig Studio/Library` |
| `TL.wZs()`, `IwV(String)`, `tSS()` | Effective package directory resolution |
| `TL.EYR()` | Settings root, including `BITWIG_USER_SETTINGS_DIR` override handling |

Custom packages have an important resolution rule: unless the configured path
is the default or already ends in `Installed Bitwig Packs`, Bitwig appends that
child directory. The default is `installed-packages` under its settings root.
The runtime library class `prefs.cEc` also resolves configured/effective paths;
effective field 5135 is not serialized in this observed file. An internal-host
getter route is therefore a possible alternative, but was not invoked or
validated here. A controller deployment is unnecessary for the demonstrated
file-reader route.

Native resources remain rooted in the running application installation, as
established in R05. Combine that application root with preferences-derived My
Library, package, sound-content, music, and plug-in roots. Do not infer all of
these from My Library or assume default plug-in locations. The schema also has
`explicitly_remove_standard_library_locations` (field 6457); default-location
reconciliation needs to respect this, not blindly re-add standard locations.
The research extractor does not yet interpret those removal records.

The prefs stream uses a BtWg header, typed fields and object lists. Its bare
four-byte class-3 list terminator differs from assumptions in other file codecs.
The reader rejects unsupported types, unexpected location classes/references,
truncation, duplicate fields, trailing data, and oversized/deep inputs. It does
not change the existing preset codec or claim a generic Bitwig serializer.

## Live test and independent readback

Authorization: “We can add a location to test if needed.” Normal-profile hello
passed before the test: API 25, 92 methods, hash `8be1975eaa99d78f`, expected
markers and initialization `2026-10-25T16:53:58.441Z`, fresh relative to deployment.
No competing foreground research driver was present; existing MCP clients were
left alone. The project was `gn-scale-test`, generation
`3f94850d-d1db-4edb-9f13-8cd6c2c7b299`, revision 0, with `gn-sel` selected.

1. Read the baseline prefs: no sound-content or music roots; eight plug-in roots
   matched the visible Settings list. My Library and packages used defaults.
2. Created an empty owned `.tmp/r06-location-test` directory and added it through
   Settings > Locations > Sound Content Locations.
3. The GUI displayed the exact path. A separate disk read decoded that path with
   automatic updates enabled. Settings remained open; no restart was needed.
4. Removed only that row through the GUI. A separate prefs read matched every
   extracted baseline location field; the GUI again showed no sound-content rows.
   Removed the now-unconfigured empty test directory using `rmdir`.
5. Post-test project, generation, revision, scene count and selection matched
   their pre-test values. No project write or controller deployment occurred.

[Before](../data/r06-roots/before.json),
[added](../data/r06-roots/added.json), and
[after](../data/r06-roots/after.json) retain source stats, hashes and extracted
fields. [Host readback](../data/r06-roots/host-after.json) records preserved context.
No save-latency bound is claimed: the next read observed each change, but the
interval included tool orchestration. Whole-file restoration was not attempted.

## Reproduction and limits

[Reader](../data/r06-roots/prefs_reader.py) and
[tests](../data/r06-roots/test_prefs_reader.py):

```sh
python3 context/evidence/data/r06-roots/prefs_reader.py \
  "$HOME/Library/Application Support/Bitwig/Bitwig Studio/prefs/6.1.4.prefs"
python3 -m unittest discover -s context/evidence/data/r06-roots -v
javap -p -c -classpath '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar' \
  com.bitwig.flt.prefs.IVc com.bitwig.flt.prefs.A2V \
  com.bitwig.flt.prefs.iiq com.bitwig.flt.prefs.cEc com.bitwig.flt.app.TL
```

Seven focused tests pass: multiple roots with spaces/Unicode, disabled automatic
updates, every truncation of a synthetic fixture, unknown types, duplicate
fields, trailing bytes, invalid flags, and default/custom package resolution
are covered across those tests. The live three-state snapshots all parse.

This proves a sound-content configuration change is discoverable without any
index preamble or browser popup. It does not prove every platform/version or
settings override. Custom My Library and package relocation were statically
traced, not live-cycled. Music and plug-in list mutations were not live-cycled.
The installed prefs format is private and needs version admission or a tested
fallback. Resolving the running application's actual settings root and active
version remains an integration task; do not assume the agent's environment
matches Bitwig's or choose the newest prefs file by timestamp.

Implementation should refresh location configuration, include newly configured
roots, and distinguish unavailable/inaccessible roots, missing/stale indexes,
and unsupported records from a complete empty result. A configured root does
not prove its index is fresh or its files are readable. Direct recursive preset
enumeration plus metadata reading remains an alternative to decoding the
native/preset index preamble. Public discovery implementation is unscheduled.
