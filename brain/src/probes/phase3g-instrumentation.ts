/** Focused live smoke for 3g-d production instrumentation and exact cleanup. */
import assert from 'node:assert/strict';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { decodeObservationRecord, emptyObservationRecord } from '../observation/index.js';
import { Session } from '../session.js';
import { TOOL_DESCRIPTION_VERSION } from '../surface/description-cohort.js';
import { check, client as bridge, failureCount, note } from './lib.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/mcp-server.ts'],
});
const mcp = new Client({ name: 'phase3g-instrumentation-probe', version: '0.0.1' });
const recordSession = new Session();

const parse = (result: unknown): Record<string, unknown> => {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  const payload = content.find((part) => part.type === 'text')?.text ?? '{}';
  return JSON.parse(payload) as Record<string, unknown>;
};
const call = async (name: string, args: Record<string, unknown> = {}) =>
  parse(await mcp.callTool({ name, arguments: args }));

type TrackRow = { trackId: string; name: string; kind: string };

let originalRecord: string | undefined;
let sourceTrackId: string | undefined;
let copiedTrackId: string | undefined;
let beforeTrackIds: string[] = [];

try {
  await bridge.connect();
  await bridge.request('transport.stop');
  await mcp.connect(transport);
  originalRecord = (await recordSession.observations.read()).value;
  const original = originalRecord.length === 0
    ? emptyObservationRecord()
    : decodeObservationRecord(originalRecord);

  const before = await call('list_tracks') as { tracks?: TrackRow[] };
  beforeTrackIds = (before.tracks ?? []).map((track) => track.trackId);
  check('3g-d-P0: the baseline track identities are readable', beforeTrackIds.length > 0, before);

  const sourceName = `gn-3g-source-${process.pid}`;
  const added = await call('add_track', { names: [sourceName] }) as {
    creationConfirmed?: boolean;
    namesConfirmed?: boolean;
    created?: { trackId?: string; nameConfirmed?: boolean }[];
  };
  sourceTrackId = added.created?.[0]?.trackId;
  check('3g-d-P1: one disposable source has a confirmed id and exact name',
    added.creationConfirmed === true
      && added.namesConfirmed === true
      && added.created?.[0]?.nameConfirmed === true
      && typeof sourceTrackId === 'string',
    added);
  if (sourceTrackId === undefined) throw new Error('the source track has no durable id');

  const sourceClip = await call('add_clip', {
    clips: [{
      trackId: sourceTrackId,
      row: 0,
      lengthBeats: 4,
      notes: [{ startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1 }],
    }],
  });
  check('3g-d-P2: the disposable source clip exists', sourceClip['applied'] === true, sourceClip);

  const begun = await call('record_observation', {
    operation: 'begin',
    requestedScope: 'mixed',
    rawScope: { request: 'Production smoke', writes: ['device', 'launcher-clip'] },
  });
  check('3g-d-P3: explicit mixed context starts silent',
    begun['recorded'] === true
      && begun['operatorResponse'] === 'silent'
      && typeof begun['instructionId'] === 'string',
    begun);

  const names = [`gn-3g-a-${process.pid}`, `gn-3g-b-${process.pid}`];
  const device = await call('create_device_alternates', {
    trackId: sourceTrackId, containerType: 'effect', names,
  });
  const clip = await call('copy_clip_down', {
    trackId: sourceTrackId,
    row: 0,
    quantization: '1',
    mode: 'continue_or_synced',
    useLoopStartAsQuantizationReference: false,
  });
  check('3g-d-P4: each confirmed creator returns one different managed-event id',
    device['creationConfirmed'] === true
      && clip['creationConfirmed'] === true
      && typeof device['managedEventId'] === 'string'
      && typeof clip['managedEventId'] === 'string'
      && device['managedEventId'] !== clip['managedEventId'],
    { device, clip });

  const containerPosition = (device['structure'] as {
    container?: { devicePosition?: number };
  } | undefined)?.container?.devicePosition;
  const inspected = typeof containerPosition === 'number'
    ? await call('inspect_device_alternates', {
      trackId: sourceTrackId, containerPosition,
    })
    : {};
  check('3g-d-P5: lifecycle inspection reads the object without creating another event',
    inspected['readable'] === true, inspected);

  const enriched = await call('record_observation', {
    operation: 'enrich',
    instructionId: begun['instructionId'],
    rationale: 'The smoke requested both managed object scopes.',
    operatorResponse: 'accepted',
  });
  check('3g-d-P6: explicit enrichment preserves two related result ids',
    enriched['operatorResponse'] === 'accepted'
      && Array.isArray(enriched['resultIds'])
      && enriched['resultIds'].join(',')
        === [device['managedEventId'], clip['managedEventId']].join(','),
    enriched);

  const copied = await call('copy_track', {
    trackId: sourceTrackId, name: `gn-3g-copy-${process.pid}`,
  });
  copiedTrackId = (copied['copied'] as { trackId?: string } | undefined)?.trackId;
  check('3g-d-P7: confirmed track copy returns one ordinary-use id',
    copied['copyConfirmed'] === true
      && typeof copiedTrackId === 'string'
      && typeof copied['ordinaryUseId'] === 'string'
      && copied['managedEventId'] === undefined,
    copied);

  const refused = await call('create_device_alternates', {
    trackId: sourceTrackId, containerType: 'effect', names: ['same', 'same'],
  });
  check('3g-d-P8: refused creation returns no event id',
    refused['refused'] === true && refused['managedEventId'] === undefined,
    refused);

  const stored = decodeObservationRecord((await recordSession.observations.read()).value);
  const appended = stored.entries.slice(original.entries.length);
  check('3g-d-P9: persistence has one instruction, two managed events, and one ordinary use',
    appended.length === 4
      && appended[0]?.type === 'instruction-observation'
      && appended[1]?.type === 'managed-event'
      && appended[2]?.type === 'managed-event'
      && appended[3]?.type === 'ordinary-use'
      && appended.every((entry) => entry.descriptionVersion === TOOL_DESCRIPTION_VERSION),
    appended);
  const managed = appended.filter((entry) => entry.type === 'managed-event');
  check('3g-d-P10: mixed correlation does not merge result or execution identity',
    managed.length === 2
      && new Set(managed.map((entry) => entry.correlationId)).size === 1
      && new Set(managed.map((entry) => entry.id)).size === 2
      && new Set(managed.map((entry) => entry.executionId)).size === 2,
    managed);
} catch (error) {
  check('3g-d-PX: the production smoke completed without an unexpected failure', false, {
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
} finally {
  const cleanupIds = [copiedTrackId, sourceTrackId].filter((id): id is string => id !== undefined);
  if (cleanupIds.length > 0) {
    try {
      const removed = await call('delete_track', { trackIds: cleanupIds });
      check('3g-d-P11: directed cleanup removes both disposable track ids',
        removed['applied'] === true && removed['refused'] !== true, removed);
    } catch (error) {
      check('3g-d-P11: track cleanup completed without an unexpected failure', false, {
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });
    }
  }
  if (originalRecord !== undefined) {
    try {
      const restored = await recordSession.observations.replace(originalRecord);
      check('3g-d-P12: the prior observation record is restored exactly',
        restored.value === originalRecord, { restoredChars: restored.value.length });
    } catch (error) {
      check('3g-d-P12: record cleanup completed without an unexpected failure', false, {
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });
    }
  }
  try {
    const after = await call('list_tracks') as { tracks?: TrackRow[] };
    check('3g-d-P13: cleanup restores the exact baseline track identities',
      JSON.stringify((after.tracks ?? []).map((track) => track.trackId))
        === JSON.stringify(beforeTrackIds),
      after);
  } catch (error) {
    check('3g-d-P13: baseline verification completed without an unexpected failure', false, {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
  try { await bridge.request('transport.stop'); } catch { /* already visible above */ }
  try { await mcp.close(); } catch { /* process may already be closed */ }
  await recordSession.close();
  bridge.disconnect();
}

assert.equal(failureCount(), 0);
note('Phase 3g-d production smoke: PASS');
