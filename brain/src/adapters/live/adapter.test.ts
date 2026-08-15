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
  addressKey, chain as chainAt, clip, device as deviceAt, deviceIn as deviceInAt,
  notes as notesAt, scene, slot, track,
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
        // ⚠ The mark now carries both epochs and the generation nonce, because
        // the extension owns them (session 3). A stub that answers only
        // `revision` makes every scene-relative address read as stale, which is
        // the right failure — it is the adapter refusing an epoch it never saw.
        return { revision: 1, generation: 'stub-gen', sceneEpoch: 1, contentEpoch: 0, contentEvents: [] };

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
        return {
          revision: this.revision,
          generation: 'stub-gen',
          sceneEpoch: 1,
          contentEpoch: 0,
          contentEvents: [],
        };

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

// --- chain observation: the wire mapping, and what it refuses ------------------

/**
 * A `chain.inventory`-shaped stub, and — like `CursorModelTransport` — it answers
 * from the track CURSOR 0 IS ON rather than from the track the adapter asked
 * about. A stub that echoed the request back could not fail for the bug the
 * identity guard exists to catch: an inventory of somebody else's container,
 * reported under this address, with every field looking healthy.
 */
class InventoryTransport implements Transport {
  readonly frames: Frame[] = [];
  /** Which track cursor 0 is pointed at, by bank index. Nothing points it at first. */
  private pointed: number | undefined;

  constructor(
    /** bank index -> that track's channelId. */
    private readonly tracks: ReadonlyMap<number, string>,
    /** channelId -> scopes, exactly as the extension would report them. */
    private readonly inventory: ReadonlyMap<string, unknown[]>,
    /** ⚠ An extension too old to send the identity and the bank sizes. */
    private readonly stale = false,
    /**
     * ⚠ A cursor that DOES NOT MOVE when pointed — the failure the identity
     * guard exists for. It is not hypothetical: `cursor.pointTrack` is
     * `CursorTrack.selectChannel`, and a bank row that is not what the adapter
     * thinks it is (a re-index, a stale scan) points it somewhere else while
     * every call still succeeds.
     */
    private readonly stuckOn?: number,
  ) {
    this.pointed = stuckOn;
  }

  async send(frame: Frame): Promise<unknown> {
    this.frames.push(frame);
    const params = (frame.params ?? {}) as Record<string, unknown>;
    switch (frame.method) {
      case WIRE.trackList:
        return {
          tracks: [...this.tracks].map(([index, channelId]) => ({ index, channelId, name: `t${index}` })),
          count: this.tracks.size, bankSize: 8, itemCount: this.tracks.size,
        };
      case WIRE.revisionGet:
        return { revision: 1, generation: 'stub-gen', sceneEpoch: 1, contentEpoch: 0, contentEvents: [] };
      case WIRE.cursorPointTrack:
        if (params['cursor'] === '0' && this.stuckOn === undefined) {
          this.pointed = params['trackIndex'] as number;
        }
        return {};
      case WIRE.chainInventory: {
        const on = this.pointed === undefined ? undefined : this.tracks.get(this.pointed);
        const scopes = (on === undefined ? undefined : this.inventory.get(on)) ?? [];
        const stripped = this.stale
          ? (scopes as Record<string, unknown>[]).map(({ chainBankSize, deviceBankSize, ...rest }) => rest)
          : scopes;
        return this.stale
          ? { scopes: stripped, trackName: 'whoever' }
          : { scopes: stripped, trackName: 'whoever', trackChannelId: on };
      }
      default:
        return {};
    }
  }

  async close(): Promise<void> {}
}

const CONTAINER_SCOPE = (chains: { index: number; name: string; devices?: { index: number; name: string }[] }[]) => ({
  slot: 0,
  status: 'held',
  deviceExists: true,
  deviceName: 'FX Layer',
  chains: chains.map((c) => ({ ...c, devices: c.devices ?? [] })),
  chainCount: chains.length,
  chainBankSize: 4,
  deviceBankSize: 4,
});

const OTHER_ID = 'e4a1c0de-0000-4000-8000-000000000002';

