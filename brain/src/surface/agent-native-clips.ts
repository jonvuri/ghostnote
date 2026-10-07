/**
 * The Launcher clip and scene tools of `agent-native-v1`, and its generic operation handle (8h4d).
 *
 * Each tool uses the shared result module: a write result with effects and a
 * readback, or a failure with a stable code. Names follow E135: a tool that
 * acts on a Launcher clip says so, and a destructive tool has its own name.
 * Titles and descriptions say scene; only an address says row.
 *
 * D19: a read, navigation, and a launch create no change record. A durable
 * effect (a clip, a copy, a move, a property, a scene) creates one, and its
 * effect carries the change ID.
 *
 * Occupancy (migration contract, "Public read scope"): the copy and move
 * preflight returns the occupancy of every row that it read, also on a dry run
 * and on a refusal. It replaces `inspect_clip_block`.
 *
 * This module imports only types from `tools.ts`; `tools.ts` composes the
 * profile, so there is no import cycle.
 */
import { z } from 'zod';

import {
  LAUNCH_MODES, LAUNCH_QUANTIZATIONS, addressKey, clip as clipAt, clipLaunch as launchAt,
  clipMetadata as metadataAt, clipPlay as playAt, isGroupTrack, scene as sceneAt, slot as slotAt,
  supportedClipColors, track as trackAt,
  type Address, type ClipAddress, type ClipMetadataState, type Op, type RevisionMark, type Snapshot,
} from '../contract/index.js';
import { branchProtected, directedDestruction, takeAppliedAnything } from '../engine/index.js';
import {
  EditRefusal, completeClipProperties, documentClipLength, type ClipPropertyChanges,
} from '../bindings/launcher-clip-edit.js';
import type { StashedChangeset } from '../stash/index.js';
import {
  AGENT_NATIVE_TOOL_PROFILE, ToolFailure, failureResult, isFailureResult,
  type Effect, type FailureStage, type WriteResult,
} from './agent-native-result.js';
import { checkHealth, format } from './agent-native.js';
import { editLauncherClip, parseProposal } from './agent-native-edit.js';
import type { OperationStatus } from './operations.js';
import type { ToolSpec } from './tools.js';
import type { Workspace } from './workspace.js';

export const ADD_SCHEMA = 'ghostnote-launcher-clip-add/1';
export const COPY_SCHEMA = 'ghostnote-launcher-clip-copy/1';
export const MOVE_SCHEMA = 'ghostnote-launcher-clip-move/1';
export const LAUNCH_SETTINGS_SCHEMA = 'ghostnote-launcher-clip-launch-settings/1';
export const PROPERTIES_SCHEMA = 'ghostnote-launcher-clip-properties/1';
export const DELETE_SCHEMA = 'ghostnote-launcher-clip-delete/1';
export const SHOW_SCHEMA = 'ghostnote-launcher-clip-show/1';
export const LAUNCH_SCHEMA = 'ghostnote-launcher-clip-launch/1';
export const SCENES_SCHEMA = 'ghostnote-scenes/1';
export const OPERATION_SCHEMA = 'ghostnote-operation/1';

const PROFILE = `Profile ${AGENT_NATIVE_TOOL_PROFILE}.`;
const FAILURE_FIELDS = ['schema', 'failure.code', 'failure.stage', 'failure.effects', 'message', 'retryWhen', 'detail'];
const WRITE_FIELDS = ['schema', 'applied', 'effects', 'readback', 'next', 'warnings', 'timing', 'target'];

// --- shared pieces -------------------------------------------------------------

const trackId = z.string().min(1).describe('Durable track ID from list_tracks.');
const row = z.number().int().min(0).describe('Zero-based Launcher row of the scene.');
const address = z.object({ trackId, row }).strict();
type Target = z.infer<typeof address>;

const quantization = z.enum(LAUNCH_QUANTIZATIONS).describe('Launch grid: project default, none, or a beat division.');
const mode = z.enum(LAUNCH_MODES).describe(
  'Where playback enters the clip. continue_or_synced follows the outgoing clip position on the grid.');

/** One durable effect of a recorded change. */
function effectOf(change: StashedChangeset, target: Readonly<Record<string, unknown>>, summary: string): Effect {
  return { changeId: change.take.id, target, summary, fidelity: change.take.fidelity };
}

/** A change that the revision guard refused whole applied nothing. */
function requireApplied(change: StashedChangeset): void {
  if (!takeAppliedAnything(change.take)) {
    throw new ToolFailure('target-changed', 'write', 'The project changed before the write. Nothing was written.', {
      retryWhen: 'after the project stops changing' });
  }
}

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
    const failure = failureResult(schema, state.stage, error instanceof EditRefusal
      ? new ToolFailure(error.code, 'plan', error.message, { detail: { reason: error.reason, ...error.detail } })
      : error, target);
    return state.effects.length === 0 ? failure
      : { ...failure, failure: { ...failure.failure, effects: [...state.effects, ...failure.failure.effects] } };
  }
}

/** The current mark, healthy, with every named row inside the project. */
async function markFor(workspace: Workspace, rows: readonly number[]): Promise<RevisionMark> {
  const at = await workspace.mark();
  checkHealth(at);
  const missing = rows.filter((index) => index >= at.window.scenes.count);
  if (missing.length > 0) {
    throw new ToolFailure('absent', 'resolve', `Launcher row ${Math.min(...missing)} is outside the project `
      + `(${at.window.scenes.count} scenes). Add scenes at the end with add_scenes.`,
    { detail: { missingRows: [...new Set(missing)].sort((a, b) => a - b), scenes: at.window.scenes.count } });
  }
  return at;
}

/** Each named track exists exactly once and is not a group track. */
async function requireTracks(workspace: Workspace, ids: readonly string[]): Promise<void> {
  const tracks = await workspace.tracks();
  for (const id of new Set(ids)) {
    const matching = tracks.filter((item) => item.channelId === id);
    if (matching.length !== 1) {
      throw new ToolFailure('absent', 'resolve', `The trackId ${id} does not name exactly one track. Use list_tracks.`);
    }
    if (isGroupTrack(matching[0]!)) {
      throw new ToolFailure('group-slot', 'resolve', 'The track is a group track. Its launcher slots mirror '
        + 'the clips of its child tracks. Address a child track by its trackId.');
    }
  }
}

