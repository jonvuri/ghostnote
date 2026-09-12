/** D03 live probe for direct plug-in preset files and popup-browser commits. */
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { BridgeClient } from '../client.js';
import { check, failureCount, note, pollUntil } from './lib.js';
import { directRouteVerdict } from './d03-preset-loading-lib.js';

const SOURCES = {
  bwpreset: {
    path: '/Users/jonvuri/Development/ghostnote/brain/fixtures/Sampler/gn_sampler_bare.bwpreset',
    resultName: 'gn_sampler_bare',
    device: 'Sampler',
  },
  h2p: {
    path: '/Users/jonvuri/Library/Audio/Presets/u-he/Repro-5/Zensound/'
      + 'Zensound - Netrunner Repro-5/Presets/ZenSound - Netrunner/KEY Peace Flute.h2p',
    resultName: 'KEY Peace Flute',
    device: 'Repro-5',
  },
  fxp: {
    path: '/Users/jonvuri/Library/Audio/Presets/u-he/Filterscape/'
      + 'Patchpool - Edgy Scapes/Heavenly Waves var (Straight).fxp',
    resultName: 'Heavenly Waves var (Straight)',
    device: 'Filterscape',
  },
  vstpreset: {
    path: '/Library/Audio/Presets/Softube/Weiss Compressor Limiter/'
      + 'BK Natural Setup Stereo Linked Ganged.vstpreset',
    resultName: 'BK Natural Setup Stereo Linked Ganged',
    device: 'Weiss Compressor Limiter',
  },
} as const;

type Format = keyof typeof SOURCES;
type TrackRow = {
  readonly index: number;
  readonly name: string;
  readonly position: number;
  readonly type: string;
  readonly channelId: string;
};
type DeviceRow = { readonly index: number; readonly name: string; readonly enabled: boolean };
type DirectRow = { readonly id: string; readonly name: string | null; readonly value?: number };
type BrowserItem = { readonly index: number; readonly name: string; readonly selected: boolean };
type BrowserFilter = {
  readonly key: string;
  readonly entryCount: number;
  readonly scrollPosition: number;
  readonly wildcard: { readonly name: string; readonly selected: boolean };
  readonly items: readonly (BrowserItem & { readonly hitCount: number })[];
};
type BrowserStatus = {
  readonly exists: boolean;
  readonly title: string;
  readonly contentTypes: readonly string[];
  readonly selectedContentType: string;
  readonly selectedContentTypeIndex: number;
  readonly shouldAudition: boolean;
  readonly filters: readonly BrowserFilter[];
  readonly results: {
    readonly entryCount: number;
    readonly scrollPosition: number;
    readonly items: readonly BrowserItem[];
  };
  readonly guard: string;
};

const [route, formatArg] = process.argv.slice(2);
if (!['direct', 'direct-incompatible', 'browser', 'browser-inspect', 'browser-catalog', 'browser-guard',
  'status', 'cleanup-residue'].includes(route ?? '')) {
  throw new Error('usage: d03-preset-loading.ts direct|direct-incompatible|browser|browser-inspect|browser-catalog|browser-guard|status|cleanup-residue [format]');
}
if (route !== 'status' && route !== 'cleanup-residue'
    && !['bwpreset', 'h2p', 'fxp', 'vstpreset'].includes(formatArg ?? '')) {
  throw new Error('format must be bwpreset, h2p, fxp, or vstpreset');
}
const format = formatArg as Format;
const source = SOURCES[format];
const client = new BridgeClient();
const scratchName = `gn-d03-${route}-${formatArg ?? 'status'}`;
let entryTracks: readonly TrackRow[] = [];
let ownedTrackId: string | undefined;
let tempRoot: string | undefined;

async function request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  return client.request(method, params);
}

async function tracks(): Promise<readonly TrackRow[]> {
  return ((await request('track.list')) as { readonly tracks: readonly TrackRow[] }).tracks;
}

async function devices(): Promise<readonly DeviceRow[]> {
  return ((await request('device.list', { cursor: '0' })) as {
    readonly devices: readonly DeviceRow[];
  }).devices;
}

