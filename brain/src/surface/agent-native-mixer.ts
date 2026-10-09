/**
 * 8i7: `read_track_mixer` and `set_track_mixer` of `agent-native-v1` (E257, D48).
 *
 * Both tools address tracks by durable trackId. One snapshot reads the track rows and every mixer field of every
 * named track (`track.mixer`, one host turn). The write reads the prior fields, refuses every invalid input,
 * unsupported kind, and automated field before the first write, and writes only the fields that differ. The
 * executor then records the prior value of each written field from that read, writes the fields of all tracks in
 * one stage, and reads them back independently. Each field is one durable address, so `revert_change` restores a field only
 * while it still holds what the change left there.
 *
 * Units (E257): volume is in dB, `60 * log10(raw)` of the host raw value; silence is `-inf`; the maximum is
 * +6.0206 dB. Pan is -1 (full left) to 1 (full right). The host display text is reported beside the value and is
 * never parsed.
 *
 * This module imports only types from `tools.ts`, so there is no import cycle.
 */
import { z } from 'zod';

import {
  MIXER_FIELDS, MIXER_TRACK_KINDS, VOLUME_DB_MAX, VOLUME_DB_MIN, addressKey, mixer as mixerAt, sameMixerValue,
  track as trackAt, volumeDbOfRaw, volumeDbProblem, volumeRawOfDb,
  type Address, type MixerField, type MixerFieldState, type Op, type Snapshot, type TrackState, type VolumeDb,
} from '../contract/index.js';
import { takeAppliedAnything } from '../engine/index.js';
import type { StashedChangeset } from '../stash/index.js';
import {
  AGENT_NATIVE_TOOL_PROFILE, ToolFailure, combinedReadbackStatus, failureResult, readbackUnavailableWarning,
  type Effect, type FailureStage, type ReadbackStatus, type ReadResult, type Warning, type WriteResult,
} from './agent-native-result.js';
import type { ToolSpec } from './tools.js';
import { atMost, requireWithinLimit } from './write-limits.js';
import type { Workspace } from './workspace.js';

export const TRACK_MIXER_SCHEMA = 'ghostnote-track-mixer/1';
export const TRACK_MIXER_SET_SCHEMA = 'ghostnote-track-mixer-set/1';

const PROFILE = `Profile ${AGENT_NATIVE_TOOL_PROFILE}.`;
const FAILURE_FIELDS = ['schema', 'failure.code', 'failure.stage', 'failure.effects', 'message', 'retryWhen', 'detail'];
const WRITE_FIELDS = ['schema', 'applied', 'effects', 'readback', 'next', 'warnings', 'timing', 'target'];
const READ_FIELDS = ['schema', 'source', 'target', 'coverage', 'authority', 'data', 'warnings', 'timing'];

/** Volume in dB is reported to this precision. The host stores the raw value exactly (E257). */
const DB_DIGITS = 4;
const roundDb = (db: VolumeDb): VolumeDb => db === '-inf' ? db : Number(db.toFixed(DB_DIGITS));

const trackId = z.string().min(1).describe('Durable track ID from list_tracks.');
const volumeDb = z.union([z.number(), z.literal('-inf')]);

// --- shared pieces -------------------------------------------------------------------------

interface RunState {
  stage: FailureStage;
  effects: Effect[];
}

async function guardedRun(
  schema: string,
  target: Readonly<Record<string, unknown>>,
  body: (state: RunState) => Promise<unknown>,
): Promise<unknown> {
  const state: RunState = { stage: 'input', effects: [] };
  try {
    return await body(state);
  } catch (error) {
    const failure = failureResult(schema, state.stage, error, target);
    return state.effects.length === 0 ? failure
      : { ...failure, failure: { ...failure.failure, effects: [...state.effects, ...failure.failure.effects] } };
  }
}

function requireDistinct(ids: readonly string[]): void {
  if (new Set(ids).size !== ids.length) {
    throw new ToolFailure('invalid-input', 'input', 'Each trackId can appear only once. Nothing was read or written.');
  }
}

