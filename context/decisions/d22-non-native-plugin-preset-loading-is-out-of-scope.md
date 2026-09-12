---
id: D22
kind: decision
state: active
updated: 2026-09-12
source: D03, E101, E102
---

# D22 — Non-native plug-in preset loading is out of scope **[SETTLED 2026-09-12]**

Ghostnote does not load vendor plug-in preset formats. This exclusion includes
H2P, VSTPRESET, FXP, FXB, and presets found through CLAP preset discovery.
Ghostnote can still insert VST3 and CLAP devices and load Bitwig `.bwpreset`
files through its existing public sources.

D03 proved two direct host routes. VSTPRESET loaded from indexed and unindexed
paths. H2P loaded only from a path in Bitwig's private discovery index. The
supported controller API could not enumerate either catalog or complete a safe
popup-browser transaction. A general CLAP catalog would require Ghostnote to
load third-party plug-in binaries in an isolated scanner. That work is outside
the product boundary.

D03b and D04 are canceled. Their evidence remains valid, but it does not define
a future product commitment. Reconsider this decision only after an explicit
scope change and a supported Bitwig operation can address the required preset.

The D03-only popup-browser handlers and preallocated browser banks are removed
from the extension. The source probes remain as historical evidence. They are
not runnable against the product extension.
