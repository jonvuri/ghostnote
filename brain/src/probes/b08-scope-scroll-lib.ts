/**
 * B08 bounded live probe: does a layer bank hung off a one-wide scrollable
 * device bank retarget when that bank scrolls, how long does it take, how do
 * the banks clamp, do the nested windows scroll, and does a guarded write
 * through a scrolled scope read back through an independent route?
 *
 * The driver owns no state in Bitwig beyond scroll positions of probe-owned
 * banks and one solo flag that it sets and clears. Every mutation has a
 * separate delayed readback.
 */
export const SCOPE_MARKER = 'b08-scope-scroll-v1';
// Research waits, not stable latency claims. The fixed waits mirror containers.md §6.
export const SETTLE_WAITS = [0, 25, 50, 100, 200] as const;
export const TRIALS_PER_WAIT = 6;
export const SETTLE_TRIALS = 8;
export const POLL_INTERVAL_MS = 5;
export const POLL_LIMIT_MS = 2000;
export const READBACK_WAIT_MS = 300;

export type BankState = {
  scrollPosition: number; itemCount: number; canScrollForwards: boolean; canScrollBackwards: boolean;
};
export type NestedDevice = { index: number; exists: boolean; name?: string; position?: number };
export type LayerRow = {
  index: number; exists: boolean; name?: string; solo?: boolean; channelId?: string;
  devices: BankState & { items: NestedDevice[] };
};
export type ScopeState = BankState & {
  scope: number; status: string; requestedPosition: number;
  device: { exists: boolean; name: string; position: number; hasLayers: boolean };
  layers: BankState & { items: LayerRow[] };
};
export type ScopeStatus = {
  marker: string; sequence: number; scopeCount: number; layerWindow: number; deviceWindow: number;
  context: { project: string; generation: string; trackExists: boolean; trackId: string; trackName: string; deviceCount: number };
  reference: { width: number; itemCount: number; devices: { index: number; name: string }[] };
  scopes: ScopeState[];
};
export type Container = { position: number; name: string; chains: { name: string; devices: string[] }[] };
export type Wire = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

export type Mismatch = { field: string; expected: unknown; actual: unknown };
export type SettleTrial = { target: string; position: number; nameMs: number | null; completeMs: number | null };
export type ScopeScrollVerdict = {
  verdict: 'scrollable-scope-retargets' | 'scrollable-scope-does-not-retarget';
  retarget: { outcome: 'observed' | 'refuted'; mismatches: Mismatch[]; resting: { outcome: 'observed' | 'refuted'; mismatches: Mismatch[] } };
  settle: {
    fixedWaits: { waitMs: number; correct: number; trials: number }[];
    polled: SettleTrial[]; medianNameMs: number | null; medianCompleteMs: number | null;
  };
  clamp: {
    requested: number; reportedPosition: number; canScrollForwards: boolean; deviceExists: boolean; deviceName: string;
    last: { position: number; canScrollForwards: boolean; deviceName: string };
    first: { position: number; canScrollBackwards: boolean };
  };
  nested: {
    layers: { requested: number; reportedPosition: number; itemCount: number; names: (string | undefined)[]; expected: string[]; outcome: 'observed' | 'refuted' };
    layersOverflow: { requested: number; reportedPosition: number; canScrollForwards: boolean };
    devices: { chain: string; requested: number; reportedPosition: number; itemCount: number; names: (string | undefined)[]; expected: string[]; outcome: 'observed' | 'refuted' };
  };
  guard: { immediateWrite: 'refused' | 'accepted'; message?: string; settledAfterMs: number | null };
  solo: {
    chain: string; refused?: string; independentScope: boolean | undefined; cursorRoute: boolean | undefined; siblingsUntouched: boolean;
    restored: { independentScope: boolean | undefined; cursorRoute: boolean | undefined };
    outcome: 'observed' | 'refuted';
  };
  simultaneity: { scope0: string; scope1: string; outcome: 'observed' | 'refuted' };
  cleanup: { scopePositions: number[]; soloFlags: boolean[] };
};

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/** The complete identity a settled scope must show for one container. */
export function compareScope(scope: ScopeState, container: Container, layerWindow: number, deviceWindow: number): Mismatch[] {
  const mismatches: Mismatch[] = [];
  const expect = (field: string, expected: unknown, actual: unknown) => {
    if (expected !== actual) mismatches.push({ field, expected, actual });
  };
  expect('scrollPosition', container.position, scope.scrollPosition);
  expect('device.exists', true, scope.device.exists);
  expect('device.name', container.name, scope.device.name);
  expect('device.hasLayers', true, scope.device.hasLayers);
  expect('layers.itemCount', container.chains.length, scope.layers.itemCount);
  const offset = scope.layers.scrollPosition;
  for (let i = 0; i < layerWindow; i++) {
    const chain = container.chains[offset + i];
    const row = scope.layers.items[i];
    expect(`layers[${i}].exists`, chain !== undefined, row?.exists ?? false);
    if (chain === undefined || row === undefined) continue;
    expect(`layers[${i}].name`, chain.name, row.name);
    expect(`layers[${i}].devices.itemCount`, chain.devices.length, row.devices.itemCount);
    const nestedOffset = row.devices.scrollPosition;
    for (let d = 0; d < deviceWindow; d++) {
      const expected = chain.devices[nestedOffset + d];
      const item = row.devices.items[d];
      expect(`layers[${i}].devices[${d}].exists`, expected !== undefined, item?.exists ?? false);
      if (expected !== undefined && item !== undefined) expect(`layers[${i}].devices[${d}].name`, expected, item.name);
    }
  }
  return mismatches;
}

