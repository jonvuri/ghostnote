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
// earlier bucket would quietly destroy that. So all closed buckets are read back
// from the golden and only the CURRENT sitting's bucket accumulates.
//
// ⚠ E16 joined them when session 3b opened: it is finished, and its list is the
// record of what the branching mini-spike put on the wire. E20, the session-3e
// probe, E22, session 3f, sessions 3g-b through 4b, and Phase 2 session 2e are
// frozen too. Phase 2 session 2i and Phase 4 session 4b are also frozen. New
// methods accumulate in Phase 5 session 5o's bucket.
const addedInSession1 = golden.addedInSession1 ?? ['contract.hello', 'rig.methods'];
const addedInSession2 = golden.addedInSession2 ?? [];
const addedInE16 = golden.addedInE16 ?? [];
const addedInE20 = golden.addedInE20 ?? [];
const addedInSession3eProbe = golden.addedInSession3eProbe ?? [];
const addedInE22Probe = golden.addedInE22Probe ?? [];
const addedInSession3f = golden.addedInSession3f ?? [];
const addedInSession3gB = golden.addedInSession3gB ?? [];
const addedInSession4a = golden.addedInSession4a ?? [];
const addedInSession4b = golden.addedInSession4b ?? [];
const addedInPhase2Session2e = golden.addedInPhase2Session2e ?? [];
const addedInPhase2Session2i = golden.addedInPhase2Session2i ?? [];
const addedInPhase4Session4b = golden.addedInPhase4Session4b ?? [];
const addedInPhase4Session4f = golden.addedInPhase4Session4f ?? [];
const addedInPhase4Session4g = golden.addedInPhase4Session4g ?? [];
const addedInPhase4Session4h1 = golden.addedInPhase4Session4h1 ?? [];
const earlier = new Set([
  ...addedInSession1, ...addedInSession2, ...addedInE16, ...addedInE20,
  ...addedInSession3eProbe, ...addedInE22Probe, ...addedInSession3f, ...addedInSession3gB,
  ...addedInSession4a, ...addedInSession4b, ...addedInPhase2Session2e,
  ...addedInPhase2Session2i, ...addedInPhase4Session4b,
  ...addedInPhase4Session4f, ...addedInPhase4Session4g, ...addedInPhase4Session4h1,
]);
const addedInPhase5Session5o = [...new Set([
  ...(golden.addedInPhase5Session5o ?? []),
  ...added.filter((m) => !earlier.has(m)),
])].sort();

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
  addedInE20,
  addedInSession3eProbe,
  addedInE22Probe,
  addedInSession3f,
  addedInSession3gB,
  addedInSession4a,
  addedInSession4b,
  addedInPhase2Session2e,
  addedInPhase2Session2i,
  addedInPhase4Session4b,
  addedInPhase4Session4f,
  addedInPhase4Session4g,
  addedInPhase4Session4h1,
  addedInPhase5Session5o,
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
