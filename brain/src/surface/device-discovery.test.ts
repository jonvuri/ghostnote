/**
 * V14: resolve_device_name on the fake adapter with an injected host probe and a synthetic host tree. No real
 * process list, prefs file, or vendor jar is read, and no adapter call is made.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { CONTRACT_TAG, CONTRACT_VERSION, type AdapterInfo } from '../contract/index.js';
import { EXAMPLE_CLAP_ID, EXAMPLE_VST3_ID, POLYSYNTH_UUID, buildSyntheticHost, type SyntheticHost } from '../discovery/fixtures.js';
import type { HostProbe } from '../discovery/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { DEVICE_NAME_SCHEMA, runResolveDeviceName, resolveInput } from './device-discovery.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool, toolNamed } from './tools.js';
import { workspaceOf } from './workspace.js';

type Wire = Record<string, any>;

/** Counts adapter calls: the tool must make none. */
class CountingAdapter extends FakeAdapter {
  calls = 0;
  override async revision(...args: Parameters<FakeAdapter['revision']>) { this.calls += 1; return super.revision(...args); }
  override async tracks(...args: Parameters<FakeAdapter['tracks']>) { this.calls += 1; return super.tracks(...args); }
  override async devices(...args: Parameters<FakeAdapter['devices']>) { this.calls += 1; return super.devices(...args); }
}

const liveInfo = (version: string): AdapterInfo => ({
  contract: CONTRACT_TAG, contractVersion: CONTRACT_VERSION, kind: 'live',
  host: { apiVersion: 25, product: 'Bitwig Studio', version, extensionVersion: '0.0.1' },
  limits: { trackBankSize: 64, sceneBankSize: 8, trackCount: 1 },
  capabilities: { hasRealBitwig: true, hasDeterministicClock: false, canOverflowBank: false, canInjectInterference: false, hasDeviceModel: true },
});

