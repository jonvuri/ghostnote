/** Probe the API boundary around a CLAP device's contextual browser. */
import { BridgeClient } from '../client.js';
import { check, failureCount, note, pollUntil } from './lib.js';

const CLAP_ID = 'com.u-he.Repro-5';
const DEVICE_NAME = 'Repro-5';
const TRACK_NAME = 'gn-d03-clap-preset-feasibility';

type TrackRow = {
  readonly index: number;
  readonly name: string;
  readonly position: number;
  readonly type: string;
  readonly channelId: string;
};
type DeviceRow = { readonly index: number; readonly name: string; readonly enabled: boolean };
type BrowserItem = { readonly index: number; readonly name: string; readonly selected: boolean };
type BrowserFilter = {
  readonly key: string;
  readonly exists: boolean;
  readonly entryCount: number;
  readonly items: readonly (BrowserItem & { readonly hitCount: number })[];
};
type BrowserStatus = {
  readonly exists: boolean;
  readonly title: string;
  readonly selectedContentType: string;
  readonly selectedContentTypeIndex: number;
  readonly filters: readonly BrowserFilter[];
  readonly results: { readonly entryCount: number; readonly items: readonly BrowserItem[] };
  readonly guard: string;
};

const client = new BridgeClient();
let entryTracks: readonly TrackRow[] = [];
let ownedTrackId: string | undefined;

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

async function browserStatus(): Promise<BrowserStatus> {
  return request('spike.preset.browserStatus') as Promise<BrowserStatus>;
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

function sameTracks(left: readonly TrackRow[], right: readonly TrackRow[]): boolean {
  return JSON.stringify(left.map((row) => [row.channelId, row.name, row.position, row.type]))
    === JSON.stringify(right.map((row) => [row.channelId, row.name, row.position, row.type]));
}

async function cleanup(): Promise<void> {
  if ((await browserStatus()).exists) {
    await request('spike.preset.browserCancel');
    const closed = await pollUntil(async () => !(await browserStatus()).exists, 5_000, 100);
    if (!closed.ok) throw new Error('the popup browser did not close');
  }
  if (ownedTrackId === undefined) return;
  const row = (await tracks()).find((item) => item.channelId === ownedTrackId);
  if (row === undefined) return;
  await request('track.delete', { trackIndex: row.index });
  const removed = await pollUntil(async () =>
    !(await tracks()).some((item) => item.channelId === ownedTrackId), 8_000, 100);
  if (!removed.ok) throw new Error('the owned track did not delete');
}

try {
  await client.connect();
  entryTracks = await tracks();
  note(`entry tracks=${entryTracks.length}`);
  const known = new Set(entryTracks.map((row) => row.channelId));
  await request('track.create', { position: entryTracks.length });
  const appeared = await pollUntil(async () => (await tracks()).length === entryTracks.length + 1,
    5_000, 100);
  if (!appeared.ok) throw new Error('the owned track did not appear');
  const owned = (await tracks()).find((row) => !known.has(row.channelId));
  if (owned === undefined) throw new Error('the owned track has no durable identity');
  ownedTrackId = owned.channelId;
  await request('track.setName', { trackIndex: owned.index, name: TRACK_NAME });
  const row = await pointOwned();
  await request('device.insertClap', {
    cursor: '0', clapId: CLAP_ID, expectedTrackChannelId: row.channelId,
    expectedDeviceNames: [], expectedDeviceEnabled: [],
  });
  const inserted = await pollUntil(async () => {
    const chain = await devices();
    return chain.length === 1 && chain[0]?.name === DEVICE_NAME;
  }, 15_000, 100);
  if (!inserted.ok) throw new Error('the Repro-5 CLAP device did not appear');

  await request('spike.preset.browserOpen', {
    cursor: '0', expectedTrackChannelId: row.channelId,
    expectedDeviceNames: [DEVICE_NAME], replaceDeviceIndex: 0,
  });
  let initial = await browserStatus();
  const opened = await pollUntil(async () => {
    initial = await browserStatus();
    return initial.exists && initial.results.entryCount > 0;
  }, 12_000, 150);
  if (!opened.ok) throw new Error('the replacement browser did not open');
  console.log(`D03_CLAP_CONTEXT ${JSON.stringify(initial)}`);

  const location = initial.filters.find((filter) => filter.key === 'location');
  const deviceFilter = initial.filters.find((filter) => filter.key === 'device');
  check('the replacement browser exposes the CLAP device catalog',
    location?.items.some((item) => item.name === 'System CLAP Plug-ins') === true
      && location.items.some((item) => item.name === 'Repro-1.clap'), location);
  check('the replacement browser does not expose a preset device filter',
    deviceFilter?.exists === false, deviceFilter);
  check('the replacement browser has no observable selected content type',
    initial.selectedContentType === '' && initial.selectedContentTypeIndex === 0, {
      name: initial.selectedContentType,
      index: initial.selectedContentTypeIndex,
    });

  const action = await request('app.invokeAction', { id: 'select_next_tab' }) as {
    readonly resolved: boolean;
  };
  const changed = await pollUntil(async () => (await browserStatus()).guard !== initial.guard,
    3_000, 150);
  const afterAction = await browserStatus();
  console.log(`D03_CLAP_TAB_ACTION ${JSON.stringify({ action, changed: changed.ok, afterAction })}`);
  check('the resolved next-tab action does not expose the preset catalog',
    action.resolved && !changed.ok
      && afterAction.filters.find((filter) => filter.key === 'device')?.exists === false,
    { action, changed: changed.ok, afterAction });
} catch (error) {
  check('CLAP contextual-browser boundary completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try {
    await cleanup();
    const finalTracks = await tracks();
    check('CLAP browser cleanup restored the exact entry track list',
      sameTracks(finalTracks, entryTracks), { entryTracks, finalTracks });
  } catch (error) {
    check('CLAP browser cleanup completed', false,
      error instanceof Error ? error.message : String(error));
  }
  client.disconnect();
}

console.log(failureCount() === 0 ? '\nD03 CLAP BROWSER: ALL PASS'
  : `\nD03 CLAP BROWSER: ${failureCount()} FAILURE(S)`);
process.exitCode = failureCount() === 0 ? 0 : 1;
