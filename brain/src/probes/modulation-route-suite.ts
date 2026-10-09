/**
 * D46 modulation route conformance suite. Run it after a Ghostnote change to the route path and after each
 * Bitwig upgrade. `agent-native-v1` runs no behavior witness, so this suite is the live proof that each admitted
 * route form loads as an active route. Each probe uses `stable-v1`, which keeps the behavior witness, on its own
 * owned track and restores the entry track list in `finally`.
 *
 * Preconditions: an owned scratch project is open, the audio engine is on, and Zebra3 (VST3 and CLAP) is installed.
 * The LFO targets need no notes.
 *
 * | Probe | Route forms |
 * |---|---|
 * | phase5j | native top-level (Polysynth `CONTENTS/F1FREQ`); plug-in top-level (Zebra3 VST3 `CONTENTS/PID411`) |
 * | phase5p | native and plug-in inside one FX Layer entry (Delay+ `CONTENTS/BLUR`; Zebra3 VST3 `CONTENTS/PID411`) |
 * | phase5q | outer container route into a composed layer chain (Zebra3 VST3 `CONTENTS/PID411`); its preset-local Sampler route is page-only |
 *
 * CLAP routes use the plug-in form. Zebra3 and Repro-5 CLAP expose no remote pages and have no typed handle, so the
 * suite has no ID-bound CLAP witness; E97 proved nested ColourCopy routes through equal-name remote controls.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROBES = [
  'phase5j-general-modulation-targets.ts',
  'phase5p-existing-device-wrapper.ts',
  'phase5q-general-device-composition.ts',
] as const;

const results: { probe: string; status: number | null; ms: number }[] = [];
for (const probe of PROBES) {
  const started = performance.now();
  console.log(`\n=== ${probe}`);
  const run = spawnSync('npx', ['tsx', join(HERE, probe)], { stdio: 'inherit' });
  results.push({ probe, status: run.status, ms: Math.round(performance.now() - started) });
  // A failed probe can leave its owned track. Stop so the next probe does not run on unknown state.
  if (run.status !== 0) break;
}

console.log('\n=== modulation route suite');
for (const result of results) {
  console.log(`${result.status === 0 ? 'pass' : 'FAIL'}  ${result.probe}  ${result.ms} ms`);
}
const passed = results.length === PROBES.length && results.every((result) => result.status === 0);
console.log(passed ? 'all route forms proved live' : 'route forms NOT proved: do not ship the route change');
process.exit(passed ? 0 : 1);
