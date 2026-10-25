---
title: Wave 4 direction and scope inputs
kind: note
state: active
updated: 2026-10-24
---

# Direction and scope inputs

## User direction, 2026-10-24

This section records the kickoff message. It is a planning input, not a
claim that the capabilities exist or a change to the write contract.

- Ghostnote should be a comprehensive Bitwig interaction layer. It should
  create, read, change, and organize projects. Workflows include new ideas,
  sound design, live performance preparation, arrangement, mixing, and mastering.
- Compose stock devices, plugins, samples, and MIDI. Generative audio is out
  of scope. Musical choices and composition can stay with the agent.
- Export presets, MIDI clips, and samples to a personal library. Record
  direct audio output for external tools. Ghostworks is the intended personal
  library and analysis system.
- Move most audio and MIDI analysis outside Ghostnote's supported scope.
  Retain detailed host reads and writes that external analysis needs.
- At kickoff, prefer live operations over preset-file construction when they
  can meet the task; W4-013 later makes capability and speed decisive. Deprioritize new preset-authoring infrastructure. This does not
  remove current supported operations or the need to export presets.
- Direct clients should be possible without MCP. Assess the current
  extension/server split, a client library, and a documented reference client.
- Internal-host failures after an upgrade should leave primary controller
  capabilities usable. Self-repair is desirable, but failure must degrade
  capability rather than block all use.
- Keep an agent interface, the Ghostnote document format, and offline
  Bitwig reference retrieval. Consider Ghostworks interaction and audio
  interpretation through external consumers. The user already uses an agent
  as an informal bridge between the systems.
- Leave wave 3 mostly unchanged. Use wave 4 for new reports and decisions.

## Accepted priority refinement

[W4-004 through W4-011](decisions.md) refine the kickoff scope. MIDI,
arrangement, and automation have high priority. Grid construction and
modulation also have high priority; revisit live setters. Pressure needs a
fresh audit and reproduction, with upstream evidence if the defect persists.
Compare all Producer Pal notations and transforms with Ghostnote documents.

Audio work focuses on clip CRUD, audio within devices, and quick inaudible
track readback for external analysis. Operators generally record and export.
Live launching, broad structure/reuse, rare device state, and platform
expansion have lower priority unless needed by a workflow. This is project
preparation in a running DAW, not a requirement for host-free file editing.
See the [proposed sequence](workflow-sequence.md).

## Later architecture and release refinement

W4-012 accepts the working workflow plan. W4-013 keeps file authoring where
capability or speed justifies it. Full removal is a possible simplification
only if evidence supports every required replacement. W4-014 prioritizes
triage of costly edit/history machinery over speculative core extraction.
W4-015 adds a lightweight early release option after a few useful cases.
See [simplification](simplification.md) and [remaining choices](remaining-decisions.md).

## Settled recovery and execution scope

W4-016–023 select the research/cleanup split, workflow templates with inputs
supplied at execution, basic sample-device CRUD, post-device/pre-fader clip
readback, current notation by default, whole-tool refusal on missing required
internals, and tested-version-only lightweight release support.
[D54](../../../decisions/d54-recovery-is-not-a-prerequisite-for-requested-edits.md)
removes the universal agent-reversal obligation. Keep working machinery unless
simplification benefits performance or maintenance. The current product still
implements its existing behavior; P01 will change selected paths explicitly.

## Draft vision

Ghostnote gives people, agents, and programs a dependable way to inspect and
edit Bitwig projects. It supplies host control, detailed musical data, and
verified media handoffs. A reusable client layer supports those operations.
MCP presents them to agents. External tools own library organization and
musical or audio interpretation.

Build complete creative workflows in small steps. Keep broad interaction as
the long-term goal. Do not interpret "comprehensive" as a requirement to
finish every capability before the system is useful.

The vision wording above was a proposal. The user subsequently selected song
construction first, performable sounds second, and mixing/capture third.
Practical variations should exercise most of the feature matrix. The
[decision log](decisions.md) records these choices and the future HTTP intent.
The [backlog](../../../BACKLOG.md) now selects implementation work and its
order. Detailed choices for each item remain with its implementation.

