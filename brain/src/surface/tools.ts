/**
 * The tool surface — what an agent can actually do, and under which privilege.
 *
 * ## ⚠⚠ The partition is the permission model (D20, as MEASURED by E20c)
 *
 * D20 put destructive verbs on their own annotated tool surface and rested the
 * stop-and-ask on the host's permission flow. E20c measured what the host really
 * does: Claude Code prompts **identically** for every tool, annotated or not —
 * there is no sign the annotations are read at all — and the grain it *does* gate
 * on is the tool **NAME**, per project: *"Yes, and don't ask again for this tool
 * in this project."*
 *
 * Three consequences, and every one of them is built into this file:
 *
 *   1. **The names ARE the partition.** Reading, writing and destroying live on
 *      separately-named tools because a name is what an allow-list keys on.
 *   2. ⚠⚠ **"Don't ask again for this tool" is a blanket grant for that name.**
 *      So a destructive verb must never share a name with a benign one, and must
 *      never be widened later to cover a benign case — the operator may already
 *      have granted it. Widening is a NEW name. `surface.test.ts` asserts the
 *      partition rather than trusting this paragraph.
 *   3. **Annotations stay on and nothing relies on them.** They are correct, they
 *      cost nothing, and a host that starts honouring them makes the seam sharper
 *      rather than different. They are derived from the class below rather than
 *      written per tool, so a tool cannot carry the wrong one.
 *
 * ⚠ Where the line falls, and why it is where it is. **Destroying is removing a
 * container** — a clip, a track, a row, a device — because what is inside it goes
 * too and no record here can rebuild it. **Editing what is inside a clip** is
 * ordinary, because the state it replaces is read and recorded first, and the
 * engine refuses outright when it cannot be. The one crossing is `revert_change`,
 * which may remove a clip it created: putting our own work back is not
 * destruction (D19), it is bounded to what this session wrote and still owns, and
 * a place a person has edited since is reported rather than overwritten.
 *
 * ## ⚠⚠ No mechanism is named here, because none is offered
 *
 * D18c's one-way door: a description that maps the shape of a change onto a
 * mechanism contaminates every branch event recorded afterwards, irrecoverably.
 * This surface has no branch verbs at all, so there is nothing to map onto — which
 * is exactly why it was built before them (session 3d) rather than beside them.
 * `naming.ts` holds the ban as a list something can check.
 *
 * ## ⚠ What the descriptions carry
 *
 * D18c: complete mechanical knowledge — capabilities, costs, traps and correct
 * procedures, as prescriptive as correctness requires — and zero choice-mapping.
 * D18d: lean, with no worked examples, no heuristics and no "typically /
 * recommended" language. Every trap named below is a measured one.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { z } from 'zod';

import {
  chain as chainAt, clip as clipAt, clipLaunch as launchAt, clipMetadata as metadataAt,
  clipPlay as playAt, notes as notesAt,
  param as paramAt, remote as remoteAt, remotes as remotesAt,
  scene as sceneAt, slot as slotAt, track as trackAt, device as deviceAt,
  deviceEnabled as deviceEnabledAt, deviceIn, drumPad as drumPadAt,
  addressKey, blindCount, blindSpotError, LAUNCH_MODES, LAUNCH_QUANTIZATIONS, lookupChain,
  projectedReorder,
  AddressUnresolvedError, BankWindowOverflowError, SlotOccupiedError,
  type Address, type ClipAddress, type DeviceAddress, type DeviceSource, type NoteRecord,
  type ObservedDeviceBank, type Op, type OpKind, type ParamState, type Recurrence,
  type RevisionMark,
} from '../contract/index.js';
import { branchProtected, directedDestruction } from '../engine/index.js';
import { FX_LAYER_UUID, INSTRUMENT_LAYER_SEED_PATH } from '../device-alternates/assets.js';
import {
  reportObservationRecord,
  reportObservationFailureAfterProjectWrite,
  type ConfirmedToolResult,
  type JsonValue,
  type ObservationExecution,
} from '../observation/index.js';
import { selectClip, selectTrack, type Slice } from '../stash/index.js';
import { describeAddress, receiptOf, refusalOf, reversalReport } from './report.js';
import {
  cancellableWorkspace, captureWorkspaceChanges, type Workspace,
} from './workspace.js';
import { showChangedClip } from './navigation.js';
import type { StatusCategory } from './status.js';
import { applyMusicalPatch } from '../musical/index.js';
import {
  MUSICAL_RESULT_CONTRACT, musicalToolInputSchema, musicalToolInputValidator,
  publicMusicalResult,
} from './musical.js';
import {
  modulatorAuthoringInputSchema, modulatorAuthoringInputValidator, runModulatorAuthoring,
} from './modulator-authoring.js';
import {
  deviceStructureCompositionInputSchema, deviceStructureCompositionInputValidator,
  runDeviceStructureComposition,
} from './device-structure-composition.js';
import {
  drumMachineCompositionInputSchema, drumMachineCompositionInputValidator,
  runDrumMachineComposition,
} from './drum-machine-composition.js';
import { isNativeDeviceUuid } from '../native-catalog/catalog.js';
import {
  nativeDeviceInsertionInputSchema, nativeDeviceInsertionInputValidator,
  runNativeDeviceInsertion,
} from './native-device-insertion.js';

// --- the shape of a tool -----------------------------------------------------

/**
 * ⚠ The privilege class, and the ONLY thing that decides a tool's annotations.
 * Read tools change nothing. Focus tools change UI focus only. Write tools
 * change project state through the recorded write seam. Destructive tools
 * remove something.
 */
export type ToolClass = 'read' | 'focus' | 'write' | 'destructive';
export type ObservationOutcome =
  | 'device-alternate'
  | 'clip-block'
  | 'copy-track'
  | 'musical-generation'
  | 'musical-transformation';

export interface ToolSpec {
  readonly name: string;
  readonly kind: ToolClass;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: z.ZodRawShape;
  /** Full validator when the input contract has rules beyond its field shape. */
  readonly inputValidator?: z.ZodType;
  /**
   * Which kinds of edit this tool can put on the wire — declared as data so the
   * partition can be ASSERTED against what tools actually emit, rather than
   * described in a comment. Empty for a read tool.
   */
  readonly emits: readonly OpKind[];
  /** Versioned result fields and procedures included in the cohort golden. */
  readonly resultContract?: unknown;
  /** Confirmed result type, if this tool can create one observation row. */
  readonly observation?: ObservationOutcome;
  /** Product category shown after a confirmed, non-empty change. */
  readonly status?: readonly StatusCategory[];
  run(workspace: Workspace, args: never): Promise<unknown>;
}

/**
 * ⚠ Derived from the class, never written per tool.
 *
 * `idempotentHint` is true only where calling twice really is calling once:
 * reading. A second write is a second change, and a second delete of a clip that
 * is already gone is a refusal, not a no-op.
 */
export const ANNOTATIONS: Readonly<Record<ToolClass, {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
}>> = {
  read: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  focus: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  write: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  destructive: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
};

/**
 * ⚠ The edits that REMOVE something — the line the destructive surface is drawn
 * along, as a set something can check rather than a paragraph someone can forget.
 */
export const REMOVAL_OPS: ReadonlySet<OpKind> = new Set<OpKind>([
  'clip.delete', 'track.delete', 'scene.delete', 'device.delete',
]);

/**
 * ⚠⚠ The ONE crossing, named the way `WIRE_METHODS_BANNED` names its exceptions:
 * a tool on the ordinary write surface that may nonetheless remove something.
 *
 * Adding an entry here is the reviewable act. It should be very hard to justify a
 * second one, because every entry is a name an operator might have granted
 * blanket while believing it could not delete.
 */
export const WRITE_TOOLS_THAT_MAY_REMOVE: Readonly<Record<string, string>> = {
  revert_change:
    'D19: putting our own work back rides the ordinary write surface and is not destruction — '
    + 'and it has to, or a change that removed something could never be undone at all. What '
    + 'makes that safe is structural rather than stated: it can only undo changes THIS session '
    + 'made, and only in places that still hold exactly what that change left, so a clip it '
    + 'removes is one it created and nobody has touched since. Anything else is reported and '
    + 'left alone.',
};

function tool<S extends z.ZodRawShape>(spec: {
  name: string;
  kind: ToolClass;
  title: string;
  description: string;
  inputSchema: S;
  inputValidator?: z.ZodType;
  emits?: readonly OpKind[];
  resultContract?: unknown;
  observation?: ObservationOutcome;
  status?: readonly StatusCategory[];
  run: (workspace: Workspace, args: z.infer<z.ZodObject<S>>) => Promise<unknown>;
}): ToolSpec {
  return { emits: [], ...spec } as unknown as ToolSpec;
}

// --- shared input pieces -----------------------------------------------------

const trackId = z.string().describe(
  'The track\'s durable id, from list_tracks. It survives renaming and reordering; a position '
  + 'does not, and is never an address here.',
);

const nestedDeviceStep = z.discriminatedUnion('through', [
  z.object({
    through: z.literal('named-container-entry'),
    name: z.string().min(1).describe('The exact named entry returned by container inspection.'),
    devicePosition: z.number().int().min(0).describe(
      'Device position inside the named container entry, from 0.',
    ),
  }),
  z.object({
    through: z.literal('drum-pad'),
    channel: z.number().int().min(0).max(15).describe(
      'Drum-pad channel, from 0 through 15. The route reaches its first device.',
    ),
  }),
]);

const deviceTarget = z.object({
  trackId,
  devicePosition: z.number().int().min(0).describe(
    'Top-level device position, from 0. This is positional and changes after a device-order edit.',
  ),
  route: z.array(nestedDeviceStep).max(2).optional().describe(
    'Optional measured route through named container entries or drum-pad channels. Read names again after '
    + 'a structural edit. Two descents are supported.',
  ),
});

type DeviceTargetInput = z.infer<typeof deviceTarget>;

const expectedDeviceOrder = z.array(z.object({
  name: z.string(),
  enabled: z.boolean(),
})).describe(
  'Optional exact complete order from the latest inspect_devices result. The write refuses if it changed.',
);

const row = z.number().int().min(0).describe(
  'Which launcher row, counting from 0. Bitwig displays the same scene row as this number plus 1. '
  + 'A row is a position, so adding or removing rows changes what it means — a call made against '
  + 'a stale row number is refused, never guessed at.',
);

const launchQuantization = z.enum(LAUNCH_QUANTIZATIONS).describe(
  'Launch grid: project default, none, or the named beat division.',
);

const launchMode = z.enum(LAUNCH_MODES).describe(
  'Where playback enters the clip. continue_or_synced follows the outgoing clip position on the grid.',
);

const channel = z.number().int().min(0).max(15).optional().describe(
  'MIDI channel within the clip, 0-15. The low-level surface defaults to 0 for compatibility. '
  + 'The musical patch path always supplies this field.',
);

const clipMetadataInput = z.object({
  name: z.string().describe('The complete clip name. Use an empty string for no name.'),
  color: z.object({
    red: z.number().int().min(0).max(255),
    green: z.number().int().min(0).max(255),
    blue: z.number().int().min(0).max(255),
  }).describe('The complete clip colour as red, green, and blue bytes.'),
  lengthBeats: z.number().positive().describe('The complete loop length in beats.'),
  playStartBeats: z.number().min(0).describe('The play start in beats.'),
  loopEnabled: z.boolean(),
  loopStartBeats: z.number().min(0).describe('The loop start in beats.'),
  loopEndBeats: z.number().positive().describe(
    'The loop end in beats. It must equal loopStartBeats plus lengthBeats.',
  ),
}).strict();

const sameClipMetadata = (
  left: import('../contract/index.js').ClipMetadataState,
  right: import('../contract/index.js').ClipMetadataState,
): boolean => left.name === right.name
  && left.color.red === right.color.red
  && left.color.green === right.color.green
  && left.color.blue === right.color.blue
  && left.lengthBeats === right.lengthBeats
  && left.playStartBeats === right.playStartBeats
  && left.loopEnabled === right.loopEnabled
  && left.loopStartBeats === right.loopStartBeats
  && left.loopEndBeats === right.loopEndBeats;

const jsonInput: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.null(), z.boolean(), z.number().finite(), z.string(), z.array(jsonInput),
  z.record(z.string(), jsonInput),
]));
// The array stays homogeneous in JSON Schema. The length check makes its output
// safe to use as the contract tuple.
const recurrenceInput = z.array(z.number()).length(2) as unknown as z.ZodType<Recurrence>;

/**
 * ⚠ Every property that can be written, and NOT the one that cannot.
 *
 * `pressure` is absent on purpose: the API accepts it and discards it — the value
 * reaches the writing handle and never the clip — so a caller who set it would
 * see it "work" on a read through the same handle and lose it for real. Leaving
 * it out of the schema is a refusal an agent can see before it calls.
 *
 * `surface.test.ts` checks this list against the property table, so a property
 * promoted to writable does not quietly stay off the surface, and an unwritable
 * one cannot quietly appear on it.
 */
const noteInput = z.object({
  startBeats: z.number().describe('Where the note starts, in beats from the clip start.'),
  pitch: z.number().int().min(0).max(127).describe('MIDI note number, 0-127.'),
  velocity: z.number().min(0).max(127).describe('0-127.'),
  durationBeats: z.number().positive().describe(
    'Length in beats. A note ends where the next note of the same pitch begins, so this can read '
    + 'back shorter than asked for.',
  ),
  releaseVelocity: z.number().min(0).max(1).optional(),
  velocitySpread: z.number().min(0).max(1).optional(),
  gain: z.number().optional().describe(
    'Exact. Bitwig reads twice the raw setter input, so the shared encoder writes the requested '
    + 'value divided by 2. E24 verified the inverse with independent reads and revert.',
  ),
  pan: z.number().min(-1).max(1).optional(),
  timbre: z.number().min(-1).max(1).optional(),
  transpose: z.number().optional(),
  chance: z.number().min(0).max(1).optional(),
  isChanceEnabled: z.boolean().optional(),
  isMuted: z.boolean().optional(),
  isOccurrenceEnabled: z.boolean().optional(),
  occurrence: z.string().optional(),
  isRecurrenceEnabled: z.boolean().optional(),
  recurrence: recurrenceInput.optional().describe(
    'Length and mask together; the API has no way to set one alone.',
  ),
  isRepeatEnabled: z.boolean().optional(),
  repeatCount: z.number().int().optional(),
  repeatCurve: z.number().optional(),
  repeatVelocityCurve: z.number().optional(),
  repeatVelocityEnd: z.number().optional(),
});

type NoteInput = z.infer<typeof noteInput>;

/** The surface's note shape IS the contract's, minus what cannot be written. */
const toNote = (note: NoteInput): NoteRecord => note;

const scopeInput = z.object({
  trackId: z.string().describe('Restrict to one track.'),
  row: z.number().int().min(0).optional().describe('Restrict further to one clip in that track.'),
}).optional().describe(
  'Narrow this to part of what the change touched. Whatever is left out is untouched.',
);

const operationId = z.string().min(1).describe(
  'Id returned by start_clip_music_operation.',
);

// --- helpers -----------------------------------------------------------------

/**
 * ⚠ A row address is minted against a mark READ NOW, never remembered.
 *
 * A row created or deleted between two calls moves every row below it, and the
 * adapters refuse an address minted before that rather than resolving it — which
 * is what turns a silent wrong write into a refusal a caller can act on.
 */
const slotOf = (id: string, index: number, at: RevisionMark) =>
  slotAt(trackAt(id), sceneAt(index, at.sceneEpoch));

const clipOf = (id: string, index: number, at: RevisionMark): ClipAddress =>
  clipAt(slotOf(id, index, at));

/** Everything a write tool answers with, refusal or receipt, in one place. */
async function writing<T>(run: () => Promise<T>): Promise<T | ReturnType<typeof refusalOf>> {
  try {
    return await run();
  } catch (error) {
    return refusalOf(error);
  }
}

function addressedDevice(target: DeviceTargetInput): DeviceAddress {
  let current = deviceAt(trackAt(target.trackId), target.devicePosition);
  for (const step of target.route ?? []) {
    current = step.through === 'named-container-entry'
      ? deviceIn(chainAt(current, step.name), step.devicePosition)
      : deviceIn(drumPadAt(current, step.channel), 0);
  }
  return current;
}

function completeDeviceBank(bank: ObservedDeviceBank): bank is ObservedDeviceBank & {
  readonly devicesComplete: true;
  readonly bankSize: number;
} {
  return bank.devicesComplete && bank.bankSize !== undefined;
}

function enabledFingerprint(bank: ObservedDeviceBank): readonly boolean[] | undefined {
  const values = bank.devices.map((item) => item.enabled);
  return values.every((value): value is boolean => typeof value === 'boolean') ? values : undefined;
}

function publicParameter(parameter: ParamState): Record<string, unknown> {
  return {
    id: parameter.id,
    name: parameter.name,
    normalizedValue: parameter.value,
    ...(parameter.index === undefined ? {} : { typedIndex: parameter.index }),
    ...(parameter.display === undefined ? {} : { display: parameter.display }),
    ...(parameter.modulatedValue === undefined
      ? {} : { modulatedValue: parameter.modulatedValue }),
    ...(parameter.hasAutomation === undefined
      ? {} : { hasAutomation: parameter.hasAutomation }),
    ...(parameter.origin === undefined ? {} : { origin: parameter.origin }),
    ...(parameter.discreteValueCount === undefined || parameter.discreteValueCount < 0
      ? {} : { discreteValueCount: parameter.discreteValueCount }),
    ...(parameter.discreteValueNames === undefined || parameter.discreteValueNames.length === 0
      ? {} : { discreteValueNames: parameter.discreteValueNames }),
  };
}

function parameterWarnings(parameter: ParamState): string[] {
  return [
    ...(parameter.modulatedValue !== undefined
        && Math.abs(parameter.modulatedValue - parameter.value) > 1e-9
      ? ['The modulated value differs from the stored base value. A static write is not the value heard.']
      : []),
    ...(parameter.hasAutomation === true
      ? ['Host automation can override the stored base value.']
      : []),
  ];
}

function sliceFor(
  workspace: Workspace,
  changeId: string,
  scope: { trackId: string; row?: number } | undefined,
): Slice | undefined {
  if (scope === undefined) return undefined;
  const change = workspace.changes.require(changeId);
  const at = change.take.at;
  const addresses = workspace.changes.readSetFor(changeId);
  return scope.row === undefined
    ? selectTrack(addresses, trackAt(scope.trackId))
    : selectClip(addresses, clipOf(scope.trackId, scope.row, at));
}

const containerAt = (id: string, position: number) => deviceAt(trackAt(id), position);

const alternateName = z.string().min(1).refine((name) => name.trim().length > 0, {
  message: 'a device alternate name cannot contain only whitespace',
});

function observedAlternateStates(container: {
  readonly chainsComplete: boolean;
  readonly chains: readonly { readonly name: string; readonly solo?: boolean }[];
}): {
  readonly exclusiveActive: string | null;
  readonly states: { readonly name: string; readonly soloed: boolean | null }[];
} {
  const states = container.chains.map((item) => ({
    name: item.name,
    soloed: typeof item.solo === 'boolean' ? item.solo : null,
  }));
  const soloed = states.filter((item) => item.soloed === true);
  const exclusiveActive = container.chainsComplete
    && states.every((item) => item.soloed !== null)
    && soloed.length === 1
    ? soloed[0]!.name
    : null;
  return { states, exclusiveActive };
}

