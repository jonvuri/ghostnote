/**
 * The retained and track tools of `agent-native-v1` on the shared result module (8h4f).
 *
 * The connection, track, change, and modulator-catalog tools keep their host
 * calls; only the envelope changes. A read returns the read envelope; a write
 * returns the write envelope with one effect for each recorded change; a
 * failure returns the failure envelope with a stable code. Places use the one
 * public vocabulary: `track`, `scene`, `launcher_clip`, `device`, and
 * `device_control`, with 1-based note channels.
 *
 * Track kinds (E239): `add_tracks` makes instrument and audio tracks, and
 * `duplicate_track` copies Instrument, Audio, and Hybrid tracks. These are the
 * kinds whose live arms passed. Bitwig has no API route that makes a Hybrid
 * track, and Group, Effect, and Master duplication has no proof.
 *
 * Six tools keep the result body that a session measured (E126 and 8h4e):
 * `read_device_controls`, `set_device_controls`, `read_preset_modulation`,
 * `edit_preset_modulation`, `wrap_existing_device_modulation`, and
 * `reverse_existing_device_modulation_wrap`. `measuredBody` adds the `schema`
 * and, on a refusal or a partial write, the shared `failure` object.
 *
 * This module imports only types from `tools.ts`. `tools.ts` calls
 * `agentNativeRetainedTools` with the stable tools, so there is no import cycle.
 */
import { z } from 'zod';

import {
  CREATABLE_TRACK_KINDS, clip as clipAt, device as deviceAt, isGroupTrack,
  scene as sceneAt, slot as slotAt, track as trackAt,
  type CreatableTrackKind, type Op, type TrackAddress,
} from '../contract/index.js';
import { directedDestruction, takeAppliedAnything, type RunOptions } from '../engine/index.js';
import { selectClip, selectTrack, type Slice, type StashedChangeset } from '../stash/index.js';
import {
  AGENT_NATIVE_TOOL_PROFILE, REFUSAL_CODES, ToolFailure, classifyError, failureResult,
  type Effect, type FailureCode, type FailureStage, type ReadResult, type Warning, type WriteResult,
} from './agent-native-result.js';
import { atMost, requireWithinLimit } from './write-limits.js';
import { checkCursorPins, checkHealth } from './agent-native.js';
import { completeDeviceBank, enabledFingerprint } from './device-controls.js';
import {
  issuedCompositionCheckpoint, previewGeneralDeviceCompositionReversal, runGeneralDeviceCompositionReversal,
} from './general-device-composition.js';
import { runModulatorCatalog } from './modulator-catalog.js';
import { causeOf, receiptOf, reversalReport, type Receipt, type Where } from './report.js';
import type { ToolSpec } from './tools.js';
import { captureWorkspaceChanges, type Workspace } from './workspace.js';

export const CONNECTION_SCHEMA = 'ghostnote-connection/1';
export const TRACKS_SCHEMA = 'ghostnote-tracks/1';
export const CHANGES_SCHEMA = 'ghostnote-changes/1';
export const REVERT_CHECK_SCHEMA = 'ghostnote-revert-check/1';
export const REVERT_SCHEMA = 'ghostnote-revert/1';
export const TRACK_ADD_SCHEMA = 'ghostnote-track-add/1';
export const TRACK_DUPLICATE_SCHEMA = 'ghostnote-track-duplicate/1';
export const TRACK_RENAME_SCHEMA = 'ghostnote-track-rename/1';
export const TRACK_DELETE_SCHEMA = 'ghostnote-track-delete/1';
export const DEVICE_ENABLED_SCHEMA = 'ghostnote-device-enabled/1';
export const MODULATOR_TYPES_SCHEMA = 'ghostnote-modulator-types/1';

/** The track kinds that `duplicate_track` copies (E239). The names are the Bitwig track types. */
export const DUPLICABLE_TRACK_KINDS = ['Instrument', 'Audio', 'Hybrid'] as const;

/** The six tools that keep a measured result body, with their schema IDs. */
export const MEASURED_BODY_SCHEMAS: Readonly<Record<string, string>> = {
  read_device_controls: 'ghostnote-device-controls/1',
  set_device_controls: 'ghostnote-device-controls-set/1',
  read_preset_modulation: 'ghostnote-preset-modulation/1',
  edit_preset_modulation: 'ghostnote-preset-modulation-edit/1',
  wrap_existing_device_modulation: 'ghostnote-device-modulation-wrap/1',
  reverse_existing_device_modulation_wrap: 'ghostnote-device-modulation-unwrap/1',
};

const PROFILE = `Profile ${AGENT_NATIVE_TOOL_PROFILE}.`;
const FAILURE_FIELDS = ['schema', 'failure.code', 'failure.stage', 'failure.effects', 'message', 'retryWhen', 'detail'];
const WRITE_FIELDS = ['schema', 'applied', 'effects', 'readback', 'next', 'warnings', 'timing', 'target'];
const READ_FIELDS = ['schema', 'source', 'target', 'coverage', 'authority', 'data', 'warnings', 'timing'];

const trackId = z.string().min(1).describe('Durable track ID from list_tracks.');
const trackName = z.string().min(1).describe('Exact track name.');

// --- shared pieces -------------------------------------------------------------

interface RunState {
  stage: FailureStage;
  effects: Effect[];
}

