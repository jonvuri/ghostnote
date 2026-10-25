import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SCOPE_MARKER, SETTLE_WAITS, TRIALS_PER_WAIT, compareScope, runScopeScrollProbe,
  type Container, type ScopeState, type ScopeStatus,
} from './b08-scope-scroll-lib.js';

const target = { project: 'B08 test', generation: 'init-1', trackId: 'scratch-id' };
const resting: Container = { position: 0, name: 'gn-b08 A', chains: [
  { name: 'A1', devices: ['Tool'] }, { name: 'A2', devices: ['Blur'] },
] };
const far: Container = { position: 3, name: 'gn-b08 B', chains: [
  { name: 'B1', devices: ['Tool', 'Blur', 'Delay-1', 'Filter'] }, { name: 'B2', devices: ['Chorus'] },
  { name: 'B3', devices: ['Gate'] }, { name: 'B4', devices: ['Bit-8'] }, { name: 'B5', devices: ['EQ-5'] },
] };
const LAYER_WINDOW = 3;
const DEVICE_WINDOW = 2;

/** A host model: one-wide scopes retarget `lag` ms after a scroll; nested windows move at once. */
function fake(options: { lag?: number; retargetBroken?: boolean } = {}) {
  const lag = options.lag ?? 60;
  let clock = 0;
  const chains = (container: Container) => container.chains.map((chain) => ({ ...chain, solo: false }));
  const track: ({ name: string; chains?: ReturnType<typeof chains> })[] = [
    { name: resting.name, chains: chains(resting) }, { name: 'Tool' }, { name: 'Tool' }, { name: far.name, chains: chains(far) },
  ];
  type Scope = { requested: number; effective: number; effectiveAt: number; layerPos: number; devicePos: number[] };
  const scopes: Scope[] = [0, 1].map(() => ({ requested: 0, effective: 0, effectiveAt: 0, layerPos: 0, devicePos: [0, 0, 0] }));
  let cursor = 0;
  const clampTop = (p: number) => Math.max(0, Math.min(track.length - 1, p));
  const settle = (scope: Scope) => {
    if (!options.retargetBroken && clock >= scope.effectiveAt) scope.effective = clampTop(scope.requested);
  };
  const state = (index: number): ScopeState => {
    const scope = scopes[index]!;
    settle(scope);
    const device = track[scope.effective]!;
    const rows = device.chains ?? [];
    const layerPos = Math.max(0, Math.min(Math.max(0, rows.length - LAYER_WINDOW), scope.layerPos));
    return {
      scope: index, status: 'held', requestedPosition: scope.requested,
      scrollPosition: scope.effective, itemCount: track.length,
      canScrollForwards: scope.effective < track.length - 1, canScrollBackwards: scope.effective > 0,
      device: { exists: true, name: device.name, position: scope.effective, hasLayers: device.chains !== undefined },
      layers: {
        scrollPosition: layerPos, itemCount: rows.length,
        canScrollForwards: layerPos + LAYER_WINDOW < rows.length, canScrollBackwards: layerPos > 0,
        items: Array.from({ length: LAYER_WINDOW }, (_, i) => {
          const chain = rows[layerPos + i];
          const devicePos = chain ? Math.max(0, Math.min(Math.max(0, chain.devices.length - DEVICE_WINDOW), scope.devicePos[i]!)) : 0;
          return {
            index: i, exists: chain !== undefined, ...(chain ? { name: chain.name, solo: chain.solo, channelId: `id-${chain.name}` } : {}),
            devices: {
              scrollPosition: devicePos, itemCount: chain?.devices.length ?? 0,
              canScrollForwards: chain !== undefined && devicePos + DEVICE_WINDOW < chain.devices.length, canScrollBackwards: devicePos > 0,
              items: Array.from({ length: DEVICE_WINDOW }, (_, d) => {
                const name = chain?.devices[devicePos + d];
                return { index: d, exists: name !== undefined, ...(name !== undefined ? { name, position: devicePos + d } : {}) };
              }),
            },
          };
        }),
      },
    };
  };
  const status = (): ScopeStatus => ({
    marker: SCOPE_MARKER, sequence: 0, scopeCount: 2, layerWindow: LAYER_WINDOW, deviceWindow: DEVICE_WINDOW,
    context: { ...target, trackExists: true, trackName: 'gn-b08', deviceCount: track.length },
    reference: { width: 16, itemCount: track.length, devices: track.map((d, index) => ({ index, name: d.name })) },
    scopes: [state(0), state(1)],
  });
  const calls: { method: string; params?: Record<string, unknown> }[] = [];
  const wire = async (method: string, params?: Record<string, unknown>) => {
    calls.push({ method, params });
    if (method === 'devcursor.selectAt') { cursor = params!['deviceIndex'] as number; return { success: true }; }
    if (method === 'layer.list') {
      return { layers: (track[cursor]!.chains ?? []).map((chain, index) => ({ index, name: chain.name, solo: chain.solo })) };
    }
    assert.equal(method, 'probe.scopeScroll');
    const p = params!;
    const operation = p['operation'];
    if (operation === 'status') return status();
    // The probe checks the scratch identity only for scrolls and the write, as the extension does.
    assert.equal(p['trackId'], target.trackId);
    const scope = scopes[p['scope'] as number]!;
    if (operation === 'scroll') { scope.requested = p['position'] as number; scope.effectiveAt = clock + lag; return { requested: true }; }
    if (operation === 'scrollLayers') { scope.layerPos = p['position'] as number; return { requested: true }; }
    if (operation === 'scrollDevices') { scope.devicePos[p['layerIndex'] as number] = p['position'] as number; return { requested: true }; }
    assert.equal(operation, 'setSolo');
    const current = state(p['scope'] as number);
    if (current.scrollPosition !== scope.requested) throw new Error(`scope reports position ${current.scrollPosition}, not the requested ${scope.requested}`);
    if (track[scope.requested]!.name !== p['expectedContainerName']) throw new Error('reference name differs');
    if (current.device.name !== p['expectedContainerName']) throw new Error('the hung bank has not settled');
    const row = current.layers.items[p['layerIndex'] as number]!;
    if (!row.exists || row.name !== p['expectedChainName']) throw new Error('chain name differs');
    const chain = track[scope.effective]!.chains!.find((c) => c.name === row.name)!;
    chain.solo = p['solo'] as boolean;
    return { requested: true, previousSolo: !chain.solo };
  };
  const records: Record<string, unknown> = {};
  return {
    wire, calls, records,
    wait: async (ms: number) => { clock += ms; },
    now: () => clock,
    record: (label: string, value: unknown) => { records[label] = value; },
    soloFlags: () => track.flatMap((d) => (d.chains ?? []).map((c) => c.solo)),
  };
}

