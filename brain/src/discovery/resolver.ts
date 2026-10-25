/**
 * Exact device and preset name resolution (V14; the R05 contract).
 *
 * A resolution reads the running host's configuration and local indexes, never the project and never a browser
 * popup. It returns every exact candidate with a format-specific insertion identity, every exclusion it can name,
 * and the coverage of the requested scope. `resolved` needs one supported candidate and complete coverage;
 * two or more candidates are `ambiguous` even when coverage is incomplete; zero candidates with complete coverage
 * is `not-found`; any other case is `incomplete`, or `unsupported` when the build or its files cannot be read.
 */
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';

import { DiscoveryFormatError, readStableFile, signatureKey, type FileSignature } from './binary.js';
import type { HostContext } from './host-context.js';
import { pluginDisplayName, type PluginArchitecture, type PluginKind } from './plugin-index.js';
import { decodePrefsLocations, type PrefsLocations } from './prefs.js';
import { PRESET_ROOT_KINDS, discoverRoots, type DiscoveredRoot, type RootKind } from './roots.js';
import {
  DiscoveryCache, PLUGIN_ARCHITECTURES, cacheFailureFor, hasIndexState, readIdTables, readMetadataCache, readPresetMetadata, scanBundles,
  scanNativeDevices, scanPluginIndex, scanPresetFiles, type IdTableSet, type NativeScan, type PluginBundleEntry, type PluginIndexScan,
} from './sources.js';

export const DEVICE_NAME_RESOLUTION_VERSION = 'device-name-resolution-v1';
export const SOURCE_KINDS = ['native', 'vst3', 'clap', 'bitwig-preset'] as const;
export type SourceKind = typeof SOURCE_KINDS[number];
export type ResolutionStatus = 'resolved' | 'ambiguous' | 'not-found' | 'incomplete' | 'unsupported';

/** Builds whose prefs and index schemas were traced on the exact jar. Another jar is validated at run time. */
export const KNOWN_BUILDS: Readonly<Record<string, { readonly version: string; readonly evidence: string }>> = {
  '5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f': { version: '6.1.4', evidence: 'E349, E350' },
};

export interface ResolutionQuery {
  readonly name: string;
  readonly sourceKind?: SourceKind;
  readonly root?: string;
}

export type InsertionSource =
  | { readonly kind: 'bitwig'; readonly id: string }
  | { readonly kind: 'vst3'; readonly id: string }
  | { readonly kind: 'clap'; readonly id: string }
  | { readonly kind: 'preset'; readonly path: string };

export interface Candidate {
  readonly sourceKind: SourceKind;
  readonly name: string;
  readonly identity: { readonly uuid: string } | { readonly vst3Id: string } | { readonly clapId: string } | { readonly path: string };
  /** The `add_devices` source for this candidate. */
  readonly insertion: InsertionSource;
  readonly location: {
    readonly rootKind: RootKind; readonly root: string; readonly path: string; readonly relativePath?: string;
    /** Other discovered roots that contain the same file, when content locations overlap. */
    readonly alsoUnder?: readonly { readonly rootKind: RootKind; readonly root: string }[];
  };
  readonly vendor?: string;
  readonly architecture?: PluginArchitecture;
  readonly version?: string;
  readonly category?: string;
  readonly deviceTypeCode?: number;
  readonly freshness?: { readonly bundleExists: boolean; readonly bundleMtimeMatchesIndex: boolean | null };
  readonly preset?: {
    readonly deviceId: string; readonly deviceName: string; readonly deviceCreator: string | null; readonly creator: string | null;
    readonly tags: string | null; readonly applicationVersion: string | null; readonly bytes: number; readonly sha256: string;
  };
}

export interface Exclusion {
  readonly sourceKind: SourceKind;
  readonly name: string;
  readonly reason: 'bundle-missing' | 'architecture-suffix' | 'unreadable-preset' | 'plug-in-failed-to-load';
  readonly path: string;
  readonly detail: string;
}

export type ScopeStatus = 'complete' | 'incomplete' | 'unavailable' | 'unsupported';

