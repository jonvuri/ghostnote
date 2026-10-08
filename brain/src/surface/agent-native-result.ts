/**
 * The shared result vocabulary of the `agent-native-v1` profile (8h4b).
 *
 * Every tool of the profile returns one of three envelopes: a read, a write, or
 * a failure. Agents branch on `failure.code`, never on message text. Adapter
 * and exception text goes into `diagnostic` only. Every later 8h4 session uses
 * this module; do not add a second envelope.
 *
 * Six outcomes stay distinct (interface audit, target conventions):
 *
 *   - `empty`: the launcher slot exists and holds no clip. A read result, not a
 *     failure, and not an empty clip.
 *   - `absent`: the target does not exist. Never an empty result.
 *   - `unavailable`: a value or a compound field has no representable reading.
 *   - `partial`: the read did not cover every note field or channel.
 *   - `unhealthy`: the connection, extension, or project state cannot support
 *     a fresh read.
 *   - `outside-limit`: the target or its content is outside the observed window
 *     or the reader limits.
 *
 * An edit adds `unsupported` (8h4c): the host binding cannot write or reverse
 * the proposed change exactly. `detail.reason` names the rule (HOST-BINDING.md,
 * "Edit refusals").
 *
 * The Launcher clip tools add `occupied` (8h4d): a destination slot holds a clip,
 * and the write would replace it or put the clip on an unreachable row (E20b, E21).
 *
 * 8h4f: a write that stopped after an earlier recorded change uses `partial`;
 * `failure.effects` lists each completed change. The retained tools map a
 * missing change record to `absent` and a value outside a host-proved domain
 * to `range`.
 */
import { BridgeError } from '../client.js';
import {
  AddressUnresolvedError, BankWindowOverflowError, BlindSpotError, CLIP_READ_SOUNDING_CELLS, ClipReadLimitError,
  ClipSnapshotRefusedError, InvalidOpError, ParameterValueUnrepresentableError, SlotOccupiedError,
  CollapsedGroupRowError, ContractVersionError, GroupSlotError, RuntimeProfileMismatchError,
  StaleAddressError, WireDriftError,
  type ClipSnapshotVerdictKind,
} from '../contract/index.js';
import { StaleExtensionError } from '../deploy.js';
import { BindingRefusal } from '../bindings/ghostnote-document.js';
import { UnprotectedWriteError } from '../engine/index.js';
import { ChangesetNotFoundError, EmptySliceError } from '../stash/index.js';
import { DocumentError, ImportCollisionError } from '../document/index.js';

export const AGENT_NATIVE_TOOL_PROFILE = 'agent-native-v1';

/** The stable machine codes. Add a code only with a test and a row in the identity or host binding rules. */
export const FAILURE_CODES = [
  'absent',
  'unavailable',
  'partial',
  'unhealthy',
  'outside-limit',
  'authority-unavailable',
  'target-changed',
  'stale-address',
  'group-slot',
  'collapsed-group-row',
  'range',
  'collision',
  'invalid-ref',
  'expired-ref',
  'stale',
  'identity-changed',
  'incomparable',
  'invalid-input',
  'unsupported',
  'occupied',
  'internal',
] as const;
export type FailureCode = typeof FAILURE_CODES[number];

/** The stage of a tool at which a failure stopped it. */
export type FailureStage =
  | 'input' | 'resolve' | 'acquire' | 'project' | 'registry' | 'guard' | 'plan' | 'write' | 'readback';

/**
 * One machine code for each D32 verdict. `current` is not a failure. A write
 * (8h4c) refuses every other verdict with this code.
 */
export const VERDICT_CODES: Readonly<Record<Exclude<ClipSnapshotVerdictKind, 'current'>, FailureCode>> = {
  stale: 'stale',
  'identity-changed': 'identity-changed',
  absent: 'absent',
  incomparable: 'incomparable',
  uncovered: 'outside-limit',
};

/** One machine code for each 8h4a refusal reason on `Refusal.reason`. */
export const REFUSAL_CODES: Readonly<Record<'group-slot' | 'collapsed-group-row', FailureCode>> = {
  'group-slot': 'group-slot',
  'collapsed-group-row': 'collapsed-group-row',
};

