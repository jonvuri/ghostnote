---
title: Dogfooding run ledger
kind: status
state: active
updated: 2026-08-25
parent: README.md
---

# Dogfooding run ledger

This ledger is the index for root musical and tool-exposure sessions. Detailed
behavior and evidence stay in D01, D02, their linked evidence records, and the
[behavioral findings ledger](findings.md).

## Provenance

- **Observed** means that the session transcript or its own live handshake
  returned the value.
- **Timeline** means that the checked-out Ghostnote revision and description
  cohort active at the session time determine the value. The session did not
  return it.
- **Baseline** means that an adjacent live engineering handshake proved the
  value. The session did not return it.
- **Not applicable** means that the session did not contact that interface.

Public Ghostnote calls do not currently return the Bitwig Studio version, host
API version, extension method count, or extension build hash. A musical session
can therefore prove its public surface and project state without observing the
host build. Record the adjacent live baseline separately.

## Runs

### `01a0303d-ee7f-7d53-b691-9ae3caae375a` — bootstrap failure

- Transcript: `~/.codex/archived_sessions/rollout-2026-08-23T15-09-20-01a0303d-ee7f-7d53-b691-9ae3caae375a.jsonl`.
- Agent: Codex Desktop `0.149.0-alpha.4.1`; `gpt-5.6-sol`, high effort
  (**observed**).
- Ghostnote: native MCP registration failed. No public surface version applies.
  The later shell fallback is not a native Codex tool exposure. Repository
  revision `18933f4` was current when the session started (**timeline**).
- Bitwig: contacted by the manual fallback. The transcript did not return a
  host version. Bitwig Studio 6.0.6 and host API 25 were the live engineering
  baseline. The deployed extension baseline had 148 methods and hash
  `eb3391803ef4eea4` (**baseline**).