export interface ScopeCoverage {
  readonly sourceKind: SourceKind;
  readonly rootKind: RootKind;
  readonly root: string;
  readonly status: ScopeStatus;
  readonly scanned: number;
  readonly entries: number;
  readonly limits: readonly string[];
  /** The index files Bitwig wrote for this root and kind; an absent file is an empty scope, not a limit. */
  readonly indexes?: readonly { readonly file: string; readonly architecture: PluginArchitecture; readonly entries: number; readonly reused: boolean }[];
  /** The on-disk freshness check of a plug-in scope: bundles at the root and one directory below it. */
  readonly bundleCheck?: { readonly depth: number; readonly bundles: number; readonly unscannedDirectories: number; readonly unindexed: readonly string[]; readonly failedToLoad: readonly string[] };
}

export interface BuildAdmission {
  readonly verdict: 'pinned' | 'validated' | 'partial' | 'unsupported';
  readonly jar: { readonly path: string; readonly sha256: string; readonly bytes: number; readonly mtimeNs: string } | null;
  readonly knownBuild: string | null;
  readonly checks: {
    readonly prefsDecoded: boolean;
    readonly pluginRootsWithIndexState: number;
    readonly pluginRootsAvailable: number;
    readonly indexesPresent: number;
    readonly indexesDecoded: number;
    readonly nativeDecoded: boolean;
  };
  readonly detail: string;
}

export interface DeviceNameResolution {
  readonly version: typeof DEVICE_NAME_RESOLUTION_VERSION;
  readonly status: ResolutionStatus;
  readonly query: ResolutionQuery;
  readonly candidates: readonly Candidate[];
  readonly exclusions: readonly Exclusion[];
  readonly coverage: {
    readonly complete: boolean;
    readonly requestedSourceKinds: readonly SourceKind[];
    readonly roots: readonly DiscoveredRoot[];
    readonly scopes: readonly ScopeCoverage[];
    readonly unsupportedScopes: readonly string[];
    readonly limits: readonly string[];
  };
  readonly admission: BuildAdmission;
  readonly prefs: { readonly path: string; readonly sha256: string | null; readonly signature: FileSignature | null; readonly reused: boolean; readonly problem: string | null };
  readonly timing: Readonly<Record<string, number>>;
  readonly cache: { readonly hits: number; readonly misses: number };
}

export class RootNotDiscoveredError extends Error {
  constructor(readonly root: string, readonly discovered: readonly string[]) {
    super(`${root} is not a discovered location`);
    this.name = 'RootNotDiscoveredError';
  }
}

export interface ResolverOptions {
  readonly cache?: DiscoveryCache;
  readonly now?: () => number;
}

const sha256Hex = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

interface PrefsRead {
  readonly prefs: PrefsLocations | null;
  readonly sha256: string | null;
  readonly signature: FileSignature | null;
  readonly reused: boolean;
  readonly problem: string | null;
}

function readPrefs(path: string, cache: DiscoveryCache): PrefsRead {
  if (!existsSync(path)) return { prefs: null, sha256: null, signature: null, reused: false, problem: `the prefs file does not exist: ${path}` };
  try {
    const { bytes, signature } = readStableFile(path);
    let reused = true;
    const decoded = cache.reuse(`prefs:${path}`, signatureKey(signature), () => {
      reused = false;
      return { prefs: decodePrefsLocations(bytes), sha256: sha256Hex(bytes) };
    });
    return { prefs: decoded.prefs, sha256: decoded.sha256, signature, reused, problem: null };
  } catch (error) {
    return { prefs: null, sha256: null, signature: null, reused: false,
      problem: `the prefs file could not be decoded: ${error instanceof Error ? error.message : String(error)}` };
  }
}

const requested = (query: ResolutionQuery, kind: SourceKind): boolean => query.sourceKind === undefined || query.sourceKind === kind;
const inRoot = (query: ResolutionQuery, root: DiscoveredRoot): boolean => query.root === undefined || query.root === root.path;

