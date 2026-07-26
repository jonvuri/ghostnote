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
 *   1. **Granularity for notes is the WHOLE CLIP CHANNEL**, never the written
 *      range, even when the op carries one. A write truncates same-pitch notes
 *      that sit outside it (E8-E), so a bounding-box stash would miss exactly
 *      the state the write is about to damage. It is also the shape session 2's
 *      partial revert wants to SLICE, and slicing a superset is possible where
 *      widening a subset is not.
 *   2. **Some ops have no restorable prior state at all**, and they split into
 *      two kinds. `track.delete` HAS an address whose stash is meaningless
 *      (a recreated track mints a new `channelId`, E2f) — that is a target with
 *      `restore: 'none'`. `track.create` has no prior address whatsoever — that
 *      is an `UnrevertableOp`. Both must reach the take, because D5's rule is
 *      that a revert never silently under-delivers, and silence is exactly what
 *      dropping them on the floor would produce.
 */
import {
  ADDRESS_IDENTITY, addressKey, assertNever, clip as clipAt, notes as notesAt,
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
}

export interface WriteSet {
  readonly targets: readonly WriteTarget[];
  readonly unrevertable: readonly UnrevertableOp[];
}

const NO_TRACK_IDENTITY =
  'a track cannot be un-deleted: `channelId` is minted fresh on create, so a recreated ' +
  'track is a DIFFERENT track and this stash can never be replayed onto it (E2f, D6).';

const NO_CLIP_READBACK =
  'a deleted clip cannot be recreated: neither its length nor its content has a readback ' +
  'that could reproduce it (E3, D8 "clip create-delete: low / none").';

const NO_SCENE_READBACK =
  'scene deletion COMPACTS the rows below it (E3); the prior layout has no readback, and ' +
  'every scene-relative address minted before it is refused rather than resolved.';

const NO_DEVICE_READBACK =
  'a device insert/delete has no readback that could reproduce the chain (E3, D8). Phase 5 ' +
  'authors devices by file surgery, which is where an inverse could come from.';

/** One op -> the addresses it touches, with what a stash of each could promise. */
function targetsOf(op: Op): { address: Address; restore: Restore; reason?: string }[] {
  switch (op.op) {
    // ⚠ Deliberately UNRANGED even when the op carries a range. See this file's
    // header: a write truncates same-pitch neighbours outside its own extent
    // (E8-E), so anything narrower than the whole channel stashes the wrong set.
    case 'note.write':
    case 'note.props':
    case 'note.clear':
      return [{ address: notesAt(op.clip, op.channel ?? 0), restore: 'replay' }];

    // Creating a clip can land on an occupied slot, so the notes go in the
    // write-set too. `exists: false` in the stash is what makes the inverse
    // (delete it again) both available and exact — see `revert.ts`.
    case 'clip.create':
      return [
        { address: clipAt(op.slot), restore: 'replay' },
        { address: notesAt(clipAt(op.slot), 0), restore: 'replay' },
      ];

    // ⚠ And the other direction is NOT symmetric. The notes are captured — they
    // are the record — but they cannot be replayed into a clip that no longer
    // exists, and pointing at the empty slot to try would land on the wrong clip
    // entirely (E2). Both halves are `none` so the revert reports rather than
    // attempts.
    case 'clip.delete':
      return [
        { address: clipAt(op.slot), restore: 'none', reason: NO_CLIP_READBACK },
        { address: notesAt(clipAt(op.slot), 0), restore: 'none', reason: NO_CLIP_READBACK },
      ];

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

    // No prior address exists for these — see `unrevertableOf`.
    case 'track.create':
    case 'scene.create':
    case 'device.insert':
    case 'notify':
      return [];

    default:
      // ⚠ THE POINT OF THIS FILE. A Phase-4/5 variant added without a mapping
      // fails to compile here, instead of shipping a take with a hole in it.
      return assertNever(op, 'writeTargets');
  }
}

/** Ops that change the world but have no prior address to stash. */
function unrevertableOf(op: Op, opIndex: number): UnrevertableOp | undefined {
  switch (op.op) {
    case 'track.create':
      return {
        opIndex, op: op.op,
        why:
          'the track did not exist, so there is nothing to restore; and deleting it again is ' +
          'NOT offered, because the receipt\'s minted id is the only proof it was ours and a ' +
          'human may already have put work in it (E2c, D5 "a revert never silently ' +
          'under-delivers" cuts both ways).',
      };
    case 'scene.create':
      return { opIndex, op: op.op, why: NO_SCENE_READBACK };
    case 'device.insert':
      return { opIndex, op: op.op, why: NO_DEVICE_READBACK };
    // `notify` mutates nothing; its absence here is a positive statement.
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
  const byKey = new Map<AddressKey, { address: Address; opIndices: number[]; restore: Restore; reason?: string }>();
  const unrevertable: UnrevertableOp[] = [];

  ops.forEach((op, opIndex) => {
    const un = unrevertableOf(op, opIndex);
    if (un !== undefined) unrevertable.push(un);

    for (const t of targetsOf(op)) {
      const key = addressKey(t.address);
      const existing = byKey.get(key);
      if (existing === undefined) {
        byKey.set(key, { address: t.address, opIndices: [opIndex], restore: t.restore, ...(t.reason === undefined ? {} : { reason: t.reason }) });
        continue;
      }
      existing.opIndices.push(opIndex);
      if (t.restore === 'none' && existing.restore !== 'none') {
        existing.restore = 'none';
        existing.reason = t.reason;
      }
    }
  });

  const targets: WriteTarget[] = [...byKey.entries()].map(([key, v]) => ({
    address: v.address,
    key,
    opIndices: v.opIndices,
    restore: v.restore,
    ...(v.reason === undefined ? {} : { reason: v.reason }),
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
    scenes: ops.some((o) => o.op === 'scene.create' || o.op === 'scene.delete'),
    deviceChains: ops.some((o) => o.op === 'device.insert' || o.op === 'device.delete'),
  };
}

/** Does `risk` threaten this address's position? Gated on `ADDRESS_IDENTITY`. */
export function isAtRisk(address: Address, risk: StructuralRisk): boolean {
  if (ADDRESS_IDENTITY[address.kind] === 'durable') return false;
  switch (address.kind) {
    case 'scene':
    case 'slot':
    case 'clip':
    case 'notes':
      return risk.scenes;
    case 'device':
    case 'param':
      return risk.deviceChains;
    default:
      return false;
  }
}
