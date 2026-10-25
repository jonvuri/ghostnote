---
title: Internal-host dependency register
kind: plan
state: active
updated: 2026-10-24
---

# Internal-host dependency register

**Policy:** if a tool needs internal-host access and that access is unavailable,
refuse the requested tool as a whole before any mutation. Keep independent
primary tools and support diagnostics usable. Do not silently run a subset
or substitute another route. A mid-operation failure must report partial or
uncertain effects; preflight refusal is not a promise of transactional rollback.

This is an initial class map, not a complete audit of all 45 normal tools.
[I01](work-sessions.md#i01--internal-host-dependency-register-and-refusal-boundary)
will enumerate exact tools and argument variants. Use `unknown` until the
transitive route and initialization dependencies are inspected.

| Tool class | Initial classification / evidence | Required follow-up |
|---|---|---|
| Connection and capability diagnostics | Diagnostic; support reporting must remain useful when an internal feature is unavailable. `check_grid_support` reads local admission data. | Check session negotiation and shared initialization, not only method dispatch. |
| Current Launcher note read/write | Public-controller route visible in [ClipReader](../../../../extension/src/main/java/com/ghostnote/extension/ClipReader.java), [read handlers](../../../../extension/src/main/java/com/ghostnote/extension/handlers/ClipReadHandlers.java), and [note handlers](../../../../extension/src/main/java/com/ghostnote/extension/handlers/NoteHandlers.java). Full dependency classification pending. | Trace each normal tool and helper; prove operation with optional internals disabled. Do not conflate pressure failure with internal-host admission. |
| Current track, mixer, device control, and structure tools | Public-controller candidates; full transitive audit pending. The [live adapter](../../../../brain/src/adapters/live/adapter.ts) combines several routes and guards. | Classify tool/argument variants and shared initialization. No broad primary-only proof is claimed here. |
| Preset-file authoring and insertion | File-format dependency is separate from internal-host access. Native insertion may use a public controller route. | Trace live wrapper stages and source bindings; classify each route rather than treating all private file formats as host internals. |
| Grid authoring | Required internal-host access for the planned native path; [D52](../../../decisions/d52-grid-upgrade-admission-policy.md) and [admission](../../../../brain/src/grid/admission.ts). Product writes are not yet normal tools. | Keep exact-build admission, whole-tool refusal, and bounded native command handling. |
| Arranger MIDI/audio and automation | Current external leads use internal descriptors/document operations; selected product routes are not yet proved. See [CA-3/4/5/6](../wave-3/clips-and-arrangement.md). | Classify after route selection; do not promise these remain usable if internals fail. |
| New live remote/modulation setters | Unknown until R04. Grid mappings do not prove outer modulation or remote-page access. | Record each setter and required model; source evidence alone is not admission. |
| Sample source CRUD and track readback | Unknown for the wider requested operations. Existing insertion/master capture does not establish their routes. | R03/V06 determine dependencies. Track bounce may need internals; no public route is assumed. |
| Popup-browser discovery | Public controller API (`PopupBrowser`, `InsertionPoint.browse`). E101 on API 25: the content-type index write had no effect; D22 removed the probe handlers. Control Deck and Gig Maestro use the same API with waits (Source). | [R05](workflow-sequence.md#r05--browser-and-catalog-name-resolution) re-probes with a wait and filter reset on one owned track; cancel on any mismatch. A route verdict is required before V01 claims name resolution. |
| Document codec and local MIDI/file conversion | Offline/local core; a host binding adds the dependencies of its tool. | Keep pure format/file functions usable without host access. |

Grid may not be the only internal-dependent class. The Arranger and automation
leads already make a broader set plausible; audio readback remains unknown.
The register makes that cost visible before a capability is selected.

For each concrete tool entry, record: tool/variant, required class, source
path, primary/internal dependencies, admission gate, preflight refusal,
partial-failure reporting, tested host build, and last failure-injection
result. Unknown proof must not be represented as tested degradation.
