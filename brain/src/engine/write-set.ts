/**
 * The write-set — the pivot the whole design turns on.
 *
 * §8b's claim is that a patch has a KNOWN write-set before it executes. This
 * module is what makes that true: every `Op` variant maps to the addresses it
 * touches, and `assertNever` turns a Phase-4/5 variant added without a mapping
 * into a COMPILE error rather than a silent gap in a snapshot. A missing entry
 * here is not a missing feature — it is a take that quietly cannot restore
 * something it claimed to cover.
 *
 * Two things the naive version gets wrong, both recorded as decisions:
 *
 *   1. **Granularity for notes is the WHOLE CLIP.** Reads and writes address one
 *      MIDI channel, but the only clear operation clears all channels. A safe
 *      inverse must therefore capture every channel before any note change.
 *   2. **Some ops have no restorable prior state at all**, and they split into
 *      two kinds. `track.delete` HAS an address whose stash is meaningless
 *      (a recreated track mints a new `channelId`, E2f) — that is a target with
 *      `restore: 'none'`. `track.create` has no prior address whatsoever — that
 *      is an `UnrevertableOp`. Both must reach the take, because D5's rule is
 *      that a revert never silently under-delivers, and silence is exactly what
 *      dropping them on the floor would produce.
 */
import {
  ADDRESS_IDENTITY, OP_BUMPS_SCENE_EPOCH, addressKey, assertNever, clip as clipAt,
  clipLaunch, notes as notesAt,
  type Address, type AddressKey, type Op, type OpKind,
} from '../contract/index.js';

/**
 * Can a stash of this address put it back?
 *
 *   replay — the captured state IS the restore instruction. What the value can
 *            promise is a separate question, answered per-property in
 *            `fidelity.ts`; this only says an inverse EXISTS.
 *   none   — the op that touched it mints or destroys identity, so no readback
 *            could reproduce the prior world (E3, D8's "low / none" row).
 */
export type Restore = 'replay' | 'none';

export interface WriteTarget {
  readonly address: Address;
  /** Canonical form — the key the stash, the diff and session 2's slicing share. */
  readonly key: AddressKey;
  /** Which ops in the patch touch it, by index into the CALLER's op list. */
  readonly opIndices: readonly number[];
  readonly restore: Restore;
  /** Always set when `restore` is `'none'`. Carried verbatim into the take. */
  readonly reason?: string;
  /** Op-shaped public label when the address kind alone would be ambiguous. */
  readonly unrestoredAs?: string;
}

/**
 * An op with no prior state to stash at all — distinct from a target that
 * cannot be restored, because there is not even an address to hang the failure
 * off. Reported so a revert can say what it did not attempt.
 */
export interface UnrevertableOp {
  readonly opIndex: number;
  readonly op: OpKind;
  readonly why: string;
  /** Public failure label when the internal op name is mechanism-shaped. */
  readonly unrestoredAs?: string;
}

export interface WriteSet {
  readonly targets: readonly WriteTarget[];
  readonly unrevertable: readonly UnrevertableOp[];
}

const NO_TRACK_IDENTITY =
  'a track cannot be un-deleted: `channelId` is minted fresh on create, so a recreated ' +
  'track is a DIFFERENT track and this stash can never be replayed onto it (E2f, D6).';

const NO_SCENE_READBACK =
  'scene deletion COMPACTS the rows below it (E3); the prior layout has no readback, and ' +
  'every scene-relative address minted before it is refused rather than resolved.';

const NO_DEVICE_READBACK =
  'a device insert/delete has no readback that could reproduce the chain (E3, D8). Phase 5 ' +
  'authors devices by file surgery, which is where an inverse could come from.';

