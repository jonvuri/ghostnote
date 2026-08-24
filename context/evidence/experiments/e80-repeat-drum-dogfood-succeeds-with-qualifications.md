---
id: E80
kind: evidence
state: active
source: dogfooding-d02-session-5
---

# E80 — Repeat drum dogfood succeeds with qualifications [K] (2026-08-23)

**Verdict: the unchanged prompt produced a verified native Drum Machine with
separate synthesized pad voices. The operator accepted it. The continued run
also exposed a one-device Instrument Layer, missing named native-effect
insertion, avoidable catalog retries, and two parameter-handling concerns.**

## Run identity and baseline

- Session: `01a0313d-a405-7063-a184-d7263ac256d6`.
- Transcript:
  `~/.codex/sessions/2026/08/23/rollout-2026-08-23T19-48-38-01a0313d-a405-7063-a184-d7263ac256d6.jsonl`.
- Host: Codex projectless chat, version `0.149.0-alpha.4.1`.
- Model: `gpt-5.6-sol`, high reasoning effort.
- Public surface: `ghostnote-description-v10`, 46 Ghostnote tools.
- Project: `New 3`.

The project had four tracks and eight launcher rows. The first instrument track
was `Inst 1`. Its complete top-level device order was empty. Rows 0 through 7
were empty. The run did not record the entry project revision or content epoch.

## Drum result

The prompt was unchanged from D02. After five safe catalog refusals, one
`compose_drum_machine` call created and verified this mapping:

| MIDI note | pad | native device |
|---:|---:|---|
| 36 | 0 | `v1 Kick` |
| 37 | 1 | `v8 Snare` |
| 38 | 2 | `v1 Snare` |
| 42 | 6 | `v1 Hat` |
| 45 | 9 | `v1 Tom` |
| 46 | 10 | `v8 Hat` |

Each note reached one separate Drum Machine pad. The agent did not substitute
an Instrument Layer or Selector for the requested drum rack.

The agent wrote and read back an eight-beat, 31-note clip named
`Soft Amen Sketch 01`. Every note start and duration fit the 1/64-beat grid on
the first attempt. It launched the clip for audition. The operator accepted the
rack and clip.

The source run needed 21 minutes 9 seconds from the prompt to its audition
request and still produced a parallel Instrument Layer. This run needed 5
minutes 39 seconds and produced the requested routed Drum Machine. This is 73.3
percent less elapsed agent time.

| phase | agent elapsed to audition request | recorded Ghostnote call time | operator wait |
|---|---:|---:|---:|
| Drum pass | 5:39 | 99.5 s | 5:39 |
| Chord pass | 5:12 | 67.7 s | 3:17 |
| Tonal revision | 1:47 | 17.5 s | 1:23:39 |

The complete session lasted 1 hour 45 minutes 21 seconds. Most elapsed time was
the final operator audition wait. The transcript contains 52 Ghostnote calls,
seven local capability-discovery calls, and two web searches. It contains no
shell command, test, probe, or repository access.

## Instrument Layer finding

The later chord request asked for one Polysynth followed by a native delay. The
agent inspected the create, fill, and inspect alternate descriptions, but it did
not call any alternate lifecycle tool. It did not call
`create_device_alternates`, `fill_device_alternate`,
`switch_device_alternate`, `keep_device_alternate`, or
`remove_device_alternate`.

Instead, it called `compose_device_structure` with one `Polysynth` entry. That
tool always creates an Instrument Layer. The agent addressed and edited the
Polysynth through the named layer entry. The last complete top-level read showed
only `Instrument Layer`. No later structural call moved the Polysynth out or
removed the container.

The visible final state is therefore explained by the one-entry composer, not
by alternate use. The run did not test whether `keep_device_alternate` can
collapse a `compose_device_structure` result. A direct top-level native-device
operation would avoid the extra container and a destructive collapse.

## Other findings

### 1. Named native devices are not available at the top level

`compose_device_structure` resolves exact native names but always adds an
Instrument Layer. `add_device` appends at the top level but requires a Bitwig
UUID. The agent supplied `Delay+` as that UUID. The call spent 6.0 seconds,
returned `partialSuccess: true`, added no device, and left only the Instrument
Layer. The agent then used 33 extra MIDI notes as two velocity-decaying echo
taps after the six chord stabs. The operator accepted this musical substitute,
but the final chain has no native delay.

The public UUID field accepts any non-empty string. It should reject a name such
as `Delay+` before a write. A public exact-name top-level insertion would solve
both the Polysynth wrapper and the missing delay.

### 2. Catalog failures caused five blind composition retries

The agent first used retired `E-*` device names. Each refusal said only that an
exact native-device name was absent. It did not identify which request failed.
The agent removed candidates across four more 3.5-to-4.2-second calls before it
proved that `E-Kick` alone was absent. It then used the Bitwig user guide to find
the current `v1` and `v8` names. The five refusals cost 19.9 seconds.

A refusal that names every absent or non-unique caller-supplied name would
remove this search. A small public native-catalog lookup would also keep this
work inside Ghostnote.