async function pointOwned(): Promise<TrackRow> {
  const row = (await tracks()).find((item) => item.channelId === ownedTrackId);
  if (row === undefined) throw new Error('the owned track is absent');
  await request('cursor.pointTrack', { cursor: '0', trackIndex: row.index });
  const reached = await pollUntil(async () => {
    const reply = await request('device.list', { cursor: '0' }) as { readonly trackChannelId: string };
    return reply.trackChannelId === row.channelId;
  }, 5_000, 100);
  if (!reached.ok) throw new Error('the device bank did not reach the owned track');
  return row;
}

async function createOwnedTrack(type: 'instrument' | 'audio' | 'effect' = 'instrument'): Promise<TrackRow> {
  const before = await tracks();
  const known = new Set(before.map((row) => row.channelId));
  if (type === 'instrument') {
    await request('track.create', { position: before.length });
  } else {
    await request('spike.preset.createTrack', { position: before.length, type });
  }
  const appeared = await pollUntil(async () => (await tracks()).length === before.length + 1, 5_000, 100);
  if (!appeared.ok) throw new Error('the owned track did not appear');
  const row = (await tracks()).find((item) => !known.has(item.channelId));
  if (row === undefined) throw new Error('the owned track has no durable identity');
  ownedTrackId = row.channelId;
  await request('track.setName', { trackIndex: row.index, name: scratchName });
  const renamed = await pollUntil(async () =>
    (await tracks()).some((item) => item.channelId === row.channelId && item.name === scratchName),
  5_000, 100);
  if (!renamed.ok) throw new Error('the owned track rename did not settle');
  return pointOwned();
}

async function directInventory(expectedName: string, trackId: string): Promise<readonly DirectRow[]> {
  const begun = await request('directparam.list', { begin: true }) as { readonly generation: number };
  await request('devcursor.selectAt', { deviceIndex: 0 });
  let prior = '';
  let finalRows: readonly DirectRow[] = [];
  const settled = await pollUntil(async () => {
    const reply = await request('directparam.list', { generation: begun.generation }) as {
      readonly generation: number;
      readonly idsGeneration: number;
      readonly deviceExists: boolean;
      readonly deviceName: string;
      readonly trackChannelId: string;
      readonly observedTrackChannelId?: string;
      readonly params: readonly DirectRow[];
      readonly count: number;
    };
    const complete = reply.generation === begun.generation
      && reply.idsGeneration === begun.generation
      && reply.deviceExists
      && reply.deviceName === expectedName
      && reply.trackChannelId === trackId
      && reply.observedTrackChannelId === trackId
      && reply.params.length === reply.count
      && reply.params.length > 0
      && reply.params.every((item) => item.name !== null && typeof item.value === 'number');
    if (!complete) return false;
    finalRows = reply.params;
    const signature = JSON.stringify(reply.params);
    const stable = signature === prior;
    prior = signature;
    return stable;
  }, 30_000, 150);
  if (!settled.ok) throw new Error(`the ${expectedName} DirectParameter inventory did not settle`);
  return finalRows;
}

