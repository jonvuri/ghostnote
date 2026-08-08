/**
 * `LiveAdapter.read`, driven offline against a transport that MODELS THE CURSOR.
 *
 * The live adapter has had no offline harness at all: `encoder.test.ts` checks
 * the frames an op produces and `pool.ts` is tested as an allocator, but nothing
 * has ever run `read` end to end without a DAW. That gap is exactly where a
 * mispoint hides, because a mispoint does not throw — it returns another clip's
 * music with a healthy status (E2), and every layer above takes it at face value.
 *
 * ⚠ So the stub below tracks WHERE EACH CURSOR IS POINTED and answers from
 * whatever clip that cursor is really on, which is what Bitwig does. A test whose
 * stub answered from the address the adapter *asked about* could not fail for the
 * bug this file exists to catch: it would be asserting the adapter's own belief
 * back at it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addressKey, clip, notes as notesAt, scene, slot, track,
  type ClipAddress, type TrackAddress,
} from '../../contract/index.js';
import { LiveAdapter } from './adapter.js';
import type { Transport } from './transport.js';
import { WIRE, type Frame } from './wiremap.js';

const CHANNEL_ID = 'e4a1c0de-0000-4000-8000-000000000001';
const TRACK: TrackAddress = track(CHANNEL_ID);
const CLIP = (sceneIndex: number): ClipAddress => clip(slot(TRACK, scene(sceneIndex, 1)));

interface SlotModel {
  readonly lengthBeats: number;
  /** One note per clip, pitched so a mispoint is legible in the assertion. */
  readonly pitch: number;
}

/**
 * A Bitwig-shaped stub: slots hold music, cursors point at slots, and a read
 * through a cursor returns whatever that cursor is ON.
 */
class CursorModelTransport implements Transport {
  readonly frames: Frame[] = [];
  /** cursor ref -> the slot index it is currently pointed at. */
  private readonly cursorOn = new Map<string, number>();
  /** The cursor named by the last `cursor.pointTrack`, awaiting its `slot.select`. */
  private pending: string | undefined;

  constructor(private readonly slots: ReadonlyMap<number, SlotModel>) {}

  /** Where a given cursor ended up — for asserting the point actually happened. */
  where(cursor: string): number | undefined {
    return this.cursorOn.get(cursor);
  }

  async send(frame: Frame): Promise<unknown> {
    this.frames.push(frame);
    const params = (frame.params ?? {}) as Record<string, unknown>;

    switch (frame.method) {
      case WIRE.trackList:
        return { tracks: [{ index: 0, channelId: CHANNEL_ID, name: 'gn-fixture' }], count: 1, bankSize: 8, itemCount: 1 };

      case WIRE.revisionGet:
        return { revision: 1 };

      case WIRE.selectionStatus:
        return { trackIndex: -1, slotIndex: -1 };

      case WIRE.slotStatus:
        return { hasContent: this.slots.has(params['slotIndex'] as number) };

      // ⚠ The two frames that MOVE a cursor, paired exactly as the adapter emits
      // them. The trailing selection restore also sends `slot.select`, with no
      // `cursor.pointTrack` in front of it — so consuming `pending` is what keeps
      // the restore from being mistaken for a point.
      case WIRE.cursorPointTrack:
        this.pending = params['cursor'] as string;
        return {};

      case WIRE.slotSelect: {
        if (this.pending !== undefined) {
          this.cursorOn.set(this.pending, params['slotIndex'] as number);
          this.pending = undefined;
        }
        return {};
      }

      case WIRE.cursorStatus: {
        const on = this.cursorOn.get(params['cursor'] as string);
        const model = on === undefined ? undefined : this.slots.get(on);
        return model === undefined ? {} : { loopLength: model.lengthBeats };
      }

      case WIRE.cursorGetNotesVerbose: {
        const on = this.cursorOn.get(params['cursor'] as string);
        const model = on === undefined ? undefined : this.slots.get(on);
        return model === undefined
          ? { notes: [] }
          : { notes: [{ x: 0, y: model.pitch, velocity: 100 / 127, duration: 1 }] };
      }

      default:
        return {};
    }
  }

  async close(): Promise<void> {}
}

/**
 * ⚠ `settle` is stubbed to nothing. Every budget here is a real `setTimeout`
 * (`SETTLE_MS`), and this file asserts POINTING, not timing — paying ~400ms of
 * genuine wall clock to re-measure numbers E1 and E15-D already own would make
 * the offline suite slower for no evidence. The frames are what is under test.
 */
class UntimedAdapter extends LiveAdapter {
  override async settle(): Promise<void> {}
}