test('L-chain: a chain resolves by name, at the bank position the container reported', async () => {
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([{ index: 2, name: 'A take' }])]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const target = chainAt(deviceAt(TRACK, 0), 'A take');
  const hit = (await adapter.resolve([target])).resolved[0];

  assert.equal(hit?.found, true);
  assert.equal(hit?.index, 2, 'the BANK position, not the position in the reply array');
  // ⚠ And it pointed cursor 0 specifically: the slot scopes were built from
  // `cursorDeviceBanks[0]` at init and follow that one cursor. A pool ref would
  // scope the read to whatever track that cursor happened to hold.
  const point = wire.frames.find((f) => f.method === WIRE.cursorPointTrack);
  assert.equal((point?.params as Record<string, unknown>)['cursor'], '0');
});

test('L-chain: an inventory of ANOTHER track is refused, not reported under this address', async () => {
  // ⚠⚠ The e16o trap, one level up, and the reason a name is not enough here.
  // The cursor stays on track 1, so the reply is about a DIFFERENT container —
  // well-formed, healthy, and describing somebody else's chains. Under this
  // address it would be a chain that resolves to the wrong object, which is the
  // whole failure class the nested seam exists to prevent.
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID], [1, OTHER_ID]]),
    new Map([[OTHER_ID, [CONTAINER_SCOPE([{ index: 0, name: 'A take' }])]]]),
    false,
    1,
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const hit = (await adapter.resolve([chainAt(deviceAt(TRACK, 0), 'A take')])).resolved[0];
  // ⚠ `unsupported`: nothing about the addressed container was observed at all.
  // `absent` would be a claim about a container we never looked into.
  assert.deepEqual({ found: hit?.found, reason: hit?.reason }, { found: false, reason: 'unsupported' });
});

test('L-chain: an extension too old to report the bank sizes never answers `absent`', async () => {
  // ⚠ `methodsHash` is over method NAMES, so a deployment that predates these
  // reply fields answers the completeness question with silence — and silence
  // must fail closed. Every zero-match becomes a window answer instead of a
  // tombstone, which is the difference between "we could not see it" and "it is
  // not there".
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([{ index: 0, name: 'A take' }])]]]),
    true,
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const hit = (await adapter.resolve([chainAt(deviceAt(TRACK, 0), 'nope')])).resolved[0];
  // ⚠ `unsupported` and not `absent`: without `trackChannelId` the observation
  // cannot even be attributed to the right track, so it is refused whole.
  assert.deepEqual({ found: hit?.found, reason: hit?.reason }, { found: false, reason: 'unsupported' });
});

test('L-chain: a scope whose handle was never built is unsupported, never absent', async () => {
  // Standing rule 13, as instrumentation: "the handle does not exist" and "the
  // API declines" are indistinguishable in the outcome, and three false ○s in
  // E17 came from exactly that.
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [{ ...CONTAINER_SCOPE([]), status: 'failed: NoSuchMethod' }]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const hit = (await adapter.resolve([chainAt(deviceAt(TRACK, 0), 'A take')])).resolved[0];
  assert.deepEqual({ found: hit?.found, reason: hit?.reason }, { found: false, reason: 'unsupported' });
});

test('L-chain: a duplicated NAME refuses as ambiguous rather than taking the first', async () => {
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([
      { index: 0, name: 'A take' },
      { index: 1, name: 'A take' },
    ])]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const hit = (await adapter.resolve([chainAt(deviceAt(TRACK, 0), 'A take')])).resolved[0];
  assert.deepEqual({ found: hit?.found, reason: hit?.reason }, { found: false, reason: 'ambiguous' });
});

test('L-chain: a container read carries the chains — the only way a name is ever learned', async () => {
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([
      { index: 0, name: 'A take', devices: [{ index: 0, name: 'Polysynth' }] },
    ])]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const snapshot = await adapter.read([deviceAt(TRACK, 0)]);
  const entry = snapshot.entries[addressKey(deviceAt(TRACK, 0))];
  assert.equal(entry?.value.of, 'device');
  const observed = entry?.value.of === 'device' ? entry.value.device : undefined;
  assert.equal(observed?.container?.chains[0]?.name, 'A take');
  assert.equal(observed?.container?.chains[0]?.devices[0]?.name, 'Polysynth');
  // ⚠ NO PARAMETERS, and absent rather than empty: this route has no parameter
  // handle at all, and `[]` would assert a device with no controls.
  assert.equal(observed?.params, undefined);
});