const clipOf = (target: Target, at: RevisionMark): ClipAddress =>
  clipAt(slotAt(trackAt(target.trackId), sceneAt(target.row, at.sceneEpoch)));

type Occupancy = 'occupied' | 'empty';

/**
 * One occupancy read of the named slots: one `slot.status` each, with no clip capture (8h4d). A slot that the read
 * did not reach refuses with outside-limit.
 */
async function readSlots(workspace: Workspace, targets: readonly Target[], at: RevisionMark, extra: readonly Address[] = []) {
  const clips = targets.map((target) => clipOf(target, at));
  const tracks = [...new Set(targets.map((target) => target.trackId))].map((id) => trackAt(id));
  const read = await workspace.read([...tracks, ...clips, ...extra], { occupancy: true });
  if (read.unreachable.length > 0) {
    throw new ToolFailure('outside-limit', 'acquire', 'A slot is outside the observed track or scene window.');
  }
  const occupancy = (target: Target): Occupancy => {
    const entry = read.entries[addressKey(clipOf(target, at))];
    if (entry?.value.of !== 'clip') {
      throw new ToolFailure('authority-unavailable', 'acquire', 'The fresh host read did not report a slot.', {
        retryWhen: 'once; then check the connection' });
    }
    return entry.value.exists ? 'occupied' : 'empty';
  };
  return { read, occupancy };
}

/**
 * The readback of a write: the executor verify read when it covers every address (it is a new host read after the
 * write, not the writer echo; D15, D38), otherwise one more plain read.
 */
async function readbackOf(
  workspace: Workspace, change: StashedChangeset, addresses: (at: RevisionMark) => readonly Address[],
): Promise<{ entries: Snapshot['entries']; at: RevisionMark }> {
  const verify = change.take.verify;
  if (addresses(verify.at).every((item) => verify.entries[addressKey(item)] !== undefined)) {
    return { entries: verify.entries, at: verify.at };
  }
  const at = await workspace.mark();
  const read = await workspace.read(addresses(at));
  return { entries: read.entries, at };
}

const occupancyIn = (entries: Snapshot['entries'], target: Target, at: RevisionMark): Occupancy | 'unread' => {
  const entry = entries[addressKey(clipOf(target, at))];
  return entry?.value.of !== 'clip' ? 'unread' : entry.value.exists ? 'occupied' : 'empty';
};

// --- add_launcher_clip ---------------------------------------------------------

const addInput = z.object({
  trackId,
  row,
  document: z.union([z.string().min(1), z.record(z.string(), z.unknown())]).describe(
    'A desired Document 1.0 without BASE: one CLIP and its notes. FIELDS text, or JSON when format is json.',
  ),
  format,
  readback: z.enum(['summary', 'document']).optional().describe(
    'summary (default): the new base, IDs, and discrepancies. document: also the read-back document.',
  ),
  background: z.boolean().optional().describe(
    'Return an operation handle at once and run the call in the background. Use inspect_operation.',
  ),
}).strict();
type AddInput = Omit<z.infer<typeof addInput>, 'background'>;

const ADD_DESCRIPTION = `${PROFILE} Create one Launcher clip in an empty slot from a Ghostnote Document 1.0 `
  + 'desired document without BASE (DOC ghostnote-document 1.0 desired, one CLIP). The CLIP length is the clip length '
  + 'in beats. A CLIP without loop makes a clip that does not loop; loop {"from":"0","to":<length>} makes it loop '
  + 'over its length. The notes are written through the edit_launcher_clip path, with its rules and refusals.\n'
  + 'The slot must exist and be empty. An occupied slot refuses with code occupied: Bitwig would put the new clip '
  + 'on a new scene past the reachable rows. A missing row refuses with code absent; add scenes at the end with '
  + 'add_scenes.\n'
  + 'Two changes: the empty clip, then its notes and properties. Result: effects (each with a changeId), and '
  + 'readback from an independent read with the base sha256 and ref for read_launcher_clip, '
  + 'check_launcher_clips, and edit_launcher_clip. A refusal of the content after the clip exists returns the '
  + 'creation in failure.effects; revert_change with its changeId removes the empty clip. To undo a complete '
  + 'add, revert the content change, then the creation (next.revert has both, in order).';

async function addLauncherClip(workspace: Workspace, args: AddInput): Promise<unknown> {
  const started = performance.now();
  const target = { trackId: args.trackId, row: args.row };
  return guardedRun(ADD_SCHEMA, target, async (state) => {
    const proposal = parseProposal(args);
    if (proposal.kind !== 'desired' || proposal.base !== undefined) {
      throw new ToolFailure('invalid-input', 'input', 'add_launcher_clip takes a desired document without BASE.');
    }
    if (proposal.clips.length !== 1) {
      throw new ToolFailure('invalid-input', 'input', 'A desired document for one Launcher clip has exactly one CLIP.');
    }
    const lengthBeats = documentClipLength(proposal.clips[0]!);

    state.stage = 'resolve';
    const at = await markFor(workspace, [args.row]);
    await requireTracks(workspace, [args.trackId]);
    state.stage = 'acquire';
    const { occupancy } = await readSlots(workspace, [target], at);
    if (occupancy(target) === 'occupied') {
      throw new ToolFailure('occupied', 'acquire', 'The slot holds a clip. Nothing was written. Name an empty '
        + 'slot, or edit the clip with edit_launcher_clip.');
    }

    state.stage = 'write';
    const created = await workspace.apply([{ op: 'clip.create', slot: clipOf(target, at).slot, lengthBeats }]);
    requireApplied(created);
    const creation = effectOf(created, target, `Created an empty clip of ${lengthBeats} beats.`);
    state.effects.push(creation);

    // The content goes through the edit limb: an unguarded replacement of the new, empty clip.
    state.stage = 'plan';
    const content = await editLauncherClip(workspace, {
      trackId: args.trackId, row: args.row, document: args.document, intent: 'replace', format: args.format ?? 'fields',
      ...(args.readback === undefined ? {} : { readback: args.readback }),
    }) as Record<string, any>;
    if (isFailureResult(content)) {
      return {
        ...content,
        schema: ADD_SCHEMA,
        failure: { ...content.failure, effects: [creation, ...content.failure.effects] },
        message: `The empty clip exists; its content was refused. ${content.message}`,
        detail: { ...(content.detail ?? {}), revert: { tool: 'revert_change', changeId: creation.changeId } },
      };
    }
    const effects: Effect[] = [creation, ...(content['effects'] as Effect[])];
    const result: WriteResult<unknown> = {
      schema: ADD_SCHEMA,
      applied: true,
      effects,
      readback: content['readback'],
      next: { revert: [...effects].reverse().map((effect) => ({ tool: 'revert_change', changeId: effect.changeId })) },
      warnings: content['warnings'] ?? [],
      timing: { ...(content['timing'] ?? {}), totalMs: performance.now() - started },
    };
    return { ...result, target, ...(content['plan'] === undefined ? {} : { plan: content['plan'] }) };
  });
}

