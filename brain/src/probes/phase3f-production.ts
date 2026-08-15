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

  // Production creation is exercised through the public surface for both
  // autonomous container cases. Each receives a device only after the
  // container, keeping the positional creation proof inside the observable
  // scopes and making move-based fill deterministic.
  if (cleanupId === undefined) throw new Error('the copied track has no durable id');
  const instrumentNames = [`gn-3f-inst-a-${process.pid}`, `gn-3f-inst-b-${process.pid}`];
  const instrument = await call('create_device_alternates', {
    trackId: cleanupId,
    containerType: 'instrument',
    names: instrumentNames,
  }) as {
    applied?: boolean;
    creationConfirmed?: boolean;
    structure?: {
      complete?: boolean;
      container?: { devicePosition?: number };
      alternates?: { name: string; devices?: unknown[] }[];
    };
  };
  const instrumentPosition = instrument.structure?.container?.devicePosition;
  check('3f-P5: bundled Instrument creation resolves every explicit name',
    instrument.applied === true
      && instrument.creationConfirmed === true
      && instrument.structure?.complete === true
      && instrument.structure.alternates?.map((item) => item.name).join(',') === instrumentNames.join(',')
      && typeof instrumentPosition === 'number',
    instrument);
  if (typeof instrumentPosition !== 'number') throw new Error('instrument container has no position');

  const instrumentDevice = await call('add_device', {
    devices: [{
      trackId: cleanupId,
      from: 'bitwig',
      id: 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef',
    }],
  }) as { added?: { devicePosition?: number }[] };
  const instrumentSource = instrumentDevice.added?.[0]?.devicePosition;
  if (typeof instrumentSource !== 'number') throw new Error('instrument fill source was not observed');
  const instrumentFill = await call('fill_device_alternate', {
    trackId: cleanupId,
    containerPosition: instrumentPosition,
    alternateName: instrumentNames[0],
    sourceDevicePositions: [instrumentSource],
    mode: 'move',
  }) as {
    applied?: boolean;
    finalContainerPosition?: number;
    structure?: { alternates?: { name: string; devices?: unknown[] }[] };
  };
  check('3f-P6: Instrument fill is independently visible in the named destination',
    instrumentFill.applied === true
      && instrumentFill.structure?.alternates
        ?.find((item) => item.name === instrumentNames[0])?.devices?.length === 1,
    instrumentFill);

  const activeInstrumentPosition = instrumentFill.finalContainerPosition ?? instrumentPosition;
  const switched = await call('switch_device_alternate', {
    trackId: cleanupId,
    containerPosition: activeInstrumentPosition,
    alternateName: instrumentNames[1],
  });
  const final = await call('inspect_device_alternates', {
    trackId: cleanupId,
    containerPosition: activeInstrumentPosition,
  }) as {
    complete?: boolean;
    exclusiveActive?: string | null;
    alternates?: { name: string; soloed?: boolean | null }[];
  };
  check('3f-P7: production switching proves exactly the requested soloed alternate',
    switched['applied'] === true
      && switched['exclusiveStateConfirmed'] === true
      && switched['exclusiveActive'] === instrumentNames[1]
      && final.complete === true
      && final.exclusiveActive === instrumentNames[1]
      && final.alternates !== undefined
      && final.alternates.every((item) => typeof item.soloed === 'boolean')
      && final.alternates.filter((item) => item.soloed).map((item) => item.name).join(',') === instrumentNames[1],
    { switched, final });

  const removedInstrument = await call('delete_device', {
    devices: [{ trackId: cleanupId, position: activeInstrumentPosition }],
  });
  if (removedInstrument['applied'] !== true) {
    throw new Error('the disposable Instrument container could not be removed before the effect path');
  }

  const effectNames = [`gn-3f-fx-a-${process.pid}`, `gn-3f-fx-b-${process.pid}`];
  const effect = await call('create_device_alternates', {
    trackId: cleanupId,
    containerType: 'effect',
    names: effectNames,
  }) as {
    applied?: boolean;
    creationConfirmed?: boolean;
    structure?: {
      complete?: boolean;
      container?: { devicePosition?: number };
      alternates?: { name: string; devices?: unknown[] }[];
    };
  };
  const effectPosition = effect.structure?.container?.devicePosition;
  check('3f-P8: fresh effect-container creation resolves every explicit name',
    effect.applied === true
      && effect.creationConfirmed === true
      && effect.structure?.complete === true
      && effect.structure.alternates?.map((item) => item.name).join(',') === effectNames.join(',')
      && typeof effectPosition === 'number',
    effect);
  if (typeof effectPosition !== 'number') throw new Error('effect container has no position');

  const effectDevice = await call('add_device', {
    devices: [{
      trackId: cleanupId,
      from: 'bitwig',
      id: 'f2dcfe9a-7b66-4c84-984a-b25685a1c21a',
    }],
  }) as { added?: { devicePosition?: number }[] };
  const effectSource = effectDevice.added?.[0]?.devicePosition;
  if (typeof effectSource !== 'number') throw new Error('effect fill source was not observed');
  const effectFill = await call('fill_device_alternate', {
    trackId: cleanupId,
    containerPosition: effectPosition,
    alternateName: effectNames[0],
    sourceDevicePositions: [effectSource],
    mode: 'move',
  }) as {
    applied?: boolean;
    structure?: { alternates?: { name: string; devices?: unknown[] }[] };
  };
  check('3f-P9: effect-container fill is independently visible in the named destination',
    effectFill.applied === true
      && effectFill.structure?.alternates
        ?.find((item) => item.name === effectNames[0])?.devices?.length === 1,
    effectFill);

} catch (error) {
  check('3f-PX: the production smoke completed without an unexpected failure', false, {
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
} finally {
  if (cleanupId !== undefined) {
    try {
      const removed = await call('delete_track', { trackIds: [cleanupId] });
      check('3f-P10: directed cleanup removes the observed copied id',
        removed['applied'] === true && removed['refused'] !== true, removed);
    } catch (error) {
      check('3f-P10: directed cleanup completed without an unexpected failure', false, {
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
