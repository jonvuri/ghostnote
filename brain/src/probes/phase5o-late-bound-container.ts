/** Live proof for late-bound modulation from Chain and layer containers. */
import { createHash } from 'node:crypto';
import {
  existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  addModulator, listModulators, loadDonor, readMeta, stubValues, validate,
} from '../bwmod/index.js';
import {
  NATIVE_CATALOG_PATH, OWNED_FX_LAYER_TEMPLATE_PATH,
  OWNED_LAYER_MANIFEST_PATH, OWNED_LAYER_TEMPLATE_PATH,
  composeOwnedTemplate,
  type OwnedTemplateManifest,
} from '../composition/index.js';
import type { NativeCatalog } from '../native-catalog/catalog.js';
import { check, client, failureCount, note, pollUntil } from './lib.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHAIN_DEFAULT = '/Applications/Bitwig Studio.app/Contents/Resources/Library/'
  + 'device-settings/c86d21fb-d544-4daf-a1bf-57de22aa320c/Default.bwpreset';
const POLYSYNTH = join(ROOT, 'fixtures', 'Polysynth', 'mp_bare.bwpreset');
const ZEBRA_VST3 = join(ROOT, 'fixtures', 'Zebra3', 'gn_zebra3vst_bare.bwpreset');
const TRACK_NAME = 'gn-p5o-late-bound';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const req = (method: string, params: Record<string, unknown> = {}) =>
  client.request(method, params);

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly position: number;
  readonly type: string;
  readonly channelId: string;
}

interface DeviceRow {
  readonly index: number;
  readonly name: string;
  readonly enabled: boolean;
}

interface DirectParameterRow {
  readonly id: string;
  readonly name: string;
  readonly value: number;
}

interface DirectInventory {
  readonly params: readonly DirectParameterRow[];
  readonly count: number;
  readonly generation: number;
  readonly idsGeneration: number;
  readonly deviceExists: boolean;
  readonly deviceName: string;
  readonly trackChannelId: string;
  readonly observedTrackChannelId?: string;
  readonly observedDeviceName?: string;
}

interface ParamList {
  readonly params: readonly {
    readonly id: string;
    readonly exists: boolean;
    readonly value?: number;
    readonly modulatedValue?: number;
    readonly hasAutomation?: boolean;
  }[];
  readonly deviceExists: boolean;
  readonly deviceName: string;
}

interface ChainInventory {
  readonly trackChannelId?: string;
  readonly scopes: readonly {
    readonly slot: number;
    readonly status: string;
    readonly deviceName?: string;
    readonly chains: readonly {
      readonly index: number;
      readonly name?: string;
      readonly devices: readonly DeviceRow[];
      readonly deviceCount: number;
    }[];
  }[];
}

interface CaseSpec {
  readonly label: string;
  readonly container: 'Chain' | 'FX Layer' | 'Instrument Layer';
  readonly shape: 'slot-empty' | 'layer-empty' | 'layer-placeholder';
  readonly preset: string;
  readonly chainName?: string;
  readonly sourceChainName?: string;
  readonly candidate: string;
  readonly candidateName: 'Polysynth' | 'Zebra3';
  readonly directParameterId: 'CONTENTS/F1FREQ' | 'CONTENTS/PID411';
  readonly typedParameterId: 'F1FREQ' | 'PID411';
  readonly expectActive: boolean;
  readonly inactiveReason?: string;
  readonly expectMoveUnsupported?: boolean;
}

const tracks = async (): Promise<readonly TrackRow[]> =>
  ((await req('track.list')) as { readonly tracks: readonly TrackRow[] }).tracks;

