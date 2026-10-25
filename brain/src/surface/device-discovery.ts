/**
 * V14: `resolve_device_name` of `agent-native-v1`.
 *
 * One exact name becomes the insertion identity that `add_devices` takes: a stock device UUID from the running
 * installation, a VST3 class UID or CLAP id from Bitwig's plug-in indexes, or an absolute `.bwpreset` path under a
 * configured content location. The tool reads the running host's process, settings directory, preferences, indexes,
 * and content roots on each call and makes no Bitwig call. It returns every exact candidate, the exclusions it can
 * name, and the coverage of the requested scope, so a unique or absence claim is never wider than what was read.
 *
 * This module imports only types from `tools.ts`, so there is no import cycle.
 */
import { isAbsolute } from 'node:path';

import { z } from 'zod';

import {
  DiscoveryCache, RootNotDiscoveredError, SOURCE_KINDS, discoverHostContext, resolveDeviceName,
  type DeviceNameResolution, type HostProbe,
} from '../discovery/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, ToolFailure, failureResult, type ReadResult, type Warning } from './agent-native-result.js';
import type { ToolSpec } from './tools.js';
import type { Workspace } from './workspace.js';

export const DEVICE_NAME_SCHEMA = 'ghostnote-device-name-resolution/1';
const PROFILE = `Profile ${AGENT_NATIVE_TOOL_PROFILE}.`;

export const resolveInput = z.object({
  name: z.string().min(1).describe('Exact, case-sensitive display name: a stock device name, a plug-in name as Bitwig '
    + 'indexes it (an x64 plug-in is "Name [X64]"), or a preset file name without .bwpreset.'),
  sourceKind: z.enum(SOURCE_KINDS).optional().describe('Search one kind only: native (stock Bitwig device), vst3, clap, or '
    + 'bitwig-preset. Omit it to search all four; a name in two kinds is then ambiguous.'),
  root: z.string().min(1).refine(isAbsolute, 'Use an absolute path.').optional().describe('Search one discovered location only, by '
    + 'its exact path from data.coverage.roots. A path that is not a discovered location refuses; it does not add a search root.'),
}).strict();
export type ResolveInput = z.infer<typeof resolveInput>;

const DESCRIPTION = `${PROFILE} Find the exact insertion identity of one device or Bitwig preset name without a Bitwig `
  + 'call or browser popup: a stock device UUID from the running installation, a VST3 class UID or CLAP id from Bitwig\'s '
  + 'plug-in indexes, or the absolute .bwpreset path under the configured My Library, package, sound-content, and music '
  + 'locations. Each call identifies the running Bitwig process, its version, its settings directory '
  + '(BITWIG_USER_SETTINGS_DIR is honored), and its current preferences, so a location added in Settings > Locations '
  + 'is searched at once and a removed one is not. Matching is exact. data.status: resolved (one candidate and complete '
  + 'coverage; data.insertion is the add_devices source), ambiguous (two or more candidates: pass sourceKind or root), '
  + 'not-found (no candidate and complete coverage), incomplete (a limit in data.coverage.limits prevents a unique or '
  + 'absence claim; the candidates found are still listed), or unsupported (the build or its files could not be '
  + 'validated). A plug-in claim is about Bitwig\'s own index, which is what add_devices can insert from; a bundle on disk '
  + 'at the root or one directory below it without an index entry or a recorded load failure makes the scope incomplete, '
  + 'and deeper directories are counted in coverage.scopes[].bundleCheck.unscannedDirectories, not searched. A preset '
  + 'candidate reports its contained device and file hash; the path is its identity. VST2 and vendor preset formats are '
  + 'not resolved. macOS only. The call takes about 100 ms on a warm cache and writes nothing.';

export interface DeviceDiscoveryOptions {
  readonly probe?: HostProbe;
  readonly cache?: DiscoveryCache;
}

const sharedCache = new DiscoveryCache();