/** Public shape of one independently read device-alternate container. */
async function deviceAlternatesAt(
  workspace: Workspace,
  id: string,
  position: number,
): Promise<Record<string, unknown>> {
  const container = containerAt(id, position);
  const snapshot = await workspace.read([trackAt(id), container]);
  if (snapshot.unreachable.some((address) => addressKey(address) === addressKey(container))) {
    return {
      readable: false,
      why: 'this device position is outside the container scopes this connection can inspect.',
    };
  }
  if (snapshot.entries[addressKey(trackAt(id))] === undefined) {
    return { readable: false, why: 'that id does not name a visible track.' };
  }
  const entry = snapshot.entries[addressKey(container)];
  const device = entry?.value.of === 'device' ? entry.value.device : undefined;
  if (device === undefined) {
    return { readable: false, why: 'no device exists at that position.' };
  }
  if (device.container === undefined) {
    return { readable: false, why: 'the device at that position does not expose named alternates.' };
  }
  const observedState = observedAlternateStates(device.container);
  const routing = device.name === 'Instrument Layer'
    ? 'All entries run in parallel and receive the same MIDI input. Exclusive solo auditions one entry; it does not map MIDI notes.'
    : device.name === 'FX Layer'
      ? 'All entries run in parallel and receive the same audio input. Exclusive solo auditions one entry.'
      : 'The container exposes named entries and exclusive solo state. Its input routing was not identified.';
  return {
    readable: true,
    container: { trackId: id, devicePosition: position },
    containerKind: device.name,
    routing,
    complete: device.container.chainsComplete,
    capacity: device.container.chainsBankSize ?? null,
    exclusiveActive: observedState.exclusiveActive,
    alternates: device.container.chains.map((item) => ({
      name: item.name,
      soloed: typeof item.solo === 'boolean' ? item.solo : null,
      state: {
        mute: typeof item.mute === 'boolean' ? item.mute : null,
        volume: typeof item.volume === 'number' ? item.volume : null,
        pan: typeof item.pan === 'number' ? item.pan : null,
        color: item.color ?? null,
      },
      devicesComplete: item.devicesComplete,
      devices: item.devices.map((nested) => ({
        position: nested.index,
        name: nested.name,
      })),
    })),
  };
}

// --- the tools ---------------------------------------------------------------