test('L-chain: an inventory still naming the PREVIOUS track is retried, not reported as a miss', async () => {
  // ⚠⚠ Measured 2026-08-15: `chain.inventory` follows a re-pointed cursor at a
  // structural pace, not a cursor-point one — it named the track just pointed at
  // 0/6 immediately, 3/6 at the 25ms `cursorPoint` budget this read was
  // borrowing, and 6/6 only from 100ms. So the identity guard was firing on
  // containers that were perfectly observable a tick later, and `C-chain-switch`
  // failed two live runs in three on it. A mismatch is a staleness signal, never
  // an observation, so it is retried within a bound; every other miss still
  // answers at once because each of those IS an observation.
  class LaggingInventory extends InventoryTransport {
    private reads = 0;

    override async send(frame: Frame): Promise<unknown> {
      const reply = await super.send(frame);
      if (frame.method !== WIRE.chainInventory) return reply;
      this.reads += 1;
      // The first two reads still describe wherever the cursor used to be.
      return this.reads <= 2
        ? { ...(reply as Record<string, unknown>), trackChannelId: 'some-other-track' }
        : reply;
    }
  }
  const wire = new LaggingInventory(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([{ index: 0, name: 'A take' }])]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const entry = (await adapter.read([deviceAt(TRACK, 0)]))
    .entries[addressKey(deviceAt(TRACK, 0))];
  const observed = entry?.value.of === 'device' ? entry.value.device : undefined;
  assert.equal(observed?.container?.chains[0]?.name, 'A take',
    'the lagging reply was waited out rather than answered as unobservable');
  // ⚠ And it re-POINTS each time rather than only re-reading: the cursor is what
  // the stale reply is stale about, so a bare re-read could wait forever.
  assert.equal(
    wire.frames.filter((f) => f.method === WIRE.cursorPointTrack).length,
    wire.frames.filter((f) => f.method === WIRE.chainInventory).length,
  );
});

test('L-chain: a cursor that never arrives is still a refusal, not an endless wait', async () => {
  // The bound is what keeps the retry above from turning a real miss into a
  // hang. `stuckOn` models a point that succeeds and moves nothing.
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID], [1, 'other-channel']]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([{ index: 0, name: 'A take' }])]]]),
    false,
    1,
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const hit = (await adapter.resolve([chainAt(deviceAt(TRACK, 0), 'A take')])).resolved[0];
  assert.equal(hit?.found, false, 'another track\'s container is never reported under this address');
  assert.ok(wire.frames.filter((f) => f.method === WIRE.chainInventory).length <= 8);
});

test('L-chain: a device INSIDE a chain reads its own name, never the track chain\'s', async () => {
  // ⚠ The `C-nested-device` hazard, from the observation side: `chainIndex` 0
  // means two different devices depending on whether the address is nested, and
  // the track's own chain holds something at that position too.
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([
      { index: 0, name: 'A take', devices: [{ index: 0, name: 'inner-polysynth' }] },
    ])]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const inner = deviceInAt(chainAt(deviceAt(TRACK, 0), 'A take'), 0);
  const snapshot = await adapter.read([inner]);
  const entry = snapshot.entries[addressKey(inner)];
  assert.equal(entry?.value.of === 'device' ? entry.value.device.name : undefined, 'inner-polysynth');
});

// --- chain creation: the first typed write inside a container ------------------

interface StubChain {
  name: string;
  channelId: string;
  solo: boolean;
}

/**
 * A container that can really be duplicated into — and, like every other stub in
 * this file, one that answers from what it ACTUALLY holds rather than from what
 * the adapter asked for.
 *
 * ⚠ Two behaviours are modelled because they are the two the create rests on,
 * and neither is a convenience:
 *
 *   - `duplicate` DOES NOTHING WITHOUT A SELECTION (`e17ak` arm A ○ against arm
 *     B ●●). A stub that copied unconditionally would pass a build that never
 *     sent `chain.select`, which is the single call the whole route turned on
 *     and which the whole spike missed for six sessions;
 *   - the copy carries the SOURCE'S NAME and a fresh `channelId`. That is what
 *     makes the container ambiguous in the middle of the verb, and it is why the
 *     rename has to be addressed by identity.
 */
class ChainCreateTransport implements Transport {
  readonly frames: Frame[] = [];
  readonly chains: StubChain[] = [{ name: 'gn-shipped', channelId: 'chain-id-1', solo: false }];
  private pointed: number | undefined;
  private selected: number | undefined;
  private revision = 1;
  private minted = 1;