### 3. One drum parameter accepted an unrepresentable value

The first 42-setting drum request reached the kick cohort, then stopped. Four
kick values verified. `CONTENTS/ATTACK_CLICK` was requested as `0.28` and read
back as `0`. The result correctly reported partial success and a mismatch. The
agent continued with the five other pad routes but did not correct or reverse
that kick mismatch. Its later statement that all six voices were shaped did not
name this qualification.

The parameter behaved as a binary control, but its public inventory did not
expose a discrete value count or names. The write path accepted an
unrepresentable intermediate normalized value. A follow-up must measure the
domain and expose enough type information to refuse that value before any
scalar in the cohort writes.

### 4. Amp release changed outside the requested revision set

The first chord verification at 01:04 read `CONTENTS/R` as `0.01`. The two tonal
revision cohorts did not include that parameter. Their next complete parameter
read at 01:09 found `0.325`. The agent detected the difference, wrote `0.01`
again, and independently read back `1.00 %`.

The transcript does not show whether an operator edit or one revision write
caused the change. This is an unresolved integrity finding. Reproduce it before
changing the parameter path. The final accepted value is exact.

### 5. Smaller agent inefficiencies

- The first metadata write requested blue `78` and read `77`. A retry requested
  `77` and read `76`. The agent stopped after the second predictable mismatch.
- The agent wrote a complete 51-note chord clip, deleted it, and wrote it again
  only to move one stab from beat `3.5` to `3.25`. No grid refusal required this
  rewrite.
- The first drum acceptance enrichment supplied a second rationale. The
  observation record refused the replacement as designed. The agent retried
  without the duplicate rationale.
- The operator accepted the rhythm but rejected the first chord timbre. The
  agent recorded the whole chord instruction as `vetoed`, then opened a new
  device-only instruction. The three-state observation model cannot record this
  partial verdict without losing the accepted rhythm detail.
- The first chord patch deliberately combined noise, a resonant band-pass,
  wide unison, zero sustain, and 1 percent release. The operator described it as
  noisy, atonal, and hat-like. The focused tonal revision removed noise and
  unison, matched the oscillator octaves, selected a low-pass filter, reduced
  resonance, and passed audition.

## Engineering classification

The Layer and delay result did not come from misleading container wording.
`compose_device_structure` stated that it creates a parallel Instrument Layer.
`add_device` stated that its Bitwig identifier is a UUID. The agent used both
interfaces incorrectly. It did not use the alternate lifecycle.

The run did expose these implementation or interface defects:

- `add_device` accepted a non-UUID Bitwig identifier before the adapter. It then
  returned `partialSuccess: true` although its failed first stage added no
  device. The public schema, result classification, shared `device.insert`,
  live encoder and adapter, and extension `device.insertBitwig` route are in
  scope for D02 Session 6.
- Drum Machine catalog refusal omitted the failed caller input. The public
  composition result, exact-name resolver, and native catalog are also in
  Session 6.
- The parameter path did not preflight a usable domain for Attack Click. Its
  complete-inventory verification also cannot yet exclude collateral parameter
  drift. Public parameter discovery and mutation, cohort execution, live
  inventory comparison, and the extension DirectParameter observers and write
  route are in Session 7.
- Clip color did not preserve requested bytes across public encoding, extension
  float writes, host readback, and live byte conversion. Session 8 isolates
  that boundary.
- The observation store cannot express the operator's partial verdict. Its
  description also omits the write-once rationale rule. Public observation
  schema, capture, stored record, migration, and reporting are in Session 9.

The rationale rule is the only clear tool-description omission that caused a
retry. The catalog issue is a result diagnostic. The parameter-domain issue is
missing observed data and validation. No description led the agent to use the
one-entry Layer or pass `Delay+` as a UUID.

## Final accepted state

`Inst 1` keeps the verified six-pad Drum Machine and the accepted 31-note clip.
`Ice Shells` keeps one top-level Instrument Layer with one nested Polysynth. Its
accepted eight-beat clip has 51 notes: 18 chord notes and 33 velocity-decaying
echo notes. The final Polysynth readback includes zero noise, one unison voice
per oscillator, both oscillators at 8-foot octave, a two-pole low-pass filter,
24 percent resonance, zero sustain, and 1 percent release. No native delay is
present.

## Follow-up order

Complete these focused sessions before the next musical dogfood chat:

1. D02 Session 6: exact-name top-level insertion, UUID validation, truthful
   partial results, and catalog diagnostics.
2. D02 Session 7: Attack Click domain preflight and complete-inventory parameter
   integrity.
3. D02 Session 8: exact clip-color byte round trips.
4. D02 Session 9: write-once observation wording and partial operator verdicts.

The central [run ledger](../../plan/dogfooding/runs.md) records this session's
agent, model, public surface, project, Bitwig baseline, and version provenance.

## Retrospective

Fetch only the tool descriptions needed for the next action. The initial broad
discovery returned a large truncated surface and did not prevent later narrow
lookups.