export async function runResolveDeviceName(workspace: Workspace, args: ResolveInput, options: DeviceDiscoveryOptions = {}): Promise<unknown> {
  const started = performance.now();
  const target = { name: args.name, sourceKind: args.sourceKind ?? null, root: args.root ?? null };
  try {
    // The handshake version is cached after the first connection. Before it, one revision mark connects and
    // handshakes; it is the only Bitwig call this tool can make.
    let info = await workspace.hostInfo?.();
    let bitwigCalls = 0;
    if (info === undefined) {
      try { await workspace.mark(); bitwigCalls = 1; info = await workspace.hostInfo?.(); } catch { /* no connection: the version stays unverified */ }
    }
    const liveHostVersion = info?.host?.version ?? null;
    const hostStarted = performance.now();
    const host = await discoverHostContext(options.probe, liveHostVersion);
    const hostContextMs = performance.now() - hostStarted;
    if (!host.ok) {
      throw new ToolFailure(host.reason === 'host-version-mismatch' || host.reason === 'multiple-hosts' ? 'unhealthy' : 'unsupported', 'resolve',
        `Device names cannot be resolved: ${host.detail}.`, { detail: { reason: host.reason },
          ...(host.reason === 'no-running-host' ? { retryWhen: 'after Bitwig Studio is running' } : {}) });
    }
    const { context } = host;
    const resolution = resolveDeviceName(args, context, { cache: options.cache ?? sharedCache });
    const warnings = warningsOf(resolution, liveHostVersion, context.lastRunVersion, context.version);
    const result: ReadResult<unknown> = {
      schema: DEVICE_NAME_SCHEMA,
      source: {
        host: 'local-filesystem', read: 'running-host-configuration', bitwigCalls,
        application: { root: context.appRoot, pid: context.pid, version: context.version, liveHostVersion },
        settings: { root: context.settingsRoot, override: context.settingsOverride, prefs: context.prefsPath, prefsSha256: resolution.prefs.sha256,
          indexDirectory: context.indexDirectory },
        jar: resolution.admission.jar,
      },
      target,
      coverage: {
        status: resolution.coverage.complete ? 'complete' : resolution.status === 'unsupported' ? 'unsupported' : 'incomplete',
        requestedSourceKinds: resolution.coverage.requestedSourceKinds,
        roots: resolution.coverage.roots,
        scopes: resolution.coverage.scopes,
        unsupportedScopes: resolution.coverage.unsupportedScopes,
        limits: resolution.coverage.limits,
      },
      authority: { kind: 'fresh-read', version: resolution.version, admission: resolution.admission },
      data: {
        status: resolution.status,
        candidates: resolution.candidates,
        exclusions: resolution.exclusions,
        ...(resolution.status === 'resolved' ? {
          insertion: resolution.candidates[0]!.insertion,
          next: { tool: 'add_devices', devices: [resolution.candidates[0]!.insertion] },
        } : {}),
        ...(resolution.status === 'ambiguous' ? { next: disambiguation(resolution) } : {}),
      },
      warnings,
      timing: { ...resolution.timing, hostContextMs, toolTotalMs: performance.now() - started,
        cacheHits: resolution.cache.hits, cacheMisses: resolution.cache.misses },
    };
    return result;
  } catch (error) {
    if (error instanceof RootNotDiscoveredError) {
      return failureResult(DEVICE_NAME_SCHEMA, 'resolve', new ToolFailure('absent', 'resolve',
        `${error.root} is not a discovered location. Pass one of the discovered roots or omit root.`,
        { detail: { discoveredRoots: error.discovered } }), target);
    }
    return failureResult(DEVICE_NAME_SCHEMA, 'resolve', error, target);
  }
}

function disambiguation(resolution: DeviceNameResolution): Record<string, unknown> {
  const kinds = [...new Set(resolution.candidates.map((item) => item.sourceKind))];
  const roots = [...new Set(resolution.candidates.map((item) => item.location.root))];
  return {
    tool: 'resolve_device_name',
    ...(kinds.length > 1 ? { sourceKind: kinds } : {}),
    ...(roots.length > 1 ? { root: roots } : {}),
    ...(kinds.length === 1 && roots.length === 1 ? { note: 'The candidates share a kind and location; choose by data.candidates[].location.path and insert with add_devices.' } : {}),
  };
}

function warningsOf(resolution: DeviceNameResolution, liveHostVersion: string | null, lastRunVersion: string | null, version: string): Warning[] {
  const warnings: Warning[] = [];
  if (liveHostVersion === null) {
    warnings.push({ code: 'host-version-unverified', message: 'No extension handshake is cached, so the running application version was not '
      + 'cross-checked against the connected host.' });
  }
  if (lastRunVersion !== null && lastRunVersion !== version) {
    warnings.push({ code: 'settings-last-run-differs', message: `The settings directory last recorded Bitwig ${lastRunVersion}; the running `
      + `application is ${version}.` });
  }
  if (resolution.admission.verdict === 'validated') {
    warnings.push({ code: 'build-validated-at-runtime', message: resolution.admission.detail });
  }
  if (resolution.admission.verdict === 'partial' || resolution.admission.verdict === 'unsupported') {
    warnings.push({ code: 'build-checks-failed', message: resolution.admission.detail });
  }
  if (!resolution.coverage.complete && resolution.status !== 'unsupported') {
    warnings.push({ code: 'coverage-incomplete', message: `${resolution.coverage.limits.length} limit(s) prevent a unique or absence claim. See coverage.limits.` });
  }
  for (const candidate of resolution.candidates) {
    if (candidate.freshness?.bundleMtimeMatchesIndex === false) {
      warnings.push({ code: 'bundle-changed-since-index', message: `${candidate.name} (${candidate.sourceKind}): the bundle at ${candidate.location.path} `
        + 'changed after Bitwig indexed it; the id is the indexed one.' });
    }
  }
  return warnings;
}

export const DEVICE_DISCOVERY_TOOLS: readonly ToolSpec[] = [{
  name: 'resolve_device_name', kind: 'read', title: 'Resolve a device or preset name to its insertion identity',
  description: DESCRIPTION, inputSchema: resolveInput.shape, inputValidator: resolveInput, emits: [],
  resultContract: { schema: DEVICE_NAME_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE,
    envelope: ['schema', 'source', 'target', 'coverage', 'authority', 'data', 'warnings', 'timing'],
    data: ['status', 'candidates', 'exclusions', 'insertion', 'next'],
    status: ['resolved', 'ambiguous', 'not-found', 'incomplete', 'unsupported'],
    candidate: ['sourceKind', 'name', 'identity', 'insertion', 'location', 'vendor', 'architecture', 'version', 'category', 'deviceTypeCode', 'freshness', 'preset'],
    exclusion: ['bundle-missing', 'architecture-suffix', 'unreadable-preset'],
    coverage: ['status', 'requestedSourceKinds', 'roots', 'scopes', 'unsupportedScopes', 'limits'],
    admission: ['pinned', 'validated', 'partial', 'unsupported'],
    refusals: ['absent (root is not a discovered location)', 'unsupported (platform, no running host, unreadable process or version)',
      'unhealthy (host version mismatch or several hosts)'] },
  run: (workspace, input) => runResolveDeviceName(workspace, input as ResolveInput),
}];
