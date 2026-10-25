/**
 * The three discovery sources (V14): stock devices from the installation, `.bwpreset` files under content roots,
 * and VST3/CLAP entries from Bitwig's plug-in indexes. Every scan reports what it covered and every limit it hit;
 * a scan never guesses past a limit.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync, type Dirent } from 'node:fs';
import { join, relative } from 'node:path';
import { ByteReader } from './binary.js';

import { readMeta } from '../bwmod/index.js';
import { DiscoveryFormatError, readStableFile, signatureKey, type FileSignature } from './binary.js';
import {
  PLUGIN_ARCHITECTURES, decodeIdTable, decodePluginIndex, PLUGIN_ID_TABLES, pluginIndexFileName, pluginIndexStem,
  type IdTables, type PluginArchitecture, type PluginIndexEntry, type PluginKind,
} from './plugin-index.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_PRESET_BYTES = 16 * 1024 * 1024;
export const PRESET_SCAN_LIMITS = { maxEntries: 250_000, maxDepth: 32 } as const;
/** The freshness check looks for bundles at the root and one vendor directory below it; deeper levels are stated, not scanned. */
export const BUNDLE_SCAN_LIMITS = { maxEntries: 50_000, maxDepth: 2 } as const;
/** Directory names that are bundles of another kind; a scan never descends into a bundle. */
const BUNDLE_EXTENSIONS = ['.vst', '.vst3', '.clap', '.component', '.bundle', '.framework', '.app', '.lv2', '.aaxplugin', '.dSYM'];
const isBundleDirectory = (name: string): boolean => BUNDLE_EXTENSIONS.some((extension) => name.endsWith(extension));

/** A value kept until the signature of its source changes. */
export class DiscoveryCache {
  private readonly values = new Map<string, { key: string; value: unknown }>();
  hits = 0;
  misses = 0;

  reuse<T>(name: string, key: string, compute: () => T): T {
    const entry = this.values.get(name);
    if (entry !== undefined && entry.key === key) { this.hits += 1; return entry.value as T; }
    this.misses += 1;
    const value = compute();
    this.values.set(name, { key, value });
    return value;
  }
}

// --- stock devices --------------------------------------------------------------------------------------------

export interface NativeDeviceEntry {
  readonly uuid: string;
  readonly name: string;
  readonly path: string;
}

export interface NativeScan {
  readonly entries: readonly NativeDeviceEntry[];
  readonly directories: number;
  readonly complete: boolean;
  readonly problems: readonly string[];
}

