/**
 * 9b.7: check_grid_support on the fake adapter. The gate reads a local jar and a local cache; the tests point both
 * at temporary files through the environment, and no test opens a vendor jar.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { CONTRACT_TAG, CONTRACT_VERSION, type AdapterInfo } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { acceptedCacheFile, fingerprintJar } from '../grid/admission.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { GRID_SUPPORT_SCHEMA } from './grid-support.js';
import { AGENT_NATIVE_TOOL_PROFILE, AGENT_NATIVE_TOOLS, callTool, toolNamed } from './tools.js';
import { workspaceOf } from './workspace.js';

type Wire = Record<string, any>;
const ROOT = join(import.meta.dirname, '../../..');
const E342 = join(ROOT, 'context/evidence/data/phase9b-doctor/614-third-pass/live-v21-third-pass/accepted.json');

function workspace(info?: AdapterInfo) {
  const fake = new FakeAdapter({ tracks: ['gn-grid'], scenes: 4 });
  let id = 0;
  return workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `g-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
    ...(info === undefined ? {} : { adapterInfo: () => info }),
  });
}

const liveInfo = (version: string): AdapterInfo => ({
  contract: CONTRACT_TAG, contractVersion: CONTRACT_VERSION, kind: 'live',
  host: { apiVersion: 25, product: 'Bitwig Studio', version, extensionVersion: '0.0.1' },
  limits: { trackBankSize: 64, sceneBankSize: 8, trackCount: 1 },
  capabilities: { hasRealBitwig: true, hasDeterministicClock: false, canOverflowBank: false,
    canInjectInterference: false, hasDeviceModel: true },
});

async function withEnvironment<T>(values: Record<string, string>, work: () => Promise<T>): Promise<T> {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try { return await work(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gn-grid-support-'));
  const jar = join(dir, 'bitwig.jar');
  writeFileSync(jar, Buffer.from('inert jar bytes for the grid support test'));
  const cache = join(dir, 'cache');
  mkdirSync(cache);
  return { dir, jar, cache, env: { GHOSTNOTE_BITWIG_JAR: jar, GHOSTNOTE_GRID_DOCTOR_CACHE: cache } };
}

test('check_grid_support is a read with the fixed envelope and no Grid write tool beside it', () => {
  const spec = toolNamed('check_grid_support', AGENT_NATIVE_TOOL_PROFILE)!;
  assert.equal(spec.kind, 'read');
  assert.deepEqual(spec.emits, []);
  assert.match(spec.description, /cannot run that pass/);
  assert.match(spec.description, /one revision mark/);
  // The gate's promise: no public Grid write exists before a build is admitted.
  for (const tool of AGENT_NATIVE_TOOLS) {
    if (tool.name !== 'check_grid_support') assert.doesNotMatch(tool.name, /grid/, tool.name);
  }
});

test('without a cached pass the read succeeds with supported false and the operator steps', async () => {
  const { dir, env } = fixture();
  try {
    const result = await withEnvironment(env, () =>
      callTool(workspace(liveInfo('6.1.4')), 'check_grid_support', {}, AGENT_NATIVE_TOOL_PROFILE)) as Wire;
    assert.equal(result.schema, GRID_SUPPORT_SCHEMA);
    assert.equal(result.failure, undefined, JSON.stringify(result).slice(0, 300));
    assert.equal(result.data.supported, false);
    assert.deepEqual(result.data.host, { product: 'Bitwig Studio', version: '6.1.4' });
    assert.equal(result.data.jar.path, realpathSync(env.GHOSTNOTE_BITWIG_JAR));
    assert.equal(result.data.admission.reason, 'no-cached-pass');
    assert.match(result.data.next, /consent-gated doctor pass/);
    assert.deepEqual(result.warnings.map((w: Wire) => w.code), ['grid-unsupported']);
    assert.equal(result.coverage.gridWriteTools, 'none-in-this-profile');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('with the accepted record for the jar and host version the read reports supported true', async () => {
  const { dir, jar, cache, env } = fixture();
  try {
    const record = JSON.parse(readFileSync(E342, 'utf8')) as Wire;
    writeFileSync(acceptedCacheFile(cache, fingerprintJar(jar)),
      JSON.stringify({ ...record, fingerprint: fingerprintJar(jar).fingerprint }));
    const supported = await withEnvironment(env, () =>
      callTool(workspace(liveInfo('6.1.4')), 'check_grid_support', {}, AGENT_NATIVE_TOOL_PROFILE)) as Wire;
    assert.equal(supported.data.supported, true);
    assert.equal(supported.data.admission.verdict, 'admitted');
    assert.equal(supported.data.admission.cache.roles, 76);
    assert.deepEqual(supported.warnings, []);
    // The same record on another host version is refused: the gate is per build.
    const other = await withEnvironment(env, () =>
      callTool(workspace(liveInfo('6.2.0')), 'check_grid_support', {}, AGENT_NATIVE_TOOL_PROFILE)) as Wire;
    assert.equal(other.data.supported, false);
    assert.equal(other.data.admission.reason, 'host-version-differs');
    // The fake adapter has no host: the version is not cross-checked, and the warning says so.
    const fake = await withEnvironment(env, () =>
      callTool(workspace(), 'check_grid_support', {}, AGENT_NATIVE_TOOL_PROFILE)) as Wire;
    assert.equal(fake.data.supported, true);
    assert.equal(fake.data.host, null);
    assert.deepEqual(fake.warnings.map((w: Wire) => w.code), ['host-version-unknown']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an unreadable jar path is a successful read with supported false, not a failure', async () => {
  const result = await withEnvironment({ GHOSTNOTE_BITWIG_JAR: '/no/such/bitwig.jar', GHOSTNOTE_GRID_DOCTOR_CACHE: '/no/such' },
    () => callTool(workspace(liveInfo('6.1.4')), 'check_grid_support', {}, AGENT_NATIVE_TOOL_PROFILE)) as Wire;
  assert.equal(result.failure, undefined);
  assert.equal(result.data.supported, false);
  assert.equal(result.data.jar, null);
  assert.equal(result.data.admission.reason, 'jar-unreadable');
  assert.match(result.data.next, /GHOSTNOTE_BITWIG_JAR/);
});
