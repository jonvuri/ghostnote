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
 *
 * ⚠ ONE LEVEL DOWN THE RULE INVERTS. A device-layer chain also hands out a
 * `channelId`, and it is not a key: the project loader mints it afresh on every
 * document load while the chain's NAME survives (E17ad, E18b). `ChainAddress`
 * therefore addresses by name, and says why where it is declared.
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

export interface ClipLaunchAddress {
  readonly kind: 'clipLaunch';
  readonly clip: ClipAddress;
}

export interface ClipPlayAddress {
  readonly kind: 'clipPlay';
  readonly clip: ClipAddress;
}

/** Readable and writable launcher-clip container metadata (E43). */
export interface ClipMetadataAddress {
  readonly kind: 'clipMetadata';
  readonly clip: ClipAddress;
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
  /** Absent means the complete addressed MIDI channel. */
  readonly range?: BeatRange;
}

/**
 * One device-layer chain, inside the container device that holds it.
 *
 * ⚠⚠ **The name is the identifier, and that inverts D6 one level down.** A chain
 * IS a `Channel` and does hand out a `channelId` — and it is worthless as a key:
 * the project LOADER mints it, so it regenerates on every document load (E17ad
 * 8/8 changed with the track ids unchanged in the same read; E18b separated the
 * two reload kinds on one fixture and closed it). The NAME survived a content
 * change, a save and a restart in the same measurements. So for a track
 * `channelId` is the key and the name is the human tag; for a chain there is no
 * key and the tag is all there is.
 *
 * ⚠ A name is not unique BY CONSTRUCTION — nothing in Bitwig enforces it, and a
 * default name tracks the chain's content rather than naming it (E4c, corrected
 * by E17 row 5). Two consequences, both obligations on whoever resolves one:
 * chains this system creates are given explicit names, and a name matching more
 * than one chain must be REFUSED rather than resolved to the first hit. That is
 * the `e17n` artifact — a duplicate container has identical chain names and
 * different ids — turned into a rule instead of a hazard.
 *
 * ⚠ The container is addressed positionally, so the whole address is positional:
 * `ADDRESS_IDENTITY` says so, and a device-chain edit re-indexes it (E3).
 */
export interface ChainAddress {
  readonly kind: 'chain';
  /** The container device holding this chain — itself a position in a chain. */
  readonly container: DeviceAddress;
  /** The chain's name: durable where its `channelId` is not (E17 row 5, E18b). */
  readonly name: string;
}

/**
 * One drum-pad channel inside a Drum Machine container.
 *
 * The channel is the bank position passed to `selectFirstInChannel(pad)`. It is
 * not a MIDI key. E4d proved that `selectFirstInKeyPad` takes a key and silently
 * leaves the cursor on the container when it receives a pad index.
 */
export interface DrumPadAddress {
  readonly kind: 'drumPad';
  readonly container: DeviceAddress;
  readonly channel: number;
}

/** One named device-chain slot on a container, such as a Chain device's `CHAIN` slot. */
export interface DeviceSlotAddress {
  readonly kind: 'deviceSlot';
  readonly container: DeviceAddress;
  readonly name: string;
}

/** One measured parent route for a nested device. */
export type DeviceParentAddress = ChainAddress | DrumPadAddress | DeviceSlotAddress;

export interface DeviceAddress {
  readonly kind: 'device';
  /** The durable anchor every address hangs off, at any depth (E2f). */
  readonly track: TrackAddress;
  /**
   * Position in the device chain named by `chain`, or in the track's top-level
   * device chain when that is absent. Positional and fragile: a device-chain
   * delete re-indexes its survivors. Re-resolve after any chain edit.
   */
  readonly chainIndex: number;
  /**
   * ⚠ Absent means TOP LEVEL, and the two must never be conflated: `chainIndex`
   * alone is measured against a different list in each case, so a nested address
   * handed to a top-level route names a real device that nobody addressed. Every
   * write path that cannot yet reach inside a chain refuses on this field
   * (`assertDevicesRoutable`) instead of indexing past it.
   */
  readonly chain?: DeviceParentAddress;
}

