---
id: E64
kind: evidence
state: active
source: phase-4-session-4j-closeout
---

# E64 — Phase 4 closes with a saved device baseline [K] (2026-08-22)

**Verdict: every Phase 4 exit criterion passes. The accepted sound-design
result is saved, the complete device matrix passes, cleanup restores the exact
project baseline, and remote CI passes for the Phase 4 candidate.**

## Saved project baseline

The saved `26.05-2 moon` project contains seven tracks and no launcher residue.
The complete 7-by-8 read-only baseline preserves all 14 accepted clips, the two
musical instruction records, and the exact 43-note open-minor result.

`Harmony – Open Minor` keeps this top-level device order:

`Key Filter+ → Repro-5 → Chorus+ → Reverb`

Fresh independent inventories returned stable Chorus+ and Reverb views after
all scratch work. They confirmed the nine accepted normalized values from E63:

| Device | Parameter | Value |
|---|---|---:|
| Chorus+ | LFO Speed | 0.22 |
| Chorus+ | Modulation Depth | 0.35 |
| Chorus+ | Mix | 0.30 |
| Reverb | Room Size | 0.72 |
| Reverb | Reverb Time | 0.50 |
| Reverb | Mix | 0.38 |
| Reverb | Stereo Width | 0.78 |
| Reverb | Low Band Reverb Factor | 0.10 |
| Reverb | High Band Reverb Factor | 0.46 |

## Complete live matrix

The final regression ran the native, VST3, CLAP, deep-route, drum-pad, remote,
managed-chain, interference, reversal, and clip workloads. All owned tracks and
devices were removed. The entry selection and the seven durable track ids were
restored.

| Workload | Final result | E61 budget |
|---|---:|---:|
| Native inventory | 2,964 ms | 3,500 ms |
| Native scalar replay | 4,606 ms | 6,000 ms |
| VST3 insert, inventory, and replay | 11,431 ms | 15,000 ms |
| CLAP insert, inventory, and replay | 12,586 ms | 15,000 ms |
| Depth-2 scalar replay | 7,177 ms | 9,000 ms |
| Remote inventory | 1,357 ms | 2,000 ms |
| Remote replay | 8,219 ms | 10,000 ms |
| Managed cold build | 49,841 ms | 60,000 ms |
| Managed warm build | 48,221 ms | 60,000 ms |
| Managed reversal, maximum | 16,480 ms | 20,000 ms |

The public MCP proof inserted native, VST3, CLAP, and preset devices. VST3 and
CLAP insertion took 1,668 and 1,666 ms. Polysynth returned 55 named parameters
in 1,207 ms. One returned id changed and read back exactly in 5,750 ms. Bypass
and both scalar reversals passed. Directed highest-first deletion removed all
four devices and the owned track.

Zebra3 VST3 returned 2,185 named parameters. Zebra3 CLAP returned 2,193. Each
format changed and restored `Attack Rate`. Polysynth and Sampler supplied the
native and preset proofs. Depth 1, depth 2, Drum Machine channel 3, and the
nine-page Polysynth remote view all changed and restored exact scalar bases.

The matrix also passed these explicit limits:

- A missing CLAP id returned a failed receipt and minted no device.
- An incomplete device bank refused before mutation.
- A concurrent top-level insertion changed the guarded chain and prevented a
  stale parameter write.
- A remote inventory returned exact selectors when stable. The public optional
  top-level view returned explicit instability and no partial selectors.
- `modulatedValue` remained present on stable remote controls. Typed modulation
  and automation state remain warnings, not proof that a static base value is
  what is heard.
- Offline exact-readback cases report silent parameter and enabled-state no-ops
  as disagreements. No final live matrix write was non-taking.

The clip regression measured a 1,638 ms exact-read median and a 6,066 ms
two-empty-clip workflow. Both accepted gates pass. Reversal restored both
scratch slots, and cleanup removed the owned track.

## Exit audit

| Criterion | Result | Evidence and qualification |
|---|---|---|
| 1. Natural public use | Complete | [E63](e63-device-dogfood-exposes-ab-selection-gap.md) records the accepted sound-design task and operator verdict. |
| 2. Native, VST3, and CLAP parameter depth | Complete | E55–E57 and the final matrix enumerate and independently verify more than eight parameters for each format. Plugin counts and availability are specific to this machine. |
| 3. Revertible mixed FX chain | Complete | [E59](e59-managed-fx-chain-is-live.md) and the final cold and warm runs prove ordered construction, tuning, checkpointing, exact scalar replay, and highest-first owned-device removal. Existing-device deletion remains unrecoverable. |
| 4. Native catalog resolution | Complete | [E56](e56-native-device-catalog-is-reproducible-and-resolved.md) resolves Polysynth and Sampler. E63 and this closeout resolve the accepted Chorus+ and Reverb devices through stable live inventories. |
| 5. Explicit boundary results | Complete | [E58](e58-deep-parameters-and-remote-controls-are-live.md), E59, [E62](e62-public-device-surface-is-live.md), and this matrix cover depth 2, drum pads, remotes, warnings, bypass, silent no-ops, and incomplete windows. |
| 6. Exact cleanup | Complete | Every owned scratch track and device was removed. The final seven-track, 14-clip baseline and accepted device values pass. |
| 7. Verification gates | Complete | Focused live probes, 758 offline tests, 54 live conformance cases with six expected skips, extension build, the 148-method handshake, context and diff checks, and remote CI pass. |
| 8. Phase 5 handoff | Complete | Remote-control base and `modulatedValue` readback are the live modulation verification instrument. Offline `bwmod.validate()` remains only a load predictor. |

## Final remote CI

[GitHub Actions run 32603767285](https://github.com/jonvuri/ghostnote/actions/runs/32603767285)
passed on its first attempt for exact candidate
`b11bfc6aceee7857b534ee2f315a08cec0388ad2`. The `brain (offline suite)` and
`extension (compile)` jobs both passed.

## Qualifications

- General DirectParameter values are normalized bases. DirectParameter display
  text is not available. Typed views and remote controls provide display,
  automation, modulation, origin, or discrete metadata only when observed.
- The remote bank contains 16 pages with eight controls per page. Larger or
  unstable targets refuse without a partial inventory.
- Device positions are not identity. Complete name-and-enabled sequences are
  guards, not durable device keys.
- The checked-in native catalog is for Bitwig 6.0.6. Installed plugin identity,
  availability, parameter count, and timing are machine-specific.
- Phase 4 controls existing scalar and structural device state. It does not
  author modulator topology. Phase 5 owns that integration.

## Retrospective

The general parameter inventory was sufficient for the natural task. No
device-specific view is needed. The closeout lookup was efficient because E61
already defined one complete performance command and fixed budgets. No process
change is needed.