const addLauncherClipTool: ToolSpec = {
  name: 'add_launcher_clip',
  kind: 'write',
  title: 'Create one Launcher clip from a document',
  description: ADD_DESCRIPTION,
  inputSchema: addInput.shape,
  inputValidator: addInput,
  emits: ['clip.create', 'clip.update', 'note.remove', 'note.insert', 'note.clear', 'note.write'],
  background: true,
  resultContract: {
    schema: ADD_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE, envelope: [...WRITE_FIELDS, 'plan'], failure: FAILURE_FIELDS,
    readbackStatus: ['verified', 'differs', 'unavailable', 'unchanged'],
  },
  run: (workspace, input) => addLauncherClip(workspace, input as AddInput),
};

// --- copy_launcher_clips -------------------------------------------------------

const copyInput = z.object({
  copies: z.array(z.object({ source: address, destination: address }).strict()).min(1).max(64).describe(
    'Each copy names its source clip and its destination slot.',
  ),
  dryRun: z.boolean().optional().describe('Return the occupancy and make no write.'),
}).strict();
type CopyInput = z.infer<typeof copyInput>;

const COPY_DESCRIPTION = `${PROFILE} Copy Launcher clips. Each copy names a source clip and a destination slot. `
  + 'The host can copy a clip only into the slot directly below it on the same track (destination row = source '
  + 'row + 1); another destination refuses with code unsupported. The copy carries the notes, the clip '
  + 'properties, and the launch settings.\n'
  + 'Every source must hold a clip (code absent) and every destination must exist and be empty (code occupied): '
  + 'Bitwig replaces an occupied destination without an occupancy event. A missing row refuses with code absent; '
  + 'add scenes at the end with add_scenes. Every result, also a refusal and a dry run, has occupancy: the '
  + 'state of each slot that the preflight read.\n'
  + 'Result: one effect with a changeId; revert_change removes the copies while they are unchanged.';

async function copyLauncherClips(workspace: Workspace, args: CopyInput): Promise<unknown> {
  const started = performance.now();
  const target = { copies: args.copies.length };
  let occupancyReport: Record<string, unknown>[] | undefined;
  const result = await guardedRun(COPY_SCHEMA, target, async (state) => {
    const sources = args.copies.map((item) => item.source);
    const destinations = args.copies.map((item) => item.destination);
    const unsupported = args.copies.filter((item) => item.destination.trackId !== item.source.trackId
      || item.destination.row !== item.source.row + 1);
    if (unsupported.length > 0) {
      throw new ToolFailure('unsupported', 'input', 'The host copies a clip only into the slot directly below it '
        + 'on the same track.', { detail: { reason: 'copy-destination', copies: unsupported } });
    }
    const all = [...sources, ...destinations];
    if (new Set(all.map((item) => `${item.trackId}:${item.row}`)).size !== all.length) {
      throw new ToolFailure('invalid-input', 'input', 'Each source and destination slot can appear only once.');
    }

    state.stage = 'resolve';
    const at = await markFor(workspace, all.map((item) => item.row));
    await requireTracks(workspace, all.map((item) => item.trackId));
    state.stage = 'acquire';
    const { occupancy } = await readSlots(workspace, all, at);
    occupancyReport = args.copies.map((item) => ({
      source: { ...item.source, occupancy: occupancy(item.source) },
      destination: { ...item.destination, occupancy: occupancy(item.destination) },
    }));
    const empty = sources.filter((item) => occupancy(item) === 'empty');
    if (empty.length > 0) {
      throw new ToolFailure('absent', 'acquire', 'A source slot holds no clip. Nothing was written.', {
        detail: { sources: empty } });
    }
    const blocked = destinations.filter((item) => occupancy(item) === 'occupied');
    if (blocked.length > 0) {
      throw new ToolFailure('occupied', 'acquire', 'A destination slot holds a clip. Nothing was written.', {
        detail: { destinations: blocked } });
    }
    if (args.dryRun === true) {
      return { schema: COPY_SCHEMA, applied: false, effects: [], readback: null, dryRun: true, target };
    }

    state.stage = 'write';
    const change = await workspace.apply(args.copies.map((item): Op => ({
      op: 'clip.duplicate', source: clipOf(item.source, at), destination: clipOf(item.destination, at).slot,
    })));
    requireApplied(change);
    state.effects.push(effectOf(change, target, `Copied ${args.copies.length} clip(s).`));

    state.stage = 'readback';
    const after = await readbackOf(workspace, change, (at) => destinations.map((item) => clipOf(item, at)));
    const copied = (item: Target) => occupancyIn(after.entries, item, after.at);
    const missing = destinations.filter((item) => copied(item) !== 'occupied');
    const outcome: WriteResult<unknown> = {
      schema: COPY_SCHEMA,
      applied: true,
      effects: state.effects,
      readback: { status: missing.length === 0 ? 'verified' : 'differs', copies: destinations.map((item) => ({
        ...item, occupancy: copied(item) })) },
      next: { revert: { tool: 'revert_change', changeId: state.effects[0]!.changeId } },
      warnings: [],
      timing: { totalMs: performance.now() - started },
    };
    return { ...outcome, target };
  });
  return occupancyReport === undefined ? result : { ...(result as object), occupancy: occupancyReport };
}

const copyLauncherClipsTool: ToolSpec = {
  name: 'copy_launcher_clips',
  kind: 'write',
  title: 'Copy Launcher clips',
  description: COPY_DESCRIPTION,
  inputSchema: copyInput.shape,
  inputValidator: copyInput,
  emits: ['clip.duplicate'],
  resultContract: {
    schema: COPY_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE, envelope: [...WRITE_FIELDS, 'occupancy', 'dryRun'],
    failure: [...FAILURE_FIELDS, 'occupancy'], occupancy: ['occupied', 'empty'],
  },
  run: (workspace, input) => copyLauncherClips(workspace, input as CopyInput),
};

