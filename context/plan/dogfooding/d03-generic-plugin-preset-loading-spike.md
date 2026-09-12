---
title: D03 — Generic plug-in preset loading spike
kind: plan
state: complete
updated: 2026-09-12
parent: README.md
session: d03-generic-plugin-preset-loading-spike
source: 01a0965e-2ec6-7482-9719-73c51b8a1ea8
evidence: E101
---

# D03 — Generic plug-in preset loading spike

## Source run

- Session ID: `01a0965e-2ec6-7482-9719-73c51b8a1ea8`.
- Transcript:
  `~/.codex/sessions/2026/09/12/rollout-2026-09-12T11-05-49-01a0965e-2ec6-7482-9719-73c51b8a1ea8.jsonl`.
- Agent: Codex Desktop `0.153.4`; `gpt-5.6-sol`, high effort.
- Ghostnote: 53 exposed tools from `ghostnote-description-v21` at repository
  revision `7928314cb9f435926d03a227f3939a06c946ece9`.
- Project: `26.11-1 garden synth 1`, with four tracks and eight launcher rows.

The run requested a three-voice orchestration. It needed a Repro-5 flute and a
Diva piano preset. The agent found suitable H2P files, but the public
`add_device` contract accepts only `.bwpreset` files. The operator required
Ghostnote-only Bitwig control. The agent stopped without a Ghostnote write.

This is a public product gap, not a proved host limitation. E4h renamed valid
`.bwpreset` bytes to `.template`. It proved filename-based dispatch for that
file, but it did not test a valid plug-in preset format. The current brain
incorrectly uses that result to reject every non-`.bwpreset` extension. The
extension already passes a path to `InsertionPoint.insertFile` without its own
extension restriction.

## Objective

Determine which Bitwig-supported plug-in preset formats load reliably through
direct file insertion. Compare that route with the popup-browser API. Produce
one evidence-based product direction without adding vendor-specific behavior.

## Questions

1. Does `InsertionPoint.insertFile` append a device from each supported preset
   file when the caller supplies its exact absolute path?
2. Does direct insertion need Bitwig to index the source path, or does an
   unindexed byte-identical copy also load?
3. Can device name, preset name, parameter inventory, and complete chain
   readback verify the result without parsing a vendor format?
4. What are the cold and warm times for direct insertion and popup commit?
5. Which presets exist only through Bitwig or CLAP discovery and have no usable
   file path?
6. Can the popup route select one exact result, cancel every failed attempt,
   and resist concurrent user interaction?

## Known host surface

Bitwig documents H2P, FXP, FXB, VSTPRESET, and vendor-specific formats exposed
by CLAP preset discovery as plug-in preset sources. The controller API exposes:

- `InsertionPoint.insertFile(path)` and `InsertionPoint.browse()`;
- one global `PopupBrowser` with content-type and filter columns;
- result banks with item names, selection, counts, and scroll position; and
- audition, commit, and cancel controls.

The popup API does not expose the text-search field, a result path, or a durable
result id. It is a discovery fallback, not an equal substitute for an exact
path.

## Local fixture inventory

| Format | Trustworthy local fixture | Planned case |
|---|---|---|
| `.bwpreset` | Existing Ghostnote Sampler fixture | Direct control |
| `.h2p` | 99,635 u-he files in the standard audio preset roots | Repro-5 `KEY Peace Flute` |
| `.fxp` | 329 u-he files | One Filterscape preset |
| `.vstpreset` | 22 Softube Weiss presets | One Weiss preset |
| `.fxb` | One internal Kilohearts resource bank | Test only if it proves to be a genuine loadable bank |
| CLAP discovery | sforzando, Quanta 2, Stochas, TAL-Sampler, TX16Wx, and Reflection Step are installed | One non-u-he discovered preset with no assumed file path |