/** Resolve one exact name against the running host's configuration. */
export function resolveDeviceName(query: ResolutionQuery, context: HostContext, options: ResolverOptions = {}): DeviceNameResolution {
  const now = options.now ?? (() => performance.now());
  const cache = options.cache ?? new DiscoveryCache();
  const hitsBefore = cache.hits, missesBefore = cache.misses;
  const started = now();
  const timing: Record<string, number> = {};
  const limits: string[] = [];
  const unsupportedScopes: string[] = [];

  // --- configuration ---------------------------------------------------------------------------------------
  let t = now();
  const prefs = readPrefs(context.prefsPath, cache);
  const roots = discoverRoots(context, prefs.prefs);
  timing['configurationMs'] = now() - t;
  if (query.root !== undefined && !roots.some((root) => root.path === query.root)) {
    throw new RootNotDiscoveredError(query.root, roots.map((root) => root.path));
  }

  const candidates: Candidate[] = [];
  const exclusions: Exclusion[] = [];
  const scopes: ScopeCoverage[] = [];

  // --- stock devices ---------------------------------------------------------------------------------------
  let nativeScan: NativeScan | null = null;
  const nativeRoot = roots.find((root) => root.kind === 'native')!;
  if (requested(query, 'native') && inRoot(query, nativeRoot)) {
    t = now();
    if (!nativeRoot.available) {
      scopes.push({ sourceKind: 'native', rootKind: 'native', root: nativeRoot.path, status: 'unavailable', scanned: 0, entries: 0,
        limits: [`device-settings ${nativeRoot.problem ?? 'unavailable'}`] });
    } else {
      nativeScan = cache.reuse(`native:${nativeRoot.path}`, nativeKey(nativeRoot.path), () => scanNativeDevices(nativeRoot.path));
      for (const entry of nativeScan.entries) {
        if (entry.name !== query.name) continue;
        candidates.push({ sourceKind: 'native', name: entry.name, identity: { uuid: entry.uuid }, insertion: { kind: 'bitwig', id: entry.uuid },
          location: { rootKind: 'native', root: nativeRoot.path, path: entry.path } });
      }
      scopes.push({ sourceKind: 'native', rootKind: 'native', root: nativeRoot.path, status: nativeScan.complete ? 'complete' : 'incomplete',
        scanned: nativeScan.directories, entries: nativeScan.entries.length, limits: nativeScan.problems });
    }
    timing['nativeMs'] = now() - t;
  }

  // --- plug-ins ----------------------------------------------------------------------------------------------
  const pluginRoots = roots.filter((root) => root.kind === 'plug-ins');
  let tables: IdTableSet | null = null;
  let tablesProblem: string | null = null;
  let indexesPresent = 0, indexesDecoded = 0, rootsWithState = 0;
  const pluginKinds = (['vst3', 'clap'] as const).filter((kind) => requested(query, kind));
  for (const root of pluginRoots) if (root.available && hasIndexState(root.path, context.indexDirectory)) rootsWithState += 1;
  if (pluginKinds.length > 0) {
    t = now();
    if (prefs.prefs === null) {
      for (const kind of pluginKinds) unsupportedScopes.push(`${kind}: the configured plug-in locations are unknown (${prefs.problem})`);
    } else {
      try {
        tables = readIdTables(context.indexDirectory, cache);
      } catch (error) {
        tablesProblem = error instanceof Error ? error.message : String(error);
        for (const kind of pluginKinds) unsupportedScopes.push(`${kind}: the shared index dictionaries could not be read (${tablesProblem})`);
      }
      // Every configured plug-in root normally has an index state file. None at all means the location list or
      // the index naming scheme is not the traced one, so no plug-in scope can claim uniqueness or absence.
      const stateProblem = pluginRoots.some((root) => root.available) && rootsWithState === 0
        ? 'no configured plug-in location has an index state file: the location list or the index naming scheme is unverified'
        : null;
      for (const root of pluginRoots) {
        if (!inRoot(query, root)) continue;
        for (const kind of pluginKinds) {
          scopes.push(pluginScope(query, root, kind, context, tables, tablesProblem, stateProblem, cache, candidates, exclusions, (present, decoded) => {
            indexesPresent += present; indexesDecoded += decoded;
          }));
        }
      }
    }
    timing['pluginIndexMs'] = now() - t;
  }

  // --- Bitwig presets --------------------------------------------------------------------------------------
  if (requested(query, 'bitwig-preset')) {
    t = now();
    if (prefs.prefs === null) {
      unsupportedScopes.push(`bitwig-preset: the configured content locations are unknown (${prefs.problem})`);
    } else {
      for (const root of roots.filter((item) => PRESET_ROOT_KINDS.includes(item.kind))) {
        if (!inRoot(query, root)) continue;
        scopes.push(presetScope(query, root, candidates, exclusions));
      }
    }
    timing['presetScanMs'] = now() - t;
  }

  // One file under two overlapping roots is one candidate; its other roots stay visible as provenance.
  const merged = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = `${candidate.sourceKind}|${JSON.stringify(candidate.identity)}|${candidate.location.path}|${candidate.architecture ?? ''}`;
    const kept = merged.get(key);
    if (kept === undefined) { merged.set(key, candidate); continue; }
    merged.set(key, { ...kept, location: { ...kept.location,
      alsoUnder: [...(kept.location.alsoUnder ?? []), { rootKind: candidate.location.rootKind, root: candidate.location.root }] } });
  }
  candidates.splice(0, candidates.length, ...merged.values());

  // --- admission and status ----------------------------------------------------------------------------------
  const knownBuild = context.jar === null ? null : KNOWN_BUILDS[context.jar.sha256]?.version ?? null;
  const pluginRootsAvailable = pluginRoots.filter((root) => root.available).length;
  const checks: BuildAdmission['checks'] = {
    prefsDecoded: prefs.prefs !== null, pluginRootsWithIndexState: rootsWithState, pluginRootsAvailable,
    indexesPresent, indexesDecoded, nativeDecoded: nativeScan === null ? nativeRoot.available : nativeScan.complete,
  };
  const admission = admissionOf(context, knownBuild, checks, prefs, tablesProblem, pluginKinds.length > 0);
  if (admission.verdict === 'unsupported' || admission.verdict === 'partial') limits.push(admission.detail);
  for (const scope of scopes) for (const limit of scope.limits) limits.push(`${scope.sourceKind} ${scope.root}: ${limit}`);
  const complete = unsupportedScopes.length === 0 && scopes.every((scope) => scope.status === 'complete');
  const status: ResolutionStatus = candidates.length >= 2 ? 'ambiguous'
    : complete ? (candidates.length === 1 ? 'resolved' : 'not-found')
      : scopes.length === 0 && unsupportedScopes.length > 0 ? 'unsupported'
        : 'incomplete';
  timing['totalMs'] = now() - started;
  return {
    version: DEVICE_NAME_RESOLUTION_VERSION, status, query, candidates, exclusions,
    coverage: { complete, requestedSourceKinds: SOURCE_KINDS.filter((kind) => requested(query, kind)), roots, scopes, unsupportedScopes, limits },
    admission,
    prefs: { path: context.prefsPath, sha256: prefs.sha256, signature: prefs.signature, reused: prefs.reused, problem: prefs.problem },
    timing, cache: { hits: cache.hits - hitsBefore, misses: cache.misses - missesBefore },
  };
}