/** One op -> the addresses it touches, with what a stash of each could promise. */
function targetsOf(op: Op): {
  address: Address;
  restore: Restore;
  reason?: string;
  unrestoredAs?: string;
}[] {
  const allClipChannels = (clip: ReturnType<typeof clipAt>) =>
    Array.from({ length: 16 }, (_, channel) => ({
      address: notesAt(clip, channel), restore: 'replay' as const,
    }));

  switch (op.op) {
    // A note restore must clear the complete clip because the host has no
    // channel-scoped clear. Protect all channels before any note change so the
    // inverse can reconstruct the complete clip without losing other channels.
    case 'note.write':
    case 'note.props':
    case 'note.clear':
      return allClipChannels(op.clip);

    // Creating a clip can land on an occupied slot, so the notes go in the
    // write-set too. `exists: false` in the stash is what makes the inverse
    // (delete it again) both available and exact — see `revert.ts`.
    case 'clip.create':
      return [
        { address: clipAt(op.slot), restore: 'replay' },
        ...allClipChannels(clipAt(op.slot)),
      ];

    // ⚠ AMENDED 2026-08-07 (D16, E16-OPEN-QUESTIONS §3.3.3). Both halves used to
    // be `none`, on the reason *"neither its length nor its content has a
    // readback that could reproduce it"* — and both halves of that were false as
    // the code stood. Content is stashed (all clip channels, above). Length
    // is readable: the live adapter was already reading `loopLength` to pick a
    // scan grid and simply never wrote it into the clip entry, while `StateValue`
    // declared `lengthBeats?` and the fake populated it — PHASE-0 §Risks' named
    // failure mode, sitting unexercised because nothing read the field.
    //
    // So the stash IS the restore instruction for both: `revert.ts` recreates the
    // clip at its captured length and replays the notes into it. What that cannot
    // put back is real and is REPORTED rather than hidden — name, colour, loop
    // start/end as distinct from length, launch settings, and automation lanes,
    // which have no readback in our surface at all (`fidelity.ts`, `valueCaveats`).
    // Recorded so a later session does not mistake a stash gap for an API wall.
    case 'clip.delete':
      return [
        { address: clipAt(op.slot), restore: 'replay' },
        ...allClipChannels(clipAt(op.slot)),
      ];

    // The destination was verified empty before the host's copy call. Its
    // absence is an exact stash value, so the inverse is the same exact
    // clip.delete used for clip.create.
    case 'clip.duplicate':
      return [
        { address: clipAt(op.destination), restore: 'replay' },
        ...allClipChannels(clipAt(op.destination)),
      ];

    // Moving preserves opaque clip state, but positional clip identity cannot
    // prove that a later occupant is the object we moved. The operation is
    // mechanically reversible by moving it back; automatic reversal declines.
    case 'clip.move':
      return [
        { address: clipAt(op.source.slot), restore: 'none', reason: 'clip relocation preserves the object, but clips have no identity with which to prove a later reverse move targets the same object' },
        { address: clipAt(op.destination), restore: 'none', reason: 'the destination is positional and a later occupant cannot be identified as the moved clip' },
      ];

    case 'clip.launchSettings':
      return [{ address: clipLaunch(op.clip), restore: 'replay' }];

    // Launching is transient playback control, not a project edit to restore.
    case 'clip.launch':
      return [];

    case 'track.rename':
      return [{ address: op.track, restore: 'replay' }];

    case 'track.delete':
      return [{ address: op.track, restore: 'none', reason: NO_TRACK_IDENTITY }];

    case 'scene.delete':
      return [{ address: op.scene, restore: 'none', reason: NO_SCENE_READBACK }];

    case 'device.delete':
      return [{ address: op.device, restore: 'none', reason: NO_DEVICE_READBACK }];

    case 'param.set':
      return [{ address: op.param, restore: 'replay' }];

    // No prior address exists for these.
    //
    // `track.create` and `scene.create` reach the take through `unrevertableOf`.
    // ⚠ `device.insert` no longer does (D16 amendment 2): its inverse needs no
    // prior state at all, only the chain index the insert actually produced,
    // which the receipt MINTS the way `track.create`'s channelId is minted (E2c —
    // read back what was created, never assume a requested position). `revert.ts`
    // materialises the `device.delete` from that mint.
    // ⚠ `chain.create` is here for the `track.create` reason and NOT for the
    // `device.insert` reason, and the difference is the whole of its entry in
    // `unrevertableOf` below: there is no prior address, and unlike an inserted
    // device there is also no inverse to materialise from the mint. A chain has
    // no typed delete at all (`e17al`, `e17am`).
    case 'track.create':
    case 'track.duplicate':
    case 'scene.create':
    case 'device.insert':
    case 'chain.create':
    case 'chain.rename':
    case 'chain.relocate':
    case 'device.relocate':
    case 'chain.activate':
    case 'notify':
      return [];

    default:
      // ⚠ THE POINT OF THIS FILE. A Phase-4/5 variant added without a mapping
      // fails to compile here, instead of shipping a take with a hole in it.
      return assertNever(op, 'writeTargets');
  }
}

