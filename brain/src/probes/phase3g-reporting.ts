/** Preserving production smoke for 3g-e reporting and restart closure. */
import assert from 'node:assert/strict';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import {
  decodeObservationRecord,
  reportObservationRecord,
  type InstructionObservation,
  type ObservationReport,
} from '../observation/index.js';
import { Session } from '../session.js';
import { TOOL_DESCRIPTION_VERSION } from '../surface/description-cohort.js';
import { askYesNo, check, client as bridge, failureCount, note } from './lib.js';

const STATE = join(tmpdir(), 'ghostnote-phase3g-reporting.json');
const mode = process.argv[2] ?? 'arm';

interface TrackRow {
  readonly trackId: string;
  readonly name: string;
  readonly kind: string;
}

interface SmokeState {
  readonly originalRecord: string;
  readonly baselineTrackIds: readonly string[];
  readonly cleanupTrackIds: readonly string[];
  readonly expectedCanonicalJson: string;
  readonly expectedReport: ObservationReport;
}

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/mcp-server.ts'],
});
const mcp = new Client({ name: 'phase3g-reporting-probe', version: '0.0.1' });
const recordSession = new Session();

const parse = (result: unknown): Record<string, unknown> => {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  const payload = content.find((part) => part.type === 'text')?.text ?? '{}';
  return JSON.parse(payload) as Record<string, unknown>;
};
const call = async (name: string, args: Record<string, unknown> = {}) =>
  parse(await mcp.callTool({ name, arguments: args }));

const begin = async (
  requestedScope: 'device-only' | 'launcher-clip-only' | 'mixed' | 'unsupported',
  rawScope: unknown,
) => call('record_observation', { operation: 'begin', requestedScope, rawScope });

const enrich = async (
  instructionId: unknown,
  operatorResponse?: 'accepted' | 'vetoed',
) => call('record_observation', {
  operation: 'enrich',
  instructionId,
  ...(operatorResponse === undefined ? {} : { operatorResponse }),
});

async function tracks(): Promise<TrackRow[]> {
  return ((await call('list_tracks'))['tracks'] ?? []) as TrackRow[];
}

async function removeTracks(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const result = await call('delete_track', { trackIds: ids });
  check('3g-e cleanup: disposable tracks are removed',
    result['applied'] === true && result['refused'] !== true, result);
}

async function restore(state: SmokeState): Promise<void> {
  const visible = await tracks();
  const cleanup = state.cleanupTrackIds.filter((id) =>
    visible.some((track) => track.trackId === id));
  await removeTracks(cleanup);

  const restored = await recordSession.observations.replace(state.originalRecord);
  check('3g-e cleanup: the prior record is restored exactly',
    restored.value === state.originalRecord, { restoredChars: restored.value.length });

  const afterIds = (await tracks()).map((track) => track.trackId);
  check('3g-e cleanup: exact baseline track identities are restored',
    JSON.stringify(afterIds) === JSON.stringify(state.baselineTrackIds), { afterIds });
}