function nativeKey(root: string): string {
  try {
    const stat = statSync(root, { bigint: true });
    return `${stat.ino}:${stat.mtimeNs}:${stat.ctimeNs}`;
  } catch {
    return `missing:${Date.now()}`;
  }
}

function pluginScope(
  query: ResolutionQuery, root: DiscoveredRoot, kind: PluginKind, context: HostContext, tables: IdTableSet | null, tablesProblem: string | null,
  stateProblem: string | null, cache: DiscoveryCache, candidates: Candidate[], exclusions: Exclusion[], count: (present: number, decoded: number) => void,
): ScopeCoverage {
  const base = { sourceKind: kind, rootKind: root.kind, root: root.path } as const;
  if (!root.available) {
    return { ...base, status: 'unavailable', scanned: 0, entries: 0, limits: [`location ${root.problem ?? 'unavailable'}`] };
  }
  if (tables === null) {
    return { ...base, status: 'unsupported', scanned: 0, entries: 0, limits: [`index dictionaries unreadable: ${tablesProblem}`] };
  }
  const scans: PluginIndexScan[] = PLUGIN_ARCHITECTURES.map((arch) => scanPluginIndex(root.path, kind, arch, context.indexDirectory, tables, cache));
  const limitsOut: string[] = [];
  let status: ScopeCoverage['status'] = 'complete';
  if (stateProblem !== null) { status = 'incomplete'; limitsOut.push(stateProblem); }
  let entries = 0;
  const indexed = new Set<string>();
  for (const scan of scans) {
    if (!scan.present) continue;
    count(1, scan.problem === null ? 1 : 0);
    if (scan.problem !== null) { status = 'unsupported'; limitsOut.push(`${scan.architecture} index undecodable: ${scan.problem}`); continue; }
    entries += scan.entries.length;
    for (const entry of scan.entries) {
      indexed.add(entry.relativeBundle);
      const display = pluginDisplayName(entry);
      if (display !== query.name) {
        if (entry.name === query.name) {
          exclusions.push({ sourceKind: kind, name: display, reason: 'architecture-suffix', path: entry.bundlePath,
            detail: `the ${entry.architecture} entry is shown as ${JSON.stringify(display)}; request that exact name` });
        }
        continue;
      }
      if (!entry.bundleExists) {
        exclusions.push({ sourceKind: kind, name: display, reason: 'bundle-missing', path: entry.bundlePath,
          detail: 'the index names a bundle that no longer exists; Bitwig has not re-indexed the location' });
        continue;
      }
      candidates.push(candidateOf(entry, root));
    }
  }
  // A bundle on disk that no index names is a plug-in Bitwig could not load (its metadata cache says so) or has not
  // indexed yet. The first is an exclusion; the second is a coverage limit.
  const onDisk = scanBundles(root.path, kind);
  if (!onDisk.complete) { status = status === 'unsupported' ? status : 'incomplete'; limitsOut.push(...onDisk.problems.map((p) => `bundle scan: ${p}`)); }
  const unindexed: string[] = [];
  const failedToLoad: string[] = [];
  for (const bundle of onDisk.bundles) {
    if (indexed.has(bundle)) continue;
    const bundlePath = `${root.path}/${bundle}`;
    const failure = metadataFailure(context, kind, cache, bundlePath);
    if (failure === null) { unindexed.push(bundle); continue; }
    failedToLoad.push(bundle);
    const stem = bundle.split('/').pop()!.slice(0, -(kind.length + 1));
    if (stem === query.name) {
      exclusions.push({ sourceKind: kind, name: stem, reason: 'plug-in-failed-to-load', path: bundlePath,
        detail: `Bitwig recorded a load failure for this bundle: ${failure}` });
    }
  }
  if (unindexed.length > 0) {
    if (status === 'complete') status = 'incomplete';
    limitsOut.push(`${unindexed.length} ${kind} bundle(s) on disk without an index entry or a recorded load failure: ${unindexed.slice(0, 8).join(', ')}${unindexed.length > 8 ? ', …' : ''}`);
  }
  return { ...base, status, scanned: onDisk.scanned, entries, limits: limitsOut,
    indexes: scans.filter((scan) => scan.present).map((scan) => ({ file: scan.file, architecture: scan.architecture, entries: scan.entries.length, reused: scan.reused })),
    bundleCheck: { depth: onDisk.depth, bundles: onDisk.bundles.length, unscannedDirectories: onDisk.unscannedDirectories, unindexed, failedToLoad } };
}