export const TOOLS: readonly ToolSpec[] = [
  // ============================== read ======================================
  tool({
    name: 'check_connection',
    kind: 'read',
    title: 'Check the connection to Bitwig',
    description:
      'Confirm Bitwig is running with the ghostnote extension loaded, and report which project '
      + 'is open and how much of it this connection can address. Anything outside what it can '
      + 'address is invisible to every other tool here — not empty, invisible — so a project '
      + 'larger than that is refused rather than worked on half-blind.',
    inputSchema: {},
    async run(workspace) {
      return writing(async () => {
        const at = await workspace.mark();
        return {
          reachable: true,
          project: at.project === '' ? null : at.project,
          tracks: coverage(at.window.tracks),
          rows: coverage(at.window.scenes),
        };
      });
    },
  }),

  tool({
    name: 'inspect_clip_music_operation',
    kind: 'read',
    title: 'Inspect a clip music operation',
    description:
      'Read the current or terminal state of a background clip music operation. A terminal state '
      + 'confirms that the operation will make no later project change. A completed result '
      + 'includes the same output as the corresponding direct music tool. A cancelled result '
      + 'lists every change that finished verification and was recorded before cancellation.',
    inputSchema: { operationId },
    emits: [],
    async run(workspace, args) {
      return workspace.operations.status(args.operationId);
    },
  }),

  tool({
    name: 'read_observation_record',
    kind: 'read',
    title: 'Read the raw observation record',
    description:
      'Return the complete validated per-project observation record and its canonical JSON. '
      + 'Every raw instruction, independent managed event, musical use, ordinary track-copy use, '
      + 'response, result identity, and description version stays present. This tool does not classify, '
      + 'compact, delete, or change the record.',
    inputSchema: {},
    async run(workspace) {
      return writing(async () => workspace.observations.snapshot());
    },
  }),

  tool({
    name: 'report_observations',
    kind: 'read',
    title: 'Report observation counts',
    description:
      'Return descriptive counts and response rates from the complete per-project observation '
      + 'record. The report cross-tabulates caller-supplied requested scope with separate counts '
      + 'for device events, launcher-clip events, musical generation, musical transformation, '
      + 'and ordinary track copies. It also reports '
      + 'no-result instructions and choice diversity. The report does not score, recommend, '
      + 'redirect, or select a tool.',
    inputSchema: {},
    async run(workspace) {
      return writing(async () => {
        const snapshot = await workspace.observations.snapshot();
        return reportObservationRecord(snapshot.record);
      });
    },
  }),

  tool({
    name: 'list_tracks',
    kind: 'read',
    title: 'List the project\'s tracks',
    description:
      'Every track this connection can address, with the id the other tools name it by. The id '
      + 'survives renaming and reordering and is the only durable name a track has: a track that '
      + 'is deleted and made again is a different track with a new id. Tracks beyond what this '
      + 'connection can address are not listed at all, and how many were left out is reported '
      + 'separately — an incomplete list is never presented as a complete one.',
    inputSchema: {},
    async run(workspace) {
      return writing(async () => {
        const [tracks, at] = [await workspace.tracks(), await workspace.mark()];
        const missing = blindCount(at.window.tracks);
        return {
          tracks: tracks.map((t) => ({
            trackId: t.channelId,
            name: t.name,
            kind: t.type,
            position: t.position,
          })),
          rows: coverage(at.window.scenes),
          notListed: missing < 0 ? null : missing,
          notListedWhy: missing === 0
            ? undefined
            : 'these tracks exist and cannot be addressed through this connection. Raise '
              + '`tracks` in ~/.ghostnote/rig.json and reload the controller.',
        };
      });
    },
  }),

  tool({
    name: 'read_clip',
    kind: 'read',
    title: 'Read one clip',
    description:
      'What is in one launcher slot: whether a clip is there, how long it is in beats, and its '
      + 'notes. An empty clip and an absent clip are reported differently, because they are '
      + 'different facts and only one of them can be written into. Notes come back as they read '
      + 'back rather than as anything was asked for — lengths and gain in particular can differ; '
      + 'see write_notes.',
    inputSchema: {
      trackId,
      row,
      channel,
    },
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const clip = clipOf(args.trackId, args.row, at);
        const notesAddress = notesAt(clip, args.channel ?? 0);
        // ⚠ The TRACK is read alongside the slot, and not for symmetry. An id
        // that names nothing reads exactly like an empty slot from here — both
        // are simply absent from the answer — so without this, a mistyped id
        // would come back as the confident, wrong sentence "there is no clip
        // there".
        const trackAddress = trackAt(args.trackId);
        const launchAddress = launchAt(clip);
        const playAddress = playAt(clip);
        const snapshot = await workspace.read([
          trackAddress, clip, notesAddress, launchAddress, playAddress,
        ]);
        const clipEntry = snapshot.entries[addressKey(clip)];
        const notesEntry = snapshot.entries[addressKey(notesAddress)];
        const launchEntry = snapshot.entries[addressKey(launchAddress)];
        const playEntry = snapshot.entries[addressKey(playAddress)];
        const value = clipEntry?.value.of === 'clip' ? clipEntry.value : undefined;
        const where = describeAddress(clip);

        if (snapshot.unreachable.length > 0) {
          return {
            where,
            readable: false,
            why: 'this slot is outside what this connection can address, so it cannot be read. '
              + 'Invisible is not the same as empty, and nothing about it is reported as though '
              + 'it were.',
          };
        }
        if (snapshot.entries[addressKey(trackAddress)] === undefined) {
          return {
            where,
            readable: false,
            why: 'that id does not name a track this connection can see. `list_tracks` reports '
              + 'the ids that exist; a track that was deleted never resolves again.',
          };
        }
        return {
          where,
          readable: true,
          clipExists: value?.exists === true,
          lengthBeats: value?.lengthBeats ?? null,
          notes: notesEntry?.value.of === 'notes' ? notesEntry.value.notes : [],
          launch: launchEntry?.value.of === 'clipLaunch' ? launchEntry.value.launch : null,
          playback: playEntry?.value.of === 'clipPlay' ? playEntry.value.play : null,
        };
      });
    },
  }),

  tool({
    name: 'inspect_device_alternates',
    kind: 'read',
    title: 'Inspect device alternates',
    description:
      'Read every named device alternate inside one container, including its device order and '
      + 'observed solo flag. The container is named by its position in the track; adding or removing '
      + 'devices before it changes that position. Only positions 0 and 1 can expose container '
      + 'contents through the current observer. A partial sibling or device view is labelled '
      + 'partial and is never presented as complete. An exclusive active name is reported only '
      + 'when the complete sibling read shows exactly one soloed entry; no claim about effective '
      + 'audibility is made. Device alternates carry devices and device '
      + 'state, not clips, sends, routing or track mixer state.',
    inputSchema: {
      trackId,
      containerPosition: z.number().int().min(0).describe(
        'Position of the containing device in the track, counting from 0. Only 0 and 1 expose container contents.',
      ),
    },
    async run(workspace, args) {
      return writing(() => deviceAlternatesAt(workspace, args.trackId, args.containerPosition));
    },
  }),

  tool({
    name: 'inspect_clip_block',
    kind: 'read',
    title: 'Inspect a contiguous clip block',
    description:
      'Check a range on one launcher track. Every row in the range is read, along with the slots '
      + 'immediately above and below it. The answer reports whether the range is contiguous and '
      + 'whether both boundaries are empty. A missing row is reported as missing, never empty. '
      + 'Tool rows count from 0; Bitwig scene rows count from 1.',
    inputSchema: {
      trackId,
      firstRow: row.describe('First row in the range, counting from 0.'),
      lastRow: row.describe('Last row in the range, inclusive and counting from 0.'),
    },
    async run(workspace, args) {
      return writing(async () => {
        if (args.firstRow > args.lastRow) {
          return {
            readable: false,
            why: 'firstRow must be less than or equal to lastRow. Nothing was read as a block.',
          };
        }
        const at = await workspace.mark();
        const count = at.window.scenes.count;
        if (count >= 0 && args.lastRow >= count) {
          return {
            readable: false,
            why: 'the range reaches a row that does not exist. Add launcher rows at the end, then '
              + 'inspect the range again.',
            rowsInProject: count,
          };
        }

        const firstRead = Math.max(0, args.firstRow - 1);
        const lastRead = Math.min(
          at.window.scenes.bankSize - 1,
          count < 0 ? args.lastRow + 1 : Math.min(count - 1, args.lastRow + 1),
        );
        const clips = Array.from(
          { length: Math.max(0, lastRead - firstRead + 1) },
          (_, offset) => clipOf(args.trackId, firstRead + offset, at),
        );
        const trackAddress = trackAt(args.trackId);
        const snapshot = await workspace.read([trackAddress, ...clips]);
        if (snapshot.entries[addressKey(trackAddress)] === undefined) {
          return {
            readable: false,
            why: 'that id does not name a track this connection can see. list_tracks reports the '
              + 'ids that exist.',
          };
        }
        if (snapshot.unreachable.length > 0) {
          return {
            readable: false,
            why: 'part of the range is outside the rows this connection can address. Invisible is '
              + 'not the same as empty.',
          };
        }

        const occupied = (index: number): boolean | undefined => {
          const address = clipOf(args.trackId, index, at);
          const entry = snapshot.entries[addressKey(address)];
          return entry?.value.of === 'clip' ? entry.value.exists : undefined;
        };
        const rows = Array.from(
          { length: args.lastRow - args.firstRow + 1 },
          (_, offset) => args.firstRow + offset,
        );
        const above = args.firstRow === 0
          ? 'project-edge'
          : occupied(args.firstRow - 1) === false ? 'empty' : 'occupied';
        const below = count >= 0 && args.lastRow + 1 >= count
          ? 'missing-row'
          : occupied(args.lastRow + 1) === false ? 'empty' : 'occupied';
        const contiguous = rows.every((index) => occupied(index) === true);
        return {
          readable: true,
          range: {
            firstRow: args.firstRow,
            lastRow: args.lastRow,
            firstBitwigSceneRow: args.firstRow + 1,
            lastBitwigSceneRow: args.lastRow + 1,
          },
          rows: rows.map((index) => ({
            row: index,
            bitwigSceneRow: index + 1,
            clipExists: occupied(index) === true,
          })),
          contiguous,
          boundaryAbove: above,
          boundaryBelow: below,
          boundedByEmptySlots: contiguous && above === 'empty' && below === 'empty',
        };
      });
    },
  }),

  tool({
    name: 'list_changes',
    kind: 'read',
    title: 'List what this session changed',
    description:
      'Everything written through this connection since it opened, newest first, with what each '
      + 'change can and cannot put back. This is the whole of what revert_change can undo: edits '
      + 'made before this connection opened, or by a person in Bitwig, are theirs to undo there.',
    inputSchema: {
      limit: z.number().int().min(1).max(200).default(20).optional()
        .describe('How many of the most recent changes to report.'),
    },
    async run(workspace, args) {
      return writing(async () => {
        const summaries = workspace.changes.list().slice(0, args.limit ?? 20);
        return {
          changes: summaries.map((summary) => {
            const change = workspace.changes.get(summary.id);
            const receipt = change === undefined ? undefined : receiptOf(change);
            return {
              changeId: summary.id,
              order: summary.seq,
              applied: summary.applied,
              at: summary.createdAtMs,
              places: receipt?.places ?? [],
              canBeUndone: receipt?.canBeUndone ?? false,
              cannotBeUndone: receipt?.cannotBeUndone ?? [],
            };
          }),
        };
      });
    },
  }),

  tool({
    name: 'check_revert',
    kind: 'read',
    title: 'Check what undoing a change would do',
    description:
      'Report what putting one of this session\'s changes back would restore and what it would '
      + 'not, without altering anything. The answer is the same one revert_change acts on, worked '
      + 'out the same way: every place is compared against what that change left there, and any '
      + 'place a person has edited since — or that has had a clip moved into or out of it, even '
      + 'an identical one — is left alone and reported.',
    inputSchema: {
      changeId: z.string().describe('From list_changes.'),
      scope: scopeInput,
    },
    async run(workspace, args) {
      return writing(async () => {
        const slice = sliceFor(workspace, args.changeId, args.scope);
        const plan = await workspace.planRevert(args.changeId, slice);
        const change = workspace.changes.require(args.changeId);
        return {
          ...reversalReport(plan, change.take.targets),
          wouldWriteAnything: plan.ops.length > 0,
        };
      });
    },
  }),

  // ============================== focus =====================================
  tool({
    name: 'show_changed_clip',
    kind: 'focus',
    title: 'Show one changed clip in Bitwig',
    description:
      'Open one launcher clip from a recorded change in Bitwig\'s detail editor, request the '
      + 'edit layout, and fit the clip content. This changes Bitwig UI focus only. It does not '
      + 'change project content, create a change record, or run automatically. If the change '
      + 'has several current clip targets, call again with one target returned here.',
    inputSchema: {
      changeId: z.string().describe('From list_changes.'),
      target: z.object({
        trackId: z.string().describe('The durable track id returned in the change location.'),
        row: z.number().int().min(0).describe('The zero-based launcher row returned in the change location.'),
      }).optional().describe('Required when the change has several current clip targets.'),
    },
    async run(workspace, args) {
      return writing(async () => showChangedClip(workspace, args.changeId, args.target));
    },
  }),

  // ============================== write =====================================
  tool({
    name: 'record_observation',
    kind: 'write',
    title: 'Record explicit instruction context',
    description:
      'Store caller-supplied context for later measurement without changing tracks, clips, or '
      + 'devices. Begin before related tool calls to link their independently confirmed results, '
      + 'including musical results. '
      + 'Enrich after the calls to add a rationale or an explicit accepted or vetoed response. '
      + 'Enrichment completes the active observation unless complete is false. No response is '
      + 'inferred from tool success, permission, or silence.',
    inputSchema: {
      operation: z.enum(['begin', 'enrich']),
      requestedScope: z.enum([
        'device-only', 'launcher-clip-only', 'mixed', 'unsupported',
      ]).optional().describe('Required for begin. The caller classifies the requested object scope.'),
      rawScope: jsonInput.optional().describe(
        'Required for begin. Exact caller-supplied instruction text or structured scope.',
      ),
      instructionId: z.string().min(1).optional().describe(
        'Required for enrich. The instruction observation id returned by begin.',
      ),
      resultIds: z.array(z.string().min(1)).optional().describe(
        'Already recorded result ids to relate. Results from an active observation are linked automatically.',
      ),
      rationale: z.string().optional().describe('Caller-supplied rationale. It is never inferred.'),
      operatorResponse: z.enum(['accepted', 'vetoed']).optional().describe(
        'An explicit operator response. Omission preserves silent.',
      ),
      complete: z.boolean().optional().describe(
        'For enrich only. Defaults to true and clears the active observation for this session.',
      ),
    },
    async run(workspace, args) {
      return writing(async () => {
        if (args.operation === 'begin') {
          if (args.requestedScope === undefined || args.rawScope === undefined) {
            throw new Error('begin needs requestedScope and rawScope.');
          }
          if (args.instructionId !== undefined || args.operatorResponse !== undefined
              || args.complete !== undefined) {
            throw new Error(
              'begin does not accept instructionId, operatorResponse, or complete. Use enrich.',
            );
          }
          const observation = await workspace.observations.begin({
            requestedScope: args.requestedScope,
            rawScope: args.rawScope,
            ...(args.rationale === undefined ? {} : { rationale: args.rationale }),
            ...(args.resultIds === undefined ? {} : { resultIds: args.resultIds }),
          });
          return {
            recorded: true,
            instructionId: observation.id,
            correlationId: observation.correlationId,
            operatorResponse: observation.operatorResponse,
            resultIds: observation.resultIds,
            active: true,
          };
        }
        if (args.instructionId === undefined) {
          throw new Error('enrich needs instructionId.');
        }
        if (args.requestedScope !== undefined || args.rawScope !== undefined) {
          throw new Error('enrich does not replace requestedScope or rawScope.');
        }
        const observation = await workspace.observations.enrich({
          instructionId: args.instructionId,
          ...(args.rationale === undefined ? {} : { rationale: args.rationale }),
          ...(args.operatorResponse === undefined
            ? {}
            : { operatorResponse: args.operatorResponse }),
          ...(args.resultIds === undefined ? {} : { resultIds: args.resultIds }),
          ...(args.complete === undefined ? {} : { complete: args.complete }),
        });
        return {
          recorded: true,
          instructionId: observation.id,
          correlationId: observation.correlationId,
          operatorResponse: observation.operatorResponse,
          resultIds: observation.resultIds,
          active: args.complete === false,
        };
      });
    },
  }),

  tool({
    name: 'generate_clip_music',
    kind: 'write',
    title: 'Generate music in existing clips',
    description:
      'Generate notes in one or more existing launcher clips with musical patch version 1. Every '
      + 'target starts with generate. Track ids are durable ids from list_tracks. Rows and note '
      + 'times count from zero in beats. MIDI channels are 0-15. Each source clip must already '
      + 'exist. This tool does not remove clip containers.\n'
      + 'Merge keeps existing notes and adds the output. Replace changes only the addressed MIDI '
      + 'channel after all 16 channels are read. An identical note address, an unread channel, '
      + 'pressure, or a pitch outside MIDI 0-127 is refused before a write. Timing, expression, '
      + 'added notes, removed notes, and shortened overlaps are returned as differences.\n'
      + 'Direct work creates no alternate. It is recorded for revert_change and is refused if the '
      + 'prior clip cannot be restored. Requested variations copy the source clip into adjacent '
      + 'rows before any note write. Fidelity-required work needs an adjacent existing protected '
      + 'row whose notes match on all 16 channels. The complete patch is one revision-bound change.\n'
      + 'The result returns outputs, differences, warnings, clip rows, readback, a change id, and '
      + 'reversal limits. Use read_clip to inspect an output, revert_change to put the change back, '
      + 'and show_changed_clip to open one changed clip in the editor.',
    inputSchema: musicalToolInputSchema,
    inputValidator: musicalToolInputValidator,
    resultContract: MUSICAL_RESULT_CONTRACT,
    emits: ['clip.duplicate', 'note.clear', 'note.write'],
    observation: 'musical-generation',
    async run(workspace, args) {
      return writing(async () =>
        publicMusicalResult(await applyMusicalPatch(workspace, args, 'generation')));
    },
  }),

  tool({
    name: 'transform_clip_music',
    kind: 'write',
    title: 'Transform music in existing clips',
    description:
      'Transform notes already in one or more launcher clips with musical patch version 1. No '
      + 'target starts with generate. Track ids are durable ids from list_tracks. Rows and note '
      + 'times count from zero in beats. MIDI channels are 0-15. Each source clip must already '
      + 'exist. This tool does not remove clip containers.\n'
      + 'Operations run in the order supplied. Merge keeps existing notes and adds the output. '
      + 'Replace changes only the addressed MIDI channel after all 16 channels are read. A '
      + 'matching note address, an unread channel, pressure, or a pitch outside MIDI 0-127 is '
      + 'refused before a write. Timing, expression, added notes, removed notes, and shortened '
      + 'overlaps are returned as differences.\n'
      + 'Direct work creates no alternate. It is recorded for revert_change and is refused if the '
      + 'prior clip cannot be restored. Requested variations copy the source clip into adjacent '
      + 'rows before any note write. Fidelity-required work needs an adjacent existing protected '
      + 'row whose notes match on all 16 channels. The complete patch is one revision-bound change.\n'
      + 'The result returns outputs, differences, warnings, clip rows, readback, a change id, and '
      + 'reversal limits. Use read_clip to inspect an output, revert_change to put the change back, '
      + 'and show_changed_clip to open one changed clip in the editor.',
    inputSchema: musicalToolInputSchema,
    inputValidator: musicalToolInputValidator,
    resultContract: MUSICAL_RESULT_CONTRACT,
    emits: ['clip.duplicate', 'note.clear', 'note.write'],
    observation: 'musical-transformation',
    async run(workspace, args) {
      return writing(async () =>
        publicMusicalResult(await applyMusicalPatch(workspace, args, 'transformation')));
    },
  }),

  tool({
    name: 'start_clip_music_operation',
    kind: 'write',
    title: 'Start a clip music operation',
    description:
      'Start a generation or transformation in the background and return an operation id '
      + 'immediately. The direct music tools remain available for short calls. Inspect this '
      + 'operation until it is terminal before starting recovery work. Cancellation stops before '
      + 'the next project-write unit. A write already in progress finishes independent readback '
      + 'and recording before cancellation becomes terminal.',
    inputSchema: {
      operation: z.enum(['generation', 'transformation']),
      patch: musicalToolInputValidator,
    },
    emits: ['clip.duplicate', 'note.clear', 'note.write'],
    async run(workspace, args) {
      return workspace.operations.start(args.operation, async ({ signal, record }) => {
        const scoped = cancellableWorkspace(workspace, signal, record);
        const toolName = args.operation === 'generation'
          ? 'generate_clip_music'
          : 'transform_clip_music';
        const result = await callTool(scoped, toolName, args.patch);
        signal.throwIfAborted();
        return result;
      });
    },
  }),

  tool({
    name: 'cancel_clip_music_operation',
    kind: 'write',
    title: 'Cancel a clip music operation',
    description:
      'Request cancellation of a background clip music operation. The first answer can be '
      + 'cancelling while a current read or project-write unit finishes. Inspect the operation '
      + 'until it is terminal. Terminal cancellation confirms that it will make no later project '
      + 'change. Repeating this call for a terminal operation does not change its result.',
    inputSchema: { operationId },
    emits: [],
    async run(workspace, args) {
      return workspace.operations.cancel(args.operationId);
    },
  }),

  tool({
    name: 'copy_clip_down',
    kind: 'write',
    title: 'Copy a clip to the next row',
    description:
      'Copy one launcher clip into the immediately following row on the same track. The '
      + 'destination must already exist and is positively read as empty before the call; an '
      + 'occupied destination is refused because Bitwig would silently replace its clip without '
      + 'an occupancy event. Add rows only at the end with add_scenes when room is missing.\n'
      + 'The source is first set to the requested launch grid and mode, and those settings travel '
      + 'with the copied clip. A person clicking either clip in Bitwig then gets the same launch '
      + 'behaviour. continue_or_synced enters at the outgoing clip position on the grid; that '
      + 'position continuity requires the outgoing clip itself to be on the grid.\n'
      + 'Hands-off cycling is not configured here. Bitwig Next Actions cannot be set, read, or '
      + 'verified through this API. A person must configure them in the Inspector, and this '
      + 'system cannot distinguish configured from unconfigured. Tool row N is Bitwig scene row N+1.',
    inputSchema: {
      trackId,
      row: row.describe('Source row, counting from 0. The destination is row + 1.'),
      quantization: launchQuantization,
      mode: launchMode,
      useLoopStartAsQuantizationReference: z.boolean().default(false).optional().describe(
        'Whether the clip loop start, rather than the project grid, is the quantization reference.',
      ),
    },
    emits: ['clip.launchSettings', 'clip.duplicate'],
    observation: 'clip-block',
    status: ['clip-alternate'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const destinationRow = args.row + 1;
        if (at.window.scenes.count >= 0 && destinationRow >= at.window.scenes.count) {
          return {
            refused: true,
            nothingWasWritten: true,
            why: 'the destination row does not exist. Add one launcher row at the end with '
              + 'add_scenes, then repeat this call.',
            destination: { row: destinationRow, bitwigSceneRow: destinationRow + 1 },
          };
        }
        const source = clipOf(args.trackId, args.row, at);
        const destination = slotOf(args.trackId, destinationRow, at);
        const snapshot = await workspace.read([
          trackAt(args.trackId), source, clipAt(destination),
        ]);
        if (snapshot.unreachable.length > 0) {
          throw blindSpotError(snapshot.unreachable, at.window);
        }
        const sourceEntry = snapshot.entries[addressKey(source)];
        if (sourceEntry?.value.of !== 'clip' || !sourceEntry.value.exists) {
          throw new AddressUnresolvedError(source, 'the source slot does not contain a clip');
        }
        const destinationEntry = snapshot.entries[addressKey(clipAt(destination))];
        if (destinationEntry?.value.of !== 'clip' || destinationEntry.value.exists) {
          throw new SlotOccupiedError([clipAt(destination)], 'overwrite');
        }

        const quantizationReference = args.useLoopStartAsQuantizationReference ?? false;
        const change = await workspace.apply([
          {
            op: 'clip.launchSettings',
            clip: source,
            quantization: args.quantization,
            mode: args.mode,
            useLoopStartAsQuantizationReference: quantizationReference,
          },
          { op: 'clip.duplicate', source, destination },
          {
            op: 'clip.launchSettings',
            clip: clipAt(destination),
            quantization: args.quantization,
            mode: args.mode,
            useLoopStartAsQuantizationReference: quantizationReference,
          },
        ]);
        const copied = clipAt(destination);
        const verified = await workspace.read([launchAt(copied)]);
        const launchEntry = verified.entries[addressKey(launchAt(copied))];
        const launch = launchEntry?.value.of === 'clipLaunch' ? launchEntry.value.launch : null;
        return {
          ...receiptOf(change),
          creationConfirmed: launch !== null,
          copiedTo: {
            trackId: args.trackId,
            row: destinationRow,
            bitwigSceneRow: destinationRow + 1,
          },
          clickLaunch: launch,
          clickLaunchVerified: launch?.quantization === args.quantization
            && launch.mode === args.mode
            && launch.useLoopStartAsQuantizationReference === quantizationReference,
          handsOffCycling:
            'not configured. Next Actions require a person in Bitwig, and their state cannot be read here.',
        };
      });
    },
  }),

  tool({
    name: 'set_clip_launch',
    kind: 'write',
    title: 'Set how clips launch',
    description:
      'Set the per-clip launch grid and mode used by a person clicking clips in Bitwig. The prior '
      + 'values are read and recorded, so this change can be undone. continue_or_synced enters at '
      + 'the outgoing clip position on the grid; that position continuity requires the outgoing '
      + 'clip itself to be on the grid. This does not start playback and does not configure Next '
      + 'Actions.',
    inputSchema: {
      clips: z.array(z.object({
        trackId,
        row,
        quantization: launchQuantization,
        mode: launchMode,
        useLoopStartAsQuantizationReference: z.boolean().default(false).optional(),
      })).min(1),
    },
    emits: ['clip.launchSettings'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const ops: Op[] = args.clips.map((item) => ({
          op: 'clip.launchSettings',
          clip: clipOf(item.trackId, item.row, at),
          quantization: item.quantization,
          mode: item.mode,
          useLoopStartAsQuantizationReference:
            item.useLoopStartAsQuantizationReference ?? false,
        }));
        return receiptOf(await workspace.apply(ops));
      });
    },
  }),

  tool({
    name: 'set_clip_metadata',
    kind: 'write',
    title: 'Set complete clip metadata',
    description:
      'Set the complete measured metadata of clips that already exist. Each item must include '
      + 'the name, colour, loop length, play start, loop state, loop start, and loop end. The '
      + 'complete state prevents omitted fields from inheriting side effects from another field. '
      + 'The prior state is recorded for reversal. The result includes readback taken after the '
      + 'write; a mismatch is reported and never hidden.',
    inputSchema: {
      clips: z.array(z.object({
        trackId,
        row,
        metadata: clipMetadataInput,
      }).strict()).min(1),
    },
    emits: ['clip.update'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const targets = args.clips.map((item) => ({
          clip: clipOf(item.trackId, item.row, at),
          metadata: item.metadata,
        }));
        const change = await workspace.apply(targets.map((item) => ({
          op: 'clip.update' as const,
          clip: item.clip,
          metadata: item.metadata,
        })));
        const readback = await workspace.read(targets.map((item) => metadataAt(item.clip)));
        return {
          ...receiptOf(change),
          clips: targets.map((item, index) => {
            const entry = readback.entries[addressKey(metadataAt(item.clip))];
            const found = entry?.value.of === 'clipMetadata' ? entry.value.metadata : null;
            return {
              trackId: args.clips[index]!.trackId,
              row: args.clips[index]!.row,
              metadata: found,
              metadataVerified: found !== null
                && sameClipMetadata(found, item.metadata),
            };
          }),
        };
      });
    },
  }),

  tool({
    name: 'launch_clip',
    kind: 'write',
    title: 'Launch one clip',
    description:
      'Launch one launcher clip with a per-call grid and mode, then read whether it is queued or '
      + 'playing. '
      + 'This starts the transport. One call performs one switch; it does not keep cycling. '
      + 'continue_or_synced enters at the outgoing clip position on the grid, provided the '
      + 'outgoing clip itself is on that grid. Automatic reversal does not stop the transport or '
      + 'restore the prior playback state.',
    inputSchema: { trackId, row, quantization: launchQuantization, mode: launchMode },
    emits: ['clip.launch'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const clip = clipOf(args.trackId, args.row, at);
        const change = await workspace.apply([{
          op: 'clip.launch',
          clip,
          quantization: args.quantization,
          mode: args.mode,
        }]);
        const snapshot = await workspace.read([playAt(clip)]);
        const entry = snapshot.entries[addressKey(playAt(clip))];
        return {
          ...receiptOf(change),
          playback: entry?.value.of === 'clipPlay' ? entry.value.play : null,
          startsTransport: true,
          oneCallPerSwitch: true,
          positionContinuousOnlyIfOutgoingClipIsOnGrid: true,
        };
      });
    },
  }),

  tool({
    name: 'move_clip_block',
    kind: 'write',
    title: 'Move a contiguous clip block',
    description:
      'Move a contiguous range of clips intact on one track, including clip metadata and '
      + 'automation. Source rows must all hold clips. The destination range and the empty slots '
      + 'directly outside it must already exist unless the upper boundary is the project edge; '
      + 'destination rows outside the source range must be empty. Overlapping moves are ordered '
      + 'from the far edge inward so no clip is replaced.\n'
      + 'Clips have no durable identity, so revert_change does not move them back automatically. '
      + 'The answer supplies the exact reverse call. That reverse is safe only while the old '
      + 'source rows remain empty and the new rows still hold these clips. Tool rows count from '
      + '0; Bitwig scene rows count from 1.',
    inputSchema: {
      trackId,
      firstRow: row.describe('First source row, inclusive.'),
      lastRow: row.describe('Last source row, inclusive.'),
      destinationFirstRow: row.describe('Where the first source clip will land.'),
    },
    emits: ['clip.move'],
    async run(workspace, args) {
      return writing(async () => {
        if (args.firstRow > args.lastRow || args.destinationFirstRow === args.firstRow) {
          return {
            refused: true,
            nothingWasWritten: true,
            why: args.firstRow > args.lastRow
              ? 'firstRow must be less than or equal to lastRow.'
              : 'the source and destination ranges are the same, so there is nothing to move.',
          };
        }
        const at = await workspace.mark();
        const length = args.lastRow - args.firstRow + 1;
        const destinationLastRow = args.destinationFirstRow + length - 1;
        const requiredLastRow = destinationLastRow + 1;
        if (at.window.scenes.count >= 0 && requiredLastRow >= at.window.scenes.count) {
          return {
            refused: true,
            nothingWasWritten: true,
            why: 'the destination range has no existing empty slot below it. Add launcher rows '
              + 'at the end, then inspect and repeat the move.',
            requiredRowsInProject: requiredLastRow + 1,
          };
        }

        const sourceRows = Array.from({ length }, (_, offset) => args.firstRow + offset);
        const destinationRows = Array.from(
          { length }, (_, offset) => args.destinationFirstRow + offset,
        );
        const rowsToRead = [...new Set([
          ...sourceRows,
          ...destinationRows,
          args.destinationFirstRow - 1,
          destinationLastRow + 1,
        ].filter((index) => index >= 0))];
        const clips = rowsToRead.map((index) => clipOf(args.trackId, index, at));
        const snapshot = await workspace.read([trackAt(args.trackId), ...clips]);
        if (snapshot.unreachable.length > 0) {
          throw blindSpotError(snapshot.unreachable, at.window);
        }
        const occupied = (index: number): boolean | undefined => {
          const entry = snapshot.entries[addressKey(clipOf(args.trackId, index, at))];
          return entry?.value.of === 'clip' ? entry.value.exists : undefined;
        };
        if (!sourceRows.every((index) => occupied(index) === true)) {
          const empty = sourceRows.find((index) => occupied(index) !== true)!;
          throw new AddressUnresolvedError(
            clipOf(args.trackId, empty, at),
            'every source row must contain a verified clip',
          );
        }
        const sourceSet = new Set(sourceRows);
        const blocked = destinationRows.filter(
          (index) => !sourceSet.has(index) && occupied(index) !== false,
        );
        const boundaries = [args.destinationFirstRow - 1, destinationLastRow + 1]
          .filter((index) => index >= 0 && !sourceSet.has(index));
        blocked.push(...boundaries.filter((index) => occupied(index) !== false));
        if (blocked.length > 0) {
          throw new SlotOccupiedError(
            [...new Set(blocked)].map((index) => clipOf(args.trackId, index, at)),
            'overwrite',
          );
        }

        const ordered = args.destinationFirstRow > args.firstRow
          ? [...sourceRows].reverse()
          : sourceRows;
        const ops: Op[] = ordered.map((sourceRow) => {
          const offset = sourceRow - args.firstRow;
          return {
            op: 'clip.move',
            source: clipOf(args.trackId, sourceRow, at),
            destination: slotOf(args.trackId, args.destinationFirstRow + offset, at),
          };
        });
        const change = await workspace.apply(ops, {
          clearance: branchProtected(
            `clip-move:${args.trackId}:${args.firstRow}-${args.lastRow}>${args.destinationFirstRow}`,
          ),
        });
        return {
          ...receiptOf(change),
          movedTo: {
            firstRow: args.destinationFirstRow,
            lastRow: destinationLastRow,
            firstBitwigSceneRow: args.destinationFirstRow + 1,
            lastBitwigSceneRow: destinationLastRow + 1,
          },
          reverse: {
            tool: 'move_clip_block',
            trackId: args.trackId,
            firstRow: args.destinationFirstRow,
            lastRow: destinationLastRow,
            destinationFirstRow: args.firstRow,
          },
        };
      });
    },
  }),

  tool({
    name: 'write_notes',
    kind: 'write',
    title: 'Write notes into clips',
    description:
      'Add notes to clips that already exist. Times and lengths are in beats. Several clips in '
      + 'one call are written as one batch, which is both faster and safer than several calls: '
      + 'the whole batch is refused if anything else writes to the project in the middle of it.\n'
      + 'Notes MERGE with what is already in the clip — to replace, erase_notes first.\n'
      + 'Measured behaviour to plan around: a note ends where the next note of the same pitch '
      + 'begins, so a length can come back shorter than asked; gain uses its measured inverse; '
      + 'pressure cannot be written through this API at all and '
      + 'is not accepted.\n'
      + 'Writing into a slot with no clip is refused rather than attempted, because pointing at '
      + 'an empty slot lands on a different clip and reports success. Create it with add_clip, '
      + 'which can carry the notes in the same call.\n'
      + 'A write that would replace something whose exact state cannot be recorded first is '
      + 'refused and nothing is written; what is in the way is named in the refusal. Note starts '
      + 'and durations must fit a supported writable grid. The finest supported grid is 1/64 beat.',
    inputSchema: {
      clips: z.array(z.object({
        trackId,
        row,
        channel,
        notes: z.array(noteInput).min(1),
      })).min(1),
    },
    emits: ['note.write'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const ops: Op[] = args.clips.map((c) => ({
          op: 'note.write',
          clip: clipOf(c.trackId, c.row, at),
          ...(c.channel === undefined ? {} : { channel: c.channel }),
          notes: c.notes.map(toNote),
        }));
        return receiptOf(await workspace.apply(ops));
      });
    },
  }),

  tool({
    name: 'erase_notes',
    kind: 'write',
    title: 'Erase notes from clips',
    description:
      'Remove all notes from clips that already exist. The clip itself stays; delete_clip '
      + 'removes the clip. The host clear applies to all MIDI channels.\n'
      + 'What was there is read and recorded first, so this can be undone with revert_change. If '
      + 'the notes carry pressure that a person authored, the call is refused and nothing is '
      + 'erased, because pressure cannot be written back. All other note properties, including '
      + 'gain through its measured inverse, can be restored.',
    inputSchema: {
      clips: z.array(z.object({
        trackId,
        row,
      }).strict()).min(1),
    },
    emits: ['note.clear'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const ops: Op[] = args.clips.map((c) => ({
          op: 'note.clear',
          clip: clipOf(c.trackId, c.row, at),
        }));
        return receiptOf(await workspace.apply(ops));
      });
    },
  }),

  tool({
    name: 'add_clip',
    kind: 'write',
    title: 'Create clips, optionally with notes',
    description:
      'Create a clip in an empty launcher slot, with its notes in the same call if wanted — one '
      + 'batch, and the clip is there before its notes are written.\n'
      + 'A slot that already holds a clip is refused. Bitwig neither refuses that nor overwrites: '
      + 'it appends a row at the end of the project and puts the new clip out there, past what '
      + 'anything can address, where it can be neither reached nor removed. Delete the clip first '
      + 'or name an empty slot.\n'
      + 'Creating a clip can be undone exactly, by removing it again.',
    inputSchema: {
      clips: z.array(z.object({
        trackId,
        row,
        lengthBeats: z.number().positive().describe('The clip\'s length in beats.'),
        notes: z.array(noteInput).optional(),
      })).min(1),
    },
    emits: ['clip.create', 'note.write'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const slots = args.clips.map((c) => slotOf(c.trackId, c.row, at));

        // ⚠ Asked HERE as well as inside the engine, and not out of distrust: the
        // engine reaches the occupancy rule second. A slot holding a clip is a
        // slot holding something that cannot be reproduced exactly — a clip's
        // name, colour and automation have no readback — so the refusal that
        // fires first is the general one about recording, which is true and tells
        // an agent nothing it can act on. This one names the slot.
        const occupied = await workspace.read(slots.map(clipAt));
        const taken = slots.filter((slot) => {
          const entry = occupied.entries[addressKey(clipAt(slot))];
          return entry?.value.of === 'clip' && entry.value.exists;
        });
        if (taken.length > 0) throw new SlotOccupiedError(taken.map(clipAt));

        const ops: Op[] = [];
        for (const [index, c] of args.clips.entries()) {
          const slot = slots[index]!;
          ops.push({ op: 'clip.create', slot, lengthBeats: c.lengthBeats });
          if (c.notes !== undefined && c.notes.length > 0) {
            ops.push({ op: 'note.write', clip: clipAt(slot), notes: c.notes.map(toNote) });
          }
        }
        return receiptOf(await workspace.apply(ops));
      });
    },
  }),

  tool({
    name: 'add_track',
    kind: 'write',
    title: 'Create instrument tracks',
    description:
      'Create instrument tracks and give each one its exact requested name. Where a track lands is '
      + 'not something the API honours, so no position is accepted: each fresh durable id is read '
      + 'back first, then used for a separate naming edit. Success requires every requested name '
      + 'to be independently visible.\n'
      + 'Creating a track is not undone by revert_change. Nothing afterwards proves the track is '
      + 'still only ours, and somebody may have put work in it; removing one is delete_track, '
      + 'which is a separate tool and says what it removes along with the track.',
    inputSchema: {
      names: z.array(z.string().min(1)).min(1).describe('One new track per name.'),
    },
    emits: ['track.create', 'track.rename'],
    async run(workspace, args) {
      return writing(async () => {
        // One preflight covers the whole request. The create and naming edits
        // cannot share a batch because the durable addresses do not exist until
        // structural readback has proved what each create minted.
        const ops: Op[] = args.names.map((name) => ({ op: 'track.create', name }));
        const change = await workspace.apply(ops);
        const creation = receiptOf(change);
        const minted = args.names.map((requestedName, index) => ({
          requestedName,
          address: change.take.receipt.minted[index],
        }));
        const addressable = minted.filter((item): item is {
          requestedName: string;
          address: Extract<Address, { kind: 'track' }>;
        } => item.address?.kind === 'track');
        const created = addressable.map((item) => ({
          ...describeAddress(item.address),
          requestedName: item.requestedName,
        }));

        if (addressable.length !== args.names.length) {
          return {
            ...creation,
            creationConfirmed: false,
            namesConfirmed: false,
            created,
            why: 'The request was acknowledged, but every fresh track id was not independently '
              + 'observed. No unaddressed track is claimed named or safe to remove.',
          };
        }

        const namedChange = await workspace.apply(addressable.map((item): Op => ({
          op: 'track.rename', track: item.address, name: item.requestedName,
        })));
        const naming = receiptOf(namedChange);
        const verified = await workspace.read(addressable.map((item) => item.address));
        const confirmed = addressable.map((item) => {
          const entry = verified.entries[addressKey(item.address)];
          return entry?.value.of === 'track'
            && entry.value.track.name === item.requestedName;
        });
        return {
          ...creation,
          creationConfirmed: true,
          namesConfirmed: confirmed.every(Boolean),
          created: created.map((item, index) => ({
            ...item,
            nameConfirmed: confirmed[index],
          })),
          namingChange: naming,
        };
      });
    },
  }),

  tool({
    name: 'copy_track',
    kind: 'write',
    title: 'Copy an instrument track',
    description:
      'Copy one instrument track and give the copy an explicit name. Bitwig carries the source '
      + 'track\'s launcher and arrangement clips, devices and device state, mixer settings, sends, '
      + 'and routing into the new track. Other track kinds are refused because only instrument '
      + 'tracks have been measured for this operation.\n'
      + 'The copy is immediately audible if the source was audible. Loading its devices can glitch '
      + 'the audio and adds engine load. It consumes one addressable track row and receives a fresh '
      + 'durable id; a full bank is refused before anything is written.\n'
      + 'This is ordinary track editing. It creates no managed alternate, pairing, shared switch, '
      + 'or implicit cleanup promise. Automatic reversal leaves the copied track in place; '
      + 'delete_track is the separately permissioned cleanup.',
    inputSchema: {
      trackId,
      name: z.string().min(1).describe('The explicit name to assign to the copied track.'),
    },
    emits: ['track.duplicate', 'track.rename'],
    observation: 'copy-track',
    status: ['track-copy'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        if (at.window.tracks.count < 0
            || at.window.tracks.count + 1 > at.window.tracks.bankSize) {
          throw new BankWindowOverflowError(
            'tracks',
            Math.min(Math.max(0, at.window.tracks.count), at.window.tracks.bankSize),
            at.window.tracks.count + 1,
            at.window.tracks.bankSize,
          );
        }

        // ⚠ E16 measured Channel.duplicate() on ordinary Instrument tracks.
        // A shared supertype method is not evidence that Effect, Master, Group,
        // Audio or future track kinds behave the same way (E4c), so widening
        // this set is a live measurement and a deliberate code change.
        const source = (await workspace.tracks()).find((t) => t.channelId === args.trackId);
        if (source === undefined) throw new AddressUnresolvedError(
          trackAt(args.trackId), 'copy_track source is not visible',
        );
        if (source.type !== 'Instrument') {
          return {
            refused: true,
            nothingWasWritten: true,
            why: 'nothing was written. Only instrument tracks are supported: they are the only '
              + 'track kind whose copying behaviour has been measured. This track has another kind.',
          };
        }

        // The copy and its rename are separate typed edits because the durable
        // id needed by track.rename does not exist until bounded structural
        // readback has found it. Both go through Workspace.apply, so both are
        // ordinary session changes; no side write can escape the record.
        const copiedChange = await workspace.apply([
          { op: 'track.duplicate', track: trackAt(args.trackId) },
        ]);
        const copiedReceipt = receiptOf(copiedChange);
        const copied = copiedChange.take.receipt.minted[0];
        if (copied?.kind !== 'track') {
          return {
            ...copiedReceipt,
            copyConfirmed: false,
            copied: null,
            confirmation:
              'The request was acknowledged, but no fresh track id appeared within the bounded '
              + 'readback window. This answer does not claim that a copy succeeded.',
            automaticReversal:
              'No copied track is removed automatically. If one appeared later, inspect '
              + 'list_tracks before making any directed cleanup decision.',
          };
        }

        const namedChange = await workspace.apply([
          { op: 'track.rename', track: copied, name: args.name },
        ]);
        const namedReceipt = receiptOf(namedChange);
        const verified = await workspace.read([copied]);
        const entry = verified.entries[addressKey(copied)];
        const nameConfirmed = entry?.value.of === 'track'
          && entry.value.track.name === args.name;

        return {
          ...copiedReceipt,
          copyConfirmed: true,
          copied: describeAddress(copied),
          requestedName: args.name,
          nameConfirmed,
          namingChange: namedReceipt,
          automaticReversal:
            'The copied track remains. Automatic reversal does not remove it; delete_track is the '
            + 'separately permissioned directed cleanup.',
        };
      });
    },
  }),

  tool({
    name: 'rename_track',
    kind: 'write',
    title: 'Rename tracks',
    description:
      'Rename tracks. A track\'s id does not change with its name, so every address already '
      + 'worked out stays valid. The previous name is recorded and this can be undone.',
    inputSchema: {
      tracks: z.array(z.object({ trackId, name: z.string() })).min(1),
    },
    emits: ['track.rename'],
    async run(workspace, args) {
      return writing(async () => {
        const ops: Op[] = args.tracks.map((t) => ({
          op: 'track.rename', track: trackAt(t.trackId), name: t.name,
        }));
        return receiptOf(await workspace.apply(ops));
      });
    },
  }),

  tool({
    name: 'add_scenes',
    kind: 'write',
    title: 'Add launcher rows',
    description:
      'Add rows to the end of the launcher. Every track gains an empty slot in each new row.\n'
      + 'Adding rows moves nothing that already exists, so addresses stay valid — removing one '
      + 'is the direction that moves everything below it.\n'
      + 'Asking for more rows than this connection can address is refused before anything '
      + 'happens, counted over the whole call rather than one row at a time: a row past that '
      + 'point can be neither reached nor removed once it exists.\n'
      + 'Adding rows is not undone by revert_change — the arrangement of rows has no readback.',
    inputSchema: {
      count: z.number().int().min(1).describe('How many rows to add.'),
    },
    emits: ['scene.create'],
    async run(workspace, args) {
      return writing(async () => receiptOf(
        await workspace.apply([{ op: 'scene.create', count: args.count }]),
      ));
    },
  }),

  tool({
    name: 'inspect_devices',
    kind: 'read',
    title: 'Inspect track devices',
    description:
      'Read the complete visible top-level device order on one track. Each device reports its '
      + 'current position, name, and enabled state when observed. Positions are not ids. Adding, '
      + 'moving, or removing a device changes later positions, so inspect the device order again after '
      + 'each structural edit. The result states the fixed bank size and whether the view is '
      + 'complete. A partial view is not evidence that the hidden tail is empty.',
    inputSchema: { trackId },
    resultContract: {
      devices: 'Current top-level positions, names, and observed enabled states.',
      complete: 'True only when the fixed device bank covers the complete device order.',
      bankSize: 'The fixed top-level device-bank width, when observed.',
      elapsedMs: 'Wall-clock time for this call.',
    },
    async run(workspace, args) {
      const started = performance.now();
      try {
        const bank = await workspace.devices(trackAt(args.trackId));
        return {
          trackId: args.trackId,
          devices: bank.devices.map((item) => ({
            position: item.index,
            name: item.name,
            ...(item.enabled === undefined ? {} : { enabled: item.enabled }),
          })),
          complete: bank.devicesComplete,
          ...(bank.bankSize === undefined ? {} : { bankSize: bank.bankSize }),
          elapsedMs: Math.round(performance.now() - started),
        };
      } catch (error) {
        return {
          trackId: args.trackId,
          devices: [],
          complete: false,
          unreachable: true,
          reason: error instanceof Error ? error.message : String(error),
          elapsedMs: Math.round(performance.now() - started),
        };
      }
    },
  }),

  tool({
    name: 'inspect_device_parameters',
    kind: 'read',
    title: 'Inspect device parameters',
    description:
      'Read a device and discover its complete stable DirectParameter inventory. Each returned id '
      + 'is the general selector for set_parameter on native, VST3, and CLAP devices. Values are '
      + 'normalized from 0 through 1 and do not share one physical unit. Display text, typed '
      + 'discrete values, origin, automation, and modulatedValue appear only when Bitwig observed '
      + 'them. The remote-controls view reads remote pages instead; it uses returned page and '
      + 'control names and positions. The two views are separate because their observer generations '
      + 'do not stay stable together. The '
      + 'result distinguishes a missing target, an unreachable bank window, and observer instability.',
    inputSchema: {
      device: deviceTarget,
      view: z.enum(['direct', 'remote-controls']).optional().describe(
        'DirectParameter inventory by default, or the complete visible remote-control page bank.',
      ),
    },
    resultContract: {
      standing: 'stable, missing, unreachable, or unstable.',
      parameters: 'Complete DirectParameter inventory when standing is stable.',
      remotePages: 'Optional complete visible remote pages with exact existing controls.',
      warnings: 'Observed modulation or automation that can make a base value differ from the value heard.',
      elapsedMs: 'Wall-clock time for this call.',
    },
    async run(workspace, args) {
      const started = performance.now();
      const target = addressedDevice(args.device);
      const remoteInventory = remotesAt(target);
      const targetKey = addressKey(target);
      const remoteKey = addressKey(remoteInventory);
      if (args.view === 'remote-controls') {
        const snapshot = await workspace.read([remoteInventory]);
        const standing = snapshot.unreachable.some((item) => addressKey(item) === remoteKey)
          ? 'unreachable'
          : snapshot.unstable.some((item) => addressKey(item) === remoteKey)
            ? 'unstable'
            : snapshot.missing.some((item) => addressKey(item) === remoteKey)
              ? 'missing'
              : 'stable';
        const entry = snapshot.entries[remoteKey];
        if (standing !== 'stable' || entry?.value.of !== 'remotes') {
          return {
            device: args.device,
            view: 'remote-controls',
            standing: standing === 'stable' ? 'unstable' : standing,
            remotePages: [],
            warnings: [],
            elapsedMs: Math.round(performance.now() - started),
          };
        }
        const pages = entry.value.remotes.pages.map((page) => ({
          position: page.index,
          name: page.name,
          controls: page.controls.map((control) => ({
            position: control.index,
            name: control.name,
            normalizedValue: control.value,
            modulatedValue: control.modulatedValue,
            isBeingMapped: control.isBeingMapped,
            ...(control.hasAutomation === undefined
              ? {} : { hasAutomation: control.hasAutomation }),
          })),
        }));
        return {
          device: args.device,
          view: 'remote-controls',
          standing: 'stable',
          remotePages: pages,
          warnings: pages.flatMap((page) => page.controls.flatMap((control) => [
            ...(Math.abs(control.modulatedValue - control.normalizedValue) > 1e-9
              ? [{
                remote: { pagePosition: page.position, controlPosition: control.position },
                message: 'The modulated value differs from the stored base value.',
              }] : []),
            ...(control.hasAutomation === true
              ? [{
                remote: { pagePosition: page.position, controlPosition: control.position },
                message: 'Host automation can override the stored base value.',
              }] : []),
          ])),
          elapsedMs: Math.round(performance.now() - started),
        };
      }

      const snapshot = await workspace.read([target]);
      const standing = snapshot.unreachable.some((item) => addressKey(item) === targetKey)
        ? 'unreachable'
        : snapshot.unstable.some((item) => addressKey(item) === targetKey)
          ? 'unstable'
          : snapshot.missing.some((item) => addressKey(item) === targetKey)
            ? 'missing'
            : 'stable';
      const deviceEntry = snapshot.entries[targetKey];
      if (standing !== 'stable' || deviceEntry?.value.of !== 'device'
          || deviceEntry.value.device.params === undefined) {
        return {
          device: args.device,
          view: 'direct',
          standing: standing === 'stable' ? 'unstable' : standing,
          parameters: [],
          warnings: [],
          elapsedMs: Math.round(performance.now() - started),
        };
      }
      const parameters = deviceEntry.value.device.params;
      const warnings = parameters.flatMap((parameter) =>
        parameterWarnings(parameter).map((message) => ({ parameterId: parameter.id, message })));
      return {
        device: args.device,
        view: 'direct',
        deviceName: deviceEntry.value.device.name,
        standing: 'stable',
        parameters: parameters.map(publicParameter),
        warnings,
        elapsedMs: Math.round(performance.now() - started),
      };
    },
  }),

  tool({
    name: 'author_modulators',
    kind: 'write',
    title: 'Author preset modulators',
    description:
      'Create an edited copy of one human-saved preset and append it as a new device. The saved '
      + 'preset is not changed, and no device already in the project is changed. Add, replace, '
      + 'retarget, and delete use named modulator types and named targets. Each operation runs '
      + 'complete pre-write checks and must pass exact remote page or live behavior checks after '
      + 'insertion. Add supports LFO, Random, and Vibrato. Replace also supports Classic LFO and '
      + 'Expressions. Expressions refuses on sampled presets because it has no exact measured '
      + 'adjustment. A sampled delete also refuses when its resident modulator has no exact '
      + 'measurement. The result includes one recorded change id. Reversal removes only the '
      + 'inserted device while its last proved position remains valid.',
    inputSchema: modulatorAuthoringInputSchema,
    inputValidator: modulatorAuthoringInputValidator,
    emits: ['device.insert'],
    resultContract: {
      operation: 'The named add, replace, retarget, or delete request.',
      verification: 'Exact remote page counts and live base-to-modulated behavior checks.',
      change: 'The recorded insertion receipt and change id.',
      sampledPreset: 'True when sampled-preset references required measured adjustment.',
      reversal: 'Removes only the inserted device while its proved position remains valid.',
    },
    async run(workspace, args) {
      return runModulatorAuthoring(workspace, args);
    },
  }),

  tool({
    name: 'compose_device_structure',
    kind: 'write',
    title: 'Compose a device structure',
    description:
      'Create one complete Instrument Layer with one through four ordered entries and append it '
      + 'after a fresh complete inspection of the track device order and enabled state. The entries '
      + 'run in parallel and receive the same MIDI input. This tool does not create Drum Machine '
      + 'pads and does not route MIDI notes to separate entries. Each '
      + 'entry accepts one exact native-device catalog name and optional named modulator edits. '
      + 'Repeated device names, unknown or non-unique catalog matches, unsupported targets, and '
      + 'invalid edit requests are refused before the project write. The result separates the '
      + 'request, the validated modulator inventory, observed device names, and exact remote page '
      + 'and behavior witnesses. It includes one recorded change id. A failed live witness reports '
      + 'a post-write verification failure and keeps that recorded change visible. Reversal removes '
      + 'only the inserted container while its last proved position remains valid.',
    inputSchema: deviceStructureCompositionInputSchema,
    inputValidator: deviceStructureCompositionInputValidator,
    emits: ['device.insert'],
    resultContract: {
      containerKind: 'The observed Instrument Layer kind.',
      routing: 'All entries run in parallel and receive the same MIDI input; there is no per-note routing.',
      requested: 'The ordered entries and named edits that were requested.',
      validated: 'The public modulator inventory after complete pre-write checks.',
      observed: 'The complete ordered entry and device names read from the inserted container.',
      verification: 'Exact remote page counts and live base-to-modulated behavior witnesses.',
      change: 'The recorded insertion receipt and change id.',
      reversal: 'Removes only the inserted container while its proved position remains valid.',
    },
    async run(workspace, args) {
      return runDeviceStructureComposition(workspace, args);
    },
  }),

  tool({
    name: 'compose_drum_machine',
    kind: 'write',
    title: 'Compose a Drum Machine',
    description:
      'Create one new native Drum Machine and fill one through 16 reachable pads with native '
      + 'Bitwig drum devices. MIDI notes 36 through 51 map directly to pad channels 0 through '
      + '15. This is per-MIDI-note routing: one note reaches one separate pad device. Exact '
      + 'native-device names are resolved '
      + 'before any write. Repeated notes, unreachable notes, unknown or non-unique devices, '
      + 'an occupied pad, stale top-level device state, and incomplete readback do not produce a '
      + 'verified result. This tool does not edit an existing container. The result includes one '
      + 'recorded change id. Reversal removes only the owned Drum Machine while its complete '
      + 'device order and pad structure remains valid.',
    inputSchema: drumMachineCompositionInputSchema,
    inputValidator: drumMachineCompositionInputValidator,
    emits: ['device.insert', 'drumPad.insert'],
    resultContract: {
      containerKind: 'The observed top-level Drum Machine kind.',
      routing: 'One MIDI note addresses one separate pad and nested device.',
      requested: 'The exact MIDI-note, pad-channel, and native-device mapping.',
      failedDeviceNames: 'Every absent or non-unique caller-supplied native-device name.',
      observed: 'The exact nested-device witness for every requested pad.',
      verification: 'True only after complete top-level and nested readback.',
      change: 'One recorded composition receipt and change id.',
      reversal: 'Removes only the complete owned Drum Machine while all guards remain valid.',
    },
    async run(workspace, args) {
      return runDrumMachineComposition(workspace, args);
    },
  }),

  tool({
    name: 'add_native_devices',
    kind: 'write',
    title: 'Add native devices by name',
    description:
      'Append one through 16 top-level native Bitwig devices by exact catalog name. All names '
      + 'resolve before the first project write. The tool appends devices in caller order after '
      + 'a fresh complete read of the device names and enabled states for each stage. Unknown and '
      + 'non-unique names refuse together and identify each failed input. Each completed insertion '
      + 'returns its exact position, verification witness, and reversible receipt. This tool does '
      + 'not create an Instrument Layer and does not expose UUID, preset, asset, or file inputs.',
    inputSchema: nativeDeviceInsertionInputSchema,
    inputValidator: nativeDeviceInsertionInputValidator,
    emits: ['device.insert'],
    resultContract: {
      requestedDeviceNames: 'The exact ordered native-device names from the request.',
      failedDeviceNames: 'Every absent or non-unique caller-supplied native-device name.',
      added: 'Each verified name, exact top-level position, and reversible receipt.',
      changes: 'One recorded write receipt per insertion stage that ran.',
      partialSuccess: 'True only when an earlier insertion was proved before a later stage failed.',
      reversal: 'Remove inserted devices in reverse order while each complete guard remains valid.',
    },
    async run(workspace, args) {
      return runNativeDeviceInsertion(workspace, args);
    },
  }),

  tool({
    name: 'add_device',
    kind: 'write',
    title: 'Add devices to tracks',
    description:
      'Append devices after a fresh complete device-order inspection. Sources are an explicit Bitwig '
      + 'device UUID, VST3 class UID, CLAP id, or preset file. Each insertion requires a new '
      + 'complete prior order, and every inserted position comes from complete readback. Pass '
      + 'expectedDevices from the latest complete inspect_devices result to use that order directly. '
      + 'When it is absent, this call reads the prior order first.\n'
      + 'A preset path must be absolute and must end in `.bwpreset`. A relative path, another '
      + 'extension, or a file that is not there are all accepted by the API and silently do '
      + 'nothing, so all three are refused here before anything is sent.\n'
      + 'The result reports every completed insertion, partial completion, wall time, and the exact '
      + 'reversal limit. An inserted device can be reversed only by deleting its last proved '
      + 'current position while the complete device order still agrees.',
    inputSchema: {
      devices: z.array(z.discriminatedUnion('from', [
        z.object({
          trackId,
          from: z.literal('bitwig'),
          id: z.string().refine(isNativeDeviceUuid, 'A Bitwig device id must be a lowercase UUID.')
            .describe('Bitwig device UUID in lowercase canonical form.'),
          expectedDevices: expectedDeviceOrder.optional(),
        }),
        z.object({
          trackId,
          from: z.literal('vst3'),
          id: z.string().regex(/^[0-9A-Fa-f]{32}$/).describe('VST3 class UID as 32 hexadecimal characters.'),
          expectedDevices: expectedDeviceOrder.optional(),
        }),
        z.object({
          trackId,
          from: z.literal('clap'),
          id: z.string().min(1).refine((id) =>
            id === id.trim() && !/[\u0000-\u001f\u007f]/.test(id),
          'A CLAP id cannot have surrounding space or control characters.'),
          expectedDevices: expectedDeviceOrder.optional(),
        }),
        z.object({
          trackId,
          from: z.literal('preset'),
          path: z.string().describe('Absolute .bwpreset path.'),
          expectedDevices: expectedDeviceOrder.optional(),
        }),
      ])).min(1),
    },
    emits: ['device.insert'],
    resultContract: {
      added: 'Each inserted source with its read-back current position.',
      changes: 'One recorded write receipt per insertion stage.',
      partialSuccess: 'True when a later stage failed after an earlier insertion landed.',
      reversal: 'Inserted devices can be removed only at their last proved current positions.',
      elapsedMs: 'Wall-clock time for this call.',
    },
    async run(workspace, args) {
      const started = performance.now();
      let requests: Array<{
        index: number;
        trackId: string;
        source: DeviceSource;
        expectedDevices?: readonly { name: string; enabled: boolean }[];
      }>;
      try {
        requests = args.devices.map((item, index) => ({
          index,
          trackId: item.trackId,
          source: sourceOf(item),
          ...(item.expectedDevices === undefined
            ? {} : { expectedDevices: item.expectedDevices }),
        }));
      } catch (error) {
        return refusalOf(error);
      }
      const added: Array<Record<string, unknown>> = [];
      const changes: ReturnType<typeof receiptOf>[] = [];
      for (const request of requests) {
        try {
          const track = trackAt(request.trackId);
          const before = request.expectedDevices === undefined
            ? await workspace.devices(track)
            : undefined;
          const enabled = before === undefined
            ? request.expectedDevices!.map((item) => item.enabled)
            : enabledFingerprint(before);
          if (before !== undefined && (!completeDeviceBank(before) || enabled === undefined)) {
            throw new Error('the complete top-level device names and enabled states are not visible');
          }
          if (before !== undefined
              && (before.bankSize === undefined || before.devices.length >= before.bankSize)) {
            throw new Error('the device bank has no addressable position for another device');
          }
          const names = before === undefined
            ? request.expectedDevices!.map((item) => item.name)
            : before.devices.map((item) => item.name);
          const change = await workspace.apply([{
            op: 'device.insert',
            track,
            source: request.source,
            expectedChain: names,
            expectedEnabledChain: enabled!,
          }]);
          const receipt = receiptOf(change);
          changes.push(receipt);
          const minted = Object.values(change.take.receipt.minted)
            .filter((address): address is DeviceAddress => address.kind === 'device');
          if (!receipt.applied || receipt.failed !== undefined || receipt.mismatches !== undefined
              || receipt.notReadBack !== undefined || minted.length !== 1) {
            return {
              applied: false,
              partialSuccess: added.length > 0,
              why: 'Insertion did not finish with one exact positional readback.',
              changes,
              added,
              reversal: {
                insertedDevice: 'delete-last-proved-current-position',
                existingDeviceDelete: 'none',
              },
              elapsedMs: Math.round(performance.now() - started),
            };
          }
          const position = minted[0]!.chainIndex;
          added.push({
            requestIndex: request.index,
            trackId: request.trackId,
            source: args.devices[request.index]?.from,
            position,
            devicePosition: position,
          });
        } catch (error) {
          if (changes.length === 0) return refusalOf(error);
          return {
            applied: false,
            partialSuccess: added.length > 0,
            why: 'A later insertion did not finish after earlier project writes completed.',
            changes,
            added,
            reversal: {
              insertedDevice: 'delete-last-proved-current-position',
              existingDeviceDelete: 'none',
            },
            elapsedMs: Math.round(performance.now() - started),
          };
        }
      }
      return {
        applied: true,
        partialSuccess: false,
        changes,
        added,
        reversal: {
          insertedDevice: 'delete-last-proved-current-position',
          existingDeviceDelete: 'none',
        },
        elapsedMs: Math.round(performance.now() - started),
      };
    },
  }),

  tool({
    name: 'set_parameter',
    kind: 'write',
    title: 'Set device parameters',
    description:
      'Set DirectParameters by ids returned from inspect_device_parameters, or set one returned '
      + 'remote control by its exact page and control names and positions. Values are normalized '
      + 'from 0 through 1 and do not share one physical unit. Each write uses a fresh inventory '
      + 'and exact readback. The result does not say verified when readback disagrees. Modulation '
      + 'and automation warnings state when a static base value can differ from the value heard.',
    inputSchema: {
      settings: z.array(z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('direct'),
          device: deviceTarget,
          parameterId: z.string().min(1).describe(
            'Exact DirectParameter id returned by inspect_device_parameters.',
          ),
          normalizedValue: z.number().min(0).max(1),
        }),
        z.object({
          kind: z.literal('remote'),
          device: deviceTarget,
          pagePosition: z.number().int().min(0),
          pageName: z.string().min(1),
          controlPosition: z.number().int().min(0),
          controlName: z.string().min(1),
          normalizedValue: z.number().min(0).max(1),
        }),
      ])).min(1),
    },
    emits: ['param.set', 'remote.set'],
    resultContract: {
      partialSuccess: 'True when an earlier verified write finished before a later setting failed.',
      verified: 'True only when every requested normalized base value agrees with readback.',
      changes: 'One recorded write receipt per scalar target.',
      warnings: 'Observed modulation or automation that can override a static base value.',
      elapsedMs: 'Wall-clock time for this call.',
      reversal: 'Exact base-value replay while the positional device target remains valid.',
    },
    async run(workspace, args) {
      const started = performance.now();
      const changes: ReturnType<typeof receiptOf>[] = [];
      const warnings: Array<Record<string, unknown>> = [];
      try {
        let verified = true;
        const cohorts: Array<Array<{
          settingIndex: number;
          setting: (typeof args.settings)[number];
        }>> = [];
        for (const [settingIndex, setting] of args.settings.entries()) {
          const prior = cohorts.at(-1);
          const routeKey = JSON.stringify({ kind: setting.kind, device: setting.device });
          const targetKey = setting.kind === 'direct'
            ? setting.parameterId
            : `${setting.pagePosition}:${setting.pageName}:${setting.controlPosition}:${setting.controlName}`;
          const priorRouteKey = prior === undefined ? undefined : JSON.stringify({
            kind: prior[0]!.setting.kind,
            device: prior[0]!.setting.device,
          });
          const repeatsTarget = prior?.some((item) => setting.kind === 'direct'
            ? item.setting.kind === 'direct' && item.setting.parameterId === targetKey
            : item.setting.kind === 'remote'
              && `${item.setting.pagePosition}:${item.setting.pageName}:`
                + `${item.setting.controlPosition}:${item.setting.controlName}` === targetKey) ?? false;
          if (prior === undefined || priorRouteKey !== routeKey || repeatsTarget) {
            cohorts.push([{ settingIndex, setting }]);
          } else {
            prior.push({ settingIndex, setting });
          }
        }

        for (const cohort of cohorts) {
          const first = cohort[0]!.setting;
          const target = addressedDevice(first.device);
          const bank = await workspace.devices(trackAt(first.device.trackId));
          const enabled = enabledFingerprint(bank);
          if (!completeDeviceBank(bank) || enabled === undefined) {
            throw new Error('the complete top-level device names and enabled states are not visible');
          }
          const expectedChain = bank.devices.map((item) => item.name);
          const top = bank.devices[first.device.devicePosition];
          if (top === undefined) throw new Error('the top-level device position is absent');

          const ops: Op[] = [];
          let preflight: Awaited<ReturnType<Workspace['read']>>;
          if (first.kind === 'direct') {
            const parameterAddresses = cohort.map((item) => {
              if (item.setting.kind !== 'direct') throw new Error('the parameter cohort view changed');
              return paramAt(target, item.setting.parameterId);
            });
            const snapshot = await workspace.read([target, ...parameterAddresses]);
            preflight = snapshot;
            const entry = snapshot.entries[addressKey(target)];
            if (snapshot.unreachable.length > 0) throw new Error('the parameter target is outside its bank window');
            if (snapshot.unstable.length > 0) throw new Error('the parameter observer inventory is unstable');
            if (entry?.value.of !== 'device' || entry.value.device.params === undefined) {
              throw new Error('the parameter target or its complete inventory is missing');
            }
            for (const item of cohort) {
              const setting = item.setting;
              if (setting.kind !== 'direct') throw new Error('the parameter cohort view changed');
              const matches = entry.value.device.params.filter(
                (parameter) => parameter.id === setting.parameterId,
              );
              if (matches.length !== 1) {
                throw new Error(`the DirectParameter id matched ${matches.length} parameters`);
              }
              warnings.push(...parameterWarnings(matches[0]!).map((message) => ({
                settingIndex: item.settingIndex,
                parameterId: setting.parameterId,
                message,
              })));
              ops.push({
                op: 'param.set',
                param: paramAt(target, setting.parameterId),
                value: setting.normalizedValue,
                expectedName: entry.value.device.name,
                expectedChain,
                expectedEnabledChain: enabled,
              });
            }
          } else {
            const inventoryAddress = remotesAt(target);
            const remoteAddresses = cohort.map((item) => {
              const setting = item.setting;
              if (setting.kind !== 'remote') throw new Error('the parameter cohort view changed');
              return remoteAt(
                target,
                setting.pagePosition,
                setting.pageName,
                setting.controlPosition,
                setting.controlName,
              );
            });
            const snapshot = await workspace.read([inventoryAddress, ...remoteAddresses]);
            preflight = snapshot;
            const entry = snapshot.entries[addressKey(inventoryAddress)];
            if (snapshot.unreachable.length > 0) throw new Error('the remote target is outside its bank window');
            if (snapshot.unstable.length > 0) throw new Error('the remote observer inventory is unstable');
            if (entry?.value.of !== 'remotes') throw new Error('the remote inventory is missing');
            for (const item of cohort) {
              const setting = item.setting;
              if (setting.kind !== 'remote') throw new Error('the parameter cohort view changed');
              const page = entry.value.remotes.pages[setting.pagePosition];
              const control = page?.controls[setting.controlPosition];
              if (page?.name !== setting.pageName || control?.name !== setting.controlName) {
                throw new Error('the remote page or control does not match the fresh inventory');
              }
              if (Math.abs(control.modulatedValue - control.value) > 1e-9) {
                warnings.push({
                  settingIndex: item.settingIndex,
                  message: 'The modulated value differs from the stored base value.',
                });
              }
              if (control.hasAutomation === true) {
                warnings.push({
                  settingIndex: item.settingIndex,
                  message: 'Host automation can override the stored base value.',
                });
              }
              ops.push({
                op: 'remote.set',
                remote: remoteAt(
                  target,
                  setting.pagePosition,
                  setting.pageName,
                  setting.controlPosition,
                  setting.controlName,
                ),
                value: setting.normalizedValue,
                expectedName: entry.value.remotes.deviceName,
                expectedChain,
                expectedEnabledChain: enabled,
              });
            }
          }
          const cohortChanges = await workspace.applyParameterCohort(ops, {
            parameterPreflight: preflight,
          });
          const receipts = cohortChanges.map(receiptOf);
          changes.push(...receipts);
          if (receipts.length !== ops.length || receipts.some((receipt) =>
            !receipt.applied || receipt.failed !== undefined || receipt.mismatches !== undefined
              || receipt.notReadBack !== undefined)) {
            verified = false;
            throw new Error('the parameter cohort did not complete and verify every scalar target');
          }
        }
        return {
          applied: changes.every((change) => change.applied),
          partialSuccess: false,
          verified,
          changes,
          warnings,
          reversal: 'exact-base-value-while-the-device-route-remains-valid',
          elapsedMs: Math.round(performance.now() - started),
        };
      } catch (error) {
        if (changes.length === 0) return refusalOf(error);
        return {
          applied: false,
          partialSuccess: true,
          verified: false,
          why: 'A later setting did not finish after earlier writes completed.',
          changes,
          warnings,
          reversal: 'exact-base-value-while-the-device-route-remains-valid',
          elapsedMs: Math.round(performance.now() - started),
        };
      }
    },
  }),

  tool({
    name: 'set_device_enabled',
    kind: 'write',
    title: 'Enable or bypass devices',
    description:
      'Set the enabled state of top-level devices after a fresh complete device-order inspection. '
      + 'False bypasses the device. Each position is positional and must be read again after a '
      + 'device-order edit. Exact readback proves each result, and the prior enabled '
      + 'state is available for exact reversal.',
    inputSchema: {
      settings: z.array(z.object({
        trackId,
        devicePosition: z.number().int().min(0).describe(
          'Current top-level position returned by inspect_devices.',
        ),
        enabled: z.boolean(),
      })).min(1),
    },
    emits: ['device.setEnabled'],
    resultContract: {
      partialSuccess: 'True when an earlier verified write finished before a later setting failed.',
      verified: 'True only when every enabled state agrees with independent readback.',
      changes: 'One recorded write receipt per device.',
      elapsedMs: 'Wall-clock time for this call.',
      reversal: 'Exact prior enabled-state replay while the positional device target remains valid.',
    },
    async run(workspace, args) {
      const started = performance.now();
      const changes: ReturnType<typeof receiptOf>[] = [];
      try {
        let verified = true;
        for (const setting of args.settings) {
          const track = trackAt(setting.trackId);
          const bank = await workspace.devices(track);
          const enabled = enabledFingerprint(bank);
          if (!completeDeviceBank(bank) || enabled === undefined) {
            throw new Error('the complete top-level device names and enabled states are not visible');
          }
          const target = deviceAt(track, setting.devicePosition);
          const observed = bank.devices[setting.devicePosition];
          if (observed === undefined) throw new Error('the device position is absent');
          const change = await workspace.apply([{
            op: 'device.setEnabled',
            device: target,
            enabled: setting.enabled,
            expectedName: observed.name,
            expectedEnabled: enabled[setting.devicePosition],
            expectedChain: bank.devices.map((item) => item.name),
            expectedEnabledChain: enabled,
          }]);
          const receipt = receiptOf(change);
          changes.push(receipt);
          if (!receipt.applied || receipt.failed !== undefined || receipt.mismatches !== undefined
              || receipt.notReadBack !== undefined) verified = false;
        }
        return {
          applied: changes.every((change) => change.applied),
          partialSuccess: false,
          verified,
          changes,
          reversal: 'exact-prior-enabled-state-while-the-device-position-remains-valid',
          elapsedMs: Math.round(performance.now() - started),
        };
      } catch (error) {
        if (changes.length === 0) return refusalOf(error);
        return {
          applied: false,
          partialSuccess: true,
          verified: false,
          why: 'A later setting did not finish after earlier writes completed.',
          changes,
          reversal: 'exact-prior-enabled-state-while-the-device-position-remains-valid',
          elapsedMs: Math.round(performance.now() - started),
        };
      }
    },
  }),

  tool({
    name: 'create_device_alternates',
    kind: 'write',
    title: 'Create named device alternates',
    description:
      'Add one device container at the end of a track and create one to four explicitly named '
      + 'alternates inside it. `instrument` creates an Instrument Layer, not an Instrument '
      + 'Selector. `effect` creates an FX Layer and is also supported on effect returns and the '
      + 'master. Layer entries run in parallel. Instrument Layer entries receive the same MIDI '
      + 'input. Exclusive solo auditions one entry; it does not map MIDI notes. No '
      + 'operator-authored setup file is required. Every supplied name must be unique. Success '
      + 'reports only the complete structure independently read after insertion and naming.\n'
      + 'A device alternate carries devices and device state. It carries no clips, sends, routing '
      + 'or track mixer state. The container is added at the end and can load devices, so creation '
      + 'can add engine load. Only positions 0 and 1 expose container contents. If the new container '
      + 'lands later, the insertion is recorded but completion cannot be confirmed. Automatic '
      + 'reversal does not remove added alternates.',
    inputSchema: {
      trackId,
      containerType: z.enum(['instrument', 'effect']).describe(
        'The device role of the new container. Effect containers also work on returns and master.',
      ),
      names: z.array(alternateName).min(1).max(4).describe(
        'One unique durable name per device alternate, in order.',
      ),
    },
    emits: ['device.insert', 'chain.rename', 'chain.create'],
    observation: 'device-alternate',
    status: ['device-alternate'],
    async run(workspace, args) {
      return writing(async () => {
        const blankAt = args.names.findIndex((name) => name.trim().length === 0);
        if (blankAt !== -1) {
          return {
            refused: true,
            nothingWasWritten: true,
            why: `device alternate name ${blankAt + 1} cannot contain only whitespace.`,
          };
        }
        if (new Set(args.names).size !== args.names.length) {
          return {
            refused: true,
            nothingWasWritten: true,
            why: 'every alternate name must be unique within the new container.',
          };
        }
        if (args.containerType === 'instrument' && !existsSync(INSTRUMENT_LAYER_SEED_PATH)) {
          return {
            refused: true,
            nothingWasWritten: true,
            why: 'the bundled instrument seed is missing, so creation was refused before writing.',
          };
        }

        const inserted = await workspace.apply([{
          op: 'device.insert',
          track: trackAt(args.trackId),
          source: args.containerType === 'instrument'
            ? { from: 'file', path: INSTRUMENT_LAYER_SEED_PATH }
            : { from: 'bitwig', uuid: FX_LAYER_UUID },
        }]);
        const insertion = receiptOf(inserted);
        const container = inserted.take.receipt.minted[0];
        if (container?.kind !== 'device') {
          return {
            ...insertion,
            containerConfirmed: false,
            why: 'no new container position was independently observed within the bounded window.',
          };
        }

        try {
        const firstRead = await workspace.read([container]);
        const firstEntry = firstRead.entries[addressKey(container)];
        const observed = firstEntry?.value.of === 'device'
          ? firstEntry.value.device.container
          : undefined;
        if (observed?.chainsComplete !== true || observed.chains.length !== 1) {
          return {
            ...insertion,
            containerConfirmed: true,
            container: describeAddress(container),
            namingConfirmed: false,
            why: 'the new container did not independently resolve to exactly one complete seed entry.',
          };
        }

        let currentName = observed.chains[0]!.name;
        let preparation: ReturnType<typeof receiptOf> | undefined;
        if (currentName === args.names[0]) {
          const occupied = new Set([...args.names, currentName]);
          let temporary = 'ghostnote pending alternate';
          while (occupied.has(temporary)) temporary += ' pending';
          const prepared = await workspace.apply([{
            op: 'chain.rename',
            chain: chainAt(container, currentName),
            name: temporary,
          }]);
          preparation = receiptOf(prepared);
          const preparedRead = await deviceAlternatesAt(
            workspace, args.trackId, container.chainIndex,
          ) as { readable?: boolean; alternates?: { name: string }[] };
          if (preparation.failed !== undefined
              || preparedRead.readable !== true
              || preparedRead.alternates?.length !== 1
              || preparedRead.alternates[0]?.name !== temporary) {
            return {
              applied: false,
              containerConfirmed: true,
              namingConfirmed: false,
              containerChange: insertion,
              preparationChange: preparation,
              structure: preparedRead,
            };
          }
          currentName = temporary;
        }

        const named = await workspace.apply([{
          op: 'chain.rename',
          chain: chainAt(container, currentName),
          name: args.names[0]!,
        }]);
        const naming = receiptOf(named);
        const afterName = await deviceAlternatesAt(
          workspace, args.trackId, container.chainIndex,
        ) as { readable?: boolean; alternates?: { name: string }[] };
        const namingConfirmed = afterName.readable === true
          && afterName.alternates?.length === 1
          && afterName.alternates[0]?.name === args.names[0];
        if (!namingConfirmed) {
          return {
            applied: false,
            containerConfirmed: true,
            namingConfirmed: false,
            containerChange: insertion,
            namingChange: naming,
            ...(preparation === undefined ? {} : { preparationChange: preparation }),
            structure: afterName,
          };
        }

        const added = args.names.length <= 1
          ? undefined
          // Each requested entry copies the one immediately before it. That
          // preserves caller order whether Bitwig places a copy beside its
          // source or at the container tail; the final readback still proves it.
          : await workspace.apply(args.names.slice(1).map((name, index): Op => ({
            op: 'chain.create',
            source: chainAt(container, args.names[index]!),
            name,
          })));
        const structure = await deviceAlternatesAt(
          workspace, args.trackId, container.chainIndex,
        ) as {
          readable?: boolean;
          complete?: boolean;
          containerKind?: string;
          routing?: string;
          alternates?: { name: string }[];
        };
        const resolvedNames = structure.alternates?.map((item) => item.name) ?? [];
        const creationConfirmed = structure.readable === true
          && structure.complete === true
          && resolvedNames.length === args.names.length
          && args.names.every((name, index) => resolvedNames[index] === name);
        return {
          applied: creationConfirmed,
          containerKind: structure.containerKind,
          routing: structure.routing,
          containerConfirmed: true,
          namingConfirmed: true,
          creationConfirmed,
          containerChange: insertion,
          namingChange: naming,
          ...(preparation === undefined ? {} : { preparationChange: preparation }),
          ...(added === undefined ? {} : { alternateChange: receiptOf(added) }),
          structure,
        };
        } catch {
          return {
            applied: false,
            containerConfirmed: true,
            namingConfirmed: false,
            containerChange: insertion,
            why: 'The container was added and recorded, but all requested names were not '
              + 'independently confirmed. No automatic cleanup was attempted.',
          };
        }
      });
    },
  }),

  tool({
    name: 'fill_device_alternate',
    kind: 'write',
    title: 'Fill a device alternate',
    description:
      'Move or copy one or more top-level devices into one named device alternate, appending them '
      + 'in the order given. Positions count from 0 in the starting track device list. A move '
      + 'compacts that list; the operation projects every later source position and the container '
      + 'position before writing it. Success returns the complete destination structure from a '
      + 'fresh independent reading. Only container positions 0 and 1 are observable.\n'
      + 'Moving or copying carries each device and its device state. It does not carry clips, sends, '
      + 'routing or track mixer state. A copy can load another device instance and add engine load. '
      + 'A move changes the signal path and can be audible. Automatic reversal does not move or '
      + 'remove the devices.',
    inputSchema: {
      trackId,
      containerPosition: z.number().int().min(0).describe(
        'Starting position of the containing device in the track, counting from 0. Only 0 and 1 expose container contents.',
      ),
      alternateName: z.string().min(1).describe('Exact name of the destination device alternate.'),
      sourceDevicePositions: z.array(z.number().int().min(0)).min(1).max(4).describe(
        'Top-level device positions in the starting list, in the order to append them.',
      ),
      mode: z.enum(['move', 'copy']),
    },
    emits: ['chain.relocate'],
    status: ['device-alternate'],
    async run(workspace, args) {
      return writing(async () => {
        if (new Set(args.sourceDevicePositions).size !== args.sourceDevicePositions.length) {
          return {
            refused: true,
            nothingWasWritten: true,
            why: 'each source device position may appear only once.',
          };
        }
        if (args.sourceDevicePositions.includes(args.containerPosition)) {
          return {
            refused: true,
            nothingWasWritten: true,
            why: 'the containing device cannot be moved or copied into itself.',
          };
        }

        const moved: number[] = [];
        const ops: Op[] = args.sourceDevicePositions.map((original) => {
          const sourcePosition = args.mode === 'move'
            ? original - moved.filter((position) => position < original).length
            : original;
          const projectedContainer = args.mode === 'move'
            ? args.containerPosition
              - moved.filter((position) => position < args.containerPosition).length
            : args.containerPosition;
          if (args.mode === 'move') moved.push(original);
          return {
            op: 'chain.relocate',
            source: deviceAt(trackAt(args.trackId), sourcePosition),
            destination: chainAt(
              containerAt(args.trackId, projectedContainer),
              args.alternateName,
            ),
            mode: args.mode,
          };
        });
        const change = await workspace.apply(ops);
        const finalContainerPosition = args.mode === 'move'
          ? args.containerPosition
            - args.sourceDevicePositions.filter((position) => position < args.containerPosition).length
          : args.containerPosition;
        const structure = await deviceAlternatesAt(
          workspace, args.trackId, finalContainerPosition,
        );
        return {
          ...receiptOf(change),
          finalContainerPosition,
          structure,
        };
      });
    },
  }),

  tool({
    name: 'switch_device_alternate',
    kind: 'write',
    title: 'Solo one device alternate exclusively',
    description:
      'Solo one named device alternate inside a device container and clear solo from every sibling. '
      + 'The container is named by its position in the track; that position shifts when '
      + 'devices before it are added or removed. Only positions 0 and 1 can expose container '
      + 'contents through the current observer. The alternate name must identify exactly one '
      + 'entry, and the complete sibling set plus every solo flag must be readable or nothing '
      + 'is written. Success is proved by a fresh independent reading, not by acknowledgement.\n'
      + 'This can change the sound immediately and is not beat-aligned. A device alternate carries '
      + 'devices and device state. It carries no clips, sends, routing '
      + 'or track mixer state. Automatic reversal does not restore the prior soloed entry; call '
      + 'this operation again with the desired name.',
    inputSchema: {
      trackId,
      containerPosition: z.number().int().min(0).describe(
        'Position of the containing device in the track, counting from 0. Only 0 and 1 expose container contents.',
      ),
      alternateName: alternateName.describe('Exact name of the device alternate to solo exclusively.'),
    },
    emits: ['chain.activate'],
    status: ['device-alternate'],
    async run(workspace, args) {
      return writing(async () => {
        const container = deviceAt(trackAt(args.trackId), args.containerPosition);
        const target = chainAt(container, args.alternateName);
        const change = await workspace.apply([{ op: 'chain.activate', chain: target }]);
        const receipt = receiptOf(change);
        const snapshot = await workspace.read([container]);
        const entry = snapshot.entries[addressKey(container)];
        const observed = entry?.value.of === 'device' ? entry.value.device.container : undefined;
        const observedState = observed === undefined
          ? { states: [], exclusiveActive: null }
          : observedAlternateStates(observed);
        const states = observedState.states;
        return {
          ...receipt,
          ...(receipt.failed === undefined ? {} : {
            failed: receipt.failed.map(() => ({
              op: 'switch_device_alternate',
              error: 'The requested device alternate was not proved as the only soloed sibling.',
            })),
          }),
          exclusiveActive: observedState.exclusiveActive,
          alternates: states,
          exclusiveStateConfirmed:
            observedState.exclusiveActive === args.alternateName,
          automaticReversal:
            'The prior exclusively soloed entry is not restored automatically. Switch again with its name.',
        };
      });
    },
  }),

  tool({
    name: 'revert_change',
    kind: 'write',
    title: 'Put back what one change replaced',
    description:
      'Undo one of this session\'s own changes, from what it recorded before it ran. Ask for this '
      + 'when the person asks for it.\n'
      + 'It is bounded twice, structurally. Only changes this session made are reversible at all — '
      + 'anything else has no record here. And within one change, only the places that still hold '
      + 'exactly what it left: a place a person edited since, or a slot that has had a clip moved '
      + 'into or out of it — even an identical one — is left untouched and reported. Nothing is '
      + 'overwritten to make an undo tidy.\n'
      + 'What it cannot put back is reported rather than approximated: a rebuilt clip comes back '
      + 'without its name, colour, loop points, launch settings or automation, and a value that '
      + 'cannot be written exactly is reported and left alone.\n'
      + 'check_revert answers the same question without writing.',
    inputSchema: {
      changeId: z.string().describe('From list_changes.'),
      scope: scopeInput,
    },
    // ⚠ It can REMOVE, on the ordinary surface. See this file's header: putting
    // our own work back is not destruction, and the boundary above is what makes
    // that true rather than merely claimed.
    emits: ['clip.create', 'clip.delete', 'note.clear', 'note.write', 'track.rename', 'param.set', 'device.delete'],
    status: ['reversal'],
    async run(workspace, args) {
      return writing(async () => {
        const slice = sliceFor(workspace, args.changeId, args.scope);
        const plan = await workspace.planRevert(args.changeId, slice);
        const change = workspace.changes.require(args.changeId);
        const report = reversalReport(plan, change.take.targets);
        if (plan.ops.length === 0) {
          return {
            ...report,
            applied: false,
            nothingToPutBack:
              'nothing was written. There is nothing here that is still ours to put back — see '
              + 'what each place says below.',
          };
        }
        // ⚠ The clearance travels with the plan, and must: putting our own work
        // back is the one write the engine's own refusal has to let through, or
        // the changes most worth undoing would be the ones that could not be.
        const applied = await workspace.apply(plan.ops, { clearance: plan.clearance });
        // ⚠ Spelled out rather than spread over the plan's report, because after
        // the fact the tenses differ and one of the two `changeId`s is not the one
        // a reader would assume: an undo is a change of its own, so the receipt
        // names the NEW one and `undoOf` names what it put back.
        const receipt = receiptOf(applied);
        return {
          ...receipt,
          undoOf: args.changeId,
          restored: report.wouldRestore,
          notRestored: report.wouldNotRestore,
          caveats: report.caveats,
        };
      });
    },
  }),

  // ============================ destructive =================================
  // ⚠⚠ Separate names, one per destructive permission, rather than one `delete`
  // with a kind parameter. The host's "don't ask again for this tool" is a
  // blanket grant on a NAME, so the grain of the naming is the grain of the
  // permission: allowing clip deletion for a project must not also allow track
  // deletion in it.
  //
  // ⚠⚠ Each one carries `directedDestruction`, and that is not a way round the
  // engine's own refusal — it is the only reading of D18c and D20 together that
  // leaves the destructive surface able to run at all. The engine refuses any
  // batch whose prior state cannot be reproduced exactly, which is EVERY deletion
  // of anything that already existed; D20 says of exactly these calls that "the
  // boundary is host-mediated: nothing INSIDE our system gates a directed
  // destructive call", and the direction is the operator answering the host's
  // prompt for this tool name. What the clearance does not touch is the
  // REPORTING: every receipt below still says what it could not put back.
  tool({
    name: 'remove_device_alternate',
    kind: 'destructive',
    title: 'Remove one device alternate',
    description:
      'Remove one explicitly named alternate while preserving two or more named survivors by '
      + 'building a replacement container. The caller supplies the replacement container role '
      + 'because that role is not exposed by the current observer. Before anything is written, '
      + 'the complete top-level order, every sibling name, every survivor device order, and every '
      + 'survivor mute, solo, volume, pan and colour value must be readable. Only container '
      + 'positions 0 and 1 are observable. The replacement is '
      + 'built at the track tail, filled in survivor order, and independently proved before the '
      + 'old container can be removed. It is then restored to the old signal position and read '
      + 'again. A partial rebuild is reported as partial and never as completion.\n'
      + 'Names and device order are preserved. Solo is restored when the prior survivor state '
      + 'has zero or one soloed entry; every final state value is compared with its captured '
      + 'value, and differences in mute, solo, volume, pan or colour are reported rather than '
      + 'claimed restored. Device alternates have no sends. Cross-device modulation is not '
      + 'measured and is not claimed to survive. This permanently removes the named alternate '
      + 'and the old container and cannot be undone here.',
    inputSchema: {
      trackId,
      containerPosition: z.number().int().min(0).describe(
        'Current position of the containing device in the track, counting from 0. Only 0 and 1 expose container contents.',
      ),
      alternateName: alternateName.describe('Exact durable name of the one device alternate to remove.'),
      containerType: z.enum(['instrument', 'effect']).describe(
        'Role of the replacement container. The current observer cannot infer this from the old container.',
      ),
    },
    emits: [
      'device.insert', 'chain.rename', 'chain.create', 'chain.relocate',
      'chain.activate', 'device.delete', 'device.relocate',
    ],
    status: ['device-alternate'],
    async run(workspace, args) {
      return writing(async () => {
        const same = (left: unknown, right: unknown) =>
          JSON.stringify(left) === JSON.stringify(right);
        const track = trackAt(args.trackId);
        const original = deviceAt(track, args.containerPosition);
        const topBefore = await workspace.devices(track);
        const snapshot = await workspace.read([track, original]);
        const entry = snapshot.entries[addressKey(original)];
        const device = entry?.value.of === 'device' ? entry.value.device : undefined;
        const observed = device?.container;

        if (!topBefore.devicesComplete || topBefore.bankSize === undefined) {
          return { refused: true, nothingWasWritten: true,
            why: 'the complete starting track device order was not observable.' };
        }
        if (topBefore.devices.length >= topBefore.bankSize) {
          return { refused: true, nothingWasWritten: true,
            why: 'the replacement needs one temporary top-level device position, but the observable bank is full.' };
        }
        if (device === undefined || observed === undefined || !observed.chainsComplete) {
          return { refused: true, nothingWasWritten: true,
            why: 'the complete sibling set was not observable at that container position.' };
        }
        const initialNames = topBefore.devices.map((item) => item.name);
        if (initialNames[args.containerPosition] !== device.name) {
          return { refused: true, nothingWasWritten: true,
            why: 'the container identity disagreed between the full track reading and its own reading.' };
        }
        const removed = lookupChain(observed, args.alternateName);
        if (!removed.ok) {
          return { refused: true, nothingWasWritten: true,
            why: `the named device alternate was ${removed.miss}.` };
        }
        if (new Set(observed.chains.map((item) => item.name)).size !== observed.chains.length) {
          return { refused: true, nothingWasWritten: true,
            why: 'every surviving device alternate must have a unique durable name.' };
        }
        const survivors = observed.chains.filter((item) => item.index !== removed.chain.index);
        if (survivors.length < 2) {
          return { refused: true, nothingWasWritten: true,
            why: 'selective reduction requires at least two named survivors; use keep_device_alternate for one.' };
        }
        const incomplete = survivors.find((item) => !item.devicesComplete);
        if (incomplete !== undefined) {
          return { refused: true, nothingWasWritten: true,
            why: `the complete ordered devices of survivor "${incomplete.name}" were not observable.` };
        }
        const unknown = survivors.find((item) =>
          typeof item.mute !== 'boolean'
          || typeof item.solo !== 'boolean'
          || typeof item.volume !== 'number'
          || typeof item.pan !== 'number'
          || item.color === undefined);
        if (unknown !== undefined) {
          return { refused: true, nothingWasWritten: true,
            why: `name, mute, solo, volume, pan and colour of survivor "${unknown.name}" `
              + 'must all be observed exactly before rebuilding.' };
        }
        if (args.containerType === 'instrument' && !existsSync(INSTRUMENT_LAYER_SEED_PATH)) {
          return { refused: true, nothingWasWritten: true,
            why: 'the bundled instrument seed is missing, so reduction was refused before writing.' };
        }

        const replacementStart = initialNames.length;
        const future = deviceAt(track, replacementStart);
        const futureRead = await workspace.read([future]);
        if (futureRead.unreachable.some((address) => addressKey(address) === addressKey(future))) {
          return { refused: true, nothingWasWritten: true,
            why: `the temporary replacement position ${replacementStart} is outside the observable container scopes.` };
        }

        const withoutOriginal = initialNames.filter((_, index) => index !== args.containerPosition);
        const expectedAfterRemoval = [...withoutOriginal, device.name];
        const needsReorder = args.containerPosition < initialNames.length - 1;
        if (needsReorder) {
          const projected = projectedReorder(
            expectedAfterRemoval,
            expectedAfterRemoval.length - 1,
            args.containerPosition,
          );
          if (projected === undefined || same(projected, expectedAfterRemoval) || !same(projected, initialNames)) {
            return { refused: true, nothingWasWritten: true,
              why: 'restoring the replacement to the old signal position could not be distinguished '
                + 'and projected onto the exact starting device order, so nothing was rebuilt.' };
          }
        }

        const captured = survivors.map((item) => ({
          name: item.name,
          devices: item.devices.map((nested) => nested.name),
          state: {
            mute: item.mute as boolean,
            solo: item.solo as boolean,
            volume: item.volume as number,
            pan: item.pan as number,
            color: item.color!,
          },
        }));
        const carried = {
          removedAlternate: args.alternateName,
          survivors: captured,
          replacementContainerRole: {
            supplied: args.containerType,
            independentlyObserved: false,
          },
          sends: 'none',
          crossDeviceModulation: 'not measured and not claimed',
        };
        const clearance = directedDestruction('remove_device_alternate');
        const changes: Record<string, unknown> = {};
        let removalAttempted = false;

        const partial = (why: string, extra: Record<string, unknown> = {}) => ({
          applied: false,
          originalContainerRemoved: false,
          replacementPositionConfirmed: false,
          ...carried,
          ...changes,
          ...extra,
          why,
        });

        const replacementMatches = (structure: Record<string, unknown>): boolean => {
          const alternates = structure['alternates'] as
            | { name: string; devices: { name: string }[] }[] | undefined;
          return structure['readable'] === true
            && structure['complete'] === true
            && alternates !== undefined
            && same(alternates.map((item) => ({
              name: item.name,
              devices: item.devices.map((nested) => nested.name),
            })), captured.map((item) => ({ name: item.name, devices: item.devices })));
        };

        const stateReport = (structure: Record<string, unknown>) => {
          const alternates = structure['alternates'] as | {
            name: string;
            soloed: boolean | null;
            state: { mute: boolean | null; volume: number | null; pan: number | null; color: unknown };
          }[] | undefined;
          return captured.map((before) => {
            const after = alternates?.find((item) => item.name === before.name);
            const final = after === undefined ? null : {
              mute: after.state.mute,
              solo: after.soloed,
              volume: after.state.volume,
              pan: after.state.pan,
              color: after.state.color,
            };
            const restored = final === null ? [] :
              (['mute', 'solo', 'volume', 'pan', 'color'] as const)
                .filter((field) => same(final[field], before.state[field]));
            const reportedOnly = (['mute', 'solo', 'volume', 'pan', 'color'] as const)
              .filter((field) => !restored.includes(field));
            return { name: before.name, captured: before.state, final, restored, reportedOnly };
          });
        };

        try {
          const inserted = await workspace.apply([{
            op: 'device.insert',
            track,
            source: args.containerType === 'instrument'
              ? { from: 'file', path: INSTRUMENT_LAYER_SEED_PATH }
              : { from: 'bitwig', uuid: FX_LAYER_UUID },
          }], { clearance });
          changes['replacementChange'] = receiptOf(inserted);
          const replacement = inserted.take.receipt.minted[0];
          if (replacement?.kind !== 'device' || replacement.chainIndex !== replacementStart) {
            return partial('the replacement insertion was not independently observed at the projected track tail.');
          }

          const seedRead = await workspace.read([replacement]);
          const seedEntry = seedRead.entries[addressKey(replacement)];
          const seedDevice = seedEntry?.value.of === 'device' ? seedEntry.value.device : undefined;
          const seed = seedDevice?.container;
          if (seedDevice?.name !== device.name || seed?.chainsComplete !== true || seed.chains.length !== 1) {
            return partial('the inserted replacement did not prove the same observed container name '
              + 'and exactly one complete seed entry; the original was left intact.', {
              replacementContainerPosition: replacement.chainIndex,
            });
          }

          let seedName = seed.chains[0]!.name;
          if (seedName === captured[0]!.name) {
            const occupied = new Set(captured.map((item) => item.name));
            let temporary = 'ghostnote pending reduction';
            while (occupied.has(temporary)) temporary += ' pending';
            const prepared = await workspace.apply([{
              op: 'chain.rename', chain: chainAt(replacement, seedName), name: temporary,
            }], { clearance });
            changes['preparationChange'] = receiptOf(prepared);
            seedName = temporary;
          }

          const named = await workspace.apply([{
            op: 'chain.rename', chain: chainAt(replacement, seedName), name: captured[0]!.name,
          }], { clearance });
          changes['namingChange'] = receiptOf(named);
          // Copy each survivor from the one immediately before it so either
          // beside-source or tail placement preserves the captured order.
          const added = await workspace.apply(captured.slice(1).map((item, index): Op => ({
            op: 'chain.create', source: chainAt(replacement, captured[index]!.name), name: item.name,
          })), { clearance });
          changes['alternateChange'] = receiptOf(added);

          const emptyReplacement = await deviceAlternatesAt(workspace, args.trackId, replacement.chainIndex);
          const emptyAlternates = emptyReplacement['alternates'] as
            | { name: string; devices: unknown[] }[] | undefined;
          if (emptyReplacement['readable'] !== true || emptyReplacement['complete'] !== true
              || !same(emptyAlternates?.map((item) => item.name), captured.map((item) => item.name))
              || emptyAlternates?.some((item) => item.devices.length !== 0)) {
            return partial('the empty named replacement was not independently proved; the original was left intact.', {
              replacementStructure: emptyReplacement,
            });
          }

          const migrations = captured.flatMap((item) => item.devices.map((): Op => ({
            op: 'chain.relocate',
            source: deviceIn(chainAt(original, item.name), 0),
            destination: chainAt(replacement, item.name),
            mode: 'move',
          })));
          if (migrations.length > 0) {
            const migrated = await workspace.apply(migrations, { clearance });
            changes['migrationChange'] = receiptOf(migrated);
            const receipt = changes['migrationChange'] as ReturnType<typeof receiptOf>;
            if (receipt.failed !== undefined || receipt.applied === false) {
              return partial('the survivor migration did not completely apply; the original was left intact.');
            }
          }

          let replacementStructure = await deviceAlternatesAt(
            workspace, args.trackId, replacement.chainIndex,
          );
          const originalStructure = await deviceAlternatesAt(
            workspace, args.trackId, original.chainIndex,
          );
          const oldAlternates = originalStructure['alternates'] as
            | { name: string; devices: unknown[] }[] | undefined;
          const oldSurvivorsEmpty = originalStructure['readable'] === true
            && originalStructure['complete'] === true
            && captured.every((item) =>
              oldAlternates?.find((old) => old.name === item.name)?.devices.length === 0);
          if (!replacementMatches(replacementStructure) || !oldSurvivorsEmpty) {
            return partial('fresh complete readback did not prove every survivor in the replacement '
              + 'and emptied in the original, so the original was not removed.', {
              replacementStructure, originalStructure,
            });
          }

          const soloed = captured.filter((item) => item.state.solo);
          if (soloed.length === 1) {
            const activated = await workspace.apply([{
              op: 'chain.activate', chain: chainAt(replacement, soloed[0]!.name),
            }], { clearance });
            changes['soloChange'] = receiptOf(activated);
            replacementStructure = await deviceAlternatesAt(
              workspace, args.trackId, replacement.chainIndex,
            );
          }
          if (!replacementMatches(replacementStructure)) {
            return partial('the replacement structure became unreadable while restoring reported state; '
              + 'the original was left intact.', { replacementStructure });
          }
          const state = stateReport(replacementStructure);
          if (state.some((item) => item.final === null
              || Object.values(item.final).some((value) => value === null))) {
            return partial('the final replacement state was not completely observable, so the original '
              + 'was left intact.', { replacementStructure, stateRestoration: state });
          }

          removalAttempted = true;
          const deleted = await workspace.apply([{
            op: 'device.delete', device: original, expectedName: device.name,
          }], { clearance });
          changes['removalChange'] = receiptOf(deleted);
          const afterRemoval = await workspace.devices(track);
          const afterRemovalNames = afterRemoval.devices.map((item) => item.name);
          const removedConfirmed = afterRemoval.devicesComplete && same(afterRemovalNames, expectedAfterRemoval);
          if (!removedConfirmed) {
            const beforeDelete = [...initialNames, device.name];
            const removalState = afterRemoval.devicesComplete && same(afterRemovalNames, beforeDelete)
              ? false : null;
            return {
              ...partial('the replacement is complete, but fresh readback did not prove removal of '
                + 'the guarded original container.', {
                originalContainerRemoved: removalState,
                replacementStructure,
                stateRestoration: state,
                finalDeviceOrder: afterRemoval.devicesComplete ? afterRemovalNames : null,
              }),
            };
          }

          if (needsReorder) {
            const reordered = await workspace.apply([{
              op: 'device.relocate',
              track,
              sourceFromEnd: 0,
              expectedName: device.name,
              before: deviceAt(track, args.containerPosition),
            }], { clearance });
            changes['reorderChange'] = receiptOf(reordered);
          }

          const final = await workspace.devices(track);
          const finalStructure = await deviceAlternatesAt(
            workspace, args.trackId, args.containerPosition,
          );
          const finalState = stateReport(finalStructure);
          const finalStateKnown = finalState.every((item) => item.final !== null
            && Object.values(item.final).every((value) => value !== null));
          const finalConfirmed = final.devicesComplete
            && same(final.devices.map((item) => item.name), initialNames)
            && replacementMatches(finalStructure)
            && finalStateKnown;
          return {
            applied: finalConfirmed,
            originalContainerRemoved: true,
            replacementPositionConfirmed: finalConfirmed,
            ...carried,
            ...changes,
            stateRestoration: finalState,
            finalDeviceOrder: final.devicesComplete
              ? final.devices.map((item) => item.name) : null,
            finalStructure,
            ...(finalConfirmed ? {} : {
              why: 'the original was removed, but the replacement was not proved at its old signal '
                + 'position with the exact surviving structure.',
            }),
          };
        } catch (error) {
          return {
            ...partial('selective reduction stopped after it had already written. Nothing here '
              + 'claims completion; inspect both containers before acting again.', {
                originalContainerRemoved: removalAttempted ? null : false,
              }),
            unexpected: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          };
        }
      });
    },
  }),

  tool({
    name: 'keep_device_alternate',
    kind: 'destructive',
    title: 'Keep one device alternate',
    description:
      'Keep the devices from one explicitly named alternate at the container\'s current signal '
      + 'position, then remove the container and every other alternate in it. The complete '
      + 'device order and all reported alternate state are read before anything moves. Every '
      + 'kept device is moved out in order and independently read back before the container can '
      + 'be removed; acknowledgement alone is never enough. The final complete track device '
      + 'order is read back again. Only container positions 0 and 1 are observable.\n'
      + 'Restoring the position is proved from the track device order, and devices are observed '
      + 'by position and name only. When the requested order would read exactly the same before '
      + 'and after the restoring move — two devices sharing one name — nothing could tell that '
      + 'move from a move that never happened, so the whole operation is refused before anything '
      + 'is removed.\n'
      + 'This permanently removes the other alternates and cannot be undone here. Device moves '
      + 'carry device state, but do not carry the alternate\'s name, mute, solo, volume, pan or '
      + 'colour; those exact values are reported in every answer once anything has been written, '
      + 'including one that cannot confirm what it did. Device alternates have no sends. '
      + 'Cross-device modulation is not claimed to survive. The signal interruption can be audible.',
    inputSchema: {
      trackId,
      containerPosition: z.number().int().min(0).describe(
        'Current position of the containing device in the track, counting from 0. Only 0 and 1 expose container contents.',
      ),
      alternateName: alternateName.describe('Exact durable name of the one device alternate to keep.'),
    },
    emits: ['chain.relocate', 'device.delete', 'device.relocate'],
    status: ['device-alternate'],
    async run(workspace, args) {
      return writing(async () => {
        const track = trackAt(args.trackId);
        const container = deviceAt(track, args.containerPosition);
        const topBefore = await workspace.devices(track);
        const snapshot = await workspace.read([track, container]);
        const entry = snapshot.entries[addressKey(container)];
        const device = entry?.value.of === 'device' ? entry.value.device : undefined;
        const observed = device?.container;
        if (!topBefore.devicesComplete || topBefore.bankSize === undefined) {
          return { refused: true, nothingWasWritten: true,
            why: 'the complete starting track device order was not observable.' };
        }
        if (observed === undefined || !observed.chainsComplete) {
          return { refused: true, nothingWasWritten: true,
            why: 'the complete sibling set was not observable at that container position.' };
        }
        const found = lookupChain(observed, args.alternateName);
        if (!found.ok || !found.chain.devicesComplete) {
          return { refused: true, nothingWasWritten: true,
            why: found.ok
              ? 'the complete ordered device sequence of the named alternate was not observable.'
              : `the named device alternate was ${found.miss}.` };
        }
        const winner = found.chain;
        const stateKnown = typeof winner.mute === 'boolean'
          && typeof winner.solo === 'boolean'
          && typeof winner.volume === 'number'
          && typeof winner.pan === 'number'
          && winner.color !== undefined;
        if (!stateKnown) {
          return { refused: true, nothingWasWritten: true,
            why: 'name, mute, solo, volume, pan and colour must all be observed exactly before removal.' };
        }
        const initialNames = topBefore.devices.map((item) => item.name);
        if (device === undefined || initialNames[args.containerPosition] !== device.name) {
          return { refused: true, nothingWasWritten: true,
            why: 'the container identity disagreed between the full track reading and its own reading.' };
        }
        const keptNames = winner.devices.map((item) => item.name);
        if (initialNames.length + keptNames.length > topBefore.bankSize) {
          return { refused: true, nothingWasWritten: true,
            why: `extracting ${keptNames.length} kept devices would make ${initialNames.length
              + keptNames.length} top-level devices, beyond the observable bank of ${topBefore.bankSize}.` };
        }

        // The three orders every later reading is judged against, worked out
        // once from the one complete pre-write observation.
        const withoutContainer = initialNames.filter((_, index) => index !== args.containerPosition);
        const expectedExtracted = [...initialNames, ...keptNames];
        const expectedAfterRemoval = [...withoutContainer, ...keptNames];
        const expectedFinal = [
          ...initialNames.slice(0, args.containerPosition),
          ...keptNames,
          ...initialNames.slice(args.containerPosition + 1),
        ];
        const followingName = initialNames[args.containerPosition + 1];
        const restoring = followingName === undefined || keptNames.length === 0
          ? []
          : keptNames.map((name, index) => ({
            name,
            sourceFromEnd: keptNames.length - 1 - index,
            anchorPosition: args.containerPosition + index,
          }));

        // ⚠⚠ REFUSED HERE, before the container is destroyed, when the
        // restoration is one no reading could prove.
        //
        // A top-level device has no durable id: it is observed by position and
        // name, and the position is exactly what the restoring move changes. So
        // when the order the move should leave spells the same names as the
        // order it started from — two devices sharing one name — "the device
        // moved back" and "nothing happened" are the same reading, and the
        // answer would report a restored signal position on evidence that
        // cannot exist. There is nothing stronger to fall back on and no way to
        // undo the removal afterwards, so the whole operation stops now, with
        // every alternate still intact.
        let projected = expectedAfterRemoval;
        for (const step of restoring) {
          const sourceIndex = projected.length - 1 - step.sourceFromEnd;
          const next = projectedReorder(projected, sourceIndex, step.anchorPosition);
          if (next === undefined || JSON.stringify(next) === JSON.stringify(projected)) {
            return {
              refused: true,
              nothingWasWritten: true,
              why: `restoring "${step.name}" to position ${step.anchorPosition} would leave the `
                + `device order reading [${projected.join(', ')}] both before and after the move, `
                + 'so nothing could tell it from a move that never happened. Devices are observed '
                + 'by position and name only. Rename the devices that share a name and repeat '
                + 'this call.',
              deviceOrder: projected,
            };
          }
          projected = next;
        }
        if (restoring.length > 0 && JSON.stringify(projected) !== JSON.stringify(expectedFinal)) {
          return {
            refused: true,
            nothingWasWritten: true,
            why: 'the ordered restoration could not be projected onto the exact final device order '
              + 'this operation would have to prove, so nothing was removed.',
            deviceOrder: projected,
          };
        }

        // ⚠ What every answer from here on must carry. Once the first device
        // has moved, an answer that omits the state no move carries is
        // reporting a partial destruction as though it were nothing at all.
        const carried = {
          keptAlternate: args.alternateName,
          keptDevices: keptNames,
          stateNotCarried: {
            name: args.alternateName,
            mute: winner.mute,
            solo: winner.solo,
            volume: winner.volume,
            pan: winner.pan,
            color: winner.color,
            sends: 'none',
          },
          crossDeviceModulation: 'not measured and not claimed',
        };

        /**
         * ⚠ REMOVED, NOT REMOVED, or NEITHER — read off a fresh complete track
         * order rather than assumed from a receipt. Three orders are
         * recognisable: the one extraction leaves with the container still
         * there, the one its removal leaves, and the restored one. Anything
         * else, or any reading that could not see the whole track, is `null`:
         * the removal is unconfirmed, which is a third answer and not a
         * quieter way of saying no.
         */
        const observedRemoval = async (
          known?: { readonly devices: readonly { readonly name: string }[]; readonly devicesComplete: boolean },
        ): Promise<boolean | null> => {
          try {
            const reading = known ?? await workspace.devices(track);
            if (!reading.devicesComplete) return null;
            const names = JSON.stringify(reading.devices.map((item) => item.name));
            if (names === JSON.stringify(expectedExtracted)) return false;
            if (names === JSON.stringify(expectedAfterRemoval)) return true;
            if (names === JSON.stringify(expectedFinal)) return true;
            return null;
          } catch {
            return null;
          }
        };

        const clearance = directedDestruction('keep_device_alternate');
        let extractionReceipt: ReturnType<typeof receiptOf> | undefined;
        let removalReceipt: ReturnType<typeof receiptOf> | undefined;
        let removalAttempted = false;
        try {
          const extraction = keptNames.length === 0 ? undefined : await workspace.apply(
            keptNames.map((): Op => ({
              op: 'chain.relocate',
              source: deviceIn(chainAt(container, args.alternateName), 0),
              destination: track,
              mode: 'move',
            })),
            { clearance },
          );
          extractionReceipt = extraction === undefined ? undefined : receiptOf(extraction);
          if (extractionReceipt?.failed !== undefined || extractionReceipt?.applied === false) {
            return { applied: false, containerRemoved: false, finalPositionConfirmed: false,
              ...carried, extractionChange: extractionReceipt,
              why: 'device extraction was not completely proved, so the container was not removed.' };
          }

          const topExtracted = await workspace.devices(track);
          const extractedSnapshot = await workspace.read([container]);
          const extractedEntry = extractedSnapshot.entries[addressKey(container)];
          const extractedContainer = extractedEntry?.value.of === 'device'
            ? extractedEntry.value.device.container : undefined;
          const emptied = extractedContainer === undefined
            ? undefined : lookupChain(extractedContainer, args.alternateName);
          const extractionConfirmed = topExtracted.devicesComplete
            && JSON.stringify(topExtracted.devices.map((item) => item.name)) === JSON.stringify(expectedExtracted)
            && emptied?.ok === true && emptied.chain.devicesComplete && emptied.chain.devices.length === 0;
          if (!extractionConfirmed) {
            return { applied: false, containerRemoved: false, finalPositionConfirmed: false,
              ...carried, extractionChange: extractionReceipt,
              deviceOrder: topExtracted.devicesComplete
                ? topExtracted.devices.map((item) => item.name) : null,
              why: 'fresh complete readback did not prove every kept device at the track tail and none left behind.' };
          }

          removalAttempted = true;
          const removed = await workspace.apply([{
            op: 'device.delete', device: container, expectedName: device.name,
          }], { clearance });
          removalReceipt = receiptOf(removed);
          if (removalReceipt.failed !== undefined || removalReceipt.applied === false) {
            // ⚠ Not `false`. The request went out, so whether it landed is a
            // question for a reading, not for the receipt that just declined.
            return { applied: false, containerRemoved: await observedRemoval(),
              finalPositionConfirmed: false, ...carried,
              extractionChange: extractionReceipt, removalChange: removalReceipt,
              why: 'the devices were extracted, and removal of the guarded container was not '
                + 'confirmed. The reported removal state is what a fresh complete reading showed.' };
          }

          const afterRemoval = await workspace.devices(track);
          const removalConfirmed = afterRemoval.devicesComplete
            && JSON.stringify(afterRemoval.devices.map((item) => item.name)) === JSON.stringify(expectedAfterRemoval);
          if (!removalConfirmed) {
            const state = await observedRemoval(afterRemoval);
            return {
              applied: false,
              containerRemoved: state,
              finalPositionConfirmed: false,
              ...carried,
              extractionChange: extractionReceipt,
              removalChange: removalReceipt,
              deviceOrder: afterRemoval.devicesComplete
                ? afterRemoval.devices.map((item) => item.name) : null,
              why: state === false
                ? 'the kept devices were moved out and the container is still there, so this is a '
                  + 'partly finished operation rather than a completed one.'
                : 'the kept devices were moved out, and no complete reading could say whether only '
                  + 'the container was removed. Read the track device order before acting again.',
            };
          }

          const reordered = restoring.length === 0
            ? undefined
            : await workspace.apply(restoring.map((step): Op => ({
              op: 'device.relocate',
              track,
              sourceFromEnd: step.sourceFromEnd,
              expectedName: step.name,
              before: deviceAt(track, step.anchorPosition),
            })), { clearance });
          const reorderReceipt = reordered === undefined ? undefined : receiptOf(reordered);
          const final = await workspace.devices(track);
          const finalConfirmed = final.devicesComplete
            && reorderReceipt?.failed === undefined
            && reorderReceipt?.applied !== false
            && JSON.stringify(final.devices.map((item) => item.name)) === JSON.stringify(expectedFinal);
          return {
            applied: finalConfirmed,
            containerRemoved: true,
            finalPositionConfirmed: finalConfirmed,
            ...carried,
            extractionChange: extractionReceipt,
            removalChange: removalReceipt,
            ...(reorderReceipt === undefined ? {} : { reorderChange: reorderReceipt }),
            finalDeviceOrder: final.devicesComplete
              ? final.devices.map((item) => item.name) : null,
            ...(finalConfirmed ? {} : {
              why: 'the container was removed and the kept devices were not proved back at its '
                + 'original position by a complete final reading.',
            }),
          };
        } catch (error) {
          // ⚠⚠ The one place this surface must not answer "nothing was
          // written", because by here something was. A refusal shape would
          // report a half-finished destruction as an operation that never
          // started.
          return {
            applied: false,
            containerRemoved: removalAttempted ? await observedRemoval() : false,
            finalPositionConfirmed: false,
            ...carried,
            ...(extractionReceipt === undefined ? {} : { extractionChange: extractionReceipt }),
            ...(removalReceipt === undefined ? {} : { removalChange: removalReceipt }),
            why: 'this operation stopped after it had already written, so nothing here claims that '
              + 'nothing happened. The recorded changes and the captured state are below; read the '
              + 'track device order before acting on it again.',
            unexpected: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          };
        }
      });
    },
  }),

  tool({
    name: 'delete_clip',
    kind: 'destructive',
    title: 'Delete clips',
    description:
      'Remove clips from launcher slots. The slot is left empty; the row stays.\n'
      + 'Each clip\'s notes and length are read and recorded first, so this can be undone — but '
      + 'a clip put back is a new clip carrying the same notes. Its name, colour, loop start and '
      + 'end as distinct from its length, its launch settings and its automation are not '
      + 'recorded by anything here and do not come back.',
    inputSchema: {
      clips: z.array(z.object({ trackId, row })).min(1),
    },
    emits: ['clip.delete'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const ops: Op[] = args.clips.map((c) => ({ op: 'clip.delete', slot: slotOf(c.trackId, c.row, at) }));
        return receiptOf(
          await workspace.apply(ops, { clearance: directedDestruction('delete_clip') }),
        );
      });
    },
  }),

  tool({
    name: 'delete_track',
    kind: 'destructive',
    title: 'Delete tracks',
    description:
      'Remove tracks from the project, with everything on them: every clip, every device, every '
      + 'setting. A track that holds other tracks removes those too.\n'
      + 'This cannot be undone by anything here. A track made again gets a new id, so it is a '
      + 'different track and nothing recorded about the old one can be replayed onto it. What is '
      + 'removed is named back in the answer, by id, so the result can be checked against what '
      + 'was intended.',
    inputSchema: {
      trackIds: z.array(z.string()).min(1).describe('From list_tracks.'),
    },
    emits: ['track.delete'],
    async run(workspace, args) {
      return writing(async () => {
        if (new Set(args.trackIds).size !== args.trackIds.length) {
          return {
            refused: true,
            why: 'each track id can appear only once. Nothing was removed.',
          };
        }
        const positions = new Map(
          (await workspace.tracks()).map((track) => [track.channelId, track.position]),
        );
        // The live adapter resolves durable ids before it sends the batch. A
        // lower removal shifts every higher bank position, so remove from the
        // highest observed position to the lowest.
        const ops: Op[] = args.trackIds
          .map((id) => ({ op: 'track.delete' as const, track: trackAt(id) }))
          .sort((left, right) =>
            (positions.get(right.track.channelId) ?? -1)
              - (positions.get(left.track.channelId) ?? -1));
        return receiptOf(
          await workspace.apply(ops, { clearance: directedDestruction('delete_track') }),
        );
      });
    },
  }),

  tool({
    name: 'delete_scene',
    kind: 'destructive',
    title: 'Delete launcher rows',
    description:
      'Remove launcher rows. Every clip in the row, on every track, goes with it.\n'
      + 'It also moves every row below the deleted one up by one, so every row number worked out '
      + 'before this means something else afterwards. Addresses minted earlier are refused rather '
      + 'than resolved against the new arrangement. Several rows in one call are removed highest '
      + 'first, so the numbers given all refer to the arrangement as it was before the call.\n'
      + 'This cannot be undone by anything here: the arrangement of rows has no readback, so '
      + 'there is nothing recorded to put back.',
    inputSchema: {
      rows: z.array(z.number().int().min(0)).min(1),
    },
    emits: ['scene.delete'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        // ⚠ Highest first. Each removal moves everything below it up, so
        // removing a low row first would make every later number in the same
        // call point one row too far down.
        const rows = [...new Set(args.rows)].sort((a, b) => b - a);
        const ops: Op[] = rows.map((index) => ({ op: 'scene.delete', scene: sceneAt(index, at.sceneEpoch) }));
        return receiptOf(
          await workspace.apply(ops, { clearance: directedDestruction('delete_scene') }),
        );
      });
    },
  }),

  tool({
    name: 'delete_device',
    kind: 'destructive',
    title: 'Remove devices from a track',
    description:
      'Remove top-level devices by current position after a fresh complete device-order inspection.\n'
      + 'This cannot be undone by anything here. Parameter and enabled-state reads are not a '
      + 'complete device reconstruction: presets, internal state, modulation topology, and plugin '
      + 'state cannot all be rebuilt.\n'
      + 'Removing a device moves everything after it up one position. Within a single call the '
      + 'higher positions are removed first so the numbers given all refer to the same starting '
      + 'arrangement. The result verifies the complete device order after each removal. Across calls, '
      + 'inspect the device order again.',
    inputSchema: {
      devices: z.array(z.object({
        trackId,
        position: z.number().int().min(0).describe('Position in the track, from 0.'),
      })).min(1),
    },
    emits: ['device.delete'],
    resultContract: {
      verified: 'True only when every complete post-delete device order matches the requested removal.',
      changes: 'One recorded destructive write receipt per removed device.',
      partialSuccess: 'True when a later removal failed after an earlier removal landed.',
      reversal: 'none. An existing device cannot be reconstructed.',
      elapsedMs: 'Wall-clock time for this call.',
    },
    async run(workspace, args) {
      const started = performance.now();
      const changes: ReturnType<typeof receiptOf>[] = [];
      const removed: Array<{ trackId: string; position: number; name: string }> = [];
      try {
        const unique = new Set(args.devices.map((item) => `${item.trackId}:${item.position}`));
        if (unique.size !== args.devices.length) {
          throw new Error('each starting device position can appear only once');
        }
        const byTrack = new Map<string, typeof args.devices>();
        for (const item of args.devices) {
          const group = byTrack.get(item.trackId) ?? [];
          group.push(item);
          byTrack.set(item.trackId, group);
        }
        for (const [id, group] of byTrack) {
          const initial = await workspace.devices(trackAt(id));
          if (!completeDeviceBank(initial) || enabledFingerprint(initial) === undefined) {
            throw new Error('the complete top-level device name and enabled-state chain is not visible');
          }
          for (const item of [...group].sort((a, b) => b.position - a.position)) {
            if (initial.devices[item.position] === undefined) {
              throw new Error(`device position ${item.position} is absent on track ${id}`);
            }
          }
        }

        for (const [id, group] of byTrack) {
          for (const item of [...group].sort((a, b) => b.position - a.position)) {
            const track = trackAt(id);
            const before = await workspace.devices(track);
            const enabled = enabledFingerprint(before);
            if (!completeDeviceBank(before) || enabled === undefined) {
              throw new Error('the complete top-level device name and enabled-state chain is not visible');
            }
            const observed = before.devices[item.position];
            if (observed === undefined) throw new Error('the current device position is absent');
            const expectedAfter = before.devices.filter((_, index) => index !== item.position)
              .map((entry, index) => ({ ...entry, index }));
            const change = await workspace.apply([{
              op: 'device.delete',
              device: deviceAt(track, item.position),
              expectedName: observed.name,
              expectedChain: before.devices.map((entry) => entry.name),
              expectedEnabledChain: enabled,
            }], { clearance: directedDestruction('delete_device') });
            const receipt = receiptOf(change);
            changes.push(receipt);
            const after = await workspace.devices(track);
            const matches = completeDeviceBank(after)
              && after.devices.length === expectedAfter.length
              && after.devices.every((entry, index) => {
                const expected = expectedAfter[index];
                return entry.index === expected?.index
                  && entry.name === expected.name
                  && entry.enabled === expected.enabled;
              });
            if (!receipt.applied || receipt.failed !== undefined || !matches) {
              return {
                applied: false,
                verified: false,
                partialSuccess: removed.length > 0,
                changes,
                removed,
                reversal: 'none-existing-device-cannot-be-reconstructed',
                elapsedMs: Math.round(performance.now() - started),
              };
            }
            removed.push({ trackId: id, position: item.position, name: observed.name });
          }
        }
        return {
          applied: true,
          verified: true,
          partialSuccess: false,
          changes,
          removed,
          reversal: 'none-existing-device-cannot-be-reconstructed',
          elapsedMs: Math.round(performance.now() - started),
        };
      } catch (error) {
        if (changes.length === 0) return refusalOf(error);
        return {
          applied: false,
          verified: false,
          partialSuccess: true,
          why: error instanceof Error ? error.message : String(error),
          changes,
          removed,
          reversal: 'none-existing-device-cannot-be-reconstructed',
          elapsedMs: Math.round(performance.now() - started),
        };
      }
    },
  }),
];

