/** Create, transform, verify, and remove the Phase 6e live note fixture. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

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
  readonly [key: string]: unknown;
}

interface ClipRead {
  readonly readable: boolean;
  readonly clipExists: boolean;
  readonly lengthBeats: number;
  readonly notes: readonly Note[];
}

interface LiveState {
  readonly schema: 'ghostnote-semantic-live-v0';
  readonly clip_id: string;
  readonly identity: {
    readonly kind: 'live-bitwig-launcher-clip';
    readonly project: string;
    readonly track_id: string;
    readonly row: number;
    readonly length_beats: number;
    readonly channel: 0;
    readonly clip_sha256: string;
  };
  readonly notes: readonly Note[];
  readonly baseline_tracks: readonly Track[];
}

interface Transform {
  readonly schema: 'ghostnote-semantic-transform-v0';
  readonly source_identity: LiveState['identity'];
  readonly before: readonly Note[];
  readonly after: readonly Note[];
  readonly invariants: Readonly<Record<string, boolean>>;
}

const TRACK_NAME = 'gn-6e-semantic-live';
const ROW = 0;
const LENGTH_BEATS = 4;
const sourceNotes: readonly Note[] = [
  ...chord(0, [36, 48, 55, 64]),
  ...chord(1, [41, 53, 57, 60]),
  ...chord(2, [43, 55, 59, 65]),
  ...chord(3, [36, 48, 52, 55, 59]),
];

function chord(startBeats: number, pitches: readonly number[]): readonly Note[] {
  return pitches.map((pitch) => ({ startBeats, pitch, velocity: 82, durationBeats: 1 }));
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

function noteOrder(left: Note, right: Note): number {
  return left.startBeats - right.startBeats || left.pitch - right.pitch;
}

function normalizedNotes(notes: readonly Note[]): readonly Note[] {
  return notes.map((value) => ({ ...value })).sort(noteOrder);
}

function clipHash(lengthBeats: number, notes: readonly Note[]): string {
  return hash({ lengthBeats, channel: 0, notes: normalizedNotes(notes) });
}

function exactNotes(left: readonly Note[], right: readonly Note[]): boolean {
  return stable(normalizedNotes(left)) === stable(normalizedNotes(right));
}

function coreNotes(notes: readonly Note[]): readonly Note[] {
  return normalizedNotes(notes).map((value) => ({
    startBeats: value.startBeats,
    pitch: value.pitch,
    velocity: value.velocity,
    durationBeats: value.durationBeats,
  }));
}

function exactCoreNotes(left: readonly Note[], right: readonly Note[]): boolean {
  return stable(coreNotes(left)) === stable(coreNotes(right));
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const mode = argument('--mode');
const statePath = argument('--state');
const transformPath = argument('--transform');
const outputPath = argument('--output');
if (mode === undefined || statePath === undefined) {
  throw new Error('use --mode prepare|adopt|apply|cleanup and --state PATH');
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['--import', 'tsx', 'src/mcp-server.ts'],
});
const mcp = new Client({ name: 'phase6e-live-clip', version: '1.0.0' });

function parse(value: unknown): Record<string, unknown> {
  const result = value as {
    readonly isError?: boolean;
    readonly content?: readonly { readonly type: string; readonly text?: string }[];
  };
  const text = result.content?.find((item) => item.type === 'text')?.text;
  if (result.isError === true || text === undefined) throw new Error(text ?? 'the public call failed');
  return JSON.parse(text) as Record<string, unknown>;
}

async function call(name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  return parse(await mcp.callTool({ name, arguments: args }));
}

async function tracks(): Promise<readonly Track[]> {
  const result = await call('list_tracks') as unknown as { readonly tracks?: readonly Track[] };
  if (!Array.isArray(result.tracks)) {
    throw new Error(`list_tracks returned no track list: ${JSON.stringify(result)}`);
  }
  return result.tracks;
}

async function readClip(trackId: string): Promise<ClipRead> {
  return await call('read_clip', { trackId, row: ROW, channel: 0 }) as unknown as ClipRead;
}

async function safeCleanup(state: LiveState): Promise<boolean> {
  const found = (await tracks()).find((track) => track.trackId === state.identity.track_id);
  if (found === undefined) return false;
  if (found.name !== TRACK_NAME) throw new Error('the owned live track was renamed; cleanup refused');
  const clip = await readClip(found.trackId);
  const currentHash = clipHash(clip.lengthBeats, clip.notes);
  const allowed = new Set([state.identity.clip_sha256]);
  if (transformPath !== undefined) {
    const transform = JSON.parse(await readFile(transformPath, 'utf8')) as Transform;
    allowed.add(clipHash(LENGTH_BEATS, transform.after));
  }
  if (!clip.clipExists || !allowed.has(currentHash)) {
    throw new Error(`the owned live clip changed to ${currentHash}; cleanup refused`);
  }
  const removed = await call('delete_track', { trackIds: [found.trackId] });
  if (removed['applied'] !== true) throw new Error('the owned live track did not delete');
  return true;
}

async function prepare(): Promise<LiveState> {
  const connection = await call('check_connection');
  const project = String(connection['project'] ?? '');
  const baseline = await tracks();
  const residues = baseline.filter((track) => track.name === TRACK_NAME);
  if (residues.length > 0) {
    if (residues.length !== 1) throw new Error(`several ${TRACK_NAME} tracks exist; recovery refused`);
    const residue = await readClip(residues[0]!.trackId);
    if (!residue.clipExists || residue.lengthBeats !== LENGTH_BEATS
        || !exactCoreNotes(residue.notes, sourceNotes)) {
      throw new Error(`${TRACK_NAME} exists with foreign content; recovery refused`);
    }
    if (mode === 'adopt') {
      const state: LiveState = {
        schema: 'ghostnote-semantic-live-v0', clip_id: 'bounded-live-progression',
        identity: {
          kind: 'live-bitwig-launcher-clip', project, track_id: residues[0]!.trackId, row: ROW,
          length_beats: residue.lengthBeats, channel: 0,
          clip_sha256: clipHash(residue.lengthBeats, residue.notes),
        },
        notes: normalizedNotes(residue.notes),
        baseline_tracks: baseline
          .filter((track) => track.trackId !== residues[0]!.trackId)
          .map((track, position) => ({ ...track, position })),
      };
      await writeFile(statePath!, `${JSON.stringify(state, null, 2)}\n`);
      return state;
    }
    throw new Error(`${TRACK_NAME} exists; use --mode adopt after you verify the failed-run fixture`);
  }
  const added = await call('add_track', { names: [TRACK_NAME] }) as {
    readonly applied?: boolean;
    readonly creationConfirmed?: boolean;
    readonly namesConfirmed?: boolean;
    readonly created?: readonly { readonly trackId?: string }[];
  };
  const trackId = added.created?.[0]?.trackId;
  if (added.applied !== true || added.creationConfirmed !== true
      || added.namesConfirmed !== true || trackId === undefined) {
    throw new Error(`the live track was not created exactly: ${JSON.stringify(added)}`);
  }
  try {
    const created = await call('add_clip', {
      clips: [{ trackId, row: ROW, lengthBeats: LENGTH_BEATS, notes: sourceNotes }],
    });
    if (created['applied'] !== true) throw new Error('the live clip was not created');
    const read = await readClip(trackId);
    if (!read.readable || !read.clipExists || read.lengthBeats !== LENGTH_BEATS
        || !exactCoreNotes(read.notes, sourceNotes)) {
      throw new Error(`live source readback differs: ${JSON.stringify(read)}`);
    }
    const state: LiveState = {
      schema: 'ghostnote-semantic-live-v0',
      clip_id: 'bounded-live-progression',
      identity: {
        kind: 'live-bitwig-launcher-clip', project, track_id: trackId, row: ROW,
        length_beats: read.lengthBeats, channel: 0,
        clip_sha256: clipHash(read.lengthBeats, read.notes),
      },
      notes: normalizedNotes(read.notes), baseline_tracks: baseline,
    };
    await writeFile(statePath!, `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } catch (error) {
    const current = await readClip(trackId);
    const provisional: LiveState = {
      schema: 'ghostnote-semantic-live-v0', clip_id: 'bounded-live-progression',
      identity: {
        kind: 'live-bitwig-launcher-clip', project, track_id: trackId, row: ROW,
        length_beats: LENGTH_BEATS, channel: 0,
        clip_sha256: clipHash(current.lengthBeats, current.notes),
      },
      notes: normalizedNotes(current.notes), baseline_tracks: baseline,
    };
    await safeCleanup(provisional);
    throw error;
  }
}

async function applyTransform(state: LiveState, transform: Transform): Promise<Record<string, unknown>> {
  if (transform.schema !== 'ghostnote-semantic-transform-v0'
      || stable(transform.source_identity) !== stable(state.identity)
      || !exactNotes(transform.before, state.notes)
      || Object.values(transform.invariants).some((value) => !value)) {
    throw new Error('the transform does not match the exact live source and invariants');
  }
  const before = await readClip(state.identity.track_id);
  if (clipHash(before.lengthBeats, before.notes) !== state.identity.clip_sha256) {
    throw new Error('the live source changed before transformation');
  }
  const started = Date.now();
  const erased = await call('erase_notes', { clips: [{ trackId: state.identity.track_id, row: ROW }] });
  if (erased['applied'] !== true || typeof erased['changeId'] !== 'string') {
    throw new Error('the source notes were not erased exactly');
  }
  try {
    const written = await call('write_notes', {
      clips: [{ trackId: state.identity.track_id, row: ROW, channel: 0, notes: transform.after }],
    });
    if (written['applied'] !== true) throw new Error('the transformed notes were not written');
  } catch (error) {
    await call('revert_change', { changeId: erased['changeId'] });
    throw error;
  }
  const after = await readClip(state.identity.track_id);
  if (!exactNotes(after.notes, transform.after)) {
    throw new Error(`the transformed readback differs: ${JSON.stringify(after.notes)}`);
  }
  const result = {
    schema: 'ghostnote-semantic-live-readback-v0',
    source_identity: state.identity,
    provider: { name: 'ghostnote-public-clip-surface', version: '0.0.1' },
    before: state.notes, after: normalizedNotes(after.notes),
    before_sha256: state.identity.clip_sha256,
    after_sha256: clipHash(after.lengthBeats, after.notes),
    exact_readback: true, elapsed_ms: Date.now() - started,
    operator_judgment: null,
  };
  if (outputPath !== undefined) await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

try {
  await mcp.connect(transport);
  if (mode === 'prepare' || mode === 'adopt') {
    console.log(JSON.stringify(await prepare(), null, 2));
  } else {
    const state = JSON.parse(await readFile(statePath, 'utf8')) as LiveState;
    if (mode === 'apply') {
      if (transformPath === undefined) throw new Error('--mode apply needs --transform PATH');
      const transform = JSON.parse(await readFile(transformPath, 'utf8')) as Transform;
      let result: Record<string, unknown> | undefined;
      try {
        result = await applyTransform(state, transform);
      } finally {
        await safeCleanup(state);
      }
      const restored = await tracks();
      if (stable(restored) !== stable(state.baseline_tracks)) {
        throw new Error('track cleanup did not restore the exact baseline');
      }
      console.log(JSON.stringify({ ...result, cleanup_confirmed: true }, null, 2));
    } else if (mode === 'cleanup') {
      const removed = await safeCleanup(state);
      console.log(JSON.stringify({ cleanup_confirmed: true, removed }));
    } else {
      throw new Error(`unknown mode: ${mode}`);
    }
  }
} finally {
  await mcp.close();
}
