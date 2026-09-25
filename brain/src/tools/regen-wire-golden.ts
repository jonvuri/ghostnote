/** Check or write the three active wire goldens from RuntimeProfile.java. */
import { writeFileSync } from 'node:fs';

import {
  CAPTURE_GOLDEN_PATH,
  GOLDEN_PATH,
  PROBE_GOLDEN_PATH,
  classifiedProfileMethods,
  methodsHash,
  readCaptureGolden,
  readGolden,
  readHistoricalGolden,
  readProbeGolden,
  scrapeMethodClassification,
  scrapeRegistrations,
  type ActiveGolden,
} from './wire-golden.js';

const write = process.argv.includes('--write');
const declarations = [...new Set(scrapeRegistrations())].sort();
const historical = readHistoricalGolden();
const missingHistorical = historical.methods.filter((method) => !declarations.includes(method));
const newDeclarations = declarations.filter((method) => !historical.methods.includes(method));

if (missingHistorical.length > 0 || newDeclarations.length > 0) {
  console.log(`historical source inventory drifted (${historical.count} -> ${declarations.length})`);
  if (missingHistorical.length > 0) console.log(`missing   ${missingHistorical.join(', ')}`);
  if (newDeclarations.length > 0) console.log(`new       ${newDeclarations.join(', ')}`);
  console.log('Update methods.historical.json and its owning session bucket explicitly.');
  process.exitCode = 1;
} else {
  console.log(`historical ${historical.count} methods, hash ${historical.methodsHash}`);
}

const classification = scrapeMethodClassification();
const classified = new Set([
  ...classification.product,
  ...classification.activeProbe,
  ...classification.historical,
]);
const unknown = declarations.filter((method) => !classified.has(method));
const stale = [...classified].filter((method) => !declarations.includes(method));
if (unknown.length > 0 || stale.length > 0) {
  if (unknown.length > 0) console.log(`unowned   ${unknown.join(', ')}`);
  if (stale.length > 0) console.log(`stale     ${stale.join(', ')}`);
  process.exitCode = 1;
}

const profiles = classifiedProfileMethods(classification);
const current = {
  normal: readGolden(),
  capture: readCaptureGolden(),
  probe: readProbeGolden(),
} satisfies Record<ActiveGolden['profile'], ActiveGolden>;
const paths = {
  normal: GOLDEN_PATH,
  capture: CAPTURE_GOLDEN_PATH,
  probe: PROBE_GOLDEN_PATH,
} satisfies Record<ActiveGolden['profile'], string>;
const identities = {
  normal: 'normal-v1',
  capture: 'capture-v1',
  probe: 'phase-8-probe-v1',
} satisfies Record<ActiveGolden['profile'], string>;

let changed = false;
for (const profile of ['normal', 'capture', 'probe'] as const) {
  const methods = profiles[profile];
  const next: ActiveGolden = {
    $comment: [
      `Active wire golden for the ${profile} extension build.`,
      'Historical declarations are in methods.historical.json.',
    ],
    profile,
    identity: identities[profile],
    count: methods.length,
    methodsHash: methodsHash(methods),
    methods,
  };
  const same = JSON.stringify(current[profile]) === JSON.stringify(next);
  const suffix = same ? '' : ' (changed)';
  console.log(`${profile.padEnd(7)} ${next.count} methods, hash ${next.methodsHash}${suffix}`);
  if (same) continue;
  changed = true;
  if (write) writeFileSync(paths[profile], `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

if (!changed) {
  console.log('active goldens are current; nothing to do.');
} else if (!write) {
  console.log('dry run — pass --write to update active goldens');
  process.exitCode = 1;
} else {
  console.log('wrote active wire goldens');
}