test('L-read: a clip revisited after its cursor was EVICTED is re-pointed, not assumed (E2)', async () => {
  // Four clips, a pool of three. The fourth read evicts the first clip's cursor,
  // so when the write-set comes back to that clip it is handed a DIFFERENT cursor
  // — one still sitting on somebody else's music.
  const wire = new CursorModelTransport(new Map([
    [0, { lengthBeats: 4, pitch: 60 }],
    [1, { lengthBeats: 8, pitch: 62 }],
    [2, { lengthBeats: 4, pitch: 64 }],
    [3, { lengthBeats: 4, pitch: 65 }],
  ]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  // ⚠ The shape a real write-set produces, not a contrived one: `note.write` and
  // `note.props` carry a `channel`, so one clip yields two distinct `notes`
  // addresses — and `writeSetOf` orders targets by FIRST MENTION, which puts the
  // other clips in between.
  const snapshot = await adapter.read([
    notesAt(CLIP(0), 0),
    clip(CLIP(1).slot),
    clip(CLIP(2).slot),
    clip(CLIP(3).slot),
    notesAt(CLIP(0), 1),
  ]);

  const revisited = snapshot.entries[addressKey(notesAt(CLIP(0), 1))];
  assert.equal(revisited?.value.of === 'notes' ? revisited.value.notes[0]?.pitch : undefined, 60,
    'the revisited clip must report ITS OWN notes — 62 here would be clip 1\'s, read through a ' +
    'cursor that was never re-pointed');

  // And the same failure the other way round: the length that came back is the
  // revisited clip's, not the evicting clip's.
  const first = snapshot.entries[addressKey(notesAt(CLIP(0), 0))];
  assert.equal(first?.value.of === 'notes' ? first.value.notes[0]?.pitch : undefined, 60);
});

test('L-read: a clip and its notes side by side still cost ONE point', async () => {
  // The other half, and the reason the memo exists at all: the common write-set
  // shape must not pay two point/settle round trips for one clip.
  const wire = new CursorModelTransport(new Map([[0, { lengthBeats: 4, pitch: 60 }]]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await adapter.read([clip(CLIP(0).slot), notesAt(CLIP(0), 0)]);

  const points = wire.frames.filter((f) => f.method === WIRE.cursorPointTrack);
  assert.equal(points.length, 1, 'one clip, one point — the memo is still doing its job');
});

test('L-read: an EMPTY slot is never pointed at, and is exact (E2, D16d)', async () => {
  // E2's original finding, guarded here because the clip-length capture added a
  // second caller to `pointAtClip` and absence must stay free.
  const wire = new CursorModelTransport(new Map([[0, { lengthBeats: 4, pitch: 60 }]]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const snapshot = await adapter.read([clip(CLIP(5).slot)]);

  assert.deepEqual(wire.frames.filter((f) => f.method === WIRE.cursorPointTrack), []);
  const entry = snapshot.entries[addressKey(clip(CLIP(5).slot))];
  assert.equal(entry?.value.of === 'clip' ? entry.value.exists : true, false);
  assert.equal(entry?.fidelity, 'exact');
});

// --- the device mint (D16 amendment 2, live half) ----------------------------

/**
 * A device chain that a cursor has to be POINTED at to see, which is the fact the
 * whole mint rests on: `device.list` reads `rig.cursorDeviceBanks[cursor]`, so it
 * reports the chain of whatever track that cursor is on, not the track anyone
 * named. A stub that ignored the point would certify an adapter that never made
 * one.
 */
class DeviceChainTransport implements Transport {
  readonly frames: Frame[] = [];
  /** cursor ref -> the track index it is pointed at. */
  private readonly cursorOn = new Map<string, number>();
  /** track index -> device names, in chain order. */
  readonly chains = new Map<number, string[]>([[0, ['Polysynth']]]);
  private revision = 1;

  /**
   * What the insert does to the chain. The default appends, which is what
   * `endOfDeviceChainInsertionPoint()` does; the cases below pass stranger ones
   * to prove the diff refuses them rather than picking an index.
   */
  constructor(
    private readonly onInsert: (chain: string[], name: string) => void = (c, n) => c.push(n),
    private readonly itemCountOf: (chain: string[]) => number = (c) => c.length,
  ) {}

  async send(frame: Frame): Promise<unknown> {
    this.frames.push(frame);
    return this.dispatch(frame.method, (frame.params ?? {}) as Record<string, unknown>);
  }

  private dispatch(method: string, params: Record<string, unknown>): unknown {
    switch (method) {
      case WIRE.trackList:
        return { tracks: [{ index: 0, channelId: CHANNEL_ID, name: 'gn-fixture' }], count: 1, bankSize: 8, itemCount: 1 };

      case WIRE.revisionGet:
        return { revision: this.revision };

      case WIRE.selectionStatus:
        return { trackIndex: -1, slotIndex: -1 };

      case WIRE.cursorPointTrack:
        this.cursorOn.set(params['cursor'] as string, params['trackIndex'] as number);
        return {};

      case WIRE.deviceList: {
        const chain = this.chainOf(params['cursor'] as string);
        return {
          devices: chain.map((name, index) => ({ index, name })),
          count: chain.length,
          itemCount: this.itemCountOf(chain),
        };
      }

      case WIRE.deviceInsertBitwig: {
        this.onInsert(this.chainOf(params['cursor'] as string), params['uuid'] as string);
        this.revision++;
        return {};
      }

      case WIRE.deviceDelete: {
        this.chainOf(params['cursor'] as string).splice(params['deviceIndex'] as number, 1);
        this.revision++;
        return {};
      }

      // One request carrying a stage's frames, exactly as `encodeStage` builds it.
      case WIRE.batchRun: {
        const ops = (params['ops'] ?? []) as { method: string; params: Record<string, unknown> }[];
        for (const op of ops) this.dispatch(op.method, op.params);
        return {
          applied: true,
          revision: this.revision,
          results: ops.map((o) => ({ method: o.method, ok: true })),
        };
      }

      default:
        return {};
    }
  }

  async close(): Promise<void> {}

  /** ⚠ The chain the CURSOR is on — an unpointed cursor sees nothing. */
  private chainOf(cursor: string): string[] {
    const on = this.cursorOn.get(cursor);
    if (on === undefined) return [];
    let chain = this.chains.get(on);
    if (chain === undefined) {
      chain = [];
      this.chains.set(on, chain);
    }
    return chain;
  }
}

test('L-mint: an insert reports the chain index it OBSERVED, and the delete undoes it', async () => {
  const wire = new DeviceChainTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'device.insert', track: TRACK, source: { from: 'bitwig', uuid: 'Phaser' } }],
  });

  // The fixture chain already held one device, so the insert landed at 1 — read
  // off the chain, not counted from the request.
  assert.deepEqual(receipt.minted[0], { kind: 'device', track: TRACK, chainIndex: 1 });
  assert.deepEqual(wire.chains.get(0), ['Polysynth', 'Phaser']);

  // ⚠ And the inverse actually reaches that chain, which is the half the old
  // encoding got wrong: `device.delete` addressed a bank row as a pool cursor.
  await adapter.apply({ ops: [{ op: 'device.delete', device: { kind: 'device', track: TRACK, chainIndex: 1 } }] });
  assert.deepEqual(wire.chains.get(0), ['Polysynth'], 'the chain is back where it started');
});

test('L-mint: a chain that did not change the way an append changes it mints NOTHING', async () => {
  // ⚠ Failing CLOSED is the whole design. The index a mint reports is the index a
  // revert DELETES, so an unexplained chain is reported as un-undoable rather
  // than guessed at (D20, E2c). Here the insert lands at the FRONT, which no
  // handler does today — the diff cannot tell which of the two entries is new,
  // and says so by declining.
  const wire = new DeviceChainTransport((chain, name) => chain.unshift(name));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'device.insert', track: TRACK, source: { from: 'bitwig', uuid: 'Phaser' } }],
  });

  assert.deepEqual(receipt.minted, {}, 'the prefix moved, so the observation is not an append');
  assert.deepEqual(wire.chains.get(0), ['Phaser', 'Polysynth'], 'the device is really there');
});