/** The recorded load failure of one bundle across the architectures Bitwig caches, or null. */
function metadataFailure(context: HostContext, kind: PluginKind, cache: DiscoveryCache, bundlePath: string): string | null {
  for (const arch of PLUGIN_ARCHITECTURES) {
    let records;
    try {
      records = readMetadataCache(context.cacheDirectory, kind, arch, cache);
    } catch {
      continue;
    }
    if (records === null) continue;
    const failure = cacheFailureFor(records.records, bundlePath);
    if (failure !== null) return failure.error ?? 'unspecified';
  }
  return null;
}

function candidateOf(entry: PluginBundleEntry, root: DiscoveredRoot): Candidate {
  const display = pluginDisplayName(entry);
  return {
    sourceKind: entry.kind, name: display,
    identity: entry.kind === 'vst3' ? { vst3Id: entry.identity } : { clapId: entry.identity },
    insertion: { kind: entry.kind, id: entry.identity },
    location: { rootKind: root.kind, root: root.path, path: entry.bundlePath, relativePath: entry.relativeBundle },
    vendor: entry.vendor, architecture: entry.architecture, version: entry.version, category: entry.category, deviceTypeCode: entry.deviceTypeCode,
    freshness: { bundleExists: entry.bundleExists, bundleMtimeMatchesIndex: entry.bundleMtimeMatchesIndex },
  };
}