function fixture(t: { after(run: () => void): void }, info?: AdapterInfo) {
  const dir = mkdtempSync(join(tmpdir(), 'gn-resolve-tool-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const host = buildSyntheticHost(dir);
  const fake = new CountingAdapter({ tracks: ['gn-resolve'], scenes: 4 });
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `r-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
    ...(info === undefined ? {} : { adapterInfo: () => info }),
  });
  return { host, fake, workspace, probe: probeFor(host) };
}

const exe = (host: SyntheticHost): string => `${host.appRoot}/Contents/MacOS/BitwigStudio`;
const probeFor = (host: SyntheticHost, over: Partial<HostProbe> = {}): HostProbe => ({
  platform: 'darwin', home: host.home,
  listProcesses: async () => [{ pid: 1, ppid: 0, command: '/sbin/launchd' }, { pid: 44, ppid: 1, command: exe(host) }],
  processEnvironment: async () => `${exe(host)} USER=person HOME=${host.home} SHELL=/bin/zsh`,
  bundleVersion: async () => '6.1.4',
  ...over,
});

test('resolve_device_name: a resolved name returns the add_devices source, complete coverage, and no adapter call', async (t) => {
  const fx = fixture(t, liveInfo('6.1.4'));
  const result = await runResolveDeviceName(fx.workspace, { name: 'Polysynth' }, { probe: fx.probe }) as Wire;
  assert.equal(result.schema, DEVICE_NAME_SCHEMA);
  assert.equal(result.failure, undefined, JSON.stringify(result).slice(0, 400));
  assert.equal(result.data.status, 'resolved');
  assert.deepEqual(result.data.insertion, { kind: 'bitwig', id: POLYSYNTH_UUID });
  assert.deepEqual(result.data.next, { tool: 'add_devices', devices: [{ kind: 'bitwig', id: POLYSYNTH_UUID }] });
  assert.equal(result.coverage.status, 'complete');
  assert.equal(result.source.bitwigCalls, 0);
  assert.deepEqual(result.source.application, { root: fx.host.appRoot, pid: 44, version: '6.1.4', liveHostVersion: '6.1.4' });
  assert.equal(result.source.settings.root, fx.host.settingsRoot);
  assert.equal(result.source.settings.override, null);
  assert.equal(result.authority.admission.verdict, 'validated');
  assert.deepEqual(result.warnings.map((w: Wire) => w.code), ['build-validated-at-runtime']);
  assert.equal(typeof result.timing.totalMs, 'number');
  assert.equal(typeof result.timing.hostContextMs, 'number');
  assert.equal(fx.fake.calls, 0);
});

test('resolve_device_name: ambiguity names the disambiguating inputs; sourceKind and root resolve; a foreign root refuses as absent', async (t) => {
  const fx = fixture(t, liveInfo('6.1.4'));
  const both = await runResolveDeviceName(fx.workspace, { name: 'Example' }, { probe: fx.probe }) as Wire;
  assert.equal(both.data.status, 'ambiguous');
  assert.equal(both.data.insertion, undefined);
  assert.deepEqual(both.data.next, { tool: 'resolve_device_name', sourceKind: ['vst3', 'clap'], root: [fx.host.vst3Root, fx.host.clapRoot] });
  const vst3 = await runResolveDeviceName(fx.workspace, { name: 'Example', sourceKind: 'vst3' }, { probe: fx.probe }) as Wire;
  assert.deepEqual(vst3.data.insertion, { kind: 'vst3', id: EXAMPLE_VST3_ID });
  const clap = await runResolveDeviceName(fx.workspace, { name: 'Example', root: fx.host.clapRoot }, { probe: fx.probe }) as Wire;
  assert.deepEqual(clap.data.insertion, { kind: 'clap', id: EXAMPLE_CLAP_ID });
  const absent = await runResolveDeviceName(fx.workspace, { name: 'Example', root: '/Volumes/Nowhere' }, { probe: fx.probe }) as Wire;
  assert.equal(absent.failure.code, 'absent');
  assert.equal(absent.failure.stage, 'resolve');
  assert.ok(absent.detail.discoveredRoots.includes(fx.host.clapRoot));
  assert.equal(fx.fake.calls, 0);
});

test('resolve_device_name: not-found, incomplete, and preset results carry their coverage and warnings', async (t) => {
  const fx = fixture(t);
  const none = await runResolveDeviceName(fx.workspace, { name: 'No Such Device' }, { probe: fx.probe }) as Wire;
  assert.equal(none.data.status, 'not-found');
  assert.deepEqual(none.warnings.map((w: Wire) => w.code), ['host-version-unverified', 'build-validated-at-runtime']);
  fx.host.writePrefs({ soundContent: [['/Volumes/Missing Drive', 1]] });
  const partial = await runResolveDeviceName(fx.workspace, { name: 'gn-preset-zoo', sourceKind: 'bitwig-preset' }, { probe: fx.probe }) as Wire;
  assert.equal(partial.data.status, 'incomplete');
  assert.equal(partial.coverage.status, 'incomplete');
  assert.equal(partial.data.candidates.length, 1);
  assert.deepEqual(partial.data.candidates[0].insertion, { kind: 'preset', path: join(fx.host.myLibrary, 'Presets', 'Polysynth', 'gn-preset-zoo.bwpreset') });
  assert.ok(partial.warnings.some((w: Wire) => w.code === 'coverage-incomplete'));
  assert.match(partial.coverage.limits.join('\n'), /Missing Drive/);
});

test('resolve_device_name: host discovery refusals are unsupported or unhealthy failures', async (t) => {
  const fx = fixture(t, liveInfo('6.1.4'));
  const linux = await runResolveDeviceName(fx.workspace, { name: 'Polysynth' }, { probe: probeFor(fx.host, { platform: 'linux' }) }) as Wire;
  assert.equal(linux.failure.code, 'unsupported');
  assert.equal(linux.detail.reason, 'unsupported-platform');
  const none = await runResolveDeviceName(fx.workspace, { name: 'Polysynth' }, { probe: probeFor(fx.host, { listProcesses: async () => [] }) }) as Wire;
  assert.equal(none.failure.code, 'unsupported');
  assert.equal(none.retryWhen, 'after Bitwig Studio is running');
  const other = await runResolveDeviceName(fx.workspace, { name: 'Polysynth' }, { probe: probeFor(fx.host, { bundleVersion: async () => '6.2.0' }) }) as Wire;
  assert.equal(other.failure.code, 'unhealthy');
  assert.equal(other.detail.reason, 'host-version-mismatch');
});

test('resolve_device_name: the public spec validates its input before any discovery', async (t) => {
  const fx = fixture(t);
  const spec = toolNamed('resolve_device_name', AGENT_NATIVE_TOOL_PROFILE);
  assert.ok(spec !== undefined);
  assert.equal(spec.kind, 'read');
  assert.deepEqual(spec.emits, []);
  assert.equal(resolveInput.safeParse({ name: '' }).success, false);
  assert.equal(resolveInput.safeParse({ name: 'x', sourceKind: 'vst2' }).success, false);
  assert.equal(resolveInput.safeParse({ name: 'x', root: 'relative/path' }).success, false);
  assert.equal(resolveInput.safeParse({ name: 'x', extra: 1 }).success, false);
  await assert.rejects(callTool(fx.workspace, 'resolve_device_name', { name: '' }, AGENT_NATIVE_TOOL_PROFILE));
  assert.equal(fx.fake.calls, 0);
});