/** The addresses of one snapshot: the track rows and the four fields of each track. */
function mixerAddresses(ids: readonly string[]): Address[] {
  return ids.flatMap((id) => [trackAt(id), ...MIXER_FIELDS.map((field) => mixerAt(trackAt(id), field))]);
}

interface MixerRow {
  readonly track: TrackState;
  readonly fields: Readonly<Record<MixerField, MixerFieldState>>;
}

/**
 * The track row and the four fields of each track, from one snapshot. Refuse before any write: an absent or
 * unreachable track, an unobserved field, and an unsupported kind.
 */
function rowsOf(snapshot: Snapshot, ids: readonly string[]): MixerRow[] {
  const keys = (list: readonly Address[]): Set<string> => new Set(list.map(addressKey));
  const unreachable = keys(snapshot.unreachable);
  const unstable = keys(snapshot.unstable);
  return ids.map((id) => {
    const entry = snapshot.entries[addressKey(trackAt(id))];
    if (unreachable.has(addressKey(trackAt(id)))) {
      throw new ToolFailure('outside-limit', 'resolve', `The track ${id} is outside the tracks that this connection `
        + 'can address. Nothing was written.');
    }
    if (entry?.value.of !== 'track') {
      throw new ToolFailure('absent', 'resolve', `The trackId ${id} does not name a track. Use list_tracks. `
        + 'Nothing was written.');
    }
    const track = entry.value.track;
    if (!(MIXER_TRACK_KINDS as readonly string[]).includes(track.type)) {
      throw new ToolFailure('unsupported', 'resolve', `A ${track.type} track mixer is not supported. Nothing was `
        + 'written.', { detail: { reason: 'track-kind', trackId: id, kind: track.type, supported: MIXER_TRACK_KINDS } });
    }
    const fields = {} as Record<MixerField, MixerFieldState>;
    for (const field of MIXER_FIELDS) {
      const key = addressKey(mixerAt(trackAt(id), field));
      const value = snapshot.entries[key]?.value;
      if (value?.of !== 'mixer' || unstable.has(key)) {
        throw new ToolFailure('authority-unavailable', 'acquire', `The mixer of track ${id} did not read back. `
          + 'Nothing was written.', { retryWhen: 'once; then list_tracks' });
      }
      fields[field] = value.mixer;
    }
    return { track, fields };
  });
}

/** The public form of one track's mixer. */
function publicMixer(fields: Readonly<Record<MixerField, MixerFieldState>>) {
  return {
    volume: { db: roundDb(volumeDbOfRaw(fields.volume.value as number)), display: fields.volume.display ?? null,
      automated: fields.volume.automated === true },
    pan: { value: fields.pan.value, automated: fields.pan.automated === true },
    mute: fields.mute.value,
    solo: fields.solo.value,
  };
}

// --- read_track_mixer -------------------------------------------------------------------------

const readInput = z.object({
  trackIds: z.array(trackId).min(1).describe(`Each track to read, once. ${atMost('trackMixerTracks', 'tracks')}`),
}).strict();
type ReadInput = z.infer<typeof readInput>;

const READ_DESCRIPTION = `${PROFILE} Read the mixer of tracks: volume, pan, mute, and solo. volume.db is the track `
  + `fader gain in dB (Bitwig shows it as volume.display); "-inf" is silence, and the maximum is +6.02 dB. `
  + 'pan.value is -1 (full left) through 0 (centre) to 1 (full right). solo is the solo button of the track. '
  + 'automated is true when the track volume or pan has automation: set_track_mixer refuses to write that field. '
  + 'Instrument, Audio, Hybrid, Effect, and Group tracks are supported; a Master track refuses (code unsupported). '
  + `Nothing changes. One call reads at most 8 tracks; a larger request refuses (code outside-limit).`;

