/** Synthetic prefs streams, plug-in indexes, and a complete fake host tree in the traced 6.1.4 encodings, for tests only. */
import { copyFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { HostContext } from './host-context.js';
import { pluginIndexFileName, pluginIndexStem, type IdTables, type PluginArchitecture, type PluginKind } from './plugin-index.js';
import { PREFS_HEADER } from './prefs.js';

// --- prefs -----------------------------------------------------------------------------------------------------

const be32 = (n: number): Buffer => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
export function prefsString(value: string): Buffer {
  if (/^[\x00-\x7f]*$/.test(value)) return Buffer.concat([be32(value.length), Buffer.from(value, 'latin1')]);
  const wide = Buffer.from(value, 'utf16le'); wide.swap16();
  return Buffer.concat([be32(0x80000000 | (wide.length / 2)), wide]);
}
export const prefsObject = (kind: number, fields: ReadonlyArray<readonly [id: number, wire: number, value: Buffer]>): Buffer =>
  Buffer.concat([be32(kind), ...fields.map(([id, wire, value]) => Buffer.concat([be32(id), Buffer.from([wire]), value])), be32(0)]);
const list = (items: readonly Buffer[]): Buffer => Buffer.concat([...items, be32(3)]);
const location = (path: string, automatic = 1): Buffer => prefsObject(720, [[3443, 8, prefsString(path)], [3444, 5, Buffer.from([automatic])]]);

export interface PrefsFixture {
  readonly myLibrary?: string;
  readonly packages?: string;
  readonly soundContent?: readonly (readonly [string, number])[];
  readonly music?: readonly string[];
  readonly plugins?: readonly string[];
  readonly removed?: readonly Buffer[];
  readonly extraRoot?: readonly (readonly [number, number, Buffer])[];
  readonly extraLibrary?: readonly (readonly [number, number, Buffer])[];
}

/** A complete prefs stream with the traced location fields. */
export function prefsFixture(spec: PrefsFixture = {}): Buffer {
  const library = prefsObject(718, [
    [5134, 8, prefsString(spec.myLibrary ?? '')],
    [5066, 18, list((spec.soundContent ?? []).map(([path, automatic]) => location(path, automatic)))],
    [5067, 18, list((spec.music ?? []).map((path) => location(path)))],
    [5068, 18, list((spec.plugins ?? []).map((path) => location(path)))],
    ...(spec.removed === undefined ? [] : [[6457, 18, list(spec.removed)] as const]),
    ...(spec.extraLibrary ?? []),
  ]);
  const root = prefsObject(722, [[3457, 9, library], [4917, 8, prefsString(spec.packages ?? '')], ...(spec.extraRoot ?? [])]);
  // Header, an eight-digit hex stream offset (one past the 0x0a byte), padding, then the stream.
  return Buffer.concat([Buffer.from(`${PREFS_HEADER}000000290000000000000000`, 'latin1'), Buffer.from([0x0a]), root]);
}

// --- plug-in indexes -------------------------------------------------------------------------------------------

const le32 = (n: number): Buffer => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const le16 = (n: number): Buffer => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const le64 = (n: bigint): Buffer => { const b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b; };
export const treeName = (s: string): Buffer => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([le32(0), le16(b.length), b]); };
export const block = (tag: number, payload: Buffer = Buffer.alloc(0)): Buffer => Buffer.concat([le32((tag << 24) | payload.length), payload]);
export const TABLES: IdTables = { categories: ['Synth'], 'device-creators': ['Vendor'], 'vst3-device-ids': ['A'.repeat(32)], 'clap-device-ids': ['org.example.synth'] };

export interface IndexRecordSpec {
  readonly name?: string; readonly bundle?: string; readonly identityRef?: number; readonly stamp?: bigint; readonly directory?: string;
}
export interface IndexFixtureSpec extends IndexRecordSpec {
  readonly kind?: PluginKind; readonly arch?: PluginArchitecture; readonly records?: readonly IndexRecordSpec[];
}

function record(kind: PluginKind, arch: PluginArchitecture, spec: IndexRecordSpec): Buffer {
  const bundle = block(5, Buffer.concat([treeName(spec.bundle ?? `Example.${kind}`), le32(0), Buffer.from([0, 0])]));
  let body = Buffer.concat([treeName(spec.name ?? 'Example'), le32(0), Buffer.from([0]), le64(spec.stamp ?? 123n), le32(0), le32(spec.identityRef ?? 0), treeName('1.0')]);
  if (kind === 'vst3') body = Buffer.concat([body, Buffer.from([0])]);
  if (arch !== 'arm64') body = Buffer.concat([body, Buffer.from([1])]);
  body = Buffer.concat([body, Buffer.from([3]), le32(8), le32(0)]);
  const inner = Buffer.concat([bundle, block(2, body), block(6)]);
  return spec.directory === undefined ? inner : Buffer.concat([block(1, Buffer.concat([treeName(spec.directory), le32(0)])), inner, block(4)]);
}