// --- move_launcher_clips -------------------------------------------------------

const moveInput = z.object({
  trackId,
  firstRow: row.describe('First source row, inclusive.'),
  lastRow: row.describe('Last source row, inclusive.'),
  destinationFirstRow: row.describe('The row where the first source clip lands.'),
  dryRun: z.boolean().optional().describe('Return the occupancy and make no write.'),
}).strict();
type MoveInput = z.infer<typeof moveInput>;

const MOVE_DESCRIPTION = `${PROFILE} Move a contiguous range of Launcher clips on one track, with their clip `
  + 'properties and automation. Every source row must hold a clip (code absent). The destination rows outside '
  + 'the source range must be empty, and so must the slots directly above and below the destination range '
  + '(code occupied); the slot above row 0 is the project edge. The scene below the destination range must exist '
  + '(code absent); add scenes at the end with add_scenes. An overlapping move runs from the far edge inward, so '
  + 'no clip is replaced. Every result, also a refusal and a dry run, has occupancy: the state of each row that '
  + 'the preflight read.\n'
  + 'revert_change does not move clips back: a clip has no durable identity. next.reverse is the exact reverse '
  + 'call; it is safe while the old source rows stay empty and the new rows hold these clips.';

async function moveLauncherClips(workspace: Workspace, args: MoveInput): Promise<unknown> {
  const started = performance.now();
  const target = { trackId: args.trackId, firstRow: args.firstRow, lastRow: args.lastRow,
    destinationFirstRow: args.destinationFirstRow };
  let occupancyReport: Record<string, unknown>[] | undefined;
  const result = await guardedRun(MOVE_SCHEMA, target, async (state) => {
    if (args.firstRow > args.lastRow) {
      throw new ToolFailure('invalid-input', 'input', 'firstRow must be less than or equal to lastRow.');
    }
    if (args.destinationFirstRow === args.firstRow) {
      throw new ToolFailure('invalid-input', 'input', 'The source and destination ranges are the same.');
    }
    const length = args.lastRow - args.firstRow + 1;
    const destinationLastRow = args.destinationFirstRow + length - 1;
    const sourceRows = Array.from({ length }, (_, offset) => args.firstRow + offset);
    const destinationRows = Array.from({ length }, (_, offset) => args.destinationFirstRow + offset);
    const rowsToRead = [...new Set([...sourceRows, ...destinationRows, args.destinationFirstRow - 1,
      destinationLastRow + 1].filter((index) => index >= 0))].sort((a, b) => a - b);

    state.stage = 'resolve';
    const at = await markFor(workspace, [destinationLastRow + 1, ...sourceRows]);
    await requireTracks(workspace, [args.trackId]);
    state.stage = 'acquire';
    const at$ = (index: number) => ({ trackId: args.trackId, row: index });
    const { occupancy } = await readSlots(workspace, rowsToRead.map(at$), at);
    const sourceSet = new Set(sourceRows);
    const role = (index: number) => sourceSet.has(index) ? 'source'
      : destinationRows.includes(index) ? 'destination' : 'boundary';
    occupancyReport = [
      ...(args.destinationFirstRow === 0 ? [{ row: -1, role: 'boundary', occupancy: 'project-edge' }] : []),
      ...rowsToRead.map((index) => ({ row: index, role: role(index), occupancy: occupancy(at$(index)) })),
    ];
    const empty = sourceRows.filter((index) => occupancy(at$(index)) !== 'occupied');
    if (empty.length > 0) {
      throw new ToolFailure('absent', 'acquire', 'A source row holds no clip. Nothing was written.', {
        detail: { rows: empty } });
    }
    const blocked = rowsToRead.filter((index) => !sourceSet.has(index) && occupancy(at$(index)) !== 'empty');
    if (blocked.length > 0) {
      throw new ToolFailure('occupied', 'acquire', 'A destination or boundary slot holds a clip. Nothing was '
        + 'written.', { detail: { rows: blocked } });
    }
    if (args.dryRun === true) {
      return { schema: MOVE_SCHEMA, applied: false, effects: [], readback: null, dryRun: true, target };
    }

    state.stage = 'write';
    const ordered = args.destinationFirstRow > args.firstRow ? [...sourceRows].reverse() : sourceRows;
    const change = await workspace.apply(ordered.map((sourceRow): Op => ({
      op: 'clip.move',
      source: clipOf(at$(sourceRow), at),
      destination: clipOf(at$(args.destinationFirstRow + sourceRow - args.firstRow), at).slot,
    })), {
      clearance: branchProtected(`clip-move:${args.trackId}:${args.firstRow}-${args.lastRow}>${args.destinationFirstRow}`),
    });
    requireApplied(change);
    state.effects.push(effectOf(change, target, `Moved ${length} clip(s) to rows ${args.destinationFirstRow}`
      + `-${destinationLastRow}.`));

    state.stage = 'readback';
    const after = await readbackOf(workspace, change, (now) => destinationRows.map((index) => clipOf(at$(index), now)));
    const missing = destinationRows.filter((index) => occupancyIn(after.entries, at$(index), after.at) !== 'occupied');
    const outcome: WriteResult<unknown> = {
      schema: MOVE_SCHEMA,
      applied: true,
      effects: state.effects,
      readback: { status: missing.length === 0 ? 'verified' : 'differs', firstRow: args.destinationFirstRow,
        lastRow: destinationLastRow },
      next: { reverse: { tool: 'move_launcher_clips', trackId: args.trackId, firstRow: args.destinationFirstRow,
        lastRow: destinationLastRow, destinationFirstRow: args.firstRow } },
      warnings: [],
      timing: { totalMs: performance.now() - started },
    };
    return { ...outcome, target };
  });
  return occupancyReport === undefined ? result : { ...(result as object), occupancy: occupancyReport };
}

const moveLauncherClipsTool: ToolSpec = {
  name: 'move_launcher_clips',
  kind: 'write',
  title: 'Move a range of Launcher clips',
  description: MOVE_DESCRIPTION,
  inputSchema: moveInput.shape,
  inputValidator: moveInput,
  emits: ['clip.move'],
  resultContract: {
    schema: MOVE_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE, envelope: [...WRITE_FIELDS, 'occupancy', 'dryRun'],
    failure: [...FAILURE_FIELDS, 'occupancy'], occupancy: ['occupied', 'empty', 'project-edge'],
    roles: ['source', 'destination', 'boundary'],
  },
  run: (workspace, input) => moveLauncherClips(workspace, input as MoveInput),
};