/** Read `device_id` and `device_name` from every `<uuid>/Default.bwpreset` of the installation. */
export function scanNativeDevices(deviceSettingsRoot: string): NativeScan {
  const entries: NativeDeviceEntry[] = [];
  const problems: string[] = [];
  let directories = 0;
  let listing: Dirent[];
  try {
    listing = readdirSync(deviceSettingsRoot, { withFileTypes: true });
  } catch (error) {
    return { entries, directories, complete: false, problems: [`device-settings unreadable: ${String((error as NodeJS.ErrnoException).code ?? error)}`] };
  }
  for (const item of listing) {
    if (!item.isDirectory() || !UUID_RE.test(item.name)) continue;
    directories += 1;
    const path = join(deviceSettingsRoot, item.name, 'Default.bwpreset');
    if (!existsSync(path)) continue;
    try {
      const meta = readMeta(readStableFile(path, MAX_PRESET_BYTES).bytes);
      const id = meta.get('device_id');
      const name = meta.get('device_name');
      const uuid = typeof id === 'string' ? (id.startsWith('$') ? id.slice(1) : id) : '';
      if (!UUID_RE.test(uuid) || uuid !== item.name) throw new DiscoveryFormatError(`META device_id ${JSON.stringify(id)} disagrees with the directory`);
      if (typeof name !== 'string' || name.length === 0) throw new DiscoveryFormatError('META device_name is empty');
      entries.push({ uuid, name, path });
    } catch (error) {
      problems.push(`${item.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { entries, directories, complete: problems.length === 0, problems };
}

// --- Bitwig presets --------------------------------------------------------------------------------------------

export interface PresetFile {
  readonly path: string;
  readonly relativePath: string;
  /** The file name without `.bwpreset`: the name the browser shows. */
  readonly stem: string;
}

export interface PresetScan {
  readonly files: readonly PresetFile[];
  readonly scanned: number;
  readonly complete: boolean;
  readonly problems: readonly string[];
}

/** Enumerate every `.bwpreset` under one root without following symbolic links. */
export function scanPresetFiles(root: string, limits = PRESET_SCAN_LIMITS): PresetScan {
  const files: PresetFile[] = [];
  const problems: string[] = [];
  let scanned = 0;
  let complete = true;
  const pending: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
  while (pending.length > 0) {
    const { dir, depth } = pending.pop()!;
    let listing: Dirent[];
    try {
      listing = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      problems.push(`${relative(root, dir) || '.'}: ${String((error as NodeJS.ErrnoException).code ?? error)}`);
      complete = false;
      continue;
    }
    for (const item of listing) {
      scanned += 1;
      if (scanned > limits.maxEntries) {
        problems.push(`entry limit ${limits.maxEntries} reached`);
        return { files, scanned, complete: false, problems };
      }
      if (item.isSymbolicLink()) continue;
      const path = join(dir, item.name);
      if (item.isDirectory()) {
        if (depth + 1 > limits.maxDepth) { problems.push(`depth limit ${limits.maxDepth} at ${relative(root, path)}`); complete = false; continue; }
        pending.push({ dir: path, depth: depth + 1 });
      } else if (item.isFile() && item.name.endsWith('.bwpreset')) {
        files.push({ path, relativePath: relative(root, path), stem: item.name.slice(0, -'.bwpreset'.length) });
      }
    }
  }
  return { files, scanned, complete, problems };
}

export interface PresetMetadata {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly deviceCreator: string | null;
  readonly deviceCategory: string | null;
  readonly creator: string | null;
  readonly tags: string | null;
  readonly presetCategory: string | null;
  readonly applicationVersion: string | null;
  readonly bytes: number;
  readonly sha256: string;
  readonly signature: FileSignature;
}

const text = (meta: Map<string, unknown>, key: string): string | null => {
  const value = meta.get(key);
  return typeof value === 'string' ? value : null;
};

/** Read the META section of one preset. The contained device id is descriptive; the path is the identity (E348). */
export function readPresetMetadata(path: string): PresetMetadata {
  const { bytes, signature } = readStableFile(path, MAX_PRESET_BYTES);
  const meta = readMeta(bytes);
  const id = text(meta, 'device_id');
  const deviceId = id === null ? '' : id.startsWith('$') ? id.slice(1) : id;
  const deviceName = text(meta, 'device_name');
  if (!UUID_RE.test(deviceId)) throw new DiscoveryFormatError('META device_id is not a UUID');
  if (deviceName === null || deviceName.length === 0) throw new DiscoveryFormatError('META device_name is empty');
  return {
    deviceId, deviceName, deviceCreator: text(meta, 'device_creator'), deviceCategory: text(meta, 'device_category'),
    creator: text(meta, 'creator'), tags: text(meta, 'tags'), presetCategory: text(meta, 'preset_category'),
    applicationVersion: text(meta, 'application_version_name'), bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), signature,
  };
}

// --- plug-in indexes -------------------------------------------------------------------------------------------

export interface IdTableSet {
  readonly tables: IdTables;
  readonly files: readonly { readonly name: string; readonly path: string; readonly signature: FileSignature }[];
  readonly key: string;
}

/** Read the four shared dictionaries. A missing table refuses: every index references them. */
export function readIdTables(indexDirectory: string, cache?: DiscoveryCache): IdTableSet {
  const files = PLUGIN_ID_TABLES.map((name) => {
    const path = join(indexDirectory, `${name}.ids`);
    const { bytes, signature } = readStableFile(path, 64 * 1024 * 1024);
    return { name, path, signature, bytes };
  });
  const key = files.map((file) => `${file.name}=${signatureKey(file.signature)}`).join(';');
  const tables = cache === undefined
    ? decodeTables(files)
    : cache.reuse('id-tables', key, () => decodeTables(files));
  return { tables, files: files.map(({ name, path, signature }) => ({ name, path, signature })), key };
}

const decodeTables = (files: readonly { name: string; bytes: Buffer }[]): IdTables =>
  Object.fromEntries(files.map((file) => [file.name, decodeIdTable(file.bytes)])) as unknown as IdTables;

export interface PluginBundleEntry extends PluginIndexEntry {
  readonly root: string;
  readonly bundlePath: string;
  readonly bundleExists: boolean;
  /** Null when the bundle is missing. */
  readonly bundleMtimeMatchesIndex: boolean | null;
}

export interface PluginIndexScan {
  readonly kind: PluginKind;
  readonly architecture: PluginArchitecture;
  readonly file: string;
  readonly present: boolean;
  readonly signature: FileSignature | null;
  readonly entries: readonly PluginBundleEntry[];
  readonly problem: string | null;
  readonly reused: boolean;
}

export interface BundleScan {
  readonly bundles: readonly string[];
  readonly scanned: number;
  readonly complete: boolean;
  readonly problems: readonly string[];
  readonly depth: number;
  /** Directories below the depth bound that the check did not enter. */
  readonly unscannedDirectories: number;
}

/** Bundles of one kind on disk under a plug-in root. A bundle is a directory entry with the kind's extension. */
export function scanBundles(root: string, kind: PluginKind, limits = BUNDLE_SCAN_LIMITS): BundleScan {
  const bundles: string[] = [];
  const problems: string[] = [];
  let scanned = 0;
  let unscanned = 0;
  let complete = true;
  const extension = `.${kind}`;
  const pending: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
  while (pending.length > 0) {
    const { dir, depth } = pending.pop()!;
    let listing: Dirent[];
    try {
      listing = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      problems.push(`${relative(root, dir) || '.'}: ${String((error as NodeJS.ErrnoException).code ?? error)}`);
      complete = false;
      continue;
    }
    for (const item of listing) {
      scanned += 1;
      if (scanned > limits.maxEntries) {
        return { bundles, scanned, complete: false, problems: [...problems, `entry limit ${limits.maxEntries} reached`], depth: limits.maxDepth, unscannedDirectories: unscanned };
      }
      if (item.isSymbolicLink()) continue;
      const path = join(dir, item.name);
      if (item.name.endsWith(extension)) { bundles.push(relative(root, path)); continue; }
      if (item.isDirectory() && !isBundleDirectory(item.name)) {
        if (depth + 1 > limits.maxDepth) { unscanned += 1; continue; }
        pending.push({ dir: path, depth: depth + 1 });
      }
    }
  }
  return { bundles: bundles.sort(), scanned, complete, problems, depth: limits.maxDepth, unscannedDirectories: unscanned };
}

/** Decode the index of one root, kind, and architecture when Bitwig wrote one. */
export function scanPluginIndex(
  root: string, kind: PluginKind, arch: PluginArchitecture, indexDirectory: string, tables: IdTableSet, cache?: DiscoveryCache,
): PluginIndexScan {
  const file = join(indexDirectory, pluginIndexFileName(root, kind, arch));
  if (!existsSync(file)) return { kind, architecture: arch, file, present: false, signature: null, entries: [], problem: null, reused: false };
  try {
    const { bytes, signature } = readStableFile(file);
    const key = `${signatureKey(signature)}|${tables.key}`;
    let reused = true;
    const decode = (): PluginIndexEntry[] => { reused = false; return decodePluginIndex(bytes, kind, arch, tables.tables); };
    const decoded = cache === undefined ? decode() : cache.reuse(`index:${file}`, key, decode);
    const entries = decoded.map((entry): PluginBundleEntry => {
      const bundlePath = join(root, entry.relativeBundle);
      let bundleExists = false;
      let bundleMtimeMatchesIndex: boolean | null = null;
      try {
        const stat = bundleMtimeMs(bundlePath);
        bundleExists = true;
        bundleMtimeMatchesIndex = stat === entry.indexedMtimeMs;
      } catch { /* missing bundle: a stale entry */ }
      return { ...entry, root, bundlePath, bundleExists, bundleMtimeMatchesIndex };
    });
    return { kind, architecture: arch, file, present: true, signature, entries, problem: null, reused };
  } catch (error) {
    return { kind, architecture: arch, file, present: true, signature: null, entries: [], reused: false,
      problem: error instanceof Error ? error.message : String(error) };
  }
}

/** Whole milliseconds of the bundle modification time, as the indexer records them. */
function bundleMtimeMs(path: string): number {
  const stat = statSync(path, { bigint: true });
  return Number(stat.mtimeNs / 1_000_000n);
}

// --- plug-in metadata caches -----------------------------------------------------------------------------------

export interface CacheRecord {
  readonly path: string;
  readonly failed: boolean;
  readonly error: string | null;
}

/**
 * `OKo`/`vna` cache framing (E349): a version, then appendable records of path, two stamps, and either an error
 * string or an opaque payload. A later record for a path replaces an earlier one. Payloads stay opaque.
 */
export function decodeCacheEnvelopes(data: Buffer, version: number): Map<string, CacheRecord> {
  const r = new ByteReader(data, 256 * 1024 * 1024);
  if (r.u32be() !== version) throw new DiscoveryFormatError('unsupported cache version');
  const latest = new Map<string, CacheRecord>();
  while (r.remaining > 0) {
    const path = r.stringBe();
    if (!path.startsWith('/') || path.includes('\0')) throw new DiscoveryFormatError('invalid cache path');
    r.u64be(); r.u64be();
    const failed = r.boolean();
    let error: string | null = null;
    if (failed) error = r.stringBe();
    else r.take(r.u32be());
    latest.set(path, { path, failed, error });
  }
  return latest;
}

export interface MetadataCache {
  readonly file: string;
  readonly version: number;
  readonly records: ReadonlyMap<string, CacheRecord>;
}

/** The newest metadata cache of one kind under the host's cache directory, or null when there is none. */
export function readMetadataCache(cacheDirectory: string, kind: PluginKind, arch: PluginArchitecture, cache?: DiscoveryCache): MetadataCache | null {
  const prefix = kind === 'vst3' ? `vst3-metadata-${arch}-` : 'clap-metadata-';
  let names: string[];
  try {
    names = readdirSync(cacheDirectory).filter((name) => name.startsWith(prefix) && /^\d+$/.test(name.slice(prefix.length)));
  } catch {
    return null;
  }
  if (names.length === 0) return null;
  const name = names.sort((a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length))).at(-1)!;
  const file = join(cacheDirectory, name);
  const version = Number(name.slice(prefix.length));
  const { bytes, signature } = readStableFile(file, 256 * 1024 * 1024);
  const decode = (): ReadonlyMap<string, CacheRecord> => decodeCacheEnvelopes(bytes, version);
  const records = cache === undefined ? decode() : cache.reuse(`cache:${file}`, signatureKey(signature), decode);
  return { file, version, records };
}

/** The failure Bitwig recorded for a bundle, when its cache names the bundle or a file inside it. */
export function cacheFailureFor(records: ReadonlyMap<string, CacheRecord>, bundlePath: string): CacheRecord | null {
  const direct = records.get(bundlePath);
  if (direct !== undefined) return direct.failed ? direct : null;
  for (const record of records.values()) {
    if (record.failed && record.path.startsWith(`${bundlePath}/`)) return record;
  }
  return null;
}

/** True when Bitwig has a state file for the root: evidence that the root list and the stem hash agree. */
export const hasIndexState = (root: string, indexDirectory: string): boolean =>
  existsSync(join(indexDirectory, `${pluginIndexStem(root)}-state`));

export { PLUGIN_ARCHITECTURES };