async function readTrackMixer(workspace: Workspace, args: ReadInput): Promise<unknown> {
  const target = { trackIds: args.trackIds };
  return guardedRun(TRACK_MIXER_SCHEMA, target, async (state) => {
    requireWithinLimit('trackMixerTracks', args.trackIds.length, 'tracks');
    requireDistinct(args.trackIds);
    state.stage = 'resolve';
    const started = performance.now();
    const snapshot = await workspace.read(mixerAddresses(args.trackIds));
    const rows = rowsOf(snapshot, args.trackIds);
    const result: ReadResult<unknown> = {
      schema: TRACK_MIXER_SCHEMA,
      source: { host: 'bitwig', read: 'track-mixer' },
      target,
      coverage: { tracks: rows.length },
      authority: { kind: 'live-host-read', units: { volume: 'dB, 60 * log10(host raw value)', pan: '-1..1' } },
      data: {
        tracks: rows.map((row) => ({
          trackId: row.track.channelId, name: row.track.name, kind: row.track.type, ...publicMixer(row.fields),
        })),
      },
      warnings: [],
      timing: { totalMs: Math.round(performance.now() - started) },
    };
    return result;
  });
}

// --- set_track_mixer --------------------------------------------------------------------------

const setInput = z.object({
  tracks: z.array(z.object({
    trackId,
    volumeDb: volumeDb.optional().describe(`Track fader gain in dB, ${VOLUME_DB_MIN} to +6.02, or "-inf" for silence. `
      + '0 is unity gain.'),
    pan: z.number().optional().describe('-1 is full left, 0 is centre, 1 is full right.'),
    mute: z.boolean().optional().describe('True mutes the track.'),
    solo: z.boolean().optional().describe('True solos the track. Other solo buttons do not change.'),
  }).strict()).min(1).describe(`One entry for each track, each trackId once. ${atMost('trackMixerTracks', 'tracks')}`),
}).strict();
type SetInput = z.infer<typeof setInput>;
type SetEntry = SetInput['tracks'][number];

const SET_DESCRIPTION = `${PROFILE} Set the mixer of tracks: volume in dB, pan, mute, and solo. An omitted field `
  + 'does not change. volumeDb is the track fader gain: 0 is unity, -18 is 18 dB down, "-inf" is silence, and the '
  + `range is ${VOLUME_DB_MIN} to +6.02 dB (the Bitwig maximum). Ghostnote writes the exact host value for the `
  + 'requested dB; Bitwig shows it rounded to 0.1 dB. pan is -1 (full left) to 1 (full right). solo is not '
  + 'exclusive: other solo buttons do not change, and while any track is soloed Bitwig silences the tracks without '
  + 'solo. Each change is audible at once if the transport plays. A field that has automation refuses before any '
  + 'write (code unsupported, reason automation): remove the automation in Bitwig first. Every input, track, and '
  + 'field is checked before the first write; a value outside its range refuses (code range). A project or scene '
  + 'change after the read refuses with no write (code stale-address); call again. A field that '
  + 'already holds the requested value is not written (readback status unchanged). Independent readback proves '
  + 'each written field (verified or differs; unavailable, with warning readback-unavailable, when the readback '
  + 'read failed: the write stays, so read_track_mixer before another write). revert_change restores each field that still holds what this '
  + 'change left; a field that a person changed since stays. Instrument, Audio, Hybrid, Effect, and Group tracks '
  + 'are supported. Selection and group folding do not change. One call sets at most 8 tracks; a larger request '
  + 'refuses (code outside-limit).';

/** The requested raw value of each named field of one entry. */
function requestedOf(entry: SetEntry): Partial<Record<MixerField, number | boolean>> {
  return {
    ...(entry.volumeDb === undefined ? {} : { volume: volumeRawOfDb(entry.volumeDb) }),
    ...(entry.pan === undefined ? {} : { pan: entry.pan }),
    ...(entry.mute === undefined ? {} : { mute: entry.mute }),
    ...(entry.solo === undefined ? {} : { solo: entry.solo }),
  };
}

