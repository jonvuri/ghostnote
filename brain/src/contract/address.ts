/**
 * Addressing — standing rule 2: address by identity, never by index.
 *
 * Exactly one durable key exists in Bitwig, and it is `Channel.channelId()` (a
 * UUID). E2f proved it survives index shifts, renames, deletion (a deleted track
 * resolves `found:false` — a clean tombstone, never an alias) and a full
 * save → quit → reopen cycle; a delete-and-recreate mints a NEW one, which is
 * the correct semantics for identity.
 *
 * Everything else is positional, and this module says so out loud rather than
 * pretending otherwise. `ADDRESS_IDENTITY` is what lets Phase 1 derive a take's
 * fidelity label from its write-set instead of remembering to attach one (D5:
 * "a revert never silently under-delivers").
 *
 * ⚠ Scenes carry an `epoch`. Deleting a scene COMPACTS the rows below it upward,
 * and a pinned cursor's `sceneIndex()` then goes PERMANENTLY stale — it read 10
 * for 3.1s while the clip was really at row 9, with everything else about the pin
 * still perfectly healthy (E3). An index alone therefore cannot be trusted across
 * a structural op, so every scene-derived address carries the epoch it was minted
 * in and `resolve()` REFUSES a stale one. The trap becomes a refusal instead of a
 * silent wrong write.
 *
 * ⚠ That guarantee is only as good as the adapter's knowledge of scene ops. In
 * v0 `LiveAdapter` counts its own and cannot see the user's — see the ⚠ on
 * `LiveAdapter.sceneEpoch`. Closing it needs the daemon's observers (D4, P1).
 */

export interface TrackAddress {
  readonly kind: 'track';
  /** `Channel.channelId()` — the only durable key in the model (E2f). */
  readonly channelId: string;
}

export interface SceneAddress {
  readonly kind: 'scene';
  readonly index: number;
  /** Bumped by any scene create/delete; a stale epoch is refused, not resolved (E3). */
  readonly epoch: number;
}

export interface SlotAddress {
  readonly kind: 'slot';
  readonly track: TrackAddress;
  readonly scene: SceneAddress;
}

export interface ClipAddress {
  readonly kind: 'clip';
  readonly slot: SlotAddress;
}

/** Beats, always. The step grid is a per-operation view, never global state (E2). */
export interface BeatRange {
  readonly startBeats: number;
  readonly endBeats: number;
}

export interface NotesAddress {
  readonly kind: 'notes';
  readonly clip: ClipAddress;
  readonly channel: number;
  /** Absent means the whole clip. */
  readonly range?: BeatRange;
}

export interface DeviceAddress {
  readonly kind: 'device';
  readonly track: TrackAddress;
  /**
   * Position in the track's device chain. Positional and fragile: the chain
   * RE-INDEXES on delete, exactly like tracks (E3) — deleting device[0] shifts
   * the survivor from 1 to 0. Re-resolve after any chain edit.
   */
  readonly chainIndex: number;
}

export interface ParamAddress {
  readonly kind: 'param';
  readonly device: DeviceAddress;
  readonly index: number;
  /**
   * When present this is a DirectParameter id, which is a different API with a
   * different trap (E4b: `resolution=1` or the write silently does nothing) and
   * is the only path that works for CLAP plugins.
   */
  readonly directId?: string;
}

export type Address =
  | TrackAddress
  | SceneAddress
  | SlotAddress
  | ClipAddress
  | NotesAddress
  | DeviceAddress
  | ParamAddress;

export type AddressKind = Address['kind'];

/**
 * Whether an address kind is anchored to a durable identity or to a position.
 * Phase 1 reads this to label take fidelity; a `positional` entry cannot promise
 * a lossless revert across a structural op.
 */
export const ADDRESS_IDENTITY: Record<AddressKind, 'durable' | 'positional'> = {
  track: 'durable',
  scene: 'positional',
  slot: 'positional',
  clip: 'positional',
  notes: 'positional',
  device: 'positional',
  param: 'positional',
};

/** Canonical string form, for write-set diffing and partial-revert slicing. */
export type AddressKey = string;

export function addressKey(a: Address): AddressKey {
  switch (a.kind) {
    case 'track':
      return `track:${a.channelId}`;
    case 'scene':
      return `scene:${a.index}@${a.epoch}`;
    case 'slot':
      return `slot:${a.track.channelId}:${a.scene.index}@${a.scene.epoch}`;
    case 'clip':
      return `clip:${a.slot.track.channelId}:${a.slot.scene.index}@${a.slot.scene.epoch}`;
    case 'notes': {
      const clip = `${a.clip.slot.track.channelId}:${a.clip.slot.scene.index}@${a.clip.slot.scene.epoch}`;
      const range = a.range ? `:${a.range.startBeats}-${a.range.endBeats}` : '';
      return `notes:${clip}:ch${a.channel}${range}`;
    }
    case 'device':
      return `device:${a.track.channelId}:${a.chainIndex}`;
    case 'param':
      return `param:${a.device.track.channelId}:${a.device.chainIndex}:${a.directId ?? a.index}`;
  }
}

/**
 * The track every address ultimately hangs off — the durable part of any
 * address, and what the resolver actually looks up. Scenes are the one kind with
 * no track, because a scene spans all of them.
 */
export function addressTrack(a: Address): TrackAddress | undefined {
  switch (a.kind) {
    case 'track':
      return a;
    case 'scene':
      return undefined;
    case 'slot':
      return a.track;
    case 'clip':
      return a.slot.track;
    case 'notes':
      return a.clip.slot.track;
    case 'device':
      return a.track;
    case 'param':
      return a.device.track;
  }
}

/** The scene an address depends on, if any — i.e. what a compaction would stale. */
export function addressScene(a: Address): SceneAddress | undefined {
  switch (a.kind) {
    case 'scene':
      return a;
    case 'slot':
      return a.scene;
    case 'clip':
      return a.slot.scene;
    case 'notes':
      return a.clip.slot.scene;
    default:
      return undefined;
  }
}

// --- constructors: the only sanctioned way to build an address ---------------

export const track = (channelId: string): TrackAddress => ({ kind: 'track', channelId });

export const scene = (index: number, epoch: number): SceneAddress => ({ kind: 'scene', index, epoch });

export const slot = (t: TrackAddress, s: SceneAddress): SlotAddress => ({ kind: 'slot', track: t, scene: s });

export const clip = (s: SlotAddress): ClipAddress => ({ kind: 'clip', slot: s });

export const notes = (c: ClipAddress, channel = 0, range?: BeatRange): NotesAddress =>
  range === undefined ? { kind: 'notes', clip: c, channel } : { kind: 'notes', clip: c, channel, range };

export const device = (t: TrackAddress, chainIndex: number): DeviceAddress => ({
  kind: 'device',
  track: t,
  chainIndex,
});

export const param = (d: DeviceAddress, index: number, directId?: string): ParamAddress =>
  directId === undefined ? { kind: 'param', device: d, index } : { kind: 'param', device: d, index, directId };
