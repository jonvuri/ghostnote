---
id: E98
kind: evidence
state: active
updated: 2026-09-04
parent: ../../plan/phase-5/5v-semantic-parameter-units-and-fail-closed-guidance.md
---

# E98 — parameter units and semantic writes fail closed [K]

## Verdict

Bitwig Controller API 25 can read normalized values and formatted display text.
It can also report discrete choices on typed parameters and remote controls. It
has no documented text parser or inverse display-to-value conversion. A caller
cannot request an exact semantic write such as `1.5 measures`.

Ghostnote now reports these capabilities separately. A semantic request returns
an unsupported result before project access. It does not substitute a guessed
normalized value.

## API 25 method matrix

The matrix comes from the local API 25 Javadoc and class surface in Bitwig
Studio 6.0.6. `Parameter` and `RemoteControl` inherit `SettableRangedValue`.

| Path | Normalized read | Display read | Discrete domain | Write | Text parse or inverse conversion |
|---|---|---|---|---|---|
| `Parameter` from a typed Bitwig or plug-in view | `get()` | `displayedValue()` | `discreteValueCount()` and `discreteValueNames()` | `setImmediately(double)` | None |
| `RemoteControl` | `get()` | `displayedValue()` | `discreteValueCount()` and `discreteValueNames()` | `setImmediately(double)` | None |
| `Device` DirectParameter | normalized value observer | targeted display observer | None | `setDirectParameterValueNormalized(id, value, resolution)` | None |
| `SpecificBitwigDevice` | Creates a typed `Parameter` by known string id | Same typed path | Same typed path | Same typed path | None |
| `SpecificPluginDevice` | Creates a typed `Parameter` by known numeric id | Same typed path | Same typed path | Same typed path | None |

`getRaw()` and `setRaw(double)` do not add a semantic contract. The Javadoc
calls the value internal and states that its range is undefined. It supplies no
unit identity, parser, or inverse conversion. The DirectParameter display
observer requires an explicit parameter-id list and warns against observing all
parameters at once.

CLAP has no typed factory. It remains available through DirectParameter, which
has normalized read and write plus targeted display observation. VST2, VST3,
and native Bitwig views can use typed parameters when their ids are known.

## Live Classic LFO observations

The live probe wrapped the accepted top-level ColourCopy in one reversible FX
Layer. The Classic LFO page belonged to the container that owned the modulator.
The target ColourCopy remained nested in `Layer 1`.

Remote-control display and discrete metadata were stable and target-bound:

| Control | Normalized value or domain | Host display |
|---|---|---|
| Timebase, entry state | `7/11` | `1/4` |
| Timebase domain | `0/11` through `11/11` | `32/1`, `16/1`, `8/1`, `4/1`, `2/1`, `1/1`, `1/2`, `1/4`, `1/8`, `1/16`, `1/32`, `1/64` |
| Rate | `0.25` | `0.08 Hz` |
| Rate | `0.5` | `0.71 Hz` |
| Rate | `0.75` | `5.96 Hz` |

The Rate values and displays repeated under Timebase `32/1` and `16/1`.
Therefore Rate is a continuous free-running frequency. Timebase is a separate
12-step tempo division. Display text is useful readback, but it is not an
inverse conversion API.

## Public contract

`inspect_device_parameters` now returns `valueCapabilities` with separate
normalized, displayed, discrete, and semantic fields. Remote controls return
formatted display text, normalized origin, discrete count, exact normalized
choices, and available host names.

`set_parameter` keeps its normalized input compatible. It also accepts an
explicit semantic request so it can return a structured boundary. The live
`1.5 measures` request returned `refused: true`, `nothingWasWritten: true`, an
empty change list, and the API reason in 0 ms. It did not read or write the
workspace.

The shared parameter-domain guard also covers remote controls. One invalid
remote discrete value refuses its complete scalar cohort before any adapter
write and returns the exact allowed domain.

The public description tells an agent to stop at this boundary. It forbids a
guessed scalar and web, repository, or computer-input conversion fallbacks. An
offline agent-facing test proves the refusal runs before workspace access.

## Cleanup and verification

Every normalized Rate and Timebase write reversed in last-write-first order.
The wrapper reversal restored `Serato Sample | PITCHMAP | ColourCopy` with the
original enabled states. The exact seven-track entry list also passed.

- `npm run probe:phase5v-units`: all live cases and exact cleanup pass.
- `npm run check`: tests and type checking pass.
- `./gradlew test`: extension compilation passes.
- `npm run probe:hello`: the running extension is newer than the deployed JAR.

## Retrospective

State explicitly whether a modulator page belongs to its owning container or
its nested target. The missing distinction caused one clean probe retry. Apply
shared scalar guards to both direct and remote parameter routes.