/** The readable and writable enabled flag of one top-level device. */
export interface DeviceEnabledAddress {
  readonly kind: 'deviceEnabled';
  readonly device: DeviceAddress;
}

export interface ParamAddress {
  readonly kind: 'param';
  readonly device: DeviceAddress;
  /**
   * The primary general key. DirectParameter self-enumerates this id for native,
   * VST and CLAP devices (E4b).
   */
  readonly directId?: string;
  /**
   * A legacy typed-view position. It is present only when a specific device or
   * plugin view requires a numeric handle.
   */
  readonly index?: number;
}

/** Explicit remote-control inventory for one confirmed device target. */
export interface RemotesAddress {
  readonly kind: 'remotes';
  readonly device: DeviceAddress;
}

/** One control on one confirmed remote-control page. */
export interface RemoteAddress {
  readonly kind: 'remote';
  readonly device: DeviceAddress;
  readonly pageIndex: number;
  readonly pageName: string;
  readonly controlIndex: number;
  readonly controlName: string;
}

export type Address =
  | TrackAddress
  | SceneAddress
  | SlotAddress
  | ClipAddress
  | ClipLaunchAddress
  | ClipPlayAddress
  | ClipMetadataAddress
  | NotesAddress
  | ChainAddress
  | DrumPadAddress
  | DeviceAddress
  | DeviceEnabledAddress
  | ParamAddress
  | RemotesAddress
  | RemoteAddress;

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
  clipLaunch: 'positional',
  clipPlay: 'positional',
  clipMetadata: 'positional',
  notes: 'positional',
  // ⚠ Positional despite the durable NAME in it: the container it hangs off is a
  // chain position, and a device-chain edit re-indexes that (E3). A take holding
  // one cannot promise a lossless revert across a structural op, which is exactly
  // what this table is read for.
  chain: 'positional',
  drumPad: 'positional',
  device: 'positional',
  deviceEnabled: 'positional',
  param: 'positional',
  remotes: 'positional',
  remote: 'positional',
};

/** Canonical string form, for write-set diffing and partial-revert slicing. */
export type AddressKey = string;

/**
 * The nesting path of a device or chain address, OUTERMOST FIRST. Empty for a
 * top-level device.
 *
 * Exported because refusals and resolution both need the depth and the names,
 * and walking `.chain` by hand at each call site is how one of them ends up
 * reading the path in the other order.
 */
export function chainPath(
  a: DeviceAddress | DeviceParentAddress,
): readonly DeviceParentAddress[] {
  const path: DeviceParentAddress[] = [];
  let step: DeviceParentAddress | undefined = a.kind === 'device' ? a.chain : a;
  while (step !== undefined) {
    path.unshift(step);
    step = step.container.chain;
  }
  return path;
}

/** Is this device below any container parent rather than on the track itself? */
export const isNestedDevice = (a: DeviceAddress): boolean => a.chain !== undefined;

/**
 * ⚠ A chain or slot name goes into a key escaped. The escape makes the key
 * unambiguous rather than only readable.
 *
 * The grammar's delimiters are `:` and `/`, and `encodeURIComponent` escapes both
 * (plus space). Unescaped they would be forgeable: a chain named `A/0/B` holding
 * device 5 spells the same string as chain `A` -> device 0 -> chain `B` ->
 * device 5 — two different devices in two different places, sharing one key in
 * the map the stash is indexed by and the partial-revert slice matches prefixes
 * against. `address.test.ts` asserts that exact pair.
 *
 * ⚠ It buys uniqueness, not prefix-safety: `chain:…/A%20b` is still a string
 * prefix of `chain:…/A%20bc`, the same weakness a flat `device:cid:1` has against
 * `device:cid:10`. A caller selecting structurally should build its slice from
 * addresses, the way `selectClip` does, rather than writing prefixes by hand.
 */
