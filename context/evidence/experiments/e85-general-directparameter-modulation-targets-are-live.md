---
id: E85
kind: evidence
state: active
source: phase-5-session-5j
---

# E85 — General DirectParameter modulation targets are live [K] (2026-08-26)

**Verdict: `author_modulators` now accepts one exact DirectParameter id and
name for native, VST3, and CLAP routes. Ghostnote derives the hidden route. The
same target identity verifies the loaded id, name, base value, and
`modulatedValue` when the host exposes an exact behavior witness. Native and
VST3 behavior pass live.**

## Public target contract

The caller supplies `{ parameterId, parameterName }` from one stable
`inspect_device_parameters` result. The public schema has no route, list
position, byte offset, or remote-page position. Native ids remain unchanged.
Plug-in ids such as `CONTENTS/PID411` resolve internally to
`CONTENTS/ROOT_GENERIC_MODULE/PID411`.

The three original target names remain compatibility mappings. They resolve to
the same target value and use the same verifier. Plain devices and internally
resolved container locations use the same route converter.

## Exact behavior proof

Verification first reloads the edited preset and resolves the exact
DirectParameter id. It rejects a changed name. Samples require a stable base,
known false automation state, and the requested active or inactive divergence.
A missing id, unstable inventory, moving base, unknown automation state, silent
route, or duplicate supplementary witness is a post-write verification failure.
The recorded insertion stays visible.

Bitwig DirectParameter observers expose ids, names, and base values for CLAP and
VST3, but they do not expose `modulatedValue`. A plug-in with an exact remote
control can use that control as an internal supplementary witness. Zebra3 and
Repro-5 CLAP expose no remote pages on this host. The live plug-in proof
therefore uses an internal typed Zebra3 VST3 parameter handle. The public target
contract and result remain the exact DirectParameter id and name.

## Live matrix

The combined probe ran on Bitwig Studio 6.0.6 with extension API 25.

- Native Polysynth used `CONTENTS/F1FREQ`, `Filter Frequency`. Its base stayed
  at `0.6929126260`. Maximum divergence was `0.0035618381` and automation was
  false.
- Zebra3 VST3 used `CONTENTS/PID411`, `Cutoff`. Its base stayed at `0`.
  Maximum divergence was `0.4813005328` and automation was false.
- Each public insertion returned a recorded change. Ordinary reversal removed
  the inserted device and restored the empty owned track.
- Final cleanup restored the exact four entry tracks: `Inst 1`, `Audio 2`,
  `FX 1`, and `Master`, with the same channel ids and positions.

## Verification

- Focused DirectParameter, engine, and public-surface cohort: 135/135 pass.
- Complete brain check: 895/895 pass.
- Extension build and tests: pass.
- Contract handshake: 148 methods, hash `eb3391803ef4eea4`.
- Deploy freshness: pass. The running controller started after the deployed
  extension.
- Combined native and VST3 live matrix, reversal, and exact cleanup: pass.
- Diff whitespace checks: pass.

## Retrospective

Measure each host's DirectParameter ids and observation channels before the
combined live proof. Native and plug-in ids need different route forms, and
format-neutral DirectParameter observers do not provide `modulatedValue`.