test('L-mint: a chain longer than the device bank window mints NOTHING (E5, one level down)', async () => {
  // Looking is allowed; concluding from a half-view is not. `deviceList` walks
  // `rig.config.deviceBank` slots while `itemCount` is the chain's true length, so
  // a diff over a partial view cannot tell an insert from something scrolling in.
  const wire = new DeviceChainTransport(undefined, (chain) => chain.length + 4);
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'device.insert', track: TRACK, source: { from: 'bitwig', uuid: 'Phaser' } }],
  });

  assert.deepEqual(receipt.minted, {});
});

test('L-mint: the insert is addressed to a POINTED cursor, not to a bank row', async () => {
  // The defect underneath the missing mint. Every device handler resolves
  // `rig.cursorTrack(ref)` by POOL index, so an op that names a bank row reaches
  // whichever cursor shares that number — and reports `ok` while doing it.
  const wire = new DeviceChainTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await adapter.apply({
    ops: [{ op: 'device.insert', track: TRACK, source: { from: 'bitwig', uuid: 'Phaser' } }],
  });

  // The stage's frames travel INSIDE one `batch.run`, which is where "point, then
  // act, in the same request" has to be true — a point in an earlier request is a
  // different turn and proves nothing about what the insert reached.
  const batch = wire.frames.find((f) => f.method === WIRE.batchRun);
  const ops = ((batch?.params as Record<string, unknown> | undefined)?.['ops'] ?? []) as
    { method: string; params: Record<string, unknown> }[];

  const insertAt = ops.findIndex((o) => o.method === WIRE.deviceInsertBitwig);
  const cursor = ops[insertAt]?.params['cursor'];
  assert.equal(typeof cursor, 'string', 'the insert names a CURSOR, never a trackIndex');
  assert.equal(ops[insertAt]?.params['trackIndex'], undefined, 'and carries no trackIndex to be mistaken for one');

  const point = ops[insertAt - 1];
  assert.equal(point?.method, WIRE.cursorPointTrack, 'the point is immediately in front of the op');
  assert.equal(point?.params['cursor'], cursor);
  assert.equal(point?.params['trackIndex'], 0, 'pointed at the track the op NAMED');
});