test('B08: a lagging host yields a retarget verdict with the settle table, clamping, nested windows, guard, and solo readback', async () => {
  const host = fake({ lag: 60 });
  const verdict = await runScopeScrollProbe({ ...host, target, resting, far });
  assert.equal(verdict.verdict, 'scrollable-scope-retargets');
  assert.equal(verdict.retarget.outcome, 'observed');
  assert.equal(verdict.retarget.resting.outcome, 'observed');
  assert.deepEqual(verdict.settle.fixedWaits.map((row) => [row.waitMs, row.correct, row.trials]),
    SETTLE_WAITS.map((waitMs) => [waitMs, waitMs >= 60 ? TRIALS_PER_WAIT : 0, TRIALS_PER_WAIT]));
  assert.equal(verdict.settle.medianCompleteMs, 60);
  assert.equal(verdict.settle.medianNameMs, 60);
  assert.equal(verdict.clamp.reportedPosition, 3);
  assert.equal(verdict.clamp.canScrollForwards, false);
  assert.equal(verdict.clamp.deviceName, far.name);
  assert.equal(verdict.clamp.last.canScrollForwards, false);
  assert.equal(verdict.clamp.first.canScrollBackwards, false);
  assert.equal(verdict.nested.layers.outcome, 'observed');
  assert.deepEqual(verdict.nested.layers.names, ['B3', 'B4', 'B5']);
  assert.equal(verdict.nested.layers.itemCount, 5);
  assert.equal(verdict.nested.layersOverflow.reportedPosition, 2);
  assert.equal(verdict.nested.devices.outcome, 'observed');
  assert.deepEqual(verdict.nested.devices.names, ['Delay-1', 'Filter']);
  assert.equal(verdict.nested.devices.itemCount, 4);
  assert.equal(verdict.guard.immediateWrite, 'refused');
  assert.match(verdict.guard.message ?? '', /not settled|not the requested/);
  assert.equal(verdict.guard.settledAfterMs, 60);
  assert.equal(verdict.solo.outcome, 'observed');
  assert.equal(verdict.solo.chain, 'B2');
  assert.equal(verdict.simultaneity.outcome, 'observed');
  assert.deepEqual([verdict.simultaneity.scope0, verdict.simultaneity.scope1], [far.name, resting.name]);
  assert.deepEqual(verdict.cleanup.scopePositions, [0, 0]);
  assert.ok(verdict.cleanup.soloFlags.every((flag) => flag === false));
  assert.ok(host.soloFlags().every((flag) => flag === false), 'no solo remains set in the host');
  assert.equal(host.calls.filter((call) => call.params?.['operation'] === 'setSolo').length, 3,
    'one refused guard write, one solo write, one restore');
  assert.equal(host.calls.at(-1)?.params?.['operation'], 'status');
  assert.ok(host.records['q2-polled'] !== undefined && host.records['status-exit'] !== undefined);
});

