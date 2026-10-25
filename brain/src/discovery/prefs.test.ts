/** Synthetic prefs streams in the 6.1.4 object encoding (E350). No installed prefs file is read. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { DiscoveryFormatError } from './binary.js';
import { prefsFixture, prefsObject as object, prefsString } from './fixtures.js';
import { decodePrefsLocations, packageRoot } from './prefs.js';

test('prefs: multiple roots with spaces and Unicode, disabled updates, custom library and packages', () => {
  const decoded = decodePrefsLocations(prefsFixture({
    myLibrary: '/custom/library', packages: '/custom/packs',
    soundContent: [['/Volumes/Sound One', 1], ['/Volumes/音楽/🎹', 0]], music: ['/Users/x/Music'], plugins: ['/Library/Audio/Plug-Ins/VST3'],
  }));
  assert.deepEqual(decoded, {
    myLibrary: '/custom/library', packageInstallationDirectory: '/custom/packs',
    soundContent: [{ path: '/Volumes/Sound One', automaticUpdate: true }, { path: '/Volumes/音楽/🎹', automaticUpdate: false }],
    music: [{ path: '/Users/x/Music', automaticUpdate: true }],
    plugins: [{ path: '/Library/Audio/Plug-Ins/VST3', automaticUpdate: true }],
    removedStandardLocations: [],
  });
});

test('prefs: removed standard locations are kept generically with their strings', () => {
  const decoded = decodePrefsLocations(prefsFixture({ removed: [object(999, [[1, 8, prefsString('/Library/Audio/Plug-Ins/VST')], [2, 5, Buffer.from([1])]])] }));
  assert.deepEqual(decoded.removedStandardLocations, [{ objectClass: 999, strings: ['/Library/Audio/Plug-Ins/VST'] }]);
});

test('prefs: every truncation refuses', () => {
  const data = prefsFixture({ soundContent: [['/new', 1]] });
  for (let end = 0; end < data.length; end += 1) {
    assert.throws(() => decodePrefsLocations(data.subarray(0, end)), DiscoveryFormatError, `truncation at ${end}`);
  }
});

test('prefs: unknown wire types, duplicate fields, trailing bytes, invalid flags, and other classes refuse', () => {
  assert.throws(() => decodePrefsLocations(prefsFixture({ extraRoot: [[9000, 255, Buffer.alloc(0)]] })), /unsupported wire type 255/);
  assert.throws(() => decodePrefsLocations(prefsFixture({ extraRoot: [[4917, 8, prefsString('/other')]] })), /duplicate field/);
  assert.throws(() => decodePrefsLocations(Buffer.concat([prefsFixture(), Buffer.from([0])])), /unconsumed/);
  assert.throws(() => decodePrefsLocations(prefsFixture({ soundContent: [['/new', 2]] })), /automatic-update/);
  const wrongClass = prefsFixture(); wrongClass.writeUInt32BE(721, 41);
  assert.throws(() => decodePrefsLocations(wrongClass), /unexpected root class 721/);
  assert.throws(() => decodePrefsLocations(Buffer.from('BtWg0001000200070000002900000000000000000\x0a')), /unsupported prefs header/);
  const wide = decodePrefsLocations(prefsFixture({ removed: [object(999, [[1, 8, prefsString('Ø')]])] }));
  assert.deepEqual(wide.removedStandardLocations[0]!.strings, ['Ø']);
});

test('prefs: package root defaults and the Installed Bitwig Packs child', () => {
  assert.equal(packageRoot('', '/settings'), '/settings/installed-packages');
  assert.equal(packageRoot('/settings/installed-packages', '/settings'), '/settings/installed-packages');
  assert.equal(packageRoot('/Volumes/Packs', '/settings'), '/Volumes/Packs/Installed Bitwig Packs');
  assert.equal(packageRoot('/Volumes/Packs/Installed Bitwig Packs', '/settings'), '/Volumes/Packs/Installed Bitwig Packs');
});
