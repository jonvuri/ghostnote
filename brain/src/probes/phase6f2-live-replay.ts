/** Replay the selected fine timing contract through the public note surface. */
import { createHash } from 'node:crypto';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const TRACK_NAMES = ['gn-6f2-binary', 'gn-6f2-triplet'] as const;
const HOST_DURATION_QUANTUM = 2 ** -20;

interface Track {
  readonly trackId: string;
  readonly name: string;
  readonly kind: string;
  readonly position: number;
}

interface Note {
  readonly startBeats: number;
  readonly pitch: number;
  readonly velocity: number;
  readonly durationBeats: number;
  readonly releaseVelocity?: number;
  readonly pan?: number;
  readonly timbre?: number;
  readonly gain?: number;
  readonly [key: string]: unknown;
}

interface ClipRead {
  readonly readable: boolean;
  readonly clipExists: boolean;
  readonly lengthBeats: number;
  readonly notes: readonly Note[];
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const bag = value as Record<string, unknown>;
    return `{${Object.keys(bag).sort().map((key) => `${JSON.stringify(key)}:${stable(bag[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function hostDuration(value: number): number {
  return Math.round(value / HOST_DURATION_QUANTUM) * HOST_DURATION_QUANTUM;
}

function core(notes: readonly Note[]): readonly Record<string, unknown>[] {
  return notes.map((note) => ({
    startBeats: note.startBeats,
    pitch: note.pitch,
    velocity: note.velocity,
    durationBeats: note.durationBeats,
    releaseVelocity: note.releaseVelocity,
    pan: note.pan,
    timbre: note.timbre,
    gain: note.gain,
  })).sort((left, right) => Number(left.startBeats) - Number(right.startBeats)
    || Number(left.pitch) - Number(right.pitch));
}

function equivalentNotes(
  actual: readonly Record<string, unknown>[],
  expected: readonly Record<string, unknown>[],
): boolean {
  if (actual.length !== expected.length) return false;
  return actual.every((note, index) => {
    const target = expected[index];
    if (target === undefined) return false;
    const exactKeys = ['startBeats', 'pitch', 'velocity', 'durationBeats', 'gain'] as const;
    const floatKeys = ['releaseVelocity', 'pan', 'timbre'] as const;
    return exactKeys.every((key) => note[key] === target[key])
      && floatKeys.every((key) => Math.abs(Number(note[key] ?? 0) - Number(target[key] ?? 0)) <= 1e-9);
  });
}

function parse(value: unknown): Record<string, unknown> {
  const result = value as {
    readonly isError?: boolean;
    readonly content?: readonly { readonly type: string; readonly text?: string }[];
  };
  const text = result.content?.find((item) => item.type === 'text')?.text;
  if (result.isError === true || text === undefined) throw new Error(text ?? 'the public call failed');
  return JSON.parse(text) as Record<string, unknown>;
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['--import', 'tsx', 'src/mcp-server.ts'],
});
const mcp = new Client({ name: 'phase6f2-live-replay', version: '1.0.0' });
const call = async (name: string, args: Record<string, unknown> = {}) =>
  parse(await mcp.callTool({ name, arguments: args }));
const listTracks = async (): Promise<readonly Track[]> => {
  const result = await call('list_tracks') as { readonly tracks?: readonly Track[] };
  if (!Array.isArray(result.tracks)) throw new Error('list_tracks returned no tracks');
  return result.tracks;
};
const readClip = async (trackId: string): Promise<ClipRead> =>
  await call('read_clip', { trackId, row: 0, channel: 0 }) as unknown as ClipRead;

const binaryNotes: readonly Note[] = [60, 64, 66, 71].map((pitch, index) => ({
  startBeats: 1 / 512,
  pitch,
  velocity: 84 + index,
  durationBeats: 1 / 512,
  releaseVelocity: 0.4 + index * 0.05,
  pan: -0.3 + index * 0.2,
  timbre: 0.2 + index * 0.1,
  gain: 1,
}));
const tripletNotes: readonly Note[] = [52, 56, 62, 65, 70].map((pitch, index) => ({
  startBeats: 1 / 768,
  pitch,
  velocity: 78 + index,
  durationBeats: 1 / 768,
  releaseVelocity: 0.35 + index * 0.05,
  pan: -0.4 + index * 0.2,
  timbre: 0.15 + index * 0.1,
  gain: 1,
}));

await mcp.connect(transport);
const baseline = await listTracks();
const baselineConnection = await call('check_connection');
let ownedIds: string[] = [];
let failed = false;

try {
  if (baseline.some((track) => TRACK_NAMES.includes(track.name as typeof TRACK_NAMES[number]))) {
    throw new Error('a 6f2 live replay track already exists');
  }
  if (baselineConnection['transportPlaying'] === true) throw new Error('stop transport before the live replay');
  const added = await call('add_track', { names: [...TRACK_NAMES] }) as {
    readonly applied?: boolean;
    readonly created?: readonly { readonly trackId?: string }[];
  };
  ownedIds = added.created?.map((item) => item.trackId).filter((item): item is string => item !== undefined) ?? [];
  if (added.applied !== true || ownedIds.length !== 2) throw new Error('the two owned tracks were not created exactly');

  const written = await call('add_clip', { clips: [
    { trackId: ownedIds[0], row: 0, lengthBeats: 4, channel: 0, notes: binaryNotes },
    { trackId: ownedIds[1], row: 0, lengthBeats: 4, channel: 0, notes: tripletNotes },
  ] });
  if (written['applied'] !== true) throw new Error(`the fine clips did not apply: ${JSON.stringify(written)}`);

  const binaryFirst = await readClip(ownedIds[0]!);
  const binarySecond = await readClip(ownedIds[0]!);
  const tripletFirst = await readClip(ownedIds[1]!);
  const tripletSecond = await readClip(ownedIds[1]!);
  const binaryExpected = core(binaryNotes);
  const tripletExpected = core(tripletNotes.map((note) => ({
    ...note, durationBeats: hostDuration(note.durationBeats),
  })));
  const binaryHash = hash(core(binaryFirst.notes));
  const tripletHash = hash(core(tripletFirst.notes));
  if (!equivalentNotes(core(binaryFirst.notes), binaryExpected)
      || !equivalentNotes(core(binarySecond.notes), binaryExpected)) {
    throw new Error(`binary live readback differs: ${JSON.stringify(binaryFirst.notes)}`);
  }
  if (!equivalentNotes(core(tripletFirst.notes), tripletExpected)
      || !equivalentNotes(core(tripletSecond.notes), tripletExpected)) {
    throw new Error(`triplet live readback differs: ${JSON.stringify(tripletFirst.notes)}`);
  }

  const beforeRefusal = hash(core(binarySecond.notes));
  const refused = await call('write_notes', {
    clips: [{
      trackId: ownedIds[0], row: 0, channel: 0,
      notes: [{ startBeats: 1 / 1024, pitch: 90, velocity: 80, durationBeats: 1 / 512 }],
    }],
  });
  const afterRefusal = hash(core((await readClip(ownedIds[0]!)).notes));
  if (refused['refused'] !== true || refused['nothingWasWritten'] !== true
      || beforeRefusal !== afterRefusal) {
    throw new Error(`unsupported precision did not refuse cleanly: ${JSON.stringify(refused)}`);
  }

  console.log(JSON.stringify({
    project: baselineConnection['project'],
    binary: {
      grid_beats: 1 / 512,
      conventional_note_value: '1/2048',
      milliseconds_at_120_bpm: 0.9765625,
      notes: binaryFirst.notes.length,
      readback_sha256: binaryHash,
      repeated_exactly: true,
    },
    triplet: {
      grid_beats: 1 / 768,
      conventional_note_value: 'triplet match for 1/512 beat',
      milliseconds_at_120_bpm: 0.6510416666666666,
      notes: tripletFirst.notes.length,
      readback_sha256: tripletHash,
      maximum_duration_error_beats: Math.abs(hostDuration(1 / 768) - 1 / 768),
      repeated_exactly: true,
    },
    unsupported_precision: {
      requested_start_beats: 1 / 1024,
      refused_before_mutation: true,
      before_sha256: beforeRefusal,
      after_sha256: afterRefusal,
    },
  }, null, 2));
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (ownedIds.length > 0) {
    try {
      const current = await listTracks();
      const owned = current.filter((track) => ownedIds.includes(track.trackId));
      if (owned.some((track) => !TRACK_NAMES.includes(track.name as typeof TRACK_NAMES[number]))) {
        throw new Error('an owned track was renamed; cleanup refused');
      }
      if (owned.length > 0) {
        const removed = await call('delete_track', { trackIds: owned.map((track) => track.trackId) });
        if (removed['applied'] !== true) throw new Error('owned track cleanup did not apply');
      }
      const restored = await listTracks();
      if (stable(restored) !== stable(baseline)) throw new Error('live track baseline did not restore exactly');
      console.log('CLEANUP_CONFIRMED true');
    } catch (error) {
      failed = true;
      console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    }
  }
  await mcp.close();
}

process.exitCode = failed ? 1 : 0;
