/** D02 Session 8 live proof for exact launcher-clip colour bytes. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { BridgeClient } from '../client.js';
import { EXACT_CLIP_COLORS } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, failureCount, note, point, pollUntil } from './lib.js';

const TRACK_NAME = 'gn-d02-s8-clip-color';
const CURSOR = '0';
const WITNESS = '1';
const ROW = 0;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
  readonly position: number;
  readonly type: string;
}

interface Metadata {
  readonly exists: boolean;
  readonly name: string;
  readonly playStart: number;
  readonly loopEnabled: boolean;
  readonly loopStart: number;
  readonly loopLength: number;
  readonly colorRed: number;
  readonly colorGreen: number;
  readonly colorBlue: number;
}

const bridge = new BridgeClient();
let ownedTrack: TrackRow | undefined;
let entryTracks: readonly TrackRow[] = [];

async function tracks(): Promise<readonly TrackRow[]> {
  return (await bridge.request('track.list') as { readonly tracks: readonly TrackRow[] }).tracks;
}

function sameTracks(left: readonly TrackRow[], right: readonly TrackRow[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

async function occupied(trackIndex: number): Promise<boolean> {
  return (await bridge.request('slot.status', {
    trackIndex, slotIndex: ROW,
  }) as { readonly hasContent?: boolean }).hasContent === true;
}

async function read(cursor: string): Promise<Metadata> {
  return await bridge.request('cursor.clipMetadata', { cursor }) as Metadata;
}

async function pointAt(cursor: string, trackIndex: number): Promise<void> {
  const result = await point(cursor, trackIndex, ROW, 'trackThenSlot');
  if (!result.ok) throw new Error(`cursor ${cursor} did not point to the owned clip`);
}

async function writeColor(trackIndex: number, bytes: readonly [number, number, number]): Promise<Metadata> {
  await pointAt(CURSOR, trackIndex);
  await bridge.request('cursor.setClipMetadata', {
    cursor: CURSOR,
    trackIndex,
    slotIndex: ROW,
    name: TRACK_NAME,
    colorBytes: bytes,
    lengthBeats: 4,
    playStartBeats: 0,
    loopEnabled: true,
    loopStartBeats: 0,
    loopEndBeats: 4,
  });
  await sleep(250);
  await pointAt(WITNESS, trackIndex);
  return read(WITNESS);
}

try {
  await bridge.connect();
  const hello = await bridge.request('host.info') as {
    readonly hostVersion?: string;
  };
  const contract = await bridge.request('contract.hello') as {
    readonly extensionVersion?: string;
    readonly hostApiVersion?: number;
    readonly methodCount?: number;
    readonly methodsHash?: string;
  };
  note(`Bitwig ${hello.hostVersion ?? 'unknown'}; extension ${contract.extensionVersion ?? 'unknown'}; `
    + `API ${contract.hostApiVersion ?? 'unknown'}; ${contract.methodCount ?? 'unknown'} methods; `
    + `hash ${contract.methodsHash ?? 'unknown'}`);
  entryTracks = await tracks();
  await bridge.request('track.create', { position: -1 });
  const appeared = await pollUntil(async () => {
    ownedTrack = (await tracks()).find((item) =>
      !entryTracks.some((entry) => entry.channelId === item.channelId));
    return ownedTrack !== undefined;
  });
  if (!appeared.ok || ownedTrack === undefined) throw new Error('the owned track did not appear');
  await bridge.request('track.setName', { trackIndex: ownedTrack.index, name: TRACK_NAME });
  await bridge.request('clip.create', {
    trackIndex: ownedTrack.index, slotIndex: ROW, lengthBeats: 4,
  });
  const clipAppeared = await pollUntil(async () => occupied(ownedTrack!.index));
  if (!clipAppeared.ok) throw new Error('the owned clip did not appear');

  const rows: Record<string, unknown>[] = [];
  for (const item of EXACT_CLIP_COLORS) {
    const requested = [item.color.red, item.color.green, item.color.blue] as const;
    const encoded = item.wireBytes;
    const sent = encoded.map((raw) => {
      const value = Number(raw);
      return Math.fround(
        value === 255 ? 1 : (value + 0.5) / 255,
      );
    }) as [number, number, number];
    const observed = await writeColor(ownedTrack.index, encoded);
    rows.push({
      requested,
      sent,
      hostFloats: [observed.colorRed, observed.colorGreen, observed.colorBlue],
      returnedBytes: [observed.colorRed, observed.colorGreen, observed.colorBlue]
        .map((item) => Math.round(item * 255)),
    });
  }
  note(JSON.stringify(rows));
  check('d02-s8-M1: the focused byte matrix round-trips on all channels',
    rows.every((row) => JSON.stringify(row.returnedBytes)
      === JSON.stringify(row.requested)),
    rows);

  const adapter = new LiveAdapter({ transport: new BridgeTransport(bridge) });
  await adapter.hello();
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash: new Stash(),
    observationStore: new FakeObservationStore(),
  });
  await pointAt(WITNESS, ownedTrack.index);
  const beforePublic = await read(WITNESS);
  const unsupported = await callTool(workspace, 'set_clip_metadata', {
    clips: [{
      trackId: ownedTrack.channelId,
      row: ROW,
      metadata: {
        name: 'unsupported', color: { red: 145, green: 105, blue: 78 },
        lengthBeats: 4, playStartBeats: 0, loopEnabled: true,
        loopStartBeats: 0, loopEndBeats: 4,
      },
    }],
  }) as Record<string, unknown>;
  await pointAt(WITNESS, ownedTrack.index);
  const afterRefusal = await read(WITNESS);
  check('d02-s8-M2: an unsupported colour is refused before any write',
    unsupported['refused'] === true
      && unsupported['nothingWasWritten'] === true
      && JSON.stringify(afterRefusal) === JSON.stringify(beforePublic),
    { unsupported, beforePublic, afterRefusal });

  const red = EXACT_CLIP_COLORS.find((item) => item.name === 'Red');
  if (red === undefined) throw new Error('the exact palette has no Red entry');
  const changed = await callTool(workspace, 'set_clip_metadata', {
    clips: [{
      trackId: ownedTrack.channelId,
      row: ROW,
      metadata: {
        name: 'gn-d02-s8-public', color: red.color,
        lengthBeats: 4, playStartBeats: 0, loopEnabled: true,
        loopStartBeats: 0, loopEndBeats: 4,
      },
    }],
  }) as {
    readonly applied?: boolean;
    readonly changeId?: string;
    readonly clips?: readonly { readonly metadataVerified?: boolean }[];
  };
  await pointAt(WITNESS, ownedTrack.index);
  const afterPublic = await read(WITNESS);
  check('d02-s8-M3: the public metadata tool returns exact independent readback',
    changed.applied === true
      && changed.clips?.[0]?.metadataVerified === true
      && Math.round(afterPublic.colorRed * 255) === red.color.red
      && Math.round(afterPublic.colorGreen * 255) === red.color.green
      && Math.round(afterPublic.colorBlue * 255) === red.color.blue,
    { changed, afterPublic });
  if (typeof changed.changeId !== 'string') throw new Error('the metadata change returned no id');
  const reversed = await callTool(workspace, 'revert_change', {
    changeId: changed.changeId,
  }) as Record<string, unknown>;
  await pointAt(WITNESS, ownedTrack.index);
  const afterReverse = await read(WITNESS);
  check('d02-s8-M4: exact reversal restores the complete prior clip metadata',
    reversed['applied'] === true
      && JSON.stringify(afterReverse) === JSON.stringify(beforePublic),
    { reversed, beforePublic, afterReverse });
} catch (error) {
  check('d02-s8-LX: the focused live probe completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (ownedTrack !== undefined) {
    try {
      if (await occupied(ownedTrack.index)) {
        await bridge.request('slot.delete', { trackIndex: ownedTrack.index, slotIndex: ROW });
        await pollUntil(async () => !(await occupied(ownedTrack!.index)));
      }
      await bridge.request('track.delete', { trackIndex: ownedTrack.index });
      await pollUntil(async () => (await tracks()).every((item) =>
        item.channelId !== ownedTrack!.channelId));
    } catch (error) {
      check('d02-s8-cleanup: the owned scratch track was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await tracks();
    check('d02-s8-cleanup: the exact entry track list is restored',
      sameTracks(finalTracks, entryTracks),
      { entry: entryTracks, final: finalTracks });
  } catch (error) {
    check('d02-s8-cleanup: final inventory completed', false,
      error instanceof Error ? error.message : String(error));
  }
  bridge.disconnect();
}

console.log(failureCount() === 0
  ? '\nD02 Session 8: ALL PASS'
  : `\nD02 Session 8: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
