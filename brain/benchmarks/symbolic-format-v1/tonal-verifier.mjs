#!/usr/bin/env node
// Run bounded Tonal controls for the symbolic-format v1 benchmark.

import chordApi from "@tonaljs/chord";
import intervalApi from "@tonaljs/interval";
import noteApi from "@tonaljs/note";
import scaleApi from "@tonaljs/scale";

const midi = (value) => noteApi.fromMidi(value);
const chord = chordApi.get("C7");
const checks = {
  note_name: midi(60) === "C4",
  transposition: noteApi.transpose("C4", intervalApi.fromSemitones(3)) === "Eb4",
  chord_membership_pass: [60, 64, 67, 70].every((value) => chord.notes.includes(noteApi.pitchClass(midi(value)))),
  chord_membership_fail: !chord.notes.includes(noteApi.pitchClass(midi(61))),
  scale_membership: [60, 62, 63, 65, 67, 69, 70].every((value) =>
    scaleApi.get("C dorian").notes.includes(noteApi.pitchClass(midi(value))),
  ),
};

process.stdout.write(`${JSON.stringify({
  package: "Tonal",
  controls: { known_pass: "C7", near_miss: "C7/Bb", known_fail: "C# outside C7" },
  checks,
  pass: Object.values(checks).every(Boolean),
}, null, 2)}\n`);
