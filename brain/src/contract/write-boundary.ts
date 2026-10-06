/**
 * 8h4a write boundary: the scene guard at the apply and the group-slot refusal.
 *
 * Both adapters call these functions, so the live and the fake rule cannot
 * drift. The live extension makes the same scene-guard comparison in
 * `batch.run` on the controller thread.
 */
import { addressScene, addressTrack, clip as clipAt, type Address, type SceneAddress } from './address.js';
import { ContractError, StaleAddressError } from './errors.js';
import { launcherSlotsOf, sceneRowsOf, type Op } from './ops.js';
import type { RevisionMark } from './snapshot.js';
import type { TrackState } from './state.js';

/**
 * The part of a mark that a scene-relative address depends on.
 *
 * `batch.run` compares it before the first operation. A mismatch applies no
 * operation. `ifRevision` counts only Ghostnote writes, so it cannot see a
 * human scene insert or delete. This guard can (E233).
 */
export interface SceneGuard {
  readonly generation: string;
  readonly project: string;
  readonly sceneEpoch: number;
}

export type SceneGuardField = 'generation' | 'project' | 'sceneEpoch';

export function sceneGuardOf(mark: Pick<RevisionMark, 'generation' | 'project' | 'sceneEpoch'>): SceneGuard {
  return { generation: mark.generation, project: mark.project, sceneEpoch: mark.sceneEpoch };
}

/**
 * The first field that fails, or `undefined`. The rule is the rule of the
 * guarded `slot.launchWithOptions`: an empty current project fails closed.
 */
export function sceneGuardMismatch(guard: SceneGuard, now: SceneGuard): SceneGuardField | undefined {
  if (guard.generation !== now.generation) return 'generation';
  if (now.project === '' || guard.project !== now.project) return 'project';
  if (guard.sceneEpoch !== now.sceneEpoch) return 'sceneEpoch';
  return undefined;
}

/** True when an op in the batch puts a launcher row on the wire. */
export function opsHaveSceneRows(ops: readonly Op[]): boolean {
  return ops.some((op) => sceneRowsOf(op).length > 0);
}

/** The typed refusal of a failed scene guard. It names the first scene-relative address of the batch. */
export function sceneGuardError(
  ops: readonly Op[],
  guard: SceneGuard,
  field: SceneGuardField,
  actualSceneEpoch: number,
): StaleAddressError {
  const row: SceneAddress = ops.flatMap(sceneRowsOf)[0] ?? { kind: 'scene', index: 0, epoch: guard.sceneEpoch };
  const why = field === 'project' ? 'project-changed' : field === 'generation' ? 'extension-restarted' : undefined;
  return new StaleAddressError(row, guard.sceneEpoch, actualSceneEpoch, why);
}

/** Bitwig's `trackType` value for a group track. */
export const GROUP_TRACK_TYPE = 'Group';

export function isGroupTrack(track: Pick<TrackState, 'type'>): boolean {
  return track.type === GROUP_TRACK_TYPE;
}

/**
 * A clip read, write, snapshot, or check that names a launcher slot of a group
 * track.
 *
 * A group track's own slots mirror the occupancy of its child tracks (E222).
 * They are not clips that Ghostnote can read or write. Address a child track
 * by its `channelId`. The flat product track list does not hold group
 * membership, so the refusal names no child. The bank lists the children of a
 * collapsed group under the `ALL_CHANNELS` content filter (D33).
 */
export class GroupSlotError extends ContractError {
  readonly reason = 'group-slot' as const;
  constructor(readonly address: Address, readonly track: { readonly channelId: string; readonly name?: string }) {
    super(
      `group-slot: track ${track.name === undefined ? '' : `"${track.name}" `}(${track.channelId}) is a group `
        + 'track. Its launcher slots mirror '
        + 'the clips of its child tracks and are not clips. Address a child track by its trackId instead; '
        + 'a child of a collapsed group stays addressable.',
    );
  }
}

/** Refuse the first slot-bearing address on a group track. `trackOf` answers from the current track list. */
export function assertNoGroupSlotAddresses(
  addresses: readonly Address[],
  trackOf: (channelId: string) => TrackState | undefined,
): void {
  for (const address of addresses) {
    if (addressScene(address) === undefined || address.kind === 'scene') continue;
    const ref = addressTrack(address);
    const found = ref === undefined ? undefined : trackOf(ref.channelId);
    if (found !== undefined && isGroupTrack(found)) throw new GroupSlotError(address, found);
  }
}

/** Refuse a batch that reads, writes, copies, moves, or launches through a group track's own slot. */
export function assertNoGroupSlotOps(
  ops: readonly Op[],
  trackOf: (channelId: string) => TrackState | undefined,
): void {
  for (const op of ops) {
    for (const slot of launcherSlotsOf(op)) {
      const found = trackOf(slot.track.channelId);
      if (found !== undefined && isGroupTrack(found)) throw new GroupSlotError(clipAt(slot), found);
    }
  }
}