// --- set_launcher_clip_launch_settings -------------------------------------------

const launchSettingsInput = z.object({
  clips: z.array(z.object({
    trackId, row, quantization, mode,
    useLoopStartAsQuantizationReference: z.boolean().optional().describe(
      'The clip loop start, not the project grid, is the quantization reference. Default false.'),
  }).strict()).min(1).max(64),
}).strict();
type LaunchSettingsInput = z.infer<typeof launchSettingsInput>;

const LAUNCH_SETTINGS_DESCRIPTION = `${PROFILE} Set the launch grid and mode of Launcher clips: the settings that `
  + 'a person who clicks the clip in Bitwig uses. The prior values are recorded, so revert_change can put them '
  + 'back. This does not start playback and does not configure Next Actions. continue_or_synced keeps the '
  + 'position only when the outgoing clip is on the same grid. Every clip must exist (code absent).';

async function setLaunchSettings(workspace: Workspace, args: LaunchSettingsInput): Promise<unknown> {
  const started = performance.now();
  const target = { clips: args.clips.length };
  return guardedRun(LAUNCH_SETTINGS_SCHEMA, target, async (state) => {
    state.stage = 'resolve';
    const at = await markFor(workspace, args.clips.map((item) => item.row));
    await requireTracks(workspace, args.clips.map((item) => item.trackId));
    state.stage = 'acquire';
    const { occupancy } = await readSlots(workspace, args.clips, at);
    const empty = args.clips.filter((item) => occupancy(item) === 'empty').map(({ trackId: id, row: r }) => ({ trackId: id, row: r }));
    if (empty.length > 0) throw new ToolFailure('absent', 'acquire', 'A slot holds no clip.', { detail: { clips: empty } });

    state.stage = 'write';
    const settings = args.clips.map((item) => ({ ...item,
      useLoopStartAsQuantizationReference: item.useLoopStartAsQuantizationReference ?? false }));
    const change = await workspace.apply(settings.map((item): Op => ({
      op: 'clip.launchSettings', clip: clipOf(item, at), quantization: item.quantization, mode: item.mode,
      useLoopStartAsQuantizationReference: item.useLoopStartAsQuantizationReference,
    })));
    requireApplied(change);
    state.effects.push(effectOf(change, target, `Set the launch settings of ${args.clips.length} clip(s).`));

    state.stage = 'readback';
    const after = await readbackOf(workspace, change, (at) => settings.map((item) => launchAt(clipOf(item, at))));
    const clips = settings.map((item) => {
      const entry = after.entries[addressKey(launchAt(clipOf(item, after.at)))];
      const launch = entry?.value.of === 'clipLaunch' ? entry.value.launch : null;
      return { trackId: item.trackId, row: item.row, launch,
        verified: launch !== null && launch.quantization === item.quantization && launch.mode === item.mode
          && launch.useLoopStartAsQuantizationReference === item.useLoopStartAsQuantizationReference };
    });
    const result: WriteResult<unknown> = {
      schema: LAUNCH_SETTINGS_SCHEMA, applied: true, effects: state.effects,
      readback: { status: clips.every((item) => item.verified) ? 'verified' : 'differs', clips },
      next: { revert: { tool: 'revert_change', changeId: state.effects[0]!.changeId } },
      warnings: [], timing: { totalMs: performance.now() - started },
    };
    return { ...result, target };
  });
}

const setLaunchSettingsTool: ToolSpec = {
  name: 'set_launcher_clip_launch_settings',
  kind: 'write',
  title: 'Set Launcher clip launch settings',
  description: LAUNCH_SETTINGS_DESCRIPTION,
  inputSchema: launchSettingsInput.shape,
  inputValidator: launchSettingsInput,
  emits: ['clip.launchSettings'],
  resultContract: { schema: LAUNCH_SETTINGS_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE, envelope: WRITE_FIELDS,
    failure: FAILURE_FIELDS, readbackStatus: ['verified', 'differs'] },
  run: (workspace, input) => setLaunchSettings(workspace, input as LaunchSettingsInput),
};

// --- set_launcher_clip_properties ------------------------------------------------

const colour = z.object({
  red: z.number().int().min(0).max(255), green: z.number().int().min(0).max(255), blue: z.number().int().min(0).max(255),
}).strict();

const propertiesInput = z.object({
  clips: z.array(z.object({
    trackId,
    row,
    properties: z.object({
      name: z.string().optional().describe('The clip name. An empty string is no name.'),
      color: colour.optional().describe('A colour of the exact Bitwig clip palette, as red, green, and blue bytes.'),
      lengthBeats: z.number().positive().optional().describe('The loop length in beats.'),
      playStartBeats: z.number().min(0).optional(),
      loopEnabled: z.boolean().optional(),
      loopStartBeats: z.number().min(0).optional(),
      loopEndBeats: z.number().positive().optional().describe('Must equal loopStartBeats plus lengthBeats.'),
    }).strict().refine((value) => Object.keys(value).length > 0, { message: 'name at least one property' }),
  }).strict()).min(1).max(64),
}).strict();
type PropertiesInput = z.infer<typeof propertiesInput>;

const PROPERTIES_DESCRIPTION = `${PROFILE} Set properties of Launcher clips: name, colour, length, play start, `
  + 'and loop. An omitted property keeps its value. A length or loop start change without loopEndBeats moves the '
  + 'loop end to loop start plus length; a loop end that differs from that refuses with code invalid-input. The '
  + 'prior properties are recorded, so revert_change can put them back. edit_launcher_clip writes name, length, '
  + 'and loop through the same writer.\n'
  + 'The colour before and after must be in the exact Bitwig clip palette (code unsupported, detail.reason '
  + 'clip-colour, detail.supportedClipColors), or the change could not be reversed exactly; do not retry with one '
  + 'byte changed. Every clip must exist (code absent). The readback compares each property.';

const sameMetadata = (left: ClipMetadataState, right: ClipMetadataState): boolean => left.name === right.name
  && left.color.red === right.color.red && left.color.green === right.color.green && left.color.blue === right.color.blue
  && left.lengthBeats === right.lengthBeats && left.playStartBeats === right.playStartBeats
  && left.loopEnabled === right.loopEnabled && left.loopStartBeats === right.loopStartBeats
  && left.loopEndBeats === right.loopEndBeats;