async function arm(): Promise<void> {
  const originalRecord = (await recordSession.observations.read()).value;
  const baselineTrackIds = (await tracks()).map((track) => track.trackId);
  const cleanupTrackIds: string[] = [];
  let completed = false;

  try {
    const sourceName = `gn-3g-e-source-${process.pid}`;
    const added = await call('add_track', { names: [sourceName] });
    const sourceTrackId = (added['created'] as { trackId?: string }[] | undefined)?.[0]?.trackId;
    assert.equal(added['creationConfirmed'], true);
    assert.equal(added['namesConfirmed'], true);
    assert.equal(typeof sourceTrackId, 'string');
    cleanupTrackIds.push(sourceTrackId!);

    const clips = await call('add_clip', {
      clips: [0, 2].map((row) => ({
        trackId: sourceTrackId,
        row,
        lengthBeats: 4,
        notes: [{ startBeats: 0, pitch: 60 + row, velocity: 100, durationBeats: 1 }],
      })),
    });
    assert.equal(clips['applied'], true);

    const deviceOnly = await begin('device-only', { case: 'device-only' });
    const device = await call('create_device_alternates', {
      trackId: sourceTrackId,
      containerType: 'effect',
      names: [`gn-3g-e-device-a-${process.pid}`, `gn-3g-e-device-b-${process.pid}`],
    });
    assert.equal(device['creationConfirmed'], true);
    assert.equal(typeof device['managedEventId'], 'string');
    await enrich(deviceOnly['instructionId'], 'accepted');

    const clipOnly = await begin('launcher-clip-only', { case: 'launcher-clip-only' });
    const firstClip = await call('copy_clip_down', {
      trackId: sourceTrackId,
      row: 0,
      quantization: '1',
      mode: 'continue_or_synced',
      useLoopStartAsQuantizationReference: false,
    });
    assert.equal(firstClip['creationConfirmed'], true);
    assert.equal(typeof firstClip['managedEventId'], 'string');
    await enrich(clipOnly['instructionId']);

    const mixed = await begin('mixed', { case: 'mixed', writes: ['device', 'launcher-clip'] });
    const secondDevice = await call('create_device_alternates', {
      trackId: sourceTrackId,
      containerType: 'effect',
      names: [`gn-3g-e-mixed-a-${process.pid}`, `gn-3g-e-mixed-b-${process.pid}`],
    });
    const secondClip = await call('copy_clip_down', {
      trackId: sourceTrackId,
      row: 2,
      quantization: '1',
      mode: 'continue_or_synced',
      useLoopStartAsQuantizationReference: false,
    });
    assert.equal(secondDevice['creationConfirmed'], true);
    assert.equal(secondClip['creationConfirmed'], true);
    assert.notEqual(secondDevice['managedEventId'], secondClip['managedEventId']);
    await enrich(mixed['instructionId'], 'accepted');

    const trackCopy = await begin('unsupported', { case: 'ordinary-track-copy' });
    const copied = await call('copy_track', {
      trackId: sourceTrackId,
      name: `gn-3g-e-copy-${process.pid}`,
    });
    const copiedTrackId = (copied['copied'] as { trackId?: string } | undefined)?.trackId;
    assert.equal(copied['copyConfirmed'], true);
    assert.equal(typeof copied['ordinaryUseId'], 'string');
    assert.equal(typeof copiedTrackId, 'string');
    cleanupTrackIds.push(copiedTrackId!);
    await enrich(trackCopy['instructionId'], 'accepted');

    const veto = await begin('device-only', { case: 'explicit-veto' });
    await enrich(veto['instructionId'], 'vetoed');

    const noAction = await begin('unsupported', { case: 'no-action' });
    await enrich(noAction['instructionId']);

    const raw = await call('read_observation_record') as {
      canonicalJson?: string;
      record?: { entries?: { descriptionVersion?: string }[] };
    };
    const report = await call('report_observations') as unknown as ObservationReport;
    const rawRecord = decodeObservationRecord(raw.canonicalJson!);
    const appended = rawRecord.entries
      .slice(decodeObservationRecord(originalRecord || JSON.stringify({
        format: 'ghostnote-observation-record', schemaVersion: 1, entries: [],
      })).entries.length);
    const appendedInstructions = appended.filter(
      (entry): entry is InstructionObservation => entry.type === 'instruction-observation',
    );

    check('3g-e-P0: the six instructions produce eleven distinct raw rows',
      appended.length === 11
        && appended.filter((entry) => entry.type === 'instruction-observation').length === 6
        && appended.filter((entry) => entry.type === 'managed-event').length === 4
        && appended.filter((entry) => entry.type === 'ordinary-use').length === 1,
      appended);
    check('3g-e-P1: every new raw row carries the frozen description version',
      appended.every((entry) => entry.descriptionVersion === TOOL_DESCRIPTION_VERSION));
    check('3g-e-P2: all six requested-scope, result, and response cases stay distinct',
      appendedInstructions.length === 6
        && appendedInstructions.filter((entry) => entry.operatorResponse === 'accepted').length === 3
        && appendedInstructions.filter((entry) => entry.operatorResponse === 'vetoed').length === 1
        && appendedInstructions.filter((entry) => entry.operatorResponse === 'silent').length === 2
        && appendedInstructions.filter((entry) => entry.resultIds.length === 0).length === 2
        && appendedInstructions.some((entry) => entry.requestedScope === 'device-only')
        && appendedInstructions.some((entry) => entry.requestedScope === 'launcher-clip-only')
        && appendedInstructions.some((entry) => entry.requestedScope === 'mixed')
        && appendedInstructions.some((entry) => entry.requestedScope === 'unsupported'),
      appendedInstructions);
    check('3g-e-P3: raw canonical JSON equals the project store exactly',
      raw.canonicalJson === (await recordSession.observations.read()).value
        && JSON.stringify(report) === JSON.stringify(reportObservationRecord(rawRecord)));
    if (failureCount() !== 0) throw new Error('the reporting arm did not meet its checks');

    const state: SmokeState = {
      originalRecord,
      baselineTrackIds,
      cleanupTrackIds,
      expectedCanonicalJson: raw.canonicalJson!,
      expectedReport: report,
    };
    writeFileSync(STATE, JSON.stringify(state));
    completed = true;
    note(`ARMED: ${appended.length} new rows are loaded; state is ${STATE}.`);
    note('Save the project, quit Bitwig completely, reopen the project, and then run `npm run probe:3g-reporting -- verify`.');
  } finally {
    if (!completed) {
      await restore({
        originalRecord, baselineTrackIds, cleanupTrackIds,
        expectedCanonicalJson: '', expectedReport: {} as ObservationReport,
      });
    }
  }
}