export const indexHeader = (kind: PluginKind = 'vst3'): Buffer =>
  Buffer.concat([Buffer.from(kind === 'vst3' ? '3tsv' : 'palc', 'latin1'), le32(27), Buffer.from([1])]);

/** One or more bundles with one plug-in record each, optionally inside directories. */
export function indexFixture(spec: IndexFixtureSpec = {}): Buffer {
  const kind = spec.kind ?? 'vst3', arch = spec.arch ?? 'arm64';
  const records = spec.records ?? [spec];
  return Buffer.concat([indexHeader(kind), ...records.map((item) => record(kind, arch, item))]);
}

/** The big-endian string of the id tables and metadata caches. */
export const idString = prefsString;

/** One shared dictionary file: each entry becomes one stored ID. */
export const idTable = (values: readonly string[]): Buffer => Buffer.concat(values.map(idString));

/** A metadata cache with the given records; a failed record carries its error text. */
export function cacheFixture(version: number, records: readonly { readonly path: string; readonly error?: string }[]): Buffer {
  const u64 = Buffer.alloc(8);
  return Buffer.concat([be32(version), ...records.map((item) => Buffer.concat([
    idString(item.path), u64, u64,
    ...(item.error === undefined ? [Buffer.from([0]), be32(2), Buffer.from('ok')] : [Buffer.from([1]), idString(item.error)]),
  ]))]);
}

// --- a synthetic host tree ---------------------------------------------------------------------------------------


const FIXTURES = join(import.meta.dirname, '../../fixtures');
export const POLYSYNTH_UUID = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
export const SAMPLER_UUID = '468bc14b-b2e7-45a1-9666-e83117fe404e';
export const EXAMPLE_VST3_ID = 'A'.repeat(32);
export const STALE_VST3_ID = 'B'.repeat(32);
export const FOREIGN_VST3_ID = 'C'.repeat(32);
export const EXAMPLE_CLAP_ID = 'org.example.synth';

export interface SyntheticHost {
  readonly root: string;
  readonly home: string;
  readonly appRoot: string;
  readonly settingsRoot: string;
  readonly indexDirectory: string;
  readonly cacheDirectory: string;
  readonly myLibrary: string;
  readonly packages: string;
  readonly soundContent: string;
  readonly vst3Root: string;
  readonly clapRoot: string;
  readonly context: HostContext;
  /** Rewrite the prefs file with another location configuration. */
  writePrefs(spec: PrefsFixture): void;
}

/**
 * One complete fake host under `root`: an application with two stock devices, a settings directory with prefs,
 * indexes, and dictionaries, a My Library with one preset, a sound-content directory with one preset, and VST3
 * and CLAP roots with an example bundle each. The VST3 index also names a bundle that does not exist (`Stale`)
 * and an x64 entry (`Foreign`); the VST3 root also holds `Failed.vst3`, which the metadata cache records as a
 * load failure.
 */
