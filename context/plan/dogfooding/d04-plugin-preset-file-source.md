---
title: D04 — public plug-in preset file source
kind: plan
state: canceled
status: Canceled 2026-09-12 by D22.
updated: 2026-09-12
parent: README.md
prev: d03b-clap-discovered-preset-boundary-spike.md
evidence: E101, E102
---

# D04 — public plug-in preset file source

## Closeout

This implementation will not run. D22 puts vendor plug-in preset formats and
CLAP-discovered preset loading outside the Ghostnote product boundary. The
original plan remains below as a record of the rejected product direction.

## Objective

Add one append-only public `plugin-preset-file` device source. Use a versioned
format registry with independent H2P and VSTPRESET entries. Retry the blocked
Repro-5 and Diva orchestration only after the new surface is available in a
fresh public-tools-only session.

D03b must first decide whether H2P is a narrow u-he source or one entry in a
broader filesystem-backed CLAP discovery registry. Do not implement this plan
until that decision is recorded.

## Contract

1. Require an absolute file path and an explicit registry format.
2. Register `vstpreset` as direct. Register `h2p` as indexed-direct.
3. State the H2P Bitwig-index prerequisite in validation, schema, and tool text.
4. Keep `.bwpreset` on the existing preset source.
5. Reject FXP, FXB, all unknown suffixes, and format-suffix mismatches before a
   Bitwig write.
6. Append only. Do not load into or replace an existing device.

## Receipt and safety

Use the existing complete-chain mutation guard. Verify one appended device by
position, name, enabled state, preset name when available, and a settled
DirectParameter inventory. A silent no-op returns a failed receipt and no minted
device. Reversal deletes only the device minted by the accepted append.

## Verification

- Add contract, encoder, adapter, fake, executor, MCP schema, and tool-text tests.
- Prove missing, wrong-suffix, unsupported-format, stale-chain, and silent-no-op
  refusals.
- Run the full brain and extension checks and the live handshake.
- Run one unindexed VSTPRESET live append and one indexed H2P live append.
- Reverse each result and restore the exact disposable baseline.
- Start a fresh public-tools-only dogfood session and retry the original H2P
  orchestration request.

## Boundaries

Do not expose the popup browser. Do not infer support from documentation alone.
Do not parse vendor files or add vendor-specific rules. Do not promise arbitrary
plug-in preset files.
