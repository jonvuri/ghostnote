/**
 * Bitwig's on-disk VST3 and CLAP indexes (E349).
 *
 * `<index>/<MD5(root + "7")>-<kind>-<arch>.index` holds a native-endian record tree for one configured plug-in
 * root, and the four shared `.ids` tables map category, vendor, and identity references. The schema was traced
 * on the 6.1.4 jar (`WZM`, `pAe`, `voN`, `NX`, `Ph`, `PF`, `QT`/`NQ`, `MVg`). The decoder consumes every payload
 * exactly and refuses another index version, an unknown record type, a reference outside a table, an unsafe path
 * component, an unbalanced tree, or trailing bytes. VST2 indexes have another schema and are not decoded.
 */
import { createHash } from 'node:crypto';

import { ByteReader, DiscoveryFormatError, utf16be } from './binary.js';

export const PLUGIN_INDEX_VERSION = 27;
export const PLUGIN_ID_TABLES = ['categories', 'device-creators', 'vst3-device-ids', 'clap-device-ids'] as const;
export type PluginIdTable = typeof PLUGIN_ID_TABLES[number];
export type PluginKind = 'vst3' | 'clap';
export type PluginArchitecture = 'arm64' | 'x64';
export const PLUGIN_ARCHITECTURES: readonly PluginArchitecture[] = ['arm64', 'x64'];
export type IdTables = Readonly<Record<PluginIdTable, readonly string[]>>;

export interface PluginIndexEntry {
  readonly kind: PluginKind;
  readonly architecture: PluginArchitecture;
  readonly name: string;
  readonly identity: string;
  readonly relativeBundle: string;
  readonly vendor: string;
  readonly category: string;
  readonly version: string;
  /** The indexed device-type byte; 3 was observed for instruments (E349). */
  readonly deviceTypeCode: number;
  readonly typeMask: number;
  /** The bundle modification time the indexer recorded, in milliseconds. */
  readonly indexedMtimeMs: number;
  readonly offset: number;
}

const VST3_ID = /^[0-9A-Fa-f]{32}$/;
const MAGIC: Readonly<Record<PluginKind, string>> = { vst3: '3tsv', clap: 'palc' };

/** The stem Bitwig gives the index and state files of one plug-in root: MD5 of the exact path plus the kind ordinal 7. */
export function pluginIndexStem(root: string): string {
  return createHash('md5').update(`${root}7`, 'utf8').digest('hex').toUpperCase();
}

export const pluginIndexFileName = (root: string, kind: PluginKind, arch: PluginArchitecture): string =>
  `${pluginIndexStem(root)}-${kind}-${arch}.index`;

/** `MVg.iCS`: a big-endian string stream whose position is the stored ID. */
export function decodeIdTable(data: Buffer): string[] {
  const r = new ByteReader(data);
  const out: string[] = [];
  while (r.remaining > 0) {
    const n = r.u32be();
    const wide = (n & 0x80000000) !== 0;
    const count = n & 0x7fffffff;
    if (count > 1024 * 1024) throw new DiscoveryFormatError('oversized dictionary string');
    const bytes = r.take(count * (wide ? 2 : 1));
    const value = wide ? utf16be(bytes) : bytes.toString('latin1');
    if (value.includes('\0')) throw new DiscoveryFormatError('null in dictionary string');
    if (!wide) for (const byte of bytes) if (byte > 0x7f) throw new DiscoveryFormatError('non-ASCII byte in a narrow dictionary string');
    out.push(value);
  }
  return out;
}

function lookup(tables: IdTables, table: PluginIdTable, index: number): string {
  const values = tables[table];
  if (index >= values.length) throw new DiscoveryFormatError(`${table} reference outside the dictionary: ${index}`);
  return values[index]!;
}

function treeName(r: ByteReader): string {
  r.u32le(); // search hash, not identity
  const n = r.u16le();
  if (n > 1024) throw new DiscoveryFormatError('oversized tree name');
  return r.take(n).toString('utf8');
}