async function setProperties(workspace: Workspace, args: PropertiesInput): Promise<unknown> {
  const started = performance.now();
  const target = { clips: args.clips.length };
  return guardedRun(PROPERTIES_SCHEMA, target, async (state) => {
    state.stage = 'resolve';
    const at = await markFor(workspace, args.clips.map((item) => item.row));
    await requireTracks(workspace, args.clips.map((item) => item.trackId));
    state.stage = 'acquire';
    const { read, occupancy } = await readSlots(workspace, args.clips, at,
      args.clips.map((item) => metadataAt(clipOf(item, at))));
    const empty = args.clips.filter((item) => occupancy(item) === 'empty').map(({ trackId: id, row: r }) => ({ trackId: id, row: r }));
    if (empty.length > 0) throw new ToolFailure('absent', 'acquire', 'A slot holds no clip.', { detail: { clips: empty } });

    state.stage = 'plan';
    const planned = args.clips.map((item) => {
      const entry = read.entries[addressKey(metadataAt(clipOf(item, at)))];
      if (entry?.value.of !== 'clipMetadata') {
        throw new ToolFailure('authority-unavailable', 'acquire', 'The fresh host read did not report the clip '
          + 'properties.', { retryWhen: 'once; then check the connection' });
      }
      try {
        return { item, metadata: completeClipProperties(entry.value.metadata, item.properties as ClipPropertyChanges) };
      } catch (error) {
        if (error instanceof EditRefusal && error.reason === 'clip-colour') {
          throw new ToolFailure('unsupported', 'plan', error.message, { detail: { reason: 'clip-colour',
            clip: { trackId: item.trackId, row: item.row }, supportedClipColors: supportedClipColors() } });
        }
        throw error;
      }
    });

    state.stage = 'write';
    const change = await workspace.apply(planned.map(({ item, metadata }): Op => ({
      op: 'clip.update', clip: clipOf(item, at), metadata })));
    requireApplied(change);
    state.effects.push(effectOf(change, target, `Set the properties of ${args.clips.length} clip(s).`));

    state.stage = 'readback';
    const after = await readbackOf(workspace, change, (at) => planned.map(({ item }) => metadataAt(clipOf(item, at))));
    const clips = planned.map(({ item, metadata }) => {
      const entry = after.entries[addressKey(metadataAt(clipOf(item, after.at)))];
      const found = entry?.value.of === 'clipMetadata' ? entry.value.metadata : null;
      return { trackId: item.trackId, row: item.row, properties: found, verified: found !== null && sameMetadata(found, metadata) };
    });
    const result: WriteResult<unknown> = {
      schema: PROPERTIES_SCHEMA, applied: true, effects: state.effects,
      readback: { status: clips.every((item) => item.verified) ? 'verified' : 'differs', clips },
      next: { revert: { tool: 'revert_change', changeId: state.effects[0]!.changeId } },
      warnings: [], timing: { totalMs: performance.now() - started },
    };
    return { ...result, target };
  });
}

const setPropertiesTool: ToolSpec = {
  name: 'set_launcher_clip_properties',
  kind: 'write',
  title: 'Set Launcher clip properties',
  description: PROPERTIES_DESCRIPTION,
  inputSchema: propertiesInput.shape,
  inputValidator: propertiesInput,
  emits: ['clip.update'],
  resultContract: { schema: PROPERTIES_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE, envelope: WRITE_FIELDS,
    failure: FAILURE_FIELDS, readbackStatus: ['verified', 'differs'], refusalReasons: ['clip-colour'] },
  run: (workspace, input) => setProperties(workspace, input as PropertiesInput),
};

// --- delete_launcher_clip --------------------------------------------------------

const deleteInput = z.object({ clips: z.array(address).min(1).max(64) }).strict();
type DeleteInput = z.infer<typeof deleteInput>;

const DELETE_DESCRIPTION = `${PROFILE} Delete Launcher clips. The slot stays empty and the scene stays. Each clip's `
  + 'notes, length, name, colour, loop properties, and launch settings are recorded first, so revert_change can '
  + 'put a new clip with that state back. Its play-stop marker and automation lanes do not come back. Every slot '
  + 'must hold a clip (code absent).';

async function deleteLauncherClips(workspace: Workspace, args: DeleteInput): Promise<unknown> {
  const started = performance.now();
  const target = { clips: args.clips.length };
  return guardedRun(DELETE_SCHEMA, target, async (state) => {
    if (new Set(args.clips.map((item) => `${item.trackId}:${item.row}`)).size !== args.clips.length) {
      throw new ToolFailure('invalid-input', 'input', 'Each clip can appear only once.');
    }
    state.stage = 'resolve';
    const at = await markFor(workspace, args.clips.map((item) => item.row));
    await requireTracks(workspace, args.clips.map((item) => item.trackId));
    state.stage = 'acquire';
    const { occupancy } = await readSlots(workspace, args.clips, at);
    const empty = args.clips.filter((item) => occupancy(item) === 'empty');
    if (empty.length > 0) throw new ToolFailure('absent', 'acquire', 'A slot holds no clip.', { detail: { clips: empty } });

    state.stage = 'write';
    const change = await workspace.apply(args.clips.map((item): Op => ({ op: 'clip.delete', slot: clipOf(item, at).slot })),
      { clearance: directedDestruction('delete_launcher_clip') });
    requireApplied(change);
    state.effects.push(effectOf(change, target, `Deleted ${args.clips.length} clip(s).`));

    state.stage = 'readback';
    const after = await readbackOf(workspace, change, (at) => args.clips.map((item) => clipOf(item, at)));
    const now = (item: Target) => occupancyIn(after.entries, item, after.at);
    const remaining = args.clips.filter((item) => now(item) !== 'empty');
    const result: WriteResult<unknown> = {
      schema: DELETE_SCHEMA, applied: true, effects: state.effects,
      readback: { status: remaining.length === 0 ? 'verified' : 'differs',
        clips: args.clips.map((item) => ({ ...item, occupancy: now(item) })) },
      next: { revert: { tool: 'revert_change', changeId: state.effects[0]!.changeId } },
      warnings: [], timing: { totalMs: performance.now() - started },
    };
    return { ...result, target };
  });
}