/** Refuse every invalid entry before any project read. */
function validate(args: SetInput): void {
  requireWithinLimit('trackMixerTracks', args.tracks.length, 'tracks');
  requireDistinct(args.tracks.map((entry) => entry.trackId));
  for (const entry of args.tracks) {
    if (Object.keys(requestedOf(entry)).length === 0) {
      throw new ToolFailure('invalid-input', 'input', `The entry for track ${entry.trackId} names no field. Give `
        + 'volumeDb, pan, mute, or solo. Nothing was read or written.');
    }
    const volume = entry.volumeDb === undefined ? undefined : volumeDbProblem(entry.volumeDb);
    if (volume !== undefined) {
      throw new ToolFailure('range', 'input', `${volume}. Nothing was read or written.`, {
        detail: { trackId: entry.trackId, field: 'volumeDb', requested: entry.volumeDb,
          minimum: VOLUME_DB_MIN, maximum: Number(VOLUME_DB_MAX.toFixed(DB_DIGITS)), silence: '-inf' } });
    }
    if (entry.pan !== undefined && !(Number.isFinite(entry.pan) && entry.pan >= -1 && entry.pan <= 1)) {
      throw new ToolFailure('range', 'input', 'pan must be from -1 to 1. Nothing was read or written.', {
        detail: { trackId: entry.trackId, field: 'pan', requested: entry.pan, minimum: -1, maximum: 1 } });
    }
  }
}

type FieldStatus = 'verified' | 'unchanged' | 'differs' | 'unavailable';

async function setTrackMixer(workspace: Workspace, args: SetInput): Promise<unknown> {
  const target = { trackIds: args.tracks.map((entry) => entry.trackId) };
  return guardedRun(TRACK_MIXER_SET_SCHEMA, target, async (state) => {
    validate(args);
    state.stage = 'resolve';
    const started = performance.now();
    const ids = args.tracks.map((entry) => entry.trackId);
    const prior = await workspace.read(mixerAddresses(ids));
    const rows = rowsOf(prior, ids);
    state.stage = 'guard';
    const automated = args.tracks.flatMap((entry, index) => (['volume', 'pan'] as const)
      .filter((field) => requestedOf(entry)[field] !== undefined && rows[index]!.fields[field].automated === true)
      .map((field) => ({ trackId: entry.trackId, field })));
    if (automated.length > 0) {
      throw new ToolFailure('unsupported', 'guard', 'A requested field has automation, and automation playback '
        + 'would override a written value. Nothing was written. Remove the automation in Bitwig, or omit the field.',
      { detail: { reason: 'automation', fields: automated } });
    }
    // Only a field that differs from the prior value is written. The order is the input order.
    const ops: Op[] = [];
    for (const [index, entry] of args.tracks.entries()) {
      for (const [field, value] of Object.entries(requestedOf(entry)) as [MixerField, number | boolean][]) {
        if (sameMixerValue(value, rows[index]!.fields[field].value)) continue;
        ops.push({ op: 'mixer.set', mixer: mixerAt(trackAt(entry.trackId), field), value });
      }
    }
    let change: StashedChangeset | undefined;
    if (ops.length > 0) {
      state.stage = 'write';
      // The prior read is the stash: the executor writes no second resolve or stash read, and its revision guard
      // refuses the write whole when Ghostnote wrote anything since that read.
      change = await workspace.apply(ops, { parameterPreflight: prior });
      if (!takeAppliedAnything(change.take)) {
        throw new ToolFailure('target-changed', 'write', 'The project changed before the write. Nothing was '
          + 'written.', { retryWhen: 'after the project stops changing' });
      }
      state.effects.push({ changeId: change.take.id, target, summary: `Set ${ops.length} mixer field(s) on `
        + `${new Set(ops.map((op) => op.op === 'mixer.set' ? op.mixer.track.channelId : '')).size} track(s).`,
      fidelity: change.take.fidelity });
    }
    state.stage = 'readback';
    const failedOps = change?.take.report.failed ?? [];
    const unread = new Set((change?.take.report.unverified ?? []).map((item) => addressKey(item.address)));
    const tracks = args.tracks.map((entry, index) => {
      const row = rows[index]!;
      const fields: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(requestedOf(entry)) as [MixerField, number | boolean][]) {
        const key = addressKey(mixerAt(trackAt(entry.trackId), field));
        const prior = row.fields[field];
        const written = ops.some((op) => op.op === 'mixer.set' && addressKey(op.mixer) === key);
        const seen = written ? change!.take.verify.entries[key]?.value : { of: 'mixer' as const, mixer: prior };
        const status: FieldStatus = !written ? 'unchanged'
          : unread.has(key) || seen?.of !== 'mixer' ? 'unavailable'
            : sameMixerValue(value, seen.mixer.value) ? 'verified' : 'differs';
        const observed = seen?.of === 'mixer' ? seen.mixer : undefined;
        fields[field] = field === 'volume'
          ? { status, requestedDb: entry.volumeDb, db: observed === undefined ? null
            : roundDb(volumeDbOfRaw(observed.value as number)), display: observed?.display ?? null }
          : { status, requested: value, value: observed?.value ?? null };
      }
      return { trackId: entry.trackId, name: row.track.name, fields };
    });
    const statuses = tracks.flatMap((item) => Object.values(item.fields).map((field) => (field as { status: FieldStatus }).status));
    const changedSome = statuses.includes('verified') || statuses.includes('differs');
    if (failedOps.length > 0) {
      throw new ToolFailure(changedSome || statuses.includes('unavailable') ? 'partial' : 'target-changed', 'write',
        'Bitwig refused a field write at execution, after the checks of this call. The other fields stay as '
          + 'readback.tracks shows. failure.effects lists the change; revert_change reverses its written fields.',
        { detail: { tracks, failed: failedOps.map((item) => item.error ?? item.op) } });
    }
    // 8i8: a written field that did not read back is unavailable, not a failure of the write. The change stays.
    const warnings: Warning[] = [
      ...(ops.length === 0 ? [] : [{ code: 'immediate-playback',
        message: 'Each mixer change is audible at once if the transport plays.' }]),
      ...(statuses.includes('unavailable') ? [readbackUnavailableWarning('the mixer with read_track_mixer')] : []),
    ];
    const result: WriteResult<unknown> = {
      schema: TRACK_MIXER_SET_SCHEMA,
      applied: ops.length > 0,
      effects: state.effects,
      readback: { status: ops.length === 0 ? 'unchanged'
        : combinedReadbackStatus(statuses.filter((item): item is ReadbackStatus => item !== 'unchanged')),
      tracks },
      ...(change === undefined ? {} : { next: { revert: { tool: 'revert_change', changeId: change.take.id } } }),
      warnings,
      timing: { totalMs: Math.round(performance.now() - started) },
    };
    return { ...result, target };
  });
}