// --- plumbing ----------------------------------------------------------------

const coverage = (c: { count: number; bankSize: number }): {
  addressable: number; inProject: number | null;
} => ({ addressable: c.bankSize, inProject: c.count < 0 ? null : c.count });

function sourceOf(d: { from: string; id?: string; path?: string }): DeviceSource {
  if (d.from === 'preset') {
    if (d.path === undefined) throw new Error('a preset source needs `path`');
    if (!isAbsolute(d.path)) throw new Error('a preset path must be absolute');
    if (!d.path.toLowerCase().endsWith('.bwpreset')) {
      throw new Error('a preset path must end in `.bwpreset`');
    }
    if (!existsSync(d.path)) throw new Error('the preset file does not exist');
    return { from: 'file', path: d.path };
  }
  if (d.id === undefined) throw new Error(`a ${d.from} source needs \`id\``);
  if (d.from === 'vst3') return { from: 'vst3', classUid: d.id };
  if (d.from === 'clap') return { from: 'clap', id: d.id };
  if (!isNativeDeviceUuid(d.id)) throw new Error('a Bitwig device id must be a lowercase UUID');
  return { from: 'bitwig', uuid: d.id };
}

export const toolNamed = (name: string): ToolSpec | undefined => TOOLS.find((t) => t.name === name);

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