const encodeChainName = (name: string): string => encodeURIComponent(name);

/**
 * The body a device key, a chain key and a param key all share.
 *
 * ⚠ A TOP-LEVEL device produces exactly the string it always has,
 * `channelId:chainIndex`, and every nested form appends `/`-separated steps that
 * a top-level key can never contain. That is what lets nesting arrive without
 * re-keying a single existing stash entry, take target or slice prefix.
 */
function deviceBody(a: DeviceAddress): string {
  return a.chain === undefined
    ? `${a.track.channelId}:${a.chainIndex}`
    : `${parentBody(a.chain)}/${a.chainIndex}`;
}

function chainBody(a: ChainAddress): string {
  return `${deviceBody(a.container)}/${encodeChainName(a.name)}`;
}

function drumPadBody(a: DrumPadAddress): string {
  return `${deviceBody(a.container)}/pad-${a.channel}`;
}

function deviceSlotBody(a: DeviceSlotAddress): string {
  // The raw `:` separates this scope from a chain name. A chain name must pass
  // through `encodeChainName()`, so `slot:CHAIN` becomes `slot%3ACHAIN`.
  return `${deviceBody(a.container)}/slot:${encodeChainName(a.name)}`;
}

function parentBody(a: DeviceParentAddress): string {
  switch (a.kind) {
    case 'chain': return chainBody(a);
    case 'drumPad': return drumPadBody(a);
    case 'deviceSlot': return deviceSlotBody(a);
  }
}

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
    case 'clipLaunch':
      return `clipLaunch:${a.clip.slot.track.channelId}:${a.clip.slot.scene.index}@${a.clip.slot.scene.epoch}`;
    case 'clipPlay':
      return `clipPlay:${a.clip.slot.track.channelId}:${a.clip.slot.scene.index}@${a.clip.slot.scene.epoch}`;
    case 'clipMetadata':
      return `clipMetadata:${a.clip.slot.track.channelId}:${a.clip.slot.scene.index}@${a.clip.slot.scene.epoch}`;
    case 'notes': {
      const clip = `${a.clip.slot.track.channelId}:${a.clip.slot.scene.index}@${a.clip.slot.scene.epoch}`;
      const range = a.range ? `:${a.range.startBeats}-${a.range.endBeats}` : '';
      return `notes:${clip}:ch${a.channel}${range}`;
    }
    case 'chain':
      return `chain:${chainBody(a)}`;
    case 'drumPad':
      return `drumPad:${drumPadBody(a)}`;
    case 'device':
      return `device:${deviceBody(a)}`;
    case 'deviceEnabled':
      return `deviceEnabled:${deviceBody(a.device)}`;
    case 'param': {
      // A DirectParameter id is a string and can contain a numeric value such as
      // "0". Keep it outside the typed-index namespace before maps deduplicate
      // write targets and stash entries.
      const key = a.directId === undefined
        ? String(a.index)
        : `direct:${encodeURIComponent(a.directId)}`;
      return `param:${deviceBody(a.device)}:${key}`;
    }
    case 'remotes':
      return `remotes:${deviceBody(a.device)}`;
    case 'remote':
      return `remote:${deviceBody(a.device)}:${a.pageIndex}:${encodeURIComponent(a.pageName)}`
        + `:${a.controlIndex}:${encodeURIComponent(a.controlName)}`;
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
    case 'clipLaunch':
    case 'clipPlay':
    case 'clipMetadata':
      return a.clip.slot.track;
    case 'notes':
      return a.clip.slot.track;
    // ⚠ The track is carried on every device address, at every depth, rather than
    // being walked out of the nesting path — so the durable anchor of a device
    // five layers down costs the same lookup as one on the track itself.
    case 'chain':
      return a.container.track;
    case 'drumPad':
      return a.container.track;
    case 'device':
      return a.track;
    case 'deviceEnabled':
      return a.device.track;
    case 'param':
      return a.device.track;
    case 'remotes':
    case 'remote':
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
    case 'clipLaunch':
    case 'clipPlay':
    case 'clipMetadata':
      return a.clip.slot.scene;
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