function presetScope(query: ResolutionQuery, root: DiscoveredRoot, candidates: Candidate[], exclusions: Exclusion[]): ScopeCoverage {
  const base = { sourceKind: 'bitwig-preset', rootKind: root.kind, root: root.path } as const;
  if (!root.available) return { ...base, status: 'unavailable', scanned: 0, entries: 0, limits: [`location ${root.problem ?? 'unavailable'}`] };
  const scan = scanPresetFiles(root.path);
  const limitsOut = [...scan.problems];
  let status: ScopeCoverage['status'] = scan.complete ? 'complete' : 'incomplete';
  for (const file of scan.files) {
    if (file.stem !== query.name) continue;
    try {
      const meta = readPresetMetadata(file.path);
      candidates.push({
        sourceKind: 'bitwig-preset', name: file.stem, identity: { path: file.path }, insertion: { kind: 'preset', path: file.path },
        location: { rootKind: root.kind, root: root.path, path: file.path, relativePath: file.relativePath },
        preset: { deviceId: meta.deviceId, deviceName: meta.deviceName, deviceCreator: meta.deviceCreator, creator: meta.creator,
          tags: meta.tags, applicationVersion: meta.applicationVersion, bytes: meta.bytes, sha256: meta.sha256 },
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      exclusions.push({ sourceKind: 'bitwig-preset', name: file.stem, reason: 'unreadable-preset', path: file.path, detail });
      status = 'incomplete';
      limitsOut.push(`${file.relativePath}: ${detail}`);
    }
  }
  return { ...base, status, scanned: scan.scanned, entries: scan.files.length, limits: limitsOut };
}

function admissionOf(
  context: HostContext, knownBuild: string | null, checks: BuildAdmission['checks'], prefs: PrefsRead, tablesProblem: string | null, pluginsRequested: boolean,
): BuildAdmission {
  const jar = context.jar === null ? null : { path: context.jar.path, sha256: context.jar.sha256, bytes: context.jar.bytes, mtimeNs: context.jar.mtimeNs };
  const problems: string[] = [];
  if (!checks.prefsDecoded) problems.push(prefs.problem ?? 'prefs not decoded');
  if (pluginsRequested && tablesProblem !== null) problems.push(`index dictionaries: ${tablesProblem}`);
  if (pluginsRequested && checks.pluginRootsAvailable > 0 && checks.pluginRootsWithIndexState === 0 && checks.prefsDecoded) {
    problems.push('no configured plug-in location has an index state file: the location list or the index naming scheme is not the traced one');
  }
  if (checks.indexesDecoded < checks.indexesPresent) problems.push(`${checks.indexesPresent - checks.indexesDecoded} present index file(s) did not decode`);
  if (!checks.nativeDecoded) problems.push('the stock device settings did not all decode');
  const fatal = !checks.prefsDecoded || (pluginsRequested && tablesProblem !== null);
  const verdict: BuildAdmission['verdict'] = fatal ? 'unsupported' : problems.length > 0 ? 'partial' : knownBuild !== null ? 'pinned' : 'validated';
  const detail = problems.length > 0 ? problems.join('; ')
    : knownBuild !== null ? `jar fingerprint matches the traced ${knownBuild} build (${KNOWN_BUILDS[context.jar!.sha256]!.evidence}); runtime checks pass`
      : `jar fingerprint is not a traced build (Bitwig ${context.version}); the prefs, index-state, index, and stock-device checks passed at run time`;
  return { verdict, jar, knownBuild, checks, detail: context.jarProblem === null ? detail : `${detail}; ${context.jarProblem}` };
}

export { DiscoveryCache, DiscoveryFormatError };
