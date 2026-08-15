/**
 * Phase 1 session 3f — narrow live smoke through the production surface.
 *
 * The transport is stopped first. The probe copies one visible instrument
 * track, verifies the fresh durable id and explicit name through independent
 * reads, checks ordinary change history and reversal reporting, then uses that
 * isolated copy to seed two device alternates through the contract and exercise
 * the production-only switching verb. Finally it removes only the id this run
 * observed minting.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { addressKey, chain, track } from '../contract/index.js';
import { check, client as bridge, failureCount, note } from './lib.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/mcp-server.ts'],
});
const mcp = new Client({ name: 'phase3f-production-probe', version: '0.0.1' });

const parse = (result: unknown): Record<string, unknown> => {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  const payload = content.find((part) => part.type === 'text')?.text ?? '{}';
  return JSON.parse(payload) as Record<string, unknown>;
};

const call = async (name: string, args: Record<string, unknown> = {}) =>
  parse(await mcp.callTool({ name, arguments: args }));

type TrackRow = { trackId: string; name: string; kind: string };

let cleanupId: string | undefined;

try {
  await bridge.connect();
  await bridge.request('transport.stop');
  await mcp.connect(transport);

  const before = await call('list_tracks') as { tracks?: TrackRow[] };
  const source = (before.tracks ?? [])
    .filter((track) => track.kind === 'Instrument')
    .sort((a, b) => Number(b.name === 'gn-A') - Number(a.name === 'gn-A'))[0];
  check('3f-P0: a measured instrument track is visible', source !== undefined, before);
  if (source === undefined) throw new Error('no visible instrument track');

  const beforeIds = new Set((before.tracks ?? []).map((track) => track.trackId));
  const name = `gn-3f-copy-${process.pid}`;
  const copied = await call('copy_track', { trackId: source.trackId, name }) as {
    applied?: boolean;
    copyConfirmed?: boolean;
    nameConfirmed?: boolean;
    changeId?: string;
    copied?: { trackId?: string } | null;
    namingChange?: { changeId?: string; applied?: boolean };
  };
  cleanupId = copied.copied?.trackId;

  const after = await call('list_tracks') as { tracks?: TrackRow[] };
  const fresh = (after.tracks ?? []).filter((track) => !beforeIds.has(track.trackId));
  if (cleanupId === undefined && fresh.length === 1) cleanupId = fresh[0]!.trackId;

  check('3f-P1: bounded structural readback returns one fresh durable id',
    copied.applied === true
      && copied.copyConfirmed === true
      && typeof cleanupId === 'string'
      && cleanupId !== source.trackId
      && fresh.some((track) => track.trackId === cleanupId),
    { copied, fresh });
  check('3f-P2: the explicit name is independently visible on the copied track',
    copied.nameConfirmed === true
      && fresh.some((track) => track.trackId === cleanupId && track.name === name),
    { copied, fresh });

  const changes = await call('list_changes', { limit: 10 }) as {
    changes?: { changeId: string }[];
  };
  const recorded = new Set((changes.changes ?? []).map((change) => change.changeId));
  check('3f-P3: copy and typed naming are both in ordinary change history',
    typeof copied.changeId === 'string'
      && typeof copied.namingChange?.changeId === 'string'
      && recorded.has(copied.changeId)
      && recorded.has(copied.namingChange.changeId),
    { copied, changes });

  const reversal = typeof copied.changeId === 'string'
    ? await call('check_revert', { changeId: copied.changeId })
    : {};
  check('3f-P4: automatic reversal reports that the copied track remains',
    reversal['fullyRestorable'] === false
      && reversal['wouldWriteAnything'] === false
      && Array.isArray(reversal['wouldNotRestore'])
      && reversal['wouldNotRestore'].length > 0,
    reversal);

  // 3f-f owns production creation. Until then the smoke seeds its disposable
  // copied track through the contract, then tests only the new public switch.
  if (cleanupId === undefined) throw new Error('the copied track has no durable id');
  const adapter = new LiveAdapter({ transport: new BridgeTransport(bridge) });
  await adapter.hello();
  const copiedTrack = track(cleanupId);
  const inserted = await adapter.apply({ ops: [{
    op: 'device.insert',
    track: copiedTrack,
    source: { from: 'bitwig', uuid: 'a0913b7f-096b-4ac9-bddd-33c775314b42' },
  }] });
  const container = inserted.minted[0];
  if (container?.kind !== 'device') throw new Error('the disposable container was not observed');
  const initialEntry = (await adapter.read([container])).entries[addressKey(container)];
  const initial = initialEntry?.value.of === 'device'
    ? initialEntry.value.device.container
    : undefined;
  const sourceName = initial?.chains[0]?.name;
  if (sourceName === undefined) throw new Error('the disposable container has no addressable source');
  const alternateName = `gn-3f-switch-${process.pid}`;
  await adapter.apply({ ops: [{
    op: 'chain.create', source: chain(container, sourceName), name: alternateName,
  }] });
  await adapter.apply({ ops: [{ op: 'chain.activate', chain: chain(container, sourceName) }] });

  const switched = await call('switch_device_alternate', {
    trackId: cleanupId,
    containerPosition: container.chainIndex,
    alternateName,
  });
  const finalEntry = (await adapter.read([container])).entries[addressKey(container)];
  const final = finalEntry?.value.of === 'device' ? finalEntry.value.device.container : undefined;
  check('3f-P5: production switching proves exactly the requested active alternate',
    switched['applied'] === true
      && switched['exclusiveStateConfirmed'] === true
      && switched['active'] === alternateName
      && final?.chainsComplete === true
      && final.chains.every((item) => typeof item.solo === 'boolean')
      && final.chains.filter((item) => item.solo).map((item) => item.name).join(',') === alternateName,
    { switched, final });
} catch (error) {
  check('3f-PX: the production smoke completed without an unexpected failure', false, {
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
} finally {
  if (cleanupId !== undefined) {
    try {
      const removed = await call('delete_track', { trackIds: [cleanupId] });
      check('3f-P6: directed cleanup removes the observed copied id',
        removed['applied'] === true && removed['refused'] !== true, removed);
    } catch (error) {
      check('3f-P6: directed cleanup completed without an unexpected failure', false, {
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });
    }
  }
  try { await bridge.request('transport.stop'); } catch { /* already visible above */ }
  try { await mcp.close(); } catch { /* process may already be closed */ }
  bridge.disconnect();
}

note(`Phase 3f production smoke: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