/**
 * Ops that change the world but have no prior address to stash AND no inverse.
 *
 * ⚠ Both halves matter, and getting the second one wrong is what the D16
 * amendment fixed. `device.insert` used to be filed here under
 * `NO_DEVICE_READBACK` — a reason written about the DELETE direction — even
 * though a device that did not exist has the same exact inverse a clip that did
 * not exist has: delete it again (D16d). With that corrected this list is
 * contains the creates we deliberately will not auto-delete: `track.create` has
 * nothing to restore, `track.duplicate` may receive human edits immediately,
 * and `scene.create` is not track-scoped (E16-OPEN-QUESTIONS §3.3.5). That is
 * also why the fidelity floor deliberately does not read it — see `floor.ts`.
 */
function unrevertableOf(op: Op, opIndex: number): UnrevertableOp | undefined {
  switch (op.op) {
    case 'track.create':
    case 'track.duplicate':
      return {
        opIndex, op: op.op,
        ...(op.op === 'track.duplicate' ? { unrestoredAs: 'copied track' } : {}),
        why:
          'the track did not exist, so there is nothing to restore; and deleting it again is ' +
          'NOT offered, because the receipt\'s minted id is the only proof it was ours and a ' +
          'human may already have put work in it (E2c, D5 "a revert never silently ' +
          'under-delivers" cuts both ways).',
      };
    case 'scene.create':
      return { opIndex, op: op.op, why: NO_SCENE_READBACK };
    // ⚠⚠ Unrevertable for a MEASURED reason rather than a policy one, which is
    // what separates it from the three above. `track.create` could be undone and
    // deliberately is not; this one CANNOT be. Both `DeleteableObject` forms were
    // tried on a `DeviceLayer`, each with the selection precondition that
    // unlocked creation, each bracketed by a `Track` sibling deleting in the same
    // run — `deleteObject()` ○ and `deleteObjectAction().invoke()` ○ against
    // `Track.deleteObject()` ● (`e17al`, `e17am`). A `DeviceLayer` honours the
    // verbs `Channel` declares itself and declines the ones it merely inherits,
    // which is a mechanism, not a gap waiting to be filled by a better call.
    case 'chain.create':
      return {
        opIndex, op: op.op, unrestoredAs: 'added alternate',
        why:
          'the chain did not exist, and no measured typed route removes one: both DeleteableObject '
          + 'forms refuse on a DeviceLayer while the same inherited call deletes a Track in the '
          + 'same run (e17al, e17am). Reduction is a different operation — move the devices out '
          + 'and delete the container — so automatic reversal leaves this chain standing.',
      };
    case 'chain.rename':
      return {
        opIndex, op: op.op, unrestoredAs: 'renamed device alternate',
        why:
          'the old name stops resolving as soon as it changes, so automatic reversal cannot prove '
          + 'that a later rename still addresses the same entry. The new name remains.',
      };
    case 'chain.relocate':
      return {
        opIndex, op: op.op, unrestoredAs: `${op.mode === 'copy' ? 'copied' : 'moved'} device`,
        why:
          'device addresses are positional and a relocation re-indexes at least one device chain, '
          + 'so a later occupant cannot be proved to be the object this operation moved or copied. '
          + 'Use a directed relocation for cleanup; automatic reversal declines.',
      };
    case 'device.relocate':
      return {
        opIndex, op: op.op, unrestoredAs: 'moved device',
        why:
          'device addresses are positional and this move re-indexes the top-level device order, '
          + 'so a later occupant cannot be proved to be the object that moved. Directed cleanup '
          + 'does not guess an automatic reverse move.',
      };
    case 'chain.activate':
      return {
        opIndex, op: op.op, unrestoredAs: 'active device alternate',
        why:
          'switching changes the addressed alternate and every sibling in its container, while '
          + 'the static write record cannot name that sibling set. The final state is proved by '
          + 'complete container readback, but automatic reversal does not guess the prior one.',
      };
    // `notify` mutates nothing; its absence here is a positive statement. So is
    // `device.insert`'s, as of the D16 amendment — see this function's header.
    default:
      return undefined;
  }
}

