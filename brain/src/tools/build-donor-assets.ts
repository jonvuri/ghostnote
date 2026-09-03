/** Validate the donor manifest and rebuild its extracted object assets. */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ASSET_DIR, DONOR_MANIFEST_PATH, extractModulator, listModulators,
} from '../bwmod/index.js';
import type { DonorManifest } from '../bwmod/donors.js';

const FIXTURES = join(import.meta.dirname, '..', '..', 'fixtures');
const manifest = JSON.parse(readFileSync(DONOR_MANIFEST_PATH, 'utf8')) as DonorManifest;
const supportedTypeIds = new Set(manifest.host.inventory.flatMap((entry) =>
  entry.supportedType === undefined ? [] : [entry.supportedType]));

if (existsSync(manifest.host.inventorySource)) {
  const installed = readdirSync(manifest.host.inventorySource)
    .filter((name) => name.endsWith('.bwmodulator'))
    .map((name) => name.slice(0, -'.bwmodulator'.length))
    .sort();
  const recorded = manifest.host.inventory.map((entry) => entry.name).sort();
  if (JSON.stringify(installed) !== JSON.stringify(recorded)) {
    throw new Error('the installed host modulator inventory differs from the manifest');
  }
}

mkdirSync(ASSET_DIR, { recursive: true });
for (const asset of manifest.donors) {
  const preset = readFileSync(join(FIXTURES, asset.source.fixture));
  const donor = extractModulator(preset, asset.source.index, asset.footprint);
  const modulator = listModulators(preset)[asset.source.index];
  const route = modulator?.routing?.target ?? null;
  const actual = {
    deviceName: donor.deviceName,
    category: donor.category,
    guid: donor.guid,
    route,
    file: `${asset.id}.bwmodobj`,
  };
  for (const [field, value] of Object.entries(actual)) {
    if (asset[field as keyof typeof actual] !== value) {
      throw new Error(`${asset.id} ${field} is ${JSON.stringify(value)}, not the manifest value`);
    }
  }
  const addType = manifest.types.find((type) =>
    type.donorId === asset.id && type.capabilities.includes('add'));
  if (addType !== undefined && (modulator?.routes.length ?? 0) < 1) {
    throw new Error(`${asset.id} must contain a safely retargetable route`);
  }
  writeFileSync(join(ASSET_DIR, asset.file), donor.bytes);
  console.log(
    `${asset.id.padEnd(18)} ${donor.deviceName.padEnd(14)} ${String(donor.bytes.length).padStart(4)}B `
      + `footprint=${asset.footprint === null ? 'unmeasured' : `0x${asset.footprint.toString(16)}`}`,
  );
}

const readme = `# Curated modulator donors

\`manifest.json\` is the single catalog source. Run \`npm run build:donors\` to
validate it and regenerate each \`.bwmodobj\`. Each object is the exact \`0x06c9\`
bytes lifted from the human-saved fixture named in its source. Bounds snap to
the list sentinel (E11h).

A donor is transplanted. It is never synthesized (BWMOD_DESIGN decision 3).
\`route\` records the donor's internal source route. Public results do not expose
it.

\`footprint\` is the donor subtree object count. A sampled preset needs it to
relocate count-list reference stubs (Tier 2, E12). The value cannot be computed
from the bytes. \`footprintSource\` records its measurement. A null value limits
the donor to Tier 1.

The manifest records the complete ${manifest.host.inventory.length}-type factory
inventory for ${manifest.host.product} ${manifest.host.version}. It maps public
types to owned donors. It records one proved refusal for each excluded host type.
Runtime catalogs and write-tool vocabularies read the same manifest.

| public type | name | operations | sampled preset | witness |
|---|---|---|---|---|
${manifest.types.filter((type) => supportedTypeIds.has(type.id))
  .map((type) => `| \`${type.id}\` | ${type.publicName} | ${type.capabilities.join(', ')} | ${type.sampledPreset} | ${type.witness.mode} |`)
  .join('\n')}

| id | device | footprint | source |
|---|---|---|---|
${manifest.donors
  .map((donor) => `| \`${donor.id}\` | ${donor.deviceName} | ${donor.footprint === null ? '—' : `0x${donor.footprint.toString(16)}`} | \`${donor.source.fixture}#${donor.source.index}\` |`)
  .join('\n')}
`;
writeFileSync(join(ASSET_DIR, 'README.md'), readme);
console.log(`\nwrote ${manifest.donors.length} donors to ${ASSET_DIR}`);