function idArray(r: ByteReader): void {
  const n = r.u32le();
  if (n > 1024) throw new DiscoveryFormatError('oversized ID array');
  for (let i = 0; i < n; i += 1) r.u32le();
}

function component(name: string): string {
  if (name.length === 0 || name === '.' || name === '..' || name.includes('/') || name.includes('\0')) {
    throw new DiscoveryFormatError('unsafe path component');
  }
  return name;
}

/** Decode every plug-in record of one index file for its explicit kind and architecture. */
export function decodePluginIndex(data: Buffer, kind: PluginKind, arch: PluginArchitecture, tables: IdTables): PluginIndexEntry[] {
  if (!(kind in MAGIC) || !PLUGIN_ARCHITECTURES.includes(arch)) throw new DiscoveryFormatError('unsupported scope');
  const r = new ByteReader(data);
  if (r.take(4).toString('latin1') !== MAGIC[kind] || r.u32le() !== PLUGIN_INDEX_VERSION || r.u8() !== 1) {
    throw new DiscoveryFormatError('unsupported index header');
  }
  const stack: Array<{ name: string; tag: number }> = [];
  const out: PluginIndexEntry[] = [];
  while (r.remaining > 0) {
    const offset = r.pos;
    const header = r.u32le();
    const tag = header >>> 24;
    const size = header & 0xffffff;
    const b = new ByteReader(r.take(size));
    if (tag === 1 || tag === 5) {
      const name = component(treeName(b));
      idArray(b);
      if (tag === 5) {
        if (b.u8() !== 0) throw new DiscoveryFormatError('unknown bundle file type');
        b.boolean();
      }
      b.done();
      stack.push({ name, tag });
      if (stack.length > 64) throw new DiscoveryFormatError('tree depth exceeds the bound');
    } else if (tag === 4 || tag === 6) {
      b.done();
      const top = stack[stack.length - 1];
      if (top === undefined || top.tag !== (tag === 4 ? 1 : 5)) throw new DiscoveryFormatError('unbalanced directory or container');
      stack.pop();
    } else if (tag === 3) {
      // Explicitly deleted or padding record (pAe.cfM(long)); its payload is not a device.
    } else if (tag === 2) {
      const top = stack[stack.length - 1];
      if (top === undefined || top.tag !== 5) throw new DiscoveryFormatError('plug-in record outside a bundle');
      const name = treeName(b);
      idArray(b);
      if (b.u8() !== 0) throw new DiscoveryFormatError('unknown plug-in file type');
      const stamp = b.u64le();
      const category = lookup(tables, 'categories', b.u32le());
      const identity = lookup(tables, kind === 'vst3' ? 'vst3-device-ids' : 'clap-device-ids', b.u32le());
      const version = treeName(b);
      if (kind === 'vst3') b.boolean();
      if (arch !== 'arm64') b.boolean();
      const deviceTypeCode = b.u8();
      const typeMask = b.u32le();
      const vendor = lookup(tables, 'device-creators', b.u32le());
      b.done();
      if (kind === 'vst3' && !VST3_ID.test(identity)) throw new DiscoveryFormatError('invalid VST3 ID');
      if (identity.length === 0 || name.length === 0) throw new DiscoveryFormatError('empty identity or name');
      if (stamp > BigInt(Number.MAX_SAFE_INTEGER)) throw new DiscoveryFormatError('timestamp outside the safe range');
      out.push({
        kind, architecture: arch, name, identity, relativeBundle: stack.map((item) => item.name).join('/'),
        vendor, category, version, deviceTypeCode, typeMask, indexedMtimeMs: Number(stamp), offset,
      });
    } else {
      throw new DiscoveryFormatError(`unsupported record type ${tag} at ${offset}`);
    }
  }
  if (stack.length > 0) throw new DiscoveryFormatError('unclosed directory or container');
  return out;
}

/** The browser shows a foreign-architecture entry with a suffix; the index keeps the plain name (E349). */
export const pluginDisplayName = (entry: Pick<PluginIndexEntry, 'name' | 'architecture'>): string =>
  entry.architecture === 'x64' ? `${entry.name} [X64]` : entry.name;
