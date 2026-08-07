/**
 * Build the E18 §3.4 MODULATION fixture — a preset whose modulation is loud
 * enough to be an oracle.
 *
 * ⚠ **Why this exists.** §3.1 owes an answer to *"do modulator routings survive a
 * relocation?"*, and the first attempt at it (2026-08-02) was BLOCKED on the
 * instrument rather than the question. An offline read of the fixtures on disk
 * gave the reason, and it is sharper than "low depth":
 *
 *     mp_one_lfo.bwpreset     [0] LFO          routes=0
 *     modzoo.bwpreset         [0] Classic LFO  routes=0   [1] Random  routes=0
 *     mp_one_random.bwpreset  [0] Random       routes=0
 *
 * ⚠ **Every modulator on disk is UNROUTED.** They modulate nothing at all. That is
 * not a defect — those fixtures were built for `bwmod` FORMAT work (E11/E13), where
 * the question was whether a modulator LOADS and appears in the list. But it makes
 * them useless as a modulation oracle: `modulatedValue` sits exactly on `value`, so
 * a relocation probe would compare 0 against 0 before and after and report
 * "modulation survived" — a false ● of the emptiest possible kind.
 *
 * **What this builds.** A bare Polysynth plus a ROUTED donor, aimed at `F1FREQ`
 * with maximum amount:
 *
 *   - `F1FREQ` because it is one of the 16 pre-allocated `polysynthParams0`
 *     handles, so `param.list` reads it directly by name — no guessing which
 *     remote page a parameter lives on. It is also the exact parameter `e18c`
 *     already marks for its state check, and E11e proved `CONTENTS/F1FREQ` is a
 *     live Ramona path on a Polysynth.
 *   - `amount: 1.0` because the oracle is `|modulatedValue − value|` and E11e saw
 *     divergence as small as **0.002** on a live route. The fixture must clear the
 *     noise floor by a wide margin or it cannot distinguish "modulation broke" from
 *     "we read it at a zero crossing".
 *
 * ⚠ **Two donors are built, not one.** `applyRouting` refuses a donor with no
 * `0x0e3d` entry ("a route is a structure inside CONTENTS, not a field we can
 * conjure"), so only the routed donors qualify — and whether a given modulator
 * actually RUNS at rest is not knowable offline. An LFO free-runs; a Vibrato may
 * need voices. Building both lets the live probe pick whichever genuinely diverges
 * and ABORT if neither does, rather than guessing here and discovering it live.
 *
 * ⚠ `validate()` is necessary and NOT sufficient — a wrong Ramona path passes every
 * offline check and silently carries no modulation (E10b). The live probe is the
 * sufficient check, which is exactly why it gates on measured divergence.
 *
 *     npx tsx src/tools/build-e18-modfixture.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { addModulator, listModulators, loadDonor, validate } from '../bwmod/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE = join(ROOT, 'fixtures', 'Polysynth', 'mp_bare.bwpreset');
const TARGET = 'CONTENTS/F1FREQ';
const AMOUNT = 1.0;

/** Only ROUTED donors can carry a route — the rest are refused by `applyRouting`. */
const CANDIDATES = ['lfo-sampler', 'vibrato-poly'] as const;

const template = readFileSync(TEMPLATE);
console.log(`template ${TEMPLATE}`);
console.log(`  modulators already present: ${listModulators(template).length}`);
console.log('');

let built = 0;
for (const id of CANDIDATES) {
  const out = join(ROOT, 'fixtures', 'Polysynth', `gn_mod_${id}.bwpreset`);
  try {
    const donor = loadDonor(id);
    const edited = addModulator(template, donor, { target: TARGET, amount: AMOUNT });
    const { ok, problems, warnings } = validate(edited, {
      reference: template,
      // A Polysynth embeds no sample, so there are no count stubs and the
      // footprint is not consulted — `footprintFor` returns 0 when
      // `hasCountStubs` is false. Passed anyway when known, so the stronger
      // "every stub moved by exactly this" check runs wherever it can.
      stubDelta: donor.footprint ?? undefined,
    });
    const mods = listModulators(edited);
    const added = mods[mods.length - 1]!;
    console.log(`${ok ? '●' : '○'} ${id.padEnd(16)} -> ${out.replace(ROOT + '/', '')}`);
    console.log(`    modulators ${mods.length}, added "${added.deviceName}" id=${added.instanceId}`);
    for (const r of added.routes) {
      console.log(`    route target="${r.target}" amount=${r.amount}`);
    }
    if (warnings.length) console.log(`    ⚠ warnings: ${warnings.join('; ')}`);
    if (!ok) {
      console.log(`    ⚠⚠ REFUSING TO WRITE: ${problems.join('; ')}`);
      continue;
    }
    // ⚠ Read the route back out of the WRITTEN bytes rather than trusting the
    // editor's return — the same discipline the live probes use (rule 1).
    if (added.routes.length !== 1 || added.routes[0]!.target !== TARGET) {
      console.log('    ⚠⚠ REFUSING TO WRITE: the route did not read back as requested.');
      continue;
    }
    if (added.routes[0]!.amount !== AMOUNT) {
      console.log(`    ⚠⚠ REFUSING TO WRITE: amount read back ${added.routes[0]!.amount}, wanted ${AMOUNT}.`);
      continue;
    }
    writeFileSync(out, edited);
    built++;
  } catch (err) {
    console.log(`○ ${id.padEnd(16)} ${(err as Error).message}`);
  }
  console.log('');
}

console.log(`${built} of ${CANDIDATES.length} fixtures written.`);
console.log('⚠ validate() predicts a LOAD, never MODULATION. The live probe (e18e) is the');
console.log('  sufficient check and refuses to score unless it measures real divergence.');
process.exit(built > 0 ? 0 : 1);