/** Build a row only from explicit confirmation fields in the declared result contract. */
function confirmedToolResult(
  outcome: ObservationOutcome,
  args: unknown,
  result: unknown,
): ConfirmedToolResult | undefined {
  const input = object(args);
  const reply = object(result);
  if (input === undefined || reply === undefined) return undefined;

  if (outcome === 'device-alternate') {
    const structure = object(reply['structure']);
    const container = object(structure?.['container']);
    const names = Array.isArray(input['names'])
      && input['names'].every((name) => typeof name === 'string')
      ? input['names'] as string[]
      : undefined;
    if (reply['creationConfirmed'] !== true
        || typeof input['trackId'] !== 'string'
        || !Number.isInteger(container?.['devicePosition'])
        || names === undefined) return undefined;
    return {
      kind: 'device-alternate',
      trackId: input['trackId'],
      containerPosition: container!['devicePosition'] as number,
      alternateNames: names,
    };
  }

  if (outcome === 'clip-block') {
    const copiedTo = object(reply['copiedTo']);
    if (reply['creationConfirmed'] !== true
        || typeof input['trackId'] !== 'string'
        || !Number.isInteger(input['row'])
        || !Number.isInteger(copiedTo?.['row'])) return undefined;
    return {
      kind: 'clip-block',
      trackId: input['trackId'],
      sourceRow: input['row'] as number,
      copiedRow: copiedTo!['row'] as number,
    };
  }

  if (outcome === 'musical-generation' || outcome === 'musical-transformation') {
    const changes = Array.isArray(reply['changes']) ? reply['changes'] : [];
    const change = object(changes[0]);
    const outputs = Array.isArray(reply['outputs']) ? reply['outputs'] : undefined;
    const differences = Array.isArray(reply['differences']) ? reply['differences'] : undefined;
    const warnings = Array.isArray(reply['warnings']) ? reply['warnings'] : undefined;
    const expectedOperation = outcome === 'musical-generation' ? 'generation' : 'transformation';
    if (reply['format'] !== 'ghostnote-musical-result'
        || reply['version'] !== 1
        || reply['operation'] !== expectedOperation
        || typeof change?.['changeId'] !== 'string'
        || typeof change?.['applied'] !== 'boolean'
        || outputs === undefined
        || differences === undefined
        || warnings === undefined) return undefined;
    return {
      kind: 'musical-use',
      tool: outcome === 'musical-generation'
        ? 'generate_clip_music'
        : 'transform_clip_music',
      changeId: change['changeId'],
      applied: change['applied'],
      outputCount: outputs.length,
      differenceCount: differences.length,
      warningCount: warnings.length,
    };
  }

  const copied = object(reply['copied']);
  if (reply['copyConfirmed'] !== true
      || typeof input['trackId'] !== 'string'
      || typeof copied?.['trackId'] !== 'string') return undefined;
  return {
    kind: 'copy-track',
    sourceTrackId: input['trackId'],
    copiedTrackId: copied['trackId'],
  };
}

