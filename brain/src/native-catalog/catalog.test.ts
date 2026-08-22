import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readMeta } from '../bwmod/index.js';
import {
  buildNativeCatalog, catalogJson, javaCatalogSource, parseNativePreset, POLYSYNTH_UUID,
  type NativeResolution,
} from './catalog.js';

const POLYSYNTH = join('fixtures', 'Polysynth', 'mp_bare.bwpreset');

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'ghostnote-native-catalog-'));
  const settings = join(root, 'Contents', 'Resources', 'Library', 'device-settings', POLYSYNTH_UUID);
  mkdirSync(settings, { recursive: true });
  writeFileSync(join(settings, 'Default.bwpreset'), readFileSync(POLYSYNTH));
  return root;
}

test('structured preset fields preserve names and reject object tokens as parameters', () => {
  const parsed = parseNativePreset(readFileSync(POLYSYNTH), POLYSYNTH_UUID);
  assert.equal(parsed.uuid, POLYSYNTH_UUID);
  assert.equal(parsed.name, 'Polysynth');
  assert.ok(parsed.candidateParameterIds.includes('F1FREQ'));
  assert.ok(parsed.objectTokens.includes('CONTENTS'));
  assert.ok(!parsed.candidateParameterIds.includes('CONTENTS'));
  assert.ok(!parsed.candidateParameterIds.includes('MODULATORS'));
});

test('generation is byte-identical and skips plugin or non-preset directories', () => {
  const root = fixtureRoot();
  const settings = join(root, 'Contents', 'Resources', 'Library', 'device-settings');
  mkdirSync(join(settings, 'vst-12345678'));
  mkdirSync(join(settings, 'ad947004-f1d3-40a1-bd15-3ec721ee7c65'));
  const first = catalogJson(buildNativeCatalog(root));
  const second = catalogJson(buildNativeCatalog(root));
  assert.equal(first, second);
  assert.equal(JSON.parse(first).devices.length, 1);
});

test('live resolution stays distinct from candidates and drives typed Java ids', () => {
  const root = fixtureRoot();
  const unresolved = buildNativeCatalog(root);
  const source = unresolved.source.fingerprint;
  const version = String(readMeta(readFileSync(POLYSYNTH)).get('application_version_name'));
  const resolution: NativeResolution = {
    schemaVersion: 1,
    bitwigVersion: version,
    sourceFingerprint: source,
    resolvedAt: '2026-08-22',
    devices: [{
      uuid: POLYSYNTH_UUID,
      name: 'Polysynth',
      directParameterIds: ['CONTENTS/F1FREQ', 'CONTENTS/LIVE_ONLY'],
      typedParameterIds: ['F1FREQ'],
    }],
  };
  const resolved = buildNativeCatalog(root, resolution);
  const device = resolved.devices[0]!;
  assert.equal(device.parameterResolution.status, 'live-resolved');
  if (device.parameterResolution.status !== 'live-resolved') return;
  assert.deepEqual(device.parameterResolution.resolvedIds, ['F1FREQ']);
  assert.ok(!device.parameterResolution.unresolvedCandidateIds.includes('F1FREQ'));
  assert.deepEqual(device.parameterResolution.liveOnlyIds, ['CONTENTS/LIVE_ONLY']);
  assert.match(javaCatalogSource(resolved), /"F1FREQ"/);
  assert.doesNotMatch(javaCatalogSource(resolved), /LIVE_ONLY/);
});

test('the structured name reader keeps the known 12-character name trap', () => {
  const buf = Buffer.from(readFileSync(POLYSYNTH));
  const meta = readMeta(buf);
  const record = Buffer.from('Polysynth');
  const at = buf.indexOf(record, 42);
  assert.notEqual(at, -1);
  const replacement = Buffer.from('Drum Machine');
  const edited = Buffer.concat([
    buf.subarray(0, at - 4),
    Buffer.from([0, 0, 0, replacement.length]),
    replacement,
    buf.subarray(at + record.length),
  ]);
  // The test only exercises META. Shift f4 by the three added bytes.
  const oldF4 = Number.parseInt(edited.toString('latin1', 16, 24), 16);
  edited.write((oldF4 + 3).toString(16).padStart(8, '0'), 16, 8, 'latin1');
  assert.equal(meta.get('device_name'), 'Polysynth');
  assert.equal(readMeta(edited).get('device_name'), 'Drum Machine');
  assert.equal(parseNativePreset(edited).name, 'Drum Machine');
});

test('checked-in catalog and typed Java input agree', () => {
  const catalog = JSON.parse(readFileSync('assets/native-devices/catalog.json', 'utf8'));
  assert.equal(catalog.devices.length, 151);
  for (const name of [
    'Drum Machine', 'Freq Shifter', 'HW Clock Out', 'Note Repeats',
    'Oscilloscope', 'Peak Limiter', 'Stereo Split',
  ]) {
    assert.ok(catalog.devices.some((device: { readonly name: string }) => device.name === name), name);
  }
  assert.equal(
    readFileSync('../extension/src/main/java/com/ghostnote/extension/generated/NativeDeviceCatalog.java', 'utf8'),
    javaCatalogSource(catalog),
  );
});
