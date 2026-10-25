/** Synthetic indexes in the traced 6.1.4 record tree, plus the captured 6.1.4 fixtures (E349). */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DiscoveryFormatError } from './binary.js';
import { TABLES, block, indexFixture, indexHeader, treeName } from './fixtures.js';
import { PLUGIN_ID_TABLES, decodeIdTable, decodePluginIndex, pluginDisplayName, pluginIndexFileName, pluginIndexStem, type IdTables } from './plugin-index.js';

const FIXTURES = join(import.meta.dirname, '../../fixtures/discovery/6.1.4');
const u32 = (n: number): Buffer => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
test('index: VST3 and CLAP records on both architectures decode to their identities and bundle paths', () => {
  for (const [kind, arch] of [['vst3', 'arm64'], ['vst3', 'x64'], ['clap', 'arm64']] as const) {
    const [row] = decodePluginIndex(indexFixture({ kind, arch, directory: 'Vendor Dir' }), kind, arch, TABLES);
    assert.equal(row!.identity, TABLES[kind === 'vst3' ? 'vst3-device-ids' : 'clap-device-ids'][0]);
    assert.equal(row!.relativeBundle, `Vendor Dir/Example.${kind}`);
    assert.equal(row!.deviceTypeCode, 3);
    assert.equal(row!.indexedMtimeMs, 123);
    assert.equal(row!.vendor, 'Vendor');
    assert.equal(pluginDisplayName(row!), arch === 'x64' ? 'Example [X64]' : 'Example');
  }
});

test('index: every interior truncation refuses; an empty nine-byte header is an empty scope', () => {
  const data = indexFixture();
  assert.deepEqual(decodePluginIndex(data.subarray(0, 9), 'vst3', 'arm64', TABLES), []);
  for (let end = 0; end < data.length; end += 1) {
    if (end === 9) continue;
    assert.throws(() => decodePluginIndex(data.subarray(0, end), 'vst3', 'arm64', TABLES), DiscoveryFormatError, `truncation at ${end}`);
  }
});

test('index: other versions, unknown records, bad references, unbalanced trees, unsafe paths, and wrong scopes refuse', () => {
  const other = indexFixture(); other.writeUInt32LE(28, 4);
  assert.throws(() => decodePluginIndex(other, 'vst3', 'arm64', TABLES), /unsupported index header/);
  assert.throws(() => decodePluginIndex(Buffer.concat([indexHeader(), block(7)]), 'vst3', 'arm64', TABLES), /unsupported record type 7/);
  assert.throws(() => decodePluginIndex(indexFixture({ identityRef: 9 }), 'vst3', 'arm64', TABLES), /outside the dictionary/);
  assert.throws(() => decodePluginIndex(Buffer.concat([indexHeader(), block(6)]), 'vst3', 'arm64', TABLES), /unbalanced/);
  assert.throws(() => decodePluginIndex(Buffer.concat([indexHeader(), block(2)]), 'vst3', 'arm64', TABLES), /outside a bundle/);
  assert.throws(() => decodePluginIndex(Buffer.concat([indexHeader(), block(1, Buffer.concat([treeName('..'), u32(0)])), block(4)]), 'vst3', 'arm64', TABLES), /unsafe path/);
  assert.throws(() => decodePluginIndex(indexFixture().subarray(0, indexFixture().length - 4), 'vst3', 'arm64', TABLES), /unclosed|truncated/);
  assert.throws(() => decodePluginIndex(indexFixture({ kind: 'clap' }), 'vst3', 'arm64', TABLES), /unsupported index header/);
  assert.throws(() => decodePluginIndex(indexFixture(), 'vst3', 'arm64', { ...TABLES, 'vst3-device-ids': ['not hex'] }), /invalid VST3 ID/);
});

test('index: deleted records are skipped and duplicate names are kept apart', () => {
  const data = Buffer.concat([indexFixture(), block(3, Buffer.from('not a device')), indexFixture().subarray(9)]);
  const rows = decodePluginIndex(data, 'vst3', 'arm64', TABLES);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0]!.offset, rows[1]!.offset);
});

test('index: dictionaries decode ASCII and UTF-16 entries and refuse truncation, nulls, and oversized counts', () => {
  const wide = Buffer.from('Ø', 'utf16le'); wide.swap16();
  const data = Buffer.concat([Buffer.from([0, 0, 0, 1]), Buffer.from('A'), Buffer.from([0x80, 0, 0, 1]), wide]);
  assert.deepEqual(decodeIdTable(data), ['A', 'Ø']);
  assert.throws(() => decodeIdTable(data.subarray(0, data.length - 1)), DiscoveryFormatError);
  assert.throws(() => decodeIdTable(Buffer.concat([Buffer.from([0, 0, 0, 1]), Buffer.from([0])])), /null/);
  assert.throws(() => decodeIdTable(Buffer.from([0x7f, 0xff, 0xff, 0xff])), /oversized/);
});

test('index: file names follow MD5 of the exact root path plus the kind ordinal 7', () => {
  assert.equal(pluginIndexStem('/Library/Audio/Plug-Ins/VST3'), '208F15EF22A61716E7EE3CCEE6D5BBB5');
  assert.equal(pluginIndexFileName('/Library/Audio/Plug-Ins/CLAP', 'clap', 'arm64'), '42DE5DB82C4D50AEF349BEB61D080255-clap-arm64.index');
  assert.equal(pluginIndexStem('/Users/jonvuri/Library/Audio/Plug-Ins/CLAP'), 'A1AC26D7DCA88D7402793D242388656F');
});

test('index: the captured 6.1.4 fixtures decode to the E349 counts and identities', () => {
  const tables = Object.fromEntries(PLUGIN_ID_TABLES.map((name) => [name, decodeIdTable(readFileSync(join(FIXTURES, `${name}.ids`)))])) as unknown as IdTables;
  const x64 = decodePluginIndex(readFileSync(join(FIXTURES, '208F15EF22A61716E7EE3CCEE6D5BBB5-vst3-x64.index')), 'vst3', 'x64', tables);
  const clap = decodePluginIndex(readFileSync(join(FIXTURES, '42DE5DB82C4D50AEF349BEB61D080255-clap-arm64.index')), 'clap', 'arm64', tables);
  const userClap = decodePluginIndex(readFileSync(join(FIXTURES, 'A1AC26D7DCA88D7402793D242388656F-clap-arm64.index')), 'clap', 'arm64', tables);
  assert.equal(x64.length, 17);
  assert.equal(clap.length, 31);
  assert.equal(userClap.length, 1);
  assert.equal(x64.filter((row) => row.deviceTypeCode === 3).length, 4);
  assert.equal(clap.filter((row) => row.deviceTypeCode === 3).length, 12);
  const diva = clap.find((row) => row.name === 'Diva');
  assert.deepEqual([diva?.identity, diva?.relativeBundle, diva?.vendor], ['com.u-he.Diva', 'u-he/Diva.clap', 'u-he']);
  assert.deepEqual(x64.filter((row) => row.name === 'Analog Lab 4').map(pluginDisplayName), ['Analog Lab 4 [X64]']);
  assert.equal(userClap[0]!.relativeBundle, 'Reflection Step Rs.clap');
});