test('B08: an immediately settling host records an accepted guard write and still clears every solo', async () => {
  const host = fake({ lag: 0 });
  const verdict = await runScopeScrollProbe({ ...host, target, resting, far });
  assert.equal(verdict.guard.immediateWrite, 'accepted');
  assert.equal(verdict.guard.settledAfterMs, 0);
  assert.deepEqual(verdict.settle.fixedWaits.map((row) => row.correct), SETTLE_WAITS.map(() => TRIALS_PER_WAIT));
  assert.ok(host.soloFlags().every((flag) => flag === false));
});

test('B08: a host whose hung banks never retarget yields the negative verdict without throwing', async () => {
  const host = fake({ retargetBroken: true });
  const verdict = await runScopeScrollProbe({ ...host, target, resting, far });
  assert.equal(verdict.verdict, 'scrollable-scope-does-not-retarget');
  assert.equal(verdict.retarget.outcome, 'refuted');
  assert.ok(verdict.retarget.mismatches.some((m) => m.field === 'device.name' && m.actual === resting.name));
  // Trials back to position 0 settle at once; every trial toward the far container never does.
  assert.ok(verdict.settle.polled.filter((t) => t.position === far.position).every((t) => t.nameMs === null && t.completeMs === null));
  // The scope never left position 0, so the resting-position guard write is legitimately accepted.
  assert.equal(verdict.guard.immediateWrite, 'accepted');
  assert.equal(verdict.solo.outcome, 'refuted');
  assert.match(verdict.solo.refused ?? '', /not settled|not the requested/);
  assert.equal(verdict.solo.cursorRoute, false);
  assert.ok(host.soloFlags().every((flag) => flag === false));
});

test('B08: the driver refuses a far container inside the fixed product range or within the windows', async () => {
  const host = fake();
  await assert.rejects(runScopeScrollProbe({ ...host, target, resting, far: { ...far, position: 2 } }),
    /reference bank does not name/);
  await assert.rejects(runScopeScrollProbe({ ...host, target: { ...target, trackId: 'other' }, resting, far }),
    /not the identified gn-b08/);
});

test('B08: compareScope reports every field a settled scope must match', () => {
  const settled: ScopeState = {
    scope: 0, status: 'held', requestedPosition: 3, scrollPosition: 3, itemCount: 4, canScrollForwards: false, canScrollBackwards: true,
    device: { exists: true, name: far.name, position: 3, hasLayers: true },
    layers: { scrollPosition: 0, itemCount: 5, canScrollForwards: true, canScrollBackwards: false, items: far.chains.slice(0, 3).map((chain, index) => ({
      index, exists: true, name: chain.name, solo: false, channelId: `id-${chain.name}`,
      devices: { scrollPosition: 0, itemCount: chain.devices.length, canScrollForwards: chain.devices.length > 2, canScrollBackwards: false,
        items: [0, 1].map((d) => ({ index: d, exists: chain.devices[d] !== undefined, ...(chain.devices[d] ? { name: chain.devices[d], position: d } : {}) })) },
    })) },
  };
  assert.deepEqual(compareScope(settled, far, LAYER_WINDOW, DEVICE_WINDOW), []);
  const wrongName = { ...settled, device: { ...settled.device, name: 'Tool' } };
  assert.deepEqual(compareScope(wrongName, far, LAYER_WINDOW, DEVICE_WINDOW).map((m) => m.field), ['device.name']);
  const shortCount = { ...settled, layers: { ...settled.layers, itemCount: 4 } };
  assert.deepEqual(compareScope(shortCount, far, LAYER_WINDOW, DEVICE_WINDOW).map((m) => m.field), ['layers.itemCount']);
});