export const scopeNameMatches = (scope: ScopeState, container: Container): boolean =>
  scope.scrollPosition === container.position && scope.device.exists && scope.device.name === container.name;

export async function runScopeScrollProbe(options: {
  wire: Wire;
  wait: (ms: number) => Promise<void>;
  now: () => number;
  record: (label: string, value: unknown) => void;
  target: { project: string; generation: string; trackId: string };
  resting: Container;
  far: Container;
}): Promise<ScopeScrollVerdict> {
  const { wire, wait, now, record, target, resting, far } = options;
  const probe = (params: Record<string, unknown>) => wire('probe.scopeScroll', { trackId: target.trackId, ...params });
  const status = async (label?: string) => {
    const value = await probe({ operation: 'status' }) as ScopeStatus;
    if (label) record(label, value);
    return value;
  };
  const scope = (value: ScopeStatus, index: number): ScopeState => {
    const found = value.scopes[index];
    if (!found || found.status !== 'held') throw new Error(`scope ${index} is not held`);
    return found;
  };

  // Entry: the probe build, the scratch target, and the reference bank must all agree.
  const entry = await status('status-entry');
  if (entry.marker !== SCOPE_MARKER) throw new Error(`probe marker ${entry.marker} is not ${SCOPE_MARKER}`);
  if (entry.scopes.length < 2 || entry.scopes.some((s) => s.status !== 'held')) throw new Error('both scopes must be held');
  if (entry.context.project !== target.project || entry.context.generation !== target.generation
      || entry.context.trackId !== target.trackId || !entry.context.trackName.startsWith('gn-b08')) {
    throw new Error('cursor track 0 is not the identified gn-b08 scratch track');
  }
  for (const container of [resting, far]) {
    const reference = entry.reference.devices.find((d) => d.index === container.position);
    if (reference?.name !== container.name) throw new Error(`reference bank does not name ${container.name} at ${container.position}`);
  }
  if (far.position < 3) throw new Error('the far container must sit at top-level position 3 or later');
  if (far.chains.length <= entry.layerWindow) throw new Error('the far container must hold more chains than the layer window');
  const deepChain = far.chains.reduce((best, chain) => chain.devices.length > best.devices.length ? chain : best, far.chains[0]!);
  if (deepChain.devices.length <= entry.deviceWindow) throw new Error('one far chain must hold more devices than the device window');
  const { layerWindow, deviceWindow } = entry;

  /** Scroll one scope and poll until its slot name, then its complete identity, match. */
  const scrollAndSettle = async (index: number, container: Container): Promise<SettleTrial> => {
    await probe({ operation: 'scroll', scope: index, position: container.position });
    const started = now();
    let nameMs: number | null = null;
    let completeMs: number | null = null;
    while (now() - started <= POLL_LIMIT_MS) {
      const current = scope(await status(), index);
      const elapsed = now() - started;
      if (nameMs === null && scopeNameMatches(current, container)) nameMs = elapsed;
      if (compareScope(current, container, layerWindow, deviceWindow).length === 0) { completeMs = elapsed; break; }
      await wait(POLL_INTERVAL_MS);
    }
    return { target: container.name, position: container.position, nameMs, completeMs };
  };

  // Q1: retarget. Scope 0 goes to the far container; scope 1 rests on position 0.
  const first = await scrollAndSettle(0, far);
  record('q1-first-settle', first);
  const afterFirst = await status('q1-status');
  const retargetMismatches = compareScope(scope(afterFirst, 0), far, layerWindow, deviceWindow);
  const restingMismatches = compareScope(scope(afterFirst, 1), resting, layerWindow, deviceWindow);
  const retarget: ScopeScrollVerdict['retarget'] = {
    outcome: retargetMismatches.length ? 'refuted' : 'observed', mismatches: retargetMismatches,
    resting: { outcome: restingMismatches.length ? 'refuted' : 'observed', mismatches: restingMismatches },
  };
  record('q1-retarget', retarget);

  // Q2: settle cost. Fixed waits as containers.md §6, each trial from a settled start, then polled trials.
  const fixedWaits: ScopeScrollVerdict['settle']['fixedWaits'] = [];
  let next = resting;
  for (const waitMs of SETTLE_WAITS) {
    let correct = 0;
    for (let trial = 0; trial < TRIALS_PER_WAIT; trial++) {
      await probe({ operation: 'scroll', scope: 0, position: next.position });
      await wait(waitMs);
      const read = scope(await status(), 0);
      if (compareScope(read, next, layerWindow, deviceWindow).length === 0) correct++;
      // Settle before the next trial so each measures one scroll, not a backlog.
      await scrollAndSettle(0, next);
      next = next === resting ? far : resting;
    }
    fixedWaits.push({ waitMs, correct, trials: TRIALS_PER_WAIT });
    record(`q2-wait-${waitMs}`, fixedWaits[fixedWaits.length - 1]);
  }
  const polled: SettleTrial[] = [];
  for (let trial = 0; trial < SETTLE_TRIALS; trial++) {
    polled.push(await scrollAndSettle(0, next));
    next = next === resting ? far : resting;
  }
  record('q2-polled', polled);
  const settle: ScopeScrollVerdict['settle'] = {
    fixedWaits, polled,
    medianNameMs: median(polled.flatMap((t) => t.nameMs === null ? [] : [t.nameMs])),
    medianCompleteMs: median(polled.flatMap((t) => t.completeMs === null ? [] : [t.completeMs])),
  };

  // Q3: clamping past the item count, then the last and first positions.
  const overflow = 40;
  await probe({ operation: 'scroll', scope: 0, position: overflow });
  await wait(READBACK_WAIT_MS);
  const clamped = scope(await status('q3-overflow'), 0);
  const lastPosition = entry.reference.itemCount - 1;
  await probe({ operation: 'scroll', scope: 0, position: lastPosition });
  await wait(READBACK_WAIT_MS);
  const last = scope(await status('q3-last'), 0);
  await probe({ operation: 'scroll', scope: 0, position: 0 });
  await wait(READBACK_WAIT_MS);
  const atFirst = scope(await status('q3-first'), 0);
  const clamp: ScopeScrollVerdict['clamp'] = {
    requested: overflow, reportedPosition: clamped.scrollPosition, canScrollForwards: clamped.canScrollForwards,
    deviceExists: clamped.device.exists, deviceName: clamped.device.name,
    last: { position: last.scrollPosition, canScrollForwards: last.canScrollForwards, deviceName: last.device.name },
    first: { position: atFirst.scrollPosition, canScrollBackwards: atFirst.canScrollBackwards },
  };
  record('q3-clamp', clamp);

  // Q4: nested windows on the far container.
  await scrollAndSettle(0, far);
  const layerOffset = far.chains.length - layerWindow;
  await probe({ operation: 'scrollLayers', scope: 0, position: layerOffset });
  await wait(READBACK_WAIT_MS);
  const layersScrolled = scope(await status('q4-layers'), 0);
  const layerNames = layersScrolled.layers.items.map((row) => row.exists ? row.name : undefined);
  const expectedLayerNames = far.chains.slice(layerOffset, layerOffset + layerWindow).map((c) => c.name);
  const layersOutcome = layersScrolled.layers.scrollPosition === layerOffset
    && layersScrolled.layers.itemCount === far.chains.length
    && JSON.stringify(layerNames.filter((n) => n !== undefined)) === JSON.stringify(expectedLayerNames) ? 'observed' : 'refuted';
  await probe({ operation: 'scrollLayers', scope: 0, position: 10 });
  await wait(READBACK_WAIT_MS);
  const layersOverflow = scope(await status('q4-layers-overflow'), 0);
  await probe({ operation: 'scrollLayers', scope: 0, position: 0 });
  await scrollAndSettle(0, far);
  const deepIndex = far.chains.indexOf(deepChain);
  if (deepIndex >= layerWindow) throw new Error('the deep chain must sit inside the resting layer window');
  const deviceOffset = deepChain.devices.length - deviceWindow;
  await probe({ operation: 'scrollDevices', scope: 0, layerIndex: deepIndex, position: deviceOffset });
  await wait(READBACK_WAIT_MS);
  const devicesScrolled = scope(await status('q4-devices'), 0).layers.items[deepIndex]!.devices;
  const deviceNames = devicesScrolled.items.map((item) => item.exists ? item.name : undefined);
  const expectedDeviceNames = deepChain.devices.slice(deviceOffset, deviceOffset + deviceWindow);
  const devicesOutcome = devicesScrolled.scrollPosition === deviceOffset && devicesScrolled.itemCount === deepChain.devices.length
    && JSON.stringify(deviceNames.filter((n) => n !== undefined)) === JSON.stringify(expectedDeviceNames) ? 'observed' : 'refuted';
  await probe({ operation: 'scrollDevices', scope: 0, layerIndex: deepIndex, position: 0 });
  await scrollAndSettle(0, far);
  const nested: ScopeScrollVerdict['nested'] = {
    layers: { requested: layerOffset, reportedPosition: layersScrolled.layers.scrollPosition, itemCount: layersScrolled.layers.itemCount,
      names: layerNames, expected: expectedLayerNames, outcome: layersOutcome },
    layersOverflow: { requested: 10, reportedPosition: layersOverflow.layers.scrollPosition, canScrollForwards: layersOverflow.layers.canScrollForwards },
    devices: { chain: deepChain.name, requested: deviceOffset, reportedPosition: devicesScrolled.scrollPosition, itemCount: devicesScrolled.itemCount,
      names: deviceNames, expected: expectedDeviceNames, outcome: devicesOutcome },
  };
  record('q4-nested', nested);

  // Q6: the guard must fail closed against a scope that has not settled.
  await probe({ operation: 'scroll', scope: 0, position: resting.position });
  const guardStarted = now();
  let guard: ScopeScrollVerdict['guard'];
  try {
    const receipt = await probe({ operation: 'setSolo', scope: 0, layerIndex: 0, solo: false,
      expectedContainerName: resting.name, expectedChainName: resting.chains[0]!.name, expectedTrackChannelId: target.trackId });
    record('q6-accepted', receipt);
    guard = { immediateWrite: 'accepted', settledAfterMs: now() - guardStarted };
  } catch (error) {
    guard = { immediateWrite: 'refused', message: String(error), settledAfterMs: null };
  }
  const guardSettle = await scrollAndSettle(0, resting);
  if (guard.settledAfterMs === null) guard.settledAfterMs = guardSettle.completeMs;
  record('q6-guard', guard);

  // Q5: one solo through scope 0 at the far container, read back through scope 1 and the cursor route.
  const soloChain = far.chains[1] ?? far.chains[0]!;
  const soloIndex = far.chains.indexOf(soloChain);
  await scrollAndSettle(0, far);
  await scrollAndSettle(1, far);
  let soloRefusal: string | undefined;
  try {
    const soloWrite = await probe({ operation: 'setSolo', scope: 0, layerIndex: soloIndex, solo: true,
      expectedContainerName: far.name, expectedChainName: soloChain.name, expectedTrackChannelId: target.trackId });
    record('q5-write', soloWrite);
  } catch (error) {
    // A scope that never settled refuses the write; the readbacks below then show nothing changed.
    soloRefusal = String(error);
    record('q5-write-refused', { error: soloRefusal });
  }
  await wait(READBACK_WAIT_MS);
  const independent = scope(await status('q5-readback-scope1'), 1);
  const independentSolo = independent.layers.items[soloIndex]?.solo;
  const siblingsUntouched = independent.layers.items.every((row, i) => !row.exists || i === soloIndex || row.solo === false);
  await wire('devcursor.selectAt', { deviceIndex: far.position });
  await wait(READBACK_WAIT_MS);
  const cursorList = await wire('layer.list') as { layers: { name: string; solo?: boolean }[] };
  record('q5-readback-cursor', cursorList);
  const cursorSolo = cursorList.layers.find((row) => row.name === soloChain.name)?.solo;
  if (soloRefusal === undefined) {
    const restore = await probe({ operation: 'setSolo', scope: 0, layerIndex: soloIndex, solo: false,
      expectedContainerName: far.name, expectedChainName: soloChain.name, expectedTrackChannelId: target.trackId });
    record('q5-restore', restore);
    await wait(READBACK_WAIT_MS);
  }
  const restoredScope = scope(await status('q5-restored-scope1'), 1).layers.items[soloIndex]?.solo;
  const restoredCursor = (await wire('layer.list') as { layers: { name: string; solo?: boolean }[] }).layers
    .find((row) => row.name === soloChain.name)?.solo;
  await wire('devcursor.selectAt', { deviceIndex: 0 });
  const solo: ScopeScrollVerdict['solo'] = {
    chain: soloChain.name, ...(soloRefusal === undefined ? {} : { refused: soloRefusal }),
    independentScope: independentSolo, cursorRoute: cursorSolo, siblingsUntouched,
    restored: { independentScope: restoredScope, cursorRoute: restoredCursor },
    outcome: independentSolo === true && cursorSolo === true && siblingsUntouched && restoredScope === false && restoredCursor === false
      ? 'observed' : 'refuted',
  };
  record('q5-solo', solo);

  // Two scopes at two containers in one read.
  await scrollAndSettle(1, resting);
  const both = await status('simultaneity');
  const simultaneity: ScopeScrollVerdict['simultaneity'] = {
    scope0: scope(both, 0).device.name, scope1: scope(both, 1).device.name,
    outcome: compareScope(scope(both, 0), far, layerWindow, deviceWindow).length === 0
      && compareScope(scope(both, 1), resting, layerWindow, deviceWindow).length === 0 ? 'observed' : 'refuted',
  };
  record('simultaneity', simultaneity);

  // Cleanup: both scopes rest at position 0; no solo remains set.
  await scrollAndSettle(0, resting);
  await wait(READBACK_WAIT_MS);
  const exit = await status('status-exit');
  const cleanup: ScopeScrollVerdict['cleanup'] = {
    scopePositions: exit.scopes.map((s) => s.scrollPosition),
    soloFlags: exit.scopes.flatMap((s) => s.layers.items.filter((row) => row.exists).map((row) => row.solo === true)),
  };
  const verdict: ScopeScrollVerdict = {
    verdict: retarget.outcome === 'observed' && solo.outcome === 'observed' && simultaneity.outcome === 'observed'
      ? 'scrollable-scope-retargets' : 'scrollable-scope-does-not-retarget',
    retarget, settle, clamp, nested, guard, solo, simultaneity, cleanup,
  };
  return verdict;
}