export interface Warning {
  readonly code: string;
  readonly message: string;
}

/** The read envelope. `timing` is diagnostic. */
export interface ReadResult<Data> {
  readonly schema: string;
  readonly source: Readonly<Record<string, unknown>>;
  readonly target: Readonly<Record<string, unknown>>;
  readonly coverage: Readonly<Record<string, unknown>>;
  readonly authority: Readonly<Record<string, unknown>>;
  readonly data: Data;
  readonly warnings: readonly Warning[];
  readonly timing?: Readonly<Record<string, number>>;
  readonly diagnostic?: unknown;
}

/** One durable effect of a write. */
export interface Effect {
  readonly changeId: string;
  readonly target: Readonly<Record<string, unknown>>;
  readonly summary: string;
  readonly fidelity: string;
}

/** The write envelope (used from 8h4c). */
export interface WriteResult<Readback> {
  readonly schema: string;
  readonly applied: boolean;
  readonly effects: readonly Effect[];
  readonly readback: Readback;
  readonly next?: Readonly<Record<string, unknown>>;
  readonly warnings?: readonly Warning[];
  readonly timing?: Readonly<Record<string, number>>;
}

/** The failure envelope. A read failure has no effects. */
export interface FailureResult {
  readonly schema: string;
  readonly failure: {
    readonly code: FailureCode;
    readonly stage: FailureStage;
    readonly effects: readonly Effect[];
  };
  readonly message: string;
  readonly retryWhen?: string;
  readonly target?: Readonly<Record<string, unknown>>;
  readonly detail?: Readonly<Record<string, unknown>>;
  /** Underlying adapter or exception text. Do not parse it. */
  readonly diagnostic?: { readonly error: string; readonly type: string };
}

/** A typed failure inside a tool. `run` turns it into a `FailureResult`. */
export class ToolFailure extends Error {
  constructor(
    readonly code: FailureCode,
    readonly stage: FailureStage,
    message: string,
    readonly extra: {
      readonly retryWhen?: string;
      readonly detail?: Readonly<Record<string, unknown>>;
      readonly cause?: unknown;
      readonly effects?: readonly Effect[];
    } = {},
  ) {
    super(message);
    this.name = 'ToolFailure';
  }
}

const RETRY_AFTER_CHANGE = 'after the project stops changing; read the target again';

