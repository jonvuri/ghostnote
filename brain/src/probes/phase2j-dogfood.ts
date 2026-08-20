/** Ordinary MCP client for the second real musical dogfood session. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

interface OperationChange {
  readonly changeId: string;
  readonly applied: boolean;
}

interface OperationStatus {
  readonly operationId: string;
  readonly state: string;
  readonly terminal: boolean;
  readonly elapsedMs: number;
  readonly changes: readonly OperationChange[];
  readonly result?: Record<string, unknown>;
  readonly error?: string;
}

interface TrackResult {
  readonly trackId: string;
  readonly name: string;
  readonly kind: string;
}

const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/mcp-server.ts'] });
const mcp = new Client({ name: 'phase2j-dogfood', version: '1.0.0' });
const rawRequest = 'Duplicate the Harmony track and add two clips to it that are each a different '
  + 'minor chord progression in the same key as Lead with interesting, complex, and open voicings.';
const targetName = 'Harmony – Open Minor';
const targetRows = [5, 6] as const;

const parse = (value: unknown): Record<string, unknown> => {
  const content = (value as { content?: { type: string; text?: string }[] }).content ?? [];
  const result = content.find((item) => item.type === 'text')?.text;
  if (result === undefined) throw new Error('the MCP call returned no text result');
  return JSON.parse(result) as Record<string, unknown>;
};

const call = async (name: string, args: Record<string, unknown> = {}) =>
  parse(await mcp.callTool({ name, arguments: args }));

async function timedCall(
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ readonly result: Record<string, unknown>; readonly elapsedMs: number }> {
  const startedAt = Date.now();
  const result = await call(name, args);
  return { result, elapsedMs: Date.now() - startedAt };
}

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTerminal(operationId: string): Promise<{
  readonly status: OperationStatus;
  readonly clientElapsedMs: number;
}> {
  const startedAt = Date.now();
  for (;;) {
    const status = await call('inspect_clip_music_operation', {
      operationId,
    }) as unknown as OperationStatus;
    if (status.terminal) return { status, clientElapsedMs: Date.now() - startedAt };
    if (Date.now() - startedAt > 180_000) {
      throw new Error(`operation ${operationId} did not become terminal within 180000 ms`);
    }
    await sleep(250);
  }
}

const note = (
  startBeats: number,
  pitch: number,
  velocity: number,
) => ({ startBeats, pitch, velocity, durationBeats: 7.5 });

const chord = (
  startBeats: number,
  pitches: readonly number[],
  velocity: number,
) => pitches.map((pitch) => note(startBeats, pitch, velocity));

const progressionOne = [
  ...chord(0, [53, 60, 63, 67, 80], 82), // Fm9
  ...chord(8, [55, 62, 65, 70, 72], 78), // Gm11
  ...chord(16, [51, 58, 62, 65, 79], 80), // Ebmaj9
  ...chord(24, [48, 55, 58, 62, 65, 75], 76), // Cm11
];

const progressionTwo = [
  ...chord(0, [53, 60, 63, 67, 70, 80], 80), // Fm11
  ...chord(8, [56, 63, 67, 70, 84], 76), // Abmaj9
  ...chord(16, [46, 53, 56, 60, 62, 79], 82), // Bb13
  ...chord(24, [51, 58, 62, 65, 79], 78), // Ebmaj9
];

let connected = false;
let instructionId: string | undefined;
let copiedTrackId: string | undefined;
let musicChangeId: string | undefined;
let readyForOperator = false;

async function deleteOwnedTrack(): Promise<void> {
  if (copiedTrackId === undefined) return;
  const removed = await call('delete_track', { trackIds: [copiedTrackId] });
  if (removed['applied'] !== true) throw new Error('the copied track was not removed');
  copiedTrackId = undefined;
}

try {
  await mcp.connect(transport);
  connected = true;

  const connection = await call('check_connection');
  if (connection['project'] !== '26.05-2 moon') {
    throw new Error(`expected project 26.05-2 moon, got ${String(connection['project'])}`);
  }
  const listed = await call('list_tracks') as unknown as { readonly tracks?: readonly TrackResult[] };
  const harmony = listed.tracks?.find((track) => track.name === 'Harmony');
  if (harmony === undefined) throw new Error('the Harmony track is absent');
  if (listed.tracks?.some((track) => track.name === targetName) === true) {
    throw new Error(`${targetName} already exists; no retry can claim it as this run's copy`);
  }

  const begun = await call('record_observation', {
    operation: 'begin',
    requestedScope: 'mixed',
    rawScope: rawRequest,
  });
  instructionId = begun['instructionId'] as string;

  const copied = await timedCall('copy_track', { trackId: harmony.trackId, name: targetName });
  const copiedAddress = copied.result['copied'] as { readonly trackId?: string } | undefined;
  if (copied.result['applied'] !== true
      || copied.result['copyConfirmed'] !== true
      || copied.result['nameConfirmed'] !== true
      || typeof copiedAddress?.trackId !== 'string') {
    throw new Error('the Harmony track copy was not confirmed and named');
  }
  copiedTrackId = copiedAddress.trackId;

  const created = await timedCall('add_clip', {
    clips: targetRows.map((row) => ({ trackId: copiedTrackId, row, lengthBeats: 32 })),
  });
  if (created.result['applied'] !== true || typeof created.result['changeId'] !== 'string') {
    throw new Error('the two progression clips were not created');
  }

  const patch = {
    schema: 'ghostnote-musical-patch',
    version: 1,
    protection: { kind: 'direct' },
    targets: [progressionOne, progressionTwo].map((notes, index) => ({
      clip: { trackId: copiedTrackId, row: targetRows[index] },
      channel: 0,
      write: 'merge',
      operations: [{ op: 'generate', source: { kind: 'notes', notes } }],
    })),
  };
  const started = await timedCall('start_clip_music_operation', {
    operation: 'generation', patch,
  });
  const accepted = started.result as unknown as OperationStatus;
  if (typeof accepted.operationId !== 'string' || accepted.terminal) {
    throw new Error('the musical operation did not return a non-terminal id');
  }
  const completed = await waitForTerminal(accepted.operationId);
  if (completed.status.state !== 'completed'
      || completed.status.result?.['applied'] !== true
      || completed.status.changes.length !== 1
      || completed.status.changes[0]?.applied !== true) {
    throw new Error(
      `the musical operation did not complete exactly: ${JSON.stringify(completed.status)}`,
    );
  }
  musicChangeId = completed.status.changes[0].changeId;

  const firstRead = await timedCall('read_clip', {
    trackId: copiedTrackId, row: targetRows[0], channel: 0,
  });
  const secondRead = await timedCall('read_clip', {
    trackId: copiedTrackId, row: targetRows[1], channel: 0,
  });
  const noteCounts = [firstRead, secondRead].map((read) =>
    Array.isArray(read.result['notes']) ? read.result['notes'].length : -1);
  if (noteCounts[0] !== progressionOne.length || noteCounts[1] !== progressionTwo.length) {
    throw new Error(`independent readback returned note counts ${noteCounts.join(', ')}`);
  }
  await call('show_changed_clip', {
    changeId: musicChangeId,
    target: { trackId: copiedTrackId, row: targetRows[0] },
  });

  readyForOperator = true;
  console.log(JSON.stringify({
    readyForOperator,
    instructionId,
    copiedTrackId,
    trackName: targetName,
    keyInterpretation: 'F Dorian',
    progressions: [
      { row: targetRows[0], chords: ['Fm9', 'Gm11', 'Ebmaj9', 'Cm11'] },
      { row: targetRows[1], chords: ['Fm11', 'Abmaj9', 'Bb13', 'Ebmaj9'] },
    ],
    latencyMs: {
      copyTrack: copied.elapsedMs,
      addTwoClips: created.elapsedMs,
      operationStart: started.elapsedMs,
      operationServer: completed.status.elapsedMs,
      operationClientPolling: completed.clientElapsedMs,
      readFirstClip: firstRead.elapsedMs,
      readSecondClip: secondRead.elapsedMs,
    },
    noteCounts,
    decision: 'type keep or revert',
  }));

  process.stdin.setEncoding('utf8');
  for await (const input of process.stdin) {
    const decision = input.trim().toLowerCase();
    if (decision === 'keep') {
      await call('record_observation', {
        operation: 'enrich', instructionId, operatorResponse: 'accepted',
      });
      break;
    }
    if (decision === 'revert') {
      await deleteOwnedTrack();
      musicChangeId = undefined;
      await call('record_observation', {
        operation: 'enrich', instructionId, operatorResponse: 'vetoed',
      });
      break;
    }
    console.log(JSON.stringify({ waiting: true, decision: 'type keep or revert' }));
  }
} catch (error) {
  if (!readyForOperator && copiedTrackId !== undefined) {
    try { await deleteOwnedTrack(); } catch { /* The primary error is reported below. */ }
  }
  if (instructionId !== undefined) {
    try {
      await call('record_observation', { operation: 'enrich', instructionId });
    } catch { /* The primary error is reported below. */ }
  }
  throw error;
} finally {
  if (connected) await mcp.close();
}
