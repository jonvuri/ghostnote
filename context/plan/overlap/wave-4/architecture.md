---
title: Wave 4 architecture assessment
kind: note
state: active
updated: 2026-10-24
---

# Architecture assessment

## What exists

| Layer | Inspected source | Finding |
|---|---|---|
| Host server | [Bridge.java](../../../../extension/src/main/java/com/ghostnote/extension/Bridge.java), [extension initialization](../../../../extension/src/main/java/com/ghostnote/extension/GhostnoteExtension.java) | The extension hosts newline-delimited JSON-RPC 2.0 over loopback TCP, port 8686. Requests run on the controller thread. The bridge does not require MCP. |
| Wire client | [client.ts](../../../../brain/src/client.ts) | `BridgeClient` correlates replies, handles framing, and reports timeout or disconnect. It is not a complete high-level editing API. |
| Session and host adapter | [session.ts](../../../../brain/src/session.ts), [live adapter](../../../../brain/src/adapters/live/adapter.ts) | Reconnect, generation, project changes, method/profile checks, and adapter lifetime already have a home outside MCP transport. No separate daemon exists. |
| Edit core | [engine](../../../../brain/src/engine/), [workspace.ts](../../../../brain/src/surface/workspace.ts) | Edit execution, change records, reversal, selection, and document identity are reusable concerns. Some orchestration still sits under `surface/`. |
| Document | [codec](../../../../brain/src/document/index.ts), [bindings](../../../../brain/src/bindings/launcher-clip-document.ts) | The codec and host projection are distinct TypeScript modules. The document is not the Java bridge's wire format. It already has offline uses and a CLI. |
| Agent interface | [mcp-server.ts](../../../../brain/src/mcp-server.ts), [agent-native.ts](../../../../brain/src/surface/agent-native.ts) | MCP registration is small, but the wider surface contains validation, projection, tool semantics, and orchestration. The full client boundary is not yet a standalone package. |
| Internal admission | [admission.ts](../../../../brain/src/grid/admission.ts), [D52](../../../decisions/d52-grid-upgrade-admission-policy.md) | Grid writes require exact-build admission. Current normal tools expose the support check, not Grid writes. This is a basis for feature isolation, not universal fallback proof. |

The split already supports a small reuse assessment. The user prioritizes
simplifying costly machinery over extracting a new package. See the
[concrete triage and contract assessment](simplification.md). This inspection does not
prove complete dependency closure or a safe raw-write contract for arbitrary
clients. W4-B defines that audit before any packaging promise.

## Proposed ownership

| Layer | Owns | Should not require |
|---|---|---|
| Extension and host protocol | Host objects, observers, target identity, atomic guards, bounded operations, host completion, capability discovery | MCP, analysis providers, Ghostworks records, or a document codec |
| Reusable client core | Session lifecycle, validated edits, independent result checks, selection scope, file handoffs; history policy subject to triage | An agent transport or a separate always-running service |
| Optional document module | FIELDS/JSON parsing, serialization, patches, and host projection through the core | Java-side format parsing or MCP-only use |
| MCP adapter | Tool schemas, descriptions, agent references, task-sized responses | Private copies of host safety or a mandatory analysis stack |
| Ghostworks / other consumers | Library, provenance, transcription, timing and other analysis | Direct access to internal host objects |
| Agent | Cross-system coordination, composition, interpretation, and creative choices | A new permanent Ghostnote-to-Ghostworks dependency |

These are proposed responsibility boundaries, not five required packages.
Keep code together until a real consumer needs separate distribution.

The extension must enforce host safety for every client. A reusable client
can add orchestration and better errors, but cannot be the only place that
prevents an invalid host call. Document claims and analysis overlays remain
outside the host wire contract. Structured note data, timing, IDs, and bounded
operations still belong in that contract.

## Direct client choices

| Choice | Value | Cost and recommendation |
|---|---|---|
| Document the existing wire protocol | Makes direct experiments possible now | Specify handshake, limits, target lifetime, errors, timeout uncertainty, and write scope. Documentation alone leaves callers to rebuild orchestration. |
| Expose a small reusable entry point; MCP is the main consumer | Reuses tested behavior for scripts and future clients | Keep tested modules together. Use one small script to find actual MCP coupling; move only blocking glue. Triage costly history or reads before fixing them into a public API. |
| Add a separate reference app or daemon | Can serve a named UI or long-lived operation | Defer until that consumer or lifetime requirement exists. More process state, packaging, and support need a concrete return. |
| Add HTTP to the bridge extension | Simple Python/JS calls, proxy deployment, and local-network use | Accepted future intent in [W4-001](decisions.md#w4-001--retain-tcp-now-add-http-later). Retain TCP/JSON-RPC now; create no backlog item yet. A small independent Python reference suite is a possible companion. |
| Add OSC/UDP | Could serve a controller or real-time integration | No blocking consumer is named. Keep the current TCP protocol for this plan. Reconsider only with a measured transport need. |

The MCP brain remains a reference consumer. W4-001 identifies a possible
Python test suite as an independent API consumer for the future HTTP path.
It need not depend on a TypeScript SDK. A small script that reads a
clip, submits a guarded edit, and verifies its result would demonstrate
non-MCP use more cheaply than a new app. That future live test must use an
owned scratch target and the usual operator deployment procedure.

## Selected degradation behavior; proof still required

[W4-022](decisions.md) selects whole-tool refusal when required internal access
is unavailable. [I01](work-sessions.md#i01--internal-host-dependency-register-and-refusal-boundary)
and the [class register](host-access.md) track each tool and route. Public
controller, internal-host, file-format, and diagnostic dependencies are
separate. Arranger/automation leads suggest the affected set may exceed Grid.

Check all required capabilities before the first mutation. Do not execute a
public subset or choose a lossy fallback silently. If access fails after
some work landed, stop and report partial/uncertain effects; a preflight
policy cannot promise rollback. Keep primary initialization and diagnostics
independent from optional internals. Test initialization, negotiation, and
runtime refusal, not only Grid admission. D52 still governs repair and
native admission; D54 does not remove host transaction mechanics.

## File and analysis handoff

W4-008/020 prioritize quick inaudible post-device/pre-fader track readback
from an existing clip over its full span or a measure/two. Recording and final export
are generally operator tasks. R03 in the [workflow sequence](workflow-sequence.md)
assesses the route; historical master capture does not prove it.

Use explicit source and output identities. A proposed readback result should
state path, content hash, rate, channels, duration, project and source scope,
musical time origin, captured bounds, and any lead/tail uncertainty. Define
which fields the selected route can actually prove. Library asset IDs remain
Ghostworks-owned. An analysis failure must not invalidate a completed capture.

Keep small file facts needed for safe interchange in Ghostnote. Move loudness,
key, harmony, similarity, and other interpretations to external consumers.
Do not delete accepted analysis components in this planning pass. A later
migration needs a caller inventory and an explicit compatibility choice.

Offline Bitwig docs belong outside the host runtime. Begin with a bounded,
versioned local index and exact source references for a demonstrated task.
"Instant" is a latency goal to measure. Documentation is not live capability
proof, and the document-format reference is not a Bitwig manual index.
