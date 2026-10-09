---
title: Phase 9c — Release and Bitwig upgrade live suite
kind: plan
state: planned
status: Select and document the live checks to run for a release candidate and a Bitwig upgrade. Start after the 8i trial gates close.
updated: 2026-10-09
parent: README.md
evidence: E39, E40, E85, E244, E254; D46
---

# Phase 9c — Release and Bitwig upgrade live suite

## Purpose

Define one occasional live suite. It proves the host assumptions that the
live product path depends on and that offline tests cannot prove. Run it for
a release candidate and after each Bitwig upgrade. Do not run it for each
development session; `npm run check` and the focused drivers of a session
cover that work.

## Why now

- [E40](../../evidence/experiments/e40-remote-ci-passes-and-session-5-has-a-regression-policy.md)
  is the only regression policy. It is a Phase 1 evidence record. It names
  Session 5 probes and has no Bitwig upgrade trigger.
- `brain/src/probes/conformance.live.ts` exists, but `package.json` has no
  `probe:conformance` script. The README still names it. The last full live
  conformance pass is [E39](../../evidence/experiments/e39-full-live-conformance-passes-after-pin-settlement-repair.md)
  (2026-08-16). The offline fake suite (`contract/conformance/suite.ts`) is
  maintained.
- [D46](../../decisions/d46-modulation-writers-claim-the-route-not-the-sound.md)
  removed the behavior witness from the live product. The route suite
  (`npm run probe:modulation-routes`) is now the only live proof that each
  admitted route form loads as an active route. Only D46, E254, and NOW
  record when to run it.
- `brain/` has 185 probe scripts and about 440 probe files. Most are one-shot
  experiment records.

## Fixed member

The modulation route suite stays in the suite. The live path writes routes
without observing them (D46), so this behavior witness is the proof of that
assumption. Keep it on `stable-v1` witnesses, or an equal ID-bound witness.
The session can change its form, but not remove it. Close the known gap if
possible: the suite has no ID-bound CLAP witness (E254).

## Rule for every other candidate

Do not include a probe because it exists, or because an old record names
it. Evaluate each candidate fresh:

1. State the host assumption that it proves, and the product path that
   depends on that assumption today. A probe for a retired path or a
   `stable-v1`-only path is not a member.
2. Confirm that no offline test proves the same thing.
3. Run it now, on the current extension and a documented fixture. A probe
   that fails, or that needs a repair to run, is a finding. Decide whether
   to repair it or retire it from the suite; do not assume that it is still
   correct.
4. Keep it only if it runs to a clear pass or fail, takes a bounded time,
   and restores its baseline. Record its operator steps (project, audio
   engine, plug-ins).

## Candidates to evaluate

Each candidate has an assumption to check. None is a member until it passes
the rule above.

| Candidate | Assumption to check |
|---|---|
| `probe:hello` | Profile, method hash, fresh controller, host API version |
| `conformance.live.ts` (and `probe:conformance-cleanup`) | The adapter contract against real Bitwig; check which cases still match the current contract and adapter |
| Native catalog regeneration (`npm run catalog:native`) and live resolution | The device UUIDs and DirectParameter IDs of the new Bitwig bundle (`catalog.json` records Bitwig 6.0.6 and a source fingerprint) |
| `phase8h4g-inventory.ts inventory` | The call cost and result of each `agent-native-v1` tool against the ledger |
| `phase8i3-long-writes.ts` modes (`identity`, `controls`, `compose`, `clips`) | D44 limits, sparse remote pages, and long-write costs. The `modulation` mode asks for a shape that D44 refuses |
| Clip reader and writer limits (`phase8h4c-edit.ts`, `phase8h4g-writer-width.ts`) | Reader width, sounding-cell limit, and writer parking (D41) |
| Cursor pin and selection probes (8i1, 8i2 drivers) | Owned cursor pins and collapsed-group reads (D43, E251) |
| Plug-in parameter listing with the audio engine off and on | E244: a CLAP plug-in lists no IDs with the engine off |
| Typed parameter handles (Polysynth, V1 Kick, Delay+, Zebra3 VST3) | The UUIDs and IDs still bind after an upgrade; the route suite depends on them |

Also look for assumptions with no probe. Example: API 25 classes and methods
that the extension uses. A Bitwig upgrade can change the API version.

## Work

1. Run `probe:hello` and the route suite first, to get a known base.
2. Evaluate each candidate with the rule. Record the result, time, operator
   steps, and decision for each.
3. Write `context/contracts/GHOSTNOTE_LIVE_REGRESSION.md`: the members, the
   triggers (release candidate; Bitwig upgrade; a change to the named product
   path), the commands, preconditions, baselines, cleanup, and expected time.
   State what to do when a member fails on an upgrade.
4. Add one entry command if the members can run unattended in sequence.
   Restore or remove `probe:conformance` in `package.json` and the README.
5. Mark the E40 table as superseded. Point D46, NOW, the README, and the
   performance ledger to the new reference.
6. Run the complete suite once. Record the result as a new E record.

## Cost model

The route suite takes 160 s (E254). Target the complete suite at about
15 minutes, unattended after the operator setup. Measure each member. A
member that takes much longer needs a reason in the reference.

## Acceptance

- The reference lists each member with its assumption, command,
  preconditions, time, and cleanup. Every member passed in this session.
- The route suite is a member, and its CLAP gap is closed or stated.
- Each evaluated candidate that is not a member has a recorded reason.
- `probe:conformance` works or is gone from the documentation.
- The suite ran once to completion, and the project is at its baseline.
- `LANG=en_US.UTF-8 ruby context/check.rb` and `git diff --check` pass.