const deleteLauncherClipTool: ToolSpec = {
  name: 'delete_launcher_clip',
  kind: 'destructive',
  title: 'Delete Launcher clips',
  description: DELETE_DESCRIPTION,
  inputSchema: deleteInput.shape,
  inputValidator: deleteInput,
  emits: ['clip.delete'],
  resultContract: { schema: DELETE_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE, envelope: WRITE_FIELDS,
    failure: FAILURE_FIELDS, readbackStatus: ['verified', 'differs'] },
  run: (workspace, input) => deleteLauncherClips(workspace, input as DeleteInput),
};

// --- show_launcher_clip_in_detail_editor -----------------------------------------

const showInput = address;
type ShowInput = z.infer<typeof showInput>;

const SHOW_DESCRIPTION = `${PROFILE} Open one Launcher clip in the Bitwig detail editor, request the edit layout, `
  + 'and fit the clip content. This changes Bitwig UI focus only: no project content, no change record. The slot '
  + 'must hold a clip (code absent). A scene or project change during the call refuses with code target-changed.';

async function showLauncherClip(workspace: Workspace, args: ShowInput): Promise<unknown> {
  const target = { trackId: args.trackId, row: args.row };
  return guardedRun(SHOW_SCHEMA, target, async (state) => {
    state.stage = 'resolve';
    const at = await markFor(workspace, [args.row]);
    await requireTracks(workspace, [args.trackId]);
    state.stage = 'acquire';
    const { read, occupancy } = await readSlots(workspace, [target], at);
    if (occupancy(target) === 'empty') throw new ToolFailure('absent', 'acquire', 'The slot holds no clip.');
    // The adapter and the extension validate this mark: a newer mark could approve another occupant.
    const verifiedAt = await workspace.mark();
    if (verifiedAt.revision !== read.at.revision || verifiedAt.generation !== read.at.generation
        || verifiedAt.project !== read.at.project || verifiedAt.sceneEpoch !== read.at.sceneEpoch) {
      throw new ToolFailure('target-changed', 'acquire', 'Bitwig state changed while the clip was checked.', {
        retryWhen: 'after the project stops changing' });
    }
    const shown = await workspace.showClipInEditor(clipOf(target, verifiedAt), verifiedAt);
    const result: WriteResult<unknown> = {
      schema: SHOW_SCHEMA, applied: shown.navigated, effects: [],
      readback: shown,
      warnings: [],
    };
    return { ...result, target };
  });
}

const showLauncherClipTool: ToolSpec = {
  name: 'show_launcher_clip_in_detail_editor',
  kind: 'focus',
  title: 'Show one Launcher clip in the detail editor',
  description: SHOW_DESCRIPTION,
  inputSchema: showInput.shape,
  inputValidator: showInput,
  emits: [],
  resultContract: { schema: SHOW_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE, envelope: WRITE_FIELDS,
    failure: FAILURE_FIELDS, effects: 'none: UI focus only' },
  run: (workspace, input) => showLauncherClip(workspace, input as ShowInput),
};

// --- launch_clip, add_scenes, delete_scene ---------------------------------------

const launchInput = z.object({ trackId, row, quantization, mode }).strict();
type LaunchInput = z.infer<typeof launchInput>;

const LAUNCH_DESCRIPTION = `${PROFILE} Launch one Launcher clip with a grid and mode for this call, then read `
  + 'whether it is queued or playing. This starts the transport. One call is one switch. continue_or_synced keeps '
  + 'the position only when the outgoing clip is on the same grid. A launch has no durable effect: it creates no '
  + 'change record, and revert_change does not stop the transport. The slot must hold a clip (code absent).';

async function launchClip(workspace: Workspace, args: LaunchInput): Promise<unknown> {
  const target = { trackId: args.trackId, row: args.row };
  return guardedRun(LAUNCH_SCHEMA, target, async (state) => {
    state.stage = 'resolve';
    if (workspace.launch === undefined) {
      throw new ToolFailure('unhealthy', 'resolve', 'This server has no launch route.');
    }
    const at = await markFor(workspace, [args.row]);
    await requireTracks(workspace, [args.trackId]);
    state.stage = 'acquire';
    const { occupancy } = await readSlots(workspace, [target], at);
    if (occupancy(target) === 'empty') throw new ToolFailure('absent', 'acquire', 'The slot holds no clip.');
    state.stage = 'write';
    const clip = clipOf(target, at);
    const take = await workspace.launch([{ op: 'clip.launch', clip, quantization: args.quantization, mode: args.mode }]);
    if (!takeAppliedAnything(take)) {
      throw new ToolFailure('target-changed', 'write', 'The project changed before the launch. Nothing was launched.', {
        retryWhen: 'after the project stops changing' });
    }
    state.stage = 'readback';
    const read = await workspace.read([playAt(clip)]);
    const entry = read.entries[addressKey(playAt(clip))];
    const result: WriteResult<unknown> = {
      schema: LAUNCH_SCHEMA, applied: true, effects: [],
      readback: { playback: entry?.value.of === 'clipPlay' ? entry.value.play : null },
      warnings: [{ code: 'transport-started', message: 'The launch started the transport. No change record exists.' }],
    };
    return { ...result, target };
  });
}

const launchClipTool: ToolSpec = {
  name: 'launch_clip',
  kind: 'write',
  title: 'Launch one Launcher clip',
  description: LAUNCH_DESCRIPTION,
  inputSchema: launchInput.shape,
  inputValidator: launchInput,
  emits: ['clip.launch'],
  resultContract: { schema: LAUNCH_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE, envelope: WRITE_FIELDS,
    failure: FAILURE_FIELDS, effects: 'none: ephemeral (D19)' },
  run: (workspace, input) => launchClip(workspace, input as LaunchInput),
};

const addScenesInput = z.object({ count: z.number().int().min(1).describe('How many scenes to add.') }).strict();
type AddScenesInput = z.infer<typeof addScenesInput>;

const ADD_SCENES_DESCRIPTION = `${PROFILE} Add scenes at the end of the Launcher. Every track gets an empty slot `
  + 'in each new scene. Rows that exist keep their numbers. More scenes than this connection can address refuse '
  + 'before a write (code outside-limit): a scene past that point can be neither reached nor removed. The change '
  + 'record names the scenes, but revert_change cannot remove them: the scene layout has no readback.';