export const clipLaunch = (c: ClipAddress): ClipLaunchAddress => ({ kind: 'clipLaunch', clip: c });

export const clipMetadata = (c: ClipAddress): ClipMetadataAddress => ({ kind: 'clipMetadata', clip: c });

export const clipPlay = (c: ClipAddress): ClipPlayAddress => ({ kind: 'clipPlay', clip: c });

export const notes = (c: ClipAddress, channel = 0, range?: BeatRange): NotesAddress =>
  range === undefined ? { kind: 'notes', clip: c, channel } : { kind: 'notes', clip: c, channel, range };

export const device = (t: TrackAddress, chainIndex: number): DeviceAddress => ({
  kind: 'device',
  track: t,
  chainIndex,
});

/** The enabled flag of one confirmed device. */
export const deviceEnabled = (d: DeviceAddress): DeviceEnabledAddress => ({
  kind: 'deviceEnabled',
  device: d,
});

/**
 * A named chain inside a container device.
 *
 * ⚠ An empty or blank name is REFUSED rather than accepted. The name is the only
 * durable thing about a chain (E17 row 5, E18b), so a blank one is not a weak
 * address — it is no address at all, and it would key as `chain:…:0/`, which every
 * other unnamed chain on that container would key as too.
 *
 * ⚠ A plain `Error` and not a `ContractError`: `errors.ts` imports this module,
 * and the cycle is not worth carrying for a constructor precondition that only a
 * programming mistake can reach.
 */
export const chain = (container: DeviceAddress, name: string): ChainAddress => {
  if (name.trim() === '') {
    throw new Error(
      'a chain address needs a non-empty name: a chain\'s channelId is minted fresh by every ' +
      'project load (E18b), so the name is its only durable identifier and a blank one ' +
      'identifies every unnamed chain on the container equally.',
    );
  }
  return { kind: 'chain', container, name };
};

/** A drum-pad channel. The value is a bank index, not a MIDI key. */
export const drumPad = (container: DeviceAddress, channel: number): DrumPadAddress => {
  if (!Number.isInteger(channel) || channel < 0) {
    throw new Error('a drum-pad channel must be a non-negative integer.');
  }
  return { kind: 'drumPad', container, channel };
};

/** A named device-chain slot. The cursor route selects the first device in it. */
export const deviceSlot = (container: DeviceAddress, name: string): DeviceSlotAddress => {
  if (name.trim() === '') throw new Error('a device-slot address needs a non-empty name.');
  return { kind: 'deviceSlot', container, name };
};

/**
 * A device inside a container parent.
 *
 * ⚠ The track is derived from the chain rather than taken as an argument, which
 * is what makes `address.track` and `address.chain.container.track` unable to
 * disagree. A hand-written object literal could still disagree; that is why this
 * module's header says the constructors are the only sanctioned way to build one.
 */
export const deviceIn = (c: DeviceParentAddress, chainIndex: number): DeviceAddress => ({
  kind: 'device',
  track: c.container.track,
  chainIndex,
  chain: c,
});

export function param(d: DeviceAddress, directId: string): ParamAddress;
export function param(d: DeviceAddress, index: number, directId?: string): ParamAddress;
export function param(d: DeviceAddress, key: number | string, directId?: string): ParamAddress {
  if (typeof key === 'string') return { kind: 'param', device: d, directId: key };
  return directId === undefined
    ? { kind: 'param', device: d, index: key }
    : { kind: 'param', device: d, index: key, directId };
}

export const remotes = (d: DeviceAddress): RemotesAddress => ({ kind: 'remotes', device: d });

export const remote = (
  d: DeviceAddress,
  pageIndex: number,
  pageName: string,
  controlIndex: number,
  controlName: string,
): RemoteAddress => ({
  kind: 'remote', device: d, pageIndex, pageName, controlIndex, controlName,
});