/**
 * The write-set of a patch: every address it touches, deduplicated, in the order
 * the ops first mention them.
 *
 * Merging is PESSIMISTIC — if any op that touches an address cannot be reverted,
 * the target is `none` for all of them. A batch that writes notes and then
 * deletes the clip they live in has not left a restorable note address behind,
 * and claiming otherwise is the failure mode this whole module exists to avoid.
 */
export function writeSetOf(ops: readonly Op[]): WriteSet {
  const byKey = new Map<AddressKey, {
    address: Address;
    opIndices: number[];
    restore: Restore;
    reason?: string;
    unrestoredAs?: string;
  }>();
  const unrevertable: UnrevertableOp[] = [];

  ops.forEach((op, opIndex) => {
    const un = unrevertableOf(op, opIndex);
    if (un !== undefined) unrevertable.push(un);

    for (const t of targetsOf(op)) {
      const key = addressKey(t.address);
      const existing = byKey.get(key);
      if (existing === undefined) {
        byKey.set(key, {
          address: t.address,
          opIndices: [opIndex],
          restore: t.restore,
          ...(t.reason === undefined ? {} : { reason: t.reason }),
          ...(t.unrestoredAs === undefined ? {} : { unrestoredAs: t.unrestoredAs }),
        });
        continue;
      }
      existing.opIndices.push(opIndex);
      if (t.restore === 'none' && existing.restore !== 'none') {
        existing.restore = 'none';
        existing.reason = t.reason;
        existing.unrestoredAs = t.unrestoredAs;
      }
    }
  });

  const targets: WriteTarget[] = [...byKey.entries()].map(([key, v]) => ({
    address: v.address,
    key,
    opIndices: v.opIndices,
    restore: v.restore,
    ...(v.reason === undefined ? {} : { reason: v.reason }),
    ...(v.unrestoredAs === undefined ? {} : { unrestoredAs: v.unrestoredAs }),
  }));
  return { targets, unrevertable };
}

/** The addresses alone — what `resolve` and `read` are handed (§8b). */
export function writeSet(ops: readonly Op[]): Address[] {
  return writeSetOf(ops).targets.map((t) => t.address);
}

/**
 * Which structural hazards this patch contains, so a positional address can be
 * degraded for the RIGHT reason rather than blanket-degraded.
 *
 * `ADDRESS_IDENTITY` says everything except `track` is positional (E2f), but
 * "positional" only costs fidelity when something in the same batch can MOVE it.
 * Scene create/delete compacts rows (E3); device chain edits re-index the chain
 * (E3). A track create or delete moves bank indices, which we never store — the
 * durable `channelId` is what a take holds — so it degrades nothing.
 */
export interface StructuralRisk {
  readonly scenes: boolean;
  readonly deviceChains: boolean;
}

export function structuralRisk(ops: readonly Op[]): StructuralRisk {
  return {
    // ⚠ `chain.create` is deliberately absent from BOTH rows below, and the
    // absence is a positive statement. It adds a chain to a container's layer
    // bank: the track's own device chain does not move, so no top-level device
    // address shifts; and a chain is addressed by NAME inside a container
    // position that does not shift either, so no chain-family address shifts.
    // What DOES move is a chain's bank index, and no address holds one.
    // ⚠ Read from the contract's own set rather than re-listing the ops here.
    // The literal was duplicated, and the copy that mattered — the live adapter's
    // self-bumping scene counter — was deleted in session 3 when the epoch moved
    // into the extension. A second copy left behind is how the two drift.
    scenes: ops.some((o) => OP_BUMPS_SCENE_EPOCH.has(o.op)),
    deviceChains: ops.some((o) =>
      o.op === 'device.insert' || o.op === 'device.delete'
      || o.op === 'device.relocate' || o.op === 'chain.relocate'),
  };
}

/** Does `risk` threaten this address's position? Gated on `ADDRESS_IDENTITY`. */
export function isAtRisk(address: Address, risk: StructuralRisk): boolean {
  if (ADDRESS_IDENTITY[address.kind] === 'durable') return false;
  switch (address.kind) {
    case 'scene':
    case 'slot':
    case 'clip':
    case 'clipLaunch':
    case 'clipPlay':
    case 'notes':
      return risk.scenes;
    // ⚠ A chain is at risk for the same reason its devices are: it is addressed
    // through a container POSITION, and a device-chain edit re-indexes that (E3).
    // The durable name inside the address does not rescue it.
    case 'chain':
    case 'device':
    case 'param':
      return risk.deviceChains;
    default:
      return false;
  }
}
