/** D01 follow-up 2: read-only stale-selection project-switch proof. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport, type Transport } from '../adapters/live/transport.js';
import { WIRE, type Frame } from '../adapters/live/wiremap.js';
import { BridgeClient } from '../client.js';
import { track } from '../contract/index.js';
import { check, failureCount } from './lib.js';

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

interface TraceEntry {
  readonly frame: Frame;
  readonly result?: unknown;
  readonly error?: string;
}

class TraceTransport implements Transport {
  readonly entries: TraceEntry[] = [];

  constructor(private readonly inner: Transport) {}

  async send(frame: Frame): Promise<unknown> {
    try {
      const result = await this.inner.send(frame);
      this.entries.push({ frame, result });
      return result;
    } catch (error) {
      this.entries.push({ frame, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.inner.close();
  }
}

const bridge = new BridgeClient();
const trace = new TraceTransport(new BridgeTransport(bridge));
const adapter = new LiveAdapter({ transport: trace });

try {
  await adapter.hello();
  const revision = await adapter.revision();
  const tracks = await adapter.tracks();
  const selection = await bridge.request(WIRE.selectionStatus) as Selection;
  let validation: unknown;
  try {
    validation = await bridge.request(WIRE.slotStatus, {
      trackIndex: selection.trackIndex,
      slotIndex: selection.slotIndex,
    });
  } catch (error) {
    validation = { error: error instanceof Error ? error.message : String(error) };
  }

  trace.entries.length = 0;
  const content = await adapter.devices(track(tracks[0]!.channelId));
  const capture = trace.entries.filter(({ frame }) =>
    frame.method === WIRE.selectionStatus || frame.method === WIRE.slotStatus);
  const restore = trace.entries.filter(({ frame }) => frame.method === WIRE.slotSelect);
  const finalRevision = await adapter.revision();
  const finalSelection = await bridge.request(WIRE.selectionStatus) as Selection;

  console.log(JSON.stringify({ project: revision.project, tracks: tracks.length, selection }, null, 2));
  console.log(JSON.stringify({ validation }, null, 2));
  console.log(JSON.stringify({ content }, null, 2));
  console.log(JSON.stringify({ capture, restore, finalRevision, finalSelection }, null, 2));

  check('D01-L1: the switched project has four tracks and a stale cached track 5',
    tracks.length === 4 && selection.trackIndex === 5, { project: revision.project, selection });
  check('D01-L2: slot.status rejects only the stale cached track',
    JSON.stringify(validation).includes('no track at index: 5'), validation);
  check('D01-L3: the device content read succeeds', Array.isArray(content.devices), content);
  check('D01-L4: capture validates the exact cached pair',
    capture.some(({ frame }) => frame.method === WIRE.slotStatus
      && frame.params?.['trackIndex'] === 5
      && frame.params?.['slotIndex'] === selection.slotIndex), capture);
  check('D01-L5: no restore frame names the stale pair', restore.length === 0, restore);
  check('D01-L6: the read changes no project content or selection',
    finalRevision.project === revision.project
      && finalRevision.revision === revision.revision
      && finalRevision.contentEpoch === revision.contentEpoch
      && finalSelection.trackIndex === selection.trackIndex
      && finalSelection.slotIndex === selection.slotIndex,
    { revision, finalRevision, selection, finalSelection });
} finally {
  await adapter.close();
}

process.exit(failureCount() === 0 ? 0 : 1);