/** Map one thrown value to a code and a short message. Unknown errors are `internal`. */
export function classifyError(error: unknown): {
  readonly code: FailureCode;
  readonly message: string;
  readonly retryWhen?: string;
} {
  if (error instanceof ToolFailure) {
    return { code: error.code, message: error.message,
      ...(error.extra.retryWhen === undefined ? {} : { retryWhen: error.extra.retryWhen }) };
  }
  if (error instanceof GroupSlotError) {
    return { code: REFUSAL_CODES['group-slot'], message: 'The track is a group track. Its launcher slots '
      + 'mirror the clips of its child tracks. Address a child track by its trackId.' };
  }
  if (error instanceof CollapsedGroupRowError) {
    return { code: REFUSAL_CODES['collapsed-group-row'], message: 'Ghostnote could not reach the requested '
      + 'row of a track inside a collapsed group.', retryWhen: 'after the group is expanded in Bitwig' };
  }
  if (error instanceof StaleAddressError) {
    return { code: 'stale-address', message: 'The scene layout, the project, or the extension changed '
      + 'during the call.', retryWhen: RETRY_AFTER_CHANGE };
  }
  if (error instanceof ClipSnapshotRefusedError) {
    const first = error.verdicts.find((item) => item.verdict !== 'current');
    const code = first === undefined ? 'internal' : VERDICT_CODES[first.verdict as keyof typeof VERDICT_CODES];
    return { code, message: 'A clip reference is not current.' };
  }
  if (error instanceof SlotOccupiedError) {
    return { code: 'occupied', message: 'A destination slot holds a clip. Nothing was written.' };
  }
  if (error instanceof BankWindowOverflowError || error instanceof BlindSpotError) {
    return { code: 'outside-limit', message: 'The target is outside the observed track or scene window.' };
  }
  if (error instanceof ClipReadLimitError) {
    return { code: 'outside-limit', message: error.reason === 'sounding-cell-limit'
      ? `The clip has more sounding cells than the reader limit (${CLIP_READ_SOUNDING_CELLS} cells: notes times `
        + 'their length in 1/512-beat cells). Nothing was read. Shorten or split the clip in Bitwig.'
      : 'The clip extends past the reader width of 8,192 beats. Nothing was read.' };
  }
  if (error instanceof AddressUnresolvedError) {
    // 8h4f: a track ID that does not resolve names no track in the connection window. A window overflow refuses
    // before this with outside-limit.
    if (error.address.kind === 'track') {
      return { code: 'absent', message: 'The trackId does not name a track that this connection can see. Use '
        + 'list_tracks.' };
    }
    return { code: 'authority-unavailable', message: 'The fresh host read did not complete.',
      retryWhen: 'once; then check the connection' };
  }
  if (error instanceof ChangesetNotFoundError) {
    return { code: 'absent', message: 'This server process has no change with that ID. revert_change reverses only '
      + 'the changes in list_changes; an earlier edit or a person\'s edit is for Bitwig undo.' };
  }
  if (error instanceof EmptySliceError) {
    return { code: 'invalid-input', message: 'The change touched nothing inside the named scope.' };
  }
  if (error instanceof ParameterValueUnrepresentableError) {
    return { code: 'range', message: 'The normalized value is not in the host-proved discrete domain of the '
      + 'control. Use one of the returned normalized values.' };
  }
  if (error instanceof UnprotectedWriteError) {
    return { code: 'unsupported', message: 'The write would replace state that cannot be recorded exactly first. '
      + 'Nothing was written.' };
  }
  if (error instanceof InvalidOpError) {
    return { code: 'invalid-input', message: `The host cannot represent the requested ${error.op} exactly. Nothing `
      + 'was written.' };
  }
  if (error instanceof ImportCollisionError) {
    return { code: 'collision', message: 'Two host notes normalize to the same channel, pitch, and 1/512-beat cell.' };
  }
  if (error instanceof BindingRefusal) {
    return { code: 'unavailable', message: `A host value has no portable mapping (${error.code}).` };
  }
  if (error instanceof DocumentError) {
    return { code: error.rule === 'R28' ? 'outside-limit' : 'unavailable',
      message: `The host state is not a valid document (${error.rule}).` };
  }
  if (error instanceof StaleExtensionError || error instanceof ContractVersionError
      || error instanceof WireDriftError || error instanceof RuntimeProfileMismatchError) {
    return { code: 'unhealthy', message: 'The loaded Bitwig extension does not match this Ghostnote build.' };
  }
  if (error instanceof BridgeError) {
    return { code: 'authority-unavailable', message: 'The Bitwig extension did not complete the read.',
      retryWhen: 'once; then check the connection' };
  }
  if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
    return { code: 'absent', message: 'The named file does not exist.' };
  }
  return { code: 'internal', message: 'Ghostnote failed for an unexpected reason.' };
}

/** Build the failure envelope. The underlying text stays in `diagnostic`. */
export function failureResult(
  schema: string,
  stage: FailureStage,
  error: unknown,
  target?: Readonly<Record<string, unknown>>,
): FailureResult {
  const classified = classifyError(error);
  const failure = error instanceof ToolFailure ? error : undefined;
  const cause = failure?.extra.cause ?? (failure === undefined ? error : undefined);
  return {
    schema,
    failure: {
      code: classified.code,
      stage: failure?.stage ?? stage,
      effects: failure?.extra.effects ?? [],
    },
    message: classified.message,
    ...(classified.retryWhen === undefined ? {} : { retryWhen: classified.retryWhen }),
    ...(target === undefined ? {} : { target }),
    ...(failure?.extra.detail === undefined ? {} : { detail: failure.extra.detail }),
    ...(cause === undefined ? {} : {
      diagnostic: {
        error: cause instanceof Error ? cause.message : String(cause),
        type: cause instanceof Error ? cause.name : typeof cause,
      },
    }),
  };
}

export function isFailureResult(value: unknown): value is FailureResult {
  return value !== null && typeof value === 'object' && 'failure' in value;
}