Bitwig plug-in-state cache files are not fixtures. AUPRESET is not in Bitwig's
documented plug-in preset set and is out of scope. Proprietary XML, KELVIN,
VPRESET, SERUMPRESET, and similar files remain out of the direct matrix unless
Bitwig exposes them through CLAP discovery.

## Evaluation rubric

Evaluate each route on the same four dimensions:

| Dimension | Evidence |
|---|---|
| Flexibility | Supported formats, indexed-path dependency, discovery-only coverage, and required caller knowledge |
| Speed | One cold time and three warm times from request start to stable verified readback |
| Reliability | Three consecutive warm successes, exact no-op detection, cleanup, and popup cancel behavior |
| Operational cost | Host operations, implied public round trips, modal-state exposure, and readback needed for proof |

Report the warm median and range. Keep the cold result separate. Three warm
samples are a gate for deterministic behavior, not a statistical performance
claim. A cold sample is the first plug-in load after a Bitwig restart. Restart
Bitwig before each route's cold sample, re-establish the handshake, and confirm
the disposable project baseline before the timed request.

## Safety baseline

1. Use a new disposable Bitwig project. Do not use `26.11-1 garden synth 1` or
   the accepted ColourCopy project.
2. Record the project name, complete track ids, track count, launcher row count,
   and device order before the first write.
3. Create only owned scratch tracks and devices. Do not load a preset into a
   pre-existing device.
4. Disable popup audition before result selection.
5. Remove each case immediately after its measurements. Confirm the complete
   baseline again at the end.
6. Stop after any result that cannot be identified or reversed exactly.

## Route 0 — inventory and classification

1. Freeze the installed manufacturer, plug-in format, preset suffix, and preset
   root inventory in the evidence record.
2. Classify each suffix as an explicitly documented Bitwig file format, a
   CLAP-discovered format, host-external, or unknown.
3. Check whether Bitwig exposes representative proprietary formats through the
   popup browser. Do not send unknown suffixes to direct insertion.
4. Select one fixture per documented format and one non-u-he CLAP discovery
   case. Record why each fixture is safe and representative.

## Route A — direct file insertion

1. Add one internal probe that can send an absolute file path to the existing
   `device.insertFile` wire operation. Do not expose a public tool.
2. Add internal preset-name readback if the current device inventory cannot
   observe `Device.presetName()` reliably.
3. Run the `.bwpreset` control first.
4. For H2P, FXP, and VSTPRESET, test the original indexed path on a fresh owned
   track. Record the complete chain before and after, elapsed time, device name,
   preset name, and DirectParameter name and base fingerprint.
5. Repeat each successful case from an unindexed byte-identical temporary copy
   with the original extension.
6. Run missing-file, wrong-extension, and incompatible-context controls. A
   silent no-op must return no false success and no residue.
7. Run one cold sample and three consecutive warm samples. Do not average away
   the first plug-in load.
8. Delete the owned device or track after every case and confirm exact absence.

## Route B — popup browser

1. Pre-allocate the popup browser, filter banks, and result bank during
   extension initialization. Keep all new operations internal to the spike.
2. Open the browser from an owned empty chain insertion point. Confirm its
   title, content type, and result state before selection.
3. Disable audition. Select the Preset content type, then constrain file type,
   device, creator, and location as available.
4. Require one exact and unique result name before commit. Record every filter,
   result count, result-bank position, and selected name.
5. Load the same H2P, FXP, and VSTPRESET cases used by route A. Run one cold
   sample and three consecutive warm samples. Compare device name, preset name,
   DirectParameter fingerprint, and total elapsed time.
6. Test one non-u-he CLAP plug-in whose presets Bitwig discovers without an
   assumed file path.
7. Cancel on every timeout, ambiguous result, changed selection, changed
   filter, or operator interference. Confirm that the popup closes and that no
   device remains.
8. Commit only on an unchanged guarded result. Remove the owned result and
   confirm exact absence.

## Format decisions

Give each format one result:

- `direct`: original and unindexed paths load with complete verified readback;
- `indexed-direct`: only the indexed original loads, with that dependency
  explicit;
