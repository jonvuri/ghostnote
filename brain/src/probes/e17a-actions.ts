/**
 * E17 row 1, step 1 — the named-action sweep, done for the CONCEPT.
 *
 * ⚠ Why this row is re-opened at all. E4d route 7 swept 781 named actions and
 * recorded ○ "none create chains". That sweep asked which actions *create
 * chains*; an action called "Group devices" or "Wrap in layer" does not answer
 * that description, and an action list is read by a human scanning names. E16j
 * is the precedent that makes the re-ask worth a sitting: E6 concluded named
 * actions were "unusable AND hazardous", and E16j overturned it by finding
 * `Create Group Track` and `Group` — a UI gesture with a hotkey that turned out
 * to be a named action after all, and the thing that unblocked the whole
 * track-native model. The user reports that grouping devices into a layer has a
 * menu item AND a hotkey in Bitwig's own UI, so the capability exists; the only
 * question is whether `getActions()` exposes it.
 *
 * ⚠ Grep the ID as well as the display name. E16j's working action ids were not
 * what their menu labels suggested, and this probe is the record of what the
 * list actually contains rather than of what one reading of it found.
 *
 * ⚠ `Application.getActions()` is a CURATED subset, not every menu command. A
 * hotkey that is absent from the list is a genuine dead end for us — but that
 * conclusion is only earned by reading the list for the concept, which is what
 * this does. NOTHING IS FIRED HERE: this mode is read-only, and the hazard (an
 * action fires against whatever is selected NOW — E6 blocker 3, seven orphan
 * duplicates in E16j) lives entirely in `e17b`.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { client, check, note, failureCount } from './lib.js';

const OUT = join(tmpdir(), 'gn-e17a-actions.json');

interface ActionRow { id: string; name: string; category: string }

await client.connect();
const r = (await client.request('app.actions', {})) as {
  actions: ActionRow[]; matched: number; total: number;
};
writeFileSync(OUT, JSON.stringify(r.actions, null, 2));

console.log(`\n-- the list: ${r.total} actions (dumped to ${OUT})`);
const byCat = new Map<string, number>();
for (const a of r.actions) byCat.set(a.category, (byCat.get(a.category) ?? 0) + 1);
note([...byCat].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}=${n}`).join('  '));
check('the action list is non-empty, so the sweep can find anything at all',
  r.total > 0, { total: r.total });

// ⚠ E4d route 7 counted 781. A different number is not a discrepancy to smooth
// over — it means the curated subset moved between Bitwig versions, and the
// previous ○ was taken against a different list than this one.
note(`⚠ E4d route 7 swept 781; this list has ${r.total}.`
  + (r.total === 781 ? ' Same size.' : ' ⚠ DIFFERENT SIZE — the ○ was taken against another list.'));

// The concept, not the guess. Every token that could name "put these devices
// inside a container" in someone else's vocabulary.
const TOKENS = [
  'group', 'layer', 'wrap', 'chain', 'nest', 'container',
  'combine', 'merge', 'stack', 'fold', 'collapse', 'bundle',
  'encapsulat', 'pack', 'multi', 'split', 'parallel',
];

console.log('\n-- concept grep, over BOTH the id and the display name');
const seen = new Set<string>();
let conceptHits = 0;
for (const tok of TOKENS) {
  const hits = r.actions.filter((a) =>
    a.id.toLowerCase().includes(tok) || (a.name ?? '').toLowerCase().includes(tok));
  if (hits.length === 0) {
    console.log(`  ${tok.padEnd(12)} —`);
    continue;
  }
  conceptHits += hits.length;
  console.log(`  ${tok.padEnd(12)} ${hits.length}`);
  for (const h of hits) {
    const key = h.id;
    console.log(`      ${seen.has(key) ? '(dup) ' : '      '}id=${h.id}`
      + `  name=${JSON.stringify(h.name)}  cat=${h.category}`);
    seen.add(key);
  }
}
note(`${seen.size} distinct actions matched at least one concept token (${conceptHits} hits)`);

// ⚠ The device-scoped subset is the actual question. An action that groups
// TRACKS is E16j's find and is already known; what row 1 needs is one that acts
// on a DEVICE selection.
console.log('\n-- the device-scoped subset (what row 1 actually needs)');
const deviceish = r.actions.filter((a) => {
  const s = `${a.id} ${a.name ?? ''} ${a.category}`.toLowerCase();
  return s.includes('device') || s.includes('plugin') || s.includes('preset');
});
for (const a of deviceish) {
  console.log(`      id=${a.id}  name=${JSON.stringify(a.name)}  cat=${a.category}`);
}
note(`${deviceish.length} device-scoped actions in the whole list`);

console.log(`\n${failureCount() === 0 ? 'READ-ONLY SWEEP DONE — nothing was fired' : `${failureCount()} FAILURES`}`);
process.exit(failureCount() === 0 ? 0 : 1);