function sameTracks(left: readonly TrackRow[], right: readonly TrackRow[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

async function resolveTrack(channelId: string): Promise<TrackRow | undefined> {
  return (await tracks()).find((row) => row.channelId === channelId);
}

async function pointTrack(channelId: string): Promise<TrackRow> {
  const row = await resolveTrack(channelId);
  if (row === undefined) throw new Error('the owned track is absent');
  await req('cursor.pointTrack', { cursor: '0', trackIndex: row.index });
  const settled = await pollUntil(async () => {
    const list = await req('device.list', { cursor: '0' }) as { readonly trackChannelId: string };
    return list.trackChannelId === channelId;
  }, 6_000, 100);
  if (!settled.ok) throw new Error('the device bank did not reach the owned track');
  return row;
}

async function topDevices(channelId: string): Promise<readonly DeviceRow[]> {
  await pointTrack(channelId);
  let prior: string | undefined;
  let last: readonly DeviceRow[] = [];
  const settled = await pollUntil(async () => {
    const reply = await req('device.list', { cursor: '0' }) as {
      readonly devices: readonly DeviceRow[];
      readonly count: number;
      readonly itemCount: number;
      readonly trackChannelId: string;
    };
    if (reply.trackChannelId !== channelId
        || reply.count !== reply.itemCount
        || reply.devices.length !== reply.itemCount) return false;
    last = reply.devices;
    const signature = JSON.stringify(reply.devices);
    const stable = signature === prior;
    prior = signature;
    return stable;
  }, 8_000, 120);
  if (!settled.ok) throw new Error('the complete top-level device chain did not settle');
  return last;
}

async function insertPreset(
  channelId: string,
  path: string,
  before: readonly DeviceRow[],
): Promise<readonly DeviceRow[]> {
  await req('device.insertFile', {
    cursor: 0,
    path,
    expectedTrackChannelId: channelId,
    expectedDeviceNames: before.map((item) => item.name),
    expectedDeviceEnabled: before.map((item) => item.enabled),
  });
  const settled = await pollUntil(async () => (await topDevices(channelId)).length === before.length + 1,
    15_000, 180);
  if (!settled.ok) throw new Error(`preset insertion did not settle: ${path}`);
  return topDevices(channelId);
}

async function selectTop(channelId: string, index: number, name: string): Promise<void> {
  await pointTrack(channelId);
  await req('devcursor.selectAt', { deviceIndex: index });
  const selected = await pollUntil(async () => {
    const status = await req('devcursor.status') as {
      readonly exists: boolean;
      readonly name: string;
      readonly isNested: boolean;
    };
    return status.exists && !status.isNested && status.name === name;
  }, 6_000, 100);
  if (!selected.ok) throw new Error(`the device cursor did not select top-level ${name}`);
}

async function selectNested(
  channelId: string,
  shape: CaseSpec['shape'],
  containerName: CaseSpec['container'],
  expectedName: string,
): Promise<{ readonly enabled: boolean }> {
  await selectTop(channelId, 0, containerName);
  if (shape === 'slot-empty') {
    await req('devcursor.selectFirstInSlot', { slot: 'CHAIN' });
  } else {
    await req('devcursor.selectFirstInLayer', { layerIndex: 0 });
  }
  let last: { readonly enabled: boolean } | undefined;
  const selected = await pollUntil(async () => {
    const status = await req('devcursor.status') as {
      readonly exists: boolean;
      readonly name: string;
      readonly enabled: boolean;
      readonly isNested: boolean;
    };
    if (status.exists && status.isNested && status.name === expectedName) {
      last = { enabled: status.enabled };
      return true;
    }
    return false;
  }, 8_000, 120);
  if (!selected.ok || last === undefined) {
    throw new Error(`the device cursor did not reach nested ${expectedName}`);
  }
  return last;
}

async function directInventory(
  select: () => Promise<void>,
  expectedName: string,
  expectedTrackId: string,
  timeoutMs: number,
): Promise<{ readonly rows: readonly DirectParameterRow[]; readonly elapsedMs: number }> {
  const begun = await req('directparam.list', { begin: true }) as DirectInventory;
  const started = Date.now();
  await select();
  let prior: string | undefined;
  let rows: readonly DirectParameterRow[] = [];
  const acquired = await pollUntil(async () => {
    const reply = await req('directparam.list', { generation: begun.generation }) as DirectInventory;
    const complete = reply.generation === begun.generation
      && reply.idsGeneration === begun.generation
      && reply.deviceExists
      && reply.deviceName === expectedName
      && reply.trackChannelId === expectedTrackId
      && reply.observedTrackChannelId === expectedTrackId
      && reply.observedDeviceName === expectedName
      && reply.params.length > 0
      && reply.params.length === reply.count
      && new Set(reply.params.map((item) => item.id)).size === reply.params.length
      && reply.params.every((item) => typeof item.id === 'string'
        && typeof item.name === 'string'
        && typeof item.value === 'number'
        && Number.isFinite(item.value));
    if (!complete) return false;
    rows = reply.params;
    const signature = JSON.stringify(reply.params);
    const stable = signature === prior;
    prior = signature;
    return stable;
  }, timeoutMs, 150);
  if (!acquired.ok) throw new Error(`the complete ${expectedName} parameter inventory did not settle`);
  return { rows, elapsedMs: Date.now() - started };
}

function parameterFingerprint(rows: readonly DirectParameterRow[]): string {
  const stable = rows.map((item) => [item.id, item.name, item.value.toFixed(10)]);
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

async function outerPageBeforeMove(channelId: string, containerName: string): Promise<boolean> {
  const begun = await req('remote.list', { begin: true }) as { readonly generation: number };
  await selectTop(channelId, 0, containerName);
  const ready = await pollUntil(async () => {
    const reply = await req('remote.list', { generation: begun.generation }) as {
      readonly generation: number;
      readonly observedGeneration: number;
      readonly deviceName: string;
      readonly pagesComplete: boolean;
      readonly pageNames: readonly string[];
    };
    return reply.generation === begun.generation
      && reply.observedGeneration === begun.generation
      && reply.deviceName === containerName
      && reply.pagesComplete
      && reply.pageNames.filter((name) => name === 'LFO').length === 1;
  }, 8_000, 120);
  return ready.ok;
}

async function emptyLayerTarget(
  channelId: string,
  containerName: string,
): Promise<ChainInventory['scopes'][number] | undefined> {
  await pointTrack(channelId);
  let observed: ChainInventory['scopes'][number] | undefined;
  const ready = await pollUntil(async () => {
    const reply = await req('chain.inventory') as ChainInventory;
    const scope = reply.scopes.find((item) => item.slot === 0);
    const entry = scope?.chains.find((item) => item.index === 0);
    if (reply.trackChannelId !== channelId
        || scope?.status !== 'held'
        || scope.deviceName !== containerName
        || entry?.devices.length !== 0
        || entry.deviceCount !== 0) return false;
    observed = scope;
    return true;
  }, 8_000, 120);
  return ready.ok ? observed : undefined;
}

async function behavior(
  select: () => Promise<void>,
  deviceName: string,
  parameterId: string,
): Promise<{
  readonly maximumDivergence: number;
  readonly baseSpread: number;
  readonly automation: readonly boolean[];
}> {
  await select();
  const samples: { readonly value: number; readonly modulated: number; readonly automation: boolean }[] = [];
  for (let sample = 0; sample < 14; sample++) {
    const reply = await req('param.list') as ParamList;
    const row = reply.params.find((item) => item.id === parameterId && item.exists);
    if (reply.deviceExists && reply.deviceName === deviceName
        && row?.value !== undefined && row.modulatedValue !== undefined) {
      samples.push({
        value: row.value,
        modulated: row.modulatedValue,
        automation: row.hasAutomation === true,
      });
    }
    await wait(80);
  }
  if (samples.length < 10) throw new Error(`the ${deviceName} behavior witness is incomplete`);
  const bases = samples.map((sample) => sample.value);
  return {
    maximumDivergence: Math.max(...samples.map((sample) =>
      Math.abs(sample.modulated - sample.value))),
    baseSpread: Math.max(...bases) - Math.min(...bases),
    automation: samples.map((sample) => sample.automation),
  };
}

function targetRoute(container: CaseSpec['container'], position: number, tail: string): string {
  if (container === 'Chain') {
    return `CONTENTS/DEVICE_CHAIN/Chain/DEVICE_CHAIN/${position}:${tail}`;
  }
  return `CONTENTS/CHAIN_LIST/CHAIN0/DEVICE_CHAIN/${position}:${tail}`;
}

function buildEmptySeed(templatePath: string, target: string): Buffer {
  const source = readFileSync(templatePath);
  const donor = loadDonor('lfo-sampler');
  const preset = addModulator(source, donor, { target, amount: 1 }, { listIndex: 0 });
  const checked = validate(preset, { reference: source, listIndex: 0 });
  if (!checked.ok) throw new Error(`empty seed validation failed: ${checked.problems.join('; ')}`);
  const modulator = listModulators(preset, 0)[0];
  if (modulator?.deviceName !== 'LFO' || modulator.routing?.target !== target) {
    throw new Error('the empty seed did not read back its exact LFO route');
  }
  return preset;
}

function buildInstrumentSeed(target: string): Buffer {
  const source = readFileSync(OWNED_LAYER_TEMPLATE_PATH);
  const manifest = JSON.parse(
    readFileSync(OWNED_LAYER_MANIFEST_PATH, 'utf8'),
  ) as OwnedTemplateManifest;
  const catalog = JSON.parse(readFileSync(NATIVE_CATALOG_PATH, 'utf8')) as NativeCatalog;
  const composed = composeOwnedTemplate(source, manifest, catalog, [{ deviceName: 'Polysynth' }]);
  const donor = loadDonor('lfo-sampler');
  const preset = addModulator(
    composed.preset, donor, { target, amount: 1 }, { listIndex: 0 },
  );
  const checked = validate(preset, { reference: composed.preset, listIndex: 0 });
  if (!checked.ok) throw new Error(`placeholder seed validation failed: ${checked.problems.join('; ')}`);
  return preset;
}

async function clearTrack(channelId: string): Promise<void> {
  for (let guard = 0; guard < 12; guard++) {
    const devices = await topDevices(channelId);
    if (devices.length === 0) return;
    const victim = devices[devices.length - 1]!;
    await req('device.delete', {
      cursor: 0,
      deviceIndex: victim.index,
      expectedTrackChannelId: channelId,
      expectedDeviceNames: devices.map((item) => item.name),
      expectedDeviceEnabled: devices.map((item) => item.enabled),
      expectedName: victim.name,
    });
    await pollUntil(async () => (await topDevices(channelId)).length === devices.length - 1,
      8_000, 150);
  }
  throw new Error('owned-track cleanup exceeded its guard');
}

async function runCase(channelId: string, spec: CaseSpec): Promise<void> {
  await clearTrack(channelId);
  let top = await insertPreset(channelId, spec.preset, []);
  check(`${spec.label}: the outer LFO page exists before the device move`,
    await outerPageBeforeMove(channelId, spec.container));
  if (spec.shape === 'layer-empty') {
    const emptyTarget = await emptyLayerTarget(channelId, spec.container);
    check(`${spec.label}: target position 0 is empty before the move`,
      emptyTarget !== undefined, emptyTarget);
  }

  if (spec.shape === 'layer-placeholder') {
    const placeholder = await behavior(
      async () => { await selectNested(channelId, spec.shape, spec.container, 'Polysynth'); },
      'Polysynth',
      'F1FREQ',
    );
    check(`${spec.label}: the route is active on the exact-position placeholder`,
      placeholder.maximumDivergence > 0
        && placeholder.baseSpread <= 2e-3
        && placeholder.automation.every((value) => value === false),
      placeholder);
  }

  top = await insertPreset(channelId, spec.candidate, top);
  const candidateBefore = top[1];
  if (candidateBefore?.name !== spec.candidateName) {
    throw new Error(`${spec.label}: candidate inserted as ${candidateBefore?.name ?? 'nothing'}`);
  }
  if (spec.shape === 'layer-placeholder') {
    await selectTop(channelId, 0, spec.container);
    await wait(300);
  }
  const cold = await directInventory(
    () => selectTop(channelId, 1, spec.candidateName),
    spec.candidateName,
    channelId,
    spec.candidateName === 'Zebra3' ? 18_000 : 8_000,
  );
  const beforeFingerprint = parameterFingerprint(cold.rows);

  if (spec.shape === 'layer-placeholder') {
    await pointTrack(channelId);
    await req('chain.move', {
      src: 'chain',
      srcSlot: 0,
      srcLayer: 0,
      srcDevice: 0,
      dst: 'top',
      where: 'chainEnd',
      verb: 'move',
      expectedTrackChannelId: channelId,
      expectedSourceChain: spec.sourceChainName,
      expectedSourceName: 'Polysynth',
    });
    const opened = await pollUntil(async () => (await topDevices(channelId)).length === 3,
      8_000, 150);
    if (!opened.ok) throw new Error(`${spec.label}: the placeholder did not leave its entry`);
  }

  top = await topDevices(channelId);
  const candidateIndex = top.find((item) => item.name === spec.candidateName)?.index;
  if (candidateIndex === undefined) throw new Error(`${spec.label}: candidate is not top-level before the move`);
  if (spec.shape === 'slot-empty') {
    await selectTop(channelId, 0, spec.container);
    await req('devcursor.selectFirstInSlot', { slot: 'CHAIN' });
    await wait(300);
    try {
      await req('device.moveIntoSlot', {
        cursor: 0,
        sourceDeviceIndex: candidateIndex,
        expectedSourceName: spec.candidateName,
        expectedContainerName: spec.container,
        expectedSlotName: 'CHAIN',
        expectedTrackChannelId: channelId,
        expectedDeviceNames: top.map((item) => item.name),
        expectedDeviceEnabled: top.map((item) => item.enabled),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (spec.expectMoveUnsupported
          && message.includes('selected slot is not "CHAIN"')) {
        const afterRefusal = await topDevices(channelId);
        check(`${spec.label}: the host refuses relocation into an empty named slot without residue`,
          JSON.stringify(afterRefusal) === JSON.stringify(top), { message, devices: afterRefusal });
        return;
      }
      throw error;
    }
    if (spec.expectMoveUnsupported) {
      check(`${spec.label}: the host refuses relocation into an empty named slot`, false,
        'the previously unavailable slot became writable');
      return;
    }
  } else {
    await pointTrack(channelId);
    await req('chain.move', {
      src: 'top',
      srcDevice: candidateIndex,
      dst: 'chain',
      dstSlot: 0,
      dstLayer: 0,
      verb: 'move',
      expectedTrackChannelId: channelId,
      expectedSourceName: spec.candidateName,
      expectedDestinationChain: spec.shape === 'layer-placeholder' ? 'Layer 1' : spec.chainName,
    });
  }

  const moved = await pollUntil(async () => {
    const current = await topDevices(channelId);
    if (spec.shape === 'layer-placeholder') {
      return current.length === 2
        && current[0]?.name === spec.container
        && current[1]?.name === 'Polysynth';
    }
    return !current.some((item) => item.name === spec.candidateName);
  }, 10_000, 150);
  if (!moved.ok) throw new Error(`${spec.label}: candidate did not leave the top-level chain`);

  const nestedSelect = () => selectNested(
    channelId, spec.shape, spec.container, spec.candidateName,
  );
  const nestedState = await nestedSelect();
  const after = await directInventory(
    async () => { await nestedSelect(); },
    spec.candidateName,
    channelId,
    spec.candidateName === 'Zebra3' ? 18_000 : 8_000,
  );
  const sameIdsAndNames = JSON.stringify(after.rows.map((item) => [item.id, item.name]))
    === JSON.stringify(cold.rows.map((item) => [item.id, item.name]));
  const afterFingerprint = parameterFingerprint(after.rows);
  check(`${spec.label}: the moved instance keeps name, enabled state, complete ids, and base fingerprint`,
    nestedState.enabled === candidateBefore.enabled
      && after.rows.length === cold.rows.length
      && sameIdsAndNames
      && afterFingerprint === beforeFingerprint,
    {
      name: spec.candidateName,
      enabledBefore: candidateBefore.enabled,
      enabledAfter: nestedState.enabled,
      parameterCount: after.rows.length,
      beforeFingerprint,
      afterFingerprint,
      coldInventoryMs: cold.elapsedMs,
      nestedInventoryMs: after.elapsedMs,
    });

  const routeParameter = after.rows.find((item) => item.id === spec.directParameterId);
  check(`${spec.label}: the current DirectParameter name is present after the move`,
    routeParameter !== undefined,
    routeParameter);
  const live = await behavior(
    async () => { await nestedSelect(); },
    spec.candidateName,
    spec.typedParameterId,
  );
  const behaviorPassed = spec.expectActive
    ? live.maximumDivergence > 0
    : live.maximumDivergence === 0;
  check(`${spec.label}: the route is ${spec.expectActive ? 'active'
    : (spec.inactiveReason ?? 'inactive as the negative control')}`,
    behaviorPassed
      && live.baseSpread <= 2e-3
      && live.automation.every((value) => value === false),
    live);
}

let entryTracks: readonly TrackRow[] = [];
let ownedTrackId: string | undefined;
const tempDir = mkdtempSync(join(tmpdir(), 'ghostnote-p5o-'));

try {
  for (const path of [CHAIN_DEFAULT, OWNED_FX_LAYER_TEMPLATE_PATH, POLYSYNTH, ZEBRA_VST3]) {
    if (!existsSync(path)) throw new Error(`required live fixture is absent: ${path}`);
  }
  await client.connect();
  entryTracks = await tracks();
  const hello = await req('contract.hello') as { readonly methodCount: number; readonly methodsHash: string };
  note(`wire ${hello.methodCount} methods, hash ${hello.methodsHash}`);

  await req('track.create', { position: entryTracks.length });
  const created = await pollUntil(async () => (await tracks()).length === entryTracks.length + 1,
    6_000, 100);
  if (!created.ok) throw new Error('the owned track did not appear');
  const entryIds = new Set(entryTracks.map((row) => row.channelId));
  const owned = (await tracks()).find((row) => !entryIds.has(row.channelId));
  if (owned === undefined) throw new Error('the owned track has no fresh identity');
  ownedTrackId = owned.channelId;
  await req('track.setName', { trackIndex: owned.index, name: TRACK_NAME });
  await pointTrack(ownedTrackId);

  const nativeTail = 'CONTENTS/F1FREQ';
  const pluginTail = 'CONTENTS/ROOT_GENERIC_MODULE/PID411';
  const seeds = [
    {
      name: 'fx-native',
      bytes: buildEmptySeed(OWNED_FX_LAYER_TEMPLATE_PATH, targetRoute('FX Layer', 0, nativeTail)),
    },
    {
      name: 'fx-plugin',
      bytes: buildEmptySeed(OWNED_FX_LAYER_TEMPLATE_PATH, targetRoute('FX Layer', 0, pluginTail)),
    },
    {
      name: 'fx-wrong-position',
      bytes: buildEmptySeed(OWNED_FX_LAYER_TEMPLATE_PATH, targetRoute('FX Layer', 1, nativeTail)),
    },
    {
      name: 'chain-native',
      bytes: buildEmptySeed(CHAIN_DEFAULT, targetRoute('Chain', 0, nativeTail)),
    },
    {
      name: 'instrument-native',
      bytes: buildInstrumentSeed(targetRoute('Instrument Layer', 0, nativeTail)),
    },
  ].map((seed) => {
    const path = join(tempDir, `${seed.name}.bwpreset`);
    writeFileSync(path, seed.bytes);
    const meta = readMeta(seed.bytes);
    note(`${seed.name} sha256=${createHash('sha256').update(seed.bytes).digest('hex')}`
      + ` bytes=${seed.bytes.length} sourceBitwig=${String(meta.get('application_version_name'))}`
      + ` targetSlot=0 externalFiles=${(meta.get('referenced_packaged_file_ids') as unknown[]).length}`
      + ` referenceStubs=${stubValues(seed.bytes).length}`);
    return { ...seed, path };
  });
  const pathOf = (name: string) => seeds.find((seed) => seed.name === name)!.path;

  const cases: readonly CaseSpec[] = [
    {
      label: '5o-FX-native',
      container: 'FX Layer',
      shape: 'layer-empty',
      preset: pathOf('fx-native'),
      chainName: 'Layer 1',
      candidate: POLYSYNTH,
      candidateName: 'Polysynth',
      directParameterId: 'CONTENTS/F1FREQ',
      typedParameterId: 'F1FREQ',
      expectActive: true,
    },
    {
      label: '5o-FX-plugin',
      container: 'FX Layer',
      shape: 'layer-empty',
      preset: pathOf('fx-plugin'),
      chainName: 'Layer 1',
      candidate: ZEBRA_VST3,
      candidateName: 'Zebra3',
      directParameterId: 'CONTENTS/PID411',
      typedParameterId: 'PID411',
      expectActive: true,
    },
    {
      label: '5o-negative-position',
      container: 'FX Layer',
      shape: 'layer-empty',
      preset: pathOf('fx-wrong-position'),
      chainName: 'Layer 1',
      candidate: POLYSYNTH,
      candidateName: 'Polysynth',
      directParameterId: 'CONTENTS/F1FREQ',
      typedParameterId: 'F1FREQ',
      expectActive: false,
    },
    {
      label: '5o-Chain-native',
      container: 'Chain',
      shape: 'slot-empty',
      preset: pathOf('chain-native'),
      candidate: POLYSYNTH,
      candidateName: 'Polysynth',
      directParameterId: 'CONTENTS/F1FREQ',
      typedParameterId: 'F1FREQ',
      expectActive: true,
      expectMoveUnsupported: true,
    },
    {
      label: '5o-Instrument-Layer-placeholder',
      container: 'Instrument Layer',
      shape: 'layer-placeholder',
      preset: pathOf('instrument-native'),
      chainName: 'Layer 1',
      sourceChainName: 'Polysynth',
      candidate: POLYSYNTH,
      candidateName: 'Polysynth',
      directParameterId: 'CONTENTS/F1FREQ',
      typedParameterId: 'F1FREQ',
      expectActive: false,
      inactiveReason: 'inactive after placeholder replacement',
    },
  ];

  for (const spec of cases) {
    try {
      await runCase(ownedTrackId, spec);
    } catch (error) {
      check(`${spec.label}: the live arm completed`, false,
        error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    } finally {
      await clearTrack(ownedTrackId);
    }
  }
} catch (error) {
  check('5o-LX: the focused live proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (ownedTrackId !== undefined) {
    try {
      await clearTrack(ownedTrackId);
      const row = await resolveTrack(ownedTrackId);
      if (row !== undefined) {
        await req('track.delete', { trackIndex: row.index });
        await pollUntil(async () => (await resolveTrack(ownedTrackId!)) === undefined, 6_000, 100);
      }
    } catch (error) {
      check('5o-cleanup: owned-state cleanup completed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await tracks();
    check('5o-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5o-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  rmSync(tempDir, { recursive: true, force: true });
  client.disconnect();
}

console.log(failureCount() === 0 ? '\nPhase 5o: ALL PASS' : `\nPhase 5o: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