export function buildSyntheticHost(root: string, prefs: PrefsFixture = {}): SyntheticHost {
  const home = join(root, 'home');
  const appRoot = join(root, 'Bitwig Studio.app');
  const settingsRoot = join(home, 'Library', 'Application Support', 'Bitwig', 'Bitwig Studio');
  const indexDirectory = join(settingsRoot, 'index');
  const cacheDirectory = join(home, 'Library', 'Caches', 'Bitwig');
  const myLibrary = join(home, 'Documents', 'Bitwig Studio', 'Library');
  const packages = join(settingsRoot, 'installed-packages');
  const soundContent = join(root, 'Sound Content ✓');
  const vst3Root = join(root, 'Plug-Ins', 'VST3');
  const clapRoot = join(root, 'Plug-Ins', 'CLAP');
  const deviceSettings = join(appRoot, 'Contents', 'Resources', 'Library', 'device-settings');
  for (const [uuid, fixture] of [[POLYSYNTH_UUID, 'Polysynth/gn-preset-zoo.bwpreset'], [SAMPLER_UUID, 'Sampler/gn_sampler_bare.bwpreset']] as const) {
    mkdirSync(join(deviceSettings, uuid), { recursive: true });
    copyFileSync(join(FIXTURES, fixture), join(deviceSettings, uuid, 'Default.bwpreset'));
  }
  mkdirSync(join(deviceSettings, 'not-a-device'), { recursive: true });
  mkdirSync(join(settingsRoot, 'prefs'), { recursive: true });
  mkdirSync(indexDirectory, { recursive: true });
  mkdirSync(cacheDirectory, { recursive: true });
  mkdirSync(join(myLibrary, 'Presets', 'Polysynth'), { recursive: true });
  mkdirSync(join(packages, 'Pack'), { recursive: true });
  mkdirSync(soundContent, { recursive: true });
  copyFileSync(join(FIXTURES, 'Polysynth/gn-preset-zoo.bwpreset'), join(myLibrary, 'Presets', 'Polysynth', 'gn-preset-zoo.bwpreset'));
  copyFileSync(join(FIXTURES, 'Sampler/gn_sampler_bare.bwpreset'), join(packages, 'Pack', 'Pack Sampler.bwpreset'));
  copyFileSync(join(FIXTURES, 'Polysynth/gn-preset-zoo.bwpreset'), join(soundContent, 'Custom Ünïcode Name.bwpreset'));
  writeFileSync(join(settingsRoot, 'last-run-info.txt'), 'Version name: 6.1.4\n');
  for (const bundle of ['Example.vst3', 'Failed.vst3']) mkdirSync(join(vst3Root, bundle, 'Contents'), { recursive: true });
  mkdirSync(join(clapRoot, 'Vendor', 'Example.clap', 'Contents'), { recursive: true });
  writeFileSync(join(indexDirectory, 'categories.ids'), idTable(['Synth']));
  writeFileSync(join(indexDirectory, 'device-creators.ids'), idTable(['Vendor']));
  writeFileSync(join(indexDirectory, 'vst3-device-ids.ids'), idTable([EXAMPLE_VST3_ID, STALE_VST3_ID, FOREIGN_VST3_ID]));
  writeFileSync(join(indexDirectory, 'clap-device-ids.ids'), idTable([EXAMPLE_CLAP_ID]));
  const stamp = (path: string): bigint => statSync(path, { bigint: true }).mtimeNs / 1_000_000n;
  writeFileSync(join(indexDirectory, pluginIndexFileName(vst3Root, 'vst3', 'arm64')), indexFixture({ kind: 'vst3', arch: 'arm64', records: [
    { name: 'Example', bundle: 'Example.vst3', identityRef: 0, stamp: stamp(join(vst3Root, 'Example.vst3')) },
    { name: 'Stale', bundle: 'Stale.vst3', identityRef: 1 },
  ] }));
  writeFileSync(join(indexDirectory, pluginIndexFileName(vst3Root, 'vst3', 'x64')), indexFixture({ kind: 'vst3', arch: 'x64', records: [
    { name: 'Foreign', bundle: 'Example.vst3', identityRef: 2, stamp: stamp(join(vst3Root, 'Example.vst3')) },
  ] }));
  writeFileSync(join(indexDirectory, pluginIndexFileName(clapRoot, 'clap', 'arm64')), indexFixture({ kind: 'clap', arch: 'arm64', records: [
    { name: 'Example', bundle: 'Example.clap', directory: 'Vendor', identityRef: 0, stamp: stamp(join(clapRoot, 'Vendor', 'Example.clap')) },
  ] }));
  for (const pluginRoot of [vst3Root, clapRoot]) writeFileSync(join(indexDirectory, `${pluginIndexStem(pluginRoot)}-state`), '');
  writeFileSync(join(cacheDirectory, 'vst3-metadata-arm64-11'), cacheFixture(11, [
    { path: join(vst3Root, 'Example.vst3') }, { path: join(vst3Root, 'Failed.vst3'), error: 'could not load' },
  ]));
  const prefsPath = join(settingsRoot, 'prefs', '6.1.4.prefs');
  const base: PrefsFixture = { plugins: [vst3Root, clapRoot] };
  const writePrefs = (spec: PrefsFixture): void => { writeFileSync(prefsPath, prefsFixture({ ...base, ...spec })); };
  writePrefs(prefs);
  const context: HostContext = {
    platform: 'macos', appRoot, pid: 44, version: '6.1.4', liveHostVersion: '6.1.4', settingsRoot, settingsOverride: null, home, prefsPath,
    indexDirectory, cacheDirectory, deviceSettingsRoot: deviceSettings, jar: null, jarProblem: 'no jar in the synthetic host', lastRunVersion: '6.1.4',
  };
  return { root, home, appRoot, settingsRoot, indexDirectory, cacheDirectory, myLibrary, packages, soundContent, vst3Root, clapRoot, context, writePrefs };
}
