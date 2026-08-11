---
id: E4h
kind: evidence
state: active
source: FINDINGS.md
---

# E4h — Templates as repo assets, not Library entries (2026-07-19)

**Verdict: ● presets can ship with the project.** The Bitwig Library is not
involved: `insertFile` takes any filesystem path, and after loading, the file
is no longer referenced. Probe `e04h`, all green.

| test | result |
|---|---|
| absolute path to a repo asset | ● loads all 4 chains |
| **relative path** | ○ **does not load** |
| spaces, em dash, parentheses in path | ● fine |
| **non-`.bwpreset` extension** | ○ **does not load** |
| missing file | ○ silent no-op, no error |
| **file deleted after loading** | ● structure + devices unaffected |

### The two operational rules

- **Paths must be ABSOLUTE.** The extension runs inside Bitwig, so a relative
  path resolves against *Bitwig's* working directory, not the brain's. The
  brain must resolve repo-relative asset paths before they cross the bridge.
- **The `.bwpreset` extension is REQUIRED.** Bitwig dispatches on the
  filename, not the content — byte-identical data named `.template` is
  ignored. Repo assets must keep the extension.

Both failure modes are **silent**, as is a missing file: `insertFile` gives
no negative acknowledgement, matching the documented *"some things may not
make sense to insert… nothing happens"* semantics. ⇒ every insert must be
confirmed by reading back the resulting chain contents.

### Presets are a build-time asset, not a runtime dependency

After `insertFile`, the preset file was **deleted** and the loaded structure
was unaffected — all four chains intact, devices still live (55 params
enumerated, writable). `insertFile` copies content into the project; nothing
retains a reference.

⇒ **templates belong in the repo** (e.g. `assets/presets/*.bwpreset`),
version-controlled alongside the code, with no dependency on the user's
Bitwig Library and no install step. They are inputs to a build, not
installed content.

⚠ **Caveat:** verified in-session only. A project save + reload would confirm
it fully, and **sample-bearing** presets are the case to watch — a Sampler
chain may *reference* audio files rather than embed them, which would
reintroduce an external dependency the structural devices do not have.

### Decision impact

- **Ship templates in-repo**; no Library installation, no user setup beyond
  the one-time authoring of each shape.
- **Contract/executor:** absolute paths only; assert the `.bwpreset`
  extension at the tool boundary (a wrong name fails silently otherwise);
  verify every insert by chain readback.
- Revisit embedding vs. referencing if a template ever contains samples.

---