/** Run one tool body. A throw becomes the failure envelope with the effects that happened first. */
async function guardedRun(
  schema: string,
  target: Readonly<Record<string, unknown>> | undefined,
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

function effectOf(change: StashedChangeset, target: Readonly<Record<string, unknown>>, summary: string): Effect {
  return { changeId: change.take.id, target, summary, fidelity: change.take.fidelity };
}

/** One public place: the shared nouns, a 1-based note channel, and no internal address kinds. */
export function placeOf(where: Where): Readonly<Record<string, unknown>> {
  const { what, channel, ...rest } = where;
  const noun = what === 'row' ? 'scene'
    : what === 'slot' || what === 'clip' || what === 'notes' ? 'launcher_clip'
      : what === 'parameter' ? 'device_control' : what;
  return { what: noun, ...rest, ...(channel === undefined ? {} : { channel: channel + 1 }) };
}

/** `verified` when the executor's independent readback agrees with every op (D15); `differs` otherwise. */
const statusOf = (receipt: Receipt): 'verified' | 'differs' =>
  receipt.applied && receipt.failed === undefined && receipt.mismatches === undefined
    && receipt.notReadBack === undefined ? 'verified' : 'differs';

/** A change that the revision guard refused whole wrote nothing. */
function requireApplied(change: StashedChangeset): void {
  if (!takeAppliedAnything(change.take)) {
    throw new ToolFailure('target-changed', 'write', 'The project changed before the write. Nothing was written.', {
      retryWhen: 'after the project stops changing' });
  }
}

const coverageOf = (window: { readonly count: number; readonly bankSize: number }) => ({
  addressable: window.bankSize, inProject: window.count < 0 ? null : window.count,
});

// --- check_bitwig_connection ---------------------------------------------------------

const CONNECTION_DESCRIPTION = `${PROFILE} Check that Bitwig runs with the matching Ghostnote extension, and read `
  + 'which project is open and how many tracks and scenes this connection can address. data.health is healthy, '
  + 'or outside-limit when the project has more tracks or scenes than the connection can address: other tools then '
  + 'refuse, because a target outside the window is invisible, not empty. A stale or different extension build, '
  + 'no open project, or an extension track handle that is not held in place is a failure with code unhealthy. '
  + 'Such a handle can follow and change the selection, so every tool that checks health then refuses.';

async function checkConnection(workspace: Workspace): Promise<unknown> {
  return guardedRun(CONNECTION_SCHEMA, undefined, async (state) => {
    state.stage = 'resolve';
    const at = await workspace.mark();
    const over = at.window.tracks.count > at.window.tracks.bankSize || at.window.scenes.count > at.window.scenes.bankSize;
    if (!over) checkHealth(at);
    else if (at.project.length === 0) checkHealth(at);
    else checkCursorPins(at);
    const result: ReadResult<unknown> = {
      schema: CONNECTION_SCHEMA,
      source: { host: 'bitwig', read: 'revision-mark' },
      target: { project: at.project },
      coverage: { tracks: coverageOf(at.window.tracks), scenes: coverageOf(at.window.scenes) },
      authority: { kind: 'fresh-read' },
      data: { reachable: true, project: at.project, health: over ? 'outside-limit' : 'healthy' },
      warnings: over ? [{ code: 'outside-limit', message: 'The project has more tracks or scenes than this '
        + 'connection can address. Raise tracks or scenes in ~/.ghostnote/rig.json and reload the controller.' }] : [],
    };
    return result;
  });
}

// --- list_tracks -------------------------------------------------------------------

const LIST_TRACKS_DESCRIPTION = `${PROFILE} List every track that this connection can address, with its durable `
  + 'trackId. The ID survives renaming and reordering; a track that is deleted and made again has a new ID. kind is '
  + 'the Bitwig track type: Instrument, Audio, Hybrid, Group, Effect, or Master. Tracks inside a group are listed, '
  + 'also when the group is collapsed. A group track has group true: its Launcher slots mirror the clips of its '
  + 'child tracks, so Launcher clip tools refuse it with code group-slot. When the project has more tracks than '
  + 'the connection can address, coverage.status is partial and coverage.notListed counts the tracks left out.';

async function listTracks(workspace: Workspace): Promise<unknown> {
  return guardedRun(TRACKS_SCHEMA, undefined, async (state) => {
    state.stage = 'acquire';
    const at = await workspace.mark();
    if (at.project.length === 0) checkHealth(at);
    const tracks = await workspace.tracks();
    const notListed = at.window.tracks.count < 0 ? null : Math.max(0, at.window.tracks.count - tracks.length);
    const warnings: Warning[] = notListed === null || notListed > 0 ? [{ code: 'partial', message: 'Some tracks '
      + 'exist and cannot be addressed through this connection. Raise tracks in ~/.ghostnote/rig.json and reload '
      + 'the controller.' }] : [];
    const result: ReadResult<unknown> = {
      schema: TRACKS_SCHEMA,
      source: { host: 'bitwig', read: 'fresh-track-bank-read' },
      target: { project: at.project },
      coverage: { status: warnings.length === 0 ? 'complete' : 'partial', listed: tracks.length, notListed,
        scenes: coverageOf(at.window.scenes) },
      authority: { kind: 'fresh-read' },
      data: {
        tracks: tracks.map((item) => ({
          trackId: item.channelId, name: item.name, kind: item.type, position: item.position,
          ...(isGroupTrack(item) ? { group: true, launcherSlots: 'mirror-children' } : {}),
        })),
      },
      warnings,
    };
    return result;
  });
}

// --- list_changes, check_revert, revert_change -------------------------------------------------

const changeId = z.string().min(1).describe('A change ID from list_changes or from an effect.');
const scope = z.object({
  trackId,
  row: z.number().int().min(0).optional().describe('Zero-based Launcher row: only the clip in this scene.'),
}).strict().optional().describe('Narrow the reversal to one track, or to one Launcher clip. Other places stay.');

const LIST_CHANGES_DESCRIPTION = `${PROFILE} List the changes that this server process wrote, newest first, with `
  + 'what each one can and cannot put back. This is the whole of what revert_change can reverse: an edit from '
  + 'before this connection, or one that a person made in Bitwig, is for Bitwig undo.';

const listChangesInput = z.object({
  limit: z.number().int().min(1).max(200).optional().describe('How many of the newest changes. Default 20.'),
}).strict();

async function listChanges(workspace: Workspace, args: z.infer<typeof listChangesInput>): Promise<unknown> {
  return guardedRun(CHANGES_SCHEMA, undefined, async () => {
    const all = workspace.changes.list();
    const limit = args.limit ?? 20;
    const result: ReadResult<unknown> = {
      schema: CHANGES_SCHEMA,
      source: { host: 'ghostnote', read: 'change-records' },
      target: { scope: 'this-server-process' },
      coverage: { listed: Math.min(limit, all.length), total: all.length },
      authority: { kind: 'change-records' },
      data: {
        changes: all.slice(0, limit).map((summary) => {
          const change = workspace.changes.get(summary.id);
          const receipt = change === undefined ? undefined : receiptOf(change);
          return {
            changeId: summary.id, order: summary.seq, applied: summary.applied, at: summary.createdAtMs,
            places: receipt === undefined ? [] : receipt.places.map(placeOf),
            canBeUndone: receipt?.canBeUndone ?? false,
            cannotBeUndone: (receipt?.cannotBeUndone ?? []).map((item) => ({ where: placeOf(item.where), why: item.why })),
          };
        }),
      },
      warnings: [],
    };
    return result;
  });
}

/** The places of one change that a scope keeps. A missing change refuses with code absent. */
function sliceFor(workspace: Workspace, id: string, narrowed: z.infer<typeof scope>): Slice | undefined {
  const change = workspace.changes.require(id);
  if (narrowed === undefined) return undefined;
  const addresses = workspace.changes.readSetFor(id);
  const track = trackAt(narrowed.trackId);
  return narrowed.row === undefined ? selectTrack(addresses, track)
    : selectClip(addresses, clipAt(slotAt(track, sceneAt(narrowed.row, change.take.at.sceneEpoch))));
}

const revertInput = z.object({ changeId, scope }).strict();
type RevertInput = z.infer<typeof revertInput>;

const CHECK_REVERT_DESCRIPTION = `${PROFILE} Read what revert_change would restore for one change, and what it would `
  + 'not, without a write. Each place is compared with what the change left there. A place that a person edited '
  + 'since, or a slot that a clip moved into or out of, stays and is reported in data.wouldNotRestore. For a '
  + 'compose_devices change ID, the guards of the first reversal stage run without a write; data.wouldWriteAnything '
  + 'is false, with data.why, when they refuse. A change ID that this server process did not write refuses with '
  + 'code absent.';

async function checkRevert(workspace: Workspace, args: RevertInput): Promise<unknown> {
  const target = { changeId: args.changeId, ...(args.scope === undefined ? {} : { scope: args.scope }) };
  return guardedRun(REVERT_CHECK_SCHEMA, target, async (state) => {
    state.stage = 'resolve';
    const checkpoint = args.scope === undefined ? issuedCompositionCheckpoint(workspace, args.changeId) : undefined;
    let data: Record<string, unknown>;
    if (checkpoint !== undefined) {
      state.stage = 'guard';
      const preview = await previewGeneralDeviceCompositionReversal(workspace, checkpoint);
      data = {
        compositionReversal: true, wouldWriteAnything: preview.wouldWrite,
        ...(preview.why === undefined ? {} : { why: preview.why }),
        ...(preview.wouldWrite ? {
          wouldRestore: 'the original top-level order: moved existing devices go back to their positions',
          wouldRemove: 'only the owned sources and the owned container, each after its complete guards',
        } : {}),
        completedStages: checkpoint.completedEntries.length,
      };
    } else {
      const slice = sliceFor(workspace, args.changeId, args.scope);
      state.stage = 'guard';
      const plan = await workspace.planRevert(args.changeId, slice);
      const report = reversalReport(plan, workspace.changes.require(args.changeId).take.targets);
      data = {
        wouldWriteAnything: plan.ops.length > 0, fullyRestorable: report.fullyRestorable,
        wouldRestore: report.wouldRestore.map(placeOf),
        wouldNotRestore: report.wouldNotRestore.map((item) => ({ ...item,
          ...(item.where === undefined ? {} : { where: placeOf(item.where) }) })),
        caveats: report.caveats,
      };
    }
    const result: ReadResult<unknown> = {
      schema: REVERT_CHECK_SCHEMA, source: { host: 'bitwig', read: 'fresh-read-of-each-place' }, target,
      coverage: { status: 'complete' }, authority: { kind: 'change-record-and-fresh-read' }, data, warnings: [],
    };
    return result;
  });
}

const REVERT_DESCRIPTION = `${PROFILE} Reverse one change that this server process wrote, from what the change `
  + 'recorded before it ran. Use it when the person asks for it. Only places that still hold exactly what the '
  + 'change left are written: a place that a person edited since, or a slot that a clip moved into or out of, stays '
  + 'and is reported in readback.notRestored. A rebuilt clip gets its recorded notes, length, name, colour, loop, '
  + 'and launch settings back; its play-stop marker and automation do not come back. A compose_devices change ID '
  + '(next.revert) reverses the whole composition: moved existing devices go back, and only the owned sources and '
  + 'the owned container are removed, each stage after its guards. The reversal is a change of its own: its effect '
  + 'has the new change ID. When nothing is ours to put back, applied is false and readback.status is '
  + 'nothing-to-revert. check_revert answers the same question without a write.';

async function revertChange(workspace: Workspace, args: RevertInput): Promise<unknown> {
  const target = { changeId: args.changeId, ...(args.scope === undefined ? {} : { scope: args.scope }) };
  return guardedRun(REVERT_SCHEMA, target, async (state) => {
    state.stage = 'resolve';
    const checkpoint = args.scope === undefined ? issuedCompositionCheckpoint(workspace, args.changeId) : undefined;
    if (checkpoint !== undefined) {
      state.stage = 'write';
      const captured = await captureWorkspaceChanges(workspace,
        (scoped) => runGeneralDeviceCompositionReversal(scoped, { checkpoint }));
      for (const change of captured.changes.filter((item) => takeAppliedAnything(item.take))) {
        state.effects.push(effectOf(change, { undoOf: args.changeId }, 'One stage of the composition reversal.'));
      }
      const body = captured.result;
      if (body['complete'] !== true) {
        throw new ToolFailure(state.effects.length === 0 ? 'target-changed' : 'partial',
          state.effects.length === 0 ? 'guard' : 'write', typeof body['why'] === 'string' ? body['why']
            : 'A reversal stage stopped before the composition was reversed. Read the devices again.',
          { detail: { failedStage: body['failedStage'] ?? null, currentLocation: body['currentLocation'] ?? null } });
      }
      const result: WriteResult<unknown> = {
        schema: REVERT_SCHEMA, applied: true, effects: state.effects,
        readback: { status: 'verified', compositionReversal: true, restoredDeviceOrder: body['restoredDeviceOrder'] },
        warnings: [],
      };
      return { ...result, target };
    }
    const slice = sliceFor(workspace, args.changeId, args.scope);
    state.stage = 'guard';
    const plan = await workspace.planRevert(args.changeId, slice);
    const report = reversalReport(plan, workspace.changes.require(args.changeId).take.targets);
    const notRestored = report.wouldNotRestore.map((item) => ({ ...item,
      ...(item.where === undefined ? {} : { where: placeOf(item.where) }) }));
    if (plan.ops.length === 0) {
      const nothing: WriteResult<unknown> = { schema: REVERT_SCHEMA, applied: false, effects: [],
        readback: { status: 'nothing-to-revert', notRestored }, warnings: [] };
      return { ...nothing, target };
    }
    state.stage = 'write';
    // The clearance travels with the plan: a reversal of our own work is the one write that the engine floor lets
    // through.
    const change = await workspace.apply(plan.ops, { clearance: plan.clearance });
    requireApplied(change);
    state.effects.push(effectOf(change, { undoOf: args.changeId }, `Reverted change ${args.changeId}.`));
    const receipt = receiptOf(change);
    const result: WriteResult<unknown> = {
      schema: REVERT_SCHEMA, applied: true, effects: state.effects,
      readback: { status: statusOf(receipt), restored: report.wouldRestore.map(placeOf), notRestored,
        ...(report.caveats.length === 0 ? {} : { caveats: report.caveats }),
        ...(receipt.mismatches === undefined ? {} : { mismatches: receipt.mismatches }) },
      warnings: [],
    };
    return { ...result, target };
  });
}

// --- add_tracks, duplicate_track, rename_track, delete_track --------------------------------------

/** Every named track exists once in the bank. */
async function tracksNamed(workspace: Workspace, ids: readonly string[]) {
  const tracks = await workspace.tracks();
  return ids.map((id) => {
    const found = tracks.filter((item) => item.channelId === id);
    if (found.length !== 1) {
      throw new ToolFailure('absent', 'resolve', `The trackId ${id} does not name exactly one track. Use list_tracks.`);
    }
    return found[0]!;
  });
}

const KIND_TYPES: Readonly<Record<CreatableTrackKind, string>> = { instrument: 'Instrument', audio: 'Audio' };

const addTracksInput = z.object({
  tracks: z.array(z.object({
    name: trackName,
    kind: z.enum(CREATABLE_TRACK_KINDS).optional().describe('instrument (default) or audio.'),
  }).strict()).min(1).max(16).describe('One new track for each entry, in this order.'),
}).strict();
type AddTracksInput = z.infer<typeof addTracksInput>;

const ADD_TRACKS_DESCRIPTION = `${PROFILE} Create instrument or audio tracks, each with its exact name. Bitwig `
  + 'chooses where a new track lands, so no position is accepted: each fresh trackId is read back first and then '
  + 'named in a second change. readback.tracks gives each trackId, name, and kind. A new track is empty, unmuted, '
  + 'and audible when it gets content; an audio track takes audio input. Bitwig has no route that makes a Hybrid, '
  + 'Group, or Effect track. More tracks than this connection can address refuse before a write (code '
  + 'outside-limit). revert_change does not remove a new track: delete it with delete_track.';

async function addTracks(workspace: Workspace, args: AddTracksInput): Promise<unknown> {
  const target = { tracks: args.tracks.length };
  return guardedRun(TRACK_ADD_SCHEMA, target, async (state) => {
    // The adapter refuses a batch that would put a track past the window (assertTrackRoom, outside-limit).
    state.stage = 'write';
    const created = await workspace.apply(args.tracks.map((item): Op => ({ op: 'track.create', name: item.name,
      ...(item.kind === undefined || item.kind === 'instrument' ? {} : { kind: item.kind }) })));
    requireApplied(created);
    const minted = args.tracks.map((_, index) => created.take.receipt.minted[index]);
    const ids = minted.filter((item): item is TrackAddress => item?.kind === 'track');
    state.effects.push(effectOf(created, { trackIds: ids.map((item) => item.channelId) },
      `Created ${ids.length} track(s).`));
    if (ids.length !== args.tracks.length) {
      throw new ToolFailure('unavailable', 'readback', 'Bitwig acknowledged the creation, but not every fresh '
        + 'trackId appeared in the bounded readback. Read list_tracks before any cleanup.',
      { detail: { created: ids.map((item) => item.channelId) } });
    }
    const named = await workspace.apply(ids.map((item, index): Op => ({
      op: 'track.rename', track: item, name: args.tracks[index]!.name })));
    requireApplied(named);
    state.effects.push(effectOf(named, { trackIds: ids.map((item) => item.channelId) }, 'Named the new track(s).'));
    state.stage = 'readback';
    const rows = await workspace.tracks();
    const tracks = ids.map((item, index) => {
      const row = rows.find((candidate) => candidate.channelId === item.channelId);
      const kind = args.tracks[index]!.kind ?? 'instrument';
      return { trackId: item.channelId, name: row?.name ?? null, kind: row?.type ?? null,
        verified: row?.name === args.tracks[index]!.name && row?.type === KIND_TYPES[kind] };
    });
    const result: WriteResult<unknown> = {
      schema: TRACK_ADD_SCHEMA, applied: true, effects: state.effects,
      readback: { status: tracks.every((item) => item.verified) ? 'verified' : 'differs',
        tracks: tracks.map(({ verified: _verified, ...rest }) => rest) },
      warnings: [{ code: 'not-reversible', message: 'revert_change does not remove a new track; use delete_track.' }],
    };
    return { ...result, target };
  });
}

const duplicateInput = z.object({
  trackId,
  name: trackName.describe('The exact name of the copy.'),
}).strict();
type DuplicateInput = z.infer<typeof duplicateInput>;

const DUPLICATE_DESCRIPTION = `${PROFILE} Duplicate one Instrument, Audio, or Hybrid track and give the copy an `
  + 'exact name. Bitwig copies the Launcher and Arranger clips, the devices and their state, the mixer settings, '
  + 'the sends, and the input into a track with a fresh trackId, directly after the source. The copy is audible '
  + 'at once when the source is; loading its devices can glitch the audio and adds engine load. Group, Effect, and '
  + 'Master tracks refuse before a write (code unsupported): their copy is not proved. A full track window '
  + 'refuses before a write (code outside-limit). revert_change does not remove the copy: delete it with '
  + 'delete_track.';

async function duplicateTrack(workspace: Workspace, args: DuplicateInput): Promise<unknown> {
  const target = { trackId: args.trackId };
  return guardedRun(TRACK_DUPLICATE_SCHEMA, target, async (state) => {
    state.stage = 'resolve';
    // The adapter refuses a copy past the track window before the write (assertTrackRoom, outside-limit).
    const [source] = await tracksNamed(workspace, [args.trackId]);
    if (!(DUPLICABLE_TRACK_KINDS as readonly string[]).includes(source!.type)) {
      throw new ToolFailure('unsupported', 'resolve', `Nothing was written. A ${source!.type} track copy is not `
        + 'proved. Only Instrument, Audio, and Hybrid tracks are duplicated.',
      { detail: { reason: 'track-kind', kind: source!.type, supported: DUPLICABLE_TRACK_KINDS } });
    }
    state.stage = 'write';
    const copied = await workspace.apply([{ op: 'track.duplicate', track: trackAt(args.trackId) }]);
    requireApplied(copied);
    const minted = copied.take.receipt.minted[0];
    state.effects.push(effectOf(copied, target, `Duplicated one ${source!.type} track.`));
    if (minted?.kind !== 'track') {
      throw new ToolFailure('unavailable', 'readback', 'Bitwig acknowledged the copy, but no fresh trackId appeared '
        + 'in the bounded readback. Read list_tracks before any cleanup.');
    }
    const named = await workspace.apply([{ op: 'track.rename', track: minted, name: args.name }]);
    requireApplied(named);
    state.effects.push(effectOf(named, { trackId: minted.channelId }, 'Named the copy.'));
    state.stage = 'readback';
    const row = (await workspace.tracks()).find((item) => item.channelId === minted.channelId);
    const result: WriteResult<unknown> = {
      schema: TRACK_DUPLICATE_SCHEMA, applied: true, effects: state.effects,
      readback: { status: row?.name === args.name && row.type === source!.type ? 'verified' : 'differs',
        copy: { trackId: minted.channelId, name: row?.name ?? null, kind: row?.type ?? null,
          position: row?.position ?? null } },
      warnings: [
        { code: 'audible-copy', message: 'The copy plays with the source when the source is audible.' },
        { code: 'not-reversible', message: 'revert_change does not remove the copy; use delete_track.' },
      ],
    };
    return { ...result, target };
  });
}

const renameInput = z.object({
  tracks: z.array(z.object({ trackId, name: trackName.describe('The new exact name.') }).strict()).min(1)
    .describe(atMost('trackBatch', 'tracks')),
}).strict();
type RenameInput = z.infer<typeof renameInput>;

const RENAME_DESCRIPTION = `${PROFILE} Rename tracks. The trackId does not change with the name, so every address `
  + 'stays valid. The change records each previous name; revert_change puts it back. One call renames at most 64 '
  + 'tracks. A larger request refuses before any read or write (code outside-limit, the limit in detail): split it into more calls.';

async function renameTracks(workspace: Workspace, args: RenameInput): Promise<unknown> {
  const target = { trackIds: args.tracks.map((item) => item.trackId) };
  return guardedRun(TRACK_RENAME_SCHEMA, target, async (state) => {
    requireWithinLimit('trackBatch', args.tracks.length, 'tracks');
    // 8h4f: one track read first. The executor records a rename of a missing track as a failed op, not a refusal.
    state.stage = 'resolve';
    await tracksNamed(workspace, args.tracks.map((item) => item.trackId));
    state.stage = 'write';
    const change = await workspace.apply(args.tracks.map((item): Op => ({
      op: 'track.rename', track: trackAt(item.trackId), name: item.name })));
    requireApplied(change);
    state.effects.push(effectOf(change, target, `Renamed ${args.tracks.length} track(s).`));
    const result: WriteResult<unknown> = {
      schema: TRACK_RENAME_SCHEMA, applied: true, effects: state.effects,
      readback: { status: statusOf(receiptOf(change)) }, warnings: [],
    };
    return { ...result, target };
  });
}

const deleteTracksInput = z.object({
  trackIds: z.array(trackId).min(1).describe(`Each track to delete, once. ${atMost('trackBatch', 'tracks')}`),
}).strict();
type DeleteTracksInput = z.infer<typeof deleteTracksInput>;

const DELETE_TRACK_DESCRIPTION = `${PROFILE} Delete tracks with everything on them: every clip, device, and `
  + 'setting. A group track deletes the tracks inside it too. Nothing here can undo it: a track made again has a '
  + 'new trackId, so no record of the old track applies to it. readback.removed names each deleted trackId. One call '
  + 'deletes at most 64 tracks. A larger request refuses before any read or write (code outside-limit, the limit in detail): split it into more calls.';

async function deleteTracks(workspace: Workspace, args: DeleteTracksInput): Promise<unknown> {
  const target = { trackIds: args.trackIds };
  return guardedRun(TRACK_DELETE_SCHEMA, target, async (state) => {
    requireWithinLimit('trackBatch', args.trackIds.length, 'tracks');
    if (new Set(args.trackIds).size !== args.trackIds.length) {
      throw new ToolFailure('invalid-input', 'input', 'Each trackId can appear only once. Nothing was deleted.');
    }
    state.stage = 'resolve';
    const rows = await tracksNamed(workspace, args.trackIds);
    // A lower removal shifts every higher bank position, so remove from the highest position to the lowest.
    const order = rows.map((row) => ({ id: row.channelId, position: row.position }))
      .sort((left, right) => right.position - left.position);
    state.stage = 'write';
    const change = await workspace.apply(order.map((item): Op => ({ op: 'track.delete', track: trackAt(item.id) })),
      { clearance: directedDestruction('delete_track') });
    requireApplied(change);
    state.effects.push(effectOf(change, target, `Deleted ${args.trackIds.length} track(s).`));
    // The executor's structural readback after the write is the independent evidence (D15).
    const status = statusOf(receiptOf(change));
    const result: WriteResult<unknown> = {
      schema: TRACK_DELETE_SCHEMA, applied: true, effects: state.effects,
      readback: { status, removed: status === 'verified' ? args.trackIds : [] },
      warnings: [{ code: 'not-reversible', message: 'revert_change cannot put a deleted track back.' }],
    };
    return { ...result, target };
  });
}

// --- set_device_enabled ----------------------------------------------------------------

const enabledInput = z.object({
  settings: z.array(z.object({
    trackId,
    devicePosition: z.number().int().min(0).describe('Current top-level position from read_devices.'),
    enabled: z.boolean().describe('False bypasses the device.'),
  }).strict()).min(1).describe(atMost('deviceEnabledSettings', 'settings')),
}).strict();
type EnabledInput = z.infer<typeof enabledInput>;

const ENABLED_DESCRIPTION = `${PROFILE} Enable or bypass top-level devices. Each setting reads the complete device `
  + 'order first, and refuses when the device at the position is not the one that the order guard expects. A '
  + 'position is valid only until the next device-order edit; read_devices again after one. Independent readback '
  + 'proves each state. revert_change restores the previous state while the device position is valid. A failure '
  + 'after an earlier setting keeps that setting and lists its effect. One call admits at most 32 settings (about '
  + '0.6 s each). A larger request refuses before any read or write (code outside-limit, the limit in detail): split it into more calls.';

async function setDeviceEnabled(workspace: Workspace, args: EnabledInput): Promise<unknown> {
  const target = { settings: args.settings.length };
  return guardedRun(DEVICE_ENABLED_SCHEMA, target, async (state) => {
    requireWithinLimit('deviceEnabledSettings', args.settings.length, 'settings');
    let verified = true;
    for (const setting of args.settings) {
      state.stage = 'acquire';
      const track = trackAt(setting.trackId);
      const bank = await workspace.devices(track);
      const enabled = enabledFingerprint(bank);
      if (!completeDeviceBank(bank) || enabled === undefined) {
        throw new ToolFailure('authority-unavailable', 'acquire', 'The complete top-level device order and enabled '
          + 'states are not visible.', { retryWhen: 'once; then read_devices' });
      }
      const observed = bank.devices[setting.devicePosition];
      if (observed === undefined) {
        throw new ToolFailure('absent', 'resolve', `Top-level position ${setting.devicePosition} holds no device.`);
      }
      state.stage = 'write';
      const change = await workspace.apply([{
        op: 'device.setEnabled', device: deviceAt(track, setting.devicePosition), enabled: setting.enabled,
        expectedName: observed.name, expectedEnabled: enabled[setting.devicePosition],
        expectedChain: bank.devices.map((item) => item.name), expectedEnabledChain: enabled,
      }]);
      requireApplied(change);
      state.effects.push(effectOf(change, { trackId: setting.trackId, devicePosition: setting.devicePosition },
        `${setting.enabled ? 'Enabled' : 'Bypassed'} ${observed.name}.`));
      if (statusOf(receiptOf(change)) !== 'verified') verified = false;
    }
    const result: WriteResult<unknown> = {
      schema: DEVICE_ENABLED_SCHEMA, applied: true, effects: state.effects,
      readback: { status: verified ? 'verified' : 'differs' }, warnings: [],
    };
    return { ...result, target };
  });
}

// --- list_modulator_types ---------------------------------------------------------------

async function listModulatorTypes(): Promise<unknown> {
  return guardedRun(MODULATOR_TYPES_SCHEMA, undefined, async () => {
    const catalog = runModulatorCatalog();
    const result: ReadResult<unknown> = {
      schema: MODULATOR_TYPES_SCHEMA, source: { host: 'ghostnote', read: 'measured-modulator-catalog' },
      target: { host: catalog['host'] ?? null }, coverage: { totals: catalog['totals'] ?? null },
      authority: { kind: 'measured-catalog' }, data: catalog, warnings: [],
    };
    return result;
  });
}

// --- the six measured bodies ------------------------------------------------------------------

/** The code of one refusal body, from its structured fields. Text is never parsed. */
function refusalCode(body: Readonly<Record<string, unknown>>): FailureCode {
  if (body['allowedParameterDomain'] !== undefined) return 'range';
  if (body['unsupportedValue'] !== undefined || body['inTheWay'] !== undefined) return 'unsupported';
  const reason = body['reason'];
  if (reason === 'group-slot' || reason === 'collapsed-group-row') return REFUSAL_CODES[reason];
  if (body['unexpected'] !== undefined) return 'internal';
  return 'unsupported';
}

/** The code of one read standing that is not stable. */
const STANDING_CODES: Readonly<Record<string, FailureCode>> = {
  missing: 'absent', unreachable: 'outside-limit', unstable: 'authority-unavailable', unavailable: 'unavailable',
};

/**
 * Keep the measured body of one tool and add the shared vocabulary: `schema` first and, on a refusal, a standing
 * that is not stable, an incomplete or partial write, or a throw, the `failure` object with the effects of every
 * recorded change.
 */
export function measuredBody(stable: ToolSpec, schema: string): ToolSpec {
  return {
    ...stable,
    resultContract: { schema, profile: AGENT_NATIVE_TOOL_PROFILE, envelope: 'measured-body',
      failure: ['schema', 'failure.code', 'failure.stage', 'failure.effects', 'why'],
      body: stable.resultContract ?? null },
    run: async (workspace, input) => {
      // The changes are recorded outside the call, so a throw after a write keeps them (E239 review).
      const changes: StashedChangeset[] = [];
      const scoped: Workspace = Object.freeze({
        ...workspace,
        async apply(ops: readonly Op[], options?: RunOptions) {
          const change = await workspace.apply(ops, options);
          changes.push(change);
          return change;
        },
        async applyParameterCohort(ops: readonly Op[], options?: RunOptions) {
          const cohort = await workspace.applyParameterCohort(ops, options);
          changes.push(...cohort);
          return cohort;
        },
      });
      const effectsOf = (): Effect[] => changes.filter((change) => takeAppliedAnything(change.take))
        .map((change) => effectOf(change, { tool: stable.name }, 'One recorded write.'));
      let body: Record<string, unknown>;
      try {
        body = await stable.run(scoped, input) as Record<string, unknown>;
      } catch (error) {
        const effects = effectsOf();
        const failure = failureResult(schema, 'write', error);
        // A throw after a recorded write is a partial write: the effects name what to inspect or reverse.
        return effects.length === 0 ? failure
          : { ...failure, failure: { code: 'partial' as FailureCode, stage: 'readback' as FailureStage, effects },
            message: 'The tool stopped after a recorded write. failure.effects lists each change; revert_change '
              + 'reverses it.' };
      }
      const effects = effectsOf();
      const standing = body['standing'];
      const cause = causeOf(body);
      // A cause that the shared classifier does not know (internal) keeps the code of the body fields.
      const classified = cause === undefined ? 'internal' : classifyError(cause).code;
      // An incomplete workflow with no applied stage (E239 review): a stage that the revision guard rejected is
      // target-changed; another stage that wrote nothing is authority-unavailable.
      const rejected = changes.some((change) => change.take.report.rejected !== undefined);
      const failed = body['refused'] === true ? { code: classified === 'internal' ? refusalCode(body) : classified,
        stage: 'guard' as FailureStage }
        : body['partialSuccess'] === true || body['partialCompletion'] === true || body['partialReversal'] === true
          ? { code: 'partial' as FailureCode, stage: 'write' as FailureStage }
          : body['complete'] === false
            ? effects.length > 0 ? { code: 'partial' as FailureCode, stage: 'write' as FailureStage }
              : { code: (rejected ? 'target-changed' : 'authority-unavailable') as FailureCode,
                stage: (rejected ? 'guard' : 'write') as FailureStage }
            : typeof standing === 'string' && standing !== 'stable' && STANDING_CODES[standing] !== undefined
              ? { code: STANDING_CODES[standing]!, stage: 'acquire' as FailureStage }
              : body['supported'] === false ? { code: 'unsupported' as FailureCode, stage: 'project' as FailureStage }
                : undefined;
      return { schema, ...(failed === undefined ? {} : { failure: { ...failed, effects } }), ...body };
    },
  };
}

// --- the profile pieces -------------------------------------------------------------

/**
 * The stable tools that 8h4f renames in `agent-native-v1`, each with its replacement. The migration contract has
 * one row for each.
 */
export const AGENT_NATIVE_RETAINED_RETIRED: Readonly<Record<string, string>> = {
  check_connection: 'check_bitwig_connection',
  add_track: 'add_tracks',
  copy_track: 'duplicate_track',
};

const spec = (
  name: string, kind: ToolSpec['kind'], title: string, description: string, input: z.ZodObject,
  schema: string, emits: ToolSpec['emits'], run: ToolSpec['run'], extra: Partial<ToolSpec> = {},
): ToolSpec => ({
  name, kind, title, description, inputSchema: input.shape, inputValidator: input, emits,
  resultContract: { schema, profile: AGENT_NATIVE_TOOL_PROFILE,
    envelope: kind === 'read' ? READ_FIELDS : WRITE_FIELDS, failure: FAILURE_FIELDS },
  run, ...extra,
});

const empty = z.object({}).strict();

/**
 * Build the retained tools of `agent-native-v1`. `replacements` take the place of a stable tool with the same
 * name; `renamed` take the place of a stable tool in `AGENT_NATIVE_RETAINED_RETIRED`, in the same list position.
 */
export function agentNativeRetainedTools(): {
  readonly replacements: ReadonlyMap<string, ToolSpec>;
  readonly renamed: ReadonlyMap<string, ToolSpec>;
} {
  const replacements = new Map<string, ToolSpec>([
    ['list_modulator_types', spec('list_modulator_types', 'read', 'List supported modulator types',
      `${PROFILE} Read the measured modulator catalog for the current Bitwig host: each supported public type, its `
        + 'category, operations, sampled-preset standing, witness mode and requirement, and provenance, and the '
        + 'complete host inventory, where each excluded type has a reason. A note-driven witness needs its recorded '
        + 'trigger. No asset identity or binary field is returned. Nothing changes.',
      empty, MODULATOR_TYPES_SCHEMA, [], () => listModulatorTypes())],
    ['list_tracks', spec('list_tracks', 'read', 'List the project\'s tracks', LIST_TRACKS_DESCRIPTION, empty,
      TRACKS_SCHEMA, [], (workspace) => listTracks(workspace))],
    ['list_changes', spec('list_changes', 'read', 'List the changes of this session', LIST_CHANGES_DESCRIPTION,
      listChangesInput, CHANGES_SCHEMA, [], (workspace, input) => listChanges(workspace, input as never))],
    ['check_revert', spec('check_revert', 'read', 'Check what a reversal would do', CHECK_REVERT_DESCRIPTION,
      revertInput, REVERT_CHECK_SCHEMA, [], (workspace, input) => checkRevert(workspace, input as RevertInput))],
    ['revert_change', spec('revert_change', 'write', 'Reverse one change', REVERT_DESCRIPTION, revertInput,
      REVERT_SCHEMA, ['clip.create', 'clip.delete', 'note.clear', 'note.write', 'track.rename', 'param.set',
        'device.delete', 'device.relocate', 'chain.relocate'],
      (workspace, input) => revertChange(workspace, input as RevertInput), { status: ['reversal'] })],
    ['rename_track', spec('rename_track', 'write', 'Rename tracks', RENAME_DESCRIPTION, renameInput,
      TRACK_RENAME_SCHEMA, ['track.rename'], (workspace, input) => renameTracks(workspace, input as RenameInput))],
    ['set_device_enabled', spec('set_device_enabled', 'write', 'Enable or bypass devices', ENABLED_DESCRIPTION,
      enabledInput, DEVICE_ENABLED_SCHEMA, ['device.setEnabled'],
      (workspace, input) => setDeviceEnabled(workspace, input as EnabledInput))],
    ['delete_track', spec('delete_track', 'destructive', 'Delete tracks', DELETE_TRACK_DESCRIPTION,
      deleteTracksInput, TRACK_DELETE_SCHEMA, ['track.delete'],
      (workspace, input) => deleteTracks(workspace, input as DeleteTracksInput))],
  ]);
  const renamed = new Map<string, ToolSpec>([
    ['check_connection', spec('check_bitwig_connection', 'read', 'Check the connection to Bitwig',
      CONNECTION_DESCRIPTION, empty, CONNECTION_SCHEMA, [], (workspace) => checkConnection(workspace))],
    ['add_track', spec('add_tracks', 'write', 'Create instrument or audio tracks', ADD_TRACKS_DESCRIPTION,
      addTracksInput, TRACK_ADD_SCHEMA, ['track.create', 'track.rename'],
      (workspace, input) => addTracks(workspace, input as AddTracksInput))],
    ['copy_track', spec('duplicate_track', 'write', 'Duplicate a track', DUPLICATE_DESCRIPTION, duplicateInput,
      TRACK_DUPLICATE_SCHEMA, ['track.duplicate', 'track.rename'],
      (workspace, input) => duplicateTrack(workspace, input as DuplicateInput), { status: ['track-copy'] })],
  ]);
  return { replacements, renamed };
}