- `browser-only`: the popup route loads it, but direct insertion does not;
- `unsupported`: neither measured route loads it; or
- `unproved`: no trustworthy fixture exists.

Do not infer one format from another. Do not add an extension to a public
allowlist from Bitwig documentation alone.

## Product decision gate

If a plug-in preset format passes direct insertion, it can enter a planned
append-only `plugin-preset-file` source through a versioned format registry.
Each registry entry graduates independently. A pass for one extension does not
authorize another extension. Keep `.bwpreset` separate because it can represent
complete multi-device structure. Each entry must record the Bitwig
documentation basis, measured host version, path-index requirement, expected
result shape, and proof status.

Require a successful cold case, three of three warm successes, correct stable
readback, exact no-op detection, and complete cleanup before a direct format can
graduate. An `indexed-direct` result must expose that prerequisite in the
contract. Do not promise arbitrary plug-in preset files.

Use the popup browser only for discovery or browser-only formats. Any later
public browser operation must own a complete start, filter, select,
commit-or-cancel transaction. It must not preserve modal state between public
calls.

Do not parse H2P or add u-he product rules. Do not accept arbitrary proprietary
extensions. Do not replace an existing device until Ghostnote can restore its
opaque prior state.

## Acceptance criteria

- H2P, FXP, and VSTPRESET each receive direct and popup verdicts from real
  installed fixtures.
- The evidence classifies every locally found preset suffix and records whether
  Bitwig exposes a representative case through file loading or discovery.
- FXB receives a measured verdict only with a genuine loadable fixture. If no
  such fixture exists, the result is `unproved`, not unsupported.
- One non-u-he CLAP discovery case receives a popup verdict.
- Every success reports the exact source, host route, device name, preset name
  when observable, parameter fingerprint, complete chain readback, and cold or
  warm elapsed time.
- Every silent no-op, timeout, ambiguity, and interference case reports no
  false success.
- Direct and popup timings for the same source include one cold sample, three
  warm samples, warm median, and warm range. The conclusion does not claim an
  unmeasured advantage.
- Any new internal code has focused tests. `npm run check`, extension tests, and
  the live handshake pass.
- The disposable project returns to its exact entry baseline with no test
  residue.
- Add one evidence record, update the capability record and this plan, then set
  `context/NOW.md` to the selected product follow-up or back to Phase 5
  closeout.

## Out of scope

- A public preset-file or browser tool.
- A library-cataloguing search engine.
- Vendor preset parsing or conversion.
- Existing-device preset replacement.
- Retrying the full orchestration request before the selected product route is
  implemented and exposed in a fresh Codex session.

## Result

[E101](../../evidence/experiments/e101-plugin-preset-files-have-two-direct-routes.md)
records the complete matrix. H2P is `indexed-direct`: its indexed Repro-5 source
loaded after a restart and in all three warm attempts, while an unindexed copy
was an exact no-op. VSTPRESET is `direct`: indexed and unindexed Weiss sources
loaded with stable readback. The tested Filterscape FXP is `unsupported`. FXB
is `unproved` because the only local file is an internal resource bank.

The popup route is unsupported by the safe API 25 transaction on this host.
The API reported `Plug-in Presets`, but it ignored before-open, after-open, and
relative content-index writes. No popup preset was committed. Audition disable,
guard refusal, cancellation, and cleanup passed. The default catalog exposed
non-u-he Quanta 2 and Reflection Step entries, but preset discovery remained
unreachable.

E102 later proved that the indexed H2P route creates CLAP-only Repro-5 and Diva
devices on this machine. The selected follow-up is
[D03b](d03b-clap-discovered-preset-boundary-spike.md). D04 stays blocked until
that spike defines the complete filesystem-backed CLAP boundary.

## Retrospective

Define positive, negative, and indexed-only verdicts before live testing. This
prevents a valid host-normalized result from appearing as a probe failure.
