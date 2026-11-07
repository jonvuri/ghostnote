---
title: Wave 4 decision log
kind: note
state: active
updated: 2026-10-24
---

# Decision log

Append accepted wave-4 choices here. Keep earlier entries unchanged; append
a new entry if a choice changes. These entries record planning decisions.
They do not change runtime contracts or authorize implementation by themselves.
The user requested this local log before creating backlog items.

| Entry | Decision |
|---|---|
| [W4-001](#w4-001--retain-tcp-now-add-http-later) | Retain TCP/JSON-RPC; plan HTTP for the bridge extension later |
| [W4-002](#w4-002--workflow-order) | Song construction, then performable sounds, then mixing and capture |
| [W4-003](#w4-003--use-workflow-variations-for-functional-acceptance) | Prove breadth with practical workflow variations |
| [W4-004](#w4-004--sound-design-priorities) | Prioritize Grid and modulation; deeper device state is a bonus |
| [W4-005](#w4-005--midi-arrangement-and-automation) | Pursue feasible MIDI, arrangement, and automation breadth |
| [W4-006](#w4-006--recheck-pressure) | Recheck pressure and prepare an upstream report if confirmed |
| [W4-007](#w4-007--compare-producer-pal-formats) | Compare all Producer Pal note formats and transforms |
| [W4-008](#w4-008--audio-editing-and-focused-readback) | Focus audio on editing and track readback; operators record/export |
| [W4-009](#w4-009--prepare-projects-before-live-control) | Project construction and performance preparation precede live control |
| [W4-010](#w4-010--structure-and-reuse-follow-workflow-needs) | Structure and reuse have low priority unless a workflow needs them |
| [W4-011](#w4-011--platform-expansion-follows-the-main-path) | Platform expansion is later backlog work |
| [W4-012](#w4-012--accept-the-working-workflow-plan) | Accept the workflow sequence as the working direction |
| [W4-013](#w4-013--choose-authoring-routes-by-capability-and-speed) | Keep file authoring where it wins; full removal is evidence-dependent |
| [W4-014](#w4-014--triage-machinery-by-cost-and-usefulness) | Triage costly edit/history machinery; avoid a speculative rewrite |
| [W4-015](#w4-015--prepare-a-lightweight-early-release) | Prepare a lightweight release option after early workflows |
| [W4-016](#w4-016--select-the-triage-session-split) | Select performance, format, and legacy cleanup sessions; defer retention |
| [W4-017](#w4-017--recovery-floor) | Make requested effects the floor; custom reversal is optional |
| [W4-018](#w4-018--workflow-templates-use-current-material) | Use workflow templates with user-supplied material at execution |
| [W4-019](#w4-019--sample-device-crud-first) | Start with sample CRUD and externally sliced drum hits |
| [W4-020](#w4-020--sound-design-readback-scope) | Post-device, pre-fader, bounded existing-clip readback |
| [W4-021](#w4-021--retain-current-notation-by-default) | Keep FIELDS/JSON; compare formats, claims, and names in R01 |
| [W4-022](#w4-022--refuse-tools-with-unavailable-internals) | Refuse the whole tool on missing required internals; track dependencies |
| [W4-023](#w4-023--lightweight-tested-version-release) | List tested Bitwig versions; no guarantees outside the list |
| [W4-024](#w4-024--grid-writes-record-no-inverse-operator-undo-is-the-recovery) | Grid writes record no inverse; host undo stays operator-only |
| [W4-025](#w4-025--review-additions-to-the-working-sequence) | Add Effect tracks, track state, cue markers, name resolution, and R05 to the sequence |

## W4-001 — Retain TCP now; add HTTP later

Date: 2026-10-24. Source: user's transport and scope follow-up.

> Retain TCP and JSON-RPC for now, but explicitly plan for an HTTP transport for the bridge extension later on, as a backlog item.

**Accepted direction:** retain the current TCP/JSON-RPC bridge. Plan an HTTP
transport for the bridge extension later. The reasons are deployment through
proxies, local-network use, and simple Python/JavaScript calls in ad-hoc
scripts. The [Producer Pal comparison](https://producer-pal.org/guide/rest-api)
was discussion context, not a selected implementation.

**Possible companion:** a small Python reference test suite could be an
independent API consumer alongside the MCP server. This is a proposed pairing,
not a selected suite scope or a new client application.

**Boundary:** record the intent here only. Do not create the backlog item yet.
Do not add a transport or expose the current unauthenticated listener on the
network. HTTP endpoint design, access control, deployment, and test scope are
later design work. No choice between JSON-RPC over HTTP and REST is made.
This entry does not select a separate gateway in place of extension transport.

## W4-002 — Workflow order

Date: 2026-10-24. Source: user's transport and scope follow-up.

> I think all 3 workflows make sense to tackle eventually, with 'Build a song from existing material' coming first for sure, followed by 'Make a sound performable', and 'Mix and capture a project' last.

**Accepted order:**

1. Build a song from existing material.
2. Make a sound performable.
3. Mix and capture a project.

This selects the order of outcomes. It does not freeze the implementation
sequence for every capability. Shared prerequisites can serve an earlier
workflow. In particular, useful capture can belong to the song workflow even
though the broader mixing workflow comes third. Existing Phase 11 ownership
and scope stay in force; its placement within this order still needs mapping.

## W4-003 — Use workflow variations for functional acceptance

Date: 2026-10-24. Source: user's transport and scope follow-up.

> I would want to use variations of each workflow to prove out most of the feature matrix, but using practical, functional acceptance criteria the whole way.

**Accepted method:** use variations of the three workflows to exercise most
of the capability matrix. Judge each by a useful, observable result.

**Planning consequence:** map each selected row and verb to a functional
case. Name the object types, data fields, bounds, and preservation that the
case actually tests. A completed song does not prove every note field, a
macro does not prove Grid construction, and a master recording does not
prove stem export. Keep limits explicit without making perfect restoration
a universal completion condition. D15 and D49 remain unchanged.

## W4-004 — Sound design priorities

Date: 2026-10-24. Source: user's workflow-priority follow-up.

**Accepted direction:** pursue Grid construction and modulation as far as
feasible. Revisit live modulation setters using external implementations as
leads. Less common device state and nested device support are bonuses unless
they follow easily from the selected investigations.

Keep Phase 11 ownership and admitted limits. "As far as we can" sets a
direction; it does not prove a route or require unlimited research before a
useful instrument is complete. The proposed sequence gives each expansion a
bounded question and a useful result.

## W4-005 — MIDI, arrangement, and automation

Date: 2026-10-24. Source: user's workflow-priority follow-up.

**Accepted direction:** pursue all feasible detailed MIDI, arrangement, and
automation capabilities. Give these areas high priority within song work.
Include expression, timing, channels, overlaps, clip ranges, and curves.
Existing limits remain until new evidence changes them. A format can express
a field that the host cannot read or write.

## W4-006 — Recheck pressure

Date: 2026-10-24. Source: user's workflow-priority follow-up.

**Accepted direction:** audit the earlier pressure experiments and the
external implementations that use the same public API. Check for a missed
condition before concluding that the behavior is an upstream defect. Plan
a focused reproduction. If it confirms the defect, prepare evidence for
filing an upstream bug. Do not stop at citing the earlier result.

The user wants the investigation to lead to upstream filing if confirmed.
This planning session sends no report. A later session must first produce
the reproduction, exact result, and concrete report. D37 and the current
pressure warnings stay in force until superseded by evidence and a decision.

**Clarification — 2026-10-29:** the user said they would file upstream if the
issue was reconfirmed. Agent work ends with the local evidence and report;
this record does not authorize contact, submission, or transmission on the
user’s behalf.

## W4-007 — Compare Producer Pal formats

Date: 2026-10-24. Source: user's workflow-priority follow-up and
[Producer Pal MIDI notation](https://producer-pal.org/features/midi-notation).

**Accepted direction:** include Producer Pal in the format analysis. Compare
each format's capabilities, strengths, and weaknesses with Ghostnote
documents for agent authoring and DAW reads. Prepare tests for promising
formats. The scope includes bar|beat, MIDI JSON, Stark, and the separate
transform language. No adoption or replacement is selected.

## W4-008 — Audio editing and focused readback

Date: 2026-10-24. Source: user's workflow-priority follow-up.

**Accepted direction:** focus on create/read/update/delete operations over
audio clips, audio within devices, and a focused audio readback path for
external analysis. Prefer track-scoped readback through a quick, inaudible
bounce path. Extensive recording is not needed. Recording and final export
are generally operator tasks.

The desired bounce is a route requirement to investigate, not an established
capability. Historical master recording does not satisfy it. This narrows
the earlier broad capture/export goal; it does not remove existing tools.
No replacement based on audible playback is selected by this entry.

## W4-009 — Prepare projects before live control

Date: 2026-10-24. Source: user's workflow-priority follow-up.

**Accepted direction:** prioritize constructing projects for production and
preparing sounds for performance. Transport actions and live scene/clip
launches have lower priority. Include them when easy or needed by the task;
they remain in eventual scope.

"Offline" here means project preparation without a live performance. It does
not require editing project files without a running Bitwig host. Tempo,
meter, and timeline position can still be needed by high-priority editing.

## W4-010 — Structure and reuse follow workflow needs

Date: 2026-10-24. Source: user's workflow-priority follow-up.

**Accepted direction:** most structure and reuse work has low priority unless
it directly serves a selected workflow. Promote only the required object or
operation. A needed send does not select every routing mode; saving a sound
does not require a general export/reimport system. Operators can perform
recording and final exports under W4-008.

## W4-011 — Platform expansion follows the main path

Date: 2026-10-24. Source: user's workflow-priority follow-up.

**Accepted direction:** platform support improvements are desirable later
backlog work, with low priority now. Keep compatibility, reference retrieval,
packaging, and independent-client expansion outside the main creative path
unless a specific dependency blocks it.

Existing guards and required verification still apply. This does not revoke
the earlier degradation goal or Phase 10 ownership. W4-001 still records
HTTP intent without creating its backlog item. Consolidate later backlog
entries after the main sequence and remaining scope choices are resolved.

## W4-012 — Accept the working workflow plan

Date: 2026-10-24. Source: user's architecture and release follow-up.

> Great - this looks like a good plan.

**Accepted direction:** use V01–13 and R01–R04 as the working planning path.
Specific field bounds, remaining scope choices, and implementation briefs
still need selection. This accepts the plan; it does not authorize live
experiments, a release, or a change to existing runtime contracts.

## W4-013 — Choose authoring routes by capability and speed

Date: 2026-10-24. Source: user's architecture and release follow-up.

**Accepted direction:** capabilities and speed take priority over a preference
for live calls. Keep file authoring when it supplies useful capability or
better performance. Removing all host-format authoring and intermediate
staging could simplify the architecture, but count that benefit only when
available evidence makes complete replacement realistic.

This refines the earlier live-route preference. Partial replacement does not
establish that the complete file-authoring subsystem can be removed. User
media, document exchange, and analysis handoff files are separate concerns.
No file route is removed by this decision.

## W4-014 — Triage machinery by cost and usefulness

Date: 2026-10-24. Source: user's architecture and release follow-up.

**Accepted direction:** do not restructure the tested core for its own sake.
Review edit planning, verification, change records, and deep undo/redo when
they harm speed, maintenance, or capability expansion. Functional equivalence
of the requested project change is the goal. Keep machinery that works well.

The user asks for concrete candidates and plain explanations of any conflict
with D15 or D49. The [assessment](simplification.md) also identifies D19 and
the existing fidelity floor as more direct policy questions. No particular
safeguard removal, history limit, inverse policy, or contract amendment is
selected by this entry. A reusable package extraction is not a prerequisite.

## W4-015 — Prepare a lightweight early release

Date: 2026-10-24. Source: user's architecture and release follow-up.

**Accepted direction:** be ready for a lightweight release any time after a
few early workflows. Include minimal installation instructions, explicit
version/upgrade expectations, and a clean document-format specification.
Choose a better public format name. Keep the effort modest.

This refines W4-011: broad platform expansion stays low priority, while a
small early release becomes a readiness goal. The release point, feature
slice, name, and actual upgrade guarantees remain to be selected. Reuse the
existing publication artifacts and owners. No publication or new HTTP
backlog item occurs in this planning session. See the
[release outline and remaining choices](remaining-decisions.md).

## W4-016 — Select the triage session split

Date: 2026-10-24. Source: user's recovery and scope follow-up.

**Accepted work:** P01 combines repeated parameter inventories, full clip
captures, and useful D19 simplification. R01 incorporates dense document
claims/overlays into the Producer Pal comparison. C01 audits `stable-v1`,
confirms that it is obsolete and retirable, then removes it. Do not run full
change-record retention research unless evidence shows a maintenance or
performance cost. [Session briefs](work-sessions.md) define acceptance.

## W4-017 — Recovery floor

Date: 2026-10-24. Source: user's recovery and scope follow-up.

**Accepted floor:** nearly any loss that is an expected effect of the stated
tool is acceptable; custom reversal is generally unnecessary. Operations
must do what they mean, no more and no less. Normal undo, saves, and backups
are acceptable general recovery, even with multiple host undo steps.

Keep working machinery unless relaxation benefits maintenance or speed.
Retain broad verification/tracking in regression and upgrade tests where
useful without requiring it on every live product path. D19 must not remain
an implicit implementation gate. This durable policy is recorded in
[D54](../../../decisions/d54-recovery-is-not-a-prerequisite-for-requested-edits.md).
No runtime machinery is removed in this planning turn. Per-tool side-effect
examples remain for concrete discussion.

## W4-018 — Workflow templates use current material

Date: 2026-10-24. Source: user's recovery and scope follow-up.

**Accepted method:** define each workflow as a template that names the basic
functions it exercises. The user supplies real drum, bass, melodic, harmonic,
or other current Ghostworks material when the session runs. Do not fix all
source projects now. Ask about material acceptance choices when implementing
the affected capability.

## W4-019 — Sample-device CRUD first

Date: 2026-10-24. Source: user's recovery and scope follow-up.

**Accepted initial scope:** mainly get samples in and out of sample-capable
devices. Example: an external splicer cuts a beat into hits; Ghostnote puts
the hits into Samplers in a drum rack. Start with useful source CRUD and
required pad/device operations. Arbitrary multisample or plugin sample-state
editing is not implied. Source retrieval and processed sound readback are
distinct requirements.

## W4-020 — Sound-design readback scope

Date: 2026-10-24. Source: user's recovery and scope follow-up.

**Accepted primary use:** post-device, pre-fader readback for sound design,
using an existing clip from start to finish or over a bounded measure/two.
Simple parameterizations are acceptable. The earlier quick/inaudible
preference remains. R03 investigates the route. Sends, tails, sidechains,
and fallback remain case-specific choices; no route is claimed here.

## W4-021 — Retain current notation by default

Date: 2026-10-24. Source: user's recovery and scope follow-up.

**Accepted default:** keep the tested current FIELDS/JSON notation. R01
compares it with Producer Pal's formats, evaluates dense claims/overlays,
and considers a better public name. No name or syntax change is selected.

## W4-022 — Refuse tools with unavailable internals

Date: 2026-10-24. Source: user's recovery and scope follow-up.

**Accepted behavior:** generally refuse the whole requested tool if required
internal-host access is unavailable, including after an unresolved version
upgrade. Track the internal dependency of each tool class and concrete route.
The user hopes this remains a small set, mainly Grid; that is a preference,
not evidence that Arranger, automation, or audio routes are independent.

The [class register](host-access.md) and I01 define preflight refusal and
primary-only checks. Failure after some writes must report those effects;
it cannot promise that nothing happened. This does not select general
transactional rollback or automatic lossy fallback.

## W4-023 — Lightweight tested-version release

Date: 2026-10-24. Source: user's recovery and scope follow-up.

**Accepted posture:** clean documentation, simple versioning, and an explicit
list of tested Bitwig versions, with no guarantees outside that list. Keep
the early lightweight scope and timing. GitHub asset releases are the likely
delivery route. The exact release cutoff and artifact names can be selected
later. No release or HTTP backlog item is created here.

## W4-024 — Grid writes record no inverse; operator undo is the recovery

Date: 2026-10-24. Source: user's review replies.

> Drop the requirement. Since grid operations are net-new there is no benefit to keeping it.

> Stick with operator-only recovery for now.

**Accepted behavior:** Phase 11 Grid writes record no inverse and offer no
`revert_change` path. The change record is an execution receipt: requested
operations, completed operations, and independent readback. `revert_change`
and `check_revert` refuse Grid changes with a plain reason. This applies D54
to the first net-new capability; the [Phase 11 plan](../../phase-11/README.md)
and its ledger model are updated.

**Host undo stays operator-only.** The extension already has `app.undo`,
`app.redo`, and `app.undoState` on the public `Application` class in the
research probe profile. They were never exposed as normal tools by policy
(D19, E18f): host undo walks the project-wide stack, one structural call is
one step, and the stack mixes the operator's edits with the agent's. The
operator recovers with Bitwig undo, saves, and backups. A guarded agent-facing
undo tool is a named later option for P01 if a workflow shows the operator
repeating undo for agent edits. No runtime change occurs in this entry.

## W4-025 — Review additions to the working sequence

Date: 2026-10-24. Source: user's review replies.

**Accepted additions:**

- **V12** adds Effect-track creation (the SM-7 subset a send needs) and the
  track fields the mix uses (SM-1). V12 measures `Application.createEffectTrack`
  and corrects the `add_tracks` description. Group and Hybrid tracks stay
  bonus work.
- **V03** adds cue markers (SM-5) as optional scope for song sections. Only
  the tempo, meter, and position verbs of SM-4 are required.
- **V01** adds name resolution for a device, plug-in, or Bitwig preset
  (DP-5) and the short research brief
  [R05](workflow-sequence.md#r05--browser-and-catalog-name-resolution).
  E101 found the popup browser's content-type write ineffective on API 25;
  Control Deck and Gig Maestro use the same API with waits. R05 is a bounded
  re-probe, not an established route. If it fails, the offline native
  catalog and explicit VST3/CLAP IDs remain the resolution path. D22 is
  unchanged: vendor preset formats stay out of scope.
- **Coverage accounting:** `transport`, `cue-markers`, `track.state`,
  `container.other-types`, and `track.group-effect` leave their mixed groups
  so the report credits only the variation that lists their work record,
  with a verb-level limit where a row mixes priorities.