// --- the profile pieces ---------------------------------------------------------------------

const spec = (
  name: string, kind: ToolSpec['kind'], title: string, description: string, input: z.ZodObject,
  schema: string, emits: ToolSpec['emits'], run: ToolSpec['run'],
): ToolSpec => ({
  name, kind, title, description, inputSchema: input.shape, inputValidator: input, emits,
  resultContract: { schema, profile: AGENT_NATIVE_TOOL_PROFILE,
    envelope: kind === 'read' ? READ_FIELDS : WRITE_FIELDS, failure: FAILURE_FIELDS,
    ...(kind === 'read' ? {} : { readbackStatus: ['verified', 'differs', 'unavailable', 'unchanged'] }) },
  run,
});

/** The 8i7 additions of `agent-native-v1`. */
export const AGENT_NATIVE_MIXER_TOOLS: readonly ToolSpec[] = [
  spec('read_track_mixer', 'read', 'Read the mixer of tracks', READ_DESCRIPTION, readInput, TRACK_MIXER_SCHEMA, [],
    (workspace, input) => readTrackMixer(workspace, input as ReadInput)),
  spec('set_track_mixer', 'write', 'Set the mixer of tracks', SET_DESCRIPTION, setInput, TRACK_MIXER_SET_SCHEMA,
    ['mixer.set'], (workspace, input) => setTrackMixer(workspace, input as SetInput)),
];