## Scope distinctions

| Keep in Ghostnote | Place outside the supported host product |
|---|---|
| Detailed MIDI and clip state, editing, import, and export | Harmonic interpretation, transcription, pattern and section analysis |
| Audio clip CRUD, device sample state, and focused track readback | Separation, feature extraction, similarity, and semantic library search |
| File identity, timing origin, duration, rate, channels, and bounds needed for a correct handoff | Musical judgments and audio feature providers |
| Device discovery inside Bitwig; explicit device/preset paths | Cross-project asset catalogs and provenance |
| Workflow-required project interactions and save verification | Library project folders, source history, and registration |
| Later agent reference retrieval for the installed Bitwig version | A new general documentation or analysis platform |

"Raw" should mean uninterpreted musical data, not unguarded host writes.
Readers must state coverage and unsupported fields. Writers must report
what changed, what was preserved, and what they could not verify.

## Critical assessment

1. **A thin MCP interface can reuse existing modules.** Keep validated edits
   and result checks outside transport-specific glue. Expose a small entry
   point when a script needs it. Triage history and repeated reads before
   treating every current mechanism as a required public client feature.
2. **Live operation does not imply lower cost.** It can avoid file rewriting
   but add traversal, waits, and upgrade-sensitive calls. Wave 3's historical
   native offline composition was about 3.4/4.0 seconds for two/four chains;
   staged composition was about 17.5/30.4 seconds. These are different paths,
   not a benchmark of a proposed native replacement. Compare one named task
   before replacing an accepted route. See [cost context](../wave-3/delivery.md#cost-inputs-for-later-comparison).
3. **Preset export and preset authoring are different.** Saving a sound made
   live can serve a workflow; automated export is now a lower-priority dependency. DP-6 currently has an action-based source lead,
   without file or reload proof. Deferring a codec does not solve export.
4. **Audio output has distinct costs.** A master recording does not provide
   isolated stems, exact render bounds, or offline bounce. Existing capture
   proof is master-only on 6.0.6. The user now prefers quick inaudible track readback; R03 must establish its
   route. Recording and final export are generally operator tasks.
5. **External analysis and built-in sensory providers conflict if both are
   mandatory.** A capture result plus file identity can support an external
   provider without bundling it. Keep provider adapters optional and select
   one only when repeated agent handoffs are a demonstrated problem.
6. **Graceful degradation is a behavior to prove.** A Grid admission refusal
   is not proof that every public path survives every internal failure.
   Optional initialization, dispatch, client negotiation, and mixed requests
   need explicit failure behavior. Do not silently substitute a lossy route.
7. **A protocol is not yet a supported SDK.** The raw bridge exists. A public
   client must also handle identity, freshness, partial completion, disconnects,
   and ownership. An extracted core plus a small direct-use example can prove
   the boundary before a separate app or multiple language SDKs are justified.
8. **A full song needs more than note writes.** Audio placement, required routing,
   timeline reads, and automation are separate requirements. Save and final
   export can use operator steps.
   Select an actual song task before paying for all of them. Mastering here
   means operating the necessary devices and output path; external consumers
   can measure and judge the audio.

## Current evidence and contract

[Ghostworks vision](../../../../../ghostworks/context/VISION.md) and
[README](../../../../../ghostworks/README.md) already use explicit file and
result handoffs. Ghostworks owns library records; Ghostnote owns Bitwig
control. Its vision names project create/open/save as ownership, not proof
that all three are implemented in Ghostnote. Its current code and docs include
transcription, timing, separation, and project-source tracking. This was a
read-only local inspection; no provider or library task ran.

The prior preference for functional equivalence remains relevant.
[D15](../../../decisions/d15-verification-discipline-settled-2026-07-25.md)
requires input checks and independent readback.
[D49](../../../decisions/d49-revert-fidelity-states-what-the-revert-restored.md)
requires truthful revert reporting. Neither requires universal exact reversal.
For a selected task, name allowed identity or metadata changes and required
preservation. D54 is the new recovery decision. Expected effects of the stated operation
are acceptable; unintended pressure, automation, or unrelated-state changes
are not automatically authorized. Resolve concrete cases at implementation.