function fingerprint(rows: readonly DirectRow[]): string {
  const stable = rows.map((row) => [row.id, row.name, row.value?.toFixed(10)]);
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

async function deleteOnlyDevice(): Promise<void> {
  const chain = await devices();
  if (chain.length === 0) return;
  if (chain.length !== 1) throw new Error(`cleanup refuses a ${chain.length}-device chain`);
  await request('device.delete', {
    cursor: '0',
    deviceIndex: 0,
    expectedName: chain[0]!.name,
    expectedTrackChannelId: ownedTrackId,
    expectedDeviceNames: [chain[0]!.name],
    expectedDeviceEnabled: [chain[0]!.enabled],
  });
  const removed = await pollUntil(async () => (await devices()).length === 0, 8_000, 100);
  if (!removed.ok) throw new Error('the owned device did not delete');
}

async function insertAndCapture(path: string, label: string): Promise<Record<string, unknown>> {
  if (ownedTrackId === undefined) throw new Error('the owned track is unavailable');
  const started = performance.now();
  await request('device.insertFile', {
    cursor: '0', path, expectedTrackChannelId: ownedTrackId, expectedDeviceNames: [], expectedDeviceEnabled: [],
  });
  const timeoutMs = label.startsWith('cold-') ? 60_000 : label === 'unindexed-copy' ? 12_000 : 8_000;
  const appeared = await pollUntil(async () => (await devices()).length > 0, timeoutMs, 100);
  if (!appeared.ok) {
    return { label, path, loaded: false, elapsedMs: Math.round(performance.now() - started) };
  }
  const chain = await devices();
  if (chain.length !== 1) throw new Error(`${label} inserted ${chain.length} top-level devices`);
  const state = await request('spike.preset.deviceStatus', { cursor: '0', deviceIndex: 0 }) as
    Record<string, unknown>;
  const params = await directInventory(chain[0]!.name, ownedTrackId);
  const elapsedMs = Math.round(performance.now() - started);
  return {
    label,
    path,
    loaded: true,
    elapsedMs,
    chain,
    state,
    parameterCount: params.length,
    parameterFingerprint: fingerprint(params),
    parameterHead: params.slice(0, 5).map((row) => [row.id, row.name, row.value]),
  };
}

function sameTracks(left: readonly TrackRow[], right: readonly TrackRow[]): boolean {
  return JSON.stringify(left.map((row) => [row.channelId, row.name, row.position, row.type]))
    === JSON.stringify(right.map((row) => [row.channelId, row.name, row.position, row.type]));
}

async function noOp(path: string, label: string): Promise<Record<string, unknown>> {
  const started = performance.now();
  await request('device.insertFile', {
    cursor: '0', path, expectedTrackChannelId: ownedTrackId, expectedDeviceNames: [], expectedDeviceEnabled: [],
  });
  const changed = await pollUntil(async () => (await devices()).length !== 0, 3_000, 120);
  const chain = await devices();
  if (chain.length > 0) await deleteOnlyDevice();
  return { label, path, noOp: !changed.ok && chain.length === 0, elapsedMs: Math.round(performance.now() - started) };
}

async function runDirect(): Promise<void> {
  const row = await createOwnedTrack();
  const samples: Record<string, unknown>[] = [];
  samples.push(await insertAndCapture(source.path, 'cold-indexed'));
  await deleteOnlyDevice();
  for (let index = 1; index <= 3; index += 1) {
    samples.push(await insertAndCapture(source.path, `warm-${index}-indexed`));
    await deleteOnlyDevice();
  }
  tempRoot = mkdtempSync(join(tmpdir(), 'ghostnote-d03-'));
  const copyPath = join(tempRoot, `unindexed-${basename(source.path)}`);
  copyFileSync(source.path, copyPath);
  samples.push(await insertAndCapture(copyPath, 'unindexed-copy'));
  await deleteOnlyDevice();

  const missing = await noOp(join(tempRoot, `missing${extname(source.path)}`), 'missing-file');
  const wrongPath = join(tempRoot, `${basename(source.path)}.wrong`);
  copyFileSync(source.path, wrongPath);
  const wrong = await noOp(wrongPath, 'wrong-extension');
  const warm = samples.slice(1, 4).map((item) => item['elapsedMs'] as number).sort((a, b) => a - b);
  const indexed = samples.slice(0, 4).map((item) => item['loaded'] === true);
  const verdict = directRouteVerdict(indexed, samples[4]?.['loaded'] === true);
  const summary = {
    route: 'direct', format, verdict, source, track: row,
    samples,
    warmMedianMs: warm[1], warmRangeMs: [warm[0], warm[2]],
    controls: [missing, wrong],
  };
  console.log(`D03_RESULT ${JSON.stringify(summary)}`);
  const indexedConsistent = verdict !== 'nondeterministic';
  check(`${format}: cold and three warm indexed attempts had one deterministic verdict`,
    indexedConsistent, summary);
  check(`${format}: the indexed-path dependency has a deterministic classification`,
    verdict !== 'nondeterministic', { verdict, unindexed: samples[4] });
  check(`${format}: negative controls were exact no-ops`,
    [missing, wrong].every((item) => item['noOp'] === true), { missing, wrong });
}

async function runDirectIncompatible(): Promise<void> {
  if (format !== 'h2p') throw new Error('the cross-context control uses the H2P instrument fixture');
  const row = await createOwnedTrack('effect');
  const control = await insertAndCapture(source.path, 'cross-context-effect-track');
  await deleteOnlyDevice();
  console.log(`D03_INCOMPATIBLE ${JSON.stringify({ route: 'direct-incompatible', format, control })}`);
  check('H2P instrument preset has complete readback on an owned effect track',
    control['loaded'] === true
      && (control['state'] as { readonly name?: string }).name === source.device
      && row.type === 'Effect', control);
}

async function browserStatus(): Promise<BrowserStatus> {
  return request('spike.preset.browserStatus') as Promise<BrowserStatus>;
}

async function waitForBrowser(predicate: (status: BrowserStatus) => boolean, timeoutMs = 12_000): Promise<BrowserStatus> {
  let latest = await browserStatus();
  const settled = await pollUntil(async () => {
    latest = await browserStatus();
    return predicate(latest);
  }, timeoutMs, 150);
  if (!settled.ok) throw new Error(`popup browser did not settle: ${JSON.stringify(latest)}`);
  return latest;
}

async function stableBrowserStatus(): Promise<BrowserStatus> {
  let prior = '';
  let latest = await browserStatus();
  const settled = await pollUntil(async () => {
    latest = await browserStatus();
    const stable = latest.guard === prior;
    prior = latest.guard;
    return stable;
  }, 8_000, 180);
  if (!settled.ok) throw new Error('popup browser state did not become stable');
  return latest;
}

async function selectContentType(name: string): Promise<BrowserStatus> {
  let status = await waitForBrowser((item) => item.exists && item.contentTypes.length > 0);
  const index = status.contentTypes.findIndex((item) => item.toLowerCase() === name.toLowerCase());
  if (index < 0) {
    throw new Error(`popup browser has no ${name} content type: ${JSON.stringify(status.contentTypes)}`);
  }
  await request('spike.preset.browserSetContentType', { index, relative: true });
  return waitForBrowser((item) => item.selectedContentTypeIndex === index);
}

async function openPresetBrowser(row: TrackRow): Promise<void> {
  await request('spike.preset.browserPrepareContentType', { index: 3 });
  await request('spike.preset.browserOpen', {
    cursor: '0', expectedTrackChannelId: row.channelId, expectedDeviceNames: [],
  });
}

async function findItem(target: string, exactName: string): Promise<number> {
  let position = 0;
  for (;;) {
    await request('spike.preset.browserScroll', { target, position });
    const status = await waitForBrowser((item) => {
      const sourceItems = target === 'results'
        ? item.results.items
        : item.filters.find((filter) => filter.key === target)?.items ?? [];
      return sourceItems.length === 0
        || (sourceItems[0]!.index <= position && sourceItems[sourceItems.length - 1]!.index >= position);
    });
    const items = target === 'results'
      ? status.results.items
      : status.filters.find((filter) => filter.key === target)?.items ?? [];
    const matches = items.filter((item) => item.name === exactName);
    if (matches.length > 1) throw new Error(`${target} has duplicate exact ${exactName} entries in one window`);
    if (matches.length === 1) return matches[0]!.index;
    const entryCount = target === 'results'
      ? status.results.entryCount
      : status.filters.find((filter) => filter.key === target)?.entryCount ?? 0;
    if (items.length === 0 || position + items.length >= entryCount) break;
    position += items.length;
  }
  throw new Error(`${target} has no exact ${exactName} item`);
}

async function selectFilter(column: string, name: string): Promise<void> {
  const index = await findItem(column, name);
  await request('spike.preset.browserSelectFilter', { column, index });
  await waitForBrowser((status) =>
    status.filters.find((filter) => filter.key === column)?.items
      .some((item) => item.index === index && item.selected) === true);
}

async function browserLoad(row: TrackRow, label: string): Promise<Record<string, unknown>> {
  const started = performance.now();
  await openPresetBrowser(row);
  await selectContentType('Plug-in Presets');
  await request('spike.preset.browserSetAudition', { enabled: false });
  await waitForBrowser((status) => status.shouldAudition === false);
  await selectFilter('device', source.device);
  const resultIndex = await findItem('results', source.resultName);
  await request('spike.preset.browserSelectResult', { index: resultIndex });
  await waitForBrowser((status) =>
    status.results.items.some((item) => item.index === resultIndex && item.selected));
  const selected = await stableBrowserStatus();
  const exact = selected.results.items.filter((item) => item.name === source.resultName);
  if (exact.length !== 1) throw new Error(`result ${source.resultName} is not unique in the observed window`);
  await request('spike.preset.browserCommit', { expectedGuard: selected.guard });
  const appeared = await pollUntil(async () => (await devices()).length > 0, 30_000, 100);
  if (!appeared.ok) throw new Error('the popup commit did not insert a device');
  const chain = await devices();
  if (chain.length !== 1 || ownedTrackId === undefined) throw new Error('the popup inserted an unexpected chain');
  const state = await request('spike.preset.deviceStatus', { cursor: '0', deviceIndex: 0 });
  const params = await directInventory(chain[0]!.name, ownedTrackId);
  return {
    label,
    loaded: true,
    elapsedMs: Math.round(performance.now() - started),
    filters: selected.filters.map((item) => ({
      key: item.key,
      selected: item.wildcard.selected ? item.wildcard.name : item.items.filter((entry) => entry.selected).map((entry) => entry.name),
      entryCount: item.entryCount,
      scrollPosition: item.scrollPosition,
    })),
    resultCount: selected.results.entryCount,
    resultIndex,
    resultName: source.resultName,
    chain,
    state,
    parameterCount: params.length,
    parameterFingerprint: fingerprint(params),
  };
}

async function runBrowser(): Promise<void> {
  const row = await createOwnedTrack();
  const samples: Record<string, unknown>[] = [];
  for (const label of ['cold', 'warm-1', 'warm-2', 'warm-3']) {
    samples.push(await browserLoad(row, label));
    await deleteOnlyDevice();
  }
  const warm = samples.slice(1).map((item) => item['elapsedMs'] as number).sort((a, b) => a - b);
  const summary = {
    route: 'browser', format, source, track: row, samples,
    warmMedianMs: warm[1], warmRangeMs: [warm[0], warm[2]],
  };
  console.log(`D03_RESULT ${JSON.stringify(summary)}`);
  check(`${format}: one cold and three warm guarded popup commits loaded verified devices`,
    samples.every((item) => item['loaded'] === true), summary);
}

async function runBrowserInspect(): Promise<void> {
  const row = await createOwnedTrack();
  await openPresetBrowser(row);
  await selectContentType('Plug-in Presets');
  await request('spike.preset.browserSetAudition', { enabled: false });
  console.log(`D03_BROWSER_INSPECT ${JSON.stringify(await stableBrowserStatus())}`);
}

async function scanBrowserItems(
  target: 'location' | 'results',
  match: (name: string) => boolean,
  limit?: number,
): Promise<readonly BrowserItem[]> {
  const initial = await browserStatus();
  const entryCount = target === 'results'
    ? initial.results.entryCount
    : initial.filters.find((item) => item.key === target)?.entryCount ?? 0;
  const stop = Math.min(entryCount, limit ?? entryCount);
  const matches: BrowserItem[] = [];
  for (let position = 0; position < stop; position += 64) {
    await request('spike.preset.browserScroll', { target, position });
    const status = await waitForBrowser((item) => {
      const items = target === 'results'
        ? item.results.items
        : item.filters.find((filter) => filter.key === target)?.items ?? [];
      return items.length > 0 && items[0]!.index <= position
        && items[items.length - 1]!.index >= position;
    });
    const items = target === 'results'
      ? status.results.items
      : status.filters.find((filter) => filter.key === target)?.items ?? [];
    matches.push(...items.filter((item) => match(item.name)));
  }
  return matches;
}

async function runBrowserCatalog(): Promise<void> {
  const row = await createOwnedTrack();
  await openPresetBrowser(row);
  await waitForBrowser((status) => status.exists && status.results.entryCount > 0);
  await request('spike.preset.browserSetAudition', { enabled: false });
  await waitForBrowser((status) => status.shouldAudition === false);
  const locations = await scanBrowserItems('location', (name) =>
    /netrunner|filterscape|weiss|softube|stochas/i.test(name));
  const devices = await scanBrowserItems('results', (name) =>
    /stochas|sforzando|quanta 2|tal-sampler|tx16wx|reflection step/i.test(name), 512);
  console.log(`D03_BROWSER_CATALOG ${JSON.stringify({ locations, devices })}`);
}

async function runBrowserGuard(): Promise<void> {
  const row = await createOwnedTrack();
  await openPresetBrowser(row);
  await waitForBrowser((status) => status.exists && status.results.entryCount > 0);
  await request('spike.preset.browserSetAudition', { enabled: false });
  const before = await stableBrowserStatus();
  const bass = before.filters.find((item) => item.key === 'category')?.items
    .find((item) => item.name === 'Bass');
  if (bass === undefined) throw new Error('the popup has no Bass category control');
  await request('spike.preset.browserSelectFilter', { column: 'category', index: bass.index });
  const changed = await waitForBrowser((status) => status.guard !== before.guard);
  let refusal = '';
  try {
    await request('spike.preset.browserCommit', { expectedGuard: before.guard });
  } catch (error) {
    refusal = error instanceof Error ? error.message : String(error);
  }
  const chain = await devices();
  console.log(`D03_BROWSER_GUARD ${JSON.stringify({
    beforeGuard: before.guard,
    changedGuard: changed.guard,
    refusal,
    browserStillOpen: changed.exists,
    chain,
  })}`);
  check('popup commit refuses a changed guarded state', /state changed before commit/.test(refusal), refusal);
  check('guard refusal leaves the owned chain empty', chain.length === 0, chain);
}

async function cleanup(): Promise<void> {
  try {
    const status = await browserStatus();
    if (status.exists) await request('spike.preset.browserCancel');
  } catch {
    // The direct route can run before the popup apparatus is visible.
  }
  if (ownedTrackId !== undefined) {
    await pointOwned();
    await deleteOnlyDevice();
    const row = (await tracks()).find((item) => item.channelId === ownedTrackId);
    if (row !== undefined) {
      await request('track.delete', { trackIndex: row.index });
      await pollUntil(async () => !(await tracks()).some((item) => item.channelId === ownedTrackId), 8_000, 100);
    }
  }
  if (tempRoot !== undefined) rmSync(tempRoot, { recursive: true, force: true });
}

async function cleanupResidue(): Promise<void> {
  for (;;) {
    const row = (await tracks()).find((item) => item.name.startsWith('gn-d03-'));
    if (row === undefined) return;
    await request('track.delete', { trackIndex: row.index });
    const removed = await pollUntil(async () =>
      !(await tracks()).some((item) => item.channelId === row.channelId), 8_000, 100);
    if (!removed.ok) throw new Error(`owned residue ${row.name} did not delete`);
  }
}

try {
  await client.connect();
  entryTracks = await tracks();
  const revision = await request('revision.get') as { readonly project: string; readonly generation: string };
  note(`entry project=${revision.project}; generation=${revision.generation}; tracks=${entryTracks.length}`);
  if (route === 'status') {
    console.log(JSON.stringify(await browserStatus(), null, 2));
  } else if (route === 'cleanup-residue') {
    await cleanupResidue();
  } else if (route === 'direct') {
    await runDirect();
  } else if (route === 'direct-incompatible') {
    await runDirectIncompatible();
  } else if (route === 'browser-inspect') {
    await runBrowserInspect();
  } else if (route === 'browser-catalog') {
    await runBrowserCatalog();
  } else if (route === 'browser-guard') {
    await runBrowserGuard();
  } else {
    await runBrowser();
  }
} catch (error) {
  check('D03 route completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try {
    await cleanup();
    const finalTracks = await tracks();
    const expected = route === 'cleanup-residue'
      ? entryTracks.filter((row) => !row.name.startsWith('gn-d03-'))
      : entryTracks;
    check('D03 cleanup restored the exact expected track list', sameTracks(finalTracks, expected), {
      entry: entryTracks.map((row) => [row.channelId, row.name, row.position, row.type]),
      expected: expected.map((row) => [row.channelId, row.name, row.position, row.type]),
      final: finalTracks.map((row) => [row.channelId, row.name, row.position, row.type]),
    });
  } catch (error) {
    check('D03 cleanup completed', false, error instanceof Error ? error.message : String(error));
  }
  client.disconnect();
}

console.log(failureCount() === 0 ? '\nD03: ALL PASS' : `\nD03: ${failureCount()} FAILURE(S)`);
process.exitCode = failureCount() === 0 ? 0 : 1;