async function executeTool(
  workspace: Workspace,
  spec: ToolSpec,
  args: unknown,
): Promise<unknown> {
  const execution: ObservationExecution | undefined = spec.observation === undefined
    ? undefined
    : workspace.observations.execution();
  const captured = await captureWorkspaceChanges(
    workspace,
    async (scoped) => spec.run(scoped, args as never),
  );
  const { result } = captured;
  const confirmed = spec.observation === undefined
    ? undefined
    : confirmedToolResult(spec.observation, args, result);

  let reported = result;
  if (spec.observation !== undefined && execution !== undefined && confirmed !== undefined) {
    try {
      const resultId = await workspace.observations.recordResult(confirmed, execution);
      reported = {
        ...object(result),
        ...(spec.observation === 'copy-track'
          ? { ordinaryUseId: resultId }
          : spec.observation === 'musical-generation'
              || spec.observation === 'musical-transformation'
            ? { musicalUseId: resultId }
            : { managedEventId: resultId }),
      };
    } catch (error) {
      reported = reportObservationFailureAfterProjectWrite(result, error);
    }
  }

  const changed = captured.changes
    .filter((change) => change.take.report.applied
      && change.take.receipt.stages.some(
        (stage) => stage.applied && stage.ops.some((op) => op.ok),
      ))
    .sort((left, right) => right.seq - left.seq)[0];
  // A semantic status needs its semantic confirmation. This prevents a partial
  // container insertion from being reported as a completed alternate.
  const statusConfirmed = spec.observation === undefined || confirmed !== undefined;
  const resultApplied = object(result)?.['applied'] === true;
  if (changed !== undefined && statusConfirmed && resultApplied) {
    try {
      await workspace.status.publish({
        categories: spec.status ?? ['change'],
        changeId: changed.take.id,
        seq: changed.seq,
        target: {
          generation: changed.take.at.generation,
          project: changed.take.at.project,
        },
        ...(execution?.instructionId === undefined
          ? {}
          : { groupKey: execution.correlationId }),
      });
    } catch (error) {
      return {
        ...object(reported),
        statusUpdate: {
          succeeded: false,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
  return reported;
}

/**
 * Run one tool by name, validating its input first.
 *
 * ⚠ The same path the server uses, so a case that passes here is a case that
 * passes over the wire — the whole reason the tools are data rather than
 * registrations.
 */
export async function callTool(
  workspace: Workspace,
  name: string,
  args: unknown = {},
): Promise<unknown> {
  const spec = toolNamed(name);
  if (spec === undefined) throw new Error(`no such tool: ${name}`);
  const parsed = (spec.inputValidator ?? z.object(spec.inputSchema)).parse(args);
  return executeTool(workspace, spec, parsed);
}

/** Put every tool on an MCP server, with the annotations its class implies. */
export function registerTools(server: McpServer, workspace: Workspace): void {
  for (const spec of TOOLS) {
    server.registerTool(
      spec.name,
      {
        title: spec.title,
        description: spec.description,
        inputSchema: spec.inputValidator ?? spec.inputSchema,
        annotations: ANNOTATIONS[spec.kind],
      },
      async (args: unknown, extra: { readonly signal?: AbortSignal }) => ({
        content: [{
          type: 'text' as const,
          text: JSON.stringify(await callTool(
            extra?.signal === undefined
              ? workspace
              : cancellableWorkspace(workspace, extra.signal),
            spec.name,
            args,
          )),
        }],
      }),
    );
  }
}