- Project: `New 2` (**observed**). See the bootstrap history in
  [README](README.md#bootstrap-history).

### `01a0304d-f855-73d0-99f9-38d3bb3486d8` — D01 musical source

- Transcript: `~/.codex/archived_sessions/rollout-2026-08-23T15-26-51-01a0304d-f855-73d0-99f9-38d3bb3486d8.jsonl`.
- Agent: Codex Desktop `0.149.0-alpha.4.1`; `gpt-5.6-sol`, high effort
  (**observed**).
- Ghostnote: `ghostnote-description-v7`, 45 registered tools, 40 exposed by
  Codex. Repository revision `18933f4` was current (**timeline** for the version
  and revision; **observed** for exposure).
- Bitwig: Studio 6.0.6, host API 25, and the then-current extension were the
  adjacent live baseline. The extension had 148 methods and hash
  `eb3391803ef4eea4`. The transcript did not return these values (**baseline**).
- Project: `New 2` (**observed**). See [D01](d01-native-codex-lofi-jungle.md).

### `01a03069-d710-7150-885e-74845fb88f50` — D01 exposure check

- Transcript: Codex CLI event output captured in parent engineering transcript
  `~/.codex/sessions/2026/08/23/rollout-2026-08-23T15-49-52-01a03063-0af3-74e0-99b5-61d6940289c1.jsonl`.
- Agent: Codex CLI `0.149.0`; `gpt-5.6-sol`, high effort (**observed in the
  captured event stream**).
- Ghostnote: `ghostnote-description-v8`, 45 registered and exposed tools
  at repository revision `008aa81` (**timeline** for the version and revision;
  **observed** for exposure).
- Bitwig and project: no Ghostnote or host call (**not applicable**). See
  [E74](../../evidence/experiments/e74-homogeneous-recurrence-schemas-restore-codex-tools.md).

### `01a0307a-5c55-7871-8a5f-f3402bfb8547` — D02 musical source

- Transcript: `~/.codex/sessions/2026/08/23/rollout-2026-08-23T16-15-20-01a0307a-5c55-7871-8a5f-f3402bfb8547.jsonl`.
- Agent: Codex Desktop `0.149.0-alpha.4.1`; `gpt-5.6-sol`, high effort
  (**observed**).
- Ghostnote: `ghostnote-description-v8`, 45 public tools at repository revision
  `fe44839` (**timeline**).
- Bitwig: Studio 6.0.6 and host API 25 were the adjacent live baseline. The
  deployed extension had 148 methods and hash `eb3391803ef4eea4`. The transcript
  did not return these values (**baseline**).
- Project: `New 2` (**observed**). See
  [D02](d02-drum-machine-and-surface-hardening.md#source-run).

### `01a030d1-b936-7460-841b-12d685238356` — D02 Session 1 exposure

- Transcript: `~/.codex/sessions/2026/08/23/rollout-2026-08-23T17-50-45-01a030d1-b936-7460-841b-12d685238356.jsonl`.
- Agent: Codex Desktop `0.149.0-alpha.4.1`; `gpt-5.6-sol`, high effort
  (**observed**).
- Ghostnote: `ghostnote-description-v9`, 46 registered and exposed tools
  at repository revision `abd5c41` (**timeline** for the version and revision;
  **observed** for exposure).
- Bitwig and project: no Ghostnote or host call (**not applicable**). The
  adjacent engineering check used Bitwig Studio 6.0.6, host API 25, and 148
  extension methods. See
  [E76](../../evidence/experiments/e76-public-native-drum-machine-composition-is-live.md).

### `01a03121-6f22-7461-b357-18053b3d272a` — D02 Session 4 exposure

- Transcript: `~/.codex/sessions/2026/08/23/rollout-2026-08-23T19-17-49-01a03121-6f22-7461-b357-18053b3d272a.jsonl`.
- Agent: Codex CLI `0.149.0`; `gpt-5.6-sol`, high effort (**observed**).
- Ghostnote: `ghostnote-description-v10`, 46 registered and exposed tools
  at repository revision `0e5f4df` (**timeline** for the version and revision;
  **observed** for exposure).
- Bitwig and project: no Ghostnote or host call (**not applicable**). See
  [E79](../../evidence/experiments/e79-container-and-note-refusals-are-explicit.md).

### `01a0313d-a405-7063-a184-d7263ac256d6` — D02 repeat musical run

- Transcript: `~/.codex/sessions/2026/08/23/rollout-2026-08-23T19-48-38-01a0313d-a405-7063-a184-d7263ac256d6.jsonl`.
- Agent: Codex Desktop `0.149.0-alpha.4.1`; `gpt-5.6-sol`, high effort
  (**observed**).
- Ghostnote: `ghostnote-description-v10`, 46 public tools at repository revision
  `0e5f4df` (**observed** for the surface; **timeline** for the revision).
- Bitwig: Studio 6.0.6, host API 25, and 148 extension methods were the adjacent
  deployed baseline. The extension method hash was `eb3391803ef4eea4`. The
  public session did not return these values (**baseline**).
- Project: `New 3` (**observed**). See
  [E80](../../evidence/experiments/e80-repeat-drum-dogfood-succeeds-with-qualifications.md).

### `01a035f0-78a4-7b00-9854-78460d6f8476` — piano expression run

- Transcript: `~/.codex/sessions/2026/08/24/rollout-2026-08-24T17-42-27-01a035f0-78a4-7b00-9854-78460d6f8476.jsonl`.
- Agent: Codex Desktop `0.149.0-alpha.4.1`; `gpt-5.6-sol`, high effort
  (**observed**).
- Ghostnote: `ghostnote-description-v13`, 47 public tools at repository revision
  `70a7abd85ee210793c8bbc96869b7f7d29367962` (**timeline** for the version and
  revision; **observed** for exposure).
- Bitwig: Studio 6.0.6, host API 25, 148 extension methods, and extension hash
  `eb3391803ef4eea4` were the adjacent deployed baseline. The public session did
  not return these values (**baseline**).
- Project: `New 2`, with four tracks, eight launcher rows, and no entry clips
  (**observed**). The final row-0 clip used stepped notes to approximate the
  requested continuous pitch curve. Row 1 was empty (**observed**).
- Outcome: Ghostnote could set one scalar expression value per note but could
  not write a continuous curve within a note. The agent substituted note
  fragments. The operator identified the mismatch; no acceptance was recorded.
  A permission reviewer denied one exact owned row-0 reversal, then allowed a
  similar row-1 reversal after another user message. This is one incidental
  supporting vote for [DF-001](findings.md#df-001--owned-reversal-can-look-like-unauthorized-deletion).

### `01a03744-e6c4-7be0-b210-e999c8f17081` — ColourCopy modulation run

- Transcript: `~/.codex/sessions/2026/08/24/rollout-2026-08-24T23-54-17-01a03744-e6c4-7be0-b210-e999c8f17081.jsonl`.
- Agent: Codex Desktop `0.149.0-alpha.4.3`; `gpt-5.6-sol`, high effort
  (**observed**).
- Ghostnote: `ghostnote-description-v13`, 47 public tools at repository revision
  `70a7abd85ee210793c8bbc96869b7f7d29367962` (**timeline** for the version and
  revision; **observed** for exposure).
- Bitwig: Studio 6.0.6, host API 25, 148 extension methods, and extension hash
  `eb3391803ef4eea4` were the adjacent deployed baseline. The public session did
  not return these values (**baseline**).
- Project: `26.01-1 spread burial guit`, with seven tracks and eight launcher
  rows (**observed**). ColourCopy was device position 1 on the third track. Its
  direct parameter inventory was stable (**observed**).
- Outcome: The public surface could not add modulators to the existing
  ColourCopy or mint an FX Layer with arbitrary nested plug-in targets. No
  Bitwig project content changed. Before the operator responded, the agent
  recorded the instruction as vetoed. This is one incidental supporting vote
  for [DF-002](findings.md#df-002--agent-can-invent-an-operator-verdict).

## Required fields for the next run

Record the root session ID, transcript path, client and client version, model,
reasoning effort, Ghostnote description cohort, public tool count, Ghostnote
source revision, Bitwig version, host API version, extension method
count and build hash, project name, and outcome. Record the provenance for each
field. Add a small public status field only if it can report host versions
without adding project risk.