  constructor(
    /** ⚠ `stale` drops the per-chain ids, as an extension too old to send them. */
    private readonly stale = false,
    /** ⚠ `deaf` accepts the duplicate and does nothing — the silent no-op class. */
    private readonly deaf = false,
    /**
     * ⚠ `refuseRename` throws from `chain.setName`, which the real extension
     * does — deliberately — when no chain in the scope carries the id, i.e.
     * when the bank re-indexed between the two readings.
     */
    private readonly refuseRename = false,
    /** Simulate an older/failed observer that cannot report exact solo state. */
    private readonly omitSolo = false,
  ) {}

  async send(frame: Frame): Promise<unknown> {
    this.frames.push(frame);
    return this.dispatch(frame.method, (frame.params ?? {}) as Record<string, unknown>);
  }

  private dispatch(method: string, params: Record<string, unknown>): unknown {
    switch (method) {
      case WIRE.trackList:
        return {
          tracks: [{ index: 0, channelId: CHANNEL_ID, name: 'gn-fixture' }],
          count: 1, bankSize: 8, itemCount: 1,
        };
      case WIRE.revisionGet:
        return {
          revision: this.revision, generation: 'stub-gen',
          sceneEpoch: 1, contentEpoch: 0, contentEvents: [],
        };
      case WIRE.selectionStatus:
        return { trackIndex: -1, slotIndex: -1 };
      case WIRE.cursorPointTrack:
        if (params['cursor'] === '0') this.pointed = params['trackIndex'] as number;
        return {};

      case WIRE.chainInventory: {
        // ⚠ Answers for the track cursor 0 is really ON, so a missing point
        // reads as a missing container rather than as the right one.
        if (this.pointed !== 0) return { scopes: [], trackName: 'nobody' };
        return {
          trackName: 'gn-fixture',
          trackChannelId: CHANNEL_ID,
          scopes: [{
            slot: 0,
            status: 'held',
            deviceExists: true,
            deviceName: 'FX Layer',
            chains: this.chains.map((c, index) => ({
              index,
              name: c.name,
              ...(this.stale ? {} : { channelId: c.channelId }),
              ...(this.omitSolo ? {} : { solo: c.solo }),
              devices: [],
            })),
            chainCount: this.chains.length,
            chainBankSize: 4,
            deviceBankSize: 4,
          }],
        };
      }

      case WIRE.chainSelect: {
        const at = params['layerIndex'] as number;
        const chain = this.chains[at];
        if (chain === undefined) throw new Error(`no chain at ${at}`);
        if (params['expectedName'] !== chain.name) throw new Error('stale position');
        this.selected = at;
        return {};
      }

      case WIRE.chainDuplicate: {
        const at = params['layerIndex'] as number;
        const source = this.chains[at];
        if (source === undefined) throw new Error(`no chain at ${at}`);
        // ⚠ `e17ak` arm A: with nothing selected this call returns cleanly and
        // does nothing at all.
        if (this.selected !== at || this.deaf) return {};
        this.chains.splice(at + 1, 0, {
          name: source.name,
          channelId: `chain-id-${++this.minted + 1}`,
          solo: source.solo,
        });
        this.revision++;
        return {};
      }

      case WIRE.chainSetName: {
        if (this.refuseRename) throw new Error('no chain in scope 0 has channelId ' + params['channelId']);
        const hit = this.chains.find((c) => c.channelId === params['channelId']);
        if (hit === undefined) throw new Error('no chain with that channelId');
        hit.name = params['name'] as string;
        this.revision++;
        return {};
      }

      case WIRE.chainActivate: {
        const at = params['layerIndex'] as number;
        const target = this.chains[at];
        if (target === undefined || target.name !== params['expectedName']) {
          throw new Error('stale activation position');
        }
        if (params['expectedTrackChannelId'] !== CHANNEL_ID) throw new Error('stale track');
        for (const [index, item] of this.chains.entries()) item.solo = index === at;
        this.revision++;
        return {};
      }

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
}

const SHIPPED = () => chainAt(deviceAt(TRACK, 0), 'gn-shipped');

test('L-chain-rename: the observed identity is renamed and independently resolved', async () => {
  const wire = new ChainCreateTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'chain.rename', chain: SHIPPED(), name: 'gn-source' }],
  });

  assert.equal(receipt.stages[0]?.ops[0]?.ok, true);
  assert.deepEqual(wire.chains.map((item) => item.name), ['gn-source']);
  const rename = wire.frames.find((frame) => frame.method === WIRE.batchRun)
    ?.params as { ops?: { method: string; params: Record<string, unknown> }[] };
  const frame = rename.ops?.find((item) => item.method === WIRE.chainSetName);
  assert.equal(frame?.params['channelId'], 'chain-id-1');
  assert.equal(frame?.params['name'], 'gn-source');
});