async function addScenes(workspace: Workspace, args: AddScenesInput): Promise<unknown> {
  const target = { count: args.count };
  return guardedRun(SCENES_SCHEMA, target, async (state) => {
    state.stage = 'resolve';
    const at = await markFor(workspace, []);
    state.stage = 'write';
    const change = await workspace.apply([{ op: 'scene.create', count: args.count }]);
    requireApplied(change);
    state.effects.push(effectOf(change, target, `Added ${args.count} scene(s).`));
    state.stage = 'readback';
    const after = await workspace.mark();
    const result: WriteResult<unknown> = {
      schema: SCENES_SCHEMA, applied: true, effects: state.effects,
      readback: { status: after.window.scenes.count === at.window.scenes.count + args.count ? 'verified' : 'differs',
        scenes: after.window.scenes.count },
      warnings: [],
    };
    return { ...result, target };
  });
}

const deleteScenesInput = z.object({
  rows: z.array(z.number().int().min(0)).min(1).describe('Zero-based Launcher rows of the scenes, as they are now.'),
}).strict();
type DeleteScenesInput = z.infer<typeof deleteScenesInput>;

const DELETE_SCENE_DESCRIPTION = `${PROFILE} Delete scenes. Every clip in the scene, on every track, goes with it. `
  + 'Each scene below a deleted one moves up one row, so a row number from before the call names another scene '
  + 'after it; an address from before refuses (code stale-address). One call deletes the highest row first, so '
  + 'all rows in the call refer to the layout before the call. revert_change cannot put a scene back.';

async function deleteScenes(workspace: Workspace, args: DeleteScenesInput): Promise<unknown> {
  const target = { rows: args.rows };
  return guardedRun(SCENES_SCHEMA, target, async (state) => {
    state.stage = 'resolve';
    const rows = [...new Set(args.rows)].sort((a, b) => b - a);
    const at = await markFor(workspace, rows);
    state.stage = 'write';
    const change = await workspace.apply(rows.map((index): Op => ({ op: 'scene.delete', scene: sceneAt(index, at.sceneEpoch) })),
      { clearance: directedDestruction('delete_scene') });
    requireApplied(change);
    state.effects.push(effectOf(change, target, `Deleted ${rows.length} scene(s).`));
    state.stage = 'readback';
    const after = await workspace.mark();
    const result: WriteResult<unknown> = {
      schema: SCENES_SCHEMA, applied: true, effects: state.effects,
      readback: { status: after.window.scenes.count === at.window.scenes.count - rows.length ? 'verified' : 'differs',
        scenes: after.window.scenes.count },
      warnings: [],
    };
    return { ...result, target };
  });
}

/** `agent-native-v1` versions of the tools that keep their stable names. They replace the stable specs in place. */
export const AGENT_NATIVE_SCENE_TOOLS: readonly ToolSpec[] = [
  launchClipTool,
  {
    name: 'add_scenes', kind: 'write', title: 'Add scenes', description: ADD_SCENES_DESCRIPTION,
    inputSchema: addScenesInput.shape, inputValidator: addScenesInput, emits: ['scene.create'],
    resultContract: { schema: SCENES_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE, envelope: WRITE_FIELDS,
      failure: FAILURE_FIELDS },
    run: (workspace, input) => addScenes(workspace, input as AddScenesInput),
  },
  {
    name: 'delete_scene', kind: 'destructive', title: 'Delete scenes', description: DELETE_SCENE_DESCRIPTION,
    inputSchema: deleteScenesInput.shape, inputValidator: deleteScenesInput, emits: ['scene.delete'],
    resultContract: { schema: SCENES_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE, envelope: WRITE_FIELDS,
      failure: FAILURE_FIELDS },
    run: (workspace, input) => deleteScenes(workspace, input as DeleteScenesInput),
  },
];

// --- operations ------------------------------------------------------------------

/** The operation envelope. A completed operation carries the result of the direct call. */
export function startedOperation(status: OperationStatus): unknown {
  return { schema: OPERATION_SCHEMA, operation: status };
}

const operationInput = z.object({
  operationId: z.string().min(1).describe('The operationId of a call with background true.'),
}).strict();
type OperationInput = z.infer<typeof operationInput>;

function operationOf(workspace: Workspace, args: OperationInput, act: 'status' | 'cancel'): unknown {
  try {
    return startedOperation(workspace.operations[act](args.operationId));
  } catch (error) {
    return failureResult(OPERATION_SCHEMA, 'resolve', new ToolFailure('absent', 'resolve',
      'This server process holds no such operation.', { cause: error }), { operationId: args.operationId });
  }
}

const OPERATION_STATES = ['accepted', 'running', 'cancelling', 'completed', 'cancelled', 'failed'];

const inspectOperationTool: ToolSpec = {
  name: 'inspect_operation',
  kind: 'read',
  title: 'Inspect a background operation',
  description: `${PROFILE} Read the state of an operation that a call with background true started `
    + '(edit_launcher_clip, add_launcher_clip). operation.state is accepted, running, cancelling, completed, '
    + 'cancelled, or failed. A terminal state (terminal true) means that the operation makes no later project '
    + 'change. completed has operation.result, the same result as the direct call. cancelled lists in '
    + 'operation.changes each change that was recorded before the cancellation. Operations live in this server '
    + 'process only.',
  inputSchema: operationInput.shape,
  inputValidator: operationInput,
  emits: [],
  resultContract: { schema: OPERATION_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE, states: OPERATION_STATES },
  run: async (workspace, input) => operationOf(workspace, input as OperationInput, 'status'),
};

const cancelOperationTool: ToolSpec = {
  name: 'cancel_operation',
  kind: 'write',
  title: 'Cancel a background operation',
  description: `${PROFILE} Request the cancellation of a background operation. The operation stops before its `
    + 'next project write. A write that has started finishes its readback and its change record first, so the '
    + 'first answer can be cancelling. Inspect the operation until it is terminal. A repeated call for a terminal '
    + 'operation changes nothing.',
  inputSchema: operationInput.shape,
  inputValidator: operationInput,
  emits: [],
  resultContract: { schema: OPERATION_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE, states: OPERATION_STATES },
  run: async (workspace, input) => operationOf(workspace, input as OperationInput, 'cancel'),
};

/** The Launcher clip tools and the operation handle that `agent-native-v1` adds, in order. */
export const AGENT_NATIVE_CLIP_TOOLS: readonly ToolSpec[] = [
  addLauncherClipTool,
  copyLauncherClipsTool,
  moveLauncherClipsTool,
  setLaunchSettingsTool,
  setPropertiesTool,
  deleteLauncherClipTool,
  showLauncherClipTool,
  inspectOperationTool,
  cancelOperationTool,
];
