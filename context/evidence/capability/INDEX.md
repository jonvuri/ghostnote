---
title: Capability index
kind: index
state: active
updated: 2026-08-22
scope: current Bitwig host-API capability, organized by subject
---

# Capability index

This axis holds **current** capability facts, organized by subject. Read it first
when you must find out what the Bitwig host API can do, and how.

## How this axis differs from the other two evidence axes

| Axis | Organization | Prose |
|---|---|---|
| [`evidence/experiments/`](../INDEX.md) | one file per dated run | **frozen** |
| [`evidence/format/`](../format/BWFORMAT_SPEC.md) | byte-format subject pages | rewritten in place |
| `evidence/capability/` (this axis) | host-API subject pages | rewritten in place |

An experiment file is a record of what one run measured on one day. It stays as
it was written. A capability page is the **current reading** of every run that
touched a subject. When a new measurement supersedes an older reading, you
rewrite the capability page and you leave the experiment file alone.

`evidence/format/` proved this shape for the byte-format domain. This axis is
its host-API sibling and uses the same `[K]`/`[I]`/`[U]` tags.

## The four rules

1. **Every claim cites something.** Each claim carries `[K]` known, `[I]`
   inferred or `[U]` unknown, and gives its E-number, or names its observer and
   the date. A claim that cites nothing is not admissible.
2. **A page is rewritten in place when it is superseded.** The page also records
   what it superseded and why. This axis is the one place in the tree where
   prose is not frozen. That is its purpose.
3. **Experiment files stay frozen.** A capability page never edits an E-file. It
   supersedes the *reading* of that file and links to it.
4. **An observed fact with no probe is admissible at `[I]`.** Attribute it, date
   it, and name the probe that would raise it to `[K]`.

Review enforces these rules. `check.rb` does not: it validates frontmatter and
links only.

⚠ Do not create a page with nothing measured behind it. An empty page is a claim
that the subject is understood.

## Pages

| Subject | Verdict | Current statement | Page |
|---|---|---|---|
| Containers | ⚠ ◐ | Layer chains are the product path. A Layer chain is created and filled autonomously; every typed chain delete refuses. A Selector switches by one integer but fully disables the inactive chain, so it cannot do live A/B. | [containers](containers.md) |
| Identity | ⚠ ◐ | `Channel.channelId()` is the only runtime object identity in the API. It is durable for a track and re-minted at project load for a chain. A device has none at all. | [identity](identity.md) |
| Devices | ● | Devices use explicit native, VST3, CLAP, or preset sources. Arbitrary named parameters, deep routes, remotes, bypass, guarded mixed chains, and exact scalar replay are live. Device instances still have no identity. | [devices](devices.md) |
| Banks | ⚠ ● | A bank window is a hard budget. The Master and the FX returns leave it first, and a create past the ceiling mints a track you can never address. | [banks](banks.md) |
| Named actions | ⚠⚠ ○ | A named action dispatches on primary UI focus, which no observer reports. It is product-banned. Chain create and delete no longer need one. | [actions](actions.md) |
| Launcher clips | ⚠ ● | Notes and measured metadata have typed paths. Long reads and writes page fixed cursor windows. Clip recreation remains lossy for play-stop and automation. | [clips](clips.md) |
| Host API | ◐ | The API 25 source resolves from Maven with one command, so enumeration is a source read. Plus three mechanisms ghostnote does not use: a type-filtered device bank, process spawn, and OSC. | [host-api](host-api.md) |

## Related

- [Decision index](../../decisions/INDEX.md) — settled design. ⚠ If a capability
  page and a D-file disagree, that is a decision review. It is not a page edit.
- [Evidence index](../INDEX.md) — the dated experiment records these pages read.
- [Project context](../../PROJECT.md) — architecture and stable constraints.
