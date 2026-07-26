/**
 * Rewrite `extension/methods.golden.json` from the Java source.
 *
 *   npm run wire:golden          # show the diff, write nothing
 *   npm run wire:golden -- --write
 *
 * Adding a wire method is a two-step act on purpose: the golden is the record of
 * what the extension exposes, and regenerating it silently as a build step would
 * make the drift check self-fulfilling. So this prints what would change and
 * only writes when told to, and `wiremap.test.ts` fails until it has been run.
 *
 * ⚠ It NEVER touches `preSplitMethods`. That list is the frozen pre-split
 * surface — the evidence that the Phase-0 handler split dropped nothing — and
 * regenerating it would erase the very thing it proves.
 *
 * After writing: rebuild and redeploy the extension, then run
 * `npm run probe:hello`. The hash here and the one `contract.hello` returns must
 * agree, or `LiveAdapter.hello()` refuses the session with a `WireDriftError`.
 */
import { writeFileSync } from 'node:fs';

import { GOLDEN_PATH, methodsHash, readGolden, scrapeRegistrations } from './wire-golden.js';

const write = process.argv.includes('--write');

const golden = readGolden();
const methods = [...new Set(scrapeRegistrations())].sort();
const preSplit = new Set(golden.preSplitMethods);

const added = methods.filter((m) => !preSplit.has(m));
const removed = golden.methods.filter((m) => !methods.includes(m));
const brandNew = methods.filter((m) => !golden.methods.includes(m));

// Phase-0 sessions 1 and 2 are frozen history — each is the record of what ONE
// sitting put on the wire, and letting a later sitting's methods fall into an
// earlier bucket would quietly destroy that. So both are read back from the
// golden and only the CURRENT sitting's bucket accumulates.
const addedInSession1 = golden.addedInSession1 ?? ['contract.hello', 'rig.methods'];
const addedInSession2 = golden.addedInSession2 ?? [];
const earlier = new Set([...addedInSession1, ...addedInSession2]);
const addedInE16 = added.filter((m) => !earlier.has(m)).sort();

const next = {
  ...golden,
  extractedAt: new Date().toISOString().slice(0, 10),
  extractedFrom: 'handlers/*Handlers.java register() blocks (post-split)',
  count: methods.length,
  methodsHash: methodsHash(methods),
  addedInPhase0: added,
  addedInSession1,
  addedInSession2,
  addedInE16,
  methods,
};

console.log(`scraped   ${methods.length} methods (golden has ${golden.methods.length})`);
console.log(`hash      ${golden.methodsHash} -> ${next.methodsHash}`);
if (brandNew.length > 0) console.log(`added     ${brandNew.join(', ')}`);
if (removed.length > 0) {
  console.log(`REMOVED   ${removed.join(', ')}`);
  console.log('⚠ removing a wire method breaks the archived probes that established the findings.');
}
if (brandNew.length === 0 && removed.length === 0 && golden.methodsHash === next.methodsHash) {
  console.log('golden is already current; nothing to do.');
  process.exit(0);
}

if (!write) {
  console.log('\ndry run — pass --write to update extension/methods.golden.json');
  process.exit(0);
}

writeFileSync(GOLDEN_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
console.log(`\nwrote ${GOLDEN_PATH}`);
console.log('next: rebuild + redeploy the extension, then `npm run probe:hello`');