async function verify(): Promise<void> {
  const state = JSON.parse(readFileSync(STATE, 'utf8')) as SmokeState;
  try {
    const raw = await call('read_observation_record') as {
      canonicalJson?: string;
      record?: { entries?: { descriptionVersion?: string }[] };
    };
    const report = await call('report_observations') as unknown as ObservationReport;
    check('3g-e-P4: exact raw data survives save and project reopen',
      raw.canonicalJson === state.expectedCanonicalJson);
    check('3g-e-P5: the complete aggregate report survives save and project reopen',
      JSON.stringify(report) === JSON.stringify(state.expectedReport), report);
    check('3g-e-P6: every restarted raw row keeps the frozen description version',
      raw.record?.entries?.every((entry) =>
        entry.descriptionVersion === TOOL_DESCRIPTION_VERSION) === true);

    const paneOk = await askYesNo(
      'With the test record loaded, is the observation field absent and is the controller settings pane responsive?',
    );
    check('3g-e-P7: the hidden field is absent and the pane remains responsive', paneOk);
  } finally {
    await restore(state);
  }

  if (failureCount() === 0) {
    unlinkSync(STATE);
    note('CLEAN: save the project once more to persist the restored record and track baseline.');
  }
}

async function cleanup(): Promise<void> {
  const state = JSON.parse(readFileSync(STATE, 'utf8')) as SmokeState;
  await restore(state);
  if (failureCount() === 0) unlinkSync(STATE);
}

try {
  await bridge.connect();
  await bridge.request('transport.stop');
  await mcp.connect(transport);
  if (mode === 'arm') await arm();
  else if (mode === 'verify') await verify();
  else if (mode === 'cleanup') await cleanup();
  else throw new Error(`unknown mode: ${mode}`);
} finally {
  try { await bridge.request('transport.stop'); } catch { /* reported by checks above */ }
  try { await mcp.close(); } catch { /* process may already be closed */ }
  await recordSession.close();
  bridge.disconnect();
}

assert.equal(failureCount(), 0);
note(`Phase 3g-e ${mode}: PASS`);
