# Phase 8c4f MusicXML and MIDI-like probe protocol

## Purpose

Check the last two proposed matrix arms before a full provider matrix. This is
a harness-validity probe. It gives directional results. It does not select a
format.

## Scope

Run two fresh fixtures from each of the nine decision families. Run one literal
serialization control. Run all 19 tasks on both arms:

- MusicXML 4.0 composite; and
- Ghostnote MIDI-like profile.

This gives 38 Gemini calls. Use `gemini-3.8-flash` with low thinking. Make no
retry or repair call.

The final matrix template contains these eight arms:

- compact bar `FIELDS`;
- compact bar local labels;
- exact object JSON;
- ABC 2.1 composite;
- Strudel 1.2.0 composite;
- LilyPond 2.24.4 composite;
- MusicXML 4.0 composite; and
- Ghostnote MIDI-like profile.

## Representation contracts

The MusicXML surface uses `score-partwise` version 4.0. It has a required part
list and one part per overlap-safe lane. Its integer durations use declared
divisions per quarter note. Rests preserve gaps.

The MIDI-like surface is a repository profile. It is not a public standard.
Its rows contain track, absolute time, note-on pitch, duration, and velocity.

Each arm has a Ghostnote side ledger for stable note IDs. Parse the public
surface and ledger independently. Use the ledger for musical components. Keep
surface structure, alignment, and canonical form as diagnostics.

## Measurement

Musical component accuracy is primary. Response components, structural parse,
alignment, and canonical form are secondary diagnostics. Report each family
and format separately.

After the run, inspect one complete prompt, raw payload, parse result,
reference, and component score from every family-format cell. Record any
prompt, parser, reference, alignment, provider, schedule, or cost issue before
interpreting the aggregate.

## Freshness

The exact 19 selected tasks have no content-hash overlap with the v3 probe or
the inherited v19 cohort. Their content hashes exclude synthetic IDs. The
offline screen also rejects duplicates within the selected probe.

A later full matrix must use a new cohort, seed, variant offset, musical
parameters, and prompt hashes. Keep the suite, scoring, format contracts, and
run policy fixed unless a measured issue requires a versioned repair.

## Approval and cost

The recent-cost estimate is USD 0.090000. The Gemini and total hard limit is
USD 0.200000. The estimate scales the completed v3 Gemini cost to 38 calls and
allows extra space for verbose MusicXML output. Reserve the full next-call
bound before each request. Retain a failed reservation.

No provider request is approved by this package. Approval must match the frozen
protocol hash, run-plan hash, cohort hash, candidate hashes, schedule, model,
settings, and hard limit.
