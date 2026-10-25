// Read-only cross-check of frozen browser samples against local independent sources.
// Run from brain/: node --import tsx ../context/evidence/data/r05-browser/identity-audit.mjs
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMeta } from '../../../../brain/src/bwmod/index.ts';
const base = fileURLToPath(new URL('.', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const catalogPath = fileURLToPath(new URL('../../../../brain/assets/native-devices/catalog.json', import.meta.url));
const catalogBytes = readFileSync(catalogPath);
const catalog = JSON.parse(catalogBytes).devices;
const cacheRoot = '/Users/jonvuri/Library/Caches/Bitwig';
const cacheFiles = { vst3: 'vst3-metadata-arm64-11', clap: 'clap-metadata-13' };
const caches = Object.fromEntries(Object.entries(cacheFiles).map(([kind, name]) => [kind, readFileSync(join(cacheRoot, name))]));
const rows = [];
for (const attempt of ['attempt-5', 'attempt-6']) {
  for (const event of readFileSync(join(base, attempt, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)) {
    if (event.label !== 'native-metadata') continue;
    for (const row of event.value.metadata.rows) {
      const field = (owner, name) => {
        const hits = row.fields.filter(item => item.owner === owner && item.field === name);
        assert.equal(hits.length, 1, `${owner}.${name} is not unique`);
        return hits[0].value;
      };
      const common = { attempt, location: event.value.location, name: row.observedName, nativeClass: row.nativeClass };
      if (row.nativeClass === 'zi') {
        const uuid = field('zj', 'MRY');
        const matches = catalog.filter(item => item.name === row.observedName);
        assert.equal(matches.length, 1); assert.equal(matches[0].uuid, uuid);
        rows.push({ ...common, kind: 'native', uuid, catalogMatch: true });
      } else if (row.nativeClass === 'zz') {
        const path = join(row.rootFile, field('CN', 'fJR'), field('CN', 'iHb'));
        assert.ok(path.endsWith('.bwpreset') && statSync(path).isFile());
        const bytes = readFileSync(path), meta = readMeta(bytes);
        assert.equal(meta.get('device_id'), field('zA', 'MRY'));
        rows.push({ ...common, kind: 'bitwig-preset', path, size: bytes.length, sha256: hash(bytes),
          metaDeviceId: meta.get('device_id'), metaDeviceName: meta.get('device_name'), metaMatches: true });
      } else if (row.nativeClass === 'LT' || row.nativeClass === 'Am') {
        const kind = row.nativeClass === 'LT' ? 'vst3' : 'clap';
        const id = field(kind === 'vst3' ? 'LU' : 'Ao', 'MRY');
        if (kind === 'vst3') assert.match(id, /^[0-9A-F]{32}$/);
        const pluginPath = join(row.rootFile, field('CN', 'fJR'));
        const cacheOffset = caches[kind].indexOf(Buffer.from(id));
        assert.ok(cacheOffset >= 0, `ID absent from independent ${kind} cache: ${id}`);
        const installed = statSync(pluginPath);
        rows.push({ ...common, kind, id, pluginPath, architecture: field('HC', 'ucQ'),
          vendor: field('HC', 'qoU'), installedBundle: installed.isDirectory() || installed.isFile(), cacheOffset });
      } else rows.push({ ...common, kind: 'unclassified-for-product', claim: 'no supported identity inferred' });
    }
  }
}
const result = { catalog: { path: catalogPath, sha256: hash(catalogBytes) },
  caches: Object.fromEntries(Object.entries(caches).map(([kind, bytes]) => [kind, { path: join(cacheRoot, cacheFiles[kind]), sha256: hash(bytes) }])), rows };
writeFileSync(join(base, 'identity-checks.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries([...new Set(rows.map(row => row.kind))].map(kind => [kind, rows.filter(row => row.kind === kind).length]))));