test('L-chain-create: the copy is SELECTED first, then named by the id it was observed with', async () => {
  const wire = new ChainCreateTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'chain.create', source: SHIPPED(), name: 'gn-B' }],
  });

  // ⚠ The mint is a NAME-shaped address, because a name is the only durable
  // thing a chain has (E17ad, E18b) — never the channelId the diff used.
  assert.deepEqual(receipt.minted[0], chainAt(deviceAt(TRACK, 0), 'gn-B'));
  assert.deepEqual(wire.chains.map((c) => c.name), ['gn-shipped', 'gn-B'],
    'the source keeps its name and the copy got the new one');

  // ⚠⚠ The select is its OWN request, ahead of the batch — not a frame inside
  // it. Bundled into the duplicate's turn it would rest on a same-turn
  // visibility E2 says does not exist, and would fail as a silent no-op.
  const order = wire.frames.map((f) => f.method);
  const selectAt = order.indexOf(WIRE.chainSelect);
  const batchAt = order.findIndex((m, i) => m === WIRE.batchRun && i > selectAt);
  assert.ok(selectAt >= 0 && batchAt > selectAt, 'select comes before the batch that duplicates');
  const batch = wire.frames[batchAt]!.params as Record<string, unknown>;
  const inBatch = (batch['ops'] as { method: string }[]).map((o) => o.method);
  assert.deepEqual(inBatch, [WIRE.chainDuplicate], 'and is not repeated inside it');

  // ⚠ The rename names the CHAIN THAT WAS CREATED, by the identity the diff
  // returned — not the source, and not a position.
  const rename = wire.frames.find((f) => f.method === WIRE.chainSetName)
    ?.params as Record<string, unknown>;
  assert.equal(rename['name'], 'gn-B');
  assert.equal(rename['channelId'], wire.chains[1]!.channelId);
  assert.notEqual(rename['channelId'], 'chain-id-1', 'the SOURCE must never be the rename target');
});

test('L-chain-create: a duplicate that silently did nothing mints NOTHING and says so', async () => {
  // ⚠⚠ The failure that has to be loud. `chain.duplicate` acknowledges
  // identically whether or not anything happened (E6 blocker 4), so a receipt
  // that trusted it would report a create that produced no chain as a success.
  const wire = new ChainCreateTransport(false, true);
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'chain.create', source: SHIPPED(), name: 'gn-B' }],
  });

  assert.deepEqual(receipt.minted, {});
  assert.deepEqual(wire.chains.map((c) => c.name), ['gn-shipped'], 'nothing was created');
  assert.equal(wire.frames.some((f) => f.method === WIRE.chainSetName), false,
    'and nothing was renamed — a rename on an unidentified chain is how the source loses its name');
  const failed = receipt.stages.flatMap((s) => s.ops).filter((o) => !o.ok);
  assert.equal(failed.length, 1, 'the op is reported failed even though the wire said ok');
  assert.match(failed[0]?.error ?? '', /exactly one more was expected/);
});

test('L-chain-create: an extension too old to report chain ids mints NOTHING', async () => {
  // Silence must fail closed: `methodsHash` is over method NAMES, so a
  // deployment that predates the per-chain `channelId` cannot be detected at the
  // handshake. Falling back to position would rename by guesswork.
  const wire = new ChainCreateTransport(true);
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'chain.create', source: SHIPPED(), name: 'gn-B' }],
  });

  assert.deepEqual(receipt.minted, {});
  assert.deepEqual(wire.chains.map((c) => c.name), ['gn-shipped', 'gn-shipped'],
    '⚠ the copy is REAL and is wearing the source name — which is what the failure has to report');
  const failed = receipt.stages.flatMap((s) => s.ops).filter((o) => !o.ok);
  assert.match(failed[0]?.error ?? '', /names two chains and neither resolves/);
});

test('L-chain-create: a rename the extension REFUSES is reported, never thrown', async () => {
  // ⚠⚠ The regression this row exists for. `chain.setName` refuses an id no
  // chain in the scope carries — that refusal is correct and deliberate — but by
  // the time it fires the COPY ALREADY EXISTS. An exception escaping `apply`
  // here would leave the caller with no receipt at all for a container that now
  // holds an unaddressable chain, and there is no typed delete to clean it up
  // with, so the sentence in the receipt is the entire remedy.
  const wire = new ChainCreateTransport(false, false, true);
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'chain.create', source: SHIPPED(), name: 'gn-B' }],
  });

  assert.deepEqual(receipt.minted, {}, 'nothing may be minted for a chain that was never named');
  const failed = receipt.stages.flatMap((s) => s.ops).filter((o) => !o.ok);
  assert.equal(failed.length, 1);
  // ⚠ The extension's own words are carried through verbatim: they are the only
  // thing that says WHY the rename was declined.
  assert.match(failed[0]?.error ?? '', /no chain in scope 0 has channelId/);
  assert.match(failed[0]?.error ?? '', /names two chains and neither resolves/);
  assert.deepEqual(wire.chains.map((c) => c.name), ['gn-shipped', 'gn-shipped'],
    'and the copy really is there, wearing the source name — which is what the report is about');
});

test('L-chain-create: a name the container already holds is refused before any frame', async () => {
  const wire = new ChainCreateTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await assert.rejects(
    adapter.apply({ ops: [{ op: 'chain.create', source: SHIPPED(), name: 'gn-shipped' }] }),
    /leave two chains sharing one name/,
  );
  assert.equal(wire.frames.some((f) => f.method === WIRE.chainDuplicate), false);
  assert.deepEqual(wire.chains.map((c) => c.name), ['gn-shipped']);
});

test('L-chain-create: a source the container does not hold is refused before any frame', async () => {
  const wire = new ChainCreateTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await assert.rejects(
    adapter.apply({
      ops: [{ op: 'chain.create', source: chainAt(deviceAt(TRACK, 0), 'nope'), name: 'gn-B' }],
    }),
    /source chain "nope" is absent/,
  );
  assert.equal(wire.frames.some((f) => f.method === WIRE.chainSelect), false);
});

test('L-chain-create: a container with no observable scope is refused, not written blind', async () => {
  const wire = new ChainCreateTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  // Position 4 is past the scopes the stub reports, exactly as it would be past
  // `Rig.SLOT_SCOPES` live — and a chain created out there could be resolved by
  // nothing and removed by nothing.
  await assert.rejects(
    adapter.apply({
      ops: [{ op: 'chain.create', source: chainAt(deviceAt(TRACK, 4), 'gn-shipped'), name: 'gn-B' }],
    }),
    /no container scope covers device position 4/,
  );
  assert.equal(wire.frames.some((f) => f.method === WIRE.chainDuplicate), false);
});

test('L-chain-activate: exact independent readback proves one active sibling', async () => {
  const wire = new ChainCreateTransport();
  wire.chains[0]!.solo = true;
  wire.chains.push({ name: 'gn-B', channelId: 'chain-id-2', solo: false });
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'chain.activate', chain: chainAt(deviceAt(TRACK, 0), 'gn-B') }],
  });
  assert.equal(receipt.stages[0]?.ops[0]?.ok, true);
  assert.deepEqual(wire.chains.map((item) => [item.name, item.solo]), [
    ['gn-shipped', false], ['gn-B', true],
  ]);
  const batch = wire.frames.find((frame) => frame.method === WIRE.batchRun);
  const ops = ((batch?.params as Record<string, unknown> | undefined)?.['ops'] ?? []) as
    { method: string }[];
  assert.equal(ops.some((frame) => frame.method === WIRE.chainActivate), true);
});

test('L-chain-activate: missing solo observation refuses before the write frame', async () => {
  const wire = new ChainCreateTransport(false, false, false, true);
  wire.chains.push({ name: 'gn-B', channelId: 'chain-id-2', solo: false });
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await assert.rejects(
    adapter.apply({
      ops: [{ op: 'chain.activate', chain: chainAt(deviceAt(TRACK, 0), 'gn-B') }],
    }),
    /solo state was not observed exactly/,
  );
  assert.equal(wire.frames.some((frame) => frame.method === WIRE.chainActivate), false);
});

test('L-chain: a container position with no scope is UNREACHABLE on a read, not missing', async () => {
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([{ index: 0, name: 'A take' }])]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  // Position 4 is past the scopes the stub reports, exactly as it would be past
  // `Rig.SLOT_SCOPES` live.
  const far = chainAt(deviceAt(TRACK, 4), 'A take');
  const snapshot = await adapter.read([far]);
  assert.deepEqual(snapshot.unreachable.map(addressKey), [addressKey(far)]);
  assert.deepEqual(snapshot.missing, []);
});
